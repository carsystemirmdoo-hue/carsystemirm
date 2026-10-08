import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase,
  seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Ekrani prometa čitaju isto što i `effective_sales_ledger`.
 *
 * Regresija: `loadSalesLines` (prodaja, analitika, kupci, povrati) čitao je
 * `invoices` direktno, pa je dokument na ručnom pregledu ili u sudaru ulazio
 * u promet na ekranu, dok ga preporuke i spremnost podataka nisu brojale.
 * PDF je sintetički fixture iz `fixtures/dev/biznisoft/` (vidi README tamo).
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) { t.skip(reason); return true; }
  return false;
};

let db: TestDatabase;
let office: { id: string; name: string; role: string };
let customerId: string;
const ISSUER = "QA05";

const asUser = (a: { id: string; name: string; role: string }, permissions: string[] = []) => ({
  id: a.id, email: `${a.id}@qa-1b.invalid`, name: a.name, initials: "QA",
  role: a.role as "gazda" | "komercijalista" | "kancelarija" | "magacioner",
  active: true, sessionVersion: 0, permissions,
});

async function clean() {
  await db.sql`DELETE FROM source_document_lines`;
  await db.sql`DELETE FROM source_documents`;
  await db.sql`DELETE FROM invoice_lines`;
  await db.sql`DELETE FROM invoices`;
  await db.sql`DELETE FROM customer_external_identifiers`;
  await db.sql`DELETE FROM article_catalog_mappings`;
  await db.sql`DELETE FROM articles WHERE code LIKE '900%' OR code LIKE '800%'`;
  await db.sql`DELETE FROM customer_assignments`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const a = await seedAccounts(db, [{ key: "office", role: "kancelarija" }]);
  office = { id: a.office.id, name: a.office.name, role: a.office.role };
});

after(async () => {
  if (!reason && db) {
    await clean();
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("dokument na ručnom pregledu ne ulazi u promet na ekranu, CSV faktura ulazi", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { loadSalesLines } = await import("@/lib/sales/queries");
  await clean();

  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  customerId = c.id;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${customerId}, 'mapped')`;
  const bytes = new Uint8Array(
    await readFile(new URL("../../fixtures/dev/biznisoft/vise-stavki.pdf", import.meta.url)),
  );
  const out = await ingestBiznisoftPdf({ bytes, fileName: "l.pdf", issuerCode: ISSUER }, office);
  assert.equal(out.result, "ingested");

  // Faktura bez izvornog dokumenta — kao iz ranijeg CSV uvoza.
  const [manual] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                          customer_id, net_amount, total_amount)
    VALUES (${ISSUER}, 'faktura', 'QA-CSV-1', 2025, '2025-03-01', ${customerId}, '100.00', '120.00')
    RETURNING id`;
  await db.sql`
    INSERT INTO invoice_lines (invoice_id, line_number, article_code, quantity, unit_price, line_amount)
    VALUES (${manual.id}, 1, '900001', '1.000', '100.0000', '100.00')`;

  const viewer = asUser(office);
  const before = await loadSalesLines(viewer, { customerId });
  assert.equal(before.length, 8, "7 stavki PDF-a + 1 CSV");

  await db.sql`UPDATE source_documents SET manual_review = 'pending'`;
  const pending = await loadSalesLines(viewer, { customerId });
  assert.deepEqual(pending.map((l) => l.invoiceId), [manual.id], "ostaje samo CSV faktura");

  await db.sql`UPDATE source_documents SET manual_review = 'not_required'`;
  const restored = await loadSalesLines(viewer, { customerId });
  assert.equal(restored.length, 8);
});

test("zbir na ekranu prometa jednak je zbiru iz effective_sales_ledger", async (t) => {
  if (guard(t)) return;
  const { loadSalesLines } = await import("@/lib/sales/queries");
  await db.sql`UPDATE source_documents SET manual_review = 'pending'`;
  try {
    const lines = await loadSalesLines(asUser(office), { customerId });
    const screen = lines.reduce((sum, l) => sum + l.lineAmount, 0);
    const [ledger] = await db.sql<{ total: string | null; n: number }[]>`
      SELECT sum(line_amount)::text AS total, count(*)::int AS n
        FROM effective_sales_ledger WHERE customer_id = ${customerId}`;
    assert.equal(lines.length, ledger.n);
    assert.equal(screen.toFixed(2), Number(ledger.total ?? 0).toFixed(2));
  } finally {
    await db.sql`UPDATE source_documents SET manual_review = 'not_required'`;
  }
});

test("agregati u bazi su jednaki zbiru svih stavki i ne zavise od granice prikaza", async (t) => {
  if (guard(t)) return;
  const { loadSalesLines, loadSalesSummary, loadSalesBreakdown } = await import("@/lib/sales/queries");
  const { summarize, summarizeBy } = await import("@/lib/sales/totals.mjs");

  // Negativna stavka nepoznate vrste i jedna korekcija — razvrstavanje mora biti isto kao u summarize().
  const [storno] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, total_amount)
    VALUES (${ISSUER}, 'storno', 'QA-ST-1', 2025, '2025-04-01', ${customerId}, '-40.00', '-48.00') RETURNING id`;
  await db.sql`INSERT INTO invoice_lines (invoice_id, line_number, article_code, quantity, unit_price, line_amount)
    VALUES (${storno.id}, 1, '900001', '-1.000', '40.0000', '-40.00')`;
  try {
    const viewer = asUser(office);
    const filter = { customerId };
    const sve = await loadSalesLines(viewer, filter);
    const jedna = await loadSalesLines(viewer, filter, 1);
    assert.equal(jedna.length, 1, "granica prikaza radi");

    const zbir = await loadSalesSummary(viewer, filter);
    const ocekivano = summarize(sve);
    for (const k of ["gross", "returnValue", "correctionValue", "unknownNegativeValue", "unknownNegativeCount", "net"] as const) {
      assert.equal(zbir[k], ocekivano[k], `${k}: baza ${zbir[k]} ≠ summarize ${ocekivano[k]}`);
    }
    assert.equal(zbir.lineCount, sve.length);
    assert.equal(zbir.invoiceCount, new Set(sve.map((l) => l.invoiceId)).size);
    assert.equal(zbir.negativeLineCount, sve.filter((l) => l.lineAmount < 0).length);
    assert.equal(zbir.correctionValue, -40, "storno je korekcija");

    const poKupcu = await loadSalesBreakdown(viewer, filter, "kupci");
    const jsPoKupcu = summarizeBy(sve, (l) => l.customerId);
    assert.equal(poKupcu.length, jsPoKupcu.length);
    assert.equal(poKupcu[0].net, jsPoKupcu[0].net);
    assert.equal(poKupcu[0].invoiceCount, jsPoKupcu[0].invoiceCount);
    assert.equal(poKupcu[0].customerId, customerId);

    const negativne = await loadSalesLines(viewer, { ...filter, onlyNegative: true });
    assert.ok(negativne.length === 1 && negativne[0].lineAmount < 0);

    // Kupac van opsega: komercijalista bez dodele ne vidi ni zbir.
    const rep = asUser({ id: office.id, name: "QA komercijalista", role: "komercijalista" });
    const tudji = await loadSalesSummary(rep, filter);
    assert.equal(tudji.lineCount, 0, "opseg komercijaliste se primenjuje i na agregat");
  } finally {
    await db.sql`DELETE FROM invoice_lines WHERE invoice_id = ${storno.id}`;
    await db.sql`DELETE FROM invoices WHERE id = ${storno.id}`;
  }
});
