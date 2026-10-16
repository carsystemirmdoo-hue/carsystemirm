import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Ručni uvoz lagera (0050, dok. 65): otpremanje → pregled → potvrda → važeći snimak.
 *
 *  - samo `imports:write` (vlasnik, kancelarija); provera u servisu, ne samo u UI;
 *  - isti fajl ne pravi duplikat; neuspešan fajl se beleži i ne menja važeći snimak;
 *  - stariji datum stanja ne zamenjuje noviji važeći snimak;
 *  - cene se ne čuvaju; JM i pakovanje samo potvrđeni; sudar šifara ne pravi vezu;
 *  - prikaz kupcu je isključen dok se ne uključe obe brave i zada prag.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const XLSX = readFileSync(new URL("../../fixtures/dev/biznisoft/lager/stanje-zaliha-sinteticki.xlsx", import.meta.url));
const CSV = readFileSync(new URL("../../fixtures/dev/biznisoft/lager/stanje-zaliha-sinteticki.csv", import.meta.url));
/** Isti CSV sa drugim datumom stanja (samo red „Na dan:"). */
const csvWithDate = (d: string) => {
  const text = new TextDecoder("windows-1250").decode(CSV);
  const out = text.replace(/(Na dan:;+)05\.09\.2026/, `$1${d}`);
  assert.notEqual(out, text);
  return new TextEncoder().encode(out);
};

let db: TestDatabase;
type Acc = { id: string; name: string; role: string };
let owner: Acc;
let office: Acc;
let rep: Acc;
const asUser = (a: Acc) => ({ id: a.id, email: `${a.id}@qa-lager.invalid`, name: a.name, initials: "QA", role: a.role as "gazda" | "kancelarija" | "komercijalista", active: true, sessionVersion: 0, permissions: [] as string[] });
const ids: Record<string, string> = {};

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "office", role: "kancelarija" }, { key: "rep", role: "komercijalista" }]);
  owner = accounts.owner;
  office = accounts.office;
  rep = accounts.rep;
  // Portal: 900001 sa potvrđenim pakovanjem 5 LIT; 000012 (izvoz ima „12") bez pakovanja;
  // 900006 i 0900006 daju isti ključ → sudar; 777777 nije u izvozu (nepoznato, ne nula).
  const rows = await db.sql<{ id: string; code: string }[]>`INSERT INTO articles (code, name, unit) VALUES
    ('900001', 'SINT BAZA SREBRNA 1L', 'LIT'), ('000012', 'SINT STARA', 'KOM'),
    ('900006', 'SINT TRAKA A', 'KOM'), ('0900006', 'SINT TRAKA B', 'KOM'), ('777777', 'SINT VAN IZVOZA', 'KOM')
    RETURNING id, code`;
  for (const r of rows) ids[r.code] = r.id;
  await db.sql`INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by)
    VALUES (${ids["900001"]}, 5, 'LIT', '5 L', 'sintetička potvrda', ${owner.id})`;
});

/** Prazne tabele lagera (samo test baza; okidači čuvaju istoriju u radu aplikacije). */
async function resetStock() {
  await db.sql`ALTER TABLE stock_import_lines DISABLE TRIGGER USER`;
  await db.sql`ALTER TABLE stock_imports DISABLE TRIGGER USER`;
  // article_sellout.ended_import_id → stock_imports (0055): prazni se zajedno (samo test baza).
  await db.sql`TRUNCATE stock_import_lines, stock_imports, article_sellout`;
  await db.sql`ALTER TABLE stock_import_lines ENABLE TRIGGER USER`;
  await db.sql`ALTER TABLE stock_imports ENABLE TRIGGER USER`;
}

after(async () => {
  if (!reason && db) {
    await resetStock();
    await db.sql`DELETE FROM system_settings WHERE key = 'stock.customerDisplay'`;
    await db.sql`DELETE FROM article_pack_sizes WHERE article_id = ANY(${Object.values(ids)}::uuid[])`;
    await db.sql`DELETE FROM articles WHERE id = ANY(${Object.values(ids)}::uuid[])`;
    await cleanupQa(db);
  }
  delete process.env.STOCK_CUSTOMER_DISPLAY;
  await closeTestDatabase();
});

