import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Predlozi rabata sa dokazima (10.10.2026):
 *  - par bez pravila sa premalo faktura → „nedovoljan dokaz“ sa poslednjim fakturama, ništa se ne primenjuje;
 *  - poslednja faktura različita od ODOBRENOG pravila → odluka nadležnog, nov predlog se odbija;
 *  - „Predložite“ pravi predlog na čekanju odobrenja, a par posle toga više nije u spisku;
 *  - komercijalista vidi samo svoje kupce.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const ISSUER = `QP${RUN}`;
const code = (c: string) => `QP-${RUN}-${c}`;
const AS_OF = "2026-10-10";
let db: TestDatabase;
let ownerId: string;
let repId: string;
let otherRepId: string;
let customerId: string;
const art: Record<string, string> = {};
let n = 0;

async function sell(articleKey: string, day: string, discount: string) {
  n += 1;
  const number = `P${RUN}${n}`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${number}, 2026, ${day}, ${customerId}, '1.00', '1.20', 'manual_upload') RETURNING id`;
  await db.sql`INSERT INTO invoice_lines (invoice_id, line_number, article_id, article_code, description, quantity, unit_price, discount_percent, line_amount)
               VALUES (${inv.id}, 1, ${art[articleKey]}, ${code(articleKey)}, ${`QAFAM ${articleKey}`}, '1', '100.0000', ${discount}, '1.00')`;
  await db.sql`
    INSERT INTO source_documents (file_hash, file_name, page_count, line_count, issuer_code, business_document_type,
      business_document_number, external_partner_code, document_date, parser_version, validation_status,
      revision_status, manual_review, origin, invoice_id)
    VALUES (${randomUUID().replace(/-/g, "")}, ${`${number}.pdf`}, 1, 1, ${ISSUER}, 'faktura', ${number}, ${`P${RUN}`},
            ${day}, 'qa-1', 'valid', 'original', 'not_required', 'manual_upload', ${inv.id})`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "rep", role: "komercijalista" }, { key: "other", role: "komercijalista" }]);
  ownerId = acc.owner.id;
  repId = acc.rep.id;
  otherRepId = acc.other.id;
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QP${RUN}`}, ${`QA PREDLOZI ${RUN}`}) RETURNING id`;
  customerId = c.id;
  await db.sql`INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
               VALUES ('biznisoft', ${ISSUER}, ${`P${RUN}`}, ${customerId}, 'mapped')`;
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${customerId}, ${repId})`;
  for (const k of ["A", "B"]) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit) VALUES (${code(k)}, ${`QAFAM ${k} 1L`}, 'kom') RETURNING id`;
    art[k] = a.id;
  }
  // A: samo dve fakture sa 20 % — premalo za stroga merila.
  await sell("A", "2026-08-01", "20");
  await sell("A", "2026-09-20", "20");
  // B: odobreno 10 %, a nedavna faktura 15 %.
  await sell("B", "2026-09-25", "15");
  const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const scope = { customerScope: "customer", customerId, productScope: "article", articleId: art.B };
  await db.sql`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at)
    VALUES ('customer', ${customerId}, 'article', ${art.B}, ${precedenceLevelFor(scope)}, ${scopeKeyFor(scope)}, 'discount_percent', 10,
            '2026-01-01', 'approved_pending_biznisoft', 'QA odobreno', ${ownerId}, now(), ${ownerId}, now())`;
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM price_rules WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM source_documents WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
    await db.sql`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customers WHERE id = ${customerId}`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QP-${RUN}-%`}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("predlozi: nedovoljan dokaz i razlika sa odobrenim; predlog ide na odobrenje i ne ponavlja se", async (t) => {
  if (guard(t)) return;
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const { rebateProposals, proposeFromEvidence } = await import("@/lib/pricing/rebate-application-service");
  const owner = (await loadPortalUser(ownerId))!;

  const list = await rebateProposals(owner, AS_OF, customerId);
  const a = list.find((x) => x.articleId === art.A)!;
  const b = list.find((x) => x.articleId === art.B)!;
  assert.equal(a.kind, "bez_pravila");
  assert.equal(a.verdict, "nedovoljan_dokaz");
  assert.equal(a.evidence.proposedPercent, 20);
  assert.deepEqual(a.evidence.lastInvoices.map((i) => i.issuedOn), ["2026-09-20", "2026-08-01"]);
  assert.ok(a.evidence.reasons.length > 0);
  assert.deepEqual(a.salespeople, ["QA rep"]);
  assert.equal(b.kind, "razlika_sa_odobrenim");
  assert.equal(b.verdict, "odluka_nadleznog");
  assert.deepEqual(b.approvedPercent, [10]);

  // Pregled ništa ne upisuje.
  const [{ n: before }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM price_rules WHERE customer_id = ${customerId}`;
  assert.equal(before, 1);

  const refused = await proposeFromEvidence(owner, customerId, art.B, AS_OF);
  assert.equal(refused.ok, false, "odobreno pravilo se ne prepisuje novim predlogom");

  const ok = await proposeFromEvidence(owner, customerId, art.A, AS_OF);
  assert.equal(ok.ok, true);
  const [rule] = await db.sql<{ status: string; discount_percent: string; reason: string }[]>`
    SELECT status::text AS status, discount_percent::text AS discount_percent, reason FROM price_rules WHERE customer_id = ${customerId} AND article_id = ${art.A}`;
  assert.equal(Number(rule.discount_percent), 20);
  assert.notEqual(rule.status, "approved_pending_biznisoft", "predlog čeka odobrenje");
  assert.match(rule.reason, /Poslednje fakture/);

  const again = await proposeFromEvidence(owner, customerId, art.A, AS_OF);
  assert.equal(again.ok, false, "isti par se ne predlaže dvaput");
  assert.equal((await rebateProposals(owner, AS_OF, customerId)).some((x) => x.articleId === art.A), false);
});

test("predlozi: komercijalista vidi samo svoje kupce", async (t) => {
  if (guard(t)) return;
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const { rebateProposals } = await import("@/lib/pricing/rebate-application-service");
  const rep = (await loadPortalUser(repId))!;
  const other = (await loadPortalUser(otherRepId))!;
  assert.ok((await rebateProposals(rep, AS_OF)).some((x) => x.customerId === customerId));
  assert.equal((await rebateProposals(other, AS_OF)).some((x) => x.customerId === customerId), false);
});
