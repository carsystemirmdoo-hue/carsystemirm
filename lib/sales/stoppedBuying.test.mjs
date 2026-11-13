import assert from "node:assert/strict";
import test from "node:test";
import { stoppedBuying } from "./stoppedBuying.mjs";

const today = "2026-11-13";

test("redovan artikal: prag je 2× uobičajen razmak", () => {
  // Kupovine na ~30 dana, poslednja pre 75 dana → prag 60 → prestao.
  const a = { code: "A", name: "Razređivač", dates: ["2026-05-01", "2026-05-31", "2026-06-30", "2026-07-30", "2026-08-30"] };
  const [r] = stoppedBuying([a], { today, from: null, to: null });
  assert.equal(r.usualIntervalDays, 30);
  assert.equal(r.thresholdDays, 60);
  assert.equal(r.daysSince, 75);
  // Ista istorija, ali poslednja kupovina pre 40 dana → nije prestao.
  const b = { ...a, dates: [...a.dates.slice(0, 4), "2026-10-04"] };
  assert.deepEqual(stoppedBuying([b], { today, from: null, to: null }), []);
});

test("jedna ili dve kupovine: prag 90 dana", () => {
  const two = { code: "B", name: null, dates: ["2026-06-01", "2026-07-01"] };
  const [r] = stoppedBuying([two], { today, from: null, to: null });
  assert.equal(r.usualIntervalDays, null);
  assert.equal(r.thresholdDays, 90);
  const recent = { code: "C", name: null, dates: ["2026-09-01"] };
  assert.deepEqual(stoppedBuying([recent], { today, from: null, to: null }), []);
});

test("nedeljni artikal ne iskače pre 30 dana", () => {
  const weekly = { code: "D", name: null, dates: ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-10-20"] };
  // razmak 7 → 2× = 14, ali najmanje 30; prošlo 24 dana → ne.
  assert.deepEqual(stoppedBuying([weekly], { today, from: null, to: null }), []);
});

test("samo artikli kupljeni u periodu; kupovina posle perioda se računa kao poslednja", () => {
  const outside = { code: "E", name: null, dates: ["2025-01-10", "2025-02-10"] };
  const later = { code: "F", name: null, dates: ["2026-01-10", "2026-11-01"] };
  const period = { today, from: "2026-01-01", to: "2026-03-31" };
  // E nije kupljen u periodu; F jeste, ali ga je kupac uzeo i 1. 11. → nije prestao.
  assert.deepEqual(stoppedBuying([outside, later], period), []);
});

test("redosled: najčešće kupovano prvo, pa najduže nekupljeno", () => {
  const x = { code: "X", name: null, dates: ["2026-01-01", "2026-02-01"] };
  const y = { code: "Y", name: null, dates: ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"] };
  const z = { code: "Z", name: null, dates: ["2025-12-01", "2026-01-05"], dismissed: true };
  const r = stoppedBuying([x, y, z], { today, from: null, to: null });
  assert.deepEqual(r.map((a) => a.code), ["Y", "Z", "X"]);
  assert.equal(r[1].dismissed, true);
});
