import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { PortalUser } from "@/lib/authz/user-repository";
import { actsAsOwner } from "@/lib/pricing/owner-oversight";
import { groupChanges, peopleOf, type ChangeRow } from "@/lib/pricing/ownerChanges.mjs";

/**
 * Odluke o cenama i rabatima u periodu — za vlasnika (/portal/cene/promene).
 *
 * Izvor je `price_rules` (ko je odlučio, kada, i koje pravilo menja), ne
 * obaveštenja: obaveštenje je zbir, pravilo je činjenica. Stari rabat je
 * vrednost pravila koje ovo zamenjuje (`replaces_rule_id`).
 */
export const MAX_CHANGE_ROWS = 5000;

export class OwnerChangesError extends Error {}

export async function loadOwnerChanges(
  viewer: PortalUser,
  input: { od: string; do: string; ko: string | null; ukljuciVlasnika: boolean },
) {
  if (!actsAsOwner(viewer)) throw new OwnerChangesError("Pregled promena vidi samo vlasnik.");
  const db = getDb();
  const rows = await db.execute<{
    id: string; source_batch: string | null; customer_id: string | null; customer_name: string | null;
    product_scope: string; brand: string | null; product_group: string | null;
    article_code: string | null; article_name: string | null;
    value_kind: string; new_pct: string | null; new_net: string | null; old_pct: string | null; old_net: string | null;
    payment_condition: string | null; effective_from: string; status: string;
    decided_at: string; decided_by: string; decided_by_name: string; decided_by_role: string;
    proposed_by_name: string | null; reason: string | null; decision_reason: string | null;
  }>(sql`
    SELECT r.id, r.source_batch, r.customer_id, c.name AS customer_name,
           r.product_scope::text AS product_scope, r.brand, r.product_group,
           a.code AS article_code, a.name AS article_name,
           r.value_kind::text AS value_kind,
           r.discount_percent::text AS new_pct, r.net_price::text AS new_net,
           o.discount_percent::text AS old_pct, o.net_price::text AS old_net,
           r.payment_condition, r.effective_from::text AS effective_from, r.status::text AS status,
           to_char(r.decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS decided_at,
           r.decided_by::text AS decided_by, du.name AS decided_by_name, du.role::text AS decided_by_role,
           pu.name AS proposed_by_name, r.reason, r.decision_reason
      FROM price_rules r
      JOIN users du ON du.id = r.decided_by
      LEFT JOIN users pu ON pu.id = r.proposed_by
      LEFT JOIN customers c ON c.id = r.customer_id
      LEFT JOIN articles a ON a.id = r.article_id
      LEFT JOIN price_rules o ON o.id = r.replaces_rule_id
     WHERE r.decided_at IS NOT NULL
       AND r.status NOT IN ('draft', 'pending_approval')
       AND (r.decided_at AT TIME ZONE 'Europe/Belgrade')::date BETWEEN ${input.od}::date AND ${input.do}::date
       AND (${input.ukljuciVlasnika} OR du.role <> 'gazda')
       AND (${input.ko}::uuid IS NULL OR r.decided_by = ${input.ko}::uuid)
     ORDER BY r.decided_at DESC
     LIMIT ${MAX_CHANGE_ROWS + 1}`);

  const list = [...rows];
  const truncated = list.length > MAX_CHANGE_ROWS;
  const num = (v: string | null) => (v === null ? null : Number(v));
  const changes: ChangeRow[] = list.slice(0, MAX_CHANGE_ROWS).map((r) => ({
    id: r.id,
    sourceBatch: r.source_batch,
    customerId: r.customer_id,
    customerName: r.customer_name,
    productScope: r.product_scope,
    brand: r.brand,
    productGroup: r.product_group,
    articleCode: r.article_code,
    articleName: r.article_name,
    valueKind: r.value_kind,
    newValue: r.value_kind === "net_price" ? num(r.new_net) : num(r.new_pct),
    oldValue: r.value_kind === "net_price" ? num(r.old_net) : num(r.old_pct),
    paymentCondition: r.payment_condition,
    effectiveFrom: r.effective_from,
    status: r.status,
    decidedAt: r.decided_at,
    decidedById: r.decided_by,
    decidedByName: r.decided_by_name,
    proposedByName: r.proposed_by_name,
    reason: r.decision_reason && r.status !== "approved_pending_biznisoft" ? r.decision_reason : r.reason,
  }));
  const blocks = groupChanges(changes);
  return { blocks, people: peopleOf(blocks), rules: changes.length, truncated };
}

/** Svi koji su ikad odlučivali o ceni (za izbor osobe u filteru). */
export async function priceDecisionMakers(viewer: PortalUser) {
  if (!actsAsOwner(viewer)) return [];
  const rows = await getDb().execute<{ id: string; name: string; role: string }>(sql`
    SELECT DISTINCT u.id::text AS id, u.name, u.role::text AS role
      FROM price_rules r JOIN users u ON u.id = r.decided_by
     ORDER BY u.name`);
  return [...rows];
}
