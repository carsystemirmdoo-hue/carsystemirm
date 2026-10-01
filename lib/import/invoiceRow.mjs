/**
 * Provera i normalizacija jednog reda iz BiznisSoft izvoza.
 *
 * Čista logika, bez baze — da bi se pravila mogla proveriti testom, a red koji
 * ne prođe proveru nikada ne uđe u promet.
 */

/** Kolone koje izvoz mora da ima. */
export const REQUIRED_COLUMNS = [
  "pib",
  "kupac",
  "broj_dokumenta",
  "datum",
  "vrsta_dokumenta",
  "sifra_artikla",
  "kolicina",
  "cena",
  "iznos_stavke",
];

/**
 * Mapiranje oznaka vrste dokumenta iz izvora na vrste koje sistem razume.
 * Ono što nije na spisku ostaje `nepoznato` — bez pogađanja.
 */
const DOCUMENT_KINDS = {
  faktura: "faktura",
  racun: "faktura",
  otpremnica: "faktura",
  povrat: "povrat_robe",
  "povrat robe": "povrat_robe",
  storno: "storno",
  "knjizno odobrenje": "knjizno_odobrenje",
  knjizno_odobrenje: "knjizno_odobrenje",
  odobrenje: "knjizno_odobrenje",
  "korekcija cene": "korekcija_cene",
  korekcija_cene: "korekcija_cene",
  "korekcija popusta": "korekcija_popusta",
  korekcija_popusta: "korekcija_popusta",
  popust: "korekcija_popusta",
};

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/**
 * Prepoznaje vrstu dokumenta iz izvora.
 *
 * @param {unknown} raw
 * @returns {{ kind: string, known: boolean, source: string }}
 */
export function classifyDocument(raw) {
  const source = text(raw);
  // Izvor piše i „Knjižno odobrenje“ i „knjizno odobrenje“ — dijakritike se
  // uklanjaju pre poređenja da bi oba oblika dala isti rezultat.
  const key = source
    .toLocaleLowerCase("sr-Latn")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[-_]+/g, " ")
    .trim();
  const kind = DOCUMENT_KINDS[key] ?? DOCUMENT_KINDS[key.replace(/\s+/g, "_")];
  return {
    kind: kind ?? "nepoznato",
    known: Boolean(kind),
    source,
  };
}

/**
 * Broj iz izvoza. Prihvata i srpski zapis (1.234,56) i tačku kao decimalu.
 * Znak se čuva — negativne vrednosti su legitimne.
 *
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseNumber(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const value = text(raw);
  if (value === "") return null;

  const negative = /^-/.test(value) || /^\(.*\)$/.test(value);
  let digits = value.replace(/[()\s]/g, "").replace(/^-/, "");

  if (digits.includes(",")) {
    // 1.234,56 → tačka je razdvajač hiljada, zarez decimala.
    digits = digits.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(digits)) {
    // Bez zareza, a grupe su tačno po tri cifre: `1.200` je hiljadu dvesta,
    // ne jedan i dva. Knjigovodstveni izvoz piše iznose u srpskom formatu.
    digits = digits.replace(/\./g, "");
  }
  if (!/^\d*\.?\d*$/.test(digits) || digits === "" || digits === ".") return null;

  const parsed = Number.parseFloat(digits);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/**
 * Datum iz izvoza: `dd.mm.gggg`, `dd/mm/gggg` ili ISO. Vraća ISO datum.
 * Nepostojeći datum (31.02.) se odbija, ne „popravlja“.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function parseDate(raw) {
  const value = text(raw);
  if (value === "") return null;

  let day;
  let month;
  let year;

  const dotted = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\.?$/);
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dotted) {
    [, day, month, year] = dotted.map(Number);
  } else if (iso) {
    [, year, month, day] = iso.map(Number);
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Ako se dan „prelio“ u sledeći mesec, datum ne postoji.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** PIB u Srbiji ima devet cifara. */
export function isValidPib(raw) {
  return /^\d{9}$/.test(text(raw));
}

/**
 * Stabilni identitet fakture. Namerno ne koristi redni broj reda ni poziciju
 * fajla — samo poslovne podatke, da bi ponovni uvoz pogodio isti dokument.
 *
 * @param {{ companyId: string, documentKind: string, number: string, year: number }} invoice
 * @returns {string}
 */
export function invoiceIdentity(invoice) {
  return [
    text(invoice.companyId).toLocaleLowerCase("sr-Latn"),
    invoice.documentKind,
    text(invoice.number).toLocaleLowerCase("sr-Latn"),
    invoice.year,
  ].join("|");
}

/**
 * Proverava jedan red i vraća normalizovane vrednosti ili spisak grešaka.
 *
 * @param {Record<string, unknown>} row
 * @param {number} rowNumber
 */