test("prava: komercijalista ne otprema ni ne potvrđuje; ništa se ne upisuje", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/stock/stock-import-service");
  await assert.rejects(svc.uploadStockReport(asUser(rep), { fileName: "l.xlsx", bytes: XLSX }), (e: { code?: string }) => e.code === "forbidden");
  await assert.rejects(svc.confirmStockImport(asUser(rep), { importId: "00000000-0000-0000-0000-000000000000" }), (e: { code?: string }) => e.code === "forbidden");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM stock_imports`;
  assert.equal(n, 0);
});

let firstId = "";

test("otpremanje → pregled: stavke, veze, sudar, potvrđena JM/pakovanje; bez cena; bez duplikata", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/stock/stock-import-service");
  const up = await svc.uploadStockReport(asUser(office), { fileName: "lager 05.09.xlsx", bytes: XLSX });
  assert.deepEqual([up.duplicate, up.status], [false, "pregled"]);
  firstId = up.importId;

  const again = await svc.uploadStockReport(asUser(owner), { fileName: "isti.xlsx", bytes: XLSX });
  assert.deepEqual([again.importId, again.duplicate], [firstId, true]);
  const [{ n, l }] = await db.sql<{ n: number; l: number }[]>`SELECT (SELECT count(*)::int FROM stock_imports) AS n, (SELECT count(*)::int FROM stock_import_lines) AS l`;
  assert.deepEqual([n, l], [1, 10]);

  const v = await svc.loadStockImport(firstId);
  assert.ok(v);
  assert.deepEqual([v.header.warehouseCode, v.header.warehouseName, v.header.stockDate, v.header.printedOn, v.header.fileFormat], ["021", "VELEPRODAJA", "2026-09-05", "2026-09-05", "xlsx"]);
  const by = new Map(v.lines.map((l) => [l.sourceCode, l]));
  assert.deepEqual([by.get("900001")?.link, by.get("900001")?.unit, by.get("900001")?.packs], ["povezan", "LIT", 2], "12 L u kantama od 5 L = 2 cela pakovanja");
  assert.deepEqual([by.get("12")?.link, by.get("12")?.articleCode, by.get("12")?.exactCode, by.get("12")?.packs, by.get("12")?.packReason], ["povezan", "000012", false, null, "pakovanje_nepotvrdjeno"]);
  assert.equal(by.get("900006")?.link, "sudar");
  assert.equal(by.get("900002")?.link, "nepovezan");

  // Cene i vrednosti iz izveštaja nigde u bazi.
  const dump = JSON.stringify(await db.sql`SELECT to_jsonb(s) AS s FROM stock_imports s UNION ALL SELECT to_jsonb(l) FROM stock_import_lines l`);
  for (const price of ["26000", "20000", "5200"]) assert.ok(!dump.includes(price), price);
  const [audit] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_log WHERE entity_type = 'Lager' AND entity_id = ${firstId}`;
  assert.equal(audit.n, 1);
});

test("stavke se ne menjaju; podaci otpremanja se ne menjaju", async (t) => {
  if (guard(t)) return;
  await assert.rejects(db.sql`UPDATE stock_import_lines SET quantity = 1 WHERE import_id = ${firstId}`);
  await assert.rejects(db.sql`UPDATE stock_imports SET stock_date = '2026-01-01' WHERE id = ${firstId}`);
  await assert.rejects(db.sql`DELETE FROM stock_imports WHERE id = ${firstId}`);
});

