import assert from "node:assert/strict";
import test from "node:test";
import {
  averageInvoice,
  concentration,
  deltaPercent,
  summarize,
  summarizeBy,
  UNKNOWN_NEGATIVE_LABEL,
} from "./totals.mjs";

const ROWS = [
  { documentKind: "faktura", quantity: 10, lineAmount: 100000, invoiceId: "f1", customer: "Duga" },
  { documentKind: "faktura", quantity: 5, lineAmount: 50000, invoiceId: "f2", customer: "Prolak" },
  { documentKind: "povrat_robe", quantity: -4, lineAmount: -39200, invoiceId: "r1", customer: "Duga" },
  { documentKind: "knjizno_odobrenje", quantity: 0, lineAmount: -62000, invoiceId: "r2", customer: "Duga" },
  { documentKind: "nepoznato", quantity: -2, lineAmount: -7600, invoiceId: "r3", customer: "Prolak" },
];

test("bruto broji samo pozitivne stavke", () => {
  assert.equal(summarize(ROWS).gross, 150000);
});

test("povrat robe i korekcije se vode odvojeno", () => {
  const s = summarize(ROWS);
  assert.equal(s.returnValue, -39200);
  assert.equal(s.returnedQuantity, -4);
  assert.equal(s.correctionValue, -62000);
});

test("knjižno odobrenje se ne broji kao fizički povrat robe", () => {
  const s = summarize([
    { documentKind: "knjizno_odobrenje", quantity: 0, lineAmount: -62000 },
  ]);
  assert.equal(s.returnValue, 0);
  assert.equal(s.returnedQuantity, 0);
  assert.equal(s.correctionValue, -62000);
});

test("negativan iznos nepoznate vrste se ne svrstava u povrat", () => {
  const s = summarize(ROWS);
  assert.equal(s.unknownNegativeValue, -7600);
  assert.equal(s.unknownNegativeCount, 1);
  // Ne sme da uveća povrate ni korekcije.
  assert.equal(s.returnValue, -39200);
  assert.equal(s.correctionValue, -62000);
});

test("neto je bruto umanjen za sve negativne stavke", () => {
  const s = summarize(ROWS);
  assert.equal(s.net, 150000 - 39200 - 62000 - 7600);
  assert.equal(s.net, 41200);
});

test("prazan skup daje nule, a ne grešku", () => {
  const s = summarize([]);
  assert.equal(s.gross, 0);
  assert.equal(s.net, 0);
  assert.equal(s.unknownNegativeCount, 0);
});

test("grupisanje po kupcu razdvaja promet", () => {
  const byCustomer = summarizeBy(ROWS, (row) => row.customer);
  const duga = byCustomer.find((row) => row.key === "Duga");
  const prolak = byCustomer.find((row) => row.key === "Prolak");

  assert.equal(duga.gross, 100000);
  assert.equal(duga.net, 100000 - 39200 - 62000);
  assert.equal(prolak.gross, 50000);
  assert.equal(prolak.net, 50000 - 7600);
  // Sortirano opadajuće po neto prometu.
  assert.ok(byCustomer[0].net >= byCustomer[1].net);
});

test("broj faktura se ne duplira po stavkama", () => {
  const rows = [
    { documentKind: "faktura", quantity: 1, lineAmount: 100, invoiceId: "f1", customer: "A" },
    { documentKind: "faktura", quantity: 1, lineAmount: 200, invoiceId: "f1", customer: "A" },
    { documentKind: "faktura", quantity: 1, lineAmount: 300, invoiceId: "f2", customer: "A" },
  ];
  assert.equal(summarizeBy(rows, (row) => row.customer)[0].invoiceCount, 2);
});

test("promena bez osnove nije 100% rasta nego nepoznata", () => {
  assert.equal(deltaPercent(1000, 0), null);
  assert.equal(deltaPercent(1000, 800), 25);
  assert.equal(deltaPercent(800, 1000), -20);
});

test("prosečna faktura bez faktura je nedostupna, ne nula", () => {
  assert.equal(averageInvoice(0, 0), null);
  assert.equal(averageInvoice(100000, 4), 25000);
});

test("koncentracija bez prometa je nedostupna", () => {
  assert.equal(concentration([]), null);
  assert.equal(concentration([{ net: 0 }]), null);
  const top = concentration(
    [{ net: 50 }, { net: 30 }, { net: 20 }],
    2,
  );
  assert.equal(top, 80);
});

test("oznaka za nerazvrstan negativan dokument je propisana rečenica", () => {
  assert.equal(
    UNKNOWN_NEGATIVE_LABEL,
    "Vrsta negativnog dokumenta nije poznata iz izvora",
  );
});
