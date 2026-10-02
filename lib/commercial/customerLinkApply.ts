import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customerExternalIdentifiers, customers } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { planCustomerLinks } from "@/lib/commercial/customerLinkPlan.mjs";

/**
 * Primena POTVRĐENIH predloga veze kupaca (`customerLinkPlan.mjs`).
 *
 * - Plan se uvek računa ponovo nad stanjem baze u trenutku primene; potvrda
 *   važi samo ako se otisak predloga (`key`) poklapa — inače je zastarela.
 * - Jedan partner = jedna transakcija: kupac (ako je nov) + šifra + trag.
 * - Ponovno pokretanje ne pravi duplikate: kupac je jedinstven po PIB-u,
 *   šifra po (izvor, izdavalac, šifra), a već povezan partner je `already_linked`.
 * - Nalog za prijavu (`customer_users`) se NIKAD ne pravi.
 */

export const SOURCE_SYSTEM = "biznisoft";

export type LinkActor = { id: string; name: string; role: string };
type Register = Parameters<typeof planCustomerLinks>[0]["register"];
type InvoicePartners = Parameters<typeof planCustomerLinks>[0]["invoicePartners"];

export async function loadLinkState(issuerCode: string, invoicePartners: InvoicePartners) {
  const db = getDb();
  const pibs = [...new Set(invoicePartners.map((p) => p.pib).filter((p): p is string => Boolean(p)))];
  const codes = [...new Set(invoicePartners.map((p) => p.code))];
  const customerRows = pibs.length
    ? await db.select({ id: customers.id, name: customers.name, pib: customers.pib }).from(customers).where(inArray(customers.pib, pibs))
    : [];
  const identRows = codes.length
    ? await db
        .select({
          code: customerExternalIdentifiers.externalPartnerCode,
          customerId: customerExternalIdentifiers.customerId,
          status: customerExternalIdentifiers.status,
        })
        .from(customerExternalIdentifiers)
        .where(
          and(
            eq(customerExternalIdentifiers.sourceSystem, SOURCE_SYSTEM),
            eq(customerExternalIdentifiers.issuerCode, issuerCode),
            inArray(customerExternalIdentifiers.externalPartnerCode, codes),
          ),
        )
    : [];
  return {
    customersByPib: new Map(customerRows.map((c) => [c.pib, { id: c.id, name: c.name }])),
    identifiers: new Map(identRows.map((i) => [i.code, { customerId: i.customerId, status: i.status }])),
  };
}

export async function planFromDatabase(input: { issuerCode: string; register: Register; invoicePartners: InvoicePartners }) {
  const existing = await loadLinkState(input.issuerCode, input.invoicePartners);
  return planCustomerLinks({ ...input, existing });
}

export type LinkDecision = { key: string; decision: "potvrdi" | "odbij" | ""; confirmedBy: string };

export type ApplyOutcome = {
  key: string;
  invoiceCode: string;
  result: "created_and_linked" | "linked_existing" | "already_linked" | "stale" | "not_confirmed" | "would_apply";
};

export async function applyConfirmedLinks(
  input: {
    issuerCode: string;
    register: Register;
    invoicePartners: InvoicePartners;
    decisions: readonly LinkDecision[];
    dryRun: boolean;
  },
  actor: LinkActor,
): Promise<ApplyOutcome[]> {
  const { proposals } = await planFromDatabase(input);
  const byKey = new Map(proposals.map((p) => [p.key, p]));
  const outcomes: ApplyOutcome[] = [];

  for (const d of input.decisions) {
    const p = byKey.get(d.key);
    if (d.decision !== "potvrdi" || !d.confirmedBy.trim()) {
      outcomes.push({ key: d.key, invoiceCode: p?.invoiceCode ?? "?", result: "not_confirmed" });
      continue;
    }
    if (!p) {
      outcomes.push({ key: d.key, invoiceCode: "?", result: "stale" });
      continue;
    }
    if (p.action === "already_linked") {
      outcomes.push({ key: d.key, invoiceCode: p.invoiceCode, result: "already_linked" });
      continue;
    }
    if (input.dryRun) {
      outcomes.push({ key: d.key, invoiceCode: p.invoiceCode, result: "would_apply" });
      continue;
    }
    outcomes.push(await applyOne(p, d.confirmedBy.trim(), input.issuerCode, actor));
  }
  return outcomes;
}

