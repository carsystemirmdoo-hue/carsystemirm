"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { proposeRebateFromEvidence } from "@/lib/pricing/rebate-evidence-service";

/** Dosledan rabat iz faktura → predlog pravila u postojećem toku odobravanja. */
export async function proposeRebateAction(customerId: string, productGroup: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireCapability("prices:propose", "/portal/cene/rabati-iz-faktura");
  try {
    const r = await proposeRebateFromEvidence(user, customerId, productGroup);
    revalidatePath("/portal/cene/rabati-iz-faktura");
    return r.ok
      ? { ok: true, message: "Predlog je poslat na odobrenje (Odobravanje cena). Ne ulazi u cenovnik ni u korpu." }
      : { ok: false, message: r.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Predlog nije sačuvan." };
  }
}
