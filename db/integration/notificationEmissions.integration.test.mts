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
 * Cetiri vrste obavestenja koje postflight audit (F-7) nije nasao nigde
 * emitovane, plus idempotentnost.
 *
 * Sve cetiri nastaju iz MUTACIJE, ne iz otvaranja ekrana. Ekran koji bi ih
 * proizvodio pravio bi nov red pri svakom osvezavanju, a lista koja se puni
 * istim redom prestaje da se cita.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

let db: TestDatabase;
let fx: {
  customerId: string;
  articleId: string;
  accountId: string;
  owner: { id: string; name: string; role: string };
  office: { id: string; name: string; role: string };
};

const staff = (a: { id: string; name: string; role: string }) => ({
  id: a.id,
  name: a.name,
  role: a.role,
});

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();

  const run = randomUUID().slice(0, 8);
  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}n`}, 'QA Notif Kupac') RETURNING id`;
  const [article] = await db.sql<{ id: string }[]>`
    INSERT INTO articles (code, name, product_group, brand)
    VALUES (${`QAN-${run}`}, 'QA artikal', 'BAZE', 'R-M') RETURNING id`;
  const [account] = await db.sql<{ id: string }[]>`
    INSERT INTO customer_users (customer_id, email, name, password_hash, status)
    VALUES (${customer.id}, ${`qa1bverify-${run}-n@qa-1b.invalid`}, 'QA', 'x', 'active')
    RETURNING id`;

  const accounts = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "office", role: "kancelarija" },
  ]);

  fx = {
    customerId: customer.id,
    articleId: article.id,
    accountId: account.id,
    owner: accounts.owner,
    office: accounts.office,
  };
});

