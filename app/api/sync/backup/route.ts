import { parseDeviceBackupReport } from "@/lib/backup/deviceReport.mjs";
import { recordDeviceBackup, type DeviceBackupReport } from "@/lib/backup/device-confirm";
import { syncJson, withAuthenticatedDevice } from "@/lib/sync/http/handler";

/**
 * Potpisana potvrda rezervne kopije sa firminog računara.
 *
 * Računar nema lozinku baze: dokazuje identitet istim Ed25519 ključem kao za
 * fakture, a server upisuje zapis samo kroz `record_device_backup` (0037).
 *
 * `offsite_stored` prolazi samo ako otisak šifrovane kopije odgovara USPEŠNOM
 * GitHub prolazu (`db_verified`) — inače 409 `backup_unknown`. Ponovljena
 * potvrda istog prolaza vraća `created: false` i ne osvežava rok.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "/api/sync/backup";

export async function POST(request: Request): Promise<Response> {
  return withAuthenticatedDevice(request, PATH, async ({ device, bodyBytes, requestId }) => {
    const parsed = parseDeviceBackupReport(bodyBytes);
    if (!parsed.ok) return syncJson(400, { ok: false, code: parsed.code, requestId });
    const r = await recordDeviceBackup(device.deviceCode, parsed.report as DeviceBackupReport);
    if (!r.ok) return syncJson(r.code === "backup_unknown" ? 409 : 503, { ok: false, code: r.code, requestId });
    return syncJson(200, {
      ok: true,
      code: r.created ? "backup_recorded" : "backup_already_recorded",
      requestId,
      kind: (parsed.report as DeviceBackupReport).vrsta,
    });
  });
}
