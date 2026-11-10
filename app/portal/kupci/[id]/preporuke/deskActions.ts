"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { addCallNote, completeFollowUp, CustomerDeskError, saveCustomerContact } from "@/lib/sales-tools/customer-desk-service";
import { previewRepOrder, RepOrderError, submitRepOrder } from "@/lib/ordering/request-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidate(customerId: string) {
  revalidatePath(`/portal/kupci/${customerId}/preporuke`);
  revalidatePath(`/portal/kupci/${customerId}`);
  revalidatePath("/portal/preporuke");
  revalidatePath("/portal");
}

type Result = { ok: true } | { ok: false; error: string };

async function run(customerId: string, fn: (user: Awaited<ReturnType<typeof requireCapability>>) => Promise<void>): Promise<Result> {
  if (!UUID.test(customerId)) return { ok: false, error: "Neispravan kupac." };
  const user = await requireCapability("view:preporuke", `/portal/kupci/${customerId}/preporuke`);
  try {
    await fn(user);
  } catch (error) {
    if (error instanceof CustomerDeskError) return { ok: false, error: error.message };
    throw error;
  }
  revalidate(customerId);
  return { ok: true };
}

export async function addCallNoteAction(input: { customerId: string; outcome: string; body?: string; followUpDays?: number; followUpOn?: string }) {
  const customerId = String(input.customerId);
  return run(customerId, (user) =>
    addCallNote(user, customerId, {
      outcome: String(input.outcome ?? ""),
      body: String(input.body ?? "").slice(0, 1000),
      followUpDays: Number(input.followUpDays ?? 0),
      followUpOn: input.followUpOn ? String(input.followUpOn) : undefined,
    }),
  );
}

export async function saveContactAction(input: { customerId: string; contactName?: string; phone?: string; phoneAlt?: string; email?: string; note?: string }) {
  const customerId = String(input.customerId);
  return run(customerId, (user) => saveCustomerContact(user, customerId, { contactName: input.contactName, phone: input.phone, phoneAlt: input.phoneAlt, email: input.email, note: input.note }));
}

export async function completeFollowUpAction(input: { customerId: string; noteId: string }) {
  const customerId = String(input.customerId);
  const noteId = String(input.noteId);
  if (!UUID.test(noteId)) return { ok: false as const, error: "Neispravan podsetnik." };
  return run(customerId, (user) => completeFollowUp(user, customerId, noteId));
}

type Line = { articleId: string; quantity: number };
const cleanLines = (lines: Line[]) =>
  (Array.isArray(lines) ? lines : [])
    .slice(0, 200)
    .map((l) => ({ articleId: String(l.articleId), quantity: Math.round(Number(l.quantity) * 1000) / 1000 }))
    .filter((l) => UUID.test(l.articleId) && Number.isFinite(l.quantity) && l.quantity >= 0 && l.quantity <= 100000);

export async function previewRepOrderAction(input: { customerId: string; lines: Line[]; paymentOption: string | null }) {
  const customerId = String(input.customerId);
  if (!UUID.test(customerId)) return { ok: false as const, error: "Neispravan kupac." };
  const user = await requireCapability("customer_orders:prepare", `/portal/kupci/${customerId}/preporuke`);
  try {
    return { ok: true as const, preview: await previewRepOrder(user, customerId, cleanLines(input.lines), input.paymentOption ? String(input.paymentOption) : null) };
  } catch (error) {
    if (error instanceof RepOrderError) return { ok: false as const, error: error.message };
    throw error;
  }
}

export async function submitRepOrderAction(input: { customerId: string; idempotencyKey: string; lines: Line[]; paymentOption: string | null; note?: string; contactPhone?: string }) {
  const customerId = String(input.customerId);
  if (!UUID.test(customerId)) return { ok: false as const, error: "Neispravan kupac." };
  const user = await requireCapability("customer_orders:prepare", `/portal/kupci/${customerId}/preporuke`);
  try {
    const res = await submitRepOrder(user, customerId, {
      idempotencyKey: String(input.idempotencyKey ?? ""),
      lines: cleanLines(input.lines),
      paymentOption: input.paymentOption ? String(input.paymentOption) : null,
      note: input.note ? String(input.note) : null,
      contactPhone: input.contactPhone ? String(input.contactPhone) : null,
    });
    revalidate(customerId);
    revalidatePath("/portal/zahtevi");
    return { ok: true as const, orderId: res.orderId, requestNumber: res.requestNumber };
  } catch (error) {
    if (error instanceof RepOrderError) return { ok: false as const, error: error.message };
    throw error;
  }
}
