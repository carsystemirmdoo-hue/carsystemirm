import assert from "node:assert/strict";
import test from "node:test";
import { brandOfName, buildIndex, codeInName, codesIn, compact, confidenceOf, measures, rankTargets } from "./nameMatch.mjs";

test("brend iz prve reči naziva", () => {
  assert.equal(brandOfName("CS P25C KRUŽNA ŠMIRGLA"), "carsystem");
  assert.equal(brandOfName("COS.SPREJ RAL9005"), "cosmos-lac");
  assert.equal(brandOfName("RM PASTA BC 800"), "r-m");
  assert.equal(brandOfName("POSUDA PVC 1.4L"), null);
});

test("granulacija i mera nisu šifra", () => {
  assert.ok(!codesIn("CS P25C ŠMIRGLA 150MM P240").has("P240"));
  assert.ok(measures("ŠMIRGLA P240").has("P240"));
  assert.ok(measures("SPREJ 400ML").has("L0.4"));
  assert.ok(measures("BAZA 2,5L").has("L2.5"));
});

test("šifra sa razmakom i granica cifre", () => {
  assert.ok(codeInName("BC1815", compact("RM PASTA BC 1815 0.5")));
  assert.ok(!codeInName("BC100", compact("RM PASTA BC 1000 1/1")));
  assert.ok(codeInName("CB58M", compact("RM CB 58M0,125L")));
});

test("rang: šifra varijante pobeđuje sličan naziv", () => {
  const index = buildIndex([
    { key: "p25#159.998", slug: "p25", variant: "159.998", brand: "carsystem", text: "Sanding disc P 25 ceramic P240 159.998", codes: ["159.998"], label: "P25 P240" },
    { key: "f19#156.052", slug: "f19", variant: "156.052", brand: "carsystem", text: "F19 brusni diskovi P240 156.052", codes: ["156.052"], label: "F19 P240" },
  ]);
  const { ranked } = rankTargets({ code: "159998", name: "CS P25C KRUŽNA ŠMIRGLA 150MM P240" }, index);
  assert.equal(ranked[0].slug, "p25");
  assert.equal(confidenceOf(ranked), "sigurno");
});

test("brojčana šifra sa crticom: zalepljena za reč ili za zapreminu (Baslac 21-10, 40-440)", async () => {
  const nm = await import("./nameMatch.mjs");
  assert.equal(nm.dashedCodeInName("2110", "BASLAC 21-10PLASTIC PRIMER 1L"), true);
  assert.equal(nm.dashedCodeInName("40440", "BASLAC 2K UNIVERSAL LAK 40-4401L"), true);
  assert.equal(nm.dashedCodeInName("40440", "BASLAC 2K UNIVERSAL LAK 40-440 5L"), true);
  assert.equal(nm.dashedCodeInName("2110", "BASLAC 21-105 NESTO"), false);
  assert.equal(nm.dashedCodeInName("2110", "BASLAC 121-10 NESTO"), false);
  const idx = nm.buildIndex([
    { key: "a", slug: "baslac-21-10-1k-plastic-primer", variant: null, brand: "baslac", text: "baslac 21-10 1K Plastic Primer 21-10", codes: ["21-10"], label: "21-10" },
    { key: "b", slug: "baslac-21-50-primer", variant: null, brand: "baslac", text: "baslac 21-50 1K Primer 21-50", codes: ["21-50"], label: "21-50" },
    { key: "c", slug: "baslac-40-440-2k-voc-clear", variant: null, brand: "baslac", text: "baslac 40-440 2K VOC Clear 40-440", codes: ["40-440"], label: "40-440" },
  ]);
  const r1 = nm.rankTargets({ code: "565407", name: "BASLAC 21-10PLASTIC PRIMER 1L" }, idx);
  assert.equal(r1.ranked[0].slug, "baslac-21-10-1k-plastic-primer");
  assert.equal(nm.confidenceOf(r1.ranked), "sigurno");
  const r2 = nm.rankTargets({ code: "504360", name: "BASLAC 2K UNIVERSAL LAK 40-4401L" }, idx);
  assert.equal(r2.ranked[0].slug, "baslac-40-440-2k-voc-clear");
});

test("Carsystem: naša šifra = kataloška šifra varijante (sa tačkom) → sigurno", async () => {
  const nm = await import("./nameMatch.mjs");
  const idx = nm.buildIndex([
    { key: "f#156.901", slug: "carsystem-finish-serija", variant: "156.901", brand: "carsystem", text: "Finish serija P1500 156.901", codes: ["156.901"], label: "Finish P1500" },
    { key: "f#156.902", slug: "carsystem-finish-serija", variant: "156.902", brand: "carsystem", text: "Finish serija P2000 156.902", codes: ["156.902"], label: "Finish P2000" },
  ]);
  const r = nm.rankTargets({ code: "156901", name: "CS F19 DISK FINIŠ P1500" }, idx);
  assert.equal(r.ranked[0].variant, "156.901");
  assert.equal(nm.confidenceOf(r.ranked), "sigurno");
});

