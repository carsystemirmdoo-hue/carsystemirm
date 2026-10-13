"use server";

import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { getDb } from "@/db/client";
import { clientIpFromRequest } from "@/lib/auth/client-ip";
import { clearAccountAttempts, isBucketBlocked, registerAttempt } from "@/lib/auth/rate-limit-service";
import { clearRememberCookie } from "@/lib/auth/remember-session";
import { logoutAllDevices, revokeAllRememberTokens } from "@/lib/auth/remember-tokens";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { CustomerAccountError } from "@/lib/customers/account-service";
import { changeCustomerPassword } from "@/lib/customers/invitation-service";

/*
 * Bezbednost kupčevog naloga. Svaka akcija u svom telu traži kupčevu sesiju;
 * nalog je iz sesije, nikad iz ulaza.
 */

/** Kraj sesije na ovom uređaju; poruka je KOD sa zatvorenog spiska, ne slobodan tekst iz adrese. */
async function endHere(code: "odjava-svi" | "lozinka") {
  await clearRememberCookie();
  (await cookies()).delete("cs_kupac");
  await signOut({ redirect: false });
  redirect(`/prijava/kupac?callbackUrl=%2Fkupac&poruka=${code}`);
}

/** Odjava sa svih uređaja: sve sesije i svi zapamćeni uređaji, uključujući ovaj. */
export async function logoutAllDevicesAction() {
  const session = await requireCustomerSession("/kupac/bezbednost");
  await logoutAllDevices(session.accountId, session.email);
  await endHere("odjava-svi");
}

/** Zaboravlja JEDAN zapamćeni uređaj (cela porodica tokena), samo sopstvenog naloga. */
export async function forgetDeviceAction(tokenId: string) {
  const session = await requireCustomerSession("/kupac/bezbednost");
  if (!/^[0-9a-f-]{36}$/i.test(tokenId)) return;
  await getDb().execute(sql`
    UPDATE customer_remember_tokens SET revoked_at = now(), revoked_reason = 'logout', grant_hash = NULL
     WHERE revoked_at IS NULL AND account_id = ${session.accountId}
       AND family_id = (SELECT family_id FROM customer_remember_tokens WHERE id = ${tokenId}::uuid AND account_id = ${session.accountId})`);
  redirect("/kupac/bezbednost");
}

export type PasswordState = { error: string | null };

/** Promena lozinke: nova verzija sesije (sve sesije) + opoziv svih zapamćenih uređaja. */
export async function changePasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const session = await requireCustomerSession("/kupac/bezbednost");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) return { error: "Nova lozinka i potvrda se ne slažu." };
  /*
   * Isti brojač kao prijava (`password`, nalog + adresa): provera trenutne
   * lozinke iza otvorene sesije bez njega dozvoljava neograničeno pogađanje
   * (revizija 2026-10-11, B9).
   */
  const clientIp = await clientIpFromRequest();
  const identifier = session.email.toLowerCase();
  if (await isBucketBlocked({ scope: "password", accountIdentifier: identifier, clientIp })) {
    return { error: "Previše pokušaja. Sačekajte nekoliko minuta pa pokušajte ponovo." };
  }
  try {
    const { ok } = await changeCustomerPassword({ accountId: session.accountId, currentPassword: current, newPassword: next });
    if (!ok) {
      await registerAttempt({ scope: "password", accountIdentifier: identifier, clientIp });
      return { error: "Trenutna lozinka nije ispravna." };
    }
    await clearAccountAttempts("password", identifier);
  } catch (error) {
    if (error instanceof CustomerAccountError) return { error: error.message };
    throw error;
  }
  await revokeAllRememberTokens(session.accountId, "password_changed");
  await endHere("lozinka");
  return { error: null };
}
