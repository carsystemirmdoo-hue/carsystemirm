import assert from "node:assert/strict";
import { test } from "node:test";
import { isRequiredCompanion, requiredCompanionQuantities, requiredPairMessage, requiredPairProblems } from "./requiredPairs.mjs";

// Isti oblik kao blanko posude: stara i nova šifra posude zatvaraju se istim poklopcem.
const PAIRS = [
  { articleId: "p-stara", companionId: "poklopac" },
  { articleId: "p-nova", companionId: "poklopac" },
  { articleId: "q", companionId: "poklopac-q" },
];

test("poklopac = zbir svih njegovih posuda", () => {
  const need = requiredCompanionQuantities(PAIRS, [{ articleId: "p-stara", quantity: 2 }, { articleId: "p-nova", quantity: 3 }]);
  assert.equal(need.get("poklopac"), 5);
  assert.equal(need.get("poklopac-q"), 0);
});

test("jednak broj → bez kršenja", () => {
  assert.deepEqual(requiredPairProblems(PAIRS, [{ articleId: "p-nova", quantity: 4 }, { articleId: "poklopac", quantity: 4 }]), []);
  assert.deepEqual(requiredPairProblems(PAIRS, []), []);
});

test("manje, više ili bez poklopca → kršenje", () => {
  assert.deepEqual(requiredPairProblems(PAIRS, [{ articleId: "p-nova", quantity: 4 }, { articleId: "poklopac", quantity: 3 }]), [{ companionId: "poklopac", required: 4, actual: 3 }]);
  assert.deepEqual(requiredPairProblems(PAIRS, [{ articleId: "p-nova", quantity: 4 }, { articleId: "poklopac", quantity: 5 }]), [{ companionId: "poklopac", required: 4, actual: 5 }]);
  assert.deepEqual(requiredPairProblems(PAIRS, [{ articleId: "q", quantity: 1 }]), [{ companionId: "poklopac-q", required: 1, actual: 0 }]);
});

test("poklopac bez posude je kršenje", () => {
  const [p] = requiredPairProblems(PAIRS, [{ articleId: "poklopac", quantity: 2 }]);
  assert.deepEqual(p, { companionId: "poklopac", required: 0, actual: 2 });
  assert.match(requiredPairMessage(p, () => "POKLOPAC"), /ne poručuje bez/);
});

test("poruka nosi potreban i stvaran broj", () => {
  assert.equal(requiredPairMessage({ companionId: "x", required: 4, actual: 3 }, () => "POKLOPAC"), "POKLOPAC: broj poklopaca mora biti jednak broju posuda (4), a sada je 3.");
});

test("prepoznaje poklopac", () => {
  assert.equal(isRequiredCompanion(PAIRS, "poklopac"), true);
  assert.equal(isRequiredCompanion(PAIRS, "p-nova"), false);
});
