import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readXlsxCells } from "../import/xlsx/readXlsx.mjs";
import { readCsvGrid } from "./csvGrid.mjs";
import { readStockFile } from "./readStockFile.mjs";
import { classifyNumber, parseQuantity, parseReportDate } from "./reportValues.mjs";
import { buildArticleIndex, codeKey, linkLine, wholePacks } from "./stockLink.mjs";
import { parseStockReport } from "./stockReport.mjs";

// Sintetički izveštaj istog rasporeda kao BizniSoft izvoz štampe (scripts/fixtures/build-stock-report-fixture.py).
const XLSX = readFileSync(new URL("../../fixtures/dev/biznisoft/lager/stanje-zaliha-sinteticki.xlsx", import.meta.url));
const CSV = readFileSync(new URL("../../fixtures/dev/biznisoft/lager/stanje-zaliha-sinteticki.csv", import.meta.url));
const grid = () => readXlsxCells(XLSX)[0].rows.map((r) => [...r]);
const codes = (r) => r.lines.map((l) => l.sourceCode);
const has = (list, code) => list.some((e) => e.code === code);
/** Red u mreži po vrednosti šifre (kolona A). */
const rowOf = (g, code) => g.findIndex((r) => String(r?.[0]) === String(code));

test("XLSX: objekat, datum stanja i štampe iz sadržaja, sve stavke, kontrola potpunosti", () => {
  const r = readStockFile(XLSX);
  assert.equal(r.format, "xlsx");
  assert.equal(r.sheet, "Page1");
  assert.equal(r.report.ok, true, JSON.stringify(r.report.errors));
  assert.deepEqual(
    { ...r.report.meta, articleFilter: undefined },
    { title: "STANJE ZALIHA", stockDate: "2026-09-05", printedOn: "2026-09-05", warehouseCode: "021", warehouseName: "VELEPRODAJA", articleFilter: undefined, stockFilter: "Artikli na zalihama" },
  );
  assert.equal(r.report.stats.lines, 10);
  assert.equal(r.report.stats.repeatedHeaders, 2, "zaglavlje ponovljeno na stranama 2 i 3");
  assert.deepEqual(r.report.control, { totalRowFound: true, totalsChecked: true, totalsMatch: true, pagesDeclared: 3, pagesSeen: 3, pagesComplete: true, rowValueMismatches: 0 });
  assert.deepEqual(r.report.lines.find((l) => l.sourceCode === "900002"), { row: r.report.lines.find((l) => l.sourceCode === "900002").row, sourceCode: "900002", codeKey: "900002", name: "SINT LAK HS 5 L", quantity: 7.5, quantityStatus: "ok", negative: false });
  assert.match(r.sha256, /^[0-9a-f]{64}$/);
});

test("CSV (Windows-1250, ';', decimalni zarez) daje iste stavke kao XLSX", () => {
  const x = readStockFile(XLSX).report;
  const c = readStockFile(CSV);
  assert.equal(c.format, "csv");
  assert.equal(c.report.ok, true, JSON.stringify(c.report.errors));
  assert.deepEqual(c.report.lines.map((l) => [l.sourceCode, l.quantity, l.name]), x.lines.map((l) => [l.sourceCode, l.quantity, l.name]));
  assert.equal(readCsvGrid(CSV).encoding, "windows-1250");
  assert.ok(c.report.lines.some((l) => l.name === "SINT ČISTAČ ĐAK ŽUTI"));
});

test("cene, vrednosti i marže ne izlaze iz parsera", () => {
  const out = JSON.stringify(readStockFile(XLSX).report);
  for (const v of ["20000", "26000", "1300", "5200", "Nab", "RuC"]) assert.ok(!out.includes(v), v);
});

test("raspored se prepoznaje, ne pretpostavlja: dodati redovi iznad i pomerene kolone", () => {
  const g = grid();
  const shifted = [[null], [null], [null], ...g.map((r) => [null, ...r])];
  const r = parseStockReport(shifted);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(codes(r), codes(parseStockReport(g)));
});

