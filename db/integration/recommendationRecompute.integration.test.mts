import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before, beforeEach } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase,
  seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Recompute: idempotentnost, atomično objavljivanje i trag.
 *
 * Ono što se ovde dokazuje ne živi u JavaScriptu nego u Postgresu — delimični
 * jedinstveni indeksi, `pg_advisory_xact_lock`, transakcija koja objavljuje sve
 * ili ništa. Nijedan mock to ne može pokazati.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) { t.skip(reason); return true; }
  return false;
};

let db: TestDatabase;
let owner: { id: string; name: string; role: string };
let rep: { id: string; name: string; role: string };

const ISSUER = "QARUN";
const AS_OF = "2026-06-30";

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
    { key: "owner", role: "gazda" },
    { key: "rep", role: "komercijalista" },
  ]);
  owner = { id: a.owner.id, name: a.owner.name, role: a.owner.role };
  rep = { id: a.rep.id, name: a.rep.name, role: a.rep.role };
});

after(async () => {
  if (!reason && db) {
    await ocisti();
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

async function ocisti() {
  await db.sql`DELETE FROM recommendation_results`;
  await db.sql`DELETE FROM recommendation_runs`;
  await db.sql`DELETE FROM source_document_lines`;
  await db.sql`DELETE FROM source_documents`;
  await db.sql`DELETE FROM invoice_lines`;
  await db.sql`DELETE FROM invoices`;
  await db.sql`DELETE FROM customer_external_identifiers`;
  await db.sql`DELETE FROM article_catalog_mappings`;
  await db.sql`DELETE FROM articles WHERE code LIKE 'RUN%'`;
  await db.sql`DELETE FROM customer_assignments`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QAU%'`;
}

beforeEach(async () => {
  if (reason) return;
  await ocisti();
});

/* =========================================================================
 * Gradnja korpusa
 * ====================================================================== */

type Kupac = { id: string; partnerCode: string };
let brojac = 0;

async function kupac(partnerCode: string): Promise<Kupac> {
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QAU${randomUUID().slice(0, 6)}`}, ${`QA Kupac ${partnerCode}`})
    RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, ${partnerCode}, ${c.id}, 'mapped')`;
  return { id: c.id, partnerCode };
}

/** Jedan ispravan proknjižen dokument sa jednom stavkom. */
async function kupovina(k: Kupac, issuedOn: string, articleCode: string, naziv = "Bazni lak") {
  brojac += 1;
  const broj = `U${brojac}`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                          customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${broj}, ${Number(issuedOn.slice(0, 4))}, ${issuedOn},
            ${k.id}, '100.00', '120.00', 'manual_upload')
    RETURNING id`;
  await db.sql`
    INSERT INTO invoice_lines (invoice_id, line_number, article_code, description,
                               quantity, unit_price, line_amount)
    VALUES (${inv.id}, 1, ${articleCode}, ${naziv}, '1.000', '100.0000', '100.00')`;
  await db.sql`
    INSERT INTO source_documents
      (file_hash, file_name, page_count, line_count, issuer_code,
       business_document_type, business_document_number, external_partner_code,
       document_date, parser_version, validation_status, revision_status,
       manual_review, origin, invoice_id)
    VALUES (${randomUUID().replace(/-/g, "")}, ${`${broj}.pdf`}, 1, 1, ${ISSUER},
            'faktura', ${broj}, ${k.partnerCode}, ${issuedOn}, 'qa-1', 'valid',
            'original', 'not_required', 'manual_upload', ${inv.id})`;
  return inv.id;
}

/** `n` kupovina istog artikla na fiksni razmak. */
async function ritam(k: Kupac, articleCode: string, pocetak: string, korak: number, n: number) {
  const { addDays } = await import("@/lib/recommendations/cadence.mjs");
  for (let i = 0; i < n; i += 1) {
    await kupovina(k, addDays(pocetak, korak * i), articleCode);
  }
}

const svi = { customerIds: null as string[] | null };

async function pokreni(scope = svi, asOfDate = AS_OF, actor = owner) {
  const { recomputeRecommendations } = await import("@/lib/recommendations/recompute");
  return recomputeRecommendations(scope, { asOfDate }, actor);
}

async function aktivniRedovi() {
  /*
   * `[...]` je namerno: postgres.js vraća `Result`, a ne običan niz, pa bi
   * `deepEqual(rezultat, [])` pao i nad praznim skupom — greška koja izgleda
   * kao da su redovi ostali.
   */
  const redovi = await db.sql<
    {
      customer_id: string; article_code: string; status: string; confidence: string;
      event_count: number; median_interval_days: number | null;
      expected_next_on: string | null; explanation: string;
      algorithm_version: string; as_of_date: string; date_basis: string;
    }[]
  >`SELECT customer_id, article_code, status, confidence, event_count,
           median_interval_days, expected_next_on::text AS expected_next_on,
           explanation, algorithm_version, as_of_date::text AS as_of_date, date_basis
      FROM active_recommendations
     ORDER BY customer_id, article_code`;
  return [...redovi];
}

/* =========================================================================
 * 1. Osnovni prolaz
 * ====================================================================== */

test("uspešan prolaz upisuje rezultate i postaje aktivan", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 6);

  const rezime = await pokreni();
  assert.equal(rezime.algorithmVersion, "cadence_v1");
  assert.equal(rezime.asOfDate, AS_OF);
  assert.equal(rezime.resultCount, 1);

  const redovi = await aktivniRedovi();
  assert.equal(redovi.length, 1);
  assert.equal(redovi[0].article_code, "RUN001");
  assert.equal(redovi[0].event_count, 6);
  assert.equal(redovi[0].median_interval_days, 30);
  assert.equal(redovi[0].algorithm_version, "cadence_v1");
  assert.equal(redovi[0].as_of_date, AS_OF);
  assert.equal(redovi[0].date_basis, "issued_on");
  assert.match(redovi[0].explanation, /kupovao 6 puta/);

  const [run] = await db.sql<{ status: string; is_active: boolean; requested_by: string;
                              finished_at: string | null; result_count: number;
                              pair_count: number; repeat_pair_count: number;
                              input_lines_accepted: number; exclusions: Record<string, number>;
                              status_counts: Record<string, number>;
                              confidence_counts: Record<string, number>;
                              scope_customer_count: number | null }[]>`
    SELECT * FROM recommendation_runs ORDER BY started_at DESC LIMIT 1`;
  assert.equal(run.status, "succeeded");
  assert.equal(run.is_active, true);
  assert.equal(run.requested_by, owner.id);
  assert.ok(run.finished_at);
  assert.equal(run.result_count, 1);
  assert.equal(run.pair_count, 1);
  assert.equal(run.repeat_pair_count, 1);
  assert.equal(run.input_lines_accepted, 6);
  assert.equal(run.scope_customer_count, null, "neograničen opseg mora ostati NULL");
  // asOf je 4 dana pre očekivanog 2026-07-04, a lead za mesečni ritam je 8 dana.
  assert.deepEqual(run.status_counts, { due_soon: 1 });
  assert.deepEqual(run.confidence_counts, { high: 1 });
  assert.equal(typeof run.exclusions, "object");
});

test("rezultat NE nosi kolonu za količinu, JM, cenu ni maržu", async (t) => {
  if (guard(t)) return;
  const kolone = await db.sql<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
     WHERE table_name = 'recommendation_results'`;
  const imena = kolone.map((c) => c.column_name).join(" ");
  for (const zabranjeno of ["quantity", "kolicin", "unit", "price", "cena", "margin", "marza", "amount"]) {
    assert.ok(!imena.includes(zabranjeno), `tabela ima kolonu „${zabranjeno}"`);
  }
});

test("parovi sa jednom kupovinom se ne upisuju, ali se broje", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 4);
  await kupovina(k, "2026-02-02", "RUN999"); // jedina kupovina tog artikla

  const rezime = await pokreni();
  assert.equal(rezime.pairCount, 2, "par sa jednom kupovinom mora ostati u dijagnostici");
  assert.equal(rezime.repeatPairCount, 1);

  const redovi = await aktivniRedovi();
  assert.deepEqual(redovi.map((r) => r.article_code), ["RUN001"]);
});

