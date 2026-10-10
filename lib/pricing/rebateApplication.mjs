/**
 * Izbor pravila rabata kupac–artikal iz istorije faktura — čista pravila.
 *
 * Najuži dokazani obuhvat je par (kupac, artikal). Grupa se ovde NE koristi:
 * grupe izvedene iz naziva su predlog, a potvrđenih grupa iz BizniSofta još
 * nema. Ulaz su potvrđene prodajne stavke (bez storniranih faktura, povrata i
 * korekcija — to već radi `recommendation_input_lines`).
 *
 * Ishod za svaki par:
 *   primeni      — poslednje fakture dosledno nose isti rabat → pravilo
 *   vec_vazi     — isto pravilo već postoji
 *   sukob        — postoji odobreno pravilo sa DRUGOM vrednošću → pregled, ne prepisuje se
 *   vec_predlozeno — isti predlog čeka odluku
 *   visok_rabat  — poslednji dosledan rabat ≥ prag; procenat ne dokazuje akciju → pregled
 *   nejasno      — vrednosti se smenjuju ili su protivrečne na istoj fakturi → pregled
 *   kratko       — ponovljeno, ali u premalo dana ili prekratkom periodu → pregled
 *   zastarelo    — dosledno, ali poslednja faktura je stara → bez primene
 *   bez_rabata   — dosledno 0 % → izričito pravilo 0 % (od 10.10.2026: bez pravila
 *                  kupac vidi „cenu na upit“, pa dokazan 0 % mora biti zapisan)
 *   jednokratno  — manje faktura nego što kriterijum traži → bez zaključka
 */
import { REBATE_CRITERIA } from "./rebateCriteria.mjs";

const round = (d) => Math.round(Number(d) * 100) / 100;
const dayMs = 86400000;
const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / dayMs);

/** Ishodi koji idu na listu za pregled (nadležni komercijalista ili gazda). */
export const REVIEW_OUTCOMES = ["sukob", "visok_rabat", "nejasno", "kratko"];

export const OUTCOME_LABELS = {
  primeni: "Dosledan rabat — pravilo",
  vec_vazi: "Isto pravilo već važi",
  sukob: "Sukob sa odobrenim pravilom",
  vec_predlozeno: "Isti predlog čeka odluku",
  visok_rabat: "Visok rabat — proveriti",
  nejasno: "Nejasno ili protivrečno",
  kratko: "Ponovljeno u kratkom periodu",
  zastarelo: "Zastarelo",
  bez_rabata: "Dosledno bez rabata — pravilo 0 %",
  jednokratno: "Premalo faktura",
};

/**
 * Fakture jednog para hronološki; vrednost fakture je jedinstven rabat ili
 * `null` kada ista faktura nosi različite rabate za isti artikal.
 * @param {{ invoiceId: string, documentLabel: string, issuedOn: string, discountPercent: number, lineNumber?: number | null }[]} lines
 */
export function articleInvoices(lines) {
  const m = new Map();
  for (const l of lines) {
    const e = m.get(l.invoiceId) ?? { invoiceId: l.invoiceId, documentLabel: l.documentLabel, issuedOn: l.issuedOn, values: new Set(), lines: [] };
    e.values.add(round(l.discountPercent));
    e.lines.push(l.lineNumber ?? null);
    m.set(l.invoiceId, e);
  }
  return [...m.values()]
    .map((e) => ({
      invoiceId: e.invoiceId,
      documentLabel: e.documentLabel,
      issuedOn: e.issuedOn,
      percent: e.values.size === 1 ? [...e.values][0] : null,
      values: [...e.values].sort((a, b) => a - b),
      lineNumbers: e.lines.filter((n) => n !== null),
    }))
    .sort((a, b) => a.issuedOn.localeCompare(b.issuedOn) || a.documentLabel.localeCompare(b.documentLabel));
}

/**
 * @param {Parameters<typeof articleInvoices>[0]} lines stavke JEDNOG para kupac–artikal
 * @param {{ asOf: string, existing?: { status: string, discountPercent: number, approved: boolean }[], criteria?: typeof REBATE_CRITERIA }} opts
 */
