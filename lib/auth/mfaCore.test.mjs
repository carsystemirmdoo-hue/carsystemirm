import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  activeKeyVersion,
  decryptMfaSecret,
  encryptMfaSecret,
  fingerprintsMatch,
  isMfaConfigured,
  IV_BYTES,
  MfaDecryptError,
  MfaKeyMissingError,
  normalizeRecoveryCode,
  recoveryCodeFingerprint,
  TAG_BYTES,
} from "./mfa-crypto.mjs";
import {
  counterAt,
  generateTotpSecret,
  isCounterFresh,
  normalizeTotpToken,
  totpFor,
  totpUri,
  TOTP_DIGITS,
  TOTP_PERIOD,
  TOTP_WINDOW,
  verifyTotp,
} from "./totp.mjs";
import {
  formatRecoveryCodesForDownload,
  generateRecoveryCodes,
  looksLikeRecoveryCode,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_ENTROPY_BITS,
} from "./recovery-codes.mjs";

const env = () => ({
  PORTAL_MFA_MASTER_KEY_V1: randomBytes(32).toString("base64"),
  PORTAL_MFA_ACTIVE_KEY_VERSION: "1",
});

/* =========================================================================
 * Šifrovanje tajne
 * ====================================================================== */

test("IV i tag imaju propisanu duzinu", () => {
  const e = env();
  const record = encryptMfaSecret(randomBytes(20), e);
  assert.equal(Buffer.from(record.iv, "base64").length, IV_BYTES);
  assert.equal(Buffer.from(record.authTag, "base64").length, TAG_BYTES);
});

test("round-trip vraca istu tajnu", () => {
  const e = env();
  const secret = randomBytes(20);
  assert.equal(Buffer.compare(decryptMfaSecret(encryptMfaSecret(secret, e), e), secret), 0);
});

test("ista tajna dva puta daje razlicit IV i ciphertext", () => {
  const e = env();
  const secret = randomBytes(20);
  const a = encryptMfaSecret(secret, e);
  const b = encryptMfaSecret(secret, e);
  assert.notEqual(a.iv, b.iv, "ponovljen IV rusi garanciju GCM-a");
  assert.notEqual(a.ciphertext, b.ciphertext);
  // Ali obe se dešifruju u istu tajnu.
  assert.equal(Buffer.compare(decryptMfaSecret(a, e), decryptMfaSecret(b, e)), 0);
});

test("pogresan kljuc pada, bez otkrivanja razloga", () => {
  const e = env();
  const record = encryptMfaSecret(randomBytes(20), e);
  const wrong = { ...e, PORTAL_MFA_MASTER_KEY_V1: randomBytes(32).toString("base64") };
  assert.throws(() => decryptMfaSecret(record, wrong), MfaDecryptError);
});

test("izmenjen ciphertext pada", () => {
  const e = env();
  const record = encryptMfaSecret(randomBytes(20), e);
  const tampered = { ...record, ciphertext: randomBytes(20).toString("base64") };
  assert.throws(() => decryptMfaSecret(tampered, e), MfaDecryptError);
});

test("izmenjen authentication tag pada", () => {
  const e = env();
  const record = encryptMfaSecret(randomBytes(20), e);
  const tampered = { ...record, authTag: randomBytes(16).toString("base64") };
  assert.throws(() => decryptMfaSecret(tampered, e), MfaDecryptError);
});

test("izmenjen IV pada", () => {
  const e = env();
  const record = encryptMfaSecret(randomBytes(20), e);
  const tampered = { ...record, iv: randomBytes(12).toString("base64") };
  assert.throws(() => decryptMfaSecret(tampered, e), MfaDecryptError);
});

