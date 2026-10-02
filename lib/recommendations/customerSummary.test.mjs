import assert from "node:assert/strict";
import test from "node:test";
import { ARTICLE_STATUS_LABELS, groupArticles, monthlyRhythm, summarizeCustomer, uncomputedArticle } from "./customerSummary.mjs";

const art = (code, status, over = {}) => ({
  articleCode: code,
  articleName: `Artikal ${code}`,
  status,
  eventCount: 8,
  lastPurchaseOn: "2026-08-01",
  medianIntervalDays: 30,
  daysUntilExpected: 10,
  daysSinceLastPurchase: 20,
  ...over,
});
const rhythm = (over = {}) => ({ status: "due", eventCount: 40, lastPurchaseOn: "2026-08-28", daysSinceLastPurchase: 31, ...over });
const monthly = { documentsLast12Months: 20, activeMonthsLast12: 11, perMonth: 1.7 };

test("svaki artikal se pojavljuje tačno jednom, grupe po važnosti", () => {
  const list = [art("A", "not_yet"), art("B", "overdue", { daysUntilExpected: -40 }), art("C", "dormant"), art("D", "due"), art("E", "provisional", { eventCount: 2 }), art("F", "not_computed")];
  const groups = groupArticles(list);
  assert.deepEqual(groups.map((g) => g.key), ["lapsed", "overdue", "due", "steady", "uncomputed", "thin"]);
  const all = groups.flatMap((g) => g.items.map((i) => i.articleCode)).sort();
  assert.deepEqual(all, ["A", "B", "C", "D", "E", "F"]);
});

test("ranije redovno, sada ne: najvažnija promena i predlog", () => {
  const s = summarizeCustomer({
    rhythm: rhythm(),
    monthly,
    articles: [art("KIT", "dormant", { eventCount: 11, lastPurchaseOn: "2026-01-31" }), art("BZ", "due", { daysUntilExpected: 0 })],
    hasActiveRun: true,
  });
  assert.equal(s.status.key, "attention");
  assert.match(s.change, /Artikal KIT: uzimao 11 puta, tipično na 30 dana; poslednji put 31\. 1\. 2026\., od tada ne/);
  assert.match(s.nextStep, /dogovoriti uobičajenu porudžbinu \(Artikal BZ\); pitati za Artikal KIT/);
  assert.deepEqual(s.mention.map((m) => m.articleCode), ["KIT", "BZ"]);
  assert.match(s.mention[1].reason, /sada je uobičajeni termin/);
});

test("kasni: najveće kašnjenje u odnosu na sopstveni ritam ide prvo", () => {
  const s = summarizeCustomer({
    rhythm: rhythm({ status: "overdue" }),
    monthly,
    articles: [
      art("A", "overdue", { medianIntervalDays: 90, daysUntilExpected: -10 }),
      art("B", "overdue", { medianIntervalDays: 14, daysUntilExpected: -60 }),
    ],
    hasActiveRun: true,
  });
  assert.match(s.change, /2 artikla su prošla uobičajeni termin; najviše Artikal B \(60 dana posle očekivanog\)/);
  assert.equal(s.mention[0].articleCode, "B");
});

test("uspavan kupac, premalo istorije i bez istorije", () => {
  const dormant = summarizeCustomer({ rhythm: rhythm({ status: "dormant", daysSinceLastPurchase: 279, lastPurchaseOn: "2025-12-24" }), monthly, articles: [art("X", "dormant")], hasActiveRun: true });
  assert.equal(dormant.status.label, "Ne kupuje od 24. 12. 2025.");
  assert.match(dormant.nextStep, /da li i dalje radi sa nama/);

  const thin = summarizeCustomer({ rhythm: rhythm({ eventCount: 2 }), monthly, articles: [art("Y", "provisional", { eventCount: 2 })], hasActiveRun: true });
  assert.equal(thin.status.key, "thin");
  assert.deepEqual(thin.mention, []);

  const none = summarizeCustomer({ rhythm: rhythm({ eventCount: 0, lastPurchaseOn: null, daysSinceLastPurchase: null }), monthly: { documentsLast12Months: 0, activeMonthsLast12: 0, perMonth: 0 }, articles: [], hasActiveRun: true });
  assert.equal(none.status.key, "none");
  assert.equal(none.usual, "—");
});

