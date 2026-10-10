import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Zahtev za porudžbinu iz stvarnog cenovnika (0044):
 *  - dve odobrene opcije: obe cene, zbir po izabranoj (44 % avans / 38 % na 30 dana);
 *  - stavka bez pravila je „na upit“: bez iznosa, nije u zbiru;
 *  - neodobrena opcija se odbija; promena cene između korpe i slanja traži novu potvrdu;
 *  - isti ključ ne pravi drugi zahtev; van programa se ne dodaje; kupac van pripreme ne šalje;
 *  - izmenjen predlog kancelarije: original netaknut, kupac potvrđuje; komercijalista ne menja.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const code = (c: string) => `QZ-${RUN}-${c}`;
let db: TestDatabase;
const ids: Record<string, string> = {};
const art: Record<string, string> = {};
let customerId: string;
let accountId: string;
const session = (assurance: "password" | "remembered" = "password") => ({
  accountId, customerId, customerName: `QA ZAHTEV ${RUN}`, email: `qz-${RUN}@qa.invalid`, name: "QA osoba", status: "active" as const, assurance,
});

async function rule(scope: { productScope: "article" | "brand"; articleId?: string; brand?: string }, pct: number, cond: string | null = null) {
  const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const s = { customerScope: "customer", customerId, ...scope, paymentCondition: cond };
  const [r] = await db.sql<{ id: string }[]>`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, brand, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required, payment_condition)
    VALUES ('customer', ${customerId}, ${scope.productScope}, ${scope.articleId ?? null}, ${scope.brand ?? null}, ${precedenceLevelFor(s)}, ${scopeKeyFor(s)},
            'discount_percent', ${pct}, '2026-01-01', 'approved_pending_biznisoft', 'QA', ${ids.owner}, now(), ${ids.owner}, now(), false, ${cond}) RETURNING id`;
  return r.id;
}

before(async () => {
  if (reason) return;
  process.env.CUSTOMER_ORDERING = "cenovnik";
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "tamara", role: "kancelarija" }, { key: "rep", role: "komercijalista" }]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QZ${RUN}`}, ${`QA ZAHTEV ${RUN}`}) RETURNING id`;
  customerId = c.id;
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${customerId}, ${ids.rep})`;
  const [u] = await db.sql<{ id: string }[]>`INSERT INTO customer_users (customer_id, email, name, password_hash, status) VALUES (${customerId}, ${`qz-${RUN}@qa.invalid`}, 'QA osoba', 'x', 'active') RETURNING id`;
  accountId = u.id;
  const items = [
    ["B1", "BASLAC 35-M218 1L BASECOAT VEOMA DUGAČAK NAZIV ZA PRELAMANJE U ŠTAMPI", "LIT", "BASLAC", "1000.00"],
    ["C1", "CS GIT MULTI 1KG", "KOM", "CS", "500.00"],
    ["N1", "CS NOVI ARTIKAL BEZ PRAVILA", "KOM", "CS", "200.00"],
    ["S1", "SIA 1950 P120", "KOM", "SIA", "50.00"],
  ] as const;
  for (const [k, name, unit, brand, price] of items) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit, brand) VALUES (${code(k)}, ${name}, ${unit}, ${brand}) RETURNING id`;
    art[k] = a.id;
    await db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by) VALUES (${a.id}, ${price}, '20', '2026-01-01', 'rucno', 'QA osnovna', ${ids.owner})`;
  }
  await db.sql`INSERT INTO article_programme_decisions (article_id, in_programme, reason, decided_by) VALUES (${art.S1}, false, 'QA sia van programa', ${ids.owner})`;
  await rule({ productScope: "brand", brand: "BASLAC" }, 38);
  await rule({ productScope: "brand", brand: "BASLAC" }, 44, "avans");
  await rule({ productScope: "article", articleId: art.C1 }, 40);
  for (const o of ["avans", "odlozeno_30"]) {
    await db.sql`INSERT INTO customer_payment_options (customer_id, option_code, status, effective_from, reason, proposed_by, decided_by, decided_at)
                 VALUES (${customerId}, ${o}, 'odobreno', '2026-01-01', 'QA odobreno', ${ids.owner}, ${ids.owner}, now())`;
  }
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId}`;
    await db.sql`UPDATE customer_orders SET replaces_order_id = NULL WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customer_order_events WHERE order_id IN (SELECT id FROM customer_orders WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_order_lines WHERE order_id IN (SELECT id FROM customer_orders WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_orders WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM price_rules WHERE customer_id = ${customerId}`;
    await db.sql`TRUNCATE customer_payment_options, article_base_prices, article_programme_decisions, customer_commercial_status_decisions`;
    await db.sql`DELETE FROM customer_message_outbox WHERE customer_user_id IN (SELECT id FROM customer_users WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_account_tokens WHERE customer_user_id IN (SELECT id FROM customer_users WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_users WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customers WHERE id = ${customerId}`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QZ-${RUN}-%`}`;
    await cleanupQa(db);
  }
  delete process.env.CUSTOMER_ORDERING;
  await closeTestDatabase();
});

