import "server-only";
import { resolveClientIp } from "@/lib/auth/rate-limit-policy.mjs";
import { registerAttempt } from "@/lib/auth/rate-limit-service";
import {
  authenticateDeviceRequest,
  DeviceAuthError,
  pruneExpiredNonces,
  recordDeviceContact,
  type AuthenticatedDevice,
} from "@/lib/sync/device/authenticate";
import { HEADERS } from "@/lib/sync/device/signing.mjs";
import {
  BodyError,
  isDeviceIngestEnabled,
  isSyncOperationsEnabled,
  readBoundedBody,
  requireJsonContentType,
} from "./gate";

/**
 * Zajednički put svakog zahteva sa uređaja.
 *
 * Oba endpointa prolaze OVUDA i svaki sam sprovodi autentifikaciju. Middleware
 * i portal kolačić nisu zamena: middleware se konfiguriše na drugom mestu i
 * jedna izmena `matcher`-a bi tiho otvorila rutu, a kolačić dokazuje pretraživač
 * prijavljenog čoveka — ne uređaj.
 */

/** Odgovor nosi SAMO tehničke reference; nikad sadržaj dokumenta. */
export type SyncResponseBody = {
  ok: boolean;
  code: string;
  /** Korelacija za log; ne otkriva ništa o dokumentu. */
  requestId: string;
  [k: string]: unknown;
};

export function syncJson(status: number, body: SyncResponseBody): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Odgovor se ne kešira i ne indeksira ni pod kojim uslovom.
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * Redosled je obavezan i svaki korak štiti sledeći.
 *
 *   1. gate — isključen kanal ne troši ništa;
 *   2. metod i content type — jeftino, bez baze;
 *   3. rate limit za NEPOZNATOG pozivaoca;
 *   4. ograničeno telo (stvarni bajtovi, ne `Content-Length`);
 *   5. autentifikacija: uređaj, ključ, vreme, otisak tela, potpis, nonce;
 *   6. rate limit za AUTENTIFIKOVAN uređaj;
 *   7. posao.
 *
 * Greška baze ne sme da zaobiđe 1–5: sve što padne posle autentifikacije pada
 * kao neuspeh posla, ne kao propuštanje zahteva.
 */
export async function withAuthenticatedDevice(
  request: Request,
  path: string,
  posao: (ctx: {
    device: AuthenticatedDevice;
    bodyBytes: Uint8Array;
    requestId: string;
  }) => Promise<Response>,
  opcije: { trazi?: "ingest" | "operations" } = {},
): Promise<Response> {
  const requestId = crypto.randomUUID();

  /* --- 1. Gate. Podrazumevano isključen. ------------------------------- */
  /*
   * Rute komandi traže SVOJ gate uz postojeći.
   *
   * Uključivanje prijema dokumenata ne sme usput da otvori i daljinsko
   * pokretanje posla na kancelarijskom računaru — to su različite odluke.
   */
  const otvoreno =
    opcije.trazi === "operations" ? isSyncOperationsEnabled() : isDeviceIngestEnabled();
  if (!otvoreno) {
    /*
     * 404, ne 403.
     *
     * Isključen kanal ne treba da potvrdi da postoji. `403` bi rekao „ovde
     * ima nečega, samo ti ne smeš“.
     */
    return syncJson(404, { ok: false, code: "not_found", requestId });
  }

  /* --- 2. Metod i tip. Bez baze. --------------------------------------- */
  if (request.method !== "POST") {
    return syncJson(405, { ok: false, code: "method_not_allowed", requestId });
  }

  /*
   * `Headers` se prosledjuje kakav jeste — `resolveClientIp` zove `.get()`.
   *
   * `Object.fromEntries` bi dao obican objekat bez `get`, i adresa bi tiho
   * ostala `null`: brojac po adresi bi prestao da radi, a nista ne bi puklo.
   */
  const clientIp = resolveClientIp({
    headers: request.headers,
    trustedProxy: true,
    socketAddress: null,
  });

  /*
   * Oznaka uređaja iz zaglavlja je TVRDNJA, ne identitet.
   *
   * Koristi se samo kao ključ brojača za nepoznate pozivaoce, da jedan izvor
   * ne bi trošio ceo limit adrese izmišljanjem oznaka. Ničemu drugom ne služi
   * dok potpis ne prođe.
   */
  const tvrdjenaOznaka = (request.headers.get(HEADERS.device) ?? "").slice(0, 64) || null;

  const nepoznat = await registerAttempt({
    scope: "sync_unknown",
    accountIdentifier: tvrdjenaOznaka,
    clientIp,
  });
  if (!nepoznat.allowed) {
    return syncJson(429, {
      ok: false,
      code: "rate_limited",
      requestId,
      retryAfterSeconds: nepoznat.retryAfterSeconds,
    });
  }

  /* --- 3. Telo, uz tvrdu granicu. -------------------------------------- */
  let bodyBytes: Uint8Array;
  try {
    requireJsonContentType(request);
    bodyBytes = await readBoundedBody(request);
  } catch (error) {
    if (error instanceof BodyError) {
      return syncJson(error.status, { ok: false, code: error.code, requestId });
    }
    return syncJson(400, { ok: false, code: "body_unreadable", requestId });
  }

  /* --- 4. Autentifikacija. --------------------------------------------- */
  let device: AuthenticatedDevice;
  try {
    device = await authenticateDeviceRequest({
      method: request.method,
      path,
      header: (name) => request.headers.get(name),
      bodyBytes,
    });
  } catch (error) {
    if (error instanceof DeviceAuthError) {
      return syncJson(error.status, { ok: false, code: error.code, requestId });
    }
    /*
     * Greška baze pri autentifikaciji NE propušta zahtev.
     *
     * Bez ovoga bi ispad baze pretvorio provere potpisa i nonce-a u „prošlo je“.
     * Odgovor je 503 i posao se ne izvršava.
     */
    return syncJson(503, { ok: false, code: "temporarily_unavailable", requestId });
  }

  /* --- 5. Rate limit za poznat uređaj. --------------------------------- */
  const poznat = await registerAttempt({
    scope: "sync_device",
    accountIdentifier: device.deviceId,
    clientIp,
  });
  if (!poznat.allowed) {
    return syncJson(429, {
      ok: false,
      code: "rate_limited",
      requestId,
      retryAfterSeconds: poznat.retryAfterSeconds,
    });
  }

  /*
   * Čišćenje isteklih nonce-ova ide usput.
   *
   * Zaseban scheduler samo zbog ovoga nije potreban u P2, i ne bi bio
   * garancija: bez čišćenja tabela raste, ali se zaštita ne gubi.
   */
  void pruneExpiredNonces().catch(() => {});

  /* --- 6. Kontakt je zabeležen TEK posle uspešnog potpisa. ------------- */
  await recordDeviceContact(device.deviceId);

  return posao({ device, bodyBytes, requestId });
}
