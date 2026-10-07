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
 * Neaktivan kupac: podrazumevano izostavljen sa „Za razgovor" i iz predloga
 * (redovi i brojači), vidljiv kroz filter; kartica i dalje ima istoriju.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const ISSUER = "QA-NEAKTIVAN";
const AS_OF = "2026-09-28";
let db: TestDatabase;
let owner: { id: string; name: string; role: string };
const kupac: Record<"A" | "B", string> = { A: "", B: "" };
let counter = 0;

async function purchase(customerId: string, partner: string, issuedOn: string) {
  counter += 1;
  const number = `NA${counter}`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${number}, ${Number(issuedOn.slice(0, 4))}, ${issuedOn}, ${customerId}, '100.00', '120.00', 'manual_upload')
    RETURNING id`;
  await db.sql`
    INSERT INTO invoice_lines (invoice_id, line_number, article_code, description, quantity, unit_price, line_amount)
    VALUES (${inv.id}, 1, 'QA-NA', 'QA artikal', '1.000', '100.0000', '100.00')`;
  await db.sql`
    INSERT INTO source_documents (file_hash, file_name, page_count, line_count, issuer_code, business_document_type,
      business_document_number, external_partner_code, document_date, parser_version, validation_status,
      revision_status, manual_review, origin, invoice_id)
    VALUES (${randomUUID().replace(/-/g, "")}, ${`${number}.pdf`}, 1, 1, ${ISSUER}, 'faktura', ${number}, ${partner},
            ${issuedOn}, 'qa-1', 'valid', 'original', 'not_required', 'manual_upload', ${inv.id})`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  owner = { id: accounts.owner.id, name: accounts.owner.name, role: accounts.owner.role };
  const { addDays } = await import("@/lib/recommendations/cadence.mjs");
  for (const [k, partner] of [["A", "P1"], ["B", "P2"]] as const) {
    const [c] = await db.sql<{ id: string }[]>`
      INSERT INTO customers (pib, name) VALUES (${`QAN${randomUUID().slice(0, 6)}`}, ${`QA Kupac ${k}`}) RETURNING id`;
    kupac[k] = c.id;
    await db.sql`
      INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
      VALUES ('biznisoft', ${ISSUER}, ${partner}, ${c.id}, 'mapped')`;
    for (let i = 0; i < 8; i += 1) await purchase(c.id, partner, addDays("2026-03-02", 21 * i));
  }
  const { recomputeRecommendations } = await import("@/lib/recommendations/recompute");
  await recomputeRecommendations({ customerIds: null }, { asOfDate: AS_OF }, owner);
  const { setCustomerActive } = await import("@/lib/customers/customer-status-service");
  await setCustomerActive({ customerId: kupac.B, active: false, reason: "QA: više ne radi" }, owner);
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM recommendation_results`;
    await db.sql`DELETE FROM recommendation_recompute_requests`;
    await db.sql`DELETE FROM recommendation_runs`;
    await db.sql`DELETE FROM source_documents WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
    await db.sql`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM customers WHERE id IN (${kupac.A}, ${kupac.B})`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const scope = () => ({ customerIds: [kupac.A, kupac.B] });

test("„Za razgovor“: neaktivan kupac podrazumevano izostavljen i prebrojan; vidi se kroz filter", async (t) => {
  if (guard(t)) return;
  const { loadConversationCustomers } = await import("@/lib/customers/conversation-customers");
  const aktivni = await loadConversationCustomers(scope(), "aktivni");
  assert.deepEqual(aktivni.rows.map((r) => r.id), [kupac.A]);
  assert.equal(aktivni.inactiveInScope, 1);
  assert.deepEqual((await loadConversationCustomers(scope(), "neaktivni")).rows.map((r) => r.id), [kupac.B]);
  assert.equal((await loadConversationCustomers(scope(), "svi")).rows.length, 2);
  // Opseg i dalje važi: kupac van opsega se ne vidi ni kroz filter „svi“.
  assert.deepEqual((await loadConversationCustomers({ customerIds: [kupac.A] }, "svi")).rows.map((r) => r.id), [kupac.A]);
});

test("predlozi: redovi i brojači podrazumevano bez neaktivnih; filter ih prikazuje", async (t) => {
  if (guard(t)) return;
  const { recommendationRows, recommendationStatusCounts } = await import("@/lib/recommendations/query");
  const podrazumevano = await recommendationRows(scope(), {});
  assert.ok(podrazumevano.length > 0);
  assert.ok(podrazumevano.every((r) => r.customerId === kupac.A), "neaktivan kupac u podrazumevanoj listi");
  const neaktivni = await recommendationRows(scope(), { customerStatus: "neaktivni" });
  assert.ok(neaktivni.length > 0 && neaktivni.every((r) => r.customerId === kupac.B));
  const svi = await recommendationRows(scope(), { customerStatus: "svi" });
  assert.equal(svi.length, podrazumevano.length + neaktivni.length);
  const zbir = (o: Record<string, number>) => Object.values(o).reduce((s, x) => s + x, 0);
  assert.equal(zbir(await recommendationStatusCounts(scope(), {})), podrazumevano.length);
});

test("kartica neaktivnog kupca zadržava istoriju i statuse artikala", async (t) => {
  if (guard(t)) return;
  const { loadCustomerProfile } = await import("@/lib/recommendations/customer-profile");
  const p = await loadCustomerProfile(kupac.B, new Date("2026-09-29T10:00:00+02:00"));
  assert.equal(p.documentCount, 8);
  assert.notEqual(p.articles[0].status, "not_computed", "status artikla neaktivnog kupca je izgubljen");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices WHERE customer_id = ${kupac.B}`;
  assert.equal(n, 8);
});
