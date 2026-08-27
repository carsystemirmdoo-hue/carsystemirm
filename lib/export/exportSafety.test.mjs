import assert from "node:assert/strict";
import test from "node:test";

import {
  FORMULA_GUARD,
  guardSpreadsheetRow,
  guardSpreadsheetValue,
  looksLikeFormula,
} from "./spreadsheet-safety.mjs";
import { toCsv, toXlsx, EXPORT_FORMATS } from "./serializers.mjs";

const meta = {
  title: "Promet po kupcu",
  generatedAt: "24. avg 2026. 11:04",
  generatedBy: "Test (gazda)",
  filters: [{ label: "Grupa proizvoda", value: "sve" }],
};

/** Ulazi koje tabelarni program sme protumačiti kao formulu. */
const DANGEROUS = [
  ["prosto jednako", "=1+1"],
  ["plus", "+SUM(A1:A2)"],
  ["minus kao tekst", "-2+3"],
  ["at", "@SUM(A1:A2)"],
  ["vodeci razmak", "  =1+1"],
  ["vodeci tab", "\t=1+1"],
  ["vodeci CR", "\r=1+1"],
  ["vodeci LF", "\n=1+1"],
  ["nedeljivi razmak", " =1+1"],
  ["BOM", "﻿=1+1"],
  ["DDE poziv", '=cmd|\'/c calc\'!A1'],
  ["hyperlink", '=HYPERLINK("http://zlo.rs","klikni")'],
];

/** Ulazi koji moraju proći nepromenjeni. */
const SAFE = [
  ["obican tekst", "Cosmos Lac Easy Max"],
  ["sifra sa crticom unutra", "40-204"],
  ["unicode", "Šifra artikla — nijansa č/ć/ž/đ/š"],
  ["prazan string", ""],
  ["samo razmak", " "],
  ["broj u tekstu", "1.234,56"],
  ["email", "kupac@primer.rs"],
];

/* -------------------------------------------------------------------------
 * Sanitizer
 * ---------------------------------------------------------------------- */

test("prepoznaje sve oblike formula markera", () => {
  for (const [label, input] of DANGEROUS) {
    assert.equal(looksLikeFormula(input), true, `promasen: ${label}`);
  }
});

test("bezbedan sadrzaj ostaje netaknut", () => {
  for (const [label, input] of SAFE) {
    assert.equal(looksLikeFormula(input), false, `lazna uzbuna: ${label}`);
    assert.equal(guardSpreadsheetValue(input), input, `izmenjen: ${label}`);
  }
});

test("opasan sadrzaj dobija prefiks i cuva original iza njega", () => {
  for (const [label, input] of DANGEROUS) {
    const guarded = guardSpreadsheetValue(input);
    assert.equal(
      guarded,
      `${FORMULA_GUARD}${input}`,
      `neneutralisan: ${label}`,
    );
    // Podatak se ne gubi — samo prestaje da počinje markerom.
    assert.equal(guarded.slice(1), input, `izgubljen sadrzaj: ${label}`);
  }
});

test("stvaran broj ostaje broj, i kad je negativan", () => {
  for (const value of [0, 42, -1250.4, -0.001, 1e6]) {
    const guarded = guardSpreadsheetValue(value);
    assert.equal(typeof guarded, "number", `pretvoren u tekst: ${value}`);
    assert.equal(guarded, value);
  }
  // Ista vrednost kao NEPOUZDAN TEKST mora dobiti zaštitu.
  assert.equal(guardSpreadsheetValue("-1250.4"), "'-1250.4");
});

test("null, undefined i ne-stringovi prolaze bez izmene", () => {
  assert.equal(guardSpreadsheetValue(null), null);
  assert.equal(guardSpreadsheetValue(undefined), undefined);
  assert.equal(guardSpreadsheetValue(true), true);
  // NaN i Infinity nisu konačni brojevi i ne smeju proći kao broj.
  assert.equal(guardSpreadsheetValue(Number.NaN), Number.NaN);
});

test("red se stiti celiju po celiju", () => {
  assert.deepEqual(guardSpreadsheetRow(["=1+1", "ok", -5, null]), [
    "'=1+1",
    "ok",
    -5,
    null,
  ]);
  assert.deepEqual(guardSpreadsheetRow([]), []);
  assert.deepEqual(guardSpreadsheetRow(undefined), []);
});

/* -------------------------------------------------------------------------
 * CSV putanja
 * ---------------------------------------------------------------------- */

test("CSV: nijedna celija ne pocinje formula markerom", () => {
  const rows = DANGEROUS.map(([, input]) => [input, "prati"]);
  const csv = toCsv(["Naziv", "Napomena"], rows, meta);

  // Redovi zaglavlja su komentari (`# …`) i nisu ćelije podataka.
  const dataLines = csv
    .split("\r\n")
    .filter((line) => line !== "" && !line.startsWith("#"));

  for (const line of dataLines) {
    const firstCell = line.startsWith('"')
      ? line.slice(1, line.indexOf('"', 1))
      : line.split(";")[0];
    assert.ok(
      !/^[=+\-@\t\r\n]/.test(firstCell),
      `celija i dalje pocinje markerom: ${JSON.stringify(firstCell)}`,
    );
  }
});

/**
 * Minimalan CSV čitač koji poštuje navodnike.
 *
 * Naivno deljenje po `\r\n` ovde ne valja: prelom reda UNUTAR navodnika je
 * legitiman deo jedne ćelije, i tabelarni program ga tako i čita. Test mora
 * proveravati ćelije onako kako ih vidi Excel, a ne fizičke linije fajla.
 */
