import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Tabela rabata kupca (2026-11-09):
 *  - svi artikli u ponudi (i oni koje kupac ne uzima), važeći rabat i neto cena iz istog računa kao kupac;
 *  - neto cena → rabat koji na fakturi daje tačno tu cenu (upisuje se kao pravilo artikla);
 *  - grupa menja i artikle koje kupac ne uzima, a poseban dogovor ostaje;
 *  - komercijalista menja samo svog kupca; analitika = samo pregled; zastarelo stanje se odbija.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const code = (c: string) => `QT-${RUN}-${c}`;
let db: TestDatabase;
const ids: Record<string, string> = {};
let customerId: string;
let otherCustomerId: string;
const art: Record<string, string> = {};
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());
const plus = (d: string, k: number) => new Date(Date.parse(`${d}T00:00:00Z`) + k * 86400000).toISOString().slice(0, 10);

async function rule(articleKey: string, percent: number, from: string) {
  const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const scope = { customerScope: "customer", customerId, productScope: "article", articleId: art[articleKey] };
  await db.sql`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required)
    VALUES ('customer', ${customerId}, 'article', ${art[articleKey]}, ${precedenceLevelFor(scope)}, ${scopeKeyFor(scope)}, 'discount_percent', ${percent},
            ${from}, 'approved_pending_biznisoft', 'QA dogovor', ${ids.owner}, now(), ${ids.owner}, now(), false)`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "milan", role: "komercijalista" },
    { key: "miroslav", role: "komercijalista" },
  ]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  await db.sql`INSERT INTO user_permissions (user_id, permission_key, granted_by, reason) VALUES (${ids.miroslav}, 'analitika', ${ids.owner}, 'QA')`;
  const [c1, c2] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QT${RUN}a`}, ${`QA TABELA ${RUN}`}), (${`QT${RUN}b`}, ${`QA TUĐI ${RUN}`}) RETURNING id`;
  customerId = c1.id;
  otherCustomerId = c2.id;
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${customerId}, ${ids.milan})`;
  const names: Record<string, [string, string]> = {
    P400: ["CS P19 KRUŽNA ŠMIRGLA 150MM P400", "3150.00"],
    P320: ["CS P19 KRUŽNA ŠMIRGLA 150MM P320", "3150.00"],
    P800: ["CS P19 KRUŽNA ŠMIRGLA 150MM P800", "3150.00"],
    P120: ["CS P19 KRUŽNA ŠMIRGLA 150MM P120", "3150.00"],
    KLAR: ["BASLAC 2K KLAR HS 5L", "11800.00"],
  };
  for (const [k, [name, price]] of Object.entries(names)) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit) VALUES (${code(k)}, ${name}, 'KOM') RETURNING id`;
    art[k] = a.id;
    await db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by)
                 VALUES (${a.id}, ${price}, '20', '2026-01-01', 'rucno', 'QA osnovna', ${ids.owner})`;
  }
  // P19: osnov grupe 40 %; P120 je poseban dogovor 45 %; P800 kupac ne uzima i nema rabat (na upit).
  await rule("P400", 40, "2026-01-01");
  await rule("P320", 40, "2026-01-01");
  await rule("P120", 45, "2026-01-01");
  await rule("KLAR", 30, "2026-01-01");
});

after(async () => {
  if (!reason && db) {
    await db.sql`UPDATE price_rules SET replaces_rule_id = NULL WHERE customer_id IN (${customerId}, ${otherCustomerId})`;
    await db.sql`DELETE FROM price_rules WHERE customer_id IN (${customerId}, ${otherCustomerId})`;
    await db.sql`DELETE FROM notifications WHERE dedupe_key LIKE 'promene-cena:%'`;
    await db.sql`TRUNCATE article_base_prices`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id IN (${customerId}, ${otherCustomerId})`;
    await db.sql`DELETE FROM customers WHERE id IN (${customerId}, ${otherCustomerId})`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QT-${RUN}-%`}`;
    await db.sql`DELETE FROM user_permissions WHERE user_id IN (${ids.milan}, ${ids.miroslav})`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const user = async (k: string) => (await (await import("@/lib/authz/user-repository")).loadPortalUser(ids[k]))!;
const mine = async (k: string) => {
  const { loadRebateTable } = await import("@/lib/pricing/rebate-table-service");
  const t = await loadRebateTable(await user(k), customerId);
  return { ...t, by: new Map(t.rows.filter((r) => r.code.startsWith(`QT-${RUN}-`)).map((r) => [r.code.slice(-4).replace(/^-/, ""), r])) };
};

