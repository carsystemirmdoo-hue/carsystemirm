import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { LedgerScope } from "@/lib/ledger/effective-sales";

/**
 * Kupci za „Za razgovor" u opsegu, po statusu (podrazumevano samo aktivni).
 * Neaktivni se izostavljaju, ali se broje — ekran kaže koliko ih je i kako
 * se vide (filter „neaktivni" / „svi").
 */
export async function loadConversationCustomers(
  scope: LedgerScope,
  status: "aktivni" | "neaktivni" | "svi",
): Promise<{
  rows: { id: string; name: string; city: string | null; active: boolean; reps: string[] | null }[];
  inactiveInScope: number;
}> {
  const db = getDb();
  const uOpsegu =
    scope.customerIds === null
      ? sql`true`
      : scope.customerIds.length === 0
        ? sql`false`
        : sql`c.id IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
  const poStatusu = status === "svi" ? sql`true` : status === "aktivni" ? sql`c.active` : sql`NOT c.active`;
  const [rows, [{ n }]] = await Promise.all([
    db.execute<{ id: string; name: string; city: string | null; active: boolean; reps: string[] | null }>(sql`
      SELECT c.id, c.name, c.city, c.active,
             array_remove(array_agg(u.name ORDER BY u.name), NULL) AS reps
        FROM customers c
        LEFT JOIN customer_assignments ca ON ca.customer_id = c.id
        LEFT JOIN users u ON u.id = ca.user_id
       WHERE ${uOpsegu} AND ${poStatusu}
       GROUP BY c.id, c.name, c.city, c.active`),
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM customers c WHERE ${uOpsegu} AND NOT c.active`),
  ]);
  return { rows: [...rows], inactiveInScope: n };
}
