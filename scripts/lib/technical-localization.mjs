/**
 * Srpski prikaz tehničkih vrednosti iz zvaničnih tehničkih listova (TDS).
 *
 * Parser lista čuva vrednost doslovno (engleski, kako stoji u PDF-u). Kupac vidi srpski
 * tekst koji je napisao i odobrio čovek, u `data/<brend>-sync/technical-localization.json`:
 *
 *   { "<zvanična šifra>": [{ "field", "original", "value", "kind", "tds": { "url", "page", "section" } }] }
 *
 * - `original` mora biti TAČNO ono što je parser upisao; kad se list promeni, pravilo više
 *   ne pogađa ništa i apply pada (zastareo prevod se ne primenjuje tiho).
 * - `kind`: `translation` (isti iskaz na srpskom) ili `parser-correction` (parser je pogrešno
 *   pročitao list; `value` je ono što list stvarno kaže, uz stranu i odeljak).
 * - Original i izvor ostaju u zapisu kao `technicalLocalization` (provenance), ne prikazuju se.
 */

import { existsSync, readFileSync } from "node:fs";

export function loadTechnicalLocalization(file) {
  if (!existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const rules = [];
  for (const [code, list] of Object.entries(raw)) {
    if (code.startsWith("_")) continue;
    for (const rule of list) {
      for (const key of ["field", "original", "value", "kind"]) {
        if (typeof rule[key] !== "string" || !rule[key]) throw new Error(`${file}: ${code} — pravilo bez polja „${key}"`);
      }
      if (!["translation", "parser-correction"].includes(rule.kind)) throw new Error(`${file}: ${code} — nepoznat kind „${rule.kind}"`);
      if (!rule.tds?.url || !rule.tds?.page) throw new Error(`${file}: ${code} — pravilo bez TDS izvora (url, page)`);
      rules.push({ code, rule, used: 0 });
    }
  }
  return rules;
}

const provenance = ({ rule }) => ({
  field: rule.field,
  original: rule.original,
  ...(rule.originalCondition !== undefined ? { originalCondition: rule.originalCondition } : {}),
  value: rule.value,
  ...(rule.condition !== undefined ? { condition: rule.condition } : {}),
  kind: rule.kind,
  tds: rule.tds,
});

/** Tehnički objekat po poljima (baslac, R-M): string ili niz redova (sušenje). */
export function localizeTechnical(code, technical, rules) {
  const localized = [];
  if (!technical || !code) return { technical, localized };
  const next = { ...technical };
  for (const entry of rules.filter((candidate) => candidate.code === code)) {
    const { rule } = entry;
    const current = next[rule.field];
    if (Array.isArray(current)) {
      const index = current.indexOf(rule.original);
      if (index < 0) continue;
      next[rule.field] = current.map((line, position) => (position === index ? rule.value : line));
    } else if (current === rule.original) {
      next[rule.field] = rule.value;
    } else {
      continue;
    }
    entry.used += 1;
    localized.push(provenance(entry));
  }
  return { technical: next, localized };
}

/** Tvrdnje iz lista (Norbin): `{ field, value, condition }`. */
export function localizeClaims(code, claims, rules) {
  const localized = [];
  if (!claims || !code) return { claims, localized };
  const own = rules.filter((candidate) => candidate.code === code);
  const next = claims.map((claim) => {
    const entry = own.find(({ rule }) =>
      rule.field === claim.field &&
      rule.original === claim.value &&
      (rule.originalCondition === undefined || rule.originalCondition === claim.condition));
    if (!entry) return claim;
    entry.used += 1;
    if (!localized.some((item) => item.field === entry.rule.field && item.original === entry.rule.original)) localized.push(provenance(entry));
    return { ...claim, value: entry.rule.value, ...(entry.rule.condition !== undefined ? { condition: entry.rule.condition } : {}) };
  });
  return { claims: next, localized };
}

/** Pravilo koje ništa nije pogodilo znači da se list (ili parser) promenio — prevod se mora proveriti. */
export function assertAllRulesUsed(rules, label) {
  const stale = rules.filter((entry) => !entry.used).map(({ code, rule }) => `${code} · ${rule.field} · „${rule.original}"`);
  if (stale.length) throw new Error(`${label}: prevod TDS vrednosti više ne odgovara izvoru — proveriti list:\n  ${stale.join("\n  ")}`);
}