after(async () => {
  if (!reason && db) {
    // Redosled prati strane kljuceve: sve sto pokazuje na `articles` i
    // `customers` mora pasti pre njih.
    await db.sql`DELETE FROM notifications`;
    await db.sql`DELETE FROM price_rules`;
    await db.sql`DELETE FROM article_catalog_mappings`;
    await db.sql`DELETE FROM customer_external_identifiers`;
    await db.sql`DELETE FROM customer_users WHERE email LIKE 'qa1bverify-%'`;
    await db.sql`DELETE FROM articles WHERE code LIKE 'QAN-%'`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

async function countKind(kind: string) {
  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM notifications WHERE kind = ${kind}`;
  return count;
}

/* -------------------------------------------------------------------------
 * external_identity_conflict
 * ---------------------------------------------------------------------- */

test("konflikt sifre partnera emituje obavestenje, idempotentno", async (t) => {
  if (guard(t)) return;
  const { registerExternalIdentifier } = await import(
    "@/lib/commercial/identity-service"
  );
  await db.sql`DELETE FROM notifications`;
  await db.sql`DELETE FROM customer_external_identifiers`;

  const [drugi] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 8)}d`}, 'QA Drugi') RETURNING id`;

  const code = { sourceSystem: "biznisoft", issuerCode: "01", externalPartnerCode: "0012" };
  await registerExternalIdentifier(
    { ...code, customerId: fx.customerId },
    staff(fx.office),
  );
  // Ista sifra ka DRUGOM kupcu → konflikt.
  await registerExternalIdentifier({ ...code, customerId: drugi.id }, staff(fx.office));

  assert.equal(await countKind("external_identity_conflict"), 1);

  const [notice] = await db.sql<
    { severity: string; required_capability: string; context: Record<string, unknown> }[]
  >`SELECT severity, required_capability, context FROM notifications
    WHERE kind = 'external_identity_conflict'`;
  assert.equal(notice.severity, "critical");
  assert.equal(notice.required_capability, "mappings:manage");
  const payload = JSON.stringify(notice.context).toLowerCase();
  for (const forbidden of ["pib", "adresa", "email"]) {
    assert.ok(!payload.includes(forbidden), `kontekst nosi ${forbidden}`);
  }

  // Ponovni uvoz istog sudara NE pravi drugi red dok je prvi otvoren.
  await registerExternalIdentifier({ ...code, customerId: drugi.id }, staff(fx.office));
  assert.equal(
    await countKind("external_identity_conflict"),
    1,
    "isti konflikt je duplirao obavestenje",
  );
});

/* -------------------------------------------------------------------------
 * mapping_customer_facing_changed
 * ---------------------------------------------------------------------- */

test("mapiranje emituje samo kada se menja ono sto kupac vidi", async (t) => {
  if (guard(t)) return;
  const { decideMapping } = await import("@/lib/commercial/mapping-service");
  await db.sql`DELETE FROM notifications`;
  await db.sql`DELETE FROM article_catalog_mappings`;

  // unmapped → mapped: kupac dobija sliku i PDP.
  await decideMapping(
    {
      articleId: fx.articleId,
      status: "mapped",
      catalogProductSlug: "neki-proizvod",
      note: "provereno u cenovniku",
    },
    staff(fx.office),
  );
  assert.equal(await countKind("mapping_customer_facing_changed"), 1);

  /*
   * mapped → revoked: kupac ih gubi. Nov dogadjaj, nov kljuc.
   *
   * `revoked`, ne `rejected` — od F-10 su to razliciti dogadjaji i potvrdjena
   * veza se ponistava, ne odbija.
   */
  await decideMapping(
    { articleId: fx.articleId, status: "revoked", note: "pogresna veza" },
    staff(fx.office),
  );
  assert.equal(await countKind("mapping_customer_facing_changed"), 2);

  const [poslednje] = await db.sql<{ body: string }[]>`
    SELECT body FROM notifications
    WHERE kind = 'mapping_customer_facing_changed' ORDER BY id DESC LIMIT 1`;
  assert.match(poslednje.body, /bez slike i PDP-a/);
});

test("prelaz koji kupcu ne menja nista NE emituje", async (t) => {
  if (guard(t)) return;
  const { decideMapping } = await import("@/lib/commercial/mapping-service");
  await db.sql`DELETE FROM notifications`;
  await db.sql`DELETE FROM article_catalog_mappings`;

  // unmapped → unmapped: kupac ni pre ni posle nema kataloski identitet.
  await decideMapping(
    { articleId: fx.articleId, status: "unmapped", note: "ostaje nemapiran" },
    staff(fx.office),
  );
  assert.equal(await countKind("mapping_customer_facing_changed"), 0);
});

/* -------------------------------------------------------------------------
 * customer_account_status_changed
 * ---------------------------------------------------------------------- */

test("promena stanja kupcevog naloga emituje obavestenje bez e-poste", async (t) => {
  if (guard(t)) return;
  const { setCustomerAccountStatus } = await import(
    "@/lib/customers/account-service"
  );
  await db.sql`DELETE FROM notifications`;

  await setCustomerAccountStatus(
    { accountId: fx.accountId, status: "suspended", reason: "Neizmirena dugovanja" },
    staff(fx.owner),
  );

  const [notice] = await db.sql<
    {
      severity: string;
      required_capability: string;
      context: Record<string, unknown>;
      body: string;
    }[]
  >`SELECT severity, required_capability, context, body FROM notifications
    WHERE kind = 'customer_account_status_changed'`;

  assert.ok(notice, "promena stanja naloga nije emitovala obavestenje");
  assert.equal(notice.severity, "warning");
  assert.equal(notice.required_capability, "customer_accounts:manage");
  assert.ok(
    !JSON.stringify(notice.context).includes("@"),
    "kontekst nosi e-postu",
  );
  assert.match(notice.body, /suspended/);
});

/* -------------------------------------------------------------------------
 * price_rule_conflict
 * ---------------------------------------------------------------------- */

test("sudar dva aktivna pravila emituje kriticno obavestenje, jednom", async (t) => {
  if (guard(t)) return;
  const { proposePriceRule, transitionPriceRule } = await import(
    "@/lib/pricing/rule-service"
  );
  await db.sql`DELETE FROM notifications`;
  await db.sql`DELETE FROM price_rules`;

  const owner = {
    id: fx.owner.id,
    email: `${fx.owner.id}@qa-1b.invalid`,
    name: fx.owner.name,
    initials: "QA",
    role: "gazda" as const,
    active: true,
    sessionVersion: 0,
    permissions: [] as string[],
  };

  const draft = {
    customerScope: "customer" as const,
    customerId: fx.customerId,
    productScope: "article" as const,
    articleId: fx.articleId,
    valueKind: "discount_percent" as const,
    effectiveFrom: "2026-01-01",
  };

  const a = await proposePriceRule(
    { ...draft, discountPercent: 10, reason: "Prvi dogovor" },
    owner,
  );
  const b = await proposePriceRule(
    { ...draft, discountPercent: 20, reason: "Drugi dogovor" },
    owner,
  );

  // Prvo odobrenje: jos nema sudara.
  await transitionPriceRule(
    { ruleId: a.id, to: "approved_pending_biznisoft" },
    owner,
  );
  assert.equal(await countKind("price_rule_conflict"), 0);

  // Drugo odobrenje pravi sudar iste klase i istog opsega.
  await transitionPriceRule(
    { ruleId: b.id, to: "approved_pending_biznisoft" },
    owner,
  );
  assert.equal(await countKind("price_rule_conflict"), 1);

  const [notice] = await db.sql<{ severity: string; required_capability: string }[]>`
    SELECT severity, required_capability FROM notifications
    WHERE kind = 'price_rule_conflict'`;
  assert.equal(notice.severity, "critical");
  assert.equal(notice.required_capability, "prices:approve");
});

/* -------------------------------------------------------------------------
 * Idempotentnost i read/resolve lifecycle
 * ---------------------------------------------------------------------- */

test("zatvoreno obavestenje dozvoljava nov red kada se uslov ponovi", async (t) => {
  if (guard(t)) return;
  const { notify, resolveNotification } = await import(
    "@/lib/notifications/notification-service"
  );
  await db.sql`DELETE FROM notifications`;

  const input = {
    kind: "price_rule_conflict" as const,
    severity: "critical" as const,
    requiredCapability: "prices:approve",
    title: "t",
    body: "b",
    entityType: "Pravilo cene",
    dedupeKey: "test:kljuc",
  };

  await notify(input);
  await notify(input);
  assert.equal(await countKind("price_rule_conflict"), 1, "duplikat je prosao");

  const [row] = await db.sql<{ id: number }[]>`
    SELECT id FROM notifications WHERE dedupe_key = 'test:kljuc'`;

  const owner = {
    id: fx.owner.id,
    email: `${fx.owner.id}@qa-1b.invalid`,
    name: fx.owner.name,
    initials: "QA",
    role: "gazda" as const,
    active: true,
    sessionVersion: 0,
    permissions: [] as string[],
  };
  assert.equal(await resolveNotification(owner, row.id, "Razreseno rucno"), true);

  /*
   * Posle zatvaranja isti uslov SME ponovo. Da je indeks pokrivao i zatvorene,
   * ponovna pojava problema bi prosla nemo — sto je gore od duplikata.
   */
  await notify(input);
  assert.equal(await countKind("price_rule_conflict"), 2);
});
