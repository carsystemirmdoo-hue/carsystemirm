import "server-only";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
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
  /**
   * Ključ istovetnosti.
   *
   * Kada je zadat, ponovno slanje istog uslova dok je prethodno obaveštenje
   * otvoreno NE pravi nov red. Bez njega bi svaka mutacija koja ponovo primeti
   * konflikt dodala jedan red, a lista koja se puni istim redom prestaje da se
   * čita — to je nacin na koji obavestenja umiru u praksi.
   */
  dedupeKey?: string | null;
  /** 0063: kupac na koga se odnosi; komercijalista ga vidi samo ako mu je kupac dodeljen. */
  customerId?: string | null;
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
  const values = {
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
    dedupeKey: input.dedupeKey ?? null,
    customerId: input.customerId ?? null,
  };

  if (!input.dedupeKey) {
    await executor.insert(notifications).values(values);
    return;
  }

  /*
   * Idempotentnost se sprovodi PARCIJALNIM UNIQUE INDEKSOM, ne prethodnim
   * `SELECT`-om. Provera pa upis su dve naredbe i dve paralelne mutacije bi
   * prosle obe — a upravo mutacije koje se dese istovremeno i proizvode isti
   * uslov.
   */
  /*
   * `where` ponavlja predikat PARCIJALNOG indeksa.
   *
   * Bez njega Postgres ne ume da zakljuci koji indeks se gadja i odbija naredbu
   * — parcijalni indeks se pogadja samo ako se predikat doslovno poklopi.
   */
  await executor
    .insert(notifications)
    .values(values)
    .onConflictDoNothing({
      target: notifications.dedupeKey,
      where: sql`${notifications.dedupeKey} IS NOT NULL AND ${notifications.status} <> 'resolved'`,
    });
}

/**
 * Sposobnosti po kojima korisnik VIDI obaveštenja.
 *
 * Obaveštenja o odlukama o cenama (`prices:propose|approve|audit`) nisu vezana
 * za kupca: nose naziv kupca i opseg pravila. Od 2026-11-09 te sposobnosti ima
 * SVAKI komercijalista (rabati svojih kupaca), pa bi ih po sposobnosti video i
 * o tuđim kupcima. Komercijalista ih zato ne vidi; svoje odluke vidi na
 * stranama kupca, a vlasnik ih dobija u dnevnom zbiru (`prices:oversee`).
 */
export const PRICE_DECISION_NOTIFICATION_CAPABILITIES = Object.freeze(["prices:propose", "prices:approve", "prices:audit"]);

/**
 * Obaveštenje vezano za kupca (0063) vidi komercijalista samo ako je kupac u njegovom opsegu;
 * obaveštenja bez kupca i svi ostali korisnici — kao i do sada.
 */
async function customerScopeCondition(user: PortalUser) {
  if (user.role !== "komercijalista") return sql`true`;
  const scope = await resolveLedgerScope(user);
  if (scope.customerIds === null) return sql`true`;
  if (!scope.customerIds.length) return sql`${notifications.customerId} IS NULL`;
  return sql`(${notifications.customerId} IS NULL OR ${notifications.customerId} IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)}))`;
}

export function notificationCapabilitiesFor(user: Pick<PortalUser, "role" | "permissions">): string[] {
  const all = [...resolveCapabilities(user.role, user.permissions)];
  if (user.role !== "komercijalista") return all;
  return all.filter((c) => !PRICE_DECISION_NOTIFICATION_CAPABILITIES.includes(c));
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
  const capabilities = notificationCapabilitiesFor(user);
  if (capabilities.length === 0) return [];

  const db = getDb();
  const conditions = [inArray(notifications.requiredCapability, capabilities), await customerScopeCondition(user)];
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
  const capabilities = notificationCapabilitiesFor(user);
  if (capabilities.length === 0) return 0;

  const db = getDb();
  const rows = await db
    .select({ total: count() })
    .from(notifications)
    .where(
      and(
        inArray(notifications.requiredCapability, capabilities),
        eq(notifications.status, "unread"),
        await customerScopeCondition(user),
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
  const capabilities = notificationCapabilitiesFor(user);
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
  const capabilities = notificationCapabilitiesFor(user);
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
