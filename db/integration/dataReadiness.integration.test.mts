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
 * Spremnost podataka nad PRAVIM PostgreSQL-om.
 *
 * Tvrdnje ovog fajla ne žive u JavaScriptu: `count(DISTINCT …)`, `FILTER`,
 * uslov opsega i sam pogled `effective_sales_ledger` su SQL. Mock ih ne
 * pokazuje, a upravo u njima je i jedina prilika da promet bude prebrojan
 * dvaput.
 *
 * SVI podaci su sintetički. Nijedno ime, PIB, šifra ni iznos ne potiče iz
 * stvarnog poslovanja; PDF-ovi su generisani fixtures iz `fixtures/dev/`.
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
/** Dva komercijaliste sa RAZLIČITIM opsegom — za dokaz izolacije. */
let repA: { id: string; name: string; role: string };
let repB: { id: string; name: string; role: string };

const ISSUER = "QA01";
const SVE = { customerIds: null } as const;

const bytesOf = async (n: string) =>
  new Uint8Array(await readFile(new URL(`../../fixtures/dev/biznisoft/${n}`, import.meta.url)));

/** Ista poslovna faktura, drugi otisak fajla — „reprint istog dokumenta“. */
const drugiBajtovi = (bytes: Uint8Array) =>
  new Uint8Array([...bytes, ...new TextEncoder().encode("\n% ponovna stampa\n")]);

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const a = await seedAccounts(db, [
    { key: "office", role: "kancelarija" },
    { key: "repa", role: "komercijalista" },
    { key: "repb", role: "komercijalista" },
  ]);
  actor = { id: a.office.id, name: a.office.name, role: a.office.role };
  repA = { id: a.repa.id, name: a.repa.name, role: a.repa.role };
  repB = { id: a.repb.id, name: a.repb.name, role: a.repb.role };
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
  await db.sql`DELETE FROM articles WHERE code LIKE '9%' OR code LIKE '8%'`;
  await db.sql`DELETE FROM customer_assignments`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
}

async function noviKupac(ime = "QA Kupac") {
  const [row] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, ${ime}) RETURNING id`;
  return row.id;
}

async function dodeli(rep: { id: string }, customerId: string) {
  await db.sql`
    INSERT INTO customer_assignments (user_id, customer_id)
    VALUES (${rep.id}, ${customerId})`;
}

/**
 * Faktura sa proizvoljnim brojem redova — kao iz ranijeg CSV uvoza.
 *
 * `redovi` je niz šifri artikala; ponovljena šifra je NAMERNO dozvoljena, jer
 * je upravo to slučaj „tri reda istog artikla na jednoj fakturi“.
 */
async function faktura(input: {
  customerId: string;
  issuedOn: string;
  broj: string;
  redovi: string[];
  kind?: string;
}) {
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                          customer_id, net_amount, total_amount)
    VALUES (${ISSUER}, ${input.kind ?? "faktura"}, ${input.broj},
            ${Number(input.issuedOn.slice(0, 4))}, ${input.issuedOn},
            ${input.customerId}, '100.00', '120.00')
    RETURNING id`;

  let n = 0;
  for (const sifra of input.redovi) {
    n += 1;
    const [art] = await db.sql<{ id: string }[]>`
      INSERT INTO articles (code, name) VALUES (${sifra}, ${`QA artikal ${sifra}`})
      ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code
      RETURNING id`;
    await db.sql`
      INSERT INTO invoice_lines (invoice_id, line_number, article_id, article_code,
                                 quantity, unit_price, line_amount)
      VALUES (${inv.id}, ${n}, ${art.id}, ${sifra}, '1.000', '100.0000', '100.00')`;
  }
  return inv.id;
}

const modul = () => import("@/lib/readiness/data-readiness");
const PUN: { od: string | null; do: string | null } = { od: null, do: null };

/* =========================================================================
 * Prazna baza i nulti imenitelj
 * ====================================================================== */

