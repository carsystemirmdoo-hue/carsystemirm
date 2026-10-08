import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeLoginIdentifier,
  resolveCredentialsLogin,
  shouldCountFailedAttempt,
} from "./credentials-login.mjs";
import {
  ABSENT_USER_PASSWORD_RECORD,
  hashPassword,
  verifyPassword,
} from "./password.mjs";

const PASSWORD = "ispravna-lozinka-123";
let realHash;

/** Beleži svaki poziv provere, da bi se broj poziva mogao tvrditi. */
function countingVerify(result = false) {
  const calls = [];
  return {
    calls,
    verify: async (password, storedHash) => {
      calls.push({ password, storedHash });
      return typeof result === "function" ? result(password, storedHash) : result;
    },
  };
}

const activeUser = () => ({
  id: "u1",
  email: "kupac@primer.rs",
  name: "Test",
  role: "gazda",
  passwordHash: realHash,
  active: true,
  lockedUntil: null,
  failedLoginAttempts: 0,
});

test.before(async () => {
  realHash = await hashPassword(PASSWORD);
});

/* -------------------------------------------------------------------------
 * Broj poziva provere — srž zaštite od enumeracije
 * ---------------------------------------------------------------------- */

test("postojeci nalog: provera lozinke se poziva tacno jednom", async () => {
  const { calls, verify } = countingVerify(true);
  await resolveCredentialsLogin({
    email: "kupac@primer.rs",
    password: PASSWORD,
    loadUser: async () => activeUser(),
    verify,
    absentUserHash: ABSENT_USER_PASSWORD_RECORD,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].storedHash, realHash);
});

test("nepostojeci nalog: provera lozinke se i dalje poziva tacno jednom", async () => {
  const { calls, verify } = countingVerify(false);
  const decision = await resolveCredentialsLogin({
    email: "ne-postoji@primer.rs",
    password: PASSWORD,
    loadUser: async () => null,
    verify,
    absentUserHash: ABSENT_USER_PASSWORD_RECORD,
  });

  // Ovo je cela poenta: rada ima i kad naloga nema.
  assert.equal(calls.length, 1, "rani izlaz je vracen");
  assert.equal(calls[0].storedHash, ABSENT_USER_PASSWORD_RECORD);
  assert.equal(decision.outcome, "denied");
});

test("deaktiviran i zakljucan nalog takodje placaju proveru", async () => {
  for (const patch of [
    { active: false },
    { lockedUntil: new Date(Date.now() + 60_000) },
  ]) {
    const { calls, verify } = countingVerify(true);
    const decision = await resolveCredentialsLogin({
      email: "kupac@primer.rs",
      password: PASSWORD,
      loadUser: async () => ({ ...activeUser(), ...patch }),
      verify,
      absentUserHash: ABSENT_USER_PASSWORD_RECORD,
    });
    assert.equal(calls.length, 1, `rani izlaz za ${JSON.stringify(patch)}`);
    assert.equal(decision.outcome, "denied");
  }
});

test("prazan i neispravan identifikator takodje placaju proveru", async () => {
  for (const email of ["", "   ", null, undefined, 42]) {
    const { calls, verify } = countingVerify(false);
    const decision = await resolveCredentialsLogin({
      email,
      password: PASSWORD,
      loadUser: async () => {
        throw new Error("baza ne sme biti pitana za prazan identifikator");
      },
      verify,
      absentUserHash: ABSENT_USER_PASSWORD_RECORD,
    });
    assert.equal(calls.length, 1, `rani izlaz za ${JSON.stringify(email)}`);
    assert.equal(decision.outcome, "denied");
  }
});

/* -------------------------------------------------------------------------
 * Ishod je isti spolja, različit iznutra
 * ---------------------------------------------------------------------- */

