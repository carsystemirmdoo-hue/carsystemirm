import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before, beforeEach } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase,
  seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Ugovor o ulazu u recommendation engine.
 *
 * Filter zapisan u dokumentaciji nije filter. Ovaj fajl dokazuje da nijedan
 * NEBEZBEDAN red ne stiže do algoritma — svaki uslov iz migracije 0026 ima svoj
 * test, i svaki test najpre napravi red koji BI prošao, pa mu pokvari tačno
 * jedan uslov i dokaže da je nestao.
 *
 * Bez tog obrasca bi test „ne vidi se" prolazio i kada se ne vidi ništa.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) { t.skip(reason); return true; }
  return false;
};

let db: TestDatabase;
let owner: { id: string; name: string; role: string };
let rep: { id: string; name: string; role: string };

const ISSUER = "QAREC";
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
  await db.sql`DELETE FROM source_document_lines`;
  await db.sql`DELETE FROM source_documents`;
  await db.sql`DELETE FROM invoice_lines`;
  await db.sql`DELETE FROM invoices`;
  await db.sql`DELETE FROM customer_external_identifiers`;
  await db.sql`DELETE FROM article_catalog_mappings`;
  await db.sql`DELETE FROM articles WHERE code LIKE 'REC%'`;
  await db.sql`DELETE FROM customer_assignments`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QAR%'`;
}

beforeEach(async () => {
  if (reason) return;
  await ocisti();
});

/* =========================================================================
 * Gradnja jednog dokaza
 * ====================================================================== */

type Kupac = { id: string; partnerCode: string };

/** Kupac + potvrđena šifra partnera. */
async function kupac(partnerCode: string): Promise<Kupac> {
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QAR${randomUUID().slice(0, 6)}`}, ${`QA Kupac ${partnerCode}`})
    RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, ${partnerCode}, ${c.id}, 'mapped')`;
  return { id: c.id, partnerCode };
}

type StavkaOpts = {
  articleCode?: string;
  description?: string;
  quantity?: string;
  lineAmount?: string;
};

type DokumentOpts = {
  documentKind?: string;
  origin?: string;
  validationStatus?: string;
  revisionStatus?: string;
  manualReview?: string;
  /** `false` pravi fakturu BEZ izvornog dokumenta — kao iz ranijeg CSV uvoza. */
  withSourceDocument?: boolean;
  partnerCode?: string;
  lines?: StavkaOpts[];
};

let brojac = 0;

/**
 * Jedan proknjižen dokument, sa svim što ga čini prihvatljivim — i sa tačno
 * onim što test želi da pokvari.
 *
 * Namerno NE ide kroz `ingestBiznisoftPdf`: da bi se dokazalo da pogled odbija
 * `superseded`, `conflict` i `totals_mismatch`, ta stanja moraju da se
 * naprave, a uvoz ih (ispravno) ne pravi na zahtev.
 */