test("tabela: svi artikli u ponudi, grupa iz naziva, važeći rabat i neto cena kao kod kupca", async (t) => {
  if (guard(t)) return;
  const tb = await mine("milan");
  assert.equal(tb.canPropose, true);
  assert.equal(tb.canApprove, true);
  const p400 = tb.by.get("P400")!;
  assert.equal(p400.group, "CS P19");
  assert.equal(p400.brand, "CS");
  assert.equal(p400.currentPercent, 40);
  assert.equal(p400.netCents, 189000, "3.150,00 − 40 %");
  assert.equal(p400.source, "artikal");
  const p800 = tb.by.get("P800")!;
  assert.equal(p800.currentPercent, null, "bez pravila: na upit");
  assert.equal(p800.baseCents, 315000, "VP cena i za artikal na upit, da bi se neto mogla upisati");
  assert.equal(p800.buysNow, false);
});

test("čuvanje: neto cena + grupa (sa artiklom koji ne uzima), poseban dogovor ostaje", async (t) => {
  if (guard(t)) return;
  const { applyRebateTable } = await import("@/lib/pricing/rebate-table-service");
  const { planChanges } = await import("@/lib/pricing/rebateTable.mjs");
  const before = await mine("milan");
  const edits = { groups: { "CS P19": 42 }, nets: { [art.KLAR]: 700000 } };
  const plan = planChanges(before.rows, edits);
  const expected = Object.fromEntries(plan.items.map((i) => [i.articleId, i.replacesRuleId]));
  const r = await applyRebateTable(await user("milan"), {
    customerId, edits, effectiveFrom: TODAY, reason: "QA dogovor sa kupcem — tabela", approveNow: true, expected,
  });
  assert.equal(r.count, 4, "P400, P320, P800 (grupa) + KLAR (neto)");
  assert.equal(r.kept, 1, "P120 45 % ostaje");

  const after = await mine("milan");
  assert.equal(after.by.get("P400")!.currentPercent, 42);
  assert.equal(after.by.get("P800")!.currentPercent, 42, "artikal koji kupac ne uzima dobio je rabat grupe");
  assert.equal(after.by.get("P120")!.currentPercent, 45);
  const klar = after.by.get("KLAR")!;
  assert.equal(klar.currentPercent, 40.678, "rabat izračunat iz neto cene (3 decimale)");
  assert.equal(klar.netCents, 700000, "kupac vidi tačno upisanu neto cenu");

  const [old] = await db.sql<{ t: string | null }[]>`
    SELECT effective_to::text AS t FROM price_rules WHERE article_id = ${art.P400} AND discount_percent = 40 AND customer_id = ${customerId}`;
  assert.ok(old.t !== null, "staro pravilo je zatvoreno, nema sukoba");
  const [digest] = await db.sql<{ title: string }[]>`SELECT title FROM notifications WHERE dedupe_key LIKE 'promene-cena:%' ORDER BY id DESC LIMIT 1`;
  assert.match(digest.title, /QA milan/, "vlasnik dobija dnevni zbir");
});

test("zastarelo stanje i neispravan unos: ništa se ne upisuje", async (t) => {
  if (guard(t)) return;
  const { applyRebateTable } = await import("@/lib/pricing/rebate-table-service");
  const count = async () => Number((await db.sql<{ n: string }[]>`SELECT count(*)::text AS n FROM price_rules WHERE customer_id = ${customerId}`)[0].n);
  const n0 = await count();
  await assert.rejects(
    async () => applyRebateTable(await user("milan"), { customerId, edits: { articles: { [art.P400]: 43 } }, effectiveFrom: plus(TODAY, 2), reason: "QA zastarelo stanje", approveNow: true, expected: { [art.P400]: null } }),
    /Stanje se promenilo/,
  );
  await assert.rejects(
    async () => applyRebateTable(await user("milan"), { customerId, edits: { nets: { [art.P800]: 400000 } }, effectiveFrom: plus(TODAY, 2), reason: "QA neto veća od VP", approveNow: true, expected: {} }),
    /veća od VP/,
  );
  assert.equal(await count(), n0);
});

test("dozvole: analitika vidi tuđeg kupca samo za pregled; tuđi komercijalista ne menja", async (t) => {
  if (guard(t)) return;
  const { loadRebateTable, applyRebateTable } = await import("@/lib/pricing/rebate-table-service");
  const view = await loadRebateTable(await user("miroslav"), customerId);
  assert.equal(view.canPropose, false);
  await assert.rejects(
    async () => applyRebateTable(await user("miroslav"), { customerId, edits: { articles: { [art.P400]: 50 } }, effectiveFrom: plus(TODAY, 3), reason: "QA tuđi kupac", approveNow: true, expected: {} }),
    /ne možete da menjate/,
  );
  const { PricingScopeError } = await import("@/lib/pricing/pricing-scope");
  await assert.rejects(async () => loadRebateTable(await user("milan"), otherCustomerId), PricingScopeError);
});
