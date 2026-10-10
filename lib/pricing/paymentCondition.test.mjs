import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePricing, scopeKeyFor } from "./precedence.mjs";

const base = { customerScope: "customer", customerId: "c1", valueKind: "discount_percent", effectiveFrom: "2026-01-01", effectiveTo: null, status: "approved_pending_biznisoft" };
const art = (p, cond = null, id = `r${p}${cond ?? ""}`) => ({ ...base, id, productScope: "article", articleId: "a1", discountPercent: String(p), paymentCondition: cond });
const brand = (p, cond = null) => ({ ...base, id: `b${p}${cond ?? ""}`, productScope: "brand", brand: "BASLAC", discountPercent: String(p), paymentCondition: cond });
const ctx = (cond = null) => ({ customerId: "c1", customerGroupIds: [], articleId: "a1", brand: "BASLAC", onDate: "2026-10-10", paymentCondition: cond });

test("uslov plaćanja je deo opsega: uslovno i bezuslovno pravilo istog para nisu isti opseg", () => {
  assert.notEqual(scopeKeyFor(art(38)), scopeKeyFor(art(44, "kratak_rok")));
  assert.equal(scopeKeyFor(art(38)), "customer:c1|article:a1", "bezuslovni ključ se ne menja (postojeća pravila)");
});

test("bez izabranog uslova uslovni rabat se ne primenjuje — jači rabat nije podrazumevan", () => {
  const d = evaluatePricing([art(38), art(44, "kratak_rok")], ctx());
  assert.equal(Number(d.winner.discountPercent), 38);
  assert.equal(d.conflict.length, 0);
  assert.equal(evaluatePricing([art(44, "kratak_rok")], ctx()).winner, null, "samo uslovno pravilo → nema podrazumevane cene");
});

test("izabran uslov: na istoj klasi uslovno pravilo ima prednost, bez sukoba", () => {
  const d = evaluatePricing([art(38), art(44, "kratak_rok")], ctx("kratak_rok"));
  assert.equal(Number(d.winner.discountPercent), 44);
  assert.equal(d.conflict.length, 0);
});

test("uži opseg i dalje pobeđuje: pojedinačni dogovor artikla nad uslovom za brend", () => {
  const d = evaluatePricing([art(40), brand(44, "kratak_rok")], ctx("kratak_rok"));
  assert.equal(Number(d.winner.discountPercent), 40);
});
