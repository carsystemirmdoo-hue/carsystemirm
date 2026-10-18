import assert from "node:assert/strict";
import { test } from "node:test";
import { articleStats, enoughHistory, frequentOrder, personalOrder, refillCandidates, refillReason } from "./forYouRules.mjs";

const ev = (articleId, date, purchaseId = `${articleId}-${date}`) => ({ articleId, date, purchaseId });

test("učestalost po različitim kupovinama, ne po broju stavki istog dokumenta", () => {
  const s = articleStats([ev("a", "2026-10-01", "d1"), ev("a", "2026-10-01", "d1"), ev("b", "2026-09-01"), ev("b", "2026-10-01")], "2026-10-16");
  assert.equal(s.find((x) => x.articleId === "a").purchases, 1);
  assert.equal(s.find((x) => x.articleId === "b").purchases, 2);
});

test("novija kupovina vredi više od iste starije", () => {
  const s = articleStats([ev("staro", "2025-10-16"), ev("novo", "2026-10-10")], "2026-10-16");
  assert.deepEqual(frequentOrder(s).map((x) => x.articleId), ["novo", "staro"]);
});

test("česta kupovina iznad jedne skorije", () => {
  const s = articleStats([ev("cesto", "2026-07-01"), ev("cesto", "2026-08-01"), ev("cesto", "2026-09-01"), ev("jednom", "2026-10-15")], "2026-10-16");
  assert.equal(frequentOrder(s)[0].articleId, "cesto");
});

test("buduće kupovine se ne računaju", () => {
  assert.deepEqual(articleStats([ev("a", "2026-12-01")], "2026-10-16"), []);
});

test("dopuna: tek uz bar tri kupovine i kada je prošlo ≥ 80 % razmaka", () => {
  const due = articleStats([ev("a", "2026-07-01"), ev("a", "2026-08-01"), ev("a", "2026-09-01")], "2026-10-01");
  assert.equal(refillCandidates(due)[0].intervalDays, 31);
  const early = articleStats([ev("a", "2026-07-01"), ev("a", "2026-08-01"), ev("a", "2026-09-01")], "2026-09-10");
  assert.deepEqual(refillCandidates(early), []);
  const two = articleStats([ev("a", "2026-08-01"), ev("a", "2026-09-01")], "2026-10-01");
  assert.deepEqual(refillCandidates(two), []);
  const stale = articleStats([ev("a", "2026-01-01"), ev("a", "2026-01-15"), ev("a", "2026-02-01")], "2026-10-01");
  assert.deepEqual(refillCandidates(stale), [], "posle trostrukog razmaka nije „dopuna“");
});

test("objašnjenje bez tvrdnje o stanju kod kupca", () => {
  assert.equal(refillReason(31, 30), "Obično na oko 31 dan · poslednja pre 30 dana");
  assert.doesNotMatch(refillReason(30, 30), /nestalo|stanje|zalih/i);
});

test("dovoljno istorije: bar 3 kupovine i 2 artikla", () => {
  assert.equal(enoughHistory([ev("a", "2026-01-01", "d1"), ev("a", "2026-02-01", "d2")]), false);
  assert.equal(enoughHistory([ev("a", "2026-01-01", "d1"), ev("b", "2026-02-01", "d2"), ev("a", "2026-03-01", "d3")]), true);
});

test("lični redosled: kupovano → srodno → ostatak; svaka stavka jednom; nepoznato se ignoriše", () => {
  const { order, tier } = personalOrder(["s1", "s2", "s3", "s4", "s5"], ["s4", "x", "s2"], ["s2", "s5"]);
  assert.deepEqual(order, ["s4", "s2", "s5", "s1", "s3"]);
  assert.equal(tier.get("s2"), 1);
  assert.equal(tier.get("s5"), 2);
  assert.equal(tier.get("s1"), 3);
  assert.equal(new Set(order).size, order.length);
});
