"use server";

import { revalidatePath } from "next/cache";
import { requireCapability, requireCustomerAccess } from "@/lib/authz/session";
import { recordManualStockRequest, StockRequestError } from "@/lib/stock/stock-requests";

export type TrazenoResult = { ok: true; text: string } | { ok: false; text: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * „Traženo — nema na stanju“ sa Lager liste (2026-11-16): artikal iz reda, količina OBAVEZNA,
 * kupac i napomena opcioni. Kupac mora biti u opsegu korisnika (komercijalista: svoji).
 */
export async function recordTrazenoAction(input: { articleId: string; quantity: string; customerId?: string | null; note?: string | null }): Promise<TrazenoResult> {
  const user = await requireCapability("view:lager_lista", "/portal/lager-lista");
  if (!UUID.test(input.articleId)) return { ok: false, text: "Neispravan artikal." };
  const raw = String(input.quantity ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const quantity = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, text: "Upišite količinu (broj veći od nule)." };
  const customerId = input.customerId?.trim() || null;
  if (customerId) {
    if (!UUID.test(customerId)) return { ok: false, text: "Neispravan kupac." };
    await requireCustomerAccess(user, customerId);
  }
  try {
    await recordManualStockRequest(user, { articleId: input.articleId, customerId, quantity, note: input.note ?? null });
  } catch (e) {
    if (e instanceof StockRequestError) return { ok: false, text: e.message };
    throw e;
  }
  revalidatePath("/portal/lager-lista");
  revalidatePath("/portal/zalihe");
  revalidatePath("/portal/nabavka");
  if (customerId) revalidatePath(`/portal/kupci/${customerId}`);
  return { ok: true, text: "Zabeleženo kao traženo." };
}
