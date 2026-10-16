import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Uvoz VP cenovnika iz tabele (0057):
 *  - kancelarija (Tamara) i gazda uvoze; kolone i jedinica cene se biraju; povezivanje samo po šifri;
 *  - cena po pakovanju se deli potvrđenom količinom; artikal bez potvrđenog pakovanja ide u neispravne;
 *  - nov artikal: JM, pakovanje, preračun i podrazumevani rabat 30 % za obe opcije;
 *  - izričita veza šifre važi i za sledeći uvoz; rabati kupaca se ne menjaju, cene se preračunavaju.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 5).toUpperCase();
const code = (c: string) => `T${RUN}${c}`;
let db: TestDatabase;
const ids: Record<string, string> = {};
const art: Record<string, string> = {};
let customerId = "";

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "tamara", role: "kancelarija" }, { key: "rep", role: "komercijalista" }]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  for (const [k, name, qty] of [["LAK5", "QA LAK SJAJNI 5L", 5], ["CRNA", "QA BAZNA CRNA 1L", 1], ["BEZPAK", "QA PUNILAC 3L", null], ["STARI", "QA STARI DISK P400", 100]] as const) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit) VALUES (${code(k)}, ${name}, 'l') RETURNING id`;
    art[k] = a.id;
    await db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by) VALUES (${a.id}, '2190.00', '20', '2026-01-01', 'rucno', 'QA osnovna', ${ids.owner})`;
    if (qty) await db.sql`INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by) VALUES (${a.id}, ${qty}, 'l', 'QA pakovanje', 'QA', ${ids.owner})`;
  }
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`T${RUN}K`}, ${`QA UVOZ ${RUN}`}) RETURNING id`;
  customerId = c.id;
  const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const s = { customerScope: "customer", customerId, productScope: "all", paymentCondition: null };
  await db.sql`INSERT INTO price_rules (customer_scope, customer_id, product_scope, precedence_level, scope_key, value_kind, discount_percent, effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required)
               VALUES ('customer', ${customerId}, 'all', ${precedenceLevelFor(s)}, ${scopeKeyFor(s)}, 'discount_percent', 18, '2026-01-01', 'approved_pending_biznisoft', 'QA', ${ids.owner}, now(), ${ids.owner}, now(), false)`;
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM price_rules WHERE customer_id = ${customerId}`;
    await db.sql`DELETE FROM customers WHERE id = ${customerId}`;
    await db.sql`TRUNCATE article_new_defaults, article_code_aliases, article_base_prices, price_list_import_rows, price_list_imports`;
    await db.sql`DELETE FROM article_pack_sizes WHERE article_id IN (SELECT id FROM articles WHERE code LIKE ${`T${RUN}%`})`;
    await db.sql`DELETE FROM audit_log WHERE entity_type = 'Artikal' AND entity_label LIKE ${`T${RUN}%`}`.catch(() => undefined);
    await db.sql`DELETE FROM articles WHERE code LIKE ${`T${RUN}%`}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const user = async (k: string) => (await (await import("@/lib/authz/user-repository")).loadPortalUser(ids[k]))!;
const csv = (lines: string[]) => new TextEncoder().encode(lines.join("\n"));

test("tabela po pakovanju: preračun, neispravni redovi, nov artikal 30 %, veza šifre; rabati isti", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/pricing/price-list-service");
  const map = { header: true, code: 0, price: 2, name: 1, unit: null, pack: null };
  const file = csv([
    "Sifra;Naziv;VP pak.",
    `${code("LAK5")};Lak sjajni 5L;11.450,00`,
    `${code("CRNA")};Bazna crna 1L;4.473,00`,
    `${code("BEZPAK")};Punilac 3L;10.158,00`,
    `${code("NOVI")};Bazna plava perla 0,5L;3.480,00`,
    `${code("ALIAS")};Disk P400 novi kod;4.000,00`,
    `${code("LOSE")};Folija;12a`,
  ]);
  await assert.rejects(async () => svc.prepareTablePriceList(await user("rep"), { fileName: "c.csv", bytes: file, map, priceUnit: "pak" }), (e: { code?: string }) => e.code === "forbidden");
  const up = await svc.prepareTablePriceList(await user("tamara"), { fileName: "cenovnik.csv", bytes: file, map, priceUnit: "pak" });
  const review = (await svc.loadPriceListReview(await user("tamara"), up.importId))!;
  const by = new Map(review.rows.map((r) => [r.code, r]));
  assert.equal(by.get(code("LAK5"))!.vpPriceCents, 229000, "11.450,00 ÷ 5 l");
  assert.equal(by.get(code("CRNA"))!.vpPriceCents, 447300);
  assert.equal(by.get(code("NOVI"))!.status, "nepovezano");
  assert.equal(by.has(code("BEZPAK")), false, "bez potvrđenog pakovanja — neispravan red");
  const problems = review.import.problems as { code: string; reason: string }[];
  assert.deepEqual(problems.map((p) => p.code).sort(), [code("BEZPAK"), code("LOSE")].sort());

  const before = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM price_rules WHERE customer_id = ${customerId}`;
  const r = await svc.applyPriceList(await user("tamara"), {
    importId: up.importId,
    validFrom: new Date().toISOString().slice(0, 10),
    confirmedUnclearCodes: [code("CRNA")],
    newArticles: [
      { code: code("NOVI"), mode: "novi", name: "QA Bazna boja vodena, plava perla", unit: "l", packLabel: "limenka 0,5 l", packQuantity: "0,5" },
      { code: code("ALIAS"), mode: "povezi", articleCode: code("STARI") },
    ],
  });
  assert.equal(r.created, 1);
  assert.equal(r.linked, 1);
  const [nov] = await db.sql<{ id: string; unit: string }[]>`SELECT id, unit FROM articles WHERE code = ${code("NOVI")}`;
  const [bp] = await db.sql<{ p: string }[]>`SELECT net_price::text AS p FROM article_base_prices WHERE article_id = ${nov.id}`;
  assert.equal(bp.p, "6960.00", "3.480,00 ÷ 0,5 l");
  const [def] = await db.sql<{ d: string }[]>`SELECT discount_percent::text AS d FROM article_new_defaults WHERE article_id = ${nov.id}`;
  assert.equal(Number(def.d), 30);
  const [alias] = await db.sql<{ p: string }[]>`SELECT net_price::text AS p FROM article_base_prices WHERE article_id = ${art.STARI} AND import_id = ${up.importId}`;
  assert.equal(alias.p, "40.00", "4.000,00 ÷ 100 kom (povezani artikal)");
  const after = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM price_rules WHERE customer_id = ${customerId}`;
  assert.equal(after[0].n, before[0].n, "uvoz ne menja nijedno pravilo rabata");

  // Kupac sa osnovnim rabatom 18 %: nov artikal dobija 30 %, postojeći 18 % na novu VP.
  const { customerPricesByOption } = await import("@/lib/pricing/customer-price-service");
  const prices = (await customerPricesByOption(customerId, [nov.id, art.LAK5], new Date().toISOString().slice(0, 10))).options[0].prices;
  const pn = prices.get(nov.id)!;
  const pl = prices.get(art.LAK5)!;
  assert.deepEqual(pn.status === "cena" ? [pn.discountPercent, pn.netCents] : null, [30, 487200]);
  assert.deepEqual(pl.status === "cena" ? [pl.discountPercent, pl.netCents] : null, [18, 187780], "2.290,00 × 0,82");

  // Sledeći uvoz: veza šifre se pamti.
  const next = await svc.prepareTablePriceList(await user("owner"), { fileName: "cenovnik-2.csv", bytes: csv(["Sifra;Naziv;VP", `${code("ALIAS")};Disk P400;4.200,00`]), map, priceUnit: "pak" });
  const rv = (await svc.loadPriceListReview(await user("owner"), next.importId))!;
  assert.equal(rv.rows[0].articleId, art.STARI);
  assert.equal(rv.rows[0].vpPriceCents, 4200);
});

test("tabela po JM: bez preračuna; isti fajl i isti izbor ne pravi duplikat", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/pricing/price-list-service");
  const bytes = csv(["Sifra,Cena", `${code("CRNA")},4500.00`]);
  const map = { header: true, code: 0, price: 1, name: null, unit: null, pack: null };
  const a = await svc.prepareTablePriceList(await user("owner"), { fileName: "jm.csv", bytes, map, priceUnit: "jm" });
  const b = await svc.prepareTablePriceList(await user("owner"), { fileName: "jm.csv", bytes, map, priceUnit: "jm" });
  assert.equal(b.duplicate, true);
  assert.equal(a.importId, b.importId);
  const rv = (await svc.loadPriceListReview(await user("owner"), a.importId))!;
  assert.equal(rv.rows[0].vpPriceCents, 450000);
  await assert.rejects(async () => svc.prepareTablePriceList(await user("owner"), { fileName: "x.csv", bytes, map, priceUnit: "kom" as never }), /po JM ili po pakovanju/);
});