test("prazna baza daje nule i nulti imenitelj, ne 0% i ne 100%", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { zbirniPregled, parovi, mapiranjeKupaca, mapiranjeArtikala } = await modul();
  const { pokrivenost, pokrivenostTekst } = await import("@/lib/readiness/dataReadiness.mjs");

  const zbir = await zbirniPregled(SVE, PUN);
  assert.deepEqual(zbir, {
    dokumenata: 0,
    stavki: 0,
    kupaca: 0,
    artikala: 0,
    najranije: null,
    najkasnije: null,
  });

  assert.deepEqual(await parovi(SVE, PUN), {
    ukupno: 0,
    saViseFaktura: 0,
    saViseDatuma: 0,
  });

  const k = await mapiranjeKupaca(SVE);
  const a = await mapiranjeArtikala(SVE, PUN);
  assert.deepEqual(k, { potvrdjeno: 0, ukupno: 0 });
  assert.deepEqual(a, { potvrdjeno: 0, ukupno: 0 });

  // Nulti imenitelj se NE prikazuje kao pokrivenost.
  for (const brojevi of [k, a]) {
    const p = pokrivenost({ ...brojevi, imenitelj: "QA imenitelj" });
    assert.equal(pokrivenostTekst(p), "nije dostupno");
  }
});

/* =========================================================================
 * Duplo brojanje: jedan dokument, više redova istog artikla
 * ====================================================================== */

test("tri reda istog artikla na jednoj fakturi su JEDNA kupovina", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { zbirniPregled, parovi } = await modul();

  const kupac = await noviKupac();
  await faktura({
    customerId: kupac,
    issuedOn: "2026-03-10",
    broj: "R-1",
    redovi: ["900001", "900001", "900001"],
  });

  const zbir = await zbirniPregled(SVE, PUN);
  assert.equal(zbir.dokumenata, 1, "tri reda su prebrojana kao tri dokumenta");
  assert.equal(zbir.stavki, 3, "stavke se broje kakve jesu");
  assert.equal(zbir.artikala, 1);

  /*
   * Ovo je jezgro zadatka: par (kupac, artikal) postoji, ali NIJE ponovljena
   * kupovina. Bez `count(DISTINCT invoice_id)` bi ovde stajalo 1 i sistem bi
   * tvrdio da kupac ponovo kupuje isti artikal — na osnovu jednog dokumenta.
   */
  const par = await parovi(SVE, PUN);
  assert.equal(par.ukupno, 1);
  assert.equal(par.saViseFaktura, 0, "jedna faktura je prebrojana kao dve");
  assert.equal(par.saViseDatuma, 0);
});

test("ponovljen par na dve fakture ISTOG dana broji fakture, ne datume", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { parovi } = await modul();

  const kupac = await noviKupac();
  await faktura({ customerId: kupac, issuedOn: "2026-03-10", broj: "R-1", redovi: ["900001"] });
  await faktura({ customerId: kupac, issuedOn: "2026-03-10", broj: "R-2", redovi: ["900001"] });

  const par = await parovi(SVE, PUN);
  assert.equal(par.ukupno, 1);
  assert.equal(par.saViseFaktura, 1, "dve različite fakture nisu prepoznate");
  /*
   * Dva dokumenta istog dana najčešće su jedna isporuka razbijena na dva
   * računa. Da su datumi brojani zajedno sa fakturama, to bi izgledalo kao da
   * kupac dolazi dvaput.
   */
  assert.equal(par.saViseDatuma, 0, "isti datum je prebrojan kao dva dolaska");
});

test("ponovljen par na različitim datumima broji se u oba merila", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { parovi } = await modul();

  const kupac = await noviKupac();
  await faktura({ customerId: kupac, issuedOn: "2026-03-10", broj: "R-1", redovi: ["900001"] });
  await faktura({ customerId: kupac, issuedOn: "2026-05-02", broj: "R-2", redovi: ["900001"] });

  const par = await parovi(SVE, PUN);
  assert.equal(par.ukupno, 1);
  assert.equal(par.saViseFaktura, 1);
  assert.equal(par.saViseDatuma, 1);
});

/* =========================================================================
 * Duplikat, sudar, superseded — izbor B
 * ====================================================================== */