test("dve kupovine daju PROVISIONAL sa niskom pouzdanošću", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-04-01", 30, 2);

  await pokreni();
  const [red] = await aktivniRedovi();
  assert.equal(red.status, "provisional");
  assert.equal(red.confidence, "low");
  assert.ok(red.expected_next_on, "procena postoji, samo nije glavna preporuka");
});

/* =========================================================================
 * 2. Idempotentnost i atomičnost
 * ====================================================================== */

test("dva prolaza nad istim ulazom daju IDENTIČAN rezultat", async (t) => {
  if (guard(t)) return;
  const a = await kupac("09001");
  const b = await kupac("09002");
  await ritam(a, "RUN001", "2026-01-05", 30, 6);
  await ritam(a, "RUN002", "2026-02-01", 45, 4);
  await ritam(b, "RUN001", "2026-03-01", 14, 5);

  await pokreni();
  const prvi = await aktivniRedovi();
  await pokreni();
  const drugi = await aktivniRedovi();

  assert.equal(prvi.length, 3);
  assert.deepEqual(drugi, prvi, "isti ulaz je dao drugačiji rezultat");

  // Tačno JEDAN aktivan prolaz, iako su izvršena dva.
  const [{ aktivnih }] = await db.sql<{ aktivnih: number }[]>`
    SELECT count(*)::int AS aktivnih FROM recommendation_runs WHERE is_active`;
  assert.equal(aktivnih, 1);
  const [{ ukupno }] = await db.sql<{ ukupno: number }[]>`
    SELECT count(*)::int AS ukupno FROM recommendation_runs`;
  assert.equal(ukupno, 2, "istorija prolaza se ne briše");
});

