import "server-only";
import { eq, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { authRevokedSessions } from "@/db/schema";
import { auth } from "@/auth";
import { isValidSessionId, revocationExpiresAt } from "@/lib/auth/session-lifetime.mjs";

/**
 * Da li je ova sesija opozvana odjavom (0045).
 *
 * Neispravan ili nepostojeći `sid` se tumači kao opozvan — fail-closed, kao i
 * nedostajuće vreme prijave (vidi `lib/auth/session-lifetime.mjs`).
 */
export async function isSessionRevoked(sid: unknown): Promise<boolean> {
  if (!isValidSessionId(sid)) return true;
  const rows = await getDb()
    .select({ sid: authRevokedSessions.sid })
    .from(authRevokedSessions)
    .where(eq(authRevokedSessions.sid, sid))
    .limit(1);
  return rows.length > 0;
}

/**
 * Opoziva TEKUĆU sesiju (poziva se iz odjave, pre brisanja kolačića).
 *
 * Ostali uređaji istog naloga ostaju prijavljeni. Usput briše zapise čiji je
 * token ionako istekao, da tabela ne raste.
 */
export async function revokeCurrentSession(): Promise<void> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !isValidSessionId(user.sid) || typeof user.loginAt !== "number") return;
  const db = getDb();
  await db
    .insert(authRevokedSessions)
    .values({
      sid: user.sid,
      subject: user.subject === "customer" ? "customer" : "internal",
      subjectId: user.id,
      expiresAt: revocationExpiresAt(user.loginAt),
    })
    .onConflictDoNothing();
  await db.delete(authRevokedSessions).where(lt(authRevokedSessions.expiresAt, new Date()));
}
