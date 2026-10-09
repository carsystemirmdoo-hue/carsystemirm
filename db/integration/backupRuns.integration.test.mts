import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { closeTestDatabase, initTestDatabase, QA_PREFIX, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Evidencija rezervnih kopija (0036) i uloge iz db/provisioning/backup-roles.sql.
 *
 *  - zapisi se samo dodaju (okidač);
 *  - uloga za status sme SAMO da doda red u backup_runs — ne čita ni tu ni
 *    jednu drugu tabelu;
 *  - čitalac kopije čita sve i ne sme da piše;
 *  - servis portala razdvaja „proverena kopija" od „sačuvana van GitHub-a".
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
let db: TestDatabase;
const sfx = randomBytes(4).toString("hex");
const reader = `${QA_PREFIX}_bkr_${sfx}`;
const status = `${QA_PREFIX}_bks_${sfx}`;
const label = `${QA_PREFIX}-${sfx}`;

async function provisioning(): Promise<string> {
  const source = await readFile(new URL("../provisioning/backup-roles.sql", import.meta.url), "utf8");
  return source
    .split("\n")
    .filter((line) => !line.startsWith("\\set"))
    .join("\n")
    .replaceAll(":'reader_role'", `'${reader}'`)
    .replaceAll(":'status_role'", `'${status}'`)
    .replaceAll(":reader_role", `"${reader}"`)
    .replaceAll(":status_role", `"${status}"`);
}

before(async () => {
  if (reason) return;
  db = await initTestDatabase();
});

after(async () => {
  if (reason) return;
  for (const r of [reader, status]) {
    await db.sql.unsafe(`DROP OWNED BY "${r}"`).catch(() => {});
    await db.sql.unsafe(`DROP ROLE IF EXISTS "${r}"`).catch(() => {});
  }
  await closeTestDatabase();
});

test("uloge kopije: čitalac samo čita, status samo dodaje u backup_runs", async (t) => {
  if (guard(t)) return;
  for (const r of [reader, status]) await db.sql.unsafe(`CREATE ROLE "${r}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  await db.sql.unsafe(await provisioning());
  const [p] = await db.sql<Record<string, boolean>[]>`
    SELECT has_table_privilege(${reader}, 'public.invoices', 'SELECT') AS r_sel,
           has_table_privilege(${reader}, 'public.invoices', 'INSERT') AS r_ins,
           has_table_privilege(${reader}, 'public.backup_runs', 'INSERT') AS r_bk_ins,
           has_table_privilege(${status}, 'public.backup_runs', 'INSERT') AS s_ins,
           has_table_privilege(${status}, 'public.backup_runs', 'SELECT') AS s_sel,
           has_table_privilege(${status}, 'public.invoices', 'SELECT') AS s_inv,
           has_table_privilege(${status}, 'public.users', 'SELECT') AS s_users`;
  assert.deepEqual(p, { r_sel: true, r_ins: false, r_bk_ins: false, s_ins: true, s_sel: false, s_inv: false, s_users: false });
});

test("pod ulogom za status: dodavanje radi, čitanje i izmena su odbijeni", async (t) => {
  if (guard(t)) return;
  await db.sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE "${status}"`);
    await tx`INSERT INTO backup_runs (kind, ok, source_label) VALUES ('db_verified', true, ${label})`;
  });
  // Čitanje (pa ni sopstvenih upisa) nije dozvoljeno; neuspela transakcija se odbacuje cela.
  await assert.rejects(
    db.sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE "${status}"`);
      await tx`SELECT count(*) FROM backup_runs`;
    }),
    (e: { code?: string }) => e.code === "42501",
  );
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM backup_runs WHERE source_label = ${label}`;
  assert.equal(n, 1);
  await assert.rejects(db.sql`UPDATE backup_runs SET ok = false WHERE source_label = ${label}`, /samo dodaju/);
  await assert.rejects(db.sql`DELETE FROM backup_runs WHERE source_label = ${label}`, /samo dodaju/);
  await assert.rejects(db.sql`INSERT INTO backup_runs (kind, ok, dump_sha256) VALUES ('db_verified', true, 'nije-heš')`, /backup_runs_sha_check/);
});

