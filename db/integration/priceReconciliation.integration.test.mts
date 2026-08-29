import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase,
  seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * `confirmed` je dostizno isključivo preko usaglašavanja sa fakturom.
 *
 * Testovi ovde ne dokazuju da servis radi „u većini slučajeva" — dokazuju da
 * svaki drugi put do `confirmed` ne postoji: ni kroz tok, ni kroz bazu, ni sa
 * izmišljenim dokazom.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) { t.skip(reason); return true; }
  return false;
};

let db: TestDatabase;
let actor: { id: string; name: string; role: string };

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const a = await seedAccounts(db, [{ key: "office", role: "kancelarija" }]);
  actor = { id: a.office.id, name: a.office.name, role: a.office.role };
});

after(async () => {
  if (!reason && db) {
    await clean();
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

async function clean() {
  await db.sql`DELETE FROM notifications`;
  await db.sql`DELETE FROM price_rules`;
  await db.sql`DELETE FROM invoice_lines`;
  await db.sql`DELETE FROM invoices`;
  await db.sql`DELETE FROM articles WHERE code LIKE 'QAR-%'`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
}

/** Kupac, artikal i jedna faktura sa zadatim uslovom. */
async function fixture(over: {
  unitPrice?: number;
  discountPercent?: number;
  issuedOn?: string;
  documentKind?: string;
} = {}) {
  const code = `QAR-${randomUUID().slice(0, 8)}`;
  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  const [article] = await db.sql<{ id: string }[]>`
    INSERT INTO articles (code, name) VALUES (${code}, 'QA artikal') RETURNING id`;

  const issuedOn = over.issuedOn ?? "2026-03-10";
  const [invoice] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices
      (company_id, document_kind, number, year, issued_on, customer_id,
       net_amount, tax_amount, total_amount)
    VALUES ('QA01', ${over.documentKind ?? "faktura"}, ${randomUUID().slice(0, 8)},
            ${Number(issuedOn.slice(0, 4))}, ${issuedOn}, ${customer.id}, 100, 20, 120)
    RETURNING id`;
  const [line] = await db.sql<{ id: string }[]>`
    INSERT INTO invoice_lines
      (invoice_id, line_number, article_id, article_code, quantity,
       unit_price, discount_percent, tax_percent, line_amount)
    VALUES (${invoice.id}, 1, ${article.id}, ${code}, 1,
            ${over.unitPrice ?? 100}, ${over.discountPercent ?? 15}, 20, 85)
    RETURNING id`;

  return { customerId: customer.id, articleId: article.id, code, invoiceId: invoice.id, lineId: line.id };
}

/** Pravilo dovedeno do `office_recorded` direktnim upisom stanja. */
async function officeRecordedRule(f: { customerId: string; articleId: string }, over: {
  valueKind?: string;
  discountPercent?: number | null;
  netPrice?: number | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  customerScope?: string;
  productScope?: string;
} = {}) {
  const [row] = await db.sql<{ id: string }[]>`
    INSERT INTO price_rules
      (customer_scope, customer_id, product_scope, article_id, precedence_level,
       scope_key, value_kind, discount_percent, net_price, effective_from,
       effective_to, status, reason, office_recorded_by, office_recorded_at,
       office_record_note)
    VALUES (${over.customerScope ?? "customer"}, ${f.customerId},
            ${over.productScope ?? "article"}, ${f.articleId}, 1,
            ${`customer:${f.customerId}|article:${f.articleId}`},
            ${over.valueKind ?? "discount_percent"},
            ${over.discountPercent === undefined ? 15 : over.discountPercent},
            ${over.netPrice ?? null},
            ${over.effectiveFrom ?? "2026-01-01"}, ${over.effectiveTo ?? null},
            'office_recorded', 'QA razlog', ${actor.id}, now(),
            'QA napomena o unosu')
    RETURNING id`;
  return row.id;
}

const statusOf = async (id: string) => {
  const [row] = await db.sql<{
    status: string; reconciled_invoice_id: string | null;
    reconciled_invoice_line_id: string | null; confirmed_by: string | null;
  }[]>`
    SELECT status, reconciled_invoice_id, reconciled_invoice_line_id, confirmed_by
      FROM price_rules WHERE id = ${id}`;
  return row;
};

test("faktura sa uslovom potvrdjuje pravilo i nosi dokaz", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcilePriceRule } = await import("@/lib/pricing/reconciliation-service");

  const f = await fixture({ discountPercent: 15 });
  const ruleId = await officeRecordedRule(f);

  const out = await reconcilePriceRule(ruleId, actor);
  assert.equal(out.outcome, "confirmed");

  const row = await statusOf(ruleId);
  assert.equal(row.status, "confirmed");
  assert.equal(row.reconciled_invoice_id, f.invoiceId);
  assert.equal(row.reconciled_invoice_line_id, f.lineId);
  // Potvrdu nije dao covek — polje ostaje prazno.
  assert.equal(row.confirmed_by, null);
});

test("faktura sa drugim uslovom vodi u reconciliation_failed, ne u confirmed", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcilePriceRule } = await import("@/lib/pricing/reconciliation-service");

  const f = await fixture({ discountPercent: 5 });
  const ruleId = await officeRecordedRule(f, { discountPercent: 15 });

  const out = await reconcilePriceRule(ruleId, actor);
  assert.equal(out.outcome, "failed");

  const row = await statusOf(ruleId);
  assert.equal(row.status, "reconciliation_failed");
  assert.equal(row.reconciled_invoice_id, null, "neuspeh je upisao dokaz");
});

test("bez ijedne fakture pravilo ostaje u office_recorded", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcilePriceRule } = await import("@/lib/pricing/reconciliation-service");

  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  const [article] = await db.sql<{ id: string }[]>`
    INSERT INTO articles (code, name)
    VALUES (${`QAR-${randomUUID().slice(0, 8)}`}, 'QA artikal') RETURNING id`;
  const ruleId = await officeRecordedRule({ customerId: customer.id, articleId: article.id });

  const out = await reconcilePriceRule(ruleId, actor);
  assert.equal(out.outcome, "no_evidence_yet");
  assert.equal((await statusOf(ruleId)).status, "office_recorded");
});

test("siri opseg se ne potvrdjuje ni kad faktura nosi uslov", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcilePriceRule } = await import("@/lib/pricing/reconciliation-service");

  const f = await fixture({ discountPercent: 15 });
  const [group] = await db.sql<{ id: string }[]>`
    INSERT INTO customer_groups (name, key) VALUES ('QA grupa', ${`qa-${randomUUID().slice(0, 8)}`})
    RETURNING id`;
  const [row] = await db.sql<{ id: string }[]>`
    INSERT INTO price_rules
      (customer_scope, customer_group_id, product_scope, article_id, precedence_level,
       scope_key, value_kind, discount_percent, effective_from, status, reason,
       office_recorded_by, office_recorded_at, office_record_note)
    VALUES ('group', ${group.id}, 'article', ${f.articleId}, 5,
            ${`group:${group.id}|article:${f.articleId}`}, 'discount_percent', 15,
            '2026-01-01', 'office_recorded', 'QA razlog', ${actor.id}, now(), 'QA napomena')
    RETURNING id`;

  const out = await reconcilePriceRule(row.id, actor);
  assert.equal(out.outcome, "not_applicable");
  assert.equal((await statusOf(row.id)).status, "office_recorded");
  await db.sql`DELETE FROM price_rules`;
  await db.sql`DELETE FROM customer_groups WHERE id = ${group.id}`;
});

test("pravilo koje kancelarija nije evidentirala se ne usaglasava", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcilePriceRule } = await import("@/lib/pricing/reconciliation-service");

  const f = await fixture({ discountPercent: 15 });
  const ruleId = await officeRecordedRule(f);
  await db.sql`
    UPDATE price_rules SET status = 'approved_pending_biznisoft' WHERE id = ${ruleId}`;

  const out = await reconcilePriceRule(ruleId, actor);
  assert.equal(out.outcome, "not_eligible");
  assert.equal((await statusOf(ruleId)).status, "approved_pending_biznisoft");
});

test("dokaz sa TUDJE fakture ne potvrdjuje pravilo", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcilePriceRule } = await import("@/lib/pricing/reconciliation-service");

  // Faktura sa uslovom postoji, ali za drugog kupca.
  const other = await fixture({ discountPercent: 15 });
  const [mine] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac 2') RETURNING id`;
  const ruleId = await officeRecordedRule({ customerId: mine.id, articleId: other.articleId });

  const out = await reconcilePriceRule(ruleId, actor);
  assert.equal(out.outcome, "no_evidence_yet");
  assert.equal((await statusOf(ruleId)).status, "office_recorded");
});

test("povrat ne potvrdjuje pravilo — ledger ga ne racuna u promet", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcilePriceRule } = await import("@/lib/pricing/reconciliation-service");

  const f = await fixture({ discountPercent: 15, documentKind: "povrat_robe" });
  const ruleId = await officeRecordedRule(f);

  const out = await reconcilePriceRule(ruleId, actor);
  assert.equal(out.outcome, "no_evidence_yet");
});

