import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Cene po kupcu (0057) — dogovorena pravila:
 *  - pamti se rabat; unos cene samo izračunava rabat (cena se ne čuva);
 *  - avans i odloženo imaju odvojene rabate;
 *  - komercijalista uređuje samo svoje kupce, gazda sve; kancelarija i magacioner samo pregled;
 *  - promena VP cene ne menja rabat, cena se preračunava;
 *  - akcija važi u periodu; posle isteka vraća se sačuvani redovni rabat na tada važeću VP cenu;
 *    preklapanje akcija se ne čuva bez izričite zamene; zamena skraćuje staru akciju;
 *  - nov artikal: 30 % za obe opcije, bez prepisivanja izričitog dogovora za artikal;
 *  - izmena komercijaliste → obaveštenje gazdi; gazdina → dodeljenom komercijalisti; bez dodele → nikome;
 *    obaveštenja se brišu posle 10 dana, pravila ostaju; pravila ne traže unos u BizniSoft.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const code = (c: string) => `QR-${RUN}-${c}`;
let db: TestDatabase;
const ids: Record<string, string> = {};
const cust: Record<string, string> = {};
const art: Record<string, string> = {};
let TODAY = "";
let plus = (n: number) => String(n);

async function addRule(customerId: string, scope: { productScope: "article" | "all"; articleId?: string }, pct: number, cond: string | null, from = "2026-01-01") {
  const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
  const s = { customerScope: "customer", customerId, ...scope, paymentCondition: cond };
  await db.sql`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required, payment_condition)
    VALUES ('customer', ${customerId}, ${scope.productScope}, ${scope.articleId ?? null}, ${precedenceLevelFor(s)}, ${scopeKeyFor(s)},
            'discount_percent', ${pct}, ${from}, 'approved_pending_biznisoft', 'QA', ${ids.owner}, now(), ${ids.owner}, now(), false, ${cond})`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const { todayBelgrade } = await import("@/lib/pricing/customer-rebate-service");
  const { addDays } = await import("@/lib/pricing/rebateSheet.mjs");
  TODAY = todayBelgrade();
  plus = (n: number) => addDays(TODAY, n);
  const acc = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "owner2", role: "gazda" },
    { key: "rep", role: "komercijalista" },
    { key: "other", role: "komercijalista" },
    { key: "tamara", role: "kancelarija" },
    { key: "mag", role: "magacioner" },
  ]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  const rows = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name, city) VALUES (${`QR${RUN}a`}, ${`QA RABATI ${RUN}`}, 'Novi Sad'), (${`QR${RUN}b`}, ${`QA BEZ KOMERCIJALISTE ${RUN}`}, 'Zrenjanin')
    RETURNING id`;
  cust.a = rows[0].id;
  cust.b = rows[1].id;
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${cust.a}, ${ids.rep})`;
  for (const c of [cust.a, cust.b]) {
    for (const o of ["avans", "odlozeno_30"]) {
      await db.sql`INSERT INTO customer_payment_options (customer_id, option_code, status, effective_from, reason, proposed_by, decided_by, decided_at)
                   VALUES (${c}, ${o}, 'odobreno', '2026-01-01', 'QA dogovor opcije', ${ids.owner}, ${ids.owner}, now())`;
    }
  }
  for (const [k, name] of [["LAK", "QA LAK 1L"], ["TRAKA", "QA TRAKA"], ["NOV", "QA NOVI ARTIKAL"], ["NOVX", "QA NOVI SA DOGOVOROM"], ["BEZVP", "QA BEZ VP"]] as const) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit) VALUES (${code(k)}, ${name}, 'l') RETURNING id`;
    art[k] = a.id;
  }
  const bp = async (a: string, price: string, from: string) =>
    db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by)
           VALUES (${a}, ${price}, '20', ${from}, 'rucno', 'QA osnovna', ${ids.owner})`;
  await bp(art.LAK, "2360.00", "2026-01-01");
  await bp(art.LAK, "2466.00", plus(15));
  await bp(art.TRAKA, "236.00", "2026-01-01");
  await bp(art.TRAKA, "247.00", plus(15));
  await bp(art.NOV, "6960.00", "2026-01-01");
  await bp(art.NOVX, "1000.00", "2026-01-01");
  // BEZVP: nema VP cene u cenovniku (osnovna cena 0 baza ne prima), ali ima dogovor kupca.
  for (const c of [cust.a, cust.b]) {
    await addRule(c, { productScope: "all" }, 18, "odlozeno_30");
    await addRule(c, { productScope: "all" }, 23, "avans");
  }
  await addRule(cust.a, { productScope: "article", articleId: art.TRAKA }, 24, "odlozeno_30");
  await addRule(cust.a, { productScope: "article", articleId: art.NOVX }, 27, "avans");
  await addRule(cust.a, { productScope: "article", articleId: art.BEZVP }, 20, "odlozeno_30");
  await db.sql`INSERT INTO article_new_defaults (article_id, created_by) VALUES (${art.NOV}, ${ids.owner}), (${art.NOVX}, ${ids.owner})`;
});

