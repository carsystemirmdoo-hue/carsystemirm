import "server-only";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import {
  notifications,
  type NotificationKind,
  type NotificationRow,
  type NotificationSeverity,
  type NotificationStatus,
} from "@/db/schema";
import { resolveCapabilities } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type NotificationInput = {
  kind: NotificationKind;
  severity?: NotificationSeverity;
  requiredCapability: string;
  title: string;
  body: string;
  entityType: string;
  entityId?: string | null;
  actionHref?: string | null;
  context?: Record<string, unknown> | null;
  correlationId?: string | null;
};

/**
 * Vrednosti koje ne smeju u `context`.
 *
 * Obaveštenja se čitaju na više ekrana, izvoze i prosleđuju, pa su najlakši
 * put kojim osetljiv podatak izađe iz sistema. Spisak prati isti princip kao
 * `lib/audit/auditEntry.mjs:REDACTED_KEYS`, uz PIB i adresu — koji auditu
 * mogu zatrebati kao identitet, a obaveštenju nikada ne trebaju.
 */
const FORBIDDEN_CONTEXT_KEYS = [
  "pib",
  "adresa",
  "address",
  "email",
  "telefon",
  "phone",
  "password",
  "passwordhash",
  "lozinka",
  "token",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "ip",
];

export class NotificationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "NotificationError";
  }
}

/** Baca ako bi obaveštenje nosilo vrednost koja tu ne pripada. */
export function assertSafeContext(context: Record<string, unknown> | null | undefined) {
  if (!context) return;
  for (const key of Object.keys(context)) {
    const normalized = key.toLowerCase().replace(/[\s_-]/g, "");
    if (FORBIDDEN_CONTEXT_KEYS.includes(normalized)) {
      throw new NotificationError(
        `Obaveštenje ne sme nositi polje „${key}".`,
        "forbidden_context_key",
      );
    }
  }
}

/**
 * Upisuje obaveštenje.
 *
 * `tx` se prosleđuje kad god obaveštenje prati izmenu podataka — tako se
 * izmena, audit zapis i obaveštenje urezuju zajedno ili nikako. Obaveštenje o
 * promeni koja se nije desila je gore od nedostajućeg.
 */
export async function notify(
  input: NotificationInput,
  tx?: Transaction,
): Promise<void> {
  assertSafeContext(input.context);

  const executor = tx ?? getDb();
  await executor.insert(notifications).values({
    kind: input.kind,
    severity: input.severity ?? "info",
    requiredCapability: input.requiredCapability,
    title: input.title,
    body: input.body,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    actionHref: input.actionHref ?? null,
    context: input.context ?? null,
    correlationId: input.correlationId ?? null,
  });
}

/**
 * Obaveštenja koja dati korisnik sme da vidi.
 *
 * Filtriranje ide u `WHERE`, po sposobnostima razrešenim iz baze. Povlačenje
 * svih pa filtriranje u JavaScriptu bi značilo da je red sa tuđim opsegom već
 * pročitan — a odatle do prikaza je jedna izostavljena linija.
 */
export async function listNotificationsFor(
  user: PortalUser,
  filter?: { status?: NotificationStatus; limit?: number },
): Promise<NotificationRow[]> {
  const capabilities = [...resolveCapabilities(user.role, user.permissions)];
  if (capabilities.length === 0) return [];

  const db = getDb();
  const conditions = [inArray(notifications.requiredCapability, capabilities)];
  if (filter?.status) conditions.push(eq(notifications.status, filter.status));

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(filter?.limit ?? 200);
}

/** Broj nepročitanih koja korisnik sme da vidi. */
export async function countUnreadFor(user: PortalUser): Promise<number> {
  const capabilities = [...resolveCapabilities(user.role, user.permissions)];
  if (capabilities.length === 0) return 0;

  const db = getDb();
  const rows = await db
    .select({ total: count() })
    .from(notifications)
    .where(
      and(
        inArray(notifications.requiredCapability, capabilities),
        eq(notifications.status, "unread"),
      ),
    );
  return rows[0]?.total ?? 0;
}

/**
 * Označava obaveštenje kao pročitano.
 *
 * Uslov `required_capability IN (…)` stoji i u `UPDATE`-u, ne samo u
 * prethodnom čitanju: bez njega bi korisnik mogao da zatvori tuđe obaveštenje
 * pogađanjem ID-a, i to bi izgledalo kao da je nestalo samo od sebe.
 */
export async function markNotificationRead(
  user: PortalUser,
  id: number,
): Promise<boolean> {
  const capabilities = [...resolveCapabilities(user.role, user.permissions)];
  if (capabilities.length === 0) return false;

  const db = getDb();
  const rows = await db
    .update(notifications)
    .set({ status: "read", readAt: sql`now()`, readBy: user.id })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.status, "unread"),
        inArray(notifications.requiredCapability, capabilities),
      ),
    )
    .returning({ id: notifications.id });
  return rows.length > 0;
}

/** Zatvara obaveštenje uz obavezan razlog. */
export async function resolveNotification(
  user: PortalUser,
  id: number,
  note: string,
): Promise<boolean> {
  const trimmed = note.trim();
  if (trimmed.length < 3) {
    throw new NotificationError(
      "Zatvaranje obaveštenja traži napomenu (najmanje 3 znaka).",
      "missing_note",
    );
  }
  const capabilities = [...resolveCapabilities(user.role, user.permissions)];
  if (capabilities.length === 0) return false;

  const db = getDb();
  const rows = await db
    .update(notifications)
    .set({
      status: "resolved",
      resolvedAt: sql`now()`,
      resolvedBy: user.id,
      resolutionNote: trimmed,
    })
    .where(
      and(
        eq(notifications.id, id),
        inArray(notifications.requiredCapability, capabilities),
      ),
    )
    .returning({ id: notifications.id });
  return rows.length > 0;
}
