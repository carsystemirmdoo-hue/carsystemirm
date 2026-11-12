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
