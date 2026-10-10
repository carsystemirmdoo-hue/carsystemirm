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
 * F8: kupovina iz celog kataloga (varijanta + pakovanje + kupčeva cena),
 * „Zatražite cenu/uslove" sa radnom listom, i rabati po grupama iz faktura.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const RUN = randomUUID().slice(0, 6);
const code = (c: string) => `QAB-${RUN}-${c}`;
let db: TestDatabase;
const staff: Record<string, { id: string }> = {};
const firm: Record<"a" | "b", { customerId: string; accountId: string; name: string }> = {
  a: { customerId: "", accountId: "", name: "" },
  b: { customerId: "", accountId: "", name: "" },
};
const art: Record<string, string> = {};
let listId = "";

type Svc = typeof import("@/lib/ordering/ordering-service");
type Req = typeof import("@/lib/ordering/price-request-service");
let svc: Svc;
let req: Req;

const session = (who: "a" | "b") => ({
  accountId: firm[who].accountId,
  customerId: firm[who].customerId,
  customerName: firm[who].name,
  email: `${who}@qa.invalid`,
  name: `QA osoba ${who}`,
  status: "active" as const,
});

async function portalUser(key: string) {
  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  return (await loadPortalUser(staff[key].id))!;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  process.env.CUSTOMER_ORDERING = "demo";
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "office", role: "kancelarija" },
    { key: "rep", role: "komercijalista" },
  ]);
  for (const k of Object.keys(accounts)) staff[k] = { id: accounts[k].id };
  await db.sql`INSERT INTO system_settings (key, value) VALUES ('dataset.kind', ${db.sql.json({ kind: "demo" })})
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;

  for (const who of ["a", "b"] as const) {
    const name = `QA Kupac ${who.toUpperCase()} ${RUN}`;
    const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QAB${who}${RUN}`}, ${name}) RETURNING id`;
    const [u] = await db.sql<{ id: string }[]>`
      INSERT INTO customer_users (customer_id, email, name, password_hash, status)
      VALUES (${c.id}, ${`qab-${RUN}-${who}@qa.invalid`}, ${`QA osoba ${who}`}, 'x', 'active') RETURNING id`;
    firm[who] = { customerId: c.id, accountId: u.id, name };
    await db.sql`INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
                 VALUES ('biznisoft', 'QA-BUY', ${`P${who}`}, ${c.id}, 'mapped')`;
  }
  await db.sql`INSERT INTO customer_assignments (user_id, customer_id) VALUES (${staff.rep.id}, ${firm.a.customerId})`;

  const { decideMapping } = await import("@/lib/commercial/mapping-service");
  const [owner] = await db.sql<{ id: string; name: string; role: string }[]>`SELECT id, name, role::text AS role FROM users WHERE id = ${staff.owner.id}`;
  const ARTS = [
    { c: "P400", group: "Abrazivi", slug: "carsystem-f19-brusni-diskovi", variant: "156.056", price: 2890 },
    { c: "P800", group: "Abrazivi", slug: "carsystem-f19-brusni-diskovi", variant: "156.059", price: 2890 },
    { c: "2K1", group: "Bezbojni lakovi", slug: "c-2e50-clear-coat", variant: null, price: 3690 },
    { c: "2K5", group: "Bezbojni lakovi", slug: "c-2e50-clear-coat", variant: null, price: 15900 },
    { c: "TAPE", group: "Maskiranje", slug: "carsystem-black-tape", variant: null, price: null },
    { c: "NOGRP", group: null, slug: "r-2e10-thinner-fast", variant: null, price: 990 },
  ];
  const [list] = await db.sql<{ id: string }[]>`
    INSERT INTO price_lists (code, name, kind, status, valid_from, source_note)
    VALUES (${`QAB-${RUN}`}, 'QA demo cenovnik', 'demo', 'active', '2026-01-01', 'QA') RETURNING id`;
  listId = list.id;
  for (const a of ARTS) {
    const [row] = await db.sql<{ id: string }[]>`
      INSERT INTO articles (code, name, product_group, brand, unit) VALUES (${code(a.c)}, ${`QA ${a.c}`}, ${a.group}, 'QA', 'kom') RETURNING id`;
    art[a.c] = row.id;
    await decideMapping({ articleId: row.id, status: "mapped", catalogProductSlug: a.slug, catalogVariantId: a.variant, note: "QA potvrda" }, owner);
    if (a.price) {
      await db.sql`INSERT INTO price_list_items (price_list_id, article_id, unit, pack_label, net_price, vat_percent)
                   VALUES (${listId}, ${row.id}, 'kom', ${`Pakovanje ${a.c}`}, ${a.price}, 20)`;
    }
  }
  // A ima 10 % na abrazive; B nema rabat.
  await db.sql`INSERT INTO price_list_customer_terms (price_list_id, customer_id, product_scope, product_group, discount_percent)
               VALUES (${listId}, ${firm.a.customerId}, 'product_group', 'Abrazivi', 10)`;

  // Fakture sa rabatima (za pripremu rabata po grupama). Cena na fakturi je namerno čudna.
  let n = 0;
  const invoice = async (who: "a" | "b", day: string, lines: { c: string; d: number }[], kind = "faktura") => {
    n += 1;
    const number = `QB${RUN}${n}`;
    const [inv] = await db.sql<{ id: string }[]>`
      INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount, origin)
      VALUES ('QA-BUY', ${kind}, ${number}, 2026, ${day}, ${firm[who].customerId}, '1.00', '1.20', 'manual_upload') RETURNING id`;
    let ln = 0;
    for (const l of lines) {
      ln += 1;
      await db.sql`INSERT INTO invoice_lines (invoice_id, line_number, article_id, article_code, quantity, unit_price, discount_percent, line_amount)
                   VALUES (${inv.id}, ${ln}, ${art[l.c]}, ${code(l.c)}, '1', '4321.0000', ${l.d}, '1.00')`;
    }
    if (kind === "faktura") {
      await db.sql`
        INSERT INTO source_documents (file_hash, file_name, page_count, line_count, issuer_code, business_document_type,
          business_document_number, external_partner_code, document_date, parser_version, validation_status,
          revision_status, manual_review, origin, invoice_id)
        VALUES (${randomUUID().replace(/-/g, "")}, ${`${number}.pdf`}, 1, ${lines.length}, 'QA-BUY', 'faktura', ${number}, ${`P${who}`},
                ${day}, 'qa-1', 'valid', 'original', 'not_required', 'manual_upload', ${inv.id})`;
    }
  };
  await invoice("a", "2026-05-01", [{ c: "P800", d: 10 }, { c: "2K5", d: 12 }, { c: "NOGRP", d: 5 }]);
  await invoice("a", "2026-06-01", [{ c: "P800", d: 10 }, { c: "2K5", d: 15 }]);
  await invoice("a", "2026-07-01", [{ c: "P400", d: 10 }, { c: "2K5", d: 12 }]);
  await invoice("b", "2026-06-15", [{ c: "2K1", d: 0 }]);
  await invoice("b", "2026-07-15", [{ c: "2K1", d: 0 }]);
  await invoice("b", "2026-08-15", [{ c: "2K1", d: 0 }]);
  await invoice("a", "2026-08-01", [], "korekcija_popusta");

  svc = await import("@/lib/ordering/ordering-service");
  req = await import("@/lib/ordering/price-request-service");
});

after(async () => {
  if (!reason && db) {
    const ids = [firm.a.customerId, firm.b.customerId].filter(Boolean);
    await db.sql`DELETE FROM customer_price_requests WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM customer_cart_items WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM price_rules WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM price_lists WHERE id = ${listId}`;
    await db.sql`DELETE FROM source_documents WHERE issuer_code = 'QA-BUY'`;
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = 'QA-BUY')`;
    await db.sql`DELETE FROM invoices WHERE company_id = 'QA-BUY'`;
    await db.sql`DELETE FROM article_catalog_mappings WHERE article_id IN ${db.sql(Object.values(art))}`;
    await db.sql`DELETE FROM articles WHERE id IN ${db.sql(Object.values(art))}`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = 'QA-BUY'`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM customer_users WHERE customer_id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM customers WHERE id IN ${db.sql(ids)}`;
    await db.sql`DELETE FROM system_settings WHERE key = 'dataset.kind'`;
    await cleanupQa(db);
  }
  delete process.env.CUSTOMER_ORDERING;
  await closeTestDatabase();
});

