import assert from "node:assert/strict";
import test from "node:test";
import { belgradeDate, evaluateCustomerRhythm, groupCustomerSignals } from "./customerRhythm.mjs";

const AS_OF = "2026-09-28";

test("bez dokumenata nema ritma i nema zaključka", () => {
  const r = evaluateCustomerRhythm({ customerId: "c", purchaseDates: [] }, AS_OF);
  assert.equal(r.status, "insufficient_history");
  assert.equal(r.lastPurchaseOn, null);
  assert.match(r.explanation, /Nema nijednog potvrđenog/);
  assert.equal("articleCode" in r, false);
});

test("jedan dan kupovine: prikazan datum, bez ritma", () => {
  const r = evaluateCustomerRhythm({ customerId: "c", purchaseDates: ["2026-03-02"] }, AS_OF);
  assert.equal(r.status, "insufficient_history");
  assert.match(r.explanation, /2026-03-02/);
});

test("prag zavisi od ritma kupca: mesečni kupac kasni, kvartalni ne", () => {
  const monthly = ["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"];
  const quarterly = ["2025-11-01", "2026-02-01", "2026-05-01", "2026-08-01"];
  const m = evaluateCustomerRhythm({ customerId: "m", purchaseDates: monthly }, AS_OF);
  const q = evaluateCustomerRhythm({ customerId: "q", purchaseDates: quarterly }, AS_OF);
  // Isti broj dana od poslednje kupovine (58), različit zaključak.
  assert.equal(m.daysSinceLastPurchase, 58);
  assert.equal(q.daysSinceLastPurchase, 58);
  assert.equal(m.status, "overdue");
  assert.equal(q.status, "not_yet");
  assert.match(m.explanation, /2026-04-01/);
  assert.match(m.explanation, /2026-08-01/);
});

test("uspavan tek posle 3 razmaka I 180 dana; tekst ne tvrdi da je prestao", () => {
  const r = evaluateCustomerRhythm(
    { customerId: "d", purchaseDates: ["2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01"] },
    AS_OF,
  );
  assert.equal(r.status, "dormant");
  assert.match(r.explanation, /ne dokaz da je prestao/);
});

test("grupe: samo ono što je cadence_v1 već rekao, 1–2 kupovine se samo broje", () => {
  const rows = [
    { articleCode: "A", status: "due", eventCount: 8, daysSinceLastPurchase: 30 },
    { articleCode: "B", status: "not_yet", eventCount: 3, daysSinceLastPurchase: 5 },
    { articleCode: "C", status: "overdue", eventCount: 5, daysSinceLastPurchase: 90 },
    { articleCode: "D", status: "dormant", eventCount: 6, daysSinceLastPurchase: 400 },
    { articleCode: "E", status: "provisional", eventCount: 2, daysSinceLastPurchase: 10 },
    { articleCode: "F", status: "insufficient_history", eventCount: 1, daysSinceLastPurchase: 3 },
  ];
  const g = groupCustomerSignals(rows);
  assert.deepEqual(g.regular.map((r) => r.articleCode), ["A", "C", "B"]);
  assert.deepEqual(g.overdue.map((r) => r.articleCode), ["C"]);
  assert.deepEqual(g.lapsed.map((r) => r.articleCode), ["D"]);
  assert.equal(g.thinHistoryCount, 2);
});

test("beogradski datum oko ponoći UTC", () => {
  assert.equal(belgradeDate(new Date("2026-09-27T22:30:00Z")), "2026-09-28");
  assert.equal(belgradeDate(new Date("2026-01-15T22:59:00Z")), "2026-01-15");
});
