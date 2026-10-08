/**
 * Polje „Na dan" obračuna preporuka: podrazumevana vrednost i provera unosa.
 *
 * Čisto: sat dolazi spolja (`today` u vremenskoj zoni aplikacije), pa je
 * ponašanje isto u testu, na serveru i u pregledaču.
 */

import { dayNumber } from "./cadence.mjs";

/**
 * Dan poslednjeg uspešnog obračuna, a pre prvog obračuna — današnji dan.
 * Prazno polje pri prvom obračunu je ranije tiho blokiralo slanje.
 *
 * @param {string | null | undefined} lastRunAsOfDate
 * @param {string} today  `YYYY-MM-DD` u vremenskoj zoni aplikacije
 */
export function defaultAsOfDate(lastRunAsOfDate, today) {
  return lastRunAsOfDate || today;
}

/**
 * @param {unknown} value  vrednost iz forme
 * @param {string} today   `YYYY-MM-DD` u vremenskoj zoni aplikacije
 * @returns {{ ok: true, asOfDate: string } | { ok: false, error: string }}
 */
export function parseAsOfDate(value, today) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return { ok: false, error: "Unesite datum u polje „Na dan“." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, error: "Datum mora biti u obliku GGGG-MM-DD." };
  try {
    dayNumber(s);
  } catch {
    return { ok: false, error: "Taj datum ne postoji u kalendaru." };
  }
  if (s > today) return { ok: false, error: "Datum obračuna ne može biti posle današnjeg dana." };
  return { ok: true, asOfDate: s };
}
