import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export type DeviceReceiptDay = {
  day: string;
  deviceCode: string;
  received: number;
  booked: number;
  pending: number;
};

/**
 * Prijem dokumenata sa uređaja (konektor) po danu — za istoriju uvoza.
 *
 * Prijem preko `/api/sync/ingest` ne otvara `import_runs`, pa ga istorija
 * ručnih uvoza nije pokazivala (revizija 2026-10-11, B2). Ovde se broji iz
 * `source_documents`: primljeno, proknjiženo (ima fakturu) i na čekanju
 * (mapiranje kupca ili pregled). Bez brojeva dokumenata i naziva kupaca.
 */
export async function loadDeviceReceipts(days = 14): Promise<DeviceReceiptDay[]> {
  const rows = await getDb().execute<{ day: string; device_code: string; received: number; booked: number; pending: number }>(sql`
    SELECT (s.created_at AT TIME ZONE 'Europe/Belgrade')::date::text AS day, d.device_code,
           count(*)::int AS received,
           count(*) FILTER (WHERE s.invoice_id IS NOT NULL)::int AS booked,
           count(*) FILTER (WHERE s.invoice_id IS NULL)::int AS pending
      FROM source_documents s
      JOIN sync_devices d ON d.id = s.delivered_by_device_id
     WHERE s.created_at >= now() - make_interval(days => ${Math.max(1, Math.min(90, days))})
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2`);
  return [...rows].map((r) => ({ day: r.day, deviceCode: r.device_code, received: r.received, booked: r.booked, pending: r.pending }));
}
