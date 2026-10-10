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
 * F7 priprema: korpa firme → zahtev → prijem u kancelariji → porudžbina.
 *
 * Proverava tražene slučajeve: izolaciju dve firme, promenu cene pre slanja,
 * nevažeću varijantu, ponovljeno (i istovremeno) slanje, prelaze statusa, i da
 * istorijska fakturisana cena nikad ne postaje cena u korpi.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const RUN = randomUUID().slice(0, 6);
const code = (c: string) => `QAO-${RUN}-${c}`;
let db: TestDatabase;
const staff: Record<string, { id: string }> = {};
const firm: Record<"a" | "b", { customerId: string; accountId: string; name: string }> = {
  a: { customerId: "", accountId: "", name: "" },
  b: { customerId: "", accountId: "", name: "" },
};
const art: Record<string, string> = {};
let listId = "";

type Svc = typeof import("@/lib/ordering/ordering-service");
let svc: Svc;

function session(who: "a" | "b") {
  return {
    accountId: firm[who].accountId,
    customerId: firm[who].customerId,
    customerName: firm[who].name,
    email: `${who}@qa.invalid`,
    name: `QA osoba ${who}`,
    status: "active" as const,
  };
}

async function portalUser(key: string) {
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  return (await loadPortalUser(staff[key].id))!;
}

async function mapTo(articleCode: string, slug: string, variant: string | null) {
  const { decideMapping } = await import("@/lib/commercial/mapping-service");
  const [owner] = await db.sql<{ id: string; name: string; role: string }[]>`SELECT id, name, role::text AS role FROM users WHERE id = ${staff.owner.id}`;
  await decideMapping({ articleId: art[articleCode], status: "mapped", catalogProductSlug: slug, catalogVariantId: variant, note: "QA potvrda" }, owner);
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  process.env.CUSTOMER_ORDERING = "demo";
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "office", role: "kancelarija" },
    { key: "rep", role: "komercijalista" },
  ]);
  for (const k of Object.keys(accounts)) staff[k] = { id: accounts[k].id };

  await db.sql`INSERT INTO system_settings (key, value) VALUES ('dataset.kind', ${db.sql.json({ kind: "demo", label: "QA demo" })})
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;

  for (const who of ["a", "b"] as const) {
    const name = `QA Firma ${who.toUpperCase()} ${RUN}`;
    const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QAO${who}${RUN}`}, ${name}) RETURNING id`;
    const [u] = await db.sql<{ id: string }[]>`
      INSERT INTO customer_users (customer_id, email, name, password_hash, status)
      VALUES (${c.id}, ${`qao-${RUN}-${who}@qa.invalid`}, ${`QA osoba ${who}`}, 'x', 'active') RETURNING id`;
    firm[who] = { customerId: c.id, accountId: u.id, name };
  }
  // Komercijalista vidi samo firmu A.
  await db.sql`INSERT INTO customer_assignments (user_id, customer_id) VALUES (${staff.rep.id}, ${firm.a.customerId})`;

  for (const [c, group] of [["BZ", "Bazni lakovi"], ["RZ", "Razređivači"], ["P800", "Abrazivi"], ["KIT", "Kitovi"], ["TRAKA", "Maskiranje"]] as const) {
    const [a] = await db.sql<{ id: string }[]>`
      INSERT INTO articles (code, name, product_group, brand, unit) VALUES (${code(c)}, ${`QA ${c}`}, ${group}, 'QA', 'kom') RETURNING id`;
    art[code(c)] = a.id;
  }
  await mapTo(code("BZ"), "baslac-basecoat-35", null);
  await mapTo(code("RZ"), "r-2e10-thinner-fast", null);
  await mapTo(code("P800"), "carsystem-f19-brusni-diskovi", "156.059");
  // Kit: samo PREDLOG. Traka: bez veze. Oba su ipak u cenovniku.
  await db.sql`INSERT INTO article_catalog_mappings (article_id, catalog_product_slug, status)
               VALUES (${art[code("KIT")]}, 'baslac-12-20-bodyfiller-universal', 'suggested')`;

  const [list] = await db.sql<{ id: string }[]>`
    INSERT INTO price_lists (code, name, kind, status, valid_from, source_note)
    VALUES (${`QA-${RUN}`}, 'QA demo cenovnik', 'demo', 'active', '2026-01-01', 'QA') RETURNING id`;
  listId = list.id;
  for (const [c, price] of [["BZ", 3480], ["RZ", 990], ["P800", 2890], ["KIT", 1950], ["TRAKA", 520]] as const) {
    await db.sql`INSERT INTO price_list_items (price_list_id, article_id, unit, pack_label, net_price, vat_percent)
                 VALUES (${listId}, ${art[code(c)]}, 'kom', ${`Pakovanje ${c}`}, ${price}, 20)`;
  }
  // Firma A: 3 % na sve, 10 % na bazne lakove, 5 % baš na razređivač (uži opseg pobeđuje).
  await db.sql`INSERT INTO price_list_customer_terms (price_list_id, customer_id, product_scope, discount_percent) VALUES (${listId}, ${firm.a.customerId}, 'all', 3)`;
  await db.sql`INSERT INTO price_list_customer_terms (price_list_id, customer_id, product_scope, product_group, discount_percent) VALUES (${listId}, ${firm.a.customerId}, 'product_group', 'Bazni lakovi', 10)`;
  await db.sql`INSERT INTO price_list_customer_terms (price_list_id, customer_id, product_scope, article_id, discount_percent) VALUES (${listId}, ${firm.a.customerId}, 'article', ${art[code("RZ")]}, 5)`;

  // Istorijska faktura sa DRUGAČIJOM cenom — ne sme se pojaviti u korpi.
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount, origin)
    VALUES ('QA-ORD', 'faktura', ${`F${RUN}`}, 2026, '2026-08-01', ${firm.a.customerId}, '1111.00', '1333.20', 'manual_upload') RETURNING id`;
  await db.sql`INSERT INTO invoice_lines (invoice_id, line_number, article_id, article_code, quantity, unit_price, line_amount)
               VALUES (${inv.id}, 1, ${art[code("BZ")]}, ${code("BZ")}, '1', '1111.0000', '1111.00')`;

  svc = await import("@/lib/ordering/ordering-service");
});

