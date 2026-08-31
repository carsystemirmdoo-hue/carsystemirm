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
 * Telo se i dalje potpisuje i njegov otisak ulazi u potpis; prazan objekat je
 * legitiman sadržaj. Ovde se ne parsira jer nijedno polje nije potrebno —
 * heartbeat ne prenosi podatke.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "/api/sync/heartbeat";

export async function POST(request: Request): Promise<Response> {
  return withAuthenticatedDevice(request, PATH, async ({ device, requestId }) => {
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
    });
  });
}