const svc = async () => import("@/lib/ordering/request-service");
const user = async (k: string) => (await (await import("@/lib/authz/user-repository")).loadPortalUser(ids[k]))!;

test("korpa: obe cene, zbir po izabranoj opciji, stavka na upit bez iznosa, van programa se ne dodaje", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  assert.equal((await s.addRequestItem(session(), { articleId: art.B1, quantity: "4" })).ok, true);
  assert.equal((await s.addRequestItem(session(), { articleId: art.C1, quantity: "2" })).ok, true);
  assert.equal((await s.addRequestItem(session(), { articleId: art.N1, quantity: "1" })).ok, true);
  const out = await s.addRequestItem(session(), { articleId: art.S1, quantity: "1" });
  assert.equal(out.ok, false, "van programa se ne dodaje");
  assert.equal((await s.addRequestItem(session(), { articleId: art.C1, quantity: "1,5" })).ok, false, "KOM bez delova");
  const av = await s.loadRequestQuote(customerId, "avans");
  const od = await s.loadRequestQuote(customerId, "odlozeno_30");
  assert.deepEqual(av.options.map((o) => o.label), ["Odloženo plaćanje — 30 dana", "Avansno plaćanje"]);
  const b1 = av.lines.find((l) => l.articleId === art.B1)!;
  assert.equal((b1.byOption.avans as { netPrice: number }).netPrice, 560);
  assert.equal((b1.byOption.odlozeno_30 as { netPrice: number }).netPrice, 620);
  // avans: 4 × 560 + 2 × 300 = 2.840,00; odloženo: 4 × 620 + 2 × 300 = 3.080,00; N1 na upit u oba.
  assert.equal(av.totals.net, 2840);
  assert.equal(od.totals.net, 3080);
  assert.equal(av.onRequest, 1);
  assert.equal(av.lines.find((l) => l.articleId === art.N1)!.amounts, null);
  assert.notEqual(av.fingerprint, od.fingerprint, "opcija je deo otiska");
  assert.equal(av.canSubmit, true, "stavka na upit ne blokira slanje");
});

