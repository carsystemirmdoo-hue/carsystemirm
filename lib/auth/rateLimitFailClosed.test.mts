import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { after } from "node:test";
import {
  __resetRateLimitLogStateForTests,
  isBucketBlocked,
  registerAttempt,
} from "@/lib/auth/rate-limit-service";

/**
 * `AUTH-02` — fail-closed ograničavanje pokušaja, STVARNO izvršavanje.
 *
 * `registerAttempt`/`isBucketBlocked` su `server-only` i normalno zavise od
 * baze (čitanje/upis brojača) — ali provera podešavanja stoji PRE ijednog
 * upita, pa se testovi ispod izvršavaju BEZ baze: kad je produkcija a ključ
 * neispravan, funkcija se nikad ne približi `getDb()`. To je i sama tvrdnja
 * koju poslednji test u ovom fajlu dokazuje — sa VALIDNIM ključem funkcija
 * MORA pokušati bazu (i tu propasti, jer je nema), za razliku od fail-closed
 * puta koji nikad ne baca izuzetak.
 *
 * Pokreće se preko `tsx` (ne plain `node --test`) zato što
 * `rate-limit-service.ts` uvozi `server-only` i `@/`-alias uvoze — isti
 * obrazac kao `db/integration/*.mts` (uklj. stub za `server-only`), samo bez
 * `TEST_DATABASE_URL` gate-a jer ova putanja bazu nikad ne dotiče.
 *
 * Čisto-funkcijski deo (`validateRateLimitConfiguration`, bez servisa) je u
 * `lib/auth/rateLimit.test.mjs`.
 */

const REAL_ENV = { ...process.env };
const RELEVANT_KEYS = ["VERCEL_ENV", "NODE_ENV", "AUTH_RATE_LIMIT_HMAC_KEY", "DATABASE_URL"];

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
const TOO_SHORT_KEY = randomBytes(8).toString("base64");

