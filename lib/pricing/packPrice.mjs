/**
 * Cena PAKOVANJA iz cene po BizniSoft jedinici mere.
 *
 * Osnovna cena važi za jedinicu iz BizniSofta (KOM, LIT…), ne za pakovanje iz
 * kataloga. Primer: NORBIN LAK N15-V20 VOC 4L (506391) ima JM = LIT i faktura
 * obračunava 4 ili 12 litara po ceni litra — cena litra NIJE cena limenke.
 *
 * Cena pakovanja se izračunava SAMO uz dokaz:
 *   - veza artikla sa katalogom je potvrđena (pakovanje je poznato);
 *   - komad (KOM, KT): pakovanje = 1 komad, osim ako se na fakturama prodaju i
 *     delovi komada (tada nije jasno šta je komad);
 *   - mera (LIT, KG, M…): potrebna je POTVRĐENA količina pakovanja u toj
 *     jedinici. Mera u nazivu („4L“) je samo trag za proveru, ne potvrda.
 * Inače: obračun tog pakovanja je blokiran i navodi se šta nedostaje.
 */
import { lineNetCents } from "./money.mjs";

export const PIECE_UNITS = Object.freeze(["KOM", "KT"]);

/** Mera iz naziva (npr. „4L“, „0,5 L“, „1 KG“) — SAMO kao trag za proveru. */
export function sizeHintFromName(name) {
  const m = String(name ?? "").toUpperCase().match(/(\d+(?:[.,]\d+)?)\s*(L|LIT|KG|G|ML|M)\b/);
  return m ? `${m[1].replace(",", ".")} ${m[2]}` : null;
}

/**
 * @param {{
 *   unit: string | null,
 *   name?: string | null,
 *   basePrice: string,              // osnovna cena po JM, npr. "2335.00"
 *   discountPercent: string | number,
 *   mappingConfirmed: boolean,
 *   fractionalSales?: boolean,      // na fakturama postoje necele količine
 *   packQuantity?: string | null,   // POTVRĐENA količina pakovanja u JM
 * }} input
 * @returns {{ status: "cena_pakovanja", packNetCents: number, packQuantity: string, unit: string }
 *         | { status: "blokirano", missing: string[], message: string }}
 */
export function packPrice(input) {
  const unit = String(input.unit ?? "").trim().toUpperCase();
  const missing = [];
  if (!input.mappingConfirmed) missing.push("potvrđena veza artikla sa katalogom (koje pakovanje kupac kupuje)");
  if (!unit) missing.push("jedinica mere artikla iz BizniSofta");
  let qty = null;
  if (unit && PIECE_UNITS.includes(unit)) {
    if (input.fractionalSales) missing.push(`potvrda šta je 1 ${unit} — na fakturama se prodaju i delovi komada`);
    else qty = "1";
  } else if (unit) {
    if (input.packQuantity && /^\d+(\.\d{1,3})?$/.test(String(input.packQuantity)) && Number(input.packQuantity) > 0) qty = String(input.packQuantity);
    else {
      const hint = sizeHintFromName(input.name);
      missing.push(`potvrđena količina pakovanja u ${unit} — cena je po ${unit}${hint ? `; u nazivu piše „${hint}“, to nije potvrda` : ""}`);
    }
  }
  if (missing.length || qty === null) {
    return { status: "blokirano", missing, message: `Obračun pakovanja je blokiran. Nedostaje: ${missing.join("; ")}.` };
  }
  return {
    status: "cena_pakovanja",
    packQuantity: qty,
    unit,
    packNetCents: lineNetCents({ quantity: qty, price: input.basePrice, discountPercent: input.discountPercent }),
  };
}
