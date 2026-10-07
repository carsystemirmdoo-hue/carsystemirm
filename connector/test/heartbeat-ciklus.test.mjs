import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { beogradskiTrenutak, isoBeograd, sledeciOkidacSaRadom, sledeciTerminRadnoVreme } from "../src/schedule.mjs";

/**
 * Najava sledećeg ciklusa (heartbeat 0.3.9) — Europe/Belgrade, okidači u HH:02,
 * radni dani i praznici. Portal po ovoj najavi prepoznaje računar koji ne radi,
 * pa najava mora biti STVARAN okidač na kome će ciklus raditi.
 */
const c = { od: "08:00", do: "19:00", svakihMinuta: 60 };
const t = (s) => new Date(s);
const sledeci = (now, poslednji) =>
  isoBeograd(sledeciOkidacSaRadom({ now: t(now), ciklus: c, poslednjiCiklusVreme: poslednji }));

test("posle ručnog pokretanja u 11:32 okidač u 12:02 se preskače — najava je 13:02", () => {
  assert.equal(sledeci("2026-10-07T11:40:00+02:00", "2026-10-07T11:32:35+02:00"), "2026-10-07T13:02:00+02:00");
  // Prikaz u statusu je isti okidač (ranije je pisalo 12:32, kada okidača nema).
  assert.equal(
    sledeciTerminRadnoVreme({ now: t("2026-10-07T11:40:00+02:00"), ciklus: c, poslednjiCiklusVreme: "2026-10-07T11:32:35+02:00" }),
    "2026-10-07 13:02",
  );
});

test("redovan rad: posle 13:02 sledi 14:02; posle 19:02 petkom sledi ponedeljak 08:02", () => {
  assert.equal(sledeci("2026-10-07T13:05:00+02:00", "2026-10-07T13:02:01+02:00"), "2026-10-07T14:02:00+02:00");
  assert.equal(sledeci("2026-10-09T19:10:00+02:00", "2026-10-09T19:02:00+02:00"), "2026-10-12T08:02:00+02:00");
});

test("praznik se preskače (Dan primirja, 11. novembar 2026, sreda)", () => {
  assert.equal(sledeci("2026-11-10T19:30:00+01:00", "2026-11-10T19:02:00+01:00"), "2026-11-12T08:02:00+01:00");
});

test("prelaz na zimsko vreme menja pomak, ne zidni sat", () => {
  assert.equal(isoBeograd(beogradskiTrenutak("2026-10-23", 8, 2)), "2026-10-23T08:02:00+02:00");
  assert.equal(isoBeograd(beogradskiTrenutak("2026-10-26", 8, 2)), "2026-10-26T08:02:00+01:00");
});

test("bez satnog rasporeda nema najave", () => {
  assert.equal(sledeciOkidacSaRadom({ now: new Date(), ciklus: null }), null);
});

test("heartbeat posle ciklusa: posle brave i upisa, bez bacanja, bez imena fajlova", () => {
  const izvor = readFileSync(new URL("../src/cli.mjs", import.meta.url), "utf8");
  const fn = izvor.slice(izvor.indexOf("async function ciklus("), izvor.indexOf("function brojIli0"));
  // Redosled u finally: brava se oslobađa PRE heartbeat-a, store se zatvara posle.
  const fin = fn.slice(fn.lastIndexOf("} finally {"));
  assert.ok(fin.indexOf("otpustiZakljucavanje") < fin.indexOf("javiCiklus"), "heartbeat pre oslobađanja brave");
  assert.ok(fin.indexOf("javiCiklus") < fin.indexOf("store.zatvori"));
  const javi = izvor.slice(izvor.indexOf("async function javiCiklus"), izvor.indexOf("async function javiCiklus") + 2500);
  assert.match(javi, /catch \(greska\)/, "heartbeat mora hvatati sopstvene greške");
  assert.doesNotMatch(javi, /zavrsi\(|oznaciSalje|vratiUSpremno|postaviMetu/, "heartbeat ne sme menjati red");
  assert.doesNotMatch(javi, /putanja:\s*s|izvorniFolder|fileName|putanj[ae]\b(?!:)/, "heartbeat ne šalje putanje");
});
