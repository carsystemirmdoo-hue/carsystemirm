import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateRateLimit,
  isCredentialAttemptPath,
  isTrustedProxyEnvironment,
  policyFor,
  RATE_LIMIT_POLICY,
  RATE_LIMIT_SCOPES,
  resolveClientIp,
} from "./rate-limit-policy.mjs";
import {
  isRateLimitConfigured,
  rateLimitSubjectKey,
  RateLimitKeyMissingError,
  RATE_LIMIT_KEY_ENV,
  requiresRateLimitSecret,
  validateRateLimitConfiguration,
} from "./rate-limit-key.mjs";

const env = () => ({ [RATE_LIMIT_KEY_ENV]: randomBytes(32).toString("base64") });
const headers = (map) => ({ get: (name) => map[name.toLowerCase()] ?? null });

/* =========================================================================
 * Politika
 * ====================================================================== */

test("svaki opseg ima nezavisne pragove za nalog i adresu", () => {
  for (const scope of RATE_LIMIT_SCOPES) {
    const account = policyFor(scope, "account");
    const ip = policyFor(scope, "ip");
    assert.ok(account.limit > 0 && ip.limit > 0, scope);
    // Adresa uvek trpi više od pojedinačnog naloga — iza jedne adrese sedi
    // cela kancelarija, iza naloga jedan čovek.
    assert.ok(ip.limit >= account.limit, `${scope}: prag po adresi je preuzak`);
  }
});

test("TOTP je strozi od lozinke", () => {
  assert.ok(
    RATE_LIMIT_POLICY.totp.account.limit < RATE_LIMIT_POLICY.password.account.limit,
    "sestocifren kod trpi grubu silu i mora imati manje pokusaja",
  );
});

test("blokada je privremena, nikad trajna", () => {
  for (const scope of RATE_LIMIT_SCOPES) {
    for (const dimension of ["account", "ip"]) {
      const policy = policyFor(scope, dimension);
      assert.ok(
        policy.blockMs > 0 && Number.isFinite(policy.blockMs),
        `${scope}/${dimension}: trajna blokada dozvoljava napadacu da zakljuca tudji nalog`,
      );
      assert.ok(policy.blockMs <= 60 * 60_000, `${scope}/${dimension}: blokada duza od sata`);
    }
  }
});

test("brojac raste do praga, pa blokira", () => {
  const policy = { limit: 3, windowMs: 60_000, blockMs: 300_000 };
  const now = new Date("2026-08-24T10:00:00Z");
  let state = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const outcome = evaluateRateLimit(state, policy, now);
    assert.equal(outcome.allowed, true, `pokusaj ${attempt} je odbijen prerano`);
    state = { attempts: outcome.nextAttempts, windowStartedAt: now, blockedUntil: null };
  }

  const blocked = evaluateRateLimit(state, policy, now);
  assert.equal(blocked.allowed, false, "cetvrti pokusaj je prosao");
  assert.equal(blocked.retryAfterSeconds, 300);
  assert.ok(blocked.blockUntil instanceof Date);
});

test("blokada istice i brojac krece iznova", () => {
  const policy = { limit: 3, windowMs: 60_000, blockMs: 300_000 };
  const blockedAt = new Date("2026-08-24T10:00:00Z");
  const state = {
    attempts: 4,
    windowStartedAt: blockedAt,
    blockedUntil: new Date(blockedAt.getTime() + policy.blockMs),
  };

  // Dok traje — odbijeno, sa opadajućim `Retry-After`.
  const during = evaluateRateLimit(state, policy, new Date(blockedAt.getTime() + 60_000));
  assert.equal(during.allowed, false);
  assert.equal(during.retryAfterSeconds, 240);

  // Posle isteka — prolazi, i prozor se resetuje.
  const after = evaluateRateLimit(state, policy, new Date(blockedAt.getTime() + 301_000));
  assert.equal(after.allowed, true);
  assert.equal(after.resetWindow, true);
  assert.equal(after.nextAttempts, 1);
});

test("pokusaji tokom blokade ne produzavaju blokadu", () => {
  const policy = { limit: 3, windowMs: 60_000, blockMs: 300_000 };
  const start = new Date("2026-08-24T10:00:00Z");
  const blockedUntil = new Date(start.getTime() + policy.blockMs);
  const state = { attempts: 4, windowStartedAt: start, blockedUntil };

  const first = evaluateRateLimit(state, policy, new Date(start.getTime() + 10_000));
  const later = evaluateRateLimit(state, policy, new Date(start.getTime() + 20_000));

  assert.equal(first.blockUntil.getTime(), blockedUntil.getTime());
  assert.equal(later.blockUntil.getTime(), blockedUntil.getTime());
  // Brojač ostaje isti — pokušaji tokom blokade se ne broje.
  assert.equal(later.nextAttempts, state.attempts);
});

