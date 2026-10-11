import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Zahtev za porudžbinu radi i sa JEDNOM vezom u pool-u (revizija 2026-10-11).
 *
 * Regresija: slanje, izmenjen predlog i obračun u njima otvarali su transakciju
 * (`FOR UPDATE`), a cene, opcije plaćanja i proveru probe čitali preko zasebne
 * veze iz pool-a. Sa `DATABASE_POOL_MAX=1` (Preview, lokalni `.env.local`)
 * server je čekao sam sebe — prijava i svaki sledeći zahtev su stajali; sa više
 * veza isto se dešava kada istovremena slanja zauzmu ceo pool. Svaki korak ovde
 * mora da se završi u roku, inače je neki upit u transakciji opet otišao mimo nje.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const code = (c: string) => `Q1-${RUN}-${c}`;
let db: TestDatabase;
let single: ReturnType<typeof postgres> | null = null;
let saved: unknown;
const ids: Record<string, string> = {};
const art: Record<string, string> = {};
let customerId: string;
let accountId: string;
const session = () => ({
  accountId, customerId, customerName: `QA JEDNA VEZA ${RUN}`, email: `q1-${RUN}@qa.invalid`, name: "QA osoba", status: "active" as const, assurance: "password" as const,
});

async function inTime<T>(label: string, p: Promise<T>, ms = 15000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: nije završeno za ${ms} ms — upit u transakciji traži drugu vezu`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "office", role: "kancelarija" }, { key: "rep", role: "komercijalista" }]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`Q1${RUN}`}, ${`QA JEDNA VEZA ${RUN}`}) RETURNING id`;
  customerId = c.id;
  const [u] = await db.sql<{ id: string }[]>`INSERT INTO customer_users (customer_id, email, name, password_hash, status) VALUES (${customerId}, ${`q1-${RUN}@qa.invalid`}, 'QA osoba', 'x', 'active') RETURNING id`;
  accountId = u.id;
  for (const [k, unit, price] of [["L1", "LIT", "1000.00"], ["K1", "KOM", "500.00"]] as const) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit, brand) VALUES (${code(k)}, ${`QA ${k}`}, ${unit}, 'QAJV') RETURNING id`;
    art[k] = a.id;
    await db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by) VALUES (${a.id}, ${price}, '20', '2026-01-01', 'rucno', 'QA osnovna cena', ${ids.owner})`;
  }
  const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const s = { customerScope: "customer", customerId, productScope: "brand", brand: "QAJV", paymentCondition: null };
  await db.sql`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, brand, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required)
    VALUES ('customer', ${customerId}, 'brand', 'QAJV', ${precedenceLevelFor(s)}, ${scopeKeyFor(s)}, 'discount_percent', 30,
            '2026-01-01', 'approved_pending_biznisoft', 'QA', ${ids.owner}, now(), ${ids.owner}, now(), false)`;
  await db.sql`INSERT INTO customer_payment_options (customer_id, option_code, status, effective_from, reason, proposed_by, decided_by, decided_at)
               VALUES (${customerId}, 'odlozeno_30', 'odobreno', '2026-01-01', 'QA odobreno', ${ids.owner}, ${ids.owner}, now())`;
  // Proba za ovog kupca preko system_settings — isti put kao na Production-u (bez CUSTOMER_ORDERING).
  await db.sql`INSERT INTO system_settings (key, value) VALUES ('ordering.trial', ${db.sql.json({ customerIds: [customerId] })})
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;

  // Pool od JEDNE veze umesto harness-ovog (4) — kao Preview.
  const globalForDb = globalThis as unknown as { carsystemDb?: unknown };
  saved = globalForDb.carsystemDb;
  single = postgres(process.env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });
  globalForDb.carsystemDb = drizzle(single, { schema });
});

after(async () => {
  const globalForDb = globalThis as unknown as { carsystemDb?: unknown };
  if (saved !== undefined) globalForDb.carsystemDb = saved;
  if (single) await single.end({ timeout: 5 });
  if (!reason && db) {
    await db.sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId}`;
    await db.sql`UPDATE customer_orders SET replaces_order_id = NULL WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customer_order_events WHERE order_id IN (SELECT id FROM customer_orders WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_order_lines WHERE order_id IN (SELECT id FROM customer_orders WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM notifications WHERE kind = 'customer_order_submitted' AND entity_id IN (SELECT id::text FROM customer_orders WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_orders WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM price_rules WHERE customer_id = ${customerId}`;
    await db.sql`TRUNCATE customer_payment_options, article_base_prices`;
    await db.sql`DELETE FROM system_settings WHERE key = 'ordering.trial'`;
    await db.sql`DELETE FROM customer_message_outbox WHERE customer_user_id IN (SELECT id FROM customer_users WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_account_tokens WHERE customer_user_id IN (SELECT id FROM customer_users WHERE customer_id = ${customerId})`;
    await db.sql`DELETE FROM customer_users WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customers WHERE id = ${customerId}`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`Q1-${RUN}-%`}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("jedna veza: probni nalog (poziv) i aktivacija završavaju se (B11)", async (t) => {
  if (guard(t)) return;
  const { createTrialAccount } = await import("@/lib/ordering/trial-service");
  const { activateWithInvitation } = await import("@/lib/customers/invitation-service");
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const owner = (await loadPortalUser(ids.owner))!;
  const email = `q1-proba-${RUN}@qa.invalid`;
  const issued = await inTime("probni nalog", createTrialAccount(owner, { customerId, email, name: "QA proba" }));
  const token = new URL(issued.link, "http://x").searchParams.get("token")!;
  const activated = await inTime("aktivacija", activateWithInvitation({ token, password: `qa-jedna-veza-${RUN}-lozinka` }));
  assert.equal(activated.ok, true, "aktivacija uspela");
  const [row] = await db.sql<{ status: string }[]>`SELECT status::text AS status FROM customer_users WHERE email = ${email}`;
  assert.equal(row.status, "active");
});

