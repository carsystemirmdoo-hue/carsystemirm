import "server-only";
import { eq } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { customers, type NotificationKind } from "@/db/schema";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { canAccessCustomer } from "@/lib/authz/scope.mjs";
import { loadAssignedCustomerIds, type PortalUser } from "@/lib/authz/user-repository";
import { notify } from "@/lib/notifications/notification-service";

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
  if (seesAllCustomers(actor)) return;
  const assigned = await loadAssignedCustomerIds(actor.id);
  for (const rule of rules) {
    if (rule.customerScope !== "customer" || !rule.customerId || !canAccessCustomer(actor, assigned, rule.customerId)) {
      throw new PriceDecisionScopeError();
    }
  }
}

/** Obaveštenje vlasniku o odluci nekog drugog; vlasnikova sopstvena odluka ga ne pravi. */
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
): Promise<void> {
  if (actsAsOwner(actor)) return;
  const executor = tx ?? getDb();
  const [customer] = input.customerId
    ? await executor.select({ name: customers.name }).from(customers).where(eq(customers.id, input.customerId)).limit(1)
    : [];
  const verb = input.kind === "price_rule_approved" ? "odobrio" : input.kind === "price_rule_rejected" ? "odbio" : "opozvao";
  await notify(
    {
      kind: input.kind,
      severity: input.kind === "price_rule_approved" ? "info" : "warning",
      requiredCapability: OWNER_CAPABILITY,
      title: `${actor.name} je ${verb}: ${customer?.name ?? "promena rabata"}`,
      body: `${input.what}. Odluku je doneo ${actor.name}, ne vlasnik.`,
      entityType: input.entityType,
      entityId: input.entityId,
      actionHref: input.actionHref,
      context: { ...(input.context ?? {}), odlucio: actor.name, kupac: customer?.name ?? null },
      correlationId: input.correlationId ?? null,
    },
    tx,
  );
}
