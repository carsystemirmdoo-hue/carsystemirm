"use server";

import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { revokeCurrentSession } from "@/lib/auth/revoked-sessions";
import { CALLBACK_PARAM, LOGIN_ROUTE, normalizeCallback } from "@/lib/authz/redirects.mjs";

/**
 * Auth.js post-login redirect callback ne sme da odlucuje odrediste ODJAVE:
 * prima samo `/portal…`, pa bi odjavu odveo nazad na portal. Zato se sesija
 * prvo gasi sa `redirect: false`, a Next zatim eksplicitno vodi na `LOGIN_ROUTE`.
 */
/** Oznaka za javnu traku („Poslovni portal“ umesto „Za zaposlene“) — bez podataka, nije ovlašćenje. */
const STAFF_MARKER_COOKIE = "cs_zaposleni";

export async function signOutAction() {
  // Odjava gasi i sam token, ne samo kolačić (B8).
  (await cookies()).delete(STAFF_MARKER_COOKIE);
  await revokeCurrentSession();
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

  const hadMarker = (await cookies()).has(STAFF_MARKER_COOKIE);
  (await cookies()).set(STAFF_MARKER_COOKIE, "1", { path: "/", httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 3600 });
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
    if (error instanceof AuthError) {
      // Neuspela ponovna potvrda identiteta ne briše oznaku postojeće sesije.
      if (!hadMarker) (await cookies()).delete(STAFF_MARKER_COOKIE);
      return { error: GENERIC_ERROR };
    }
    // signIn signalizira uspeh bacanjem preusmeravanja — mora dalje.
    throw error;
  }
}
