import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activeBackupKinds, BACKUP_KINDS, classifyBackup } from "@/lib/backup/status.mjs";

type Row = {
  kind: string; ok: boolean; finished_at: string; started_at: string | null; source_label: string | null;
  migrations: number | null; tables: number | null; rows: string | null; bytes: string | null;
  files_new: number | null; files_changed: number | null; files_missing: number | null; detail: string | null;
};

/**
 * Zapis dokazivog porekla — jedino se on prikazuje kao stvarna kopija:
 *   db_verified    — upisao ga je GitHub prolaz (github_run_id, nije uređaj);
 *   offsite_stored, pdf_backup — potpisana potvrda uređaja kroz 0037.
 * Ručni ili probni upis (npr. sa Mac-a) nema to poreklo i ne računa se.
 */
const TRUSTED_ORIGIN_SQL = sql`(
  (kind = 'db_verified' AND github_run_id IS NOT NULL AND recorded_by NOT LIKE 'uredjaj:%')
  OR (kind IN ('offsite_stored', 'pdf_backup') AND recorded_by LIKE 'uredjaj:%'))`;

/**
 * Poslednje stanje svake vrste kopije (samo čitanje `backup_runs`).
 *
 * Aktivne vrste: `BACKUP_AUTOMATION` ako je zadat, inače one za koje postoji
 * zapis dokazivog porekla (vidi `activeBackupKinds`). `BACKUP_SOURCE_LABEL`,
 * ako je zadat, sužava kopiju baze i kopiju van GitHub-a na tu oznaku izvora
 * (PDF kopija nema oznaku baze).
 * Ako tabela još ne postoji (baza pre 0036), vraća `null` umesto greške.
 */
export async function loadBackupStatus(now = new Date(), env: Record<string, string | undefined> = process.env) {
  const label = env.BACKUP_SOURCE_LABEL?.trim() || null;
  const db = getDb();
  let rows: Row[];
  try {
    rows = [...(await db.execute<Row>(sql`
      SELECT DISTINCT ON (kind, ok) kind::text AS kind, ok, finished_at::text AS finished_at, started_at::text AS started_at,
             source_label, migrations, tables, rows::text AS rows, bytes::text AS bytes,
             files_new, files_changed, files_missing, detail
        FROM backup_runs
       WHERE ${TRUSTED_ORIGIN_SQL}
         AND ${label === null ? sql`true` : sql`(kind = 'pdf_backup' OR source_label = ${label})`}
       ORDER BY kind, ok, finished_at DESC`))];
  } catch (error) {
    if ((error as { code?: string })?.code === "42P01" || /backup_runs/.test(String(error))) return null;
    throw error;
  }
  const enabled = activeBackupKinds(env, Object.fromEntries(BACKUP_KINDS.map((k) => [k, rows.some((r) => r.kind === k)])));
  return BACKUP_KINDS.map((kind) => {
    if (!enabled.includes(kind)) {
      return { ...classifyBackup(kind, null, null, now, { enabled: false }), lastOk: null, lastFail: null };
    }
    const lastOk = rows.find((r) => r.kind === kind && r.ok) ?? null;
    const lastFail = rows.find((r) => r.kind === kind && !r.ok) ?? null;
    const lastAny = [lastOk, lastFail].filter(Boolean).sort((a, b) => Date.parse(b!.finished_at) - Date.parse(a!.finished_at))[0] ?? null;
    const state = classifyBackup(
      kind,
      lastOk ? { finishedAt: lastOk.finished_at, ok: true } : null,
      lastAny ? { finishedAt: lastAny.finished_at, ok: lastAny.ok, detail: lastAny.detail } : null,
      now,
    );
    return { ...state, lastOk, lastFail };
  });
}

export type BackupStatusItem = NonNullable<Awaited<ReturnType<typeof loadBackupStatus>>>[number];
