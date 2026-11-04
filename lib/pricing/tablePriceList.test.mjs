import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { buildTableRows, cellAmountCents, parseCsv, readXlsx } from "./tablePriceList.mjs";

/** Minimalna ZIP arhiva (CRC se ne proverava pri čitanju). */
function zip(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text, deflate] of files) {
    const nameB = enc.encode(name);
    const raw = enc.encode(text);
    const data = deflate ? deflateRawSync(raw) : raw;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(deflate ? 8 : 0, 8);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameB.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(deflate ? 8 : 0, 10);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameB.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameB, data);
    centrals.push(ch, nameB);
    offset += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}

test("CSV: razdelnik „;“, navodnici, srpski iznosi", () => {
  const rows = parseCsv('﻿Sifra;Naziv;VP pak.\n300112;"Bazna ""crna"" 1L";4.473,00\r\n\n310201;Lak 5L;11.450,00\n');
  assert.deepEqual(rows, [["Sifra", "Naziv", "VP pak."], ["300112", 'Bazna "crna" 1L', "4.473,00"], ["310201", "Lak 5L", "11.450,00"]]);
  assert.equal(cellAmountCents("4.473,00"), 447300);
  assert.equal(cellAmountCents("4473.5"), 447350);
  assert.equal(cellAmountCents("4473.505"), 447351);
  assert.ok(Number.isNaN(cellAmountCents("10.158,0O")));
});

test("XLSX: prvi list, deljeni tekst, brojevi i prazne ćelije", async () => {
  const bytes = zip([
    ["xl/workbook.xml", '<workbook><sheets><sheet name="Cene" sheetId="1" r:id="rId1"/></sheets></workbook>', false],
    ["xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>', false],
    ["xl/sharedStrings.xml", "<sst><si><t>Sifra</t></si><si><t>VP</t></si><si><t>310205</t></si><si><r><t>Lak </t></r><r><t>&amp; 1L</t></r></si></sst>", true],
    ["xl/worksheets/sheet1.xml", '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>2466</v></c></row></sheetData></worksheet>', true],
  ]);
  const rows = await readXlsx(bytes, (d) => inflateRawSync(d));
  assert.deepEqual(rows, [["Sifra", "", "VP"], ["310205", "Lak & 1L", "2466"]]);
});

test("po JM / po pakovanju: preračun samo uz potvrđenu količinu; neispravni redovi odvojeno", () => {
  const table = [
    ["Sifra", "Naziv", "VP"],
    ["310201", "Lak 5L", "11.450,00"],
    ["300112", "Crna 1L", "4.473,00"],
    ["350601", "Punilac", "10.158,0O"],
    ["370812", "Folija", ""],
    ["300210", "Nova plava", "3.480,00"],
    ["320310", "Ucvrscivac", "7.445,00"],
  ];
  const known = { packQtyByCode: new Map([["310201", 5], ["300112", 1]]), vatByCode: new Map([["310201", 20], ["300112", 20], ["350601", 20], ["370812", 20], ["320310", 20]]) };
  const map = { header: true, code: 0, price: 2, name: 1 };
  const pak = buildTableRows(table, map, "pak", known);
  assert.deepEqual(pak.rows.map((r) => [r.code, r.vpPriceCents, r.rawCents]), [["310201", 229000, 1145000], ["300112", 447300, 447300], ["300210", 348000, 348000]]);
  assert.deepEqual(pak.problems.map((p) => [p.line, p.code, p.reason.slice(0, 14)]), [[4, "350601", "cena nije broj"], [5, "370812", "nema cene"], [7, "320310", "cena je po pak"]]);
  const jm = buildTableRows(table, map, "jm", known);
  assert.equal(jm.rows.find((r) => r.code === "310201").vpPriceCents, 1145000, "po JM bez preračuna");
  assert.throws(() => buildTableRows(table, map, null, known), /po JM ili po pakovanju/);
  assert.throws(() => buildTableRows(table, { header: true, code: 0, price: 0 }, "jm", known), /različite kolone/);
});
