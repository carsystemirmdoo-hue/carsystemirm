import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Obavezan par u jednakoj količini (0056): blanko posuda → poklopac.
 *  - posuda dodaje/menja/uklanja poklopac sama (stara i nova šifra iste posude dele poklopac → zbir);
 *  - poklopac se ne dodaje, ne menja i ne uklanja ručno;
 *  - slanje se odbija na serveru ako par nije jednak (i kada je korpa izmenjena mimo akcija);
 *  - poklopac koji se ne može poručiti → posuda ne ulazi u korpu;
 *  - izmenjen predlog kancelarije sa nejednakim parom se odbija;
 *  - povučen par se više ne sprovodi; zapis se ne briše niti prepravlja.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const code = (c: string) => `QP-${RUN}-${c}`;
let db: TestDatabase;
const ids: Record<string, string> = {};
const art: Record<string, string> = {};
let customerId: string;
let accountId: string;
const session = () => ({ accountId, customerId, customerName: `QA PAR ${RUN}`, email: `qp-${RUN}@qa.invalid`, name: "QA osoba", status: "active" as const, assurance: "password" as const });

before(async () => {
  if (reason) return;
  process.env.CUSTOMER_ORDERING = "cenovnik";
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "tamara", role: "kancelarija" }]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QP${RUN}`}, ${`QA PAR ${RUN}`}) RETURNING id`;
  customerId = c.id;
  const [u] = await db.sql<{ id: string }[]>`INSERT INTO customer_users (customer_id, email, name, password_hash, status) VALUES (${customerId}, ${`qp-${RUN}@qa.invalid`}, 'QA osoba', 'x', 'active') RETURNING id`;
  accountId = u.id;
  const items = [
    ["P1", "CS POSUDA BLANKO 1 L NOVA", "100.00"],
    ["P0", "CS POSUDA BLANKO 1 L STARA SIFRA", "100.00"],
    ["L1", "CS POKLOPAC 1 L", "20.00"],
    ["P5", "CS POSUDA BLANKO 5 L", "300.00"],
    ["L5", "CS POKLOPAC 5 L", "40.00"],
    ["X1", "CS OBICAN ARTIKAL", "50.00"],
  ] as const;
  for (const [k, name, price] of items) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit, brand) VALUES (${code(k)}, ${name}, 'KOM', 'CS') RETURNING id`;
    art[k] = a.id;
    await db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by) VALUES (${a.id}, ${price}, '20', '2026-01-01', 'rucno', 'QA osnovna', ${ids.owner})`;
    await db.sql`INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by) VALUES (${a.id}, '1', 'KOM', '1 kom', 'QA', ${ids.owner})`;
  }
  for (const [p, l] of [["P1", "L1"], ["P0", "L1"], ["P5", "L5"]]) {
    await db.sql`INSERT INTO article_required_pairs (article_id, companion_article_id, evidence, decided_by) VALUES (${art[p]}, ${art[l]}, 'QA odluka vlasnika', ${ids.owner})`;
  }
  await db.sql`INSERT INTO customer_payment_options (customer_id, option_code, status, effective_from, reason, proposed_by, decided_by, decided_at)
               VALUES (${customerId}, 'avans', 'odobreno', '2026-01-01', 'QA odobreno', ${ids.owner}, ${ids.owner}, now())`;
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId}`;
    await db.sql`UPDATE customer_orders SET replaces_order_id = NULL WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customer_order_events WHERE order_id IN (SELECT id FROM customer_orders WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_order_lines WHERE order_id IN (SELECT id FROM customer_orders WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_orders WHERE customer_id = ${customerId}`;
    // TRUNCATE ne pokreće okidač reda (DELETE je zabranjen i vlasniku kroz okidač).
    await db.sql`TRUNCATE article_required_pairs, customer_payment_options, article_base_prices, article_pack_sizes, article_programme_decisions, customer_commercial_status_decisions`;
    await db.sql`DELETE FROM customer_message_outbox WHERE customer_user_id IN (SELECT id FROM customer_users WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_users WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customers WHERE id = ${customerId}`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QP-${RUN}-%`}`;
    await cleanupQa(db);
  }
  delete process.env.CUSTOMER_ORDERING;
  await closeTestDatabase();
});

const svc = async () => import("@/lib/ordering/request-service");
const user = async (k: string) => (await (await import("@/lib/authz/user-repository")).loadPortalUser(ids[k]))!;
const cart = async () => Object.fromEntries((await db.sql<{ article_id: string; q: number; p: number | null }[]>`
  SELECT article_id, quantity::float8 AS q, pack_count AS p FROM customer_cart_items WHERE customer_id = ${customerId}`).map((r) => [r.article_id, r.q]));

test("posuda vodi poklopac: dodavanje, promena, druga šifra iste posude (zbir), uklanjanje", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  assert.equal((await s.addRequestItem(session(), { articleId: art.P1, packs: "2" })).ok, true);
  assert.equal((await cart())[art.L1], 2, "poklopac dodat sam, isti broj");
  assert.equal((await s.addRequestItem(session(), { articleId: art.P0, packs: "3" })).ok, true);
  assert.equal((await cart())[art.L1], 5, "stara + nova šifra posude = jedan poklopac, zbir");
  assert.equal((await s.setRequestPacks(session(), { articleId: art.P1, packs: "4" })).ok, true);
  assert.equal((await cart())[art.L1], 7);
  assert.equal((await s.setRequestPacks(session(), { articleId: art.P0, packs: "0" })).ok, true);
  assert.equal((await cart())[art.L1], 4, "uklonjena posuda smanjuje poklopce");
  const q = await s.loadRequestQuote(customerId, "avans");
  assert.equal(q.canSubmit, true, q.blockers.join("; "));
  assert.deepEqual(q.pairedLids[art.L1], ["CS POSUDA BLANKO 1 L NOVA"]);
  assert.equal((await s.setRequestPacks(session(), { articleId: art.P1, packs: "" })).ok, true);
  assert.equal((await cart())[art.L1], undefined, "bez posude nema ni poklopca");
});

test("poklopac se ne dodaje, ne menja i ne uklanja ručno", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  assert.equal((await s.addRequestItem(session(), { articleId: art.L1, packs: "1" })).ok, false, "poklopac sam se ne dodaje");
  assert.equal((await cart())[art.L1], undefined);
  await s.addRequestItem(session(), { articleId: art.P1, packs: "3" });
  for (const packs of ["2", "4", "0", ""]) {
    const r = await s.setRequestPacks(session(), { articleId: art.L1, packs });
    assert.equal(r.ok, false, `poklopac → ${JSON.stringify(packs)} mora biti odbijeno`);
    assert.equal((await cart())[art.L1], 3);
  }
  assert.equal((await s.addRequestItem(session(), { articleId: art.L1, packs: "1" })).ok, false, "ni uz posudu se ne dodaje višak");
  assert.equal((await s.setRequestPacks(session(), { articleId: art.L1, packs: "3" })).ok, true, "isti broj kao posude je dozvoljen (bez promene)");
  await s.setRequestPacks(session(), { articleId: art.P1, packs: "0" });
});

test("slanje: server odbija nejednak par i kada je korpa izmenjena mimo akcija; jednak par prolazi", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  await s.addRequestItem(session(), { articleId: art.P1, packs: "2" });
  await s.addRequestItem(session(), { articleId: art.X1, packs: "1" });
  // Zaobilaženje: poklopac smanjen direktno u bazi (stara kartica, istovremena izmena…).
  await db.sql`UPDATE customer_cart_items SET quantity = 1, pack_count = 1 WHERE customer_id = ${customerId} AND article_id = ${art.L1}`;
  let q = await s.loadRequestQuote(customerId, "avans");
  assert.equal(q.canSubmit, false);
  assert.match(q.blockers.join(" "), /CS POKLOPAC 1 L: broj poklopaca mora biti jednak broju posuda \(2\), a sada je 1/);
  const r = await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" });
  assert.equal(r.status, "blocked");
  // Poklopac uklonjen mimo akcija.
  await db.sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId} AND article_id = ${art.L1}`;
  q = await s.loadRequestQuote(customerId, "avans");
  assert.equal((await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" })).status, "blocked");
  // Poklopac bez posude.
  await db.sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId} AND article_id = ${art.P1}`;
  await db.sql`INSERT INTO customer_cart_items (customer_id, article_id, quantity, pack_count, added_by) VALUES (${customerId}, ${art.L5}, 2, 2, ${accountId})`;
  q = await s.loadRequestQuote(customerId, "avans");
  assert.match(q.blockers.join(" "), /CS POKLOPAC 5 L: poklopac se ne poručuje bez odgovarajuće posude/);
  assert.equal((await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" })).status, "blocked");
  assert.equal((await db.sql`SELECT 1 FROM customer_orders WHERE customer_id = ${customerId}`).length, 0, "nijedan zahtev nije upisan");
  assert.equal((await s.setRequestPacks(session(), { articleId: art.L5, packs: "0" })).ok, true, "poklopac bez posude sme da se ukloni");
  // Ispravno: svaka sledeća promena posude usklađuje poklopac; slanje prolazi i upisuje jednak par.
  await s.addRequestItem(session(), { articleId: art.P1, packs: "2" });
  await s.addRequestItem(session(), { articleId: art.P5, packs: "1" });
  q = await s.loadRequestQuote(customerId, "avans");
  assert.equal(q.canSubmit, true, q.blockers.join("; "));
  const ok = await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" });
  assert.equal(ok.status, "created");
  const lines = Object.fromEntries((await db.sql<{ article_id: string; q: number }[]>`
    SELECT article_id, quantity::float8 AS q FROM customer_order_lines WHERE order_id = ${(ok as { orderId: string }).orderId}`).map((l) => [l.article_id, l.q]));
  assert.deepEqual([lines[art.P1], lines[art.L1], lines[art.P5], lines[art.L5], lines[art.X1]], [2, 2, 1, 1, 1]);
});

test("izmenjen predlog kancelarije: nejednak par odbijen (i u pregledu), jednak prolazi", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const [o] = await db.sql<{ id: string }[]>`SELECT id FROM customer_orders WHERE customer_id = ${customerId} AND status = 'submitted'`;
  const tamara = await user("tamara");
  const bad = [{ articleId: art.P1, quantity: 3 }, { articleId: art.L1, quantity: 2 }];
  assert.match((await s.previewOrderRevision(tamara, o.id, bad)).pairProblems.join(" "), /\(3\), a sada je 2/);
  await assert.rejects(s.proposeOrderRevision(tamara, o.id, { lines: bad, reason: "promena količine" }), /broj poklopaca mora biti jednak/);
  await assert.rejects(s.proposeOrderRevision(tamara, o.id, { lines: [{ articleId: art.L5, quantity: 1 }], reason: "samo poklopac" }), /ne poručuje bez/);
  const good = [{ articleId: art.P1, quantity: 3 }, { articleId: art.L1, quantity: 3 }];
  assert.deepEqual((await s.previewOrderRevision(tamara, o.id, good)).pairProblems, []);
  assert.ok((await s.proposeOrderRevision(tamara, o.id, { lines: good, reason: "promena količine" })).orderId);
});

test("poklopac koji se ne može poručiti → posuda ne ulazi u korpu; korpa ostaje ista", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  await db.sql`INSERT INTO article_programme_decisions (article_id, in_programme, reason, decided_by) VALUES (${art.L5}, false, 'QA poklopac van programa', ${ids.owner})`;
  const before = await cart();
  const r = await s.addRequestItem(session(), { articleId: art.P5, packs: "1" });
  assert.equal(r.ok, false);
  assert.match((r as { message: string }).message, /obavezan poklopac \(CS POKLOPAC 5 L\) nije dostupan/);
  assert.deepEqual(await cart(), before, "ni posuda ni poklopac nisu upisani");
});

test("zapis para: bez brisanja i prepravke; povučen par se više ne sprovodi", async (t) => {
  if (guard(t)) return;
  await assert.rejects(db.sql`DELETE FROM article_required_pairs WHERE article_id = ${art.P0}`, /ne briše/);
  await assert.rejects(db.sql`UPDATE article_required_pairs SET evidence = 'prepravka' WHERE article_id = ${art.P0}`, /samo povlači/);
  await assert.rejects(db.sql`UPDATE article_required_pairs SET revoked_at = now() WHERE article_id = ${art.P0}`, /text_check/);
  await db.sql`UPDATE article_required_pairs SET revoked_at = now(), revoked_reason = 'QA povlačenje' WHERE article_id = ${art.P0}`;
  await assert.rejects(db.sql`UPDATE article_required_pairs SET revoked_reason = 'drugi razlog' WHERE article_id = ${art.P0}`, /samo povlači/);
  const s = await svc();
  await db.sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId}`;
  assert.equal((await s.addRequestItem(session(), { articleId: art.P0, packs: "2" })).ok, true);
  assert.equal((await cart())[art.L1], undefined, "povučen par: poklopac se ne dodaje sam");
  assert.equal((await s.loadRequestQuote(customerId, "avans")).canSubmit, true);
});
