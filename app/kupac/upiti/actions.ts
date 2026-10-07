"use server";

import { revalidatePath } from "next/cache";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { createPriceRequest, type PriceRequestResult } from "@/lib/ordering/price-request-service";

/*
 * Kupac traži cenu ili posebne uslove. Firma iz sesije; ulaz je samo proizvod,
 * varijanta, količina, napomena, vrsta i ključ slanja.
 */
export async function requestPriceAction(input: {
  slug: string;
  variantKey: string | null;
  articleCode: string | null;
  quantity: string;
  note: string;
  kind: "no_price" | "special_terms";
  idempotencyKey: string;
}): Promise<PriceRequestResult> {
  const session = await requireCustomerSession("/katalog");
  const result = await createPriceRequest(session, input);
  revalidatePath("/kupac/upiti");
  return result;
}
