/**
 * Pravo objave dostavljene slike (`supplied-images.json` → `rightsBasis`).
 *
 * Slika čije pravo objave vlasnik još nije potvrdio (`OWNER_CONFIRMATION_REQUIRED`) sme da se
 * vidi lokalno i na Vercel Preview-u — da bi vlasnik mogao da je pregleda — ali NE na Vercel
 * Production: tamo zapis zadržava placeholder dok se `rightsBasis` ne promeni u `OWNER_CONFIRMED`.
 * Odlučuje `VERCEL_ENV`, koji Vercel sam postavlja (isti obrazac kao `internal-demo-routes.mjs`).
 *
 * Bez Node zavisnosti.
 */

export const RIGHTS_CONFIRMED = "OWNER_CONFIRMED";

/**
 * @param {{ rightsBasis?: string }} entry zapis iz `supplied-images.json`
 * @param {string | undefined} vercelEnv vrednost `process.env.VERCEL_ENV`
 */
export function suppliedImageAllowed(entry, vercelEnv) {
  if (entry.rightsBasis === RIGHTS_CONFIRMED) return true;
  return vercelEnv !== "production";
}
