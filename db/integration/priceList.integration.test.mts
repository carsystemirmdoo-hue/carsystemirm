import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Cenovnik (0038): otpremanje → pregled → odluka gazde → osnovne cene.
 *
 *  - samo gazda (`pricelist:manage`), provera u servisu, ne samo u UI;
 *  - isti fajl ne pravi duplikat; podaci otpremanja se ne menjaju;
 *  - primena traži datum važenja >= datum stanja i prošle kontrole čitanja;
 *  - nejasne stavke samo uz izričitu potvrdu; ista cena se ne upisuje ponovo;
 *  - istorija cena se samo dodaje; fakture i rabati se ne diraju;
 *  - pojedinačna izmena traži obrazloženje i ostavlja trag.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
let db: TestDatabase;
let owner: { id: string; name: string; role: string };
let office: { id: string; name: string; role: string };
const run = randomUUID().slice(0, 6);
const code = (n: number) => `9${run}${n}`;

const asUser = (a: { id: string; name: string; role: string }) => ({
  id: a.id,
  email: `${a.id}@qa-cenovnik.invalid`,
  name: a.name,
  initials: "QA",
  role: a.role as "gazda" | "kancelarija",
  active: true,
  sessionVersion: 0,
  permissions: [] as string[],
});

function report(rows: { code: string; name: string; vp: number }[], opts: { reportDate?: string; checksOk?: boolean } = {}) {
  return {
    sha256: randomBytes(32).toString("hex"),
    bytes: 1234,
    meta: { title: "STANJE ZALIHA - NABAVNA I VP CENA", company: "QA", reportDate: opts.reportDate ?? "2026-10-09", printDate: "2026-10-09", businessUnit: "021 VELEPRODAJA", pages: 1, parser: "biznisoft-stanje-zaliha-vp/1" },
    rows: rows.map((r) => ({ code: r.code, name: r.name, vatPercent: 20, vpPriceCents: r.vp, page: 1 })),
    problems: [],
    checks: { rows: rows.length, totalVpMatches: opts.checksOk !== false, rowChecksFailed: 0 },
  };
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "office", role: "kancelarija" }]);
  owner = accounts.owner;
  office = accounts.office;
  await db.sql`INSERT INTO articles (code, name, unit) VALUES
    (${code(1)}, 'PROBNI PRAJMER 1L', 'kom'),
    (${code(2)}, 'PROBNA TRAKA 48MM X 50M', 'kom'),
    (${code(3)}, 'SASVIM DRUGI NAZIV ARTIKLA', 'kom')`;
});