type Proposal = ReturnType<typeof planCustomerLinks>["proposals"][number];

async function applyOne(p: Proposal, confirmedBy: string, issuerCode: string, actor: LinkActor): Promise<ApplyOutcome> {
  const db = getDb();
  const label = `${SOURCE_SYSTEM}/${issuerCode}/${p.invoiceCode}`;
  const reason =
    `Potvrdio u pregledu: ${confirmedBy}; primenio: ${actor.name}. Šifra sa fakture ${p.invoiceCode} = šifra ${p.registerCode} u šifarniku ` +
    `(jedinstvena bez vodećih nula), PIB sa fakture jednak PIB-u u šifarniku.`;
  const correlationId = randomUUID();

  return db.transaction(async (tx) => {
    let customerId = p.customerId as string | null;
    if (p.action === "create_customer_and_link") {
      const [created] = await tx
        .insert(customers)
        .values({ pib: p.pib as string, name: (p.name as string) ?? p.invoiceCode, city: p.city ?? null })
        .onConflictDoNothing({ target: customers.pib })
        .returning({ id: customers.id });
      // Kupac sa tim PIB-om nastao je posle pravljenja predloga — predlog je zastareo.
      if (!created) return { key: p.key, invoiceCode: p.invoiceCode, result: "stale" as const };
      customerId = created.id;
    }

    const [existing] = await tx
      .select({ id: customerExternalIdentifiers.id, customerId: customerExternalIdentifiers.customerId, status: customerExternalIdentifiers.status })
      .from(customerExternalIdentifiers)
      .where(
        and(
          eq(customerExternalIdentifiers.sourceSystem, SOURCE_SYSTEM),
          eq(customerExternalIdentifiers.issuerCode, issuerCode),
          eq(customerExternalIdentifiers.externalPartnerCode, p.invoiceCode),
        ),
      )
      .for("update")
      .limit(1);

    const values = {
      customerId,
      status: "mapped" as const,
      sourceName: p.name ?? null,
      note: reason,
      verifiedBy: actor.id,
      verifiedAt: sql`now()`,
      updatedAt: sql`now()`,
    };
    let identifierId: string;
    if (existing) {
      // Samo nepovezana šifra se dopunjuje; sve drugo je promena posle predloga.
      if (existing.customerId || existing.status !== "unmapped") {
        tx.rollback();
      }
      await tx.update(customerExternalIdentifiers).set(values).where(eq(customerExternalIdentifiers.id, existing.id));
      identifierId = existing.id;
    } else {
      const [inserted] = await tx
        .insert(customerExternalIdentifiers)
        .values({ ...values, sourceSystem: SOURCE_SYSTEM, issuerCode, externalPartnerCode: p.invoiceCode, createdBy: actor.id })
        .returning({ id: customerExternalIdentifiers.id });
      identifierId = inserted.id;
    }

    if (p.action === "create_customer_and_link") {
      await recordAudit(
        {
          actor,
          action: AUDIT_ACTIONS.partnerPromotedToCustomer,
          entityType: "Šifra partnera",
          entityId: identifierId,
          entityLabel: label,
          after: { nacin: "create", customerId, sifarnik: p.registerCode },
          reason,
          correlationId,
        },
        tx,
      );
    }
    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.externalIdentifierMapped,
        entityType: "Šifra partnera",
        entityId: identifierId,
        entityLabel: label,
        before: { status: existing?.status ?? null, customerId: null },
        after: { status: "mapped", customerId, sifarnik: p.registerCode },
        reason,
        correlationId,
      },
      tx,
    );
    return {
      key: p.key,
      invoiceCode: p.invoiceCode,
      result: p.action === "create_customer_and_link" ? ("created_and_linked" as const) : ("linked_existing" as const),
    };
  }).catch((error: unknown) => {
    // `tx.rollback()` — stanje šifre se promenilo posle predloga.
    if (error instanceof Error && /rollback/i.test(error.message)) {
      return { key: p.key, invoiceCode: p.invoiceCode, result: "stale" as const };
    }
    throw error;
  });
}
