import assert from "node:assert/strict";
import test from "node:test";
import {
  RANKING_VERSION,
  legacySuggestions,
  historyWeight,
  rankSuggestions,
  roughInterval,
  suggestionReason,
  suggestionScore,
  suggestionTier,
  timingWeight,
} from "./suggestionRanking.mjs";

const a = (code, status, over = {}) => ({
  articleCode: code,
  status,
  confidence: "medium",
  eventCount: 8,
  medianIntervalDays: 30,
  daysUntilExpected: 0,
  daysSinceLastPurchase: 30,
  ...over,
});

test("glavna lista: najviše 5, „Prikažite sve“ dobija ostatak", () => {
  const list = Array.from({ length: 9 }, (_, i) => a(`D${i}`, "due", { eventCount: 3 + i }));
  const r = rankSuggestions(list);
  assert.equal(r.top.length, 5);
  assert.equal(r.main.length, 9);
  // Pri istom terminu i pouzdanosti, više kupovina ide napred.
  assert.deepEqual(r.top.map((x) => x.articleCode), ["D8", "D7", "D6", "D5", "D4"]);
});

test("slabe procene (dve kupovine, niska pouzdanost) su odvojene od glavne liste", () => {
  const r = rankSuggestions([
    a("P", "provisional", { eventCount: 2, confidence: "low", daysUntilExpected: -2 }),
    a("L", "overdue", { confidence: "low", daysUntilExpected: -5 }),
    a("M", "overdue", { daysUntilExpected: -5 }),
  ]);
  assert.deepEqual(r.main.map((x) => x.articleCode), ["M"]);
  assert.deepEqual(r.weak.map((x) => x.articleCode).sort(), ["L", "P"]);
});

test("premalo istorije, nije obračunato, u ritmu i kupljeno posle obračuna ne pune listu", () => {
  for (const x of [
    a("I", "insufficient_history", { eventCount: 1, medianIntervalDays: null, daysUntilExpected: null }),
    a("N", "not_computed", { medianIntervalDays: null, daysUntilExpected: null }),
    a("Y", "not_yet", { daysUntilExpected: 20 }),
    a("O", "overdue", { daysUntilExpected: -5, statusOutdated: true }),
  ]) {
    assert.equal(suggestionTier(x), "none", x.articleCode);
  }
});

test("davno prestao artikal nije u kratkoj listi, ali nedavno prestao jeste", () => {
  assert.equal(suggestionTier(a("OLD", "dormant", { daysSinceLastPurchase: 900 })), "none");
  assert.equal(suggestionTier(a("NEW", "dormant", { daysSinceLastPurchase: 200 })), "main");
});

test("redosled ne zavisi samo od proteklog vremena", () => {
  // Isti broj dana od poslednje kupovine, različit ritam: jedan je sada u terminu, drugi ni blizu.
  const sada = a("SADA", "due", { medianIntervalDays: 60, daysSinceLastPurchase: 60, daysUntilExpected: 0 });
  const daleko = a("DALEKO", "overdue", { medianIntervalDays: 10, daysSinceLastPurchase: 60, daysUntilExpected: -50 });
  assert.ok(suggestionScore(sada) > suggestionScore(daleko));
  // Pouzdanost i broj kupovina menjaju redosled pri istom terminu.
  assert.ok(suggestionScore(a("H", "due", { confidence: "high" })) > suggestionScore(a("M", "due")));
  assert.ok(historyWeight(12) > historyWeight(4));
  assert.equal(historyWeight(40), 1);
  // Kašnjenje do pola ciklusa je i dalje „sada"; posle toga slabi.
  assert.equal(timingWeight(a("X", "overdue", { daysUntilExpected: -15 })), 1);
  assert.ok(timingWeight(a("X", "overdue", { daysUntilExpected: -90 })) < 0.5);
});

test("razlog je rečenica bez lažne preciznosti i bez obećanja datuma potrebe", () => {
  assert.equal(roughInterval(10), "~10 dana");
  assert.equal(roughInterval(21), "~3 nedelje");
  assert.equal(roughInterval(45), "~6 nedelja");
  assert.equal(roughInterval(90), "~3 meseca");
  assert.equal(roughInterval(200), "~7 meseci");
  assert.match(suggestionReason(a("X", "overdue", { daysUntilExpected: -12 })), /^prošao uobičajeni termin pre 12 dana \(obično na ~4 nedelje\)\.$/);
  assert.match(suggestionReason(a("X", "dormant", { daysSinceLastPurchase: 200 })), /ranije redovno .* bez kupovine 200 dana/);
  assert.match(suggestionReason(a("P", "provisional", { eventCount: 2, daysUntilExpected: 0 })), /^Samo dve kupovine — /);
  for (const st of ["due", "due_soon", "overdue", "dormant"]) {
    assert.doesNotMatch(suggestionReason(a("X", st, { daysUntilExpected: 3 })), /treba mu|potrebno mu je|ponestaje/);
  }
});

test("dosadašnji redosled ostaje dostupan za poređenje i ne menja ulaz", () => {
  const list = [
    a("DUE", "due", { daysUntilExpected: 2 }),
    a("OLD", "dormant", { eventCount: 20, daysSinceLastPurchase: 1200, confidence: "low" }),
    a("LATE", "overdue", { daysUntilExpected: -90 }),
    a("P", "provisional", { eventCount: 2, confidence: "low" }),
  ];
  const snapshot = JSON.stringify(list);
  const legacy = legacySuggestions(list);
  // Stari: ranije redovno (i davno), pa najveće kašnjenje, pa rok; bez dve kupovine.
  assert.deepEqual(legacy.main.map((x) => x.articleCode), ["OLD", "LATE", "DUE"]);
  assert.deepEqual(legacy.weak, []);
  // R1 nad istim ulazom: davno prestao ispada, rok „sada" ide ispred dugog kašnjenja.
  assert.deepEqual(rankSuggestions(list).main.map((x) => x.articleCode), ["DUE", "LATE"]);
  assert.equal(JSON.stringify(list), snapshot, "rangiranje ne sme menjati artikle (status, pouzdanost)");
  assert.equal(RANKING_VERSION, "r1_eksperiment");
});
