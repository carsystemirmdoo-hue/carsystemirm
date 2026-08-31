import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { syncDeviceKeys, syncDevices } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { keyFingerprint, SIGNATURE_ALGORITHM } from "./signing.mjs";

/**
 * Životni ciklus uređaja: registracija, aktivacija, opoziv.
 *
 * Sve tri radnje traže `devices:manage`, i to se proverava u pozivaocu
 * (`requireCapability`). Ovaj modul ne sadrži nijednu javnu rutu i nijedan
 * bootstrap put — uređaj se ne može sam registrovati, aktivirati, rotirati
 * ključ ni promeniti sebi opseg.
 *
 * SERVER ČUVA SAMO JAVNE KLJUČEVE. Privatni nastaje na uređaju; ni jedna
 * funkcija ovde ga ne prima i nema kolone u koju bi stao.
 */

export type DeviceActor = { id: string; name: string; role: string };

export class DeviceAdminError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeviceAdminError";
  }
}

/** Oznaka uređaja u tragu — nikad ceo javni ključ. */
function deviceRef(deviceCode: string): string {
  return `dev:${deviceCode}`;
}

/**
 * Registruje uređaj i njegov PRVI javni ključ, u stanju `registered`.
 *
 * Nikad `active`. Registracija i aktivacija su namerno dva čina: da su jedno,
 * svako ko ume da sastavi zahtev za registraciju time bi i otvorio kanal ka
 * prometu. Između njih stoji čovek koji uporedi otisak ključa sa onim što
 * uređaj pokazuje.
 */
export async function registerDevice(
  input: {
    deviceCode: string;
    label: string;
    sourceSystem: string;
    issuerCode: string;
    keyId: string;
    publicKeySpki: string;
  },
  actor: DeviceActor,
): Promise<{ deviceId: string; keyId: string; fingerprint: string }> {
  const db = getDb();
  const fingerprint = keyFingerprint(input.publicKeySpki);

  return db.transaction(async (tx) => {
    const [device] = await tx
      .insert(syncDevices)
      .values({
        deviceCode: input.deviceCode,
        label: input.label,
        sourceSystem: input.sourceSystem,
        issuerCode: input.issuerCode,
        status: "registered",
        registeredBy: actor.id,
      })
      .returning({ id: syncDevices.id });

    await tx.insert(syncDeviceKeys).values({
      deviceId: device.id,
      keyId: input.keyId,
      algorithm: SIGNATURE_ALGORITHM,
      publicKeySpki: input.publicKeySpki,
      fingerprint,
      status: "registered",
      createdBy: actor.id,
    });

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.deviceRegistered,
        entityType: "Uređaj za prijem",
        entityId: device.id,
        entityLabel: deviceRef(input.deviceCode),
        // Otisak, ne ključ: trag ne treba da nosi ceo materijal.
        after: { opseg: `${input.sourceSystem}/${input.issuerCode}`, otisak: fingerprint },
        reason: "Uređaj registrovan; još ne sme da šalje.",
      },
      tx,
    );

    return { deviceId: device.id, keyId: input.keyId, fingerprint };
  });
}

/**
 * Aktivira uređaj i jedan njegov ključ.
 *
 * Opozvan uređaj se NE vraća u pogon: opoziv je trajna odluka, i „reaktivacija“
 * bi značila da jedan pogrešan klik poništava reakciju na kompromitovan ključ.
 * Za nastavak rada se registruje nov uređaj sa novim ključem.
 */
