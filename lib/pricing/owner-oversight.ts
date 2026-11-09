import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { customers, notifications, type NotificationKind } from "@/db/schema";
import { can } from "@/lib/authz/permissions.mjs";
import { canDecidePricesFor, decidesPricesForAllCustomers } from "@/lib/authz/scope.mjs";
import { loadAssignedCustomerIds, type PortalUser } from "@/lib/authz/user-repository";
import { mergeDigest } from "@/lib/pricing/ownerChanges.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Odluke o cenama koje ne donosi vlasnik (2026-11-04).
 *
 * Odobravanje sme i komercijalista, ali samo za svoje kupce, i vlasnik dobija
 * obaveštenje o svakoj takvoj odluci. `prices:oversee` ima samo gazda (nijedan
 * paket je ne dodeljuje), pa obaveštenje ne vide drugi koji odobravaju.
 */
export const OWNER_CAPABILITY = "prices:oversee";

export function actsAsOwner(actor: PortalUser): boolean {
  return can(actor, OWNER_CAPABILITY);
}

export class PriceDecisionScopeError extends Error {
  constructor(message = "Kupac nije u Vašem opsegu — odluka nije moguća.") {
    super(message);
    this.name = "PriceDecisionScopeError";
  }
}

/**
 * Sme li akter da odlučuje o pravilu ovog opsega.
 *
 * Ko ne vidi sve kupce odlučuje samo o pravilima JEDNOG svog kupca: grupno i
 * globalno pravilo menjaju uslove i kupcima koje ne vidi.
 */
export async function assertDecisionScope(
  actor: PortalUser,
  rules: readonly { customerScope: string; customerId: string | null }[],
): Promise<void> {
  if (decidesPricesForAllCustomers(actor)) return;
  const assigned = await loadAssignedCustomerIds(actor.id);
  for (const rule of rules) {
    if (rule.customerScope !== "customer" || !rule.customerId || !canDecidePricesFor(actor, assigned, rule.customerId)) {
      throw new PriceDecisionScopeError();
    }
  }
}

/**
 * Obaveštenje vlasniku o odluci nekog drugog; vlasnikova sopstvena odluka ga
 * ne pravi.
 *
 * JEDNO obaveštenje po danu (2026-11-09), ne po odluci: dnevni zbir se
 * dopunjuje svakom novom odlukom (ko, kome, šta) i ponovo postaje nepročitan.
 * Kada ga vlasnik zatvori, sledeća odluka istog dana otvara nov zbir.
 * Pojedinosti su na /portal/cene/promene.
 */
export async function notifyOwnerOfDecision(
  actor: PortalUser,
  input: {
    kind: Extract<NotificationKind, "price_rule_approved" | "price_rule_rejected" | "price_rule_revoked">;
    customerId: string | null;
    what: string;
    entityType: string;
    entityId: string;
    actionHref: string;
    correlationId?: string | null;
    context?: Record<string, unknown>;
  },
  tx?: Transaction,
  now: Date = new Date(),
): Promise<void> {
  if (actsAsOwner(actor)) return;
  if (tx) return addToDailyDigest(tx, actor, input, now);
  await getDb().transaction((t) => addToDailyDigest(t, actor, input, now));
}

async function addToDailyDigest(
  tx: Transaction,
  actor: PortalUser,
  input: Parameters<typeof notifyOwnerOfDecision>[1],
  now: Date,
): Promise<void> {
  const [customer] = input.customerId
    ? await tx.select({ name: customers.name }).from(customers).where(eq(customers.id, input.customerId)).limit(1)
    : [];
  const verb = input.kind === "price_rule_approved" ? "odobrio" : input.kind === "price_rule_rejected" ? "odbio" : "opozvao";
  const day = belgradeDate(now);
  const dedupeKey = `${DIGEST_KEY_PREFIX}${day}`;
  const what = input.what.length > 160 ? `${input.what.slice(0, 157)}…` : input.what;
  const change = {
    day,
    actorName: actor.name,
    line: `${verb}: ${customer?.name ?? "promena rabata"} — ${what}`,
    warning: input.kind !== "price_rule_approved",
  };
  const actionHref = `/portal/cene/promene?od=${day}&do=${day}`;

  // Dva pokušaja: ako paralelna odluka upiše zbir između provere i upisa, drugi prolaz ga dopunjuje.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [open] = await tx
      .select({ id: notifications.id, context: notifications.context })
      .from(notifications)
      .where(and(eq(notifications.dedupeKey, dedupeKey), ne(notifications.status, "resolved")))
      .for("update")
      .limit(1);
    const merged = mergeDigest((open?.context as DigestContext | null) ?? null, change);
    const digest = { ...merged, severity: merged.severity === "warning" ? ("warning" as const) : ("info" as const) };
    if (open) {
      await tx
        .update(notifications)
        .set({
          title: digest.title,
          body: digest.body,
          severity: digest.severity,
          context: digest.context,
          actionHref,
          status: "unread",
          readAt: null,
          readBy: null,
          createdAt: now,
        })
        .where(eq(notifications.id, open.id));
      return;
    }
    const inserted = await tx
      .insert(notifications)
      .values({
        kind: "price_rule_approved",
        severity: digest.severity,
        requiredCapability: OWNER_CAPABILITY,
        title: digest.title,
        body: digest.body,
        entityType: "Promene cena i rabata",
        entityId: day,
        actionHref,
        context: digest.context,
        correlationId: input.correlationId ?? null,
        dedupeKey,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: notifications.dedupeKey,
        where: sql`${notifications.dedupeKey} IS NOT NULL AND ${notifications.status} <> 'resolved'`,
      })
      .returning({ id: notifications.id });
    if (inserted.length) return;
  }
}

/** Ključ dnevnog zbira; jedan otvoren zbir po danu (parcijalni UNIQUE nad dedupe_key). */
export const DIGEST_KEY_PREFIX = "promene-cena:";

type DigestContext = Parameters<typeof mergeDigest>[0];