test("istek prozora resetuje brojac i bez blokade", () => {
  const policy = { limit: 3, windowMs: 60_000, blockMs: 300_000 };
  const start = new Date("2026-08-24T10:00:00Z");
  const state = { attempts: 2, windowStartedAt: start, blockedUntil: null };

  const inside = evaluateRateLimit(state, policy, new Date(start.getTime() + 30_000));
  assert.equal(inside.nextAttempts, 3);
  assert.equal(inside.resetWindow, false);

  const outside = evaluateRateLimit(state, policy, new Date(start.getTime() + 61_000));
  assert.equal(outside.nextAttempts, 1);
  assert.equal(outside.resetWindow, true);
});

/* =========================================================================
 * Ključevi — pseudonimizacija
 * ====================================================================== */

test("kljuc ne sadrzi sirovu adresu ni e-postu", () => {
  const e = env();
  const ip = "203.0.113.42";
  const account = "kupac@primer.rs";

  const ipKey = rateLimitSubjectKey("ip", ip, e);
  const accountKey = rateLimitSubjectKey("account", account, e);

  assert.ok(!ipKey.includes(ip), "sirova IP adresa je u kljucu");
  assert.ok(!accountKey.includes(account), "sirova e-posta je u kljucu");
  assert.ok(!accountKey.includes("kupac"), "deo e-poste je u kljucu");
});

test("ista vrednost u dve dimenzije daje razlicit kljuc", () => {
  const e = env();
  // Bez razdvajanja bi se brojač po nalogu i po adresi mogli spojiti u jedan red.
  assert.notEqual(
    rateLimitSubjectKey("account", "203.0.113.42", e),
    rateLimitSubjectKey("ip", "203.0.113.42", e),
  );
});

test("kljuc zavisi od tajnog kljuca — inace se predracuna", () => {
  const a = env();
  const b = env();
  assert.notEqual(
    rateLimitSubjectKey("ip", "203.0.113.42", a),
    rateLimitSubjectKey("ip", "203.0.113.42", b),
  );
});

test("e-posta se normalizuje, adresa ne", () => {
  const e = env();
  assert.equal(
    rateLimitSubjectKey("account", " KUPAC@Primer.RS ", e),
    rateLimitSubjectKey("account", "kupac@primer.rs", e),
  );
});

test("bez kljuca se ogranicavanje ne podesava", () => {
  assert.equal(isRateLimitConfigured({}), false);
  assert.throws(() => rateLimitSubjectKey("ip", "1.2.3.4", {}), RateLimitKeyMissingError);
  assert.throws(
    () => rateLimitSubjectKey("ip", "1.2.3.4", { [RATE_LIMIT_KEY_ENV]: randomBytes(8).toString("base64") }),
    /najmanje 32 bajta/,
  );
});

/* =========================================================================
 * `AUTH-02` — fail-closed konfiguracija na svakom udaljenom deployment-u
 *
 * `requiresRateLimitSecret`/`validateRateLimitConfiguration` su čiste funkcije
 * (bez baze, bez I/O) — stvarni pozivi ispod, ne pretraga izvora. Stvarno
 * izvršavanje samog `registerAttempt`/`isBucketBlocked` fail-closed puta (bez
 * baze, jer provera stoji PRE svakog upita) je u
 * `lib/auth/rateLimitFailClosed.test.mts`.
 *
 * KORIGOVANO: `resolveRuntimeEnvironment` (MFA) svesno tretira Vercel Preview
 * kao "development" — ispravno za MFA, POGREŠNO za rate-limit fail-closed
 * odluku, jer bi Preview bez ključa tiho prošao kao "još neograničeno".
 * `requiresRateLimitSecret` je zato SOPSTVENA, nezavisna funkcija — matrica
 * ispod je doslovno tabela iz zahteva korekcije.
 * ====================================================================== */

/**
 * Doslovna matrica iz zahteva korekcije. `zahteva: true` znači "fail-closed
 * kada je ključ neispravan"; `false` znači "postojeće fail-open ponašanje".
 */
