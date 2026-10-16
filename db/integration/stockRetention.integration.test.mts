import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Pravilo čuvanja lagera (0051, odluka vlasnika 15. 10. 2026):
 *  - detaljne stavke samo za poslednja DVA potvrđena snimka (ne kalendarski dani);
 *  - nov upload, neuspela provera i nepotvrđen fajl ne brišu nijedan od ta dva;
 *  - potvrda i čišćenje u jednoj transakciji, paralelne potvrde jedna za drugom;
 *  - nepotvrđena i odbačena otpremanja gube stavke posle 7 dana; zapis i audit ostaju.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const CSV = readFileSync(new URL("../../fixtures/dev/biznisoft/lager/stanje-zaliha-sinteticki.csv", import.meta.url));
const csvWithDate = (d: string) => {
  const text = new TextDecoder("windows-1250").decode(CSV);
  const out = text.replace(/(Na dan:;+)05\.09\.2026/, `$1${d}`);
  assert.notEqual(out, text);
  return new TextEncoder().encode(out);
};

let db: TestDatabase;
type Acc = { id: string; name: string; role: string };
let office: Acc;
const asUser = (a: Acc) => ({ id: a.id, email: `${a.id}@qa-lager.invalid`, name: a.name, initials: "QA", role: a.role as "kancelarija", active: true, sessionVersion: 0, permissions: [] as string[] });

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  office = (await seedAccounts(db, [{ key: "office", role: "kancelarija" }])).office;
});