test("ponude kataloga: varijanta i pakovanje, cena po kupcu, kartice proizvoda i porodice", async (t) => {
  if (guard(t)) return;
  const a = (await svc.loadCustomerOffers(firm.a.customerId)).offers.filter((o) => o.articleCode.startsWith(`QAB-${RUN}`));
  const b = (await svc.loadCustomerOffers(firm.b.customerId)).offers.filter((o) => o.articleCode.startsWith(`QAB-${RUN}`));
  const by = (list: typeof a, c: string) => list.find((o) => o.articleCode === code(c))!;
  assert.equal(by(a, "P400").variantKey, "156.056");
  assert.equal(by(a, "P400").variantLabel, "P400");
  assert.equal(by(a, "P400").netPrice, 2601, "2890 − 10 % za firmu A");
  // Firma B nema potvrđen rabat: cena na upit, NE puna cenovnička cena kao „njena“.
  assert.equal(by(b, "P400").netPrice, null, "firma B bez potvrđenog rabata");
  assert.equal(by(b, "P400").state, "no_price");
  assert.equal(by(b, "P400").reason, "rebate_unknown");
  // Dva pakovanja istog proizvoda bez varijanti-redova.
  // Firma A ima rabat samo za grupu Abrazivi — za lak nema potvrđen rabat, pa su oba pakovanja „cena na upit“.
  const clear = a.filter((o) => o.slug === "c-2e50-clear-coat");
  assert.deepEqual(clear.map((o) => o.articleCode).sort(), [code("2K1"), code("2K5")]);
  assert.ok(clear.every((o) => o.state === "no_price" && o.reason === "rebate_unknown" && o.netPrice === null && o.variantKey === null));
  assert.equal(by(a, "TAPE").state, "no_price", "povezan bez cene → zatraži cenu");
  assert.equal(by(a, "TAPE").netPrice, null);
  assert.ok(by(a, "P400").cardKeys.includes("carsystem-f19-brusni-diskovi"));
  // Nijedan lager, nijedan iznos sa fakture.
  const json = JSON.stringify(a);
  assert.doesNotMatch(json, /4321|stock|lager|zalih/i);
});