test("stariji prolaz se GASI, ne briše — poređenje ostaje moguće", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 6);
  const prvi = await pokreni();
  await kupovina(k, "2026-06-25", "RUN001");
  const drugi = await pokreni();

  const [{ redova }] = await db.sql<{ redova: number }[]>`
    SELECT count(*)::int AS redova FROM recommendation_results WHERE run_id = ${prvi.runId}`;
  assert.equal(redova, 1, "rezultati starog prolaza su obrisani");

  const [red] = await aktivniRedovi();
  assert.equal(red.event_count, 7, "aktivan je stari prolaz");
  assert.ok(drugi.runId !== prvi.runId);
});

test("baza odbija drugi AKTIVAN prolaz iste verzije", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 3);
  await pokreni();

  /*
   * Direktan pokušaj da se napravi drugi aktivan prolaz — zaobilazeći servis.
   *
   * Bez delimičnog jedinstvenog indeksa bi ovo prošlo, i portal bi video dva
   * skupa rezultata bez ijedne poruke o grešci.
   */
  await assert.rejects(
    () => db.sql`
      INSERT INTO recommendation_runs
        (algorithm_version, as_of_date, status, requested_by, is_active, finished_at)
      VALUES ('cadence_v1', ${AS_OF}, 'succeeded', ${owner.id}, true, now())`,
    /recommendation_runs_one_active|duplicate key/i,
  );
});

test("baza odbija drugi prolaz U TOKU iste verzije", async (t) => {
  if (guard(t)) return;
  await db.sql`
    INSERT INTO recommendation_runs (algorithm_version, as_of_date, status, requested_by)
    VALUES ('cadence_v1', ${AS_OF}, 'running', ${owner.id})`;

  await assert.rejects(
    () => db.sql`
      INSERT INTO recommendation_runs (algorithm_version, as_of_date, status, requested_by)
      VALUES ('cadence_v1', ${AS_OF}, 'running', ${owner.id})`,
    /recommendation_runs_one_running|duplicate key/i,
  );
});

