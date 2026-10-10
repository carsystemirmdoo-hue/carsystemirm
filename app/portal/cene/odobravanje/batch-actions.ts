"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { decidePendingBatch } from "@/lib/pricing/rebate-coverage-service";

/** Odluka gazde za ceo paket predloga (jedna serija). Svako pravilo ide kroz postojeći prelaz. */
export async function decideBatchAction(batchId: string, to: "approved_pending_biznisoft" | "rejected", reason: string | null) {
  const user = await requireCapability("prices:approve", "/portal/cene/odobravanje");
  if (!/^[a-z0-9-]{6,80}$/i.test(batchId) || !["approved_pending_biznisoft", "rejected"].includes(to)) return { ok: false, message: "Neispravan zahtev." };
  try {
    const r = await decidePendingBatch(user, { batchId, to, reason: reason?.trim().slice(0, 500) || null });
    revalidatePath("/portal/cene/odobravanje");
    revalidatePath("/portal/cene/istorija");
    return { ok: true, message: `${to === "rejected" ? "Odbijeno" : "Odobreno"}: ${r.count} pravila.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Odluka nije sačuvana." };
  }
}
