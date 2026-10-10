import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Promena rabata (0041):
 *  - zamena važećeg pravila: do odobrenja važi staro; posle odobrenja staro se zatvara dan pre novog, bez sukoba;
 *  - ponovljeno slanje za isti par se odbija;
 *  - dozvole: komercijalista samo svoje kupce, „analitika“ sve kupce, kancelarija ne predlaže, direktno odobrava samo gazda;
 *  - grupna promena ne gazi pojedinačni dogovor (izuzetak) osim izričito; zastareo pregled se odbija;
 *  - paket na čekanju gazda odobrava jednim potezom.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const ISSUER = `QC${RUN}`;
const code = (c: string) => `QC-${RUN}-${c}`;
let db: TestDatabase;
const ids: Record<string, string> = {};
let customerId: string;
let otherCustomerId: string;
const art: Record<string, string> = {};
let n = 0;
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());
const plus = (d: string, k: number) => new Date(Date.parse(`${d}T00:00:00Z`) + k * 86400000).toISOString().slice(0, 10);
const ago = (k: number) => plus(TODAY, -k);

async function invoice(day: string, items: [string, string][], customer = customerId) {
  n += 1;
  const number = `C${RUN}${n}`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${number}, 2026, ${day}, ${customer}, '1.00', '1.20', 'manual_upload') RETURNING id`;
  let ln = 0;
  for (const [k, discount] of items) {
    ln += 1;
    await db.sql`INSERT INTO invoice_lines (invoice_id, line_number, article_id, article_code, description, quantity, unit_price, discount_percent, line_amount)
                 VALUES (${inv.id}, ${ln}, ${art[k]}, ${code(k)}, ${k}, '1', '100.0000', ${discount}, '1.00')`;
  }
  await db.sql`
    INSERT INTO source_documents (file_hash, file_name, page_count, line_count, issuer_code, business_document_type,
      business_document_number, external_partner_code, document_date, parser_version, validation_status,
      revision_status, manual_review, origin, invoice_id)
    VALUES (${randomUUID().replace(/-/g, "")}, ${`${number}.pdf`}, 1, ${items.length}, ${ISSUER}, 'faktura', ${number},
            ${customer === customerId ? `P${RUN}` : `O${RUN}`}, ${day}, 'qa-1', 'valid', 'original', 'not_required', 'manual_upload', ${inv.id})`;
}

async function rule(articleKey: string, percent: number, from: string) {
  const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const scope = { customerScope: "customer", customerId, productScope: "article", articleId: art[articleKey] };
  await db.sql`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required)
    VALUES ('customer', ${customerId}, 'article', ${art[articleKey]}, ${precedenceLevelFor(scope)}, ${scopeKeyFor(scope)}, 'discount_percent', ${percent},
            ${from}, 'approved_pending_biznisoft', 'QA pojedinačni dogovor', ${ids.owner}, now(), ${ids.owner}, now(), false)`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "milan", role: "komercijalista" },
    { key: "miroslav", role: "komercijalista" },
    { key: "tamara", role: "kancelarija" },
  ]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  for (const k of ["milan", "miroslav"]) {
    await db.sql`INSERT INTO user_permissions (user_id, permission_key, granted_by, reason) VALUES (${ids[k]}, 'cene_predlog', ${ids.owner}, 'QA')`;
  }
  await db.sql`INSERT INTO user_permissions (user_id, permission_key, granted_by, reason) VALUES (${ids.miroslav}, 'analitika', ${ids.owner}, 'QA')`;
  const [c1, c2] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QC${RUN}a`}, ${`QA PROMENA ${RUN}`}), (${`QC${RUN}b`}, ${`QA TUĐI ${RUN}`}) RETURNING id`;
  customerId = c1.id;
  otherCustomerId = c2.id;
  await db.sql`INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
               VALUES ('biznisoft', ${ISSUER}, ${`P${RUN}`}, ${customerId}, 'mapped'), ('biznisoft', ${ISSUER}, ${`O${RUN}`}, ${otherCustomerId}, 'mapped')`;
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${customerId}, ${ids.milan})`;
  const names: Record<string, string> = { A: "CS GIT MULTI 1KG", B: "CS F19 KRUZNA P80", C: "CS 2K FILLER 1L", D: "CS RASPA 300", E: "CS PROFLEX PLUTO", X: "CS POSUDA PVC" };
  for (const [k, name] of Object.entries(names)) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit) VALUES (${code(k)}, ${name}, 'KOM') RETURNING id`;
    art[k] = a.id;
  }
  // Porodica CS 40 %; X ima pojedinačni dogovor 45 %, A ima pravilo 40 % (isto kao grupa).
  await invoice(ago(150), [["A", "40"], ["B", "40"], ["X", "45"]]);
  await invoice(ago(110), [["C", "40"], ["D", "40"]]);
  await invoice(ago(70), [["A", "40"], ["E", "40"], ["X", "45"]]);
  await invoice(ago(30), [["B", "40"], ["C", "40"]]);
  await invoice(ago(20), [["A", "40"]], otherCustomerId);
  await rule("A", 40, ago(100));
  await rule("X", 45, ago(100));
});

after(async () => {
  if (!reason && db) {
    await db.sql`UPDATE price_rules SET replaces_rule_id = NULL WHERE customer_id IN (${customerId}, ${otherCustomerId})`;
    await db.sql`DELETE FROM price_rules WHERE customer_id IN (${customerId}, ${otherCustomerId})`;
    await db.sql`DELETE FROM source_documents WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
    await db.sql`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id IN (${customerId}, ${otherCustomerId})`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE customer_id IN (${customerId}, ${otherCustomerId})`;
    await db.sql`DELETE FROM customers WHERE id IN (${customerId}, ${otherCustomerId})`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QC-${RUN}-%`}`;
    await db.sql`DELETE FROM user_permissions WHERE user_id IN (${ids.milan}, ${ids.miroslav})`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const user = async (k: string) => (await (await import("@/lib/authz/user-repository")).loadPortalUser(ids[k]))!;

test("dozvole: svoj kupac, analitika za sve, kancelarija ne predlaže, direktno odobrava samo gazda", async (t) => {
  if (guard(t)) return;
  const { previewRebateChange, submitRebateChange } = await import("@/lib/pricing/rebate-change-service");
  const input = { customerId: otherCustomerId, mode: "artikli" as const, articleIds: [art.A], newPercent: 41, effectiveFrom: plus(TODAY, 1) };
  await assert.rejects(async () => previewRebateChange(await user("milan"), input), /opsegu/);
  const p = await previewRebateChange(await user("miroslav"), input);
  assert.equal(p.rows[0].action, "novo");
  await assert.rejects(async () => submitRebateChange(await user("tamara"), { ...input, reason: "pokušaj kancelarije", expected: [{ articleId: art.A, replacesRuleId: null }] }), /pravo/);
  await assert.rejects(async () => submitRebateChange(await user("miroslav"), { ...input, reason: "direktno bez prava gazde", approveNow: true, expected: [{ articleId: art.A, replacesRuleId: null }] }), /vlasnik/);
});

test("zamena: predlog ne menja cenu; posle odobrenja staro pravilo se zatvara, bez sukoba; ponovljeno slanje se odbija", async (t) => {
  if (guard(t)) return;
  const { previewRebateChange, submitRebateChange } = await import("@/lib/pricing/rebate-change-service");
  const { transitionPriceRule } = await import("@/lib/pricing/rule-service");
  const { evaluatePricing } = await import("@/lib/pricing/precedence.mjs");
  const milan = await user("milan");
  const from = plus(TODAY, 2);
  const input = { customerId, mode: "artikli" as const, articleIds: [art.A], newPercent: 42, effectiveFrom: from };
  const p = await previewRebateChange(milan, input);
  assert.equal(p.rows[0].action, "zamena");
  assert.equal(p.rows[0].current?.percent, 40);
  const expected = [{ articleId: art.A, replacesRuleId: p.rows[0].current!.ruleId }];
  await submitRebateChange(milan, { ...input, reason: "dogovor sa kupcem — novi uslov", expected });
  // Ponovljeno slanje: već čeka predlog → pregled ga prikazuje kao „čeka odluku“, slanje se odbija.
  const again = await previewRebateChange(milan, input);
  assert.equal(again.rows[0].action, "ceka_odluku");
  await assert.rejects(() => submitRebateChange(milan, { ...input, reason: "dogovor sa kupcem — novi uslov", expected }), /promenilo|Nema artikala/);

  const rules = async () => db.sql<{ id: string; status: string; p: string; f: string; t: string | null; r: string | null }[]>`
    SELECT id, status::text AS status, discount_percent::text AS p, effective_from::text AS f, effective_to::text AS t, replaces_rule_id AS r
      FROM price_rules WHERE customer_id = ${customerId} AND article_id = ${art.A} ORDER BY created_at`;
  const before = await rules();
  assert.equal(before.length, 2);
  assert.equal(before[1].status, "pending_approval");
  assert.equal(before[0].t, null, "staro važi dok predlog čeka");
  await transitionPriceRule({ ruleId: before[1].id, to: "approved_pending_biznisoft", reason: "QA" }, await user("owner"));
  const afterR = await rules();
  assert.equal(afterR[0].t, plus(from, -1), "staro se zatvara dan pre novog");
  const asRules = afterR.map((r) => ({ id: r.id, customerScope: "customer", productScope: "article", customerId, articleId: art.A, valueKind: "discount_percent", discountPercent: r.p, effectiveFrom: r.f, effectiveTo: r.t, status: r.status }));
  const day = (d: string) => evaluatePricing(asRules, { customerId, customerGroupIds: [], articleId: art.A, onDate: d });
  assert.equal(Number(day(plus(from, -1)).winner?.discountPercent), 40);
  assert.equal(Number(day(from).winner?.discountPercent), 42);
  assert.equal(day(from).conflict.length, 0);
});

test("grupa: pojedinačni dogovor je izuzetak i ne menja se bez izričitog uključivanja; zastareo pregled se odbija; paket odobrava gazda", async (t) => {
  if (guard(t)) return;
  const { previewRebateChange, submitRebateChange, customerFamilies } = await import("@/lib/pricing/rebate-change-service");
  const { decidePendingBatch } = await import("@/lib/pricing/rebate-coverage-service");
  const milan = await user("milan");
  const fams = await customerFamilies(milan, customerId);
  const cs = fams.find((f) => f.key === "CS");
  assert.ok(cs, JSON.stringify(fams.map((f) => f.key)));
  assert.equal(cs!.percent, 40);
  const input = { customerId, mode: "grupa" as const, groupKey: "CS", newPercent: 43, effectiveFrom: plus(TODAY, 3) };
  const p = await previewRebateChange(milan, input);
  const row = (k: string) => p.rows.find((r) => r.articleId === art[k])!;
  assert.equal(row("X").action, "izuzetak");
  assert.equal(row("X").included, false);
  assert.equal(row("A").action, "izuzetak", "A ima zakazanu promenu iz prethodnog testa — ne menja se preko nje");
  assert.match(row("A").note ?? "", /zakazana/);
  assert.equal(row("B").action, "novo");
  // Zastareo pregled: korisnik šalje i X bez izričitog uključivanja → odbija se.
  const sent = p.rows.filter((r) => r.included).map((r) => ({ articleId: r.articleId, replacesRuleId: r.current?.ruleId ?? null }));
  await assert.rejects(() => submitRebateChange(milan, { ...input, reason: "grupni dogovor za CS program", expected: [...sent, { articleId: art.X, replacesRuleId: row("X").current!.ruleId }] }), /promenilo/);
  const ok = await submitRebateChange(milan, { ...input, reason: "grupni dogovor za CS program", expected: sent });
  const [{ k }] = await db.sql<{ k: number }[]>`SELECT count(*)::int AS k FROM price_rules WHERE customer_id = ${customerId} AND article_id = ${art.X}`;
  assert.equal(k, 1, "pojedinačni dogovor X ostaje netaknut");
  const r = await decidePendingBatch(await user("owner"), { batchId: ok.batchId, to: "approved_pending_biznisoft", reason: null });
  assert.equal(r.count, ok.count);
  const [{ s }] = await db.sql<{ s: string }[]>`SELECT string_agg(DISTINCT status::text, ',') AS s FROM price_rules WHERE source_batch = ${ok.batchId}`;
  assert.equal(s, "approved_pending_biznisoft");
  // Izričito uključen izuzetak se menja (zamena).
  const p2 = await previewRebateChange(milan, { ...input, effectiveFrom: plus(TODAY, 4), includeExceptions: [art.X] });
  const x2 = p2.rows.find((r) => r.articleId === art.X)!;
  assert.equal(x2.included, true);
  assert.match(x2.note ?? "", /IZRIČITO/);
});
