import assert from "node:assert/strict";
import { test } from "node:test";
import { lineKey, paymentsByCustomer } from "./recentPayments.mjs";

const L = (customerId, invoiceNumber, remaining, extra = {}) => ({ customerId, sourceLabel: "Milan", invoiceNumber, issuedOn: "2026-10-01", amount: 1000, remaining, ...extra });

test("nestala faktura = plaćena cela, smanjen ostatak = delimično", () => {
  const r = paymentsByCustomer({
    before: [L("k1", "26-RN1", 1000), L("k1", "26-RN2", 500), L("k2", "26-RN3", 300)],
    after: [L("k1", "26-RN2", 200), L("k2", "26-RN3", 300)],
  });
  assert.equal(r.size, 1);
  const k1 = r.get("k1");
  assert.equal(k1.paidTotal, 1300);
  assert.deepEqual(k1.invoices.map((i) => [i.invoiceNumber, i.paid, i.full]).sort(), [["26-RN1", 1000, true], ["26-RN2", 300, false]]);
});

test("nova faktura i povećan ostatak nisu uplata", () => {
  const r = paymentsByCustomer({ before: [L("k1", "A", 100)], after: [L("k1", "A", 150), L("k1", "B", 999)] });
  assert.equal(r.size, 0);
});

test("cela tabela komercijaliste nedostaje u poslednjem snimku → ne broji se", () => {
  const r = paymentsByCustomer({
    before: [L("k1", "A", 100), L("k2", "B", 100, { sourceLabel: "Aleksandar" })],
    after: [L("k9", "Z", 5, { sourceLabel: "Aleksandar" })],
  });
  assert.equal(r.size, 1);
  assert.ok(r.has("k2"));
});

test("datum uplate = prvi snimak u kome je ostatak pao; faktura koja se vrati se ne broji duplo", () => {
  const r = paymentsByCustomer({
    before: [L("k1", "A", 100)],
    between: [
      { createdAt: "2026-11-20T08:00:00Z", lines: [L("k1", "A", 100)] },
      { createdAt: "2026-11-21T08:00:00Z", lines: [] },
      { createdAt: "2026-11-22T08:00:00Z", lines: [L("k1", "A", 100)] },
      { createdAt: "2026-11-23T08:00:00Z", lines: [] },
    ],
    after: [],
  });
  assert.equal(r.get("k1").paidTotal, 100);
  assert.equal(r.get("k1").invoices[0].seenOn, "2026-11-21T08:00:00Z");
});

test("ključ: broj fakture bez razmaka i velikim slovima; bez broja datum+iznos; bez oba null", () => {
  assert.equal(lineKey({ customerId: "k", invoiceNumber: " 26-rn 1 " }), "k|f:26-RN1");
  assert.equal(lineKey({ customerId: "k", invoiceNumber: null, issuedOn: "2026-01-02", amount: 5 }), "k|d:2026-01-02|5.00");
  assert.equal(lineKey({ customerId: "k", invoiceNumber: null, issuedOn: null, amount: null }), null);
});