test("potvrda → važeći snimak; neuspešan fajl ga ne menja; stariji datum ne zamenjuje noviji", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/stock/stock-import-service");
  assert.equal(await svc.currentStockSnapshot(), null);
  await svc.confirmStockImport(asUser(office), { importId: firstId });
  assert.equal((await svc.currentStockSnapshot())?.id, firstId);
  await assert.rejects(svc.confirmStockImport(asUser(owner), { importId: firstId }), (e: { code?: string }) => e.code === "odluceno");

  const bad = await svc.uploadStockReport(asUser(office), { fileName: "pogresan.csv", bytes: new TextEncoder().encode("nije lager;1;2\n") });
  assert.equal(bad.status, "neuspesno");
  await assert.rejects(svc.confirmStockImport(asUser(office), { importId: bad.importId }), (e: { code?: string }) => e.code === "odluceno");
  assert.equal((await svc.currentStockSnapshot())?.id, firstId);

  const older = await svc.uploadStockReport(asUser(office), { fileName: "stari.csv", bytes: csvWithDate("01.09.2026") });
  assert.equal(older.status, "pregled");
  await assert.rejects(svc.confirmStockImport(asUser(office), { importId: older.importId }), (e: { code?: string }) => e.code === "stariji");
  assert.equal((await svc.currentStockSnapshot())?.id, firstId);
  await svc.discardStockImport(asUser(office), { importId: older.importId, note: "stariji izvoz" });

  const newer = await svc.uploadStockReport(asUser(office), { fileName: "novi.csv", bytes: csvWithDate("06.09.2026") });
  await svc.confirmStockImport(asUser(owner), { importId: newer.importId });
  const cur = await svc.currentStockSnapshot();
  assert.deepEqual([cur?.id, cur?.stockDate], [newer.importId, "2026-09-06"]);
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM stock_imports WHERE status = 'potvrdjeno'`;
  assert.equal(n, 2, "prethodni snimak ostaje u istoriji");
});

test("prikaz kupcu: prekidač vlasnika i prag 24 h od vremena stanja; broj samo uz potvrdu, ostalo na upit", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/stock/stock-import-service");
  const all = [ids["900001"], ids["000012"], ids["777777"]];
  // Važeći snimak ima samo datum 06.09.2026 → važi od 05.09. 22:00 UTC (ponoć u Beogradu) 24 h.
  const fresh = new Date("2026-09-06T10:00:00Z");
  delete process.env.STOCK_CUSTOMER_DISPLAY;
  assert.deepEqual(await svc.customerStockFor(all, fresh), { state: "iskljuceno" }, "bez podešavanja vlasnika");
  await db.sql`INSERT INTO system_settings (key, value) VALUES ('stock.customerDisplay', ${db.sql.json({ enabled: true })})`;
  assert.deepEqual(await svc.customerStockFor(all, fresh), { state: "iskljuceno" }, "bez praga");
  await db.sql`UPDATE system_settings SET value = ${db.sql.json({ enabled: true, maxAgeHours: 24 })} WHERE key = 'stock.customerDisplay'`;
  const r = await svc.customerStockFor(all, fresh);
  assert.equal(r.state, "svez");
  if (r.state !== "svez") return;
  assert.equal(r.validUntil.toISOString(), "2026-09-06T22:00:00.000Z");
  assert.deepEqual(r.byArticle.get(ids["900001"]), { state: "ima", text: "Na stanju prema izvozu: 2 × 5 L" }, "12 L / 5 L = 2 cela pakovanja");
  assert.deepEqual(r.byArticle.get(ids["000012"]), { state: "upit", text: "Raspoloživost na upit" }, "bez potvrđenog pakovanja");
  assert.deepEqual(r.byArticle.get(ids["777777"]), { state: "upit", text: "Raspoloživost na upit" }, "izostavljen artikal nije nula");
  assert.deepEqual(await svc.customerStockFor(all, new Date("2026-09-06T22:00:00Z")), { state: "zastareo", stockDate: "2026-09-06" }, "posle 24 h bez brojeva");
  process.env.STOCK_CUSTOMER_DISPLAY = "0";
  assert.deepEqual(await svc.customerStockFor(all, fresh), { state: "iskljuceno" }, "hitno isključenje u okruženju");
  delete process.env.STOCK_CUSTOMER_DISPLAY;
  await db.sql`UPDATE system_settings SET value = ${db.sql.json({ enabled: false, maxAgeHours: 24 })} WHERE key = 'stock.customerDisplay'`;
  assert.deepEqual(await svc.customerStockFor(all, fresh), { state: "iskljuceno" }, "isključeno podešavanjem");
});

const XLSX_B = readFileSync(new URL("../../fixtures/dev/biznisoft/lager/stanje-zaliha-artikla-sinteticki.xlsx", import.meta.url));

test("raspored B (JM u izveštaju): JM različita od potvrđenog pakovanja → nema broja pakovanja, upozorenje", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/stock/stock-import-service");
  // Isti sadržaj kao ranije potvrđeni raspored A bi dao postojeći snimak (0053) — ovde se proverava JM rasporeda B.
  await resetStock();
  // Izveštaj vodi 900008 u LIT, a potvrđeno pakovanje je „1 kom“ u KOM.
  const [a] = await db.sql<{ id: string }[]>`INSERT INTO articles (code, name, unit) VALUES ('900008', 'SINT ČISTAČ', 'LIT') RETURNING id`;
  ids["900008"] = a.id;
  await db.sql`INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by) VALUES (${a.id}, 1, 'KOM', '1 kom', 'sintetička potvrda', ${owner.id})`;
  const up = await svc.uploadStockReport(asUser(office), { fileName: "artikla.xlsx", bytes: XLSX_B });
  assert.equal(up.status, "pregled");
  const v = await svc.loadStockImport(up.importId);
  assert.ok(v);
  const by = new Map(v.lines.map((l) => [l.sourceCode, l]));
  assert.deepEqual([by.get("900008")?.packs, by.get("900008")?.packReason], [null, "jm_razlika"]);
  assert.deepEqual([by.get("900001")?.packs, by.get("900001")?.packReason], [2, null], "LIT = LIT: 12 L / 5 L = 2");
  const warnings = (v.header.problems as { warnings: { code: string; count?: number }[] }).warnings;
  assert.deepEqual(warnings.find((w) => w.code === "jm_razlikuje_od_potvrde"), { code: "jm_razlikuje_od_potvrde", count: 1 });
  assert.equal(v.header.parserVersion, "biznisoft-stanje-zaliha/2");
});

test("isti fajl koji je ranije odbila starija verzija čitača: nova provera, stari pokušaj ostaje, bez duplikata", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/stock/stock-import-service");
  const bytes = csvWithDate("07.09.2026");
  const { createHash } = await import("node:crypto");
  const sha = createHash("sha256").update(bytes).digest("hex");
  const [old] = await db.sql<{ id: string }[]>`INSERT INTO stock_imports (file_sha256, file_name, file_bytes, file_format, parser_version, line_count, status, uploaded_by, decided_at)
    VALUES (${sha}, 'stari-pokusaj.csv', ${bytes.length}, 'csv', 'biznisoft-stanje-zaliha/1', 0, 'neuspesno', ${office.id}, now()) RETURNING id`;
  const up = await svc.uploadStockReport(asUser(office), { fileName: "isti.csv", bytes });
  assert.deepEqual([up.duplicate, up.status, up.recheckOf], [false, "pregled", old.id]);
  const again = await svc.uploadStockReport(asUser(office), { fileName: "isti-opet.csv", bytes });
  assert.deepEqual([again.duplicate, again.importId], [true, up.importId], "ponovljen upload = ista nova provera");
  const rows = await db.sql<{ status: string; parser_version: string }[]>`SELECT status::text AS status, parser_version FROM stock_imports WHERE file_sha256 = ${sha} ORDER BY uploaded_at`;
  assert.deepEqual(rows.map((r) => [r.status, r.parser_version]), [["neuspesno", "biznisoft-stanje-zaliha/1"], ["pregled", "biznisoft-stanje-zaliha/2"]], "istorija pokušaja");
  // Baza: isti fajl ne može imati dva zapisa koji nisu „neuspešno“ (nema duplih snimaka).
  await assert.rejects(
    db.sql`INSERT INTO stock_imports (file_sha256, file_name, file_bytes, file_format, parser_version, line_count, status, uploaded_by)
      VALUES (${sha}, 'dupli.csv', ${bytes.length}, 'csv', 'biznisoft-stanje-zaliha/3', 0, 'pregled', ${office.id})`,
    (e: { code?: string }) => e.code === "23505",
  );
  await svc.discardStockImport(asUser(office), { importId: up.importId, note: "proba ponovne provere" });
});

test("PDF i XLSX istog stanja: isti sadržaj se ne upisuje dvaput; posle odbacivanja može drugi format", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/stock/stock-import-service");
  const PDF = readFileSync(new URL("../../fixtures/dev/biznisoft/lager/zbirni-pregled-sinteticki.pdf", import.meta.url));
  // Čista polazna tačka za ovaj datum stanja (05.09.2026): ranije potvrđeni snimci istog sadržaja ostaju.
  const live = await db.sql<{ id: string; status: string }[]>`SELECT id, status::text AS status FROM stock_imports WHERE stock_date = '2026-09-05' AND status IN ('pregled', 'potvrdjeno')`;
  const pdf = await svc.uploadStockReport(asUser(office), { fileName: "zbirni.pdf", bytes: PDF });
  if (live.length) {
    assert.deepEqual([pdf.duplicate, pdf.sameContent, pdf.importId], [true, true, live[0].id], "isti sadržaj kao postojeći snimak");
    return;
  }
  assert.deepEqual([pdf.duplicate, pdf.status], [false, "pregled"]);
  const xlsx = await svc.uploadStockReport(asUser(office), { fileName: "isti-dan.xlsx", bytes: XLSX });
  assert.deepEqual([xlsx.duplicate, xlsx.sameContent, xlsx.importId], [true, true, pdf.importId], "XLSX istog stanja → postojeći PDF zapis");
  const [{ fmt }] = await db.sql<{ fmt: string }[]>`SELECT file_format AS fmt FROM stock_imports WHERE id = ${pdf.importId}`;
  assert.equal(fmt, "pdf");
  await svc.discardStockImport(asUser(office), { importId: pdf.importId, note: "proba drugog formata" });
  const again = await svc.uploadStockReport(asUser(office), { fileName: "isti-dan.xlsx", bytes: XLSX });
  assert.deepEqual([again.duplicate, again.status], [false, "pregled"], "posle odbacivanja PDF-a XLSX dobija proveru");
  await svc.discardStockImport(asUser(office), { importId: again.importId, note: "kraj probe formata" });
});

test("prodaja do rasprodaje (0055): potvrđen lager sa stanjem 0 trajno povlači artikal; stanje > 0 ga ostavlja u ponudi", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/stock/stock-import-service");
  await resetStock();
  // 900004 je u sintetičkom izvozu sa stanjem 0, 900001 sa 12.
  const made = await db.sql<{ id: string; code: string }[]>`INSERT INTO articles (code, name, unit) VALUES ('900004', 'SINT KIT 1 KG', 'KOM'), ('900001x', 'SINT NEMA U IZVOZU', 'KOM') RETURNING id, code`;
  const kit = made.find((m) => m.code === "900004")!.id;
  await db.sql`INSERT INTO article_sellout (article_id, evidence, decided_by) VALUES (${kit}, 'sintetička proba rasprodaje', ${owner.id}), (${ids["900001"]}, 'sintetička proba rasprodaje', ${owner.id})`;
  const up = await svc.uploadStockReport(asUser(office), { fileName: "rasprodaja.csv", bytes: csvWithDate("08.09.2026") });
  await svc.confirmStockImport(asUser(office), { importId: up.importId });
  const out = await db.sql<{ article_id: string }[]>`SELECT article_id FROM articles_out_of_programme WHERE article_id IN (${kit}, ${ids["900001"]})`;
  assert.deepEqual(out.map((o) => o.article_id), [kit], "samo artikal sa potvrđenim stanjem 0");
  const [s] = await db.sql<{ ended: boolean; imp: string }[]>`SELECT ended_at IS NOT NULL AS ended, ended_import_id::text AS imp FROM article_sellout WHERE article_id = ${kit}`;
  assert.deepEqual([s.ended, s.imp], [true, up.importId]);
  const [d] = await db.sql<{ reason: string; by: string }[]>`SELECT reason, decided_by::text AS by FROM article_programme_decisions WHERE article_id = ${kit} ORDER BY decided_at DESC LIMIT 1`;
  assert.match(d.reason, /Rasprodato/);
  assert.equal(d.by, office.id, "povlačenje beleži ko je potvrdio lager");
  await assert.rejects(db.sql`DELETE FROM article_sellout WHERE article_id = ${kit}`, (e: { code?: string }) => e.code === "42501");
  await db.sql`ALTER TABLE article_sellout DISABLE TRIGGER USER`;
  await db.sql`DELETE FROM article_sellout WHERE article_id IN (${kit}, ${ids["900001"]})`;
  await db.sql`ALTER TABLE article_sellout ENABLE TRIGGER USER`;
  await db.sql`ALTER TABLE article_programme_decisions DISABLE TRIGGER USER`;
  await db.sql`DELETE FROM article_programme_decisions WHERE article_id = ${kit}`;
  await db.sql`ALTER TABLE article_programme_decisions ENABLE TRIGGER USER`;
  await db.sql`DELETE FROM articles WHERE id IN (${kit}, ${made.find((m) => m.code === "900001x")!.id})`;
});
