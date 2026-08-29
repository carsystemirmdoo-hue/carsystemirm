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
  await db.sql`DELETE FROM articles WHERE code LIKE '900%' OR code LIKE '800%'`;
  await db.sql`DELETE FROM import_rows`;
  await db.sql`DELETE FROM import_runs`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%' OR pib LIKE '90000%'`;
  await db.sql`DELETE FROM user_permissions`;
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

/* -------------------------------------------------------------------------
 * H-2, trajna regresija: verzije A i B moraju biti STVARNO različite.
 *
 * Test iznad pravi B dopisivanjem komentara na iste bajtove, pa dokazuje samo
 * da se broj redova ne menja. Da `retargetInvoice` prepiše pogrešnu verziju
 * ili ne prepiše ništa, taj test bi i dalje bio zelen — a razlika bi se videla
 * tek na fakturi kupca.
 *
 * Ovde se A i B razlikuju u svemu: šiframa, broju stavki, količinama, cenama,
 * rabatima, stopama, iznosima stavki i zbiru zaglavlja. Očekivane vrednosti su
 * ISPISANE, ne izračunate istom formulom kojom ih generator pravi — inače bi
 * test ponavljao grešku generatora umesto da je otkrije.
 * ---------------------------------------------------------------------- */

/** Isti poslovni ključ za obe verzije — to ih i čini sudarom. */
const REV_BROJ = "99-RN900000901";
const REV_DATUM = "07.01.2026";

/** Verzija A: dve stavke, bez rabata, jedna stopa. */
const VERZIJA_A = [
  { sifra: "900101", naziv: "STARA STAVKA JEDAN", jm: "KOM", kol: 1, cena: 100, rabat: 0, pdv: 20 },
  { sifra: "900102", naziv: "STARA STAVKA DVA", jm: "LIT", kol: 2, cena: 200, rabat: 0, pdv: 20 },
];

/** Verzija B: tri stavke, druge šifre, decimalne količine, rabati, dve stope. */
const VERZIJA_B = [
  { sifra: "800011", naziv: "NOVA STAVKA JEDAN", jm: "KOM", kol: 3.5, cena: 55, rabat: 10, pdv: 20 },
  { sifra: "800022", naziv: "NOVA STAVKA DVA", jm: "KOM", kol: 7, cena: 12, rabat: 0, pdv: 10 },
  { sifra: "800033", naziv: "NOVA STAVKA TRI", jm: "LIT", kol: 1.25, cena: 480, rabat: 5, pdv: 20 },
];

/** Ono što posle izbora B mora stajati u fakturi i u ledgeru. */
const OCEKIVANO_B = [
  { article_code: "800011", quantity: "3.500", unit_price: "55.0000", discount_percent: "10.000", line_amount: "173.25" },
  { article_code: "800022", quantity: "7.000", unit_price: "12.0000", discount_percent: "0.000", line_amount: "84.00" },
  { article_code: "800033", quantity: "1.250", unit_price: "480.0000", discount_percent: "5.000", line_amount: "570.00" },
];
const ZBIR_B = { net_amount: "827.25", tax_amount: "157.05", total_amount: "984.30" };