test("zapis se cita po SVOJOJ verziji kljuca, ne po aktivnoj", () => {
  const v1 = randomBytes(32).toString("base64");
  const v2 = randomBytes(32).toString("base64");
  const secret = randomBytes(20);

  const withV1 = { PORTAL_MFA_MASTER_KEY_V1: v1, PORTAL_MFA_ACTIVE_KEY_VERSION: "1" };
  const record = encryptMfaSecret(secret, withV1);
  assert.equal(record.keyVersion, 1);

  // Rotacija: aktivna je sada v2, ali stari zapis mora ostati čitljiv.
  const rotated = {
    PORTAL_MFA_MASTER_KEY_V1: v1,
    PORTAL_MFA_MASTER_KEY_V2: v2,
    PORTAL_MFA_ACTIVE_KEY_VERSION: "2",
  };
  assert.equal(Buffer.compare(decryptMfaSecret(record, rotated), secret), 0);
  assert.equal(encryptMfaSecret(secret, rotated).keyVersion, 2, "nov zapis ne koristi novu verziju");
  assert.equal(activeKeyVersion(rotated), 2);
});

test("bez kljuca sve pada zatvoreno", () => {
  assert.equal(isMfaConfigured({}), false);
  assert.throws(() => encryptMfaSecret(randomBytes(20), {}), MfaKeyMissingError);
});

test("`AUTH-03`: aktivna verzija pokazuje na nepostojeci kljuc — prethodna verzija i dalje postoji", () => {
  /*
   * Rotacija u toku: V1 je i dalje podesen (stari zapisi moraju ostati
   * citljivi), ali ACTIVE_KEY_VERSION je vec prebacen na V2 pre nego sto je
   * V2 stvarno podesen na ovom deployment-u — operativna greska koja se
   * dogadja kad se promenljive prebacuju redom, ne odjednom. Sistem NE SME
   * tiho da nastavi da koristi V1 kao da je aktivan.
   */
  const env = {
    PORTAL_MFA_MASTER_KEY_V1: randomBytes(32).toString("base64"),
    PORTAL_MFA_ACTIVE_KEY_VERSION: "2",
  };
  assert.equal(activeKeyVersion(env), 2);
  assert.equal(isMfaConfigured(env), false, "V2 ne postoji — konfiguracija nije upotrebljiva");
  assert.throws(() => encryptMfaSecret(randomBytes(20), env), MfaKeyMissingError);
});

test("prekratak master kljuc se odbija", () => {
  assert.throws(
    () => encryptMfaSecret(randomBytes(20), {
      PORTAL_MFA_MASTER_KEY_V1: randomBytes(16).toString("base64"),
      PORTAL_MFA_ACTIVE_KEY_VERSION: "1",
    }),
    /najmanje 32 bajta/,
  );
});

test("serializovan zapis ne sadrzi plaintext tajnu", () => {
  const e = env();
  const secret = Buffer.from("TAJNA-KOJU-TRAZIMO--", "ascii");
  const record = encryptMfaSecret(secret, e);
  const serialized = JSON.stringify(record);

  assert.ok(!serialized.includes(secret.toString("ascii")));
  assert.ok(!serialized.includes(secret.toString("base64")));
  assert.ok(!serialized.includes(secret.toString("hex")));
  // Ni master ključ ne sme procuriti u zapis.
  assert.ok(!serialized.includes(e.PORTAL_MFA_MASTER_KEY_V1));
});

test("kljucevi za sifrovanje i za recovery su razliciti", () => {
  const e = env();
  // Isti ulaz, dve namene → različit izlaz. Kad bi se koristio isti sirovi
  // ključ, HMAC recovery koda bi se mogao izvesti iz ključa za šifrovanje.
  const secret = Buffer.from("ABCDEFGHIJKLMNOPQRST", "ascii");
  const encrypted = encryptMfaSecret(secret, e);
  const fingerprint = recoveryCodeFingerprint("ABCDEFGHIJKLMNOPQRST", e);
  assert.notEqual(encrypted.ciphertext, fingerprint);
});

/* =========================================================================
 * TOTP
 * ====================================================================== */

