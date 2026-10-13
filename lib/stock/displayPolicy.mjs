/**
 * Prikaz stanja iz poslednjeg izvoza prijavljenim kupcima (dok. 65) — ISKLJUČEN dok se
 * pravila ne potvrde i stvarni izvoz ne proveri.
 *
 * Dve brave, obe moraju biti otključane:
 *   1. env `STOCK_CUSTOMER_DISPLAY=1` (odluka po okruženju/deploy-u);
 *   2. `system_settings['stock.customerDisplay']` = { enabled: true, maxAgeDays: N, ... }
 *      (odluka vlasnika, sa pragom zastarelosti koji ON zadaje).
 * Prag zastarelosti NEMA podrazumevanu vrednost: ranije predloženi 75 min / 18 h nisu usvojeni.
 * Bez praga nema prikaza.
 *
 * Starost se meri od DATUMA STANJA iz izveštaja (izveštaj nema vreme izvoza); vreme
 * uvoza je posebna informacija i ne „podmlađuje" stanje.
 */

export const STOCK_DISPLAY_SETTING = "stock.customerDisplay";

/**
 * @param {unknown} raw vrednost iz system_settings
 * @returns {{ enabled: boolean, maxAgeDays: number | null, problems: string[] }}
 */
export function normalizeDisplayPolicy(raw) {
  const problems = [];
  const v = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const enabled = v.enabled === true;
  let maxAgeDays = null;
  if (v.maxAgeDays !== undefined && v.maxAgeDays !== null) {
    if (Number.isInteger(v.maxAgeDays) && /** @type {number} */ (v.maxAgeDays) >= 0 && /** @type {number} */ (v.maxAgeDays) <= 60) maxAgeDays = /** @type {number} */ (v.maxAgeDays);
    else problems.push("prag_neispravan");
  }
  if (enabled && maxAgeDays === null) problems.push("prag_nije_zadat");
  return { enabled, maxAgeDays, problems };
}

/** Dani između dva datuma YYYY-MM-DD (b − a). */
export function daysBetween(a, b) {
  const t = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86400000);
}

/**
 * @param {{ env: Record<string, string | undefined>, policy: unknown, snapshot: { stockDate: string, confirmedAt: string } | null, today: string }} input
 * @returns {{ show: true } | { show: false, reason: string }}
 */
export function customerDisplayDecision({ env, policy, snapshot, today }) {
  if (env.STOCK_CUSTOMER_DISPLAY !== "1") return { show: false, reason: "iskljuceno_okruzenje" };
  const p = normalizeDisplayPolicy(policy);
  if (!p.enabled) return { show: false, reason: "iskljuceno_podesavanje" };
  if (p.maxAgeDays === null) return { show: false, reason: "prag_nije_zadat" };
  if (!snapshot) return { show: false, reason: "nema_snimka" };
  const age = daysBetween(snapshot.stockDate, today);
  if (age < 0) return { show: false, reason: "datum_u_buducnosti" };
  if (age > p.maxAgeDays) return { show: false, reason: "zastareo_snimak" };
  return { show: true };
}

const fmtDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}.`;

/**
 * Tekst za kupca. Izvor ima samo DATUM stanja → prikazuje se samo datum; vreme uvoza
 * ide odvojeno i ne predstavlja se kao vreme stanja.
 * @param {{ stockDate: string, confirmedAt: Date | string, timeZone?: string }} s
 */
export function customerStockCaption(s) {
  const at = new Date(s.confirmedAt);
  const tz = s.timeZone ?? "Europe/Belgrade";
  const d = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(at);
  const t = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  return {
    headline: `Stanje prema poslednjem izvozu: ${fmtDate(s.stockDate)}`,
    imported: `Uvezeno ${d} u ${t}`,
    note: "Raspoloživost potvrđuje kancelarija.",
  };
}

/**
 * Šta kupac vidi za jedan artikal (kada je prikaz uključen). Broj pakovanja samo uz
 * potvrđenu vezu, JM i pakovanje; negativno ili prazno stanje → ništa.
 * @param {{ status: "ok", packs: number } | { status: "nema_broja", reason: string }} packs rezultat wholePacks
 * @param {string | null} label oznaka pakovanja (npr. „5 L")
 */
export function customerStockLine(packs, label) {
  if (packs.status !== "ok") return null;
  if (packs.packs < 1) return { state: "nema", text: "Prema izvozu: nema celog pakovanja na stanju" };
  return { state: "ima", text: `Prema izvozu: ${packs.packs} × ${label ?? "pakovanje"}` };
}