test("sva odbijanja imaju identican javni ishod", async () => {
  const scenarios = [
    ["nepostojeci", async () => null, false],
    ["pogresna lozinka", async () => activeUser(), false],
    ["deaktiviran", async () => ({ ...activeUser(), active: false }), true],
    [
      "zakljucan",
      async () => ({ ...activeUser(), lockedUntil: new Date(Date.now() + 60_000) }),
      true,
    ],
  ];

  const outcomes = new Set();
  for (const [, loadUser, verifyResult] of scenarios) {
    const { verify } = countingVerify(verifyResult);
    const decision = await resolveCredentialsLogin({
      email: "kupac@primer.rs",
      password: "bilo-sta",
      loadUser,
      verify,
      absentUserHash: ABSENT_USER_PASSWORD_RECORD,
    });
    outcomes.add(decision.outcome);
  }

  assert.deepEqual([...outcomes], ["denied"], "ishodi se razlikuju spolja");
});

test("interni razlog se razlikuje — za audit, ne za korisnika", async () => {
  const cases = [
    [async () => null, false, "no_such_user"],
    [async () => ({ ...activeUser(), active: false }), true, "inactive"],
    [
      async () => ({ ...activeUser(), lockedUntil: new Date(Date.now() + 60_000) }),
      true,
      "locked",
    ],
    [async () => activeUser(), false, "bad_password"],
    [async () => activeUser(), true, "ok"],
  ];

  for (const [loadUser, verifyResult, expected] of cases) {
    const { verify } = countingVerify(verifyResult);
    const decision = await resolveCredentialsLogin({
      email: "kupac@primer.rs",
      password: PASSWORD,
      loadUser,
      verify,
      absentUserHash: ABSENT_USER_PASSWORD_RECORD,
    });
    assert.equal(decision.reason, expected);
  }
});

test("uspesna prijava i dalje radi", async () => {
  const decision = await resolveCredentialsLogin({
    email: "  KUPAC@Primer.RS  ",
    password: PASSWORD,
    loadUser: async (email) => {
      assert.equal(email, "kupac@primer.rs", "identifikator nije normalizovan");
      return activeUser();
    },
    verify: verifyPassword,
    absentUserHash: ABSENT_USER_PASSWORD_RECORD,
  });
  assert.equal(decision.outcome, "granted");
  assert.equal(decision.reason, "ok");
  assert.equal(decision.user.id, "u1");
});

test("istekla brava vise ne blokira prijavu", async () => {
  const decision = await resolveCredentialsLogin({
    email: "kupac@primer.rs",
    password: PASSWORD,
    loadUser: async () => ({
      ...activeUser(),
      lockedUntil: new Date(Date.now() - 60_000),
    }),
    verify: verifyPassword,
    absentUserHash: ABSENT_USER_PASSWORD_RECORD,
  });
  assert.equal(decision.outcome, "granted");
});

/* -------------------------------------------------------------------------
 * Zamenski zapis
 * ---------------------------------------------------------------------- */

test("zamenski zapis ima iste parametre kao stvarne lozinke", async () => {
  const [scheme, N, r, p] = ABSENT_USER_PASSWORD_RECORD.split("$");
  const [realScheme, realN, realR, realP] = realHash.split("$");
  assert.equal(scheme, realScheme);
  assert.deepEqual([N, r, p], [realN, realR, realP], "cena provere se razlikuje");
});