test("2026-11-13: boja, RAL, sjaj/mat i šifra proizvoda ne smeju da se razlikuju za „sigurno“", async () => {
  const nm = await import("./nameMatch.mjs");
  const idx = nm.buildIndex([
    { key: "fo303", slug: "cosmos-lac-flame-orange-fo-303-400-ml-flame-orange-fo-303-red-pastel", variant: null, brand: "cosmos-lac", text: "Cosmos Lac Flame Orange FO-303 Red Pastel", codes: [], label: "Flame Orange FO-303 Red Pastel" },
    { key: "cl304s", slug: "cosmos-lac-ral-cl-304-ral-9005-sjaj", variant: null, brand: "cosmos-lac", text: "Cosmos Lac RAL CL 304 RAL 9005 Black sjaj", codes: [], label: "RAL CL 304 RAL 9005 Black — sjaj" },
    { key: "cl304m", slug: "cosmos-lac-ral-cl-304-ral-9005-mat", variant: null, brand: "cosmos-lac", text: "Cosmos Lac RAL CL 304 RAL 9005 Black mat", codes: [], label: "RAL CL 304 RAL 9005 Black — mat" },
    { key: "m14", slug: "befar-m14-adapter", variant: null, brand: "befar", text: "Befar M14 Adapter M14", codes: ["M14"], label: "Befar M14 Adapter" },
    { key: "6010", slug: "baslac-60-10-reducer-universal-fast", variant: null, brand: "baslac", text: "baslac 60-10 Reducer Universal Fast 60-10", codes: ["60-10"], label: "60-10" },
    { key: "6020", slug: "baslac-60-20-razredjivac", variant: null, brand: "baslac", text: "Baslac 60-20 akrilni razređivač 60-20", codes: ["60-20"], label: "60-20" },
  ]);
  // Classic crna sjaj N303 nije Flame FO-303.
  const black = nm.rankTargets({ code: "003034", name: "COS.SPREJ CRNA SJAJ RAL9005 N303" }, idx);
  assert.notEqual(black.ranked[0]?.slug, "cosmos-lac-flame-orange-fo-303-400-ml-flame-orange-fo-303-red-pastel");
  assert.equal(black.ranked[0]?.slug, "cosmos-lac-ral-cl-304-ral-9005-sjaj");
  // Mat pobeđuje sjaj kada naziv kaže MAT.
  const matt = nm.rankTargets({ code: "003044", name: "COS.SPREJ RAL9005 CRNA MAT N304" }, idx);
  assert.equal(matt.ranked[0].slug, "cosmos-lac-ral-cl-304-ral-9005-mat");
  // Sunđer sa bojom ne ide „sigurno“ na adapter bez boje.
  const sponge = nm.rankTargets({ code: "002403", name: "BEFAR SUNDJER 150X45 M14 CRNI" }, idx);
  assert.notEqual(nm.confidenceOf(sponge.ranked), "sigurno");
  assert.ok(sponge.ranked[0].doubts.includes("boja nije navedena na sajtu"));
  // 60-10 nije 60-20.
  const red = nm.rankTargets({ code: "501836", name: "BASLAC AKRILNI RAZREDJIVAC BRZI 60-10 5L" }, idx);
  assert.equal(red.ranked[0].slug, "baslac-60-10-reducer-universal-fast");
  assert.ok(!red.ranked.some((c) => c.slug === "baslac-60-20-razredjivac" && c.score > 0.5));
  // Zapremina zalepljena za šifru („50-200,5L“) nije druga šifra.
  assert.equal(nm.dashedCodeInName("5020", "BASLAC 2K HERTER NORMAL 50-200,5L"), true);
});

test("dva artikla sa istim nazivom i istim predlogom → nejasno; različite litraže ostaju", async () => {
  const nm = await import("./nameMatch.mjs");
  const c = [{ slug: "fo-396", variant: null }];
  const out = nm.markSharedTargets([
    { name: "COS.SPREJ FLAME FO-396 VIOLET 400 ML", confidence: "sigurno", candidates: c },
    { name: "COS.SPREJ FLAME FO-396 VIOLET 400ML", confidence: "sigurno", candidates: c },
    { name: "BASLAC 50-15 0,5L", confidence: "sigurno", candidates: [{ slug: "50-15", variant: null }] },
    { name: "BASLAC 50-15 2,5L", confidence: "sigurno", candidates: [{ slug: "50-15", variant: null }] },
  ]);
  assert.deepEqual(out.map((p) => p.confidence), ["nejasno", "nejasno", "sigurno", "sigurno"]);
  assert.equal(nm.measureLabel("BASLAC 2K HERTER BRZI 50-15 0,5L"), "500 ml");
  assert.equal(nm.measureLabel("BASLAC 40-440 2,5L"), "2,5 L");
  assert.equal(nm.measureLabel("BEFAR SUNDJER 150X50 M14 ORANZ"), "50 × 150");
  assert.equal(nm.measureLabel("RM CB 38L 0,125"), "");
});
