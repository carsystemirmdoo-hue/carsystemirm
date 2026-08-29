import "server-only";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customerContactConsents } from "@/db/schema";
import type {
  ConsentAction,
  ConsentPurpose,
} from "@/db/schema/consents";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import {
  ConsentError,
  CURRENT_CONSENT_TEXT_VERSION,
  effectiveConsents,
  rejectConsentEvent,
} from "@/lib/customers/consent.mjs";

export type ConsentState = Record<
  string,
  {
    granted: boolean;
    since: Date | string | null;
    textVersion: string | null;
    source: string | null;
  }
>;

/**
 * Trenutno stanje saglasnosti jednog naloga.
 *
 * `customerUserId` uvek dolazi iz `requireCustomerSession()`. Funkcija namerno
 * nema drugi parametar identiteta — dok takav parametar ne postoji, kupac ne
 * može da traži tuđe saglasnosti ni greškom pozivaoca.
 */
export async function loadConsentState(
  customerUserId: string,
): Promise<ConsentState> {
  if (!customerUserId) {
    throw new ConsentError(
      "Upit saglasnosti bez naloga se ne sme izvršiti.",
      "missing_account",
    );
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(customerContactConsents)
    .where(eq(customerContactConsents.customerUserId, customerUserId))
    .orderBy(asc(customerContactConsents.id));

  return effectiveConsents(rows) as ConsentState;
}

/** Cela istorija jednog naloga, najstarije prvo. Za pregled i pravni uvid. */
export async function loadConsentHistory(customerUserId: string) {
  if (!customerUserId) {
    throw new ConsentError(
      "Upit saglasnosti bez naloga se ne sme izvršiti.",
      "missing_account",
    );
  }
  const db = getDb();
  return db
    .select()
    .from(customerContactConsents)
    .where(eq(customerContactConsents.customerUserId, customerUserId))
    .orderBy(asc(customerContactConsents.id))
    .limit(500);
}

export type ConsentActor =
  | { kind: "customer"; accountId: string; email: string; customerName: string }
  | { kind: "staff"; id: string; name: string; role: string };

/**
 * Upisuje jedan događaj saglasnosti.
 *
 * Nikada ne menja i ne briše raniji red — dodaje nov. Zato ovde nema `update`
 * ni `delete`, i to je jedina garancija koju append-only model ima na
 * aplikativnom nivou.
 */
export async function recordConsentEvent(
  input: {
    customerUserId: string;
    purpose: ConsentPurpose;
    action: ConsentAction;
    source: "customer_self_service" | "office_recorded_offline";
    consentTextVersion?: string;
    note?: string | null;
  },
  actor: ConsentActor,
): Promise<void> {
  const consentTextVersion =
    input.consentTextVersion ?? CURRENT_CONSENT_TEXT_VERSION;
  const recordedBy = actor.kind === "staff" ? actor.id : null;

  const refusal = rejectConsentEvent({
    purpose: input.purpose,
    action: input.action,
    source: input.source,
    consentTextVersion,
    recordedBy,
  });
  if (refusal) throw new ConsentError(refusal, "bad_event");

  /*
   * Kupac upisuje samo za SEBE.
   *
   * Provera stoji ovde, a ne samo u ruti: servis je jedini ulaz, pa je i jedino
   * mesto na kome se ovo ne može zaboraviti pri dodavanju nove rute.
   */
  if (actor.kind === "customer" && actor.accountId !== input.customerUserId) {
    throw new ConsentError(
      "Saglasnost se upisuje isključivo za sopstveni nalog.",
      "forbidden",
    );
  }

  const db = getDb();
  const correlationId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(customerContactConsents).values({
      customerUserId: input.customerUserId,
      purpose: input.purpose,
      action: input.action,
      source: input.source,
      consentTextVersion,
      recordedBy,
      note: input.note?.trim() || null,
    });

    await recordAudit(
      {
        actor:
          actor.kind === "staff"
            ? { id: actor.id, name: actor.name, role: actor.role }
            : {
                /*
                 * Kupčev nalog nije `users.id`, pa `actorUserId` ostaje `null`
                 * — strani ključ pokazuje na internu tabelu. Ime nosi firmu i
                 * ulogu „kupac", da red ostane čitljiv bez spajanja tabela.
                 */
                id: null,
                name: actor.customerName,
                role: "kupac",
              },
        action: AUDIT_ACTIONS.customerConsentRecorded,
        entityType: "Saglasnost kupca",
        entityId: input.customerUserId,
        // E-pošta je login identitet naloga; PIB, adresa i telefon NE ulaze.
        entityLabel: actor.kind === "customer" ? actor.email : input.customerUserId,
        after: {
          svrha: input.purpose,
          odluka: input.action,
          izvor: input.source,
          verzijaTeksta: consentTextVersion,
        },
        reason:
          input.action === "granted"
            ? "Kupac dao saglasnost."
            : "Kupac povukao saglasnost.",
        correlationId,
      },
      tx,
    );
  });
}

export { ConsentError };
