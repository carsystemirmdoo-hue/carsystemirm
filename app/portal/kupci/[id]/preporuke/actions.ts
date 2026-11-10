"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { CustomerOfferError, dismissArticle, restoreArticle } from "@/lib/recommendations/customer-offer-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidate(customerId: string) {
  revalidatePath(`/portal/kupci/${customerId}/preporuke`);
  revalidatePath(`/portal/kupci/${customerId}`);
  revalidatePath("/portal/preporuke");
  revalidatePath("/portal/za-razgovor");
}

export async function dismissArticleAction(input: { customerId: string; articleCode: string; reason: string; replacementCode?: string; note?: string }) {
  const customerId = String(input.customerId);
  if (!UUID.test(customerId)) return { ok: false as const, error: "Neispravan kupac." };
  const user = await requireCapability("view:preporuke", `/portal/kupci/${customerId}/preporuke`);
  try {
    await dismissArticle(user, {
      customerId,
      articleCode: String(input.articleCode ?? "").slice(0, 100),
      reason: String(input.reason ?? ""),
      replacementCode: String(input.replacementCode ?? "").slice(0, 100),
      note: String(input.note ?? "").slice(0, 600),
    });
  } catch (error) {
    if (error instanceof CustomerOfferError) return { ok: false as const, error: error.message };
    throw error;
  }
  revalidate(customerId);
  return { ok: true as const };
}

export async function restoreArticleAction(input: { customerId: string; dismissalId: string }) {
  const customerId = String(input.customerId);
  const dismissalId = String(input.dismissalId);
  if (!UUID.test(customerId) || !UUID.test(dismissalId)) return { ok: false as const, error: "Neispravan zahtev." };
  const user = await requireCapability("view:preporuke", `/portal/kupci/${customerId}/preporuke`);
  try {
    await restoreArticle(user, { customerId, dismissalId });
  } catch (error) {
    if (error instanceof CustomerOfferError) return { ok: false as const, error: error.message };
    throw error;
  }
  revalidate(customerId);
  return { ok: true as const };
}
