"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { setCommercialStatus, type CommercialStatus } from "@/lib/customers/commercial-status-service";

/** Poseban poslovni status kupca — samo vlasnik; provera i u servisu. */
export async function setCommercialStatusAction(customerId: string, status: CommercialStatus, reason: string) {
  const user = await requireCapability("prices:approve", `/portal/cene/rabati-iz-faktura/kupci/${customerId}`);
  if (!/^[0-9a-f-]{36}$/.test(customerId)) return { ok: false, message: "Neispravan kupac." };
  try {
    const r = await setCommercialStatus(user, { customerId, status, reason: String(reason ?? "") });
    revalidatePath(`/portal/cene/rabati-iz-faktura/kupci/${customerId}`);
    revalidatePath("/portal/cene/rabati-iz-faktura/predlozi");
    return { ok: true, message: r.changed ? "Status je sačuvan (istorija i ranija pravila ostaju)." : "Status je već takav — nije bilo promene." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Status nije sačuvan." };
  }
}
