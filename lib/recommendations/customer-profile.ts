import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { LedgerScope } from "@/lib/ledger/effective-sales";
import { dayNumber } from "@/lib/recommendations/cadence.mjs";
import {
  belgradeDate,
  evaluateCustomerRhythm,
  groupCustomerSignals,
} from "@/lib/recommendations/customerRhythm.mjs";
import {
  groupArticles,
  monthlyRhythm,
  summarizeCustomer,
  uncomputedArticle,
} from "@/lib/recommendations/customerSummary.mjs";
import { freshnessOf } from "@/lib/recommendations/freshness.mjs";
import { recommendationRows, type RecommendationRow } from "@/lib/recommendations/query";

/**
 * Profili kupaca za karticu i radnu listu „Za razgovor".
 *
 * Pozivalac MORA pre ovoga razrešiti opseg na serveru (`requireCustomerAccess`
 * za jednog kupca, `resolveLedgerScope` za listu). Ovde se opseg samo
 * primenjuje, nikad ne proširuje.
 *
 * Dva izvora, namerno razdvojena:
 *   ČINJENICE (poslednja kupovina, datumi, broj dokumenata) — uživo, iz
 *     potvrđenih dokumenata do danas. Nova kupovina se vidi odmah.
 *   STATUSI i SAVET — iz aktivnog obračuna `cadence_v1`, „na dan" obračuna.
 *     Ako je posle obračuna stigao dokument za kupca, obračun je za njega
 *     zastareo i savet se ne prikazuje (`freshnessOf`).
 */

