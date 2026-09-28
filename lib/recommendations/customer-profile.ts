import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
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
} from "@/lib/recommendations/customerSummary.mjs";
import { recommendationRows } from "@/lib/recommendations/query";

/**
 * Profil JEDNOG kupca za komercijalistu i gazdu.
 *
 * Pozivalac MORA pre ovoga proći `requireCustomerAccess(user, customerId)`.
 * Ova funkcija opseg ne proverava — prima već dozvoljen ID, isto kao
 * `recommendationRows`, kome prosleđuje opseg od tačno tog jednog kupca.
 *
 * Ulaz je isti uski pogled kao za preporuke (`recommendation_input_lines`):
 * samo validne, originalne fakture sa izvornim dokumentom, za kupca čija je
 * šifra partnera TRENUTNO potvrđena. Promet koji tu nije ne postoji za profil —
 * i profil to kaže, umesto da nagađa.
 */
export async function loadCustomerProfile(customerId: string, now: Date = new Date()) {
  const db = getDb();

  // Isti dan kao aktivni prolaz preporuka, da ritam i signali govore o istom danu.
  const [run] = [
    ...(await db.execute<{ as_of_date: string }>(sql`
      SELECT as_of_date::text AS as_of_date FROM recommendation_runs WHERE is_active LIMIT 1`)),
  ];
  const asOfDate = run?.as_of_date ?? belgradeDate(now);

  const [docs, perArticle] = await Promise.all([
    db.execute<{ invoice_id: string; d: string }>(sql`
      SELECT DISTINCT invoice_id, issued_on::text AS d
        FROM recommendation_input_lines
       WHERE customer_id = ${customerId}
         AND issued_on <= ${asOfDate}::date`),
    db.execute<{ article_code: string; article_name: string | null; dates: string[]; docs: number }>(sql`
      SELECT article_code,
             max(article_name) AS article_name,
             array_agg(DISTINCT issued_on::text ORDER BY issued_on::text) AS dates,
             count(DISTINCT invoice_id)::int AS docs
        FROM recommendation_input_lines
       WHERE customer_id = ${customerId}
         AND issued_on <= ${asOfDate}::date
       GROUP BY article_code`),
  ]);

  const documentDates = [...docs].map((x) => x.d);
  const purchaseDays = [...new Set(documentDates)].sort();
  const rhythm = evaluateCustomerRhythm({ customerId, purchaseDates: purchaseDays }, asOfDate);
  const rows = run ? await recommendationRows({ customerIds: [customerId] }, { limit: 1000 }) : [];
  const byCode = new Map(rows.map((r) => [r.articleCode, r]));
  const asOf = dayNumber(asOfDate);

  const articles = [...perArticle].map((a) => {
    const r = byCode.get(a.article_code);
    const last = a.dates[a.dates.length - 1];
    return {
      articleCode: a.article_code,
      articleName: r?.articleName ?? a.article_name,
      status: r?.status ?? "insufficient_history",
      confidence: r?.confidence ?? null,
      eventCount: r?.eventCount ?? a.dates.length,
      documentCount: a.docs,
      firstPurchaseOn: a.dates[0],
      lastPurchaseOn: last,
      medianIntervalDays: r?.medianIntervalDays ?? null,
      toleranceDays: r?.toleranceDays ?? null,
      expectedNextOn: r?.expectedNextOn ?? null,
      daysUntilExpected: r?.daysUntilExpected ?? null,
      daysSinceLastPurchase: asOf - dayNumber(last),
      explanation: r?.explanation ?? (a.dates.length === 1
        ? "Jedna potvrđena kupovina; ritam se ne procenjuje."
        : "Premalo kupovina za procenu ritma."),
      purchaseDates: a.dates,
    };
  });

  const monthly = monthlyRhythm(documentDates, asOfDate);
  const summary = summarizeCustomer({ rhythm, monthly, articles, hasActiveRun: Boolean(run) });

  return {
    asOfDate,
    hasActiveRun: Boolean(run),
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

export type CustomerProfile = Awaited<ReturnType<typeof loadCustomerProfile>>;
export type CustomerArticle = CustomerProfile["articles"][number];
