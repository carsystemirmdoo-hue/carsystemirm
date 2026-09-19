/** Taksonomija iz zvaničnih činjenica: uloga, „aerosol” u opisu i uloge proizvoda koji komponentu koriste. */

export function resolveTaxonomy(product, byCode, rules) {
  const text = `${product.introduction.join(" ")} ${product.tds?.subtitle ?? ""} ${product.tds?.application ?? ""}`;
  const usedByRoles = new Set((product.usedBy ?? []).map((code) => byCode.get(code)?.role).filter(Boolean));
  const rule = rules.find((candidate) => {
    if (candidate.role && candidate.role !== product.role) return false;
    const when = candidate.when ?? {};
    if (when.aerosol && !/aerosol/i.test(text)) return false;
    if (when.textMatches && !new RegExp(when.textMatches, "i").test(text)) return false;
    if (when.usedByRole && !(product.kind === "component" && usedByRoles.has(when.usedByRole))) return false;
    return true;
  });
  if (!rule) return null;
  return { category: rule.category, programSlug: rule.programSlug, phaseSlug: rule.phaseSlug, visualType: rule.visualType, rule: rule.id };
}
