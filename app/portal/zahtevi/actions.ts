"use server";

import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { proposeOrderRevision } from "@/lib/ordering/request-service";
import { createTrialAccount } from "@/lib/ordering/trial-service";

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

/** Izmenjen predlog (0044): kancelarija menja robu/količine; cene po važećim odobrenim uslovima; kupac potvrđuje. */
export async function proposeRevisionAction(orderId: string, lines: { code: string; quantity: string }[], reason: string) {
  const user = await requireCapability("customer_orders:review", `/portal/zahtevi/${orderId}`);
  if (!/^[0-9a-f-]{36}$/.test(orderId) || !Array.isArray(lines) || lines.length > 500) return { ok: false, message: "Neispravan zahtev." };
  const codes = [...new Set(lines.map((l) => String(l.code).trim()).filter(Boolean))];
  const found = codes.length ? await getDb().execute<{ id: string; code: string }>(sql`SELECT id, code FROM articles WHERE code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`) : [];
  const byCode = new Map([...found].map((a) => [a.code, a.id]));
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length) return { ok: false, message: `Nepoznata šifra: ${missing.join(", ")}` };
  try {
    const r = await proposeOrderRevision(user, orderId, { lines: lines.map((l) => ({ articleId: byCode.get(String(l.code).trim())!, quantity: Number(String(l.quantity).replace(",", ".")) })), reason });
    revalidatePath("/portal/zahtevi");
    revalidatePath(`/portal/zahtevi/${orderId}`);
    return { ok: true, message: `Izmenjen predlog ${r.requestNumber} je poslat kupcu na potvrdu.`, orderId: r.orderId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Predlog nije sačuvan." };
  }
}

/** Probni nalog kontrolisane probe (samo vlasnik, samo izdvojeni test kupac). Link se prikazuje jednom. */
export async function createTrialAccountAction(customerId: string, email: string, name: string) {
  const user = await requireCapability("customer_accounts:manage", "/portal/zahtevi");
  try {
    const r = await createTrialAccount(user, { customerId: String(customerId), email: String(email ?? ""), name: String(name ?? "") });
    revalidatePath("/portal/zahtevi");
    return { ok: true, link: r.link, expiresAt: r.expiresAt.toISOString() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Nalog nije napravljen." };
  }
}
