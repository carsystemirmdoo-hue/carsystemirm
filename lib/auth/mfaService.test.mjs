import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/*
 * `mfa-service.ts` je `server-only` i traži bazu, pa se ne uvozi u test.
 * Ono što se ovde brani su ATOMSKE garancije — one ne žive u JavaScriptu nego u
 * SQL uslovima, i jedini način da se odbrane bez žive baze je da se dokaže da
 * uslov stoji tamo gde mora.
 *
 * Ponašanje nad stvarnom bazom pokriva integracioni tok iz `npm run db:dev`
 * (PGlite), koji nije deo ovog paketa jer traži pokrenutu bazu.
 */
const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

const service = codeOf(await read("./mfa-service.ts"));
const schema = codeOf(await read("../../db/schema/security.ts"));
const migration = await read("../../db/migrations/0004_auth_hardening.sql");

/* =========================================================================
 * Ponovna upotreba TOTP koda
 * ====================================================================== */

test("prihvatanje TOTP prozora ide kroz uslov u WHERE, ne kroz proveru u kodu", () => {
  const block = service.slice(
    service.indexOf("export async function verifyTotpForUser"),
    service.indexOf("export async function consumeRecoveryCode"),
  );

  // Uslov mora biti deo UPDATE-a: dva paralelna zahteva citaju isto stanje,
  // pa provera u aplikaciji propusta oba.
  assert.match(block, /\.update\(userMfa\)/);
  assert.match(
    block,
    /lastAcceptedCounter\} IS NULL OR \$\{userMfa\.lastAcceptedCounter\} < \$\{result\.counter\}/,
  );
  // Uspeh se meri brojem izmenjenih redova, ne pretpostavkom.
  assert.match(block, /\.returning\(/);
  assert.match(block, /updated\.length === 1/);
});

