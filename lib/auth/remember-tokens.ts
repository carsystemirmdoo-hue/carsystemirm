import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { recordAudit } from "@/lib/audit/record";
import { canCustomerSignIn } from "@/lib/authz/customer-scope.mjs";
import {
  decideRedemption,
  deviceLabel,
  GRANT_TTL_MS,
  MAX_REMEMBERED_DEVICES,
  REMEMBER_MS,
} from "@/lib/auth/rememberRules.mjs";

/**
 * Tokeni „Zapamti me" — samo baza, bez kolačića i bez Auth.js-a.
 *
 * Tok obnove: `redeemRememberToken` proverava i ROTIRA token i izdaje
 * jednokratnu dozvolu (60 s); provajder `customer-remember` u `auth.ts` tu
 * dozvolu troši (`consumeRememberGrant`) i izdaje običnu 8-časovnu sesiju.
 * Sirovi token i dozvola nikad nisu u bazi — samo SHA-256.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Exec = Database | Tx;

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
const newRaw = () => randomBytes(32).toString("base64url");

/** Izdaje token za nalog posle prijave LOZINKOM. Porodica traje 30 dana. */
export async function issueRememberToken(accountId: string, userAgent: string | null, now = new Date()) {
  const db = getDb();
  const raw = newRaw();
  const expiresAt = new Date(now.getTime() + REMEMBER_MS);
  await db.transaction(async (tx) => {
    const [acc] = [...(await tx.execute<{ session_version: number }>(sql`
      SELECT session_version FROM customer_users WHERE id = ${accountId} FOR UPDATE`))];
    if (!acc) throw new Error("Nalog ne postoji.");
    await tx.execute(sql`
      INSERT INTO customer_remember_tokens (account_id, family_id, token_hash, session_version, device_label, expires_at)
      VALUES (${accountId}, ${randomUUID()}, ${hash(raw)}, ${acc.session_version}, ${deviceLabel(userAgent)}, ${expiresAt.toISOString()}::timestamptz)`);
    // Najviše N uređaja: višak gasi najstarije porodice.
    await tx.execute(sql`
      UPDATE customer_remember_tokens SET revoked_at = now(), revoked_reason = 'device_limit'
       WHERE revoked_at IS NULL AND account_id = ${accountId}
         AND id NOT IN (
           SELECT id FROM customer_remember_tokens
            WHERE revoked_at IS NULL AND account_id = ${accountId}
            ORDER BY created_at DESC LIMIT ${MAX_REMEMBERED_DEVICES})`);
  });
  return { raw, expiresAt };
}

async function revokeFamily(exec: Exec, familyId: string, reason: string) {
  await exec.execute(sql`
    UPDATE customer_remember_tokens SET revoked_at = now(), revoked_reason = ${reason}, grant_hash = NULL
     WHERE family_id = ${familyId} AND revoked_at IS NULL`);
}

export type Redemption =
  | { ok: true; raw: string; grant: string; expiresAt: Date; accountId: string }
  | { ok: false; reason: string };

/**
 * Proverava token iz kolačića i, ako važi, zamenjuje ga novim (rotacija).
 * Ponovna upotreba starog tokena posle prozora tolerancije gasi celu porodicu
 * i sve sesije naloga (mogući ukraden token).
 */
export async function redeemRememberToken(raw: string | null | undefined, now = new Date()): Promise<Redemption> {
  if (!raw || raw.length < 20 || raw.length > 200) return { ok: false, reason: "unknown" };
  const db = getDb();
  return db.transaction(async (tx) => {
    const [row] = [
      ...(await tx.execute<{
        id: string; account_id: string; family_id: string; session_version: number; expires_at: Date;
        revoked_at: Date | null; revoked_reason: string | null; device_label: string;
      }>(sql`
        SELECT id, account_id, family_id, session_version, expires_at, revoked_at, revoked_reason, device_label
          FROM customer_remember_tokens WHERE token_hash = ${hash(raw)} FOR UPDATE`)),
    ];
    const [acc] = row
      ? [...(await tx.execute<{ status: string; session_version: number; email: string }>(sql`
          SELECT status::text AS status, session_version, email FROM customer_users WHERE id = ${row.account_id} FOR UPDATE`))]
      : [];
    const decision = decideRedemption(
      row
        ? { revokedAt: row.revoked_at ? new Date(row.revoked_at) : null, revokedReason: row.revoked_reason, expiresAt: new Date(row.expires_at), sessionVersion: row.session_version }
        : null,
      acc ? { status: acc.status, sessionVersion: acc.session_version, canSignIn: canCustomerSignIn(acc.status) } : null,
      now,
    );
    if (decision.action === "reject") return { ok: false as const, reason: decision.reason };
    if (decision.action === "revoke_family") {
      await revokeFamily(tx, row!.family_id, decision.reason);
      if (decision.reason === "reuse_detected") {
        // Stari token u tuđim rukama: gase se i sve žive sesije naloga.
        await tx.execute(sql`UPDATE customer_users SET session_version = session_version + 1, updated_at = now() WHERE id = ${row!.account_id}`);
        await recordAudit(
          {
            actor: { id: null, name: acc?.email ?? "kupac", role: "kupac", kind: "system" },
            action: "customer_remember.reuse_detected",
            entityType: "Kupčev nalog",
            entityId: row!.account_id,
            reason: "Ponovna upotreba zamenjenog tokena „Zapamti me”; opozvane sve sesije i zapamćeni uređaji.",
          },
          tx,
        );
      }
      return { ok: false as const, reason: decision.reason };
    }

    const nextRaw = newRaw();
    const grant = newRaw();
    const [next] = [
      ...(await tx.execute<{ id: string }>(sql`
        INSERT INTO customer_remember_tokens (account_id, family_id, token_hash, session_version, device_label, expires_at,
                                              last_used_at, grant_hash, grant_expires_at)
        VALUES (${row!.account_id}, ${row!.family_id}, ${hash(nextRaw)}, ${row!.session_version}, ${row!.device_label},
                ${new Date(row!.expires_at).toISOString()}::timestamptz, now(), ${hash(grant)},
                ${new Date(now.getTime() + GRANT_TTL_MS).toISOString()}::timestamptz)
        RETURNING id`)),
    ];
    await tx.execute(sql`
      UPDATE customer_remember_tokens SET revoked_at = now(), revoked_reason = 'rotated', replaced_by = ${next.id}, grant_hash = NULL
       WHERE id = ${row!.id}`);
    return { ok: true as const, raw: nextRaw, grant, expiresAt: new Date(row!.expires_at), accountId: row!.account_id };
  });
}

