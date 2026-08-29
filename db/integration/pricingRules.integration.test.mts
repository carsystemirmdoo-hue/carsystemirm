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
 * Pravila cene nad stvarnim PostgreSQL-om.
 *
 * Jedinični testovi dokazuju matricu prvenstva (`lib/pricing/precedence.test.mjs`).
 * Ovde se dokazuje ono što JavaScript ne može: da su CHECK ograničenja stvarno
 * u bazi, i da produkcijski upit koji predfiltrira u SQL-u vraća isti skup nad
 * kojim čista funkcija odlučuje.
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
let fixture: {
  customerId: string;
  otherCustomerId: string;
  groupId: string;
  articleId: string;
  actorId: string;
};

/**
 * Gazda kao posmatrac.
 *
 * `previewPricing`, `listRuleConflicts` i `listPriceRules` od F-2 traze
 * posmatraca, jer `customerId` po pravilu stize iz adrese i mora proci kapiju
 * pre nego sto udje u upit. Ovaj fajl dokazuje MATRICU PRVENSTVA, pa namerno
 * gleda kroz nalog koji vidi sve kupce — opseg komercijaliste se dokazuje u
 * `pricingScope.integration.test.mts`, da se dve stvari ne mesaju u istom testu.
 */
function ownerViewer() {
  return {
    id: fixture.actorId,
    email: `${fixture.actorId}@qa-1b.invalid`,
    name: "QA gazda",
    initials: "QA",
    role: "gazda" as const,
    active: true,
    sessionVersion: 0,
    permissions: [] as string[],
  };
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();

  const run = randomUUID().slice(0, 8);
  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}p`}, 'QA Pricing Kupac') RETURNING id`;
  const [other] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}o`}, 'QA Drugi Kupac') RETURNING id`;
  const [group] = await db.sql<{ id: string }[]>`
    INSERT INTO customer_groups (key, name) VALUES (${`qa-${run}`}, 'QA grupa') RETURNING id`;
  await db.sql`
    INSERT INTO customer_group_members (group_id, customer_id) VALUES (${group.id}, ${customer.id})`;
  const [article] = await db.sql<{ id: string }[]>`
    INSERT INTO articles (code, name, product_group, brand)
    VALUES (${`QA-${run}`}, 'QA artikal', 'BAZE', 'R-M') RETURNING id`;

  // `confirmed` trazi potpis — vidi `price_rules_confirmed_ck`.
  const accounts = await seedAccounts(db, [{ key: "gazda", role: "gazda" }]);

  fixture = {
    customerId: customer.id,
    otherCustomerId: other.id,
    groupId: group.id,
    articleId: article.id,
    actorId: accounts.gazda.id,
  };
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM price_rules`;
    await db.sql`DELETE FROM customer_group_members`;
    await db.sql`DELETE FROM customer_groups`;
    await db.sql`DELETE FROM articles WHERE code LIKE 'QA-%'`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

/** Umeće pravilo date klase; `level` određuje opseg. */
async function insertRule(
  level: number,
  overrides: Partial<{
    status: string;
    discountPercent: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    customerId: string;
  }> = {},
) {
  const { PRECEDENCE_LEVELS, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const spec = PRECEDENCE_LEVELS.find((entry) => entry.level === level)!;
  /*
   * Podrazumevano `office_recorded`, ne `confirmed`.
   *
   * `confirmed` sada trazi referencu na fakturu (`price_rules_confirmed_needs_invoice_ck`),
   * a ovi testovi dokazuju prvenstvo, ne usaglasavanje. `office_recorded` isto
   * ucestvuje u odlucivanju o ceni.
   */
  const status = overrides.status ?? "office_recorded";

  const rule = {
    customerScope: spec.customerScope,
    customerId:
      spec.customerScope === "customer"
        ? (overrides.customerId ?? fixture.customerId)
        : null,
    customerGroupId: spec.customerScope === "group" ? fixture.groupId : null,
    productScope: spec.productScope,
    articleId: spec.productScope === "article" ? fixture.articleId : null,
    productGroup: spec.productScope === "product_group" ? "BAZE" : null,
    brand: spec.productScope === "brand" ? "R-M" : null,
  };

  const [row] = await db.sql<{ id: string }[]>`
    INSERT INTO price_rules (
      customer_scope, customer_id, customer_group_id,
      product_scope, article_id, product_group, brand,
      precedence_level, scope_key,
      value_kind, discount_percent,
      effective_from, effective_to, status, reason,
      office_recorded_by, office_recorded_at, office_record_note, decision_reason
    ) VALUES (
      ${rule.customerScope}, ${rule.customerId}, ${rule.customerGroupId},
      ${rule.productScope}, ${rule.articleId}, ${rule.productGroup}, ${rule.brand},
      ${level}, ${scopeKeyFor(rule)},
      'discount_percent', ${overrides.discountPercent ?? level},
      ${overrides.effectiveFrom ?? "2026-01-01"},
      ${overrides.effectiveTo ?? null},
      ${status},
      'QA pravilo',
      ${status === "office_recorded" ? fixture.actorId : null},
      ${status === "office_recorded" ? new Date() : null},
      ${status === "office_recorded" ? "QA evidencija" : null},
      ${status === "rejected" || status === "revoked" ? "QA odluka" : null}
    ) RETURNING id`;
  return row.id;
}

/* -------------------------------------------------------------------------
 * Prvenstvo kroz pravi upit
 * ---------------------------------------------------------------------- */

test("svih 12 klasa: uzi opseg pobedjuje, kroz pravi SQL upit", async (t) => {
  if (guard(t)) return;
  const { previewPricing } = await import("@/lib/pricing/evaluation-service");

  await db.sql`DELETE FROM price_rules`;
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    await insertRule(level);
  }

  for (let expected = 1; expected <= 12; expected += 1) {
    const preview = await previewPricing({
      customerId: fixture.customerId,
      articleId: fixture.articleId,
      onDate: "2026-06-15",
      viewer: ownerViewer(),
    });
    assert.equal(preview.conflict.length, 0, `konflikt na klasi ${expected}`);
    assert.ok(preview.winner, `nema pobednika na klasi ${expected}`);
    assert.equal(preview.level, expected);
    assert.equal(preview.considered.length, 13 - expected);

    await db.sql`DELETE FROM price_rules WHERE precedence_level = ${expected}`;
  }

  const prazno = await previewPricing({
    customerId: fixture.customerId,
    articleId: fixture.articleId,
    onDate: "2026-06-15",
    viewer: ownerViewer(),
  });
  assert.equal(prazno.winner, null);
});

test("kupac bez grupe ne dobija nijedno grupno pravilo", async (t) => {
  if (guard(t)) return;
  const { previewPricing } = await import("@/lib/pricing/evaluation-service");

  await db.sql`DELETE FROM price_rules`;
  await insertRule(5); // grupa + artikal

  // `otherCustomer` nije član nijedne grupe.
  const preview = await previewPricing({
    customerId: fixture.otherCustomerId,
    articleId: fixture.articleId,
    onDate: "2026-06-15",
    viewer: ownerViewer(),
  });
  assert.equal(preview.winner, null, "grupno pravilo je pokrilo kupca van grupe");
  assert.equal(preview.considered.length, 0);
});

test("dva pravila iste klase i istog opsega daju konflikt, ne izbor", async (t) => {
  if (guard(t)) return;
  const { previewPricing } = await import("@/lib/pricing/evaluation-service");

  await db.sql`DELETE FROM price_rules`;
  await insertRule(1, { discountPercent: 10 });
  await insertRule(1, { discountPercent: 40 });

  const preview = await previewPricing({
    customerId: fixture.customerId,
    articleId: fixture.articleId,
    onDate: "2026-06-15",
    viewer: ownerViewer(),
  });
  assert.equal(preview.winner, null, "sistem je izabrao pobednika");
  assert.equal(preview.conflict.length, 2);
  assert.match(preview.reason, /Konflikt/);
});

test("izvestaj o konfliktima ne prijavljuje pravila koja se smenjuju kroz vreme", async (t) => {
  if (guard(t)) return;
  const { listRuleConflicts } = await import("@/lib/pricing/evaluation-service");
  // Gazda: `customerIds: null` znaci „bez ogranicenja", ne „prazan opseg".
  const OWNER_SCOPE = { seesAll: true, customerIds: null, groupIds: null };

  await db.sql`DELETE FROM price_rules`;
  await insertRule(1, { effectiveFrom: "2026-01-01", effectiveTo: "2026-05-31" });
  await insertRule(1, { effectiveFrom: "2026-06-01", effectiveTo: null });
  assert.deepEqual(await listRuleConflicts(OWNER_SCOPE), []);

  await insertRule(1, { effectiveFrom: "2026-06-15", effectiveTo: null });
  const conflicts = await listRuleConflicts(OWNER_SCOPE);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].precedenceLevel, 1);
  assert.equal(conflicts[0].total, 2);
});

/* -------------------------------------------------------------------------
 * approved ≠ confirmed
 * ---------------------------------------------------------------------- */

test("odobreno pravilo vazi, ali NIJE potvrdjeno iz BizniSofta", async (t) => {
  if (guard(t)) return;
  const { previewPricing } = await import("@/lib/pricing/evaluation-service");

  await db.sql`DELETE FROM price_rules`;
  await insertRule(1, { status: "approved_pending_biznisoft" });

  const preview = await previewPricing({
    customerId: fixture.customerId,
    articleId: fixture.articleId,
    onDate: "2026-06-15",
    viewer: ownerViewer(),
  });
  assert.ok(preview.winner);
  assert.equal(preview.winner.status, "approved_pending_biznisoft");
  assert.equal(
    preview.confirmed,
    false,
    "odobreno pravilo je prikazano kao potvrdjeno",
  );
  assert.equal(preview.officeRecorded, false);
});

test("predlog koji niko nije odobrio ne utice na cenu", async (t) => {
  if (guard(t)) return;
  const { previewPricing } = await import("@/lib/pricing/evaluation-service");

  await db.sql`DELETE FROM price_rules`;
  for (const status of ["draft", "pending_approval", "rejected", "revoked", "expired"]) {
    await insertRule(1, { status });
    const preview = await previewPricing({
      customerId: fixture.customerId,
      articleId: fixture.articleId,
      onDate: "2026-06-15",
      viewer: ownerViewer(),
    });
    assert.equal(preview.winner, null, `stanje ${status} je uticalo na cenu`);
    await db.sql`DELETE FROM price_rules`;
  }
});

/* -------------------------------------------------------------------------
 * Ograničenja baze
 * ---------------------------------------------------------------------- */

test("pravilo ne moze imati i rabat i fiksnu cenu — baza to odbija", async (t) => {
  if (guard(t)) return;
  await assert.rejects(
    () => db.sql`
      INSERT INTO price_rules (
        customer_scope, customer_id, product_scope, article_id,
        precedence_level, scope_key, value_kind, discount_percent, net_price,
        effective_from, status, reason
      ) VALUES (
        'customer', ${fixture.customerId}, 'article', ${fixture.articleId},
        1, 'x', 'net_price', 10, 500, '2026-01-01', 'draft', 'QA'
      )`,
    /price_rules_value_ck/,
  );
});

test("opseg bez svog polja se odbija u bazi", async (t) => {
  if (guard(t)) return;
  // customer_scope = 'customer' bez customer_id
  await assert.rejects(
    () => db.sql`
      INSERT INTO price_rules (
        customer_scope, product_scope, precedence_level, scope_key,
        value_kind, discount_percent, effective_from, status, reason
      ) VALUES ('customer', 'all', 4, 'x', 'discount_percent', 5, '2026-01-01', 'draft', 'QA')`,
    /price_rules_customer_scope_ck/,
  );

  // product_scope = 'brand' bez brenda
  await assert.rejects(
    () => db.sql`
      INSERT INTO price_rules (
        customer_scope, product_scope, precedence_level, scope_key,
        value_kind, discount_percent, effective_from, status, reason
      ) VALUES ('all', 'brand', 11, 'x', 'discount_percent', 5, '2026-01-01', 'draft', 'QA')`,
    /price_rules_product_scope_ck/,
  );
});

test("pogresna klasa prvenstva se ne moze upisati", async (t) => {
  if (guard(t)) return;
  await assert.rejects(
    () => db.sql`
      INSERT INTO price_rules (
        customer_scope, customer_id, product_scope, article_id,
        precedence_level, scope_key, value_kind, discount_percent,
        effective_from, status, reason
      ) VALUES (
        'customer', ${fixture.customerId}, 'article', ${fixture.articleId},
        9, 'x', 'discount_percent', 5, '2026-01-01', 'draft', 'QA'
      )`,
    /price_rules_precedence_ck/,
  );
});

test("baza cuva sve 12 klase kada su tacno izracunate", async (t) => {
  if (guard(t)) return;
  await db.sql`DELETE FROM price_rules`;
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    await insertRule(level);
  }
  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM price_rules`;
  assert.equal(count, 12);
});