test("neuspesno desifrovanje se ponasa kao pogresan kod", () => {
  const block = service.slice(service.indexOf("export async function verifyTotpForUser"));
  // Iz odgovora se ne sme zakljuciti da je zapis ostecen.
  assert.match(block, /catch \{[\s\S]{0,120}return false;/);
});

test("kod upotrebljen za potvrdu vezivanja ne prolazi i pri prijavi", () => {
  const block = service.slice(
    service.indexOf("export async function confirmMfaEnrollment"),
    service.indexOf("export async function verifyTotpForUser"),
  );
  assert.match(block, /lastAcceptedCounter: result\.counter/);
});

/* =========================================================================
 * Recovery kodovi
 * ====================================================================== */

test("recovery kod se trosi uslovom used_at IS NULL", () => {
  const block = service.slice(
    service.indexOf("export async function consumeRecoveryCode"),
    service.indexOf("export async function regenerateRecoveryCodes"),
  );

  assert.match(block, /isNull\(mfaRecoveryCodes\.usedAt\)/);
  assert.match(block, /\.returning\(/);
  assert.match(block, /consumed\.length === 1/);
  // Oblik se proverava pre upita, da se u bazu ne salje proizvoljan unos.
  assert.match(block, /looksLikeRecoveryCode/);
});

test("u bazi stoji samo otisak, nikad sam kod", () => {
  assert.match(service, /codeFingerprint: recoveryCodeFingerprint\(/);
  assert.match(schema, /codeFingerprint: text\("code_fingerprint"\)/);
  // Nijedna kolona ne cuva sam kod.
  assert.ok(!/\bcode:\s*text\(/.test(schema), "shema cuva sam kod");
});

test("regeneracija brise prethodni set", () => {
  const block = service.slice(service.indexOf("async function replaceRecoveryCodes"));
  assert.match(block, /\.delete\(mfaRecoveryCodes\)/);
  assert.match(block, /\.insert\(mfaRecoveryCodes\)/);
});

test("reset MFA ponistava i tajnu i sve kodove", () => {
  const block = service.slice(service.indexOf("export async function resetMfaForUser"));
  assert.match(block, /secretCiphertext: null/);
  assert.match(block, /lastAcceptedCounter: null/);
  assert.match(block, /\.delete\(mfaRecoveryCodes\)/);
  assert.match(block, /transaction\(/);
});

/* =========================================================================
 * Enrollment
 * ====================================================================== */

test("MFA se ne aktivira pre prve uspesne provere", () => {
  const begin = service.slice(
    service.indexOf("export async function beginMfaEnrollment"),
    service.indexOf("export async function confirmMfaEnrollment"),
  );
  // Pocetak vezivanja upisuje ISKLJUCIVO `pending*` kolone.
  assert.match(begin, /pendingCiphertext:/);
  assert.ok(!/\bsecretCiphertext:/.test(begin), "vezivanje odmah aktivira MFA");
  // I postavlja rok — napustena tajna ne sme da vazi zauvek.
  assert.match(begin, /pendingExpiresAt/);
  assert.match(service, /PENDING_TTL_MS/);
});

test("istekao pending se odbija", () => {
  const confirm = service.slice(service.indexOf("export async function confirmMfaEnrollment"));
  assert.match(confirm, /pendingExpiresAt <= now/);
});

test("ponovno pokretanje zamenjuje nezavrsen pokusaj", () => {
  const begin = service.slice(service.indexOf("export async function beginMfaEnrollment"));
  assert.match(begin, /onConflictDoUpdate/);
});

test("bez master kljuca vezivanje pada zatvoreno", () => {
  const begin = service.slice(service.indexOf("export async function beginMfaEnrollment"));
  assert.match(begin, /isMfaConfigured\(env\(\)\)/);
  assert.match(begin, /throw new Error/);
});

/* =========================================================================
 * Tajne ne izlaze iz sistema
 * ====================================================================== */

test("servis ne ispisuje nista i ne vraca tajnu posle vezivanja", () => {
  assert.doesNotMatch(service, /console\.(log|info|warn|error|debug)/);

  // `confirmMfaEnrollment` vraca recovery kodove — to je jedini put kada se
  // vide — ali NE i TOTP tajnu.
  const confirm = service.slice(
    service.indexOf("export async function confirmMfaEnrollment"),
    service.indexOf("export async function verifyTotpForUser"),
  );
  assert.match(confirm, /recoveryCodes: codes/);
  assert.ok(!/base32/.test(confirm), "tajna se vraca i posle vezivanja");

  // Svaki `return` objekat iz potvrde sme da nosi samo ishod i kodove.
  const returned = [...confirm.matchAll(/return \{[\s\S]*?\};/g)].map((m) => m[0]);
  assert.ok(returned.length > 0, "nijedan return nije pronadjen");
  for (const block of returned) {
    assert.ok(
      !/secret|base32|uri|ciphertext/i.test(block),
      `tajna curi iz potvrde: ${block}`,
    );
  }

  // Status naloga nikad ne nosi tajnu.
  const status = service.slice(
    service.indexOf("export async function readMfaStatus"),
    service.indexOf("export async function beginMfaEnrollment"),
  );
  assert.ok(!/base32|totpUri|decryptMfaSecret/.test(status));
});

test("tajna se cuva iskljucivo sifrovano", () => {
  // Nijedna kolona ne prima sirovu tajnu.
  assert.match(schema, /secretCiphertext: text\("secret_ciphertext"\)/);
  assert.match(schema, /secretIv: text\("secret_iv"\)/);
  assert.match(schema, /secretAuthTag: text\("secret_auth_tag"\)/);
  assert.match(schema, /secretKeyVersion: integer\("secret_key_version"\)/);
  assert.ok(!/secret:\s*text\("secret"\)/.test(schema), "shema cuva sirovu tajnu");

  // Upis uvek ide kroz sifrovanje.
  assert.match(service, /encryptMfaSecret\(bytes, env\(\)\)/);
});

/* =========================================================================
 * Migracija
 * ====================================================================== */

test("migracija je aditivna i ne dira postojece redove", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "auth_rate_limits"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "user_mfa"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "mfa_recovery_codes"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "password_reset_codes"/);

  // Nista se ne brise, ne menja i ne prepisuje.
  assert.doesNotMatch(migration, /\bDROP\b|\bTRUNCATE\b|\bDELETE FROM\b|\bALTER COLUMN\b/i);
});

test("jedinstvenost sprecava dvostruko trosenje i sudar brojaca", () => {
  // Jedan red po (opseg, dimenzija, subjekt) — osnova za atomski upsert.
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "auth_rate_limits_key"/);
  // Isti otisak koda ne moze postojati dvaput za istog korisnika.
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "mfa_recovery_codes_fingerprint_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_codes_fingerprint_key"/);
});

test("migracija je upisana u journal", async () => {
  const journal = JSON.parse(await read("../../db/migrations/meta/_journal.json"));
  const entry = journal.entries.find((e) => e.tag === "0004_auth_hardening");
  assert.ok(entry, "migracija nije u journalu");
  assert.equal(entry.idx, 4);
});

test("brisanje korisnika povlaci i njegov MFA materijal", () => {
  assert.match(migration, /"user_mfa"[\s\S]{0,200}ON DELETE CASCADE/);
  assert.match(migration, /"mfa_recovery_codes"[\s\S]{0,300}ON DELETE CASCADE/);
});
