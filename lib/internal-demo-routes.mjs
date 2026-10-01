/**
 * Interne demo strane (`/interaction-demo/*`, `/social-exports/*`) služe za
 * razvoj i izvoz vizuala. Na Vercel Production i Preview vraćaju 404, ne samo
 * `noindex` (odluka vlasnika 2026-10-01, docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md
 * GAP-008). Lokalno (`next dev`, lokalni `next start` za render skripte) i u
 * `vercel dev` ostaju dostupne. Bez nove env promenljive: odlučuje VERCEL_ENV,
 * koji Vercel sam postavlja.
 *
 * Bez Node zavisnosti — uvozi ga Edge middleware.
 */

export const INTERNAL_DEMO_PREFIXES = ["/interaction-demo", "/social-exports"];

/** Putanja bez strane; prepisivanje na nju daje Next 404 stranu i status 404. */
export const INTERNAL_DEMO_NOT_FOUND_PATH = "/__interna-strana-nije-dostupna";

/** @param {string} pathname */
export function isInternalDemoRoute(pathname) {
  return INTERNAL_DEMO_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Dozvoljeno samo van Vercel deploymenta (lokalno) i u `vercel dev`.
 * @param {string | undefined} vercelEnv vrednost `process.env.VERCEL_ENV`
 */
export function internalDemoRoutesAllowed(vercelEnv) {
  return !vercelEnv || vercelEnv === "development";
}
