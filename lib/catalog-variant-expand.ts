/**
 * `expandVariant` je ovde odvojen od `lib/catalog-listing.ts` jer ga koristi
 * klijentski CatalogExplorer: vrednosni uvoz iz catalog-listing povlačio je ceo
 * katalog (carsystem-data) u JS paket stranice /katalog. Ovde su dozvoljeni samo
 * uvozi tipova.
 */

import type {
  CatalogListingEntity,
  CatalogVariantEntity,
} from "@/lib/catalog-listing";

/** Rebuilds a full listing entity from a variant plus its family. */
export function expandVariant(
  variant: CatalogVariantEntity,
  family: CatalogListingEntity,
): CatalogListingEntity {
  return {
    ...family,
    kind: "variant",
    id: variant.id,
    // Varijanta vodi na canonical family PDP sa preselektovanom varijantom, a
    // ne na zasebnu variant stranicu — korisnik nikada ne dolazi na generički
    // group listing. `family.href` je već `familyPath`.
    href: (variant.variantKey ?? variant.productCode)
      ? `${family.href}?varijanta=${encodeURIComponent(variant.variantKey ?? variant.productCode)}`
      : `/proizvodi/${variant.id}`,
    name: variant.name,
    productCode: variant.productCode,
    shortCode: variant.productCode,
    technicalLine: variant.technicalLine,
    finish: variant.finish,
    variantCount: 1,
    search: variant.search,
    presentation: {
      ...family.presentation,
      slug: variant.id,
      name: variant.name,
      sizeClass: variant.sizeClass,
      quantityLabel: variant.quantityLabel,
      volumeStatus: variant.volumeStatus,
      style: {
        "--product-visual-accent": variant.accent,
        "--product-visual-complement": variant.accent,
        "--product-visual-background-color": variant.accent,
        "--product-active-color": variant.accent,
      } as CatalogListingEntity["presentation"]["style"],
      shade: variant.shade,
      image: variant.imageSrc
        ? { src: variant.imageSrc, alt: variant.imageAlt }
        : null,
    },
  };
}