export function validateInvoiceRow(row, rowNumber) {
  /** @type {{ field: string, message: string, level: "greska" | "upozorenje" }[]} */
  const problems = [];
  const fail = (field, message) =>
    problems.push({ field, message, level: "greska" });
  const warn = (field, message) =>
    problems.push({ field, message, level: "upozorenje" });

  const pib = text(row.pib);
  if (!isValidPib(pib)) {
    fail("pib", `PIB „${pib || "prazno"}“ nije ispravan (očekuje se 9 cifara).`);
  }

  const number = text(row.broj_dokumenta);
  if (number === "") fail("broj_dokumenta", "Broj dokumenta nedostaje.");

  const issuedOn = parseDate(row.datum);
  if (!issuedOn) {
    fail("datum", `Datum „${text(row.datum) || "prazno"}“ ne postoji.`);
  }

  const document = classifyDocument(row.vrsta_dokumenta);
  const articleCode = text(row.sifra_artikla);
  if (articleCode === "") fail("sifra_artikla", "Šifra artikla nedostaje.");

  const quantity = parseNumber(row.kolicina);
  if (quantity === null) fail("kolicina", "Količina nije broj.");

  const unitPrice = parseNumber(row.cena);
  if (unitPrice === null) fail("cena", "Cena nije broj.");

  const lineAmount = parseNumber(row.iznos_stavke);
  if (lineAmount === null) fail("iznos_stavke", "Iznos stavke nije broj.");

  const discountPercent = parseNumber(row.rabat) ?? 0;
  const taxPercent = parseNumber(row.poreska_stopa) ?? 0;

  // Znak količine i iznosa mora da se slaže: negativna količina uz pozitivan
  // iznos je greška u izvoru, a ne nešto što treba tiho ispraviti.
  if (quantity !== null && lineAmount !== null && quantity !== 0 && lineAmount !== 0) {
    if (Math.sign(quantity) !== Math.sign(lineAmount)) {
      fail(
        "iznos_stavke",
        `Znak količine (${quantity}) i iznosa (${lineAmount}) se ne poklapaju.`,
      );
    }
  }

  // Negativan dokument bez prepoznate vrste se uvozi, ali se obeležava —
  // prikazuje se kao „vrsta nije poznata iz izvora“.
  const isNegative =
    (quantity !== null && quantity < 0) || (lineAmount !== null && lineAmount < 0);
  if (isNegative && !document.known) {
    warn(
      "vrsta_dokumenta",
      "Negativna stavka bez prepoznate vrste dokumenta — vrsta ostaje nepoznata.",
    );
  }

  if (text(row.komercijalista) === "") {
    warn("komercijalista", "Komercijalista nije naveden u izvoru.");
  }

  // Provera zbira: iznos stavke bi trebalo da odgovara količini i ceni uz rabat.
  if (quantity !== null && unitPrice !== null && lineAmount !== null) {
    const expected = quantity * unitPrice * (1 - discountPercent / 100);
    if (Math.abs(expected - lineAmount) > 0.02 + Math.abs(expected) * 0.005) {
      warn(
        "iznos_stavke",
        `Iznos ${lineAmount} ne odgovara količini × ceni − rabat (${expected.toFixed(2)}).`,
      );
    }
  }

  const hasError = problems.some((problem) => problem.level === "greska");
  const year = issuedOn ? Number(issuedOn.slice(0, 4)) : null;

  return {
    rowNumber,
    status: hasError
      ? "neispravan"
      : problems.length > 0
        ? "upozorenje"
        : "ispravan",
    problems,
    value: hasError
      ? null
      : {
          companyId: text(row.pravno_lice) || "carsystem",
          pib,
          customerName: text(row.kupac) || `Kupac ${pib}`,
          city: text(row.grad) || null,
          number,
          year,
          issuedOn,
          documentKind: document.kind,
          sourceDocumentType: document.source || null,
          documentKindKnown: document.known,
          salespersonCode: text(row.sifra_komercijaliste) || text(row.komercijalista) || null,
          salespersonName: text(row.komercijalista) || null,
          articleCode,
          articleName: text(row.naziv_artikla) || articleCode,
          productGroup: text(row.grupa_proizvoda) || null,
          brand: text(row.brend) || null,
          unit: text(row.jm) || null,
          lineNumber: Number(row.redni_broj) || rowNumber,
          quantity,
          unitPrice,
          discountPercent,
          taxPercent,
          lineAmount,
        },
  };
}

/**
 * Obavezne kolone kojih nema u zaglavlju (prvi red nosi sve ključeve zaglavlja,
 * vidi `parseDelimited`). Bez ove provere je fajl bez, npr., kolone `pib`
 * davao istu grešku u svakom redu umesto jedne jasne poruke.
 *
 * @param {Record<string, unknown>[]} rows
 * @returns {string[]}
 */
export function missingRequiredColumns(rows) {
  if (rows.length === 0) return [];
  const present = new Set(Object.keys(rows[0]));
  return REQUIRED_COLUMNS.filter((column) => !present.has(column));
}

/**
 * Faktura se uvozi CELA ili nikako.
 *
 * Ranije je faktura sa jednom neispravnom stavkom knjižena bez te stavke, a
 * njen zbir računat iz ostatka — promet manji od stvarnog, bez traga na samoj
 * fakturi. Ovde se svaka ispravna stavka fakture koja ima i neispravnu stavku
 * (isti `broj_dokumenta` u izvornom redu) prevodi u neispravnu, sa razlogom.
 *
 * @template {{ rowNumber: number, status: string, problems: object[], value: unknown }} R
 * @param {R[]} validated rezultat `validateInvoiceRow` po redu
 * @param {Record<string, unknown>[]} rows izvorni redovi (isti redosled)
 * @returns {{ rows: R[], heldBack: number }}
 */
export function holdBackIncompleteInvoices(validated, rows) {
  const broken = new Set();
  for (const row of validated) {
    if (row.status !== "neispravan") continue;
    const number = text(rows[row.rowNumber - 1]?.broj_dokumenta);
    if (number) broken.add(number);
  }
  let heldBack = 0;
  const out = validated.map((row) => {
    if (row.value === null) return row;
    const number = text(rows[row.rowNumber - 1]?.broj_dokumenta);
    if (!broken.has(number)) return row;
    heldBack += 1;
    return {
      ...row,
      status: "neispravan",
      value: null,
      problems: [
        {
          field: "broj_dokumenta",
          message: "Faktura nije uvezena: druga stavka iste fakture ima grešku.",
          level: "greska",
        },
      ],
    };
  });
  return { rows: out, heldBack };
}
