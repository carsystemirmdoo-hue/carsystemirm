import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * „Za Vas“ (kartice i lični redosled):
 *  - demo istorija i demo cene samo za izdvojenog TEST kupca (ordering.trial); stvarna firma sa
 *    istim podešavanjem ne dobija ništa;
 *  - samo potvrđene veze, bez artikala van programa i bez opreme;
 *  - demo cena se ne prenosi u korpu (korpa računa iz cenovnika).
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const code = (c: string) => `QY-${RUN}-${c}`;
let db: TestDatabase;
const ids: Record<string, string> = {};
const art: Record<string, string> = {};
let trialId: string;
let realId: string;
let accountId: string;

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  ids.owner = acc.owner.id;
  const [t] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QYT${RUN}`}, ${`QA TEST ${RUN}`}) RETURNING id`;
  const [r] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QYR${RUN}`}, ${`QA STVARNA ${RUN}`}) RETURNING id`;
  trialId = t.id;
  realId = r.id;
  const [u] = await db.sql<{ id: string }[]>`INSERT INTO customer_users (customer_id, email, name, password_hash, status) VALUES (${trialId}, ${`qy-${RUN}@qa.invalid`}, 'QA', 'x', 'active') RETURNING id`;
  accountId = u.id;
  const items = [
    ["F1", "QA FILLER", "KOM", "carsystem-2k-filler-air-plus", "152.580", "1000.00"],
    ["T1", "QA TRAKA", "KOM", "carsystem-mount-tape", "125.712", "500.00"],
    ["V1", "QA VAN PROGRAMA", "KOM", "carsystem-glas", "127.974", "300.00"],
    ["E1", "QA OPREMA", "KOM", "carsystem-multi", "127.977", "900.00"],
  ] as const;
  for (const [k, name, unit, slug, variant, price] of items) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit, brand) VALUES (${code(k)}, ${name}, ${unit}, 'CS') RETURNING id`;
    art[k] = a.id;
    await db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by) VALUES (${a.id}, ${price}, '20', '2026-01-01', 'rucno', 'QA osnovna', ${ids.owner})`;
    await db.sql`INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by) VALUES (${a.id}, '1', 'KOM', '1 kom', 'QA', ${ids.owner})`;
    await db.sql`INSERT INTO article_catalog_mappings (article_id, catalog_product_slug, catalog_variant_id, status, note, proposed_by, proposed_at, confirmed_by, confirmed_at)
                 VALUES (${a.id}, ${slug}, ${variant}, 'mapped', 'QA', ${ids.owner}, now(), ${ids.owner}, now())`;
  }
  await db.sql`INSERT INTO article_programme_decisions (article_id, in_programme, reason, decided_by) VALUES (${art.V1}, false, 'QA van programa', ${ids.owner})`;
  await db.sql`INSERT INTO internal_equipment (code, code_key, name, unit, evidence, decided_by) VALUES (${code("E1")}, ${code("E1")}, 'QA OPREMA', 'KOM', 'QA oprema', ${ids.owner})`;
  await db.sql`INSERT INTO system_settings (key, value) VALUES ('ordering.trial', ${db.sql.json({ customerIds: [trialId] })})
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  const events = (c: string, gaps: number[]) => gaps.map((d) => ({ code: code(c), daysAgo: d, doc: `D${d}`, qty: 2 }));
  const profile = {
    label: "QA demo",
    events: [...events("F1", [100, 70, 40, 10]), ...events("T1", [90, 60, 31]), ...events("V1", [50, 20]), ...events("E1", [45, 15])],
    prices: { [code("F1")]: 850, [code("T1")]: 425, [code("V1")]: 1, [code("E1")]: 1 },
  };
  await db.sql`INSERT INTO system_settings (key, value) VALUES ('customer.demo', ${db.sql.json({ profiles: { [trialId]: profile, [realId]: profile } })})
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM customer_cart_items WHERE customer_id IN (${trialId}, ${realId})`;
    await db.sql`DELETE FROM system_settings WHERE key IN ('customer.demo', 'ordering.trial')`;
    await db.sql`ALTER TABLE internal_equipment DISABLE TRIGGER USER`;
    await db.sql`DELETE FROM internal_equipment WHERE code = ${code("E1")}`;
    await db.sql`ALTER TABLE internal_equipment ENABLE TRIGGER USER`;
    await db.sql`TRUNCATE article_base_prices, article_pack_sizes, article_programme_decisions`;
    await db.sql`DELETE FROM article_catalog_mappings WHERE article_id IN (SELECT id FROM articles WHERE code LIKE ${`QY-${RUN}-%`})`;
    await db.sql`DELETE FROM customer_users WHERE customer_id IN (${trialId}, ${realId})`;
    await db.sql`DELETE FROM customers WHERE id IN (${trialId}, ${realId})`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QY-${RUN}-%`}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const svc = async () => import("@/lib/customers/for-you");

test("test kupac: demo kartice i lični redosled; bez van programa i opreme; demo cena označena", async (t) => {
  if (guard(t)) return;
  const f = await (await svc()).loadForYou(trialId);
  assert.equal(f.demo, true);
  assert.equal(f.enoughHistory, true);
  const shown = [...f.refill, ...f.frequent];
  assert.deepEqual(new Set(shown.map((c) => c.articleId)), new Set([art.F1, art.T1]), "van programa i oprema nisu prikazani");
  assert.equal(new Set(shown.map((c) => c.articleId)).size, shown.length, "isti artikal samo jednom");
  const filler = shown.find((c) => c.articleId === art.F1)!;
  assert.equal(filler.price?.kind, "demo");
  assert.equal(filler.price?.unitNet, 850);
  assert.deepEqual(f.ranking.purchased.slice(0, 2).sort(), ["carsystem-2k-filler-air-plus", "carsystem-mount-tape"]);
  assert.ok(!f.ranking.purchased.includes("carsystem-glas") && !f.ranking.purchased.includes("carsystem-multi"));
  assert.ok(f.refill.some((c) => /Obično kupujete na oko 30 dana/.test(c.reason ?? "")), JSON.stringify(f.refill.map((c) => c.reason)));
});

test("stvarna firma sa istim podešavanjem ne dobija demo podatke", async (t) => {
  if (guard(t)) return;
  const f = await (await svc()).loadForYou(realId);
  assert.equal(f.demo, false);
  assert.deepEqual([f.frequent.length, f.refill.length, f.ranking.purchased.length], [0, 0, 0]);
});

test("demo cena se ne prenosi u korpu: korpa računa iz cenovnika", async (t) => {
  if (guard(t)) return;
  const s = await import("@/lib/ordering/request-service");
  const session = { accountId, customerId: trialId, customerName: "QA", email: "qa@qa.invalid", name: "QA", status: "active" as const, assurance: "password" as const };
  assert.equal((await s.addRequestItem(session, { articleId: art.F1, packs: "1" })).ok, true);
  const q = await s.loadRequestQuote(trialId, null);
  const line = q.lines.find((l) => l.articleId === art.F1)!;
  assert.notEqual(line.selected?.status === "cena" ? line.selected.netPrice : null, 850, "demo cena nije cena zahteva");
});
