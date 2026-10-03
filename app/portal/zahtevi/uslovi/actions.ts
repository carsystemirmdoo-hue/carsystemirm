"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { changePriceRequest, type PriceRequestChange } from "@/lib/ordering/price-request-service";

/* Obrada zahteva za cenu/uslove. Opseg (koji kupci) servis uzima iz korisnika. */

export async function takePriceRequestAction(id: string): Promise<PriceRequestChange> {
  const user = await requireCapability("price_requests:handle", "/portal/zahtevi/uslovi");
  const r = await changePriceRequest(user, id, "in_progress");
  revalidatePath("/portal/zahtevi/uslovi");
  return r;
}

export async function answerPriceRequestAction(id: string, answer: string): Promise<PriceRequestChange> {
  const user = await requireCapability("price_requests:handle", "/portal/zahtevi/uslovi");
  const r = await changePriceRequest(user, id, "answered", answer);
  revalidatePath("/portal/zahtevi/uslovi");
  return r;
}

export async function closePriceRequestAction(id: string): Promise<PriceRequestChange> {
  const user = await requireCapability("price_requests:handle", "/portal/zahtevi/uslovi");
  const r = await changePriceRequest(user, id, "closed");
  revalidatePath("/portal/zahtevi/uslovi");
  return r;
}
