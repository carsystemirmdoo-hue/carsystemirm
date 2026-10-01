import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { LedgerScope } from "@/lib/ledger/effective-sales";
import { loadDatasetInfo, type DatasetInfo } from "@/lib/data-state/dataset";

/**
 * Stanje podataka — JEDNO mesto koje odgovara na pitanje „šta sistem zna,
 * odakle i do kog datuma".
 *
 * Definicija dokumenta je ista kao na kartici kupca i u preporukama: potvrđen
 * prodajni dokument iz uskog ulaza `recommendation_input_lines` (validan,
 * originalan, sa izvornim dokumentom, kupac trenutno povezan). Zbog toga
 * početna i kartica ne mogu reći dve različite stvari o istom kupcu.
 *
 * Brojevi su u opsegu korisnika: komercijalista vidi samo svoje kupce.
 */

export type DocumentOrigin = "manual_upload" | "device" | "csv_import" | "legacy_unknown";

export type DataState = {
  dataset: DatasetInfo;
  /** Potvrđeni prodajni dokumenti u opsegu (ista definicija kao kartica kupca). */
  confirmedDocuments: number;
  customersWithDocuments: number;
  firstIssuedOn: string | null;
  lastIssuedOn: string | null;
  /** Sve fakture u opsegu, i one koje još nisu potvrđene (npr. raniji CSV). */
  allInvoices: number;
  byOrigin: Partial<Record<DocumentOrigin, number>>;
  /** Kada je poslednji izvorni dokument upisan u bazu (vreme uvoza, ne datum fakture). */
  lastIngestedAt: Date | null;
  recommendations: {
    asOfDate: string | null;
    finishedAt: Date | null;
    customersNeedingAttention: number;
    articlesOverdue: number;
    articlesDormant: number;
  };
};

export const ORIGIN_LABELS: Record<DocumentOrigin, string> = {
  manual_upload: "BizniSoft PDF, ručni uvoz",
  device: "BizniSoft, Windows konektor",
  csv_import: "raniji CSV uvoz",
  legacy_unknown: "nepoznato poreklo",
};

function inScope(column: SQL, scope: LedgerScope): SQL {
  if (scope.customerIds === null) return sql`true`;
  if (scope.customerIds.length === 0) return sql`false`;
  return sql`${column} IN (${sql.join(
    scope.customerIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

export async function loadDataState(scope: LedgerScope): Promise<DataState> {
  const db = getDb();
  const [dataset, confirmed, all, origins, ingested, reco] = await Promise.all([
    loadDatasetInfo(),
    db.execute<{ docs: number; customers: number; first: string | null; last: string | null }>(sql`
      SELECT count(DISTINCT invoice_id)::int AS docs,
             count(DISTINCT customer_id)::int AS customers,
             min(issued_on)::text AS first,
             max(issued_on)::text AS last
        FROM recommendation_input_lines
       WHERE ${inScope(sql`customer_id`, scope)}`),
    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM invoices WHERE ${inScope(sql`customer_id`, scope)}`),
    db.execute<{ origin: DocumentOrigin; n: number }>(sql`
      SELECT origin::text AS origin, count(*)::int AS n
        FROM invoices WHERE ${inScope(sql`customer_id`, scope)}
       GROUP BY origin`),
    db.execute<{ at: Date | null }>(sql`
      SELECT max(sd.created_at) AS at
        FROM source_documents sd
        LEFT JOIN invoices i ON i.id = sd.invoice_id
       WHERE ${scope.customerIds === null ? sql`true` : inScope(sql`i.customer_id`, scope)}`),
    db.execute<{
      as_of: string | null;
      finished_at: Date | null;
      customers: number;
      overdue: number;
      dormant: number;
    }>(sql`
      SELECT max(run_as_of)::text AS as_of,
             max(run_finished_at) AS finished_at,
             count(DISTINCT customer_id) FILTER (WHERE status IN ('overdue', 'dormant'))::int AS customers,
             count(*) FILTER (WHERE status = 'overdue')::int AS overdue,
             count(*) FILTER (WHERE status = 'dormant')::int AS dormant
        FROM (SELECT as_of_date AS run_as_of, run_finished_at, customer_id, status
                FROM active_recommendations
               WHERE ${inScope(sql`customer_id`, scope)}) r`),
  ]);

  const c = [...confirmed][0];
  const r = [...reco][0];
  const byOrigin: DataState["byOrigin"] = {};
  for (const row of origins) byOrigin[row.origin] = row.n;

  return {
    dataset,
    confirmedDocuments: c?.docs ?? 0,
    customersWithDocuments: c?.customers ?? 0,
    firstIssuedOn: c?.first ?? null,
    lastIssuedOn: c?.last ?? null,
    allInvoices: [...all][0]?.n ?? 0,
    byOrigin,
    lastIngestedAt: [...ingested][0]?.at ?? null,
    recommendations: {
      asOfDate: r?.as_of ?? null,
      finishedAt: r?.finished_at ?? null,
      customersNeedingAttention: r?.customers ?? 0,
      articlesOverdue: r?.overdue ?? 0,
      articlesDormant: r?.dormant ?? 0,
    },
  };
}

/**
 * Kratko stanje za bočnu traku — bez opsega, jer ne otkriva ništa o kupcima:
 * samo da li je izvor povezan i do kog datuma ima dokumenata.
 */
export async function loadDataHeartbeat(): Promise<{
  dataset: DatasetInfo;
  lastIssuedOn: string | null;
}> {
  const [dataset, rows] = await Promise.all([
    loadDatasetInfo(),
    getDb()
      .execute<{ last: string | null }>(sql`SELECT max(issued_on)::text AS last FROM recommendation_input_lines`)
      .catch(() => [] as { last: string | null }[]),
  ]);
  return { dataset, lastIssuedOn: [...rows][0]?.last ?? null };
}
