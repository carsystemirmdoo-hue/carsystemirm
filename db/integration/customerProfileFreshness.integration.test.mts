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
 * „Novi dokument posle obračuna": kartica i radna lista ne smeju prikazati
 * stari status kao aktuelan, a nova kupovina mora biti vidljiva odmah.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const ISSUER = "QA-SVEZINA";
const AS_OF = "2026-09-28";
const TODAY = new Date("2026-09-29T10:00:00+02:00");
let db: TestDatabase;
let owner: { id: string; name: string; role: string };
let customerId = "";
let counter = 0;

async function purchase(issuedOn: string, articleCode = "QA-BZ") {
  counter += 1;
  const number = `SV${counter}`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${number}, ${Number(issuedOn.slice(0, 4))}, ${issuedOn}, ${customerId}, '100.00', '120.00', 'manual_upload')
    RETURNING id`;
  await db.sql`
    INSERT INTO invoice_lines (invoice_id, line_number, article_code, description, quantity, unit_price, line_amount)
    VALUES (${inv.id}, 1, ${articleCode}, 'QA bazni lak', '1.000', '100.0000', '100.00')`;
  await db.sql`
    INSERT INTO source_documents (file_hash, file_name, page_count, line_count, issuer_code, business_document_type,
      business_document_number, external_partner_code, document_date, parser_version, validation_status,
      revision_status, manual_review, origin, invoice_id)
    VALUES (${randomUUID().replace(/-/g, "")}, ${`${number}.pdf`}, 1, 1, ${ISSUER}, 'faktura', ${number}, 'P1',
            ${issuedOn}, 'qa-1', 'valid', 'original', 'not_required', 'manual_upload', ${inv.id})`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  owner = { id: accounts.owner.id, name: accounts.owner.name, role: accounts.owner.role };
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QAS${randomUUID().slice(0, 6)}`}, 'QA Svežina') RETURNING id`;
  customerId = c.id;
  await db.sql`
    INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, 'P1', ${customerId}, 'mapped')`;
  // Kupac na ~14 dana; poslednja kupovina 9. 7. — na dan 28. 9. artikal kasni.
  const { addDays } = await import("@/lib/recommendations/cadence.mjs");
  for (let i = 0; i < 10; i += 1) await purchase(addDays("2026-03-26", 14 * i));
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM recommendation_results`;
    await db.sql`DELETE FROM recommendation_runs`;
    await db.sql`DELETE FROM source_documents WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
    await db.sql`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM customers WHERE id = ${customerId}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("pre nove kupovine: obračun je aktuelan i daje savet", async (t) => {
  if (guard(t)) return;
  const { recomputeRecommendations } = await import("@/lib/recommendations/recompute");
  await recomputeRecommendations({ customerIds: null }, { asOfDate: AS_OF }, owner);
  const { loadCustomerProfile } = await import("@/lib/recommendations/customer-profile");
  const p = await loadCustomerProfile(customerId, TODAY);
  assert.equal(p.freshness.state, "current");
  assert.equal(p.summary.status.key, "attention");
  assert.equal(p.articles[0].status, "overdue");
  assert.ok(p.summary.mention.length > 0);
});

test("nov dokument posle obračuna: nova kupovina vidljiva, status i savet nisu aktuelni", async (t) => {
  if (guard(t)) return;
  await purchase("2026-09-29");
  const { loadCustomerProfile, loadCustomerProfiles } = await import("@/lib/recommendations/customer-profile");
  const p = await loadCustomerProfile(customerId, TODAY);

  assert.equal(p.freshness.state, "new_documents");
  assert.equal(p.freshness.newDocuments.length, 1);
  assert.equal(p.summary.lastPurchaseOn, "2026-09-29", "nova kupovina mora biti vidljiva odmah");
  assert.equal(p.summary.status.key, "stale");
  assert.deepEqual(p.summary.mention, []);
  assert.match(p.summary.nextStep, /ne prikazuje/);
  assert.equal(p.articles[0].statusOutdated, true);
  assert.deepEqual(p.articles[0].newPurchaseDates, ["2026-09-29"]);

  // Radna lista čita isti profil kroz grupno učitavanje.
  const list = await loadCustomerProfiles({ customerIds: [customerId] }, TODAY);
  assert.equal(list.profiles.get(customerId)?.summary.status.key, "stale");
});

test("posle ponovnog obračuna stanje je ponovo aktuelno i uključuje novu kupovinu", async (t) => {
  if (guard(t)) return;
  const { recomputeRecommendations } = await import("@/lib/recommendations/recompute");
  await recomputeRecommendations({ customerIds: null }, { asOfDate: "2026-09-29" }, owner);
  const { loadCustomerProfile } = await import("@/lib/recommendations/customer-profile");
  const p = await loadCustomerProfile(customerId, TODAY);
  assert.equal(p.freshness.state, "current");
  assert.notEqual(p.summary.status.key, "stale");
  // Kupac je upravo kupio: sledeći uobičajeni termin je za ~14 dana.
  assert.equal(p.articles[0].status, "not_yet", "posle nove kupovine artikal više ne kasni");
  assert.equal(p.summary.lastPurchaseOn, "2026-09-29");
});