test("kupovina novog proizvoda preko varijante: pakovanje ide u korpu sa tačnom varijantom", async (t) => {
  if (guard(t)) return;
  const r = await svc.addToCart(session("a"), { articleCode: code("P400"), quantity: "3" });
  assert.equal(r.ok, true);
  const q = await svc.loadCartQuote(firm.a.customerId);
  const line = q.lines.find((l) => l.articleCode === code("P400"))!;
  assert.equal(line.catalog!.variantLabel, "P400");
  assert.equal(line.catalog!.href, "/proizvodi/carsystem-f19-brusni-diskovi?varijanta=156.056");
  assert.equal(line.price!.netPrice, 2601);
  assert.equal(line.price!.packLabel, "Pakovanje P400");
  // Proizvod bez cene ne može u korpu.
  assert.equal((await svc.addToCart(session("a"), { articleCode: code("TAPE"), quantity: "1" })).ok, false);
  assert.equal((await svc.loadCartQuote(firm.b.customerId)).lines.length, 0, "korpa B ne vidi A");
  await db.sql`DELETE FROM customer_cart_items WHERE customer_id = ${firm.a.customerId}`;
});

test("zatraži cenu/uslove: proizvod, tačna varijanta, količina; isti ključ = isti zahtev", async (t) => {
  if (guard(t)) return;
  const key = randomUUID();
  const r1 = await req.createPriceRequest(session("a"), { slug: "carsystem-black-tape", articleCode: code("TAPE"), quantity: "12", note: "mesečno", kind: "no_price", idempotencyKey: key });
  const r2 = await req.createPriceRequest(session("a"), { slug: "carsystem-black-tape", articleCode: code("TAPE"), quantity: "12", note: "mesečno", kind: "no_price", idempotencyKey: key });
  assert.ok(r1.ok && r2.ok);
  assert.equal((r2 as { id: string }).id, (r1 as { id: string }).id);
  assert.equal((r2 as { existing: boolean }).existing, true);
  assert.match((r1 as { requestNumber: string }).requestNumber, /^U-\d{4}-\d{5}$/);

  // Varijanta je obavezna i mora biti tačna.
  const noVariant = await req.createPriceRequest(session("a"), { slug: "carsystem-f19-brusni-diskovi", quantity: "1", kind: "no_price", idempotencyKey: randomUUID() });
  assert.equal(noVariant.ok, false);
  const badVariant = await req.createPriceRequest(session("a"), { slug: "carsystem-f19-brusni-diskovi", variantKey: "P500", quantity: "1", kind: "no_price", idempotencyKey: randomUUID() });
  assert.equal(badVariant.ok, false, "oznaka se ne pogađa po nazivu");
  const okVariant = await req.createPriceRequest(session("b"), { slug: "carsystem-f19-brusni-diskovi", variantKey: "156.059", quantity: "2", kind: "special_terms", idempotencyKey: randomUUID() });
  assert.equal(okVariant.ok, true);
  // Proizvod koji ne postoji i nevažeća količina.
  assert.equal((await req.createPriceRequest(session("a"), { slug: "ne-postoji", quantity: "1", kind: "no_price", idempotencyKey: randomUUID() })).ok, false);
  assert.equal((await req.createPriceRequest(session("a"), { slug: "carsystem-black-tape", quantity: "0", kind: "no_price", idempotencyKey: randomUUID() })).ok, false);
  // Tuđi ključ ne vraća tuđi zahtev.
  assert.equal((await req.createPriceRequest(session("b"), { slug: "carsystem-black-tape", quantity: "1", kind: "no_price", idempotencyKey: key })).ok, false);

  const mine = await req.listCustomerPriceRequests(firm.a.customerId);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].articleCode, code("TAPE"));
  assert.equal(mine[0].quantity, 12);
  const b = await req.listCustomerPriceRequests(firm.b.customerId);
  assert.equal(b.length, 1);
  assert.equal(b[0].variantLabel, "P800");
});

