import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import {
  columnIndex,
  decodeXmlText,
  readXlsx,
  unzipEntries,
  XlsxReadError,
} from "./readXlsx.mjs";

const FIXTURE = new URL("../../../fixtures/dev/partners/partner-prep-synthetic.xlsx", import.meta.url);

/** Najmanji ZIP pisac za test: STORE ili DEFLATE, bez ZIP64. */
function zip(files, { deflate = true } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, "utf8");
    const raw = Buffer.from(content, "utf8");
    const data = deflate ? deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, eocd]);
}

test("čita Excel/openpyxl oblik bez prefiksa i čuva tekst tačno", () => {
  const sheets = readXlsx(readFileSync(FIXTURE));
  assert.deepEqual(
    sheets.map((s) => s.name),
    ["Kupci sa emailom", "Kupci bez emaila", "Za dodatnu proveru", "Pomocna lista 99", "Metod i ogranicenja"],
  );
  const first = sheets[0].rows[1];
  // Vodeća nula ostaje — šifra "0012" nije šifra "12".
  assert.equal(first[0], "0012");
  assert.equal(sheets[0].rows[2][0], "12");
  for (const v of first) assert.ok(v === null || typeof v === "string");
});

test("čita .NET OpenXML oblik sa prefiksom x: i inline tekstom", () => {
  const bytes = zip({
    "xl/workbook.xml":
      '<?xml version="1.0"?><x:workbook xmlns:x="m"><x:sheets><x:sheet name="List 1" sheetId="1" r:id="R1" xmlns:r="r" /></x:sheets></x:workbook>',
    "xl/_rels/workbook.xml.rels":
      '﻿<?xml version="1.0"?><Relationships><Relationship Type="t" Target="/xl/worksheets/sheet1.xml" Id="R1" /></Relationships>',
    "xl/sharedStrings.xml":
      '<x:sst><x:si><x:t>Šifra</x:t></x:si><x:si><x:r><x:t>Pr</x:t></x:r><x:r><x:t xml:space="preserve">va &amp; druga</x:t></x:r></x:si></x:sst>',
    "xl/worksheets/sheet1.xml":
      '<x:worksheet><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="C1" t="s"><x:v>1</x:v></x:c></x:row>' +
      '<x:row r="3"><x:c r="A3"><x:v>0012</x:v></x:c><x:c r="B3" t="inlineStr"><x:is><x:t>Inđija</x:t></x:is></x:c></x:row></x:sheetData></x:worksheet>',
  });
  const [sheet] = readXlsx(bytes);
  assert.equal(sheet.name, "List 1");
  assert.deepEqual(sheet.rows[0], ["Šifra", null, "Prva & druga"]);
  assert.deepEqual(sheet.rows[1], []);
  assert.deepEqual(sheet.rows[2], ["0012", "Inđija"]);
});

test("STORE zapis se čita isto kao DEFLATE", () => {
  const entries = unzipEntries(zip({ "a.txt": "zdravo" }, { deflate: false }));
  assert.equal(entries.get("a.txt").toString("utf8"), "zdravo");
});

test("odbija fajl koji nije XLSX", () => {
  assert.throws(() => readXlsx(Buffer.from("nije zip")), XlsxReadError);
  assert.throws(() => readXlsx(zip({ "a.txt": "x" })), /xl\/workbook\.xml/);
});

test("pomoćne funkcije", () => {
  assert.equal(columnIndex("A1"), 0);
  assert.equal(columnIndex("Z9"), 25);
  assert.equal(columnIndex("AB12"), 27);
  assert.equal(decodeXmlText("&lt;a&gt; &#x10D; &#269; &quot;"), '<a> č č "');
});