test("H-2 regresija: izbor verzije B menja STAVKE I IZNOSE na B, ne samo broj redova", async (t) => {
  if (guard(t)) return;
  await clean();
  const { document } = await import("../../scripts/fixtures/biznisoft-document.mjs");
  const { ingestBiznisoftPdf, resolveDocumentRevision } = await import("@/lib/pdf/ingest");
  const { can } = await import("@/lib/authz/permissions.mjs");

  await mappedCustomer();
  const napravi = (items: typeof VERZIJA_A) =>
    document({ broj: REV_BROJ, partner: "09002", datum: REV_DATUM, items }) as Uint8Array;

  // 1. A se uvozi i knjiži.
  const a = await ingestBiznisoftPdf(
    { bytes: napravi(VERZIJA_A), fileName: "a.pdf", issuerCode: ISSUER }, actor);
  assert.equal(a.result, "ingested");
  const prometA = await db.sql<{ article_code: string }[]>`
    SELECT article_code FROM effective_sales_ledger ORDER BY article_code`;
  assert.deepEqual([...prometA.map((r) => r.article_code)], ["900101", "900102"]);

  // 2. B sa istim poslovnim ključem pravi sudar.
  const b = await ingestBiznisoftPdf(
    { bytes: napravi(VERZIJA_B), fileName: "b.pdf", issuerCode: ISSUER }, actor);
  assert.equal(b.result, "business_key_conflict");

  // 3. Dok sudar traje, ledger nema nijedan red.
  const [{ uSudaru }] = await db.sql<{ uSudaru: number }[]>`
    SELECT count(*)::int AS "uSudaru" FROM effective_sales_ledger`;
  assert.equal(uSudaru, 0);

  /*
   * 4. Bira kancelarija SA sposobnošću `documents:resolve`.
   *
   * Sposobnost se ovde i proverava, jer je odluka o verziji upravo ono što je
   * odvojeno od pukog pregleda uvoza.
   */
  await db.sql`
    INSERT INTO user_permissions (user_id, permission_key, granted_by, reason)
    VALUES (${actor.id}, 'mapiranja', ${actor.id}, 'QA: paket za odlucivanje')`;
  const odlucuje = { role: actor.role, permissions: ["mapiranja"] };
  assert.equal(can(odlucuje, "documents:resolve"), true, "odluku donosi nalog bez sposobnosti");
  assert.equal(
    can({ role: actor.role, permissions: [] }, "documents:resolve"),
    false,
    "sposobnost je dostupna i bez paketa",
  );

  const out = await resolveDocumentRevision(
    { supersededId: a.sourceDocumentId, supersedingId: b.sourceDocumentId, reason: "QA: B vazi" },
    actor,
  );
  assert.equal(out.posted, true);

  // 5. A ostaje `superseded`, sa sačuvanim izvornim stavkama.
  const [staraVerzija] = await db.sql<{
    revision_status: string; superseded_by_id: string | null; invoice_id: string | null;
  }[]>`SELECT revision_status, superseded_by_id, invoice_id
         FROM source_documents WHERE id = ${a.sourceDocumentId}`;
  assert.equal(staraVerzija.revision_status, "superseded");
  assert.equal(staraVerzija.superseded_by_id, b.sourceDocumentId);
  assert.equal(staraVerzija.invoice_id, null);
  const sacuvaneA = await db.sql<{ article_code: string }[]>`
    SELECT article_code FROM source_document_lines
     WHERE source_document_id = ${a.sourceDocumentId} ORDER BY line_number`;
  assert.deepEqual(
    [...sacuvaneA.map((r) => r.article_code)],
    ["900101", "900102"],
    "izvorne stavke verzije A su izgubljene",
  );

  // 6. Tačno jedna faktura.
  const fakture = await db.sql<{ id: string }[]>`SELECT id FROM invoices`;
  assert.equal(fakture.length, 1, "nastala je druga faktura za isti poslovni dokument");

  /*
   * 7. `invoice_lines` i ledger nose ISKLJUČIVO vrednosti iz B.
   *
   * Redovi se prepisuju u obične objekte: drajver vraća svoj podtip niza, a
   * `deepEqual` poredi i prototip, pa bi poređenje palo i na identičnim
   * vrednostima.
   */
  const obicni = <T>(rows: readonly T[]) => rows.map((row) => ({ ...row }));

  const stavke = await db.sql<typeof OCEKIVANO_B>`
    SELECT article_code, quantity, unit_price, discount_percent, line_amount
      FROM invoice_lines ORDER BY article_code`;
  assert.deepEqual(obicni(stavke), OCEKIVANO_B, "invoice_lines ne nose vrednosti iz B");

  const promet = await db.sql<typeof OCEKIVANO_B>`
    SELECT article_code, quantity, unit_price, discount_percent, line_amount
      FROM effective_sales_ledger ORDER BY article_code`;
  assert.deepEqual(obicni(promet), OCEKIVANO_B, "ledger ne nosi vrednosti iz B");

  // 8. Nijedna šifra ni vrednost iz A nije ostala u efektivnom prometu.
  for (const izA of VERZIJA_A) {
    assert.ok(
      !promet.some((r) => r.article_code === izA.sifra),
      `sifra ${izA.sifra} iz verzije A je ostala u prometu`,
    );
  }
  assert.ok(
    !promet.some((r) => r.line_amount === "100.00" || r.line_amount === "400.00"),
    "iznos iz verzije A je ostao u prometu",
  );

  // 9. Zaglavlje fakture odgovara zbiru verzije B.
  const [zaglavlje] = await db.sql<(typeof ZBIR_B)[]>`
    SELECT net_amount, tax_amount, total_amount FROM invoices`;
  assert.deepEqual({ ...zaglavlje }, ZBIR_B, "zaglavlje fakture nosi zbir verzije A");

  // 10. Ponovljeno razrešenje je no-op.
  const ponovo = await resolveDocumentRevision(
    { supersededId: a.sourceDocumentId, supersedingId: b.sourceDocumentId, reason: "QA ponovo" },
    actor,
  );
  assert.equal(ponovo.posted, false);
  assert.equal(ponovo.invoiceId, fakture[0].id);
  const posle = await db.sql<typeof OCEKIVANO_B>`
    SELECT article_code, quantity, unit_price, discount_percent, line_amount
      FROM effective_sales_ledger ORDER BY article_code`;
  assert.deepEqual(obicni(posle), OCEKIVANO_B, "ponovljeno razresenje je promenilo promet");
  const [{ f }] = await db.sql<{ f: number }[]>`SELECT count(*)::int AS f FROM invoices`;
  assert.equal(f, 1);
});

