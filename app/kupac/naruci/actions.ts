"use server";

import { revalidatePath } from "next/cache";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { addRequestItem, type RequestCartChange } from "@/lib/ordering/request-service";

/** Dodavanje u zahtev: firma iz sesije; ulaz je samo artikal i količina (cena se računa na serveru). */
export async function addRequestItemAction(input: { articleId: string; quantity: string }): Promise<RequestCartChange> {
  const session = await requireCustomerSession("/kupac/naruci");
  const r = await addRequestItem(session, input);
  revalidatePath("/kupac/korpa");
  return r;
}