test("duplikat uvoza ne povećava broj efektivnih kupovina", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { zbirniPregled } = await modul();

  const kupac = await noviKupac();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${kupac}, 'mapped')`;

  const bytes = await bytesOf("vise-stavki.pdf");
  const prvi = await ingestBiznisoftPdf(
    { bytes, fileName: "a.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(prvi.result, "ingested");
  const posle1 = await zbirniPregled(SVE, PUN);

  // Isti bajtovi, drugo ime fajla — otisak sadržaja je isti.
  const drugi = await ingestBiznisoftPdf(
    { bytes, fileName: "kopija.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(drugi.result, "duplicate_file");

  const posle2 = await zbirniPregled(SVE, PUN);
  assert.deepEqual(posle2, posle1, "duplikat je promenio promet");
  assert.equal(posle2.dokumenata, 1);
});

test("sudar verzija ne ostavlja nijednu kupovinu u metrikama", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { zbirniPregled, problemiDokumenata } = await modul();

  const kupac = await noviKupac();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${kupac}, 'mapped')`;

  const bytes = await bytesOf("vise-stavki.pdf");
  await ingestBiznisoftPdf({ bytes, fileName: "a.pdf", issuerCode: ISSUER }, actor);
  const b = await ingestBiznisoftPdf(
    { bytes: drugiBajtovi(bytes), fileName: "b.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(b.result, "business_key_conflict");

  // Obe verzije su sporne, pa promet pada na nulu — ne udvostručuje se.
  const zbir = await zbirniPregled(SVE, PUN);
  assert.equal(zbir.dokumenata, 0);
  assert.equal(zbir.stavki, 0);

  // Ali problem MORA biti vidljiv, inače bi nula izgledala kao „nema podataka“.
  const p = await problemiDokumenata(SVE);
  assert.equal(p.sudar, 2, "obe sporne verzije nisu prebrojane");
  assert.equal(p.ukupnoRazlicitih, 2);
});

test("izbor B: metrike se zasnivaju SAMO na efektivnoj verziji", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { ingestBiznisoftPdf, resolveDocumentRevision } = await import("@/lib/pdf/ingest");
  const { zbirniPregled, parovi } = await modul();

  const kupac = await noviKupac();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${kupac}, 'mapped')`;

  const bytes = await bytesOf("vise-stavki.pdf");
  const a = await ingestBiznisoftPdf({ bytes, fileName: "a.pdf", issuerCode: ISSUER }, actor);
  const b = await ingestBiznisoftPdf(
    { bytes: drugiBajtovi(bytes), fileName: "b.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(a.result, "ingested");
  assert.equal(b.result, "business_key_conflict");

  await resolveDocumentRevision(
    {
      supersededId: a.sourceDocumentId!,
      supersedingId: b.sourceDocumentId!,
      reason: "QA: verzija B važi",
    },
    actor,
  );

  /*
   * Posle razrešenja postoje DVA izvorna dokumenta i JEDNA faktura. Metrike
   * moraju videti tačno jedan efektivan dokument — ni dva (obe verzije), ni
   * nula (obe i dalje sporne).
   */
  const zbir = await zbirniPregled(SVE, PUN);
  assert.equal(zbir.dokumenata, 1, "zamenjena verzija je ušla u metrike");
  assert.equal(zbir.kupaca, 1);

  const [{ sd }] = await db.sql<{ sd: number }[]>`
    SELECT count(*)::int AS sd FROM source_documents`;
  assert.equal(sd, 2, "istorija verzija je obrisana");

  // Nijedan par se ne ponavlja: postoji samo jedan efektivan dokument.
  assert.equal((await parovi(SVE, PUN)).saViseFaktura, 0);
});

/* =========================================================================
 * CSV/PDF sudar
 * ====================================================================== */

test("CSV faktura + PDF iz drugog izvora: bez dupliranja, uz vidljiv problem", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { zbirniPregled, problemiDokumenata } = await modul();
  const { parseBiznisoftPdf } = await import("@/lib/pdf/extract");

  const kupac = await noviKupac();
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, '09002', ${kupac}, 'mapped')`;

  /*
   * Prvo se ručno unese faktura sa ISTIM poslovnim identitetom kao PDF —
   * tačno ono što ostavlja raniji CSV uvoz iz knjigovodstva.
   */
  const bytes = await bytesOf("vise-stavki.pdf");
  const parsed = await parseBiznisoftPdf(bytes);
  const broj = parsed.header.documentNumber.value!;
  const datum = parsed.header.documentDate.value!;
  await faktura({ customerId: kupac, issuedOn: datum, broj, redovi: ["900001"] });

  const preZbir = await zbirniPregled(SVE, PUN);
  assert.equal(preZbir.dokumenata, 1);
  assert.equal(preZbir.stavki, 1);

  const out = await ingestBiznisoftPdf(
    { bytes, fileName: "iz-pdf.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "already_imported_other_source");

  /*
   * PDF se NE knjiži drugi put. Promet ostaje identičan — ni jedan red više.
   * Da je PDF prošao, isti posao bi bio prebrojan dvaput kao veći promet.
   */
  const posle = await zbirniPregled(SVE, PUN);
  assert.deepEqual(posle, preZbir, "PDF je udvostručio promet");

  /*
   * Ali to NIJE potvrda da je sadržaj isti. Mora ostati vidljiv otvoren
   * problem porekla — inače bi tiho nestao.
   */
  const p = await problemiDokumenata(SVE);
  assert.equal(p.sudar, 1, "sudar porekla nije vidljiv");
  assert.equal(p.rucniPregled, 1, "sudar ne čeka ručni pregled");
  assert.equal(p.ukupnoRazlicitih, 1, "isti dokument je prebrojan više puta");

  // Kategorije se preklapaju i NE smeju se sabirati.
  const { problemiDokumenata: slozi } = await import("@/lib/readiness/dataReadiness.mjs");
  const pregled = slozi(p);
  assert.equal(pregled.preklapaSe, true);
  assert.ok(
    pregled.kategorije.reduce((s: number, k: { broj: number }) => s + k.broj, 0) >
      pregled.ukupnoRazlicitih,
    "zbir kategorija nije veći od broja dokumenata — preklapanje se izgubilo",
  );
});

