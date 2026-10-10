import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { issueInvitation } from "@/lib/customers/invitation-service";
import { trialCustomerIds } from "@/lib/ordering/trial";

/** Izdvojeni test kupci probe sa svojim probnim nalozima (za vlasnika). */
export async function trialOverview() {
  const ids = await trialCustomerIds();
  if (!ids.length) return [];
  const rows = await getDb().execute<{ id: string; name: string; accounts: { email: string; status: string }[] | null }>(sql`
    SELECT c.id, c.name,
           (SELECT json_agg(json_build_object('email', u.email, 'status', u.status::text) ORDER BY u.created_at)
              FROM customer_users u WHERE u.customer_id = c.id) AS accounts
      FROM customers c WHERE c.id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`);
  return [...rows].map((r) => ({ customerId: r.id, name: r.name, accounts: r.accounts ?? [] }));
}

/**
 * Probni nalog kupca — SAMO za izdvojenog test kupca i samo vlasnik. Nalog se
 * pravi bez lozinke; poziv daje jednokratan link na kome VLASNIK postavlja
 * lozinku. Ništa se ne šalje e-poštom (poziv ostaje u redu za ručnu predaju).
 */
export async function createTrialAccount(actor: PortalUser, input: { customerId: string; email: string; name: string }) {
  if (!can(actor, "customer_accounts:manage") || !can(actor, "prices:approve")) throw new Error("Probni nalog pravi samo vlasnik.");
  if (!(await trialCustomerIds()).includes(input.customerId)) throw new Error("Probni nalog je moguć samo za izdvojenog test kupca.");
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Neispravna e-pošta.");
  const name = input.name.trim().slice(0, 120) || "Probni nalog";
  const db = getDb();
  const [taken] = [...(await db.execute<{ id: string; customer_id: string }>(sql`SELECT id, customer_id FROM customer_users WHERE lower(email) = ${email}`))];
  if (taken && taken.customer_id !== input.customerId) throw new Error("Ta e-pošta već pripada nalogu druge firme.");
  const accountId = taken?.id ?? [...(await db.execute<{ id: string }>(sql`
    INSERT INTO customer_users (customer_id, email, name, password_hash, status, decided_by, decided_at, decision_reason)
    VALUES (${input.customerId}::uuid, ${email}, ${name}, NULL, 'requested', ${actor.id}::uuid, now(), 'Probni nalog kontrolisane probe (test kupac)')
    RETURNING id`))][0].id;
  const issued = await issueInvitation({ accountId, reason: "Probni nalog kontrolisane probe zahteva za porudžbinu" }, { id: actor.id, name: actor.name, role: actor.role });
  return { link: `/prijava/kupac/aktivacija?token=${encodeURIComponent(issued.token)}`, expiresAt: issued.expiresAt };
}
