import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

/**
 * Podaci o kupcu za odštampan zahtev/porudžbinu u rasporedu kao na fakturi (2026-11-13):
 * PIB i mesto iz šifarnika kupaca i trenutno dodeljeni komercijalisti.
 * Pozivalac je već proverio pristup zahtevu (`loadOrderRequest`).
 */
export async function loadOrderPrintParty(customerId: string) {
  const db = getDb();
  const [[customer], reps] = await Promise.all([
    db.execute<{ pib: string; city: string | null }>(sql`SELECT pib, city FROM customers WHERE id = ${customerId}::uuid`).then((r) => [...r]),
    db.execute<{ name: string }>(sql`
      SELECT u.name FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
       WHERE ca.customer_id = ${customerId}::uuid ORDER BY u.name`),
  ]);
  return { pib: customer?.pib ?? null, city: customer?.city ?? null, salespeople: [...reps].map((r) => r.name) };
}
