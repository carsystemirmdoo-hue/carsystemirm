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
 * Assignment scope na pricing čitanjima — postflight audit, F-2.
 *
 * Jedinični testovi dokazuju pravilo opsega. Ovde se dokazuje ono što oni ne
 * mogu: da PRODUKCIJSKI upit sa `WHERE` uslovom stvarno ne vrati tuđe redove,
 * i da `customerId` iz adrese ne zaobilazi kapiju.
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
  mineId: string;
  theirsId: string;
  groupMineId: string;
  groupTheirsId: string;
  articleId: string;
  rep: { id: string; name: string; role: string };
  repNoAssignments: { id: string; name: string; role: string };
  owner: { id: string; name: string; role: string };
};

function asPortalUser(
  account: { id: string; name: string; role: string },
  permissions: string[],
) {
  return {
    id: account.id,
    email: `${account.id}@qa-1b.invalid`,
    name: account.name,
    initials: "QA",
    role: account.role as "gazda" | "komercijalista" | "kancelarija" | "magacioner",
    active: true,
    sessionVersion: 0,
    permissions,
  };
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();

  const run = randomUUID().slice(0, 8);
  const [mine] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}m`}, 'QA Moj Kupac') RETURNING id`;
  const [theirs] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}t`}, 'QA Tudji Kupac') RETURNING id`;
  const [groupMine] = await db.sql<{ id: string }[]>`
    INSERT INTO customer_groups (key, name) VALUES (${`qa-m-${run}`}, 'QA Moja grupa') RETURNING id`;
  const [groupTheirs] = await db.sql<{ id: string }[]>`
    INSERT INTO customer_groups (key, name) VALUES (${`qa-t-${run}`}, 'QA Tudja grupa') RETURNING id`;
  await db.sql`INSERT INTO customer_group_members (group_id, customer_id) VALUES (${groupMine.id}, ${mine.id})`;
  await db.sql`INSERT INTO customer_group_members (group_id, customer_id) VALUES (${groupTheirs.id}, ${theirs.id})`;
  const [article] = await db.sql<{ id: string }[]>`
    INSERT INTO articles (code, name, product_group, brand)
    VALUES (${`QAS-${run}`}, 'QA artikal', 'BAZE', 'R-M') RETURNING id`;

  const accounts = await seedAccounts(db, [
    { key: "rep", role: "komercijalista" },
    { key: "repempty", role: "komercijalista" },
    { key: "owner", role: "gazda" },
  ]);
  await db.sql`
    INSERT INTO customer_assignments (user_id, customer_id)
    VALUES (${accounts.rep.id}, ${mine.id})`;

  fx = {
    mineId: mine.id,
    theirsId: theirs.id,
    groupMineId: groupMine.id,
    groupTheirsId: groupTheirs.id,
    articleId: article.id,
    rep: accounts.rep,
    repNoAssignments: accounts.repempty,
    owner: accounts.owner,
  };
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM notifications`;
    await db.sql`DELETE FROM price_rules`;
    await db.sql`DELETE FROM customer_group_members`;
    await db.sql`DELETE FROM customer_groups`;
    await db.sql`DELETE FROM customer_assignments`;
    await db.sql`DELETE FROM articles WHERE code LIKE 'QAS-%'`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

/** Pravilo za konkretnog kupca, u stanju koje učestvuje u ceni. */
async function ruleForCustomer(customerId: string, percent: number) {
  const { scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const rule = {
    customerScope: "customer" as const,
    customerId,
    productScope: "all" as const,
  };
  const [row] = await db.sql<{ id: string }[]>`
    INSERT INTO price_rules (
      customer_scope, customer_id, product_scope,
      precedence_level, scope_key, value_kind, discount_percent,
      effective_from, status, reason, office_recorded_by, office_recorded_at, office_record_note
    ) VALUES ('customer', ${customerId}, 'all', 4, ${scopeKeyFor(rule)},
              'discount_percent', ${percent}, '2026-01-01', 'office_recorded', 'QA',
              ${fx.owner.id}, now(), 'QA evidencija')
    RETURNING id`;
  return row.id;
}

async function ruleForGroup(groupId: string, percent: number) {
  const { scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const rule = {
    customerScope: "group" as const,
    customerGroupId: groupId,
    productScope: "all" as const,
  };
  const [row] = await db.sql<{ id: string }[]>`
    INSERT INTO price_rules (
      customer_scope, customer_group_id, product_scope,
      precedence_level, scope_key, value_kind, discount_percent,
      effective_from, status, reason, office_recorded_by, office_recorded_at, office_record_note
    ) VALUES ('group', ${groupId}, 'all', 8, ${scopeKeyFor(rule)},
              'discount_percent', ${percent}, '2026-01-01', 'office_recorded', 'QA',
              ${fx.owner.id}, now(), 'QA evidencija')
    RETURNING id`;
  return row.id;
}

async function globalRule(percent: number) {
  const [row] = await db.sql<{ id: string }[]>`
    INSERT INTO price_rules (
      customer_scope, product_scope, precedence_level, scope_key,
      value_kind, discount_percent, effective_from, status, reason,
      office_recorded_by, office_recorded_at, office_record_note
    ) VALUES ('all', 'all', 12, 'all|all', 'discount_percent', ${percent},
              '2026-01-01', 'office_recorded', 'QA', ${fx.owner.id}, now(), 'QA evidencija')
    RETURNING id`;
  return row.id;
}

async function reset() {
  await db.sql`DELETE FROM price_rules`;
}

/* -------------------------------------------------------------------------
 * Spisak pravila
 * ---------------------------------------------------------------------- */

test("komercijalista ne vidi pravilo nedodeljenog kupca", async (t) => {
  if (guard(t)) return;
  const { listPriceRules } = await import("@/lib/pricing/rule-service");
  const { resolvePricingScope } = await import("@/lib/pricing/pricing-scope");
  await reset();

  const mine = await ruleForCustomer(fx.mineId, 10);
  const theirs = await ruleForCustomer(fx.theirsId, 40);

  const scope = await resolvePricingScope(asPortalUser(fx.rep, ["cene_predlog"]));
  const rows = await listPriceRules(scope);
  const ids = rows.map((row) => row.id);

  assert.ok(ids.includes(mine), "ne vidi ni svoje pravilo");
  assert.ok(!ids.includes(theirs), "vidi pravilo nedodeljenog kupca");
  // Ime tuđeg kupca ne sme se pojaviti ni kao usputni podatak.
  assert.ok(
    !rows.some((row) => row.customerName === "QA Tudji Kupac"),
    "ime tudjeg kupca je procurilo",
  );
});

test("gazda vidi oba pravila kroz all-customer capability", async (t) => {
  if (guard(t)) return;
  const { listPriceRules } = await import("@/lib/pricing/rule-service");
  const { resolvePricingScope } = await import("@/lib/pricing/pricing-scope");
  await reset();
  const mine = await ruleForCustomer(fx.mineId, 10);
  const theirs = await ruleForCustomer(fx.theirsId, 40);

  const scope = await resolvePricingScope(asPortalUser(fx.owner, []));
  assert.equal(scope.seesAll, true);
  const ids = (await listPriceRules(scope)).map((row) => row.id);
  assert.ok(ids.includes(mine) && ids.includes(theirs));
});

test("prazan assignment vraca prazno, nikad sve", async (t) => {
  if (guard(t)) return;
  const { listPriceRules } = await import("@/lib/pricing/rule-service");
  const { resolvePricingScope } = await import("@/lib/pricing/pricing-scope");
  await reset();
  await ruleForCustomer(fx.mineId, 10);
  await ruleForCustomer(fx.theirsId, 40);

  const scope = await resolvePricingScope(
    asPortalUser(fx.repNoAssignments, ["cene_predlog"]),
  );
  assert.deepEqual(scope.customerIds, []);
  assert.deepEqual(scope.groupIds, []);

  const rows = await listPriceRules(scope);
  // Globalna pravila bi bila vidljiva, ali ovde ih nema — dakle prazno.
  assert.equal(rows.length, 0, "komercijalista bez dodela je video tudja pravila");
});

test("grupno pravilo se vidi samo ako grupa sadrzi dodeljenog kupca", async (t) => {
  if (guard(t)) return;
  const { listPriceRules } = await import("@/lib/pricing/rule-service");
  const { resolvePricingScope } = await import("@/lib/pricing/pricing-scope");
  await reset();
  const mine = await ruleForGroup(fx.groupMineId, 12);
  const theirs = await ruleForGroup(fx.groupTheirsId, 33);

  const scope = await resolvePricingScope(asPortalUser(fx.rep, ["cene_predlog"]));
  const ids = (await listPriceRules(scope)).map((row) => row.id);
  assert.ok(ids.includes(mine));
  assert.ok(!ids.includes(theirs), "vidi grupu koja ne sadrzi njegovog kupca");
});

test("globalno pravilo je vidljivo — ne otkriva nijednog kupca", async (t) => {
  if (guard(t)) return;
  const { listPriceRules } = await import("@/lib/pricing/rule-service");
  const { resolvePricingScope } = await import("@/lib/pricing/pricing-scope");
  await reset();
  const global = await globalRule(3);

  const scope = await resolvePricingScope(asPortalUser(fx.rep, ["cene_predlog"]));
  const ids = (await listPriceRules(scope)).map((row) => row.id);
  assert.ok(ids.includes(global));
});

/* -------------------------------------------------------------------------
 * Direktan customerId iz zahteva
 * ---------------------------------------------------------------------- */

test("customerId iz adrese ne zaobilazi opseg", async (t) => {
  if (guard(t)) return;
  const { previewPricing } = await import("@/lib/pricing/evaluation-service");
  await reset();
  await ruleForCustomer(fx.theirsId, 40);

  await assert.rejects(
    () =>
      previewPricing({
        customerId: fx.theirsId,
        articleId: fx.articleId,
        onDate: "2026-06-15",
        viewer: asPortalUser(fx.rep, ["cene_predlog"]),
      }),
    /nije u vašem opsegu/,
    "preview je vratio cenu nedodeljenog kupca",
  );
});

test("isti upit za SVOG kupca prolazi", async (t) => {
  if (guard(t)) return;
  const { previewPricing } = await import("@/lib/pricing/evaluation-service");
  await reset();
  await ruleForCustomer(fx.mineId, 10);

  const preview = await previewPricing({
    customerId: fx.mineId,
    articleId: fx.articleId,
    onDate: "2026-06-15",
    viewer: asPortalUser(fx.rep, ["cene_predlog"]),
  });
  assert.ok(preview.winner);
  assert.equal(preview.confirmed, false);
  assert.equal(preview.officeRecorded, true);
});

test("komercijalista bez dodela ne moze videti nijednu cenu", async (t) => {
  if (guard(t)) return;
  const { previewPricing } = await import("@/lib/pricing/evaluation-service");
  await reset();
  await ruleForCustomer(fx.mineId, 10);

  await assert.rejects(
    () =>
      previewPricing({
        customerId: fx.mineId,
        articleId: fx.articleId,
        viewer: asPortalUser(fx.repNoAssignments, ["cene_predlog"]),
      }),
    /nije u vašem opsegu/,
  );
});

/* -------------------------------------------------------------------------
 * Konflikti i izbornik
 * ---------------------------------------------------------------------- */

test("izvestaj o konfliktima ne otkriva tudji scope_key", async (t) => {
  if (guard(t)) return;
  const { listRuleConflicts } = await import("@/lib/pricing/evaluation-service");
  const { resolvePricingScope } = await import("@/lib/pricing/pricing-scope");
  await reset();
  // Dva sudarena pravila za TUDJEG kupca.
  await ruleForCustomer(fx.theirsId, 10);
  await ruleForCustomer(fx.theirsId, 40);

  const repScope = await resolvePricingScope(asPortalUser(fx.rep, ["cene_predlog"]));
  const repConflicts = await listRuleConflicts(repScope);
  assert.equal(repConflicts.length, 0, "komercijalista vidi tudji konflikt");
  assert.ok(
    !repConflicts.some((c) => c.scopeKey.includes(fx.theirsId)),
    "scope_key tudjeg kupca je procurio",
  );

  const ownerScope = await resolvePricingScope(asPortalUser(fx.owner, []));
  assert.equal((await listRuleConflicts(ownerScope)).length, 1, "gazda ne vidi konflikt");
});

test("izbornik kupaca je skopiran", async (t) => {
  if (guard(t)) return;
  const { listScopedCustomers } = await import("@/lib/pricing/pricing-scope");

  const forRep = await listScopedCustomers(asPortalUser(fx.rep, ["cene_predlog"]));
  assert.deepEqual(
    forRep.map((c) => c.id),
    [fx.mineId],
  );

  const forEmpty = await listScopedCustomers(
    asPortalUser(fx.repNoAssignments, ["cene_predlog"]),
  );
  assert.deepEqual(forEmpty, []);

  const forOwner = await listScopedCustomers(asPortalUser(fx.owner, []));
  const ownerIds = forOwner.map((c) => c.id);
  assert.ok(ownerIds.includes(fx.mineId) && ownerIds.includes(fx.theirsId));
});

test("ruta odobravanja trazi uzu sposobnost od view:cene", async (t) => {
  if (guard(t)) return;
  const { resolveCapabilities, ROUTE_CAPABILITY } = await import(
    "@/lib/authz/permissions.mjs"
  );
  assert.equal(
    ROUTE_CAPABILITY["/portal/cene/odobravanje"],
    "view:cene_odobravanje",
  );
  const predlagac = resolveCapabilities("komercijalista", ["cene_predlog"]);
  assert.equal(predlagac.has("view:cene"), true);
  assert.equal(
    predlagac.has("view:cene_odobravanje"),
    false,
    "predlagac i dalje moze na ekran odobravanja",
  );
});