const ENV_MATRIX = [
  { VERCEL_ENV: "production", NODE_ENV: "production", zahteva: true },
  { VERCEL_ENV: "production", NODE_ENV: "development", zahteva: true },
  { VERCEL_ENV: "preview", NODE_ENV: "production", zahteva: true },
  { VERCEL_ENV: "preview", NODE_ENV: "development", zahteva: true },
  { VERCEL_ENV: undefined, NODE_ENV: "production", zahteva: true },
  { VERCEL_ENV: undefined, NODE_ENV: "development", zahteva: false },
  { VERCEL_ENV: undefined, NODE_ENV: "test", zahteva: false },
  { VERCEL_ENV: "development", NODE_ENV: "development", zahteva: false },
  { VERCEL_ENV: "staging-nepoznato", NODE_ENV: "development", zahteva: true },
];

test("requiresRateLimitSecret prati TAČNU matricu iz zahteva korekcije", () => {
  for (const red of ENV_MATRIX) {
    const { zahteva, ...ulaz } = red;
    assert.equal(
      requiresRateLimitSecret(ulaz),
      zahteva,
      `VERCEL_ENV=${ulaz.VERCEL_ENV ?? "(nepostavljen)"} NODE_ENV=${ulaz.NODE_ENV} → očekivano ${zahteva}`,
    );
  }
});

test("validateRateLimitConfiguration prati istu matricu, bez ključa", () => {
  for (const red of ENV_MATRIX) {
    const { zahteva, ...ulaz } = red;
    const rezultat = validateRateLimitConfiguration(ulaz);
    assert.equal(
      rezultat.ok,
      !zahteva,
      `VERCEL_ENV=${ulaz.VERCEL_ENV ?? "(nepostavljen)"} NODE_ENV=${ulaz.NODE_ENV}: ok trebalo da bude ${!zahteva}`,
    );
  }
});

test("produkcija + kljuc odsutan → nevalidno", () => {
  const rezultat = validateRateLimitConfiguration({ VERCEL_ENV: "production" });
  assert.equal(rezultat.ok, false);
  assert.match(rezultat.reason, new RegExp(RATE_LIMIT_KEY_ENV));
});

test("preview + kljuc odsutan → nevalidno (KORIGOVANA praznina)", () => {
  const rezultat = validateRateLimitConfiguration({ VERCEL_ENV: "preview" });
  assert.equal(rezultat.ok, false);
  assert.match(rezultat.reason, new RegExp(RATE_LIMIT_KEY_ENV));
});

test("preview + prazan kljuc → nevalidno", () => {
  const rezultat = validateRateLimitConfiguration({ VERCEL_ENV: "preview", [RATE_LIMIT_KEY_ENV]: "" });
  assert.equal(rezultat.ok, false);
});

test("preview + whitespace-only kljuc → nevalidno", () => {
  const rezultat = validateRateLimitConfiguration({
    VERCEL_ENV: "preview",
    [RATE_LIMIT_KEY_ENV]: "   \n\t  ",
  });
  assert.equal(rezultat.ok, false);
});

test("preview + preslab kljuc (manje od 32 bajta) → nevalidno", () => {
  const rezultat = validateRateLimitConfiguration({
    VERCEL_ENV: "preview",
    [RATE_LIMIT_KEY_ENV]: randomBytes(16).toString("base64"),
  });
  assert.equal(rezultat.ok, false);
});

test("preview + validan kljuc (>=32 bajta) → validno", () => {
  const rezultat = validateRateLimitConfiguration({ VERCEL_ENV: "preview", ...env() });
  assert.deepEqual(rezultat, { ok: true, reason: null });
});

test("produkcija + preslab kljuc (manje od 32 bajta) → nevalidno", () => {
  const rezultat = validateRateLimitConfiguration({
    VERCEL_ENV: "production",
    [RATE_LIMIT_KEY_ENV]: randomBytes(16).toString("base64"),
  });
  assert.equal(rezultat.ok, false);
});

test("produkcija + validan kljuc (>=32 bajta) → validno", () => {
  const rezultat = validateRateLimitConfiguration({ VERCEL_ENV: "production", ...env() });
  assert.deepEqual(rezultat, { ok: true, reason: null });
});

test("van udaljenog deploymenta, isti nedostajuci kljuc ostaje validan — postojece ponasanje ocuvano", () => {
  assert.deepEqual(
    validateRateLimitConfiguration({ VERCEL_ENV: "development" }),
    { ok: true, reason: null },
  );
  assert.deepEqual(validateRateLimitConfiguration({ NODE_ENV: "test" }), { ok: true, reason: null });
  assert.deepEqual(validateRateLimitConfiguration({}), { ok: true, reason: null });
});

