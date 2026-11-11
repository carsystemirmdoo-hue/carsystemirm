/**
 * Kreditni limit kupca — čista računica (2026-11-11, odluka vlasnika).
 *
 * Limit = procenat × prosečna mesečna kupovina sa PDV-om u poslednjih 12 meseci.
 * Podrazumevani procenat je 150 % (rok plaćanja je najčešće 30 dana, pa kupac koji
 * plaća na vreme duguje oko 100 % mesečne kupovine). Kupcu se može upisati sopstveni
 * procenat ili tačan iznos. Kupac bez kupovine u 12 meseci nema automatski limit.
 */

export const DEFAULT_CREDIT_PERCENT = 150;
export const CREDIT_PERCENT_SETTING = "credit.defaultPercent";
/** Od ovog udela limita kupac je „blizu limita“. */
export const NEAR_SHARE = 0.8;
/** Faktura koja kasni duže od ovoga posle valute daje upozorenje i bez prekoračenja limita. */
export const LATE_DAYS = 30;

const round = (/** @type {number} */ x) => Math.round(x * 100) / 100;

/** Podešavanje iz baze → procenat; sve neispravno → 150. */
export function normalizeDefaultPercent(/** @type {unknown} */ value) {
  const n = typeof value === "number" ? value : typeof value === "object" && value && "percent" in value ? Number(/** @type {any} */ (value).percent) : Number(value);
  return Number.isFinite(n) && n > 0 && n <= 1000 ? n : DEFAULT_CREDIT_PERCENT;
}

/**
 * @param {{ gross12m: number, override: { percent: number | null, amount: number | null } | null, defaultPercent: number }} p
 * @returns {{ avgMonthly: number, limit: number | null, basis: "default" | "percent" | "amount" | "none", percent: number | null }}
 */
export function creditLimitFor({ gross12m, override, defaultPercent }) {
  const avgMonthly = round(Math.max(0, gross12m) / 12);
  if (override && override.amount !== null && override.amount !== undefined) {
    return { avgMonthly, limit: round(override.amount), basis: "amount", percent: null };
  }
  if (override && override.percent !== null && override.percent !== undefined) {
    return { avgMonthly, limit: avgMonthly > 0 ? round((avgMonthly * override.percent) / 100) : null, basis: avgMonthly > 0 ? "percent" : "none", percent: override.percent };
  }
  if (avgMonthly <= 0) return { avgMonthly, limit: null, basis: "none", percent: null };
  return { avgMonthly, limit: round((avgMonthly * defaultPercent) / 100), basis: "default", percent: defaultPercent };
}

/**
 * @param {{ debt: number, limit: number | null, maxDaysOverdue: number | null }} p
 * @returns {{ usage: number | null, status: "over" | "near" | "ok" | "no_limit", late: boolean }}
 */
export function creditStatus({ debt, limit, maxDaysOverdue }) {
  const late = (maxDaysOverdue ?? 0) > LATE_DAYS;
  if (limit === null) return { usage: null, status: "no_limit", late };
  if (limit === 0) return { usage: debt > 0 ? Infinity : 0, status: debt > 0 ? "over" : "ok", late };
  const usage = debt / limit;
  return { usage, status: usage > 1 ? "over" : usage >= NEAR_SHARE ? "near" : "ok", late };
}

/**
 * Unos sa ekrana: „podrazumevano“, procenat ili iznos. Vraća grešku kao tekst.
 * @param {{ mode: string, value: string }} input
 * @returns {{ ok: true, percent: number | null, amount: number | null, reset: boolean } | { ok: false, error: string }}
 */
export function parseLimitInput({ mode, value }) {
  if (mode === "default") return { ok: true, percent: null, amount: null, reset: true };
  const n = Number(String(value ?? "").trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Upišite broj veći ili jednak nuli." };
  if (mode === "percent") return n > 1000 ? { ok: false, error: "Procenat ne može biti veći od 1000 %." } : { ok: true, percent: round(n), amount: null, reset: false };
  if (mode === "amount") return { ok: true, percent: null, amount: round(n), reset: false };
  return { ok: false, error: "Nepoznat način limita." };
}
