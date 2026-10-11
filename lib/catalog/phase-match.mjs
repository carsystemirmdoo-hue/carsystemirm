/**
 * Da li proizvod pripada fazi za filter `?faza=`.
 *
 * Glavna faza je jedna (prikaz, oznaka na kartici), ali R-M komponenta koju zvanično koriste
 * proizvodi više faza nosi i `secondaryPhaseSlugs` (npr. H 2A14: Lak + Boja). Filter je ne sme
 * sakriti ni iz jedne od tih faza.
 *
 * @param {{ phaseSlug: string, secondaryPhaseSlugs?: readonly string[] }} product
 * @param {string} phaseSlug
 */
export function matchesPhase(product, phaseSlug) {
  return product.phaseSlug === phaseSlug || Boolean(product.secondaryPhaseSlugs?.includes(phaseSlug));
}

/** Sve faze proizvoda (glavna prva). */
export function phasesOf(product) {
  return [product.phaseSlug, ...(product.secondaryPhaseSlugs ?? [])];
}
