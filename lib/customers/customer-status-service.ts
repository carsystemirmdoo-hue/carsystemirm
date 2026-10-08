import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customers } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { STATUS_CHANGE_ERRORS, validateStatusChange } from "@/lib/customers/customerStatus.mjs";

/**
 * Označava kupca neaktivnim ili ga vraća u aktivne — poslovna odluka uz
 * razlog i trag revizije. Ne briše ništa: fakture, veze šifara, dodele i
 * kartica ostaju. Ovlašćenje proverava pozivalac (`mappings:manage`).
 */
export class CustomerStatusError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | keyof typeof STATUS_CHANGE_ERRORS,
  ) {
    super(message);
  }
}

export async function setCustomerActive(
  input: { customerId: string; active: boolean; reason: string },
  actor: { id: string; name: string; role: string },
): Promise<{ active: boolean }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: customers.id, name: customers.name, pib: customers.pib, active: customers.active })
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .for("update")
      .limit(1);
    if (!row) throw new CustomerStatusError("Kupac ne postoji.", "not_found");

    const odluka = validateStatusChange({ currentActive: row.active, nextActive: input.active, reason: input.reason });
    if (!odluka.ok) throw new CustomerStatusError(STATUS_CHANGE_ERRORS[odluka.code], odluka.code);

    await tx
      .update(customers)
      .set({ active: input.active, updatedAt: sql`now()` })
      .where(eq(customers.id, row.id));

    await recordAudit(
      {
        actor,
        action: input.active ? AUDIT_ACTIONS.customerReactivated : AUDIT_ACTIONS.customerDeactivated,
        entityType: "Kupac",
        entityId: row.id,
        entityLabel: `${row.name} (PIB ${row.pib})`,
        before: { aktivan: row.active },
        after: { aktivan: input.active },
        reason: odluka.reason,
        correlationId: randomUUID(),
      },
      tx,
    );
    return { active: input.active };
  });
}
