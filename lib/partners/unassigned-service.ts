import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

/**
 * Kupci sa fakturama kojima trenutno nije dodeljen nijedan komercijalista.
 *
 * Samo čitanje: dodela ostaje ručna odluka (`assignments:manage`). Promet je
 * neto iz `effective_sales_ledger` (stornirane fakture isključene), isti izvor
 * kao zbirovi prodaje. „Istorijski komercijalista" je onaj sa poslednje
 * fakture — informacija, ne zaduženje.
 */
export async function loadUnassignedCustomers(asOf: string) {
  const rows = await getDb().execute<{
    id: string; name: string; last_on: string; last_label: string; last_invoice_id: string;
    net_total: string; net_12m: string; net_year: string; invoices: number; historical_rep: string | null;
  }>(sql`
    WITH l AS (
      SELECT customer_id, invoice_id, issued_on, line_amount
        FROM effective_sales_ledger WHERE enters_net
    ), agg AS (
      SELECT customer_id,
             max(issued_on) AS last_on,
             round(sum(line_amount), 2) AS net_total,
             round(coalesce(sum(line_amount) FILTER (WHERE issued_on > ${asOf}::date - interval '12 months'), 0), 2) AS net_12m,
             round(coalesce(sum(line_amount) FILTER (WHERE issued_on >= date_trunc('year', ${asOf}::date)), 0), 2) AS net_year,
             count(DISTINCT invoice_id)::int AS invoices
        FROM l GROUP BY customer_id
    )
    SELECT c.id, c.name, agg.last_on::text AS last_on, agg.net_total::text, agg.net_12m::text, agg.net_year::text, agg.invoices,
           li.number || '/' || li.year AS last_label, li.id AS last_invoice_id, sp.name AS historical_rep
      FROM agg
      JOIN customers c ON c.id = agg.customer_id
      LEFT JOIN LATERAL (
        SELECT i.id, i.number, i.year, i.salesperson_id FROM invoices i
         WHERE i.customer_id = c.id AND i.document_kind = 'faktura'
         ORDER BY i.issued_on DESC, i.number DESC LIMIT 1
      ) li ON true
      LEFT JOIN salespeople sp ON sp.id = li.salesperson_id
     WHERE NOT EXISTS (SELECT 1 FROM customer_assignments ca WHERE ca.customer_id = c.id)
     ORDER BY agg.net_12m DESC, c.name`);
  return [...rows].map((r) => ({
    id: r.id,
    name: r.name,
    lastOn: r.last_on,
    lastLabel: r.last_label,
    lastInvoiceId: r.last_invoice_id,
    netTotal: Number(r.net_total),
    net12m: Number(r.net_12m),
    netYear: Number(r.net_year),
    invoices: r.invoices,
    historicalRep: r.historical_rep,
  }));
}
