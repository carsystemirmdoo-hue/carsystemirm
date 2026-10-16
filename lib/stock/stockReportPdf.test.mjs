import assert from "node:assert/strict";
import test from "node:test";

import { stockContentFingerprint } from "./contentFingerprint.mjs";
import { parseStockPdf } from "./stockReportPdf.mjs";

/*
 * Sintetički „ZBIRNI PREGLED PO ARTIKLIMA“ sa koordinatama kao u stvarnom BizniSoft PDF-u
 * (15. 10. 2026): šifra x 21,7; naziv 61,4; brojevi desno poravnati; red brojeva pomeren ~1.
 * Stvaran izvoz ostaje privatno (dok. 65 §1b).
 */
const COL = { sifra: 21.7, naziv: 61.4, ulaz: 268.5, izlaz: 319.9, stanje: 366.5, duguje: 422.6, potrazuje: 471.1, saldo: 549.3 };
const RIGHT = [290, 342, 396, 456, 515, 575];
const fmt = (v) => {
  const [i, d] = Math.abs(v).toFixed(2).split(".");
  return `${v < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${d}`;
};
const t = (str, x, y, w = 0) => ({ str, x, y, w });
const nums = (y, vals) => vals.map((v, k) => { const s = fmt(v); const w = s.length * 4.4; return t(s, RIGHT[k] - w, y, w); });

function page(n, of, rows, { first = false, last = false, objects = "021 VELEPRODAJA", period = "01.01.2026-15.10.2026", prev = [0, 0, 0, 0, 0, 0], totals = null } = {}) {
  const items = [t("Datum štampe: 15.10.2026", 477.4, 814), t("CAR SYSTEM SINT", 21.7, 813), t("ZBIRNI PREGLED PO ARTIKLIMA", 21.7, 786)];
  let y = 753;
  if (first) {
    items.push(t("Period:", 50.5, 764), t(period, 86.9, 764), t("Vrsta cene: Veleprodajna", 86.9, 753), t("Filteri:", 53.1, 741), t(`Poslovni objekti: ${objects}`, 86.9, 741));
    y = 717;
  }
  for (const [h, x] of Object.entries({ "Šifra": COL.sifra, "Naziv artikla": COL.naziv, Ulaz: COL.ulaz, Izlaz: COL.izlaz, Stanje: COL.stanje, Duguje: COL.duguje, "Potražuje": COL.potrazuje, Saldo: COL.saldo })) items.push(t(h, x, y));
  y -= 12;
  if (first) { items.push(t("Prethodno stanje:", 180, y), ...nums(y, prev)); y -= 13; }
  for (const [code, name, ulaz, izlaz, fin = 1000] of rows) {
    items.push(t(code, COL.sifra, y), t(name, COL.naziv, y), ...nums(y + 1, [ulaz, izlaz, ulaz - izlaz, fin, fin / 2, fin / 2]));
    y -= 12.6;
  }
  if (last && totals) {
    items.push(t("ZBIRNI PODACI", 21.7, 201), t("Ukupno ulaz (KOM):", 60.6, 185), t(fmt(totals[0]), 179.9, 185), t("Ukupno izlaz (KOM):", 59.7, 172), t(fmt(totals[1]), 179.9, 172), t("Stanje (KOM):", 81.8, 160), t(fmt(totals[2]), 184.9, 160));
  }
  items.push(t(`Strana ${n} od ${of}`, 273.2, 26));
  return items;
}

const ROWS1 = [["000007", "SINT UBRUS 800/1", 63, 33], ["004405", "SINT SUNDJER PLAVI", 26, 16], ["156363", "SINT ŠMIRGLA P180", 1754, 1750]];
const ROWS2 = [["600010", "SINT PASTA 4/1", 40, 0], ["910019", "SINT TRAKA 19MM", 15, 15], ["990050", "POLICA", 1.5, 0.25]];
const sum = (rows, k) => rows.reduce((a, r) => a + (k === 2 ? r[2] - r[3] : r[k + 2]), 0);
const ALL = [...ROWS1, ...ROWS2];
const TOT = [sum(ALL, 0), sum(ALL, 1), sum(ALL, 2)];
const doc = (opts = {}) => ({ numPages: 2, pages: [page(1, 2, ROWS1, { first: true, ...opts }), page(2, 2, ROWS2, { last: true, totals: opts.totals ?? TOT })] });

test("čita šifru kao tekst (vodeće nule ostaju), naziv i stanje; zbirovi i strane se slažu", () => {
  const r = parseStockPdf(doc());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.meta.stockDate, "2026-10-15");
  assert.deepEqual([r.meta.warehouseCode, r.meta.warehouseName], ["021", "VELEPRODAJA"]);
  assert.deepEqual(r.lines.map((l) => [l.sourceCode, l.codeKey, l.quantity]), [
    ["000007", "7", 30], ["004405", "4405", 10], ["156363", "156363", 4], ["600010", "600010", 40], ["910019", "910019", 0], ["990050", "990050", 1.25],
  ]);
  assert.equal(r.lines[1].name, "SINT SUNDJER PLAVI");
  assert.deepEqual([r.control.pagesComplete, r.control.totalsMatch], [true, true]);
  assert.equal(r.lines.every((l) => l.unit === null), true, "PDF nema JM");
  assert.ok(!JSON.stringify(r).includes("500,00"), "finansijske kolone se ne čuvaju");
});

