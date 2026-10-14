import { formatSerbianMeasureText } from "@/lib/measure-format.mjs";
import type { CarsystemProduct } from "@/lib/carsystem-data";

/**
 * Decimalni zarez u srpskim opisima mera, jednom, na kraju sklapanja proizvoda.
 *
 * Menjaju se samo tekstovi za prikaz (naziv, opisi, SEO, alt, tehnički podaci, vrednosti
 * redova tabele). Ne diraju se: zvanični nazivi proizvođača (`officialName`), tekst pod
 * navodnicima, engleski izvorni tekst (vidi `formatSerbianMeasureText`), šifre, adrese, slike,
 * ključevi varijanti i pakovanja (`packages`, iz njih se čita veličina; prikaz ih formatira sam).
 * Izvorni naziv sa tačkom ostaje u `searchTerms`, pa pretraga „3.5 mm” i dalje nalazi proizvod.
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

function formatDeep<T>(value: T): T {
  if (typeof value === "string") return formatSerbianMeasureText(value) as T;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const formatted = formatDeep(entry);
      if (formatted !== entry) changed = true;
      return formatted;
    });
    return (changed ? next : value) as T;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const formatted = SKIPPED_KEYS.has(key) ? entry : formatDeep(entry);
      if (formatted !== entry) changed = true;
      next[key] = formatted;
    }
    return (changed ? next : value) as T;
  }
  return value;
}

const text = (value: string | undefined) => (value === undefined ? value : formatSerbianMeasureText(value));

export function withSerbianMeasureDisplay(product: CarsystemProduct): CarsystemProduct {
  const name = formatSerbianMeasureText(product.name);
  const next: CarsystemProduct = {
    ...product,
    name,
    shortDescription: formatSerbianMeasureText(product.shortDescription),
    longDescription: formatSerbianMeasureText(product.longDescription),
    purpose: formatSerbianMeasureText(product.purpose),
    seoTitle: text(product.seoTitle),
    seoDescription: text(product.seoDescription),
    productImage: product.productImage
      ? { ...product.productImage, alt: formatSerbianMeasureText(product.productImage.alt) }
      : product.productImage,
    galleryImages: product.galleryImages.map((image) => ({ ...image, alt: formatSerbianMeasureText(image.alt) })),
    specifications: formatDeep(product.specifications),
    ...(product.family ? { family: formatDeep(product.family) } : {}),
    ...(product.detail ? { detail: formatDeep(product.detail) } : {}),
  };
  if (name !== product.name) {
    next.searchTerms = [...(product.searchTerms ?? []), product.name];
  }
  if (product.seoTitle === undefined) delete next.seoTitle;
  if (product.seoDescription === undefined) delete next.seoDescription;
  return next;
}
