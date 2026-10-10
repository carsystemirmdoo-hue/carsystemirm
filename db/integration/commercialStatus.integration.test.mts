import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * 0042 — poseban poslovni status kupca i rabat uslovljen plaćanjem:
 *  - van pripreme za portal: nalog se ne priprema (server), istorija i pravila ostaju;
 *  - poseban status: nema automatskih predloga ni izvedenih grupa; ranije odobreno je „poseban slučaj“;
 *  - status menja samo vlasnik; odluke se samo dodaju;
 *  - uslovni rabat (kratak rok): predlog/zamena po uslovu, bez sukoba sa bezuslovnim, cena kupca ga ne uzima podrazumevano.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const ISSUER = `QS${RUN}`;
const code = (c: string) => `QS-${RUN}-${c}`;
let db: TestDatabase;
const ids: Record<string, string> = {};
let customerId: string;
const art: Record<string, string> = {};
let n = 0;
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());
const plus = (d: string, k: number) => new Date(Date.parse(`${d}T00:00:00Z`) + k * 86400000).toISOString().slice(0, 10);

async function invoice(day: string, items: [string, string][]) {
  n += 1;
  const number = `S${RUN}${n}`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${number}, 2026, ${day}, ${customerId}, '1.00', '1.20', 'manual_upload') RETURNING id`;
  let ln = 0;
  for (const [k, discount] of items) {
    ln += 1;
    await db.sql`INSERT INTO invoice_lines (invoice_id, line_number, article_id, article_code, description, quantity, unit_price, discount_percent, line_amount)
                 VALUES (${inv.id}, ${ln}, ${art[k]}, ${code(k)}, ${k}, '1', '100.0000', ${discount}, '1.00')`;
  }
  await db.sql`
    INSERT INTO source_documents (file_hash, file_name, page_count, line_count, issuer_code, business_document_type,
      business_document_number, external_partner_code, document_date, parser_version, validation_status,
      revision_status, manual_review, origin, invoice_id)
    VALUES (${randomUUID().replace(/-/g, "")}, ${`${number}.pdf`}, 1, ${items.length}, ${ISSUER}, 'faktura', ${number}, ${`P${RUN}`},
            ${day}, 'qa-1', 'valid', 'original', 'not_required', 'manual_upload', ${inv.id})`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "rep", role: "komercijalista" }]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  await db.sql`INSERT INTO user_permissions (user_id, permission_key, granted_by, reason) VALUES (${ids.rep}, 'cene_predlog', ${ids.owner}, 'QA')`;
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QS${RUN}`}, ${`QA POSEBAN ${RUN}`}) RETURNING id`;
  customerId = c.id;
  await db.sql`INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
               VALUES ('biznisoft', ${ISSUER}, ${`P${RUN}`}, ${customerId}, 'mapped')`;
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${customerId}, ${ids.rep})`;
  for (const [k, name] of Object.entries({ A: "CS GIT MULTI 1KG", B: "CS F19 KRUZNA P80", C: "CS 2K FILLER 1L", D: "CS RASPA 300", X: "CS POSUDA PVC" })) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit) VALUES (${code(k)}, ${name}, 'KOM') RETURNING id`;
    art[k] = a.id;
  }
  const ago = (k: number) => plus(TODAY, -k);
  await invoice(ago(150), [["A", "40"], ["B", "40"]]);
  await invoice(ago(110), [["C", "40"], ["D", "40"]]);
  await invoice(ago(70), [["A", "40"], ["B", "40"]]);
  await invoice(ago(30), [["C", "40"], ["X", "40"]]);
  const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const scope = { customerScope: "customer", customerId, productScope: "article", articleId: art.A };
  await db.sql`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required, source_batch)
    VALUES ('customer', ${customerId}, 'article', ${art.A}, ${precedenceLevelFor(scope)}, ${scopeKeyFor(scope)}, 'discount_percent', 40,
            ${plus(TODAY, -100)}, 'approved_pending_biznisoft', 'QA ranije odobreno', ${ids.owner}, now(), ${ids.owner}, now(), false, 'rabati-istorija-qa')`;
  await db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by)
               VALUES (${art.A}, '1000.00', '20', ${plus(TODAY, -100)}, 'rucno', 'QA osnovna cena', ${ids.owner})`;
});

