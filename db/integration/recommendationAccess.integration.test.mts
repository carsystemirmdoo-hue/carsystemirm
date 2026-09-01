import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before, beforeEach } from "node:test";
import {
  cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase,
  seedAccounts, skipReason, type TestDatabase,
} from "./harness.mts";

/**
 * Ko šta vidi na ekranu preporuka.
 *
 * Testira sloj sa kog stranica ČITA (`lib/recommendations/query.ts`) i model
 * dozvola, a ne raspored elemenata. Ono što se ovde dokazuje je da opseg dolazi
 * iz sesije: nijedan parametar iz adrese ne sme da ga proširi, ni onaj koji
 * postoji (`komercijalista`) ni onaj koji bi neko dopisao.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) { t.skip(reason); return true; }
  return false;
};

let db: TestDatabase;
let owner: { id: string; name: string; role: string };
let repA: { id: string; name: string; role: string };
let repB: { id: string; name: string; role: string };
let office: { id: string; name: string; role: string };

const ISSUER = "QAACC";
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
    { key: "accowner", role: "gazda" },
    { key: "accrepa", role: "komercijalista" },
    { key: "accrepb", role: "komercijalista" },
    { key: "accoffice", role: "kancelarija" },
  ]);
  owner = { id: a.accowner.id, name: a.accowner.name, role: a.accowner.role };
  repA = { id: a.accrepa.id, name: a.accrepa.name, role: a.accrepa.role };
  repB = { id: a.accrepb.id, name: a.accrepb.name, role: a.accrepb.role };
  office = { id: a.accoffice.id, name: a.accoffice.name, role: a.accoffice.role };
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
  await db.sql`DELETE FROM source_documents`;
  await db.sql`DELETE FROM invoice_lines`;
  await db.sql`DELETE FROM invoices`;
  await db.sql`DELETE FROM customer_external_identifiers`;
  await db.sql`DELETE FROM customer_assignments`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QAA%'`;
}

beforeEach(async () => {
  if (reason) return;
  await ocisti();
});

type Kupac = { id: string; partnerCode: string; name: string };
let brojac = 0;

async function kupac(partnerCode: string, name: string): Promise<Kupac> {
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QAA${randomUUID().slice(0, 6)}`}, ${name}) RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, ${partnerCode}, ${c.id}, 'mapped')`;
  return { id: c.id, partnerCode, name };
}

async function kupovina(k: Kupac, issuedOn: string, articleCode: string, naziv: string) {
  brojac += 1;
  const broj = `A${brojac}`;
  const [inv] = await db.sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on,
                          customer_id, net_amount, total_amount, origin)
    VALUES (${ISSUER}, 'faktura', ${broj}, ${Number(issuedOn.slice(0, 4))}, ${issuedOn},
            ${k.id}, '100.00', '120.00', 'manual_upload') RETURNING id`;
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
}

async function ritam(k: Kupac, code: string, naziv: string, pocetak: string, korak: number, n: number) {
  const { addDays } = await import("@/lib/recommendations/cadence.mjs");
  for (let i = 0; i < n; i += 1) await kupovina(k, addDays(pocetak, korak * i), code, naziv);
}

/** Dva kupca, po jedan artikal sa ritmom, i jedan preračunat aktivan prolaz. */
async function korpus() {
  const a = await kupac("09001", "Auto Lim Vršac");
  const b = await kupac("09002", "Farbara Beograd");
  await ritam(a, "ACC001", "Bazni lak 1L", "2026-01-05", 30, 5);
  await ritam(b, "ACC002", "Lak za zaštitu", "2026-01-10", 21, 6);
  await db.sql`
    INSERT INTO customer_assignments (user_id, customer_id) VALUES (${repA.id}, ${a.id})`;
  await db.sql`
    INSERT INTO customer_assignments (user_id, customer_id) VALUES (${repB.id}, ${b.id})`;

  const { recomputeRecommendations } = await import("@/lib/recommendations/recompute");
  await recomputeRecommendations({ customerIds: null }, { asOfDate: AS_OF }, owner);
  return { a, b };
}

async function redoviZa(
  u: { id: string; name: string; role: string },
  filter: Record<string, unknown> = {},
) {
  const { resolveLedgerScope } = await import("@/lib/ledger/effective-sales");
  const { recommendationRows } = await import("@/lib/recommendations/query");
  const scope = await resolveLedgerScope(asUser(u));
  return recommendationRows(scope, filter);
}

/* =========================================================================
 * Model dozvola
 * ====================================================================== */

