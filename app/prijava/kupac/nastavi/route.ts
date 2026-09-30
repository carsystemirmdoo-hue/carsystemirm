import { NextResponse, type NextRequest } from "next/server";
import { CUSTOMER_LOGIN_ROUTE } from "@/lib/authz/customer-session";
import { normalizeCustomerReturn } from "@/lib/authz/redirects.mjs";
import { tryResumeCustomerSession } from "@/lib/auth/remember-session";

/**
 * Obnova kupčeve sesije sa zapamćenog uređaja, pa povratak na traženu stranu.
 *
 * Jedini ulaz je kolačić „Zapamti me" (HttpOnly) i povratna adresa, proverena
 * istom kapijom kao prijava (`normalizeCustomerReturn`). Neuspeh briše
 * kolačić i vodi na prijavu lozinkom — zato middleware ne može da uđe u petlju.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const back = normalizeCustomerReturn(request.nextUrl.searchParams.get("callbackUrl")) ?? "/kupac";
  const resumed = await tryResumeCustomerSession();
  const target = resumed !== null ? back : `${CUSTOMER_LOGIN_ROUTE}?callbackUrl=${encodeURIComponent(back)}`;
  const res = NextResponse.redirect(new URL(target, request.nextUrl.origin));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
