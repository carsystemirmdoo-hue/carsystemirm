import assert from "node:assert/strict";
import test from "node:test";
import { billingQuantity, orderPack, packSummary, parsePacks, suggestedPacks } from "./packRule.mjs";

const lit5 = { packQuantity: "5.000", unit: "LIT", label: "limenka 5 L" };

test("merna JM: samo uz potvrđenu količinu pakovanja; 2 × 5 L = 10 LIT", () => {
  assert.equal(orderPack({ unit: "LIT" }).status, "blocked", "bez potvrde nema preračuna");
  const p = orderPack({ unit: "LIT", confirmed: lit5 });
  assert.deepEqual(p, { status: "pack", packQuantity: 5, unit: "LIT", label: "limenka 5 L" });
  assert.equal(billingQuantity(2, p.packQuantity), 10);
  assert.equal(packSummary(2, p), "2 × limenka 5 L = 10 LIT");
  assert.equal(billingQuantity(3, "0.500"), 1.5);
});

test("komad: 2 pakovanja = 2 komada; delovi komada na fakturama blokiraju", () => {
  const p = orderPack({ unit: "KOM" });
  assert.equal(p.status, "pack");
  assert.equal(billingQuantity(2, p.packQuantity), 2);
  assert.equal(orderPack({ unit: "KOM", fractionalSales: true }).status, "blocked");
  assert.equal(orderPack({ unit: "KOM", fractionalSales: true, confirmed: { packQuantity: 1, unit: "KOM", label: "sprej 400 ml" } }).status, "pack");
});

test("promenjena JM posle potvrde poništava potvrdu", () => {
  const r = orderPack({ unit: "KOM", confirmed: lit5 });
  assert.equal(r.status, "blocked");
  assert.match(r.reason, /LIT.*KOM/);
});

test("broj pakovanja: samo ceo broj 1..999", () => {
  assert.deepEqual(parsePacks("2"), { ok: true, packs: 2 });
  for (const bad of ["0", "1,5", "1.5", "-1", "", "abc", "1000"]) assert.equal(parsePacks(bad).ok, false, bad);
});

test("predlog iz istorije: 10 LIT / 5 → 2; 7 LIT / 5 → 1", () => {
  assert.equal(suggestedPacks(10, 5), 2);
  assert.equal(suggestedPacks(7, 5), 1);
  assert.equal(suggestedPacks(3, 1), 3);
  assert.equal(suggestedPacks(0, 5), 1);
});

test("komad = pakovanje: prikaz bez ponavljanja obračuna; LIT se uvek prikazuje", async () => {
  const { isSinglePiece } = await import("./packRule.mjs");
  assert.equal(isSinglePiece({ quantity: 1, label: "1 kom" }, "KOM"), true);
  assert.equal(isSinglePiece({ quantity: 1, label: "limenka 1 L" }, "LIT"), false);
  assert.equal(isSinglePiece({ quantity: 6, label: "paket 6 kom" }, "KOM"), false);
  assert.equal(isSinglePiece(null, "KOM"), false);
});
