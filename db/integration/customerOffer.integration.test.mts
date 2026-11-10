import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Preporuke kupca i „Ne uzima više“ (0060, 2026-11-10):
 *  - tabela kupca: poslednja cena/rabat/količina sa fakture i istorija;
 *  - oznaka skida artikal iz Preporuka i sa kartice/„Za razgovor“, a tabela ga prikazuje odvojeno;
 *  - vraćanje je jednokratno; zapis se ne briše; tuđ kupac se ne otvara.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);

const ISSUER = "QA-PONUDA";
const AS_OF = "2026-09-28";
const RUN = randomUUID().slice(0, 6);
const K1 = `QP${RUN}1`;
const K2 = `QP${RUN}2`;
let db: TestDatabase;
const ids: Record<string, string> = {};
let customerId = "";
let counter = 0;
type Actor = { id: string; name: string; role: string };
let owner: Actor;

async function purchase(issuedOn: string, discount: string) {
  counter += 1;
  const number = `PO${RUN}${counter}`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${number}, ${Number(issuedOn.slice(0, 4))}, ${issuedOn}, ${customerId}, '130.00', '156.00', 'manual_upload')
    RETURNING id`;
  const amount = (2 * 100 * (1 - Number(discount) / 100)).toFixed(2);
  await db.sql`
    INSERT INTO invoice_lines (invoice_id, line_number, article_code, description, quantity, unit_price, discount_percent, line_amount)
    VALUES (${inv.id}, 1, ${K1}, 'QA KLAR', '2.000', '100.0000', ${discount}, ${amount}),
           (${inv.id}, 2, ${K2}, 'QA ŠMIRGLA', '1.000', '100.0000', ${discount}, ${(Number(amount) / 2).toFixed(2)})`;
  await db.sql`
    INSERT INTO source_documents (file_hash, file_name, page_count, line_count, issuer_code, business_document_type,
      business_document_number, external_partner_code, document_date, parser_version, validation_status,
      revision_status, manual_review, origin, invoice_id)
    VALUES (${randomUUID().replace(/-/g, "")}, ${`${number}.pdf`}, 1, 2, ${ISSUER}, 'faktura', ${number}, 'PP1',
            ${issuedOn}, 'qa-1', 'valid', 'original', 'not_required', 'manual_upload', ${inv.id})`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "milan", role: "komercijalista" },
    { key: "petar", role: "komercijalista" },
  ]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  owner = { id: acc.owner.id, name: acc.owner.name, role: acc.owner.role };
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QP${RUN}`}, ${`QA PONUDA ${RUN}`}) RETURNING id`;
  customerId = c.id;
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${customerId}, ${ids.milan})`;
  await db.sql`
    INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, 'PP1', ${customerId}, 'mapped')`;
  await db.sql`INSERT INTO articles (code, name, unit) VALUES (${K1}, 'QA KLAR 1L', 'KOM'), (${K2}, 'QA ŠMIRGLA P400', 'KOM')`;
  const { addDays } = await import("@/lib/recommendations/cadence.mjs");
  for (let i = 0; i < 8; i += 1) await purchase(addDays("2026-03-02", 21 * i), i === 7 ? "38" : "35");
  const { recomputeRecommendations } = await import("@/lib/recommendations/recompute");
  await recomputeRecommendations({ customerIds: null }, { asOfDate: AS_OF }, owner);
});

