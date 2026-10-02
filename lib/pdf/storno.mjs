/**
 * Poređenje storna sa originalom — čista logika, bez baze.
 *
 * Ne pretpostavlja se da storno poništava ceo original. Ishod je:
 *   - `full`     — isti partner, iste stavke (šifra, cena, rabat), svaka količina
 *                  tačno suprotna, zbir storna + originala = 0;
 *   - `partial`  — isti partner, svaka stavka storna postoji u originalu po istoj
 *                  ceni i rabatu, ali bar jedna količina ili stavka nije poništena
 *                  u celosti;
 *   - `mismatch` — sve ostalo (drugi partner, stavka koje nema u originalu,
 *                  druga cena ili rabat, storno veći od originala).
 *
 * Samo `full` je oblik viđen u stvarnim stornima. `partial` i `mismatch` traže
 * potvrdu kancelarije pre bilo kakvog uticaja na promet.
 */

const CENT = 0.011;
const near = (a, b) => Math.abs(a - b) < CENT;

/**
 * @param {{ partnerCode: string|null, total: number|null,
 *           lines: { articleCode: string|null, quantity: number, unitPrice: number, discountPercent: number }[] }} storno
 * @param {{ partnerCode: string|null, total: number|null,
 *           lines: { articleCode: string|null, quantity: number, unitPrice: number, discountPercent: number }[] }} original
 * @returns {{ kind: "full" | "partial" | "mismatch", reasons: string[] }}
 */
export function compareStornoToOriginal(storno, original) {
  const reasons = [];
  if (!storno.partnerCode || storno.partnerCode !== original.partnerCode) reasons.push("partner_differs");

  // Ostatak količine po (šifra, cena, rabat) — ista šifra po dve cene su dve stavke.
  const key = (l) => `${l.articleCode}|${l.unitPrice}|${l.discountPercent}`;
  const remaining = new Map();
  for (const l of original.lines) remaining.set(key(l), (remaining.get(key(l)) ?? 0) + l.quantity);

  for (const l of storno.lines) {
    if (!(l.quantity < 0)) { reasons.push("non_negative_line"); continue; }
    if (!remaining.has(key(l))) { reasons.push("line_not_in_original"); continue; }
    const left = remaining.get(key(l)) + l.quantity;
    if (left < -1e-9) reasons.push("reverses_more_than_original");
    remaining.set(key(l), left);
  }
  if (reasons.length > 0) return { kind: "mismatch", reasons: [...new Set(reasons)] };

  const fullyReversed = [...remaining.values()].every((q) => Math.abs(q) < 1e-9);
  const totalsCancel = storno.total !== null && original.total !== null && near(storno.total + original.total, 0);
  if (fullyReversed && totalsCancel) return { kind: "full", reasons: [] };
  return { kind: "partial", reasons: fullyReversed ? ["totals_do_not_cancel"] : ["quantity_left_on_original"] };
}
