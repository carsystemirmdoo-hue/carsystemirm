"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { CALLBACK_PARAM, LOGIN_ROUTE, normalizeCallback } from "@/lib/authz/redirects.mjs";

/**
 * Auth.js post-login redirect callback ne sme da odlucuje odrediste ODJAVE:
 * prima samo `/portal…`, pa bi odjavu odveo nazad na portal. Zato se sesija
 * prvo gasi sa `redirect: false`, a Next zatim eksplicitno vodi na `LOGIN_ROUTE`.
 */
export async function signOutAction() {
  await signOut({ redirect: false });
  redirect(LOGIN_ROUTE);
}

/** Ista poruka za svaki neuspeh — iz odgovora se ne sme zaključiti da li nalog postoji. */
const GENERIC_ERROR =
  "Prijava nije uspela. Proverite e-poštu i lozinku, pa pokušajte ponovo.";

export type LoginState = { error: string | null };

export async function signInAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // Odredište prolazi kroz istu proveru kao i preusmeravanje na prijavu:
  // spoljne, protokol-relativne i adrese van portala se odbacuju.
  const safeRedirect =
    normalizeCallback(formData.get(CALLBACK_PARAM)) ?? "/portal";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      // Prazno polje se šalje kao prazan string; `authorize` ga tako i tretira.
      // Vrednost NIKADA ne ide u adresu — ostaje u telu POST zahteva.
      secondFactor: formData.get("secondFactor") ?? "",
      redirectTo: safeRedirect,
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) return { error: GENERIC_ERROR };
    // signIn signalizira uspeh bacanjem preusmeravanja — mora dalje.
    throw error;
  }
}
