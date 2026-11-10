import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { PortalUser } from "@/lib/authz/user-repository";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { outcomeLabel, parseCallNote, parseContact, splitPhones } from "@/lib/sales-tools/customerDesk.mjs";
import { customerDebtLines } from "@/lib/sales-tools/receivables-service";

/**
 * Radni sto kupca (0061; 2026-11-10): kontakt, beleške razgovora sa podsetnikom i dugovanje.
 * Opseg je isti kao za preporuke: komercijalista samo dodeljene kupce.
 */

export class CustomerDeskError extends Error {}

export async function assertDeskScope(viewer: PortalUser, customerId: string) {
  const scope = await resolveLedgerScope(viewer);
  if (scope.customerIds !== null && !scope.customerIds.includes(customerId)) throw new CustomerDeskError("Kupac nije u Vašem opsegu.");
}

export type DeskPhone = { number: string; source: string };
export type CallNote = { id: string; outcome: string; outcomeLabel: string; body: string | null; followUpOn: string | null; done: boolean; by: string; at: string };

export async function loadCustomerDesk(viewer: PortalUser, customerId: string) {
  await assertDeskScope(viewer, customerId);
  const db = getDb();
  const today = belgradeDate(new Date());
  const [contactRows, partnerRows, orderRows, accountRows, noteRows, debt] = await Promise.all([
    db.execute<{ contact_name: string | null; phone: string | null; phone_alt: string | null; email: string | null; note: string | null; by: string; at: string }>(sql`
      SELECT s.contact_name, s.phone, s.phone_alt, s.email, s.note, u.name AS by, to_char(s.updated_at AT TIME ZONE 'Europe/Belgrade', 'YYYY-MM-DD') AS at
        FROM customer_sales_contacts s JOIN users u ON u.id = s.updated_by WHERE s.customer_id = ${customerId}::uuid`),
    db.execute<{ phone: string | null; email: string | null }>(sql`
      SELECT r.phone_raw AS phone, r.email_raw AS email
        FROM current_partner_records r JOIN customers c ON c.pib = r.pib
       WHERE c.id = ${customerId}::uuid AND (r.phone_raw IS NOT NULL OR r.email_raw IS NOT NULL) LIMIT 3`),
    db.execute<{ phone: string }>(sql`
      SELECT contact_phone AS phone FROM customer_orders
       WHERE customer_id = ${customerId}::uuid AND contact_phone IS NOT NULL ORDER BY submitted_at DESC LIMIT 1`),
    db.execute<{ name: string; email: string }>(sql`
      SELECT name, email FROM customer_users WHERE customer_id = ${customerId}::uuid AND status = 'active' ORDER BY name LIMIT 5`),
    db.execute<{ id: string; outcome: string; body: string | null; follow: string | null; done: boolean; by: string; at: string }>(sql`
      SELECT n.id, n.outcome, n.body, n.follow_up_on::text AS follow, n.follow_up_done_at IS NOT NULL AS done, u.name AS by,
             to_char(n.created_at AT TIME ZONE 'Europe/Belgrade', 'YYYY-MM-DD HH24:MI') AS at
        FROM customer_call_notes n JOIN users u ON u.id = n.created_by
       WHERE n.customer_id = ${customerId}::uuid ORDER BY n.created_at DESC LIMIT 20`),
    customerDebtLines(customerId, today),
  ]);

  const own = [...contactRows][0] ?? null;
  const phones: DeskPhone[] = [];
  const add = (number: string | null | undefined, source: string) => {
    if (!number) return;
    for (const n of splitPhones(number)) if (!phones.some((p) => p.number.replace(/\D/g, "") === n.replace(/\D/g, ""))) phones.push({ number: n, source });
  };
  add(own?.phone, "upisao komercijalista");
  add(own?.phone_alt, "upisao komercijalista");
  for (const p of partnerRows) add(p.phone, "BizniSoft kartica");
  for (const o of orderRows) add(o.phone, "iz poslednjeg zahteva kupca");

  const notes: CallNote[] = [...noteRows].map((n) => ({ id: n.id, outcome: n.outcome, outcomeLabel: outcomeLabel(n.outcome), body: n.body, followUpOn: n.follow, done: n.done, by: n.by, at: n.at }));
  const total = debt.lines.reduce((s, l) => s + l.remaining, 0);
  const overdue = debt.lines.filter((l) => (l.daysOverdue ?? 0) > 0);
  return {
    today,
    contact: own
      ? { contactName: own.contact_name, phone: own.phone, phoneAlt: own.phone_alt, email: own.email, note: own.note, updatedBy: own.by, updatedAt: own.at }
      : null,
    phones,
    emails: [...new Set([own?.email, ...[...partnerRows].map((p) => p.email), ...[...accountRows].map((a) => a.email)].filter((e): e is string => Boolean(e)))].slice(0, 4),
    accounts: [...accountRows].map((a) => a.name),
    notes,
    openFollowUp: notes.find((n) => n.followUpOn && !n.done) ?? null,
    debt: {
      checkedAt: debt.snapshot?.checkedAt ?? null,
      lines: debt.lines,
      total,
      overdueTotal: overdue.reduce((s, l) => s + l.remaining, 0),
      maxDaysOverdue: overdue.length ? Math.max(...overdue.map((l) => l.daysOverdue ?? 0)) : null,
    },
  };
}

export type CustomerDesk = Awaited<ReturnType<typeof loadCustomerDesk>>;

