import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { PortalUser } from "@/lib/authz/user-repository";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";

/*
 * Otisak stanja za automatsko osvežavanje (lista, detalj, korpa).
 *
 * Klijent periodično pita samo otisak; kada se razlikuje od prikazanog,
 * osvežava stranu (ili, ako forma ima nesnimljene izmene, prikazuje
 * obaveštenje). Otisak ne nosi podatke — samo md5 nad oznakama verzija.
 */

async function staffScope(viewer: PortalUser): Promise<SQL> {
  const scope = await resolveLedgerScope(viewer);
  if (scope.customerIds === null) return sql`true`;
  if (scope.customerIds.length === 0) return sql`false`;
  return sql`o.customer_id IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

/** Ceo lanac verzija zahteva (original + predlozi): menja se kad se promeni bilo koja verzija. */
async function chainStamp(orderId: string, scope: SQL): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const [r] = [...(await getDb().execute<{ s: string | null }>(sql`
    WITH RECURSIVE start AS (SELECT o.id FROM customer_orders o WHERE o.id = ${orderId}::uuid AND ${scope}),
    up(id, parent) AS (
      SELECT c.id, c.replaces_order_id FROM customer_orders c JOIN start ON start.id = c.id
      UNION ALL
      SELECT p.id, p.replaces_order_id FROM customer_orders p JOIN up ON p.id = up.parent
    ), tree(id) AS (
      SELECT id FROM up WHERE parent IS NULL
      UNION ALL
      SELECT r.id FROM customer_orders r JOIN tree ON r.replaces_order_id = tree.id
    )
    SELECT md5(string_agg(o.id::text || '@' || o.updated_at::text, ',' ORDER BY o.id)) AS s
      FROM tree JOIN customer_orders o ON o.id = tree.id`))];
  return r?.s ?? null;
}

async function listStamp(scope: SQL): Promise<string> {
  const [r] = [...(await getDb().execute<{ s: string }>(sql`
    SELECT md5(count(*)::text || '|' || coalesce(max(o.updated_at)::text, '')) AS s FROM customer_orders o WHERE ${scope}`))];
  return r.s;
}

export async function staffOrderStamp(viewer: PortalUser, orderId: string | null): Promise<string | null> {
  const scope = await staffScope(viewer);
  return orderId ? chainStamp(orderId, scope) : listStamp(scope);
}

export async function customerOrderStamp(customerId: string, orderId: string | null): Promise<string | null> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const scope = sql`o.customer_id = ${customerId}::uuid`;
  return orderId ? chainStamp(orderId, scope) : listStamp(scope);
}

/** Korpa: stavke, odobrene opcije plaćanja i odluke o pravilima cene za firmu. */
export async function customerCartStamp(customerId: string): Promise<string> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const [r] = [...(await getDb().execute<{ s: string }>(sql`
    SELECT md5(
      (SELECT count(*)::text || '|' || coalesce(max(updated_at)::text, '') || '|' || coalesce(string_agg(article_id::text || ':' || quantity::text, ',' ORDER BY article_id), '')
         FROM customer_cart_items WHERE customer_id = ${customerId}::uuid)
      || '#' || (SELECT count(*)::text || '|' || coalesce(string_agg(id::text || ':' || status, ',' ORDER BY id), '')
         FROM customer_payment_options WHERE customer_id = ${customerId}::uuid)
      || '#' || (SELECT count(*)::text || '|' || coalesce(max(coalesce(decided_at, proposed_at))::text, '')
         FROM price_rules WHERE customer_id = ${customerId}::uuid)
    ) AS s`))];
  return r.s;
}