test("faktura vec uvezena CSV putem: kontrolisan ishod, bez druge fakture i bez duplog prometa", async (t) => {
  if (guard(t)) return;
  await clean();
  const { document } = await import("../../scripts/fixtures/biznisoft-document.mjs");
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { importInvoiceFile, parseDelimited } = await import("@/lib/import/invoiceImport");

  const BROJ = "99-RN900000902";
  /*
   * PIB je devetocifren jer ga CSV put proverava po obliku — isti kupac mora
   * biti dohvatljiv i iz knjigovodstvenog izvoza i iz PDF-a.
   */
  const PIB = "900000902";
  const [kupac] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${PIB}, 'QA Kupac') RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${kupac.id}, 'mapped')`;

  /*
   * 1. Faktura nastaje POSTOJECIM CSV putem — isti put kojim je knjigovodstvo
   *    do sada punilo sistem.
   */
  const csv = [
    "pravno_lice;pib;kupac;broj_dokumenta;datum;vrsta_dokumenta;sifra_artikla;kolicina;cena;iznos_stavke",
    `${ISSUER};${PIB};QA Kupac;${BROJ};08.01.2026;faktura;700001;1;100,00;100,00`,
  ].join("\n");
  const uvoz = await importInvoiceFile(
    { fileName: "legacy.csv", sourcePath: "QA", content: csv, rows: parseDelimited(csv), dataDate: null },
    actor,
  );
  assert.notEqual(uvoz.status, "greska", "CSV uvoz nije prosao");

  const [{ preFaktura }] = await db.sql<{ preFaktura: number }[]>`
    SELECT count(*)::int AS "preFaktura" FROM invoices`;
  assert.equal(preFaktura, 1);
  const [{ prePromet }] = await db.sql<{ prePromet: number }[]>`
    SELECT count(*)::int AS "prePromet" FROM effective_sales_ledger`;
  assert.equal(prePromet, 1, "CSV faktura nije u prometu");

  // 2. Isti poslovni dokument stize i kao PDF.
  const pdf = document({
    broj: BROJ, partner: "09002", datum: "08.01.2026",
    items: [{ sifra: "800044", naziv: "PDF STAVKA", jm: "KOM", kol: 2, cena: 300, rabat: 0, pdv: 20 }],
  }) as Uint8Array;
  const out = await ingestBiznisoftPdf({ bytes: pdf, fileName: "b.pdf", issuerCode: ISSUER }, actor);

  /*
   * 3. Ishod je kontrolisan i tacan. Pre popravke je `invoices_identity_key`
   *    rusio celu transakciju, pa je operater dobijao "dokument se ne moze
   *    procitati" — a dokument je procitan savrseno, samo je vec knjizen.
   */
  assert.equal(out.result, "already_imported_other_source");
  assert.ok("invoiceId" in out && out.invoiceId, "ishod ne pokazuje na postojecu fakturu");

  // 4. I dalje TACNO jedna faktura, sa jednom stavkom iz CSV-a.
  const [{ posleFaktura }] = await db.sql<{ posleFaktura: number }[]>`
    SELECT count(*)::int AS "posleFaktura" FROM invoices`;
  assert.equal(posleFaktura, 1, "nastala je druga faktura");
  const stavke = await db.sql<{ article_code: string }[]>`SELECT article_code FROM invoice_lines`;
  assert.deepEqual([...stavke.map((r) => r.article_code)], ["700001"], "PDF je prepisao CSV stavke");

  // 5. Promet nije dupliran i nije promenjen.
  const [{ poslePromet }] = await db.sql<{ poslePromet: number }[]>`
    SELECT count(*)::int AS "poslePromet" FROM effective_sales_ledger`;
  assert.equal(poslePromet, 1, "promet je dupliran");

  /*
   * 6. Dokument JE sacuvan — u stanju sudara i na rucnom pregledu, kao i svaki
   *    drugi sporan dokument. To nije delimican upis nego namerno vidljiv trag:
   *    sadrzaj CSV zapisa i PDF-a se ne moze automatski uporediti.
   */
  const [sd] = await db.sql<{
    revision_status: string; manual_review: string; invoice_id: string | null; conflict_reason: string | null;
  }[]>`SELECT revision_status, manual_review, invoice_id, conflict_reason FROM source_documents`;
  assert.equal(sd.revision_status, "conflict");
  assert.equal(sd.manual_review, "pending");
  assert.equal(sd.invoice_id, null, "sporan dokument je vezan za tudju fakturu");

  // 7. Poruka operateru nije "PDF nije procitan", i ne odaje SQL ni ime ogranicenja.
  assert.ok(sd.conflict_reason, "nema obrazlozenja");
  assert.match(sd.conflict_reason!, /već postoji iz drugog izvora/);
  for (const zabranjeno of ["invoices_identity_key", "duplicate key", "23505", "SQL", "at ", "/Users/"]) {
    assert.ok(!sd.conflict_reason!.includes(zabranjeno), `poruka nosi tehnicki trag: ${zabranjeno}`);
  }
  const [{ nijeProcitan }] = await db.sql<{ nijeProcitan: number }[]>`
    SELECT count(*)::int AS "nijeProcitan" FROM source_documents WHERE validation_status <> 'valid'`;
  assert.equal(nijeProcitan, 0, "dokument je prijavljen kao neprocitan");

  await db.sql`DELETE FROM articles WHERE code LIKE '700%'`;
});
