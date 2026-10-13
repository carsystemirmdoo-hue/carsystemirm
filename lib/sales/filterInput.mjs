import { izIso } from "../dates/dmy.mjs";

/**
 * Filter prodaje iz adrese → vrednosti koje smeju u SQL (revizija 2026-10-11, B7).
 *
 * Datum mora biti stvaran kalendarski dan (`2026-02-31` nije), ID mora biti
 * UUID. Neispravan datum se izostavlja; neispravan ID NE sme da proširi skup
 * (prazan filter bi značio „svi“), pa postaje ID koji ne pogađa ništa.
 * Obrnut period (od posle do) se okreće.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

/** @param {unknown} v @returns {v is string} */
export function isUuid(v) {
  return typeof v === "string" && UUID.test(v);
}

/** @param {unknown} v */
export function isoDateOrNull(v) {
  return typeof v === "string" && izIso(v) ? v : null;
}

/** @param {unknown} v */
function idOrNoMatch(v) {
  if (v === undefined || v === null || v === "") return null;
  return typeof v === "string" && UUID.test(v) ? v : NO_MATCH_ID;
}

/**
 * @param {{ from?: unknown, to?: unknown, kupac?: unknown, komercijalista?: unknown, grupa?: unknown }} raw
 * @returns {{ from: string | null, to: string | null, customerId: string | null, salespersonId: string | null, productGroup: string | null }}
 */
export function normalizeSalesFilter(raw) {
  let from = isoDateOrNull(raw.from);
  let to = isoDateOrNull(raw.to);
  if (from && to && from > to) [from, to] = [to, from];
  const group = typeof raw.grupa === "string" ? raw.grupa.trim().slice(0, 120) : "";
  return {
    from,
    to,
    customerId: idOrNoMatch(raw.kupac),
    salespersonId: idOrNoMatch(raw.komercijalista),
    productGroup: group || null,
  };
}