function parseCsvCells(text, separator = ";") {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          current += '"';
          index += 1;
        } else inQuotes = false;
      } else current += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === separator) {
      cells.push(current);
      current = "";
    } else if (char === "\r" && text[index + 1] === "\n") {
      cells.push(current);
      current = "";
      index += 1;
    } else current += char;
  }
  cells.push(current);
  return cells;
}

test("CSV: neutralizacija ide PRE navodjenja, bez izlaska iz celije", () => {
  // Napad koji kombinuje separator, navodnike i prelom reda — pokušaj da se
  // sadržaj izlije u susednu ćeliju ili u nov red.
  const nasty = '=1+1";DROP\r\n=2+2';
  const csv = toCsv(["A"], [[nasty]], meta);

  // Navodnici su udvostručeni, pa se sadržaj ne izliva.
  assert.ok(csv.includes(`"'=1+1"";DROP`), "prefiks ili navodjenje nisu primenjeni");

  // Nijedna ćelija koju Excel zaista vidi ne sme početi markerom.
  const cells = parseCsvCells(csv).filter((c) => c !== "" && !c.startsWith("#"));
  for (const value of cells) {
    assert.ok(
      !/^[=+\-@\t\r\n]/.test(value),
      `celija pocinje markerom: ${JSON.stringify(value)}`,
    );
  }

  // Napad je ostao JEDNA ćelija — nije se razlio u dve.
  const payload = cells.find((c) => c.includes("DROP"));
  assert.ok(payload.startsWith("'"), "celija nije neutralisana");
  assert.ok(payload.includes("=2+2"), "sadrzaj je izgubljen umesto neutralisan");
});

test("CSV: separator i navodnici i dalje rade ispravno", () => {
  const csv = toCsv(["A", "B"], [["ima;separator", 'ima"navodnik']], meta);
  assert.ok(csv.includes('"ima;separator"'));
  assert.ok(csv.includes('"ima""navodnik"'));
});

test("CSV: broj se ne navodi i ne prefiksuje", () => {
  const csv = toCsv(["Iznos"], [[-1250.4]], meta);
  assert.ok(csv.includes("-1250.4"), "broj je izmenjen");
  assert.ok(!csv.includes("'-1250.4"), "broj je pogresno prefiksovan");
});

/* -------------------------------------------------------------------------
 * XLSX (SpreadsheetML) putanja
 * ---------------------------------------------------------------------- */

test("XLSX: nijedna celija ne postaje formula", () => {
  const rows = DANGEROUS.map(([, input]) => [input]);
  const xml = toXlsx(["Naziv"], rows, meta);

  // Strukturna garancija: formula u SpreadsheetML-u ide preko `ss:Formula`.
  assert.ok(!xml.includes("ss:Formula"), "emitovan je formula atribut");

  // Sadržajna garancija: nijedan `<Data>` ne počinje markerom.
  const cells = [...xml.matchAll(/<Data ss:Type="String">([\s\S]*?)<\/Data>/g)].map(
    (match) => match[1],
  );
  for (const value of cells) {
    assert.ok(
      !/^[=+\-@\t\r\n]/.test(value),
      `String celija pocinje markerom: ${JSON.stringify(value)}`,
    );
  }
});

test("XLSX: tip celije je String za tekst, Number za broj", () => {
  const xml = toXlsx(["Naziv", "Iznos"], [["=1+1", -1250.4]], meta);
  assert.ok(xml.includes('ss:Type="Number">-1250.4<'), "broj nije Number celija");
  assert.ok(xml.includes("&apos;=1+1"), "tekst nije neutralisan ili nije escapovan");
});

test("XLSX: meta filteri su celije i takodje su zasticeni", () => {
  const xml = toXlsx(
    ["A"],
    [["ok"]],
    { ...meta, filters: [{ label: "Kupac", value: "=1+1" }] },
  );
  const cells = [...xml.matchAll(/<Data ss:Type="String">([\s\S]*?)<\/Data>/g)].map(
    (m) => m[1],
  );
  assert.ok(
    cells.some((c) => c.startsWith("&apos;")),
    "vrednost filtera nije neutralisana",
  );
});

test("XLSX: XML escapovanje i dalje radi", () => {
  const xml = toXlsx(["A"], [['<tag> & "navodnik"']], meta);
  assert.ok(xml.includes("&lt;tag&gt; &amp; &quot;navodnik&quot;"));
});

/* -------------------------------------------------------------------------
 * Ceo izvozni tok
 * ---------------------------------------------------------------------- */

test("zastita je u stvarnom izvoznom toku, ne samo u pomocnoj funkciji", () => {
  // `EXPORT_FORMATS` je ono što `app/api/portal/izvoz/route.ts` zaista poziva.
  for (const format of ["csv", "xlsx"]) {
    const body = EXPORT_FORMATS[format].render(["Naziv"], [["=1+1"]], meta);
    assert.ok(
      body.includes("'=1+1") || body.includes("&apos;=1+1"),
      `${format}: sirov marker je stigao do izlaza`,
    );
  }
});

test("PDF putanja nije tabelarna i ne dobija prefiks", () => {
  // PDF nema ćelije ni formule; prefiks bi tu bio samo šum u izveštaju.
  const pdf = EXPORT_FORMATS.pdf.render(["Naziv"], [["=1+1"]], meta);
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.ok(!pdf.includes("'=1+1"), "PDF je nepotrebno izmenjen");
});