/* =========================================================================
 * Nemapirani identiteti i nepodržani korektivni dokumenti
 * ====================================================================== */

test("nemapiran kupac ne pravi promet, ali se broji kao dokument koji čeka", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { zbirniPregled, problemiDokumenata, mapiranjeKupaca } = await modul();

  // Bez ijednog `customer_external_identifiers` reda unapred.
  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "n.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "awaiting_customer_mapping");

  assert.equal((await zbirniPregled(SVE, PUN)).dokumenata, 0, "nemapiran dokument je ušao u promet");

  const p = await problemiDokumenata(SVE);
  assert.equal(p.cekaMapiranje, 1);
  assert.equal(p.ukupnoRazlicitih, 1);

  // Uvoz je zaveo šifru partnera kao `unmapped` — imenitelj postoji, potvrde nema.
  const k = await mapiranjeKupaca(SVE);
  assert.equal(k.ukupno, 1, "šifra partnera nije zavedena");
  assert.equal(k.potvrdjeno, 0);
});

test("nepodržan korektivni oblik ide u „bez uzorka“, ne u promet", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { zbirniPregled, problemiDokumenata } = await modul();

  /*
   * `nastavak-tabele.pdf` je oblik za koji nema potvrđenog uzorka — isto
   * stanje u koje padaju storno, povrat i knjižno odobrenje.
   */
  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("nastavak-tabele.pdf"), fileName: "k.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "quarantined");

  assert.equal((await zbirniPregled(SVE, PUN)).dokumenata, 0);

  const p = await problemiDokumenata(SVE);
  assert.equal(p.bezPodrskeZaFormat, 1, "oblik bez uzorka nije prebrojan");
  assert.equal(p.rucniPregled, 1);
  assert.equal(p.cekaMapiranje, 0, "dokument koji nije prošao proveru ne čeka mapiranje");
});

test("korektivni dokument se vidi u svojoj kofi i NE umanjuje neto", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { zbirniPregled, korektivni } = await modul();

  const kupac = await noviKupac();
  await faktura({ customerId: kupac, issuedOn: "2026-03-10", broj: "R-1", redovi: ["900001"] });
  await faktura({
    customerId: kupac,
    issuedOn: "2026-03-12",
    broj: "P-1",
    redovi: ["900001"],
    kind: "povrat_robe",
  });

  // Povrat NE ulazi u efektivnu prodaju.
  const zbir = await zbirniPregled(SVE, PUN);
  assert.equal(zbir.dokumenata, 1, "povrat je ušao u efektivnu prodaju");
  assert.equal(zbir.stavki, 1);

  const k = await korektivni(SVE, PUN);
  assert.equal(k.dokumenata, 1);
  assert.equal(k.stavki, 1);
  /*
   * Veza sa originalom se nigde ne čuva, pa je „bez dokazane veze“ ceo skup.
   * Kada bi ovaj broj bio manji od ukupnog, neko bi zaključio da je deo
   * povrata već obračunat u neto prometu — a nijedan nije.
   */
  assert.equal(k.bezDokazaneVeze, k.dokumenata);
});

