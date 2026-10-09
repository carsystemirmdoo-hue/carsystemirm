import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export type DeviceBackupReport =
  | { vrsta: "offsite_stored"; githubRunId: string; sifrovanSha256: string; bajtova: number; kopijaOd: string; cuvaSe: number }
  | { vrsta: "pdf_backup"; pocetak: string; novih: number; promenjenih: number; nestalih: number; ukupnoObjekata: number };

export type DeviceBackupResult =
  | { ok: true; runId: string; created: boolean }
  | { ok: false; code: "backup_unknown" | "backup_not_ready" };

/**
 * Upis potpisane potvrde uređaja. Aplikacija nema INSERT nad `backup_runs`;
 * jedini put je funkcija iz 0037, koja `offsite_stored` prihvata samo za
 * otisak koji je GitHub prolaz već proverio.
 */
export async function recordDeviceBackup(deviceCode: string, r: DeviceBackupReport): Promise<DeviceBackupResult> {
  const offsite = r.vrsta === "offsite_stored";
  try {
    const rows = [...(await getDb().execute<{ run_id: string; created: boolean }>(sql`
      SELECT run_id::text AS run_id, created FROM record_device_backup(
        ${r.vrsta}::backup_run_kind, ${deviceCode},
        ${offsite ? r.githubRunId : null}, ${offsite ? r.sifrovanSha256 : null}, ${offsite ? r.bajtova : null}::bigint,
        ${offsite ? null : r.novih}::integer, ${offsite ? null : r.promenjenih}::integer, ${offsite ? null : r.nestalih}::integer,
        ${offsite ? null : r.ukupnoObjekata}::bigint, ${offsite ? r.kopijaOd : r.pocetak}::timestamptz)`))];
    const row = rows[0];
    if (!row) return { ok: false, code: "backup_not_ready" };
    return { ok: true, runId: row.run_id, created: row.created };
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } })?.cause?.code ?? (error as { code?: string })?.code;
    if (code === "P0002") return { ok: false, code: "backup_unknown" };
    // Baza pre 0037 (funkcija ne postoji) ili bez prava izvršavanja.
    if (code === "42883" || code === "42501") return { ok: false, code: "backup_not_ready" };
    throw error;
  }
}
