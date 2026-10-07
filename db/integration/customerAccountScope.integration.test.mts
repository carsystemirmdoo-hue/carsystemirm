import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import {
  cleanupQa, closeTestDatabase, initTestDatabase, seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Spisak naloga kupaca poštuje opseg komercijaliste.
 *
 * Regresija (audit 2026-10-01): `/portal/kupci/nalozi` je zvao
 * `listCustomerAccounts()` bez opsega, pa je komercijalista sa paketom
 * „kupacki_nalozi_predlog" u odgovoru strane dobijao imena, e-adrese i
 * razloge odluka za kontakte SVIH kupaca.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) { t.skip(reason); return true; }
  return false;
};

let db: TestDatabase;
let rep: { id: string; role: string };
let idleRep: { id: string; role: string };
let office: { id: string; role: string };
let customerA: string;
let customerB: string;
const run = randomUUID().slice(0, 8);

before(async () => {
  if (reason) return;
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [
    { key: "rep", role: "komercijalista" },
    { key: "idle", role: "komercijalista" },
    { key: "office", role: "kancelarija" },
  ]);
  rep = { id: accounts.rep.id, role: "komercijalista" };
  idleRep = { id: accounts.idle.id, role: "komercijalista" };
  office = { id: accounts.office.id, role: "kancelarija" };

  const [a] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}a`}, 'QA Kupac A') RETURNING id`;
  const [b] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}b`}, 'QA Kupac B') RETURNING id`;
  customerA = a.id;
  customerB = b.id;
  for (const [customerId, tag] of [[customerA, "a"], [customerB, "b"]] as const) {
    await db.sql`
      INSERT INTO customer_users (customer_id, email, name, password_hash, status)
      VALUES (${customerId}, ${`qa1bverify-${run}-${tag}@qa-1b.invalid`}, ${`QA ${tag}`}, 'x', 'active')`;
  }
  await db.sql`INSERT INTO customer_assignments (user_id, customer_id) VALUES (${rep.id}, ${customerA})`;
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM customer_assignments WHERE customer_id IN (${customerA}, ${customerB})`;
    await db.sql`DELETE FROM customer_users WHERE email LIKE ${`qa1bverify-${run}-%`}`;
    await db.sql`DELETE FROM customers WHERE id IN (${customerA}, ${customerB})`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const viewer = (u: { id: string; role: string }, permissions: string[] = []) =>
  ({ id: u.id, role: u.role as "komercijalista" | "kancelarija", permissions });

test("komercijalista vidi samo naloge dodeljenih kupaca", async (t) => {
  if (guard(t)) return;
  const { listCustomerAccounts } = await import("@/lib/customers/account-service");
  const rows = await listCustomerAccounts(viewer(rep, ["kupacki_nalozi_predlog"]));
  const mine = rows.filter((r) => r.customerId === customerA || r.customerId === customerB);
  assert.deepEqual(mine.map((r) => r.customerId), [customerA]);
});

test("komercijalista bez dodela dobija prazan spisak, ne sve", async (t) => {
  if (guard(t)) return;
  const { listCustomerAccounts } = await import("@/lib/customers/account-service");
  assert.deepEqual(await listCustomerAccounts(viewer(idleRep, ["kupacki_nalozi_predlog"])), []);
});

test("kancelarija (customers:view_all) vidi oba kupca", async (t) => {
  if (guard(t)) return;
  const { listCustomerAccounts } = await import("@/lib/customers/account-service");
  const rows = await listCustomerAccounts(viewer(office));
  const ids = new Set(rows.map((r) => r.customerId));
  assert.ok(ids.has(customerA) && ids.has(customerB));
});