function inScope(column: SQL, scope: LedgerScope): SQL {
  if (scope.customerIds === null) return sql`true`;
  if (scope.customerIds.length === 0) return sql`false`;
  return sql`${column} IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

export async function loadCustomerProfiles(scope: LedgerScope, now: Date = new Date()) {
  const db = getDb();
  const today = belgradeDate(now);

  const [runRow] = [
    ...(await db.execute<{ as_of_date: string; started_at: Date; finished_at: Date | null }>(sql`
      SELECT as_of_date::text AS as_of_date, started_at, finished_at
        FROM recommendation_runs WHERE is_active LIMIT 1`)),
  ];
  const run = runRow
    ? { asOfDate: runRow.as_of_date, startedAt: new Date(runRow.started_at), finishedAt: runRow.finished_at ? new Date(runRow.finished_at) : null }
    : null;

  const [docs, perArticle, rows] = await Promise.all([
    db.execute<{ customer_id: string; invoice_id: string; d: string; ingested_at: Date | null }>(sql`
      SELECT DISTINCT ril.customer_id, ril.invoice_id, ril.issued_on::text AS d, sd.created_at AS ingested_at
        FROM recommendation_input_lines ril
        JOIN source_documents sd ON sd.id = ril.source_document_id
       WHERE ${inScope(sql`ril.customer_id`, scope)}
         AND ril.issued_on <= ${today}::date`),
    db.execute<{ customer_id: string; article_code: string; article_name: string | null; dates: string[]; docs: number }>(sql`
      SELECT customer_id, article_code,
             max(article_name) AS article_name,
             array_agg(DISTINCT issued_on::text ORDER BY issued_on::text) AS dates,
             count(DISTINCT invoice_id)::int AS docs
        FROM recommendation_input_lines
       WHERE ${inScope(sql`customer_id`, scope)}
         AND issued_on <= ${today}::date
       GROUP BY customer_id, article_code`),
    run ? recommendationRows(scope, { limit: 20000 }) : Promise.resolve([] as RecommendationRow[]),
  ]);

  const docsBy = new Map<string, { d: string; ingestedAt: Date | null }[]>();
  for (const x of docs) {
    const list = docsBy.get(x.customer_id) ?? [];
    list.push({ d: x.d, ingestedAt: x.ingested_at ? new Date(x.ingested_at) : null });
    docsBy.set(x.customer_id, list);
  }
  const articlesBy = new Map<string, typeof perArticle extends Iterable<infer T> ? T[] : never>();
  for (const a of perArticle) {
    const list = articlesBy.get(a.customer_id) ?? [];
    list.push(a);
    articlesBy.set(a.customer_id, list);
  }
  const rowsBy = new Map<string, RecommendationRow[]>();
  for (const r of rows) {
    const list = rowsBy.get(r.customerId) ?? [];
    list.push(r);
    rowsBy.set(r.customerId, list);
  }

  const ids =
    scope.customerIds ?? [...new Set([...docsBy.keys(), ...rowsBy.keys()])];
  const out = new Map<string, ReturnType<typeof build>>();
  for (const id of ids) {
    out.set(id, build(id, docsBy.get(id) ?? [], articlesBy.get(id) ?? [], rowsBy.get(id) ?? [], run, today));
  }
  return { run, today, profiles: out };
}

function build(
  customerId: string,
  documents: { d: string; ingestedAt: Date | null }[],
  perArticle: { article_code: string; article_name: string | null; dates: string[]; docs: number }[],
  rows: RecommendationRow[],
  run: { asOfDate: string; startedAt: Date; finishedAt: Date | null } | null,
  today: string,
) {
  const documentDates = documents.map((x) => x.d);
  const purchaseDays = [...new Set(documentDates)].sort();
  const rhythm = evaluateCustomerRhythm({ customerId, purchaseDates: purchaseDays }, today);
  const freshness = freshnessOf({
    run,
    documents: documents.map((x) => ({ issuedOn: x.d, ingestedAt: x.ingestedAt })),
    today,
  });
  const newDocDays = new Set(freshness.newDocuments.map((d) => d.issuedOn));
  const byCode = new Map(rows.map((r) => [r.articleCode, r]));
  const asOf = dayNumber(today);

  const articles = perArticle.map((a) => {
    const r = byCode.get(a.article_code);
    const last = a.dates[a.dates.length - 1];
    const boughtAfterRun = a.dates.some((d) => newDocDays.has(d));
    const fallback = uncomputedArticle(a.dates.length);
    return {
      articleCode: a.article_code,
      articleName: r?.articleName ?? a.article_name,
      status: r?.status ?? fallback.status,
      confidence: r?.confidence ?? null,
      eventCount: a.dates.length,
      documentCount: a.docs,
      firstPurchaseOn: a.dates[0],
      lastPurchaseOn: last,
      medianIntervalDays: r?.medianIntervalDays ?? null,
      toleranceDays: r?.toleranceDays ?? null,
      expectedNextOn: r?.expectedNextOn ?? null,
      daysUntilExpected: r ? (r.expectedNextOn ? dayNumber(r.expectedNextOn) - asOf : null) : null,
      daysSinceLastPurchase: asOf - dayNumber(last),
      explanation: r?.explanation ?? fallback.explanation,
      purchaseDates: a.dates,
      newPurchaseDates: a.dates.filter((d) => newDocDays.has(d)),
      /** Status je iz obračuna koji ovu kupovinu nije video. */
      statusOutdated: boughtAfterRun,
    };
  });

  const monthly = monthlyRhythm(documentDates, today);
  const summary = summarizeCustomer({
    rhythm,
    monthly,
    articles,
    hasActiveRun: Boolean(run),
    freshness: { ...freshness, runAsOfDate: run?.asOfDate ?? null },
  });

  return {
    customerId,
    today,
    asOfDate: run?.asOfDate ?? null,
    runStartedAt: run?.startedAt ?? null,
    hasActiveRun: Boolean(run),
    freshness,
    lastIngestedAt: documents.reduce<Date | null>(
      (max, x) => (x.ingestedAt && (!max || x.ingestedAt > max) ? x.ingestedAt : max),
      null,
    ),
    documentCount: documentDates.length,
    purchaseDayCount: purchaseDays.length,
    rhythm,
    monthly,
    summary,
    articles,
    groups: groupArticles(articles),
    /** Zadržano radi postojećih testova i ekrana preporuka. */
    signals: groupCustomerSignals(rows),
  };
}

/** Profil jednog kupca (kartica). Opseg je već proveren kod pozivaoca. */
export async function loadCustomerProfile(customerId: string, now: Date = new Date()) {
  const { profiles } = await loadCustomerProfiles({ customerIds: [customerId] }, now);
  return profiles.get(customerId)!;
}

export type CustomerProfile = Awaited<ReturnType<typeof loadCustomerProfile>>;
export type CustomerArticle = CustomerProfile["articles"][number];