export async function activateDevice(
  input: { deviceId: string; keyId: string; expectedFingerprint: string },
  actor: DeviceActor,
): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    const [device] = await tx
      .select()
      .from(syncDevices)
      .where(eq(syncDevices.id, input.deviceId))
      .limit(1);
    if (!device) throw new DeviceAdminError("not_found", "Uređaj ne postoji.");
    if (device.status === "revoked") {
      throw new DeviceAdminError(
        "revoked",
        "Opozvan uređaj se ne aktivira ponovo; registruje se nov.",
      );
    }

    const [key] = await tx
      .select()
      .from(syncDeviceKeys)
      .where(
        and(eq(syncDeviceKeys.deviceId, input.deviceId), eq(syncDeviceKeys.keyId, input.keyId)),
      )
      .limit(1);
    if (!key) throw new DeviceAdminError("key_not_found", "Ključ ne postoji za taj uređaj.");
    if (key.status === "revoked") {
      throw new DeviceAdminError("key_revoked", "Opozvan ključ se ne aktivira ponovo.");
    }

    /*
     * Otisak se POTVRĐUJE, ne prihvata.
     *
     * Čovek koji aktivira mora da uporedi otisak sa onim koji uređaj pokazuje.
     * Bez te potvrde bi aktivacija bila puko klikanje na ono što je već u
     * bazi — a upravo bi ubačen tuđi ključ tako i prošao.
     */
    if (key.fingerprint !== input.expectedFingerprint) {
      throw new DeviceAdminError(
        "fingerprint_mismatch",
        "Otisak ključa se ne poklapa sa potvrđenim.",
      );
    }

    const now = new Date();
    await tx
      .update(syncDevices)
      .set({ status: "active", activatedBy: actor.id, activatedAt: now, updatedAt: now })
      .where(eq(syncDevices.id, input.deviceId));
    await tx
      .update(syncDeviceKeys)
      .set({ status: "active", activatedBy: actor.id, activatedAt: now })
      .where(eq(syncDeviceKeys.id, key.id));

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.deviceActivated,
        entityType: "Uređaj za prijem",
        entityId: input.deviceId,
        entityLabel: deviceRef(device.deviceCode),
        after: { kljuc: input.keyId, otisak: key.fingerprint },
        reason: "Uređaj i ključ aktivirani posle potvrde otiska.",
      },
      tx,
    );
  });
}

/**
 * Opoziva uređaj i SVE njegove ključeve.
 *
 * Istorija se ne briše: redovi ostaju, samo menjaju stanje, a trag pamti ko je
 * i zašto opozvao. Opoziv ključa bez opoziva uređaja je zasebna radnja
 * (`revokeDeviceKey`) — kompromitovan ključ ne mora da znači kompromitovan
 * uređaj.
 */
export async function revokeDevice(
  input: { deviceId: string; reason: string },
  actor: DeviceActor,
): Promise<void> {
  const razlog = input.reason.trim();
  if (razlog.length < 3) {
    throw new DeviceAdminError("missing_reason", "Opoziv traži razlog (najmanje 3 znaka).");
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const [device] = await tx
      .select()
      .from(syncDevices)
      .where(eq(syncDevices.id, input.deviceId))
      .limit(1);
    if (!device) throw new DeviceAdminError("not_found", "Uređaj ne postoji.");
    if (device.status === "revoked") return; // Ponovljen opoziv je no-op.

    const now = new Date();
    await tx
      .update(syncDevices)
      .set({
        status: "revoked",
        revokedBy: actor.id,
        revokedAt: now,
        revokedReason: razlog,
        updatedAt: now,
      })
      .where(eq(syncDevices.id, input.deviceId));

    /*
     * Svi ključevi padaju zajedno sa uređajem.
     *
     * Bez toga bi ključ ostao „aktivan“ i sledeći put kada bi neko vratio
     * uređaj u pogon, stari materijal bi odmah važio.
     */
    await tx
      .update(syncDeviceKeys)
      .set({ status: "revoked", revokedBy: actor.id, revokedAt: now, revokedReason: razlog })
      .where(eq(syncDeviceKeys.deviceId, input.deviceId));

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.deviceRevoked,
        entityType: "Uređaj za prijem",
        entityId: input.deviceId,
        entityLabel: deviceRef(device.deviceCode),
        before: { status: device.status },
        after: { status: "revoked" },
        reason: razlog,
      },
      tx,
    );
  });
}

/** Opoziva jedan ključ; uređaj ostaje u svom stanju. */
export async function revokeDeviceKey(
  input: { deviceId: string; keyId: string; reason: string },
  actor: DeviceActor,
): Promise<void> {
  const razlog = input.reason.trim();
  if (razlog.length < 3) {
    throw new DeviceAdminError("missing_reason", "Opoziv traži razlog (najmanje 3 znaka).");
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const [key] = await tx
      .select()
      .from(syncDeviceKeys)
      .where(
        and(eq(syncDeviceKeys.deviceId, input.deviceId), eq(syncDeviceKeys.keyId, input.keyId)),
      )
      .limit(1);
    if (!key) throw new DeviceAdminError("key_not_found", "Ključ ne postoji za taj uređaj.");
    if (key.status === "revoked") return;

    await tx
      .update(syncDeviceKeys)
      .set({
        status: "revoked",
        revokedBy: actor.id,
        revokedAt: new Date(),
        revokedReason: razlog,
      })
      .where(eq(syncDeviceKeys.id, key.id));

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.deviceKeyRevoked,
        entityType: "Ključ uređaja",
        entityId: key.id,
        entityLabel: `key:${input.keyId}`,
        after: { otisak: key.fingerprint },
        reason: razlog,
      },
      tx,
    );
  });
}
