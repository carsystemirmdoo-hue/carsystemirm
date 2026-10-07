import { parseHeartbeatBody, recordCycleReport } from "@/lib/sync/device/cycle-report";
import { syncJson, withAuthenticatedDevice } from "@/lib/sync/http/handler";

/**
 * Potpisan „javljam se“ sa uređaja.
 *
 * Dokazuje TAČNO jedno: uređaj se autentifikovano javio u tom trenutku.
 *
 * NE znači uspešan uvoz, proveren lager ni završenu sinhronizaciju. Neuspešan
 * ili nepotpisan zahtev ne osvežava status — `recordDeviceContact` se poziva
 * tek pošto potpis prođe, u `withAuthenticatedDevice`.
 *
 * Telo se potpisuje i njegov otisak ulazi u potpis; prazan objekat je
 * legitiman sadržaj (konektor 0.3.8). Od 0.3.9 telo može nositi izveštaj
 * ciklusa — samo brojeve i vremena — koji se beleži odvojeno od javljanja.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "/api/sync/heartbeat";

export async function POST(request: Request): Promise<Response> {
  return withAuthenticatedDevice(request, PATH, async ({ device, bodyBytes, requestId }) => {
    /*
     * Izveštaj ciklusa (0.3.9) je opcion. Prazno telo (0.3.8) se ponaša kao i
     * do sada. Neispravan izveštaj se odbija sa kodom, ali kontakt je već
     * zabeležen — potpis je prošao — i nijedan dokument se ne dira.
     */
    const parsed = parseHeartbeatBody(bodyBytes);
    if (parsed.kind === "invalid") {
      return syncJson(400, { ok: false, code: parsed.code, requestId });
    }
    const cycle =
      parsed.kind === "cycle" ? await recordCycleReport(device.deviceId, parsed.report) : null;

    return syncJson(200, {
      ok: true,
      code: "acknowledged",
      requestId,
      deviceId: device.deviceId,
      /*
       * Izričito, da se odgovor ne pročita kao potvrda sinhronizacije.
       *
       * Polje postoji zato što bi ga inače neko izveo iz `ok: true`.
       */
      meaning: "authenticated_contact_only",
      ...(cycle ? { cycle } : {}),
    });
  });
}