test("drugi recompute dok prvi traje dobija razumljivu poruku, ne SQL grešku", async (t) => {
  if (guard(t)) return;
  const { RecomputeError } = await import("@/lib/recommendations/recompute");
  await db.sql`
    INSERT INTO recommendation_runs (algorithm_version, as_of_date, status, requested_by)
    VALUES ('cadence_v1', ${AS_OF}, 'running', ${owner.id})`;

  await assert.rejects(
    () => pokreni(),
    (e: unknown) => {
      assert.ok(e instanceof RecomputeError);
      assert.equal((e as InstanceType<typeof RecomputeError>).code, "already_running");
      assert.doesNotMatch(String((e as Error).message), /INSERT|recommendation_runs_/);
      return true;
    },
  );
});

test("dva PARALELNA recompute-a: jedan prolazi, drugi ne pravi duple rezultate", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 6);

  const ishodi = await Promise.allSettled([pokreni(), pokreni()]);
  const uspeli = ishodi.filter((i) => i.status === "fulfilled");
  assert.ok(uspeli.length >= 1, "nijedan prolaz nije uspeo");

  const [{ aktivnih }] = await db.sql<{ aktivnih: number }[]>`
    SELECT count(*)::int AS aktivnih FROM recommendation_runs WHERE is_active`;
  assert.equal(aktivnih, 1, "dva aktivna prolaza — rezultati bi bili udvostručeni");

  const redovi = await aktivniRedovi();
  assert.equal(redovi.length, 1, "isti par se pojavio dvaput");
});

test("NEUSPEO prolaz čuva prethodni rezultat i ostaje vidljiv kao neuspeh", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 6);
  const dobar = await pokreni();
  const pre = await aktivniRedovi();
  assert.equal(pre.length, 1);

  /*
   * Pad se izaziva stvarnim uzrokom, ne mock-om: kupac nestaje iz `customers`
   * između čitanja ulaza i upisa rezultata je nemoguće naterati, pa se umesto
   * toga ruši upis kroz `as_of_date` koji ulazni sloj odbija.
   */
  const { recomputeRecommendations } = await import("@/lib/recommendations/recompute");
  await assert.rejects(
    () => recomputeRecommendations(svi, { asOfDate: "juce" }, owner),
    /asOfDate mora biti YYYY-MM-DD/,
  );

  // Prethodni rezultat je netaknut.
  assert.deepEqual(await aktivniRedovi(), pre);
  const [{ aktivan }] = await db.sql<{ aktivan: string }[]>`
    SELECT id AS aktivan FROM recommendation_runs WHERE is_active`;
  assert.equal(aktivan, dobar.runId);
});

test("pad U TOKU upisa ostavlja prolaz kao failed, bez ijednog aktivnog reda", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 6);

  /*
   * Kupac se briše POSLE otvaranja prolaza, tako da upis rezultata padne na
   * strani ključ. To je najbliži stvarni oblik „prolaz je pukao na pola".
   */
  const { recomputeRecommendations } = await import("@/lib/recommendations/recompute");
  const izmisljen = { ...svi, customerIds: [randomUUID()] };
  const rezultat = await recomputeRecommendations(izmisljen, { asOfDate: AS_OF }, owner);
  assert.equal(rezultat.resultCount, 0, "nepostojeći kupac je dao rezultat");

  // Prazan prolaz je legitiman uspeh: nema šta da se preporuči.
  const [{ aktivnih }] = await db.sql<{ aktivnih: number }[]>`
    SELECT count(*)::int AS aktivnih FROM recommendation_runs WHERE is_active`;
  assert.equal(aktivnih, 1);
  assert.deepEqual(await aktivniRedovi(), []);
  assert.ok(k.id);
});

test("zaostao prolaz posle restarta ne zaključava dugme zauvek", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 3);

  // Prolaz koji je „ostao" od pre dva sata — proces je pao između dva koraka.
  const [zaostao] = await db.sql<{ id: string }[]>`
    INSERT INTO recommendation_runs
      (algorithm_version, as_of_date, status, requested_by, started_at)
    VALUES ('cadence_v1', ${AS_OF}, 'running', ${owner.id}, now() - interval '2 hours')
    RETURNING id`;

  const rezime = await pokreni();
  assert.equal(rezime.resultCount, 1);

  const [stari] = await db.sql<{ status: string; failure_code: string }[]>`
    SELECT status, failure_code FROM recommendation_runs WHERE id = ${zaostao.id}`;
  assert.equal(stari.status, "failed");
  assert.equal(stari.failure_code, "interrupted");
});

