"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import { resolveClientIp } from "@/lib/auth/rate-limit-policy.mjs";
import { registerAttempt } from "@/lib/auth/rate-limit-service";
import { headers } from "next/headers";
import {
  activateDevice,
  DeviceAdminError,
  registerDevice,
  revokeDevice,
} from "@/lib/sync/device/registry";
import { CommandError, zakaziKomandu } from "@/lib/sync/commands/service";
import { isSyncOperationsEnabled } from "@/lib/sync/http/gate";
import { isEd25519SpkiBase64 } from "@/lib/sync/device/signing.mjs";

/**
 * Server akcije operativnog sync ekrana.
 *
 * SVAKA akcija sama proverava sposobnost. Sakriveno dugme nije autorizacija —
 * akcija se može pozvati i bez ekrana, pa provera mora biti ovde.
 *
 * Nijedna ne prima tenant, opseg ni putanju iz forme: uređaj se traži po ID-u, a
 * njegov opseg se čita iz baze. Skriveni input ne bira firmu.
 */

export type SyncActionState = { error: string | null; ok: string | null };

const PUTANJA = "/portal/importi/sinhronizacija";

const uuidSchema = z.object({ deviceId: z.string().uuid() });

/** Rate limit i za portal akcije — dugme se može kliktati u petlji. */
async function ograniciAkciju(scope: "sync_unknown", kljuc: string) {
  const zaglavlja = await headers();
  const ip = resolveClientIp({ headers: zaglavlja, trustedProxy: true, socketAddress: null });
  return registerAttempt({ scope, accountIdentifier: kljuc, clientIp: ip });
}

/* =========================================================================
 * Ručna komanda
 * ====================================================================== */

/**
 * „Skeniraj i sinhronizuj“.
 *
 * Zakazuje jedinu postojeću komandu. Ne prosleđuje nijedan parametar: folder,
 * server, raspored i identitet ostaju u lokalnoj zaštićenoj konfiguraciji
 * konektora.
 *
 * Dvostruki klik NE pravi dve komande — postojeća otvorena se ponovo koristi, a
 * u bazi to čuva delimičan jedinstveni indeks.
 */
export async function triggerSyncAction(
  _previous: SyncActionState,
  formData: FormData,
): Promise<SyncActionState> {
  const actor = await requireCapability("sync:trigger", PUTANJA);

  /*
   * Gate se proverava i OVDE, ne samo u prikazu.
   *
   * Kada su komande isključene, akcija ne sme da zakaže posao koji niko neće
   * preuzeti — to bi na ekranu izgledalo kao da uređaj ne radi.
   */
  if (!isSyncOperationsEnabled()) {
    return { error: "Operativne komande su isključene na serveru.", ok: null };
  }

  const parsed = uuidSchema.safeParse({ deviceId: formData.get("deviceId") });
  if (!parsed.success) return { error: "Neispravan uređaj.", ok: null };

  const limit = await ograniciAkciju("sync_unknown", `cmd:${actor.id}`);
  if (!limit.allowed) {
    return { error: "Previše zahteva. Pokušajte kasnije.", ok: null };
  }

  try {
    const { vecPostoji } = await zakaziKomandu(
      { deviceId: parsed.data.deviceId },
      { id: actor.id, name: actor.name, role: actor.role },
    );
    revalidatePath(PUTANJA);
    return {
      error: null,
      ok: vecPostoji
        ? "Komanda već čeka uređaj; nova nije napravljena."
        : "Komanda je sačuvana. Uređaj je preuzima pri sledećem javljanju.",
    };
  } catch (error) {
    if (error instanceof CommandError) return { error: porukaZa(error.code), ok: null };
    throw error;
  }
}

/* =========================================================================
 * Uređaji — samo gazda
 * ====================================================================== */

/**
 * Format javnog ključa iz `connector init` / `export-key`.
 *
 * Ed25519 SPKI DER je tačno 44 bajta → 60 znakova base64. Uža provera od
 * „bilo kakav base64“: pogrešno nalepljen sadržaj pada ovde, a ne u bazi.
 */
const registracijaSchema = z.object({
  deviceCode: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  label: z.string().trim().min(1).max(120),
  sourceSystem: z.string().trim().min(1).max(64),
  issuerCode: z.string().trim().min(1).max(64),
  keyId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  // Isti oblik koji `connector init` ispisuje (Ed25519 SPKI, base64).
  publicKeySpki: z.string().trim().refine(isEd25519SpkiBase64),
});

/**
 * Registruje uređaj i njegov PRVI javni ključ.
 *
 * Prima ISKLJUČIVO javni deo. Privatni ključ nikada ne ulazi u portal, ne šalje
 * se serveru i nema polje u koje bi stao — nastaje i ostaje na uređaju.
 *
 * Otisak računa SERVER (`registerDevice` → `keyFingerprint`); iz forme se ne
 * prima, jer bi se time potvrđivalo nešto što niko nije proverio.
 */
