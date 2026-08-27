import assert from "node:assert/strict";
import test from "node:test";
import {
  describeTarget,
  evaluateTestTarget,
  fingerprint,
  SAFETY_MESSAGES,
} from "./safety.mjs";

/**
 * Sigurnosna kapija je jedini deo integracionog harnessa koji MORA biti tacan i
 * pre nego sto postoji baza. Zato je cista funkcija i zato se testira ovde,
 * uz ostale testove koji ne traze PostgreSQL.
 */

const PROD = "postgres://u:p@db.example.com:5432/carsystem";
const TEST = "postgres://u:p@db.example.com:5432/carsystem_test";

test("otisak ne otkriva vrednost", () => {
  const print = fingerprint(PROD);
  assert.equal(print.length, 12);
  assert.ok(!print.includes("carsystem"));
  assert.ok(!print.includes("example"));
  // Ista vrednost daje isti otisak; razlicita razlicit.
  assert.equal(fingerprint(PROD), fingerprint(PROD));
  assert.notEqual(fingerprint(PROD), fingerprint(TEST));
});

test("opis mete izostavlja korisnika, lozinku i parametre", () => {
  const t = describeTarget("postgres://tajni_korisnik:tajna@host.test:5432/qa_baza?sslmode=require");
  assert.deepEqual(t, { host: "host.test", port: "5432", database: "qa_baza" });
  const flat = JSON.stringify(t);
  assert.ok(!flat.includes("tajni_korisnik"));
  assert.ok(!flat.includes("tajna"));
  assert.ok(!flat.includes("sslmode"));
});

test("nedostajuca promenljiva se odbija, ne pretpostavlja", () => {
  const r = evaluateTestTarget({ testUrl: undefined });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "missing");
});

test("ista baza kao DATABASE_URL se odbija", () => {
  const r = evaluateTestTarget({ testUrl: PROD, databaseUrl: PROD });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "same-as-database-url");
  // Poruka ne sme nositi vrednost.
  assert.equal(r.target, null);
});

test("ista baza kao MIGRATION_DATABASE_URL se odbija", () => {
  const r = evaluateTestTarget({ testUrl: TEST, migrationUrl: TEST });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "same-as-migration-url");
});

test("produkcijsko okruzenje ne pokrece testove koji pisu", () => {
  const r = evaluateTestTarget({ testUrl: TEST, vercelEnv: "production" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "production-environment");
});

test("oznaka produkcije u imenu obara metu", () => {
  for (const url of [
    "postgres://u:p@prod-db.example.com/carsystem_test",
    "postgres://u:p@host/carsystem_production",
    "postgres://u:p@host/live_qa",
  ]) {
    const r = evaluateTestTarget({ testUrl: url });
    assert.equal(r.ok, false, url);
    assert.equal(r.reason, "production-marker");
  }
});

test("baza bez oznake odvojenosti se odbija", () => {
  const r = evaluateTestTarget({ testUrl: "postgres://u:p@host.example.com/carsystem" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no-test-marker");
});

test("namenska test baza prolazi", () => {
  for (const url of [
    "postgres://u:p@host/carsystem_test",
    "postgres://u:p@qa-branch.neon.tech/neondb",
    "postgres://u:p@host/staging",
    "postgres://u:p@host/carsystem_sandbox",
  ]) {
    const r = evaluateTestTarget({ testUrl: url, databaseUrl: PROD, migrationUrl: PROD });
    assert.equal(r.ok, true, `odbijeno: ${url}`);
    assert.equal(r.reason, null);
    assert.ok(r.target.host.length > 0);
  }
});

test("redosled provera: identitet pre imena", () => {
  // Baza sa ispravnim imenom, ali istim otiskom kao produkcija, mora pasti na
  // identitetu — ime ne sme da je spase.
  const r = evaluateTestTarget({ testUrl: TEST, databaseUrl: TEST });
  assert.equal(r.reason, "same-as-database-url");
});

test("spojnica (pooler) se odbija za QA prolaz", () => {
  // Spojnica u „transaction" rezimu ne garantuje istu pozadinsku vezu za sve
  // naredbe jedne transakcije, pa advisory brava prestaje da serijalizuje —
  // tiho, bez greske. Za dokaz zakljucavanja treba direktna veza.
  for (const url of [
    "postgres://u:p@ep-abc-123-pooler.eu-central-1.aws.neon.tech/qa_1b_verify",
    "postgres://u:p@host.pooler.supabase.com/qa_test",
    "postgres://u:p@pgbouncer.internal/staging",
  ]) {
    const r = evaluateTestTarget({ testUrl: url });
    assert.equal(r.ok, false, `propusteno: ${url}`);
    assert.equal(r.reason, "pooled-connection-not-allowed");
    // Meta se i dalje opisuje, da poruka moze reci koji host je odbijen.
    assert.ok(r.target.host.length > 0);
  }
});

test("direktna veza ka istoj bazi prolazi", () => {
  const r = evaluateTestTarget({
    testUrl: "postgres://u:p@ep-abc-123.eu-central-1.aws.neon.tech/qa_1b_verify",
  });
  assert.equal(r.ok, true);
});

test("poruka o spojnici objasnjava sta da se uradi, bez vrednosti", () => {
  const poruka = SAFETY_MESSAGES["pooled-connection-not-allowed"];
  assert.match(poruka, /pooler/i);
  assert.match(poruka, /DIRECT/);
  // Zabrana vazi samo za QA; produkcija sme spojnicu.
  assert.match(poruka, /[Pp]rodukcijska aplikacija/);
});

test("redosled: spojnica se gleda posle oznake produkcije", () => {
  // Host koji je i produkcijski i pooled mora pasti kao produkcijski — to je
  // ozbiljniji razlog i mora se videti prvi.
  const r = evaluateTestTarget({
    testUrl: "postgres://u:p@prod-pooler.example.com/qa_test",
  });
  assert.equal(r.reason, "production-marker");
});
