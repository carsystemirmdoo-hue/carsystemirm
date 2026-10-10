"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { signIn } from "@/auth";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import {
  addToCart,
  cancelCustomerOrder,
  removeFromCart,
  returnOrderToCart,
  setCartQuantity,
  submitCartRequest,
  type CartChange,
  type SubmitResult,
  type TransitionResult,
} from "@/lib/ordering/ordering-service";
import { answerOrderRevision, setRequestQuantity, submitOrderRequest, type RequestSubmitResult } from "@/lib/ordering/request-service";

/*
 * Kupčeve akcije nad korpom i zahtevima.
 *
 * Svaka akcija u SVOM telu traži kupčevu sesiju; firma se uzima iz nje. Nijedna
 * ne prima `customerId` ni cenu — ulaz je samo šifra/ID artikla, količina,
 * otisak ponude i ključ slanja.
 */

export async function addToCartAction(input: { articleCode: string; quantity: string }): Promise<CartChange> {
  const session = await requireCustomerSession("/katalog");
  const result = await addToCart(session, input);
  revalidatePath("/kupac/korpa");
  return result;
}

export async function setCartQuantityAction(input: { articleId: string; quantity: string }): Promise<CartChange> {
  const session = await requireCustomerSession("/kupac/korpa");
  const result = await setCartQuantity(session, input);
  revalidatePath("/kupac/korpa");
  return result;
}

export async function removeFromCartAction(articleId: string): Promise<CartChange> {
  const session = await requireCustomerSession("/kupac/korpa");
  const result = await removeFromCart(session, articleId);
  revalidatePath("/kupac/korpa");
  return result;
}

export async function submitCartAction(input: { idempotencyKey: string; fingerprint: string; note: string }): Promise<SubmitResult> {
  const session = await requireCustomerSession("/kupac/korpa");
  const result = await submitCartRequest(session, input);
  revalidatePath("/kupac/korpa");
  revalidatePath("/kupac/porudzbine");
  return result;
}

export async function cancelOrderAction(orderId: string): Promise<TransitionResult> {
  const session = await requireCustomerSession("/kupac/porudzbine");
  const result = await cancelCustomerOrder(session, orderId);
  revalidatePath(`/kupac/porudzbine/${orderId}`);
  return result;
}

export async function returnOrderToCartAction(orderId: string): Promise<TransitionResult> {
  const session = await requireCustomerSession("/kupac/porudzbine");
  const result = await returnOrderToCart(session, orderId);
  revalidatePath("/kupac/korpa");
  revalidatePath(`/kupac/porudzbine/${orderId}`);
  return result;
}

/**
 * Ponovni unos lozinke pre porudžbine iz obnovljene sesije. Uspeh izdaje novu
 * sesiju potvrđenu lozinkom (`assurance = "password"`); zapamćen uređaj ostaje.
 */
export async function confirmPasswordAction(password: string): Promise<{ ok: boolean; message?: string }> {
  const session = await requireCustomerSession("/kupac/korpa");
  try {
    await signIn("customer", { email: session.email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, message: "Lozinka nije ispravna." };
    throw error;
  }
  return { ok: true };
}

/* ---------------------------------------------------------------------------
 * Zahtev iz stvarnog cenovnika (CUSTOMER_ORDERING=cenovnik, 0044)
 * ------------------------------------------------------------------------ */

export async function setRequestQuantityAction(input: { articleId: string; quantity: string }) {
  const session = await requireCustomerSession("/kupac/korpa");
  const r = await setRequestQuantity(session, input);
  revalidatePath("/kupac/korpa");
  return r;
}

export async function submitRequestAction(input: {
  idempotencyKey: string;
  fingerprint: string;
  paymentOption: string | null;
  note: string;
  deliveryAddress: string;
  contactPhone: string;
}): Promise<RequestSubmitResult> {
  const session = await requireCustomerSession("/kupac/korpa");
  const r = await submitOrderRequest(session, input);
  // Korpa se ne osvežava ovde: kupac odmah prelazi na stranu zahteva (inače bi prazna korpa sakrila potvrdu).
  revalidatePath("/kupac/porudzbine");
  return r;
}

export async function answerRevisionAction(orderId: string, accept: boolean) {
  const session = await requireCustomerSession("/kupac/porudzbine");
  const r = await answerOrderRevision(session, orderId, accept);
  revalidatePath(`/kupac/porudzbine/${orderId}`);
  revalidatePath("/kupac/porudzbine");
  return r;
}
