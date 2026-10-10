"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { decidePaymentOption, PaymentOptionError, proposePaymentOption } from "@/lib/pricing/payment-option-service";

const path = (id: string) => `/portal/cene/rabati-iz-faktura/kupci/${id}`;
const msg = (e: unknown) => (e instanceof PaymentOptionError ? e.message : null);

export async function proposeOptionAction(customerId: string, optionCode: string, effectiveFrom: string, reason: string) {
  const user = await requireCapability("prices:propose", path(customerId));
  try {
    await proposePaymentOption(user, { customerId, optionCode, effectiveFrom, reason });
    revalidatePath(path(customerId));
    return { ok: true, message: "Predlog opcije je poslat vlasniku na odobrenje. Kupac je ne vidi dok nije odobrena." };
  } catch (e) {
    const m = msg(e);
    if (m) return { ok: false, message: m };
    throw e;
  }
}

export async function decideOptionAction(customerId: string, id: string, to: "odobreno" | "odbijeno" | "opozvano", reason: string | null) {
  const user = await requireCapability("prices:approve", path(customerId));
  try {
    await decidePaymentOption(user, { id, to, reason });
    revalidatePath(path(customerId));
    return { ok: true, message: to === "odobreno" ? "Opcija je odobrena." : to === "odbijeno" ? "Predlog je odbijen." : "Opcija je opozvana (istorija ostaje)." };
  } catch (e) {
    const m = msg(e);
    if (m) return { ok: false, message: m };
    throw e;
  }
}
