import assert from "node:assert/strict";
import test from "node:test";

import {
  FORMULA_GUARD,
  guardSpreadsheetRow,
  guardSpreadsheetValue,
  looksLikeFormula,
} from "./spreadsheet-safety.mjs";
import { inflateRawSync } from "node:zlib";
import { toCsv, toXlsx, EXPORT_FORMATS } from "./serializers.mjs";
import { crc32 } from "./xlsx.mjs";

/** Raspakuje ZIP iz izvoza (centralni direktorijum) i proverava CRC svakog dela. */
function unzip(bytes) {
  const buf = Buffer.from(bytes);
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, "nema kraja ZIP direktorijuma");
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i += 1) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, "neispravan zapis direktorijuma");
    const crc = buf.readUInt32LE(p + 16);
    const packed = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = inflateRawSync(buf.subarray(dataAt, dataAt + packed));
    assert.equal(raw.length, size, `${name}: veličina`);
    assert.equal(crc32(raw), crc, `${name}: CRC`);
    files[name] = raw.toString("utf8");
    p += 46 + nameLen;
  }
  return files;
}
const sheetOf = (bytes) => unzip(bytes)["xl/worksheets/sheet1.xml"];
const textCells = (xml) => [...xml.matchAll(/<t xml:space="preserve">([\s\S]*?)<\/t>/g)].map((m) => m[1]);

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
  assert.ok(csv.includes("\r\n-1250,4"), "broj nije u obliku za srpski Excel (decimalni zarez, bez navodnika)");
  assert.ok(!csv.includes("'-1250"), "broj je pogresno prefiksovan");
});

/* -------------------------------------------------------------------------
 * XLSX (Office Open XML) putanja
 * ---------------------------------------------------------------------- */

test("XLSX: pravi Office Open XML paket sa ispravnim CRC-om", () => {
  const files = unzip(toXlsx(["Naziv", "Iznos"], [["Đorđe Čačak", 12.5]], meta));
  for (const part of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
    assert.ok(files[part], `nedostaje ${part}`);
  }
  assert.ok(files["xl/worksheets/sheet1.xml"].includes("Đorđe Čačak"), "dijakritika se izgubila");
  assert.equal(EXPORT_FORMATS.xlsx.extension, "xlsx");
});

test("XLSX: nijedna celija ne postaje formula", () => {
  const rows = DANGEROUS.map(([, input]) => [input]);
  const xml = sheetOf(toXlsx(["Naziv"], rows, meta));

  // Strukturna garancija: formula u OOXML-u ide kroz element `<f>`.
  assert.ok(!/<f[ >]/.test(xml), "emitovan je element formule");

  // Sadržajna garancija: nijedna tekstualna ćelija ne počinje markerom.
  for (const value of textCells(xml)) {
    assert.ok(
      !/^[=+\-@\t\r\n]/.test(value),
      `String celija pocinje markerom: ${JSON.stringify(value)}`,
    );
  }
});

test("XLSX: tip celije je tekst za tekst, broj za broj", () => {
  const xml = sheetOf(toXlsx(["Naziv", "Iznos"], [["=1+1", -1250.4]], meta));
  assert.ok(/<c r="B\d+"><v>-1250\.4<\/v><\/c>/.test(xml), "broj nije numerička ćelija");
  assert.ok(xml.includes("&apos;=1+1"), "tekst nije neutralisan ili nije escapovan");
});

test("XLSX: meta filteri su celije i takodje su zasticeni", () => {
  const xml = sheetOf(toXlsx(["A"], [["ok"]], { ...meta, filters: [{ label: "Kupac", value: "=1+1" }] }));
  assert.ok(textCells(xml).some((c) => c.startsWith("&apos;")), "vrednost filtera nije neutralisana");
});

test("XLSX: XML escapovanje i kontrolni znakovi", () => {
  const xml = sheetOf(toXlsx(["A"], [['<tag> & "navodnik"\u0001']], meta));
  assert.ok(xml.includes("&lt;tag&gt; &amp; &quot;navodnik&quot;"));
  assert.ok(!xml.includes("\u0001"), "kontrolni znak bi pokvario XML");
});

/* -------------------------------------------------------------------------
 * Ceo izvozni tok
 * ---------------------------------------------------------------------- */

test("zastita je u stvarnom izvoznom toku, ne samo u pomocnoj funkciji", () => {
  // `EXPORT_FORMATS` je ono što `app/api/portal/izvoz/route.ts` zaista poziva.
  for (const format of ["csv", "xlsx"]) {
    const rendered = EXPORT_FORMATS[format].render(["Naziv"], [["=1+1"]], meta);
    const body = typeof rendered === "string" ? rendered : sheetOf(rendered);
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
