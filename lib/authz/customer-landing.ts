import { isEnabled } from "@/lib/site-access";
import { CUSTOMER_HOME_ROUTE, CUSTOMER_LOGIN_ROUTE } from "./redirects.mjs";

const isCustomerPath = (p: string) => p === CUSTOMER_HOME_ROUTE || p.startsWith(`${CUSTOMER_HOME_ROUTE}/`);

/**
 * Odredište kupca posle prijave.
 *
 * Bez povratne adrese — kupčev deo (`/kupac`), ne javna početna. Dok je javni
 * sajt u pripremi (`MAINTENANCE_MODE`), svaka javna strana preusmerava na
 * `/site-u-pripremi` sa obrascem „pristupni kod“; kupac koji tamo upiše lozinku
 * naloga dobija `?access=invalid`. Zato se tada i javna povratna adresa menja u `/kupac`.
 */
export function customerLandingAfterLogin(back: string | null): string {
  if (!back) return CUSTOMER_HOME_ROUTE;
  if (isEnabled(process.env.MAINTENANCE_MODE) && !isCustomerPath(back)) return CUSTOMER_HOME_ROUTE;
  return back;
}

/** Posle odjave: javna strana sa koje je došao, a dok je sajt u pripremi — prijava kupca. */
export function customerLandingAfterLogout(back: string | null): string {
  if (isEnabled(process.env.MAINTENANCE_MODE)) return `${CUSTOMER_LOGIN_ROUTE}?poruka=odjava`;
  return back && !isCustomerPath(back) ? back : "/";
}
