import "server-only";

import type { CatalogListingEntity } from "@/lib/catalog-listing";
import { getProductImageMetrics } from "@/lib/product-image-metrics";
import { toDisplayImageSrc } from "@/lib/productImageDisplay";
import { resolveOfficialShadowV6 } from "@/lib/productFitModel.mjs";

/**
 * Server-only adapter za V6 fit + shadow model.
 *
 * Manifest sa merenjima ima ~300 KB i ne sme u klijentski bundle, pa se odluka
 * donosi ovde, a klijentske površine dobijaju samo jednu kratku vrednost. Samo
 * pravilo (brend, izuzeci, sanity) živi u `lib/productFitModel.mjs`.
 *
 * `null` = legacy: površina ne dobija nijedan V6 atribut.
 */
export type OfficialShadow = "strong" | "thin" | "none" | "unknown";

export function getOfficialShadowV6(
  product: { slug: string; brandSlug: string },
  src: string | null | undefined,
): OfficialShadow | null {
  if (!src) return null;
  return resolveOfficialShadowV6(product, getProductImageMetrics(src));
}

/**
 * Dopunjava listing entitete za kataloške kartice. Entitet bez V6 modela se
 * vraća ISTI (ista referenca), pa se payload za druge brendove ne menja.
 */
export function withProductFitModel<T extends CatalogListingEntity>(entities: T[]): T[] {
  return entities.map((entity) => {
    // Kartica crta derivat za prikaz (ako postoji), pa se V6 odluka čita sa
    // merenja BAŠ tog fajla — isto kao `data-product-fit` na površini.
    const src = entity.presentation.image?.src;
    const officialShadow = getOfficialShadowV6(
      { slug: entity.presentation.slug, brandSlug: entity.brandSlug },
      src ? toDisplayImageSrc(src) : src,
    );
    if (!officialShadow) return entity;
    return { ...entity, presentation: { ...entity.presentation, officialShadow } };
  });
}
