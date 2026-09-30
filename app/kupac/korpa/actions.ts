"use server";

import { revalidatePath } from "next/cache";
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
