import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CSV_INVOICE_UPLOAD_ENABLED } from "./csv-gate.mjs";
import {
  holdBackIncompleteInvoices,
  missingRequiredColumns,
  REQUIRED_COLUMNS,
  validateInvoiceRow,
} from "./invoiceRow.mjs";

/**
 * CSV uvoz faktura (odluka 2026-10-01 + nalazi audita).
 * Redovi su izmišljeni; PIB vrednosti ne prolaze kontrolni broj.
 */

const root = new URL("../../", import.meta.url);
const code = (rel) =>
  readFileSync(new URL(rel, root), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

const base = {
  pib: "100000001",
  kupac: "Primer Kupac",
  broj_dokumenta: "QA-1",
  datum: "01.03.2025",
  vrsta_dokumenta: "faktura",
  sifra_artikla: "900001",
  kolicina: "1",
  cena: "100,00",
  iznos_stavke: "100,00",
  poreska_stopa: "20",
  rabat: "0",
};

test("CSV uvoz je isključen u kodu, ne preko okruženja", () => {
  assert.equal(CSV_INVOICE_UPLOAD_ENABLED, false);
  assert.doesNotMatch(code("lib/import/csv-gate.mjs"), /process\.env/);
});

test("akcija odbija pre čitanja fajla, a ekran ne prikazuje obrazac", () => {
  const action = code("app/portal/importi/actions.ts");
  const gate = action.indexOf("if (!CSV_INVOICE_UPLOAD_ENABLED)");
  const read = action.indexOf('formData.get("fajl")');
  assert.ok(gate > 0 && read > gate, "kapija mora pre čitanja fajla");
  const page = code("app/portal/importi/page.tsx");
  assert.match(page, /CSV_INVOICE_UPLOAD_ENABLED \? \(\s*<ImportUpload \/>/);
});

test("zaglavlje bez obaveznih kolona se prijavljuje jednom porukom", () => {
  assert.deepEqual(missingRequiredColumns([]), []);
  assert.deepEqual(missingRequiredColumns([base]), []);
  const { pib, iznos_stavke, ...rest } = base;
  void pib; void iznos_stavke;
  assert.deepEqual(missingRequiredColumns([rest]), ["pib", "iznos_stavke"]);
  assert.ok(REQUIRED_COLUMNS.length >= 9);
});

test("faktura sa jednom neispravnom stavkom se ne uvozi ni delimično", () => {
  const rows = [
    { ...base, broj_dokumenta: "QA-1", sifra_artikla: "900001" },
    { ...base, broj_dokumenta: "QA-1", sifra_artikla: "900002", kolicina: "nije broj" },
    { ...base, broj_dokumenta: "QA-2", sifra_artikla: "900003" },
  ];
  const validated = rows.map((row, i) => validateInvoiceRow(row, i + 1));
  assert.equal(validated[1].status, "neispravan", "pretpostavka testa: red 2 je neispravan");
  const { rows: out, heldBack } = holdBackIncompleteInvoices(validated, rows);
  assert.equal(heldBack, 1);
  assert.equal(out[0].value, null, "ispravna stavka iste fakture je zadržana");
  assert.equal(out[0].status, "neispravan");
  assert.match(out[0].problems[0].message, /druga stavka iste fakture/);
  assert.notEqual(out[2].value, null, "druga faktura nije pogođena");
});

test("istovremeni uvoz istog fajla je duplikat, ne greška", () => {
  const importer = code("lib/import/invoiceImport.ts");
  assert.match(importer, /isUniqueViolation\(error, "import_runs_file_hash_key"\)/);
  assert.match(importer, /return duplicateOutcome\(winner\?\.id \?\? null, rows\.length\)/);
});