after(async () => {
  if (!reason && db) {
    const cs = [cust.a, cust.b];
    await db.sql`DELETE FROM rebate_change_notices WHERE customer_id IN ${db.sql(cs)}`;
    await db.sql`DELETE FROM price_rules WHERE customer_id IN ${db.sql(cs)}`;
    await db.sql`TRUNCATE customer_payment_options, article_base_prices, article_new_defaults`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id IN ${db.sql(cs)}`;
    await db.sql`DELETE FROM customers WHERE id IN ${db.sql(cs)}`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QR-${RUN}-%`}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const user = async (k: string) => (await (await import("@/lib/authz/user-repository")).loadPortalUser(ids[k]))!;
const svc = () => import("@/lib/pricing/customer-rebate-service");
const cell = (sheet: Awaited<ReturnType<Awaited<ReturnType<typeof svc>>["loadRebateSheet"]>>, a: string, option: string) => {
  const i = sheet.options.findIndex((o) => o.code === option);
  return sheet.rows.find((r) => r.articleId === a)!.cells[i];
};

test("pregled: odvojeni rabati i cene za odloženo i avans; ko šta vidi i sme", async (t) => {
  if (guard(t)) return;
  const { loadRebateSheet, canEditCustomer, listRebateCustomers } = await svc();
  const s = await loadRebateSheet(await user("tamara"), cust.a);
  assert.deepEqual(s.options.map((o) => [o.code, o.rabat]), [["odlozeno_30", 18], ["avans", 23]]);
  assert.equal(s.canEdit, false, "kancelarija samo pregled");
  assert.equal(cell(s, art.LAK, "odlozeno_30").priceCents, 193520);
  assert.equal(cell(s, art.LAK, "avans").priceCents, 181720);
  assert.equal(cell(s, art.TRAKA, "odlozeno_30").rabat, 24);
  assert.equal(cell(s, art.TRAKA, "odlozeno_30").articleAgreement, true);
  assert.equal(cell(s, art.BEZVP, "odlozeno_30").status, "na_upit", "bez VP: rabat postoji, cena ne");
  assert.equal(s.rows.find((r) => r.articleId === art.BEZVP)!.vpCents, null);
  assert.equal(await canEditCustomer(await user("rep"), cust.a), true);
  assert.equal(await canEditCustomer(await user("other"), cust.a), false, "tuđi kupac");
  assert.equal(await canEditCustomer(await user("owner"), cust.b), true);
  assert.equal(await canEditCustomer(await user("mag"), cust.a), false);
  assert.equal(await canEditCustomer(await user("tamara"), cust.a), false);
  assert.equal((await loadRebateSheet(await user("mag"), cust.a)).canEdit, false, "magacioner vidi, ne menja");
  await assert.rejects(async () => loadRebateSheet(await user("other"), cust.a), (e: { code?: string }) => e.code === "forbidden");
  const mine = await listRebateCustomers(await user("rep"), "");
  assert.ok(mine.rows.some((c) => c.id === cust.a) && !mine.rows.some((c) => c.id === cust.b), "komercijalista vidi samo svoje kupce");
});

test("server odbija izmenu tuđeg kupca, kancelarije i magacionera", async (t) => {
  if (guard(t)) return;
  const { saveRebateChanges } = await svc();
  const input = { customerId: cust.a, items: [{ articleId: art.LAK, option: "odlozeno_30", field: "r" as const, value: "25" }], period: { kind: "sada" as const }, replaceConfirmed: false };
  for (const k of ["other", "tamara", "mag"]) {
    await assert.rejects(async () => saveRebateChanges(await user(k), input), (e: { code?: string }) => e.code === "forbidden", k);
  }
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM price_rules WHERE customer_id = ${cust.a} AND source_batch LIKE 'cene-kupca-%'`;
  assert.equal(n, 0);
});

test("cena → rabat: čuva se izračunat rabat, ne cena; promena VP ne menja rabat", async (t) => {
  if (guard(t)) return;
  const { saveRebateChanges, loadRebateSheet } = await svc();
  const r = await saveRebateChanges(await user("rep"), {
    customerId: cust.a,
    items: [
      { articleId: art.LAK, option: "odlozeno_30", field: "c", value: "1.793,60" },
      { articleId: art.LAK, option: "avans", field: "r", value: "28" },
    ],
    period: { kind: "sada" },
    replaceConfirmed: false,
    note: "",
  });
  assert.equal(r.saved, 2);
  const rows = await db.sql<{ value_kind: string; discount_percent: string; net_price: string | null; biznisoft_entry_required: boolean; status: string; payment_condition: string }[]>`
    SELECT value_kind::text, discount_percent::text, net_price::text, biznisoft_entry_required, status::text, payment_condition FROM price_rules
     WHERE customer_id = ${cust.a} AND article_id = ${art.LAK} AND source_batch = ${r.batch} ORDER BY payment_condition`;
  assert.deepEqual(rows.map((x) => [x.payment_condition, x.value_kind, Number(x.discount_percent), x.net_price, x.biznisoft_entry_required]), [
    ["avans", "discount_percent", 28, null, false],
    ["odlozeno_30", "discount_percent", 24, null, false],
  ]);
  const s = await loadRebateSheet(await user("rep"), cust.a);
  assert.equal(cell(s, art.LAK, "odlozeno_30").priceCents, 179360);
  assert.equal(cell(s, art.LAK, "avans").priceCents, 169920);
  const vp = s.rows.find((x) => x.articleId === art.LAK)!.vpNext;
  assert.deepEqual(vp, { from: plus(15), cents: 246600 });
  // Isti rabat na novu VP (dan posle promene) — kroz isti obračun koji koristi korpa.
  const { customerPricesByOption } = await import("@/lib/pricing/customer-price-service");
  const later = await customerPricesByOption(cust.a, [art.LAK], plus(16));
  const odl = later.options.find((o) => o.code === "odlozeno_30")!.prices.get(art.LAK)!;
  assert.deepEqual(odl.status === "cena" ? [odl.discountPercent, odl.netCents] : null, [24, 187416], "2.466,00 × 0,76 = 1.874,16");
});

test("akcija: važi u periodu, redovni se pamti i vraća na novu VP; preklapanje traži izričitu zamenu", async (t) => {
  if (guard(t)) return;
  const { saveRebateChanges } = await svc();
  const { customerPricesByOption } = await import("@/lib/pricing/customer-price-service");
  const priceOn = async (day: string) => {
    const r = await customerPricesByOption(cust.a, [art.TRAKA], day);
    const p = r.options.find((o) => o.code === "odlozeno_30")!.prices.get(art.TRAKA)!;
    return p.status === "cena" ? [p.discountPercent, p.netCents] : p.status;
  };
  await saveRebateChanges(await user("owner"), {
    customerId: cust.a,
    items: [{ articleId: art.TRAKA, option: "odlozeno_30", field: "r", value: "29" }],
    period: { kind: "akcija", from: plus(1), to: plus(30) },
    replaceConfirmed: false,
  });
  assert.deepEqual(await priceOn(TODAY), [24, 17936]);
  assert.deepEqual(await priceOn(plus(10)), [29, 16756]);
  assert.deepEqual(await priceOn(plus(20)), [29, 17537], "akcija na novu VP 247,00");
  assert.deepEqual(await priceOn(plus(31)), [24, 18772], "posle isteka: redovni 24 % na novu VP");

  const overlap = { customerId: cust.a, items: [{ articleId: art.TRAKA, option: "odlozeno_30", field: "r" as const, value: "35" }], period: { kind: "akcija" as const, from: plus(10), to: plus(20) }, replaceConfirmed: false };
  await assert.rejects(async () => saveRebateChanges(await user("owner"), overlap), (e: { code?: string }) => e.code === "preklapanje");
  await saveRebateChanges(await user("owner"), { ...overlap, replaceConfirmed: true });
  assert.deepEqual(await priceOn(plus(5)), [29, 16756], "stara akcija skraćena — važi do dana pre nove");
  assert.deepEqual(await priceOn(plus(15)), [35, 16055]);
  assert.deepEqual(await priceOn(plus(25)), [24, 18772], "posle nove akcije vraća se redovni, ne prethodna akcija");
});

test("nov artikal: 30 % za obe opcije; izričit dogovor za artikal se ne prepisuje", async (t) => {
  if (guard(t)) return;
  const { loadRebateSheet } = await svc();
  for (const c of [cust.a, cust.b]) {
    const s = await loadRebateSheet(await user("owner"), c);
    assert.equal(cell(s, art.NOV, "odlozeno_30").rabat, 30);
    assert.equal(cell(s, art.NOV, "avans").rabat, 30);
    assert.equal(cell(s, art.NOV, "avans").priceCents, 487200);
  }
  const s = await loadRebateSheet(await user("owner"), cust.a);
  assert.equal(cell(s, art.NOVX, "avans").rabat, 27, "izričit dogovor ostaje");
  assert.equal(cell(s, art.NOVX, "odlozeno_30").rabat, 30);
});

test("unos: bez VP nema rabata iz cene; prazan posebni dogovor traži rabat; ništa se ne upisuje", async (t) => {
  if (guard(t)) return;
  const { saveRebateChanges } = await svc();
  const [{ before }] = await db.sql<{ before: number }[]>`SELECT count(*)::int AS before FROM price_rules WHERE customer_id = ${cust.a}`;
  await assert.rejects(
    async () =>
      saveRebateChanges(await user("rep"), {
        customerId: cust.a,
        items: [
          { articleId: art.BEZVP, option: "odlozeno_30", field: "c", value: "10,00" },
          { articleId: art.TRAKA, option: "odlozeno_30", field: "r", value: "" },
          { articleId: art.LAK, option: "avans", field: "r", value: "120" },
        ],
        period: { kind: "sada" },
        replaceConfirmed: false,
      }),
    (e: { code?: string; details?: { message: string }[] }) => e.code === "unos" && e.details?.length === 3 && /ne vraća sam/.test(e.details[1].message),
  );
  await assert.rejects(async () => saveRebateChanges(await user("rep"), { customerId: cust.a, items: [{ articleId: art.LAK, option: "odlozeno_60", field: "r", value: "20" }], period: { kind: "sada" }, replaceConfirmed: false }), (e: { code?: string }) => e.code === "opcija");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM price_rules WHERE customer_id = ${cust.a}`;
  assert.equal(n, before);
});

test("obaveštenja: komercijalista → gazde; gazda → dodeljeni komercijalista; bez dodele → niko; brišu se posle 10 dana", async (t) => {
  if (guard(t)) return;
  const { listMyNotices, saveRebateChanges, setNoticeRead, countMyUnreadNotices, loadRebateSheet } = await svc();
  await db.sql`DELETE FROM rebate_change_notices WHERE customer_id IN (${cust.a}, ${cust.b})`;
  await saveRebateChanges(await user("rep"), { customerId: cust.a, items: [{ articleId: art.LAK, option: "odlozeno_30", field: "r", value: "25" }], period: { kind: "sada" }, replaceConfirmed: false, note: "Veća količina" });
  for (const k of ["owner", "owner2"]) {
    const n = (await listMyNotices(await user(k))).filter((x) => x.customerId === cust.a);
    assert.equal(n.length, 1, k);
    assert.equal(n[0].items[0].before, "24 % · 1.793,60");
    assert.equal(n[0].items[0].after, "25 % · 1.770,00");
    assert.equal(n[0].items[0].option, "Odloženo plaćanje — 30 dana");
    assert.equal(n[0].note, "Veća količina");
  }
  assert.equal((await listMyNotices(await user("rep"))).filter((x) => x.customerId === cust.a).length, 0, "autor ne dobija svoje");
  assert.equal((await listMyNotices(await user("tamara"))).length, 0, "kancelarija ne prima");

  await saveRebateChanges(await user("owner"), { customerId: cust.a, items: [{ articleId: art.LAK, option: "avans", field: "r", value: "30" }], period: { kind: "sada" }, replaceConfirmed: false });
  const repNotes = (await listMyNotices(await user("rep"))).filter((x) => x.customerId === cust.a);
  assert.equal(repNotes.length, 1);
  assert.equal((await listMyNotices(await user("other"))).filter((x) => x.customerId === cust.a).length, 0, "nedodeljeni komercijalista ne prima");
  assert.equal(await countMyUnreadNotices(await user("rep")), 1);
  await setNoticeRead(await user("rep"), repNotes[0].id, true);
  assert.equal(await countMyUnreadNotices(await user("rep")), 0);
  await setNoticeRead(await user("other"), repNotes[0].id, false);
  assert.equal(await countMyUnreadNotices(await user("rep")), 0, "tuđe obaveštenje se ne menja");

  const r = await saveRebateChanges(await user("owner"), { customerId: cust.b, items: [{ articleId: art.LAK, option: "avans", field: "r", value: "21" }], period: { kind: "sada" }, replaceConfirmed: false });
  assert.equal(r.notified, 0);
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM rebate_change_notices WHERE customer_id = ${cust.b}`;
  assert.equal(n, 0, "kupac bez komercijaliste: nikome");

  await db.sql`UPDATE rebate_change_notices SET created_at = now() - interval '11 days' WHERE customer_id = ${cust.a}`;
  assert.equal((await listMyNotices(await user("owner"))).filter((x) => x.customerId === cust.a).length, 0);
  const [{ left }] = await db.sql<{ left: number }[]>`SELECT count(*)::int AS left FROM rebate_change_notices WHERE customer_id = ${cust.a}`;
  assert.equal(left, 0, "obrisano");
  const s = await loadRebateSheet(await user("owner"), cust.a);
  assert.equal(cell(s, art.LAK, "odlozeno_30").rabat, 25, "pravilo ostaje posle brisanja obaveštenja");
  assert.equal(cell(s, art.LAK, "avans").rabat, 30);
});

test("tri decimale: uneta cena bez tačnog rabata — pamti se rabat sa 3 decimale, a posle učitavanja važi ista prikazana cena", async (t) => {
  if (guard(t)) return;
  const { saveRebateChanges, loadRebateSheet } = await svc();
  const { evaluateEdit } = await import("@/lib/pricing/rebateSheet.mjs");
  // VP 2.360,00: cena 1.500,00 traži rabat 36,440677… — sa 3 decimale tačna cena ne postoji (važi 1.499,99).
  const preview = evaluateEdit({ field: "c", value: "1.500,00" }, 236000);
  assert.ok(preview.ok && !preview.exact, JSON.stringify(preview));
  const r = await saveRebateChanges(await user("rep"), { customerId: cust.a, items: [{ articleId: art.LAK, option: "avans", field: "c", value: "1.500,00" }], period: { kind: "sada" }, replaceConfirmed: false });
  const [rule] = await db.sql<{ d: string }[]>`SELECT discount_percent::text AS d FROM price_rules WHERE source_batch = ${r.batch}`;
  assert.equal(Number(rule.d), preview.ok ? preview.percent : NaN, "u bazi je rabat iz pregleda");
  const reloaded = cell(await loadRebateSheet(await user("rep"), cust.a), art.LAK, "avans");
  assert.equal(reloaded.priceCents, preview.ok ? preview.priceCents : NaN, "posle učitavanja ista cena kao u pregledu");
  assert.equal(reloaded.rabat, preview.ok ? preview.percent : NaN);
  const { customerPricesByOption } = await import("@/lib/pricing/customer-price-service");
  const cart = (await customerPricesByOption(cust.a, [art.LAK], TODAY)).options.find((o) => o.code === "avans")!.prices.get(art.LAK)!;
  assert.equal(cart.status === "cena" ? cart.netCents : null, reloaded.priceCents, "ista cena i u korpi/kancelariji");
});

test("dnevni zadatak (Vercel Cron) fizički briše obaveštenja starija od 10 dana; traži CRON_SECRET; pravila ostaju", async (t) => {
  if (guard(t)) return;
  const { GET } = await import("@/app/api/cron/obavestenja-rabata/route");
  const { saveRebateChanges } = await svc();
  await saveRebateChanges(await user("rep"), { customerId: cust.a, items: [{ articleId: art.TRAKA, option: "avans", field: "r", value: "31" }], period: { kind: "sada" }, replaceConfirmed: false });
  await db.sql`UPDATE rebate_change_notices SET created_at = now() - interval '10 days 1 hour' WHERE customer_id = ${cust.a}`;
  const [{ rules }] = await db.sql<{ rules: number }[]>`SELECT count(*)::int AS rules FROM price_rules WHERE customer_id = ${cust.a}`;
  const old = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new Request("http://x/api/cron/obavestenja-rabata"))).status, 503, "bez tajne zadatak se ne izvršava");
    process.env.CRON_SECRET = "qa-cron-tajna-1234567890";
    assert.equal((await GET(new Request("http://x/api/cron/obavestenja-rabata"))).status, 401);
    const ok = await GET(new Request("http://x/api/cron/obavestenja-rabata", { headers: { authorization: "Bearer qa-cron-tajna-1234567890" } }));
    assert.equal(ok.status, 200);
    assert.ok(((await ok.json()) as { deleted: number }).deleted >= 1);
  } finally {
    if (old === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = old;
  }
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM rebate_change_notices WHERE customer_id = ${cust.a}`;
  assert.equal(n, 0, "fizički obrisano");
  const [{ after }] = await db.sql<{ after: number }[]>`SELECT count(*)::int AS after FROM price_rules WHERE customer_id = ${cust.a}`;
  assert.equal(after, rules, "pravila cena netaknuta");
});
