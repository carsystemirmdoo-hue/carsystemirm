import { test } from "node:test";
import assert from "node:assert/strict";
import { staleNote, stockRank, stockShort, workdaysSince } from "./stockAge.mjs";

test("radni dani: vikend se ne računa", () => {
  assert.equal(workdaysSince("2026-11-10", "2026-11-10"), 0);
  assert.equal(workdaysSince("2026-11-06", "2026-11-09"), 1); // petak → ponedeljak
  assert.equal(workdaysSince("2026-11-06", "2026-11-08"), 0); // petak → nedelja
  assert.equal(workdaysSince("2026-11-05", "2026-11-09"), 2);
});

test("napomena o starosti", () => {
  assert.equal(staleNote(0), null);
  assert.equal(staleNote(1), "nije ažurirano 1 radni dan");
  assert.equal(staleNote(2), "nije ažurirano 2 radna dana");
  assert.equal(staleNote(5), "nije ažurirano 5 radnih dana");
  assert.equal(staleNote(12), "nije ažurirano 12 radnih dana");
  assert.equal(staleNote(21), "nije ažurirano 21 radni dan");
  assert.equal(staleNote(22), "nije ažurirano 22 radna dana");
});

test("kratka oznaka i redosled", () => {
  assert.equal(stockShort("ima"), "Ima");
  assert.equal(stockShort("upit"), "Na upit");
  assert.ok(stockRank("ima") < stockRank("upit") && stockRank("upit") < stockRank("nema"));
});
