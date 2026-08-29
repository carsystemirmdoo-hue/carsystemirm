import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase,
  seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Ovlašćenje i privatnost oko PDF uvoza.
 *
 * Dva pravila se ovde brane: dokumenti su vidljivi samo onome ko sme da vidi
 * uvoz, i ništa iz dokumenta ne curi u trag revizije. Trag se čita pri sporu i
 * nadzoru, pa je gore da u njemu stoji naziv kupca nego da nedostaje detalj —
 * detalj se uvek može otvoriti na ekranu, uz proveru dozvola.
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

test("ruta izvornih dokumenata trazi istu sposobnost kao uvoz", async (t) => {
  if (guard(t)) return;
  const { can, capabilityForPath } = await import("@/lib/authz/permissions.mjs");

  assert.equal(capabilityForPath("/portal/importi/dokumenti"), "view:importi");

  // Kancelarija sme; komercijalista i magacioner bez paketa ne smeju.
  assert.equal(can({ role: "kancelarija", permissions: [] }, "view:importi"), true);
  assert.equal(can({ role: "komercijalista", permissions: [] }, "view:importi"), false);
  assert.equal(can({ role: "magacioner", permissions: [] }, "view:importi"), false);
  // Kupacki nalog nije ni uloga portala.
  assert.equal(can({ role: "kupac", permissions: [] }, "view:importi"), false);
});

test("M-1: odluka o verziji NIJE ista sposobnost kao pregled uvoza", async (t) => {
  if (guard(t)) return;
  const { can, CAPABILITIES, resolveCapabilities } =
    await import("@/lib/authz/permissions.mjs");

  assert.ok(CAPABILITIES.includes("documents:resolve"), "sposobnost ne postoji");

  /*
   * Kancelarija bazno VIDI uvoz, ali ne odlucuje koja verzija vazi. Pre
   * popravke je jedna ista sposobnost pokrivala oba, pa je svako ko sme da
   * pogleda uvoz smeo i da odredi koja se faktura racuna.
   */
  const kancelarija = { role: "kancelarija", permissions: [] as string[] };
  assert.equal(can(kancelarija, "view:importi"), true);
  assert.equal(can(kancelarija, "documents:resolve"), false);

  // Dobija je tek uz paket mapiranja — isti paket koji vec nosi razresenje sifri.
  const saPaketom = { role: "kancelarija", permissions: ["mapiranja"] };
  assert.equal(can(saPaketom, "documents:resolve"), true);

  // Gazda je ima bazno; magacioner i kupac ni sa cim.
  assert.equal(can({ role: "gazda", permissions: [] }, "documents:resolve"), true);
  assert.equal(can({ role: "magacioner", permissions: [] }, "documents:resolve"), false);
  assert.equal(can({ role: "kupac", permissions: [] }, "documents:resolve"), false);

  // Paket „analitika" daje pregled uvoza, ali ne i odluku.
  const analiticar = resolveCapabilities("komercijalista", ["analitika"]);
  assert.equal(analiticar.has("view:importi"), true);
  assert.equal(analiticar.has("documents:resolve"), false);
});

test("trag revizije ne sadrzi naziv kupca, PIB ni ceo broj dokumenta", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");

  const pib = `QA${randomUUID().slice(0, 6)}`;
  const naziv = "Sinteticki Kupac DOO";
  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${pib}, ${naziv}) RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${customer.id}, 'mapped')`;

  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "Faktura-09002-2026.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "ingested");

  const [doc] = await db.sql<{ business_document_number: string }[]>`
    SELECT business_document_number FROM source_documents`;
  const broj = doc.business_document_number;

  const rows = await db.sql<{
    entity_label: string | null; reason: string | null;
    value_before: unknown; value_after: unknown; actor_label: string;
  }[]>`
    SELECT entity_label, reason, value_before, value_after, actor_label
      FROM audit_log WHERE entity_type = 'Izvorni dokument'`;
  assert.ok(rows.length > 0, "uvoz nije ostavio trag");

  for (const row of rows) {
    const tekst = JSON.stringify(row);
    assert.ok(!tekst.includes(naziv), "naziv kupca je u tragu");
    assert.ok(!tekst.includes(pib), "PIB je u tragu");
    assert.ok(!tekst.includes(broj), "ceo broj dokumenta je u tragu");
    // Ime fajla ume da nosi i sifru partnera i broj — ne sme u trag.
    assert.ok(!tekst.includes("Faktura-09002-2026.pdf"), "ime fajla je u tragu");
    assert.ok(!tekst.includes("SINTETICKI ARTIKAL"), "sirov tekst PDF-a je u tragu");
  }
});

test("redigovana oznaka nosi najvise tri poslednja znaka broja", async (t) => {
  if (guard(t)) return;
  const { redactDocumentRef } = await import("@/lib/pdf/ingest");

  const ref = redactDocumentRef({
    fileHash: "a".repeat(64),
    businessDocumentNumber: "2026-000123456",
  });
  assert.equal(ref, `sd:${"a".repeat(12)}/…456`);
  assert.ok(!ref.includes("000123"), "vise od tri znaka broja je izaslo");

  // Bez broja dokumenta oznaka je samo otisak.
  assert.equal(
    redactDocumentRef({ fileHash: "b".repeat(64), businessDocumentNumber: null }),
    `sd:${"b".repeat(12)}`,
  );
});

test("baza ne cuva sadrzaj PDF fajla", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");

  await ingestBiznisoftPdf(
    { bytes: await bytesOf("jedna-stavka.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  /*
   * Nijedna kolona `source_documents` nije binarna niti nosi ceo tekst
   * dokumenta. Ako neko kasnije doda kolonu sa sadrzajem, ovaj test pada pre
   * nego sto prvi stvaran PDF udje u bazu.
   */
  const columns = await db.sql<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'source_documents'`;
  for (const column of columns) {
    assert.ok(
      !["bytea", "blob"].includes(column.data_type),
      `kolona ${column.column_name} cuva binarni sadrzaj`,
    );
  }

  // `raw_cells` cuva sirov red stavke — to je namerno, i ostaje unutar stavke.
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM source_document_lines WHERE raw_cells IS NOT NULL`;
  assert.equal(n, 1);
});

test("ledger bez opsega se ne moze izvrsiti za kupca", async (t) => {
  if (guard(t)) return;
  const { customerLedgerScope } = await import("@/lib/ledger/effective-sales");
  assert.throws(() => customerLedgerScope(""), /bez customer_id/i);
});

test("prazan opseg daje prazan ledger, nikad ceo promet", async (t) => {
  if (guard(t)) return;
  await clean();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { ledgerTotals } = await import("@/lib/ledger/effective-sales");

  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${customer.id}, 'mapped')`;
  await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );

  const prazan = await ledgerTotals({ customerIds: [] });
  assert.equal(prazan.net_effective_sales.lines, 0);
  assert.equal(prazan.gross_sales.lines, 0);

  // Kontrola: sa opsegom promet POSTOJI, pa prazan rezultat nije posledica greske.
  const pun = await ledgerTotals({ customerIds: [customer.id] });
  assert.equal(pun.net_effective_sales.lines, 7);
});
