import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  belgradeDate,
  evaluateCustomerRhythm,
  groupCustomerSignals,
} from "@/lib/recommendations/customerRhythm.mjs";
import { recommendationRows } from "@/lib/recommendations/query";

/**
 * Profil JEDNOG kupca za komercijalistu.
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

  const days = [
    ...(await db.execute<{ d: string; docs: number }>(sql`
      SELECT issued_on::text AS d, count(DISTINCT invoice_id)::int AS docs
        FROM recommendation_input_lines
       WHERE customer_id = ${customerId}
         AND issued_on <= ${asOfDate}::date
       GROUP BY issued_on
       ORDER BY issued_on`)),
  ];

  const rhythm = evaluateCustomerRhythm(
    { customerId, purchaseDates: days.map((x) => x.d) },
    asOfDate,
  );
  const rows = run ? await recommendationRows({ customerIds: [customerId] }, { limit: 1000 }) : [];

  return {
    asOfDate,
    hasActiveRun: Boolean(run),
    documentCount: days.reduce((sum, x) => sum + x.docs, 0),
    purchaseDayCount: days.length,
    rhythm,
    signals: groupCustomerSignals(rows),
  };
}

export type CustomerProfile = Awaited<ReturnType<typeof loadCustomerProfile>>;
