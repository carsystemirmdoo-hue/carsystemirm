/**
 * PIB — poreski identifikacioni broj pravnog lica ili preduzetnika u Srbiji.
 *
 * Devet cifara, poslednja je kontrolna (ISO 7064, MOD 11,10). Provera je
 * ovde da bi kancelarija videla KOJI zapisi traže pažnju, ne da bi sistem
 * sam nešto odbacio: strani PDV broj (`DE…`, `HU…`) je legitiman partner koji
 * jednostavno nije domaći kupac sa PIB-om.
 *
 * PIB je `text` iz istog razloga kao šifra partnera: vodeća nula je deo broja.
 */

/** @typedef {"valid" | "invalid_checksum" | "nonstandard" | "missing"} PibStatus */

export const PIB_STATUSES = /** @type {const} */ ([
  "valid",
  "invalid_checksum",
  "nonstandard",
  "missing",
]);

/**
 * Kontrolna cifra po MOD 11,10.
 *
 * @param {string} first8  tačno osam cifara
 * @returns {number}
 */
export function pibCheckDigit(first8) {
  let product = 10;
  for (const ch of first8) {
    let sum = (product + Number(ch)) % 10;
    if (sum === 0) sum = 10;
    product = (sum * 2) % 11;
  }
  return (11 - product) % 10;
}

/**
 * Razvrstava PIB kako stoji u izvoru. Ne menja vrednost — samo je čisti od
 * razmaka koje Excel ume da doda.
 *
 * @param {unknown} raw
 * @returns {{ value: string | null, status: PibStatus }}
 */
export function classifyPib(raw) {
  if (raw === null || raw === undefined) return { value: null, status: "missing" };
  const value = String(raw).trim();
  if (value === "") return { value: null, status: "missing" };
  if (!/^\d{9}$/.test(value)) return { value, status: "nonstandard" };
  const ok = pibCheckDigit(value.slice(0, 8)) === Number(value[8]);
  return { value, status: ok ? "valid" : "invalid_checksum" };
}