export async function registerDeviceAction(
  _previous: SyncActionState,
  formData: FormData,
): Promise<SyncActionState> {
  const actor = await requireCapability("devices:manage", PUTANJA);

  const parsed = registracijaSchema.safeParse({
    deviceCode: formData.get("deviceCode"),
    label: formData.get("label"),
    sourceSystem: formData.get("sourceSystem"),
    issuerCode: formData.get("issuerCode"),
    keyId: formData.get("keyId"),
    publicKeySpki: formData.get("publicKeySpki"),
  });
  if (!parsed.success) {
    const kljuc = parsed.error.issues.some((i) => i.path[0] === "publicKeySpki");
    return {
      error: kljuc
        ? "Javni ključ nije u obliku koji ispisuje connector init (Ed25519, SPKI base64, počinje sa MCow…)."
        : "Proverite unos: oznake uređaja i ključa smeju sadržati slova, brojeve, tačku, crtu i donju crtu.",
      ok: null,
    };
  }

  try {
    const out = await registerDevice(parsed.data, {
      id: actor.id,
      name: actor.name,
      role: actor.role,
    });
    revalidatePath(PUTANJA);
    return {
      error: null,
      // Otisak se prikazuje da bi ga čovek uporedio sa onim koji uređaj ispisuje.
      ok: `Uređaj je registrovan i čeka aktivaciju. Otisak ključa: ${out.fingerprint}`,
    };
  } catch (error) {
    if (error instanceof DeviceAdminError) return { error: porukaZa(error.code), ok: null };
    /*
     * Sirova greška baze se NE prikazuje.
     *
     * Naziv ograničenja odaje šemu, a poruka drajvera ume da nosi deo upita.
     */
    return { error: "Uređaj sa tom oznakom ili ključem već postoji.", ok: null };
  }
}

const aktivacijaSchema = z.object({
  deviceId: z.string().uuid(),
  keyId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  expectedFingerprint: z.string().trim().regex(/^sha256:[0-9a-f]{64}$/),
});

/**
 * Aktivira uređaj tek pošto čovek POTVRDI otisak.
 *
 * Bez potvrde bi aktivacija bila puko klikanje na ono što je već u bazi — a
 * upravo bi ubačen tuđi ključ tako i prošao.
 */
export async function activateDeviceAction(
  _previous: SyncActionState,
  formData: FormData,
): Promise<SyncActionState> {
  const actor = await requireCapability("devices:manage", PUTANJA);

  const parsed = aktivacijaSchema.safeParse({
    deviceId: formData.get("deviceId"),
    keyId: formData.get("keyId"),
    expectedFingerprint: formData.get("expectedFingerprint"),
  });
  if (!parsed.success) return { error: "Unesite tačan otisak ključa.", ok: null };

  try {
    await activateDevice(parsed.data, { id: actor.id, name: actor.name, role: actor.role });
    revalidatePath(PUTANJA);
    return { error: null, ok: "Uređaj je aktiviran." };
  } catch (error) {
    if (error instanceof DeviceAdminError) return { error: porukaZa(error.code), ok: null };
    throw error;
  }
}

const opozivSchema = z.object({
  deviceId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

/** Opoziva uređaj i sve njegove ključeve. Istorija ostaje. */
export async function revokeDeviceAction(
  _previous: SyncActionState,
  formData: FormData,
): Promise<SyncActionState> {
  const actor = await requireCapability("devices:manage", PUTANJA);

  const parsed = opozivSchema.safeParse({
    deviceId: formData.get("deviceId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: "Opoziv traži razlog (najmanje 3 znaka).", ok: null };

  try {
    await revokeDevice(parsed.data, { id: actor.id, name: actor.name, role: actor.role });
    revalidatePath(PUTANJA);
    return { error: null, ok: "Uređaj je opozvan. Istorija je sačuvana." };
  } catch (error) {
    if (error instanceof DeviceAdminError) return { error: porukaZa(error.code), ok: null };
    throw error;
  }
}

/** Stabilan kod → poruka za ekran. Bez SQL-a, putanja i internih detalja. */
function porukaZa(kod: string): string {
  switch (kod) {
    case "device_not_found":
      return "Uređaj ne postoji.";
    case "device_not_active":
      return "Uređaj nije aktivan.";
    case "revoked":
      return "Opozvan uređaj se ne aktivira ponovo; registruje se nov.";
    case "key_not_found":
      return "Ključ ne postoji za taj uređaj.";
    case "key_revoked":
      return "Opozvan ključ se ne aktivira ponovo.";
    case "fingerprint_mismatch":
      return "Otisak se ne poklapa sa ključem koji je uređaj poslao.";
    case "missing_reason":
      return "Potreban je razlog.";
    default:
      return "Radnja nije izvršena.";
  }
}