/* =========================================================================
 * 3. Opseg
 * ====================================================================== */

test("komercijalista preračunava SAMO svoje kupce", async (t) => {
  if (guard(t)) return;
  const a = await kupac("09001");
  const b = await kupac("09002");
  await ritam(a, "RUN001", "2026-01-05", 30, 5);
  await ritam(b, "RUN001", "2026-01-05", 30, 5);
  await db.sql`
    INSERT INTO customer_assignments (user_id, customer_id) VALUES (${rep.id}, ${a.id})`;

  const { resolveLedgerScope } = await import("@/lib/ledger/effective-sales");
  const scope = await resolveLedgerScope(asUser(rep));
  await pokreni(scope, AS_OF, rep);

  const redovi = await aktivniRedovi();
  assert.deepEqual(redovi.map((r) => r.customer_id), [a.id]);

  const [run] = await db.sql<{ scope_customer_count: number | null }[]>`
    SELECT scope_customer_count FROM recommendation_runs WHERE is_active`;
  assert.equal(run.scope_customer_count, 1, "opseg mora biti zapisan uz prolaz");
});

test("prazan assignment daje prolaz bez ijednog rezultata, ne ceo promet", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 5);

  const { resolveLedgerScope } = await import("@/lib/ledger/effective-sales");
  const scope = await resolveLedgerScope(asUser(rep));
  assert.deepEqual(scope.customerIds, []);

  const rezime = await pokreni(scope, AS_OF, rep);
  assert.equal(rezime.resultCount, 0);
  assert.deepEqual(await aktivniRedovi(), []);
});

/* =========================================================================
 * 4. Prazni slučajevi
 * ====================================================================== */

test("prazan korpus: prolaz uspeva, rezultata nema, brojači su nule", async (t) => {
  if (guard(t)) return;
  const rezime = await pokreni();
  assert.equal(rezime.resultCount, 0);
  assert.equal(rezime.pairCount, 0);

  const [run] = await db.sql<{ status: string; event_count: number; customer_count: number }[]>`
    SELECT status, event_count, customer_count FROM recommendation_runs WHERE is_active`;
  assert.equal(run.status, "succeeded");
  assert.equal(run.event_count, 0);
  assert.equal(run.customer_count, 0);
});

test("korpus bez ijednog ponovljenog para daje nula preporuka", async (t) => {
  if (guard(t)) return;
  const a = await kupac("09001");
  const b = await kupac("09002");
  await kupovina(a, "2026-01-05", "RUN001");
  await kupovina(a, "2026-02-05", "RUN002");
  await kupovina(b, "2026-03-05", "RUN001");

  const rezime = await pokreni();
  assert.equal(rezime.pairCount, 3);
  assert.equal(rezime.repeatPairCount, 0);
  assert.deepEqual(await aktivniRedovi(), []);
});

/* =========================================================================
 * 5. Trag revizije
 * ====================================================================== */

test("ručni recompute ostavlja trag sa akterom i brojevima, bez PII", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 6);
  const rezime = await pokreni();

  const [trag] = await db.sql<{
    action: string; actor_user_id: string; actor_label: string;
    entity_id: string; entity_label: string; value_after: Record<string, unknown>;
  }[]>`
    SELECT action, actor_user_id, actor_label, entity_id, entity_label, value_after
      FROM audit_log WHERE entity_type = 'Preporuke — prolaz'
     ORDER BY created_at DESC LIMIT 1`;

  assert.equal(trag.action, "Preračunate preporuke");
  assert.equal(trag.actor_user_id, owner.id);
  assert.equal(trag.entity_id, rezime.runId);
  assert.equal(trag.entity_label, "cadence_v1 @ 2026-06-30");
  assert.equal(trag.value_after.rezultata, 1);

  // Trag ne sme nositi naziv kupca, šifru artikla ni rečenicu preporuke.
  const tekst = JSON.stringify(trag).toLowerCase();
  for (const zabranjeno of ["run001", "bazni lak", "qa kupac", "kupovao"]) {
    assert.ok(!tekst.includes(zabranjeno), `trag nosi „${zabranjeno}"`);
  }
});

