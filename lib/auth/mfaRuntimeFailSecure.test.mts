import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { after } from "node:test";
import { __resetMfaAnnouncementForTests, resolveMfaRuntime } from "@/auth";

/**
 * `AUTH-03` — MFA fail-secure na udaljenom deployment-u, STVARNO izvršavanje.
 *
 * `resolveMfaRuntime` (auth.ts) je jedina funkcija koja spaja
 * `resolveMfaMode` + `validateMfaConfiguration` + jednokratnu najavu režima
 * u log — tačno ono što `authorize()` poziva pri svakoj prijavi. Testira se
 * ovde direktno (bez NextAuth `authorize` callback-a, koji traži pravu
 * sesiju/kolačić) jer sama funkcija nema tu zavisnost — čita isključivo
 * `process.env`.
 *
 * Pokreće se preko `tsx` (ne plain `node --test`) zato što `auth.ts` uvozi
 * `server-only`-tagovane module i `@/`-alias uvoze — isti obrazac kao
 * `lib/auth/rateLimitFailClosed.test.mts` (AUTH-02).
 *
 * Čisto-funkcijski deo (`resolveMfaMode`/`validateMfaConfiguration`, cela
 * environment matrica) je u `lib/auth/mfaPolicy.test.mjs`. Postojeća
 * kripto-svojstva (rotacija, prekratak ključ, neuspela dekripcija) su već
 * pokrivena u `lib/auth/mfaCore.test.mjs` — ovde se ne ponavljaju.
 */

const REAL_ENV = { ...process.env };
const RELEVANT_KEYS = [
  "VERCEL_ENV",
  "NODE_ENV",
  "PORTAL_MFA_MODE",
  "PORTAL_MFA_ENFORCEMENT",
  "PORTAL_MFA_MASTER_KEY_V1",
  "PORTAL_MFA_ACTIVE_KEY_VERSION",
];

function setEnv(overrides: Record<string, string | undefined>) {
  for (const key of RELEVANT_KEYS) {
    const value = key in overrides ? overrides[key] : undefined;
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

after(() => {
  for (const key of RELEVANT_KEYS) {
    if (REAL_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = REAL_ENV[key];
  }
});

const VALID_KEY = randomBytes(32).toString("base64");

test("preview bez PORTAL_MFA_MODE i bez ključa → configuration.ok je false (fail-secure)", () => {
  __resetMfaAnnouncementForTests();
  setEnv({ VERCEL_ENV: "preview" });
  const runtime = resolveMfaRuntime();
  assert.equal(runtime.mode, "enforced");
  assert.equal(runtime.configuration.ok, false);
});

test("preview + eksplicitni PORTAL_MFA_MODE=off + validan ključ → i dalje configuration.ok je false", () => {
  __resetMfaAnnouncementForTests();
  setEnv({ VERCEL_ENV: "preview", PORTAL_MFA_MODE: "off", PORTAL_MFA_MASTER_KEY_V1: VALID_KEY });
  const runtime = resolveMfaRuntime();
  assert.equal(runtime.offRejectedOnRemoteDeployment, true);
  assert.equal(runtime.configuration.ok, false);
});

test("preview + PORTAL_MFA_MODE=enforced + validan ključ → configuration.ok je true (normalan rad)", () => {
  __resetMfaAnnouncementForTests();
  setEnv({ VERCEL_ENV: "preview", PORTAL_MFA_MODE: "enforced", PORTAL_MFA_MASTER_KEY_V1: VALID_KEY });
  const runtime = resolveMfaRuntime();
  assert.equal(runtime.configuration.ok, true);
});

test("lokalni development bez ključa ostaje configuration.ok:true — postojeće ponašanje očuvano", () => {
  __resetMfaAnnouncementForTests();
  setEnv({ NODE_ENV: "development" });
  const runtime = resolveMfaRuntime();
  assert.equal(runtime.mode, "off");
  assert.equal(runtime.configuration.ok, true);
});

test("hiljadu ponovljenih poziva sa neispravnom konfiguracijom na Preview: svaki ok:false, upozorenje NAJVIŠE JEDNOM po procesu", async (t) => {
  __resetMfaAnnouncementForTests();
  const spy = t.mock.method(console, "warn", () => {});
  const infoSpy = t.mock.method(console, "info", () => {});

  setEnv({ VERCEL_ENV: "preview" });
  const BROJ_POZIVA = 1000;
  const rezultati = [];
  for (let i = 0; i < BROJ_POZIVA; i += 1) {
    rezultati.push(resolveMfaRuntime());
  }

  assert.ok(
    rezultati.every((r) => r.configuration.ok === false),
    "svaki od 1000 poziva mora ostati fail-secure — dedup log ne sme oslabiti odluku",
  );
  assert.equal(spy.mock.callCount(), 1, `console.warn pozvan ${spy.mock.callCount()} puta umesto tačno jednom`);
  assert.equal(infoSpy.mock.callCount(), 0, "console.info se ne poziva kad je konfiguracija upozorenje, ne info");

  const [poziv] = spy.mock.calls;
  const poruka = String(poziv.arguments[0]);
  assert.ok(!poruka.includes("MASTER_KEY"), "log pominje naziv ključa van dozvoljenog opisa režima");

  spy.mock.restore();
  infoSpy.mock.restore();
});

test("__resetMfaAnnouncementForTests ne zahteva produkcionu tajnu — čisto lokalni reset", () => {
  assert.doesNotThrow(() => __resetMfaAnnouncementForTests());
});
