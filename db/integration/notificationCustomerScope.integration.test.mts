import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
 * Obaveštenje vezano za kupca (0063).
 *
 * Komercijalista dobija upit SVOG kupca, a ne vidi upit tuđeg — ni u listi, ni
 * u broju na zvoncu, ni pogađanjem ID-a. Kancelarija i vlasnik vide sve.
 * Obaveštenje bez kupca ponaša se kao pre 0063.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

type Account = { id: string; name: string; role: string };
let db: TestDatabase;
let fx: { mine: string; other: string; repA: Account; repB: Account; office: Account; owner: Account };

const portalUser = (a: Account) => ({
  id: a.id,
  email: `${a.id}@qa-1b.invalid`,
  name: a.name,
  initials: "QA",
  role: a.role as "gazda" | "komercijalista" | "kancelarija" | "magacioner",
  active: true,
  sessionVersion: 0,
  permissions: [] as string[],
});

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const run = randomUUID().slice(0, 8);
  const [mine] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}a`}, 'QA Kupac A') RETURNING id`;
  const [other] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}b`}, 'QA Kupac B') RETURNING id`;
  const accounts = await seedAccounts(db, [
    { key: "repA", role: "komercijalista" },
    { key: "repB", role: "komercijalista" },
    { key: "office", role: "kancelarija" },
    { key: "owner", role: "gazda" },
  ]);
  await db.sql`
    INSERT INTO customer_assignments (user_id, customer_id) VALUES (${accounts.repA.id}, ${mine.id})`;
  fx = { mine: mine.id, other: other.id, ...accounts };
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM notifications`;
    await db.sql`DELETE FROM customer_assignments`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

async function emit(customerId: string | null, key: string) {
  const { notify } = await import("@/lib/notifications/notification-service");
  await notify({
    kind: "customer_price_request_submitted",
    requiredCapability: "price_requests:handle",
    customerId,
    title: `Upit ${key}`,
    body: "QA",
    entityType: "Upit za cenu",
    entityId: key,
    dedupeKey: `qa-scope:${key}`,
  });
  const [row] = await db.sql<{ id: number }[]>`SELECT id::int AS id FROM notifications WHERE entity_id = ${key}`;
  return row.id;
}

test("komercijalista vidi upit svog kupca, ne tuđeg; kancelarija i vlasnik vide oba", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/notifications/notification-service");
  await emit(fx.mine, "moj");
  await emit(fx.other, "tudj");
  await emit(null, "bez-kupca");

  const seen = async (a: Account) =>
    (await svc.listNotificationsFor(portalUser(a))).map((r) => r.entityId).filter((id) => ["moj", "tudj", "bez-kupca"].includes(id ?? "")).sort();

  assert.deepEqual(await seen(fx.repA), ["bez-kupca", "moj"]);
  assert.deepEqual(await seen(fx.repB), ["bez-kupca"], "komercijalista bez dodele ne vidi upit kupca");
  assert.deepEqual(await seen(fx.office), ["bez-kupca", "moj", "tudj"]);
  assert.deepEqual(await seen(fx.owner), ["bez-kupca", "moj", "tudj"]);

  assert.equal(await svc.countUnreadFor(portalUser(fx.repA)), 2);
  assert.equal(await svc.countUnreadFor(portalUser(fx.repB)), 1);
});

test("tuđe obaveštenje o kupcu se ne može označiti ni zatvoriti pogađanjem ID-a", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/notifications/notification-service");
  const id = await emit(fx.mine, "pogadjanje");
  assert.equal(await svc.markNotificationRead(portalUser(fx.repB), id), false);
  assert.equal(await svc.resolveNotification(portalUser(fx.repB), id, "nije moje"), false);
  assert.equal(await svc.markNotificationRead(portalUser(fx.repA), id), true);
});
