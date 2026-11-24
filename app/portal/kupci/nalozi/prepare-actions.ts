"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { prepareAllCustomerAccounts } from "@/lib/customers/account-service";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";

/** Priprema naloga za sve kupce sa e-poštom (bez slanja mejla); samo ko vidi sve kupce. */
export async function prepareAllAccountsAction(): Promise<{ ok: boolean; message: string; skipped: { customer: string; reason: string }[] }> {
  const actor = await requireCapability("customer_accounts:manage", "/portal/kupci/nalozi");
  if (!seesAllCustomers(actor)) return { ok: false, message: "Naloge za sve kupce priprema vlasnik ili kancelarija.", skipped: [] };
  const r = await prepareAllCustomerAccounts({ id: actor.id, name: actor.name, role: actor.role });
  revalidatePath("/portal/kupci/nalozi");
  return {
    ok: true,
    message: `Pripremljeno naloga: ${r.created}. Nijedan mejl nije poslat. Kupaca i dalje bez naloga: ${r.withoutAccount}${r.skipped.length ? ` (preskočeno ${r.skipped.length})` : ""}.`,
    skipped: r.skipped,
  };
}
