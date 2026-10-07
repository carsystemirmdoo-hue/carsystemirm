/**
 * Ulazni fajlovi za vezu kupaca — čista pravila, bez baze i bez fajl-sistema.
 *
 * Isti kod čita komanda (`scripts/ops/customer-link.mts plan`) i portal
 * (primena potvrđenih veza), da tabela koju je kancelarija pregledala znači
 * isto na oba mesta.
 */

/** Kolone pregledne tabele, tačnim redom. */
export const REVIEW_COLUMNS = Object.freeze([
  "kljuc", "sifra_na_fakturi", "sifra_u_sifarniku", "pib", "naziv_u_sifarniku", "mesto",
  "dokumenata", "predlog", "postojeci_kupac", "odluka", "potvrdio", "napomena",
]);

export class LinkReviewError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "LinkReviewError";
    this.code = code;
  }
}

/**
 * Šifarnik iz redova sirovog BizniSoft izvoza kupaca (prvi red = zaglavlje).
 *
 * @param {(string | null)[][]} rows
 */
export function registerFromRows(rows) {
  const [head = [], ...body] = rows;
  const col = (label) => {
    const i = head.indexOf(label);
    if (i < 0) throw new LinkReviewError(`Šifarnik nema kolonu „${label}".`, "register_column_missing");
    return i;
  };
  const [iC, iP, iN, iM, iB] = [col("Šifra"), col("PIB / JMBG"), col("Naziv partnera"), col("Mesto"), col("Blokiran")];
  return body
    .filter((r) => r[iC] !== null && String(r[iC]).trim() !== "")
    .map((r) => ({
      code: String(r[iC]).trim(),
      pib: r[iP] ? String(r[iP]).trim() : null,
      name: r[iN] ? String(r[iN]).trim() : null,
      city: r[iM] ? String(r[iM]).trim() : null,
      blocked: r[iB] === "True",
    }));
}

/** CSV sa „;" i navodnicima (kako ga piše `plan`), uz moguć BOM. */
export function parseSemicolonCsv(text) {
  const lines = String(text).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const split = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
      } else if (c === '"') q = true;
      else if (c === ";") { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur);
    return out;
  };
  return lines.map(split);
}

/**
 * Pregledana tabela → odluke i partneri talasa.
 *
 * Zaglavlje mora biti tačno `REVIEW_COLUMNS` (izmenjena struktura = zaustavi).
 * Odluka je samo `potvrdi` ili `odbij`; `potvrdi` traži ime u `potvrdio`.
 */
/**
 * @param {string} text
 * @returns {{ decisions: { key: string, decision: "" | "potvrdi" | "odbij", confirmedBy: string }[],
 *             invoicePartners: { code: string, pib: string | null, documents: number }[] }}
 */
export function readReview(text) {
  const [head, ...rows] = parseSemicolonCsv(text);
  if (!head || head.length !== REVIEW_COLUMNS.length || head.some((h, i) => h.trim() !== REVIEW_COLUMNS[i])) {
    throw new LinkReviewError("Tabela nije u očekivanom obliku (kolone se razlikuju od predloga).", "review_columns");
  }
  const at = Object.fromEntries(REVIEW_COLUMNS.map((c, i) => [c, i]));
  const keys = new Set();
  const decisions = [];
  const invoicePartners = [];
  for (const [n, r] of rows.entries()) {
    const key = (r[at.kljuc] ?? "").trim();
    if (!/^[0-9a-f]{16}$/.test(key)) throw new LinkReviewError(`Red ${n + 2}: neispravan ključ predloga.`, "review_key");
    if (keys.has(key)) throw new LinkReviewError(`Red ${n + 2}: isti ključ predloga se ponavlja.`, "review_duplicate");
    keys.add(key);
    const raw = (r[at.odluka] ?? "").trim().toLowerCase();
    if (raw !== "" && raw !== "potvrdi" && raw !== "odbij") {
      throw new LinkReviewError(`Red ${n + 2}: odluka mora biti „potvrdi", „odbij" ili prazno.`, "review_decision");
    }
    const confirmedBy = (r[at.potvrdio] ?? "").trim();
    if (raw === "potvrdi" && confirmedBy.length < 3) {
      throw new LinkReviewError(`Red ${n + 2}: potvrda traži ime osobe koja je proverila red.`, "review_confirmed_by");
    }
    decisions.push({ key, decision: /** @type {"" | "potvrdi" | "odbij"} */ (raw), confirmedBy });
    const documents = Number.parseInt(r[at.dokumenata] ?? "", 10);
    invoicePartners.push({
      code: (r[at.sifra_na_fakturi] ?? "").trim(),
      pib: (r[at.pib] ?? "").trim() || null,
      documents: Number.isFinite(documents) ? documents : 0,
    });
  }
  return { decisions, invoicePartners };
}
