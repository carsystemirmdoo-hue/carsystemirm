import type { CarsystemProduct } from "@/lib/carsystem-data";
import { productCanonicalHref } from "@/lib/product-families";

/** Dodaje kanonsku adresu kartice proizvodima pre slanja klijentskoj listi (samo server). */
export function withListingHref(products: CarsystemProduct[]): CarsystemProduct[] {
  return products.map((product) => ({ ...product, listingHref: productCanonicalHref(product) }));
}
