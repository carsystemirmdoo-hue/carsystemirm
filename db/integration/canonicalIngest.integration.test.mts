import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
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
 * Canonical (JSON) ulaz nad PRAVIM PostgreSQL-om.
 *
 * Tvrdnja koju ovaj fajl brani: dva ulaza — ručni PDF upload i canonical JSON —
 * idu kroz JEDAN transakcioni servis i daju isti sadržaj i istu projekciju, bez
 * ijednog reda duplog prometa.
 *
 * Postojeće invarijante sudara i razrešenja se NE menjaju; ovde se samo
 * dokazuje da ih canonical put nasleđuje, a ne zaobilazi.
 *
 * Svi podaci su sintetički: generisani fixture PDF-ovi i izmišljeni kupci.
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
let actor: { id: string; name: string; role: string };

const ISSUER = "QA01";
const KORENSKI = new URL("../../", import.meta.url);

const bajtovi = async (ime: string) =>
  new Uint8Array(await readFile(new URL(`fixtures/dev/biznisoft/${ime}`, KORENSKI)));

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const a = await seedAccounts(db, [{ key: "office", role: "kancelarija" }]);
  actor = { id: a.office.id, name: a.office.name, role: a.office.role };
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
  await db.sql`DELETE FROM articles WHERE code LIKE '9%'`;
  await db.sql`DELETE FROM customer_assignments`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
}

