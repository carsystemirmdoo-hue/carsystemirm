import { createSign } from "node:crypto";

/**
 * Čitanje Google tabele preko servisnog naloga — samo čitanje, bez dodatnih paketa (2026-11-10).
 *
 * Kancelarija tabelu deli sa adresom servisnog naloga kao „Čitalac“. Aplikacija nikad ne piše
 * u tabelu (opseg `spreadsheets.readonly`). Ključ je u promenljivoj okruženja, nikad u kodu.
 *
 * Promenljive:
 *   RECEIVABLES_SHEET_ID              — id iz adrese tabele (…/spreadsheets/d/<ID>/edit)
 *   RECEIVABLES_SHEET_RANGE           — opciono, npr. „Dugovanja!A1:Z“ (podrazumevano prvi list)
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL      — …@….iam.gserviceaccount.com
 *   GOOGLE_SERVICE_ACCOUNT_KEY        — privatni ključ (PEM; „\n“ u jednom redu je dozvoljeno)
 */

export class SheetReadError extends Error {}

/** @param {NodeJS.ProcessEnv} env */
export function sheetConfig(env = process.env) {
  const id = String(env.RECEIVABLES_SHEET_ID ?? "").trim();
  const email = String(env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "").trim();
  const key = String(env.GOOGLE_SERVICE_ACCOUNT_KEY ?? "").replace(/\\n/g, "\n").trim();
  if (!id || !email || !key) return null;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) return null;
  return { id, email, key, range: String(env.RECEIVABLES_SHEET_RANGE ?? "").trim() || "A1:Z5000" };
}

const b64url = (/** @type {string | Buffer} */ v) => Buffer.from(v).toString("base64url");

/**
 * JWT za OAuth (RS256) — isti postupak kao zvanične biblioteke, bez njih.
 * @param {{ email: string, key: string }} cfg @param {number} nowSec
 */
export function serviceAccountAssertion(cfg, nowSec = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: cfg.email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${signer.sign(cfg.key).toString("base64url")}`;
}

/**
 * Ćelije lista. Brojevi dolaze kao brojevi, datumi kao tekst kako su prikazani u tabeli.
 * @param {NonNullable<ReturnType<typeof sheetConfig>>} cfg
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<(string | number | null)[][]>}
 */
export async function readSheetValues(cfg, fetchImpl = fetch) {
  let assertion;
  try {
    assertion = serviceAccountAssertion(cfg);
  } catch {
    throw new SheetReadError("Ključ servisnog naloga nije ispravan.");
  }
  const tokenRes = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) throw new SheetReadError(`Google nije prihvatio servisni nalog (${tokenRes.status}).`);
  const { access_token: token } = /** @type {{ access_token?: string }} */ (await tokenRes.json());
  if (!token) throw new SheetReadError("Google nije vratio pristup.");
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.id)}/values/${encodeURIComponent(cfg.range)}`);
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");
  url.searchParams.set("majorDimension", "ROWS");
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 403 || res.status === 404) {
    throw new SheetReadError("Tabela nije podeljena sa servisnim nalogom ili ne postoji. U Google tabeli: Deli → dodajte adresu servisnog naloga kao „Čitalac“.");
  }
  if (!res.ok) throw new SheetReadError(`Čitanje tabele nije uspelo (${res.status}).`);
  const body = /** @type {{ values?: unknown[][] }} */ (await res.json());
  return (body.values ?? []).map((row) =>
    row.map((v) => (v === "" || v === undefined || v === null ? null : typeof v === "number" ? v : typeof v === "boolean" ? String(v) : String(v))),
  );
}
