import "server-only";
import { headers } from "next/headers";
import {
  isTrustedProxyEnvironment,
  resolveClientIp,
} from "@/lib/auth/rate-limit-policy.mjs";

/**
 * Klijentska adresa za brojače pokušaja.
 *
 * `x-forwarded-for` se čita samo iza poznatog posrednika; van njega bi jedan
 * izmišljen header zaobišao ograničenje po adresi.
 *
 * Van konteksta zahteva vraća `null` — tada radi samo brojač po nalogu.
 */
export async function clientIpFromRequest(): Promise<string | null> {
  try {
    const store = await headers();
    return resolveClientIp({
      headers: store,
      trustedProxy: isTrustedProxyEnvironment({
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
      }),
    });
  } catch {
    return null;
  }
}
