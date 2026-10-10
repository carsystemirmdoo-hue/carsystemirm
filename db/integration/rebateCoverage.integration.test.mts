import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * rabati-v2 i program artikla (0040):
 *  - grupa kupac × porodica: izvedeni par (jedna kupovina) dobija uslov porodice koju dokazuju DRUGI artikli;
 *  - grupno odobrenje vlasnika = odobrena pravila sa oznakom serije; odobreno pravilo se ne prepisuje;
 *  - zastarelo očekivanje (drugi procenat) se odbija, ništa se ne upisuje;
 *  - komercijalista vidi samo svoje kupce;
 *  - artikal van programa: istorija ostaje, cena kupca „van ponude“, nije u grupama; odluke se samo dodaju.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const ISSUER = `QV${RUN}`;
const code = (c: string) => `QV-${RUN}-${c}`;
const AS_OF = "2026-10-10";
let db: TestDatabase;
let ownerId: string;
let repId: string;
let otherRepId: string;
let customerId: string;
const art: Record<string, string> = {};
let n = 0;

async function invoice(day: string, items: [string, string][]) {
  n += 1;
  const number = `V${RUN}${n}`;
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
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "rep", role: "komercijalista" }, { key: "other", role: "komercijalista" }]);
  ownerId = acc.owner.id;
  repId = acc.rep.id;
  otherRepId = acc.other.id;
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QV${RUN}`}, ${`QA POKRIVENOST ${RUN}`}) RETURNING id`;
  customerId = c.id;
  await db.sql`INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
               VALUES ('biznisoft', ${ISSUER}, ${`P${RUN}`}, ${customerId}, 'mapped')`;
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${customerId}, ${repId})`;
  const names: Record<string, string> = {
    A: "CS GIT MULTI 1KG", B: "CS F19 KRUZNA P80", C: "CS 2K FILLER 1L", D: "CS RASPA 300", E: "CS PROFLEX PLUTO",
    X: "CS POSUDA PVC 0.75L", Y: "CS TRAKA 19MM", S: "SIA 1950 P120",
  };
  for (const [k, name] of Object.entries(names)) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit) VALUES (${code(k)}, ${name}, 'KOM') RETURNING id`;
    art[k] = a.id;
  }
  // Porodica CS 40 % kroz pet artikala i četiri dana; X jednom (40 %), Y odobren 38 %, S (sia) dva puta 30 %.
  await invoice("2026-05-04", [["A", "40"], ["B", "40"], ["S", "30"]]);
  await invoice("2026-06-10", [["C", "40"], ["Y", "40"]]);
  await invoice("2026-07-15", [["A", "40"], ["D", "40"], ["S", "30"]]);
  await invoice("2026-08-20", [["E", "40"], ["X", "40"]]);
  await invoice("2026-09-25", [["A", "40"], ["B", "40"]]);
  const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const scope = { customerScope: "customer", customerId, productScope: "article", articleId: art.Y };
  await db.sql`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at)
    VALUES ('customer', ${customerId}, 'article', ${art.Y}, ${precedenceLevelFor(scope)}, ${scopeKeyFor(scope)}, 'discount_percent', 38,
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
    // Odluke o programu se samo dodaju (okidač); test ih briše sa TRUNCATE, pa artikle.
    await db.sql`TRUNCATE article_programme_decisions`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QV-${RUN}-%`}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("program artikla: van programa čuva istoriju, ali nije u ponudi; odluke se samo dodaju", async (t) => {
  if (guard(t)) return;
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const { setArticleProgramme, outOfProgrammeArticles } = await import("@/lib/pricing/article-programme-service");
  const { customerPrices } = await import("@/lib/pricing/customer-price-service");
  const { orderabilityProblem } = await import("@/lib/ordering/orderRules.mjs");
  const owner = (await loadPortalUser(ownerId))!;
  const rep = (await loadPortalUser(repId))!;
  await assert.rejects(() => setArticleProgramme(rep, { articleIds: [art.S], inProgramme: false, reason: "pokušaj bez prava" }));
  const first = await setArticleProgramme(owner, { articleIds: [art.S], inProgramme: false, reason: "sia nije u aktuelnom programu" });
  assert.equal(first.changed, 1);
  const again = await setArticleProgramme(owner, { articleIds: [art.S], inProgramme: false, reason: "sia nije u aktuelnom programu" });
  assert.equal(again.changed, 0, "ista odluka ne pravi nov zapis");
  assert.ok((await outOfProgrammeArticles()).ids.has(art.S));
  const prices = await customerPrices(customerId, [art.S], AS_OF);
  assert.equal(prices.prices.get(art.S)?.status, "van_ponude");
  assert.equal(orderabilityProblem({ mapping: null, productExists: false, rowVariantKeys: [], priceItem: null, outOfProgramme: true })?.code, "not_in_programme");
  const [{ k }] = await db.sql<{ k: number }[]>`SELECT count(*)::int AS k FROM invoice_lines WHERE article_id = ${art.S}`;
  assert.equal(k, 2, "istorija faktura ostaje");
  await assert.rejects(() => db.sql`UPDATE article_programme_decisions SET reason = 'izmena' WHERE article_id = ${art.S}`, /samo dodaje/);
});

