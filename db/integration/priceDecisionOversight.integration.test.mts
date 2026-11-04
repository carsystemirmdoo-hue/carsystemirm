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
 * Odobravanje cena i rabata kod komercijaliste (odluka vlasnika 2026-11-04).
 *
 * Komercijalista sa paketom odobravanja odlučuje o pravilima SVOJIH kupaca,
 * nikad tuđih, a vlasnik dobija obaveštenje o svakoj takvoj odluci. To
 * obaveštenje ne vidi niko drugi ko odobrava.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);

let db: TestDatabase;
let fx: {
  mineId: string;
  theirsId: string;
  articleIds: string[];
  rep: ReturnType<typeof asPortalUser>;
  otherRep: ReturnType<typeof asPortalUser>;
  owner: ReturnType<typeof asPortalUser>;
};

function asPortalUser(account: { id: string; name: string; role: string }, permissions: string[]) {
  return {
    id: account.id,
    email: `${account.id}@qa-nadzor.invalid`,
    name: account.name,
    initials: "QA",
    role: account.role as "gazda" | "komercijalista" | "kancelarija" | "magacioner",
    active: true,
    sessionVersion: 0,
    permissions,
  };
}

const APPROVER = ["cene_predlog", "cene_odobravanje"];

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const run = randomUUID().slice(0, 8);
  const [mine] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QN${run}m`}, 'QA Nadzor Moj') RETURNING id`;
  const [theirs] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QN${run}t`}, 'QA Nadzor Tudji') RETURNING id`;
  const articleIds: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const [article] = await db.sql<{ id: string }[]>`
      INSERT INTO articles (code, name, product_group, brand)
      VALUES (${`QAN-${run}-${i}`}, 'QA artikal nadzora', 'BAZE', 'R-M') RETURNING id`;
    articleIds.push(article.id);
  }
  const accounts = await seedAccounts(db, [
    { key: "nrep", role: "komercijalista" },
    { key: "nrep2", role: "komercijalista" },
    { key: "nowner", role: "gazda" },
  ]);
  await db.sql`INSERT INTO customer_assignments (user_id, customer_id) VALUES (${accounts.nrep.id}, ${mine.id})`;
  await db.sql`INSERT INTO customer_assignments (user_id, customer_id) VALUES (${accounts.nrep2.id}, ${theirs.id})`;
  fx = {
    mineId: mine.id,
    theirsId: theirs.id,
    articleIds,
    rep: asPortalUser(accounts.nrep, APPROVER),
    otherRep: asPortalUser(accounts.nrep2, APPROVER),
    owner: asPortalUser(accounts.nowner, []),
  };
});

