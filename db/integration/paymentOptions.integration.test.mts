import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * 0043 — odobrene opcije plaćanja i rabati po opciji:
 *  - opcija: predlog komercijaliste (samo svoj kupac) → odluka vlasnika; kancelarija ne predlaže; jedan aktivan po opciji;
 *  - BASLAC 44 % uz avans, 38 % osnovno (odloženo 30); CS ostaje na svom rabatu u obe opcije (44 % se ne prenosi);
 *  - pojedinačni dogovor artikla bez uslova + grupno pravilo opcije → za pregled (na upit), ne bira se tiho;
 *  - kupac bez odobrene opcije: jedna cena po osnovnom uslovu.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const code = (c: string) => `QO-${RUN}-${c}`;
let db: TestDatabase;
const ids: Record<string, string> = {};
let customerId: string;
let otherId: string;
const art: Record<string, string> = {};
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());

async function rule(scope: { productScope: "article" | "brand" | "all"; articleId?: string; brand?: string }, pct: number, cond: string | null = null) {
  const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const s = { customerScope: "customer", customerId, ...scope, paymentCondition: cond };
  await db.sql`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, brand, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required, payment_condition)
    VALUES ('customer', ${customerId}, ${scope.productScope}, ${scope.articleId ?? null}, ${scope.brand ?? null}, ${precedenceLevelFor(s)}, ${scopeKeyFor(s)},
            'discount_percent', ${pct}, '2026-01-01', 'approved_pending_biznisoft', 'QA', ${ids.owner}, now(), ${ids.owner}, now(), false, ${cond})`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "rep", role: "komercijalista" }, { key: "other", role: "komercijalista" }, { key: "tamara", role: "kancelarija" }]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  for (const k of ["rep", "other"]) await db.sql`INSERT INTO user_permissions (user_id, permission_key, granted_by, reason) VALUES (${ids[k]}, 'cene_predlog', ${ids.owner}, 'QA')`;
  const [c1, c2] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QO${RUN}a`}, ${`QA OPCIJE ${RUN}`}), (${`QO${RUN}b`}, ${`QA BEZ OPCIJA ${RUN}`}) RETURNING id`;
  customerId = c1.id;
  otherId = c2.id;
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${customerId}, ${ids.rep})`;
  for (const [k, name, brand] of [["B1", "BASLAC 35-M218 1L", "BASLAC"], ["B2", "BASLAC 35-M302 1L", "BASLAC"], ["BX", "BASLAC 2K LAK 5L", "BASLAC"], ["C1", "CS GIT MULTI 1KG", "CS"]] as const) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit, brand) VALUES (${code(k)}, ${name}, 'LIT', ${brand}) RETURNING id`;
    art[k] = a.id;
    await db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by)
                 VALUES (${a.id}, '1000.00', '20', '2026-01-01', 'rucno', 'QA osnovna', ${ids.owner})`;
  }
  await rule({ productScope: "brand", brand: "BASLAC" }, 38);
  await rule({ productScope: "brand", brand: "BASLAC" }, 44, "avans");
  await rule({ productScope: "article", articleId: art.C1 }, 40);
  await rule({ productScope: "article", articleId: art.BX }, 41); // pojedinačni dogovor bez uslova
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM price_rules WHERE customer_id IN (${customerId}, ${otherId})`;
    await db.sql`TRUNCATE customer_payment_options, article_base_prices`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id IN (${customerId}, ${otherId})`;
    await db.sql`DELETE FROM customers WHERE id IN (${customerId}, ${otherId})`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QO-${RUN}-%`}`;
    await db.sql`DELETE FROM user_permissions WHERE user_id IN (${ids.rep}, ${ids.other})`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const user = async (k: string) => (await (await import("@/lib/authz/user-repository")).loadPortalUser(ids[k]))!;

test("opcije: predlog samo za svog kupca, kancelarija ne predlaže, odobrava vlasnik, jedan aktivan po opciji", async (t) => {
  if (guard(t)) return;
  const { proposePaymentOption, decidePaymentOption, approvedPaymentOptions } = await import("@/lib/pricing/payment-option-service");
  await assert.rejects(async () => proposePaymentOption(await user("other"), { customerId, optionCode: "avans", effectiveFrom: TODAY, reason: "tuđi kupac" }), /opsegu/);
  await assert.rejects(async () => proposePaymentOption(await user("tamara"), { customerId, optionCode: "avans", effectiveFrom: TODAY, reason: "kancelarija" }), /pravo/);
  const a = await proposePaymentOption(await user("rep"), { customerId, optionCode: "avans", effectiveFrom: TODAY, reason: "dogovor: avans" });
  await assert.rejects(async () => proposePaymentOption(await user("rep"), { customerId, optionCode: "avans", effectiveFrom: TODAY, reason: "ponovo" }), /čeka odluku/);
  await assert.rejects(async () => decidePaymentOption(await user("rep"), { id: a.id, to: "odobreno", reason: null }), /vlasnik/);
  assert.deepEqual(await approvedPaymentOptions(customerId, TODAY), [], "predlog ne važi pre odobrenja");
  await decidePaymentOption(await user("owner"), { id: a.id, to: "odobreno", reason: null });
  const b = await proposePaymentOption(await user("rep"), { customerId, optionCode: "odlozeno_30", effectiveFrom: TODAY, reason: "standard 30 dana" });
  await decidePaymentOption(await user("owner"), { id: b.id, to: "odobreno", reason: null });
  assert.deepEqual(await approvedPaymentOptions(customerId, TODAY), ["odlozeno_30", "avans"]);
  await assert.rejects(async () => proposePaymentOption(await user("rep"), { customerId, optionCode: "avans", effectiveFrom: TODAY, reason: "već odobreno" }), /već odobreno/);
  await assert.rejects(() => db.sql`DELETE FROM customer_payment_options WHERE customer_id = ${customerId}`, /ne briše/);
});

test("dve cene: BASLAC 44 % avans / 38 % na 30 dana; CS ostaje 40 % u obe; pojedinačni dogovor bez uslova → avans na pregled", async (t) => {
  if (guard(t)) return;
  const { customerPricesByOption } = await import("@/lib/pricing/customer-price-service");
  const r = await customerPricesByOption(customerId, [art.B1, art.C1, art.BX], TODAY);
  const byCode = new Map(r.options.map((o) => [o.code, o]));
  const pct = (code: string, a: string) => {
    const p = byCode.get(code)!.prices.get(a)!;
    return p.status === "cena" ? p.discountPercent : (p as { reason: string }).reason;
  };
  assert.deepEqual(r.options.map((o) => o.label), ["Odloženo plaćanje — 30 dana", "Avansno plaćanje"]);
  assert.equal(pct("avans", art.B1), 44);
  assert.equal(pct("odlozeno_30", art.B1), 38);
  assert.equal(pct("avans", art.C1), 40, "44 % se ne prenosi na druge brendove");
  assert.equal(pct("odlozeno_30", art.C1), 40);
  assert.equal(pct("odlozeno_30", art.BX), 41, "pojedinačni dogovor važi bez opcije/osnovno");
  assert.equal(pct("avans", art.BX), "izuzetak_za_pregled", "ne bira se tiho između dogovora i grupnog avansa");
  const b1 = byCode.get("avans")!.prices.get(art.B1)!;
  assert.equal(b1.status === "cena" ? b1.netCents : null, 56000, "1.000,00 − 44 % = 560,00 bez PDV-a");
  const other = await customerPricesByOption(otherId, [art.B1], TODAY);
  assert.deepEqual(other.options.map((o) => o.code), [null], "kupac bez odobrene opcije: jedna (osnovna) cena");
});

test("pravila artikla jednaka grupnom se zatvaraju (istorija ostaje); drugačiji dogovor ostaje za pregled", async (t) => {
  if (guard(t)) return;
  const { closeRedundantArticleRules } = await import("@/lib/pricing/rebate-change-service");
  await rule({ productScope: "article", articleId: art.B2 }, 38);
  const yesterday = new Date(Date.parse(`${TODAY}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  await db.sql`UPDATE price_rules SET effective_from = '2026-01-01' WHERE customer_id = ${customerId}`;
  const r = await closeRedundantArticleRules(await user("owner"), { customerId, brand: "BASLAC", percent: 38, closeAfter: yesterday, reason: "zamenjeno grupnim BASLAC 38 %" });
  assert.equal(r.closed, 1);
  assert.deepEqual(r.review.map((x) => x.percent), [41], "dogovor 41 % ostaje i ide na pregled");
  const [{ t: to }] = await db.sql<{ t: string }[]>`SELECT effective_to::text AS t FROM price_rules WHERE article_id = ${art.B2} AND customer_id = ${customerId}`;
  assert.equal(to, yesterday);
  await assert.rejects(async () => closeRedundantArticleRules(await user("rep"), { customerId, brand: "BASLAC", percent: 38, closeAfter: yesterday, reason: "bez prava" }), /vlasnik/);
});
