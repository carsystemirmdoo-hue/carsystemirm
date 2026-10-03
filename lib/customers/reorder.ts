import "server-only";
import { getCarsystemProductBySlug, getProductVariantSelector } from "@/lib/carsystem-data";
import { loadCustomerPurchasedArticles } from "@/lib/customers/customer-queries";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { loadOffersByCode } from "@/lib/ordering/ordering-service";
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
   * Poručivo SADA: potvrđena veza, tačna varijanta, stavka aktivnog cenovnika
   * i uključeno poručivanje. Samo tada kartica nudi količinu i korpu.
   */
  orderable: boolean;
  /** Podaci za unos količine; `null` kada artikal nije poručiv. */
  order: {
    unit: string;
    packLabel: string;
    netPrice: number;
    vatPercent: number;
    currency: string;
    step: number;
    suggestedQuantity: number;
    demoPriceList: boolean;
  } | null;
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
  offer: Awaited<ReturnType<typeof loadOffersByCode>> extends Map<string, infer T> ? T | undefined : never,
  presented: ReorderItem["product"],
  events: { quantity: number; units: (string | null)[] }[],
): Pick<ReorderItem, "orderable" | "order"> {
  // Poručiva stavka mora biti i PRIKAZANA kao proizvod — ista potvrđena veza.
  if (!offer || offer.problem || !offer.price || !presented) return { orderable: false, order: null };
  const usual = usualQuantity(events);
  const step = offer.price.quantityStep;
  const suggested = usual && usual.unit === offer.price.unit ? Math.max(offer.price.minQuantity, Math.round(usual.low / step) * step) : offer.price.minQuantity;
  return {
    orderable: true,
    order: {
      unit: offer.price.unit,
      packLabel: offer.price.packLabel,
      netPrice: offer.price.netPrice,
      vatPercent: offer.price.vatPercent,
      currency: offer.price.currency,
      step,
      suggestedQuantity: suggested,
      demoPriceList: offer.price.listKind === "demo",
    },
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

  const offers = await loadOffersByCode(customerId, chosen.map((a) => a.articleCode));

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
      ...orderFields(offers.get(a.articleCode), presented, bought?.events ?? []),
    };
  });

  return {
    items,
    totalArticles: profile.articles.length,
    demo: dataset.kind === "demo",
    dataUntil: profile.today,
  };
}
