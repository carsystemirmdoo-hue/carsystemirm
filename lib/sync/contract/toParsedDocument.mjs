import { PARSER_VERSION } from "../../pdf/biznisoftLayout.mjs";
import { canonicalDecimal, toNumberForCheck } from "./decimal.mjs";

/**
 * Validiran canonical payload → oblik koji zajednički servis već ume da knjiži.
 *
 * Ovo je adapter, ne drugi put knjiženja. Posle njega se poziva
 * `ingestParsedDocument` — isti servis koji koristi ručni PDF upload — pa
 * duplikat, sudar verzija, razrešenje i CSV/PDF sudar rade po istim pravilima
 * bez ijedne kopirane linije.
 *
 * SME se pozvati SAMO nad payloadom koji je prošao `validateCanonicalInvoice`.
 * Sve provere sadržaja su tamo; ovde se ništa ne proverava i ništa ne prašta.
 */

/**
 * Ime pod kojim se dokument vodi u pregledu.
 *
 * Canonical put NEMA ime fajla i ne sme ga imati: ime sa kancelarijskog
 * računara ume da nosi naziv kupca i broj računa, a `source_documents.file_name`
 * je `NOT NULL`. Zato se pravi izvedena oznaka iz otiska — ista redigovana
 * forma koju već koristi trag revizije.
 *
 * Ovo je zaobilaženje `NOT NULL` kolone, ne rešenje. Prava dopuna (kolona za
 * poreklo dokumenta) je zapisana kao preduslov za P2.
 */
export function derivedFileName(payload) {
  return `canonical:${payload.source_hash.slice("sha256:".length, "sha256:".length + 12)}`;
}

/**
 * @param {object} payload  VALIDIRAN canonical payload
 * @returns {object} oblik saglasan sa `ParsedDocument`
 */
export function parsedDocumentFromCanonical(payload) {
  const lines = payload.lines.map((l) => ({
    lineNumber: l.line_number,
    articleCode: l.article_code,
    description: l.description,
    unit: l.unit,
    /*
     * Brojevi za servis, decimalni tekst za identitet.
     *
     * Servis danas prima brojeve i sam ih pretvara u tekst pri upisu; Postgres
     * ih normalizuje na skalu kolone, pa `1` i `1.000` završe kao ista
     * `numeric(14,3)` vrednost. Zbog toga projekcija oba ulaza ostaje ista.
     *
     * Canonical decimalni tekst se time NE gubi kao izvor istine — on je ono
     * nad čime je izračunat `semantic_hash`, pre svakog pretvaranja u broj.
     */
    quantity: toNumberForCheck(l.quantity),
    quantityDecimals: decimalaU(l.quantity),
    unitPrice: toNumberForCheck(l.unit_price),
    discountPercent: toNumberForCheck(l.discount_percent),
    taxPercent: toNumberForCheck(l.tax_percent),
    taxAmount: l.tax_amount === null ? null : toNumberForCheck(l.tax_amount),
    grossAmount: toNumberForCheck(l.gross_amount),
    netAmount: null,
    status: "ok",
    raw: "",
    printed: null,
  }));

  const printedGross = toNumberForCheck(
    canonicalDecimal(payload.totals.printed_gross_total, "printed_gross_total"),
  );

  return {
    /*
     * `fileHash` je otisak IZVORNIH BAJTOVA.
     *
     * Zato isti PDF, uvezen ručno pa poslat kao canonical (ili obrnuto), pogađa
     * postojeću politiku duplikata bez ijednog novog pravila. `semantic_hash`
     * se ovde NE koristi za deduplikaciju — nema gde da se sačuva, pa
     * semantička deduplikacija u P1 ne postoji.
     */
    fileHash: payload.source_hash.slice("sha256:".length),
    pageCount: payload.parser_meta.page_count,
    parserVersion: payload.parser_version ?? PARSER_VERSION,
    documentKind: payload.document.kind,
    /*
     * Status određuje SERVER, na osnovu sopstvene provere.
     *
     * Payload nema polje kojim bi se izjasnio o svojoj ispravnosti, i da ga
     * ima, ne bi mu se verovalo. Ovde je „valid“ zato što je
     * `validateCanonicalInvoice` prošao — ne zato što je tako pisalo.
     */
    validationStatus: "valid",
    validationDetail: null,
    header: {
      documentNumber: polje(payload.document.number),
      partnerCode: polje(payload.partner.external_code),
      documentDate: polje(payload.document.issued_on),
      printedGrossTotal: {
        raw: payload.totals.printed_gross_total,
        value: printedGross,
        status: "ok",
      },
      // Canonical ugovor NE prenosi PIB — ni kupca ni izdavaoca. Nije potreban
      // za knjiženje i ne treba da putuje.
      customerPib: polje(null),
      issuerPib: polje(null),
      isBiznisoft: true,
    },
    lines,
    totals: {
      ok: true,
      reason: null,
      computed: lines.reduce((s, l) => s + l.grossAmount, 0),
      printed: printedGross,
    },
  };
}

function polje(value) {
  return { raw: value, value, status: value === null ? "missing" : "ok" };
}

/** Broj decimala u canonical zapisu; služi postojećoj proveri preciznosti. */
function decimalaU(value) {
  const i = value.indexOf(".");
  return i === -1 ? 0 : value.length - i - 1;
}
