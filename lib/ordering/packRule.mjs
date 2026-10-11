/**
 * Poručivanje u celim pakovanjima (dok. 61; odluka vlasnika 2026-10-11).
 *
 * Kupac bira BROJ pojedinačnih pakovanja (limenka, kanta, komad). Obračunska
 * količina za BizniSoft = broj pakovanja × POTVRĐENA količina jednog pakovanja
 * u JM artikla:
 *   - JM komad (KOM, KT): pakovanje = 1 komad, osim kada se na fakturama
 *     prodaju i delovi komada — tada nije jasno šta je komad;
 *   - merna JM (LIT, KG…): samo uz potvrđenu količinu pakovanja u ISTOJ JM.
 *     Mera iz naziva („5L“) je trag za proveru, ne potvrda.
 * Bez potvrde se ništa ne preračunava: artikal se ne poručuje preko sajta
 * (upit), a prodaja na odmerene litre nije deo početne verzije.
 * Broj komada u transportnoj kutiji NIJE ovde: to je informacija, ne uslov.
 */

export const PIECE_UNITS = Object.freeze(["KOM", "KT"]);
/** Najviše pakovanja po stavci (zaštita od greške u kucanju). */
export const MAX_PACKS = 999;

const fmt = (n) => String(Number(n)).replace(".", ",");
const unitWord = (u) => ({ LIT: "L", KG: "kg", KOM: "kom", KT: "kom", M: "m" })[u] ?? u;

/**
 * @param {{ unit: string | null, fractionalSales?: boolean,
 *           confirmed?: { packQuantity: string | number, unit: string, label: string } | null }} input
 * @returns {{ status: "pack", packQuantity: number, unit: string, label: string }
 *         | { status: "blocked", reason: string }}
 */
export function orderPack(input) {
  const unit = String(input.unit ?? "").trim().toUpperCase();
  if (!unit) return { status: "blocked", reason: "jedinica mere artikla iz BizniSofta nije poznata" };
  const c = input.confirmed ?? null;
  if (c && String(c.unit).trim().toUpperCase() !== unit) {
    return { status: "blocked", reason: `pakovanje je potvrđeno za JM ${c.unit}, a artikal je sada u JM ${unit} — potrebna nova potvrda` };
  }
  if (PIECE_UNITS.includes(unit)) {
    if (input.fractionalSales && !c) return { status: "blocked", reason: `na fakturama se prodaju i delovi komada — nije potvrđeno šta je 1 ${unit}` };
    const q = c ? Number(c.packQuantity) : 1;
    if (!Number.isFinite(q) || q <= 0) return { status: "blocked", reason: "potvrđena količina pakovanja nije ispravna" };
    return { status: "pack", packQuantity: q, unit, label: c?.label || "1 kom" };
  }
  if (!c) return { status: "blocked", reason: `zapremina/masa pakovanja u ${unitWord(unit)} još nije potvrđena` };
  const q = Number(c.packQuantity);
  if (!Number.isFinite(q) || q <= 0) return { status: "blocked", reason: "potvrđena količina pakovanja nije ispravna" };
  return { status: "pack", packQuantity: q, unit, label: c.label || `${fmt(q)} ${unitWord(unit)}` };
}

/**
 * Broj pakovanja iz unosa kupca: ceo broj 1..MAX_PACKS.
 * @param {unknown} raw
 * @returns {{ ok: true, packs: number } | { ok: false, message: string }}
 */
export function parsePacks(raw) {
  const s = String(raw ?? "").trim();
  if (!/^\d{1,4}$/.test(s)) return { ok: false, message: "Unesite ceo broj pakovanja (1, 2, 3…)." };
  const n = Number(s);
  if (n < 1) return { ok: false, message: "Najmanje jedno pakovanje." };
  if (n > MAX_PACKS) return { ok: false, message: `Najviše ${MAX_PACKS} pakovanja po stavci.` };
  return { ok: true, packs: n };
}

/** Obračunska količina u JM (3 decimale, kao numeric(14,3)). */
export function billingQuantity(packs, packQuantity) {
  return Math.round(packs * Number(packQuantity) * 1000) / 1000;
}

/**
 * Predlog broja pakovanja iz istorijske količine u JM (npr. 10 LIT, pakovanje 5 → 2).
 * Kada se ne deli celim brojem, predlog je 1 — istorijska količina nije pravilo.
 */
export function suggestedPacks(historicQuantity, packQuantity) {
  const q = Number(historicQuantity);
  const p = Number(packQuantity);
  if (!(q > 0) || !(p > 0)) return 1;
  const n = q / p;
  return Number.isInteger(Math.round(n * 1000) / 1000) && n >= 1 ? Math.min(Math.round(n), MAX_PACKS) : 1;
}

/** „2 × limenka 5 L = 10 LIT“ — isti tekst u korpi, zahtevu i štampi. */
export function packSummary(packs, pack) {
  return `${packs} × ${pack.label} = ${fmt(billingQuantity(packs, pack.packQuantity))} ${pack.unit}`;
}

/**
 * Pakovanje = jedan komad u JM komad: preračun je identičan, pa ga prikaz ne ponavlja
 * („2 × 1 kom = 2 KOM“). Merna JM (LIT, KG) se uvek prikazuje sa obračunom.
 * @param {{ quantity: number | string, label?: string } | null | undefined} pack
 * @param {string | null | undefined} unit
 */
export function isSinglePiece(pack, unit) {
  return Boolean(pack) && PIECE_UNITS.includes(String(unit ?? "").toUpperCase()) && Number(pack.quantity) === 1;
}
