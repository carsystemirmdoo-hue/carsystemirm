import assert from "node:assert/strict";
import test from "node:test";
import { compareByCustomer, customerSegmentAt, evaluateCut, monthlyCuts } from "./rankingBacktest.mjs";
import { legacySuggestions, rankSuggestions } from "./suggestionRanking.mjs";

const rules = { R0: (r) => legacySuggestions(r).main, R1: (r) => rankSuggestions(r).main };
const every = (article, from, step, n) =>
  Array.from({ length: n }, (_, i) => ({ article, date: new Date(Date.parse(from) + i * step * 864e5).toISOString().slice(0, 10) }));

test("presek ne vidi budućnost: izbor je isti bez obzira na kupovine posle preseka", () => {
  const past = every("A", "2025-01-01", 30, 10);
  // Poslednja kupovina A je 28. 9.; na dan 25. 10. A je u roku.
  const withFuture = [...past, ...every("A", "2025-11-01", 30, 3), ...every("Z", "2025-10-26", 5, 6)];
  const opts = { horizonDays: 45, limit: 5, rules };
  const a = evaluateCut(past, "2025-10-25", opts);
  const b = evaluateCut(withFuture, "2025-10-25", opts);
  assert.equal(a.perRule.R1.n, 1);
  assert.equal(a.perRule.R1.n, b.perRule.R1.n);
  assert.equal(a.segment, b.segment);
  assert.equal(a.perRule.R1.hits, 0);
  assert.equal(b.perRule.R1.hits, 1, "kupovina A posle preseka je pogodak");
});

test("storno: kupovina važi u istoriji do dana storna i nikad nije pogodak", () => {
  const ev = [...every("A", "2025-01-01", 30, 10).slice(0, 9), { article: "A", date: "2025-09-28", revokedOn: "2025-10-20" }];
  const opts = { horizonDays: 45, limit: 5, rules };
  const before = evaluateCut(ev, "2025-10-10", opts);
  const after = evaluateCut(ev, "2025-10-25", opts);
  assert.ok(before && after);
  // Pre storna: poslednja kupovina 28. 9.; posle storna: istorija bez nje.
  const futureStorno = [...every("A", "2025-01-01", 30, 9), { article: "A", date: "2025-10-30", revokedOn: "2025-11-05" }];
  assert.equal(evaluateCut(futureStorno, "2025-10-01", opts).perRule.R1.hits, 0, "stornirana kupovina nije pogodak");
});

test("grupe kupca na dan preseka", () => {
  assert.equal(customerSegmentAt(["2025-09-01"], "2025-10-01"), "novi");
  assert.equal(customerSegmentAt(["2023-01-05", "2024-01-05"], "2025-10-01"), "neaktivan");
  const monthly = Array.from({ length: 30 }, (_, i) => `${2023 + Math.floor((i + 3) / 12)}-${String(((i + 3) % 12) + 1).padStart(2, "0")}-10`).filter((d) => d <= "2025-09-30").sort();
  assert.equal(customerSegmentAt(monthly, "2025-10-01"), "redovan");
  const spring = ["2023-03-05", "2023-03-20", "2023-04-10", "2023-05-02", "2024-03-03", "2024-03-25", "2024-04-14", "2024-05-06", "2025-03-04", "2025-04-09", "2025-05-12", "2025-08-01"];
  assert.equal(customerSegmentAt(spring, "2025-10-01"), "sezonski");
  assert.equal(customerSegmentAt(["2024-01-10", "2024-08-10", "2025-02-10", "2025-07-10"], "2025-10-01"), "povremen");
});

test("mesečni preseci staju pre kraja podataka umanjenog za horizont", () => {
  assert.deepEqual(monthlyCuts("2025-01-15", "2025-05-20", 45), ["2025-01-01", "2025-02-01", "2025-03-01", "2025-04-01"]);
});

test("zbir je makro po kupcu: veliki kupac ne prekriva malog", () => {
  const cut = (aHits, bHits) => ({ perRule: { R0: { n: 5, hits: aHits }, R1: { n: 5, hits: bHits } } });
  const records = [
    ...Array.from({ length: 50 }, () => ({ customer: "VELIKI", cut: cut(1, 4) })),
    ...Array.from({ length: 4 }, () => ({ customer: "MALI", cut: cut(3, 1) })),
  ];
  const s = compareByCustomer(records, "R0", "R1").sve;
  assert.equal(s.kupacaUporedivo, 2);
  assert.equal(s.bolje, 1);
  assert.equal(s.gore, 1, "pogoršanje kod malog kupca mora biti vidljivo");
  assert.ok(Math.abs(s.R1.prosek - (0.8 + 0.2) / 2) < 1e-9);
});

test("prosek po kupcu: po preseku ili zbirno — presek sa manje od pet predloga", () => {
  const records = [
    { customer: "K", cut: { perRule: { R0: { n: 5, hits: 1 }, R1: { n: 1, hits: 1 } } } },
    { customer: "K", cut: { perRule: { R0: { n: 5, hits: 1 }, R1: { n: 5, hits: 0 } } } },
    { customer: "K", cut: { perRule: { R0: { n: 5, hits: 1 }, R1: { n: 5, hits: 0 } } } },
  ];
  // Po preseku: (1/1 + 0 + 0) / 3; zbirno: 1 / 11.
  assert.ok(Math.abs(compareByCustomer(records, "R0", "R1").sve.R1.prosek - 1 / 3) < 1e-9);
  assert.ok(Math.abs(compareByCustomer(records, "R0", "R1", undefined, 3, "pooled").sve.R1.prosek - 1 / 11) < 1e-9);
});

test("svaki presek ima pun budući prozor do poslednjeg potpunog dana", () => {
  for (const h of [30, 45, 60]) {
    const cuts = monthlyCuts("2022-01-01", "2026-09-30", h);
    const last = cuts[cuts.length - 1];
    assert.ok(Date.parse(last) + h * 864e5 <= Date.parse("2026-09-30"), `H=${h}: ${last}`);
  }
});
