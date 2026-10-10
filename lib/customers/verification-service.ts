import "server-only";
import { isTrialCustomer } from "@/lib/ordering/trial";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import {
  customerAccountTokens,
  customerContactVerifications,
  customerExternalIdentifiers,
  customers,
  customerUsers,
  users,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import {
  decideActivation,
  decideInvitation,
  GATE_REASONS,
  validateVerificationInput,
} from "@/lib/customers/contactVerification.mjs";
import {
  CustomerAccountError,
  type AccountActor,
} from "@/lib/customers/account-service";
import { notify } from "@/lib/notifications/notification-service";

type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type GateReason = keyof typeof GATE_REASONS;

/**
 * Sve što kapija poziva treba da zna o jednom nalogu, u jednom čitanju.
 *
 * Identiteti se čitaju za KUPCA naloga, a ne za šifru iz zahteva — pozivalac
 * ne bira na osnovu čega se firma smatra identifikovanom.
 */
export async function loadGateInput(accountId: string, executor: Executor = getDb()) {
  const [account] = await executor
    .select({
      id: customerUsers.id,
      customerId: customerUsers.customerId,
      email: customerUsers.email,
      status: customerUsers.status,
      customerActive: customers.active,
    })
    .from(customerUsers)
    .innerJoin(customers, eq(customers.id, customerUsers.customerId))
    .where(eq(customerUsers.id, accountId))
    .limit(1);
  if (!account) return null;

  const identifiers = await executor
    .select({
      id: customerExternalIdentifiers.id,
      customerId: customerExternalIdentifiers.customerId,
      status: customerExternalIdentifiers.status,
    })
    .from(customerExternalIdentifiers)
    .where(eq(customerExternalIdentifiers.customerId, account.customerId));

  const [verification] = await executor
    .select({
      id: customerContactVerifications.id,
      customerUserId: customerContactVerifications.customerUserId,
      customerId: customerContactVerifications.customerId,
      basisIdentifierId: customerContactVerifications.basisIdentifierId,
      verifiedEmail: customerContactVerifications.verifiedEmail,
      verifiedAt: customerContactVerifications.verifiedAt,
      revokedAt: customerContactVerifications.revokedAt,
    })
    .from(customerContactVerifications)
    .where(
      and(
        eq(customerContactVerifications.customerUserId, accountId),
        isNull(customerContactVerifications.revokedAt),
      ),
    )
    .limit(1);

  return {
    account: {
      id: account.id,
      customerId: account.customerId,
      email: account.email,
      status: account.status as string,
    },
    customerActive: account.customerActive,
    identifiers,
    verification: verification ?? null,
  };
}

/** Kapija za izdavanje poziva, nad bazom. */
export async function checkInvitationGate(
  accountId: string,
  executor: Executor = getDb(),
  now: Date = new Date(),
) {
  const input = await loadGateInput(accountId, executor);
  if (!input) return { allowed: false, reasons: [] as GateReason[], found: false };
  // Izdvojeni TEST kupac kontrolisane probe (nema BizniSoft partnera): kapija se ne traži.
  if (input.customerActive && (await isTrialCustomer(input.account.customerId))) return { allowed: true, reasons: [] as GateReason[], found: true };
  return { ...decideInvitation({ ...input, now }), found: true };
}

/** Kapija za aktivaciju, nad bazom. */
export async function checkActivationGate(
  accountId: string,
  executor: Executor = getDb(),
  now: Date = new Date(),
) {
  const input = await loadGateInput(accountId, executor);
  if (!input) return { allowed: false, reasons: [] as GateReason[] };
  if (input.customerActive && (await isTrialCustomer(input.account.customerId))) return { allowed: true, reasons: [] as GateReason[] };
  return decideActivation({ ...input, now });
}

/** Postgresov kod iz drizzle omotača (vidi `cause` lanac). */
function pgCode(error: unknown): string | undefined {
  let e: unknown = error;
  for (let i = 0; i < 5 && e && typeof e === "object"; i += 1) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export type VerifyContactInput = {
  accountId: string;
  basisIdentifierId: string;
  method: string;
  contactSource: string;
  sourceReference?: string | null;
  evidenceNote: string;
  personRole: string;
};

/**
 * Beleži da je osoba potvrđena kao ovlašćena za podatke firme.
 *
 * Ne izdaje poziv i ne menja stanje naloga: potvrda i poziv su dve odluke, i
 * tek zajedno otvaraju pristup. Šifra partnera na kojoj potvrda počiva mora
 * biti `mapped` baš na kupca ovog naloga — inače bi potvrda za jednu firmu
 * otvorila podatke druge.
 */
export async function verifyCustomerContact(
  input: VerifyContactInput,
  actor: AccountActor,
): Promise<{ id: string }> {
  const invalid = validateVerificationInput(input);
  if (invalid) throw new CustomerAccountError(invalid, "invalid_input");

  const db = getDb();
  const correlationId = randomUUID();

  try {
    return await db.transaction(async (tx) => {
      const [account] = await tx
        .select({
          id: customerUsers.id,
          customerId: customerUsers.customerId,
          email: customerUsers.email,
          status: customerUsers.status,
        })
        .from(customerUsers)
        .where(eq(customerUsers.id, input.accountId))
        .for("update")
        .limit(1);
      if (!account) throw new CustomerAccountError("Nalog ne postoji.", "not_found");
      if (account.status !== "requested" && account.status !== "approved") {
        throw new CustomerAccountError(
          "Potvrda se beleži samo za nalog koji čeka poziv (zatražen ili odobren).",
          "bad_status",
        );
      }

      const [basis] = await tx
        .select({
          id: customerExternalIdentifiers.id,
          customerId: customerExternalIdentifiers.customerId,
          status: customerExternalIdentifiers.status,
          code: customerExternalIdentifiers.externalPartnerCode,
        })
        .from(customerExternalIdentifiers)
        .where(eq(customerExternalIdentifiers.id, input.basisIdentifierId))
        .limit(1);
      if (!basis || basis.status !== "mapped" || basis.customerId !== account.customerId) {
        throw new CustomerAccountError(
          "Izabrana šifra partnera nije potvrđeno povezana sa firmom ovog naloga.",
          "basis_invalid",
        );
      }

      const [created] = await tx
        .insert(customerContactVerifications)
        .values({
          customerUserId: account.id,
          customerId: account.customerId,
          basisIdentifierId: basis.id,
          verifiedEmail: account.email,
          personRole: input.personRole.trim(),
          method: input.method as "callback_known_number",
          contactSource: input.contactSource as "biznisoft_partner_record",
          sourceReference: input.sourceReference?.trim() || null,
          evidenceNote: input.evidenceNote.trim(),
          verifiedBy: actor.id,
        })
        .returning({ id: customerContactVerifications.id });

      await recordAudit(
        {
          actor,
          action: AUDIT_ACTIONS.customerContactVerified,
          entityType: "Kupčev nalog",
          entityId: account.id,
          entityLabel: account.email,
          // Beleška o dokazu NE ide u trag — ume da sadrži ime i telefon.
          after: {
            nacin: input.method,
            izvorKontakta: input.contactSource,
            sifraPartnera: basis.code,
          },
          reason: `Potvrđena ovlašćena osoba (${input.personRole.trim()}).`,
          correlationId,
        },
        tx,
      );
      return { id: created.id };
    });
  } catch (error) {
    if (pgCode(error) === "23505") {
      throw new CustomerAccountError(
        "Nalog već ima važeću potvrdu. Za izmenu je prvo opozovite.",
        "already_verified",
      );
    }
    throw error;
  }
}

/**
 * Opoziv pristupa jedne osobe — jedna radnja, jedna transakcija:
 *
 *   - živa potvrda osobe se opoziva;
 *   - svi otvoreni pozivi i reseti lozinke se poništavaju;
 *   - nalog prelazi u `suspended` (osim ako je već odbijen);
 *   - `session_version` raste, pa svaka postojeća sesija pada pri sledećem
 *     zahtevu.
 *
 * Koristi se i pri promeni kontakt osobe: stara osoba se opoziva, nova se
 * predlaže, potvrđuje i poziva kao svaki drugi nalog.
 */
export async function revokeCustomerAccess(
  input: { accountId: string; reason: string },
  actor: AccountActor,
): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new CustomerAccountError(
      "Opoziv pristupa traži razlog (najmanje 3 znaka).",
      "missing_reason",
    );
  }
  const db = getDb();
  const correlationId = randomUUID();

  await db.transaction(async (tx) => {
    const [account] = await tx
      .select({
        id: customerUsers.id,
        email: customerUsers.email,
        status: customerUsers.status,
      })
      .from(customerUsers)
      .where(eq(customerUsers.id, input.accountId))
      .for("update")
      .limit(1);
    if (!account) throw new CustomerAccountError("Nalog ne postoji.", "not_found");

    const revoked = await tx
      .update(customerContactVerifications)
      .set({ revokedAt: sql`now()`, revokedBy: actor.id, revokeReason: reason })
      .where(
        and(
          eq(customerContactVerifications.customerUserId, account.id),
          isNull(customerContactVerifications.revokedAt),
        ),
      )
      .returning({ id: customerContactVerifications.id });

    const superseded = await tx
      .update(customerAccountTokens)
      .set({ supersededAt: sql`now()` })
      .where(
        and(
          eq(customerAccountTokens.customerUserId, account.id),
          isNull(customerAccountTokens.usedAt),
          isNull(customerAccountTokens.supersededAt),
        ),
      )
      .returning({ id: customerAccountTokens.id });

    const nextStatus = account.status === "rejected" ? "rejected" : "suspended";
    await tx
      .update(customerUsers)
      .set({
        status: nextStatus,
        decidedBy: actor.id,
        decidedAt: sql`now()`,
        decisionReason: reason,
        sessionVersion: sql`${customerUsers.sessionVersion} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(customerUsers.id, account.id));

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.customerAccessRevoked,
        entityType: "Kupčev nalog",
        entityId: account.id,
        entityLabel: account.email,
        before: { status: account.status },
        after: {
          status: nextStatus,
          opozvanaPotvrda: revoked.length > 0,
          ponistenihTokena: superseded.length,
        },
        reason,
        correlationId,
      },
      tx,
    );
    if (revoked.length > 0) {
      await recordAudit(
        {
          actor,
          action: AUDIT_ACTIONS.customerContactVerificationRevoked,
          entityType: "Kupčev nalog",
          entityId: account.id,
          entityLabel: account.email,
          reason,
          correlationId,
        },
        tx,
      );
    }

    await notify(
      {
        kind: "customer_account_status_changed",
        severity: "warning",
        requiredCapability: "customer_accounts:manage",
        title: "Opozvan pristup kupčevog naloga",
        body: `Pristup je opozvan i sve sesije su prekinute. Razlog: ${reason}`,
        entityType: "Kupcev nalog",
        entityId: account.id,
        actionHref: "/portal/kupci/nalozi",
        context: { staro: account.status, novo: nextStatus },
        correlationId,
        dedupeKey: `customer_access_revoked:${account.id}:${correlationId}`,
      },
      tx,
    );
  });
}

export type AccountGateView = {
  accountId: string;
  allowed: boolean;
  reasons: GateReason[];
  verification: {
    method: string;
    contactSource: string;
    personRole: string;
    verifiedAt: Date;
    verifiedByName: string | null;
  } | null;
  /** Potvrđene šifre partnera firme — ponuda za „na osnovu čega". */
  mappedIdentifiers: { id: string; code: string; issuerCode: string; sourceName: string | null }[];
};

/**
 * Stanje kapije za više naloga odjednom, za ekran kancelarije.
 * Tri upita bez obzira na broj naloga.
 */
export async function listAccountGates(
  accountIds: readonly string[],
  now: Date = new Date(),
): Promise<Map<string, AccountGateView>> {
  const out = new Map<string, AccountGateView>();
  if (accountIds.length === 0) return out;
  const db = getDb();

  const accounts = await db
    .select({
      id: customerUsers.id,
      customerId: customerUsers.customerId,
      email: customerUsers.email,
      status: customerUsers.status,
      customerActive: customers.active,
    })
    .from(customerUsers)
    .innerJoin(customers, eq(customers.id, customerUsers.customerId))
    .where(inArray(customerUsers.id, [...accountIds]));

  const customerIds = [...new Set(accounts.map((a) => a.customerId))];
  const identifiers = customerIds.length
    ? await db
        .select({
          id: customerExternalIdentifiers.id,
          customerId: customerExternalIdentifiers.customerId,
          status: customerExternalIdentifiers.status,
          code: customerExternalIdentifiers.externalPartnerCode,
          issuerCode: customerExternalIdentifiers.issuerCode,
          sourceName: customerExternalIdentifiers.sourceName,
        })
        .from(customerExternalIdentifiers)
        .where(inArray(customerExternalIdentifiers.customerId, customerIds))
        .orderBy(asc(customerExternalIdentifiers.externalPartnerCode))
    : [];

  const live = await db
    .select({
      customerUserId: customerContactVerifications.customerUserId,
      customerId: customerContactVerifications.customerId,
      basisIdentifierId: customerContactVerifications.basisIdentifierId,
      verifiedEmail: customerContactVerifications.verifiedEmail,
      verifiedAt: customerContactVerifications.verifiedAt,
      method: customerContactVerifications.method,
      contactSource: customerContactVerifications.contactSource,
      personRole: customerContactVerifications.personRole,
      verifiedByName: users.name,
    })
    .from(customerContactVerifications)
    .leftJoin(users, eq(users.id, customerContactVerifications.verifiedBy))
    .where(
      and(
        inArray(customerContactVerifications.customerUserId, [...accountIds]),
        isNull(customerContactVerifications.revokedAt),
      ),
    );

  for (const a of accounts) {
    const ids = identifiers.filter((i) => i.customerId === a.customerId);
    const v = live.find((x) => x.customerUserId === a.id) ?? null;
    const gate = decideInvitation({
      account: { id: a.id, customerId: a.customerId, email: a.email, status: a.status },
      customerActive: a.customerActive,
      identifiers: ids,
      verification: v ? { ...v, revokedAt: null } : null,
      now,
    });
    out.set(a.id, {
      accountId: a.id,
      allowed: gate.allowed,
      reasons: gate.reasons,
      verification: v
        ? {
            method: v.method,
            contactSource: v.contactSource,
            personRole: v.personRole,
            verifiedAt: v.verifiedAt,
            verifiedByName: v.verifiedByName,
          }
        : null,
      mappedIdentifiers: ids
        .filter((i) => i.status === "mapped")
        .map((i) => ({ id: i.id, code: i.code, issuerCode: i.issuerCode, sourceName: i.sourceName })),
    });
  }
  return out;
}
