import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  customerAssignments,
  userPermissions,
  userPreferences,
  users,
} from "@/db/schema";
import type { UserRole } from "@/db/schema/users";

export interface PortalUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: UserRole;
  active: boolean;
  /** Ključevi paketa dozvola, uvek sveže učitani iz baze. */
  permissions: string[];
}

/**
 * Učitava korisnika sa aktuelnim paketima dozvola.
 *
 * Namerno se poziva pri svakom zahtevu umesto čuvanja dozvola u tokenu sesije:
 * kada Gazda oduzme paket, promena važi od sledećeg zahteva, bez odjave korisnika.
 */
export async function loadPortalUser(
  userId: string,
): Promise<PortalUser | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      initials: users.initials,
      role: users.role,
      active: users.active,
      permission: userPermissions.permissionKey,
    })
    .from(users)
    .leftJoin(userPermissions, eq(userPermissions.userId, users.id))
    .where(eq(users.id, userId));

  const first = rows[0];
  if (!first || !first.active) return null;

  return {
    id: first.id,
    email: first.email,
    name: first.name,
    initials: first.initials,
    role: first.role,
    active: first.active,
    permissions: rows
      .map((row) => row.permission)
      .filter((key): key is string => Boolean(key)),
  };
}

export async function findUserByEmail(email: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

/** Kupci dodeljeni komercijalisti; osnova za ograničavanje vidljivosti. */
export async function loadAssignedCustomerIds(
  userId: string,
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ customerId: customerAssignments.customerId })
    .from(customerAssignments)
    .where(eq(customerAssignments.userId, userId));
  return rows.map((row) => row.customerId);
}

export async function readUserPreference(
  userId: string,
  key: string,
): Promise<unknown> {
  const db = getDb();
  const rows = await db
    .select({ value: userPreferences.value })
    .from(userPreferences)
    .where(
      and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)),
    )
    .limit(1);
  return rows[0]?.value ?? null;
}

export async function writeUserPreference(
  userId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const db = getDb();
  await db
    .insert(userPreferences)
    .values({ userId, key, value })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.key],
      set: { value, updatedAt: sql`now()` },
    });
}
