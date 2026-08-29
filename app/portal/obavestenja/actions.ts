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