test("zamenski zapis nije tajna iz okruzenja", async () => {
  const source = await readFile(new URL("./password.mjs", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /process\.env/, "zapis zavisi od okruzenja");
  assert.match(code, /ABSENT_USER_PASSWORD_RECORD\s*=\s*\n?\s*"scrypt\$/);
});

test("zamenski zapis ne moze otvoriti nalog", async () => {
  // Nijedna od uobičajenih lozinki ne prolazi.
  for (const guess of ["", "password", "admin", "123456789012", PASSWORD]) {
    assert.equal(
      await verifyPassword(guess, ABSENT_USER_PASSWORD_RECORD),
      false,
      `zamenski zapis je prihvatio ${JSON.stringify(guess)}`,
    );
  }

  // I kad bi provera lagala da je lozinka tačna, prijava i dalje pada:
  // odluka traži POSTOJEĆEG korisnika, ne samo tačnu lozinku.
  const decision = await resolveCredentialsLogin({
    email: "ne-postoji@primer.rs",
    password: "bilo-sta",
    loadUser: async () => null,
    verify: async () => true,
    absentUserHash: ABSENT_USER_PASSWORD_RECORD,
  });
  assert.equal(decision.outcome, "denied");
  assert.equal(decision.user, null);
});

/* -------------------------------------------------------------------------
 * Struktura i posledice
 * ---------------------------------------------------------------------- */

test("u odluci nema nijednog izlaza pre provere lozinke", async () => {
  const source = await readFile(
    new URL("./credentials-login.mjs", import.meta.url),
    "utf8",
  );
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const body = code.slice(code.indexOf("export async function resolveCredentialsLogin"));
  const verifyAt = body.indexOf("await verify(");
  const firstReturn = body.indexOf("return {");

  assert.ok(verifyAt > -1, "provera se ne poziva");
  assert.ok(
    firstReturn > verifyAt,
    "postoji izlaz iz odluke pre provere lozinke — timing kanal je vracen",
  );
});

test("zakljucan i deaktiviran nalog se ne kaznjavaju dodatno", () => {
  assert.equal(shouldCountFailedAttempt("bad_password"), true);
  for (const reason of ["no_such_user", "inactive", "locked", "ok"]) {
    assert.equal(shouldCountFailedAttempt(reason), false, reason);
  }
});

test("normalizacija identifikatora je otporna na tip ulaza", () => {
  assert.equal(normalizeLoginIdentifier("  A@B.INVALID "), "a@b.invalid");
  for (const value of [null, undefined, 42, {}, []]) {
    assert.equal(normalizeLoginIdentifier(value), "");
  }
});

test("authorize koristi zajednicku odluku i ne loguje tajne", async () => {
  const source = await readFile(new URL("../../auth.ts", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  assert.match(code, /resolveCredentialsLogin\(/);
  assert.match(code, /absentUserHash: ABSENT_USER_PASSWORD_RECORD/);
  // Stari rani izlaz ne sme da se vrati.
  assert.doesNotMatch(code, /if \(!user \|\| !user\.active\) return null/);
  /*
   * Nikakvo ispisivanje iz same `authorize`.
   *
   * Zabrana ostaje tamo gde kredencijali postoje. Van nje, `resolveMfaRuntime`
   * sme da ispise NAZIV rezima i gresku konfiguracije — te vrednosti ne dolaze
   * od korisnika i `lib/auth/mfaPolicy.test.mjs` tvrdi da ne nose tajnu.
   */
  const authorizeBody = code.slice(
    code.indexOf("async authorize(rawCredentials)"),
    code.lastIndexOf("}),"),
  );
  assert.ok(authorizeBody.length > 100, "telo authorize nije pronadjeno");
  assert.doesNotMatch(authorizeBody, /console\.(log|info|warn|debug)/);
  // Jedini dozvoljen ispis unutar authorize je poruka o nepotpunoj konfiguraciji.
  const ispisi = [...authorizeBody.matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(ispisi, ["configuration.reason"], `neocekivan ispis: ${ispisi}`);

  // Lozinka i hash smeju da se PROSLEDE proveri, ali ne smeju izaći iz procesa:
  // ni u audit, ni u poruku, ni u vraćeni objekat sesije.
  const SECRETS = /passwordHash|parsed\.data\.password|absentUserHash|secretCiphertext|codeFingerprint|\bsecret\b/i;
  const auditBlocks = [...code.matchAll(/recordAudit\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.ok(auditBlocks.length > 0, "audit poziv nije pronadjen");
  for (const block of auditBlocks) {
    assert.doesNotMatch(block, SECRETS, "audit nosi kredencijal");
  }

  // Traže se STVARNE tajne, ne imena konstanti: `ASSURANCE_PASSWORD` je oznaka
  // nivoa pouzdanosti, ne lozinka.
  const returned = [...code.matchAll(/return \{[\s\S]*?\};/g)].map((m) => m[0]);
  for (const block of returned) {
    assert.doesNotMatch(block, SECRETS, "povratna vrednost nosi kredencijal");
  }
});
