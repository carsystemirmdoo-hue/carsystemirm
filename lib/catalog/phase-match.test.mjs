import assert from "node:assert/strict";
import test from "node:test";
import { matchesPhase, phasesOf } from "./phase-match.mjs";

test("komponenta sa više primena odgovara glavnoj i dodatnim fazama", () => {
  const h2a14 = { phaseSlug: "lak", secondaryPhaseSlugs: ["boja"] };
  assert.equal(matchesPhase(h2a14, "lak"), true);
  assert.equal(matchesPhase(h2a14, "boja"), true);
  assert.equal(matchesPhase(h2a14, "podloga"), false);
  assert.deepEqual(phasesOf(h2a14), ["lak", "boja"]);
  assert.equal(matchesPhase({ phaseSlug: "lak" }, "boja"), false);
});

test("faza bez potvrde u dokumentaciji se ne nudi u filteru", () => {
  const product = { phaseSlug: "boja", phaseUnconfirmed: true };
  assert.equal(matchesPhase(product, "boja"), false);
  assert.deepEqual(phasesOf(product), []);
});
