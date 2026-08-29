import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase,
  seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) { t.skip(reason); return true; }
  return false;
};

let db: TestDatabase;
let actor: { id: string; name: string; role: string };
let rep: { id: string; name: string; role: string };
let customerId: string;
const ISSUER = "QA01";

const bytesOf = async (n: string) =>
  new Uint8Array(await readFile(new URL(`../../fixtures/dev/biznisoft/${n}`, import.meta.url)));

const asUser = (a: { id: string; name: string; role: string }, permissions: string[] = []) => ({
  id: a.id, email: `${a.id}@qa-1b.invalid`, name: a.name, initials: "QA",
  role: a.role as "gazda" | "komercijalista" | "kancelarija" | "magacioner",
  active: true, sessionVersion: 0, permissions,
});

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const a = await seedAccounts(db, [
    { key: "office", role: "kancelarija" },
    { key: "rep", role: "komercijalista" },
  ]);
  actor = { id: a.office.id, name: a.office.name, role: a.office.role };
  rep = { id: a.rep.id, name: a.rep.name, role: a.rep.role };
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM source_document_lines`;
    await db.sql`DELETE FROM source_documents`;
    await db.sql`DELETE FROM invoice_lines`;
    await db.sql`DELETE FROM invoices`;
    await db.sql`DELETE FROM customer_external_identifiers`;
    // Uvoz sam upisuje artikle u registar, pa ih i cisti.
    await db.sql`DELETE FROM article_catalog_mappings`;
    await db.sql`DELETE FROM articles WHERE code LIKE '900%' OR code LIKE '800%'`;
    await db.sql`DELETE FROM customer_assignments`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

/** Uvozi `vise-stavki.pdf` za mapiranog kupca; vraca id izvornog dokumenta. */
async function ingestMapped() {
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  await db.sql`DELETE FROM source_document_lines`;
  await db.sql`DELETE FROM source_documents`;
  await db.sql`DELETE FROM invoice_lines`;
  await db.sql`DELETE FROM invoices`;
  await db.sql`DELETE FROM customer_external_identifiers`;
  // Uvoz sam upisuje artikle u registar, pa ih i cisti.
  await db.sql`DELETE FROM article_catalog_mappings`;
  await db.sql`DELETE FROM articles WHERE code LIKE '900%' OR code LIKE '800%'`;
  await db.sql`DELETE FROM customer_assignments`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;

  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${randomUUID().slice(0,6)}`}, 'QA Kupac') RETURNING id`;
  customerId = c.id;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${c.id}, 'mapped')`;

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "l.pdf", issuerCode: ISSUER }, actor);
  assert.equal(out.result, "ingested");
  return out;
}