test("prazna količina nije nula; negativna se čuva kao nalaz", () => {
  const g = grid();
  g[rowOf(g, 900004)][24] = null;
  g[rowOf(g, 900006)][24] = -3;
  const r = parseStockReport(g);
  const l4 = r.lines.find((l) => l.sourceCode === "900004");
  const l6 = r.lines.find((l) => l.sourceCode === "900006");
  assert.deepEqual([l4.quantity, l4.quantityStatus], [null, "prazno"]);
  assert.deepEqual([l6.quantity, l6.negative], [-3, true]);
  assert.ok(has(r.warnings, "prazne_kolicine"));
  assert.ok(has(r.warnings, "negativne_kolicine"));
});

test("dupla šifra i sudar šifara (vodeće nule) blokiraju uvoz", () => {
  const g = grid();
  g[rowOf(g, 900005)][0] = 900001;
  assert.ok(has(parseStockReport(g).errors, "dupla_sifra"));
  const g2 = grid();
  g2[rowOf(g2, 900005)][0] = "0012";
  const r2 = parseStockReport(g2);
  assert.ok(has(r2.errors, "sudar_sifara"), JSON.stringify(r2.errors));
  assert.equal(r2.ok, false);
});

test("šifra kao tekst čuva vodeće nule", () => {
  const g = grid();
  g[rowOf(g, 900005)][0] = "000777";
  const l = parseStockReport(g).lines.find((x) => x.sourceCode === "000777");
  assert.deepEqual([l.sourceCode, l.codeKey], ["000777", "777"]);
});

test("pogrešan ili više poslovnih objekata, nedostaje datum, nije lager", () => {
  const g = grid();
  g[13][0] = "022 MALOPRODAJA";
  assert.ok(has(parseStockReport(g).errors, "pogresan_poslovni_objekat"));
  const g2 = grid();
  g2[13][0] = "021 VELEPRODAJA, 022 MALOPRODAJA";
  assert.ok(has(parseStockReport(g2).errors, "vise_poslovnih_objekata"));
  const g3 = grid();
  g3[6][7] = "nije datum";
  assert.ok(has(parseStockReport(g3).errors, "nema_datuma_stanja"));
  const g4 = grid();
  g4[1][12] = "KARTICA ARTIKLA";
  assert.ok(has(parseStockReport(g4).errors, "nije_stanje_zaliha"));
  assert.ok(has(readStockFile(Buffer.from("nešto sasvim drugo\n1;2;3\n")).report.errors, "nije_stanje_zaliha"));
});

test("nedostaje stavka ili strana → kontrola potpunosti blokira", () => {
  const g = grid();
  g.splice(rowOf(g, 900002), 1);
  assert.ok(has(parseStockReport(g).errors, "kontrolni_zbir_ne_odgovara"));
  const g2 = grid();
  const footer = g2.findIndex((r) => String(r?.[0] ?? "").startsWith("Strana 2 od"));
  g2[footer] = [];
  assert.ok(has(parseStockReport(g2).errors, "nedostaju_strane"));
});

