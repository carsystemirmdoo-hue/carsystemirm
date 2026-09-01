import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase,
  seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Performance manifest nad sintetičkim korpusom od 25.000 dokumenata.
 *
 * NAMERNO van `*.integration.test.mts` glob-a
 * ------------------------------------------
 * `initTestDatabase` odbija metu koja ima ijedan red u poslovnim tabelama
 * (`MAX_TOLERATED_BUSINESS_ROWS = 0`). Da ovaj fajl radi u istom prolazu kao
 * ostali, jedan njegov pad ostavio bi 25.000 faktura i oborio SVAKI naredni
 * test fajl porukom koja izgleda kao greška u tuđem kodu. Zato ima svoj
 * skript: `npm run test:recommendations:perf`.
 *
 * Šta ovo dokazuje, a šta ne
 * --------------------------
 * Dokazuje da recompute nad korpusom reda veličine godišnjeg prometa ne pada,
 * ne troši nerazumno memorije i završava u vremenu koje je za ručno pokretanje
 * prihvatljivo. NE dokazuje da su preporuke tačne — korpus je sintetički i
 * napravljen tako da svaki par ima ritam.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) { t.skip(reason); return true; }
  return false;
};

let db: TestDatabase;
let owner: { id: string; name: string; role: string };

const ISSUER = "QAPRF";
/** 500 kupaca × 50 dokumenata = 25.000 dokumenata, 50.000 stavki. */
const KUPACA = 500;
const DOKUMENATA_PO_KUPCU = 50;
const KORAK_DANA = 14;
const ARTIKALA_PO_KUPCU = 10; // × 2 linije → 20 parova po kupcu
const POCETAK = "2024-01-01";
const AS_OF = "2026-06-30";

/** Gornja granica vremena recompute-a. Široka namerno — meri se red veličine. */
const GRANICA_MS = 180_000;

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const a = await seedAccounts(db, [{ key: "perfowner", role: "gazda" }]);
  owner = { id: a.perfowner.id, name: a.perfowner.name, role: a.perfowner.role };
});