export async function saveCustomerContact(viewer: PortalUser, customerId: string, input: Record<string, unknown>) {
  await assertDeskScope(viewer, customerId);
  const parsed = parseContact(input);
  if (!parsed.ok) throw new CustomerDeskError(parsed.error);
  const v = parsed.value;
  await getDb().execute(sql`
    INSERT INTO customer_sales_contacts (customer_id, contact_name, phone, phone_alt, email, note, updated_by, updated_at)
    VALUES (${customerId}::uuid, ${v.contactName}, ${v.phone}, ${v.phoneAlt}, ${v.email}, ${v.note}, ${viewer.id}::uuid, now())
    ON CONFLICT (customer_id) DO UPDATE SET contact_name = EXCLUDED.contact_name, phone = EXCLUDED.phone, phone_alt = EXCLUDED.phone_alt,
      email = EXCLUDED.email, note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = now()`);
}

/**
 * Nova beleška. Ako je kupac imao otvoren podsetnik, on se zatvara — razgovor se upravo desio.
 */
export async function addCallNote(viewer: PortalUser, customerId: string, input: { outcome: unknown; body?: unknown; followUpDays?: unknown; followUpOn?: unknown }) {
  await assertDeskScope(viewer, customerId);
  const parsed = parseCallNote(input, belgradeDate(new Date()));
  if (!parsed.ok) throw new CustomerDeskError(parsed.error);
  const v = parsed.value;
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE customer_call_notes SET follow_up_done_at = now(), follow_up_done_by = ${viewer.id}::uuid
       WHERE customer_id = ${customerId}::uuid AND follow_up_on IS NOT NULL AND follow_up_done_at IS NULL`);
    await tx.execute(sql`
      INSERT INTO customer_call_notes (customer_id, outcome, body, follow_up_on, created_by)
      VALUES (${customerId}::uuid, ${v.outcome}, ${v.body}, ${v.followUpOn}::date, ${viewer.id}::uuid)`);
  });
}

export async function completeFollowUp(viewer: PortalUser, customerId: string, noteId: string) {
  await assertDeskScope(viewer, customerId);
  const done = await getDb().execute<{ id: string }>(sql`
    UPDATE customer_call_notes SET follow_up_done_at = now(), follow_up_done_by = ${viewer.id}::uuid
     WHERE id = ${noteId}::uuid AND customer_id = ${customerId}::uuid AND follow_up_on IS NOT NULL AND follow_up_done_at IS NULL
     RETURNING id`);
  if (![...done].length) throw new CustomerDeskError("Podsetnik je već završen. Osvežite stranicu.");
}

export type FollowUp = { noteId: string; customerId: string; customerName: string; followUpOn: string; outcomeLabel: string; body: string | null; by: string; late: boolean };

/**
 * Podsetnici do danas (uključujući zakasnele), za kupce u opsegu.
 * Komercijalista vidi sve podsetnike svojih kupaca; vlasnik i kancelarija samo svoje.
 */
export async function dueFollowUps(viewer: PortalUser, limit = 30): Promise<FollowUp[]> {
  const scope = await resolveLedgerScope(viewer);
  if (scope.customerIds !== null && scope.customerIds.length === 0) return [];
  const today = belgradeDate(new Date());
  const who =
    scope.customerIds === null
      ? sql`n.created_by = ${viewer.id}::uuid`
      : sql`n.customer_id IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
  const rows = await getDb().execute<{ id: string; cid: string; cname: string; follow: string; outcome: string; body: string | null; by: string }>(sql`
    SELECT n.id, c.id AS cid, c.name AS cname, n.follow_up_on::text AS follow, n.outcome, n.body, u.name AS by
      FROM customer_call_notes n JOIN customers c ON c.id = n.customer_id JOIN users u ON u.id = n.created_by
     WHERE n.follow_up_on <= ${today}::date AND n.follow_up_done_at IS NULL AND ${who}
     ORDER BY n.follow_up_on, c.name LIMIT ${limit}`);
  return [...rows].map((r) => ({ noteId: r.id, customerId: r.cid, customerName: r.cname, followUpOn: r.follow, outcomeLabel: outcomeLabel(r.outcome), body: r.body, by: r.by, late: r.follow < today }));
}

/** Za listu Preporuke: poslednji razgovor i otvoren podsetnik po kupcu. */
export async function lastContactByCustomer(customerIds: string[]) {
  if (!customerIds.length) return new Map<string, { lastOn: string; outcomeLabel: string; followUpOn: string | null }>();
  const rows = await getDb().execute<{ cid: string; last_on: string; outcome: string; follow: string | null }>(sql`
    SELECT DISTINCT ON (n.customer_id) n.customer_id AS cid, to_char(n.created_at AT TIME ZONE 'Europe/Belgrade', 'YYYY-MM-DD') AS last_on, n.outcome,
           (SELECT min(f.follow_up_on)::text FROM customer_call_notes f WHERE f.customer_id = n.customer_id AND f.follow_up_on IS NOT NULL AND f.follow_up_done_at IS NULL) AS follow
      FROM customer_call_notes n
     WHERE n.customer_id IN (${sql.join(customerIds.map((id) => sql`${id}::uuid`), sql`, `)})
     ORDER BY n.customer_id, n.created_at DESC`);
  return new Map([...rows].map((r) => [r.cid, { lastOn: r.last_on, outcomeLabel: outcomeLabel(r.outcome), followUpOn: r.follow }]));
}
