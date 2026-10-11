import "server-only";
import { getCarsystemProductBySlug, getProductVariantSelector } from "@/lib/carsystem-data";
import { loadCustomerPurchasedArticles } from "@/lib/customers/customer-queries";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { loadArticleRequestPrices, type RequestLine } from "@/lib/ordering/request-service";
import { suggestedPacks } from "@/lib/ordering/packRule.mjs";
import { variantRedirectTarget } from "@/lib/product-families";
import { loadCustomerProfile } from "@/lib/recommendations/customer-profile";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import {
  formatQuantity,
  linkedProduct,
  orderReorderItems,
  reorderReason,
  resolveVariant,
  usualQuantity,
} from "@/lib/customers/reorderRules.mjs";

/**
 * Stavka „Poručite ponovo" — tačno ono što kupac vidi, ništa više.
 *
 * Nema cene, stanja ni rabata. `product` postoji samo uz POTVRĐENU vezu sa
 * katalogom; bez nje stavka nosi naziv sa fakture i put do kupčevih faktura.
 */
export type ReorderItem = {
  articleCode: string;
  /** Naziv sa kupčeve fakture (BizniSoft), uvek prisutan. */
  documentName: string;
  reason: string;
  /** Uobičajena količina po kupovini, samo kada je pouzdana. */
  usualQuantity: string | null;
  lastPurchaseOn: string;
  product: {
    slug: string;
    name: string;
    href: string;
    image: { src: string; alt: string } | null;
    variantLabel: string | null;
    /** Veza je ručno potvrđena demo veza, ne stvarna. */
    demoLink: boolean;
  } | null;
  /** Put kada veza sa katalogom ne postoji: kupčeve fakture sa ovim artiklom. */
  invoicesHref: string;
  /**
   * Poručivo SADA: poručivanje uključeno za firmu i bar jedna odobrena opcija
   * plaćanja ima cenu (isti obračun kao korpa). Puni ISTU korpu.
   */
  orderable: boolean;
  /** Podaci za unos broja pakovanja; `null` kada artikal nije poručiv. */
  order: {
    articleId: string;
    unit: string;
    /** Potvrđeno pojedinačno pakovanje (količina u JM) — poručuju se cela pakovanja. */
    pack: { label: string; quantity: number };
    /** Predlog broja pakovanja; `null` kada uobičajena količina nije ceo broj pakovanja (ne zaokružuje se). */
    suggestedPacks: number | null;
    /** Objašnjenje kada predloga nema (npr. „ranije 7 L, pakovanje 5 L“). */
    suggestionNote: string | null;
    /** Cena celog pakovanja i cena po JM, po svakoj odobrenoj opciji plaćanja, bez PDV-a. */
    prices: { label: string; packNet: number; netPrice: number; vatPercent: number }[];
  } | null;
  /** Zašto se ne poručuje preko sajta iako ima cenu (npr. pakovanje nije potvrđeno). */
  orderNote: string | null;
};

export type ReorderList = {
  items: ReorderItem[];
  /** Koliko kupljenih artikala postoji ukupno (pre ograničenja liste). */
  totalArticles: number;
  demo: boolean;
  dataUntil: string;
};

function imageOf(src: string | null | undefined, alt: string) {
  if (!src || /placeholder/i.test(src)) return null;
  return { src, alt };
}

