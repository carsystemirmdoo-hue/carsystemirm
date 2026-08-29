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
 * Tok promene cene, audit i obaveštenja — nad stvarnim PostgreSQL-om.
 *
 * Ovde se dokazuju tri stvari koje jedinični test ne može:
 *   - da su izmena, audit zapis i obaveštenje u ISTOJ transakciji;
 *   - da je `audit_log` stvarno append-only (okidač u bazi);
 *   - da obaveštenje vidi samo onaj ko ima odgovarajuću sposobnost.
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
  articleId: string;
  rep: { id: string; name: string; role: string };
  owner: { id: string; name: string; role: string };
  office: { id: string; name: string; role: string };
};

/** `PortalUser` oblik koji servisi očekuju, sa stvarnim paketima. */
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
  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}w`}, 'QA Workflow Kupac') RETURNING id`;
  const [article] = await db.sql<{ id: string }[]>`
    INSERT INTO articles (code, name, product_group, brand)
    VALUES (${`QAW-${run}`}, 'QA artikal', 'BAZE', 'R-M') RETURNING id`;

  const accounts = await seedAccounts(db, [
    { key: "rep", role: "komercijalista" },
    { key: "owner", role: "gazda" },
    { key: "office", role: "kancelarija" },
  ]);

  // Komercijalista vidi samo dodeljene kupce.
  await db.sql`
    INSERT INTO customer_assignments (user_id, customer_id)
    VALUES (${accounts.rep.id}, ${customer.id})`;

  fixture = {
    customerId: customer.id,
    articleId: article.id,
    rep: accounts.rep,
    owner: accounts.owner,
    office: accounts.office,
  };
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM notifications`;
    await db.sql`DELETE FROM price_rules`;
    await db.sql`DELETE FROM customer_assignments`;
    await db.sql`DELETE FROM articles WHERE code LIKE 'QAW-%'`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

async function freshProposal() {
  const { proposePriceRule } = await import("@/lib/pricing/rule-service");
  await db.sql`DELETE FROM notifications`;
  await db.sql`DELETE FROM price_rules`;

  return proposePriceRule(
    {
      customerScope: "customer",
      customerId: fixture.customerId,
      productScope: "article",
      articleId: fixture.articleId,
      valueKind: "discount_percent",
      discountPercent: 15,
      effectiveFrom: "2026-01-01",
      reason: "Dogovoren rabat za kvartal",
    },
    asPortalUser(fixture.rep, ["cene_predlog"]),
  );
}

/* -------------------------------------------------------------------------
 * Predlaganje
 * ---------------------------------------------------------------------- */

test("komercijalista predlaze za dodeljenog kupca i to stvara audit i obavestenje", async (t) => {
  if (guard(t)) return;
  const created = await freshProposal();
  assert.equal(created.status, "pending_approval");

  const audit = await db.sql<{ action: string; reason: string }[]>`
    SELECT action, reason FROM audit_log WHERE entity_id = ${created.id}`;
  assert.equal(audit.length, 1);
  assert.match(audit[0].action, /Predložena promena cene/);
  assert.equal(audit[0].reason, "Dogovoren rabat za kvartal");

  const notifications = await db.sql<{ required_capability: string; kind: string }[]>`
    SELECT required_capability, kind FROM notifications WHERE entity_id = ${created.id}`;
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, "price_rule_proposed");
  // Obaveštenje ide onome ko odlučuje, ne onome ko je predložio.
  assert.equal(notifications[0].required_capability, "prices:approve");
});

test("komercijalista ne moze predloziti za nedodeljenog kupca", async (t) => {
  if (guard(t)) return;
  const { proposePriceRule } = await import("@/lib/pricing/rule-service");

  const [drugi] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 8)}x`}, 'QA Tudji Kupac') RETURNING id`;

  await assert.rejects(
    () =>
      proposePriceRule(
        {
          customerScope: "customer",
          customerId: drugi.id,
          productScope: "all",
          valueKind: "discount_percent",
          discountPercent: 10,
          effectiveFrom: "2026-01-01",
          reason: "Pokusaj van opsega",
        },
        asPortalUser(fixture.rep, ["cene_predlog"]),
      ),
    /nije u vašem opsegu/,
  );
});

test("komercijalista ne moze predloziti globalno pravilo", async (t) => {
  if (guard(t)) return;
  const { proposePriceRule } = await import("@/lib/pricing/rule-service");

  await assert.rejects(
    () =>
      proposePriceRule(
        {
          customerScope: "all",
          productScope: "all",
          valueKind: "discount_percent",
          discountPercent: 5,
          effectiveFrom: "2026-01-01",
          reason: "Globalni rabat",
        },
        asPortalUser(fixture.rep, ["cene_predlog"]),
      ),
    /vidi sve kupce/,
  );
});

/* -------------------------------------------------------------------------
 * Odobravanje, odbijanje, potvrda
 * ---------------------------------------------------------------------- */

test("odobreno pravilo je approved_pending_biznisoft, NE confirmed", async (t) => {
  if (guard(t)) return;
  const { transitionPriceRule } = await import("@/lib/pricing/rule-service");
  const created = await freshProposal();

  await transitionPriceRule(
    { ruleId: created.id, to: "approved_pending_biznisoft" },
    asPortalUser(fixture.owner, []),
  );

  const [rule] = await db.sql<{ status: string; confirmed_at: Date | null }[]>`
    SELECT status, confirmed_at FROM price_rules WHERE id = ${created.id}`;
  assert.equal(rule.status, "approved_pending_biznisoft");
  assert.equal(rule.confirmed_at, null, "odobrenje je popunilo potvrdu");

  // Obaveštenje o odobrenju ide kancelariji, koja upisuje u BizniSoft.
  const [notice] = await db.sql<{ required_capability: string; body: string }[]>`
    SELECT required_capability, body FROM notifications
    WHERE entity_id = ${created.id} AND kind = 'price_rule_approved'`;
  assert.equal(notice.required_capability, "prices:apply");
  assert.match(notice.body, /NIJE potvrđen/);
});

test("kancelarija evidentira primenu i tek tada je confirmed", async (t) => {
  if (guard(t)) return;
  const { transitionPriceRule } = await import("@/lib/pricing/rule-service");
  const created = await freshProposal();

  await transitionPriceRule(
    { ruleId: created.id, to: "approved_pending_biznisoft" },
    asPortalUser(fixture.owner, []),
  );
  await transitionPriceRule(
    {
      ruleId: created.id,
      to: "confirmed",
      confirmationNote: "Upisano u BizniSoft 15.06.",
    },
    asPortalUser(fixture.office, ["cene_primena"]),
  );

  const [rule] = await db.sql<
    { status: string; confirmed_by: string; confirmation_note: string }[]
  >`SELECT status, confirmed_by, confirmation_note FROM price_rules WHERE id = ${created.id}`;
  assert.equal(rule.status, "confirmed");
  assert.equal(rule.confirmed_by, fixture.office.id);
  assert.match(rule.confirmation_note, /BizniSoft/);
});

test("komercijalista ne moze ni odobriti ni potvrditi", async (t) => {
  if (guard(t)) return;
  const { transitionPriceRule } = await import("@/lib/pricing/rule-service");
  const created = await freshProposal();

  await assert.rejects(
    () =>
      transitionPriceRule(
        { ruleId: created.id, to: "approved_pending_biznisoft" },
        asPortalUser(fixture.rep, ["cene_predlog"]),
      ),
    /prices:approve/,
  );

  const [rule] = await db.sql<{ status: string }[]>`
    SELECT status FROM price_rules WHERE id = ${created.id}`;
  assert.equal(rule.status, "pending_approval", "stanje se promenilo uprkos odbijanju");
});

test("odbijanje trazi razlog i belezi ga", async (t) => {
  if (guard(t)) return;
  const { transitionPriceRule } = await import("@/lib/pricing/rule-service");
  const created = await freshProposal();

  await assert.rejects(
    () =>
      transitionPriceRule(
        { ruleId: created.id, to: "rejected" },
        asPortalUser(fixture.owner, []),
      ),
    /razlog/,
  );

  await transitionPriceRule(
    { ruleId: created.id, to: "rejected", reason: "Rabat prelazi dogovoreni okvir" },
    asPortalUser(fixture.owner, []),
  );

  const [rule] = await db.sql<{ status: string; decision_reason: string }[]>`
    SELECT status, decision_reason FROM price_rules WHERE id = ${created.id}`;
  assert.equal(rule.status, "rejected");
  assert.match(rule.decision_reason, /dogovoreni okvir/);
});

test("reconciliation_failed salje kriticno obavestenje gazdi", async (t) => {
  if (guard(t)) return;
  const { transitionPriceRule } = await import("@/lib/pricing/rule-service");
  const created = await freshProposal();

  await transitionPriceRule(
    { ruleId: created.id, to: "approved_pending_biznisoft" },
    asPortalUser(fixture.owner, []),
  );
  await transitionPriceRule(
    {
      ruleId: created.id,
      to: "reconciliation_failed",
      reason: "Uslov nije pronadjen u BizniSoftu ni posle 5 dana",
    },
    asPortalUser(fixture.office, ["cene_primena"]),
  );

  const [notice] = await db.sql<{ severity: string; required_capability: string }[]>`
    SELECT severity, required_capability FROM notifications
    WHERE entity_id = ${created.id} AND kind = 'price_rule_reconciliation_failed'`;
  assert.equal(notice.severity, "critical");
  assert.equal(notice.required_capability, "prices:approve");
});

/* -------------------------------------------------------------------------
 * Audit je append-only
 * ---------------------------------------------------------------------- */

test("audit zapis o ceni se ne moze izmeniti ni obrisati", async (t) => {
  if (guard(t)) return;
  const created = await freshProposal();

  const [entry] = await db.sql<{ id: number }[]>`
    SELECT id FROM audit_log WHERE entity_id = ${created.id} LIMIT 1`;

  await assert.rejects(
    () => db.sql`UPDATE audit_log SET reason = 'prepravljeno' WHERE id = ${entry.id}`,
    /append|restrict|izmen/i,
  );
  await assert.rejects(
    () => db.sql`DELETE FROM audit_log WHERE id = ${entry.id}`,
    /append|restrict|bris/i,
  );
});

test("svaki prelaz ostavlja svoj zapis, i stari ostaju netaknuti", async (t) => {
  if (guard(t)) return;
  const { transitionPriceRule } = await import("@/lib/pricing/rule-service");
  const created = await freshProposal();

  await transitionPriceRule(
    { ruleId: created.id, to: "approved_pending_biznisoft" },
    asPortalUser(fixture.owner, []),
  );
  await transitionPriceRule(
    { ruleId: created.id, to: "confirmed", confirmationNote: "upisano" },
    asPortalUser(fixture.office, ["cene_primena"]),
  );

  const entries = await db.sql<{ action: string; value_after: { status: string } }[]>`
    SELECT action, value_after FROM audit_log
    WHERE entity_id = ${created.id} ORDER BY id`;

  assert.equal(entries.length, 3, "nedostaje zapis o nekom prelazu");
  assert.deepEqual(
    entries.map((row) => row.value_after.status),
    ["pending_approval", "approved_pending_biznisoft", "confirmed"],
  );
});

/* -------------------------------------------------------------------------
 * Obaveštenja
 * ---------------------------------------------------------------------- */

test("obavestenje vidi samo onaj ko ima odgovarajucu sposobnost", async (t) => {
  if (guard(t)) return;
  const { listNotificationsFor } = await import(
    "@/lib/notifications/notification-service"
  );
  const created = await freshProposal();

  const zaGazdu = await listNotificationsFor(asPortalUser(fixture.owner, []));
  assert.ok(
    zaGazdu.some((row) => row.entityId === created.id),
    "gazda ne vidi predlog koji ceka njegovu odluku",
  );

  const zaMagacionera = await listNotificationsFor({
    ...asPortalUser(fixture.office, []),
    role: "magacioner",
  });
  assert.equal(
    zaMagacionera.filter((row) => row.entityId === created.id).length,
    0,
    "magacioner vidi obavestenje o ceni",
  );
});

test("tudje obavestenje se ne moze zatvoriti pogadjanjem ID-a", async (t) => {
  if (guard(t)) return;
  const { markNotificationRead, resolveNotification } = await import(
    "@/lib/notifications/notification-service"
  );
  const created = await freshProposal();

  const [notice] = await db.sql<{ id: number }[]>`
    SELECT id FROM notifications WHERE entity_id = ${created.id}`;

  const magacioner = { ...asPortalUser(fixture.office, []), role: "magacioner" as const };
  assert.equal(await markNotificationRead(magacioner, notice.id), false);
  assert.equal(await resolveNotification(magacioner, notice.id, "zatvaram"), false);

  const [row] = await db.sql<{ status: string }[]>`
    SELECT status FROM notifications WHERE id = ${notice.id}`;
  assert.equal(row.status, "unread");
});

test("zatvaranje trazi napomenu i belezi potpis", async (t) => {
  if (guard(t)) return;
  const { resolveNotification } = await import(
    "@/lib/notifications/notification-service"
  );
  const created = await freshProposal();
  const [notice] = await db.sql<{ id: number }[]>`
    SELECT id FROM notifications WHERE entity_id = ${created.id}`;

  const owner = asPortalUser(fixture.owner, []);
  await assert.rejects(
    () => resolveNotification(owner, notice.id, "x"),
    /napomenu/,
  );

  assert.equal(await resolveNotification(owner, notice.id, "Razmotreno na sastanku"), true);
  const [row] = await db.sql<
    { status: string; resolved_by: string; resolution_note: string }[]
  >`SELECT status, resolved_by, resolution_note FROM notifications WHERE id = ${notice.id}`;
  assert.equal(row.status, "resolved");
  assert.equal(row.resolved_by, fixture.owner.id);
  assert.match(row.resolution_note, /sastanku/);
});

test("obavestenje ne sme nositi PIB ni druge osetljive vrednosti", async (t) => {
  if (guard(t)) return;
  const { notify } = await import("@/lib/notifications/notification-service");

  for (const key of ["pib", "PIB", "adresa", "email", "token"]) {
    await assert.rejects(
      () =>
        notify({
          kind: "price_rule_proposed",
          requiredCapability: "prices:approve",
          title: "t",
          body: "b",
          entityType: "Pravilo cene",
          context: { [key]: "vrednost" },
        }),
      /ne sme nositi polje/,
      key,
    );
  }
});

test("zatvoreno obavestenje bez napomene se ne moze upisati ni direktno", async (t) => {
  if (guard(t)) return;
  await assert.rejects(
    () => db.sql`
      INSERT INTO notifications (kind, required_capability, title, body, entity_type, status)
      VALUES ('price_rule_proposed', 'prices:approve', 't', 'b', 'Pravilo cene', 'resolved')`,
    /notifications_resolved_ck/,
  );
});
