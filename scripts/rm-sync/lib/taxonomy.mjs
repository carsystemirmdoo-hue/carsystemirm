/** Taksonomija iz zvaničnih činjenica: uloga, „aerosol” u opisu i uloge proizvoda koji komponentu koriste. */

export function resolveTaxonomy(product, byCode, rules) {
  const text = `${product.introduction.join(" ")} ${product.tds?.subtitle ?? ""} ${product.tds?.application ?? ""}`;
  const usedByCounts = new Map();
  for (const code of product.usedBy ?? []) {
    const role = byCode.get(code)?.role;
    if (role) usedByCounts.set(role, (usedByCounts.get(role) ?? 0) + 1);
  }
  const usedByRoles = new Set(usedByCounts.keys());
  const matches = rules.filter((candidate) => {
    if (candidate.role && candidate.role !== product.role) return false;
    const when = candidate.when ?? {};
    if (when.aerosol && !/aerosol/i.test(text)) return false;
    if (when.textMatches && !new RegExp(when.textMatches, "i").test(text)) return false;
    if (when.usedByRole && !(product.kind === "component" && usedByRoles.has(when.usedByRole))) return false;
    return true;
  });
  /*
   * Komponenta koju koristi više vrsta proizvoda (H 2A14: 7 bezbojnih lakova i 2 topcoat-a) dobija
   * fazu VEĆINE, ne prve uloge po redosledu pravila. Nerešeno ostaje po redosledu pravila.
   */
  const first = matches[0];
  const rule = first?.when?.usedByRole
    ? matches
        .filter((candidate) => candidate.when?.usedByRole)
        .reduce((best, candidate) => ((usedByCounts.get(candidate.when.usedByRole) ?? 0) > (usedByCounts.get(best.when.usedByRole) ?? 0) ? candidate : best))
    : first;
  if (!rule) return null;
  return { category: rule.category, programSlug: rule.programSlug, phaseSlug: rule.phaseSlug, visualType: rule.visualType, rule: rule.id };
}
