"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { proposeFromEvidence } from "@/lib/pricing/rebate-application-service";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

/** Predlog jednog para kupac–artikal; dokaz i procenat se ponovo računaju na serveru. Ide na odobrenje vlasnika. */
export async function proposeArticleRebateAction(customerId: string, articleId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireCapability("prices:propose", "/portal/cene/rabati-iz-faktura/predlozi");
  if (!/^[0-9a-f-]{36}$/.test(customerId) || !/^[0-9a-f-]{36}$/.test(articleId)) return { ok: false, message: "Neispravan zahtev." };
  try {
    const r = await proposeFromEvidence(user, customerId, articleId, belgradeDate(new Date()));
    revalidatePath("/portal/cene/rabati-iz-faktura/predlozi");
    return r.ok ? { ok: true, message: "Predlog je poslat na odobrenje (Odobravanje cena)." } : { ok: false, message: r.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Predlog nije sačuvan." };
  }
}
