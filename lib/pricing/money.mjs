/**
 * Novčani obračun stavke TAČNO kao BizniSoft faktura.
 *
 * Izmereno na svim fakturama 2021–2026 (80.350 stavki):
 *   iznos stavke = količina × osnovna cena × (1 − rabat/100), računato tačno
 *   (decimalno), pa zaokruženo na paru — tačna polovina pare NANIŽE.
 *   Poklapa se sa 80.346 stavki; zaokruživanje polovine naviše sa 80.198.
 *   PDV = Σ (iznos stavke × stopa), zaokruženo po stavci; ukupno = neto + PDV.
 *   Poklapa se sa svih 12.335 faktura.
 *
 * Sve se računa u celim brojevima (BigInt) — bez grešaka binarnog razlomka
 * (npr. 2,5 × 3.053 × 0,65 = 4.961,125 → faktura 4.961,12).
 */

/** Decimalni zapis („2.5“, „3053“, „35.000“) → ceo broj u 10^-dec. */
export function toUnits(value, dec) {
  const s = typeof value === "number" ? value.toFixed(dec) : String(value).trim();
  const m = s.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!m) throw new Error(`Neispravan broj: ${value}`);
  const frac = (m[3] ?? "").padEnd(dec, "0");
  if (frac.length > dec && /[1-9]/.test(frac.slice(dec))) throw new Error(`Previše decimala: ${value}`);
  const v = BigInt(m[2] + frac.slice(0, dec));
  return m[1] === "-" ? -v : v;
}

/** v / unit, zaokruženo na ceo broj; tačna polovina naniže (ka nuli). */
function roundHalfDown(v, unit) {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const q = a / unit;
  const r = a % unit;
  const out = 2n * r > unit ? q + 1n : q;
  return neg ? -out : out;
}

/** v / unit, uobičajeno zaokruživanje (polovina naviše). */
function roundHalfUp(v, unit) {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const q = a / unit;
  const out = 2n * (a % unit) >= unit ? q + 1n : q;
  return neg ? -out : out;
}

const Q = 3; // količina
const P = 4; // cena
const D = 3; // rabat u %

/**
 * Neto iznos stavke u parama, kao na fakturi.
 * @param {{ quantity: string | number, price: string | number, discountPercent?: string | number }} line
 */
export function lineNetCents(line) {
  const v = toUnits(line.quantity, Q) * toUnits(line.price, P) * (100n * 10n ** BigInt(D) - toUnits(line.discountPercent ?? 0, D));
  // jedinica v: 10^-(Q+P) × 10^-D × 10^-2 (deljenje sa 100) = 10^-(Q+P+D+2); do para (10^-2):
  return Number(roundHalfDown(v, 10n ** BigInt(Q + P + D)));
}

/** Neto jedinična cena posle rabata u parama (za prikaz „Vaša cena“). */
export function unitNetCents(price, discountPercent = 0) {
  return lineNetCents({ quantity: 1, price, discountPercent });
}

/** PDV stavke u parama: iznos stavke × stopa, po stavci. */
export function lineVatCents(netCents, vatPercent) {
  return Number(roundHalfUp(BigInt(netCents) * toUnits(vatPercent, 2), 10000n));
}

/** Zbir: neto, PDV i ukupno u parama — zbir zaokruženih stavki, kao na fakturi. */
export function totalsCents(lines) {
  let net = 0;
  let vat = 0;
  for (const l of lines) {
    const n = lineNetCents(l);
    net += n;
    vat += lineVatCents(n, l.vatPercent);
  }
  return { net, vat, gross: net + vat };
}