test("decimalni zarez i tačka; dvosmislena vrednost se ne pogađa", () => {
  assert.deepEqual(classifyNumber("2,5"), { kind: "decimal", sep: ",", value: 2.5 });
  assert.deepEqual(classifyNumber("1.234,5"), { kind: "grouped", decimalSep: ",", value: 1234.5 });
  assert.deepEqual(classifyNumber("1,234.5"), { kind: "grouped", decimalSep: ".", value: 1234.5 });
  assert.deepEqual(classifyNumber("1.234"), { kind: "ambiguous", sep: "." });
  assert.deepEqual(classifyNumber("0,500"), { kind: "decimal", sep: ",", value: 0.5 });
  assert.deepEqual(parseQuantity("1.234", null), { ok: false, reason: "dvosmislen_broj" });
  assert.deepEqual(parseQuantity("1.234", ","), { ok: true, value: 1234 });
  assert.deepEqual(parseQuantity("1.234", "."), { ok: true, value: 1.234 });
  assert.deepEqual(parseQuantity("", ","), { ok: false, reason: "prazno" });
  assert.deepEqual(parseQuantity("dva", ","), { ok: false, reason: "neispravan_broj" });

  const g = grid();
  for (const r of g) if (typeof r?.[24] === "number" && r[0] !== undefined) r[24] = String(r[24]).replace(".", ",");
  g[rowOf(g, 900005)][24] = "1.234";
  const resolved = parseStockReport(g);
  assert.equal(resolved.lines.find((l) => l.sourceCode === "900005").quantity, 1234, "fajl koristi zarez → tačka je hiljade");

  const g2 = grid();
  for (const r of g2) if (typeof r?.[24] === "number") r[24] = String(r[24]);
  g2[rowOf(g2, 900005)][24] = "1.234";
  assert.equal(parseStockReport(g2).lines.find((l) => l.sourceCode === "900005").quantity, 1.234, "fajl koristi tačku → decimalni broj");

  const g4 = grid();
  for (const r of g4) if (typeof r?.[24] === "number") r[24] = String(Math.round(r[24]));
  g4[rowOf(g4, 900005)][24] = "1.234";
  assert.ok(has(parseStockReport(g4).errors, "dvosmislen_broj"), "bez nedvosmislenih decimala separator fajla nije poznat");

  const g3 = grid();
  g3[rowOf(g3, 900002)][24] = "7,5";
  g3[rowOf(g3, 900003)][24] = "2.5";
  assert.ok(has(parseStockReport(g3).errors, "mesoviti_decimalni_separator"));
});

test("datumi: dd.mm.gggg, sa tačkom na kraju, Excel serijski broj; nemoguć datum odbijen", () => {
  assert.equal(parseReportDate("24.08.2026"), "2026-08-24");
  assert.equal(parseReportDate("24.08.2026."), "2026-08-24");
  assert.equal(parseReportDate(46258), "2026-08-24");
  assert.equal(parseReportDate("31.02.2026"), null);
});

test("veza: ključ bez vodećih nula, sudar artikala portala, JM i pakovanje samo potvrđeni", () => {
  assert.equal(codeKey("000012"), "12");
  const index = buildArticleIndex([
    { id: "a1", code: "900001" },
    { id: "a2", code: "000012" },
    { id: "a3", code: "0777" },
    { id: "a4", code: "777" },
  ]);
  const packs = new Map([["a1", { unit: "LIT", packQuantity: 5, label: "5 L", fractionalOk: false }]]);
  const l1 = linkLine({ sourceCode: "900001", codeKey: "900001" }, index, packs);
  assert.deepEqual([l1.link, l1.unit, l1.packStatus, l1.exactCode], ["povezan", "LIT", "potvrdjeno", true]);
  const l2 = linkLine({ sourceCode: "12", codeKey: "12" }, index, packs);
  assert.deepEqual([l2.link, l2.articleCode, l2.exactCode, l2.unit, l2.packStatus], ["povezan", "000012", false, null, "nema_potvrde"]);
  assert.equal(linkLine({ sourceCode: "777", codeKey: "777" }, index, packs).link, "sudar");
  assert.equal(linkLine({ sourceCode: "5", codeKey: "5" }, index, packs).link, "nepovezan");

  assert.deepEqual(wholePacks({ quantity: 12, link: l1 }), { status: "ok", packs: 2 });
  assert.deepEqual(wholePacks({ quantity: 4.999, link: l1 }), { status: "ok", packs: 0 });
  assert.deepEqual(wholePacks({ quantity: 12, link: l2 }), { status: "nema_broja", reason: "pakovanje_nepotvrdjeno" });
  assert.deepEqual(wholePacks({ quantity: null, link: l1 }), { status: "nema_broja", reason: "prazna_kolicina" });
  assert.deepEqual(wholePacks({ quantity: -1, link: l1 }), { status: "nema_broja", reason: "negativna_kolicina" });
});
