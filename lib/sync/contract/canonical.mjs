import { createHash } from "node:crypto";
import { canonicalDecimal } from "./decimal.mjs";

/**
 * Canonical oblik i semantic hash.
 *
 * Čista logika: bez baze, bez mreže, bez `server-only`. Isti kod računa hash na
 * kancelarijskom računaru i na serveru — inače bi „server ponovo računa hash“
 * poredio dva različita algoritma i uvek se ne bi slagao.
 */

/** Verzija ugovora i verzija pravila normalizacije. */
export const SCHEMA_VERSION = 1;
export const CANONICALIZATION_VERSION = 1;

/**
 * Verzije čitača koje server prihvata.
 *
 * IZRIČITA lista. Prihvatanje proizvoljne verzije bi značilo da dokument
 * pročitan nepoznatim parserom uđe u promet bez ijedne provere šta taj parser
 * radi drugačije. Lista je niz, ne jedna vrednost: verzija će se menjati, i
 * prelazni period u kome važe dve je normalan, ne izuzetak.
 */
/*
 * `biznisoft-pdf-1` se NE prihvata: na stvarnim fakturama je čitao susednu
 * oznaku kao šifru partnera (svi kupci bi dobili istu šifru), lepio prvu reč
 * naziva uz šifru artikla i gubio prelomljen naziv. Prelaznog perioda nema —
 * nijedan dokument nije uvezen sa v1, a konektor sa v1 nije isporučen.
 */
export const SUPPORTED_PARSER_VERSIONS = ["biznisoft-pdf-2"];

/**
 * Domenski prefiks hash-a.
 *
 * Vezuje hash za NAMENU i za verziju pravila normalizacije. Bez prefiksa bi
 * isti niz bajtova mogao da bude validan hash u nekom drugom kontekstu; bez
 * verzije u prefiksu bi promena pravila normalizacije prošla nevidljivo —
 * stari i novi algoritam bi tvrdili isti identitet za različit canonical oblik.
 */
const DOMEN = "carsystem/invoice-ingest/semantic";

/* =========================================================================
 * Normalizacija teksta
 * ====================================================================== */

/**
 * Granice normalizacije teksta — namerno uske.
 *
 * Radi se TAČNO ovo:
 * - Unicode NFC (isti znak zapisan na dva načina daje isti bajt niz);
 * - trim spolja;
 * - nizovi belina unutra se svode na jedan razmak.
 *
 * Ne radi se: presavijanje dijakritika, promena veličine slova, uklanjanje
 * interpunkcije. Sve troje bi spojilo poslovno različite vrednosti — „Boja
 * bela“ i „boja BELA“ mogu biti dva artikla, i nije na hash-u da odluči da
 * nisu.
 *
 * Šifre i brojevi dokumenata NE prolaze ovuda; oni idu kroz `identitet()`.
 */
export function canonicalText(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).normalize("NFC").trim().replace(/\s+/g, " ");
  return s === "" ? null : s;
}

/**
 * Identitet (šifra, broj dokumenta): NFC i trim, ništa više.
 *
 * Vodeće nule se ČUVAJU: `001234` i `1234` moraju ostati različiti, jer su to
 * dva partnera odnosno dva artikla. Zbog toga ovde nema ničega što liči na
 * numeričku normalizaciju.
 */
export function identitet(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).normalize("NFC").trim();
  return s === "" ? null : s;
}

/* =========================================================================
 * Canonical serijalizacija
 * ====================================================================== */

/**
 * Deterministički JSON.
 *
 * Pravila:
 * - ključevi objekta idu LEKSIKOGRAFSKI po UTF-16 code unit-ima (`Array#sort`
 *   podrazumevano), da redosled ne zavisi ni od redosleda upisa ni od jezika
 *   platforme;
 * - bez ijedne beline;
 * - `undefined` se ne pojavljuje — polje koje semantički postoji a nema
 *   vrednost je `null`. Razlika „odsutno“ / „null“ bi dala dva hash-a za istu
 *   stvar, pa je u canonical sadržaju svako polje uvek prisutno;
 * - brojevi postoje samo kao celi (`line_number`, verzije); svaki poslovni
 *   iznos je već string.
 */
