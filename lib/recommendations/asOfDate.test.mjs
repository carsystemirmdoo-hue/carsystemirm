import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultAsOfDate, parseAsOfDate } from "./asOfDate.mjs";
import { belgradeDate } from "./customerRhythm.mjs";

const TODAY = "2026-10-02";

test("prvi obračun: „Na dan“ je današnji dan, posle toga dan poslednjeg obračuna", () => {
  assert.equal(defaultAsOfDate(null, TODAY), TODAY);
  assert.equal(defaultAsOfDate(undefined, TODAY), TODAY);
  assert.equal(defaultAsOfDate("", TODAY), TODAY);
  assert.equal(defaultAsOfDate("2026-09-15", TODAY), "2026-09-15");
});

test("današnji dan je po vremenskoj zoni aplikacije, ne po UTC", () => {
  // 22:30 UTC 1. oktobra je već 2. oktobar u Beogradu (UTC+2).
  assert.equal(belgradeDate(new Date("2026-10-01T22:30:00Z")), "2026-10-02");
  // 23:30 UTC 31. decembra je 1. januar u Beogradu (UTC+1).
  assert.equal(belgradeDate(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
});

test("prazan ili neispravan unos daje jasnu poruku", () => {
  assert.deepEqual(parseAsOfDate("", TODAY), { ok: false, error: "Unesite datum u polje „Na dan“." });
  assert.deepEqual(parseAsOfDate("   ", TODAY), { ok: false, error: "Unesite datum u polje „Na dan“." });
  assert.deepEqual(parseAsOfDate(null, TODAY), { ok: false, error: "Unesite datum u polje „Na dan“." });
  assert.equal(parseAsOfDate("2.10.2026", TODAY).ok, false);
  assert.match(/** @type {any} */ (parseAsOfDate("2.10.2026", TODAY)).error, /GGGG-MM-DD/);
  assert.match(/** @type {any} */ (parseAsOfDate("2026-02-30", TODAY)).error, /ne postoji/);
  assert.match(/** @type {any} */ (parseAsOfDate("2026-10-03", TODAY)).error, /posle današnjeg/);
});

test("promenjen datum se prihvata", () => {
  assert.deepEqual(parseAsOfDate("2026-10-02", TODAY), { ok: true, asOfDate: "2026-10-02" });
  assert.deepEqual(parseAsOfDate(" 2025-01-31 ", TODAY), { ok: true, asOfDate: "2025-01-31" });
});

test("forma ne blokira slanje tiho; stranica puni današnji dan", () => {
  // Regresija: `required` na praznom polju je zaustavljao slanje bez poruke.
  const form = readFileSync(new URL("../../features/portal/RecomputeRecommendations.tsx", import.meta.url), "utf8");
  assert.match(form, /<form[^>]*noValidate/);
  assert.doesNotMatch(form, /\brequired\b/);
  // Kontrolisano polje: posle slanja ostaje poslata vrednost, ne podrazumevana.
  assert.match(form, /value=\{asOfDate\}/);
  const page = readFileSync(new URL("../../app/portal/preporuke/page.tsx", import.meta.url), "utf8");
  assert.match(page, /defaultAsOfDate\(run\?\.asOfDate, belgradeDate\(new Date\(\)\)\)/);
  assert.doesNotMatch(page, /run\?\.asOfDate \?\? ""/);
  const action = readFileSync(new URL("../../app/portal/preporuke/actions.ts", import.meta.url), "utf8");
  assert.match(action, /parseAsOfDate\(formData\.get\("asOfDate"\), belgradeDate\(new Date\(\)\)\)/);
});
