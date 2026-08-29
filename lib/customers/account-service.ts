import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customers, customerUsers } from "@/db/schema";
import type { CustomerAccountStatus } from "@/db/schema/customer-accounts";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
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
 * Predlaže kontakt-osobu kupca.
 *
 * Nalog nastaje u stanju `requested`: BEZ lozinke i BEZ prava prijave. Ovo je
 * jedina radnja koju komercijalista sme nad kupčevim nalogom, i samo za
 * dodeljenog kupca — opseg proverava pozivalac kroz `requireCustomerAccess`.
 *
 * Kancelarija/gazda kasnije izdaje poziv (`issueInvitation`), a lozinku
 * postavlja kupac. Niko iz firme je ne unosi i ne saznaje.
 */
export async function proposeCustomerContact(
  input: {
    customerId: string;
    email: string;
    name: string;
    reason: string;
  },
  actor: AccountActor,
): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();
  const reason = input.reason.trim();

  if (reason.length < 3) {
    throw new CustomerAccountError(
      "Predlog kontakta traži razlog (najmanje 3 znaka).",
      "missing_reason",
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

  const correlationId = randomUUID();

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(customerUsers)
      .values({
        customerId: input.customerId,
        email,
        name: input.name.trim(),
        // Bez lozinke. `customer_users_password_lifecycle_ck` to i sprovodi.
        passwordHash: null,
        status: "requested",
        decidedBy: actor.id,
        decidedAt: sql`now()`,
        decisionReason: reason,
      })
      .returning({ id: customerUsers.id });

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.customerContactProposed,
        entityType: "Kupčev nalog",
        entityId: created.id,
        entityLabel: email,
        after: { status: "requested", kupac: customer[0].name },
        reason,
        correlationId,
      },
      tx,
    );

    return { id: created.id };
  });
}

/* =========================================================================
 * Neuspela prijava, zaključavanje i audit — postflight F-4 i F-5
 * ====================================================================== */

/** Posle ovoliko uzastopnih promašaja nalog se zaključava na kratko. */
export const CUSTOMER_MAX_FAILED_ATTEMPTS = 8;
export const CUSTOMER_LOCK_MINUTES = 15;

/**
 * Beleži neuspeh prijave i, po potrebi, zaključava nalog.
 *
 * Brojač se uvećava U SQL-u (`failed_login_attempts + 1`), ne čitanjem pa
 * upisom: dva paralelna pokušaja bi inače oba pročitala istu staru vrednost i
 * upisala isti novi broj, pa bi napadač dobio dvostruko više pokušaja nego što
 * politika dozvoljava. Zaključavanje se računa iz vrednosti koju je baza
 * vratila, u istom `UPDATE`-u.
 */
export async function recordCustomerLoginFailure(input: {
  accountId: string;
  email: string;
  reason: "bad_password" | "inactive" | "locked";
  rateLimited: boolean;
}): Promise<void> {
  const db = getDb();

  if (input.rateLimited) {
    await recordAudit({
      actor: { id: null, name: input.email, role: "kupac" },
      action: AUDIT_ACTIONS.customerLoginLocked,
      entityType: "Kupčev nalog",
      entityId: input.accountId,
      entityLabel: input.email,
      reason: "Previše neuspelih pokušaja prijave",
    });
    return;
  }

  /*
   * Zaključan nalog se ne kažnjava dodatno — inače bi napadač produžavao
   * zaključavanje unedogled. Isto pravilo kao `shouldCountFailedAttempt`.
   */
  if (input.reason !== "bad_password") return;

  const [updated] = await db
    .update(customerUsers)
    .set({
      failedLoginAttempts: sql`${customerUsers.failedLoginAttempts} + 1`,
      lockedUntil: sql`CASE
        WHEN ${customerUsers.failedLoginAttempts} + 1 >= ${CUSTOMER_MAX_FAILED_ATTEMPTS}
        THEN now() + (${CUSTOMER_LOCK_MINUTES} || ' minutes')::interval
        ELSE ${customerUsers.lockedUntil}
      END`,
      updatedAt: sql`now()`,
    })
    .where(eq(customerUsers.id, input.accountId))
    .returning({
      attempts: customerUsers.failedLoginAttempts,
      lockedUntil: customerUsers.lockedUntil,
    });

  if (!updated) return;
  const locked = updated.attempts >= CUSTOMER_MAX_FAILED_ATTEMPTS;

  await recordAudit({
    actor: { id: null, name: input.email, role: "kupac" },
    action: locked
      ? AUDIT_ACTIONS.customerLoginLocked
      : AUDIT_ACTIONS.customerLoginFailed,
    entityType: "Kupčev nalog",
    entityId: input.accountId,
    entityLabel: input.email,
    reason: locked
      ? `${updated.attempts} uzastopnih neuspelih prijava — nalog zaključan ${CUSTOMER_LOCK_MINUTES} minuta`
      : `Neuspeli pokušaj prijave (${updated.attempts})`,
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

/**
 * Uspešna prijava: resetuje brojač i beleži trag.
 *
 * Stanje se NE menja — nalog je već `active` (aktivaciju radi pozivni token).
 * Ranije je ova funkcija prevodila `approved` u `active`, što je značilo da
 * prijava sama sebe proglašava aktivacijom; sada je aktivacija zaseban korak
 * koji troši token.
 */
export async function markCustomerSignedIn(
  accountId: string,
  email: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(customerUsers)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(customerUsers.id, accountId));

  await recordAudit({
    actor: { id: null, name: email, role: "kupac" },
    action: AUDIT_ACTIONS.customerLoginSucceeded,
    entityType: "Kupčev nalog",
    entityId: accountId,
    entityLabel: email,
    reason: "Uspešna prijava kupca",
  });
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

/**
 * Zapis za prijavu: nalog bez lozinke košta ISTO koliko i nalog sa lozinkom.
 *
 * Nalog u stanju `requested`/`approved` nema `password_hash`. Da se on vrati
 * kao `null`, provera lozinke bi se preskočila i odgovor bi stigao brže — pa
 * bi se iz vremena videlo da poziv još nije iskorišćen. Zamenski zapis održava
 * jedan scrypt prolaz; prijava svejedno pada, jer `canCustomerSignIn` propušta
 * samo `active`.
 *
 * Mapiranje živi OVDE, a ne u `auth.ts`: tamo bi `passwordHash` ušao u
 * povratni izraz i oborio proveru koja čuva da kredencijal ne izađe iz
 * `authorize` (`lib/auth/credentialsLogin.test.mjs`).
 */
export async function loadCustomerAccountForLogin(email: string) {
  const row = await findCustomerAccountByEmail(email);
  if (!row) return null;
  const { ABSENT_USER_PASSWORD_RECORD } = await import("@/lib/auth/password.mjs");
  return { ...row, passwordHash: row.passwordHash ?? ABSENT_USER_PASSWORD_RECORD };
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