after(async () => {
  if (!reason && db) {
    const ids = [firm.a.customerId, firm.b.customerId].filter(Boolean);
    await db.sql`DELETE FROM customer_cart_items WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`UPDATE customer_orders SET replaces_order_id = NULL WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM customer_order_events WHERE order_id IN (SELECT id FROM customer_orders WHERE customer_id IN ${db.sql(ids)})`;
    await db.sql`DELETE FROM customer_order_lines WHERE order_id IN (SELECT id FROM customer_orders WHERE customer_id IN ${db.sql(ids)})`;
    await db.sql`DELETE FROM customer_orders WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM customer_cart_items WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM price_lists WHERE id = ${listId}`;
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = 'QA-ORD')`;
    await db.sql`DELETE FROM invoices WHERE company_id = 'QA-ORD'`;
    await db.sql`DELETE FROM article_catalog_mappings WHERE article_id IN ${db.sql(Object.values(art))}`;
    await db.sql`DELETE FROM articles WHERE id IN ${db.sql(Object.values(art))}`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM customer_users WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM customers WHERE id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM system_settings WHERE key = 'dataset.kind'`;
    await cleanupQa(db);
  }
  delete process.env.CUSTOMER_ORDERING;
  await closeTestDatabase();
});

async function clearCart(who: "a" | "b") {
  await db.sql`DELETE FROM customer_cart_items WHERE customer_id = ${firm[who].customerId}`;
}

test("cena iz cenovnika i rabata kupca (uži opseg pobeđuje), nikad iz fakture", async (t) => {
  if (guard(t)) return;
  await clearCart("a");
  assert.deepEqual(await svc.addToCart(session("a"), { articleCode: code("BZ"), quantity: "3" }), { ok: true, count: 1 });
  await svc.addToCart(session("a"), { articleCode: code("RZ"), quantity: "2" });
  await svc.addToCart(session("a"), { articleCode: code("P800"), quantity: "1" });
  const q = await svc.loadCartQuote(firm.a.customerId);
  const by = new Map(q.lines.map((l) => [l.articleCode, l]));
  assert.equal(by.get(code("BZ"))!.price!.netPrice, 3132, "3480 − 10 % (grupa)");
  assert.notEqual(by.get(code("BZ"))!.price!.netPrice, 1111, "fakturisana cena se ne koristi");
  assert.equal(by.get(code("RZ"))!.price!.netPrice, 940.5, "990 − 5 % (artikal, uži od grupe i od svih)");
  assert.equal(by.get(code("P800"))!.price!.netPrice, 2803.3, "2890 − 3 % (sve)");
  assert.equal(by.get(code("P800"))!.catalog!.variantLabel, "P800");
  // 3×3132 + 2×940,5 + 2803,3 = 14080,30; PDV 20 % po stavci.
  assert.deepEqual(q.totals, { net: 14080.3, vat: 2816.06, gross: 16896.36 });
  assert.equal(q.canSubmit, true);
  // Druga firma BEZ potvrđenog rabata: cena na upit, ne cenovnička cena kao „njena“.
  const naUpit = await svc.addToCart(session("b"), { articleCode: code("BZ"), quantity: "1" });
  assert.equal(naUpit.ok, false);
  assert.match((naUpit as { message: string }).message, /Cena na upit/);
  // Izričit rabat 0 % JE potvrđen uslov (0039): puna cenovnička cena.
  const [nula] = await db.sql<{ id: string }[]>`
    INSERT INTO price_list_customer_terms (price_list_id, customer_id, product_scope, discount_percent) VALUES (${listId}, ${firm.b.customerId}, 'all', 0) RETURNING id`;
  assert.deepEqual(await svc.addToCart(session("b"), { articleCode: code("BZ"), quantity: "1" }), { ok: true, count: 1 });
  const nulaQuote = await svc.loadCartQuote(firm.b.customerId);
  assert.equal(nulaQuote.lines[0].price!.netPrice, 3480);
  assert.equal(nulaQuote.lines[0].price!.discountPercent, 0);
  await clearCart("b");
  await db.sql`DELETE FROM price_list_customer_terms WHERE id = ${nula.id}`;
});

test("izolacija firmi: tuđa korpa i tuđi zahtev nisu dostupni", async (t) => {
  if (guard(t)) return;
  assert.equal((await svc.loadCartQuote(firm.b.customerId)).lines.length, 0, "B ne vidi A-inu korpu");
  const bzA = art[code("BZ")];
  // B pokušava da menja stavku koja postoji samo u A-inoj korpi.
  const r = await svc.setCartQuantity(session("b"), { articleId: bzA, quantity: "50" });
  assert.equal(r.ok, false);
  await svc.removeFromCart(session("b"), bzA);
  const a = await svc.loadCartQuote(firm.a.customerId);
  assert.equal(a.lines.find((l) => l.articleId === bzA)!.quantity, 3, "A-ina korpa nepromenjena");

  const sent = await svc.submitCartRequest(session("a"), { idempotencyKey: randomUUID(), fingerprint: a.fingerprint });
  assert.equal(sent.status, "created");
  const orderId = (sent as { orderId: string }).orderId;
  assert.equal(await svc.loadCustomerOrder(firm.b.customerId, orderId), null, "tuđ zahtev = kao nepostojeći");
  assert.deepEqual(await svc.listCustomerOrders(firm.b.customerId), []);
  assert.equal((await svc.cancelCustomerOrder(session("b"), orderId)).ok, false, "B ne može otkazati A-in zahtev");
  assert.equal((await svc.loadCustomerOrder(firm.a.customerId, orderId))!.status, "submitted");
  assert.equal((await svc.loadCartQuote(firm.a.customerId)).lines.length, 0, "slanje prazni korpu");
});

test("predlog veze i artikal bez veze nisu poručivi, iako imaju cenu", async (t) => {
  if (guard(t)) return;
  for (const c of ["KIT", "TRAKA"]) {
    const r = await svc.addToCart(session("a"), { articleCode: code(c), quantity: "1" });
    assert.equal(r.ok, false, c);
    assert.match((r as { message: string }).message, /nije potvrđeno povezan/);
  }
  assert.equal((await svc.addToCart(session("a"), { articleCode: "NE-POSTOJI", quantity: "1" })).ok, false);
});

test("nevažeća količina se odbija na serveru", async (t) => {
  if (guard(t)) return;
  for (const q of ["0", "-2", "1.5", "abc", "100000"]) {
    const r = await svc.addToCart(session("a"), { articleCode: code("BZ"), quantity: q });
    assert.equal(r.ok, false, `količina ${q}`);
  }
});

test("nevažeća varijanta: stavka se ne šalje, ništa se ne izbacuje tiho", async (t) => {
  if (guard(t)) return;
  await clearCart("a");
  await svc.addToCart(session("a"), { articleCode: code("P800"), quantity: "2" });
  await svc.addToCart(session("a"), { articleCode: code("BZ"), quantity: "1" });
  // Katalog se promenio: varijanta iz veze više ne postoji.
  await db.sql`UPDATE article_catalog_mappings SET catalog_variant_id = 'P999-NEMA' WHERE article_id = ${art[code("P800")]} AND status = 'mapped'`;
  const q = await svc.loadCartQuote(firm.a.customerId);
  const p800 = q.lines.find((l) => l.articleCode === code("P800"))!;
  assert.equal(p800.problem?.code, "invalid_variant");
  assert.equal(p800.price, null, "nevažeća stavka nema cenu u ponudi");
  assert.equal(q.canSubmit, false);
  const r = await svc.submitCartRequest(session("a"), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint });
  assert.equal(r.status, "blocked");
  assert.ok((r as { blockers: string[] }).blockers.some((b) => /Varijanta/.test(b)));
  assert.equal((await svc.addToCart(session("a"), { articleCode: code("P800"), quantity: "1" })).ok, false, "ne dodaje se ni nova");
  await db.sql`UPDATE article_catalog_mappings SET catalog_variant_id = '156.059' WHERE article_id = ${art[code("P800")]} AND status = 'mapped'`;
  assert.equal((await svc.loadCartQuote(firm.a.customerId)).canSubmit, true);
});

test("promena cene pre slanja: zahtev se ne šalje, kupac vidi novu cenu i šalje ponovo", async (t) => {
  if (guard(t)) return;
  const seen = await svc.loadCartQuote(firm.a.customerId);
  await db.sql`UPDATE price_list_items SET net_price = 3600 WHERE price_list_id = ${listId} AND article_id = ${art[code("BZ")]}`;
  const before = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customer_orders WHERE customer_id = ${firm.a.customerId}`;
  const r = await svc.submitCartRequest(session("a"), { idempotencyKey: randomUUID(), fingerprint: seen.fingerprint });
  assert.equal(r.status, "price_changed");
  const afterRows = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customer_orders WHERE customer_id = ${firm.a.customerId}`;
  assert.equal(afterRows[0].n, before[0].n, "nijedan zahtev nije nastao");
  const fresh = await svc.loadCartQuote(firm.a.customerId);
  assert.equal(fresh.lines.length, 2, "korpa netaknuta");
  assert.equal(fresh.lines.find((l) => l.articleCode === code("BZ"))!.price!.netPrice, 3240, "3600 − 10 %");
  const ok = await svc.submitCartRequest(session("a"), { idempotencyKey: randomUUID(), fingerprint: fresh.fingerprint });
  assert.equal(ok.status, "created");
  const order = (await svc.loadCustomerOrder(firm.a.customerId, (ok as { orderId: string }).orderId))!;
  assert.equal(order.lines.find((l) => l.articleCode === code("BZ"))!.netPrice, 3240, "u zahtev ulazi potvrđena nova cena");
  await db.sql`UPDATE price_list_items SET net_price = 3480 WHERE price_list_id = ${listId} AND article_id = ${art[code("BZ")]}`;
});

test("ponovljeno i istovremeno slanje sa istim ključem daje JEDAN zahtev", async (t) => {
  if (guard(t)) return;
  await svc.addToCart(session("a"), { articleCode: code("RZ"), quantity: "4" });
  const q = await svc.loadCartQuote(firm.a.customerId);
  const key = randomUUID();
  const results = await Promise.all([1, 2, 3].map(() => svc.submitCartRequest(session("a"), { idempotencyKey: key, fingerprint: q.fingerprint })));
  const ids = new Set(results.map((r) => (r as { orderId: string }).orderId));
  assert.equal(ids.size, 1, `jedan zahtev, ne ${ids.size}`);
  assert.deepEqual(results.map((r) => r.status).sort(), ["created", "existing", "existing"]);
  const again = await svc.submitCartRequest(session("a"), { idempotencyKey: key, fingerprint: q.fingerprint });
  assert.equal(again.status, "existing");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customer_orders WHERE idempotency_key = ${key}`;
  assert.equal(n, 1);
  // Isti ključ od druge firme ne otkriva ni ne vraća A-in zahtev.
  const foreign = await svc.submitCartRequest(session("b"), { idempotencyKey: key, fingerprint: q.fingerprint });
  assert.notEqual(foreign.status, "existing");
});

test("kancelarija: prijem, provera, potvrda sa brojem porudžbine, BizniSoft broj; opseg komercijaliste", async (t) => {
  if (guard(t)) return;
  const office = await portalUser("office");
  const rep = await portalUser("rep");
  // B šalje jedan zahtev da komercijalista (samo A) ima šta da NE vidi.
  await svc.addToCart(session("b"), { articleCode: code("BZ"), quantity: "1" });
  const qb = await svc.loadCartQuote(firm.b.customerId);
  const b = await svc.submitCartRequest(session("b"), { idempotencyKey: randomUUID(), fingerprint: qb.fingerprint });
  const bId = (b as { orderId: string }).orderId;

  const repRows = await svc.listOrderRequests(rep);
  assert.ok(repRows.length > 0 && repRows.every((r) => r.customerId === firm.a.customerId), "komercijalista vidi samo dodeljenu firmu");
  assert.equal(await svc.loadOrderRequest(rep, bId), null);

  const target = (await svc.listCustomerOrders(firm.a.customerId)).find((o) => o.status === "submitted")!;
  assert.match(
    (await svc.officeTransition(office, target.id, "confirmed", null) as { message: string }).message,
    /nije dozvoljen/,
    "potvrda tek posle prijema u obradu",
  );
  assert.deepEqual(await svc.officeTransition(office, target.id, "under_review", null), { ok: true, changed: true });
  assert.deepEqual(await svc.officeTransition(office, target.id, "under_review", null), { ok: true, changed: false }, "dvostruki klik = no-op");
  assert.equal((await svc.cancelCustomerOrder(session("a"), target.id)).ok, false, "kupac ne otkazuje zahtev u obradi");
  assert.equal((await svc.officeTransition(office, target.id, "rejected", "")).ok, false, "odbijanje traži razlog");
  assert.equal((await svc.recordBiznisoftEntry(office, target.id, "BS-1")).ok, false, "BizniSoft broj tek posle potvrde");

  assert.deepEqual(await svc.officeTransition(office, target.id, "confirmed", null), { ok: true, changed: true });
  const confirmed = (await svc.loadCustomerOrder(firm.a.customerId, target.id))!;
  assert.equal(confirmed.status, "confirmed");
  assert.match(confirmed.orderNumber!, /^P-\d{4}-\d{5}$/);
  assert.match(confirmed.requestNumber, /^Z-\d{4}-\d{5}$/);
  assert.deepEqual(await svc.officeTransition(office, target.id, "confirmed", null), { ok: true, changed: false });

  assert.deepEqual(await svc.recordBiznisoftEntry(office, target.id, "BS-2026-001"), { ok: true, changed: true });
  assert.equal((await svc.recordBiznisoftEntry(office, target.id, "BS-DRUGI")).ok, false, "drugi broj se ne prepisuje");
  const events = (await svc.loadCustomerOrder(firm.a.customerId, target.id))!.events.map((e) => e.toStatus ?? e.kind);
  assert.deepEqual(events, ["submitted", "under_review", "confirmed", "biznisoft_recorded"]);

  // Komercijalista nema sposobnost prijema, ali ni servis mu ne daje tuđu firmu.
  assert.equal((await svc.officeTransition(rep, bId, "under_review", null)).ok, false);
});

test("izmena: kancelarija traži izmenu, kupac vraća stavke u korpu i šalje nov zahtev", async (t) => {
  if (guard(t)) return;
  const office = await portalUser("office");
  await svc.addToCart(session("a"), { articleCode: code("BZ"), quantity: "2" });
  const q = await svc.loadCartQuote(firm.a.customerId);
  const r = (await svc.submitCartRequest(session("a"), { idempotencyKey: randomUUID(), fingerprint: q.fingerprint })) as { orderId: string };
  await svc.officeTransition(office, r.orderId, "under_review", null);
  assert.deepEqual(await svc.officeTransition(office, r.orderId, "changes_requested", "Pakovanje 1 l nije na stanju, uzmite 2×"), { ok: true, changed: true });
  assert.equal((await svc.returnOrderToCart(session("b"), r.orderId)).ok, false, "tuđa firma ne može");
  assert.deepEqual(await svc.returnOrderToCart(session("a"), r.orderId), { ok: true, changed: true });
  // Ponovljen klik ne dodaje stavke dvaput.
  assert.deepEqual(await svc.returnOrderToCart(session("a"), r.orderId), { ok: true, changed: false });
  const order = (await svc.loadCustomerOrder(firm.a.customerId, r.orderId))!;
  assert.equal(order.status, "superseded", "stari zahtev ostaje u istoriji kao „vraćen na ispravku”");
  const q2 = await svc.loadCartQuote(firm.a.customerId);
  assert.equal(q2.lines.length, 1);
  assert.equal(q2.lines[0].quantity, 2);
  assert.equal(q2.correcting?.orderId, r.orderId, "korpa zna koji zahtev ispravlja");

  // Ispravka: nova količina, novo slanje → nov zahtev povezan sa prethodnim.
  await svc.setCartQuantity(session("a"), { articleId: q2.lines[0].articleId, quantity: "4" });
  const q3 = await svc.loadCartQuote(firm.a.customerId);
  const key = randomUUID();
  const fixed = (await svc.submitCartRequest(session("a"), { idempotencyKey: key, fingerprint: q3.fingerprint })) as { orderId: string; requestNumber: string };
  const again = await svc.submitCartRequest(session("a"), { idempotencyKey: key, fingerprint: q3.fingerprint });
  assert.equal((again as { orderId: string }).orderId, fixed.orderId, "dvostruki klik na ispravku = jedan zahtev");
  const newOrder = (await svc.loadCustomerOrder(firm.a.customerId, fixed.orderId))!;
  assert.equal(newOrder.replaces?.id, r.orderId);
  assert.equal(newOrder.lines[0].quantity, 4);
  const old = (await svc.loadCustomerOrder(firm.a.customerId, r.orderId))!;
  assert.equal(old.replacedBy?.id, fixed.orderId);
  assert.deepEqual(
    old.events.map((e) => e.toStatus ?? e.kind),
    ["submitted", "under_review", "changes_requested", "superseded", "replaced"],
    "istorija starog zahteva je sačuvana",
  );
  assert.equal(old.lines[0].quantity, 2, "stavke starog zahteva se ne menjaju");
  // Stari zahtev se ne može „oživeti” ni vratiti u korpu ponovo.
  assert.equal((await svc.cancelCustomerOrder(session("a"), r.orderId)).ok, false);
  await clearCart("a");
});

test("broj porudžbine postoji samo za potvrđen zahtev (ograničenje u bazi)", async (t) => {
  if (guard(t)) return;
  const [o] = await db.sql<{ id: string }[]>`SELECT id FROM customer_orders WHERE status = 'submitted' LIMIT 1`;
  await assert.rejects(() => db.sql`UPDATE customer_orders SET order_number = 'P-HACK' WHERE id = ${o.id}`);
});

test("isključeno poručivanje i stvarni (nepotvrđen) cenovnik ne dozvoljavaju slanje", async (t) => {
  if (guard(t)) return;
  delete process.env.CUSTOMER_ORDERING;
  const off = await svc.addToCart(session("a"), { articleCode: code("BZ"), quantity: "1" });
  assert.equal(off.ok, false);
  assert.match((off as { message: string }).message, /nije uključeno/);
  process.env.CUSTOMER_ORDERING = "demo";
  await db.sql`UPDATE price_lists SET kind = 'biznisoft' WHERE id = ${listId}`;
  const real = await svc.addToCart(session("a"), { articleCode: code("BZ"), quantity: "1" });
  assert.match((real as { message: string }).message, /nije odobren/);
  await db.sql`UPDATE price_lists SET kind = 'demo' WHERE id = ${listId}`;
});

test("interni nazivi: BizniSoft ↔ katalog, varijanta na stavci, pretraga po šifri i nazivu", async (t) => {
  if (guard(t)) return;
  const ids = await svc.loadArticleIdentities([code("BZ"), code("KIT"), code("TRAKA"), code("P800")]);
  assert.equal(ids.get(code("BZ"))!.bizName, "QA BZ");
  assert.equal(ids.get(code("BZ"))!.catalog!.name, "baslac Basecoat 35");
  assert.equal(ids.get(code("P800"))!.catalog!.variantLabel, "P800");
  assert.equal(ids.get(code("KIT"))!.mappingStatus, "suggested");
  assert.equal(ids.get(code("KIT"))!.catalog, null, "predlog nije katalog");
  assert.equal(ids.get(code("TRAKA"))!.catalog, null);

  const office = await portalUser("office");
  const byName = await svc.listOrderRequests(office, null, "QA P800");
  assert.ok(byName.length > 0 && byName.every((o) => o.customerId === firm.a.customerId || o.customerId === firm.b.customerId));
  const withP800 = await svc.loadOrderRequest(office, byName[0].id);
  const line = withP800!.lines.find((l) => l.articleCode === code("P800"))!;
  assert.equal(line.variantLabel, "P800", "stavka nosi čitljivu varijantu");
  assert.ok((await svc.listOrderRequests(office, null, code("RZ"))).length > 0, "pretraga po BizniSoft šifri");
  assert.deepEqual(await svc.listOrderRequests(office, null, `nema-${RUN}`), []);
  // Komercijalista i u pretrazi ostaje u svom opsegu.
  const rep = await portalUser("rep");
  assert.ok((await svc.listOrderRequests(rep, null, "QA")).every((o) => o.customerId === firm.a.customerId));
});
