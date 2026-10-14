import { formatSerbianMeasureText } from "@/lib/measure-format.mjs";
import { applyVerifiedThousands } from "@/lib/verified-thousands";
import { maskUnverifiedQuantity } from "@/lib/unverified-quantities";
import type { CarsystemProduct } from "@/lib/carsystem-data";

/**
 * Decimalni zarez u srpskim opisima mera, jednom, na kraju sklapanja proizvoda.
 *
 * Menjaju se samo tekstovi za prikaz (naziv, opisi, SEO, alt, tehnički podaci, vrednosti
 * redova tabele). Ne diraju se: zvanični nazivi proizvođača (`officialName`), tekst pod
 * navodnicima, engleski izvorni tekst (vidi `formatSerbianMeasureText`), šifre, adrese, slike,
 * ključevi varijanti; u pakovanjima samo potvrđene hiljade (iz njih se čita veličina).
 * Izvorni naziv sa tačkom ostaje u `searchTerms`, pa pretraga „3.5 mm” i dalje nalazi proizvod.
 * Engleski zapis hiljada se menja samo za potvrđene vrednosti (lib/verified-thousands.ts).
 */
const SKIPPED_KEYS = new Set([
  "slug",
  "href",
  "src",
  "url",
  "sourceUrl",
  "id",
  "key",
  "sku",
  "code",
  "productCode",
  "publicCode",
  "variantKey",
  "officialName",
  "image",
  "images",
]);

type Format = (text: string) => string;

function formatDeep<T>(value: T, format: Format): T {
  if (typeof value === "string") return format(value) as T;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const formatted = formatDeep(entry, format);
      if (formatted !== entry) changed = true;
      return formatted;
    });
    return (changed ? next : value) as T;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const formatted = SKIPPED_KEYS.has(key) ? entry : formatDeep(entry, format);
      if (formatted !== entry) changed = true;
      next[key] = formatted;
    }
    return (changed ? next : value) as T;
  }
  return value;
}

export function withSerbianMeasureDisplay(product: CarsystemProduct): CarsystemProduct {
  // Dvosmislene količine se sakrivaju (lib/unverified-quantities.ts), potvrđene hiljade
  // ispravljaju (lib/verified-thousands.ts), pa se dodaje decimalni zarez.
  const format: Format = (value) =>
    formatSerbianMeasureText(applyVerifiedThousands(product.slug, maskUnverifiedQuantity(product.slug, value)));
  const text = (value: string | undefined) => (value === undefined ? value : format(value));
  const name = format(product.name);
  const next: CarsystemProduct = {
    ...product,
    name,
    shortDescription: format(product.shortDescription),
    longDescription: format(product.longDescription),
    purpose: format(product.purpose),
    seoTitle: text(product.seoTitle),
    seoDescription: text(product.seoDescription),
    productImage: product.productImage
      ? { ...product.productImage, alt: format(product.productImage.alt) }
      : product.productImage,
    galleryImages: product.galleryImages.map((image) => ({ ...image, alt: format(image.alt) })),
    // Pakovanja: samo potvrđene hiljade (decimalni zarez dodaje prikaz, formatMeasureSr).
    packages: product.packages.map((item) => ({
      ...item,
      label: applyVerifiedThousands(product.slug, maskUnverifiedQuantity(product.slug, item.label)),
    })),
    specifications: formatDeep(product.specifications, format),
    ...(product.family ? { family: formatDeep(product.family, format) } : {}),
    ...(product.detail ? { detail: formatDeep(product.detail, format) } : {}),
  };
  if (name !== product.name) {
    next.searchTerms = [...(product.searchTerms ?? []), product.name];
  }
  if (product.seoTitle === undefined) delete next.seoTitle;
  if (product.seoDescription === undefined) delete next.seoDescription;
  return next;
}
