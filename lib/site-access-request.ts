import "server-only";
import { cookies } from "next/headers";
import { isEnabled, isValidSiteAccessToken, SITE_ACCESS_COOKIE_NAME } from "@/lib/site-access";

/**
 * Da li je javni sajt otvoren ZA OVAJ ZAHTEV: sajt nije u pripremi, ili
 * posetilac ima važeći kod za otključavanje (pilot kupci dok je sajt u
 * pripremi). Od ovoga zavisi da li kupca posle prijave vraćamo na javnu stranu
 * i da li nalog nudi veze ka katalogu (dok. 61 K5).
 */
export async function publicSiteOpenForRequest(): Promise<boolean> {
  if (!isEnabled(process.env.MAINTENANCE_MODE)) return true;
  const token = (await cookies()).get(SITE_ACCESS_COOKIE_NAME)?.value;
  return isValidSiteAccessToken(token);
}
