import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
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
 * Trag revizije nad pravom bazom.
 *
 * Dve stvari se ne mogu dokazati bez PostgreSQL-a: da okidači STVARNO odbijaju
 * izmenu i brisanje, i da nijedna tajna ne završi ni u jednoj koloni zapisa.
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

test("zapis nosi izvrsioca, metu, radnju i vreme", async (t) => {
  if (guard(t)) return;
  const { recordAudit, AUDIT_ACTIONS } = await import("@/lib/audit/record");
  const a = await seedAccounts(db, [
    { key: "aud1actor", role: "gazda" },
    { key: "aud1target", role: "komercijalista" },
  ]);

  await recordAudit({
    actor: { id: a.aud1actor.id, name: a.aud1actor.name, role: a.aud1actor.role },
    action: AUDIT_ACTIONS.passwordResetIssued,
    entityType: "Korisnik",
    entityId: a.aud1target.id,
    entityLabel: a.aud1target.email,
    reason: "QA provera sadržaja traga",
  });

  /*
   * Kanonska imena kolona su `actor_user_id` i `actor_label` (vidi
   * `db/schema/system.ts`). Raniji test je čitao `actor_id` — ime koje ne
   * postoji. Ispravlja se TEST; produkcijska kolona se ne preimenuje da bi
   * pogrešna tvrdnja prošla.
   */
  const [row] = await db.sql<
    {
      actor_user_id: string;
      actor_label: string;
      action: string;
      entity_id: string;
      entity_label: string;
      created_at: Date;
    }[]
  >`SELECT actor_user_id, actor_label, action, entity_id, entity_label, created_at
    FROM audit_log WHERE entity_id = ${a.aud1target.id} ORDER BY created_at DESC LIMIT 1`;

  assert.ok(row, "zapis nije nastao");
  assert.equal(row.actor_user_id, a.aud1actor.id);
  assert.ok(row.actor_label.length > 0, "ime izvršioca nije zapisano");
  assert.equal(row.entity_id, a.aud1target.id);
  assert.equal(row.action, AUDIT_ACTIONS.passwordResetIssued);
  assert.equal(row.entity_label, a.aud1target.email);
  assert.ok(row.created_at instanceof Date);
  assert.ok(Date.now() - row.created_at.getTime() < 60_000, "vreme zapisa nije aktuelno");
});

test("izmena zapisa je odbijena na nivou baze", async (t) => {
  if (guard(t)) return;
  const { recordAudit, AUDIT_ACTIONS } = await import("@/lib/audit/record");
  const a = await seedAccounts(db, [{ key: "aud2", role: "gazda" }]);

  await recordAudit({
    actor: { id: a.aud2.id, name: a.aud2.name, role: a.aud2.role },
    action: AUDIT_ACTIONS.mfaReset,
    entityType: "Korisnik",
    entityId: a.aud2.id,
    entityLabel: a.aud2.email,
    reason: "QA provera nepromenljivosti",
  });

  /*
   * Okidač u bazi, ne provera u aplikaciji.
   *
   * Zaštita u kodu štiti od greške u kodu. Ne štiti od naloga koji sme da
   * izvrši `UPDATE` — a upravo to bi napadač i pokušao da obriše svoj trag.
   */
  await assert.rejects(
    db.sql`UPDATE audit_log SET reason = 'izmenjeno' WHERE entity_id = ${a.aud2.id}`,
    /restrict|not allowed|nije dozvoljen|append/i,
  );
  await assert.rejects(
    db.sql`DELETE FROM audit_log WHERE entity_id = ${a.aud2.id}`,
    /restrict|not allowed|nije dozvoljen|append/i,
  );
});

