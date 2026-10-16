import { isEnabled } from "@/lib/site-access";
import { CUSTOMER_HOME_ROUTE, CUSTOMER_LOGIN_ROUTE } from "./redirects.mjs";

const isCustomerPath = (p: string) => p === CUSTOMER_HOME_ROUTE || p.startsWith(`${CUSTOMER_HOME_ROUTE}/`);

/**
 * Odredište kupca posle prijave: proverena lokalna putanja sa koje je došao
 * (`normalizeCustomerReturn`), a bez nje javna početna. Prijavljen kupac vidi
 * javni sajt i dok je „u pripremi“ (middleware propušta kupčevu sesiju), a
 * „Moj nalog“ ostaje u zaglavlju.
 */
export function customerLandingAfterLogin(back: string | null): string {
  if (!back || back === "/site-u-pripremi" || back.startsWith("/site-u-pripremi?")) return "/";
  return back;
}

/** Posle odjave: javna strana sa koje je došao, a dok je sajt u pripremi — prijava kupca. */
export function customerLandingAfterLogout(back: string | null, siteOpen = !isEnabled(process.env.MAINTENANCE_MODE)): string {
  if (!siteOpen) return `${CUSTOMER_LOGIN_ROUTE}?poruka=odjava`;
  return back && !isCustomerPath(back) ? back : "/";
}
