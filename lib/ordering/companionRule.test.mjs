import assert from "node:assert/strict";
import test from "node:test";
import { companionDecision, companionStockPolicy } from "./companionRule.mjs";

const base = { orderable: true, outOfProgramme: false, stock: "nepoznato", policy: "require" };

test("bez izvora zaliha poklopac se podrazumevano NE predlaže", () => {
  assert.deepEqual(companionDecision(base), { show: false, mode: null, reason: "stanje zaliha nije poznato (izvor zaliha ne postoji)" });
  assert.equal(companionStockPolicy(undefined), "require");
  assert.equal(companionStockPolicy("da"), "require");
});

test("uz izričitu postavku predlaže se i kad stanje nije poznato", () => {
  assert.equal(companionStockPolicy(" unknown-ok "), "unknown-ok");
  assert.equal(companionDecision({ ...base, policy: "unknown-ok" }).show, true);
});

test("poznato stanje odlučuje bez obzira na postavku", () => {
  assert.equal(companionDecision({ ...base, stock: "na_stanju" }).show, true);
  assert.equal(companionDecision({ ...base, stock: "nema", policy: "unknown-ok" }).show, false);
});

test("van programa — nikad; bez potvrđene ponude/pakovanja/cene — samo upit, nikad dodavanje", () => {
  assert.equal(companionDecision({ ...base, policy: "unknown-ok", outOfProgramme: true }).show, false);
  assert.deepEqual(companionDecision({ ...base, policy: "unknown-ok", orderable: false }), { show: true, mode: "upit", reason: "pribor nije u potvrđenoj ponudi za direktno poručivanje" });
  assert.equal(companionDecision({ ...base, policy: "unknown-ok" }).mode, "dodaj");
});

import { suggestCompanionPacks } from "./companionRule.mjs";

const vol = { base: 100, companion: 50, basis: "zapremina" };

test("herter: 2 × 1 L laka po 100 : 50 (zapremina) = 1 L → 1 × 1 L ili 2 × 0,5 L", () => {
  assert.deepEqual(suggestCompanionPacks({ basePacks: 2, basePack: { quantity: 1, unit: "LIT" }, companionPack: { quantity: 1, unit: "LIT" }, ratio: vol }), { packs: 1, needed: 1, unit: "LIT", reason: null });
  assert.equal(suggestCompanionPacks({ basePacks: 2, basePack: { quantity: 1, unit: "LIT" }, companionPack: { quantity: 0.5, unit: "LIT" }, ratio: vol }).packs, 2);
  // 5 L laka, 25 % → 1,25 L; pakovanje 1 L → 2 (zaokružuje se naviše, nikad manje od potrebnog)
  assert.equal(suggestCompanionPacks({ basePacks: 1, basePack: { quantity: 5, unit: "LIT" }, companionPack: { quantity: 1, unit: "LIT" }, ratio: { base: 100, companion: 25, basis: "zapremina" } }).packs, 2);
});

test("herter: bez osnove odnosa, sa JM komad ili sa masom naspram litara — nema predloga", () => {
  assert.equal(suggestCompanionPacks({ basePacks: 1, basePack: { quantity: 1, unit: "LIT" }, companionPack: { quantity: 1, unit: "LIT" }, ratio: { base: 2, companion: 1, basis: null } }).packs, null);
  assert.equal(suggestCompanionPacks({ basePacks: 1, basePack: { quantity: 1, unit: "KOM" }, companionPack: { quantity: 1, unit: "KOM" }, ratio: vol }).packs, null);
  assert.equal(suggestCompanionPacks({ basePacks: 1, basePack: { quantity: 1, unit: "LIT" }, companionPack: { quantity: 1, unit: "LIT" }, ratio: { base: 100, companion: 3, basis: "masa" } }).packs, null);
  assert.equal(suggestCompanionPacks({ basePacks: 1, basePack: { quantity: 1, unit: "LIT" }, companionPack: { quantity: 1, unit: "LIT" }, ratio: null }).packs, null);
});
