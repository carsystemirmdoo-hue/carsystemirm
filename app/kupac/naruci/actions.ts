"use server";

import { revalidatePath } from "next/cache";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { addCatalogItem, addRequestItem, type RequestCartChange } from "@/lib/ordering/request-service";

/** Dodavanje u zahtev: firma iz sesije; ulaz je samo artikal i BROJ pakovanja (količina i cena se računaju na serveru). */
export async function addRequestItemAction(input: { articleId: string; packs: string }): Promise<RequestCartChange> {
  const session = await requireCustomerSession("/kupac/naruci");
  const r = await addRequestItem(session, input);
  revalidatePath("/kupac/korpa");
  return r;
}

/**
 * Dodavanje iz javnog kataloga u ISTU serversku korpu firme (dok. 61 K4).
 * Artikal mora imati potvrđenu vezu sa katalogom; cena se računa na serveru.
 */
export async function addCatalogItemAction(input: { articleId: string; packs: string }): Promise<RequestCartChange> {
  const session = await requireCustomerSession("/katalog");
  const r = await addCatalogItem(session, input);
  revalidatePath("/kupac/korpa");
  return r;
}
