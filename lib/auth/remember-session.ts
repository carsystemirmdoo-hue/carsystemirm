import "server-only";
import { AuthError } from "next-auth";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { signIn } from "@/auth";
import { getDb } from "@/db/client";
import { isRememberEnabled } from "@/lib/auth/rememberRules.mjs";
import { redeemRememberToken, revokeRememberTokenByRaw } from "@/lib/auth/remember-tokens";

/**
 * Kolačići „Zapamti me" i obnova sesije.
 *
 * `__Host-` prefiks traži HTTPS; lokalni demo radi na http://localhost, pa se
 * tamo koristi obično ime. Kolačić je uvek `HttpOnly` i `SameSite=Lax`.
 */
const secure = () => (process.env.AUTH_URL ?? "").startsWith("https://") || Boolean(process.env.VERCEL);
export const rememberCookieName = () => (secure() ? "__Host-cs_remember" : "cs_remember");
/** Isti marker kao u `app/prijava/kupac/actions.ts` — bez ikakvog podatka. */
export const CUSTOMER_MARKER_COOKIE = "cs_kupac";

export async function readRememberCookie(): Promise<string | null> {
  return (await cookies()).get(rememberCookieName())?.value ?? null;
}

export async function setRememberCookie(raw: string, expiresAt: Date) {
  const jar = await cookies();
  const maxAge = Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  jar.set(rememberCookieName(), raw, { path: "/", httpOnly: true, sameSite: "lax", secure: secure(), maxAge });
  // Marker traje koliko i zapamćen uređaj, da javne strane znaju da treba pitati server.
  jar.set(CUSTOMER_MARKER_COOKIE, "1", { path: "/", httpOnly: false, sameSite: "lax", secure: secure(), maxAge });
}

export async function clearRememberCookie() {
  (await cookies()).delete(rememberCookieName());
}

/** Odjava na ovom uređaju: gasi token i briše kolačić. */
export async function forgetThisDevice() {
  await revokeRememberTokenByRaw(await readRememberCookie(), "logout");
  await clearRememberCookie();
}

/**
 * Obnova kupčeve sesije iz zapamćenog uređaja. Poziva se samo kada sesije
 * NEMA. Vraća ID naloga ili `null`. Uspeh: nov token u kolačiću i nova 8-časovna sesija sa
 * `assurance = "remembered"` (porudžbina tada traži lozinku). Neuspeh:
 * kolačić se briše, kupac se prijavljuje lozinkom.
 */
export async function tryResumeCustomerSession(): Promise<string | null> {
  if (!isRememberEnabled()) return null;
  const raw = await readRememberCookie();
  if (!raw) return null;
  const r = await redeemRememberToken(raw);
  if (!r.ok) {
    // Druga kartica je upravo obnovila isti uređaj: kolačić je već nov, ne briše se.
    if (r.reason !== "rotated_recently") await clearRememberCookie();
    return null;
  }
  try {
    await signIn("customer-remember", { grant: r.grant, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      await clearRememberCookie();
      return null;
    }
    throw error;
  }
  await setRememberCookie(r.raw, r.expiresAt);
  // Nova sesija važi tek od SLEDEĆEG zahteva; pozivalac dobija ID naloga odmah.
  return r.accountId;
}

/**
 * Firma i ime za zaglavlje posle obnove, kada nova sesija važi tek od
 * sledećeg zahteva. ID naloga dolazi iz upravo proverenog tokena, nikad od
 * pregledača.
 */
export async function loadResumedCustomerHeader(accountId: string) {
  const rows = await getDb().execute<{ customer_id: string; customer_name: string; name: string }>(sql`
    SELECT cu.customer_id, c.name AS customer_name, cu.name
      FROM customer_users cu JOIN customers c ON c.id = cu.customer_id
     WHERE cu.id = ${accountId} AND cu.status = 'active'`);
  const r = [...rows][0];
  return r ? { customerId: r.customer_id, customerName: r.customer_name, name: r.name } : null;
}
