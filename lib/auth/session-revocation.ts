import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import type { Tx } from "@/lib/authz/security-admin";

/**
 * Opoziv svih otvorenih sesija jednog naloga.
 *
 * Sesije su JWT tokeni — server ih ne drži, pa se ne mogu „obrisati". Umesto
 * toga svaki token nosi `session_version` sa kojim je izdat, a pri svakom
 * zahtevu se poredi sa vrednošću u bazi. Povećanje kolone obara sve tokene
 * izdate pre toga, uključujući i onaj kojim je radnja pokrenuta.
 *
 * Zašto uvek u prosleđenoj transakciji
 * ------------------------------------
 * Opoziv prati odluku koja ga je izazvala — promenu lozinke, deaktivaciju,
 * reset drugog faktora. Ako bi se izvršio zasebno, postojao bi trenutak u kome
 * je odluka upisana a stara sesija još radi, ili obrnuto. Zato funkcija prima
 * `tx` i nema sopstvenu transakciju.
 */
export async function revokeUserSessions(
  tx: Tx,
  userId: string,
  now = new Date(),
): Promise<void> {
  await tx
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now })
    .where(eq(users.id, userId));
}

/** Isto, kada poziv nema spoljnu transakciju uz sebe. */
export async function revokeUserSessionsStandalone(
  userId: string,
  now = new Date(),
): Promise<void> {
  await getDb().transaction((tx) => revokeUserSessions(tx, userId, now));
}