test("odbija: bez teksta, drugi raspored, pogrešan ili više objekata, prethodno stanje ≠ 0, strana nedostaje, zbir", () => {
  const code = (d) => parseStockPdf(d).errors.map((e) => e.code);
  assert.deepEqual(code({ numPages: 1, pages: [[]] }), ["pdf_bez_teksta"]);
  assert.deepEqual(code({ numPages: 1, pages: [[t("STANJE ZALIHA ARTIKLA", 20, 700)]] }), ["pdf_raspored_bez_uzorka"]);
  assert.ok(code(doc({ objects: "021 VELEPRODAJA, 022 MALOPRODAJA" })).includes("vise_poslovnih_objekata"));
  assert.ok(code(doc({ objects: "022 MALOPRODAJA" })).includes("pogresan_poslovni_objekat"));
  assert.ok(code(doc({ prev: [5, 0, 5, 0, 0, 0] })).includes("prethodno_stanje_nije_nula"));
  assert.ok(code({ numPages: 2, pages: [page(1, 3, ROWS1, { first: true }), page(2, 3, ROWS2, { last: true, totals: TOT })] }).includes("nedostaju_strane"));
  assert.ok(code(doc({ totals: [TOT[0], TOT[1], TOT[2] + 1] })).includes("kontrolni_zbir_ne_odgovara"));
  const bad = parseStockPdf(doc({ totals: [TOT[0], TOT[1], TOT[2] + 1] }));
  assert.equal(bad.lines.length, 0, "neuspešan uvoz nema stavki");
});

test("broj van svoje kolone se ne prihvata (nema spajanja šifre i kolone)", () => {
  const d = doc();
  const n = d.pages[0].find((i) => i.str === "30,00");
  n.x += 40; // stanje pomereno u kolonu „Duguje“
  assert.ok(parseStockPdf(d).errors.some((e) => e.code === "pdf_kolona_nejasna"));
});

test("negativno stanje se čuva za administraciju; dupla šifra i sudar vodećih nula se odbijaju", () => {
  const neg = [["000007", "SINT UBRUS", 1, 3]];
  const r = parseStockPdf({ numPages: 1, pages: [page(1, 1, neg, { first: true, last: true, totals: [1, 3, -2] })] });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.lines[0].quantity, -2);
  assert.ok(r.warnings.some((w) => w.code === "negativne_kolicine"));
  const dup = [["000007", "A", 1, 0], ["007", "B", 1, 0]];
  assert.ok(parseStockPdf({ numPages: 1, pages: [page(1, 1, dup, { first: true, last: true, totals: [2, 0, 2] })] }).errors.some((e) => e.code === "sudar_sifara"));
});

test("otisak sadržaja: isti za PDF i XLSX istog stanja (nule se ne računaju), drugačiji kod razlike", () => {
  const meta = { warehouseCode: "021", stockDate: "2026-10-15" };
  const pdf = [{ codeKey: "7", sourceCode: "000007", quantity: 30 }, { codeKey: "4405", sourceCode: "004405", quantity: 10 }];
  const xlsx = [{ codeKey: "4405", sourceCode: "4405", quantity: 10 }, { codeKey: "7", sourceCode: "7", quantity: 30 }, { codeKey: "12", sourceCode: "12", quantity: 0 }];
  assert.equal(stockContentFingerprint(meta, pdf), stockContentFingerprint(meta, xlsx));
  assert.notEqual(stockContentFingerprint(meta, pdf), stockContentFingerprint(meta, [...xlsx.slice(0, 2), { codeKey: "12", sourceCode: "12", quantity: 1 }]));
  assert.notEqual(stockContentFingerprint(meta, pdf), stockContentFingerprint({ ...meta, stockDate: "2026-10-16" }, pdf));
  assert.equal(stockContentFingerprint({ warehouseCode: null, stockDate: "2026-10-15" }, pdf), null);
});

test("fajl: sintetički tekstualni PDF prolazi kroz čitač (unpdf) i ima isti otisak kao XLSX istog stanja", async () => {
  const { readFileSync } = await import("node:fs");
  const { readStockFile, readStockFileAsync } = await import("./readStockFile.mjs");
  const dir = new URL("../../fixtures/dev/biznisoft/lager/", import.meta.url);
  const pdf = await readStockFileAsync(readFileSync(new URL("zbirni-pregled-sinteticki.pdf", dir)));
  assert.equal(pdf.format, "pdf");
  assert.equal(pdf.report.ok, true, JSON.stringify(pdf.report.errors));
  assert.equal(pdf.report.lines.find((l) => l.codeKey === "12")?.sourceCode, "000012", "vodeće nule iz PDF-a ostaju u izvornoj šifri");
  const xlsx = readStockFile(readFileSync(new URL("stanje-zaliha-artikla-sinteticki.xlsx", dir))).report;
  assert.equal(stockContentFingerprint(pdf.report.meta, pdf.report.lines), stockContentFingerprint(xlsx.meta, xlsx.lines));
  // XLSX i dalje ide istim putem (asinhroni čitač ne menja postojeće formate).
  assert.equal((await readStockFileAsync(readFileSync(new URL("stanje-zaliha-sinteticki.xlsx", dir)))).format, "xlsx");
});

test("fajl: PDF bez teksta (npr. skeniran) se odbija sa jasnim uputstvom", async () => {
  const { readStockFileAsync } = await import("./readStockFile.mjs");
  const body = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>"];
  let out = "%PDF-1.4\n";
  const off = [];
  body.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 4\n0000000000 65535 f \n${off.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  const r = await readStockFileAsync(Buffer.from(out, "latin1"));
  assert.deepEqual([r.format, r.report.ok, r.report.errors.map((e) => e.code)], ["pdf", false, ["pdf_bez_teksta"]]);
});
