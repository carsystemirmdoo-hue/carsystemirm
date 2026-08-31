import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkLineArithmetic,
  validateTotals,
} from "../../pdf/biznisoftLayout.mjs";
import {
  CANONICALIZATION_VERSION,
  SCHEMA_VERSION,
  SUPPORTED_PARSER_VERSIONS,
  semanticHash,
} from "./canonical.mjs";
import { canonicalDecimal, DecimalError, toNumberForCheck } from "./decimal.mjs";
import { compileTrustedSchema, validateWithCompiled } from "./schemaValidator.mjs";

/**
 * Validaciona granica canonical ulaza.
 *
 * Sve se dešava PRE nego što ijedan red dodirne bazu. Nevalidan ili nepodržan
 * ulaz ne ostavlja ni izvorni dokument, ni stavke, ni promet — nema
 * „delimično primljeno“.
 *
 * Ovo NIJE zamena za potpis uređaja iz P2, i P2 je neće zameniti: potpis
 * dokazuje KO je poslao, ova provera šta je poslato. Validan potpis nad
 * besmislenim sadržajem i dalje mora pasti ovde.
 */

/* =========================================================================
 * Ugovor se ČITA, ne prepisuje
 * ====================================================================== */

const CONTRACT_RELATIVE = "contracts/invoice-ingest/v1/schema.json";

/**
 * Autoritativna šema, učitana iz `contracts/`.
 *
 * Namerno `readFileSync` nad fajlom umesto `import ... with { type: "json" }`:
 * ugovor mora ostati običan fajl koji se može pročitati i van ovog projekta
 * (konektor, tuđi alat, ručna provera), a ne artefakt bundlera.
 *
 * Dva puta do istog fajla, i oba su potrebna:
 *
 * - relativno na `import.meta.url` — radi u `node --test`, `tsx` i svakom
 *   pokretanju iz izvora;
 * - relativno na `process.cwd()` — radi kada Next spakuje modul u chunk, gde
 *   `import.meta.url` pokazuje na `.next/server/chunks`, a ne na izvorno
 *   stablo. Bez ovoga build pada na „Failed to collect page data“.
 *
 * `fileURLToPath` je obavezan: `readFileSync` u webpack `fs` sloju ne prima
 * `URL` instancu, iako je Node prima.
 */
function readContract() {
  const kandidati = [
    fileURLToPath(new URL(`../../../${CONTRACT_RELATIVE}`, import.meta.url)),
    join(process.cwd(), CONTRACT_RELATIVE),
  ];
  let poslednja = null;
  for (const putanja of kandidati) {
    try {
      return readFileSync(putanja, "utf8");
    } catch (error) {
      poslednja = error;
    }
  }
  throw new Error(
    `Ugovor se ne može učitati sa ${CONTRACT_RELATIVE}: ${poslednja?.code ?? "nepoznat razlog"}`,
  );
}

export const SCHEMA = JSON.parse(readContract());

/**
 * Ugovor se kompajlira JEDNOM, pri učitavanju modula.
 *
 * Kompilacija je i provera same šeme: pod `strict` pravilima nepoznat ili
 * zanemaren keyword obara učitavanje umesto da tiho ostane bez dejstva. Bolje
 * da to padne pri pokretanju nego pri prvom zahtevu sa mreže.
 */
const VALIDATOR = compileTrustedSchema(SCHEMA);

/* =========================================================================
 * Podržani podskup
 * ====================================================================== */

/**
 * Šta P1 ume da SAČUVA, nasuprot onome što ugovor ume da IZRAZI.
 *
 * Razlika je namerna i mora ostati vidljiva. Ugovor opisuje dokument; baza
 * danas nema kolonu za valutu ni za datum prometa. Sve što se ne može verno
 * sačuvati odbija se OVDE, pre upisa — alternativa bi bila tiho svođenje na
 * uže značenje, a to se otkriva tek kada se izveštaj ne poklopi.
 */
export const SUPPORTED = {
  /**
   * Samo RSD.
   *
   * `invoices` i `invoice_lines` NEMAJU kolonu valute — svaki iznos je
   * implicitno dinar. RSD ovde nije pročitan sa dokumenta: čitač dokumenta ne
   * čita valutu uopšte. To je podrazumevana vrednost KONFIGURACIJE podržanog
   * izvora, i tako je i dokumentovano. Drugi kod bi značio iznose bez oznake u
   * bazi, gde sto evra i sto dinara postaju isti broj.
   */
  currencies: ["RSD"],
  /**
   * Samo `issued_on`.
   *
   * Datum prometa nema gde da se sačuva, pa se ne prima. Primiti ga pa
   * odbaciti pri upisu značilo bi da pošiljalac misli da je podatak stigao.
   */
  dateBases: ["issued_on"],
  /**
   * Samo faktura.
   *
   * Storno, povrat, knjižno odobrenje i korekcije nemaju potvrđen uzorak.
   * Blokada važi i kada stignu kao JSON — JSON ne dokazuje format koji niko
   * nije video.
   */
  documentKinds: ["faktura"],
};