after(async () => {
  if (!reason && db) {
    await db.sql`ALTER TABLE stock_import_lines DISABLE TRIGGER USER`;
    await db.sql`ALTER TABLE stock_imports DISABLE TRIGGER USER`;
    // article_sellout.ended_import_id → stock_imports (0055): prazni se zajedno (samo test baza).
    await db.sql`TRUNCATE stock_import_lines, stock_imports, article_sellout`;
    await db.sql`ALTER TABLE stock_import_lines ENABLE TRIGGER USER`;
    await db.sql`ALTER TABLE stock_imports ENABLE TRIGGER USER`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const svc = () => import("@/lib/stock/stock-import-service");
const ids: Record<string, string> = {};
async function upload(day: string) {
  const r = await (await svc()).uploadStockReport(asUser(office), { fileName: `lager-${day}.csv`, bytes: csvWithDate(`${day}.09.2026`) });
  assert.equal(r.status, "pregled");
  ids[day] = r.importId;
  return r.importId;
}
const confirm = async (day: string) => (await svc()).confirmStockImport(asUser(office), { importId: ids[day] });
async function state() {
  const rows = await db.sql<{ id: string; status: string; purged: string | null; reason: string | null; lines: number; line_count: number; sha: string; decided_by: string | null }[]>`
    SELECT i.id, i.status::text AS status, i.lines_purged_at::text AS purged, i.lines_purged_reason AS reason,
           (SELECT count(*)::int FROM stock_import_lines l WHERE l.import_id = i.id) AS lines, i.line_count, i.file_sha256 AS sha, i.decided_by
      FROM stock_imports i`;
  const byDay: Record<string, (typeof rows)[number]> = {};
  for (const [d, id] of Object.entries(ids)) byDay[d] = rows.find((r) => r.id === id)!;
  return byDay;
}

test("posle svake potvrde ostaju stavke samo dva poslednja potvrđena snimka; zapis ostaje", async (t) => {
  if (guard(t)) return;
  await upload("06");
  await confirm("06");
  await upload("07");
  await confirm("07");
  let s = await state();
  assert.deepEqual([s["06"].lines, s["07"].lines], [10, 10], "dva potvrđena — oba čuvaju stavke");
  await upload("08");
  s = await state();
  assert.deepEqual([s["06"].lines, s["07"].lines, s["08"].lines], [10, 10, 10], "nepotvrđen upload ne briše ništa");
  const r = await confirm("08");
  assert.deepEqual(r.retention, { purgedImports: 1, purgedLines: 10 });
  s = await state();
  assert.deepEqual([s["06"].lines, s["07"].lines, s["08"].lines], [0, 10, 10]);
  assert.equal(s["06"].reason, "starija_od_dva_potvrdjena");
  assert.ok(s["06"].purged);
  // Mala evidencija ostaje: status, broj stavki, otisak, ko je potvrdio.
  assert.deepEqual([s["06"].status, s["06"].line_count, s["06"].sha.length, s["06"].decided_by], ["potvrdjeno", 10, 64, office.id]);
  const v = await (await svc()).loadStockImport(ids["06"]);
  assert.equal(v?.lines.length, 0);
  assert.ok(v?.header.linesPurgedAt);
});

test("neuspela provera, nov upload i odbacivanje ne diraju dva poslednja potvrđena snimka", async (t) => {
  if (guard(t)) return;
  const bad = await (await svc()).uploadStockReport(asUser(office), { fileName: "pogresan.csv", bytes: new TextEncoder().encode("nije lager;1;2\n") });
  assert.equal(bad.status, "neuspesno");
  await upload("09");
  await (await svc()).discardStockImport(asUser(office), { importId: ids["09"], note: "proba odbacivanja" });
  const s = await state();
  assert.deepEqual([s["07"].lines, s["08"].lines], [10, 10]);
  assert.equal(s["09"].lines, 10, "odbačeno čuva stavke do 7 dana");
});

test("nepotvrđeno i odbačeno starije od 7 dana gube stavke; takvo otpremanje se više ne može potvrditi", async (t) => {
  if (guard(t)) return;
  await upload("10");
  // Simulacija protoka vremena (vlasnik test baze; aplikacija ne može da menja datum otpremanja).
  await db.sql`ALTER TABLE stock_imports DISABLE TRIGGER stock_imports_guard_trg`;
  await db.sql`UPDATE stock_imports SET uploaded_at = now() - interval '8 days' WHERE id IN (${ids["09"]}, ${ids["10"]})`;
  await db.sql`ALTER TABLE stock_imports ENABLE TRIGGER stock_imports_guard_trg`;
  await upload("11"); // svaki upload pokreće postupak čuvanja
  const s = await state();
  assert.deepEqual([s["09"].lines, s["09"].reason, s["10"].lines, s["10"].reason], [0, "nepotvrdjeno_7_dana", 0, "nepotvrdjeno_7_dana"]);
  assert.deepEqual([s["07"].lines, s["08"].lines, s["11"].lines], [10, 10, 10]);
  await assert.rejects(confirm("10"), (e: { code?: string }) => e.code === "uklonjeno");
});

test("paralelne potvrde se izvršavaju jedna za drugom (zajedničko zaključavanje)", async (t) => {
  if (guard(t)) return;
  let done = false;
  let pending: Promise<Awaited<ReturnType<typeof confirm>>> | null = null;
  await db.sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('stock_imports_retention'))`;
    pending = confirm("11").then((r) => {
      done = true;
      return r;
    });
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(done, false, "potvrda čeka dok druga transakcija drži zaključavanje");
  }); // kraj transakcije oslobađa zaključavanje
  const r = await pending!;
  assert.equal(done, true);
  assert.deepEqual(r.retention, { purgedImports: 1, purgedLines: 10 });
  const s = await state();
  assert.deepEqual([s["07"].lines, s["08"].lines, s["11"].lines], [0, 10, 10], "ostaju 08 i 11");
});

test("aplikacija ne može ručno da upiše oznaku čišćenja niti da obriše stavke mimo postupka", async (t) => {
  if (guard(t)) return;
  // Oznaku i brisanje dozvoljava samo vlasnik tabele kroz postupak; trigger ih odbija i za UPDATE bez postupka.
  const [owner] = await db.sql<{ owner: string; me: string }[]>`SELECT pg_get_userbyid(relowner) AS owner, current_user AS me FROM pg_class WHERE relname = 'stock_imports'`;
  if (owner.owner !== owner.me) {
    await assert.rejects(db.sql`UPDATE stock_imports SET lines_purged_at = now(), lines_purged_reason = 'nepotvrdjeno_7_dana' WHERE id = ${ids["11"]}`);
    await assert.rejects(db.sql`DELETE FROM stock_import_lines WHERE import_id = ${ids["11"]}`);
  }
  // Ni vlasnik ne može da promeni odluku istovremeno sa oznakom.
  await assert.rejects(db.sql`UPDATE stock_imports SET lines_purged_at = now(), lines_purged_reason = 'nepotvrdjeno_7_dana', status = 'odbaceno' WHERE id = ${ids["11"]}`);
});