/**
 * Troši jednokratnu dozvolu i vraća nalog za novu sesiju (poziva ga samo
 * provajder `customer-remember`). Dozvola važi 60 s i samo jednom; nalog mora i
 * dalje smeti da se prijavi, sa istom verzijom sesije.
 */
export async function consumeRememberGrant(grant: string | null | undefined, now = new Date()) {
  if (!grant || grant.length < 20 || grant.length > 200) return null;
  const db = getDb();
  return db.transaction(async (tx) => {
    const [row] = [
      ...(await tx.execute<{ id: string; account_id: string; session_version: number; grant_expires_at: Date }>(sql`
        UPDATE customer_remember_tokens SET grant_hash = NULL
         WHERE grant_hash = ${hash(grant)} AND revoked_at IS NULL
        RETURNING id, account_id, session_version, grant_expires_at`)),
    ];
    if (!row || new Date(row.grant_expires_at).getTime() < now.getTime()) return null;
    const [acc] = [
      ...(await tx.execute<{ id: string; name: string; email: string; status: string; session_version: number }>(sql`
        SELECT id, name, email, status::text AS status, session_version FROM customer_users WHERE id = ${row.account_id}`)),
    ];
    if (!acc || !canCustomerSignIn(acc.status) || acc.session_version !== row.session_version) return null;
    return { id: acc.id, name: acc.name, email: acc.email, sessionVersion: acc.session_version };
  });
}

/** Odjava na jednom uređaju: gasi porodicu tokena iz kolačića. */
export async function revokeRememberTokenByRaw(raw: string | null | undefined, reason = "logout") {
  if (!raw) return;
  const db = getDb();
  const [row] = [...(await db.execute<{ family_id: string }>(sql`SELECT family_id FROM customer_remember_tokens WHERE token_hash = ${hash(raw)}`))];
  if (row) await revokeFamily(db, row.family_id, reason);
}

/** Gasi sve zapamćene uređaje naloga (bez promene verzije sesije). */
export async function revokeAllRememberTokens(accountId: string, reason: string, exec: Exec = getDb()) {
  await exec.execute(sql`
    UPDATE customer_remember_tokens SET revoked_at = now(), revoked_reason = ${reason}, grant_hash = NULL
     WHERE account_id = ${accountId} AND revoked_at IS NULL`);
}

/**
 * Odjava sa svih uređaja: verzija sesije + 1 (gasi sve žive sesije) i opoziv
 * svih zapamćenih uređaja, u jednoj transakciji.
 */
export async function logoutAllDevices(accountId: string, actorEmail: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.execute(sql`UPDATE customer_users SET session_version = session_version + 1, updated_at = now() WHERE id = ${accountId}`);
    await revokeAllRememberTokens(accountId, "logout_all", tx);
    await recordAudit(
      {
        actor: { id: null, name: actorEmail, role: "kupac", kind: "system" },
        action: "customer_remember.logout_all",
        entityType: "Kupčev nalog",
        entityId: accountId,
        reason: "Kupac se odjavio sa svih uređaja.",
      },
      tx,
    );
  });
}

export type RememberedDevice = {
  id: string; deviceLabel: string; createdAt: Date; lastUsedAt: Date | null; expiresAt: Date; current: boolean;
};

/** Aktivni zapamćeni uređaji naloga (po porodici, poslednji token). */
export async function listRememberedDevices(accountId: string, currentRaw: string | null): Promise<RememberedDevice[]> {
  const rows = await getDb().execute<{
    id: string; device_label: string; created_at: Date; last_used_at: Date | null; expires_at: Date; token_hash: string;
    family_created: Date;
  }>(sql`
    SELECT t.id, t.device_label, t.created_at, t.last_used_at, t.expires_at, t.token_hash,
           (SELECT min(f.created_at) FROM customer_remember_tokens f WHERE f.family_id = t.family_id) AS family_created
      FROM customer_remember_tokens t
      JOIN customer_users u ON u.id = t.account_id AND u.session_version = t.session_version
     WHERE t.account_id = ${accountId} AND t.revoked_at IS NULL AND t.expires_at > now()
     ORDER BY family_created DESC`);
  const cur = currentRaw ? hash(currentRaw) : null;
  return [...rows].map((r) => ({
    id: r.id, deviceLabel: r.device_label, createdAt: new Date(r.family_created), lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null,
    expiresAt: new Date(r.expires_at), current: cur === r.token_hash,
  }));
}
