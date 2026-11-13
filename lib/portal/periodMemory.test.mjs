import assert from "node:assert/strict";
import test from "node:test";
import { decodePeriod, encodePeriod, periodLabel, resolvePortalPeriod } from "./periodMemory.mjs";

test("kolačić: dva datuma, jedan datum ili „sve“; neispravno se ne pamti", () => {
  assert.equal(encodePeriod("2026-10-01", "2026-11-13"), "2026-10-01|2026-11-13");
  assert.equal(encodePeriod("", ""), "sve");
  assert.equal(encodePeriod("2026-02-31", null), "sve");
  assert.deepEqual(decodePeriod("2026-10-01|2026-11-13"), { from: "2026-10-01", to: "2026-11-13" });
  assert.deepEqual(decodePeriod("sve"), { from: null, to: null });
  assert.deepEqual(decodePeriod("|2026-11-13"), { from: null, to: "2026-11-13" });
  assert.deepEqual(decodePeriod("2026-11-13|2026-10-01"), { from: "2026-10-01", to: "2026-11-13" });
  assert.equal(decodePeriod("x|y"), null);
  assert.equal(decodePeriod(undefined), null);
});

test("adresa ima prednost, i prazna („Sve vreme“); kolačić samo kada adresa ćuti", () => {
  const c = "2026-10-01|2026-11-13";
  assert.deepEqual(resolvePortalPeriod({ from: "2026-01-01", to: "2026-03-31" }, c), { from: "2026-01-01", to: "2026-03-31", source: "adresa" });
  assert.deepEqual(resolvePortalPeriod({ from: "", to: "" }, c), { from: null, to: null, source: "adresa" });
  assert.deepEqual(resolvePortalPeriod({}, c), { from: "2026-10-01", to: "2026-11-13", source: "zapamceno" });
  assert.deepEqual(resolvePortalPeriod({}, "sve"), { from: null, to: null, source: "zapamceno" });
  assert.deepEqual(resolvePortalPeriod({}, undefined), { from: null, to: null, source: "podrazumevano" });
  assert.deepEqual(resolvePortalPeriod({ from: "2026-05-01", to: "2026-04-01" }, null), { from: "2026-04-01", to: "2026-05-01", source: "adresa" });
});

test("opis perioda", () => {
  assert.equal(periodLabel({ from: "2026-10-01", to: "2026-11-13" }), "1. 10. 2026. – 13. 11. 2026.");
  assert.equal(periodLabel({ from: null, to: null }), "sve vreme");
  assert.equal(periodLabel({ from: "2026-10-01", to: null }), "od 1. 10. 2026.");
});