test("nijedna tajna ne zavrsava u tragu", async (t) => {
  if (guard(t)) return;
  const { recordAudit, AUDIT_ACTIONS } = await import("@/lib/audit/record");
  const { issuePasswordResetCode } = await import("@/lib/auth/password-reset");
  const { issueEnrollmentGrant } = await import("@/lib/auth/enrollment-grant");
  const { beginMfaEnrollment, confirmMfaEnrollment } = await import("@/lib/auth/mfa-service");
  const OTPAuth = await import("otpauth");

  const a = await seedAccounts(db, [{ key: "aud3", role: "komercijalista" }]);

  // Napravi sve vrste tajni koje sistem uopšte izdaje.
  const reset = await issuePasswordResetCode({ userId: a.aud3.id, issuedBy: null });
  const grant = await issueEnrollmentGrant({ userId: a.aud3.id, issuedBy: null });
  const setup = await beginMfaEnrollment({ userId: a.aud3.id, accountLabel: a.aud3.email });
  const token = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(setup.base32),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  }).generate();
  const enrolled = await confirmMfaEnrollment({ userId: a.aud3.id, token });
  assert.equal(enrolled.ok, true);

  for (const action of [
    AUDIT_ACTIONS.passwordResetIssued,
    AUDIT_ACTIONS.mfaGrantIssued,
    AUDIT_ACTIONS.mfaEnabled,
    AUDIT_ACTIONS.recoveryCodesRegenerated,
    AUDIT_ACTIONS.sessionsRevoked,
  ]) {
    await recordAudit({
      actor: { id: a.aud3.id, name: a.aud3.name, role: a.aud3.role },
      action,
      entityType: "Korisnik",
      entityId: a.aud3.id,
      entityLabel: a.aud3.email,
      reason: "QA provera odsustva tajni",
    });
  }

  // Ceo red kao tekst, ne samo kolone za koje se sećamo da postoje.
  const rows = await db.sql<{ payload: string }[]>`
    SELECT row_to_json(audit_log)::text AS payload FROM audit_log
    WHERE entity_id = ${a.aud3.id}
  `;
  assert.ok(rows.length >= 5, `očekivano bar 5 zapisa, nađeno ${rows.length}`);

  const tajne = [
    reset.code,
    grant.code,
    setup.base32,
    token,
    a.aud3.password,
    ...enrolled.recoveryCodes,
  ];

  for (const row of rows) {
    for (const tajna of tajne) {
      assert.ok(
        !row.payload.includes(tajna),
        `tajna je završila u tragu revizije (akcija: ${row.payload.slice(0, 120)}…)`,
      );
    }
    // Ni šifrovani materijal ne sme u trag.
    assert.ok(!/secret_ciphertext|code_fingerprint/i.test(row.payload));
  }
});

test("korisnik iz traga se ne moze obrisati, a trag ostaje identican", async (t) => {
  if (guard(t)) return;
  const { recordAudit, AUDIT_ACTIONS } = await import("@/lib/audit/record");
  const a = await seedAccounts(db, [{ key: "aud4", role: "komercijalista" }]);

  await recordAudit({
    actor: { id: a.aud4.id, name: a.aud4.name, role: a.aud4.role },
    action: AUDIT_ACTIONS.userDeactivated,
    entityType: "Korisnik",
    entityId: a.aud4.id,
    entityLabel: a.aud4.email,
    reason: "QA provera ugovora o brisanju",
  });

  const [pre] = await db.sql<{ payload: string }[]>`
    SELECT row_to_json(audit_log)::text AS payload FROM audit_log
    WHERE actor_user_id = ${a.aud4.id}
  `;
  assert.ok(pre, "trag nije nastao");

  /*
   * Ugovor: interni nalog koji figurira u tragu se NE briše.
   *
   * Ranije je FK imao `ON DELETE SET NULL`, pa je brisanje pokretalo izmenu
   * koju append-only okidač odbija — model je protivrečio sam sebi. Sada baza
   * odbija samo brisanje, izričito, i trag ostaje netaknut.
   *
   * Za prestanak rada postoje deaktivacija i reaktivacija.
   */
  await assert.rejects(
    db.sql`DELETE FROM users WHERE id = ${a.aud4.id}`,
    /foreign key|violates|restrict/i,
    "brisanje korisnika iz traga nije odbijeno",
  );

  const [post] = await db.sql<{ payload: string }[]>`
    SELECT row_to_json(audit_log)::text AS payload FROM audit_log
    WHERE actor_user_id = ${a.aud4.id}
  `;
  assert.equal(post.payload, pre.payload, "trag je izmenjen");

  // Deaktivacija je dozvoljen put i ne dira trag.
  await db.sql`UPDATE users SET active = false WHERE id = ${a.aud4.id}`;
  const [posleDeaktivacije] = await db.sql<{ payload: string }[]>`
    SELECT row_to_json(audit_log)::text AS payload FROM audit_log
    WHERE actor_user_id = ${a.aud4.id}
  `;
  assert.equal(posleDeaktivacije.payload, pre.payload, "deaktivacija je promenila trag");
});

test("strani kljuc iz traga koristi RESTRICT, ne SET NULL", async (t) => {
  if (guard(t)) return;
  const [fk] = await db.sql<{ delete_rule: string }[]>`
    SELECT rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_name = 'audit_log' AND tc.constraint_type = 'FOREIGN KEY'
  `;
  assert.ok(fk, "FK ka korisniku ne postoji");
  // `SET NULL` bi značio izmenu traga, a nad njim stoji zabrana izmene.
  assert.equal(fk.delete_rule, "RESTRICT");
});

test("runtime rola nema TRUNCATE nad tragom", async (t) => {
  if (guard(t)) return;
  const provisioning = await readFile(
    new URL("../provisioning/runtime-role.sql", import.meta.url),
    "utf8",
  );
  // Reset u QA prolazu koristi TRUNCATE, ali kao vlasnik baze — nikad kroz
  // aplikacionu rolu. Ovo drži tu granicu.
  assert.match(provisioning, /REVOKE[^;]*TRUNCATE[^;]*audit_log/i);
  assert.ok(!/GRANT[^;]*TRUNCATE/i.test(provisioning), "runtime rola dobija TRUNCATE");
});
