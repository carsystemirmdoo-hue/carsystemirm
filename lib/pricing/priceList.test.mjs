import assert from "node:assert/strict";
import test from "node:test";
import { classifyPriceRows, nameSimilarity, rowsToApply, sameArticleWording, summarizeClassification } from "./priceListMatch.mjs";
import { centsToDecimal, parseAmountCents, parseStockPriceReport, StockReportFormatError } from "./stockPriceReport.mjs";

/*
 * Veštački izveštaj u istom rasporedu kao BizniSoft „STANJE ZALIHA - NABAVNA I
 * VP CENA“: iste kolone i desne ivice, izmišljene šifre i cene. Stvarni PDF i
 * stvarne cene ne ulaze u repozitorijum.
 */
const RIGHT = { vat: 387, qty: 458, costPrice: 529, costValue: 608, vpPrice: 679, vpValue: 758.5, margin: 821 };
const cell = (str, right, y) => ({ str, x: right - str.length * 4.5, y, w: str.length * 4.5 });
const at = (str, x, y) => ({ str, x, y, w: str.length * 4.5 });
const fmt = (c) => {
  const neg = c < 0;
  const [i, d] = (Math.abs(c) / 100).toFixed(2).split(".");
  return `${neg ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${d}`;
};

function page({ pageNo, pages, rows, first = false, total = null, header = null, title = "STANJE ZALIHA - NABAVNA I VP CENA" }) {
  const items = [at("Datum štampe: 09.10.2026", 724, 567), at("CAR SYSTEM I RM", 22, 566), at("IVE ANDRIĆA 3", 22, 556), at(title, 22, 540)];
  let y = 506;
  if (first) {
    items.push(at("Na dan:", 47, 517), at("09.10.2026", 87, 517), at("Filteri:", 53, 495), at("Poslovni objekti: 021 VELEPRODAJA", 87, 495));
    y = 471;
  }
  const h = header ?? ["Šifra", "Naziv robe", "Stopa", "Količina", "Nab. cena", "Nab. vrednost", "VP cena", "VP vrednost", "% RuC"];
  h.forEach((t, i) => items.push(at(t, 22 + i * 90, y)));
  for (const r of rows) {
    y -= 13;
    items.push(at(r.code, 22, y));
    r.name.split("|").forEach((part, i) => items.push(at(part, 61 + i * 120, y)));
    const qty = r.qty ?? 0;
    items.push(
      cell(`${r.vat ?? 20} %`, RIGHT.vat, y),
      cell(fmt(qty * 100), RIGHT.qty, y),
      cell(fmt(r.cost ?? 100), RIGHT.costPrice, y),
      cell(fmt(Math.round(qty * (r.cost ?? 100))), RIGHT.costValue, y),
      cell(fmt(r.vp), RIGHT.vpPrice, y),
      cell(fmt(r.vpValue ?? qty * r.vp), RIGHT.vpValue, y),
      cell("25,00", RIGHT.margin, y),
    );
  }
  if (total) items.push(at("Ukupno stanje zaliha na dan:", 397, y - 16), cell(fmt(total.cost), RIGHT.costValue, y - 16), cell(fmt(total.vp), RIGHT.vpValue, y - 16));
  items.push(at(`Strana ${pageNo} od ${pages}`, 398, 26), at("BizniSoft Poslovni Programi - www.biznisoft.com", 672, 26));
  return { items };
}

const R1 = [
  { code: "900001", name: "PROBNI PRAJMER 1L", vp: 520000, qty: 2 },
  { code: "000902", name: "PROBNA TRAKA 48MM|X 50M", vp: 43300, qty: 0 },
];
const R2 = [{ code: "900003", name: "PROBNI DISK P120", vp: 4100, qty: 13 }];
const sumVp = [...R1, ...R2].reduce((s, r) => s + r.qty * r.vp, 0);
const good = () => [
  page({ pageNo: 1, pages: 2, rows: R1, first: true }),
  page({ pageNo: 2, pages: 2, rows: R2, total: { cost: 1500, vp: sumVp } }),
];

test("iznosi: srpski format u stotim delovima, bez gubitka tačnosti", () => {
  assert.equal(parseAmountCents("33.570.345,26"), 3357034526);
  assert.equal(parseAmountCents("-0,01"), -1);
  assert.equal(parseAmountCents("4.160,00"), 416000);
  for (const bad of ["4160,0", "4,160.00", "abc", "", "1.23,00"]) assert.equal(parseAmountCents(bad), null, bad);
  assert.equal(centsToDecimal(520000), "5200.00");
  assert.equal(centsToDecimal(5), "0.05");
});