/** Rucno unet dokument bez izvornog PDF-a — kao iz ranijeg CSV uvoza. */
async function manualInvoice(
  owner: string,
  kind: string,
  issuedOn: string,
  number: string,
) {
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                          customer_id, net_amount, total_amount)
    VALUES (${ISSUER}, ${kind}, ${number}, ${Number(issuedOn.slice(0, 4))},
            ${issuedOn}, ${owner}, '100.00', '120.00')
    RETURNING id`;
  await db.sql`
    INSERT INTO invoice_lines (invoice_id, line_number, article_code, quantity,
                               unit_price, line_amount)
    VALUES (${inv.id}, 1, '900001', '1.000', '100.0000', '100.00')`;
  return inv.id;
}

test("promet ulazi u ledger tacno jednom", async (t) => {
  if (guard(t)) return;
  const { ledgerTotals } = await import("@/lib/ledger/effective-sales");
  await ingestMapped();

  const totals = await ledgerTotals({ customerIds: null });
  assert.equal(totals.gross_sales.lines, 7);
  assert.equal(totals.net_effective_sales.lines, 7);
  // Redovi se ne broje dvaput u bruto i neto kao dve prodaje.
  assert.equal(totals.returns.lines, 0);
  assert.equal(totals.cancellations.lines, 0);
});

test("ZAMENJEN dokument ispada iz ledgera — nema dvostrukog brojanja revizije", async (t) => {
  if (guard(t)) return;
  const { ledgerTotals } = await import("@/lib/ledger/effective-sales");
  const first = await ingestMapped();

  const before = await ledgerTotals({ customerIds: null });
  assert.equal(before.gross_sales.lines, 7);

  // Simulira potvrdjenu reviziju: original postaje `superseded`.
  const [replacement] = await db.sql<{ id: string }[]>`
    INSERT INTO source_documents
      (file_hash, file_name, page_count, issuer_code, business_document_type,
       parser_version, validation_status)
    VALUES ('feed0001', 'r.pdf', 1, ${ISSUER}, 'faktura', 'p1', 'valid') RETURNING id`;
  await db.sql`
    UPDATE source_documents
       SET revision_status = 'superseded', superseded_by_id = ${replacement.id},
           revision_confirmed_by = ${actor.id}, revision_confirmed_at = now()
     WHERE id = ${first.sourceDocumentId}`;

  const after = await ledgerTotals({ customerIds: null });
  assert.equal(after.gross_sales.lines, 0, "zamenjen dokument je ostao u ledgeru");
});

test("dokument u SUDARU ne ulazi u ledger", async (t) => {
  if (guard(t)) return;
  const { ledgerTotals } = await import("@/lib/ledger/effective-sales");
  const first = await ingestMapped();

  await db.sql`
    UPDATE source_documents
       SET revision_status = 'conflict', conflict_reason = 'dve verzije', manual_review = 'pending'
     WHERE id = ${first.sourceDocumentId}`;

  const totals = await ledgerTotals({ customerIds: null });
  assert.equal(totals.gross_sales.lines, 0);
});

test("dokument na rucnom pregledu ne ulazi u ledger", async (t) => {
  if (guard(t)) return;
  const { ledgerTotals } = await import("@/lib/ledger/effective-sales");
  const first = await ingestMapped();
  await db.sql`UPDATE source_documents SET manual_review = 'pending' WHERE id = ${first.sourceDocumentId}`;
  const totals = await ledgerTotals({ customerIds: null });
  assert.equal(totals.gross_sales.lines, 0);
});

test("povrat i storno se prikazuju u svojim kofama, ali NE ulaze u neto", async (t) => {
  if (guard(t)) return;
  const { ledgerTotals } = await import("@/lib/ledger/effective-sales");
  await ingestMapped();

  // Rucno unet povrat bez reference na original — realna situacija dok nema uzorka.
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                          customer_id, net_amount, total_amount)
    VALUES (${ISSUER}, 'povrat_robe', 'P1', 2026, '2026-02-01', ${customerId}, '100.00', '120.00')
    RETURNING id`;
  await db.sql`
    INSERT INTO invoice_lines (invoice_id, line_number, article_code, quantity,
                               unit_price, line_amount)
    VALUES (${inv.id}, 1, '900001', '1.000', '100.0000', '100.00')`;

  const totals = await ledgerTotals({ customerIds: null });
  assert.equal(totals.returns.lines, 1, "povrat se ne vidi u svojoj kofi");
  assert.equal(
    totals.net_effective_sales.lines, 7,
    "nerazresen povrat je usao u neto prodaju",
  );
});

test("prazan assignment daje prazan ledger, nikad ceo promet", async (t) => {
  if (guard(t)) return;
  const { ledgerTotals, resolveLedgerScope } = await import("@/lib/ledger/effective-sales");
  await ingestMapped();

  const scope = await resolveLedgerScope(asUser(rep));
  assert.deepEqual(scope.customerIds, []);
  const totals = await ledgerTotals(scope);
  assert.equal(totals.gross_sales.lines, 0);
  assert.equal(totals.net_effective_sales.amount, "0");
});

test("komercijalista vidi samo dodeljenog kupca", async (t) => {
  if (guard(t)) return;
  const { ledgerTotals, resolveLedgerScope } = await import("@/lib/ledger/effective-sales");
  await ingestMapped();

  const [drugi] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${randomUUID().slice(0,6)}`}, 'QA Drugi') RETURNING id`;
  await db.sql`INSERT INTO customer_assignments (user_id, customer_id) VALUES (${rep.id}, ${drugi.id})`;

  const scope = await resolveLedgerScope(asUser(rep));
  const totals = await ledgerTotals(scope);
  assert.equal(totals.gross_sales.lines, 0, "vidi promet nedodeljenog kupca");

  // Gazda kroz capability vidi sve.
  const owner = await resolveLedgerScope(asUser({ ...rep, role: "gazda" }));
  assert.equal(owner.customerIds, null);
  assert.equal((await ledgerTotals(owner)).gross_sales.lines, 7);
});

test("kupac vidi iskljucivo svoju firmu", async (t) => {
  if (guard(t)) return;
  const { customerLedgerScope, ledgerTotals } = await import("@/lib/ledger/effective-sales");
  await ingestMapped();

  const [drugi] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${randomUUID().slice(0,6)}`}, 'QA Drugi') RETURNING id`;

  assert.equal((await ledgerTotals(customerLedgerScope(customerId))).gross_sales.lines, 7);
  assert.equal((await ledgerTotals(customerLedgerScope(drugi.id))).gross_sales.lines, 0);
  assert.throws(() => customerLedgerScope(""), /bez customer_id/);
});