test("RFC 6238 test vektori", () => {
  // RFC 6238 Appendix B, SHA-1, tajna "12345678901234567890".
  const secret = Buffer.from("12345678901234567890", "ascii");
  const vectors = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];
  for (const [seconds, expected] of vectors) {
    const code = totpFor(secret, "rfc").generate({ timestamp: seconds * 1000 });
    assert.equal(code, expected, `vektor ${seconds}`);
  }
});

test("parametri su oni koje authenticator aplikacije podrazumevaju", () => {
  assert.equal(TOTP_DIGITS, 6);
  assert.equal(TOTP_PERIOD, 30);
  assert.equal(TOTP_WINDOW, 1, "prozor veci od 1 siri povrsinu pogadjanja");
});

test("validan kod prolazi, pogresan pada", () => {
  const { bytes } = generateTotpSecret();
  const now = new Date();
  const code = totpFor(bytes, "x").generate({ timestamp: now.getTime() });

  assert.equal(verifyTotp({ secretBytes: bytes, token: code, now }).valid, true);
  assert.equal(verifyTotp({ secretBytes: bytes, token: "000000", now }).valid, false);
  assert.equal(verifyTotp({ secretBytes: bytes, token: "", now }).valid, false);
  assert.equal(verifyTotp({ secretBytes: bytes, token: "12345", now }).valid, false);
  assert.equal(verifyTotp({ secretBytes: bytes, token: null, now }).valid, false);
});

test("drift -1, 0 i +1 prolaze; -2 i +2 padaju", () => {
  const { bytes } = generateTotpSecret();
  const now = new Date();

  for (const delta of [-1, 0, 1]) {
    const at = new Date(now.getTime() + delta * TOTP_PERIOD * 1000);
    const code = totpFor(bytes, "x").generate({ timestamp: at.getTime() });
    const result = verifyTotp({ secretBytes: bytes, token: code, now });
    assert.equal(result.valid, true, `drift ${delta} nije prosao`);
    assert.equal(result.delta, delta);
  }

  for (const delta of [-2, 2, 5]) {
    const at = new Date(now.getTime() + delta * TOTP_PERIOD * 1000);
    const code = totpFor(bytes, "x").generate({ timestamp: at.getTime() });
    assert.equal(
      verifyTotp({ secretBytes: bytes, token: code, now }).valid,
      false,
      `drift ${delta} je prosao a ne bi smeo`,
    );
  }
});

test("prihvaceni prozor se racuna apsolutno, ne kao delta", () => {
  const { bytes } = generateTotpSecret();
  const now = new Date();
  const previous = new Date(now.getTime() - TOTP_PERIOD * 1000);
  const code = totpFor(bytes, "x").generate({ timestamp: previous.getTime() });

  const result = verifyTotp({ secretBytes: bytes, token: code, now });
  assert.equal(result.counter, counterAt(now) - 1, "prozor nije apsolutan");
});

test("isti prozor se ne prihvata dvaput", () => {
  const current = counterAt(new Date());
  assert.equal(isCounterFresh(current, null), true, "prvi put mora proci");
  assert.equal(isCounterFresh(current, current), false, "isti prozor je prosao dvaput");
  assert.equal(isCounterFresh(current - 1, current), false, "stariji prozor je prosao");
  assert.equal(isCounterFresh(current + 1, current), true);
});

test("otpauth adresa nosi tacne parametre i ne curi nigde", () => {
  const { bytes, base32 } = generateTotpSecret();
  const uri = totpUri(bytes, "kupac@primer.rs");

  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.match(uri, /issuer=Carsystem(%20| )i(%20| )R-M/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
  assert.match(uri, /algorithm=SHA1/);
  assert.ok(uri.includes(base32), "adresa mora nositi bas tu tajnu");
});

test("razmaci u kodu se tolerisu", () => {
  assert.equal(normalizeTotpToken("123 456"), "123456");
  assert.equal(normalizeTotpToken(" 1 2 3 4 5 6 "), "123456");
  assert.equal(normalizeTotpToken(null), "");
});

/* =========================================================================
 * Recovery kodovi
 * ====================================================================== */

test("set ima tacno deset jedinstvenih kodova", () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, RECOVERY_CODE_COUNT);
  assert.equal(new Set(codes).size, RECOVERY_CODE_COUNT);
});