export class ContractRejection extends Error {
  /**
   * @param {string} code  stabilan razlog, za log i za ekran
   * @param {string} message  objašnjenje BEZ ijednog dela poslovne vrednosti
   * @param {{ path: string, reason: string }[]} [details]
   */
  constructor(code, message, details = []) {
    super(message);
    this.name = "ContractRejection";
    this.code = code;
    this.details = details;
  }
}

/* =========================================================================
 * Provera
 * ====================================================================== */

/**
 * Validira canonical payload i vraća ga tek kada je siguran.
 *
 * @param {unknown} payload  ono što je stiglo; ničemu se ne veruje
 * @param {{ issuerCode: string }} trusted  opseg iz POUZDANOG serverskog konteksta
 * @returns {{ payload: import("./types").CanonicalInvoice, semanticHash: string }}
 */
export function validateCanonicalInvoice(payload, trusted) {
  if (!trusted || typeof trusted.issuerCode !== "string" || trusted.issuerCode.trim() === "") {
    /*
     * Bez pouzdanog opsega se ne validira ništa.
     *
     * Ovo je programerska greška, ne loš ulaz: poziv bez opsega bi značio da
     * payload sam sebi dodeljuje izdavaoca.
     */
    throw new Error("Canonical provera bez pouzdanog opsega se ne sme izvršiti.");
  }

  /* --- 1. Oblik, prema autoritativnoj šemi. ---------------------------- */
  const shema = validateWithCompiled(payload, VALIDATOR);
  if (!shema.ok) {
    throw new ContractRejection(
      "schema_invalid",
      "Sadržaj ne odgovara ugovoru.",
      shema.errors,
    );
  }
  const p = /** @type {any} */ (payload);

  /* --- 2. Verzije. Nepoznata se ODBIJA, ne tumači. --------------------- */
  if (p.schema_version !== SCHEMA_VERSION) {
    throw new ContractRejection("schema_version_unsupported", "Nepodržana verzija ugovora.");
  }
  if (p.canonicalization_version !== CANONICALIZATION_VERSION) {
    throw new ContractRejection(
      "canonicalization_version_unsupported",
      "Nepodržana verzija pravila normalizacije.",
    );
  }
  if (!SUPPORTED_PARSER_VERSIONS.includes(p.parser_version)) {
    throw new ContractRejection("parser_version_unsupported", "Nepodržana verzija čitača.");
  }

  /* --- 3. Opseg. Payload ga ne sme sam sebi dodeliti. ------------------ */
  if (p.issuer.code !== trusted.issuerCode) {
    throw new ContractRejection(
      "issuer_mismatch",
      "Izdavalac iz sadržaja ne odgovara opsegu pošiljaoca.",
    );
  }

  /* --- 4. Podržani podskup. -------------------------------------------- */
  if (!SUPPORTED.documentKinds.includes(p.document.kind)) {
    throw new ContractRejection(
      "document_kind_unsupported",
      "Za ovu vrstu dokumenta ne postoji potvrđen uzorak; ne knjiži se ni kao JSON.",
    );
  }
  if (!SUPPORTED.currencies.includes(p.document.currency)) {
    throw new ContractRejection(
      "currency_unsupported",
      "Iznosi u ovoj valuti se ne mogu sačuvati — baza nema kolonu valute.",
    );
  }
  if (!SUPPORTED.dateBases.includes(p.document.date_basis)) {
    throw new ContractRejection(
      "date_basis_unsupported",
      "Datum prometa se još ne može trajno sačuvati, pa se takav ulaz ne prima.",
    );
  }
  if (p.document.trade_date !== null) {
    throw new ContractRejection(
      "trade_date_unsupported",
      "Datum prometa se još ne može trajno sačuvati, pa se takav ulaz ne prima.",
    );
  }

  /* --- 5. Datumi moraju biti stvarni i međusobno dosledni. ------------- */
  if (!jeStvaranDatum(p.document.issued_on)) {
    throw new ContractRejection("issued_on_invalid", "Datum izdavanja nije stvaran datum.");
  }
  // `date_basis` mora pokazivati na datum koji zaista postoji.
  if (p.document.date_basis === "trade_date" && p.document.trade_date === null) {
    throw new ContractRejection(
      "date_basis_mismatch",
      "Osnov datuma pokazuje na datum koji nije dostavljen.",
    );
  }

  /*
   * Poslovna godina se ne sme tiho suziti.
   *
   * Poslovni ključ fakture je `(izdavalac, vrsta, broj, godina)`, a godina se
   * izvodi iz datuma izdavanja. Dokument čija se poslovna godina razlikuje od
   * godine izdavanja postoji, ali nema potvrđen uzorak — i tiho svođenje na
   * godinu izdavanja bi ga knjižilo pod tuđim ključem.
   */
  const godinaIzdavanja = Number(p.document.issued_on.slice(0, 4));
  if (p.document.business_year !== undefined && p.document.business_year !== godinaIzdavanja) {
    throw new ContractRejection(
      "business_year_mismatch",
      "Poslovna godina se razlikuje od godine izdavanja; poslovni ključ se ne sme svesti na uži.",
    );
  }

  /* --- 6. Stavke: redosled i identitet. -------------------------------- */
  const brojevi = p.lines.map((l) => l.line_number);
  const ocekivani = brojevi.map((_, i) => i + 1);
  if (brojevi.length !== new Set(brojevi).size) {
    throw new ContractRejection("line_numbers_duplicated", "Redni brojevi stavki se ponavljaju.");
  }
  if (brojevi.join(",") !== ocekivani.join(",")) {
    throw new ContractRejection(
      "line_numbers_not_sequential",
      "Redni brojevi stavki nisu 1..N u rastućem redosledu.",
    );
  }
  if (p.parser_meta.line_count !== p.lines.length) {
    throw new ContractRejection("line_count_mismatch", "Prijavljen broj stavki ne odgovara stvarnom.");
  }

  /* --- 7. Decimale: skala i granice, bez tihog zaokruživanja. ---------- */
  try {
    canonicalDecimal(p.totals.printed_gross_total, "printed_gross_total");
    for (const l of p.lines) {
      canonicalDecimal(l.quantity, "quantity");
      canonicalDecimal(l.unit_price, "unit_price");
      canonicalDecimal(l.discount_percent, "discount_percent");
      canonicalDecimal(l.tax_percent, "tax_percent");
      if (l.tax_amount !== null) canonicalDecimal(l.tax_amount, "tax_amount");
      canonicalDecimal(l.gross_amount, "gross_amount");
    }
  } catch (error) {
    if (error instanceof DecimalError) {
      throw new ContractRejection("decimal_invalid", error.message);
    }
    throw error;
  }

  /* --- 8. Nezavisna provera iznosa — ISTA formula kao PDF put. --------- */
  const zaZbir = [];
  for (const l of p.lines) {
    const { off } = checkLineArithmetic({
      quantity: toNumberForCheck(l.quantity),
      unitPrice: toNumberForCheck(l.unit_price),
      discountPercent: toNumberForCheck(l.discount_percent),
      taxPercent: toNumberForCheck(l.tax_percent),
      taxAmount: l.tax_amount === null ? null : toNumberForCheck(l.tax_amount),
      grossAmount: toNumberForCheck(l.gross_amount),
    });
    if (off.length > 0) {
      throw new ContractRejection(
        "line_arithmetic_mismatch",
        "Stavka ne prolazi proveru aritmetike.",
      );
    }
    zaZbir.push({ grossAmount: toNumberForCheck(l.gross_amount) });
  }

  const totals = validateTotals(zaZbir, toNumberForCheck(p.totals.printed_gross_total));
  if (!totals.ok) {
    // Bez iznosa u poruci: razlika se gleda na ekranu, ne iz loga.
    throw new ContractRejection("totals_mismatch", "Odštampan zbir se ne poklapa sa izračunatim.");
  }

  /* --- 9. Semantic hash — server ga PONOVO računa. --------------------- */
  const izracunat = semanticHash(p);
  if (izracunat !== p.semantic_hash) {
    throw new ContractRejection(
      "semantic_hash_mismatch",
      "Semantički otisak se ne poklapa sa sadržajem.",
    );
  }

  return { payload: p, semanticHash: izracunat };
}

/**
 * Stvaran kalendarski datum, ne samo tačan oblik.
 *
 * `2026-02-30` prolazi svaki regex a nema ga u kalendaru; propušten bi otišao u
 * upit i vratio se kao sirova greška drajvera.
 */
function jeStvaranDatum(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() + 1 === Number(m[2]) &&
    d.getUTCDate() === Number(m[3])
  );
}
