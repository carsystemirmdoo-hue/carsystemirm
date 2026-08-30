import {
  CANONICALIZATION_VERSION,
  SCHEMA_VERSION,
  semanticHash,
  sourceHash,
} from "./canonical.mjs";
import { canonicalDecimal, decimalFromPrinted } from "./decimal.mjs";

/**
 * Pročitan dokument → canonical payload.
 *
 * Ovo je JEDINI proizvođač canonical sadržaja i namerno je čist: bez baze, bez
 * mreže, bez `server-only`. Isti kod radi na kancelarijskom računaru (gde PDF
 * ostaje lokalno) i u testu.
 *
 * Ovo NIJE Windows agent. Nema skeniranja foldera, trajnog stanja, slanja ni
 * rasporeda — to je P3.
 */

export class CanonicalBuildError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "CanonicalBuildError";
    this.code = code;
  }
}

/**
 * Valuta podržanog izvora.
 *
 * PAŽNJA: ovo NIJE pročitano sa dokumenta. Čitač BizniSoft PDF-a ne čita
 * valutu uopšte — na dokumentu je nema u obliku koji bi se mogao pouzdano
 * izdvojiti. `RSD` je podrazumevana vrednost KONFIGURACIJE podržanog izvora,
 * ista pretpostavka pod kojom `invoices` već danas čuva iznose bez kolone
 * valute. Zapisuje se izričito da bi pretpostavka bila vidljiva umesto
 * podrazumevana, i da bi prvi drugačiji izvor pao na proveri umesto da tiho
 * uđe.
 */
export const SOURCE_CURRENCY = "RSD";

/**
 * Gradi canonical payload iz `ParsedDocument`.
 *
 * Odbija sve što nije potpuno pročitan, ispravan dokument. Payload se pravi
 * SAMO od dokumenta koji je čitač već proglasio validnim — canonical zapis
 * nepročitanog dokumenta bi bio tvrdnja bez pokrića.
 *
 * @param {object} parsed  rezultat `parseBiznisoftPdf`
 * @param {Uint8Array} bytes  tačni bajtovi fajla, za `source_hash`
 * @param {{ issuerCode: string }} context
 * @returns {import("./types").CanonicalInvoice} canonical payload
 */
export function canonicalFromParsedDocument(parsed, bytes, context) {
  if (!context?.issuerCode) {
    throw new CanonicalBuildError("Izdavalac je obavezan.", "issuer_missing");
  }
  if (parsed.validationStatus !== "valid") {
    /*
     * Nepodržan ili neispravan dokument NEMA canonical oblik.
     *
     * Alternativa bi bila payload sa oznakom „nije valjan", koji bi server
     * morao da razlikuje od valjanog — a to je tačno ono polje kome se ne sme
     * verovati. Ovde se takav dokument uopšte ne pretvara.
     */
    throw new CanonicalBuildError(
      "Dokument nije prošao proveru čitača; canonical oblik se ne pravi.",
      `not_valid:${parsed.validationStatus}`,
    );
  }

  const lines = parsed.lines.map((l, i) => ({
    line_number: i + 1,
    article_code: l.articleCode,
    description: l.description ?? null,
    unit: l.unit ?? null,
    /*
     * Decimale se uzimaju iz ODŠTAMPANOG zapisa, ne iz pročitanog broja.
     *
     * `parseSerbianNumber` vraća `number`; `String(number)` bi vratio ono što
     * binarni float ume da predstavi, ne ono što na dokumentu piše. Zato
     * `printed` postoji.
     */
    quantity: obavezno(l.printed?.quantity, "quantity"),
    unit_price: obavezno(l.printed?.unitPrice, "unit_price"),
    discount_percent: opcionoSaNulom(l.printed?.discountPercent, "discount_percent"),
    tax_percent: obavezno(l.printed?.taxPercent, "tax_percent"),
    tax_amount: opciono(l.printed?.taxAmount, "tax_amount"),
    gross_amount: obavezno(l.printed?.grossAmount, "gross_amount"),
  }));

  const payload = {
    schema_version: SCHEMA_VERSION,
    canonicalization_version: CANONICALIZATION_VERSION,
    parser_version: parsed.parserVersion,
    source_system: "biznisoft",
    issuer: { code: context.issuerCode },
    document: {
      kind: parsed.documentKind,
      number: parsed.header.documentNumber.value,
      issued_on: parsed.header.documentDate.value,
      /*
       * Datum prometa se NE izmišlja.
       *
       * Čitač dokumenta poznaje tačno jedan datum — „Datum izdavanja računa“.
       * Da li BizniSoft uopšte štampa datum prometa nije poznato bez stvarnog
       * uzorka, pa je ovde `null`, a osnov je izričito `issued_on`.
       */
      trade_date: null,
      date_basis: "issued_on",
      currency: SOURCE_CURRENCY,
    },
    partner: { external_code: parsed.header.partnerCode.value },
    totals: {
      printed_gross_total: obavezno(
        // Zaglavlje čuva i sirovi odštampani zapis; njega i koristimo.
        parsed.header.printedGrossTotal.raw,
        "printed_gross_total",
      ),
    },
    lines,
    parser_meta: {
      page_count: parsed.pageCount,
      line_count: lines.length,
    },
    source_hash: sourceHash(bytes),
    // Popunjava se ispod: hash ne sme da uključuje sam sebe.
    semantic_hash: "sha256:" + "0".repeat(64),
  };

  payload.semantic_hash = semanticHash(payload);
  return payload;
}

/** Odštampana vrednost je obavezna; njeno odsustvo je greška, ne nula. */
function obavezno(printed, polje) {
  const decimal = decimalFromPrinted(printed);
  if (decimal === null) {
    throw new CanonicalBuildError(
      `Polje „${polje}“ nije odštampano u prepoznatljivom obliku.`,
      `printed_missing:${polje}`,
    );
  }
  return canonicalDecimal(decimal, polje);
}

/** Odsutna vrednost ostaje `null` — nula bi tiho postala poslovni podatak. */
function opciono(printed, polje) {
  const decimal = decimalFromPrinted(printed);
  return decimal === null ? null : canonicalDecimal(decimal, polje);
}

/**
 * Rabat: odsutan znači nula.
 *
 * Ovo prati postojeći čitač (`parseLine`: `discountPercent ?? 0`) — dokument
 * bez odštampanog rabata je dokument bez rabata, i taj ishod je već dokazan
 * nad uzorcima. Kada bi ovde bio `null`, canonical put bi odbijao dokumente
 * koje PDF put prima.
 */
function opcionoSaNulom(printed, polje) {
  const decimal = decimalFromPrinted(printed);
  return canonicalDecimal(decimal ?? "0", polje);
}
