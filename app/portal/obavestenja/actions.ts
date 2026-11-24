"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import {
  markNotificationRead,
  NotificationError,
  resolveNotification,
} from "@/lib/notifications/notification-service";

export type NotificationActionState = { error: string | null; ok: string | null };

const idSchema = z.coerce.number().int().positive();

export async function markReadAction(
  _previous: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const user = await requireCapability("view:obavestenja", "/portal/obavestenja");
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return { error: "Obaveštenje nije prepoznato.", ok: null };

  /*
   * Servis ponovo proverava sposobnost, u samom `UPDATE`-u.
   *
   * Kapija iznad štiti rutu; ona ne zna koje je obaveštenje u pitanju. Bez
   * provere u upitu bi se tuđe obaveštenje moglo zatvoriti pogađanjem ID-a.
   */
  const done = await markNotificationRead(user, parsed.data);
  revalidatePath("/portal/obavestenja");
  return done
    ? { error: null, ok: "Označeno kao pročitano." }
    : { error: "Obaveštenje nije dostupno ili je već pročitano.", ok: null };
}

export async function resolveNotificationAction(
  _previous: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const user = await requireCapability("notifications:review", "/portal/obavestenja");
  const parsed = idSchema.safeParse(formData.get("id"));
  const note = String(formData.get("note") ?? "");
  if (!parsed.success) return { error: "Obaveštenje nije prepoznato.", ok: null };

  try {
    const done = await resolveNotification(user, parsed.data, note);
    revalidatePath("/portal/obavestenja");
    return done
      ? { error: null, ok: "Obaveštenje je zatvoreno." }
      : { error: "Obaveštenje nije dostupno.", ok: null };
  } catch (error) {
    if (error instanceof NotificationError) return { error: error.message, ok: null };
    throw error;
  }
}

/**
 * Grupna radnja (2026-11-24): označi pročitanim ili zatvori više obaveštenja odjednom.
 * Servis za SVAKO obaveštenje ponovo proverava sposobnost (isto kao pojedinačno).
 */
export async function bulkNotificationAction(input: { ids: number[]; mode: "read" | "resolve"; note: string }): Promise<NotificationActionState> {
  const ids = [...new Set(input.ids)].filter((id) => Number.isInteger(id) && id > 0).slice(0, 500);
  if (!ids.length) return { error: "Izaberite bar jedno obaveštenje.", ok: null };
  if (input.mode === "read") {
    const user = await requireCapability("view:obavestenja", "/portal/obavestenja");
    let n = 0;
    for (const id of ids) if (await markNotificationRead(user, id)) n += 1;
    revalidatePath("/portal/obavestenja");
    return { error: null, ok: `Označeno kao pročitano: ${n}.` };
  }
  const user = await requireCapability("notifications:review", "/portal/obavestenja");
  const note = input.note.trim();
  if (note.length < 3) return { error: "Upišite kratku napomenu o zatvaranju (bar 3 znaka).", ok: null };
  let n = 0;
  try {
    for (const id of ids) if (await resolveNotification(user, id, note)) n += 1;
  } catch (error) {
    if (error instanceof NotificationError) return { error: error.message, ok: n ? `Zatvoreno pre greške: ${n}.` : null };
    throw error;
  }
  revalidatePath("/portal/obavestenja");
  return { error: null, ok: `Zatvoreno: ${n}.` };
}
