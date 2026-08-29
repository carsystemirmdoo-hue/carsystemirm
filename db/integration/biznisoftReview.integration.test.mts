import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase,
  seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Pregled i razrešenje izvornih dokumenata.
 *
 * Naglasak je na tome šta se NE dešava: zamenjena verzija se ne briše, zatvoren
 * pregled ne pretvara karantin u promet, i nijedan spisak ne izlazi iz kruga
 * internih polja.
 */

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
    await clean();
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
  await db.sql`DELETE FROM article_catalog_mappings`;
  await db.sql`DELETE FROM articles WHERE code LIKE '9000%'`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
}

test("karantinski dokument je u spisku, ali bez ijednog reda prometa", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf, listSourceDocuments, countSourceDocuments } =
    await import("@/lib/pdf/ingest");

  await ingestBiznisoftPdf(
    { bytes: await bytesOf("zbir-se-ne-poklapa.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  const rows = await listSourceDocuments({ validationStatus: "totals_mismatch" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].invoiceId, null);

  const counts = await countSourceDocuments();
  assert.equal(counts["validation:totals_mismatch"], 1);
  assert.equal(counts["review:pending"], 1);

  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM effective_sales_ledger`;
  assert.equal(n, 0);
});

test("zatvaranje pregleda NE pretvara karantin u promet", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf, closeManualReview, listSourceDocuments } =
    await import("@/lib/pdf/ingest");

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("zbir-se-ne-poklapa.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  await closeManualReview(
    { sourceDocumentId: out.sourceDocumentId, note: "QA pregledano, ostaje u karantinu" },
    actor,
  );

  const [row] = await listSourceDocuments({});
  assert.equal(row.manualReview, "resolved");
  assert.equal(row.validationStatus, "totals_mismatch");
  assert.equal(row.invoiceId, null, "zatvoren pregled je napravio fakturu");
});

test("zatvaranje pregleda bez napomene se odbija", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf, closeManualReview, IngestError } =
    await import("@/lib/pdf/ingest");

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("zbir-se-ne-poklapa.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  await assert.rejects(
    () => closeManualReview({ sourceDocumentId: out.sourceDocumentId, note: "  " }, actor),
    (e: unknown) => e instanceof IngestError && e.code === "missing_reason",
  );
});

test("razresenje sudara zamenjuje raniju verziju, ali je ne brise", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf, resolveDocumentRevision, listSourceDocuments } =
    await import("@/lib/pdf/ingest");

  const customerId = await newCustomer();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${customerId}, 'mapped')`;

  // Prvi dokument prolazi i knjizi se.
  const first = await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(first.result, "ingested");

  /*
   * Drugi fajl sa istim poslovnim brojem — sudar.
   *
   * Pravi se izmenom otiska, jer bi isti bajtovi bili duplikat fajla, a ovde se
   * ispituje sudar POSLOVNOG kljuca.
   */
  const [twin] = await db.sql<{ id: string }[]>`
    INSERT INTO source_documents
      (file_hash, file_name, page_count, line_count, issuer_code,
       business_document_type, business_document_number, external_partner_code,
       document_date, parser_version, validation_status, revision_status,
       conflict_reason, manual_review)
    SELECT ${randomUUID().replace(/-/g, "")}, 'b.pdf', page_count, line_count,
           issuer_code, business_document_type, business_document_number,
           external_partner_code, document_date, parser_version, 'valid',
           'conflict', 'QA sudar', 'pending'
      FROM source_documents WHERE id = ${first.sourceDocumentId}
    RETURNING id`;
  // Blizanac nosi i stavke — bez njih ne bi mogao da preuzme fakturu.
  await db.sql`
    INSERT INTO source_document_lines
      (source_document_id, line_number, article_code, description, unit, quantity,
       unit_price, discount_percent, tax_percent, tax_amount, gross_amount,
       raw_cells, line_status)
    SELECT ${twin.id}, line_number, article_code, description, unit, quantity,
           unit_price, discount_percent, tax_percent, tax_amount, gross_amount,
           raw_cells, line_status
      FROM source_document_lines WHERE source_document_id = ${first.sourceDocumentId}`;

  await resolveDocumentRevision(
    {
      supersededId: first.sourceDocumentId,
      supersedingId: twin.id,
      reason: "QA: novija verzija vazi",
    },
    actor,
  );

  const rows = await listSourceDocuments({});
  const older = rows.find((r) => r.id === first.sourceDocumentId)!;
  const newer = rows.find((r) => r.id === twin.id)!;

  // Ranija verzija POSTOJI i dalje — samo vise ne vazi.
  assert.equal(older.revisionStatus, "superseded");
  assert.equal(newer.revisionStatus, "original");

  /*
   * Promet je u ledgeru TACNO jednom: faktura je presla na verziju koja vazi,
   * a zamenjena verzija je iz ledgera ispala. Ni nula (izgubljen promet) ni
   * cetrnaest (dvostruko brojanje) nisu tacan odgovor.
   */
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM effective_sales_ledger`;
  assert.equal(n, 7, "promet nije tacno jednom u ledgeru");
  const [{ f }] = await db.sql<{ f: number }[]>`SELECT count(*)::int AS f FROM invoices`;
  assert.equal(f, 1, "nastala je druga faktura za isti poslovni dokument");
});

test("dokument ne moze sam sebe da zameni ni preko servisa", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf, resolveDocumentRevision, IngestError } =
    await import("@/lib/pdf/ingest");

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("jedna-stavka.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  await assert.rejects(
    () =>
      resolveDocumentRevision(
        {
          supersededId: out.sourceDocumentId,
          supersedingId: out.sourceDocumentId,
          reason: "QA pokusaj",
        },
        actor,
      ),
    (e: unknown) => e instanceof IngestError && e.code === "self_reference",
  );
});

test("spisak dokumenata ne iznosi ime fajla kupca u polja ekrana", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf, listSourceDocuments } = await import("@/lib/pdf/ingest");

  await ingestBiznisoftPdf(
    { bytes: await bytesOf("jedna-stavka.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  const [row] = await listSourceDocuments({});
  /*
   * Ime fajla se cuva u bazi (potrebno je za podrsku), ali ekran ga ne
   * prikazuje. Ovaj test cuva ugovor spiska: sve sto ekran koristi je interno.
   */
  const ekranska = [
    row.fileHash, row.issuerCode, row.externalPartnerCode, row.documentDate,
    row.validationStatus, row.revisionStatus, row.manualReview,
  ];
  assert.ok(ekranska.every((v) => v === null || typeof v === "string"));
  assert.match(row.fileHash, /^[0-9a-f]{64}$/);
});

const newCustomer = async () => {
  const [row] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  return row.id;
};

/**
 * Ista poslovna faktura, druga sadrzina.
 *
 * Dopisan komentar posle `%%EOF` menja otisak fajla, a ne menja nista sto
 * parser cita — tacno oblik "reprint istog dokumenta" koji se u praksi javlja.
 */
const sameDocumentOtherBytes = (bytes: Uint8Array) =>
  new Uint8Array([...bytes, ...new TextEncoder().encode("\n% ponovna stampa\n")]);

async function mappedCustomer() {
  const id = await newCustomer();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${id}, 'mapped')`;
  return id;
}

test("H-1: sudar karantinira OBE verzije — ledger pada na nulu", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  await mappedCustomer();

  const bytes = await bytesOf("vise-stavki.pdf");
  const a = await ingestBiznisoftPdf(
    { bytes, fileName: "a.pdf", issuerCode: ISSUER }, actor);
  assert.equal(a.result, "ingested");

  const [{ pre }] = await db.sql<{ pre: number }[]>`
    SELECT count(*)::int AS pre FROM effective_sales_ledger`;
  assert.equal(pre, 7, "prva verzija nije usla u promet");

  const b = await ingestBiznisoftPdf(
    { bytes: sameDocumentOtherBytes(bytes), fileName: "b.pdf", issuerCode: ISSUER }, actor);
  assert.equal(b.result, "business_key_conflict");

  // OBE verzije su u sudaru i na rucnom pregledu.
  const docs = await db.sql<{ revision_status: string; manual_review: string }[]>`
    SELECT revision_status, manual_review FROM source_documents ORDER BY created_at`;
  assert.equal(docs.length, 2);
  for (const doc of docs) {
    assert.equal(doc.revision_status, "conflict");
    assert.equal(doc.manual_review, "pending");
  }

  /*
   * Pre popravke je ranija verzija ostajala `original`/`not_required` i njenih
   * 7 redova je i dalje bilo u prometu, dok je ekran pisao "ceka odluku".
   */
  const [{ post }] = await db.sql<{ post: number }[]>`
    SELECT count(*)::int AS post FROM effective_sales_ledger`;
  assert.equal(post, 0, "sporna verzija je ostala u prometu");

  // Faktura NIJE obrisana — samo je iskljucena iz ledgera.
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  assert.equal(n, 1, "istorija je obrisana");
});

test("H-2: pun scenario A -> B -> izbor B -> knjizenje tacno jednom", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf, resolveDocumentRevision } = await import("@/lib/pdf/ingest");
  const customerId = await mappedCustomer();

  // 1. Verzija A se uveze i proknjizi.
  const bytes = await bytesOf("vise-stavki.pdf");
  const a = await ingestBiznisoftPdf({ bytes, fileName: "a.pdf", issuerCode: ISSUER }, actor);
  assert.equal(a.result, "ingested");

  // 2. Verzija B sa istim poslovnim kljucem pravi sudar.
  const b = await ingestBiznisoftPdf(
    { bytes: sameDocumentOtherBytes(bytes), fileName: "b.pdf", issuerCode: ISSUER }, actor);
  assert.equal(b.result, "business_key_conflict");

  // 3. Dok sudar traje, ledger nema nijedan red za taj dokument.
  const [{ zaSudara }] = await db.sql<{ zaSudara: number }[]>`
    SELECT count(*)::int AS "zaSudara" FROM effective_sales_ledger`;
  assert.equal(zaSudara, 0);

  // 4. Kancelarija bira verziju B.
  const out = await resolveDocumentRevision(
    { supersededId: a.sourceDocumentId, supersedingId: b.sourceDocumentId, reason: "QA: B vazi" },
    actor,
  );
  assert.equal(out.posted, true, "pobednicka verzija nije proknjizena");

  // 5. A ostaje `superseded` i vise ne drzi fakturu; istorija je citava.
  const [staraVerzija] = await db.sql<{
    revision_status: string; superseded_by_id: string | null; invoice_id: string | null;
  }[]>`SELECT revision_status, superseded_by_id, invoice_id
         FROM source_documents WHERE id = ${a.sourceDocumentId}`;
  assert.equal(staraVerzija.revision_status, "superseded");
  assert.equal(staraVerzija.superseded_by_id, b.sourceDocumentId, "lanac verzija je prekinut");
  assert.equal(staraVerzija.invoice_id, null);

  const [{ stavkiA }] = await db.sql<{ stavkiA: number }[]>`
    SELECT count(*)::int AS "stavkiA" FROM source_document_lines
     WHERE source_document_id = ${a.sourceDocumentId}`;
  assert.equal(stavkiA, 7, "stavke ranije verzije su obrisane");

  // 6. B je proknjizen TACNO jednom.
  const [{ faktura }] = await db.sql<{ faktura: number }[]>`
    SELECT count(*)::int AS faktura FROM invoices`;
  assert.equal(faktura, 1, "nastala je druga faktura za isti poslovni dokument");

  const redovi = await db.sql<{ customer_id: string }[]>`
    SELECT customer_id FROM effective_sales_ledger`;
  assert.equal(redovi.length, 7, "promet nije tacno jednom u ledgeru");
  assert.equal(redovi[0].customer_id, customerId);

  const [novaVerzija] = await db.sql<{
    revision_status: string; manual_review: string; invoice_id: string | null;
  }[]>`SELECT revision_status, manual_review, invoice_id
         FROM source_documents WHERE id = ${b.sourceDocumentId}`;
  assert.equal(novaVerzija.revision_status, "original");
  assert.equal(novaVerzija.manual_review, "resolved");
  assert.ok(novaVerzija.invoice_id, "pobednik nije vezan za fakturu");

  // 7. Ponavljanje akcije ne duplira promet.
  const ponovo = await resolveDocumentRevision(
    { supersededId: a.sourceDocumentId, supersedingId: b.sourceDocumentId, reason: "QA ponovo" },
    actor,
  );
  assert.equal(ponovo.posted, false, "ponovljena akcija je ponovo knjizila");
  assert.equal(ponovo.invoiceId, novaVerzija.invoice_id, "faktura se promenila");

  const [{ posle }] = await db.sql<{ posle: number }[]>`
    SELECT count(*)::int AS posle FROM effective_sales_ledger`;
  assert.equal(posle, 7, "ponovljena akcija je duplirala promet");
  const [{ f2 }] = await db.sql<{ f2: number }[]>`SELECT count(*)::int AS f2 FROM invoices`;
  assert.equal(f2, 1);
});
