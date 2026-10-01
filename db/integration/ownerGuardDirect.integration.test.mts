import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { eq, sql } from "drizzle-orm";
import {
  cleanupQa, closeTestDatabase, countActiveOwners, ensureTestCryptoEnv, initTestDatabase,
  isolateOwners, seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Zaštita poslednjeg Vlasnika kroz POSEBNU direktnu vezu (`DATABASE_DIRECT_URL`).
 *
 * `ownerGuard.integration.test.mts` dokazuje bravu i prebrojavanje, ali kroz
 * glavnu vezu: harness namerno briše `DATABASE_DIRECT_URL`. Ovde se posle
 * provere mete direktna veza ponovo uključuje — ista test baza, druga adresa
 * (drugi `application_name`), pa `getDirectDb()` otvara ZASEBAN pool, kao na
 * Vercelu gde je `DATABASE_URL` pooled, a `DATABASE_DIRECT_URL` direktan.
 *
 * Nalozi su sintetički (`seedAccounts`); nijedan stvaran nalog se ne dira.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) { t.skip(reason); return true; }
  return false;
};

const DIRECT_APP = "owner-guard-direct";
let db: TestDatabase;

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  // Posle initTestDatabase (koji je briše): ista meta, prepoznatljiva veza.
  const direct = new URL(process.env.TEST_DATABASE_URL!);
  direct.searchParams.set("application_name", DIRECT_APP);
  process.env.DATABASE_DIRECT_URL = direct.toString();
});

after(async () => {
  if (!reason && db) {
    delete process.env.DATABASE_DIRECT_URL;
    const { closeDb } = await import("@/db/client");
    // Zatvara samo direktni pool; glavnu instancu je podmetnuo harness.
    await closeDb(1);
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

async function owners(keys: string[]) {
  const accounts = await seedAccounts(db, keys.map((key) => ({ key, role: "gazda" })));
  const ids = keys.map((k) => accounts[k].id);
  await isolateOwners(db, ids);
  assert.equal(await countActiveOwners(db), ids.length, "preduslov: tačan broj aktivnih vlasnika");
  return ids;
}

test("transakcija zaštite ide kroz zaseban direktni pool, ne kroz glavnu vezu", async (t) => {
  if (guard(t)) return;
  const { withOwnerGuard } = await import("@/lib/authz/security-admin");
  const [id] = await owners(["direct-one"]);
  const seen = await withOwnerGuard({ targetId: id, removesOwner: false }, async (tx) => {
    const [row] = (await tx.execute(sql`SELECT current_setting('application_name') AS app`)) as unknown as {
      app: string;
    }[];
    return row.app;
  });
  assert.equal(seen, DIRECT_APP);
});

test("poslednji aktivni Vlasnik se ne može isključiti (direktna veza)", async (t) => {
  if (guard(t)) return;
  const { withOwnerGuard, SecurityActionError, removesActiveOwner } = await import("@/lib/authz/security-admin");
  const { users } = await import("@/db/schema");
  const [id] = await owners(["direct-last"]);
  await assert.rejects(
    withOwnerGuard(
      { targetId: id, removesOwner: removesActiveOwner({ role: "gazda", active: true }, { nextActive: false }) },
      async (tx) => tx.update(users).set({ active: false }).where(eq(users.id, id)),
    ),
    (error: unknown) => error instanceof SecurityActionError && /poslednji aktivan nalog/i.test((error as Error).message),
  );
  const [row] = await db.sql<{ active: boolean }[]>`SELECT active FROM users WHERE id = ${id}`;
  assert.equal(row.active, true, "nalog je ostao aktivan");
});

test("dve istovremene promene uloge poslednja dva Vlasnika — prolazi tačno jedna (direktna veza)", async (t) => {
  if (guard(t)) return;
  const { withOwnerGuard, SecurityActionError, removesActiveOwner } = await import("@/lib/authz/security-admin");
  const { users } = await import("@/db/schema");
  const ids = await owners(["direct-a", "direct-b"]);
  const demote = (id: string) =>
    withOwnerGuard(
      { targetId: id, removesOwner: removesActiveOwner({ role: "gazda", active: true }, { nextRole: "kancelarija" }) },
      async (tx) => {
        await tx.execute(sql`SELECT pg_sleep(0.3)`);
        await tx.update(users).set({ role: "kancelarija" }).where(eq(users.id, id));
      },
    );
  const results = await Promise.allSettled(ids.map(demote));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof SecurityActionError);
  assert.equal(await countActiveOwners(db), 1, "ostao je tačno jedan aktivan Vlasnik");
});
