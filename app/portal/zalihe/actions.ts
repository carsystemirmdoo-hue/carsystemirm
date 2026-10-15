"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import { getDb } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireRecentMfaOrReauth } from "@/lib/authz/session";
import { STOCK_DISPLAY_SETTING } from "@/lib/stock/displayPolicy.mjs";

/*
 * Prikaz lagera prijavljenim kupcima (dok. 65 §4): uključivanje sa pragom 24 h od vremena
 * stanja i isključivanje jednim klikom. Samo `settings:manage` (vlasnik), svež drugi faktor
 * istog korisnika; promena i prethodna vrednost idu u audit u istoj transakciji.
 */
const PATH = "/portal/zalihe";
const MAX_AGE_HOURS = 24;

export type StockDisplayState = { error: string | null; ok: string | null };

export async function setStockDisplayAction(_prev: StockDisplayState, formData: FormData): Promise<StockDisplayState> {
  const actor = await requireCapability("settings:manage", PATH);
  const fresh = await requireRecentMfaOrReauth(PATH);
  if (fresh.id !== actor.id || !can(fresh, "settings:manage") || !can(fresh, "view:zalihe")) forbidden();
  const enable = formData.get("prikaz") === "ukljuci";
  const reason = String(formData.get("razlog") ?? "").trim();
  if (reason.length < 3) return { error: "Upišite kratak razlog izmene.", ok: null };
  const value = enable ? { enabled: true, maxAgeHours: MAX_AGE_HOURS } : { enabled: false, maxAgeHours: MAX_AGE_HOURS };
  const db = getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, STOCK_DISPLAY_SETTING)).for("update");
    await tx
      .insert(systemSettings)
      .values({ key: STOCK_DISPLAY_SETTING, value, updatedBy: fresh.id })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedBy: fresh.id, updatedAt: sql`now()` } });
    await recordAudit(
      {
        actor: { id: fresh.id, name: fresh.name, role: fresh.role },
        action: AUDIT_ACTIONS.stockDisplayChanged,
        entityType: "Sistemski prag",
        entityId: STOCK_DISPLAY_SETTING,
        entityLabel: "Prikaz lagera prijavljenim kupcima",
        before: before?.value ?? null,
        after: value,
        reason,
        correlationId: randomUUID(),
      },
      tx,
    );
  });
  revalidatePath(PATH);
  return { error: null, ok: enable ? "Prikaz je uključen za sve prijavljene kupce (prag 24 h od vremena stanja)." : "Prikaz je isključen. Kupci više ne vide stanje." };
}
