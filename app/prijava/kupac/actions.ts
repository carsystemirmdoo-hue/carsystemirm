"use server";

import { AuthError } from "next-auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { forgetThisDevice, setRememberCookie } from "@/lib/auth/remember-session";
import { isRememberEnabled } from "@/lib/auth/rememberRules.mjs";
import { issueRememberToken } from "@/lib/auth/remember-tokens";
import { findCustomerAccountByEmail } from "@/lib/customers/account-service";
import { normalizeCustomerReturn } from "@/lib/authz/redirects.mjs";
import { customerLandingAfterLogin, customerLandingAfterLogout } from "@/lib/authz/customer-landing";

/** Ista poruka za svaki neuspeh — iz odgovora se ne sme zaključiti da li nalog postoji. */
/** Vidi `components/layout/CustomerAccountMenu.tsx`. */
const CUSTOMER_MARKER_COOKIE = "cs_kupac";

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
  /*
   * Kupac se vraća na stranicu sa koje je došao (javni sajt ili `/kupac`), a
   * bez nje na početnu. `/portal`, prijava i API su izričito zabranjeni —
   * vidi `normalizeCustomerReturn`.
   */
  const safeRedirect = customerLandingAfterLogin(normalizeCustomerReturn(formData.get("callbackUrl")));

  /*
   * Marker za javno zaglavlje: samo „možda je prijavljen kupac", bez ikakvog
   * podatka. Ništa ne otvara — sesiju i dalje proverava server. Postoji da
   * anonimni posetioci ne bi pravili zahtev ka serveru na svakoj strani.
   * Ako prijava ne uspe, marker je bezopasan: server odgovara „nije prijavljen".
   */
  (await cookies()).set(CUSTOMER_MARKER_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
    maxAge: 60 * 60 * 8,
  });

  try {
    /*
     * Bez Auth.js preusmeravanja: njegova zajednička kapija (`normalizeAnyCallback`)
     * namerno prihvata samo portal i `/kupac`. Povratak na javnu stranicu je
     * proveren iznad (`normalizeCustomerReturn`) i radi se tek posle uspešne prijave.
     */
    await signIn("customer", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: GENERIC_ERROR };
    throw error;
  }
  /*
   * „Zapamti me" — tek POSLE uspešne prijave lozinkom, i samo kada je
   * uključeno. Token ne produžava ovu sesiju; služi da se po isteku izda nova.
   */
  if (isRememberEnabled() && formData.get("remember") === "on") {
    const account = await findCustomerAccountByEmail(String(formData.get("email") ?? ""));
    if (account) {
      const { raw, expiresAt } = await issueRememberToken(account.id, (await headers()).get("user-agent"));
      await setRememberCookie(raw, expiresAt);
    }
  }
  redirect(safeRedirect);
}

/**
 * Odjava vraća na javnu stranicu na kojoj je kupac bio (ili na početnu).
 * Stranice naloga (`/kupac…`) se posle odjave ne otvaraju, pa se tada ide na početnu.
 */
export async function customerSignOutAction(formData?: FormData) {
  // Odjava zaboravlja i ovaj uređaj: bez toga bi ga sledeća poseta ponovo prijavila.
  await forgetThisDevice();
  await signOut({ redirect: false });
  (await cookies()).delete(CUSTOMER_MARKER_COOKIE);
  const back = normalizeCustomerReturn(formData?.get("returnTo") ?? null);
  redirect(customerLandingAfterLogout(back));
}
