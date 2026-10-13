export const SITE_ACCESS_COOKIE_NAME = "carsystem_site_access";
export const SITE_ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const LOCAL_SITE_ACCESS_PASSWORD = "carsystem-local";
const SITE_ACCESS_TOKEN_SALT = "carsystem-rm-maintenance-access-v1";

export type SiteAccessPasswordState = "configured" | "local-fallback" | "missing";

function configuredPassword() {
  const sitePassword = process.env.SITE_ACCESS_PASSWORD?.trim();
  const previewPassword = process.env.PREVIEW_ACCESS_PASSWORD?.trim();

  return sitePassword || previewPassword || null;
}

export function getSiteAccessPasswordState(): SiteAccessPasswordState {
  if (configuredPassword()) return "configured";
  if (process.env.NODE_ENV !== "production") return "local-fallback";

  return "missing";
}

export function getSiteAccessPassword() {
  return configuredPassword() ?? (process.env.NODE_ENV !== "production" ? LOCAL_SITE_ACCESS_PASSWORD : null);
}

export function getLocalSiteAccessPassword() {
  return LOCAL_SITE_ACCESS_PASSWORD;
}

export function isEnabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

export async function createSiteAccessToken() {
  const password = getSiteAccessPassword();
  if (!password) return null;

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${SITE_ACCESS_TOKEN_SALT}:${password}`),
  );

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Poređenje bez ranog izlaska: vreme odgovora ne sme da kaže koliko je
 * početnih znakova pogođeno (revizija 2026-10-11, B9). Radi i na edge-u.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export async function isValidSiteAccessToken(token: string | undefined) {
  if (!token) return false;

  const expectedToken = await createSiteAccessToken();
  return Boolean(expectedToken && constantTimeEqual(token, expectedToken));
}
