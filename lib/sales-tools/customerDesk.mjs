/**
 * Pravila za beleške razgovora i kontakt kupca (0061; 2026-11-10) — bez baze, da se testiraju.
 */

/** Ishod razgovora: kratko, kako bi ga komercijalista rekao. Redosled je redosled dugmadi. */
export const CALL_OUTCOMES = /** @type {const} */ ([
  ["porucio", "Poručio"],
  ["javice_se", "Javiće se"],
  ["nije_dostupan", "Nije se javio"],
  ["ne_treba", "Ne treba mu ništa"],
  ["poseta", "Bio kod kupca"],
  ["drugo", "Drugo"],
]);

/** Podsetnik: dugmad „za koliko dana“. */
export const FOLLOW_UP_CHOICES = /** @type {const} */ ([
  [0, "Bez podsetnika"],
  [1, "Sutra"],
  [3, "Za 3 dana"],
  [7, "Za nedelju"],
  [14, "Za 2 nedelje"],
  [30, "Za mesec"],
]);

export function outcomeLabel(/** @type {string} */ k) {
  return CALL_OUTCOMES.find(([key]) => key === k)?.[1] ?? k;
}

/** Datum + n dana (ISO, bez vremenske zone). */
export function addDays(/** @type {string} */ isoDate, /** @type {number} */ n) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {{ outcome: unknown, body?: unknown, followUpDays?: unknown, followUpOn?: unknown }} input
 * @param {string} today
 * @returns {{ ok: true, value: { outcome: string, body: string | null, followUpOn: string | null } } | { ok: false, error: string }}
 */
export function parseCallNote(input, today) {
  const outcome = String(input.outcome ?? "");
  if (!CALL_OUTCOMES.some(([k]) => k === outcome)) return { ok: false, error: "Izaberite kako je prošao razgovor." };
  const body = String(input.body ?? "").trim().slice(0, 1000) || null;
  if (outcome === "drugo" && (!body || body.length < 3)) return { ok: false, error: "Za „Drugo“ upišite kratku belešku." };
  let followUpOn = null;
  if (input.followUpOn !== undefined && input.followUpOn !== null && input.followUpOn !== "") {
    const s = String(input.followUpOn);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) return { ok: false, error: "Neispravan datum podsetnika." };
    if (s < today) return { ok: false, error: "Podsetnik ne može biti u prošlosti." };
    if (s > addDays(today, 366)) return { ok: false, error: "Podsetnik najviše godinu dana unapred." };
    followUpOn = s;
  } else {
    const days = Number(input.followUpDays ?? 0);
    if (!Number.isInteger(days) || days < 0 || days > 366) return { ok: false, error: "Neispravan podsetnik." };
    followUpOn = days > 0 ? addDays(today, days) : null;
  }
  return { ok: true, value: { outcome, body, followUpOn } };
}

/**
 * Telefon za `tel:` vezu: cifre i vodeći „+“; srpski 0… ostaje kako jeste (radi i sa mobilnog).
 * @param {unknown} raw
 * @returns {string | null}
 */
export function telHref(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const plus = s.startsWith("+") || s.startsWith("00");
  const digits = s.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 6 || digits.length > 15) return null;
  return `tel:${plus ? "+" : ""}${digits}`;
}

/** Iz polja „telefon“ iz BizniSoft kartice može doći više brojeva: „011/123-456; 063 123 456“. */
export function splitPhones(/** @type {unknown} */ raw) {
  return String(raw ?? "")
    .split(/[;,|]|\s{2,}|\s\/\s/)
    .map((s) => s.trim())
    .filter((s) => telHref(s) !== null);
}

/**
 * @param {{ contactName?: unknown, phone?: unknown, phoneAlt?: unknown, email?: unknown, note?: unknown }} input
 * @returns {{ ok: true, value: { contactName: string | null, phone: string | null, phoneAlt: string | null, email: string | null, note: string | null } } | { ok: false, error: string }}
 */
export function parseContact(input) {
  const t = (/** @type {unknown} */ v, /** @type {number} */ n) => String(v ?? "").trim().slice(0, n) || null;
  const value = {
    contactName: t(input.contactName, 120),
    phone: t(input.phone, 40),
    phoneAlt: t(input.phoneAlt, 40),
    email: t(input.email, 160),
    note: t(input.note, 300),
  };
  if (value.phone && !telHref(value.phone)) return { ok: false, error: "Telefon nije ispravan (npr. 063 123 4567)." };
  if (value.phoneAlt && !telHref(value.phoneAlt)) return { ok: false, error: "Drugi telefon nije ispravan." };
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) return { ok: false, error: "E-pošta nije ispravna." };
  return { ok: true, value };
}