async function dokument(
  k: Kupac,
  issuedOn: string,
  opts: DokumentOpts = {},
): Promise<{ invoiceId: string; sourceDocumentId: string | null }> {
  brojac += 1;
  const broj = `R${brojac}`;
  const kind = opts.documentKind ?? "faktura";
  const lines = opts.lines ?? [{}];

  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                          customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, ${kind}, ${broj}, ${Number(issuedOn.slice(0, 4))},
            ${issuedOn}, ${k.id}, '100.00', '120.00',
            ${opts.origin ?? "manual_upload"})
    RETURNING id`;

  let lineNumber = 0;
  for (const l of lines) {
    lineNumber += 1;
    await db.sql`
      INSERT INTO invoice_lines (invoice_id, line_number, article_code, description,
                                 quantity, unit_price, line_amount)
      VALUES (${inv.id}, ${lineNumber}, ${l.articleCode ?? "REC001"},
              ${l.description ?? "Bazni lak 1L"}, ${l.quantity ?? "1.000"},
              '100.0000', ${l.lineAmount ?? "100.00"})`;
  }

  if (opts.withSourceDocument === false) {
    return { invoiceId: inv.id, sourceDocumentId: null };
  }

  const [sd] = await db.sql<{ id: string }[]>`
    INSERT INTO source_documents
      (file_hash, file_name, page_count, line_count, issuer_code,
       business_document_type, business_document_number, external_partner_code,
       document_date, parser_version, validation_status, revision_status,
       manual_review, origin, invoice_id)
    VALUES (${randomUUID().replace(/-/g, "")}, ${`${broj}.pdf`}, 1, ${lines.length},
            ${ISSUER}, 'faktura', ${broj}, ${opts.partnerCode ?? k.partnerCode},
            ${issuedOn}, 'qa-1', ${opts.validationStatus ?? "valid"},
            'original', ${opts.manualReview ?? "not_required"},
            ${opts.origin ?? "manual_upload"}, ${inv.id})
    RETURNING id`;

  /*
   * Revizija se postavlja POSLE upisa: `source_documents_revision_ck` traži
   * potpis uz `superseded` i razlog uz `conflict`, pa se ta stanja prave
   * izričito, sa svime što ograničenje zahteva.
   */
  if (opts.revisionStatus === "superseded") {
    const [zamena] = await db.sql<{ id: string }[]>`
      INSERT INTO source_documents
        (file_hash, file_name, page_count, issuer_code, business_document_type,
         parser_version, validation_status)
      VALUES (${randomUUID().replace(/-/g, "")}, 'zamena.pdf', 1, ${ISSUER},
              'faktura', 'qa-1', 'valid')
      RETURNING id`;
    await db.sql`
      UPDATE source_documents
         SET revision_status = 'superseded', superseded_by_id = ${zamena.id},
             revision_confirmed_by = ${owner.id}, revision_confirmed_at = now()
       WHERE id = ${sd.id}`;
  } else if (opts.revisionStatus === "conflict") {
    await db.sql`
      UPDATE source_documents
         SET revision_status = 'conflict', conflict_reason = 'dve verzije'
       WHERE id = ${sd.id}`;
  } else if (opts.revisionStatus === "pending_review") {
    await db.sql`
      UPDATE source_documents SET revision_status = 'pending_review' WHERE id = ${sd.id}`;
  }

  return { invoiceId: inv.id, sourceDocumentId: sd.id };
}

const svi = { customerIds: null as string[] | null };

async function dogadjaji(scope = svi, asOfDate = AS_OF) {
  const { purchaseEvents } = await import("@/lib/ledger/recommendation-input");
  return purchaseEvents(scope, { asOfDate });
}

/* =========================================================================
 * 1. Osnova — red koji SME da uđe
 * ====================================================================== */

test("ispravan dokument mapiranog kupca ulazi u ulaz preporuka", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10");

  const events = await dogadjaji();
  assert.equal(events.length, 1);
  assert.equal(events[0].customerId, k.id);
  assert.equal(events[0].articleCode, "REC001");
  assert.equal(events[0].issuedOn, "2026-01-10");
  assert.equal(events[0].articleName, "Bazni lak 1L");
  assert.equal(events[0].sourceDocumentIds.length, 1);
});

/* =========================================================================
 * 2. Isključenja — svaki uslov posebno
 * ====================================================================== */

test("faktura BEZ izvornog dokumenta (legacy/CSV) ne ulazi", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", { withSourceDocument: false });

  assert.deepEqual(await dogadjaji(), []);

  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  const d = await inputDiagnostics(svi, { asOfDate: AS_OF });
  assert.equal(d.accepted, 0);
  assert.equal(d.excluded.no_source_document, 1);
});

test("dokument iz csv_import / legacy_unknown kanala ne ulazi", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", { origin: "csv_import" });
  await dokument(k, "2026-02-10", { origin: "legacy_unknown" });

  assert.deepEqual(await dogadjaji(), []);
  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  const d = await inputDiagnostics(svi, { asOfDate: AS_OF });
  assert.equal(d.excluded.legacy_or_csv_origin, 2);
});

test("ZAMENJENA revizija ne ulazi", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", { revisionStatus: "superseded" });

  assert.deepEqual(await dogadjaji(), []);
  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  assert.equal(
    (await inputDiagnostics(svi, { asOfDate: AS_OF })).excluded.revision_superseded, 1);
});

test("SUDAR revizija ne ulazi", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", { revisionStatus: "conflict" });

  assert.deepEqual(await dogadjaji(), []);
  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  assert.equal(
    (await inputDiagnostics(svi, { asOfDate: AS_OF })).excluded.revision_conflict, 1);
});

test("revizija koja ČEKA ODLUKU ne ulazi", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", { revisionStatus: "pending_review" });

  assert.deepEqual(await dogadjaji(), []);
  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  assert.equal(
    (await inputDiagnostics(svi, { asOfDate: AS_OF })).excluded.revision_pending_review, 1);
});

test("dokument na RUČNOM PREGLEDU ne ulazi", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", { manualReview: "pending" });

  assert.deepEqual(await dogadjaji(), []);
  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  assert.equal(
    (await inputDiagnostics(svi, { asOfDate: AS_OF })).excluded.manual_review_pending, 1);
});

test("NEVALIDAN dokument nema fakturu, pa nema ni ulaza — baza to brani", async (t) => {
  if (guard(t)) return;
  /*
   * `source_documents_invoice_needs_valid_ck` je jedina odbrana koja mora da
   * važi PRE pogleda: dokument sa `totals_mismatch`, `unparsable` ili
   * `unsupported_requires_sample` ne sme uopšte da dobije `invoice_id`.
   *
   * Test to i dokazuje — pokušaj upisa pada u bazi, ne u aplikaciji.
   *
   * Čisti se posle SVAKOG statusa, jer neuspeli upis izvornog dokumenta ostavlja
   * fakturu iza sebe. Bez toga bi sledeći prolaz merio zaostalu fakturu.
   */
  for (const status of ["totals_mismatch", "unparsable", "unsupported_requires_sample"]) {
    const k = await kupac("09001");
    await assert.rejects(
      () => dokument(k, "2026-01-10", { validationStatus: status }),
      /invoice_needs_valid|violates check constraint/i,
      `baza je dozvolila knjizenje dokumenta sa statusom ${status}`,
    );
    assert.deepEqual(await dogadjaji(), [], `status ${status} je stigao do ulaza`);
    await ocisti();
  }
});

test("POVUČENO mapiranje kupca gasi preporuku, a promet ostaje", async (t) => {
  if (guard(t)) return;
  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  const { ledgerTotals } = await import("@/lib/ledger/effective-sales");

  /*
   * Tri načina da veza prestane da važi, i sva tri moraju da ugase preporuku.
   *
   * `unmapped` traži da `customer_id` bude `NULL` (CHECK iz migracije 0008), pa
   * se prazni zajedno sa statusom; `conflict` i `disabled` zadržavaju kupca.
   */
  for (const [status, praznikupca] of [
    ["disabled", false], ["conflict", false], ["unmapped", true],
  ] as const) {
    const k = await kupac("09001");
    await dokument(k, "2026-01-10");
    assert.equal((await dogadjaji()).length, 1, "osnova nije ni ušla u ulaz");

    await db.sql`
      UPDATE customer_external_identifiers
         SET status = ${status},
             customer_id = ${praznikupca ? null : k.id},
             conflict_reason = ${status === "conflict" ? "dve firme na istu šifru" : null}
       WHERE external_partner_code = ${k.partnerCode}`;

    assert.deepEqual(await dogadjaji(), [], `status ${status} je i dalje puštao preporuku`);
    assert.equal(
      (await inputDiagnostics(svi, { asOfDate: AS_OF })).excluded.customer_not_mapped, 1);

    // Ledger i dalje vidi promet — preporuka i promet nisu isto pitanje.
    assert.equal((await ledgerTotals(svi)).gross_sales.lines, 1);
    await ocisti();
  }
});

test("šifra partnera drugog kupca ne otvara tuđu istoriju", async (t) => {
  if (guard(t)) return;
  const a = await kupac("09001");
  const b = await kupac("09002");
  // Dokument je knjižen na kupca A, ali nosi šifru partnera kupca B.
  await dokument(a, "2026-01-10", { partnerCode: "09002" });

  assert.deepEqual(await dogadjaji(), [], "veza je uspostavljena preko tuđe šifre");
  assert.ok(b.id);
});

test("PRAZNA šifra artikla ne pravi par", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", {
    lines: [{ articleCode: "" }, { articleCode: "   " }, { articleCode: "REC001" }],
  });

  const events = await dogadjaji();
  assert.equal(events.length, 1);
  assert.equal(events[0].articleCode, "REC001");

  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  assert.equal(
    (await inputDiagnostics(svi, { asOfDate: AS_OF })).excluded.empty_article_code, 2);
});

test("storno, povrat, korekcija i nerazvrstan dokument ne ulaze", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  for (const kind of [
    "storno", "povrat_robe", "knjizno_odobrenje",
    "korekcija_cene", "korekcija_popusta", "nepoznato",
  ]) {
    await dokument(k, "2026-01-10", { documentKind: kind });
  }

  assert.deepEqual(await dogadjaji(), []);
  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  assert.equal(
    (await inputDiagnostics(svi, { asOfDate: AS_OF })).excluded.document_not_positive_sale, 6);
});

test("nepozitivan red (nulta/negativna količina, negativan iznos) ne ulazi", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", {
    lines: [
      { articleCode: "REC001", quantity: "0.000" },
      { articleCode: "REC002", quantity: "-1.000" },
      { articleCode: "REC003", lineAmount: "-50.00" },
      { articleCode: "REC004" },
    ],
  });

  const events = await dogadjaji();
  assert.deepEqual(events.map((e) => e.articleCode), ["REC004"]);
  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  assert.equal(
    (await inputDiagnostics(svi, { asOfDate: AS_OF })).excluded.non_positive_line, 3);
});

test("dokument POSLE asOfDate ne ulazi — ni u jedan smer", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-06-30");
  await dokument(k, "2026-07-01");

  const events = await dogadjaji(svi, "2026-06-30");
  assert.deepEqual(events.map((e) => e.issuedOn), ["2026-06-30"], "granica nije uključiva");

  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  assert.equal(
    (await inputDiagnostics(svi, { asOfDate: "2026-06-30" })).excluded.after_as_of_date, 1);
});

test("asOfDate mora biti eksplicitan i u obliku YYYY-MM-DD", async (t) => {
  if (guard(t)) return;
  const { purchaseEvents } = await import("@/lib/ledger/recommendation-input");
  for (const los of ["", "danas", "2026-6-30", "2026-06-30T00:00:00Z"]) {
    await assert.rejects(
      () => purchaseEvents(svi, { asOfDate: los }),
      /asOfDate mora biti YYYY-MM-DD/,
      `prihvaćen neispravan asOfDate: ${JSON.stringify(los)}`,
    );
  }
});

/* =========================================================================
 * 3. Opseg
 * ====================================================================== */

test("prazan assignment daje NULA rezultata, nikad ceo promet", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10");

  const { resolveLedgerScope } = await import("@/lib/ledger/effective-sales");
  const scope = await resolveLedgerScope(asUser(rep));
  assert.deepEqual(scope.customerIds, []);
  assert.deepEqual(await dogadjaji(scope), []);
});

test("komercijalista vidi samo dodeljene kupce; gazda sve kroz capability", async (t) => {
  if (guard(t)) return;
  const a = await kupac("09001");
  const b = await kupac("09002");
  await dokument(a, "2026-01-10");
  await dokument(b, "2026-01-11");
  await db.sql`
    INSERT INTO customer_assignments (user_id, customer_id) VALUES (${rep.id}, ${a.id})`;

  const { resolveLedgerScope } = await import("@/lib/ledger/effective-sales");

  const repScope = await resolveLedgerScope(asUser(rep));
  const repEvents = await dogadjaji(repScope);
  assert.deepEqual(repEvents.map((e) => e.customerId), [a.id]);

  const ownerScope = await resolveLedgerScope(asUser(owner));
  assert.equal(ownerScope.customerIds, null);
  assert.equal((await dogadjaji(ownerScope)).length, 2);
});

test("customerId iz zahteva NE PROŠIRUJE opseg — presek, nikad unija", async (t) => {
  if (guard(t)) return;
  const a = await kupac("09001");
  const b = await kupac("09002");
  await dokument(a, "2026-01-10");
  await dokument(b, "2026-01-11");
  await db.sql`
    INSERT INTO customer_assignments (user_id, customer_id) VALUES (${rep.id}, ${a.id})`;

  const { resolveLedgerScope } = await import("@/lib/ledger/effective-sales");
  const { purchaseEvents } = await import("@/lib/ledger/recommendation-input");
  const repScope = await resolveLedgerScope(asUser(rep));

  // Traži se TUĐI kupac, izričito. Rezultat mora biti prazan, ne njegov promet.
  const kradja = await purchaseEvents(repScope, { asOfDate: AS_OF, customerId: b.id });
  assert.deepEqual(kradja, []);

  // Sopstveni kupac se i dalje vidi — sužavanje radi, proširivanje ne.
  const svoj = await purchaseEvents(repScope, { asOfDate: AS_OF, customerId: a.id });
  assert.equal(svoj.length, 1);
});

/* =========================================================================
 * 4. Kupovni ciklusi
 * ====================================================================== */

test("dva reda istog artikla na ISTOJ fakturi = jedan ciklus", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", {
    lines: [{ articleCode: "REC001" }, { articleCode: "REC001" }],
  });

  const events = await dogadjaji();
  assert.equal(events.length, 1);
  assert.equal(events[0].lineCount, 2, "stavke se ne gube, samo ne prave dva ciklusa");
  assert.equal(events[0].invoiceIds.length, 1);
});

test("dve fakture istog kupca ISTOG DANA = jedan dnevni ciklus", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10");
  await dokument(k, "2026-01-10");

  const events = await dogadjaji();
  assert.equal(events.length, 1, "jedna isporuka na dva dokumenta je postala dva ciklusa");
  assert.equal(events[0].invoiceIds.length, 2, "obe fakture moraju ostati kao dokaz");
});

test("različiti dani = različiti ciklusi", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10");
  await dokument(k, "2026-02-10");
  await dokument(k, "2026-03-10");

  const events = await dogadjaji();
  assert.deepEqual(events.map((e) => e.issuedOn), ["2026-01-10", "2026-02-10", "2026-03-10"]);
});

test("promena cene ili rabata ne menja identitet artikla", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", { lines: [{ lineAmount: "100.00" }] });
  await dokument(k, "2026-02-10", { lines: [{ lineAmount: "250.00" }] });

  const events = await dogadjaji();
  assert.equal(new Set(events.map((e) => e.articleCode)).size, 1);
  assert.equal(events.length, 2);
});

test("vodeće nule u šifri se ČUVAJU i razlikuju artikle", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", {
    lines: [{ articleCode: "0012" }, { articleCode: "12" }],
  });

  const events = await dogadjaji();
  assert.deepEqual(events.map((e) => e.articleCode).sort(), ["0012", "12"]);
});

test("isti naziv sa različitim šiframa ostaju različiti artikli", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", {
    lines: [
      { articleCode: "REC001", description: "Bazni lak 1L" },
      { articleCode: "REC002", description: "Bazni lak 1L" },
    ],
  });

  const events = await dogadjaji();
  assert.equal(events.length, 2, "naziv je spojio dva artikla");
});

test("različit naziv sa istom šifrom ostaje isti artikal", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10", {
    lines: [{ articleCode: "REC001", description: "Bazni lak 1L" }],
  });
  await dokument(k, "2026-02-10", {
    lines: [{ articleCode: "REC001", description: "BAZNI LAK 1 L (novo pakovanje)" }],
  });

  const events = await dogadjaji();
  assert.equal(new Set(events.map((e) => e.articleCode)).size, 1);
  assert.equal(events.length, 2);
});

test("rezultat je deterministički sortiran i ne zavisi od redosleda upisa", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-03-10", { lines: [{ articleCode: "REC002" }] });
  await dokument(k, "2026-01-10", { lines: [{ articleCode: "REC002" }] });
  await dokument(k, "2026-02-10", { lines: [{ articleCode: "REC001" }] });

  const prvi = await dogadjaji();
  const drugi = await dogadjaji();
  assert.deepEqual(prvi, drugi);
  assert.deepEqual(
    prvi.map((e) => `${e.articleCode}@${e.issuedOn}`),
    ["REC001@2026-02-10", "REC002@2026-01-10", "REC002@2026-03-10"],
  );
});

/* =========================================================================
 * 5. Dijagnostika se ne sme razići sa pogledom
 * ====================================================================== */

test("accepted iz dijagnostike je JEDNAK broju redova u pogledu", async (t) => {
  if (guard(t)) return;
  const a = await kupac("09001");
  const b = await kupac("09002");

  await dokument(a, "2026-01-10", {
    lines: [{ articleCode: "REC001" }, { articleCode: "REC002" }],
  });
  await dokument(a, "2026-02-10", { withSourceDocument: false });
  await dokument(a, "2026-03-10", { revisionStatus: "conflict" });
  await dokument(b, "2026-04-10", { documentKind: "povrat_robe" });
  await dokument(b, "2026-05-10", { lines: [{ articleCode: "" }] });
  await dokument(b, "2026-07-15");

  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  const d = await inputDiagnostics(svi, { asOfDate: AS_OF });

  const [{ redova }] = await db.sql<{ redova: number }[]>`
    SELECT count(*)::int AS redova FROM recommendation_input_lines
     WHERE issued_on <= ${AS_OF}`;
  assert.equal(d.accepted, redova, "dijagnostika i pogled se razilaze");
  assert.equal(d.accepted, 2);

  // Zbir mora da zatvori: prihvaćeno + isključeno = sve stavke u opsegu.
  const [{ sve }] = await db.sql<{ sve: number }[]>`
    SELECT count(*)::int AS sve FROM invoice_lines`;
  assert.equal(d.accepted + d.excludedTotal, sve);
});

test("dijagnostika poštuje opseg — prazan assignment ne vidi nijedan red", async (t) => {
  if (guard(t)) return;
  const k = await kupac("09001");
  await dokument(k, "2026-01-10");

  const { inputDiagnostics } = await import("@/lib/ledger/recommendation-input");
  const d = await inputDiagnostics({ customerIds: [] }, { asOfDate: AS_OF });
  assert.equal(d.accepted, 0);
  assert.equal(d.excludedTotal, 0);
});
