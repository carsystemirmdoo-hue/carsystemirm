import assert from "node:assert/strict";
import test from "node:test";
import { creditLimitFor, creditStatus, normalizeDefaultPercent, parseLimitInput } from "./creditLimit.mjs";

test("podrazumevano 150 % prosečne mesečne kupovine", () => {
  assert.deepEqual(creditLimitFor({ gross12m: 1_200_000, override: null, defaultPercent: 150 }), { avgMonthly: 100_000, limit: 150_000, basis: "default", percent: 150 });
});

test("sopstveni procenat i tačan iznos imaju prednost", () => {
  assert.equal(creditLimitFor({ gross12m: 1_200_000, override: { percent: 200, amount: null }, defaultPercent: 150 }).limit, 200_000);
  assert.equal(creditLimitFor({ gross12m: 0, override: { percent: null, amount: 50_000 }, defaultPercent: 150 }).limit, 50_000);
});

test("bez kupovine u 12 meseci nema automatskog limita", () => {
  assert.deepEqual(creditLimitFor({ gross12m: 0, override: null, defaultPercent: 150 }), { avgMonthly: 0, limit: null, basis: "none", percent: null });
});

test("stanje: preko, blizu, u redu, kasni", () => {
  assert.equal(creditStatus({ debt: 160_000, limit: 150_000, maxDaysOverdue: 0 }).status, "over");
  assert.equal(creditStatus({ debt: 130_000, limit: 150_000, maxDaysOverdue: 0 }).status, "near");
  assert.equal(creditStatus({ debt: 10_000, limit: 150_000, maxDaysOverdue: 31 }).late, true);
  assert.equal(creditStatus({ debt: 10_000, limit: 150_000, maxDaysOverdue: 30 }).late, false);
  assert.equal(creditStatus({ debt: 10, limit: null, maxDaysOverdue: null }).status, "no_limit");
});

test("unos sa ekrana", () => {
  assert.deepEqual(parseLimitInput({ mode: "percent", value: "120" }), { ok: true, percent: 120, amount: null, reset: false });
  assert.deepEqual(parseLimitInput({ mode: "amount", value: "250.000" }), { ok: true, percent: null, amount: 250000, reset: false });
  assert.deepEqual(parseLimitInput({ mode: "amount", value: "1.250.000,50" }), { ok: true, percent: null, amount: 1250000.5, reset: false });
  assert.equal(parseLimitInput({ mode: "percent", value: "abc" }).ok, false);
  assert.equal(parseLimitInput({ mode: "default", value: "" }).ok, true);
  assert.equal(normalizeDefaultPercent({ percent: 120 }), 120);
  assert.equal(normalizeDefaultPercent("x"), 150);
});
