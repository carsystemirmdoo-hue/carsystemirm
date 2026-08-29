import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customers, customerUsers } from "@/db/schema";
import type { CustomerAccountStatus } from "@/db/schema/customer-accounts";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { hashPassword } from "@/lib/auth/password.mjs";
import { canCustomerSignIn } from "@/lib/authz/customer-scope.mjs";

export type AccountActor = { id: string; name: string; role: string };

export class CustomerAccountError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "CustomerAccountError";
  }
}

export type CustomerAccountView = {
  id: string;
  customerId: string;
  customerName: string;
  email: string;
  name: string;
  status: CustomerAccountStatus;
  lastLoginAt: Date | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  createdAt: Date;
};

/**
 * Otvara nalog kupcu.
 *
 * Nalog se otvara u stanju `approved` — otvoren, ali još nijednom korišćen.
 * Prvo uspešno prijavljivanje ga prevodi u `active`. Razlika nije kozmetička:
 * nalog koji je godinu dana `approved` je nalog koji niko nije preuzeo, i to
 * je podatak koji kancelarija mora da vidi.
 */
export async function createCustomerAccount(
  input: {
    customerId: string;
    email: string;
    name: string;
    password: string;
    reason: string;
  },
  actor: AccountActor,
): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();
  const reason = input.reason.trim();

  if (reason.length < 3) {
    throw new CustomerAccountError(
      "Otvaranje naloga traži razlog (najmanje 3 znaka).",
      "missing_reason",
    );
  }
  if (input.password.length < 12) {
    throw new CustomerAccountError(
      "Lozinka kupčevog naloga mora imati najmanje 12 znakova.",
      "weak_password",
    );
  }

  const db = getDb();

  const customer = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(eq(customers.id, input.customerId))
    .limit(1);
  if (customer.length === 0) {
    throw new CustomerAccountError("Kupac ne postoji.", "customer_not_found");
  }

  const existing = await db
    .select({ id: customerUsers.id })
    .from(customerUsers)
    .where(eq(customerUsers.email, email))
    .limit(1);
  if (existing.length > 0) {
    throw new CustomerAccountError(
      "Nalog sa tom e-poštom već postoji.",
      "duplicate_email",
    );
  }

  const passwordHash = await hashPassword(input.password);
  const correlationId = randomUUID();

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(customerUsers)
      .values({
        customerId: input.customerId,
        email,
        name: input.name.trim(),
        passwordHash,
        status: "approved",
        decidedBy: actor.id,
        decidedAt: sql`now()`,
        decisionReason: reason,
      })
      .returning({ id: customerUsers.id });

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.customerAccountCreated,
        entityType: "Kupčev nalog",
        entityId: created.id,
        entityLabel: email,
        // Lozinka ne ide u trag; `buildAuditEntry` je i inače redigovao.
        after: { status: "approved", kupac: customer[0].name },
        reason,
        correlationId,
      },
      tx,
    );

    return { id: created.id };
  });
}

/**
 * Menja stanje naloga i opoziva sve njegove sesije.
 *
 * Opoziv je uvek, ne samo pri isključenju: i vraćanje iz `suspended` je odluka
 * posle koje stari token ne sme da preživi. Verzija se povećava u ISTOJ
 * transakciji kao i stanje, pa ne postoji trenutak u kome je nalog isključen a
 * sesija još važi.
 */
export async function setCustomerAccountStatus(
  input: {
    accountId: string;
    status: Extract<
      CustomerAccountStatus,
      "approved" | "suspended" | "rejected"
    >;
    reason: string;
  },
  actor: AccountActor,
): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new CustomerAccountError(
      "Promena stanja naloga traži razlog (najmanje 3 znaka).",
      "missing_reason",
    );
  }

  const db = getDb();
  const rows = await db
    .select({
      id: customerUsers.id,
      email: customerUsers.email,
      status: customerUsers.status,
    })
    .from(customerUsers)
    .where(eq(customerUsers.id, input.accountId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new CustomerAccountError("Nalog ne postoji.", "not_found");

  await db.transaction(async (tx) => {
    await tx
      .update(customerUsers)
      .set({
        status: input.status,
        decidedBy: actor.id,
        decidedAt: sql`now()`,
        decisionReason: reason,
        sessionVersion: sql`${customerUsers.sessionVersion} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(customerUsers.id, input.accountId));

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.customerAccountStatusChanged,
        entityType: "Kupčev nalog",
        entityId: input.accountId,
        entityLabel: row.email,
        before: { status: row.status },
        after: { status: input.status },
        reason,
        correlationId: randomUUID(),
      },
      tx,
    );
  });
}

/** Prvo uspešno prijavljivanje prevodi nalog iz `approved` u `active`. */
export async function markCustomerSignedIn(accountId: string): Promise<void> {
  const db = getDb();
  await db
    .update(customerUsers)
    .set({
      status: sql`CASE WHEN ${customerUsers.status} = 'approved'
                       THEN 'active'::customer_account_status
                       ELSE ${customerUsers.status} END`,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(customerUsers.id, accountId));
}

/**
 * Nalog po e-pošti, za prijavu.
 *
 * Vraća red bez obzira na stanje: odluku o tome ko sme unutra donosi jedno
 * mesto (`canCustomerSignIn`), a ne upit. Kad bi upit filtrirao, „nalog ne
 * postoji" i „nalog je isključen" bi se razlikovali po vremenu odgovora.
 */
export async function findCustomerAccountByEmail(email: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(customerUsers)
    .where(eq(customerUsers.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

/** Pregled naloga za kancelariju i gazdu. */
export async function listCustomerAccounts(filter?: {
  status?: CustomerAccountStatus;
}): Promise<CustomerAccountView[]> {
  const db = getDb();
  return db
    .select({
      id: customerUsers.id,
      customerId: customerUsers.customerId,
      customerName: customers.name,
      email: customerUsers.email,
      name: customerUsers.name,
      status: customerUsers.status,
      lastLoginAt: customerUsers.lastLoginAt,
      decidedAt: customerUsers.decidedAt,
      decisionReason: customerUsers.decisionReason,
      createdAt: customerUsers.createdAt,
    })
    .from(customerUsers)
    .innerJoin(customers, eq(customers.id, customerUsers.customerId))
    .where(filter?.status ? eq(customerUsers.status, filter.status) : undefined)
    .orderBy(asc(customers.name), asc(customerUsers.email))
    .limit(500);
}

/** Broj naloga koji trenutno smeju da se prijave, po kupcu. */
export async function countSignableAccounts(customerId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ status: customerUsers.status })
    .from(customerUsers)
    .where(
      and(
        eq(customerUsers.customerId, customerId),
        sql`${customerUsers.status} IN ('approved', 'active')`,
      ),
    );
  return rows.filter((row) => canCustomerSignIn(row.status)).length;
}