test("slanje: neodobrena opcija odbijena, promena cene traži novu potvrdu, isti ključ = isti zahtev", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const q = await s.loadRequestQuote(customerId, "avans");
  const bad = await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "odlozeno_60" });
  assert.equal(bad.status, "price_changed", "neodobrena opcija: bez zahteva, nova potvrda");
  assert.equal((await db.sql`SELECT 1 FROM customer_orders WHERE customer_id = ${customerId}`).length, 0);
  assert.equal((await s.submitOrderRequest(session("remembered"), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" })).status, "reauth");
  // Cena se promenila posle prikaza korpe (novo pravilo za CS GIT) → nova potvrda.
  await db.sql`UPDATE price_rules SET discount_percent = 42 WHERE customer_id = ${customerId} AND article_id = ${art.C1}`;
  const changed = await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" });
  assert.equal(changed.status, "price_changed");
  const q2 = await s.loadRequestQuote(customerId, "avans");
  const key = randomUUID();
  const input = { idempotencyKey: key, fingerprint: q2.fingerprint, paymentOption: "avans", note: "Isporuka do petka", deliveryAddress: "Magacin 2", contactPhone: "060 000 000" };
  const [a, b] = await Promise.all([s.submitOrderRequest(session(), input), s.submitOrderRequest(session(), input)]);
  assert.ok(["created", "existing"].includes(a.status) && ["created", "existing"].includes(b.status));
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customer_orders WHERE customer_id = ${customerId}`;
  assert.equal(n, 1, "dvostruko slanje pravi jedan zahtev");
  const [o] = await db.sql<{ payment_option: string; payment_option_label: string; net_total: string; on_request_lines: number; pricing_source: string; price_list_id: string | null }[]>`
    SELECT payment_option, payment_option_label, net_total::text, on_request_lines, pricing_source, price_list_id FROM customer_orders WHERE customer_id = ${customerId}`;
  assert.equal(o.payment_option, "avans");
  assert.equal(o.payment_option_label, "Avansno plaćanje");
  assert.equal(Number(o.net_total), 4 * 560 + 2 * 290);
  assert.equal(o.on_request_lines, 1);
  assert.equal(o.pricing_source, "cenovnik");
  const lines = await db.sql<{ code: string; status: string; net: string | null }[]>`
    SELECT article_code AS code, price_status AS status, net_price::text AS net FROM customer_order_lines l JOIN customer_orders o ON o.id = l.order_id WHERE o.customer_id = ${customerId} ORDER BY line_number`;
  assert.deepEqual(lines.map((l) => [l.status, l.net === null ? null : Number(l.net)]), [["cena", 560], ["cena", 290], ["na_upit", null]]);
});

test("izmenjen predlog: original netaknut, komercijalista ne menja, kupac potvrđuje → original vraćen na ispravku", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const [orig] = await db.sql<{ id: string }[]>`SELECT id FROM customer_orders WHERE customer_id = ${customerId}`;
  await assert.rejects(async () => s.proposeOrderRevision(await user("rep"), orig.id, { lines: [{ articleId: art.B1, quantity: 2 }], reason: "pokušaj" }), /pravo/);
  const rev = await s.proposeOrderRevision(await user("tamara"), orig.id, { lines: [{ articleId: art.B1, quantity: 2 }, { articleId: art.C1, quantity: 3 }], reason: "deo robe nije na stanju" });
  const status = async (id: string) => (await db.sql<{ s: string }[]>`SELECT status::text AS s FROM customer_orders WHERE id = ${id}`)[0].s;
  assert.equal(await status(orig.id), "changes_requested");
  assert.equal(await status(rev.orderId), "awaiting_customer");
  const [{ k }] = await db.sql<{ k: number }[]>`SELECT count(*)::int AS k FROM customer_order_lines WHERE order_id = ${orig.id}`;
  assert.equal(k, 3, "original zadržava svoje stavke");
  const r = await s.answerOrderRevision(session(), rev.orderId, true);
  assert.equal(r.ok, true);
  assert.equal(await status(rev.orderId), "submitted");
  assert.equal(await status(orig.id), "superseded");
  const { loadOrderRequest } = await import("@/lib/ordering/ordering-service");
  const detail = (await loadOrderRequest(await user("tamara"), rev.orderId))!;
  assert.equal(detail.revision, 2);
  assert.equal(detail.paymentOptionLabel, "Avansno plaćanje");
  assert.equal(detail.preparedByName !== null, true);
  assert.equal(detail.lines.length, 2);
});

test("stavka na upit blokira potvrdu; posle odbijenog predloga novi dobija sledeći broj; pretraga bez kvačica", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const ord = await import("@/lib/ordering/ordering-service");
  const tamara = await user("tamara");
  await db.sql`UPDATE articles SET name = 'CS RAZREĐIVAČ QA BEZ PRAVILA' WHERE id = ${art.N1}`;
  assert.ok((await s.listRequestArticles(customerId, "razredjivac qa")).articles.some((a) => a.articleId === art.N1), "razredjivac → RAZREĐIVAČ");
  assert.ok((await s.listRequestArticles(customerId, "razređivač")).articles.some((a) => a.articleId === art.N1), "razređivač → RAZREĐIVAČ");
  await s.addRequestItem(session(), { articleId: art.B1, quantity: "2" });
  await s.addRequestItem(session(), { articleId: art.N1, quantity: "1" });
  const q = await s.loadRequestQuote(customerId, "avans");
  const sent = await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" });
  assert.equal(sent.status, "created");
  const id = (sent as { orderId: string }).orderId;
  assert.ok((await ord.listOrderRequests(tamara, null, "razredjivac")).some((o) => o.id === id), "pretraga zahteva po nazivu stavke bez kvačica");
  assert.equal((await ord.officeTransition(tamara, id, "under_review", null)).ok, true);
  const blocked = await ord.officeTransition(tamara, id, "confirmed", null);
  assert.equal(blocked.ok, false, "potvrda sa stavkom na upit");
  assert.match((blocked as { message: string }).message, /na upit/);
  const r2 = await s.proposeOrderRevision(tamara, id, { lines: [{ articleId: art.B1, quantity: 2 }, { articleId: art.N1, quantity: 1 }], reason: "prvi predlog" });
  assert.match(r2.requestNumber, /\/2$/);
  await assert.rejects(async () => s.proposeOrderRevision(tamara, id, { lines: [{ articleId: art.B1, quantity: 1 }], reason: "dok čeka kupca" }), /već postoji predlog/);
  assert.equal((await s.answerOrderRevision(session(), r2.orderId, false)).ok, true);
  const r3 = await s.proposeOrderRevision(tamara, id, { lines: [{ articleId: art.B1, quantity: 2 }], reason: "drugi predlog bez stavke na upit" });
  assert.match(r3.requestNumber, /\/3$/, "drugi predlog ne ponavlja broj /2");
  const orig = (await ord.loadOrderRequest(tamara, id))!;
  assert.equal(orig.replacedBy?.requestNumber, r3.requestNumber, "važeća zamena je /3, ne odbijena /2");
  assert.equal((await s.answerOrderRevision(session(), r3.orderId, true)).ok, true);
  assert.equal((await ord.officeTransition(tamara, r3.orderId, "under_review", null)).ok, true);
  assert.equal((await ord.officeTransition(tamara, r3.orderId, "confirmed", null)).ok, true, "bez stavki na upit potvrda prolazi");
  await db.sql`UPDATE articles SET name = 'CS NOVI ARTIKAL BEZ PRAVILA' WHERE id = ${art.N1}`;
});

test("odredište kupca posle prijave i odjave zavisi od režima „sajt u pripremi“", async () => {
  const { customerLandingAfterLogin, customerLandingAfterLogout } = await import("@/lib/authz/customer-landing");
  const prev = process.env.MAINTENANCE_MODE;
  try {
    process.env.MAINTENANCE_MODE = "1";
    assert.equal(customerLandingAfterLogin(null), "/kupac");
    assert.equal(customerLandingAfterLogin("/katalog"), "/kupac", "javna strana bi vodila na /site-u-pripremi");
    assert.equal(customerLandingAfterLogin("/kupac/korpa"), "/kupac/korpa");
    assert.equal(customerLandingAfterLogout("/katalog"), "/prijava/kupac?poruka=odjava");
    process.env.MAINTENANCE_MODE = "0";
    assert.equal(customerLandingAfterLogin(null), "/kupac");
    assert.equal(customerLandingAfterLogin("/katalog"), "/katalog");
    assert.equal(customerLandingAfterLogout("/katalog"), "/katalog");
    assert.equal(customerLandingAfterLogout("/kupac/korpa"), "/");
  } finally {
    if (prev === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = prev;
  }
});

test("verzije: važeća verzija, liste bez starih verzija, server odbija radnju nad zastarelom verzijom, otisak se menja", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const ord = await import("@/lib/ordering/ordering-service");
  const live = await import("@/lib/ordering/live-stamp");
  const tamara = await user("tamara");
  await s.addRequestItem(session(), { articleId: art.B1, quantity: "3" });
  const q = await s.loadRequestQuote(customerId, "avans");
  const sent = (await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" })) as { orderId: string };
  const id = sent.orderId;
  const listStamp0 = await live.staffOrderStamp(tamara, null);
  const chain0 = await live.customerOrderStamp(customerId, id);
  const v0 = (await ord.loadOrderRequest(tamara, id))!.version;
  // Prozor A preuzima u obradu; prozor B (stara oznaka) pokušava da odbije → zastarelo, ništa se ne menja.
  assert.equal((await ord.officeTransition(tamara, id, "under_review", null, v0)).ok, true);
  const staleReject = await ord.officeTransition(tamara, id, "rejected", "drugi prozor", v0);
  assert.equal(staleReject.ok, false);
  assert.ok(!staleReject.ok && staleReject.stale, "odgovor nudi aktuelnu verziju");
  assert.equal((await db.sql<{ s: string }[]>`SELECT status::text AS s FROM customer_orders WHERE id = ${id}`)[0].s, "under_review");
  assert.notEqual(await live.staffOrderStamp(tamara, null), listStamp0, "otisak liste se promenio");
  assert.notEqual(await live.customerOrderStamp(customerId, id), chain0, "otisak lanca se promenio");
  // Predlog sa zastarelom oznakom se odbija; sa važećom prolazi.
  await assert.rejects(async () => s.proposeOrderRevision(tamara, id, { lines: [{ articleId: art.B1, quantity: 2 }], reason: "zastarela oznaka", expectedVersion: v0 }), /u međuvremenu promenjen/);
  const v1 = (await ord.loadOrderRequest(tamara, id))!.version;
  const rev = await s.proposeOrderRevision(tamara, id, { lines: [{ articleId: art.B1, quantity: 2 }], reason: "predlog iz prozora A", expectedVersion: v1 });
  // Original sada vodi na važeću verziju; liste prikazuju samo nju.
  const orig = (await ord.loadOrderRequest(tamara, id))!;
  assert.equal(orig.current?.id, rev.orderId, "važeća verzija originala je predlog");
  assert.equal(orig.versions.length, 2);
  const list = await ord.listOrderRequests(tamara, null, null);
  assert.ok(list.some((o) => o.id === rev.orderId) && !list.some((o) => o.id === id), "lista: samo važeća verzija");
  assert.equal(list.find((o) => o.id === rev.orderId)!.otherVersions, 1);
  assert.ok((await ord.listOrderRequests(tamara, null, null, { allVersions: true })).some((o) => o.id === id), "sve verzije na zahtev");
  assert.ok(!(await ord.listCustomerOrders(customerId)).some((o) => o.id === id), "kupčeva lista: samo važeća verzija");
  // Kupac u dva prozora: A potvrđuje, B (stara oznaka) pokušava da odbije → zastarelo.
  const pv = (await ord.loadCustomerOrder(customerId, rev.orderId))!.version;
  assert.equal((await s.answerOrderRevision(session(), rev.orderId, true, pv)).ok, true);
  const late = await s.answerOrderRevision(session(), rev.orderId, false, pv);
  assert.equal(late.ok, false);
  assert.match((late as { message: string }).message, /u međuvremenu promenjen/);
  assert.equal((await db.sql<{ s: string }[]>`SELECT status::text AS s FROM customer_orders WHERE id = ${rev.orderId}`)[0].s, "submitted");
  // Otkazivanje stare verzije (originala) iz zastarelog prozora → ponuđena važeća verzija.
  const cancelOld = await ord.cancelCustomerOrder(session(), id, v0);
  assert.equal(cancelOld.ok, false);
  assert.equal(!cancelOld.ok && cancelOld.stale?.currentId, rev.orderId);
});

test("opoziv opcije plaćanja posle prikaza korpe traži novu potvrdu", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  await s.addRequestItem(session(), { articleId: art.B1, quantity: "1" });
  const q = await s.loadRequestQuote(customerId, "avans");
  await db.sql`UPDATE customer_payment_options SET status = 'opozvano' WHERE customer_id = ${customerId} AND option_code = 'avans'`;
  try {
    const r = await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" });
    assert.equal(r.status, "price_changed");
    assert.match(String((r as { message?: string }).message), /potvrdite ponovo/);
  } finally {
    await db.sql`UPDATE customer_payment_options SET status = 'odobreno' WHERE customer_id = ${customerId} AND option_code = 'avans'`;
    await db.sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId}`;
  }
});

