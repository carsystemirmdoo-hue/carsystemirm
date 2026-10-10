import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePricing, scopeKeyFor } from "./precedence.mjs";

const base = { customerScope: "customer", customerId: "c1", valueKind: "discount_percent", effectiveFrom: "2026-01-01", effectiveTo: null, status: "approved_pending_biznisoft" };
const art = (p, cond = null, id = `r${p}${cond ?? ""}`) => ({ ...base, id, productScope: "article", articleId: "a1", discountPercent: String(p), paymentCondition: cond });
const brand = (p, cond = null) => ({ ...base, id: `b${p}${cond ?? ""}`, productScope: "brand", brand: "BASLAC", discountPercent: String(p), paymentCondition: cond });
const ctx = (cond = null) => ({ customerId: "c1", customerGroupIds: [], articleId: "a1", brand: "BASLAC", onDate: "2026-10-10", paymentCondition: cond });

test("uslov plaćanja je deo opsega: uslovno i bezuslovno pravilo istog para nisu isti opseg", () => {
  assert.notEqual(scopeKeyFor(art(38)), scopeKeyFor(art(44, "avans")));
  assert.equal(scopeKeyFor(art(38)), "customer:c1|article:a1", "bezuslovni ključ se ne menja (postojeća pravila)");
});

test("bez izabranog uslova uslovni rabat se ne primenjuje — jači rabat nije podrazumevan", () => {
  const d = evaluatePricing([art(38), art(44, "avans")], ctx());
  assert.equal(Number(d.winner.discountPercent), 38);
  assert.equal(d.conflict.length, 0);
  assert.equal(evaluatePricing([art(44, "avans")], ctx()).winner, null, "samo uslovno pravilo → nema podrazumevane cene");
});

test("izabran uslov: na istoj klasi uslovno pravilo ima prednost, bez sukoba", () => {
  const d = evaluatePricing([art(38), art(44, "avans")], ctx("avans"));
  assert.equal(Number(d.winner.discountPercent), 44);
  assert.equal(d.conflict.length, 0);
});

test("pojedinačni dogovor artikla bez uslova + šire pravilo opcije → za pregled, ne bira se tiho", () => {
  const d = evaluatePricing([art(40), brand(44, "avans")], ctx("avans"));
  assert.equal(d.winner, null);
  assert.equal(d.exceptionReview, true);
  // Bez izabrane opcije pojedinačni dogovor važi normalno.
  assert.equal(Number(evaluatePricing([art(40), brand(44, "avans")], ctx()).winner.discountPercent), 40);
});

test("unutar opcije: artikal > brend > osnovni rabat; opcija bez svog pravila koristi osnovni uslov", () => {
  const all = (p, cond = null) => ({ ...base, id: `all${p}${cond ?? ""}`, productScope: "all", discountPercent: String(p), paymentCondition: cond });
  assert.equal(Number(evaluatePricing([all(30), brand(38), brand(44, "avans")], ctx("avans")).winner.discountPercent), 44);
  assert.equal(Number(evaluatePricing([all(30), brand(38), brand(44, "avans")], ctx("odlozeno_30")).winner.discountPercent), 38);
  assert.equal(Number(evaluatePricing([all(30), art(41, "avans"), brand(44, "avans")], ctx("avans")).winner.discountPercent), 41);
  assert.equal(Number(evaluatePricing([all(30)], ctx("avans")).winner.discountPercent), 30);
});