function orderFields(
  line: RequestLine | undefined,
  options: { key: string; label: string }[],
  events: { quantity: number; units: (string | null)[] }[],
): Pick<ReorderItem, "orderable" | "order" | "orderNote"> {
  if (!line) return { orderable: false, order: null, orderNote: null };
  const priced = options.some((o) => line.byOption[o.key]?.status === "cena");
  if (!line.pack) return { orderable: false, order: null, orderNote: priced ? line.packProblem : null };
  if (line.problem) return { orderable: false, order: null, orderNote: null };
  const pack = line.pack;
  const prices = options.flatMap((o) => {
    const p = line.byOption[o.key];
    return p?.status === "cena" && p.packAmounts ? [{ label: o.label, packNet: p.packAmounts.net, netPrice: p.netPrice, vatPercent: p.vatPercent }] : [];
  });
  if (!prices.length) return { orderable: false, order: null, orderNote: null };
  // Uobičajena količina sa faktura je u JM; predlog je broj celih pakovanja (inače 1).
  const usual = usualQuantity(events);
  const sameUnit = Boolean(usual && usual.unit?.toUpperCase() === line.unit);
  const suggested = usual && sameUnit ? suggestedPacks(usual.low, pack.quantity) : 1;
  const qty = (n: number) => String(n).replace(".", ",");
  const suggestionNote =
    suggested === null && usual
      ? `Uobičajeno ste kupovali ${qty(usual.low)} ${line.unit}, a pakovanje je ${pack.label} — to nije ceo broj pakovanja. Unesite broj pakovanja.`
      : null;
  return {
    orderable: true,
    order: { articleId: line.articleId, unit: line.unit, pack: { label: pack.label, quantity: pack.quantity }, suggestedPacks: suggested, suggestionNote, prices },
    orderNote: null,
  };
}

/** Samo kupčeva istorija. `customerId` dolazi isključivo iz kupčeve sesije. */
export async function loadReorderList(customerId: string, now: Date = new Date()): Promise<ReorderList> {
  if (!customerId) {
    throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  }
  const [profile, purchased, dataset] = await Promise.all([
    loadCustomerProfile(customerId, now),
    loadCustomerPurchasedArticles(customerId, belgradeDate(now)),
    loadDatasetInfo(),
  ]);
  const byCode = new Map(purchased.map((p) => [p.articleCode, p]));
  const rhythmCurrent = profile.freshness.state === "current";

  const candidates = profile.articles.map((a) => ({
    ...a,
    rhythmCurrent: rhythmCurrent && !a.statusOutdated,
  }));
  const chosen = orderReorderItems(candidates);

  // Cene iz ISTOG obračuna kao korpa (dok. 61 K4): šifra → artikal → priceLines.
  const codes = chosen.map((a) => a.articleCode);
  const idRows = codes.length
    ? [...(await getDb().execute<{ id: string; code: string }>(sql`SELECT id, code FROM articles WHERE code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`))]
    : [];
  const idByCode = new Map(idRows.map((r) => [r.code, r.id]));
  const priced = await loadArticleRequestPrices(customerId, idRows.map((r) => r.id));

  const items: ReorderItem[] = chosen.map((a) => {
    const bought = byCode.get(a.articleCode);
    const mapping = bought?.mapping ?? null;
    const product =
      mapping && linkedProduct(mapping, (slug: string) => Boolean(getCarsystemProductBySlug(slug)))
        ? getCarsystemProductBySlug(mapping.catalogProductSlug!)!
        : null;

    let presented: ReorderItem["product"] = null;
    if (product) {
      const selector = getProductVariantSelector(product);
      const variant = resolveVariant(mapping!.catalogVariantId, selector?.variants ?? []);
      const row = variant ? selector?.variants.find((v) => (v.sku ?? v.id) === variant.key) : null;
      presented = {
        slug: product.slug,
        name: product.name,
        // Kanonska adresa odmah: varijanta porodice vodi na stranicu porodice, bez preusmerenja.
        href: variant
          ? `/proizvodi/${product.slug}?varijanta=${encodeURIComponent(variant.key)}`
          : (variantRedirectTarget(product) ?? `/proizvodi/${product.slug}`),
        image: imageOf(row?.image ?? product.productImage?.src, product.productImage?.alt ?? product.name),
        variantLabel: variant?.label ?? null,
        demoLink: /^DEMO\b/i.test(mapping!.note ?? ""),
      };
    }

    return {
      articleCode: a.articleCode,
      documentName: a.articleName ?? a.articleCode,
      reason: reorderReason(a),
      usualQuantity: formatQuantity(usualQuantity(bought?.events ?? [])),
      lastPurchaseOn: a.lastPurchaseOn,
      product: presented,
      invoicesHref: `/kupac/fakture?q=${encodeURIComponent(a.articleCode)}`,
      ...orderFields(priced.lines.get(idByCode.get(a.articleCode) ?? ""), priced.options, bought?.events ?? []),
    };
  });

  return {
    items,
    totalArticles: profile.articles.length,
    demo: dataset.kind === "demo",
    dataUntil: profile.today,
  };
}
