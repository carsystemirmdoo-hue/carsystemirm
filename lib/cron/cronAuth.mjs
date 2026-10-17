import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Provera poziva zakazanog zadatka (Vercel Cron šalje `Authorization: Bearer <CRON_SECRET>`).
 * Bez podešene tajne zadatak se odbija (zatvoreno, ne otvoreno); poređenje u konstantnom vremenu.
 * @param {string | null | undefined} header
 * @param {string | null | undefined} secret
 * @returns {"ok" | "nije_podeseno" | "odbijeno"}
 */
export function checkCronAuth(header, secret) {
  if (!secret || secret.length < 16) return "nije_podeseno";
  const got = String(header ?? "");
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b) ? "ok" : "odbijeno";
}
