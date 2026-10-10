import assert from "node:assert/strict";
import test from "node:test";
import {
  formatQuantity,
  linkedProduct,
  orderReorderItems,
  reorderReason,
  resolveVariant,
  usualQuantity,
} from "./reorderRules.mjs";

const ev = (quantity, unit = "kom") => ({ quantity, units: [unit] });

test("količina: manje od tri kupovine nije pouzdana", () => {
  assert.equal(usualQuantity([ev(5), ev(6)]), null);
});

test("količina: raspon iz stvarno kupljenih vrednosti", () => {
  const q = usualQuantity([ev(6), ev(8), ev(9), ev(10), ev(12)]);
  assert.deepEqual(q, { low: 8, high: 10, unit: "kom" });
  assert.equal(formatQuantity(q), "8–10 kom");
  assert.equal(formatQuantity(usualQuantity([ev(2), ev(2), ev(2)])), "2 kom");
});

test("količina: mešane ili nepoznate jedinice se ne prikazuju", () => {
  assert.equal(usualQuantity([ev(1, "l"), ev(1, "kom"), ev(1, "l")]), null);
  assert.equal(usualQuantity([ev(1, ""), ev(1, ""), ev(1, "")]), null);
  assert.equal(usualQuantity([{ quantity: 1, units: [null] }, ev(1), ev(1)]), null);
});

test("količina: preširok raspon ili nepozitivna količina se ne prikazuju", () => {
  assert.equal(usualQuantity([ev(1), ev(1), ev(20), ev(20)]), null);
  assert.equal(usualQuantity([ev(0), ev(3), ev(3)]), null);
});

test("razlog: bez aktuelnog obračuna samo činjenice", () => {
  const r = reorderReason({ eventCount: 12, lastPurchaseOn: "2026-09-17", daysSinceLastPurchase: 12, status: "overdue", medianIntervalDays: 30, rhythmCurrent: false });
  assert.equal(r, "Kupljeno 12 puta, poslednji put 17/09/2026");
});

test("razlog: uz aktuelan obračun pominje uobičajeni razmak, bez reči „kasnite”", () => {
  const r = reorderReason({ eventCount: 21, lastPurchaseOn: "2026-08-18", daysSinceLastPurchase: 42, status: "overdue", medianIntervalDays: 30, rhythmCurrent: true });
  assert.match(r, /Kupljeno 21 put,/);
  assert.match(r, /Obično na ~30 dana; od poslednje kupovine je prošlo 42 dana\./);
  assert.doesNotMatch(r, /kasn/i);
  // Uspavan artikal ne dobija rečenicu o ritmu.
  assert.doesNotMatch(
    reorderReason({ eventCount: 5, lastPurchaseOn: "2026-02-01", daysSinceLastPurchase: 240, status: "dormant", medianIntervalDays: 30, rhythmCurrent: true }),
    /Obično/,
  );
});

test("veza: samo potvrđena i samo na postojeći proizvod", () => {
  const has = (s) => s === "postoji";
  assert.equal(linkedProduct({ status: "mapped", catalogProductSlug: "postoji" }, has), true);
  assert.equal(linkedProduct({ status: "suggested", catalogProductSlug: "postoji" }, has), false);
  assert.equal(linkedProduct({ status: "conflict", catalogProductSlug: "postoji" }, has), false);
  assert.equal(linkedProduct({ status: "mapped", catalogProductSlug: "nestalo" }, has), false);
  assert.equal(linkedProduct({ status: "mapped", catalogProductSlug: null }, has), false);
  assert.equal(linkedProduct(null, has), false);
});

test("varijanta: samo ako oznaka postoji u selektoru", () => {
  const opts = [{ id: "156.058", sku: "156.058", label: "P600" }, { id: "156.059", sku: "156.059", label: "P800" }];
  assert.deepEqual(resolveVariant("156.059", opts), { key: "156.059", label: "P800" });
  assert.equal(resolveVariant("P800", opts), null, "oznaka se ne pogađa po nazivu");
  assert.equal(resolveVariant(null, opts), null);
});

test("redosled: termin pre ostalog, stariji od godinu dana otpada", () => {
  const base = { rhythmCurrent: true, status: "not_yet" };
  const items = orderReorderItems([
    { ...base, articleCode: "A", lastPurchaseOn: "2026-09-20", daysSinceLastPurchase: 9 },
    { ...base, articleCode: "B", lastPurchaseOn: "2026-08-01", daysSinceLastPurchase: 59, status: "overdue" },
    { ...base, articleCode: "C", lastPurchaseOn: "2025-06-01", daysSinceLastPurchase: 485 },
    { ...base, articleCode: "D", lastPurchaseOn: "2026-08-02", daysSinceLastPurchase: 58, status: "overdue", rhythmCurrent: false },
  ]);
  assert.deepEqual(items.map((i) => i.articleCode), ["B", "A", "D"]);
});