test("jedna veza: korpa, promenjena cena, slanje, izmenjen predlog i potvrda kupca završavaju se", async (t) => {
  if (guard(t)) return;
  const s = await import("@/lib/ordering/request-service");
  const { loadPortalUser } = await import("@/lib/authz/user-repository");

  assert.equal((await inTime("dodavanje L1", s.addRequestItem(session(), { articleId: art.L1, quantity: "4" }))).ok, true);
  assert.equal((await inTime("dodavanje K1", s.addRequestItem(session(), { articleId: art.K1, quantity: "2" }))).ok, true);
  const q = await inTime("obračun korpe", s.loadRequestQuote(customerId, "odlozeno_30"));
  assert.equal(q.totals.net, 4 * 700 + 2 * 350);

  // Stari otisak → nova potvrda; transakcija se mora završiti (ne „idle in transaction“).
  const changed = await inTime("slanje sa starim otiskom", s.submitOrderRequest(session(), { idempotencyKey: randomUUID(), fingerprint: "zastareo", paymentOption: "odlozeno_30" }));
  assert.equal(changed.status, "price_changed");

  const sendKey = randomUUID();
  const sent = await inTime("slanje", s.submitOrderRequest(session(), { idempotencyKey: sendKey, fingerprint: q.fingerprint, paymentOption: "odlozeno_30" }));
  assert.equal(sent.status, "created");
  const orderId = (sent as { orderId: string }).orderId;

  const office = (await loadPortalUser(ids.office))!;
  await inTime("izmenjen predlog", s.proposeOrderRevision(office, orderId, { lines: [{ articleId: art.L1, quantity: 4 }], reason: "QA bez K1" }));
  const [rev] = await db.sql<{ id: string }[]>`SELECT id FROM customer_orders WHERE replaces_order_id = ${orderId} AND status = 'awaiting_customer'`;
  assert.ok(rev, "predlog čeka kupca");
  const answered = await inTime("potvrda kupca", s.answerOrderRevision(session(), rev.id, true));
  assert.equal(answered.ok, true);

  // B3: kancelarija dobija obaveštenje za nov zahtev i za potvrđen predlog; komercijalista ne.
  const { listNotificationsFor } = await import("@/lib/notifications/notification-service");
  const forOffice = (await listNotificationsFor(office)).filter((n) => n.kind === "customer_order_submitted" && [orderId, rev.id].includes(n.entityId ?? ""));
  assert.equal(forOffice.length, 2, "dva obaveštenja: nov zahtev i potvrđen predlog");
  assert.ok(forOffice.every((n) => n.actionHref === `/portal/zahtevi/${n.entityId}`));
  assert.ok(forOffice.every((n) => !/@|060|\+381/.test(`${n.title} ${n.body}`)), "bez kontakta kupca");
  const rep = (await loadPortalUser(ids.rep))!;
  assert.equal((await listNotificationsFor(rep)).filter((n) => n.kind === "customer_order_submitted").length, 0);
  // Ponovljeno slanje istim ključem ne pravi drugo obaveštenje.
  assert.equal((await s.submitOrderRequest(session(), { idempotencyKey: sendKey, fingerprint: q.fingerprint, paymentOption: "odlozeno_30" })).status, "existing");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM notifications WHERE entity_id = ${orderId}`;
  assert.equal(n, 1);
});