/** Mapiran kupac za šifru partnera sa uzorka. */
async function mapiranKupac(partnerCode: string) {
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, ${partnerCode}, ${c.id}, 'mapped')`;
  return c.id;
}

/** Canonical payload iz sintetičkog PDF-a, kao što bi ga napravio lokalni proces. */
async function canonicalOd(ime: string) {
  const { parseBiznisoftPdf } = await import("@/lib/pdf/parseDocument");
  const { canonicalFromParsedDocument } = await import(
    "@/lib/sync/contract/fromParsedDocument.mjs"
  );
  const b = await bajtovi(ime);
  const parsed = await parseBiznisoftPdf(b);
  return { payload: canonicalFromParsedDocument(parsed, b, { issuerCode: ISSUER }), bytes: b };
}

/** Snimak projekcije jedne fakture — ono što ledger i ekrani zaista vide. */
async function projekcija() {
  const [zaglavlje] = await db.sql<
    { broj: string; godina: number; izdat: string; neto: string; porez: string; ukupno: string }[]
  >`
    SELECT number AS broj, year AS godina, issued_on::text AS izdat,
           net_amount::text AS neto, tax_amount::text AS porez, total_amount::text AS ukupno
      FROM invoices ORDER BY created_at LIMIT 1`;
  const stavke = await db.sql<
    {
      rb: number; sifra: string; kolicina: string; cena: string;
      rabat: string; stopa: string; iznos: string;
    }[]
  >`
    SELECT line_number AS rb, article_code AS sifra, quantity::text AS kolicina,
           unit_price::text AS cena, discount_percent::text AS rabat,
           tax_percent::text AS stopa, line_amount::text AS iznos
      FROM invoice_lines ORDER BY line_number`;
  return { zaglavlje, stavke };
}

/* =========================================================================
 * 6. Dva ulaza, isti servis, ista projekcija
 * ====================================================================== */

test("canonical ulaz daje ISTU projekciju kao ručni PDF upload", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { ingestCanonicalInvoice } = await import("@/lib/sync/ingestCanonical");

  /* --- Put A: ručni PDF upload. --------------------------------------- */
  await ocisti();
  await mapiranKupac("09002");
  const pdfIshod = await ingestBiznisoftPdf(
    { bytes: await bajtovi("vise-stavki.pdf"), fileName: "rucno.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(pdfIshod.result, "ingested");
  const izPdf = await projekcija();

  /* --- Put B: canonical JSON, na čistoj bazi. ------------------------- */
  await ocisti();
  await mapiranKupac("09002");
  const { payload } = await canonicalOd("vise-stavki.pdf");
  const jsonIshod = await ingestCanonicalInvoice(payload, { issuerCode: ISSUER }, actor);
  assert.equal(jsonIshod.result, "ingested");
  const izJson = await projekcija();

  /*
   * Poređenje ide nad ONIM ŠTO BAZA VRATI, ne nad ulazom.
   *
   * `numeric(14,3)` normalizuje i `1` i `1.000` na istu vrednost, pa dva ulaza
   * sa različitim decimalnim zapisom moraju dati isti tekst iz baze. Da se
   * negde izgubila decimala ili zaokružio iznos, videlo bi se ovde.
   */
  assert.deepEqual(izJson.stavke, izPdf.stavke, "stavke se razlikuju između dva ulaza");
  assert.deepEqual(
    izJson.zaglavlje,
    izPdf.zaglavlje,
    "zaglavlje fakture se razlikuje između dva ulaza",
  );
  assert.equal(izPdf.stavke.length, 7);
});

test("isti dokument oba puta: bez duplog prometa", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { ingestCanonicalInvoice } = await import("@/lib/sync/ingestCanonical");
  const { ledgerTotals } = await import("@/lib/ledger/effective-sales");

  await ocisti();
  await mapiranKupac("09002");

  await ingestBiznisoftPdf(
    { bytes: await bajtovi("vise-stavki.pdf"), fileName: "rucno.pdf", issuerCode: ISSUER },
    actor,
  );
  const posle1 = await ledgerTotals({ customerIds: null });
  assert.equal(posle1.gross_sales.lines, 7);

  /*
   * Isti dokument stiže i kao canonical.
   *
   * `source_hash` je otisak ISTIH bajtova, pa pogađa postojeću politiku
   * duplikata bez ijednog novog pravila. Da canonical put ima svoju
   * deduplikaciju, ovde bi nastalo sedam redova viška — tiho, kao veći promet.
   */
  const { payload } = await canonicalOd("vise-stavki.pdf");
  const ponovo = await ingestCanonicalInvoice(payload, { issuerCode: ISSUER }, actor);
  assert.equal(ponovo.result, "duplicate_file", "canonical put je zaobišao politiku duplikata");

  const posle2 = await ledgerTotals({ customerIds: null });
  assert.deepEqual(posle2, posle1, "promet se promenio posle duplikata");

  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  assert.equal(n, 1, "nastala je druga faktura za isti dokument");
});

test("obrnut redosled — canonical pa PDF — takođe ne duplira", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { ingestCanonicalInvoice } = await import("@/lib/sync/ingestCanonical");

  await ocisti();
  await mapiranKupac("09002");

  const { payload, bytes } = await canonicalOd("vise-stavki.pdf");
  assert.equal(
    (await ingestCanonicalInvoice(payload, { issuerCode: ISSUER }, actor)).result,
    "ingested",
  );
  const pdf = await ingestBiznisoftPdf(
    { bytes, fileName: "isti.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(pdf.result, "duplicate_file");

  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  assert.equal(n, 1);
});

/* =========================================================================
 * Nevalidan canonical ulaz ne ostavlja NIŠTA
 * ====================================================================== */

test("odbijen canonical ulaz ne ostavlja dokument, stavke ni promet", async (t) => {
  if (guard(t)) return;
  const { ingestCanonicalInvoice, ContractRejection } = await import("@/lib/sync/ingestCanonical");
  const { semanticHash } = await import("@/lib/sync/contract/canonical.mjs");

  await ocisti();
  await mapiranKupac("09002");

  const osnov = (await canonicalOd("vise-stavki.pdf")).payload;

  const slucajevi: [string, (d: Record<string, unknown>) => void][] = [
    ["lažan hash", (d) => ((d as { semantic_hash: string }).semantic_hash = `sha256:${"a".repeat(64)}`)],
    ["promenjen zbir", (d) => {
      (d as { totals: { printed_gross_total: string } }).totals.printed_gross_total = "1.00";
      (d as { semantic_hash: string }).semantic_hash = semanticHash(d);
    }],
    ["nepodržana valuta", (d) => {
      (d as { document: { currency: string } }).document.currency = "EUR";
      (d as { semantic_hash: string }).semantic_hash = semanticHash(d);
    }],
    ["datum prometa", (d) => {
      (d as { document: { trade_date: string | null } }).document.trade_date = "2026-01-02";
      (d as { semantic_hash: string }).semantic_hash = semanticHash(d);
    }],
    ["korektivna vrsta", (d) => {
      (d as { document: { kind: string } }).document.kind = "storno";
      (d as { semantic_hash: string }).semantic_hash = semanticHash(d);
    }],
    ["dodatno polje", (d) => ((d as { valid?: boolean }).valid = true)],
    ["nemoguć datum", (d) => {
      (d as { document: { issued_on: string } }).document.issued_on = "2026-02-30";
      (d as { semantic_hash: string }).semantic_hash = semanticHash(d);
    }],
  ];

  for (const [naziv, izmeni] of slucajevi) {
    const p = JSON.parse(JSON.stringify(osnov));
    izmeni(p);

    await assert.rejects(
      () => ingestCanonicalInvoice(p, { issuerCode: ISSUER }, actor),
      ContractRejection,
      `„${naziv}“ nije odbijen`,
    );

    const [{ sd }] = await db.sql<{ sd: number }[]>`
      SELECT count(*)::int AS sd FROM source_documents`;
    const [{ sl }] = await db.sql<{ sl: number }[]>`
      SELECT count(*)::int AS sl FROM source_document_lines`;
    const [{ inv }] = await db.sql<{ inv: number }[]>`
      SELECT count(*)::int AS inv FROM invoices`;
    assert.equal(sd, 0, `„${naziv}“ je ostavio izvorni dokument`);
    assert.equal(sl, 0, `„${naziv}“ je ostavio stavke`);
    assert.equal(inv, 0, `„${naziv}“ je ostavio fakturu`);
  }
});

test("tuđi izdavalac se odbija — opseg dolazi iz konteksta, ne iz sadržaja", async (t) => {
  if (guard(t)) return;
  const { ingestCanonicalInvoice, ContractRejection } = await import("@/lib/sync/ingestCanonical");

  await ocisti();
  await mapiranKupac("09002");
  const { payload } = await canonicalOd("vise-stavki.pdf");

  /*
   * Payload tvrdi `QA01`, a pozivalac je ovlašćen za `QA99`.
   *
   * Da se opseg čitao iz sadržaja, potpisan payload bi sam sebi dodelio
   * izdavaoca — i to je razlog zbog koga se ovde poredi, a ne preuzima.
   */
  await assert.rejects(
    () => ingestCanonicalInvoice(payload, { issuerCode: "QA99" }, actor),
    ContractRejection,
  );

  const [{ inv }] = await db.sql<{ inv: number }[]>`SELECT count(*)::int AS inv FROM invoices`;
  assert.equal(inv, 0);
});

/* =========================================================================
 * Postojeće invarijante se nasleđuju, ne zaobilaze
 * ====================================================================== */

test("nemapiran kupac: canonical put čeka mapiranje, ne knjiži", async (t) => {
  if (guard(t)) return;
  const { ingestCanonicalInvoice } = await import("@/lib/sync/ingestCanonical");

  await ocisti(); // bez ijednog mapiranja
  const { payload } = await canonicalOd("vise-stavki.pdf");
  const out = await ingestCanonicalInvoice(payload, { issuerCode: ISSUER }, actor);

  assert.equal(out.result, "awaiting_customer_mapping");
  const [{ inv }] = await db.sql<{ inv: number }[]>`SELECT count(*)::int AS inv FROM invoices`;
  assert.equal(inv, 0);
});

test("sudar verzija: canonical put karantinira obe, kao i PDF put", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { ingestCanonicalInvoice } = await import("@/lib/sync/ingestCanonical");
  const { parseBiznisoftPdf } = await import("@/lib/pdf/parseDocument");
  const { canonicalFromParsedDocument } = await import(
    "@/lib/sync/contract/fromParsedDocument.mjs"
  );

  await ocisti();
  await mapiranKupac("09002");

  const b = await bajtovi("vise-stavki.pdf");
  assert.equal(
    (await ingestBiznisoftPdf({ bytes: b, fileName: "a.pdf", issuerCode: ISSUER }, actor)).result,
    "ingested",
  );

  // Isti poslovni dokument, drugi bajtovi — druga verzija istog računa.
  const drugi = new Uint8Array([...b, ...new TextEncoder().encode("\n% ponovna stampa\n")]);
  const payload = canonicalFromParsedDocument(await parseBiznisoftPdf(drugi), drugi, {
    issuerCode: ISSUER,
  });

  const out = await ingestCanonicalInvoice(payload, { issuerCode: ISSUER }, actor);
  assert.equal(out.result, "business_key_conflict", "canonical put je zaobišao sudar verzija");

  // Obe verzije su sporne i nijedna nije u efektivnom prometu.
  const docs = await db.sql<{ revision_status: string; manual_review: string }[]>`
    SELECT revision_status, manual_review FROM source_documents ORDER BY created_at`;
  assert.equal(docs.length, 2);
  for (const d of docs) {
    assert.equal(d.revision_status, "conflict");
    assert.equal(d.manual_review, "pending");
  }
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM effective_sales_ledger`;
  assert.equal(n, 0, "sporna verzija je ostala u prometu");
});

