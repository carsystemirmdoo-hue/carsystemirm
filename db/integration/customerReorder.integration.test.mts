import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
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
 * F6 „Poručite ponovo": kupac vidi samo svoju istoriju, slika i put do
 * proizvoda postoje samo uz potvrđenu vezu, količina samo kada je pouzdana,
 * i nijedan iznos ne napušta server.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const ISSUER = "QA-PONOVO";
const NOW = new Date("2026-09-29T10:00:00+02:00");
const RUN = randomUUID().slice(0, 6);
const CODE = {
  mapped: `QAP-${RUN}-BZ`,
  variant: `QAP-${RUN}-P800`,
  badVariant: `QAP-${RUN}-P600X`,
  suggested: `QAP-${RUN}-KIT`,
  missing: `QAP-${RUN}-NESTALO`,
  unlinked: `QAP-${RUN}-TRAKA`,
  other: `QAP-${RUN}-TUDJE`,
};
let db: TestDatabase;
let owner: { id: string; name: string; role: string };
const customer: Record<"a" | "b", string> = { a: "", b: "" };
const articleId: Record<string, string> = {};
let counter = 0;

async function purchase(who: "a" | "b", issuedOn: string, lines: { code: string; qty: number }[]) {
  counter += 1;
  const number = `QP${RUN}${counter}`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${number}, ${Number(issuedOn.slice(0, 4))}, ${issuedOn}, ${customer[who]}, '777.00', '932.40', 'manual_upload')
    RETURNING id`;
  let n = 0;
  for (const l of lines) {
    n += 1;
    await db.sql`
      INSERT INTO invoice_lines (invoice_id, line_number, article_id, article_code, description, quantity, unit_price, line_amount)
      VALUES (${inv.id}, ${n}, ${articleId[l.code]}, ${l.code}, ${`Naziv ${l.code}`}, ${l.qty.toFixed(3)}, '777.0000', '777.00')`;
  }
  await db.sql`
    INSERT INTO source_documents (file_hash, file_name, page_count, line_count, issuer_code, business_document_type,
      business_document_number, external_partner_code, document_date, parser_version, validation_status,
      revision_status, manual_review, origin, invoice_id)
    VALUES (${randomUUID().replace(/-/g, "")}, ${`${number}.pdf`}, 1, ${lines.length}, ${ISSUER}, 'faktura', ${number},
            ${who === "a" ? "PA" : "PB"}, ${issuedOn}, 'qa-1', 'valid', 'original', 'not_required', 'manual_upload', ${inv.id})`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  owner = { id: accounts.owner.id, name: accounts.owner.name, role: accounts.owner.role };

  for (const who of ["a", "b"] as const) {
    const [c] = await db.sql<{ id: string }[]>`
      INSERT INTO customers (pib, name) VALUES (${`QAP${who}${RUN}`}, ${`QA Ponovo ${who}`}) RETURNING id`;
    customer[who] = c.id;
    await db.sql`
      INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
      VALUES ('biznisoft', ${ISSUER}, ${who === "a" ? "PA" : "PB"}, ${c.id}, 'mapped')`;
  }
  for (const code of Object.values(CODE)) {
    const [a] = await db.sql<{ id: string }[]>`
      INSERT INTO articles (code, name, unit) VALUES (${code}, ${`Naziv ${code}`}, ${code === CODE.unlinked ? null : "kom"}) RETURNING id`;
    articleId[code] = a.id;
  }

  const { decideMapping } = await import("@/lib/commercial/mapping-service");
  await decideMapping({ articleId: articleId[CODE.mapped], status: "mapped", catalogProductSlug: "baslac-basecoat-35", note: "QA potvrda" }, owner);
  await decideMapping(
    { articleId: articleId[CODE.variant], status: "mapped", catalogProductSlug: "carsystem-f19-brusni-diskovi", catalogVariantId: "156.059", note: "DEMO veza, QA" },
    owner,
  );
  await decideMapping(
    { articleId: articleId[CODE.badVariant], status: "mapped", catalogProductSlug: "carsystem-f19-brusni-diskovi", catalogVariantId: "P600", note: "QA potvrda" },
    owner,
  );
  await decideMapping({ articleId: articleId[CODE.missing], status: "mapped", catalogProductSlug: `ne-postoji-${RUN}`, note: "QA potvrda" }, owner);
  await db.sql`
    INSERT INTO article_catalog_mappings (article_id, catalog_product_slug, status)
    VALUES (${articleId[CODE.suggested]}, 'baslac-12-20-bodyfiller-universal', 'suggested')`;
  // Kupcu B potvrđena veza na isti proizvod — ne sme da se pojavi kod A.
  await decideMapping({ articleId: articleId[CODE.other], status: "mapped", catalogProductSlug: "c-2e50-clear-coat", note: "QA potvrda" }, owner);

  // A: četiri kupovine osnovnih artikala, jedna kupovina ostalih.
  for (const [i, d] of ["2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"].entries()) {
    await purchase("a", d, [
      { code: CODE.mapped, qty: [6, 8, 9, 10][i] },
      { code: CODE.variant, qty: 2 },
      { code: CODE.unlinked, qty: 5 },
    ]);
  }
  await purchase("a", "2026-09-10", [
    { code: CODE.badVariant, qty: 1 },
    { code: CODE.suggested, qty: 1 },
    { code: CODE.missing, qty: 1 },
  ]);
  await purchase("b", "2026-09-15", [{ code: CODE.other, qty: 3 }]);
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM recommendation_results`;
    await db.sql`DELETE FROM recommendation_runs`;
    await db.sql`DELETE FROM source_documents WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
    await db.sql`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM customers WHERE id IN (${customer.a}, ${customer.b})`;
    await db.sql`DELETE FROM article_catalog_mappings WHERE article_id IN (SELECT id FROM articles WHERE code LIKE ${`QAP-${RUN}-%`})`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`QAP-${RUN}-%`}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

async function listFor(who: "a" | "b") {
  const { loadReorderList } = await import("@/lib/customers/reorder");
  return loadReorderList(customer[who], NOW);
}

test("kupac vidi samo svoju istoriju", async (t) => {
  if (guard(t)) return;
  const a = await listFor("a");
  const b = await listFor("b");
  const aCodes = a.items.map((i) => i.articleCode);
  assert.ok(!aCodes.includes(CODE.other), "tuđi artikal se ne sme pojaviti");
  assert.deepEqual(b.items.map((i) => i.articleCode), [CODE.other]);
  assert.equal(a.totalArticles, 6);
  assert.equal(b.totalArticles, 1);
});

test("prazan customerId se odbija pre upita", async (t) => {
  if (guard(t)) return;
  const { loadReorderList } = await import("@/lib/customers/reorder");
  await assert.rejects(() => loadReorderList(""), /bez customer_id/);
});

test("slika, naziv i put do proizvoda samo uz potvrđenu vezu", async (t) => {
  if (guard(t)) return;
  const byCode = new Map((await listFor("a")).items.map((i) => [i.articleCode, i]));

  const mapped = byCode.get(CODE.mapped)!;
  // Varijanta porodice: kanonska stranica porodice, bez preusmerenja.
  assert.equal(mapped.product?.href, "/proizvodi/grupa/baslac-line-35?varijanta=baslac-basecoat-35");
  assert.ok(mapped.product?.image?.src, "potvrđena veza nosi stvarnu sliku");
  assert.equal(mapped.product?.demoLink, false);

  const variant = byCode.get(CODE.variant)!;
  assert.equal(variant.product?.href, "/proizvodi/carsystem-f19-brusni-diskovi?varijanta=156.059");
  assert.equal(variant.product?.variantLabel, "P800");
  assert.equal(variant.product?.demoLink, true, "demo veza je označena");

  const bad = byCode.get(CODE.badVariant)!;
  assert.equal(bad.product?.href, "/proizvodi/carsystem-f19-brusni-diskovi", "nepostojeća varijanta se ne pogađa");
  assert.equal(bad.product?.variantLabel, null);

  for (const code of [CODE.suggested, CODE.missing, CODE.unlinked]) {
    const item = byCode.get(code)!;
    assert.equal(item.product, null, `${code}: bez potvrđene veze nema proizvoda ni slike`);
    assert.equal(item.documentName, `Naziv ${code}`);
    assert.equal(item.invoicesHref, `/kupac/fakture?q=${encodeURIComponent(code)}`);
  }
});

test("uobičajena količina samo kada je pouzdana", async (t) => {
  if (guard(t)) return;
  const byCode = new Map((await listFor("a")).items.map((i) => [i.articleCode, i]));
  assert.equal(byCode.get(CODE.mapped)!.usualQuantity, "6–9 kom");
  assert.equal(byCode.get(CODE.variant)!.usualQuantity, "2 kom");
  assert.equal(byCode.get(CODE.unlinked)!.usualQuantity, null, "nepoznata jedinica mere");
  assert.equal(byCode.get(CODE.suggested)!.usualQuantity, null, "jedna kupovina");
});

test("nijedan iznos, cena ni dugme za poručivanje ne napušta server", async (t) => {
  if (guard(t)) return;
  const json = JSON.stringify(await listFor("a"));
  assert.doesNotMatch(json, /777|932/, "iznosi sa fakture ne smeju biti u odgovoru");
  assert.doesNotMatch(json, /price|amount|cena|rabat/i);
  for (const item of (await listFor("a")).items) assert.equal(item.orderable, false);
});

test("rečenica o ritmu samo uz aktuelan obračun; nova faktura je skriva", async (t) => {
  if (guard(t)) return;
  const { recomputeRecommendations } = await import("@/lib/recommendations/recompute");
  await recomputeRecommendations({ customerIds: null }, { asOfDate: "2026-09-28" }, owner);
  const before = (await listFor("a")).items.find((i) => i.articleCode === CODE.mapped)!;
  assert.match(before.reason, /Obično na ~\d+ dan/, "uz aktuelan obračun ritam se pominje");

  await purchase("a", "2026-09-29", [{ code: CODE.mapped, qty: 8 }]);
  const after_ = (await listFor("a")).items.find((i) => i.articleCode === CODE.mapped)!;
  assert.doesNotMatch(after_.reason, /Obično/, "obračun nije video novu fakturu — ritam se ne pominje");
  assert.match(after_.reason, /poslednji put 29\/09\/2026/, "nova kupovina je vidljiva odmah");
});

test("ruta uzima kupca samo iz sesije i ne prima parametre", async () => {
  const source = await readFile(new URL("../../app/api/kupac/poruci-ponovo/route.ts", import.meta.url), "utf8");
  assert.match(source, /export async function GET\(\)/, "GET ne sme primati zahtev");
  assert.match(source, /getCustomerSession\(\)/);
  assert.match(source, /loadReorderList\(session\.customerId\)/);
  assert.doesNotMatch(source, /searchParams|request\.|params/);
  assert.match(source, /status: 401/);
  assert.match(source, /no-store/);
});
