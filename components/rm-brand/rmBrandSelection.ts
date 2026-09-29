import type { CarsystemProduct } from "@/lib/carsystem-data";

/** Isti placeholder koji katalog daje zapisima bez slike (`lib/carsystem-data.ts`). */
export const RM_PLACEHOLDER_PRODUCT_IMAGE = "/images/products/placeholder-product.svg";

export function hasCatalogImage(product: Pick<CarsystemProduct, "productImage">): boolean {
  const src = product.productImage?.src;
  return Boolean(src) && src !== RM_PLACEHOLDER_PRODUCT_IMAGE;
}

/**
 * Proizvodi jedne grupe brend stranice (sistem, serija ili porodica).
 *
 * Grupa se čita iz kataloga (`rmMetadata`), ne iz ručne liste: `pinnedSlugs` samo određuje
 * koji zapisi idu PRVI i kojim redom (npr. sistemski zapis UNO HD). Ostatak do `limit` su
 * ostali članovi iste grupe — oni sa slikom iz kataloga pre onih bez nje, a zapis čiji je
 * naziv već prikazan (npr. „Pure black” iz Advance i Pioneer serije) ide iza ostalih; inače
 * redom kataloga. Slika je uvek ona iz kataloga; brend stranica nema svoju kopiju packshota.
 *
 * @param pinnedSlugs  izričito izabrani zapisi (nepostojeći slug se preskače)
 * @param members      članovi grupe iz kataloga
 * @param pool         gde se traže `pinnedSlugs` (podrazumevano: `members`)
 */
export function selectRmGroupProducts({
  limit,
  members,
  pinnedSlugs = [],
  pool = members,
}: {
  limit: number;
  members: CarsystemProduct[];
  pinnedSlugs?: string[];
  pool?: CarsystemProduct[];
}): CarsystemProduct[] {
  const pinned = pinnedSlugs
    .map((slug) => pool.find((product) => product.slug === slug))
    .filter((product): product is CarsystemProduct => Boolean(product));
  const pinnedSet = new Set(pinned.map((product) => product.slug));
  const seenNames = new Set(pinned.map((product) => product.name));
  const rank = (product: CarsystemProduct) => {
    const repeated = seenNames.has(product.name);
    seenNames.add(product.name);
    return (hasCatalogImage(product) ? 0 : 2) + (repeated ? 1 : 0);
  };
  const ordered = members
    .filter((product) => !pinnedSet.has(product.slug))
    .map((product, index) => ({ product, index, rank: rank(product) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ product }) => product);

  return [...pinned, ...ordered].slice(0, Math.max(limit, pinned.length));
}