test("entropija je iznad trazenih 128 bita", () => {
  assert.ok(
    RECOVERY_CODE_ENTROPY_BITS >= 128,
    `entropija je ${RECOVERY_CODE_ENTROPY_BITS} bita`,
  );
});

test("kodovi izbegavaju znakove koji se mesaju pri prepisivanju", () => {
  const codes = generateRecoveryCodes(50);
  const chars = new Set(codes.join("").replace(/-/g, ""));
  for (const confusing of ["0", "O", "1", "I", "L", "U"]) {
    assert.ok(!chars.has(confusing), `alfabet sadrzi ${confusing}`);
  }
});

test("oblik koda se prepoznaje, tudji unos se odbija", () => {
  const [code] = generateRecoveryCodes(1);
  assert.equal(looksLikeRecoveryCode(code), true);
  assert.equal(looksLikeRecoveryCode(code.replace(/-/g, "")), true);
  assert.equal(looksLikeRecoveryCode(code.toLowerCase()), true);
  for (const bad of ["", "kratko", "0".repeat(30), null, 42, code + "X"]) {
    assert.equal(looksLikeRecoveryCode(bad), false, `prihvacen: ${bad}`);
  }
});

test("otisak je stabilan bez obzira na crtice i velicinu slova", () => {
  const e = env();
  const [code] = generateRecoveryCodes(1);
  const base = recoveryCodeFingerprint(code, e);
  assert.equal(recoveryCodeFingerprint(code.toLowerCase(), e), base);
  assert.equal(recoveryCodeFingerprint(code.replace(/-/g, ""), e), base);
  assert.equal(recoveryCodeFingerprint(` ${code} `, e), base);
});

test("otisak ne otkriva sam kod i zavisi od kljuca", () => {
  const [code] = generateRecoveryCodes(1);
  const a = env();
  const b = env();
  const fpA = recoveryCodeFingerprint(code, a);

  assert.ok(!fpA.includes(normalizeRecoveryCode(code)));
  // Bez tajnog ključa otisak bi se predračunao; različit ključ → različit otisak.
  assert.notEqual(fpA, recoveryCodeFingerprint(code, b));
});

test("poredjenje otisaka je otporno na duzinu i tip", () => {
  const e = env();
  const [code] = generateRecoveryCodes(1);
  const fp = recoveryCodeFingerprint(code, e);

  assert.equal(fingerprintsMatch(fp, fp), true);
  assert.equal(fingerprintsMatch(fp, recoveryCodeFingerprint("DRUGI", e)), false);
  assert.equal(fingerprintsMatch(fp, ""), false);
  assert.equal(fingerprintsMatch(fp, null), false);
});

test("tekst za preuzimanje ne nosi ime korisnika ni firme", () => {
  const codes = generateRecoveryCodes(3);
  const text = formatRecoveryCodesForDownload(codes);
  for (const code of codes) assert.ok(text.includes(code));
  assert.ok(!/@/.test(text), "tekst sadrzi e-postu");
});

/* =========================================================================
 * Rezimi obaveznosti
 *
 * Cela matrica odluke o pristupu zivi u `lib/auth/mfaPolicy.test.mjs`, nad
 * jedinim vlasnikom te odluke (`lib/auth/mfa-policy.mjs`). Ovde je nema da se
 * ne bi ponovo pojavila dva mesta koja odgovaraju na isto pitanje.
 * ====================================================================== */

/* =========================================================================
 * Higijena izvora
 * ====================================================================== */

test("nijedan modul ne ispisuje tajne", async () => {
  for (const file of ["./mfa-crypto.mjs", "./totp.mjs", "./recovery-codes.mjs"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.doesNotMatch(code, /console\.(log|info|warn|error|debug)/, file);
  }
});

test("tajna se ne izvodi iz okruzenja u totp modulu", async () => {
  const source = await readFile(new URL("./totp.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /process\.env/);
});
