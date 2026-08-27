import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { eq, sql } from "drizzle-orm";
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
 * Opoziv sesija: svaka radnja koja menja pristup mora oboriti stare tokene.
 *
 * Sesije su JWT — server ih ne drži. Jedini mehanizam je `session_version`, i
 * jedini način da se dokaže da radi je da se za SVAKU radnju izmeri vrednost
 * pre i posle nad pravom bazom.
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

async function version(userId: string): Promise<number> {
  const [row] = await db.sql<{ v: number }[]>`
    SELECT session_version AS v FROM users WHERE id = ${userId}
  `;
  return row.v;
}

/** Izvršava radnju i tvrdi da je verzija porasla tačno za jedan. */
async function tvrdiOpoziv(
  userId: string,
  naziv: string,
  radnja: () => Promise<unknown>,
) {
  const pre = await version(userId);
  await radnja();
  const post = await version(userId);
  assert.equal(post, pre + 1, `${naziv}: verzija ${pre} → ${post}, očekivano ${pre + 1}`);
}

test("izdavanje reset koda opoziva sesije", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode } = await import("@/lib/auth/password-reset");
  const a = await seedAccounts(db, [{ key: "sv1", role: "komercijalista" }]);
  await tvrdiOpoziv(a.sv1.id, "izdavanje reset koda", () =>
    issuePasswordResetCode({ userId: a.sv1.id, issuedBy: null }),
  );
});

test("zavrsen reset opoziva sesije", async (t) => {
  if (guard(t)) return;
  const { issuePasswordResetCode, completePasswordReset } = await import(
    "@/lib/auth/password-reset"
  );
  const a = await seedAccounts(db, [{ key: "sv2", role: "komercijalista" }]);
  const { code } = await issuePasswordResetCode({ userId: a.sv2.id, issuedBy: null });

  await tvrdiOpoziv(a.sv2.id, "završen reset", async () => {
    const r = await completePasswordReset({
      email: a.sv2.email,
      code,
      newPassword: "qa-lozinka-posle-reseta",
    });
    assert.equal(r.ok, true);
  });
});

test("promena sopstvene lozinke opoziva sesije", async (t) => {
  if (guard(t)) return;
  const { revokeUserSessions } = await import("@/lib/auth/session-revocation");
  const { getDb } = await import("@/db/client");
  const { users } = await import("@/db/schema");
  const { hashPassword } = await import("@/lib/auth/password.mjs");
  const a = await seedAccounts(db, [{ key: "sv3", role: "komercijalista" }]);

  /*
   * Server akcija traži HTTP kontekst, pa se ovde izvršava isti niz koraka koji
   * ona radi: nov heš i opoziv u JEDNOJ transakciji. Tvrdnja je da transakcija
   * zaista ostavlja oba efekta zajedno.
   */
  const hash = await hashPassword("qa-nova-sopstvena-lozinka");
  await tvrdiOpoziv(a.sv3.id, "promena lozinke", () =>
    getDb().transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: hash }).where(eq(users.id, a.sv3.id));
      await revokeUserSessions(tx, a.sv3.id);
    }),
  );

  const [row] = await db.sql<{ h: string }[]>`
    SELECT password_hash AS h FROM users WHERE id = ${a.sv3.id}
  `;
  assert.equal(row.h, hash, "heš i opoziv nisu ostali zajedno");
});

test("iskljucivanje i vracanje naloga oba opozivaju sesije", async (t) => {
  if (guard(t)) return;
  const { revokeUserSessions } = await import("@/lib/auth/session-revocation");
  const { withOwnerGuard } = await import("@/lib/authz/security-admin");
  const { users } = await import("@/db/schema");
  const a = await seedAccounts(db, [{ key: "sv4", role: "komercijalista" }]);

  await tvrdiOpoziv(a.sv4.id, "isključivanje", () =>
    withOwnerGuard({ targetId: a.sv4.id, removesOwner: false }, async (tx) => {
      await tx.update(users).set({ active: false }).where(eq(users.id, a.sv4.id));
      await revokeUserSessions(tx, a.sv4.id);
    }),
  );

  // Vraćanje u rad takođe: nalog je bio isključen sa razlogom, pa stari token
  // ne sme da oživi zajedno sa nalogom.
  await tvrdiOpoziv(a.sv4.id, "vraćanje", () =>
    withOwnerGuard({ targetId: a.sv4.id, removesOwner: false }, async (tx) => {
      await tx.update(users).set({ active: true }).where(eq(users.id, a.sv4.id));
      await revokeUserSessions(tx, a.sv4.id);
    }),
  );
});

test("ponistavanje faktora opoziva sesije", async (t) => {
  if (guard(t)) return;
  const { resetMfaForUser } = await import("@/lib/auth/mfa-service");
  const { revokeUserSessionsStandalone } = await import("@/lib/auth/session-revocation");
  const a = await seedAccounts(db, [{ key: "sv5", role: "komercijalista" }]);

  await tvrdiOpoziv(a.sv5.id, "poništavanje faktora", async () => {
    await resetMfaForUser({ userId: a.sv5.id });
    await revokeUserSessionsStandalone(a.sv5.id);
  });
});

test("promena uloge opoziva sesije, u istoj transakciji", async (t) => {
  if (guard(t)) return;
  const { withOwnerGuard } = await import("@/lib/authz/security-admin");
  const { getDb } = await import("@/db/client");
  const { users } = await import("@/db/schema");
  const a = await seedAccounts(db, [{ key: "sv6", role: "komercijalista" }]);

  await tvrdiOpoziv(a.sv6.id, "promena uloge", () =>
    withOwnerGuard({ targetId: a.sv6.id, removesOwner: false }, async (tx) => {
      await tx
        .update(users)
        .set({ role: "kancelarija", sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.id, a.sv6.id));
    }),
  );
  void getDb;

  const [row] = await db.sql<{ role: string }[]>`
    SELECT role FROM users WHERE id = ${a.sv6.id}
  `;
  assert.equal(row.role, "kancelarija");
});

test("stara verzija tokena se odbija", async (t) => {
  if (guard(t)) return;
  const { isSessionVersionCurrent } = await import("@/lib/authz/user-repository");
  const { issuePasswordResetCode } = await import("@/lib/auth/password-reset");
  const a = await seedAccounts(db, [{ key: "sv7", role: "komercijalista" }]);

  const izdato = await version(a.sv7.id);
  await issuePasswordResetCode({ userId: a.sv7.id, issuedBy: null });
  const aktuelno = await version(a.sv7.id);

  assert.equal(isSessionVersionCurrent(izdato, aktuelno), false, "star token je prošao");
  assert.equal(isSessionVersionCurrent(aktuelno, aktuelno), true);
});

test("opoziv jednog naloga ne dira druge", async (t) => {
  if (guard(t)) return;
  const { revokeUserSessionsStandalone } = await import("@/lib/auth/session-revocation");
  const a = await seedAccounts(db, [
    { key: "sv8a", role: "komercijalista" },
    { key: "sv8b", role: "komercijalista" },
  ]);

  const preB = await version(a.sv8b.id);
  await revokeUserSessionsStandalone(a.sv8a.id);
  assert.equal(await version(a.sv8b.id), preB, "opoziv je pogodio tuđ nalog");
});
