import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { syncDeviceKeys, syncDevices, syncRequestNonces } from "@/db/schema";
import {
  bodyMatchesHash,
  canonicalPath,
  nonceRetainUntil,
  PROTOCOL_VERSION,
  readSignatureHeaders,
  SigningError,
  signingString,
  timestampWithinWindow,
  verifySignature,
} from "./signing.mjs";

/**
 * Autentifikacija jednog zahteva sa uređaja.
 *
 * Redosled nije stvar stila — svaki korak štiti onaj sledeći:
 *
 *   1. oblik zaglavlja (bez ijednog upita);
 *   2. uređaj i ključ iz baze, oba `active`;
 *   3. vreme u prozoru;
 *   4. otisak TELA nad primljenim bajtovima;
 *   5. potpis;
 *   6. TEK ONDA upis nonce-a.
 *
 * Nonce se upisuje POSLE provere potpisa. Da se upisuje ranije, bilo ko bi
 * potrošio tuđe nonce-ove običnim slanjem smeća i time onemogućio uređaju da
 * radi — uskraćivanje usluge bez ijednog validnog potpisa.
 */

export type AuthenticatedDevice = {
  deviceId: string;
  deviceCode: string;
  keyId: string;
  /** Opseg iz REGISTRACIJE. Payload ga ne određuje, samo se poredi sa njim. */
  sourceSystem: string;
  issuerCode: string;
  signedAt: Date;
  nonce: string;
};

export class DeviceAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 401,
  ) {
    super(message);
    this.name = "DeviceAuthError";
  }
}

/**
 * Proverava potpisan zahtev i registruje nonce.
 *
 * Poruke su namerno kratke i ujednačene: „nepoznat uređaj“, „neispravan
 * potpis“ i „opozvan ključ“ ne smeju da se razlikuju toliko da postanu
 * pretraživač tuđih uređaja. Razlog ostaje u `code`, za log.
 *
 * @param bodyBytes TAČNI primljeni bajtovi tela, pre parsiranja.
 */
export async function authenticateDeviceRequest(input: {
  method: string;
  path: string;
  header: (name: string) => string | null;
  bodyBytes: Uint8Array;
  now?: Date;
}): Promise<AuthenticatedDevice> {
  const now = input.now ?? new Date();

  /* --- 1. Oblik zaglavlja i putanje. Bez ijednog upita. ---------------- */
  let h;
  let path;
  try {
    h = readSignatureHeaders(input.header);
    path = canonicalPath(input.path);
  } catch (error) {
    if (error instanceof SigningError) {
      throw new DeviceAuthError(error.code, "Zahtev nije ispravno potpisan.", 401);
    }
    throw error;
  }

  const method = String(input.method || "").toUpperCase();
  if (method !== "POST") {
    throw new DeviceAuthError("method_not_allowed", "Metod nije dozvoljen.", 405);
  }

  /* --- 2. Uređaj i ključ. Oba moraju biti `active`. -------------------- */
  const db = getDb();
  const redovi = await db
    .select({
      deviceId: syncDevices.id,
      deviceCode: syncDevices.deviceCode,
      deviceStatus: syncDevices.status,
      sourceSystem: syncDevices.sourceSystem,
      issuerCode: syncDevices.issuerCode,
      keyRowId: syncDeviceKeys.id,
      keyStatus: syncDeviceKeys.status,
      publicKeySpki: syncDeviceKeys.publicKeySpki,
      algorithm: syncDeviceKeys.algorithm,
    })
    .from(syncDevices)
    .innerJoin(syncDeviceKeys, eq(syncDeviceKeys.deviceId, syncDevices.id))
    .where(and(eq(syncDevices.deviceCode, h.deviceId), eq(syncDeviceKeys.keyId, h.keyId)))
    .limit(1);

  const red = redovi[0];
  /*
   * Nepoznat uređaj i neispravan potpis daju ISTU poruku.
   *
   * Različite poruke bi pretvorile endpoint u pretraživač: napadač bi po
   * odgovoru saznao koje oznake uređaja postoje.
   */
  if (!red) throw new DeviceAuthError("unknown_device", "Zahtev nije prihvaćen.", 401);
  if (red.deviceStatus !== "active" || red.keyStatus !== "active") {
    throw new DeviceAuthError("device_not_active", "Zahtev nije prihvaćen.", 401);
  }
  if (red.algorithm !== "ed25519") {
    throw new DeviceAuthError("algorithm_unsupported", "Zahtev nije prihvaćen.", 401);
  }

  /* --- 3. Vreme, u OBA smera. ------------------------------------------ */
  if (!timestampWithinWindow(h.signedAtMs, now.getTime())) {
    throw new DeviceAuthError("timestamp_out_of_window", "Zahtev je van vremenskog prozora.", 401);
  }

  /* --- 4. Telo. Nad PRIMLJENIM bajtovima, ne nad ponovo serijalizovanim. */
  if (!bodyMatchesHash(input.bodyBytes, h.bodyHash)) {
    throw new DeviceAuthError("body_hash_mismatch", "Telo ne odgovara potpisu.", 401);
  }

  /* --- 5. Potpis. ------------------------------------------------------ */
  const niz = signingString({
    version: PROTOCOL_VERSION,
    deviceId: h.deviceId,
    keyId: h.keyId,
    method,
    path,
    timestamp: h.timestamp,
    nonce: h.nonce,
    bodyHash: h.bodyHash,
  });

  if (
    !verifySignature({
      signingString: niz,
      signatureBase64: h.signature,
      publicKeySpki: red.publicKeySpki,
    })
  ) {
    throw new DeviceAuthError("signature_invalid", "Zahtev nije prihvaćen.", 401);
  }

  /* --- 6. Nonce. Upis odlučuje ko je prvi. ----------------------------- */
  await claimNonce({
    deviceId: red.deviceId,
    keyId: h.keyId,
    nonce: h.nonce,
    signedAt: new Date(h.signedAtMs),
  });

  return {
    deviceId: red.deviceId,
    deviceCode: red.deviceCode,
    keyId: h.keyId,
    sourceSystem: red.sourceSystem,
    issuerCode: red.issuerCode,
    signedAt: new Date(h.signedAtMs),
    nonce: h.nonce,
  };
}