export function canonicalJson(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const kljucevi = Object.keys(value).sort();
    return `{${kljucevi.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(
        "Canonical sadržaj ne sme nositi decimalni broj — iznosi su decimalni tekst.",
      );
    }
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  throw new Error(`Canonical sadržaj ne podržava tip ${typeof value}.`);
}

/* =========================================================================
 * Semantički sadržaj
 * ====================================================================== */

/**
 * Poslovni sadržaj koji ulazi u `semantic_hash`.
 *
 * ULAZI: identitet izdavaoca i dokumenta, partner, datumi i njihova osnova,
 * valuta, zbir zaglavlja i sve stavke sa iznosima — plus obe verzije, da
 * promena ugovora ili pravila normalizacije ne bude nevidljiva.
 *
 * NE ULAZI, i svako od toga ima razlog:
 * - `parser_version` — isti posao pročitan novijim čitačem je isti posao;
 * - `parser_meta` (broj strana/redova) — raspored teksta po stranama je
 *   svojstvo štampe, ne dokumenta;
 * - `source_hash` — isti sadržaj u drugim bajtovima (reprint) mora dati ISTI
 *   semantic hash; to je cela svrha razdvajanja ta dva;
 * - `semantic_hash` — ne uključuje sam sebe;
 * - ime fajla, putanja, vreme skeniranja, device/run ID, potpis — ništa od
 *   toga nije poslovni sadržaj i ne sme da ga menja.
 *
 * Stavke se NE sortiraju i NE agregiraju. Ista šifra u dva reda ostaje dva
 * reda: dokument koji dvaput navodi isti artikal je drugi dokument od onog
 * koji ga navodi jednom sa dvostrukom količinom.
 */
export function semanticContent(payload) {
  return {
    schema_version: payload.schema_version,
    canonicalization_version: payload.canonicalization_version,
    source_system: payload.source_system,
    issuer_code: identitet(payload.issuer.code),
    document_kind: payload.document.kind,
    document_number: identitet(payload.document.number),
    issued_on: payload.document.issued_on,
    trade_date: payload.document.trade_date ?? null,
    date_basis: payload.document.date_basis,
    currency: payload.document.currency,
    partner_external_code: identitet(payload.partner.external_code),
    printed_gross_total: canonicalDecimal(payload.totals.printed_gross_total, "printed_gross_total"),
    lines: payload.lines.map((l) => ({
      line_number: l.line_number,
      article_code: identitet(l.article_code),
      description: canonicalText(l.description),
      unit: canonicalText(l.unit),
      quantity: canonicalDecimal(l.quantity, "quantity"),
      unit_price: canonicalDecimal(l.unit_price, "unit_price"),
      discount_percent: canonicalDecimal(l.discount_percent, "discount_percent"),
      tax_percent: canonicalDecimal(l.tax_percent, "tax_percent"),
      tax_amount: l.tax_amount === null ? null : canonicalDecimal(l.tax_amount, "tax_amount"),
      gross_amount: canonicalDecimal(l.gross_amount, "gross_amount"),
    })),
  };
}

/**
 * `sha256:<hex>` nad canonical poslovnim sadržajem.
 *
 * Ulaz u hash je `<DOMEN>/v<verzija normalizacije>\n<canonical JSON>`, UTF-8.
 */
export function semanticHash(payload) {
  const telo = canonicalJson(semanticContent(payload));
  const ulaz = `${DOMEN}/v${payload.canonicalization_version}\n${telo}`;
  return `sha256:${createHash("sha256").update(ulaz, "utf8").digest("hex")}`;
}

/** `sha256:<hex>` nad tačnim bajtovima fajla. */
export function sourceHash(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
