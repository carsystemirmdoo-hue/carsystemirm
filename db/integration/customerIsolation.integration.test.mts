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
 * Izolacija kupca, nad stvarnim PostgreSQL-om.
 *
 * Jedinični testovi dokazuju pravila (`lib/authz/customerIsolation.test.mjs`).
 * Ovde se dokazuje ono što pravila ne mogu: da su ograničenja stvarno u bazi i
 * da produkcijski upit sa opsegom iz sesije ne vraća tuđe redove — čak i kada
 * pozivalac pokuša da traži drugog kupca.
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
  if (!reason && db) {
    // Kupčevi nalozi i njihovi dokumenti idu pre `cleanupQa`, jer nose strane
    // ključeve ka `customers` i `users`.
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (
      SELECT id FROM invoices WHERE customer_id IN (
        SELECT id FROM customers WHERE pib LIKE 'QA%'))`;
    await db.sql`DELETE FROM invoices WHERE customer_id IN (
      SELECT id FROM customers WHERE pib LIKE 'QA%')`;
    await db.sql`DELETE FROM customer_users WHERE email LIKE 'qa1bverify-%'`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code LIKE 'QA%'`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

/** Dva kupca, svaki sa svojim nalogom i svojim dokumentom. */
async function seedTwoCustomers() {
  const run = randomUUID().slice(0, 8);
  const made: Record<string, { customerId: string; accountId: string }> = {};

  for (const key of ["a", "b"]) {
    const [customer] = await db.sql<{ id: string }[]>`
      INSERT INTO customers (pib, name, city)
      VALUES (${`QA${run}${key}`}, ${`QA Kupac ${key.toUpperCase()}`}, 'Inđija')
      RETURNING id
    `;
    const [account] = await db.sql<{ id: string }[]>`
      INSERT INTO customer_users (customer_id, email, name, password_hash, status)
      VALUES (
        ${customer.id},
        ${`qa1bverify-${run}-${key}@qa-1b.invalid`},
        ${`QA nalog ${key}`},
        'x',
        'active'
      )
      RETURNING id
    `;
    await db.sql`
      INSERT INTO invoices (
        company_id, document_kind, number, year, issued_on,
        customer_id, net_amount, total_amount
      )
      VALUES ('01', 'faktura', ${`${run}-${key}`}, 2026, '2026-01-15',
              ${customer.id}, '1000.00', '1200.00')
    `;
    made[key] = { customerId: customer.id, accountId: account.id };
  }
  return made;
}

test("kupac A ne vidi nijedan dokument kupca B", async (t) => {
  if (guard(t)) return;
  const { loadCustomerDocuments } = await import("@/lib/customers/customer-queries");
  const seeded = await seedTwoCustomers();

  const zaA = await loadCustomerDocuments(seeded.a.customerId);
  const zaB = await loadCustomerDocuments(seeded.b.customerId);

  assert.equal(zaA.length, 1);
  assert.equal(zaB.length, 1);
  assert.notEqual(zaA[0].id, zaB[0].id);

  const idsA = new Set(zaA.map((row) => row.id));
  for (const row of zaB) {
    assert.ok(!idsA.has(row.id), "dokument kupca B se pojavio u opsegu kupca A");
  }
});

test("promena trazenog ID-a ne menja opseg — vraca se ID iz sesije", async (t) => {
  if (guard(t)) return;
  const { resolveCustomerScope } = await import("@/lib/authz/customer-scope.mjs");
  const { loadCustomerDocuments } = await import("@/lib/customers/customer-queries");
  const seeded = await seedTwoCustomers();

  // Kupac A pokušava da traži kupca B.
  const scope = resolveCustomerScope({
    sessionCustomerId: seeded.a.customerId,
    requestedCustomerId: seeded.b.customerId,
  });
  assert.equal(scope.refused, true);
  assert.equal(scope.customerId, seeded.a.customerId);

  // Upit sa razrešenim opsegom vraća isključivo dokumente kupca A.
  const rows = await loadCustomerDocuments(scope.customerId);
  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM invoices WHERE customer_id = ${seeded.a.customerId}
  `;
  assert.equal(rows.length, count);
});

test("prazan customer_id ne moze da izvrsi upit", async (t) => {
  if (guard(t)) return;
  const { loadCustomerDocuments } = await import("@/lib/customers/customer-queries");
  await assert.rejects(() => loadCustomerDocuments(""), /bez customer_id/);
});

test("kupcev nalog ne postoji u internoj tabeli korisnika", async (t) => {
  if (guard(t)) return;
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const seeded = await seedTwoCustomers();

  /*
   * Ovo je strukturna garancija, ne provera koda: `loadPortalUser` gleda
   * tabelu `users`, a kupčev ID postoji samo u `customer_users`. Zato kupčev
   * token kroz internu kapiju ne može da dobije NIŠTA, čak i kada bi neko
   * zaboravio da proveri `subject`.
   */
  assert.equal(await loadPortalUser(seeded.a.accountId), null);
});

test("e-posta kupca je jedinstvena preko cele tabele", async (t) => {
  if (guard(t)) return;
  const seeded = await seedTwoCustomers();
  const email = `qa1bverify-dupl-${randomUUID().slice(0, 8)}@qa-1b.invalid`;

  await db.sql`
    INSERT INTO customer_users (customer_id, email, name, password_hash, status)
    VALUES (${seeded.a.customerId}, ${email}, 'A', 'x', 'active')
  `;

  await assert.rejects(
    () => db.sql`
      INSERT INTO customer_users (customer_id, email, name, password_hash, status)
      VALUES (${seeded.b.customerId}, ${email}, 'B', 'x', 'active')
    `,
    /duplicate key|customer_users_email_key/,
    "ista adresa je otvorila nalog kod druge firme",
  );
});

test("iskljucen nalog mora imati razlog — baza to sprovodi", async (t) => {
  if (guard(t)) return;
  const seeded = await seedTwoCustomers();

  await assert.rejects(
    () => db.sql`
      UPDATE customer_users SET status = 'suspended', decision_reason = NULL
      WHERE id = ${seeded.a.accountId}
    `,
    /customer_users_decision_reason_ck/,
  );
});

test("adresa se ne moze upisati velikim slovima", async (t) => {
  if (guard(t)) return;
  const seeded = await seedTwoCustomers();

  await assert.rejects(
    () => db.sql`
      INSERT INTO customer_users (customer_id, email, name, password_hash, status)
      VALUES (${seeded.a.customerId}, 'QA1BVERIFY-UPPER@QA-1B.INVALID', 'A', 'x', 'active')
    `,
    /customer_users_email_lowercase_ck/,
  );
});

test("interni nalozi i dalje rade nepromenjeno", async (t) => {
  if (guard(t)) return;
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const accounts = await seedAccounts(db, [{ key: "gazda", role: "gazda" }]);

  const user = await loadPortalUser(accounts.gazda.id);
  assert.ok(user, "interni nalog se vise ne ucitava");
  assert.equal(user.role, "gazda");
});