/**
 * Zauzima nonce, ili odbija zahtev.
 *
 * `INSERT` sa jedinstvenim indeksom je jedina provera. Čitanje pa upis bi
 * ostavilo prozor u kome dva istovremena zahteva oba vide „nonce je slobodan“ —
 * i oba bi izvršila poslovni upis.
 */
async function claimNonce(input: {
  deviceId: string;
  keyId: string;
  nonce: string;
  signedAt: Date;
}): Promise<void> {
  try {
    await getDb().insert(syncRequestNonces).values({
      deviceId: input.deviceId,
      keyId: input.keyId,
      nonce: input.nonce,
      signedAt: input.signedAt,
      retainUntil: nonceRetainUntil(input.signedAt.getTime()),
    });
  } catch (error) {
    if (isUniqueViolation(error, "sync_request_nonces_key")) {
      throw new DeviceAuthError("nonce_replayed", "Zahtev je već obrađen.", 409);
    }
    throw error;
  }
}

/**
 * Briše nonce-ove kojima je rok čuvanja prošao.
 *
 * Poziva se usput, iz samog prijema — u P2 nema zasebnog schedulera samo zbog
 * čišćenja, a on ni ne bi bio garancija: bez njega bi tabela rasla, ne bi se
 * gubila zaštita.
 *
 * Rok se računa od `signed_at`, pa red nestaje tek kada zahtev više ne može da
 * prođe proveru vremena. Prerano brisanje bi ponovo otvorilo replay.
 */
export async function pruneExpiredNonces(now = new Date()): Promise<number> {
  const obrisani = await getDb()
    .delete(syncRequestNonces)
    .where(lt(syncRequestNonces.retainUntil, now))
    .returning({ id: syncRequestNonces.id });
  return obrisani.length;
}

/**
 * Beleži AUTENTIFIKOVAN kontakt.
 *
 * Poziva se tek pošto potpis prođe. Neuspešan ili nepotpisan zahtev ga ne
 * dira — inače bi „uređaj se javio“ značilo samo „neko je pogodio adresu“.
 *
 * Ovo NE znači uspešan uvoz, proveren lager ni završenu sinhronizaciju.
 */
export async function recordDeviceContact(deviceId: string, now = new Date()): Promise<void> {
  await getDb()
    .update(syncDevices)
    .set({ lastSeenAt: now, updatedAt: now })
    .where(eq(syncDevices.id, deviceId));
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const c = current as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (c.code === "23505" && c.constraint_name === constraint) return true;
    current = c.cause;
  }
  return false;
}
