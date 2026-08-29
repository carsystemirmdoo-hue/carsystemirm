"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import {
  CUSTOMER_HOME_ROUTE,
  CUSTOMER_LOGIN_ROUTE,
  normalizeCustomerCallback,
} from "@/lib/authz/redirects.mjs";

/** Ista poruka za svaki neuspeh — iz odgovora se ne sme zaključiti da li nalog postoji. */
const GENERIC_ERROR =
  "Prijava nije uspela. Proverite e-poštu i lozinku, pa pokušajte ponovo.";

export type CustomerLoginState = { error: string | null };

/**
 * Prijava kupca.
 *
 * Gađa provajder `"customer"`, ne `"credentials"`. To su dva odvojena puta i
 * nikada se ne mešaju: kupčeva adresa u internoj prijavi ne postoji, a interna
 * adresa ovde ne postoji.
 */
export async function customerSignInAction(
  _previous: CustomerLoginState,
  formData: FormData,
): Promise<CustomerLoginState> {
  // Kupčev povratak sme isključivo u `/kupac`. `/portal` se ovde ne prihvata.
  const safeRedirect =
    normalizeCustomerCallback(formData.get("callbackUrl")) ?? CUSTOMER_HOME_ROUTE;

  try {
    await signIn("customer", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeRedirect,
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) return { error: GENERIC_ERROR };
    // signIn signalizira uspeh bacanjem preusmeravanja — mora dalje.
    throw error;
  }
}

export async function customerSignOutAction() {
  await signOut({ redirect: false });
  redirect(CUSTOMER_LOGIN_ROUTE);
}
