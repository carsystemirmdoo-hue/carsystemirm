import "server-only";
import { isPreparedForPortal } from "@/lib/customers/commercial-status.mjs";
import { commercialStatuses } from "@/lib/customers/commercial-status-service";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customerExternalIdentifiers, customers, customerUsers } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { SOURCE_SYSTEM } from "@/lib/commercial/customerLinkApply";
import { planContactProposals, proposalReason, type readContactProposals } from "@/lib/customers/contactProposalFiles.mjs";
import type { AccountActor } from "@/lib/customers/account-service";

/**
 * Grupni predlog kontakata (`contactProposalFiles.mjs`).
 *
 * - Plan se računa nad stanjem baze u trenutku provere i ponovo u trenutku primene.
 * - Jedan red = jedna transakcija: nalog `requested` (bez lozinke) + trag, isto
 *   kao pojedinačni predlog. Potvrda osobe i poziv se ovde NE prave.
 * - Ponovno pokretanje ne pravi duplikate: e-pošta je jedinstvena, pa se
 *   istovetan kontakt vraća kao `already_present`.
 */

type Rows = ReturnType<typeof readContactProposals>;
export type ContactOutcome = ReturnType<typeof planContactProposals>[number]["outcome"] | "created" | "not_prepared";

async function loadState(issuerCode: string, rows: Rows) {
  const db = getDb();
  const codes = [...new Set(rows.map((r) => r.code).filter(Boolean))];
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))];
  const idents = codes.length
    ? await db
        .select({ code: customerExternalIdentifiers.externalPartnerCode, id: customers.id, pib: customers.pib, active: customers.active })
        .from(customerExternalIdentifiers)
        .innerJoin(customers, eq(customers.id, customerExternalIdentifiers.customerId))
        .where(
          and(
            eq(customerExternalIdentifiers.sourceSystem, SOURCE_SYSTEM),
            eq(customerExternalIdentifiers.issuerCode, issuerCode),
            eq(customerExternalIdentifiers.status, "mapped"),
            inArray(customerExternalIdentifiers.externalPartnerCode, codes),
          ),
        )
    : [];
  const customerIds = [...new Set(idents.map((i) => i.id))];
  const byEmail = emails.length
    ? await db.select({ email: customerUsers.email, customerId: customerUsers.customerId }).from(customerUsers).where(inArray(customerUsers.email, emails))
    : [];
  const byCustomer = customerIds.length
    ? await db
        .select({ customerId: customerUsers.customerId, email: customerUsers.email, status: customerUsers.status })
        .from(customerUsers)
        .where(inArray(customerUsers.customerId, customerIds))
    : [];
  const accountsByCustomer = new Map<string, { email: string; status: string }[]>();
  for (const a of byCustomer) accountsByCustomer.set(a.customerId, [...(accountsByCustomer.get(a.customerId) ?? []), a]);
  return {
    customersByCode: new Map(idents.map((i) => [i.code, { id: i.id, pib: i.pib, active: i.active }])),
    accountsByEmail: new Map(byEmail.map((a) => [a.email, { customerId: a.customerId }])),
    accountsByCustomer,
  };
}

export async function applyContactProposals(
  input: { issuerCode: string; rows: Rows; dryRun: boolean },
  actor: AccountActor,
): Promise<{ red: number; code: string; outcome: ContactOutcome }[]> {
  const plan = planContactProposals({ rows: input.rows, ...(await loadState(input.issuerCode, input.rows)) });
  const out: { red: number; code: string; outcome: ContactOutcome }[] = [];
  const statuses = await commercialStatuses();
  const notPrepared = new Set([...statuses].filter(([, v]) => !isPreparedForPortal(v.status)).map(([k]) => k));
  for (const p of plan) {
    // Kupac van pripreme za portal (0042): nalog se ne pravi ni u proveri ni u primeni.
    if (p.outcome === "would_create" && notPrepared.has(p.customerId as string)) {
      out.push({ red: p.row.red, code: p.row.code, outcome: "not_prepared" });
      continue;
    }
    if (p.outcome !== "would_create" || input.dryRun) {
      out.push({ red: p.row.red, code: p.row.code, outcome: p.outcome });
      continue;
    }
    out.push({ red: p.row.red, code: p.row.code, outcome: await createOne(p.row, p.customerId as string, actor) });
  }
  return out;
}

async function createOne(row: Rows[number], customerId: string, actor: AccountActor): Promise<ContactOutcome> {
  const db = getDb();
  const reason = proposalReason(row, actor.name);
  return db.transaction(async (tx) => {
    // Stanje se ponovo čita pod ključem kupca: između provere i primene neko je mogao da upiše kontakt.
    const [customer] = await tx
      .select({ name: customers.name, active: customers.active })
      .from(customers)
      .where(eq(customers.id, customerId))
      .for("update")
      .limit(1);
    if (!customer?.active) return "customer_inactive" as const;
    const existing = await tx
      .select({ customerId: customerUsers.customerId, email: customerUsers.email, status: customerUsers.status })
      .from(customerUsers)
      .where(eq(customerUsers.customerId, customerId));
    if (existing.some((a) => a.email === row.email)) return "already_present" as const;
    if (existing.some((a) => a.status !== "rejected")) return "customer_has_other_contact" as const;

    const [created] = await tx
      .insert(customerUsers)
      .values({
        customerId,
        email: row.email,
        name: row.name,
        // Bez lozinke. `customer_users_password_lifecycle_ck` to i sprovodi.
        passwordHash: null,
        status: "requested",
        decidedBy: actor.id,
        decidedAt: sql`now()`,
        decisionReason: reason,
      })
      .onConflictDoNothing({ target: customerUsers.email })
      .returning({ id: customerUsers.id });
    if (!created) return "email_taken_other_customer" as const;

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.customerContactProposed,
        entityType: "Kupčev nalog",
        entityId: created.id,
        entityLabel: row.email,
        after: { status: "requested", kupac: customer.name, nacin: "grupni_predlog", sifra: row.code },
        reason,
        correlationId: randomUUID(),
      },
      tx,
    );
    return "created" as const;
  });
}