test("grupa kupac × porodica: izvedeno i direktno, odobreno se ne prepisuje, van programa nije u grupi", async (t) => {
  if (guard(t)) return;
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const { rebateCoverage, approveRebateGroup } = await import("@/lib/pricing/rebate-coverage-service");
  const owner = (await loadPortalUser(ownerId))!;
  const cov = await rebateCoverage(owner, AS_OF, customerId);
  const c = cov.customers.find((x) => x.customerId === customerId)!;
  const pairOf = (k: string) => c.pairs.find((p) => p.articleId === art[k])!;
  assert.equal(pairOf("X").outcome, "izvedeno");
  assert.equal(pairOf("X").percent, 40);
  assert.equal(pairOf("A").outcome, "direktno");
  assert.equal(pairOf("Y").outcome, "odobreno");
  assert.equal(pairOf("Y").percent, 38);
  assert.equal(pairOf("S").outcome, "van_programa");
  const g = c.groups.find((x) => x.key === "CS")!;
  assert.ok(g, JSON.stringify(c.groups.map((x) => x.key)));
  const inGroup = new Set(g.pairs.map((p) => p.articleId));
  assert.ok(inGroup.has(art.X) && !inGroup.has(art.Y) && !inGroup.has(art.S));

  // Zastarelo očekivanje → odbijeno, ništa upisano.
  const stale = await approveRebateGroup(owner, { customerId, groupKey: "CS", expected: [{ articleId: art.X, percent: 35 }], asOf: AS_OF });
  assert.equal(stale.ok, false);
  const [{ k0 }] = await db.sql<{ k0: number }[]>`SELECT count(*)::int AS k0 FROM price_rules WHERE customer_id = ${customerId}`;
  assert.equal(k0, 1);

  const expected = g.pairs.map((p) => ({ articleId: p.articleId, percent: p.percent as number }));
  const ok = await approveRebateGroup(owner, { customerId, groupKey: "CS", expected, asOf: AS_OF });
  assert.equal(ok.ok, true);
  const rules = await db.sql<{ article_id: string; status: string; discount_percent: string; source_batch: string }[]>`
    SELECT article_id, status::text AS status, discount_percent::text AS discount_percent, source_batch FROM price_rules WHERE customer_id = ${customerId}`;
  const y = rules.filter((r) => r.article_id === art.Y);
  assert.equal(y.length, 1);
  assert.equal(Number(y[0].discount_percent), 38, "odobreno pravilo ostaje netaknuto");
  const x = rules.find((r) => r.article_id === art.X)!;
  assert.equal(x.status, "approved_pending_biznisoft");
  assert.equal(Number(x.discount_percent), 40);
  assert.match(x.source_batch, /^rabati-v2-/);
  // Posle odobrenja par više nije u grupi.
  const after = (await rebateCoverage(owner, AS_OF, customerId)).customers[0];
  assert.equal(after.groups.find((x) => x.key === "CS"), undefined);
});

test("komercijalista vidi samo svoje kupce", async (t) => {
  if (guard(t)) return;
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const { rebateCoverage } = await import("@/lib/pricing/rebate-coverage-service");
  const rep = (await loadPortalUser(repId))!;
  const other = (await loadPortalUser(otherRepId))!;
  assert.ok((await rebateCoverage(rep, AS_OF)).customers.some((c) => c.customerId === customerId));
  assert.equal((await rebateCoverage(other, AS_OF)).customers.some((c) => c.customerId === customerId), false);
});
