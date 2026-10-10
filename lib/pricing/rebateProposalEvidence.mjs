/**
 * Dokazi za PREDLOG rabata kupac–artikal kada stroga merila iz istorije nisu
 * ispunjena (premalo faktura, promenljiv rabat…). Predlog se NIKAD ne
 * primenjuje automatski — ide nadležnom komercijalisti na pregled.
 *
 * Porodica artikla = prva reč naziva (CS, BASLAC, RM, 3M…). U portalu brend
 * nije upisan, pa je porodica samo POMOĆNI dokaz: „jak dokaz“ traži da se
 * slože i fakture i odobrena pravila kupca, u celoj relevantnoj istoriji, uz
 * aktuelnost i bez značajnih izuzetaka.
 */

export const PROPOSAL_RULES = Object.freeze({
  /** Poslednja faktura para ne starija od ovoga (dana). */
  pairMaxAgeDays: 180,
  /** Prozor faktura porodice (dana). */
  familyWindowDays: 365,
  /** Najmanje stavki porodice i odobrenih pravila porodice. */
  familyMinLines: 5,
  familyMinRules: 3,
  /** Udeo istog rabata u porodici. */
  familyShare: 0.85,
});

const dayMs = 86400000;
const age = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs);

export function familyKey(name) {
  const w = String(name ?? "").toUpperCase().trim().split(/[\s.]+/)[0];
  return w || null;
}

function dominant(values) {
  if (!values.length) return { n: 0, value: null, share: 0 };
  const c = new Map();
  for (const v of values) c.set(v, (c.get(v) ?? 0) + 1);
  const [value, k] = [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return { n: values.length, value, share: k / values.length };
}

/**
 * @param {{
 *   target: { articleId: string, name: string | null, invoices: { issuedOn: string, percent: number | null, documentLabel: string }[] },
 *   customerPairs: { articleId: string, name: string | null, invoices: { issuedOn: string, percent: number | null }[], approvedPercent: number | null }[],
 *   asOf: string,
 * }} input
 */
export function proposalEvidence({ target, customerPairs, asOf }, rules = PROPOSAL_RULES) {
  const inv = [...target.invoices].sort((a, b) => a.issuedOn.localeCompare(b.issuedOn));
  const last = inv[inv.length - 1];
  const proposed = last?.percent ?? null;
  const family = familyKey(target.name);
  const others = customerPairs.filter((p) => p.articleId !== target.articleId && family && familyKey(p.name) === family);
  const windowStart = new Date(Date.parse(`${asOf}T00:00:00Z`) - rules.familyWindowDays * dayMs).toISOString().slice(0, 10);
  const familyLines = others.flatMap((p) => p.invoices.filter((i) => i.issuedOn >= windowStart && i.percent !== null).map((i) => i.percent));
  const familyRules = others.map((p) => p.approvedPercent).filter((v) => v !== null && v !== undefined).map(Number);
  const lines = dominant(familyLines);
  const ruleDom = dominant(familyRules);
  const pairValues = new Set(inv.filter((i) => i.issuedOn >= windowStart).map((i) => (i.percent === null ? "mešano" : i.percent)));
  const exceptions = others
    .filter((p) => p.approvedPercent !== null && p.approvedPercent !== undefined && Number(p.approvedPercent) !== proposed)
    .map((p) => `${p.name ?? p.articleId}: ${Number(p.approvedPercent)} %`);

  const reasons = [];
  if (proposed === null) reasons.push("poslednja faktura ima različite rabate za isti artikal");
  if (proposed === 0) reasons.push("poslednja faktura je bez rabata — potvrditi da li je to uslov");
  if (last && age(last.issuedOn, asOf) > rules.pairMaxAgeDays) reasons.push(`poslednja faktura je starija od ${rules.pairMaxAgeDays} dana`);
  if (pairValues.size > 1) reasons.push(`u poslednjih 12 meseci rabat na ovom artiklu se menjao (${[...pairValues].join(" / ")} %)`);
  if (!family) reasons.push("naziv ne određuje porodicu");
  if (lines.n < rules.familyMinLines) reasons.push(`premalo faktura porodice „${family}“ u 12 meseci (${lines.n})`);
  else if (lines.value !== proposed || lines.share < rules.familyShare) reasons.push(`fakture porodice „${family}“ u 12 meseci: ${Math.round(lines.share * 100)} % stavki ${lines.value} % (predlog ${proposed} %)`);
  if (ruleDom.n < rules.familyMinRules) reasons.push(`premalo odobrenih pravila porodice „${family}“ (${ruleDom.n})`);
  else if (ruleDom.value !== proposed || ruleDom.share < rules.familyShare) reasons.push(`odobrena pravila porodice: ${Math.round(ruleDom.share * 100)} % je ${ruleDom.value} % (predlog ${proposed} %)`);
  if (exceptions.length) reasons.push(`izuzeci u porodici: ${exceptions.slice(0, 4).join("; ")}${exceptions.length > 4 ? ` i još ${exceptions.length - 4}` : ""}`);

  return {
    proposedPercent: proposed,
    family,
    verdict: reasons.length === 0 ? "jak_dokaz" : "nedovoljan_dokaz",
    reasons,
    familyInvoices: lines,
    familyRules: ruleDom,
    lastInvoices: inv.slice(-5).reverse(),
  };
}