test("poslednja fakturisana cena dolazi iz ledgera i nosi datum", async (t) => {
  if (guard(t)) return;
  const { customerLedgerScope, lastInvoicedPrice } = await import("@/lib/ledger/effective-sales");
  await ingestMapped();

  const found = await lastInvoicedPrice(customerLedgerScope(customerId), {
    customerId, articleCode: "900001",
  });
  assert.ok(found, "cena nije nadjena");
  assert.match(found.issuedOn, /^\d{4}-\d{2}-\d{2}$/);

  // Tudji kupac ne dobija nista.
  const [drugi] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${randomUUID().slice(0,6)}`}, 'QA Treci') RETURNING id`;
  assert.equal(
    await lastInvoicedPrice(customerLedgerScope(drugi.id), { customerId, articleCode: "900001" }),
    null,
  );
});

test("korektivni dokumenti bez veze imaju svoj red, u opsegu korisnika", async (t) => {
  if (guard(t)) return;
  const { unlinkedCorrectiveDocuments } = await import("@/lib/ledger/effective-sales");

  await ingestMapped();
  const mine = customerId;
  const [other] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac 2') RETURNING id`;

  await manualInvoice(mine, "povrat_robe", "2026-04-01", "K1");
  await manualInvoice(mine, "storno", "2026-04-02", "K2");
  await manualInvoice(other.id, "povrat_robe", "2026-04-04", "K3");

  const moji = await unlinkedCorrectiveDocuments({ customerIds: [mine] });
  assert.equal(moji.length, 2, "faktura je usla u red korektivnih");
  assert.deepEqual(
    moji.map((r) => r.bucket).sort(),
    ["cancellations", "returns"],
  );

  // Prodaja NE ulazi u ovaj red, a tudji povrat se ne vidi.
  assert.ok(!moji.some((r) => r.bucket === "gross_sales"), "faktura je usla u red");
  assert.ok(!moji.some((r) => r.issuedOn === "2026-04-04"), "tudji dokument je vidljiv");

  // Bez opsega nema nijednog reda.
  assert.equal((await unlinkedCorrectiveDocuments({ customerIds: [] })).length, 0);
});

test("C-1: dva izvorna dokumenta na istu fakturu — baza odbija, promet se ne udvostrucuje", async (t) => {
  if (guard(t)) return;
  const first = await ingestMapped();

  const [{ pre }] = await db.sql<{ pre: number }[]>`
    SELECT count(*)::int AS pre FROM effective_sales_ledger`;
  assert.equal(pre, 7);

  /*
   * Pokusaj da se ista faktura zakaci za jos jedan izvorni dokument.
   *
   * Ledger spaja fakture i izvorne dokumente preko `invoice_id`, pa bi drugi
   * red udvostrucio SVAKI red te fakture — i to tiho, kao veci promet.
   * Pre migracije 0022 ovaj upis je prolazio i ledger je skakao na 14.
   */
  await assert.rejects(
    () => db.sql`
      INSERT INTO source_documents
        (file_hash, file_name, page_count, line_count, issuer_code,
         business_document_type, business_document_number, external_partner_code,
         document_date, parser_version, validation_status, revision_status,
         manual_review, invoice_id)
      SELECT ${randomUUID().replace(/-/g, "")}, 'drugi.pdf', page_count, line_count,
             issuer_code, business_document_type, business_document_number,
             external_partner_code, document_date, parser_version, 'valid',
             'original', 'not_required', invoice_id
        FROM source_documents WHERE id = ${first.sourceDocumentId}`,
    /source_documents_invoice_key|duplicate key/i,
    "baza je dozvolila drugi izvorni dokument na istu fakturu",
  );

  const [{ post }] = await db.sql<{ post: number }[]>`
    SELECT count(*)::int AS post FROM effective_sales_ledger`;
  assert.equal(post, 7, "promet je udvostrucen");
});

test("zbir prometa je EGZAKTAN tekst iz baze, ne JS float", async (t) => {
  if (guard(t)) return;
  const { ledgerTotals } = await import("@/lib/ledger/effective-sales");
  await ingestMapped();

  /*
   * Iznos koji se u JS-u sabira postaje binarni float pre nego sto ga iko
   * vidi. Kako je ovaj modul jedini ulaz u promet, svaki kasniji potrosac bi
   * nasledio istu gresku — zato zbir racuna baza i vraca ga kao tekst.
   */
  const totals = await ledgerTotals({ customerIds: null });
  assert.equal(typeof totals.gross_sales.amount, "string");
  assert.equal(typeof totals.net_effective_sales.amount, "string");
  assert.match(totals.gross_sales.amount, /^-?\d+(\.\d+)?$/);

  // Egzaktno se poklapa sa zbirom koji baza vidi nad istim redovima.
  const [{ iz_baze }] = await db.sql<{ iz_baze: string }[]>`
    SELECT coalesce(sum(line_amount), 0)::text AS iz_baze
      FROM effective_sales_ledger WHERE enters_net`;
  assert.equal(totals.net_effective_sales.amount, iz_baze);
  assert.equal(totals.gross_sales.lines, 7);
});
