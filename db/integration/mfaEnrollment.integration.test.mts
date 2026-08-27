import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import * as OTPAuth from "otpauth";
import {
  cleanupQa,
  closeTestDatabase,
  ensureTestCryptoEnv,
  initTestDatabase,
  seedAccounts,
  skipReason,
  type TestDatabase,
} from "./harness.mts";

/**
 * Drugi faktor, dozvole i rezervni kodovi nad pravom bazom.
 *
 * Tvrdnje koje traže PostgreSQL: da atomski `UPDATE … RETURNING` zaista
 * sprečava ponovnu upotrebu pod paralelnim pozivima, i da poništavanje briše
 * SVE — aktivnu i pending tajnu, kodove i dozvole.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

let db: TestDatabase;

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
});

after(async () => {
  if (!reason && db) await cleanupQa(db);
  await closeTestDatabase();
});

/** Kod iz base32 tajne — isto što korisnik ima u telefonu. */
function totpFor(base32: string, offsetSteps = 0) {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(base32),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

/** Nalog sa aktivnim faktorom; vraća tajnu i rezervne kodove. */
async function enroll(key: string, role = "komercijalista") {
  const { beginMfaEnrollment, confirmMfaEnrollment } = await import("@/lib/auth/mfa-service");
  const a = await seedAccounts(db, [{ key, role }]);
  const setup = await beginMfaEnrollment({ userId: a[key].id, accountLabel: a[key].email });
  const result = await confirmMfaEnrollment({
    userId: a[key].id,
    token: totpFor(setup.base32),
  });
  assert.equal(result.ok, true, "vezivanje nije uspelo");
  return { account: a[key], base32: setup.base32, recoveryCodes: result.recoveryCodes };
}

test("ponovljen TOTP se odbija", async (t) => {
  if (guard(t)) return;
  const { verifyTotpForUser } = await import("@/lib/auth/mfa-service");
  const { account, base32 } = await enroll("mfa1");

  /*
   * Vezivanje je već potrošilo tekući prozor, pa se za prvu proveru uzima
   * sledeći. Isti kod drugi put mora pasti — `last_accepted_counter` raste
   * atomski u samom `UPDATE`.
   */
  const token = totpFor(base32, 1);
  const prvi = await verifyTotpForUser({
    userId: account.id,
    token,
    now: new Date(Date.now() + 30_000),
  });
  const drugi = await verifyTotpForUser({
    userId: account.id,
    token,
    now: new Date(Date.now() + 30_000),
  });

  assert.equal(prvi, true, "ispravan kod nije prihvaćen");
  assert.equal(drugi, false, "ponovljen kod je prošao");
});

test("paralelna upotreba istog TOTP-a prolazi tacno jednom", async (t) => {
  if (guard(t)) return;
  const { verifyTotpForUser } = await import("@/lib/auth/mfa-service");
  const { account, base32 } = await enroll("mfa2");

  const token = totpFor(base32, 1);
  const now = new Date(Date.now() + 30_000);
  const results = await Promise.all([
    verifyTotpForUser({ userId: account.id, token, now }),
    verifyTotpForUser({ userId: account.id, token, now }),
  ]);
  assert.equal(results.filter(Boolean).length, 1, `prošlo ${results.filter(Boolean).length} puta`);
});

test("rezervni kod se trosi tacno jednom, i pod paralelnim pozivima", async (t) => {
  if (guard(t)) return;
  const { consumeRecoveryCode } = await import("@/lib/auth/mfa-service");
  const { account, recoveryCodes } = await enroll("mfa3");

  const kod = recoveryCodes[0];
  const results = await Promise.all([
    consumeRecoveryCode({ userId: account.id, code: kod }),
    consumeRecoveryCode({ userId: account.id, code: kod }),
  ]);
  assert.equal(results.filter(Boolean).length, 1);

  // Treći pokušaj posle svega takođe pada.
  assert.equal(await consumeRecoveryCode({ userId: account.id, code: kod }), false);

  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM mfa_recovery_codes
    WHERE user_id = ${account.id} AND used_at IS NOT NULL
  `;
  assert.equal(count, 1);
});

test("rezervni kodovi u bazi postoje samo kao otisak", async (t) => {
  if (guard(t)) return;
  const { account, recoveryCodes } = await enroll("mfa4");

  const rows = await db.sql<{ code_fingerprint: string }[]>`
    SELECT code_fingerprint FROM mfa_recovery_codes WHERE user_id = ${account.id}
  `;
  assert.equal(rows.length, recoveryCodes.length);
  for (const kod of recoveryCodes) {
    assert.ok(
      !rows.some((r) => r.code_fingerprint.includes(kod)),
      "rezervni kod se nalazi u bazi u čitljivom obliku",
    );
  }
});

test("dozvola za vezivanje se trosi jednom; istekla se odbija", async (t) => {
  if (guard(t)) return;
  const { issueEnrollmentGrant, consumeEnrollmentGrant } = await import(
    "@/lib/auth/enrollment-grant"
  );
  const a = await seedAccounts(db, [{ key: "grant1", role: "komercijalista" }]);

  const { code } = await issueEnrollmentGrant({ userId: a.grant1.id, issuedBy: null });
  const results = await Promise.all([
    consumeEnrollmentGrant({ userId: a.grant1.id, code }),
    consumeEnrollmentGrant({ userId: a.grant1.id, code }),
  ]);
  assert.equal(results.filter(Boolean).length, 1, "dozvola je potrošena više puta");

  // Istekla dozvola.
  const drugi = await issueEnrollmentGrant({ userId: a.grant1.id, issuedBy: null });
  await db.sql`
    UPDATE mfa_enrollment_grants SET expires_at = now() - interval '1 minute'
    WHERE user_id = ${a.grant1.id} AND used_at IS NULL
  `;
  assert.equal(
    await consumeEnrollmentGrant({ userId: a.grant1.id, code: drugi.code }),
    false,
    "istekla dozvola je prošla",
  );
});

test("dozvola jednog naloga ne otvara vezivanje na drugom", async (t) => {
  if (guard(t)) return;
  const { issueEnrollmentGrant, consumeEnrollmentGrant } = await import(
    "@/lib/auth/enrollment-grant"
  );
  const a = await seedAccounts(db, [
    { key: "grant2a", role: "komercijalista" },
    { key: "grant2b", role: "komercijalista" },
  ]);
  const { code } = await issueEnrollmentGrant({ userId: a.grant2a.id, issuedBy: null });
  assert.equal(await consumeEnrollmentGrant({ userId: a.grant2b.id, code }), false);
});

test("ponistavanje faktora brise aktivnu i pending tajnu, kodove i dozvole", async (t) => {
  if (guard(t)) return;
  const { beginMfaEnrollment, resetMfaForUser, readMfaStatus } = await import(
    "@/lib/auth/mfa-service"
  );
  const { issueEnrollmentGrant, revokeEnrollmentGrants, hasOpenEnrollmentGrant } = await import(
    "@/lib/auth/enrollment-grant"
  );
  const { account } = await enroll("mfa5");

  // Uz aktivan faktor napravi i pending tajnu i otvorenu dozvolu.
  await beginMfaEnrollment({ userId: account.id, accountLabel: account.email });
  await issueEnrollmentGrant({ userId: account.id, issuedBy: null });
  assert.equal(await hasOpenEnrollmentGrant(account.id), true);

  await resetMfaForUser({ userId: account.id });
  await revokeEnrollmentGrants(account.id);

  const [row] = await db.sql<
    {
      secret_ciphertext: string | null;
      pending_ciphertext: string | null;
      last_accepted_counter: number | null;
      enrolled_at: Date | null;
    }[]
  >`SELECT secret_ciphertext, pending_ciphertext, last_accepted_counter, enrolled_at
    FROM user_mfa WHERE user_id = ${account.id}`;

  assert.equal(row.secret_ciphertext, null, "aktivna tajna je ostala");
  assert.equal(row.pending_ciphertext, null, "pending tajna je ostala");
  assert.equal(row.last_accepted_counter, null);
  assert.equal(row.enrolled_at, null);

  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM mfa_recovery_codes WHERE user_id = ${account.id}
  `;
  assert.equal(count, 0, "rezervni kodovi su ostali");
  assert.equal(await hasOpenEnrollmentGrant(account.id), false, "dozvola je ostala otvorena");

  const status = await readMfaStatus(account.id);
  assert.equal(status.enabled, false);
});

test("posle ponistavanja korisnik dobija samo enrollment-only pristup", async (t) => {
  if (guard(t)) return;
  const { resetMfaForUser, readMfaStatus } = await import("@/lib/auth/mfa-service");
  const { issueEnrollmentGrant, hasOpenEnrollmentGrant } = await import(
    "@/lib/auth/enrollment-grant"
  );
  const {
    resolvePortalAccess,
    mfaStateFrom,
    ACCESS_ENROLLMENT_ONLY,
    ACCESS_DENIED,
  } = await import("@/lib/auth/mfa-policy.mjs");
  const { account } = await enroll("mfa6");

  await resetMfaForUser({ userId: account.id });

  // Bez dozvole u režimu `enforced` — prijava pada.
  const bezDozvole = resolvePortalAccess({
    mode: "enforced",
    environment: "test",
    accountActive: true,
    mfaState: mfaStateFrom(await readMfaStatus(account.id)),
    factor: "none",
    grantAvailable: await hasOpenEnrollmentGrant(account.id),
  });
  assert.equal(bezDozvole.access, ACCESS_DENIED);

  // Sa novom dozvolom — samo vezivanje, nikad pun portal.
  await issueEnrollmentGrant({ userId: account.id, issuedBy: null });
  const saDozvolom = resolvePortalAccess({
    mode: "enforced",
    environment: "test",
    accountActive: true,
    mfaState: mfaStateFrom(await readMfaStatus(account.id)),
    factor: "none",
    grantAvailable: await hasOpenEnrollmentGrant(account.id),
  });
  assert.equal(saDozvolom.access, ACCESS_ENROLLMENT_ONLY);
});

test("nov set rezervnih kodova obara prethodni", async (t) => {
  if (guard(t)) return;
  const { regenerateRecoveryCodes, consumeRecoveryCode } = await import("@/lib/auth/mfa-service");
  const { account, recoveryCodes } = await enroll("mfa7");

  const stari = recoveryCodes[0];
  const novi = await regenerateRecoveryCodes({ userId: account.id });

  assert.equal(await consumeRecoveryCode({ userId: account.id, code: stari }), false);
  assert.equal(await consumeRecoveryCode({ userId: account.id, code: novi[0] }), true);
});

test("istekla pending tajna se ne moze potvrditi", async (t) => {
  if (guard(t)) return;
  const { beginMfaEnrollment, confirmMfaEnrollment } = await import("@/lib/auth/mfa-service");
  const a = await seedAccounts(db, [{ key: "mfa8", role: "komercijalista" }]);

  const setup = await beginMfaEnrollment({ userId: a.mfa8.id, accountLabel: a.mfa8.email });
  await db.sql`
    UPDATE user_mfa SET pending_expires_at = now() - interval '1 minute'
    WHERE user_id = ${a.mfa8.id}
  `;
  const result = await confirmMfaEnrollment({
    userId: a.mfa8.id,
    token: totpFor(setup.base32),
  });
  assert.equal(result.ok, false, "istekla pending tajna je aktivirana");
});

test("hasOpenEnrollmentGrant vidi vazecu, ne vidi istekulu ni potrosenu", async (t) => {
  if (guard(t)) return;
  const { issueEnrollmentGrant, consumeEnrollmentGrant, hasOpenEnrollmentGrant } =
    await import("@/lib/auth/enrollment-grant");
  const a = await seedAccounts(db, [{ key: "grant3", role: "komercijalista" }]);

  // Bez ijedne dozvole.
  assert.equal(await hasOpenEnrollmentGrant(a.grant3.id), false);

  // Sveža dozvola se vidi. Ovaj upit je ranije padao sa
  // `ERR_INVALID_ARG_TYPE: Received an instance of Date`, jer je `Date` išao u
  // sirov `sql` šablon mimo mapera kolone.
  const prva = await issueEnrollmentGrant({ userId: a.grant3.id, issuedBy: null });
  assert.equal(await hasOpenEnrollmentGrant(a.grant3.id), true);

  // Potrošena se više ne vidi.
  assert.equal(await consumeEnrollmentGrant({ userId: a.grant3.id, code: prva.code }), true);
  assert.equal(await hasOpenEnrollmentGrant(a.grant3.id), false);

  // Istekla se ne vidi.
  await issueEnrollmentGrant({ userId: a.grant3.id, issuedBy: null });
  assert.equal(await hasOpenEnrollmentGrant(a.grant3.id), true);
  await db.sql`
    UPDATE mfa_enrollment_grants SET expires_at = now() - interval '1 minute'
    WHERE user_id = ${a.grant3.id} AND used_at IS NULL
  `;
  assert.equal(await hasOpenEnrollmentGrant(a.grant3.id), false);
});

test("dozvola drugog naloga se ne vidi kao svoja", async (t) => {
  if (guard(t)) return;
  const { issueEnrollmentGrant, hasOpenEnrollmentGrant } = await import(
    "@/lib/auth/enrollment-grant"
  );
  const a = await seedAccounts(db, [
    { key: "grant4a", role: "komercijalista" },
    { key: "grant4b", role: "komercijalista" },
  ]);
  await issueEnrollmentGrant({ userId: a.grant4a.id, issuedBy: null });
  assert.equal(await hasOpenEnrollmentGrant(a.grant4a.id), true);
  assert.equal(await hasOpenEnrollmentGrant(a.grant4b.id), false);
});

test("posle MFA reseta nova dozvola je vidljiva", async (t) => {
  if (guard(t)) return;
  const { resetMfaForUser } = await import("@/lib/auth/mfa-service");
  const { issueEnrollmentGrant, revokeEnrollmentGrants, hasOpenEnrollmentGrant } =
    await import("@/lib/auth/enrollment-grant");
  const { account } = await enroll("mfa9");

  await resetMfaForUser({ userId: account.id });
  await revokeEnrollmentGrants(account.id);
  assert.equal(await hasOpenEnrollmentGrant(account.id), false);

  await issueEnrollmentGrant({ userId: account.id, issuedBy: null });
  assert.equal(await hasOpenEnrollmentGrant(account.id), true);
});
