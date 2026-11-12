"use server";

import { requireCapability } from "@/lib/authz/session";
import { sendOrderEmail, type OrderEmailResult } from "@/lib/ordering/order-email";
import { loadOrderRequest } from "@/lib/ordering/ordering-service";

/** Ručno slanje mejla o porudžbini (proba sa kancelarijom ili ponovno slanje). Samo u opsegu zaposlenog. */
export async function sendOrderEmailAction(orderId: string): Promise<OrderEmailResult> {
  const id = String(orderId ?? "");
  const user = await requireCapability("view:zahtevi", `/portal/zahtevi/${encodeURIComponent(id)}/mail`);
  const o = await loadOrderRequest(user, id);
  if (!o) return { ok: false, sent: 0, text: "Zahtev ne postoji." };
  return sendOrderEmail(o.id, { actor: { id: user.id, name: user.name, role: user.role }, reason: "rucno" });
}
