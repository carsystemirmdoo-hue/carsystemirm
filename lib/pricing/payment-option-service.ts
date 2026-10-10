import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import { canAccessCustomer } from "@/lib/authz/scope.mjs";
import { loadAssignedCustomerIds, type PortalUser } from "@/lib/authz/user-repository";
import { isOptionCode, optionLabel, sortOptions } from "@/lib/pricing/paymentOptions.mjs";

export class PaymentOptionError extends Error {}

export type PaymentOptionRow = {
  id: string;
  optionCode: string;
  label: string;
  status: "predlog" | "odobreno" | "odbijeno" | "opozvano";
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string;
  proposedBy: string;
  decidedBy: string | null;
  decisionReason: string | null;
};

/** Opcije koje važe za kupca na dan (samo odobrene, u važenju), u redosledu prikaza. */
export async function approvedPaymentOptions(customerId: string, onDate: string): Promise<string[]> {
  const rows = await getDb().execute<{ option_code: string }>(sql`
    SELECT option_code FROM customer_payment_options
     WHERE customer_id = ${customerId}::uuid AND status = 'odobreno'
       AND effective_from <= ${onDate}::date AND (effective_to IS NULL OR effective_to >= ${onDate}::date)`);
  return sortOptions([...new Set(rows.map((r) => r.option_code))]);
}

/** Sve opcije kupca sa istorijom (za ekran kupca). */
export async function listPaymentOptions(customerId: string): Promise<PaymentOptionRow[]> {
  const rows = await getDb().execute<{
    id: string; option_code: string; status: PaymentOptionRow["status"]; effective_from: string; effective_to: string | null; reason: string;
    proposed_by: string; decided_by: string | null; decision_reason: string | null;
  }>(sql`
    SELECT o.id, o.option_code, o.status, o.effective_from::text, o.effective_to::text, o.reason,
           pu.name AS proposed_by, du.name AS decided_by, o.decision_reason
      FROM customer_payment_options o
      JOIN users pu ON pu.id = o.proposed_by
      LEFT JOIN users du ON du.id = o.decided_by
     WHERE o.customer_id = ${customerId}::uuid
     ORDER BY o.proposed_at DESC`);
  return rows.map((r) => ({
    id: r.id, optionCode: r.option_code, label: optionLabel(r.option_code), status: r.status, effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to, reason: r.reason, proposedBy: r.proposed_by, decidedBy: r.decided_by, decisionReason: r.decision_reason,
  }));
}

async function assertScope(viewer: PortalUser, customerId: string) {
  const assigned = await loadAssignedCustomerIds(viewer.id);
  if (!canAccessCustomer(viewer, assigned, customerId)) throw new PaymentOptionError("Kupac nije u Vašem opsegu.");
}

/** Predlog opcije (komercijalista sa `prices:propose`, samo za kupce u opsegu). Ne važi dok vlasnik ne odobri. */
export async function proposePaymentOption(viewer: PortalUser, input: { customerId: string; optionCode: string; effectiveFrom: string; reason: string }) {
  if (!can(viewer, "prices:propose")) throw new PaymentOptionError("Nemate pravo da predlažete uslove.");
  if (!isOptionCode(input.optionCode)) throw new PaymentOptionError("Nepoznata opcija plaćanja.");
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) throw new PaymentOptionError("Obrazloženje: 5–500 znakova.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) throw new PaymentOptionError("Izaberite datum početka.");
  await assertScope(viewer, input.customerId);
  const db = getDb();
  return db.transaction(async (tx) => {
    const active = await tx.execute<{ id: string }>(sql`
      SELECT id FROM customer_payment_options WHERE customer_id = ${input.customerId}::uuid AND option_code = ${input.optionCode}
         AND status = 'odobreno' AND effective_to IS NULL`);
    if (active.length) throw new PaymentOptionError(`${optionLabel(input.optionCode)} je već odobreno ovom kupcu.`);
    const pending = await tx.execute<{ id: string }>(sql`
      SELECT id FROM customer_payment_options WHERE customer_id = ${input.customerId}::uuid AND option_code = ${input.optionCode} AND status = 'predlog'`);
    if (pending.length) throw new PaymentOptionError("Isti predlog već čeka odluku.");
    const [row] = [...(await tx.execute<{ id: string }>(sql`
      INSERT INTO customer_payment_options (customer_id, option_code, effective_from, reason, proposed_by)
      VALUES (${input.customerId}::uuid, ${input.optionCode}, ${input.effectiveFrom}::date, ${reason}, ${viewer.id}::uuid) RETURNING id`))];
    await recordAudit(
      {
        actor: { id: viewer.id, name: viewer.name, role: viewer.role },
        action: AUDIT_ACTIONS.paymentOptionChanged,
        entityType: "Opcija plaćanja",
        entityId: row.id,
        entityLabel: optionLabel(input.optionCode),
        before: null,
        after: { kupac: input.customerId, opcija: input.optionCode, status: "predlog", vaziOd: input.effectiveFrom },
        reason,
      },
      tx,
    );
    return { id: row.id };
  });
}

/** Odluka vlasnika: odobrenje, odbijanje ili opoziv (opoziv zatvara važenje, red ostaje). */
export async function decidePaymentOption(viewer: PortalUser, input: { id: string; to: "odobreno" | "odbijeno" | "opozvano"; reason: string | null; effectiveTo?: string | null }) {
  if (!can(viewer, "prices:approve")) throw new PaymentOptionError("Opcije plaćanja odobrava samo vlasnik.");
  const db = getDb();
  return db.transaction(async (tx) => {
    const [cur] = [...(await tx.execute<{ status: string; option_code: string; customer_id: string; effective_from: string }>(sql`
      SELECT status, option_code, customer_id, effective_from::text FROM customer_payment_options WHERE id = ${input.id}::uuid FOR UPDATE`))];
    if (!cur) throw new PaymentOptionError("Opcija ne postoji.");
    const allowed = (cur.status === "predlog" && (input.to === "odobreno" || input.to === "odbijeno")) || (cur.status === "odobreno" && input.to === "opozvano");
    if (!allowed) throw new PaymentOptionError(`Prelaz ${cur.status} → ${input.to} nije dozvoljen.`);
    if ((input.to === "odbijeno" || input.to === "opozvano") && !(input.reason ?? "").trim()) throw new PaymentOptionError("Razlog je obavezan.");
    const closeOn = input.to === "opozvano" ? (input.effectiveTo ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date())) : null;
    await tx.execute(sql`
      UPDATE customer_payment_options
         SET status = ${input.to === "opozvano" ? "odobreno" : input.to},
             effective_to = ${closeOn}::date,
             decided_by = ${viewer.id}::uuid, decided_at = now(), decision_reason = ${input.reason?.trim() || null}
       WHERE id = ${input.id}::uuid`);
    if (input.to === "opozvano") {
      await tx.execute(sql`UPDATE customer_payment_options SET status = 'opozvano' WHERE id = ${input.id}::uuid`);
    }
    await recordAudit(
      {
        actor: { id: viewer.id, name: viewer.name, role: viewer.role },
        action: AUDIT_ACTIONS.paymentOptionChanged,
        entityType: "Opcija plaćanja",
        entityId: input.id,
        entityLabel: optionLabel(cur.option_code),
        before: { status: cur.status },
        after: { status: input.to, vaziDo: closeOn },
        reason: input.reason?.trim() || `Odluka: ${input.to}`,
      },
      tx,
    );
    return { status: input.to };
  });
}