test("produkcija + ključ odsutan → registerAttempt ODBIJA, bez ijednog upita u bazu", async () => {
  setEnv({ VERCEL_ENV: "production" });
  const decision = await registerAttempt({
    scope: "password",
    accountIdentifier: "x@example.test",
    clientIp: "203.0.113.1",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.blockedBy, null);
  assert.ok(decision.retryAfterSeconds > 0, "retryAfterSeconds mora biti pozitivan");
});

test("produkcija + prazan ključ → registerAttempt ODBIJA", async () => {
  setEnv({ VERCEL_ENV: "production", AUTH_RATE_LIMIT_HMAC_KEY: "" });
  const decision = await registerAttempt({
    scope: "password",
    accountIdentifier: "x@example.test",
    clientIp: null,
  });
  assert.equal(decision.allowed, false);
});

test("produkcija + whitespace-only ključ → registerAttempt ODBIJA", async () => {
  setEnv({ VERCEL_ENV: "production", AUTH_RATE_LIMIT_HMAC_KEY: "   \n\t  " });
  const decision = await registerAttempt({
    scope: "totp",
    accountIdentifier: "x@example.test",
    clientIp: null,
  });
  assert.equal(decision.allowed, false);
});

test("produkcija + preslab ključ (< 32 bajta) → registerAttempt ODBIJA", async () => {
  setEnv({ VERCEL_ENV: "production", AUTH_RATE_LIMIT_HMAC_KEY: TOO_SHORT_KEY });
  const decision = await registerAttempt({
    scope: "reset",
    accountIdentifier: "x@example.test",
    clientIp: "203.0.113.9",
  });
  assert.equal(decision.allowed, false);
});

test("isBucketBlocked je fail-closed (true) pod istim uslovima — nikad „nastavi\"", async () => {
  /*
   * Ovo je smer koji najlakše promaši: `isBucketBlocked` postoji da bi se
   * preskočio skup posao KADA JE odluka već pala. `false` ovde bi značilo
   * „nastavi", tačno suprotno od namere.
   */
  setEnv({ VERCEL_ENV: "production" });
  const blocked = await isBucketBlocked({
    scope: "password",
    accountIdentifier: "x@example.test",
    clientIp: null,
  });
  assert.equal(blocked, true);
});

test("greška podešavanja NIKAD ne vraća allowed:true, ni za jedan od četiri neispravna oblika ključa", async () => {
  for (const [opis, kljuc] of [
    ["odsutan", undefined],
    ["prazan", ""],
    ["whitespace", "  "],
    ["preslab", TOO_SHORT_KEY],
  ] as const) {
    setEnv({ VERCEL_ENV: "production", AUTH_RATE_LIMIT_HMAC_KEY: kljuc });
    const decision = await registerAttempt({
      scope: "password",
      accountIdentifier: "a@b.test",
      clientIp: "203.0.113.5",
    });
    assert.equal(decision.allowed, false, `ključ ${opis} je propušten`);
  }
});

test("tajni ključ se ne pojavljuje nigde u vraćenoj odluci", async () => {
  // Namerno kratko (dekodovano < 32 bajta) da ostane u fail-closed grani, a
  // ne slučajno preživi kao „dovoljno dugačak" base64 i pokuša bazu.
  const izgledaKaoTajna = Buffer.from("ovo ne sme da se vidi u odluci").toString("base64");
  setEnv({ VERCEL_ENV: "production", AUTH_RATE_LIMIT_HMAC_KEY: izgledaKaoTajna });
  const decision = await registerAttempt({
    scope: "password",
    accountIdentifier: "x@example.test",
    clientIp: null,
  });
  assert.equal(decision.allowed, false);
  assert.ok(!JSON.stringify(decision).includes(izgledaKaoTajna));
});

test("van produkcije, isti nedostajući ključ ostaje ALLOWED — postojeće ponašanje očuvano", async () => {
  setEnv({ NODE_ENV: "test" });
  const decision = await registerAttempt({
    scope: "password",
    accountIdentifier: "x@example.test",
    clientIp: null,
  });
  assert.equal(decision.allowed, true);
});

test("VERCEL_ENV=production nadjačava lokalno NODE_ENV=development — dev bypass se ne aktivira slučajno", async () => {
  setEnv({ VERCEL_ENV: "production", NODE_ENV: "development" });
  const decision = await registerAttempt({
    scope: "password",
    accountIdentifier: "x@example.test",
    clientIp: null,
  });
  assert.equal(decision.allowed, false);
});

/* =========================================================================
 * Korektivna revizija — Vercel Preview je udaljen deployment, ne "development"
 *
 * `resolveRuntimeEnvironment` (MFA) svesno mapira `VERCEL_ENV=preview` na
 * "development". Pre korekcije, `validateRateLimitConfiguration` je tu istu
 * funkciju ponovo koristila — pa je Preview bez ključa tiho prošao kao
 * fail-open. Testovi ispod dokazuju STVARNIM izvršavanjem da je ta praznina
 * zatvorena, preko sopstvene `requiresRateLimitSecret` funkcije.
 * ====================================================================== */

test("preview + ključ odsutan → registerAttempt ODBIJA (KORIGOVANA praznina)", async () => {
  setEnv({ VERCEL_ENV: "preview" });
  const decision = await registerAttempt({
    scope: "password",
    accountIdentifier: "x@example.test",
    clientIp: "203.0.113.1",
  });
  assert.equal(decision.allowed, false);
});

test("preview + prazan/preslab ključ → registerAttempt ODBIJA", async () => {
  for (const kljuc of ["", TOO_SHORT_KEY]) {
    setEnv({ VERCEL_ENV: "preview", AUTH_RATE_LIMIT_HMAC_KEY: kljuc });
    const decision = await registerAttempt({
      scope: "password",
      accountIdentifier: "x@example.test",
      clientIp: null,
    });
    assert.equal(decision.allowed, false, `preview sa ključem ${JSON.stringify(kljuc)} je propušten`);
  }
});

test("preview + VALIDAN ključ → normalan tok (pokušava bazu, ne fail-closed)", async () => {
  setEnv({ VERCEL_ENV: "preview", AUTH_RATE_LIMIT_HMAC_KEY: VALID_KEY });
  await assert.rejects(
    () =>
      registerAttempt({
        scope: "password",
        accountIdentifier: "x@example.test",
        clientIp: "203.0.113.1",
      }),
    /DATABASE_URL/,
    "preview sa validnim ključem mora pokušati bazu, ne vratiti fail-closed odluku",
  );
});

test("VERCEL_ENV=preview nadjačava lokalno NODE_ENV=development — dev bypass se ne aktivira slučajno", async () => {
  setEnv({ VERCEL_ENV: "preview", NODE_ENV: "development" });
  const decision = await registerAttempt({
    scope: "password",
    accountIdentifier: "x@example.test",
    clientIp: null,
  });
  assert.equal(decision.allowed, false);
});

test("nepoznata neprazna VERCEL_ENV vrednost je konzervativno fail-closed", async () => {
  setEnv({ VERCEL_ENV: "staging-nepoznato" });
  const decision = await registerAttempt({
    scope: "password",
    accountIdentifier: "x@example.test",
    clientIp: null,
  });
  assert.equal(decision.allowed, false);
});

/* =========================================================================
 * Log-flood — jedan bezbedan signal po procesu, ne po zahtevu
 * ====================================================================== */

test("hiljadu ponovljenih pogrešno konfigurisanih zahteva: svaki odbijen, upozorenje ISPISANO NAJVIŠE JEDNOM", async (t) => {
  __resetRateLimitLogStateForTests();
  const spy = t.mock.method(console, "error", () => {});

  setEnv({ VERCEL_ENV: "production" });
  const BROJ_ZAHTEVA = 1000;
  const odluke = [];
  for (let i = 0; i < BROJ_ZAHTEVA; i += 1) {
    odluke.push(
      await registerAttempt({
        scope: "password",
        accountIdentifier: `napadac-${i}@example.test`,
        clientIp: "203.0.113.66",
      }),
    );
  }

  assert.ok(
    odluke.every((d) => d.allowed === false),
    "svaki od 1000 zahteva mora biti odbijen — dedup log ne sme oslabiti odluku",
  );
  assert.equal(spy.mock.callCount(), 1, `console.error pozvan ${spy.mock.callCount()} puta umesto tačno jednom`);

  const [poziv] = spy.mock.calls;
  const poruka = String(poziv.arguments[0]);
  assert.ok(!poruka.includes("napadac-"), "log sadrži identifikator naloga");
  assert.ok(!poruka.includes("203.0.113.66"), "log sadrži IP adresu");

  spy.mock.restore();
});

test("__resetRateLimitLogStateForTests ne zahteva produkcionu tajnu — čisto lokalni reset", () => {
  // Sama činjenica da je pozivljiva bez ijedne env promenljive dokazuje da ne
  // dotiče konfiguraciju — samo lokalnu modulsku zastavicu.
  assert.doesNotThrow(() => __resetRateLimitLogStateForTests());
});

test("produkcija + VALIDAN ključ → NE fail-closed; nastavlja ka bazi (ovde propada jer baze nema)", async () => {
  /*
   * Ovo je negativni dokaz koji zatvara priču: sa validnim ključem funkcija
   * MORA pokušati stvaran upit — što se ovde vidi kao `DATABASE_URL nije
   * podešen` (getDb() u db/client.ts), NE kao kontrolisana `{allowed:false}`
   * odluka. Razlika u OBLIKU neuspeha (baca izuzetak vs. vraća odluku) je
   * dokaz da je normalan tok STVARNO dostignut, a ne fail-closed grana.
   */
  setEnv({ VERCEL_ENV: "production", AUTH_RATE_LIMIT_HMAC_KEY: VALID_KEY });
  await assert.rejects(
    () =>
      registerAttempt({
        scope: "password",
        accountIdentifier: "x@example.test",
        clientIp: "203.0.113.1",
      }),
    /DATABASE_URL/,
    "sa validnim ključem mora pokušati bazu, ne vratiti kontrolisanu fail-closed odluku",
  );
});
