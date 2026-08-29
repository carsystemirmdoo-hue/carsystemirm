import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase,
  seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Mapiranje kupca i artikla nad uvezenim PDF-om.
 *
 * Sve je EXACT: šifra partnera i šifra artikla se porede znak po znak, sa
 * vodećim nulama. Nijedan test ovde ne dokazuje da fuzzy poklapanje radi —
 * dokazuju da ga nema, jer bi promet pogrešnog kupca bio nevidljiva greška.
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
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
}

const newCustomer = async () => {
  const [row] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  return row.id;
};

const identifierId = async (code: string) => {
  const [row] = await db.sql<{ id: string }[]>`
    SELECT id FROM customer_external_identifiers
     WHERE issuer_code = ${ISSUER} AND external_partner_code = ${code}`;
  return row?.id ?? null;
};

test("dokument koji je cekao mapiranje knjizi se tek kad covek povezе sifru", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf, postAwaitingMapping } = await import("@/lib/pdf/ingest");
  const { resolveExternalIdentifier } = await import("@/lib/commercial/identity-service");

  const first = await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(first.result, "awaiting_customer_mapping");

  const customerId = await newCustomer();
  const id = await identifierId("09002");
  assert.ok(id, "sifra nije usla u red za mapiranje");

  await resolveExternalIdentifier(
    { id, customerId, status: "mapped", reason: "QA potvrda mapiranja" },
    actor,
  );

  const out = await postAwaitingMapping(
    { issuerCode: ISSUER, externalPartnerCode: "09002" },
    actor,
  );
  assert.equal(out.posted.length, 1);
  assert.equal(out.failed.length, 0);

  const [inv] = await db.sql<{ id: string; customer_id: string }[]>`
    SELECT id, customer_id FROM invoices`;
  assert.equal(inv.customer_id, customerId);

  // Promet ulazi u ledger tacno jednom, i rucni pregled se zatvara.
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM effective_sales_ledger`;
  assert.equal(n, 7);
  const [sd] = await db.sql<{ manual_review: string }[]>`
    SELECT manual_review FROM source_documents`;
  assert.equal(sd.manual_review, "not_required");
});

test("ponovno knjizenje posle mapiranja ne pravi drugu fakturu", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf, postAwaitingMapping } = await import("@/lib/pdf/ingest");

  await ingestBiznisoftPdf(
    { bytes: await bytesOf("jedna-stavka.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );
  const customerId = await newCustomer();
  await db.sql`
    UPDATE customer_external_identifiers
       SET customer_id = ${customerId}, status = 'mapped'
     WHERE external_partner_code = '09001'`;

  const one = await postAwaitingMapping(
    { issuerCode: ISSUER, externalPartnerCode: "09001" },
    actor,
  );
  const two = await postAwaitingMapping(
    { issuerCode: ISSUER, externalPartnerCode: "09001" },
    actor,
  );

  assert.equal(one.posted.length, 1);
  assert.equal(two.posted.length, 0, "isti dokument je proknjizen dvaput");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  assert.equal(n, 1);
});

test("knjizenje bez mapirane sifre se odbija i ne dira promet", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf, postAwaitingMapping, IngestError } =
    await import("@/lib/pdf/ingest");

  await ingestBiznisoftPdf(
    { bytes: await bytesOf("jedna-stavka.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  await assert.rejects(
    () => postAwaitingMapping({ issuerCode: ISSUER, externalPartnerCode: "09001" }, actor),
    (error: unknown) => error instanceof IngestError && error.code === "not_mapped",
  );

  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  assert.equal(n, 0);
});

test("vodeca nula je deo sifre — 00042 nije 42", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");

  // Kupac je mapiran na sifru BEZ vodece nule.
  const customerId = await newCustomer();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '42', ${customerId}, 'mapped')`;

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("vodeca-nula-partner.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  assert.equal(out.result, "awaiting_customer_mapping");
  assert.equal(
    (out as { partnerCode: string }).partnerCode,
    "00042",
    "vodeca nula je otpala iz sifre",
  );
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  assert.equal(n, 0, "sifra bez vodece nule je pogodila pogresnog kupca");
});

test("ista sifra kod drugog izdavaoca ne pogadja istog kupca", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");

  const customerId = await newCustomer();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', 'QA99', '09001', ${customerId}, 'mapped')`;

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("jedna-stavka.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "awaiting_customer_mapping");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  assert.equal(n, 0);
});

test("nepoznat artikal ne blokira fakturu, ali ulazi u registar", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");

  const customerId = await newCustomer();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${customerId}, 'mapped')`;

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "ingested");

  const codes = await db.sql<{ code: string }[]>`
    SELECT code FROM articles WHERE code LIKE '9000%' ORDER BY code`;
  assert.equal(codes.length, 7, "artikli sa fakture nisu stigli u registar");

  // Svaka stavka je vezana za artikal — sifra nije ostala samo tekst.
  const [{ nevezanih }] = await db.sql<{ nevezanih: number }[]>`
    SELECT count(*)::int AS nevezanih FROM invoice_lines WHERE article_id IS NULL`;
  assert.equal(nevezanih, 0);
});

test("postojeci artikal se ne duplira i naziv iz kataloga se ne prepisuje", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");

  await db.sql`INSERT INTO articles (code, name) VALUES ('900001', 'Naziv iz kataloga')`;

  const customerId = await newCustomer();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${customerId}, 'mapped')`;

  await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  const rows = await db.sql<{ name: string }[]>`
    SELECT name FROM articles WHERE code = '900001'`;
  assert.equal(rows.length, 1, "sifra artikla se udvojila");
  assert.equal(rows[0].name, "Naziv iz kataloga", "uvoz je prepisao katalos naziv");
});

test("trag revizije o knjizenju ne sadrzi naziv kupca ni ceo broj dokumenta", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");

  const customerId = await newCustomer();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${customerId}, 'mapped')`;

  await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  const rows = await db.sql<{ entity_label: string }[]>`
    SELECT entity_label FROM audit_log WHERE entity_type = 'Izvorni dokument'`;
  assert.ok(rows.length >= 2, "knjizenje nije ostavilo trag");
  for (const row of rows) {
    assert.ok(row.entity_label.startsWith("sd:"), "oznaka nije redigovana");
    assert.ok(!row.entity_label.includes("QA Kupac"), "naziv kupca je u tragu");
  }
});
