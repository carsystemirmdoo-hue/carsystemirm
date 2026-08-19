"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { requireCapability } from "@/lib/authz/session";

export type SettingsState = { error: string | null; ok: string | null };

const THRESHOLD_KEY = "pragovi.limit";

const thresholdSchema = z
  .object({
    t70: z.coerce.number().int().min(1).max(200),
    t90: z.coerce.number().int().min(1).max(200),
    t100: z.coerce.number().int().min(1).max(200),
    tDelay: z.coerce.number().int().min(1).max(365),
    reason: z.string().trim().min(3).max(500),
  })
  .refine((value) => value.t70 < value.t90 && value.t90 < value.t100, {
    message: "Pragovi moraju rasti: prvi < drugi < treći.",
  });

export async function saveThresholdsAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await requireCapability("settings:manage", "/portal/admin");

  const parsed = thresholdSchema.safeParse({
    t70: formData.get("t70"),
    t90: formData.get("t90"),
    t100: formData.get("t100"),
    tDelay: formData.get("tDelay"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Vrednosti nisu ispravne. Razlog izmene je obavezan.",
      ok: null,
    };
  }

  const { reason, ...thresholds } = parsed.data;
  const db = getDb();

  const current = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, THRESHOLD_KEY))
    .limit(1);

  await db.transaction(async (tx) => {
    await tx
      .insert(systemSettings)
      .values({ key: THRESHOLD_KEY, value: thresholds, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: thresholds,
          updatedBy: actor.id,
          updatedAt: sql`now()`,
        },
      });

    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.settingChanged,
        entityType: "Sistemski prag",
        entityId: THRESHOLD_KEY,
        entityLabel: "Pragovi upozorenja za limit",
        before: current[0]?.value ?? null,
        after: thresholds,
        reason,
        correlationId: randomUUID(),
      },
      tx,
    );
  });

  revalidatePath("/portal/admin");
  return { error: null, ok: "Pragovi su sačuvani i izmena je evidentirana." };
}