export function evaluateArticle(lines, { asOf, existing = [], criteria = REBATE_CRITERIA }) {
  const invoices = articleInvoices(lines);
  const last = invoices[invoices.length - 1];
  const base = { invoiceCount: invoices.length, lastOn: last?.issuedOn ?? null, invoices };

  if (invoices.length < criteria.applyRun) return { ...base, outcome: "jednokratno", percent: null, reason: `${invoices.length} fakt., kriterijum traži ${criteria.applyRun}` };
  if (last.percent === null) {
    return { ...base, outcome: "nejasno", percent: null, reason: `poslednja faktura ${last.documentLabel} ima različite rabate za isti artikal (${last.values.join(" / ")} %)` };
  }

  let start = invoices.length - 1;
  while (start > 0 && invoices[start - 1].percent === last.percent) start -= 1;
  const run = invoices.slice(start);
  const before = invoices.slice(0, start);
  const previous = before.length ? before[before.length - 1] : null;
  const evidence = { run, previous };
  const percent = last.percent;

  if (run.length < criteria.applyRun) {
    const recent = invoices.slice(-criteria.applyRun - 2).map((i) => (i.percent === null ? i.values.join("/") : i.percent));
    const reason =
      previous && previous.percent !== null && run.length > 1
        ? `moguća promena ${previous.percent} % → ${percent} % na poslednje ${run.length} fakture — još nije potvrđena`
        : `rabat se menja: poslednje vrednosti ${recent.join(" → ")} %`;
    return { ...base, ...evidence, outcome: "nejasno", percent: null, reason };
  }
  if (percent >= criteria.highDiscount) {
    return { ...base, ...evidence, outcome: "visok_rabat", percent, reason: `${run.length} fakture zaredom ${percent} % — visok rabat, proveriti da li je trajan uslov` };
  }
  const distinctDays = new Set(run.map((i) => i.issuedOn)).size;
  const span = days(run[0].issuedOn, last.issuedOn);
  if (distinctDays < criteria.applyDistinctDays || span < criteria.applyMinSpanDays) {
    return { ...base, ...evidence, outcome: "kratko", percent, reason: `${run.length} fakture sa ${percent} % u ${distinctDays} dana, raspon ${span} dana` };
  }
  if (days(last.issuedOn, asOf) > criteria.applyMaxAgeDays) {
    return { ...base, ...evidence, outcome: "zastarelo", percent, reason: `poslednja faktura ${last.issuedOn}, starija od ${criteria.applyMaxAgeDays} dana` };
  }
  const approved = existing.filter((e) => e.approved);
  const same = (e) => Math.abs(Number(e.discountPercent) - percent) < 0.001;
  if (approved.some((e) => !same(e))) {
    return { ...base, ...evidence, outcome: "sukob", percent, reason: `odobreno pravilo ${approved.map((e) => `${Number(e.discountPercent)} %`).join(", ")} ≠ istorija ${percent} %` };
  }
  if (approved.some(same)) return { ...base, ...evidence, outcome: "vec_vazi", percent, reason: "isto pravilo već važi" };
  if (existing.some((e) => !e.approved && same(e))) return { ...base, ...evidence, outcome: "vec_predlozeno", percent, reason: "isti predlog čeka odluku" };
  // Dosledan 0 % je potvrđen uslov (ne „nema pravila“): posle provere postojećih pravila.
  if (percent === 0) return { ...base, ...evidence, outcome: "bez_rabata", percent, reason: `${run.length} fakture zaredom bez rabata (${run[0].issuedOn} – ${last.issuedOn})` };

  const changed = previous && previous.percent !== null && previous.percent !== percent;
  return {
    ...base,
    ...evidence,
    outcome: "primeni",
    percent,
    changedFrom: changed ? previous.percent : null,
    reason: changed
      ? `promena uslova: ${previous.percent} % → ${percent} % od ${run[0].issuedOn}; ${run.length} fakture zaredom`
      : `${run.length} fakture zaredom ${percent} % (${run[0].issuedOn} – ${last.issuedOn})`,
  };
}

/** Obrazloženje upisano u pravilo: dokaz, kriterijum, prethodna i nova vrednost, autorizacija. */
export function applicationReason(result, { previousRule, authorization, criteria = REBATE_CRITERIA }) {
  const docs = result.run.slice(-8).map((i) => `${i.documentLabel} (${i.issuedOn})`).join(", ");
  const parts = [
    `Primena iz istorije faktura [${criteria.version}].`,
    `Kriterijum: poslednjih ≥ ${criteria.applyRun} faktura isti rabat, ≥ ${criteria.applyDistinctDays} dana, raspon ≥ ${criteria.applyMinSpanDays} dana; storna i povrati isključeni.`,
    `Dokaz: ${result.reason}. Fakture: ${docs}${result.run.length > 8 ? ` i još ${result.run.length - 8}` : ""}.`,
    `Prethodno pravilo: ${previousRule ?? "nije postojalo"}; ranije na fakturama: ${result.changedFrom ?? "isto"} ${result.changedFrom === null || result.changedFrom === undefined ? "" : "%"}. Nova vrednost: ${result.percent} %.`,
    `Važi samo u pilot portalu; nije upisano u BizniSoft.`,
    `Autorizacija: ${authorization}`,
  ];
  return parts.join(" ").replace(/\s+/g, " ").slice(0, 2000);
}