after(async () => {
  if (!reason && db) {
    await db.sql`TRUNCATE article_base_prices, price_list_import_rows, price_list_imports`;
    await db.sql`DELETE FROM articles WHERE code LIKE ${`9${run}%`}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("samo gazda: kancelarija ne može ni da otpremi, ni da primeni, ni da menja cenu", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/pricing/price-list-service");
  const rep = report([{ code: code(1), name: "PROBNI PRAJMER 1L", vp: 100000 }]);
  await assert.rejects(svc.recordPriceListReport(asUser(office), { fileName: "c.pdf", report: rep }), (e: { code?: string }) => e.code === "forbidden");
  await assert.rejects(svc.setBasePrice(asUser(office), { articleCode: code(1), price: "10", validFrom: "2026-10-10", reason: "proba prava" }), (e: { code?: string }) => e.code === "forbidden");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM price_list_imports`;
  assert.equal(n, 0);
});

test("otpremanje → pregled → primena; isti fajl bez duplikata; nejasno samo uz potvrdu", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/pricing/price-list-service");
  const gazda = asUser(owner);
  const [{ inv0, rules0 }] = await db.sql<{ inv0: number; rules0: number }[]>`
    SELECT (SELECT count(*)::int FROM invoice_lines) AS inv0, (SELECT count(*)::int FROM price_rules) AS rules0`;

  const rep = report([
    { code: code(1), name: "PROBNI PRAJMER 1L", vp: 520000 },
    { code: code(2), name: "PROBNA TRAKA 48MM X 50M", vp: 43300 },
    { code: code(3), name: "PROBNI DISK P120", vp: 4100 },
    { code: "777777", name: "NEPOZNAT ARTIKAL", vp: 100 },
  ]);
  const up = await svc.recordPriceListReport(gazda, { fileName: "cenovnik 9.10.26.pdf", report: rep });
  assert.equal(up.duplicate, false);
  const again = await svc.recordPriceListReport(gazda, { fileName: "isti fajl.pdf", report: rep });
  assert.deepEqual([again.duplicate, again.importId], [true, up.importId]);

  const review = (await svc.loadPriceListReview(gazda, up.importId, "2026-10-10"))!;
  assert.equal(review.canApply, true);
  assert.deepEqual(review.rows.map((r) => [r.code, r.status]), [[code(1), "povezano"], [code(2), "povezano"], [code(3), "nejasno"], ["777777", "nepovezano"]]);

  // Datum važenja pre datuma stanja se odbija.
  await assert.rejects(svc.applyPriceList(gazda, { importId: up.importId, validFrom: "2026-10-01", confirmedUnclearCodes: [] }), (e: { code?: string }) => e.code === "datum");
  const applied = await svc.applyPriceList(gazda, { importId: up.importId, validFrom: "2026-10-12", confirmedUnclearCodes: [], note: "proba" });
  assert.equal(applied.applied, 2, "nejasna (ime drugačije) i nepovezana se ne primenjuju bez potvrde");
  await assert.rejects(svc.applyPriceList(gazda, { importId: up.importId, validFrom: "2026-10-12", confirmedUnclearCodes: [] }), (e: { code?: string }) => e.code === "odluceno");

  const before = await svc.effectiveBasePriceCents("2026-10-11");
  const after = await svc.effectiveBasePriceCents("2026-10-12");
  const [a1] = await db.sql<{ id: string }[]>`SELECT id FROM articles WHERE code = ${code(1)}`;
  assert.equal(before.get(a1.id), undefined, "pre datuma važenja nema cene");
  assert.equal(after.get(a1.id), 520000);

  // Drugi cenovnik: ista cena se ne upisuje ponovo; nova cena da; potvrđena nejasna stavka da.
  const rep2 = report([
    { code: code(1), name: "PROBNI PRAJMER 1L", vp: 520000 },
    { code: code(2), name: "PROBNA TRAKA 48MM X 50M", vp: 45000 },
    { code: code(3), name: "PROBNI DISK P120", vp: 4100 },
  ], { reportDate: "2026-11-01" });
  const up2 = await svc.recordPriceListReport(gazda, { fileName: "cenovnik 1.11.pdf", report: rep2 });
  const applied2 = await svc.applyPriceList(gazda, { importId: up2.importId, validFrom: "2026-11-03", confirmedUnclearCodes: [code(3)] });
  assert.equal(applied2.applied, 2);
  const [a2] = await db.sql<{ id: string }[]>`SELECT id FROM articles WHERE code = ${code(2)}`;
  assert.equal((await svc.effectiveBasePriceCents("2026-11-02")).get(a2.id), 43300, "stara verzija važi do novog datuma");
  assert.equal((await svc.effectiveBasePriceCents("2026-11-03")).get(a2.id), 45000);

  // Fakture i rabati netaknuti.
  const [{ inv1, rules1 }] = await db.sql<{ inv1: number; rules1: number }[]>`
    SELECT (SELECT count(*)::int FROM invoice_lines) AS inv1, (SELECT count(*)::int FROM price_rules) AS rules1`;
  assert.deepEqual([inv1, rules1], [inv0, rules0]);
  const [{ audits }] = await db.sql<{ audits: number }[]>`
    SELECT count(*)::int AS audits FROM audit_log WHERE entity_id IN (${up.importId}, ${up2.importId})`;
  assert.ok(audits >= 4, "otpremanje i primena oba cenovnika imaju trag");
});

