/**
 * Formati kupčevog panela i kancelarijskog dela za zahteve (redizajn 2026-10).
 *
 * Iznosi: tačka za hiljade, zarez za decimale, uvek dve decimale i oznaka
 * valute odvojena neprelomnim razmakom (iznos se ne lomi u dva reda).
 * Datumi: dd/mm/yyyy po beogradskom vremenu, kao i ručni unos datuma.
 */

const NBSP = " ";
const TZ = "Europe/Belgrade";

/** Grupisanje cifara bez oslanjanja na ICU podatke pregledača/servera. */
function group(intDigits) {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 1234.5 → "1.234,50" (bez valute). `null` → "—". */
export function amount(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const negative = n < 0 || Object.is(n, -0);
  const cents = Math.round(Math.abs(n) * 100);
  const int = String(Math.floor(cents / 100));
  const dec = String(cents % 100).padStart(2, "0");
  return `${negative && cents !== 0 ? "−" : ""}${group(int)},${dec}`;
}

/** 1234.5 → "1.234,50 RSD" (neprelomni razmak pre valute). */
export function money(value, currency = "RSD") {
  const a = amount(value);
  return a === "—" ? a : `${a}${NBSP}${currency || "RSD"}`;
}

/** Količina: do tri decimale, bez nepotrebnih nula (12,5 · 2 · 0,125). */
export function quantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const fixed = (Math.round(n * 1000) / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  const [int, dec] = fixed.split(".");
  return `${group(int.replace("-", "")).replace(/^/, n < 0 ? "−" : "")}${dec ? `,${dec}` : ""}`;
}

/** Procenat: "20 %" (neprelomni razmak); `null` → "—". */
export function percent(value) {
  if (value === null || value === undefined) return "—";
  return `${quantity(value)}${NBSP}%`;
}

function parts(at) {
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  const out = {};
  for (const p of new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** Datum: "dd/mm/yyyy". ISO datum bez vremena ("2026-10-10") ostaje taj dan. */
export function dmy(at) {
  if (!at) return "—";
  if (typeof at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(at)) {
    const [y, m, d] = at.split("-");
    return `${d}/${m}/${y}`;
  }
  const p = parts(at);
  return p ? `${p.day}/${p.month}/${p.year}` : "—";
}

/** Datum i vreme: "dd/mm/yyyy HH:mm" (Beograd). */
export function dmyTime(at) {
  if (!at) return "—";
  const p = parts(at);
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : "—";
}
