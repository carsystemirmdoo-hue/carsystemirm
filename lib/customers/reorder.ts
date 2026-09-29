import "server-only";
import { getCarsystemProductBySlug, getProductVariantSelector } from "@/lib/carsystem-data";
import { loadCustomerPurchasedArticles } from "@/lib/customers/customer-queries";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
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
   * Mesto za F7 (brz unos količine i korpa). Do tada `false`: dugme koje ne
   * radi ne sme da postoji.
   */
  orderable: false;
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
      orderable: false,
    };
  });

  return {
    items,
    totalArticles: profile.articles.length,
    demo: dataset.kind === "demo",
    dataUntil: profile.today,
  };
}
