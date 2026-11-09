import assert from "node:assert/strict";
import test from "node:test";
import { decisionOf, groupChanges, mergeDigest, peopleOf, transitionLabel } from "./ownerChanges.mjs";

const row = (over = {}) => ({
  id: "r1",
  sourceBatch: "promena-2026-11-09-aaaa",
  customerId: "c1",
  customerName: "INTER COLOR DOO",
  productScope: "article",
  brand: null,
  productGroup: null,
  articleCode: "504765",
  articleName: "BASLAC 35-M218 1L",
  valueKind: "discount_percent",
  newValue: 25,
  oldValue: 20,
  paymentCondition: null,
  effectiveFrom: "2026-11-10",
  status: "approved_pending_biznisoft",
  decidedAt: "2026-11-09T10:00:00.000Z",
  decidedById: "u-milan",
  decidedByName: "Milan Vračar",
  proposedByName: "Milan Vračar",
  reason: "dogovor",
  ...over,
});

test("predlog bez odluke nije promena; odbijeno i opozvano jesu", () => {
  assert.equal(decisionOf("pending_approval"), null);
  assert.equal(decisionOf("draft"), null);
  assert.equal(decisionOf("approved_pending_biznisoft"), "approved");
  assert.equal(decisionOf("confirmed"), "approved");
  assert.equal(decisionOf("rejected"), "rejected");
  assert.equal(decisionOf("revoked"), "revoked");
});

test("stari → novi rabat; bez starog pravila piše „novo“", () => {
  assert.equal(transitionLabel("discount_percent", 20, 25), "20 % → 25 %");
  assert.equal(transitionLabel("discount_percent", null, 25), "novo: 25 %");
});

test("jedna serija jednog kupca = jedan blok, sa zbirom prelaza", () => {
  const blocks = groupChanges([
    row({ id: "a", articleCode: "1" }),
    row({ id: "b", articleCode: "2", decidedAt: "2026-11-09T10:00:05.000Z" }),
    row({ id: "c", articleCode: "3", oldValue: 15 }),
    row({ id: "d", status: "pending_approval" }),
  ]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].items.length, 3);
  assert.equal(blocks[0].decidedAt, "2026-11-09T10:00:05.000Z");
  assert.equal(blocks[0].change, "2 × 20 % → 25 % · 1 × 15 % → 25 %");
});

test("različiti kupci, osobe i pravila bez serije su odvojeni blokovi, najnoviji prvi", () => {
  const blocks = groupChanges([
    row({ id: "a" }),
    row({ id: "b", customerId: "c2", customerName: "DRUGI", decidedAt: "2026-11-09T12:00:00.000Z" }),
    row({ id: "c", decidedById: "u-petar", decidedByName: "Petar" }),
    row({ id: "d", sourceBatch: null, productScope: "brand", brand: "BASLAC", articleCode: null, articleName: null }),
  ]);
  assert.equal(blocks.length, 4);
  assert.equal(blocks[0].customerName, "DRUGI");
  assert.ok(blocks.some((b) => b.scope === "grupa „BASLAC\""));
  assert.deepEqual(peopleOf(blocks).map((p) => [p.name, p.blocks]), [["Milan Vračar", 3], ["Petar", 1]]);
});

test("dnevni zbir: jedno obaveštenje koje broji po osobi i pamti poslednje", () => {
  let d = mergeDigest(null, { day: "2026-11-09", actorName: "Milan Vračar", line: "INTER COLOR: 20 % → 25 %", warning: false });
  assert.equal(d.title, "Promene cena i rabata 09/11/2026: 1 odluka (Milan Vračar 1)");
  assert.equal(d.severity, "info");
  d = mergeDigest(d.context, { day: "2026-11-09", actorName: "Petar", line: "X: odbijeno", warning: true });
  d = mergeDigest(d.context, { day: "2026-11-09", actorName: "Milan Vračar", line: "Y: novo 10 %", warning: false });
  assert.equal(d.title, "Promene cena i rabata 09/11/2026: 3 odluke (Milan Vračar 2, Petar 1)");
  assert.equal(d.severity, "warning", "odbijanje ili opoziv ostaje vidljiv u zbiru");
  assert.equal(d.body.split("\n")[0], "Milan Vračar — Y: novo 10 %");
  for (let i = 0; i < 10; i += 1) d = mergeDigest(d.context, { day: "2026-11-09", actorName: "Petar", line: `Z${i}`, warning: false });
  assert.equal(d.context.poslednje.length, 8);
  assert.match(d.body, /… i još 5\./);
  assert.match(d.title, /13 odluka/);
});
