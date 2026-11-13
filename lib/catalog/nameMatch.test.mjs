import assert from "node:assert/strict";
import test from "node:test";
import { measureLabel, brandOfName, buildIndex, codeInName, codesIn, compact, confidenceOf, measures, rankTargets } from "./nameMatch.mjs";

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

test("Cosmos „N307“ = „R307“; Baslac 60-20 1 L nalazi karticu 60-20 (šifra kartice BASLAC-60-20-5L)", async () => {
  const nm = await import("./nameMatch.mjs");
  const idx = nm.buildIndex([
    { key: "cosmos-lac-fast-acrylic-r307-sjaj-400-ml-fast-acrylic-r307-bright-silver", slug: "r307", variant: null, brand: "cosmos-lac", text: "Cosmos Lac Fast Acrylic R307 Bright Silver sjaj", codes: [], label: "R307" },
    { key: "cosmos-lac-flame-orange-fo-307-400-ml-flame-orange-fo-307-coral", slug: "fo307", variant: null, brand: "cosmos-lac", text: "Cosmos Lac Flame Orange FO-307 Coral", codes: [], label: "FO-307" },
    { key: "baslac-60-20-razredjivac", slug: "baslac-60-20-razredjivac", variant: null, brand: "baslac", text: "Baslac 60-20 razređivač  BASLAC-60-20-5L", codes: ["BASLAC-60-20-5L"], label: "60-20" },
    { key: "baslac-50-20-hardener-normal", slug: "baslac-50-20-hardener-normal", variant: null, brand: "baslac", text: "baslac 50-20 Hardener Normal 50-20", codes: ["50-20"], label: "50-20" },
  ]);
  assert.equal(nm.rankTargets({ code: "003074", name: "COS.SPREJ SREBRNA SVETLO N307" }, idx).ranked[0].slug, "r307");
  assert.equal(nm.rankTargets({ code: "528693", name: "BASLAC AKRILNI RAZREDJIVAC NORMAL 60-201L" }, idx).ranked[0].slug, "baslac-60-20-razredjivac");
});

test("šifra sa crticom zalepljena za reč ispred (BRZI50-4152,5L)", async () => {
  const nm = await import("./nameMatch.mjs");
  assert.equal(nm.dashedCodeInName("50415", "BASLAC HERTER CLEAR VOC BRZI50-4152,5L"), true);
  assert.equal(nm.dashedCodeInName("6010", "BASLAC RAZREDJIVAC BRZI60-20 5L"), false);
});

test("Cosmos broj zalepljen za reč (SIVAN305)", async () => {
  const nm = await import("./nameMatch.mjs");
  const idx = nm.buildIndex([
    { key: "cosmos-lac-ral-cl-305-ral-7011-sjaj", slug: "cl305", variant: null, brand: "cosmos-lac", text: "Cosmos Lac RAL CL 305 RAL 7011 Iron Grey sjaj", codes: [], label: "CL 305" },
    { key: "cosmos-lac-easy-max-cl-805-ral-7011", slug: "em805", variant: null, brand: "cosmos-lac", text: "Cosmos Lac Easy Max CL 805 RAL 7011 Iron Grey", codes: [], label: "EM 805" },
  ]);
  const r = nm.rankTargets({ code: "003054", name: "COS.SPREJ RAL7011 GVOŽĐE SIVAN305" }, idx);
  assert.equal(r.ranked[0].slug, "cl305");
});

test("kataloški sufiks slovima: 055403 = 55403ADV, ne 03403 iste boje i mere", () => {
  const index = buildIndex([
    { key: "befar-leo-plus-advance-velcro-compounding-pad#55403ADV", slug: "befar-leo-plus-advance-velcro-compounding-pad", variant: "55403ADV", brand: "befar", label: "Leo Plus Advance Velcro — Crna · 150 × 50 mm", codes: ["55403ADV"], text: "Leo Plus Advance Velcro Compounding Pad crna black 150 x 50 mm čičak" },
    { key: "befar-velcro-compounding-foam-150x50#03403", slug: "befar-velcro-compounding-foam-150x50", variant: "03403", brand: "befar", label: "Befar čičak sunđer — Crna · 150 × 45 mm", codes: ["03403"], text: "Befar čičak sunđer za poliranje crna black 150 x 50 mm velcro" },
  ]);
  const { ranked } = rankTargets({ code: "055403", name: "BEFAR PLUS CICAK SUNDJER ZA POLIRANJE CRNI 150 X 50 MM" }, index);
  assert.equal(ranked[0].variant, "55403ADV");
  assert.equal(ranked[0].exact, true);
});

test("Easy Max bez imena brenda i bez N: broj boje je poslednja reč", () => {
  assert.equal(brandOfName("SPRAY EASY MAX 400ML RAL 1007 DAFFODIL YELLOW 823"), "cosmos-lac");
  assert.equal(brandOfName("BASLACUNIVERZALHS LAK 40-450 5L"), "baslac");
  const index = buildIndex([
    { key: "fast-acrylic-1007", slug: "fast-acrylic-1007", variant: null, brand: "cosmos-lac", label: "Fast Acrylic RAL 1007", codes: [], text: "Cosmos Lac Fast Acrylic RAL 1007 Daffodil Yellow 400 ml sjaj" },
    { key: "easy-max-cl-823-ral-1007", slug: "easy-max-cl-823-ral-1007", variant: null, brand: "cosmos-lac", label: "Easy Max CL 823", codes: [], text: "Cosmos Lac Easy Max CL 823 RAL 1007 Daffodil Yellow 400 ml" },
  ]);
  const { ranked } = rankTargets({ code: "008234", name: "SPRAY EASY MAX 400ML RAL 1007 DAFFODIL YELLOW 823" }, index);
  assert.equal(ranked[0].slug, "easy-max-cl-823-ral-1007");
});

test("tačna šifra bez sufiksa ima prednost nad šifrom sa sufiksom (54401 ≠ 54401ORB)", () => {
  const index = buildIndex([
    { key: "plus#54401", slug: "befar-plus-velcro-polishing-pad", variant: "54401", brand: "befar", label: "Plus — Bela · 150 × 25 mm", codes: ["54401"], text: "Befar Plus Velcro Polishing Pad bela white 150 x 25 mm" },
    { key: "orb#54401ORB", slug: "befar-leo-plus-air-lines-orbital-velcro-compounding-pad", variant: "54401ORB", brand: "befar", label: "Air Lines Orbital — Bela", codes: ["54401ORB"], text: "Leo Plus Air Lines Orbital Velcro Compounding Pad bela white 150 mm" },
  ]);
  const { ranked } = rankTargets({ code: "054401", name: "BEFAR PLUS CICAK SUNDJER ZA POLIRANJE BELI 150 X 25 MM" }, index);
  assert.equal(ranked[0].variant, "54401");
  assert.equal(ranked.find((r) => r.variant === "54401ORB")?.exact ?? false, false);
});

test("šifra sa crticom zalepljena za litražu: 60-201L = 1 L, 50-4152,5L = 2,5 L (vlasnik 2026-11-13)", () => {
  assert.equal(measureLabel("BASLAC AKRILNI RAZREDJIVAC NORMAL 60-201L"), "1 L");
  assert.equal(measureLabel("BASLAC HERTER CLEAR VOC BRZI50-4152,5L"), "2,5 L");
  assert.equal(measureLabel("BASLAC 30-S340 1L TOPCOAT"), "1 L");
  assert.equal(measureLabel("BASLAC 50-15 0,5L"), "500 ml");
});