test("gazda vidi ekran i sme recompute; komercijalista vidi ekran ali NE sme recompute", async (t) => {
  if (guard(t)) return;
  const { can } = await import("@/lib/authz/permissions.mjs");

  assert.equal(can(asUser(owner), "view:preporuke"), true);
  assert.equal(can(asUser(owner), "recommendations:recompute"), true);

  assert.equal(can(asUser(repA), "view:preporuke"), true);
  assert.equal(
    can(asUser(repA), "recommendations:recompute"),
    false,
    "komercijalista bi objavio skup koji vide i drugi",
  );

  // Nijedan paket ne sme tiho da doda recompute.
  const { PACKAGE_KEYS } = await import("@/lib/authz/permissions.mjs");
  for (const paket of PACKAGE_KEYS) {
    assert.equal(
      can(asUser(repA, [paket]), "recommendations:recompute"),
      false,
      `paket „${paket}" dodeljuje recompute`,
    );
  }
});

test("magacioner ne vidi preporuke ni uz jedan paket", async (t) => {
  if (guard(t)) return;
  const { can, PACKAGE_KEYS } = await import("@/lib/authz/permissions.mjs");
  const magacioner = { id: "x", name: "M", role: "magacioner" };
  assert.equal(can(asUser(magacioner), "view:preporuke"), false);
  for (const paket of PACKAGE_KEYS) {
    assert.equal(can(asUser(magacioner, [paket]), "view:preporuke"), false, paket);
  }
});

test("ruta /portal/preporuke traži view:preporuke, ne view:prodaja", async (t) => {
  if (guard(t)) return;
  const { capabilityForPath, ROUTE_CAPABILITY } = await import(
    "@/lib/authz/permissions.mjs"
  );
  assert.equal(ROUTE_CAPABILITY["/portal/preporuke"], "view:preporuke");
  assert.equal(capabilityForPath("/portal/preporuke"), "view:preporuke");
  // I podruta nasleđuje isto ovlašćenje, ne slabije.
  assert.equal(capabilityForPath("/portal/preporuke/nesto"), "view:preporuke");
});

test("stavka navigacije se prikazuje samo onome ko sme na rutu", async (t) => {
  if (guard(t)) return;
  const { navGroupsFor } = await import("@/lib/authz/permissions.mjs");
  const ima = (u: { id: string; name: string; role: string }) =>
    navGroupsFor(asUser(u))
      .flatMap((g) => g.items)
      .some((i) => i.href === "/portal/preporuke");

  assert.equal(ima(owner), true);
  assert.equal(ima(repA), true);
  assert.equal(ima({ id: "x", name: "M", role: "magacioner" }), false);
});

/* =========================================================================
 * Opseg u čitanju
 * ====================================================================== */

test("gazda vidi sve preporuke; svaki komercijalista samo svoje", async (t) => {
  if (guard(t)) return;
  const { a, b } = await korpus();

  const sve = await redoviZa(owner);
  assert.equal(sve.length, 2);

  const zaA = await redoviZa(repA);
  assert.deepEqual(zaA.map((r) => r.customerId), [a.id]);
  assert.equal(zaA[0].customerName, "Auto Lim Vršac");

  const zaB = await redoviZa(repB);
  assert.deepEqual(zaB.map((r) => r.customerId), [b.id]);
});

test("prazan assignment daje NULA redova, ne ceo skup", async (t) => {
  if (guard(t)) return;
  await korpus();
  await db.sql`DELETE FROM customer_assignments WHERE user_id = ${repA.id}`;
  assert.deepEqual(await redoviZa(repA), []);
});

test("filter po komercijalisti SUŽAVA opseg, nikad ga ne širi", async (t) => {
  if (guard(t)) return;
  const { a, b } = await korpus();

  // Gazda sme da gleda tuđi portfolio — to je sužavanje njegovog punog opsega.
  const gazdaVidiB = await redoviZa(owner, { salespersonUserId: repB.id });
  assert.deepEqual(gazdaVidiB.map((r) => r.customerId), [b.id]);

  // Komercijalista A traži portfolio komercijaliste B: presek je prazan.
  const kradja = await redoviZa(repA, { salespersonUserId: repB.id });
  assert.deepEqual(kradja, [], "parametar iz adrese je proširio opseg");

  // Svoj portfolio i dalje vidi.
  const svoj = await redoviZa(repA, { salespersonUserId: repA.id });
  assert.deepEqual(svoj.map((r) => r.customerId), [a.id]);
});

test("kancelarija bez view:preporuke ne dobija ekran, ma šta opseg govorio", async (t) => {
  if (guard(t)) return;
  const { can } = await import("@/lib/authz/permissions.mjs");
  /*
   * Kancelarija VIDI sve kupce (`customers:view_all`), pa bi joj opseg bio pun.
   * Upravo zato je važno da kapija bude sposobnost, a ne opseg: širok opseg bez
   * sposobnosti mora da znači zabranu, ne pun pristup.
   */
  assert.equal(can(asUser(office), "customers:view_all"), true);
  assert.equal(can(asUser(office), "view:preporuke"), false);
  assert.equal(can(asUser(office), "recommendations:recompute"), false);
});

/* =========================================================================
 * Filteri i prazno stanje
 * ====================================================================== */

