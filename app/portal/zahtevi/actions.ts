"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { officeTransition, recordBiznisoftEntry, type TransitionResult } from "@/lib/ordering/ordering-service";

/*
 * Kancelarija nad zahtevima kupaca. Svaka akcija u svom telu traži sposobnost;
 * opseg (koje firme) servis razrešava iz korisnika, ne iz ulaza.
 */

export async function takeIntoReviewAction(orderId: string): Promise<TransitionResult> {
  const user = await requireCapability("customer_orders:review", "/portal/zahtevi");
  const r = await officeTransition(user, orderId, "under_review", null);
  revalidatePath(`/portal/zahtevi/${orderId}`);
  return r;
}

export async function requestChangesAction(orderId: string, reason: string): Promise<TransitionResult> {
  const user = await requireCapability("customer_orders:review", "/portal/zahtevi");
  const r = await officeTransition(user, orderId, "changes_requested", reason);
  revalidatePath(`/portal/zahtevi/${orderId}`);
  return r;
}

export async function rejectOrderAction(orderId: string, reason: string): Promise<TransitionResult> {
  const user = await requireCapability("customer_orders:review", "/portal/zahtevi");
  const r = await officeTransition(user, orderId, "rejected", reason);
  revalidatePath(`/portal/zahtevi/${orderId}`);
  return r;
}

export async function confirmOrderAction(orderId: string): Promise<TransitionResult> {
  const user = await requireCapability("customer_orders:confirm", "/portal/zahtevi");
  const r = await officeTransition(user, orderId, "confirmed", null);
  revalidatePath(`/portal/zahtevi/${orderId}`);
  return r;
}

export async function recordBiznisoftAction(orderId: string, documentNumber: string): Promise<TransitionResult> {
  const user = await requireCapability("customer_orders:confirm", "/portal/zahtevi");
  const r = await recordBiznisoftEntry(user, orderId, documentNumber);
  revalidatePath(`/portal/zahtevi/${orderId}`);
  return r;
}