test("VERCEL_ENV=production nadjačava lokalno podešen NODE_ENV=development — dev bypass se ne aktivira slučajno", () => {
  /*
   * Ovo je STVARNI napadni scenario koji test brani: `next start` na
   * kancelarijskom laptopu ili loše podešen preview deploy ostavlja
   * `NODE_ENV=development` dok je `VERCEL_ENV=production`.
   */
  const rezultat = validateRateLimitConfiguration({
    VERCEL_ENV: "production",
    NODE_ENV: "development",
  });
  assert.equal(rezultat.ok, false);
});

test("VERCEL_ENV=preview nadjačava lokalno podešen NODE_ENV=development — isto pravilo, isti razlog", () => {
  const rezultat = validateRateLimitConfiguration({
    VERCEL_ENV: "preview",
    NODE_ENV: "development",
  });
  assert.equal(rezultat.ok, false);
});

test("nepoznata neprazna VERCEL_ENV vrednost je konzervativno fail-closed", () => {
  const rezultat = validateRateLimitConfiguration({ VERCEL_ENV: "staging-nepoznato" });
  assert.equal(rezultat.ok, false);
});

test("VERCEL_ENV=\"development\" (vercel dev, lokalni CLI) ostaje fail-open — jedini izuzetak", () => {
  assert.deepEqual(
    validateRateLimitConfiguration({ VERCEL_ENV: "development", NODE_ENV: "development" }),
    { ok: true, reason: null },
  );
});

test("razlog greške NIKAD ne sadrži vrednost ključa — čak ni kad ključ IZGLEDA kao razlog", () => {
  // Namerno kratko (dekodrano < 32 bajta), da ok:false bude ZAJEMČENO i ne
  // zavisi od toga koliko znakova preživi kao validan base64.
  const izmisljenaVrednost = Buffer.from("OVO-JE-TAJNA-VREDNOST").toString("base64");
  const rezultat = validateRateLimitConfiguration({
    VERCEL_ENV: "production",
    [RATE_LIMIT_KEY_ENV]: izmisljenaVrednost,
  });
  assert.equal(rezultat.ok, false);
  assert.ok(!rezultat.reason.includes(izmisljenaVrednost));
  assert.ok(!rezultat.reason.includes("TAJNA"));
});

/* =========================================================================
 * Klijentska adresa
 * ====================================================================== */

test("iza poznatog posrednika se uzima PRVA adresa iz lanca", () => {
  const ip = resolveClientIp({
    headers: headers({ "x-forwarded-for": "203.0.113.42, 70.41.3.18, 150.172.238.178" }),
    trustedProxy: true,
  });
  assert.equal(ip, "203.0.113.42");
});

test("van poznatog posrednika se zaglavlje IGNORISE", () => {
  // Inače bi napadač zaobišao ograničenje jednim izmišljenim zaglavljem.
  const ip = resolveClientIp({
    headers: headers({ "x-forwarded-for": "1.1.1.1" }),
    trustedProxy: false,
    socketAddress: "127.0.0.1",
  });
  assert.equal(ip, "127.0.0.1");
});

test("bez posrednika i bez adrese veze vraca null", () => {
  const ip = resolveClientIp({ headers: headers({}), trustedProxy: false });
  assert.equal(ip, null, "izmisljena adresa bi spojila nepovezane korisnike");
});

test("poverenje posredniku samo na Vercelu", () => {
  assert.equal(isTrustedProxyEnvironment({ VERCEL: "1" }), true);
  assert.equal(isTrustedProxyEnvironment({ VERCEL_ENV: "production" }), true);
  assert.equal(isTrustedProxyEnvironment({ VERCEL_ENV: "preview" }), true);
  assert.equal(isTrustedProxyEnvironment({}), false);
  assert.equal(isTrustedProxyEnvironment({ NODE_ENV: "production" }), false);
});

/* =========================================================================
 * Šta se uopšte ograničava
 * ====================================================================== */

test("ogranicava se samo stvarna provera kredencijala", () => {
  assert.equal(
    isCredentialAttemptPath("/api/auth/callback/credentials", "POST"),
    true,
  );
  assert.equal(
    isCredentialAttemptPath("/api/auth/callback/credentials/", "POST"),
    true,
  );
});

