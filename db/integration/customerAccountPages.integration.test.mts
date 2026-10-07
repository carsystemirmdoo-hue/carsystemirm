import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, initTestDatabase, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Kupčev nalog (F5): firma A nikad ne dobija dokument firme B — ni direktnim
 * ID-jem iz adrese, ni pretragom po broju, ni kroz pregled.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const ISSUER = "QA-NALOG";
let db: TestDatabase;
const firm = { a: "", b: "" };
const inv = { a: "", b: "", bNumber: "" };

async function invoice(customerId: string, number: string, issuedOn: string, article: string) {
  const [i] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, tax_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${number}, 2026, ${issuedOn}, ${customerId}, '100.00', '20.00', '120.00', 'manual_upload')
    RETURNING id`;
  await db.sql`
    INSERT INTO invoice_lines (invoice_id, line_number, article_code, description, quantity, unit_price, line_amount)
    VALUES (${i.id}, 1, ${article}, ${`QA artikal ${article}`}, '2.000', '50.0000', '100.00')`;
  return i.id;
}

before(async () => {
  if (reason) return;
  db = await initTestDatabase();
  const [a] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QAN${randomUUID().slice(0, 6)}`}, 'QA Firma A') RETURNING id`;
  const [b] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QAN${randomUUID().slice(0, 6)}`}, 'QA Firma B') RETURNING id`;
  firm.a = a.id;
  firm.b = b.id;
  inv.a = await invoice(firm.a, "A-100", "2026-08-01", "QA-AAA");
  inv.bNumber = "B-777";
  inv.b = await invoice(firm.b, inv.bNumber, "2026-08-02", "QA-TAJNI-ARTIKAL-B");
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
    await db.sql`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
    await db.sql`DELETE FROM customers WHERE id IN (${firm.a}, ${firm.b})`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("direktan ID tuđe fakture daje isto što i nepostojeća: null", async (t) => {
  if (guard(t)) return;
  const q = await import("@/lib/customers/customer-queries");
  assert.equal(await q.loadCustomerInvoice(firm.a, inv.b), null);
  assert.equal(await q.loadCustomerInvoice(firm.a, randomUUID()), null);
  assert.equal(await q.loadCustomerInvoice(firm.a, "nije-uuid"), null);
  const own = await q.loadCustomerInvoice(firm.a, inv.a);
  assert.equal(own?.number, "A-100");
  assert.equal(own?.lines.length, 1);
});

test("pretraga i lista ne otkrivaju tuđe dokumente ni artikle", async (t) => {
  if (guard(t)) return;
  const q = await import("@/lib/customers/customer-queries");
  const byNumber = await q.loadCustomerInvoices(firm.a, { q: inv.bNumber, page: 1 });
  assert.equal(byNumber.total, 0);
  const byArticle = await q.loadCustomerInvoices(firm.a, { q: "TAJNI-ARTIKAL", page: 1 });
  assert.equal(byArticle.total, 0);
  const all = await q.loadCustomerInvoices(firm.a, { page: 1 });
  assert.deepEqual(all.rows.map((r) => r.id), [inv.a]);
});

test("filter po datumu, džokeri i prazan customer_id", async (t) => {
  if (guard(t)) return;
  const q = await import("@/lib/customers/customer-queries");
  assert.equal((await q.loadCustomerInvoices(firm.a, { from: "2026-08-02", page: 1 })).total, 0);
  assert.equal((await q.loadCustomerInvoices(firm.a, { to: "2026-08-01", page: 1 })).total, 1);
  assert.equal((await q.loadCustomerInvoices(firm.a, { q: "%", page: 1 })).total, 0, "% nije džoker");
  await assert.rejects(() => q.loadCustomerInvoices("", { page: 1 }));
  const f = q.normalizeInvoiceFilter({ od: "2026-13-99x", do: "juce", strana: "-5", q: "  x  " });
  assert.deepEqual(f, { q: "x", from: null, to: null, page: 1 });
});

test("pregled firme broji samo njene dokumente", async (t) => {
  if (guard(t)) return;
  const q = await import("@/lib/customers/customer-queries");
  const o = await q.loadCustomerOverview(firm.a);
  assert.equal(o?.invoices, 1);
  assert.equal(o?.lastIssuedOn, "2026-08-01");
});