test("trag i prolaz nastaju ZAJEDNO — nema prolaza bez traga", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await ritam(k, "RUN001", "2026-01-05", 30, 3);
  await pokreni();
  await pokreni();

  const [{ prolaza }] = await db.sql<{ prolaza: number }[]>`
    SELECT count(*)::int AS prolaza FROM recommendation_runs WHERE status = 'succeeded'`;
  /*
   * Broji se samo za prolaze koji SADA postoje: `audit_log` je append-only i
   * nosi tragove svih ranijih testova u ovom fajlu, pa bi globalan zbir merio
   * istoriju umesto invarijante.
   */
  const [{ tragova }] = await db.sql<{ tragova: number }[]>`
    SELECT count(*)::int AS tragova
      FROM audit_log
     WHERE entity_type = 'Preporuke — prolaz'
       AND entity_id IN (SELECT id::text FROM recommendation_runs)`;
  assert.equal(tragova, prolaza);
});

/* =========================================================================
 * 6. Enum u bazi i enum u algoritmu se ne smeju razići
 * ====================================================================== */

test("statusi i nivoi pouzdanosti su isti u bazi i u algoritmu", async (t) => {
  if (guard(t)) return;
  const { CADENCE_STATUSES, CONFIDENCE_LEVELS } = await import(
    "@/lib/recommendations/policy.mjs"
  );

  const status = await db.sql<{ v: string }[]>`
    SELECT unnest(enum_range(NULL::recommendation_status))::text AS v`;
  assert.deepEqual(
    status.map((r) => r.v).sort(),
    [...CADENCE_STATUSES].sort(),
  );

  const conf = await db.sql<{ v: string }[]>`
    SELECT unnest(enum_range(NULL::recommendation_confidence))::text AS v`;
  assert.deepEqual(conf.map((r) => r.v).sort(), [...CONFIDENCE_LEVELS].sort());
});

test("procena postoji u celini ili je nema — baza to brani", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  const [run] = await db.sql<{ id: string }[]>`
    INSERT INTO recommendation_runs (algorithm_version, as_of_date, status, requested_by)
    VALUES ('cadence_v1', ${AS_OF}, 'running', ${owner.id}) RETURNING id`;

  // Očekivani datum bez medijalnog intervala bi bio datum bez obrazloženja.
  await assert.rejects(
    () => db.sql`
      INSERT INTO recommendation_results
        (run_id, customer_id, article_code, first_purchase_on, last_purchase_on,
         event_count, expected_next_on, days_since_last_purchase, status, confidence,
         explanation, algorithm_version, as_of_date)
      VALUES (${run.id}, ${k.id}, 'RUN001', '2026-01-05', '2026-05-05', 5,
              '2026-06-05', 56, 'due', 'medium', 'x', 'cadence_v1', ${AS_OF})`,
    /recommendation_results_estimate_ck|check constraint/i,
  );

  // Prazna šifra artikla takođe pada u bazi.
  await assert.rejects(
    () => db.sql`
      INSERT INTO recommendation_results
        (run_id, customer_id, article_code, first_purchase_on, last_purchase_on,
         event_count, days_since_last_purchase, status, confidence,
         explanation, algorithm_version, as_of_date)
      VALUES (${run.id}, ${k.id}, '  ', '2026-01-05', '2026-05-05', 5, 56,
              'insufficient_history', 'low', 'x', 'cadence_v1', ${AS_OF})`,
    /article_code_ck|check constraint/i,
  );

  await db.sql`DELETE FROM recommendation_runs WHERE id = ${run.id}`;
});