test("izveštaj: šifra kao tekst (vodeće nule), spojen naziv, PDV, VP cena; nabavna cena i stanje NE izlaze", () => {
  const r = parseStockPriceReport(good());
  assert.deepEqual(r.meta, { title: "STANJE ZALIHA - NABAVNA I VP CENA", company: "CAR SYSTEM I RM", reportDate: "2026-10-09", printDate: "2026-10-09", businessUnit: "021 VELEPRODAJA", pages: 2, parser: "biznisoft-stanje-zaliha-vp/1" });
  assert.deepEqual(r.rows, [
    { code: "900001", name: "PROBNI PRAJMER 1L", vatPercent: 20, vpPriceCents: 520000, page: 1 },
    { code: "000902", name: "PROBNA TRAKA 48MM X 50M", vatPercent: 20, vpPriceCents: 43300, page: 1 },
    { code: "900003", name: "PROBNI DISK P120", vatPercent: 20, vpPriceCents: 4100, page: 2 },
  ]);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.checks, { rows: 3, totalVpMatches: true, rowChecksFailed: 0 });
  const tekst = JSON.stringify(r);
  for (const zabranjeno of ["cost", "qty", "margin", "Value"]) assert.ok(!tekst.includes(zabranjeno), zabranjeno);
});

test("izveštaj: drugačiji PDF daje jasnu grešku, nikad delimičan rezultat", () => {
  const greska = (pages, code) => assert.throws(() => parseStockPriceReport(pages), (e) => e instanceof StockReportFormatError && e.code === code);
  greska([], "prazan");
  greska([page({ pageNo: 1, pages: 1, rows: R1, first: true, title: "KARTICA ARTIKLA" })], "nije_izvestaj");
  greska([page({ pageNo: 1, pages: 1, rows: R1, first: true, header: ["Šifra", "Naziv robe", "Stopa", "Količina", "MP cena"] })], "kolone");
  // Nedostaje strana (podnožje kaže 3, fajl ima 2).
  greska([page({ pageNo: 1, pages: 3, rows: R1, first: true }), page({ pageNo: 2, pages: 3, rows: R2, total: { cost: 1, vp: sumVp } })], "strane");
  // Nema zbira na kraju.
  greska([page({ pageNo: 1, pages: 1, rows: R1, first: true })], "zbir");
});

test("izveštaj: pogrešno pročitan red ili zbir se prijavljuje kao problem", () => {
  const pages = good();
  pages[1] = page({ pageNo: 2, pages: 2, rows: [{ ...R2[0], vpValue: 1 }], total: { cost: 1500, vp: sumVp } });
  const r = parseStockPriceReport(pages);
  assert.ok(r.problems.some((p) => p.kind === "kontrola_reda" && p.code === "900003"));
  assert.ok(r.problems.some((p) => p.kind === "zbir"));
  assert.equal(r.checks.totalVpMatches, false);
});

test("izveštaj: duplikat šifre i nulta cena su problemi", () => {
  const pages = [
    page({ pageNo: 1, pages: 2, rows: [...R1, { code: "900001", name: "PROBNI PRAJMER 1L", vp: 530000, qty: 0 }], first: true }),
    page({ pageNo: 2, pages: 2, rows: [{ code: "900004", name: "BEZ CENE", vp: 0, qty: 0 }, ...R2], total: { cost: 0, vp: sumVp } }),
  ];
  const r = parseStockPriceReport(pages);
  assert.ok(r.problems.some((p) => p.kind === "duplikat_sifre" && p.code === "900001"));
  assert.ok(r.problems.some((p) => p.kind === "cena_nula" && p.code === "900004"));
});

test("sličnost naziva: razmaci i dijakritike ne smetaju; prevedeni naziv je ispod praga", () => {
  assert.equal(nameSimilarity("BMA ROLNA 115 P240", "BMA ROLNA 115P240"), 1);
  assert.ok(nameSimilarity("COS.SPREJ BIKE 400ML FLUO ORANGE", "COS.SPRAY BIKE 400 ML FLUO ORANGE") >= 0.8);
  assert.ok(nameSimilarity("CS MS KONEKTOR CREVA ZA VAZDUH 9MM", "CS ADAPTER MS COUPLING 9MM") < 0.8);
  assert.equal(nameSimilarity("MEĐUPODLOŠKA", "MEDJUPODLOSKA"), 1);
});

