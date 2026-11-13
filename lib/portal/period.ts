import "server-only";
import { cookies } from "next/headers";
import { PERIOD_COOKIE, resolvePortalPeriod } from "@/lib/portal/periodMemory.mjs";

/** Period ekrana iz adrese ili zapamćenog kolačića (vidi `periodMemory.mjs`). */
export async function readPortalPeriod(params: { from?: string; to?: string }) {
  const jar = await cookies();
  return resolvePortalPeriod(params, jar.get(PERIOD_COOKIE)?.value ?? null);
}