test("kontrolisana proba: isključeno za sve osim izdvojenog test kupca; probni nalog samo vlasnik", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const { createTrialAccount } = await import("@/lib/ordering/trial-service");
  delete process.env.CUSTOMER_ORDERING;
  const [other] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QY${RUN}`}, ${`QA DRUGI ${RUN}`}) RETURNING id`;
  try {
    assert.equal((await s.loadRequestQuote(customerId, "avans")).enabled, false, "bez spiska i bez prekidača isključeno");
    assert.equal((await s.addRequestItem(session(), { articleId: art.B1, quantity: "1" })).ok, false);
    await db.sql`INSERT INTO system_settings (key, value) VALUES ('ordering.trial', ${db.sql.json({ customerIds: [customerId] })})
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    assert.equal((await s.loadRequestQuote(customerId, "avans")).enabled, true, "test kupac uključen");
    assert.equal((await s.loadRequestQuote(other.id, "avans")).enabled, false, "drugi kupac ostaje isključen");
    await assert.rejects(async () => createTrialAccount(await user("tamara"), { customerId, email: `qy-${RUN}@qa.invalid`, name: "x" }), /vlasnik/);
    await assert.rejects(async () => createTrialAccount(await user("owner"), { customerId: other.id, email: `qy-${RUN}@qa.invalid`, name: "x" }), /test kupca/);
    const r = await createTrialAccount(await user("owner"), { customerId, email: `qy-${RUN}@qa.invalid`, name: "Proba" });
    assert.match(r.link, /^\/prijava\/kupac\/aktivacija\?token=/);
    const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customer_users WHERE customer_id = ${other.id}`;
    assert.equal(n, 0, "drugi kupac bez naloga");
  } finally {
    await db.sql`DELETE FROM system_settings WHERE key = 'ordering.trial'`;
    await db.sql`DELETE FROM customers WHERE id = ${other.id}`;
    process.env.CUSTOMER_ORDERING = "cenovnik";
  }
});

test("kupac van pripreme za portal ne može da pošalje zahtev", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  await db.sql`INSERT INTO customer_commercial_status_decisions (customer_id, status, reason, decided_by) VALUES (${customerId}, 'van_pripreme_portala', 'QA fakturisanje za druge', ${ids.owner})`;
  await s.addRequestItem(session(), { articleId: art.B1, quantity: "1" });
  const q = await s.loadRequestQuote(customerId, "avans");
  const r = await s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint, paymentOption: "avans" });
  assert.equal(r.status, "blocked");
});
