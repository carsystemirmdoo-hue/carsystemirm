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
  /** Trenutna verzija sesije iz baze; osnova za opoziv tokena. */
  sessionVersion: number;
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
      sessionVersion: users.sessionVersion,
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
    sessionVersion: first.sessionVersion,
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

/**
 * Razlozi zbog kojih se sve sesije korisnika poništavaju.
 *
 * Spisak je eksplicitan da bi se videlo šta jeste, a šta nije razlog za opoziv.
 * Oduzimanje pojedinačne dozvole NIJE na spisku: dozvole se ionako čitaju iz
 * baze pri svakom zahtevu, pa ta promena važi odmah i bez opoziva.
 */
export type SessionRevocationReason =
  | "password_changed"
  | "account_deactivated"
  | "role_changed"
  | "mfa_reset"
  | "admin_revoked";

/**
 * Poništava sve postojeće sesije jednog korisnika.
 *
 * Povećanjem `session_version` svaki ranije izdat token prestaje da se poklapa
 * sa bazom i pada pri sledećem zahtevu — uključujući token koji je neko odneo
 * sa tuđeg računara. Ovo je jedina kontrola koja to može, jer Auth.js sa JWT
 * strategijom ne vodi evidenciju izdatih tokena.
 *
 * Vraća novu verziju i razlog — spremne za upis u audit — ili `null` ako
 * korisnik ne postoji. Razlog se namerno vraća umesto da se upiše ovde: audit
 * traži i aktera, koga ovaj sloj ne poznaje, a pozivalac ga ne sme zaboraviti.
 */
export async function revokeUserSessions(
  userId: string,
  reason: SessionRevocationReason,
): Promise<{ sessionVersion: number; reason: SessionRevocationReason } | null> {
  const db = getDb();
  const rows = await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: sql`now()` })
    .where(eq(users.id, userId))
    .returning({ sessionVersion: users.sessionVersion });

  const updated = rows[0];
  return updated ? { sessionVersion: updated.sessionVersion, reason } : null;
}

/**
 * Da li token sme da nastavi da važi.
 *
 * Čista provera, izdvojena da bi se ugovor opoziva mogao dokazati testom bez
 * baze. Nepoznata ili izostavljena verzija u tokenu se tretira kao `0` — tokeni
 * izdati pre uvođenja ove kolone tako ostaju važeći dok im ne istekne rok ili
 * dok se sesija izričito ne opozove.
 */
export function isSessionVersionCurrent(
  tokenVersion: number | null | undefined,
  storedVersion: number,
): boolean {
  return (tokenVersion ?? 0) === storedVersion;
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
