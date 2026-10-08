import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/** Predlozi dodatnih proizvoda: slične firme (jak/slab), katalog, nedostatak podataka, bez imena drugih firmi. */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const RUN = randomUUID().slice(0, 6);
const ISSUER = `QX${RUN}`;
const code = (c: string) => `QX-${RUN}-${c}`;
let db: TestDatabase;
const cust: Record<string, string> = {};
const art: Record<string, string> = {};
let n = 0;

async function buy(who: string, codes: string[], day = "2026-09-01") {
  n += 1;
  const number = `X${RUN}${n}`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${number}, 2026, ${day}, ${cust[who]}, '1.00', '1.20', 'manual_upload') RETURNING id`;
  let ln = 0;
  for (const c of codes) {
    ln += 1;
    await db.sql`INSERT INTO invoice_lines (invoice_id, line_number, article_id, article_code, quantity, unit_price, line_amount)
                 VALUES (${inv.id}, ${ln}, ${art[c]}, ${code(c)}, '1', '1.0000', '1.00')`;
  }
  await db.sql`
    INSERT INTO source_documents (file_hash, file_name, page_count, line_count, issuer_code, business_document_type,
      business_document_number, external_partner_code, document_date, parser_version, validation_status,
      revision_status, manual_review, origin, invoice_id)
    VALUES (${randomUUID().replace(/-/g, "")}, ${`${number}.pdf`}, 1, ${codes.length}, ${ISSUER}, 'faktura', ${number}, ${`P${who}`},
            ${day}, 'qa-1', 'valid', 'original', 'not_required', 'manual_upload', ${inv.id})`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  const [owner] = await db.sql<{ id: string; name: string; role: string }[]>`SELECT id, name, role::text AS role FROM users WHERE id = ${acc.owner.id}`;
  for (const w of ["me", "p1", "p2", "p3", "far", "solo"]) {
    const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QX${w}${RUN}`}, ${`TAJNO-IME-${w}-${RUN}`}) RETURNING id`;
    cust[w] = c.id;
    await db.sql`INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
                 VALUES ('biznisoft', ${ISSUER}, ${`P${w}`}, ${c.id}, 'mapped')`;
  }
  for (const c of ["LAK", "RZ", "X", "Y", "Z"]) {
    const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit) VALUES (${code(c)}, ${`QA ${c}`}, 'kom') RETURNING id`;
    art[c] = a.id;
  }
  const { decideMapping } = await import("@/lib/commercial/mapping-service");
  await decideMapping({ articleId: art.LAK, status: "mapped", catalogProductSlug: "c-2e50-clear-coat", note: "QA potvrda" }, owner);
  await decideMapping({ articleId: art.RZ, status: "mapped", catalogProductSlug: "r-2e10-thinner-fast", note: "QA potvrda" }, owner);
  await buy("me", ["LAK", "Z"]);
  await buy("p1", ["LAK", "X", "Y"]);
  await buy("p2", ["LAK", "X", "Y"]);
  await buy("p3", ["Z", "X"]);
  await buy("far", ["Y"]);
  await buy("solo", ["RZ"]);
  await buy("me", ["X"], "2024-01-01"); // starije od godinu dana — ne računa se kao „već kupuje"
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM source_documents WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
    await db.sql`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
    await db.sql`DELETE FROM article_catalog_mappings WHERE article_id IN ${db.sql(Object.values(art))}`;
    await db.sql`DELETE FROM articles WHERE id IN ${db.sql(Object.values(art))}`;
    await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
    await db.sql`DELETE FROM customers WHERE id IN ${db.sql(Object.values(cust))}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("slične firme i katalog, sa razlogom; bez imena drugih firmi", async (t) => {
  if (guard(t)) return;
  const { loadCrossSell } = await import("@/lib/recommendations/cross-sell");
  const r = (await loadCrossSell([cust.me], new Date("2026-09-30T10:00:00+02:00"))).get(cust.me)!;
  assert.equal(r.ok, true);
  assert.equal(r.peers, 3, "p1, p2, p3 dele artikal; „far” i „solo” ne");
  const by = new Map(r.suggestions.map((s) => [s.articleCode, s]));
  assert.equal(by.get(code("X"))!.peer!.strength, "strong", "X uzimaju 3 slične firme");
  assert.equal(by.get(code("Y"))!.peer!.strength, "weak");
  assert.equal(by.get(code("RZ"))!.catalog!.viaName, "C 2E50 Clear coat", "katalog: razređivač kompatibilan sa lakom");
  assert.equal(by.get(code("RZ"))!.identity!.catalog!.name, "R 2E10 Thinner, fast");
  assert.doesNotMatch(JSON.stringify(r), /TAJNO-IME/, "imena drugih firmi ne izlaze");
  assert.equal(r.suggestions[0].articleCode, code("X"), "jak predlog prvi");
});

test("premalo podataka: poređenje se ne prikazuje, kataloški predlog ostaje, razlog rečima", async (t) => {
  if (guard(t)) return;
  const { loadCrossSell } = await import("@/lib/recommendations/cross-sell");
  // Pre 2025 postoji samo jedna kupovina — poređenje nema s kim.
  const r = (await loadCrossSell([cust.solo], new Date("2026-09-30T10:00:00+02:00"))).get(cust.solo)!;
  assert.equal(r.ok, false);
  assert.match(r.reason!, /Premalo firmi sa sličnim kupovinama/);
  assert.ok(r.suggestions.every((s) => s.catalog && !s.peer));
  assert.ok(r.suggestions.some((s) => s.articleCode === code("LAK")), "katalog: lak kompatibilan sa razređivačem");
});
