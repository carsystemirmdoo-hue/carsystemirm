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

after(async () => {
  if (!reason && db) {
    await db.sql`ALTER TABLE stock_import_lines DISABLE TRIGGER USER`;
    await db.sql`ALTER TABLE stock_imports DISABLE TRIGGER USER`;
    await db.sql`TRUNCATE stock_import_lines, stock_imports`;
    await db.sql`ALTER TABLE stock_import_lines ENABLE TRIGGER USER`;
    await db.sql`ALTER TABLE stock_imports ENABLE TRIGGER USER`;
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

test("prikaz kupcu: isključen bez obe brave i praga; uključen daje cela pakovanja samo uz potvrdu", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/stock/stock-import-service");
  const all = [ids["900001"], ids["000012"], ids["777777"]];
  const now = new Date("2026-09-07T10:00:00Z");
  delete process.env.STOCK_CUSTOMER_DISPLAY;
  assert.equal((await svc.customerStockFor(all, now)).byArticle.size, 0);
  process.env.STOCK_CUSTOMER_DISPLAY = "1";
  assert.equal((await svc.customerStockFor(all, now)).byArticle.size, 0, "bez podešavanja vlasnika");
  await db.sql`INSERT INTO system_settings (key, value) VALUES ('stock.customerDisplay', ${db.sql.json({ enabled: true })})`;
  assert.equal((await svc.customerStockFor(all, now)).byArticle.size, 0, "bez praga zastarelosti");
  await db.sql`UPDATE system_settings SET value = ${db.sql.json({ enabled: true, maxAgeDays: 0 })} WHERE key = 'stock.customerDisplay'`;
  assert.equal((await svc.customerStockFor(all, now)).byArticle.size, 0, "snimak od 06.09. je star za prag 0 dana");
  await db.sql`UPDATE system_settings SET value = ${db.sql.json({ enabled: true, maxAgeDays: 3 })} WHERE key = 'stock.customerDisplay'`;
  const r = await svc.customerStockFor(all, now);
  assert.deepEqual(r.byArticle.get(ids["900001"]), { packs: 2, reason: null, label: "5 L" });
  assert.deepEqual(r.byArticle.get(ids["000012"]), { packs: null, reason: "pakovanje_nepotvrdjeno", label: null });
  assert.deepEqual(r.byArticle.get(ids["777777"]), { packs: null, reason: "nije_u_izvozu", label: null }, "izostavljen artikal nije nula");
  delete process.env.STOCK_CUSTOMER_DISPLAY;
});