test("u ritmu: nema lažne promene", () => {
  const s = summarizeCustomer({ rhythm: rhythm({ status: "not_yet" }), monthly, articles: [art("A", "not_yet", { daysUntilExpected: 12 })], hasActiveRun: true });
  assert.equal(s.status.key, "steady");
  assert.match(s.change, /nema promene/);
  assert.match(s.nextStep, /za oko 12 dana/);
  assert.deepEqual(s.mention, []);
});

test("mesečni ritam broji poslednjih 12 meseci", () => {
  const m = monthlyRhythm(["2025-09-01", "2025-10-05", "2025-10-20", "2026-08-01"], "2026-09-28");
  assert.deepEqual(m, { documentsLast12Months: 3, activeMonthsLast12: 2, perMonth: 0.3 });
});

test("zastareo obračun: bez saveta i bez artikala za pominjanje", () => {
  const s = summarizeCustomer({
    rhythm: rhythm({ lastPurchaseOn: "2026-09-29", daysSinceLastPurchase: 0 }),
    monthly,
    articles: [art("BZ", "overdue", { daysUntilExpected: -67 })],
    hasActiveRun: true,
    freshness: { state: "new_documents", newDocuments: [{ issuedOn: "2026-09-29" }], runAsOfDate: "2026-09-28" },
  });
  assert.equal(s.status.key, "stale");
  assert.match(s.change, /Posle obračuna od 28\. 9\. 2026\. stigao je 1 nov dokument \(poslednji 29\. 9\. 2026\.\)/);
  assert.deepEqual(s.mention, []);
  assert.match(s.nextStep, /ne prikazuje/);
  assert.equal(s.lastPurchaseOn, "2026-09-29");
});

test("bez obračuna: „nije obračunato“, a ne „premalo istorije“", () => {
  // Regresija: bez rezultata obračuna artikal sa 11 kupovina je stajao u
  // grupi „premalo istorije“.
  assert.deepEqual(uncomputedArticle(11).status, "not_computed");
  assert.deepEqual(uncomputedArticle(2).status, "not_computed");
  assert.match(uncomputedArticle(11).explanation, /11 kupovina; ritam još nije obračunat/);
  // Jedna kupovina je zaista premalo istorije — i posle obračuna ostaje tako.
  assert.equal(uncomputedArticle(1).status, "insufficient_history");
  assert.equal(ARTICLE_STATUS_LABELS.not_computed, "Nije obračunato");
  assert.equal(ARTICLE_STATUS_LABELS.insufficient_history, "Nedovoljno istorije");

  const list = [art("A", uncomputedArticle(11).status, { eventCount: 11 }), art("B", uncomputedArticle(1).status, { eventCount: 1 })];
  const groups = groupArticles(list);
  assert.deepEqual(groups.map((g) => [g.key, g.label, g.items.map((i) => i.articleCode)]), [
    ["uncomputed", "Nije obračunato", ["A"]],
    ["thin", "Premalo istorije (1–2 kupovine)", ["B"]],
  ]);

  const s = summarizeCustomer({ rhythm: rhythm({ status: "not_yet" }), monthly, articles: list, hasActiveRun: false });
  assert.equal(s.status.key, "not_computed");
  assert.equal(s.status.label, "Nije obračunato");
  assert.doesNotMatch(s.change, /nema promene/);
  assert.match(s.nextStep, /posle obračuna preporuka/);
  assert.deepEqual(s.mention, []);

  // Ritam firme ne zavisi od obračuna: uspavan kupac ostaje uspavan.
  const dormant = summarizeCustomer({ rhythm: rhythm({ status: "dormant", lastPurchaseOn: "2025-12-24" }), monthly, articles: list, hasActiveRun: false });
  assert.equal(dormant.status.key, "dormant");
  // Kupac sa jednom-dve kupovine i dalje je „premalo istorije“.
  const thin = summarizeCustomer({ rhythm: rhythm({ eventCount: 2 }), monthly, articles: [list[1]], hasActiveRun: false });
  assert.equal(thin.status.key, "thin");
});
