import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { effectiveInvoiceCondition } from "@/lib/ledger/effective-invoice";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { stoppedBuying } from "@/lib/sales/stoppedBuying.mjs";

/**
 * Kartica kupca za izabrani period (zahtev vlasnika 2026-11-12/13):
 *   - „Najviše kupovano“: neto količina i neto iznos po artiklu, iz faktura koje važe za promet;
 *   - „Prestao da uzima“: vidi `stoppedBuying.mjs`.
 *
 * Pozivalac MORA pre ovoga proveriti pristup kupcu (`requireCustomerAccess`).
 */
export interface PeriodArticle {
  code: string;
  name: string | null;
  unit: string | null;
  quantity: number;
  net: number;
  invoiceCount: number;
  lastOn: string;
}

export async function loadCustomerPeriodArticles(
  customerId: string,
  period: { from: string | null; to: string | null },
  now: Date = new Date(),
) {
  const db = getDb();
  const today = belgradeDate(now);
  const from = period.from;
  const to = period.to && period.to < today ? period.to : today;

  const [top, history] = await Promise.all([
    db.execute<{ code: string; name: string | null; unit: string | null; quantity: string; net: string; invoices: number; last_on: string }>(sql`
      SELECT invoice_lines.article_code AS code,
             max(a.name) AS name,
             max(a.unit) AS unit,
             round(sum(CASE WHEN invoice_lines.line_amount < 0 THEN -abs(invoice_lines.quantity) ELSE invoice_lines.quantity END), 3)::text AS quantity,
             round(sum(invoice_lines.line_amount), 2)::text AS net,
             count(DISTINCT invoices.id)::int AS invoices,
             max(invoices.issued_on)::text AS last_on
        FROM invoice_lines
        JOIN invoices ON invoices.id = invoice_lines.invoice_id
        LEFT JOIN articles a ON a.id = invoice_lines.article_id
       WHERE invoices.customer_id = ${customerId}::uuid
         AND invoices.issued_on <= ${to}::date
         ${from ? sql`AND invoices.issued_on >= ${from}::date` : sql``}
         -- Samo dokumenti koji važe za promet (isto pravilo kao Prodaja, uključuje storna).
         AND ${effectiveInvoiceCondition()}
       GROUP BY invoice_lines.article_code`),
    // Dani kupovine bilo kad (do danas) — isti izvor kao kartica kupca (potvrđeni prodajni dokumenti).
    db.execute<{ code: string; name: string | null; dates: string[]; dismissed: boolean }>(sql`
      SELECT ril.article_code AS code,
             max(ril.article_name) AS name,
             array_agg(DISTINCT ril.issued_on::text) AS dates,
             EXISTS (SELECT 1 FROM customer_article_dismissals d
                      WHERE d.customer_id = ril.customer_id AND d.article_code = ril.article_code AND d.revoked_at IS NULL) AS dismissed
        FROM recommendation_input_lines ril
       WHERE ril.customer_id = ${customerId}::uuid
         AND ril.issued_on <= ${today}::date
       GROUP BY ril.customer_id, ril.article_code`),
  ]);

  const articles: PeriodArticle[] = [...top]
    .map((r) => ({
      code: r.code,
      name: r.name,
      unit: r.unit,
      quantity: Number(r.quantity),
      net: Number(r.net),
      invoiceCount: Number(r.invoices),
      lastOn: r.last_on,
    }))
    .filter((r) => r.quantity !== 0 || r.net !== 0)
    .sort((a, b) => b.net - a.net || b.quantity - a.quantity || a.code.localeCompare(b.code));

  const stopped = stoppedBuying(
    [...history].map((h) => ({ code: h.code, name: h.name, dates: h.dates, dismissed: h.dismissed })),
    { today, from: period.from, to: period.to },
  );

  return { today, articles, stopped };
}
