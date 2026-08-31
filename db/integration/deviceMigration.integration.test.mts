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
 * Migracije 0023/0024 nad PRAVIM PostgreSQL-om.
 *
 * Sam test nad svežom bazom ne bi bio dokaz upgrade puta — pa se ovde tvrdi ono
 * što je nezavisno od redosleda: da zatečeni redovi ostaju netaknuti, da
 * ograničenja stvarno rade i da zaštitni okidači nisu ugašeni da bi migracija
 * prošla.
 *
 * Svi podaci su sintetički.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

let db: TestDatabase;
let owner: { id: string; name: string; role: string };

const ISSUER = "QA01";

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const a = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  owner = { id: a.owner.id, name: a.owner.name, role: a.owner.role };
});

after(async () => {
  if (!reason && db) {
    await ocisti();
    await db.sql`DELETE FROM sync_request_nonces`;
    await db.sql`DELETE FROM sync_device_keys`;
    await db.sql`DELETE FROM sync_devices`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

async function ocisti() {
  await db.sql`DELETE FROM source_document_lines`;
  await db.sql`DELETE FROM source_documents`;
  await db.sql`DELETE FROM invoice_lines`;
  await db.sql`DELETE FROM invoices`;
  await db.sql`DELETE FROM customer_external_identifiers`;
  /*
   * Uvoz sam upisuje artikle u registar, pa ih i cisti.
   *
   * Bez ovoga sledeci test fajl pada na kapiji „prazna test meta" — i to
   * porukom koja izgleda kao kvar tog fajla, a nije.
   */
  await db.sql`DELETE FROM article_catalog_mappings`;
  await db.sql`DELETE FROM articles WHERE code LIKE '9%'`;
  await db.sql`DELETE FROM import_runs`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
}

/* =========================================================================
 * Zatečeni redovi
 * ====================================================================== */

test("zatečena faktura ostaje bez izmišljene valute i datuma prometa", async (t) => {
  if (guard(t)) return;
  await ocisti();

  /*
   * Red koji je nastao PRE P2 — upisan bez ijedne nove kolone, tačno kako bi ga
   * ostavio raniji CSV uvoz.
   */
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Zatecen') RETURNING id`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                          customer_id, net_amount, total_amount)
    VALUES (${ISSUER}, 'faktura', 'LEGACY-1', 2025, '2025-06-01', ${c.id}, '100.00', '120.00')
    RETURNING id`;

  const [red] = await db.sql<
    {
      origin: string;
      currency: string | null;
      currency_provenance: string | null;
      trade_date: string | null;
      date_basis: string | null;
    }[]
  >`SELECT origin, currency, currency_provenance, trade_date::text, date_basis
      FROM invoices WHERE id = ${inv.id}`;

  /*
   * NEMA globalnog backfill-a RSD.
   *
   * Zatečene fakture jesu nastale pod pretpostavkom da su iznosi dinarski, ali
   * ta pretpostavka nigde nije zapisana kao dokaz. `NULL` je tačan opis.
   */
  assert.equal(red.currency, null, "valuta je upisana unazad — pretpostavka nije dokaz");
  assert.equal(red.currency_provenance, null);
  assert.equal(red.trade_date, null, "izmišljen datum prometa");
  assert.equal(red.date_basis, null);
  // Poreklo je izričito „ne znamo“, ne pogađanje.
  assert.equal(red.origin, "legacy_unknown");
});

test("zatečeni izvorni dokument nema verifikovan hash i to se ne nagađa", async (t) => {
  if (guard(t)) return;
  await ocisti();

  const [sd] = await db.sql<{ id: string }[]>`
    INSERT INTO source_documents
      (file_hash, file_name, page_count, issuer_code, business_document_type,
       parser_version, validation_status)
    VALUES (${`legacy${randomUUID().slice(0, 8)}`}, 'legacy.pdf', 1, ${ISSUER}, 'faktura',
            'biznisoft-pdf-1', 'valid')
    RETURNING id`;

  const [red] = await db.sql<
    { origin: string; semantic_hash: string | null; canonicalization_version: number | null }[]
  >`SELECT origin, semantic_hash, canonicalization_version
      FROM source_documents WHERE id = ${sd.id}`;

  assert.equal(red.origin, "legacy_unknown");
  assert.equal(red.semantic_hash, null, "hash je izmišljen za zatečen red");
  assert.equal(red.canonicalization_version, null);

  await db.sql`DELETE FROM source_documents WHERE id = ${sd.id}`;
});

/* =========================================================================
 * Ograničenja
 * ====================================================================== */

test("valuta bez porekla se ne može upisati", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA') RETURNING id`;

  /*
   * Valuta bez zapisanog porekla je tvrdnja bez pokrića — ne bi se znalo da li
   * je pročitana sa dokumenta ili podrazumevana konfiguracijom. Usaglašavanje
   * cena to mora da razlikuje.
   */
  await assert.rejects(
    () => db.sql`
      INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                            customer_id, net_amount, total_amount, currency)
      VALUES (${ISSUER}, 'faktura', 'CK-1', 2026, '2026-01-01', ${c.id}, '1.00', '1.00', 'RSD')`,
    /invoices_currency_provenance_ck/,
  );
});

test("osnov `trade_date` traži postojeći datum prometa", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA') RETURNING id`;

  await assert.rejects(
    () => db.sql`
      INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                            customer_id, net_amount, total_amount, date_basis)
      VALUES (${ISSUER}, 'faktura', 'CK-2', 2026, '2026-01-01', ${c.id}, '1.00', '1.00', 'trade_date')`,
    /invoices_trade_date_basis_ck/,
  );
});

test("prolaz uvoza ne može imati i korisnika i uređaj kao aktera", async (t) => {
  if (guard(t)) return;
  const { registerDevice } = await import("@/lib/sync/device/registry");
  const { publicKey } = (await import("node:crypto")).generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");

  const dev = await registerDevice(
    {
      deviceCode: `mig-${randomUUID().slice(0, 8)}`,
      label: "QA",
      sourceSystem: "biznisoft",
      issuerCode: ISSUER,
      keyId: "k1",
      publicKeySpki: spki,
    },
    owner,
  );

  /*
   * Bez ovog ograničenja bi red mogao da tvrdi i korisnika i uređaj, pa bi
   * pitanje „ko je uvezao“ imalo dva tačna odgovora.
   */
  await assert.rejects(
    () => db.sql`
      INSERT INTO import_runs (file_name, file_hash, started_by, started_by_device_id)
      VALUES ('x.csv', ${randomUUID()}, ${owner.id}, ${dev.deviceId})`,
    /import_runs_single_actor_ck/,
  );

  // Svaki pojedinačno prolazi — postojeći korisnički uvozi rade nepromenjeni.
  const [a] = await db.sql<{ id: number }[]>`
    INSERT INTO import_runs (file_name, file_hash, started_by)
    VALUES ('korisnik.csv', ${randomUUID()}, ${owner.id}) RETURNING id`;
  const [b] = await db.sql<{ id: number }[]>`
    INSERT INTO import_runs (file_name, file_hash, started_by_device_id)
    VALUES ('uredjaj.json', ${randomUUID()}, ${dev.deviceId}) RETURNING id`;
  assert.ok(a.id && b.id);

  await db.sql`DELETE FROM import_runs WHERE id IN (${a.id}, ${b.id})`;
});

test("trag ne prima nevažeću kombinaciju korisničkog i device aktera", async (t) => {
  if (guard(t)) return;
  const [dev] = await db.sql<{ id: string }[]>`SELECT id FROM sync_devices LIMIT 1`;
  assert.ok(dev, "preduslov: postoji bar jedan uređaj");

  /* `device` uz korisnika — zabranjeno. */
  await assert.rejects(
    () => db.sql`
      INSERT INTO audit_log (actor_kind, actor_device_id, actor_user_id, actor_label, action, entity_type)
      VALUES ('device', ${dev.id}, ${owner.id}, 'x', 'QA', 'QA')`,
    /audit_log_actor_kind_ck/,
  );

  /* `device` bez uređaja — zabranjeno. */
  await assert.rejects(
    () => db.sql`
      INSERT INTO audit_log (actor_kind, actor_label, action, entity_type)
      VALUES ('device', 'x', 'QA', 'QA')`,
    /audit_log_actor_kind_ck/,
  );

  /* `user` uz uređaj — zabranjeno. */
  await assert.rejects(
    () => db.sql`
      INSERT INTO audit_log (actor_kind, actor_device_id, actor_user_id, actor_label, action, entity_type)
      VALUES ('user', ${dev.id}, ${owner.id}, 'x', 'QA', 'QA')`,
    /audit_log_actor_kind_ck/,
  );
});

/* =========================================================================
 * Append-only trag preživljava migracije
 * ====================================================================== */

test("audit ostaje append-only posle 0023/0024", async (t) => {
  if (guard(t)) return;

  const [red] = await db.sql<{ id: number }[]>`
    INSERT INTO audit_log (actor_user_id, actor_label, action, entity_type)
    VALUES (${owner.id}, 'QA (gazda)', 'QA provera', 'QA') RETURNING id`;

  /*
   * Zaštitni okidači se NE gase da bi migracija prošla.
   */
  await assert.rejects(
    () => db.sql`UPDATE audit_log SET action = 'izmenjeno' WHERE id = ${red.id}`,
    /append-only/,
  );
  await assert.rejects(
    () => db.sql`DELETE FROM audit_log WHERE id = ${red.id}`,
    /append-only/,
  );

  const okidaci = await db.sql<{ tgname: string }[]>`
    SELECT tgname FROM pg_trigger
     WHERE tgrelid = 'audit_log'::regclass AND NOT tgisinternal ORDER BY tgname`;
  assert.deepEqual(
    okidaci.map((r) => r.tgname),
    ["audit_log_no_delete", "audit_log_no_update"],
  );
});

test("brisanje uređaja ne kaskadno briše trag", async (t) => {
  if (guard(t)) return;
  const { registerDevice } = await import("@/lib/sync/device/registry");
  const { publicKey } = (await import("node:crypto")).generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");

  const dev = await registerDevice(
    {
      deviceCode: `del-${randomUUID().slice(0, 8)}`,
      label: "QA",
      sourceSystem: "biznisoft",
      issuerCode: ISSUER,
      keyId: "k1",
      publicKeySpki: spki,
    },
    owner,
  );

  const pre = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM audit_log WHERE actor_device_id = ${dev.deviceId}
       OR entity_id = ${dev.deviceId}`;
  assert.ok(pre[0].n >= 1, "preduslov: registracija je ostavila trag");

  /*
   * `sync_device_keys` ima `RESTRICT` ka uređaju, pa brisanje uređaja pada dok
   * ključ postoji — istorija se ne gubi ni slučajno. Trag je nedirnut.
   */
  await assert.rejects(
    () => db.sql`DELETE FROM sync_devices WHERE id = ${dev.deviceId}`,
    /violates foreign key constraint/,
  );

  const posle = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM audit_log WHERE actor_device_id = ${dev.deviceId}
       OR entity_id = ${dev.deviceId}`;
  assert.equal(posle[0].n, pre[0].n, "trag je izgubio redove");
});

/* =========================================================================
 * Izbor B nosi i metapodatke verzije
 * ====================================================================== */

test("izbor druge verzije prenosi poreklo i valutu na projekciju", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf, resolveDocumentRevision } = await import("@/lib/pdf/ingest");
  const { readFile } = await import("node:fs/promises");

  await ocisti();
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${c.id}, 'mapped')`;

  const bytes = new Uint8Array(
    await readFile(new URL("../../fixtures/dev/biznisoft/vise-stavki.pdf", import.meta.url)),
  );
  const a = await ingestBiznisoftPdf({ bytes, fileName: "a.pdf", issuerCode: ISSUER }, owner);
  assert.equal(a.result, "ingested");

  const drugi = new Uint8Array([...bytes, ...new TextEncoder().encode("\n% reprint\n")]);
  const b = await ingestBiznisoftPdf({ bytes: drugi, fileName: "b.pdf", issuerCode: ISSUER }, owner);
  assert.equal(b.result, "business_key_conflict");

  await resolveDocumentRevision(
    {
      supersededId: (a as { sourceDocumentId: string }).sourceDocumentId,
      supersedingId: (b as { sourceDocumentId: string }).sourceDocumentId,
      reason: "QA: verzija B važi",
    },
    owner,
  );

  /*
   * Metapodaci VERZIJE moraju preći zajedno sa iznosima.
   *
   * Da se ne prepišu, faktura bi nosila iznose nove a poreklo i valutu stare
   * verzije — i nijedan izveštaj to ne bi prijavio kao grešku.
   */
  const [inv] = await db.sql<
    { origin: string; date_basis: string | null }[]
  >`SELECT origin, date_basis FROM invoices`;
  const [pobednik] = await db.sql<
    { origin: string; date_basis: string | null }[]
  >`SELECT origin, date_basis FROM source_documents
      WHERE id = ${(b as { sourceDocumentId: string }).sourceDocumentId}`;

  assert.equal(inv.origin, pobednik.origin, "poreklo nije prešlo sa pobedničke verzije");
  assert.equal(inv.date_basis, pobednik.date_basis);

  // Ledger invarijanta ostaje: promet tačno jednom.
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM effective_sales_ledger`;
  assert.equal(n, 7);

  // Izvorne stavke verzije A su sačuvane.
  const [{ stavkiA }] = await db.sql<{ stavkiA: number }[]>`
    SELECT count(*)::int AS "stavkiA" FROM source_document_lines
     WHERE source_document_id = ${(a as { sourceDocumentId: string }).sourceDocumentId}`;
  assert.equal(stavkiA, 7);
});