after(async () => {
  if (!reason && db && fx) {
    const ids = [fx.mineId, fx.theirsId];
    await db.sql`DELETE FROM notifications WHERE required_capability = 'prices:oversee' OR entity_type IN ('Pravilo cene', 'Serija pravila cene')`;
    await db.sql`DELETE FROM price_rules WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM articles WHERE id IN ${db.sql(fx.articleIds)}`;
    await db.sql`DELETE FROM customers WHERE id IN ${db.sql(ids)}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

async function propose(actor: ReturnType<typeof asPortalUser>, customerId: string, articleId: string, percent: number, batch?: string) {
  const { proposePriceRule } = await import("@/lib/pricing/rule-service");
  return proposePriceRule(
    {
      customerScope: "customer",
      customerId,
      productScope: "article",
      articleId,
      valueKind: "discount_percent",
      discountPercent: percent,
      effectiveFrom: "2026-11-05",
      reason: "QA nadzor odluke",
      biznisoftEntryRequired: false,
      sourceBatch: batch,
    },
    actor,
    { notify: false },
  );
}

const ownerNotices = () =>
  db.sql<{ title: string; body: string; entity_id: string }[]>`
    SELECT title, body, entity_id FROM notifications WHERE required_capability = 'prices:oversee' ORDER BY id`;

test("komercijalista odobrava rabat svom kupcu, a vlasnik dobija obaveštenje koje samo on vidi", async (t) => {
  if (guard(t)) return;
  const { transitionPriceRule } = await import("@/lib/pricing/rule-service");
  const { listNotificationsFor } = await import("@/lib/notifications/notification-service");
  const rule = await propose(fx.rep, fx.mineId, fx.articleIds[0], 12.5);
  await transitionPriceRule({ ruleId: rule.id, to: "approved_pending_biznisoft", reason: null }, fx.rep);

  const [row] = await db.sql<{ status: string }[]>`SELECT status::text FROM price_rules WHERE id = ${rule.id}`;
  assert.equal(row.status, "approved_pending_biznisoft");

  const notices = (await ownerNotices()).filter((n) => n.entity_id === rule.id);
  assert.equal(notices.length, 1, "vlasnik dobija tačno jedno obaveštenje");
  assert.match(notices[0].title, /QA Nadzor Moj/);
  assert.match(notices[0].body, /12,5 %/);

  const ownerList = await listNotificationsFor(fx.owner);
  assert.ok(ownerList.some((n) => n.entityId === rule.id), "vlasnik vidi obaveštenje");
  for (const viewer of [fx.rep, fx.otherRep]) {
    const list = await listNotificationsFor(viewer);
    assert.ok(!list.some((n) => n.requiredCapability === "prices:oversee"), "komercijalista ne vidi obaveštenja vlasnika");
  }
});

test("komercijalista ne može da odobri pravilo tuđeg kupca", async (t) => {
  if (guard(t)) return;
  const { transitionPriceRule } = await import("@/lib/pricing/rule-service");
  const rule = await propose(fx.owner, fx.theirsId, fx.articleIds[1], 20);
  await assert.rejects(
    transitionPriceRule({ ruleId: rule.id, to: "approved_pending_biznisoft", reason: null }, fx.rep),
    /nije u Vašem opsegu/,
  );
  const [row] = await db.sql<{ status: string }[]>`SELECT status::text FROM price_rules WHERE id = ${rule.id}`;
  assert.equal(row.status, "pending_approval", "pravilo ostaje na čekanju");
});

test("paketi: komercijalista vidi i odlučuje samo pakete svojih kupaca", async (t) => {
  if (guard(t)) return;
  const { pendingBatches, decidePendingBatch } = await import("@/lib/pricing/rebate-coverage-service");
  const mineBatch = `qa-nadzor-moj-${randomUUID().slice(0, 8)}`;
  const theirsBatch = `qa-nadzor-tudji-${randomUUID().slice(0, 8)}`;
  await propose(fx.rep, fx.mineId, fx.articleIds[2], 10, mineBatch);
  await propose(fx.owner, fx.theirsId, fx.articleIds[3], 15, theirsBatch);

  const visible = (await pendingBatches(fx.rep)).map((b) => b.batch);
  assert.ok(visible.includes(mineBatch));
  assert.ok(!visible.includes(theirsBatch), "tuđi paket se ne prikazuje");
  const ownerSees = (await pendingBatches(fx.owner)).map((b) => b.batch);
  assert.ok(ownerSees.includes(mineBatch) && ownerSees.includes(theirsBatch), "vlasnik vidi sve");

  await assert.rejects(decidePendingBatch(fx.rep, { batchId: theirsBatch, to: "approved_pending_biznisoft", reason: null }), /opsegu/);
  const before = (await ownerNotices()).length;
  const r = await decidePendingBatch(fx.rep, { batchId: mineBatch, to: "approved_pending_biznisoft", reason: null });
  assert.equal(r.count, 1);
  const after = await ownerNotices();
  assert.equal(after.length, before + 1, "jedno obaveštenje za ceo paket");
  assert.equal(after.at(-1)!.entity_id, mineBatch);
});

test("vlasnikova sopstvena odluka ne pravi obaveštenje vlasniku", async (t) => {
  if (guard(t)) return;
  const { transitionPriceRule } = await import("@/lib/pricing/rule-service");
  const rule = await propose(fx.owner, fx.theirsId, fx.articleIds[0], 7);
  const before = (await ownerNotices()).length;
  await transitionPriceRule({ ruleId: rule.id, to: "approved_pending_biznisoft", reason: null }, fx.owner);
  assert.equal((await ownerNotices()).length, before);
});