after(async () => {
  if (!reason && db) {
    await db.sql`TRUNCATE customer_article_dismissals`;
    await db.sql`DELETE FROM recommendation_results`;
    await db.sql`DELETE FROM recommendation_recompute_requests`;
    await db.sql`DELETE FROM recommendation_runs`;
    await db.sql`DELETE FROM source_documents WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
    await db.sql`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customers WHERE id = ${customerId}`;
    await db.sql`DELETE FROM articles WHERE code IN (${K1}, ${K2})`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const user = async (k: string) => (await (await import("@/lib/authz/user-repository")).loadPortalUser(ids[k]))!;

test("tabela kupca: poslednja faktura (cena, rabat, količina) i istorija", async (t) => {
  if (guard(t)) return;
  const { loadCustomerOffer } = await import("@/lib/recommendations/customer-offer-service");
  const o = await loadCustomerOffer(await user("milan"), customerId, new Date("2026-09-29T10:00:00+02:00"));
  const k1 = o.rows.find((r) => r.articleCode === K1)!;
  assert.ok(k1, "artikal je u tabeli");
  assert.equal(k1.last?.quantity, 2);
  assert.equal(k1.last?.discountPercent, 38, "rabat sa POSLEDNJE fakture");
  assert.equal(k1.history.length, 6, "najviše 6 kupovina u detaljima");
  assert.equal(k1.today, null, "bez osnovne cene: danas „na upit“, nikad izmišljena cena");
  assert.equal(k1.dismissal, null);
});

test("„Ne uzima više“: skida artikal iz Preporuka i sa kartice, tabela ga prikazuje odvojeno; vraćanje jednom", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/recommendations/customer-offer-service");
  const { recommendationRows } = await import("@/lib/recommendations/query");
  const { loadCustomerProfile } = await import("@/lib/recommendations/customer-profile");
  const milan = await user("milan");
  const scope = { customerIds: [customerId] };
  const before = (await recommendationRows(scope, { customerStatus: "svi" })).map((r) => r.articleCode).sort();
  assert.deepEqual(before, [K1, K2].sort());

  await assert.rejects(svc.dismissArticle(milan, { customerId, articleCode: K1, reason: "zamenjen" }), /zamenjen/);
  await assert.rejects(svc.dismissArticle(milan, { customerId, articleCode: "NEPOSTOJI", reason: "cena" }), /nije kupovao/);
  await svc.dismissArticle(milan, { customerId, articleCode: K1, reason: "zamenjen", replacementCode: K2, note: "uzima šmirglu umesto klara (QA)" });
  await assert.rejects(svc.dismissArticle(milan, { customerId, articleCode: K1, reason: "cena" }), /već označen/);

  assert.deepEqual((await recommendationRows(scope, { customerStatus: "svi" })).map((r) => r.articleCode), [K2], "Preporuke bez artikla");
  const profile = await loadCustomerProfile(customerId, new Date("2026-09-29T10:00:00+02:00"));
  assert.ok(!profile.articles.some((a) => a.articleCode === K1), "kartica i „Za razgovor“ bez artikla");
  const o = await svc.loadCustomerOffer(milan, customerId);
  const k1 = o.rows.find((r) => r.articleCode === K1)!;
  assert.equal(k1.dismissal?.reasonLabel, "Zamenjen našim drugim artiklom");
  assert.match(k1.dismissal?.replacement ?? "", new RegExp(K2));

  // Zapis se ne briše i ne prepravlja.
  await assert.rejects(db.sql`DELETE FROM customer_article_dismissals WHERE article_code = ${K1}`, /ne briše/);
  await assert.rejects(db.sql`UPDATE customer_article_dismissals SET note = 'prepravka' WHERE article_code = ${K1}`, /samo vraća/);

  await svc.restoreArticle(milan, { customerId, dismissalId: k1.dismissal!.id });
  await assert.rejects(svc.restoreArticle(milan, { customerId, dismissalId: k1.dismissal!.id }), /već vraćena/);
  assert.equal((await recommendationRows(scope, { customerStatus: "svi" })).length, 2, "artikal je ponovo u preporukama");
  // Posle vraćanja može ponovo da se označi (aktivna je samo jedna oznaka).
  await svc.dismissArticle(milan, { customerId, articleCode: K1, reason: "cena" });
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customer_article_dismissals WHERE article_code = ${K1}`;
  assert.equal(n, 2, "istorija oznaka ostaje");
});

test("opseg: komercijalista bez dodele ne otvara kupca i ne beleži oznaku; vlasnik može", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/recommendations/customer-offer-service");
  await assert.rejects(svc.loadCustomerOffer(await user("petar"), customerId), svc.CustomerOfferError);
  await assert.rejects(svc.dismissArticle(await user("petar"), { customerId, articleCode: K2, reason: "cena" }), /opsegu/);
  const o = await svc.loadCustomerOffer(await user("owner"), customerId);
  assert.ok(o.rows.length >= 2);
});
