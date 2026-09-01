import { preuzmiKomandu } from "@/lib/sync/commands/service";
import { BodyError, parseJsonBody } from "@/lib/sync/http/gate";
import { syncJson, withAuthenticatedDevice } from "@/lib/sync/http/handler";

/**
 * Uređaj pita ima li komande za njega.
 *
 * Ruta ne radi ništa sama: `withAuthenticatedDevice` sprovodi OBA gate-a,
 * granice tela, rate limit, timestamp, potpis i anti-replay — isti put kojim
 * ide i `ingest`. Ovde stoji samo prevođenje ishoda u HTTP.
 *
 * `POST` sa potpisanim telom, ne `GET`: potpis pokriva otisak tela, a query
 * string je u profilu zabranjen. Prazan objekat je legitimno telo.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "/api/sync/commands/poll";

export async function POST(request: Request): Promise<Response> {
  return withAuthenticatedDevice(
    request,
    PATH,
    async ({ device, bodyBytes, requestId }) => {
      try {
        parseJsonBody(bodyBytes);
      } catch (error) {
        if (error instanceof BodyError) {
          return syncJson(error.status, { ok: false, code: error.code, requestId });
        }
        return syncJson(400, { ok: false, code: "body_unreadable", requestId });
      }

      try {
        /*
         * Opseg dolazi IZ POTPISA.
         *
         * Telo ne nosi `deviceId` i ne bi mu se verovalo — uređaj ne može da
         * pita za tuđe komande jer se filtrira po ID-u iz autentifikacije.
         */
        const komanda = await preuzmiKomandu({ deviceId: device.deviceId });

        if (!komanda) {
          return syncJson(200, { ok: true, code: "no_command", requestId });
        }

        /*
         * Minimalan sadržaj: ID, zatvoren tip, verzija i rok.
         *
         * Nema putanje, foldera, URL-a, konfiguracije ni bilo čega što bi uređaj
         * mogao da protumači kao uputstvo. Šta `scan_and_sync` znači, zna
         * konektor — ne server.
         */
        return syncJson(200, {
          ok: true,
          code: "command",
          requestId,
          command: {
            id: komanda.id,
            type: komanda.commandType,
            version: komanda.commandVersion,
            expiresAt: komanda.expiresAt,
          },
        });
      } catch {
        return syncJson(503, { ok: false, code: "temporarily_unavailable", requestId });
      }
    },
    { trazi: "operations" },
  );
}
