import assert from "node:assert/strict";
import test from "node:test";
import { matchesStatusFilter, parseCustomerStatusFilter, validateStatusChange } from "./customerStatus.mjs";

test("filter: podrazumevano aktivni; nepoznata vrednost ne otvara neaktivne", () => {
  assert.equal(parseCustomerStatusFilter(undefined), "aktivni");
  assert.equal(parseCustomerStatusFilter("neaktivni"), "neaktivni");
  assert.equal(parseCustomerStatusFilter("svi"), "svi");
  assert.equal(parseCustomerStatusFilter("'; drop"), "aktivni");
  assert.equal(parseCustomerStatusFilter(undefined, "svi"), "svi");
  assert.equal(matchesStatusFilter(false, "aktivni"), false);
  assert.equal(matchesStatusFilter(false, "neaktivni"), true);
  assert.equal(matchesStatusFilter(true, "neaktivni"), false);
  assert.equal(matchesStatusFilter(false, "svi"), true);
});

test("promena statusa traži razlog i stvarnu promenu", () => {
  assert.deepEqual(validateStatusChange({ currentActive: true, nextActive: false, reason: "  ne " }), { ok: false, code: "reason_short" });
  assert.deepEqual(validateStatusChange({ currentActive: false, nextActive: false, reason: "više ne radi" }), { ok: false, code: "no_change" });
  assert.deepEqual(validateStatusChange({ currentActive: true, nextActive: false, reason: " više ne radi " }), { ok: true, reason: "više ne radi" });
  assert.deepEqual(validateStatusChange({ currentActive: false, nextActive: true, reason: "ponovo kupuje" }), { ok: true, reason: "ponovo kupuje" });
});