/* =========================================================================
 * Opseg: prazan assignment i izolacija dva komercijaliste
 * ====================================================================== */

test("prazan assignment daje nula kupaca i nula metrika, nikad globalni pregled", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { resolveLedgerScope } = await import("@/lib/ledger/effective-sales");
  const { zbirniPregled, parovi, problemiDokumenata, mapiranjeKupaca } = await modul();

  // Postoji promet, ali komercijalista nema nijednu dodelu.
  const kupac = await noviKupac();
  await faktura({ customerId: kupac, issuedOn: "2026-03-10", broj: "R-1", redovi: ["900001"] });
  assert.equal((await zbirniPregled(SVE, PUN)).dokumenata, 1, "preduslov: promet postoji");

  const scope = await resolveLedgerScope(kaoKorisnik(repA));

  /*
   * `[]` i `null` NISU isto. Prazan niz mora dati prazan rezultat; da je
   * uslov izostavljen, komercijalista bez ijedne dodele bi video ceo promet
   * firme — najgori mogući ishod ove greške.
   */
  assert.deepEqual(scope.customerIds, []);

  assert.equal((await zbirniPregled(scope, PUN)).dokumenata, 0);
  assert.equal((await zbirniPregled(scope, PUN)).kupaca, 0);
  assert.equal((await parovi(scope, PUN)).ukupno, 0);
  assert.equal((await mapiranjeKupaca(scope)).ukupno, 0);
  assert.equal((await problemiDokumenata(scope)).ukupnoRazlicitih, 0);
});

test("dva komercijaliste sa različitim opsegom ne vide zbir onog drugog", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { resolveLedgerScope } = await import("@/lib/ledger/effective-sales");
  const { zbirniPregled, parovi, fakturePoKupcu } = await modul();

  const kupacA = await noviKupac("QA Kupac A");
  const kupacB = await noviKupac("QA Kupac B");
  await dodeli(repA, kupacA);
  await dodeli(repB, kupacB);

  // A ima dve fakture i ponovljen par; B ima jednu.
  await faktura({ customerId: kupacA, issuedOn: "2026-03-10", broj: "A-1", redovi: ["900001"] });
  await faktura({ customerId: kupacA, issuedOn: "2026-04-10", broj: "A-2", redovi: ["900001"] });
  await faktura({ customerId: kupacB, issuedOn: "2026-03-11", broj: "B-1", redovi: ["800001"] });

  const scopeA = await resolveLedgerScope(kaoKorisnik(repA));
  const scopeB = await resolveLedgerScope(kaoKorisnik(repB));

  const zbirA = await zbirniPregled(scopeA, PUN);
  const zbirB = await zbirniPregled(scopeB, PUN);

  assert.equal(zbirA.dokumenata, 2);
  assert.equal(zbirA.kupaca, 1, "A vidi više od svog kupca");
  assert.equal(zbirB.dokumenata, 1);
  assert.equal(zbirB.kupaca, 1, "B vidi više od svog kupca");

  // Nijedan ne vidi ukupan promet (3 dokumenta, 2 kupca).
  const globalno = await zbirniPregled(SVE, PUN);
  assert.equal(globalno.dokumenata, 3);
  assert.notEqual(zbirA.dokumenata, globalno.dokumenata);
  assert.notEqual(zbirB.dokumenata, globalno.dokumenata);

  // Artikli su različiti: nijedan opseg ne propušta tuđu šifru.
  assert.equal(zbirA.artikala, 1);
  assert.equal(zbirB.artikala, 1);

  // Ponavljanje je samo kod A — B ga ne nasleđuje.
  assert.equal((await parovi(scopeA, PUN)).saViseFaktura, 1);
  assert.equal((await parovi(scopeB, PUN)).saViseFaktura, 0);

  // Raspodela vidi tačno jednog kupca po opsegu, ne oba.
  assert.deepEqual(await fakturePoKupcu(scopeA, PUN), [{ faktura: 2, kupaca: 1 }]);
  assert.deepEqual(await fakturePoKupcu(scopeB, PUN), [{ faktura: 1, kupaca: 1 }]);
});