test("citanje sesije i CSRF se NE ogranicavaju", () => {
  // Prijavljena strana ih zove rutinski; blanket limit bi izbacivao korisnike
  // usred rada, a napadacu ne bi smetao.
  for (const [path, method] of [
    ["/api/auth/session", "GET"],
    ["/api/auth/csrf", "GET"],
    ["/api/auth/providers", "GET"],
    ["/api/auth/signout", "POST"],
    ["/api/auth/callback/credentials", "GET"],
  ]) {
    assert.equal(
      isCredentialAttemptPath(path, method),
      false,
      `${method} ${path} je pogresno ogranicen`,
    );
  }
});

/* =========================================================================
 * Servisni sloj — ugovor nad izvorom
 * ====================================================================== */

test("brojac se uvecava u SQL-u, ne u aplikaciji", async () => {
  const source = await readFile(
    new URL("./rate-limit-service.ts", import.meta.url),
    "utf8",
  );
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  // Uvećanje mora biti izraz u SQL-u; racunanje u JS-u dozvoljava da dva
  // paralelna pokusaja procitaju istu staru vrednost.
  assert.match(code, /sql`\$\{authRateLimits\.attempts\} \+ 1`/);
  assert.match(code, /onConflictDoUpdate/);
  // Nema in-memory mape.
  assert.doesNotMatch(code, /new Map\(|globalThis\.\w*[Rr]ate/);
});

test("uspesna prijava cisti SAMO brojac po nalogu", async () => {
  const source = await readFile(
    new URL("./rate-limit-service.ts", import.meta.url),
    "utf8",
  );
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  const clearBlock = code.slice(code.indexOf("export async function clearAccountAttempts"));
  assert.match(clearBlock, /eq\(authRateLimits\.dimension, "account"\)/);
  // Brisanje IP brojaca bi napadacu obrisalo trag i vratilo pun broj pokusaja.
  assert.ok(!clearBlock.includes('"ip"'), "cisti se i brojac po adresi");
});

test("ciscenje ne dira aktivne blokade", async () => {
  const source = await readFile(
    new URL("./rate-limit-service.ts", import.meta.url),
    "utf8",
  );
  const prune = source.slice(source.indexOf("export async function pruneExpiredBuckets"));
  /*
   * Uslov je namerno slozen: brise se samo ono sto NEMA aktivnu blokadu i cak
   * i tada samo ako je prozor stariji od praga. Brisanje aktivne blokade bi
   * napadacu vratilo pun broj pokusaja.
   *
   * Oblik je tipizovan (`or`/`isNull`/`lte`) jer sirov `sql` sablon salje
   * `Date` bez tipa kolone i puca nad pravim PostgreSQL-om.
   */
  assert.match(prune, /or\(isNull\(authRateLimits\.blockedUntil\), lte\(authRateLimits\.blockedUntil, now\)\)/);
  assert.match(prune, /lt\(authRateLimits\.windowStartedAt, olderThan\)/);
});

test("servis ispisuje NAJVIŠE jedan bezbedan razlog konfiguracije — nikad kredencijale, adrese ni ključ", async () => {
  /*
   * `AUTH-02` uvodi TAČNO jedan `console.error` poziv — dijagnostika greške
   * podešavanja u produkciji (isti obrazac kao `console.error(configuration.
   * reason)` za MFA u `auth.ts`). Ranija verzija ovog testa je zabranjivala
   * SVAKI `console.*` poziv; to više ne važi bukvalno, ali je i dalje tačno da
   * servis ne sme ispisati NIŠTA što nosi tajnu, adresu ili identifikator
   * naloga — zato test sada proverava TAČAN oblik jedinog dozvoljenog poziva,
   * umesto da zabrani sve.
   */
  const source = await readFile(
    new URL("./rate-limit-service.ts", import.meta.url),
    "utf8",
  );
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  const pozivi = [...code.matchAll(/console\.\w+\([^)]*\)/g)].map((m) => m[0]);
  assert.equal(pozivi.length, 1, `očekivan tačno jedan console poziv, nađeno ${pozivi.length}: ${pozivi.join(" | ")}`);

  const [poziv] = pozivi;
  assert.match(poziv, /^console\.error\(`\[rate-limit\] \$\{reason\}`\)$/);

  // Jedini argument je `reason` — nikad `input`, `configuration`, `token`,
  // adresa ili identifikator naloga.
  for (const zabranjeno of [
    "accountIdentifier", "clientIp", "input.", "configuration", "token",
    "AUTH_RATE_LIMIT_HMAC_KEY", "subjectKey",
  ]) {
    assert.ok(!poziv.includes(zabranjeno), `console poziv sadrži „${zabranjeno}“`);
  }
});