test("pretraga gleda naziv kupca, šifru i naziv artikla", async (t) => {
  if (guard(t)) return;
  const { a } = await korpus();

  assert.deepEqual((await redoviZa(owner, { q: "Vršac" })).map((r) => r.customerId), [a.id]);
  assert.deepEqual((await redoviZa(owner, { q: "ACC001" })).map((r) => r.customerId), [a.id]);
  assert.deepEqual((await redoviZa(owner, { q: "Bazni" })).map((r) => r.customerId), [a.id]);
  assert.deepEqual(await redoviZa(owner, { q: "ne postoji" }), []);
});

test("džokeri iz pretrage se ne tumače kao SQL obrazac", async (t) => {
  if (guard(t)) return;
  await korpus();
  /*
   * Bez escape-ovanja bi `%` značilo „sve", a `_` „bilo koji znak" — pa bi
   * `ACC00_` vratilo i tuđi artikal. Ovde mora vratiti nula redova, jer takva
   * šifra doslovno ne postoji.
   */
  assert.deepEqual(await redoviZa(owner, { q: "%" }), []);
  assert.deepEqual(await redoviZa(owner, { q: "ACC00_" }), []);
});

test("filteri po statusu i pouzdanosti rade nad celim skupom", async (t) => {
  if (guard(t)) return;
  await korpus();
  const sve = await redoviZa(owner);
  const statusi = [...new Set(sve.map((r) => r.status))];

  for (const s of statusi) {
    const filtrirano = await redoviZa(owner, { status: [s] });
    assert.ok(filtrirano.length > 0);
    assert.ok(filtrirano.every((r) => r.status === s));
  }

  const niska = await redoviZa(owner, { confidence: ["low"] });
  assert.ok(niska.every((r) => r.confidence === "low"));
});

test("dok nema aktivnog prolaza, ekran nema šta da pokaže — i to nije greška", async (t) => {
  if (guard(t)) return;
  const { activeRun } = await import("@/lib/recommendations/recompute");
  assert.equal(await activeRun(), null);
  assert.deepEqual(await redoviZa(owner), []);
});

test("redovi neuspešnog i nezavršenog prolaza se NE prikazuju", async (t) => {
  if (guard(t)) return;
  const { a } = await korpus();
  const pre = await redoviZa(owner);
  assert.equal(pre.length, 2);

  // Prolaz koji nikad nije objavljen, sa svojim redom.
  const [neobjavljen] = await db.sql<{ id: string }[]>`
    INSERT INTO recommendation_runs
      (algorithm_version, as_of_date, status, requested_by, finished_at, failure_code)
    VALUES ('cadence_v1', ${AS_OF}, 'failed', ${owner.id}, now(), 'test')
    RETURNING id`;
  await db.sql`
    INSERT INTO recommendation_results
      (run_id, customer_id, article_code, article_name, first_purchase_on,
       last_purchase_on, event_count, days_since_last_purchase, status, confidence,
       explanation, algorithm_version, as_of_date)
    VALUES (${neobjavljen.id}, ${a.id}, 'DUH001', 'Duh', '2026-01-01', '2026-05-01',
            5, 60, 'due', 'high', 'ne sme se videti', 'cadence_v1', ${AS_OF})`;

  const posle = await redoviZa(owner);
  assert.deepEqual(posle, pre, "red neuspešnog prolaza je procurio na ekran");
  assert.ok(!posle.some((r) => r.articleCode === "DUH001"));
});

/* =========================================================================
 * Šta prikaz ne sme da tvrdi
 * ====================================================================== */

test("nijedan prikazan red ne nosi količinu, cenu ni poziv na porudžbinu", async (t) => {
  if (guard(t)) return;
  await korpus();
  const redovi = await redoviZa(owner);
  assert.ok(redovi.length > 0);

  for (const r of redovi) {
    const polja = Object.keys(r).join(" ").toLowerCase();
    for (const zabranjeno of ["quantity", "kolicin", "price", "cena", "unit", "margin"]) {
      assert.ok(!polja.includes(zabranjeno), `red nosi polje „${zabranjeno}"`);
    }
    const tekst = r.explanation.toLowerCase();
    for (const zabranjeno of ["komad", "poruč", "naruč", "din", "cena", "količin"]) {
      assert.ok(!tekst.includes(zabranjeno), `objašnjenje tvrdi „${zabranjeno}"`);
    }
  }
});

test("kupčev nalog nije interni subjekt i ne prolazi internu kapiju", async (t) => {
  if (guard(t)) return;
  const { isInternalSubject } = await import("@/lib/authz/customer-scope.mjs");
  /*
   * Ekran preporuka stoji iza `requireCapability`, koja ide kroz
   * `loadAuthenticatedSession` → `isInternalSubject`. Kupčev token tu pada pre
   * ijedne provere dozvole, pa `view:preporuke` nikada ne dobija priliku da
   * bude tačno.
   */
  assert.equal(isInternalSubject({ subject: "customer" }), false);
  assert.equal(isInternalSubject({ subject: "internal" }), true);
});