test("kontrole čitanja koje nisu prošle blokiraju primenu; odbacivanje traži razlog", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/pricing/price-list-service");
  const gazda = asUser(owner);
  const up = await svc.recordPriceListReport(gazda, { fileName: "los.pdf", report: report([{ code: code(1), name: "PROBNI PRAJMER 1L", vp: 1 }], { checksOk: false }) });
  assert.equal((await svc.loadPriceListReview(gazda, up.importId))!.canApply, false);
  await assert.rejects(svc.applyPriceList(gazda, { importId: up.importId, validFrom: "2026-12-01", confirmedUnclearCodes: [] }), (e: { code?: string }) => e.code === "kontrole");
  await assert.rejects(svc.discardPriceList(gazda, { importId: up.importId, note: "x" }), (e: { code?: string }) => e.code === "razlog");
  await svc.discardPriceList(gazda, { importId: up.importId, note: "kontrole nisu prošle" });
  await assert.rejects(svc.discardPriceList(gazda, { importId: up.importId, note: "ponovo odbaci" }), (e: { code?: string }) => e.code === "odluceno");
});

test("pojedinačna izmena: obrazloženje obavezno, datum važenja, istorija i trag", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/pricing/price-list-service");
  const gazda = asUser(owner);
  await assert.rejects(svc.setBasePrice(gazda, { articleCode: code(1), price: "5300", validFrom: "2026-12-01", reason: "ok" }), (e: { code?: string }) => e.code === "razlog");
  await assert.rejects(svc.setBasePrice(gazda, { articleCode: code(1), price: "-1", validFrom: "2026-12-01", reason: "negativna cena" }), (e: { code?: string }) => e.code === "cena");
  await assert.rejects(svc.setBasePrice(gazda, { articleCode: "000000", price: "10", validFrom: "2026-12-01", reason: "nepostojeći" }), (e: { code?: string }) => e.code === "artikal");
  const r = await svc.setBasePrice(gazda, { articleCode: code(1), price: "5.300,50", validFrom: "2026-12-01", reason: "dogovor sa dobavljačem" });
  assert.equal(r.netPrice, "5300.50");
  const [a1] = await db.sql<{ id: string }[]>`SELECT id FROM articles WHERE code = ${code(1)}`;
  assert.equal((await svc.effectiveBasePriceCents("2026-11-30")).get(a1.id), 520000);
  assert.equal((await svc.effectiveBasePriceCents("2026-12-01")).get(a1.id), 530050);
  const history = await svc.basePriceHistory(gazda, code(1));
  assert.deepEqual(history.map((h) => [h.valid_from, h.source]), [["2026-12-01", "rucno"], ["2026-10-12", "cenovnik"]]);
  const [audit] = await db.sql<{ value_before: unknown; reason: string }[]>`
    SELECT value_before, reason FROM audit_log WHERE action = 'Ručna izmena osnovne cene' AND entity_id = ${a1.id} ORDER BY id DESC LIMIT 1`;
  assert.equal(audit.reason, "dogovor sa dobavljačem");
  assert.ok(audit.value_before, "trag čuva prethodnu cenu");
});

test("baza: istorija cena i stavke se samo dodaju; podaci otpremanja se ne menjaju", async (t) => {
  if (guard(t)) return;
  await assert.rejects(db.sql`UPDATE article_base_prices SET net_price = 1`, /samo dodaje/);
  await assert.rejects(db.sql`DELETE FROM article_base_prices`, /samo dodaje/);
  await assert.rejects(db.sql`UPDATE price_list_import_rows SET vp_price = 1`, /samo dodaje/);
  await assert.rejects(db.sql`UPDATE price_list_imports SET file_name = 'drugo.pdf'`, /konačna|ne menjaju/);
  await assert.rejects(db.sql`DELETE FROM price_list_imports`, /ne briše/);
  // Ručna cena bez obrazloženja i cenovnik bez otpremanja se odbijaju u bazi.
  const [a] = await db.sql<{ id: string }[]>`SELECT id FROM articles WHERE code = ${code(1)}`;
  await assert.rejects(db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, created_by)
    VALUES (${a.id}, 10, 20, '2027-01-01', 'rucno', ${owner.id})`, /article_base_prices_source_check/);
  await assert.rejects(db.sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, created_by)
    VALUES (${a.id}, 10, 20, '2027-01-01', 'cenovnik', ${owner.id})`, /article_base_prices_source_check/);
});