test("servis portala: tri odvojene tvrdnje; neuspeh posle uspeha je upozorenje", async (t) => {
  if (guard(t)) return;
  const { loadBackupStatus } = await import("../../lib/backup/status-service.ts");
  // Ručni upis bez GitHub prolaza (npr. proba sa Mac-a) se ne računa ni kad automatika nije zadata.
  await db.sql`INSERT INTO backup_runs (kind, ok, source_label, tables, rows, migrations) VALUES ('db_verified', true, ${label}, 55, 1000, 37)`;
  const now = new Date();
  const manual = (await loadBackupStatus(now, { BACKUP_SOURCE_LABEL: label }))!;
  // (PDF kopija nema oznaku izvora baze; zapisi se samo dodaju, pa ranija pokretanja ostavljaju PDF redove.)
  assert.ok(manual.filter((i) => i.kind !== "pdf_backup").every((i) => i.state === "nije_podesen" && i.tone !== "success" && i.lastOk === null));
  await db.sql`INSERT INTO backup_runs (kind, ok, source_label, tables, rows, migrations, github_run_id) VALUES ('db_verified', true, ${label}, 55, 1000, 37, '424242')`;
  // Bez BACKUP_AUTOMATION: zapis GitHub prolaza aktivira proveru baze, ostalo ostaje „nije podešeno".
  const auto = (await loadBackupStatus(now, { BACKUP_SOURCE_LABEL: label }))!;
  assert.equal(auto.find((i) => i.kind === "db_verified")!.tone, "success");
  assert.equal(auto.find((i) => i.kind === "offsite_stored")!.state, "nije_podesen");
  // Izričito isključenje i dalje važi.
  const off = (await loadBackupStatus(now, { BACKUP_AUTOMATION: "pdf_backup", BACKUP_SOURCE_LABEL: label }))!;
  assert.equal(off.find((i) => i.kind === "db_verified")!.state, "nije_podesen");
  const ENV = { BACKUP_AUTOMATION: "db_verified,offsite_stored,pdf_backup" };
  const items = (await loadBackupStatus(now, ENV))!;
  assert.deepEqual(items.map((i) => i.kind), ["db_verified", "offsite_stored", "pdf_backup"]);
  const db1 = items.find((i) => i.kind === "db_verified")!;
  assert.equal(db1.tone, "success");
  // Proverena kopija NE znači da je sačuvana van GitHub-a.
  const offsite = items.find((i) => i.kind === "offsite_stored")!;
  if (!offsite.lastOk) assert.equal(offsite.state, "nikad");
  // Oznaka izvora: zapisi druge oznake (npr. lokalna proba) se ne računaju.
  const other = (await loadBackupStatus(now, { ...ENV, BACKUP_SOURCE_LABEL: "nepostojeca-oznaka" }))!;
  assert.equal(other.find((i) => i.kind === "db_verified")!.state, "nikad");
  await db.sql`INSERT INTO backup_runs (kind, ok, source_label, detail, finished_at, github_run_id) VALUES ('db_verified', false, ${label}, 'manifest se razlikuje', now() + interval '1 second', '424243')`;
  const again = (await loadBackupStatus(new Date(now.getTime() + 5000), ENV))!.find((i) => i.kind === "db_verified")!;
  assert.equal(again.state, "poslednji_neuspeo");
  assert.match(again.message, /manifest se razlikuje/);
});

test("potpisana potvrda uređaja (0037): samo za otisak koji je GitHub proverio, bez dupliranja", async (t) => {
  if (guard(t)) return;
  const run = `9${Date.now()}`;
  const lbl = `${label}-dev`;
  const sha = randomBytes(32).toString("hex");
  const call = (kind: string, runId: string | null, encSha: string | null, extra: Partial<Record<"n" | "c" | "m" | "o", number>> = {}) =>
    db.sql<{ run_id: string; created: boolean }[]>`
      SELECT run_id::text AS run_id, created FROM record_device_backup(${kind}::backup_run_kind, 'KANC-QA', ${runId}, ${encSha}, 100::bigint,
        ${extra.n ?? null}::integer, ${extra.c ?? null}::integer, ${extra.m ?? null}::integer, ${extra.o ?? null}::bigint, now())`;

  // Nepoznat prolaz/otisak: odbijeno.
  await assert.rejects(call("offsite_stored", run, sha), (e: { code?: string }) => e.code === "P0002");
  await db.sql`INSERT INTO backup_runs (kind, ok, source_label, encrypted_sha256, github_run_id, tables, rows, migrations)
               VALUES ('db_verified', true, ${lbl}, ${sha}, ${run}, 55, 1000, 37)`;
  // Isti prolaz, drugi otisak: odbijeno.
  await assert.rejects(call("offsite_stored", run, randomBytes(32).toString("hex")), (e: { code?: string }) => e.code === "P0002");
  const [first] = await call("offsite_stored", run, sha);
  assert.equal(first.created, true);
  const [again] = await call("offsite_stored", run, sha);
  assert.deepEqual(again, { run_id: first.run_id, created: false });
  const [row] = await db.sql<{ recorded_by: string; source_label: string; tables: number }[]>`
    SELECT recorded_by, source_label, tables FROM backup_runs WHERE id = ${first.run_id}::uuid`;
  assert.deepEqual(row, { recorded_by: "uredjaj:KANC-QA", source_label: lbl, tables: 55 });

  // Uređaj ne može da proglasi proveru baze.
  await assert.rejects(call("db_verified", run, sha), (e: { code?: string }) => e.code === "42501");
  // PDF: samo nenegativni brojevi.
  await assert.rejects(call("pdf_backup", null, null, { n: -1, c: 0, m: 0, o: 1 }), (e: { code?: string }) => e.code === "22023");
  const [pdf] = await call("pdf_backup", null, null, { n: 3, c: 0, m: 0, o: 94 });
  assert.equal(pdf.created, true);

  // Servis: bez BACKUP_AUTOMATION sve tri vrste su sada aktivne i zelene.
  const { loadBackupStatus } = await import("../../lib/backup/status-service.ts");
  const items = (await loadBackupStatus(new Date(Date.now() + 5000), { BACKUP_SOURCE_LABEL: lbl }))!;
  assert.deepEqual(items.map((i) => [i.kind, i.tone]), [["db_verified", "success"], ["offsite_stored", "success"], ["pdf_backup", "success"]]);

  // Funkciju ne sme da izvrši bilo ko (PUBLIC je oduzet).
  const [p] = await db.sql<{ x: boolean }[]>`
    SELECT has_function_privilege(${status}, 'record_device_backup(backup_run_kind, text, text, text, bigint, integer, integer, integer, bigint, timestamptz)', 'EXECUTE') AS x`;
  assert.equal(p.x, false);
});
