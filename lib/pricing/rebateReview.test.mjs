import assert from "node:assert/strict";
import test from "node:test";
import {
  NO_GROUP,
  proposedGroup,
  proposedTerms,
  reviewCustomer,
  summarizeCustomer,
} from "./rebateReview.mjs";

let n = 0;
const line = (over) => {
  n += 1;
  return {
    invoiceId: `i${n}`, documentLabel: `${n}/2026`, issuedOn: "2026-01-10", lineNumber: 1,
    articleCode: "A1", articleName: "CS BRUSNI PAPIR P400", discountPercent: 20, ...over,
  };
};
const day = (i) => `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`;

test("grupa iz naziva je predlog sa osnovom, nikad šifarnik", () => {
  assert.deepEqual(proposedGroup("CS BRUSNI PAPIR"), { label: "Carsystem", basis: "skracenica" });
  assert.deepEqual(proposedGroup("Baslac 45-W10"), { label: "baslac", basis: "literal" });
  assert.deepEqual(proposedGroup("čistač AUTOFIT"), { label: "A.U.T.O. Fit", basis: "literal" });
  assert.deepEqual(proposedGroup("DAYSON traka"), { label: "DAYSON", basis: "prva_rec" });
  assert.deepEqual(proposedGroup("KRPA"), { label: NO_GROUP, basis: "nema" });
});

test("stabilan uslov: poslednji i najčešći rabat sa brojem faktura", () => {
  const lines = Array.from({ length: 10 }, (_, i) => line({ invoiceId: `s${i}`, documentLabel: `${i + 1}/2026`, issuedOn: day(i) }));
  const r = reviewCustomer(lines);
  assert.equal(r.status, "stabilan");
  assert.equal(r.mode.percent, 20);
  assert.equal(r.mode.invoices, 10);
  assert.equal(r.last.percent, 20);
  assert.equal(r.last.issuedOn, day(9));
  assert.equal(r.exceptions.length, 0);
  assert.deepEqual(proposedTerms(r).map((t) => [t.group, t.percent, t.invoices]), [["Carsystem", 20, 10]]);
});

test("nedavna promena: datum i faktura od koje važi nov rabat", () => {
  const lines = Array.from({ length: 9 }, (_, i) =>
    line({ invoiceId: `c${i}`, documentLabel: `${i + 1}/2026`, issuedOn: day(i * 3), discountPercent: i < 5 ? 15 : 20 }),
  );
  const r = reviewCustomer(lines);
  assert.equal(r.status, "nedavna_promena");
  assert.equal(r.change.previousPercent, 15);
  assert.equal(r.change.currentPercent, 20);
  assert.equal(r.change.sinceLabel, "6/2026");
  assert.equal(r.change.currentInvoices, 4);
  assert.equal(r.change.group, "Carsystem");
});

test("faktura sa drugim brendom nije promena uslova", () => {
  const lines = [];
  for (let i = 0; i < 10; i += 1) lines.push(line({ invoiceId: `b${i}`, issuedOn: day(i), articleName: "CS PAPIR", discountPercent: 40 }));
  // Poslednje tri fakture: samo baslac, koji uvek ima 36 %.
  for (let i = 10; i < 13; i += 1) lines.push(line({ invoiceId: `b${i}`, issuedOn: day(i), articleCode: "B1", articleName: "Baslac 45-W10", discountPercent: 36 }));
  const r = reviewCustomer(lines);
  assert.equal(r.change, null);
  assert.notEqual(r.status, "nedavna_promena");
  assert.equal(r.last.percent, 36);
  assert.deepEqual(r.last.groups, ["baslac"]);
});

test("kratko odstupanje na kraju nije promena", () => {
  const lines = Array.from({ length: 8 }, (_, i) =>
    line({ invoiceId: `k${i}`, issuedOn: day(i), discountPercent: i >= 6 ? 25 : 20 }),
  );
  assert.equal(reviewCustomer(lines).change, null);
});

test("različit rabat po predloženoj grupi, sa izuzecima na nivou stavke", () => {
  const lines = [];
  for (let i = 0; i < 6; i += 1) {
    lines.push(line({ invoiceId: `g${i}`, issuedOn: day(i), articleName: "CS PAPIR", discountPercent: 20 }));
    lines.push(line({ invoiceId: `g${i}`, issuedOn: day(i), articleCode: "R1", articleName: "RM ONYX HD", discountPercent: 35 }));
  }
  const r = reviewCustomer(lines);
  assert.equal(r.status, "razlike_po_grupi");
  assert.deepEqual(r.groups.map((g) => [g.label, g.percent]).sort(), [["Carsystem", 20], ["R-M", 35]]);
  // Mešovita faktura: poslednji rabat nosi oznaku.
  assert.equal(r.last.mixed, true);
});

test("izuzeci: visok rabat ≥ 50 % traži proveru, 0 % u grupi sa rabatom je posebno označen", () => {
  const lines = Array.from({ length: 12 }, (_, i) => line({ invoiceId: `e${i}`, issuedOn: day(i) }));
  lines.push(line({ invoiceId: "e5", issuedOn: day(5), articleCode: "A9", discountPercent: 60 }));
  lines.push(line({ invoiceId: "e7", issuedOn: day(7), articleCode: "A8", discountPercent: 0 }));
  const r = reviewCustomer(lines);
  assert.deepEqual(r.exceptions.map((e) => [e.kind, e.articleCode, e.expected]).sort(), [
    ["bez_rabata", "A8", 20],
    ["visok_rabat", "A9", 20],
  ]);
  // Visok rabat ne postaje predlog uslova.
  assert.ok(proposedTerms(r).every((t) => t.percent < 50));
});

test("artikal sa upornim posebnim rabatom se izdvaja sa dokazima", () => {
  const lines = Array.from({ length: 10 }, (_, i) => line({ invoiceId: `a${i}`, issuedOn: day(i) }));
  for (const i of [2, 6, 8]) lines.push(line({ invoiceId: `a${i}`, issuedOn: day(i), articleCode: "SP1", discountPercent: 10 }));
  const r = reviewCustomer(lines);
  assert.equal(r.articleDifferences.length, 1);
  const d = r.articleDifferences[0];
  assert.deepEqual([d.articleCode, d.percent, d.expected, d.invoices], ["SP1", 10, 20, 3]);
  assert.equal(d.samples.length, 3);
});

test("premalo faktura i prazan unos ne daju zaključak", () => {
  assert.equal(reviewCustomer([line({}), line({})]).status, "premalo");
  assert.equal(reviewCustomer([]).status, "bez_faktura");
  assert.equal(summarizeCustomer([]).last, null);
});

test("lista i detalj koriste isti obračun", () => {
  const lines = Array.from({ length: 5 }, (_, i) => line({ invoiceId: `l${i}`, issuedOn: day(i), discountPercent: 22.5 }));
  const s = summarizeCustomer(lines);
  const r = reviewCustomer(lines);
  assert.equal(s.status, r.status);
  assert.equal(s.mode.percent, 22.5);
  assert.equal(s.last.percent, r.last.percent);
  assert.equal(s.invoiceCount, 5);
});
