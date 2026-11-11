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
