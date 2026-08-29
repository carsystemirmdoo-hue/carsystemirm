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
const ISSUER = "QA01";

const FIXTURE = (n: string) => new URL(`../../fixtures/dev/biznisoft/${n}`, import.meta.url);
const bytesOf = async (n: string) => new Uint8Array(await readFile(FIXTURE(n)));

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const a = await seedAccounts(db, [{ key: "office", role: "kancelarija" }]);
  actor = { id: a.office.id, name: a.office.name, role: a.office.role };
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
    await db.sql`DELETE FROM articles WHERE code LIKE '9000%'`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

async function clean() {
  await db.sql`DELETE FROM source_document_lines`;
  await db.sql`DELETE FROM source_documents`;
  await db.sql`DELETE FROM invoice_lines`;
  await db.sql`DELETE FROM invoices`;
  await db.sql`DELETE FROM customer_external_identifiers`;
  // Uvoz sam upisuje artikle u registar, pa ih i cisti.
  await db.sql`DELETE FROM article_catalog_mappings`;
  await db.sql`DELETE FROM articles WHERE code LIKE '9000%'`;
}

test("validan dokument bez mapiranog kupca NE pravi fakturu", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  await clean();

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("jedna-stavka.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "awaiting_customer_mapping");

  const [{ count }] = await db.sql<{ count: number }[]>`SELECT count(*)::int AS count FROM invoices`;
  assert.equal(count, 0, "nemapiran kupac je ipak napravio fakturu");

  // Sifra ulazi u red za rucno razresavanje.
  const [ident] = await db.sql<{ status: string; external_partner_code: string }[]>`
    SELECT status, external_partner_code FROM customer_external_identifiers`;
  assert.equal(ident.status, "unmapped");
  assert.equal(ident.external_partner_code, "09001");

  // Dokument je i dalje vidljiv, sa stavkama.
  const [{ lines }] = await db.sql<{ lines: number }[]>`
    SELECT count(*)::int AS lines FROM source_document_lines`;
  assert.equal(lines, 1);
});

test("mapiran kupac: dokument se knjizi u postojece fakture", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  await clean();

  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${randomUUID().slice(0,6)}`}, 'QA Kupac') RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${customer.id}, 'mapped')`;

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "b.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "ingested");

  const [inv] = await db.sql<{ id: string; customer_id: string }[]>`
    SELECT id, customer_id FROM invoices`;
  assert.equal(inv.customer_id, customer.id);
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM invoice_lines WHERE invoice_id = ${inv.id}`;
  assert.equal(n, 7);

  // Izvorni dokument je povezan sa fakturom.
  const [sd] = await db.sql<{ invoice_id: string }[]>`SELECT invoice_id FROM source_documents`;
  assert.equal(sd.invoice_id, inv.id);
});

test("ponovni uvoz ISTOG fajla je no-op sa eksplicitnim duplikatom", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  await clean();

  const bytes = await bytesOf("jedna-stavka.pdf");
  const first = await ingestBiznisoftPdf(
    { bytes, fileName: "x.pdf", issuerCode: ISSUER }, actor);
  // Isti sadrzaj, DRUGO ime — ime ne sme uticati.
  const second = await ingestBiznisoftPdf(
    { bytes, fileName: "preimenovano.pdf", issuerCode: ISSUER }, actor);

  assert.equal(second.result, "duplicate_file");
  assert.equal(second.sourceDocumentId, first.sourceDocumentId);

  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM source_documents`;
  assert.equal(count, 1, "duplikat je napravio drugi zapis");

  const [audit] = await db.sql<{ action: string; entity_label: string }[]>`
    SELECT action, entity_label FROM audit_log
     WHERE entity_type = 'Izvorni dokument' ORDER BY id DESC LIMIT 1`;
  assert.match(audit.action, /duplikat/i);
  // Redigovano: bez celog broja dokumenta.
  assert.match(audit.entity_label, /^sd:[0-9a-f]{12}/);
});

test("neuskladjen zbir ide u karantin, bez ijednog reda prometa", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  await clean();

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("zbir-se-ne-poklapa.pdf"), fileName: "c.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "quarantined");

  const [{ count }] = await db.sql<{ count: number }[]>`SELECT count(*)::int AS count FROM invoices`;
  assert.equal(count, 0);

  const [sd] = await db.sql<{ validation_status: string; manual_review: string }[]>`
    SELECT validation_status, manual_review FROM source_documents`;
  assert.equal(sd.validation_status, "totals_mismatch");
  assert.equal(sd.manual_review, "pending");
});

test("nastavak tabele zavrsava u unsupported_requires_sample", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  await clean();

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("nastavak-tabele.pdf"), fileName: "d.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "quarantined");
  const [sd] = await db.sql<{ validation_status: string }[]>`
    SELECT validation_status FROM source_documents`;
  assert.equal(sd.validation_status, "unsupported_requires_sample");
});

test("baza odbija fakturu vezanu za nevalidan dokument", async (t) => {
  if (guard(t)) return;
  await clean();
  await assert.rejects(
    () => db.sql`
      INSERT INTO source_documents
        (file_hash, file_name, page_count, issuer_code, business_document_type,
         parser_version, validation_status, invoice_id)
      VALUES ('deadbeef', 'x.pdf', 1, ${ISSUER}, 'faktura', 'p1', 'totals_mismatch',
              gen_random_uuid())`,
    /source_documents_invoice_needs_valid_ck|violates foreign key/,
  );
});

test("dokument ne moze sam sebe da zameni", async (t) => {
  if (guard(t)) return;
  await clean();
  const [row] = await db.sql<{ id: string }[]>`
    INSERT INTO source_documents
      (file_hash, file_name, page_count, issuer_code, business_document_type,
       parser_version, validation_status)
    VALUES ('cafe0001', 'y.pdf', 1, ${ISSUER}, 'faktura', 'p1', 'valid')
    RETURNING id`;
  await assert.rejects(
    () => db.sql`UPDATE source_documents SET supersedes_id = id WHERE id = ${row.id}`,
    /source_documents_no_self_revision_ck/,
  );
});

test("M-3: dva ISTOVREMENA uvoza istog fajla — jedan pobedjuje, drugi je uredan duplikat", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  await clean();

  const bytes = await bytesOf("jedna-stavka.pdf");

  /*
   * Provera duplikata na pocetku vidi stanje PRE svog upisa, pa oba paralelna
   * poziva prodju kroz nju. Jedinstveni indeks potom propusta tacno jedan.
   *
   * Pre popravke je gubitnik dobijao sirovu Postgres gresku i rusio ceo grupni
   * uvoz; sada dobija isti uredan odgovor kao da je stigao sekundu kasnije.
   */
  const ishodi = await Promise.all([
    ingestBiznisoftPdf({ bytes, fileName: "a.pdf", issuerCode: ISSUER }, actor),
    ingestBiznisoftPdf({ bytes, fileName: "b.pdf", issuerCode: ISSUER }, actor),
  ]);

  const rezultati = ishodi.map((o) => o.result).sort();
  assert.deepEqual(rezultati, ["awaiting_customer_mapping", "duplicate_file"]);

  // Oba pokazuju na ISTI dokument, i taj dokument je jedini.
  assert.equal(ishodi[0].sourceDocumentId, ishodi[1].sourceDocumentId);
  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM source_documents`;
  assert.equal(count, 1, "istovremeni uvoz je napravio dva dokumenta");

  // Stavke se ne udvostrucuju.
  const [{ lines }] = await db.sql<{ lines: number }[]>`
    SELECT count(*)::int AS lines FROM source_document_lines`;
  assert.equal(lines, 1);
});