test("baza odbija confirmed sa izmisljenim dokazom", async (t) => {
  if (guard(t)) return;
  await clean();
  const f = await fixture();
  const ruleId = await officeRecordedRule(f);

  await assert.rejects(
    () => db.sql`
      UPDATE price_rules
         SET status = 'confirmed',
             reconciled_invoice_id = ${randomUUID()},
             reconciled_at = now()
       WHERE id = ${ruleId}`,
    /foreign key|violates/i,
    "nasumican UUID je prosao kao dokaz sa fakture",
  );
  assert.equal((await statusOf(ruleId)).status, "office_recorded");
});

test("baza odbija confirmed bez ijednog dokaza", async (t) => {
  if (guard(t)) return;
  await clean();
  const f = await fixture();
  const ruleId = await officeRecordedRule(f);

  await assert.rejects(
    () => db.sql`
      UPDATE price_rules SET status = 'confirmed', confirmed_at = now() WHERE id = ${ruleId}`,
    /price_rules_confirmed_needs_invoice_ck|violates/i,
  );
});

test("dokaz se ne moze obrisati ispod potvrdjenog pravila", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcilePriceRule } = await import("@/lib/pricing/reconciliation-service");

  const f = await fixture({ discountPercent: 15 });
  const ruleId = await officeRecordedRule(f);
  await reconcilePriceRule(ruleId, actor);

  await assert.rejects(
    () => db.sql`DELETE FROM invoice_lines WHERE id = ${f.lineId}`,
    /foreign key|violates/i,
  );
});

