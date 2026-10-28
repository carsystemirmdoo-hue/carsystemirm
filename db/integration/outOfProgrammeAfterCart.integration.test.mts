import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Artikal stavljen VAN PROGRAMA (0040) posle toga što je već u korpi kupca (odluka vlasnika, npr. Befar Turkuaz Static Foil):
 *  - ne pojavljuje se u izboru robe (pretraga po šifri i nazivu);
 *  - ne dodaje se ni po id-u (korpa zahteva), ni po šifri (korpa kupovine iz kataloga);
 *  - stavka koja je već u korpi blokira slanje zahteva; nijedan zahtev se ne upisuje;
 *  - istorija ostaje: artikal i njegova osnovna cena se ne brišu.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const CODE = `QT-${RUN}-079150`;
let db: TestDatabase;
const ids: Record<string, string> = {};
let customerId: string;
let accountId: string;
let articleId: string;
const session = () => ({ accountId, customerId, customerName: `QA TURKUAZ ${RUN}`, email: `qt-${RUN}@qa.invalid`, name: "QA osoba", status: "active" as const, assurance: "password" as const });

before(async () => {
  if (reason) return;
  process.env.CUSTOMER_ORDERING = "cenovnik";
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  ids.owner = acc.owner.id;
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QT${RUN}`}, ${`QA TURKUAZ ${RUN}`}) RETURNING id`;
  customerId = c.id;
  const [u] = await db.sql<{ id: string }[]>`INSERT INTO customer_users (customer_id, email, name, password_hash, status) VALUES (${customerId}, ${`qt-${RUN}@qa.invalid`}, 'QA osoba', 'x', 'active') RETURNING id`;
  accountId = u.id;
  const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit, brand) VALUES (${CODE}, 'BEFAR POLUANTISTATIK FOLIJA QA', 'KOM', 'BEFAR') RETURNING id`;
  articleId = a.id;
  await db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by) VALUES (${articleId}, '900.00', '20', '2026-01-01', 'rucno', 'QA osnovna', ${ids.owner})`;
  await db.sql`INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by) VALUES (${articleId}, '1', 'KOM', 'rolna', 'QA', ${ids.owner})`;
  await db.sql`INSERT INTO customer_payment_options (customer_id, option_code, status, effective_from, reason, proposed_by, decided_by, decided_at)
               VALUES (${customerId}, 'avans', 'odobreno', '2026-01-01', 'QA odobreno', ${ids.owner}, ${ids.owner}, now())`;
});

after(async () => {
  if (!reason && db && customerId) {
    await db.sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customer_order_events WHERE order_id IN (SELECT id FROM customer_orders WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_order_lines WHERE order_id IN (SELECT id FROM customer_orders WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_orders WHERE customer_id = ${customerId}`;
    await db.sql`TRUNCATE customer_payment_options, article_programme_decisions, article_pack_sizes, article_base_prices`;
    await db.sql`DELETE FROM customer_users WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customers WHERE id = ${customerId}`;
    await db.sql`DELETE FROM articles WHERE id = ${articleId}`;
    await cleanupQa(db);
  }
  delete process.env.CUSTOMER_ORDERING;
  await closeTestDatabase();
});

test("van programa posle dodavanja u korpu: pretraga, korpa po id-u i po šifri, slanje zahteva", async (t) => {
  if (guard(t)) return;
  const s = await import("@/lib/ordering/request-service");
  assert.equal((await s.addRequestItem(session(), { articleId, packs: "2" })).ok, true, "pre odluke se dodaje");
  assert.ok((await s.listRequestArticles(customerId, "079150")).articles.some((x) => x.articleId === articleId), "pre odluke se nalazi");

  await db.sql`INSERT INTO article_programme_decisions (article_id, in_programme, reason, decided_by) VALUES (${articleId}, false, 'QA: proizvod uklonjen iz ponude', ${ids.owner})`;

  for (const q of ["079150", CODE, "poluantistatik"]) {
    assert.equal((await s.listRequestArticles(customerId, q)).articles.some((x) => x.articleId === articleId), false, `pretraga „${q}“`);
  }
  const again = await s.addRequestItem(session(), { articleId, packs: "1" });
  assert.equal(again.ok, false); assert.match((again as { message: string }).message, /nije u aktuelnoj ponudi/);
  const cat = await s.addCatalogItem(session(), { articleId, packs: "1" });
  assert.equal(cat.ok, false, "korpa iz kataloga po id-u");
  const o = await import("@/lib/ordering/ordering-service");
  const byCode = await o.addToCart(session(), { articleCode: CODE, quantity: "1" });
  assert.equal(byCode.ok, false, "korpa po šifri");

  const q = await s.loadRequestQuote(customerId, "avans");
  const line = q.lines.find((l) => l.articleId === articleId);
  assert.ok(line, "stavka koja je već bila u korpi ostaje vidljiva kupcu");
  assert.match(String(line!.problem), /nije u aktuelnoj ponudi/);
  assert.equal(q.canSubmit, false, "slanje blokirano");
  const sent = await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" });
  assert.notEqual(sent.status, "ok"); assert.notEqual(sent.status, "created");
  assert.equal((await db.sql`SELECT 1 FROM customer_orders WHERE customer_id = ${customerId}`).length, 0, "nijedan zahtev");
  assert.equal((await db.sql`SELECT 1 FROM articles WHERE id = ${articleId}`).length, 1, "artikal ostaje");
  assert.equal((await db.sql`SELECT 1 FROM article_base_prices WHERE article_id = ${articleId}`).length, 1, "osnovna cena ostaje");
});
