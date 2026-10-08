import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { BACKUP_KINDS, classifyBackup, enabledBackupKinds } from "@/lib/backup/status.mjs";

type Row = {
  kind: string; ok: boolean; finished_at: string; started_at: string | null; source_label: string | null;
  migrations: number | null; tables: number | null; rows: string | null; bytes: string | null;
  files_new: number | null; files_changed: number | null; files_missing: number | null; detail: string | null;
};

/**
 * Poslednje stanje svake vrste kopije (samo čitanje `backup_runs`).
 *
 * Računaju se samo vrste uključene u `BACKUP_AUTOMATION`; ako je zadat
 * `BACKUP_SOURCE_LABEL`, samo zapisi sa tom oznakom izvora. Ostalo (probe,
 * ručne kopije) se ne prikazuje kao stvarna kopija.
 * Ako tabela još ne postoji (baza pre 0036), vraća `null` umesto greške.
 */
export async function loadBackupStatus(now = new Date(), env: Record<string, string | undefined> = process.env) {
  const enabled = enabledBackupKinds(env);
  const label = env.BACKUP_SOURCE_LABEL?.trim() || null;
  const db = getDb();
  let rows: Row[];
  try {
    rows = [...(await db.execute<Row>(sql`
      SELECT DISTINCT ON (kind, ok) kind::text AS kind, ok, finished_at::text AS finished_at, started_at::text AS started_at,
             source_label, migrations, tables, rows::text AS rows, bytes::text AS bytes,
             files_new, files_changed, files_missing, detail
        FROM backup_runs
       WHERE ${label === null ? sql`true` : sql`source_label = ${label}`}
       ORDER BY kind, ok, finished_at DESC`))];
  } catch (error) {
    if ((error as { code?: string })?.code === "42P01" || /backup_runs/.test(String(error))) return null;
    throw error;
  }
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