test("ponovno usaglasavanje potvrdjenog pravila ne menja nista", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcilePriceRule } = await import("@/lib/pricing/reconciliation-service");

  const f = await fixture({ discountPercent: 15 });
  const ruleId = await officeRecordedRule(f);
  await reconcilePriceRule(ruleId, actor);
  const before = await statusOf(ruleId);

  const again = await reconcilePriceRule(ruleId, actor);
  assert.equal(again.outcome, "not_eligible");
  assert.deepEqual(await statusOf(ruleId), before);
});

test("trag revizije razlikuje nalaz od ljudske odluke", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcilePriceRule } = await import("@/lib/pricing/reconciliation-service");

  const f = await fixture({ discountPercent: 15 });
  const ruleId = await officeRecordedRule(f);
  await reconcilePriceRule(ruleId, actor);

  const [row] = await db.sql<{ action: string; actor_user_id: string | null; actor_label: string }[]>`
    SELECT action, actor_user_id, actor_label FROM audit_log
     WHERE entity_id = ${ruleId} ORDER BY created_at DESC LIMIT 1`;
  assert.match(row.action, /potvrdjeno sa fakture/i);
  assert.equal(row.actor_user_id, null, "sistemski nalaz je pripisan coveku");
  assert.match(row.actor_label, /Usaglašavanje sa fakturom/);
});

test("paketna obrada vraca nalaz za svako pravilo koje ceka", async (t) => {
  if (guard(t)) return;
  await clean();
  const { reconcileOfficeRecorded } = await import("@/lib/pricing/reconciliation-service");

  const a = await fixture({ discountPercent: 15 });
  const b = await fixture({ discountPercent: 5 });
  await officeRecordedRule(a, { discountPercent: 15 });
  await officeRecordedRule(b, { discountPercent: 15 });

  const { results } = await reconcileOfficeRecorded(actor);
  assert.equal(results.length, 2);
  const outcomes = results.map((r) => r.outcome).sort();
  assert.deepEqual(outcomes, ["confirmed", "failed"]);
});