after(async () => {
  if (!reason && db) {
    await db.sql`UPDATE price_rules SET replaces_rule_id = NULL WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM price_rules WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM source_documents WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
    await db.sql`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
    await db.sql`TRUNCATE customer_commercial_status_decisions, article_base_prices, customer_payment_options`;
    await db.sql`DELETE FROM customer_users WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customers WHERE id = ${customerId}`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QS-${RUN}-%`}`;
    await db.sql`DELETE FROM user_permissions WHERE user_id = ${ids.rep}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const user = async (k: string) => (await (await import("@/lib/authz/user-repository")).loadPortalUser(ids[k]))!;

test("uslovni rabat (avans): samo odobrena opcija; predlog po uslovu, bez sukoba; cena kupca ga ne uzima podrazumevano", async (t) => {
  if (guard(t)) return;
  const { previewRebateChange, submitRebateChange } = await import("@/lib/pricing/rebate-change-service");
  const { customerPrices } = await import("@/lib/pricing/customer-price-service");
  const owner = await user("owner");
  const from = plus(TODAY, 1);
  const { proposePaymentOption, decidePaymentOption } = await import("@/lib/pricing/payment-option-service");
  const input = { customerId, mode: "artikli" as const, articleIds: [art.A], newPercent: 44, effectiveFrom: from, paymentCondition: "avans" };
  // Neodobrena opcija se odbija.
  await assert.rejects(() => previewRebateChange(owner, input), /nije odobreno/);
  const opt = await proposePaymentOption(owner, { customerId, optionCode: "avans", effectiveFrom: TODAY, reason: "QA dogovor o avansu" });
  await decidePaymentOption(owner, { id: opt.id, to: "odobreno", reason: null });
  const p = await previewRebateChange(owner, input);
  assert.equal(p.rows[0].action, "novo", "postojeće bezuslovno 40 % se NE menja uslovnim predlogom");
  await submitRebateChange(owner, { ...input, reason: "kupac plaća u roku od 1 dana — uslov za potvrdu", approveNow: true, expected: [{ articleId: art.A, replacesRuleId: null }] });
  const rules = await db.sql<{ p: string; c: string | null; t: string | null }[]>`
    SELECT discount_percent::text AS p, payment_condition AS c, effective_to::text AS t FROM price_rules WHERE customer_id = ${customerId} AND article_id = ${art.A} ORDER BY created_at`;
  assert.deepEqual(rules.map((r) => [Number(r.p), r.c, r.t]), [[40, null, null], [44, "avans", null]], "bezuslovno ostaje otvoreno; uslovno je odvojeno");
  const price = await customerPrices(customerId, [art.A], from);
  const a = price.prices.get(art.A)!;
  assert.equal(a.status, "cena");
  assert.equal((a as { discountPercent: number }).discountPercent, 40, "podrazumevana cena koristi bezuslovni rabat");
});

test("status: menja samo vlasnik; poseban status gasi automatske predloge i grupe; ranije odobreno je poseban slučaj", async (t) => {
  if (guard(t)) return;
  const { setCommercialStatus } = await import("@/lib/customers/commercial-status-service");
  const { rebateCoverage } = await import("@/lib/pricing/rebate-coverage-service");
  const { customerFamilies } = await import("@/lib/pricing/rebate-change-service");
  const owner = await user("owner");
  const before = (await rebateCoverage(owner, TODAY, customerId)).customers[0];
  assert.ok(before.groups.length > 0, "redovan kupac ima grupu");
  await assert.rejects(async () => setCommercialStatus(await user("rep"), { customerId, status: "kompenzacija", reason: "pokušaj bez prava" }), /vlasnik/);
  const r = await setCommercialStatus(owner, { customerId, status: "kompenzacija", reason: "uslovi zavise od prebijanja" });
  assert.equal(r.changed, true);
  assert.equal((await setCommercialStatus(owner, { customerId, status: "kompenzacija", reason: "uslovi zavise od prebijanja" })).changed, false);
  const c = (await rebateCoverage(owner, TODAY, customerId)).customers[0];
  assert.equal(c.status, "kompenzacija");
  assert.equal(c.groups.length, 0);
  assert.ok(c.pairs.find((p) => p.articleId === art.A)?.special, "ranije odobreno ostaje vidljivo kao poseban slučaj");
  assert.ok(c.pairs.filter((p) => p.articleId !== art.A).every((p) => p.outcome === "poseban_status"));
  assert.deepEqual(await customerFamilies(owner, customerId), []);
  await assert.rejects(() => db.sql`DELETE FROM customer_commercial_status_decisions WHERE customer_id = ${customerId}`, /samo dodaje/);
});

test("van pripreme za portal: nalog se ne priprema, istorija ostaje", async (t) => {
  if (guard(t)) return;
  const { setCommercialStatus } = await import("@/lib/customers/commercial-status-service");
  const { proposeCustomerContact } = await import("@/lib/customers/account-service");
  const owner = await user("owner");
  await setCommercialStatus(owner, { customerId, status: "van_pripreme_portala", reason: "fakturisanje za druge kupce" });
  await assert.rejects(
    () => proposeCustomerContact({ customerId, email: `qa-${RUN}@primer.invalid`, name: "QA kontakt", reason: "pokušaj pripreme naloga" }, { id: owner.id, name: owner.name, role: owner.role }),
    /nije u pripremi za portal/,
  );
  const [{ k }] = await db.sql<{ k: number }[]>`SELECT count(*)::int AS k FROM invoices WHERE customer_id = ${customerId}`;
  assert.equal(k, 4, "fakture ostaju");
  const [{ r }] = await db.sql<{ r: number }[]>`SELECT count(*)::int AS r FROM price_rules WHERE customer_id = ${customerId} AND status = 'approved_pending_biznisoft'`;
  assert.equal(r, 2, "ranija pravila ostaju");
});
