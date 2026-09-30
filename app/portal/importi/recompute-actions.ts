"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { processRecomputeQueue, retryRecomputeRequest } from "@/lib/recommendations/auto-recompute";

/** Ponavlja neuspeli automatski obračun posle uvoza i odmah ga obrađuje. */
export async function retryAutoRecomputeAction(requestId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireCapability("recommendations:retry_auto", "/portal/importi");
  const r = await retryRecomputeRequest(requestId, user);
  if (r.ok) await processRecomputeQueue();
  revalidatePath("/portal/importi");
  revalidatePath("/portal/za-razgovor");
  return r;
}
