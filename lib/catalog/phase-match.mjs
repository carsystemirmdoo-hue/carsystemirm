/**
 * Da li proizvod pripada fazi za filter `?faza=`.
 *
 * Glavna faza je jedna (prikaz, oznaka na kartici), ali R-M komponenta koju zvanično koriste
 * proizvodi više faza nosi i `secondaryPhaseSlugs` (npr. H 2A14: Lak + Boja). Filter je ne sme
 * sakriti ni iz jedne od tih faza.
 *
 * @param {{ phaseSlug: string, secondaryPhaseSlugs?: readonly string[], phaseUnconfirmed?: boolean }} product
 * @param {string} phaseSlug
 */
export function matchesPhase(product, phaseSlug) {
  // Faza bez potvrde u dokumentaciji (vidi `phaseUnconfirmed`) se ne nudi kao filter.
  if (product.phaseUnconfirmed) return false;
  return product.phaseSlug === phaseSlug || Boolean(product.secondaryPhaseSlugs?.includes(phaseSlug));
}

/** Sve faze proizvoda (glavna prva). */
export function phasesOf(product) {
  if (product.phaseUnconfirmed) return [];
  return [product.phaseSlug, ...(product.secondaryPhaseSlugs ?? [])];
}