test("confirmed bez dokaza sa fakture se ne moze upisati", async (t) => {
  if (guard(t)) return;
  /*
   * Ovo je brava iza F-1: `confirmed` traži red iz `invoices`, a te redove
   * pravi uvoz iz knjigovodstva — ne portal i ne čovek.
   */
  await assert.rejects(
    () => db.sql`
      INSERT INTO price_rules (
        customer_scope, product_scope, precedence_level, scope_key,
        value_kind, discount_percent, effective_from, status, reason,
        confirmed_by, confirmed_at
      ) VALUES ('all', 'all', 12, 'all|all', 'discount_percent', 5,
                '2026-01-01', 'confirmed', 'QA', ${fixture.actorId}, now())`,
    /price_rules_confirmed_needs_invoice_ck/,
  );
});

test("office_recorded bez napomene se ne moze upisati", async (t) => {
  if (guard(t)) return;
  await assert.rejects(
    () => db.sql`
      INSERT INTO price_rules (
        customer_scope, product_scope, precedence_level, scope_key,
        value_kind, discount_percent, effective_from, status, reason,
        office_recorded_by, office_recorded_at
      ) VALUES ('all', 'all', 12, 'all|all', 'discount_percent', 5,
                '2026-01-01', 'office_recorded', 'QA', ${fixture.actorId}, now())`,
    /price_rules_office_recorded_ck/,
  );
});

test("odbijeno pravilo mora imati razlog odluke", async (t) => {
  if (guard(t)) return;
  await assert.rejects(
    () => db.sql`
      INSERT INTO price_rules (
        customer_scope, product_scope, precedence_level, scope_key,
        value_kind, discount_percent, effective_from, status, reason
      ) VALUES ('all', 'all', 12, 'all|all', 'discount_percent', 5,
                '2026-01-01', 'rejected', 'QA')`,
    /price_rules_decision_reason_ck/,
  );
});

test("obrnut interval vazenja se odbija u bazi", async (t) => {
  if (guard(t)) return;
  await assert.rejects(
    () => db.sql`
      INSERT INTO price_rules (
        customer_scope, product_scope, precedence_level, scope_key,
        value_kind, discount_percent, effective_from, effective_to, status, reason
      ) VALUES ('all', 'all', 12, 'all|all', 'discount_percent', 5,
                '2026-06-01', '2026-05-01', 'draft', 'QA')`,
    /price_rules_effective_ck/,
  );
});