test("nemapiran dokument ne curi u zbir komercijaliste", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { resolveLedgerScope } = await import("@/lib/ledger/effective-sales");
  const { problemiDokumenata, mapiranjeKupaca } = await modul();

  const kupacA = await noviKupac("QA Kupac A");
  await dodeli(repA, kupacA);
  await faktura({ customerId: kupacA, issuedOn: "2026-03-10", broj: "A-1", redovi: ["900001"] });

  // Dokument čija šifra partnera nije mapirana ni na koga.
  const out = await ingestBiznisoftPdf(
    { bytes: await bytesOf("vise-stavki.pdf"), fileName: "n.pdf", issuerCode: ISSUER },
    actor,
  );
  assert.equal(out.result, "awaiting_customer_mapping");

  const scopeA = await resolveLedgerScope(kaoKorisnik(repA));

  /*
   * Nemapiran dokument nema kupca i zato ne pripada nijednom opsegu.
   * Prikazati ga komercijalisti značilo bi da nemapiranost SAMA PO SEBI
   * otvara vidljivost — suprotno od onoga što mapiranje čeka da odluči.
   */
  const pA = await problemiDokumenata(scopeA);
  assert.equal(pA.ukupnoRazlicitih, 0, "nemapiran dokument je procurio u opseg komercijaliste");
  assert.equal(pA.cekaMapiranje, 0);
  assert.equal(pA.obuhvataNepripisive, false, "ekran ne kaže da brojevi nisu potpuni");

  // Kancelarija ga vidi kroz postojeću globalnu politiku.
  const pSve = await problemiDokumenata(SVE);
  assert.equal(pSve.cekaMapiranje, 1);
  assert.equal(pSve.obuhvataNepripisive, true);

  // Ni nemapirana šifra partnera ne ulazi u imenitelj komercijaliste.
  assert.equal((await mapiranjeKupaca(scopeA)).ukupno, 0);
  assert.equal((await mapiranjeKupaca(SVE)).ukupno, 1);
});

/** Minimalan `PortalUser` za `resolveLedgerScope`. */
function kaoKorisnik(a: { id: string; name: string; role: string }) {
  return {
    id: a.id,
    email: `${a.id}@qa-1b.invalid`,
    name: a.name,
    initials: "QA",
    role: a.role as "gazda" | "komercijalista" | "kancelarija" | "magacioner",
    active: true,
    sessionVersion: 0,
    permissions: [] as string[],
  };
}

/* =========================================================================
 * Granice perioda
 * ====================================================================== */

test("granice perioda su uključive na oba kraja", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { zbirniPregled } = await modul();

  const kupac = await noviKupac();
  await faktura({ customerId: kupac, issuedOn: "2026-03-01", broj: "R-1", redovi: ["900001"] });
  await faktura({ customerId: kupac, issuedOn: "2026-03-15", broj: "R-2", redovi: ["900001"] });
  await faktura({ customerId: kupac, issuedOn: "2026-03-31", broj: "R-3", redovi: ["900001"] });

  /*
   * Ceo mart. Da je gornja granica isključiva, faktura od 31. bi tiho ispala i
   * mesečni zbir se ne bi poklapao sa knjigovodstvom za tačno jedan dan.
   */
  const mart = await zbirniPregled(SVE, { od: "2026-03-01", do: "2026-03-31" });
  assert.equal(mart.dokumenata, 3, "granica perioda je isključila krajnji dan");

  // Jedan dan: obe granice na istom datumu daju tačno taj dokument.
  const jedan = await zbirniPregled(SVE, { od: "2026-03-15", do: "2026-03-15" });
  assert.equal(jedan.dokumenata, 1);
  assert.equal(jedan.najranije, "2026-03-15");
  assert.equal(jedan.najkasnije, "2026-03-15");

  // Period koji ne obuhvata ništa daje nulu, ne ceo skup.
  const prazan = await zbirniPregled(SVE, { od: "2026-01-01", do: "2026-01-31" });
  assert.equal(prazan.dokumenata, 0);
  assert.equal(prazan.najranije, null);
});