test("isti artikal, drugačiji zapis: iste cifre i sve reči kraćeg naziva; boja i prevod ne prolaze", () => {
  assert.equal(sameArticleWording("BASLAC 2K FILER 20-24 SIVI 1L", "BASLAC 2K FILER SIVI 20-241L"), true);
  assert.equal(sameArticleWording("BASLAC 2K LAK 40-40 1L", "BASLAC 2K UNIVERSAL LAK 40-401L"), true);
  assert.equal(sameArticleWording("COS.SPREJ RAL2010 SI. NARANDŽASTA N331", "COS.SPREJ SIG.NARAN RAL2010 N331"), true);
  assert.equal(sameArticleWording("BASLAC 2K FILER 20-34 BELI 4L", "BASLAC 2K FILER 20-34 SIVI 4L"), false, "druga boja");
  assert.equal(sameArticleWording("CS MS KONEKTOR CREVA ZA VAZDUH 9MM", "CS ADAPTER MS COUPLING 9MM"), false, "prevod");
  assert.equal(sameArticleWording("BEFAR MEDJUPODLOŠKA MEKA 150 MM 15 RUPA", "BEFAR MEĐUPODL UNIV.MEKA 150 MM"), false, "nedostaje „15 rupa“");
  assert.equal(sameArticleWording("PROBA 1L", "PROBA 5L"), false, "druga mera");
});

test("povezivanje: povezano / nejasno / nepovezano / duplikat; primena samo promena i potvrđenih nejasnih", () => {
  const articles = new Map([
    ["900001", { id: "a1", code: "900001", name: "PROBNI PRAJMER 1L", unit: "kom" }],
    ["000902", { id: "a2", code: "000902", name: "PROBNA TRAKA 48MMX50M", unit: "kom" }],
    ["900003", { id: "a3", code: "900003", name: "SASVIM DRUGI NAZIV", unit: "kom" }],
    ["900005", { id: "a5", code: "900005", name: "BEZ JM", unit: null }],
  ]);
  const rows = [
    { code: "900001", name: "PROBNI PRAJMER 1L", vatPercent: 20, vpPriceCents: 520000 },
    { code: "000902", name: "PROBNA TRAKA 48MM X 50M", vatPercent: 20, vpPriceCents: 43300 },
    { code: "900003", name: "PROBNI DISK P120", vatPercent: 20, vpPriceCents: 4100 },
    { code: "900005", name: "BEZ JM", vatPercent: 20, vpPriceCents: 100 },
    { code: "777777", name: "NOVI ARTIKAL", vatPercent: 20, vpPriceCents: 100 },
    { code: "888888", name: "DVA PUTA", vatPercent: 20, vpPriceCents: 100 },
    { code: "888888", name: "DVA PUTA", vatPercent: 20, vpPriceCents: 200 },
  ];
  const current = new Map([["a1", 400000], ["a2", 43300]]);
  const c = classifyPriceRows(rows, articles, current);
  assert.deepEqual(c.map((r) => [r.code, r.status, r.change]), [
    ["900001", "povezano", "promena"],
    ["000902", "povezano", "ista"],
    ["900003", "nejasno", "nova"],
    ["900005", "povezano", "nova"],
    ["777777", "nepovezano", null],
    ["888888", "duplikat", null],
    ["888888", "duplikat", null],
  ]);
  assert.deepEqual(c[0].flags, ["velika_promena"]);
  const s = summarizeClassification(c);
  assert.deepEqual(c[3].flags, ["bez_jedinice_mere"], "bez jedinice mere je samo informacija");
  assert.equal(s.povezano, 3);
  assert.equal(s.nejasno, 1);
  assert.equal(s.velikaPromena, 1);
  // Bez potvrde: promena i nova cena (ista cena se ne upisuje ponovo); nejasna ne.
  assert.deepEqual(rowsToApply(c).map((r) => r.code), ["900001", "900005"]);
  // Potvrđena nejasna stavka ulazi; nepovezana i duplikat ni uz potvrdu.
  assert.deepEqual(rowsToApply(c, new Set(["900003", "777777", "888888"])).map((r) => r.code), ["900001", "900003", "900005"]);
});
