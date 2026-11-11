import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { PortalUser } from "@/lib/authz/session";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";

/**
 * Storna i knjižna odobrenja iz izvornih dokumenata (2026-11-11).
 *
 * Nijedno ne postaje faktura: storno isključuje original iz prometa kada je primenjen
 * (0033, docs/b2b/48), a knjižno odobrenje se samo čita i prikazuje. Zato ih ekran
 * „Povrati i minus fakture“ ne nalazi među stavkama faktura i čita ih odavde.
 * Kupac se razrešava preko povezane šifre partnera; komercijalista vidi samo svoje kupce.
 */

export type MinusDocument = {
  id: string;
  kind: "storno" | "knjizno_odobrenje";
  number: string | null;
  date: string | null;
  customerId: string | null;
  customerName: string | null;
  partnerCode: string | null;
  gross: number;
  lineCount: number;
  /** Storno: stanje veze sa originalom; `null` za odobrenje ili storno bez veze. */
  reversal: { status: "applied" | "waiting_original" | "review"; originalNumber: string } | null;
};

export async function loadMinusDocuments(user: PortalUser, filter: { from: string | null; to: string | null; customerId: string | null }): Promise<MinusDocument[]> {
  const scope = await resolveLedgerScope(user);
  if (scope.customerIds !== null && scope.customerIds.length === 0) return [];
  const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = iso(filter.from);
  const to = iso(filter.to);
  const rows = await getDb().execute<{
    id: string; kind: "storno" | "knjizno_odobrenje"; number: string | null; date: string | null;
    customer_id: string | null; customer_name: string | null; partner_code: string | null;
    gross: string | null; lines: number; r_status: "applied" | "waiting_original" | "review" | null; r_original: string | null;
  }>(sql`
    SELECT sd.id, sd.business_document_type::text AS kind, sd.business_document_number AS number,
           sd.document_date::text AS date, c.id AS customer_id, c.name AS customer_name,
           sd.external_partner_code AS partner_code,
           (SELECT sum(nullif(l.gross_amount, '')::numeric) FROM source_document_lines l WHERE l.source_document_id = sd.id)::text AS gross,
           (SELECT count(*)::int FROM source_document_lines l WHERE l.source_document_id = sd.id) AS lines,
           r.status::text AS r_status, r.original_number AS r_original
      FROM source_documents sd
      LEFT JOIN customer_external_identifiers x
             ON x.source_system = 'biznisoft' AND x.issuer_code = sd.issuer_code
            AND x.external_partner_code = sd.external_partner_code AND x.status = 'mapped'
      LEFT JOIN customers c ON c.id = x.customer_id
      LEFT JOIN invoice_reversals r ON r.storno_source_document_id = sd.id
     WHERE sd.business_document_type::text IN ('storno', 'knjizno_odobrenje')
       AND sd.revision_status = 'original'
       ${from ? sql`AND sd.document_date >= ${from}::date` : sql``}
       ${to ? sql`AND sd.document_date <= ${to}::date` : sql``}
       ${filter.customerId ? sql`AND c.id = ${filter.customerId}::uuid` : sql``}
       ${scope.customerIds === null ? sql`` : sql`AND c.id IN (${sql.join(scope.customerIds.map((i) => sql`${i}::uuid`), sql`, `)})`}
     ORDER BY sd.document_date DESC NULLS LAST, sd.business_document_number DESC
     LIMIT 500`);
  return [...rows].map((r) => ({
    id: r.id,
    kind: r.kind,
    number: r.number,
    date: r.date,
    customerId: r.customer_id,
    customerName: r.customer_name,
    partnerCode: r.partner_code,
    // Knjižno odobrenje se štampa sa pozitivnim iznosom; za kupca je to umanjenje.
    gross: r.kind === "knjizno_odobrenje" ? -Math.abs(Number(r.gross ?? 0)) : Number(r.gross ?? 0),
    lineCount: r.lines,
    reversal: r.r_status && r.r_original ? { status: r.r_status, originalNumber: r.r_original } : null,
  }));
}
