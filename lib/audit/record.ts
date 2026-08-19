import "server-only";
import { getDb, type Database } from "@/db/client";
import { auditLog } from "@/db/schema";
import {
  AUDIT_ACTIONS,
  buildAuditEntry,
} from "@/lib/audit/auditEntry.mjs";

export { AUDIT_ACTIONS };

export interface AuditActor {
  id?: string | null;
  name: string;
  role: string;
}

export interface AuditInput {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  correlationId?: string | null;
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Upisuje red u trag revizije.
 *
 * `tx` treba proslediti kad god trag prati izmenu podataka — tako se red i izmena
 * urezuju zajedno ili nikako, pa ne može ostati promena bez traga niti trag bez
 * promene. Bez `tx` upis ide van transakcije i koristi se samo za događaje koji
 * ništa ne menjaju (npr. neuspela prijava).
 */
export async function recordAudit(
  input: AuditInput,
  tx?: Transaction,
): Promise<void> {
  const entry = buildAuditEntry(input);
  const executor = tx ?? getDb();
  await executor.insert(auditLog).values(entry);
}
