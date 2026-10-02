/**
 * Test nalozi za LOKALNU bazu prikaza (nikad pilot, nikad Neon).
 *
 *   CARSYSTEM_SECRETS_DIR=~/.carsystem-secrets/lokalni-prikaz \
 *     npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/local-view-accounts.mts
 *
 * Pravi naloge na isti način kao QA tok nad izolovanim Postgresom
 * (`scripts/qa/pg-browser-qa.mts`): korisnik + lozinka, a drugi faktor kroz
 * servis za vezivanje (`beginMfaEnrollment` → `confirmMfaEnrollment`).
 * Lozinke i TOTP tajne idu samo u `local-view-accounts.env` (600) u fascikli
 * tajni; ništa se ne ispisuje.
 *
 *   lp-owner   gazda, drugi faktor vezan
 *   lp-office  kancelarija, drugi faktor vezan, BEZ paketa „mapiranja"
 *   lp-rep     komercijalista, drugi faktor vezan
 *   lp-nomfa   gazda, BEZ drugog faktora (provera da portal traži vezivanje)
 */
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import * as OTPAuth from "otpauth";
import { readSecrets, requireSecret, SECRETS_FILE } from "./secrets-file.mts";

const secrets = readSecrets();
if (secrets.DATASET_ROLE !== "lokalni-prikaz") throw new Error("Fajl tajni nije označen kao lokalni prikaz — odbijeno.");
const owner = new URL(requireSecret(secrets, "NEON_OWNER_URL"));
if (owner.hostname !== "127.0.0.1" || !owner.pathname.startsWith("/carsystem_lokalni_")) {
  throw new Error("Meta nije lokalna baza prikaza (127.0.0.1, carsystem_lokalni_*) — odbijeno.");
}
const OUT = path.join(path.dirname(SECRETS_FILE), "local-view-accounts.env");
if (existsSync(OUT)) throw new Error("Nalozi već postoje (local-view-accounts.env) — ništa nije promenjeno.");

process.env.DATABASE_URL = owner.toString();
process.env.PORTAL_MFA_MASTER_KEY_V1 = requireSecret(secrets, "PORTAL_MFA_MASTER_KEY_V1");
process.env.PORTAL_MFA_ACTIVE_KEY_VERSION = "1";

const { getDb, closeDb } = await import("../../db/client.ts");
const { sql } = await import("drizzle-orm");
const { hashPassword } = await import("../../lib/auth/password.mjs");
const { beginMfaEnrollment, confirmMfaEnrollment } = await import("../../lib/auth/mfa-service.ts");

const db = getDb();
const DOMAIN = "lokalni-prikaz.invalid";
const creds: string[] = [];
let lastStep = 0;
async function freshTotp(base32: string) {
  while (Math.floor(Date.now() / 30_000) <= lastStep) await new Promise((r) => setTimeout(r, 1000));
  lastStep = Math.floor(Date.now() / 30_000);
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(base32), digits: 6, period: 30, algorithm: "SHA1" }).generate();
}

for (const [key, role, mfa] of [
  ["owner", "gazda", true],
  ["office", "kancelarija", true],
  ["rep", "komercijalista", true],
  ["nomfa", "gazda", false],
] as const) {
  const password = randomBytes(18).toString("base64url");
  const email = `lp-${key}@${DOMAIN}`;
  const [row] = (await db.execute(sql`
    INSERT INTO users (email, name, initials, password_hash, role, active)
    VALUES (${email}, ${`Lokalni ${key}`}, ${key.slice(0, 2).toUpperCase()}, ${await hashPassword(password)}, ${role}, true)
    RETURNING id`)) as unknown as { id: string }[];
  creds.push(`LP_${key.toUpperCase()}_EMAIL=${email}`, `LP_${key.toUpperCase()}_PASSWORD=${password}`, `LP_${key.toUpperCase()}_ID=${row.id}`);
  if (mfa) {
    const setup = await beginMfaEnrollment({ userId: row.id, accountLabel: email });
    const done = await confirmMfaEnrollment({ userId: row.id, token: await freshTotp(setup.base32) });
    if (!done.ok) throw new Error(`Drugi faktor nije vezan (${key}).`);
    creds.push(`LP_${key.toUpperCase()}_TOTP=${setup.base32}`);
  }
}
writeFileSync(OUT, creds.join("\n") + "\n", { mode: 0o600 });
await closeDb();
console.log("Nalozi napravljeni: lp-owner, lp-office, lp-rep (sa drugim faktorom), lp-nomfa (bez). Pristup u local-view-accounts.env (600).");