test("razrešenje sudara radi i kada je jedna verzija stigla kao canonical", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf, resolveDocumentRevision } = await import("@/lib/pdf/ingest");
  const { ingestCanonicalInvoice } = await import("@/lib/sync/ingestCanonical");
  const { parseBiznisoftPdf } = await import("@/lib/pdf/parseDocument");
  const { canonicalFromParsedDocument } = await import(
    "@/lib/sync/contract/fromParsedDocument.mjs"
  );

  await ocisti();
  await mapiranKupac("09002");

  const b = await bajtovi("vise-stavki.pdf");
  const a = await ingestBiznisoftPdf({ bytes: b, fileName: "a.pdf", issuerCode: ISSUER }, actor);
  const drugi = new Uint8Array([...b, ...new TextEncoder().encode("\n% ponovna stampa\n")]);
  const payload = canonicalFromParsedDocument(await parseBiznisoftPdf(drugi), drugi, {
    issuerCode: ISSUER,
  });
  const bIshod = await ingestCanonicalInvoice(payload, { issuerCode: ISSUER }, actor);

  assert.equal(a.result, "ingested");
  assert.equal(bIshod.result, "business_key_conflict");

  // Izbor B — postojeća invarijanta, nepromenjena.
  await resolveDocumentRevision(
    {
      supersededId: (a as { sourceDocumentId: string }).sourceDocumentId,
      supersedingId: (bIshod as { sourceDocumentId: string }).sourceDocumentId,
      reason: "QA: canonical verzija važi",
    },
    actor,
  );

  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM effective_sales_ledger`;
  assert.equal(n, 7, "posle razrešenja promet nije tačno jednom u ledgeru");

  const [{ inv }] = await db.sql<{ inv: number }[]>`SELECT count(*)::int AS inv FROM invoices`;
  assert.equal(inv, 1, "nastala je druga faktura");

  // Izvorne stavke ranije verzije ostaju sačuvane.
  const [{ stavkiA }] = await db.sql<{ stavkiA: number }[]>`
    SELECT count(*)::int AS "stavkiA" FROM source_document_lines
     WHERE source_document_id = ${(a as { sourceDocumentId: string }).sourceDocumentId}`;
  assert.equal(stavkiA, 7);
});

/* =========================================================================
 * Privatnost i granica
 * ====================================================================== */

test("canonical put ne upisuje ime fajla sa kancelarijskog računara", async (t) => {
  if (guard(t)) return;
  const { ingestCanonicalInvoice } = await import("@/lib/sync/ingestCanonical");

  await ocisti();
  await mapiranKupac("09002");
  const { payload } = await canonicalOd("vise-stavki.pdf");
  await ingestCanonicalInvoice(payload, { issuerCode: ISSUER }, actor);

  const [{ file_name }] = await db.sql<{ file_name: string }[]>`
    SELECT file_name FROM source_documents LIMIT 1`;

  /*
   * Ugovor uopšte ne prenosi ime fajla; ovde stoji izvedena oznaka iz otiska.
   * Kolona je `NOT NULL`, pa je ovo zaobilaženje, ne rešenje — prava dopuna
   * (kolona za poreklo dokumenta) je zapisana kao preduslov za P2.
   */
  assert.match(file_name, /^canonical:[0-9a-f]{12}$/);
  assert.doesNotMatch(file_name, /\.pdf$/i);
});

test("nijedna API ruta ne postoji van izričito dozvoljenog spiska", async (t) => {
  if (guard(t)) return;
  const { readdir } = await import("node:fs/promises");

  /*
   * P1 je tvrdio da ruta ima tačno tri. Ta tvrdnja je bila svojstvo TE faze:
   * P2 namerno uvodi mrežni prijem. Zamenjena je spiskom IZRIČITO DOZVOLJENIH
   * ruta — bezbednosna provera ostaje, samo joj je lista eksplicitna. Nova
   * ruta koja se pojavi bez upisa ovde i dalje obara test.
   */
  const DOZVOLJENE = [
    "auth/[...nextauth]/route.ts",
    "portal/izvoz/route.ts",
    "portal/podesavanja/navigacija/route.ts",
    // P2: prijem sa uređaja, iza feature gate-a koji je podrazumevano isključen.
    "sync/heartbeat/route.ts",
    "sync/ingest/route.ts",
    /*
     * P4: ručne komande, iza DRUGOG gate-a koji je takođe podrazumevano
     * isključen. Idu kroz isti `withAuthenticatedDevice` kao prijem.
     */
    "sync/commands/poll/route.ts",
    "sync/commands/update/route.ts",
    /*
     * F5: stanje kupčeve prijave za javno zaglavlje. Samo čita SOPSTVENU sesiju
     * (naziv firme i ime), ne prima parametre, ne piše ništa i nikad se ne kešira.
     */
    "kupac/sesija/route.ts",
    /*
     * F6: „Poručite ponovo" u katalogu. Kupac isključivo iz SOPSTVENE sesije,
     * ruta ne prima parametre, samo čita, bez cena, i nikad se ne kešira.
     * Izolacija: customerReorder.integration.test.mts.
     */
    "kupac/poruci-ponovo/route.ts",
    /*
     * F8: ponude prijavljenog kupca za kartice i stranice proizvoda. Kupac
     * isključivo iz sesije, bez parametara, samo čitanje, no-store; bez lagera.
     */
    "kupac/ponude/route.ts",
  ];

  const rute: string[] = [];
  const hodaj = async (dir: URL) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = new URL(`${e.name}${e.isDirectory() ? "/" : ""}`, dir);
      if (e.isDirectory()) await hodaj(p);
      else if (e.name === "route.ts" || e.name === "route.tsx") rute.push(p.pathname);
    }
  };
  await hodaj(new URL("app/api/", KORENSKI));

  assert.deepEqual(
    rute.map((p) => p.split("/app/api/")[1]).sort(),
    [...DOZVOLJENE].sort(),
    "postoji API ruta koja nije na spisku dozvoljenih",
  );
});

test("svaka `/api/sync` ruta sama sprovodi gate i autentifikaciju", async (t) => {
  if (guard(t)) return;

  /*
   * Middleware nije zamena i ne sme postati: konfiguriše se na drugom mestu i
   * jedna izmena `matcher`-a bi tiho otvorila rutu. Zato svaka ruta mora da
   * prođe kroz `withAuthenticatedDevice`, koji nosi i gate i potpis.
   */
  for (const ruta of ["ingest", "heartbeat", "commands/poll", "commands/update"]) {
    const izvor = await readFile(new URL(`app/api/sync/${ruta}/route.ts`, KORENSKI), "utf8");
    assert.match(
      izvor,
      /withAuthenticatedDevice/,
      `ruta „${ruta}“ ne prolazi kroz zajedničku autentifikaciju`,
    );
    // Ed25519 traži `node:crypto`; Edge runtime ga nema.
    assert.match(izvor, /export const runtime = "nodejs"/);
  }

  const handler = await readFile(new URL("lib/sync/http/handler.ts", KORENSKI), "utf8");
  assert.match(handler, /isDeviceIngestEnabled/, "gate nije u zajedničkom putu");
  // P4 traži i drugi gate; komanda ne sme da prođe kroz prvi sama.
  assert.match(handler, /isSyncOperationsEnabled/, "operativni gate nije u zajedničkom putu");
  assert.match(handler, /authenticateDeviceRequest/, "potpis nije u zajedničkom putu");
});

test("canonical servis nije server action i ostaje serverski", async (t) => {
  if (guard(t)) return;
  const izvor = await readFile(new URL("lib/sync/ingestCanonical.ts", KORENSKI), "utf8");
  assert.match(izvor, /^import "server-only";/m);
  assert.doesNotMatch(izvor, /"use server"/);
});
