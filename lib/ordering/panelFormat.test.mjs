import { test } from "node:test";
import assert from "node:assert/strict";
import { amount, dmy, dmyTime, money, percent, quantity } from "./panelFormat.mjs";

const NBSP = " ";

test("iznosi: srpski razdvajači, dve decimale, valuta bez preloma", () => {
  assert.equal(amount(474432), "474.432,00");
  assert.equal(amount(197680), "197.680,00");
  assert.equal(amount(0.5), "0,50");
  assert.equal(amount(1234567.891), "1.234.567,89");
  assert.equal(amount(43124503.25), "43.124.503,25");
  assert.equal(amount(-45530.8), "−45.530,80");
  assert.equal(amount(null), "—");
  assert.equal(money(474432), `474.432,00${NBSP}RSD`);
  assert.equal(money(null), "—");
});

test("količina i procenat", () => {
  assert.equal(quantity(2), "2");
  assert.equal(quantity(12.5), "12,5");
  assert.equal(quantity(0.125), "0,125");
  assert.equal(quantity(1500), "1.500");
  assert.equal(percent(20), `20${NBSP}%`);
  assert.equal(percent(37.5), `37,5${NBSP}%`);
  assert.equal(percent(null), "—");
});

test("datumi dd/mm/yyyy po beogradskom vremenu", () => {
  assert.equal(dmy("2026-10-01"), "01/10/2026");
  // 22:30 UTC 10. oktobra je već 11. oktobar u Beogradu (UTC+2).
  assert.equal(dmy(new Date("2026-10-10T22:30:00Z")), "11/10/2026");
  assert.equal(dmyTime(new Date("2026-10-10T07:14:00Z")), "10/10/2026 09:14");
  assert.equal(dmyTime(new Date("2026-01-05T07:04:00Z")), "05/01/2026 08:04");
  assert.equal(dmy(null), "—");
});
