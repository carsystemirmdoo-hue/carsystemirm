import "server-only";
import { can } from "@/lib/authz/permissions.mjs";
import { getPortalUser, type PortalUser } from "@/lib/authz/session";
import { isEnabled } from "@/lib/site-access";

/**
 * Jedina kapija za portal commerce (korpu).
 *
 * Korpa ne pripada javnom sajtu. Prikazuje se samo kada su ispunjena OBA
 * uslova: portal commerce je sistemski uključen i postoji prijavljena sesija
 * sa ovlašćenjem za kreiranje porudžbina.
 *
 * Provera je server-side i namerno ne gleda pathname — skrivanje kontrole u
 * klijentskom JavaScriptu nije bezbednosna granica.
 */
/*
 * Korpa portala je KUPČEVA strana posla, ne nabavka.
 *
 * Ranije je ovde stajalo `orders:create` — ista dozvola koju paket
 * „porucivanje" daje za nabavku od dobavljača. Time je svaki komercijalista sa
 * tim paketom dobijao i korpu, iako kupčev kontekst još ne postoji.
 */
export const PORTAL_COMMERCE_CAPABILITY = "customer_orders:create";

/** Da li je portal commerce uopšte uključen u ovoj instalaciji. */
export function isPortalCommerceEnabled(): boolean {
  return isEnabled(process.env.PORTAL_COMMERCE);
}

export type PortalCommerceAccess = {
  /** Feature flag uključen. */
  featureEnabled: boolean;
  /** Prijavljen korisnik, ako postoji. */
  user: PortalUser | null;
  /** Korisnik ima `customer_orders:create`. */
  authorized: boolean;
  /** Korpa sme da se montira. */
  allowed: boolean;
};

export async function getPortalCommerceAccess(): Promise<PortalCommerceAccess> {
  const featureEnabled = isPortalCommerceEnabled();
  if (!featureEnabled) {
    return { featureEnabled, user: null, authorized: false, allowed: false };
  }

  const user = await getPortalUser();
  if (!user) {
    return { featureEnabled, user: null, authorized: false, allowed: false };
  }

  const authorized = can(user, PORTAL_COMMERCE_CAPABILITY);
  return { featureEnabled, user, authorized, allowed: authorized };
}

/** Skraćenica za mesta kojima treba samo odluka. */
export async function canUsePortalCommerce(): Promise<boolean> {
  return (await getPortalCommerceAccess()).allowed;
}