test("radna lista: kancelarija sve, komercijalista samo svoje; odgovor je obavezan tekst", async (t) => {
  if (guard(t)) return;
  const office = await portalUser("office");
  const rep = await portalUser("rep");
  const all = (await req.listPriceRequests(office)).filter((r) => [firm.a.customerId, firm.b.customerId].includes(r.customerId));
  assert.equal(all.length, 2);
  const repRows = await req.listPriceRequests(rep);
  assert.ok(repRows.every((r) => r.customerId === firm.a.customerId), "komercijalista ne vidi tuđe kupce");
  const bReq = all.find((r) => r.customerId === firm.b.customerId)!;
  assert.equal((await req.changePriceRequest(rep, bReq.id, "answered", "Može 5 %")).ok, false, "komercijalista ne dira tuđeg kupca");
  const aReq = all.find((r) => r.customerId === firm.a.customerId)!;
  assert.deepEqual(await req.changePriceRequest(rep, aReq.id, "in_progress"), { ok: true, changed: true });
  assert.equal((await req.changePriceRequest(rep, aReq.id, "answered", "")).ok, false);
  assert.deepEqual(await req.changePriceRequest(rep, aReq.id, "answered", "Cena 1.290 RSD/rolna, unosimo u cenovnik."), { ok: true, changed: true });
  const seen = await req.listCustomerPriceRequests(firm.a.customerId);
  assert.equal(seen[0].status, "answered");
  assert.match(seen[0].answer!, /1\.290/);
  // Odgovor ne menja cenu: traka i dalje nije poručiva.
  assert.equal((await svc.addToCart(session("a"), { articleCode: code("TAPE"), quantity: "1" })).ok, false);
});

test("rabati iz faktura: dosledno, protivrečno, bez grupe, bez rabata; istorijska cena se ne koristi", async (t) => {
  if (guard(t)) return;
  const owner = await portalUser("owner");
  const { loadRebateEvidence, proposeRebateFromEvidence } = await import("@/lib/pricing/rebate-evidence-service");
  const { items } = await loadRebateEvidence(owner);
  const mine = items.filter((i) => [firm.a.customerId, firm.b.customerId].includes(i.customerId));
  const find = (who: "a" | "b", g: string | null) => mine.find((i) => i.customerId === firm[who].customerId && i.productGroup === g)!;
  const abr = find("a", "Abrazivi");
  assert.equal(abr.status, "consistent");
  assert.equal(abr.candidatePercent, 10);
  assert.equal(abr.documentCount, 3);
  assert.equal(abr.conflict, null, "isti je kao u cenovniku");
  assert.ok(abr.corrections && abr.corrections.count === 1, "korekcija popusta se prijavljuje");
  const clear = find("a", "Bezbojni lakovi");
  assert.equal(clear.status, "contradictory");
  assert.deepEqual(clear.values.map((v) => [v.discountPercent, v.lines]), [[12, 2], [15, 1]]);
  assert.equal(find("a", null).status, "missing_group");
  assert.equal(find("b", "Bezbojni lakovi").status, "no_discount");
  assert.doesNotMatch(JSON.stringify(mine), /4321/, "cena sa fakture ne ulazi u pripremu rabata");

  const r = await proposeRebateFromEvidence(owner, firm.a.customerId, "Abrazivi");
  assert.equal(r.ok, true);
  assert.equal((r as { status: string }).status, "pending_approval", "predlog ide u postojeći tok odobravanja");
  assert.equal((await proposeRebateFromEvidence(owner, firm.a.customerId, "Abrazivi")).ok, false, "isti predlog dvaput se odbija");
  assert.equal((await proposeRebateFromEvidence(owner, firm.a.customerId, "Bezbojni lakovi")).ok, false, "protivrečno ne postaje predlog");
  // Predlog ne dira cenovnik ni korpu.
  const p400 = (await svc.loadCustomerOffers(firm.a.customerId)).offers.find((o) => o.articleCode === code("P400"))!;
  assert.equal(p400.netPrice, 2601);
});
