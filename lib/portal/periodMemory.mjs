import { izIso } from "../dates/dmy.mjs";

/**
 * Zapamćen period „Od – Do“ na internom portalu (zahtev vlasnika 2026-11-12/13).
 *
 * Izabrani period važi dok korisnik prelazi sa ekrana na ekran (Kupci, kartica
 * kupca, Prodaja, Analitika). Čuva se u kolačiću pregledača, samo za `/portal`,
 * bez ičega o kupcu — dva datuma ili „sve“.
 *
 * Pravilo: period iz adrese uvek ima prednost (i prazan, „Sve vreme“); kolačić
 * se koristi samo kada adresa ne nosi ni `from` ni `to`.
 */
export const PERIOD_COOKIE = "cs_portal_period";
export const PERIOD_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** @param {unknown} v */
function iso(v) {
  return typeof v === "string" && izIso(v) ? v : null;
}

/**
 * Vrednost kolačića za izabrani period. Prazan period je „sve“.
 * @param {string | null | undefined} from
 * @param {string | null | undefined} to
 */
export function encodePeriod(from, to) {
  const f = iso(from);
  const t = iso(to);
  if (!f && !t) return "sve";
  return `${f ?? ""}|${t ?? ""}`;
}

/** @param {string | null | undefined} raw @returns {{ from: string | null, to: string | null } | null} */
export function decodePeriod(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  if (raw === "sve") return { from: null, to: null };
  const [f, t] = raw.split("|");
  const from = iso(f);
  const to = iso(t);
  if (!from && !to) return null;
  return from && to && from > to ? { from: to, to: from } : { from, to };
}

/**
 * Period za ekran: adresa, pa zapamćen kolačić, pa „sve vreme“.
 * @param {{ from?: unknown, to?: unknown }} params
 * @param {string | null | undefined} cookieValue
 * @returns {{ from: string | null, to: string | null, source: "adresa" | "zapamceno" | "podrazumevano" }}
 */
export function resolvePortalPeriod(params, cookieValue) {
  const inUrl = params.from !== undefined || params.to !== undefined;
  if (inUrl) {
    let from = iso(params.from);
    let to = iso(params.to);
    if (from && to && from > to) [from, to] = [to, from];
    return { from, to, source: "adresa" };
  }
  const saved = decodePeriod(cookieValue);
  if (saved) return { ...saved, source: "zapamceno" };
  return { from: null, to: null, source: "podrazumevano" };
}

/**
 * Kratak opis perioda za naslove: „1. 10. 2026. – 13. 11. 2026.“, „od …“, „do …“ ili „sve vreme“.
 * @param {{ from: string | null, to: string | null }} p
 */
export function periodLabel(p) {
  const sr = (/** @type {string} */ d) => `${Number(d.slice(8, 10))}. ${Number(d.slice(5, 7))}. ${d.slice(0, 4)}.`;
  if (p.from && p.to) return `${sr(p.from)} – ${sr(p.to)}`;
  if (p.from) return `od ${sr(p.from)}`;
  if (p.to) return `do ${sr(p.to)}`;
  return "sve vreme";
}
