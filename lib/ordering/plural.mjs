/**
 * Srpska množina uz broj: 1 stavka, 2–4 stavke, 5+ stavki (11–14 → stavki; 21 → stavka).
 * @param {number} n
 * @param {readonly [string, string, string]} forms jednina, paukal (2–4), množina
 */
export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a >= 11 && a <= 14) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/** „3 stavke“ */
export const countOf = (n, forms) => `${n} ${plural(n, forms)}`;
export const STAVKA = /** @type {const} */ (["stavka", "stavke", "stavki"]);