test("period seče i parove i mesečnu tabelu, ne samo zbir", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { parovi, poMesecima } = await modul();

  const kupac = await noviKupac();
  await faktura({ customerId: kupac, issuedOn: "2026-03-10", broj: "R-1", redovi: ["900001"] });
  await faktura({ customerId: kupac, issuedOn: "2026-09-10", broj: "R-2", redovi: ["900001"] });

  // Ceo period: par se ponavlja.
  assert.equal((await parovi(SVE, PUN)).saViseDatuma, 1);

  // Samo mart: ponavljanja NEMA, jer druga kupovina je van perioda.
  const samoMart = await parovi(SVE, { od: "2026-03-01", do: "2026-03-31" });
  assert.equal(samoMart.ukupno, 1);
  assert.equal(samoMart.saViseDatuma, 0, "period nije primenjen na parove");

  const meseci = await poMesecima(SVE, PUN);
  assert.deepEqual(
    meseci.map((m) => m.mesec),
    ["2026-09", "2026-03"],
  );
  assert.equal(meseci[0].faktura, 1);
});

/* =========================================================================
 * Mapiranje artikala
 * ====================================================================== */

test("imenitelj artikala su artikli U PROMETU, ne ceo registar", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { mapiranjeArtikala } = await modul();

  const kupac = await noviKupac();
  await faktura({ customerId: kupac, issuedOn: "2026-03-10", broj: "R-1", redovi: ["900001"] });

  // Artikal koji postoji u registru, ali nikad nije prodat.
  await db.sql`INSERT INTO articles (code, name) VALUES ('900999', 'QA neprodat')`;

  const a = await mapiranjeArtikala(SVE, PUN);
  assert.equal(a.ukupno, 1, "neprodat artikal je ušao u imenitelj");
  assert.equal(a.potvrdjeno, 0);
});

test("odbijeni predlozi mapiranja ne udvostručuju artikal u imenitelju", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const { mapiranjeArtikala } = await modul();

  const kupac = await noviKupac();
  await faktura({ customerId: kupac, issuedOn: "2026-03-10", broj: "R-1", redovi: ["900001"] });

  const [art] = await db.sql<{ id: string }[]>`
    SELECT id FROM articles WHERE code = '900001'`;

  /*
   * `article_catalog_mappings` dopušta više `rejected` redova po artiklu
   * (istorija predloga) uz najviše jedan živi. Bez uslova na statuse, LEFT JOIN
   * bi isti artikal ubacio u imenitelj jednom po odbijenom predlogu.
   */
  await db.sql`
    INSERT INTO article_catalog_mappings (article_id, catalog_product_slug, status, note)
    VALUES (${art.id}, 'qa-a', 'rejected', 'QA'),
           (${art.id}, 'qa-b', 'rejected', 'QA'),
           (${art.id}, 'qa-c', 'mapped', 'QA')`;

  const a = await mapiranjeArtikala(SVE, PUN);
  assert.equal(a.ukupno, 1, "odbijeni predlozi su udvostručili artikal");
  assert.equal(a.potvrdjeno, 1);
});

/* =========================================================================
 * Read-only
 * ====================================================================== */

test("pregled ne menja nijedan poslovni red", async (t) => {
  if (guard(t)) return;
  await ocisti();
  const modulReadiness = await modul();

  const kupac = await noviKupac();
  await faktura({ customerId: kupac, issuedOn: "2026-03-10", broj: "R-1", redovi: ["900001"] });

  const otisak = async () => {
    const [r] = await db.sql<{ o: string }[]>`
      SELECT
        (SELECT count(*) FROM invoices)::text || '/' ||
        (SELECT count(*) FROM invoice_lines)::text || '/' ||
        (SELECT count(*) FROM source_documents)::text || '/' ||
        (SELECT count(*) FROM customers)::text || '/' ||
        (SELECT count(*) FROM articles)::text || '/' ||
        (SELECT coalesce(max(updated_at)::text, '-') FROM invoices) AS o`;
    return r.o;
  };

  const pre = await otisak();

  // Svaka funkcija modula, redom.
  await modulReadiness.zbirniPregled(SVE, PUN);
  await modulReadiness.poMesecima(SVE, PUN);
  await modulReadiness.parovi(SVE, PUN);
  await modulReadiness.fakturePoKupcu(SVE, PUN);
  await modulReadiness.mapiranjeKupaca(SVE);
  await modulReadiness.mapiranjeArtikala(SVE, PUN);
  await modulReadiness.problemiDokumenata(SVE);
  await modulReadiness.korektivni(SVE, PUN);

  assert.equal(await otisak(), pre, "pregled je promenio poslovne podatke");
});