after(async () => {
  if (!reason && db) {
    await ocisti();
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

/**
 * Potpuno čišćenje.
 *
 * Ne oslanja se na prefiks tamo gde ga nema: `invoice_lines` se briše kroz
 * fakture izdavaoca, jer stavka nema svoju oznaku testa.
 */
async function ocisti() {
  await db.sql`DELETE FROM recommendation_results`;
  await db.sql`DELETE FROM recommendation_runs`;
  await db.sql`DELETE FROM source_documents WHERE issuer_code = ${ISSUER}`;
  await db.sql`
    DELETE FROM invoice_lines
     WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
  await db.sql`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
  await db.sql`DELETE FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QAP%'`;
}

/**
 * Korpus se pravi u BAZI, sa `generate_series`.
 *
 * 25.000 `INSERT`-a iz Node-a bi merilo mrežni obilazak, ne recompute — i
 * trajalo bi duže od onoga što test meri.
 */
async function napraviKorpus() {
  await db.sql`
    INSERT INTO customers (pib, name)
    SELECT 'QAP' || lpad(g::text, 6, '0'), 'QA Perf ' || g
      FROM generate_series(0, ${KUPACA - 1}) g`;

  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    SELECT 'biznisoft', ${ISSUER}, substring(pib from 4), id, 'mapped'
      FROM customers WHERE pib LIKE 'QAP%'`;

  await db.sql`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                          customer_id, net_amount, total_amount, origin)
    SELECT ${ISSUER}, 'faktura', c.pib || '-' || d,
           extract(year FROM (${POCETAK}::date + d * ${KORAK_DANA}))::int,
           ${POCETAK}::date + d * ${KORAK_DANA},
           c.id, '100.00', '120.00', 'manual_upload'
      FROM customers c
      CROSS JOIN generate_series(0, ${DOKUMENATA_PO_KUPCU - 1}) d
     WHERE c.pib LIKE 'QAP%'`;

  /*
   * Dve stavke po dokumentu, sa šifrom izvedenom iz rednog broja dokumenta.
   *
   * Zahvaljujući `% ${ARTIKALA_PO_KUPCU}` svaki par (kupac, artikal) dobija
   * tačno pet kupovina na jednak razmak — dakle pun cadence status, ne
   * `insufficient_history`. Korpus koji bi dao same nedovoljne istorije ne bi
   * merio ono što recompute stvarno radi.
   */
  await db.sql`
    INSERT INTO invoice_lines (invoice_id, line_number, article_code, description,
                               quantity, unit_price, line_amount)
    SELECT i.id, ln,
           (CASE ln WHEN 1 THEN 'A' ELSE 'B' END) ||
             lpad(((((i.issued_on - ${POCETAK}::date) / ${KORAK_DANA})
                    % ${ARTIKALA_PO_KUPCU}))::text, 3, '0'),
           'Perf artikal', '1.000', '100.0000', '100.00'
      FROM invoices i
      CROSS JOIN generate_series(1, 2) ln
     WHERE i.company_id = ${ISSUER}`;

  await db.sql`
    INSERT INTO source_documents
      (file_hash, file_name, page_count, line_count, issuer_code,
       business_document_type, business_document_number, external_partner_code,
       document_date, parser_version, validation_status, revision_status,
       manual_review, origin, invoice_id)
    SELECT md5(i.id::text), i.number || '.pdf', 1, 2, ${ISSUER},
           'faktura', i.number, substring(c.pib from 4), i.issued_on,
           'qa-perf', 'valid', 'original', 'not_required', 'manual_upload', i.id
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
     WHERE i.company_id = ${ISSUER}`;
}

test("recompute nad 25.000 dokumenata — manifest", async (t) => {
  if (guard(t)) return;
  await ocisti();

  const t0 = Date.now();
  await napraviKorpus();
  const gradnjaMs = Date.now() - t0;

  const [{ dokumenata }] = await db.sql<{ dokumenata: number }[]>`
    SELECT count(*)::int AS dokumenata FROM source_documents WHERE issuer_code = ${ISSUER}`;
  const [{ stavki }] = await db.sql<{ stavki: number }[]>`
    SELECT count(*)::int AS stavki FROM recommendation_input_lines`;
  assert.equal(dokumenata, KUPACA * DOKUMENATA_PO_KUPCU);
  assert.equal(stavki, KUPACA * DOKUMENATA_PO_KUPCU * 2);

  const { recomputeRecommendations } = await import("@/lib/recommendations/recompute");

  const memPre = process.memoryUsage().heapUsed;
  const t1 = Date.now();
  const rezime = await recomputeRecommendations(
    { customerIds: null },
    { asOfDate: AS_OF },
    owner,
  );
  const recomputeMs = Date.now() - t1;
  const memMb = Math.round((process.memoryUsage().heapUsed - memPre) / 1024 / 1024);

  assert.equal(rezime.pairCount, KUPACA * ARTIKALA_PO_KUPCU * 2);
  assert.equal(rezime.repeatPairCount, rezime.pairCount, "svaki par mora imati ritam");

  const [run] = await db.sql<{
    event_count: number; input_lines_accepted: number; input_lines_excluded: number;
    status_counts: Record<string, number>; confidence_counts: Record<string, number>;
  }[]>`SELECT event_count, input_lines_accepted, input_lines_excluded,
              status_counts, confidence_counts
         FROM recommendation_runs WHERE is_active`;

  /* Drugi prolaz meri i „topao" slučaj, i usput dokazuje idempotentnost. */
  const t2 = Date.now();
  await recomputeRecommendations({ customerIds: null }, { asOfDate: AS_OF }, owner);
  const drugiMs = Date.now() - t2;

  const manifest = {
    dokumenata,
    ulaznihStavki: run.input_lines_accepted,
    iskljucenihStavki: run.input_lines_excluded,
    dogadjaja: run.event_count,
    parova: rezime.pairCount,
    rezultata: rezime.resultCount,
    statusi: run.status_counts,
    pouzdanost: run.confidence_counts,
    gradnjaKorpusaMs: gradnjaMs,
    prviRecomputeMs: recomputeMs,
    drugiRecomputeMs: drugiMs,
    prirastHeapMb: memMb,
    granicaMs: GRANICA_MS,
  };
  t.diagnostic(`MANIFEST ${JSON.stringify(manifest)}`);
  console.log("PERFORMANCE MANIFEST", JSON.stringify(manifest, null, 2));

  assert.ok(
    recomputeMs < GRANICA_MS,
    `recompute je trajao ${recomputeMs} ms, granica je ${GRANICA_MS} ms`,
  );

  // Tačno jedan aktivan prolaz i posle dva izvršavanja.
  const [{ aktivnih }] = await db.sql<{ aktivnih: number }[]>`
    SELECT count(*)::int AS aktivnih FROM recommendation_runs WHERE is_active`;
  assert.equal(aktivnih, 1);
});
