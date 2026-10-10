import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { COMMERCIAL_STATUSES, isPreparedForPortal } from "@/lib/customers/commercial-status.mjs";

export type CommercialStatus = keyof typeof COMMERCIAL_STATUSES;

/** Važeći status po kupcu (bez zapisa = redovan). */
export async function commercialStatuses(): Promise<Map<string, { status: CommercialStatus; reason: string; decidedAt: string }>> {
  const rows = await getDb().execute<{ customer_id: string; status: CommercialStatus; reason: string; decided_at: string }>(sql`
    SELECT customer_id, status, reason, decided_at::text AS decided_at FROM customer_commercial_status`);
  return new Map(rows.filter((r) => r.status !== "redovan").map((r) => [r.customer_id, { status: r.status, reason: r.reason, decidedAt: r.decided_at }]));
}

/** Zabrana pripreme naloga za kupca van pripreme za portal (provera na serveru). */
export async function assertPreparedForPortal(customerId: string) {
  const [row] = [...(await getDb().execute<{ status: string }>(sql`SELECT status FROM customer_commercial_status WHERE customer_id = ${customerId}::uuid`))];
  if (row && !isPreparedForPortal(row.status)) {
    throw new Error(`Kupac nije u pripremi za portal (${COMMERCIAL_STATUSES[row.status as CommercialStatus] ?? row.status}) — nalog se ne priprema.`);
  }
}

/** Odluka vlasnika o posebnom statusu (samo dodavanje, sa tragom). Ista odluka ne pravi nov zapis. */
export async function setCommercialStatus(actor: PortalUser, input: { customerId: string; status: CommercialStatus; reason: string }) {
  if (!can(actor, "prices:approve")) throw new Error("Poseban status kupca određuje samo vlasnik.");
  if (!(input.status in COMMERCIAL_STATUSES)) throw new Error("Nepoznat status.");
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) throw new Error("Obrazloženje: 5–500 znakova.");
  return getDb().transaction(async (tx) => {
    const [cur] = [...(await tx.execute<{ status: string }>(sql`SELECT status FROM customer_commercial_status WHERE customer_id = ${input.customerId}::uuid`))];
    if ((cur?.status ?? "redovan") === input.status) return { changed: false };
    await tx.execute(sql`
      INSERT INTO customer_commercial_status_decisions (customer_id, status, reason, decided_by)
      VALUES (${input.customerId}::uuid, ${input.status}, ${reason}, ${actor.id}::uuid)`);
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.customerCommercialStatusChanged,
        entityType: "Kupac",
        entityId: input.customerId,
        entityLabel: COMMERCIAL_STATUSES[input.status],
        before: { status: cur?.status ?? "redovan" },
        after: { status: input.status, istorijaZadrzana: true },
        reason,
      },
      tx,
    );
    return { changed: true };
  });
}
