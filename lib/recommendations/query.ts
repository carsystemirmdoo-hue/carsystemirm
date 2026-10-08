import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { LedgerScope } from "@/lib/ledger/effective-sales";
import type {
  RecommendationConfidence,
  RecommendationStatus,
} from "@/db/schema";

/**
 * Čitanje preporuka za interni ekran.
 *
 * Čita ISKLJUČIVO iz pogleda `active_recommendations`. Direktan upit nad
 * `recommendation_results` bi propustio i redove prolaza koji je pao ili je još
 * u toku — dakle preporuke koje nikad nisu objavljene.
 *
 * Opseg je OBAVEZAN parametar i razrešava se na serveru, iz sesije. Nijedan
 * parametar iz adrese ga ne dodiruje: `customerId` i ostali filteri se dodaju
 * uz opseg, uvek kroz `AND`, pa je rezultat presek — nikad unija.
 */

export type RecommendationRow = {
  id: string;
  customerId: string;
  customerName: string;
  articleCode: string;
  articleName: string | null;
  firstPurchaseOn: string;
  lastPurchaseOn: string;
  eventCount: number;
  medianIntervalDays: number | null;
  dispersionDays: number | null;
  stability: number | null;
  expectedNextOn: string | null;
  toleranceDays: number | null;
  windowFromOn: string | null;
  windowToOn: string | null;
  daysUntilExpected: number | null;
  daysSinceLastPurchase: number;
  status: RecommendationStatus;
  confidence: RecommendationConfidence;
  reasons: string[];
  confidenceComponents: Record<string, unknown>;
  explanation: string;
  algorithmVersion: string;
  asOfDate: string;
};

export type RecommendationFilter = {
  /** Slobodan tekst: naziv kupca, šifra ili naziv artikla. */
  q?: string;
  status?: RecommendationStatus[];
  confidence?: RecommendationConfidence[];
  /**
   * Komercijalista čije kupce treba prikazati.
   *
   * SUŽAVA opseg, nikad ga ne širi: dodele traženog korisnika se presecaju sa
   * opsegom pozivaoca, pa gazda može da gleda tuđi portfolio, a komercijalista
   * ne može da kroz ovaj parametar dohvati tuđe kupce.
   */
  salespersonUserId?: string;
  /**
   * Status kupca. Podrazumevano `aktivni`: neaktivni kupci (više ne rade sa
   * nama) se izostavljaju iz liste i brojača; vide se izborom `neaktivni`/`svi`.
   */
  customerStatus?: "aktivni" | "neaktivni" | "svi";
  limit?: number;
};

function uOpsegu(scope: LedgerScope): SQL {
  if (scope.customerIds === null) return sql`true`;
  if (scope.customerIds.length === 0) return sql`false`;
  const lista = sql.join(
    scope.customerIds.map((id) => sql`${id}`),
    sql`, `,
  );
  return sql`r.customer_id IN (${lista})`;
}

function uslovi(scope: LedgerScope, filter: RecommendationFilter): SQL {
  const lista: SQL[] = [uOpsegu(scope)];
  const statusKupca = filter.customerStatus ?? "aktivni";
  if (statusKupca === "aktivni") lista.push(sql`c.active`);
  else if (statusKupca === "neaktivni") lista.push(sql`NOT c.active`);

  if (filter.status?.length) {
    lista.push(
      sql`r.status IN (${sql.join(
        filter.status.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  }
  if (filter.confidence?.length) {
    lista.push(
      sql`r.confidence IN (${sql.join(
        filter.confidence.map((c) => sql`${c}`),
        sql`, `,
      )})`,
    );
  }
  if (filter.salespersonUserId) {
    /*
     * `EXISTS`, ne `JOIN`: kupac dodeljen dvojici komercijalista ne sme da se
     * pojavi kao dva reda iste preporuke.
     */
    lista.push(sql`EXISTS (
      SELECT 1 FROM customer_assignments ca
       WHERE ca.customer_id = r.customer_id
         AND ca.user_id = ${filter.salespersonUserId}
    )`);
  }
  if (filter.q && filter.q.trim() !== "") {
    /*
     * Pretraga po pojmu, sa ESCAPE-ovanim džokerima.
     *
     * Bez toga bi `%` iz unosa pretvorio pretragu u „sve", a `_` u „bilo koji
     * znak" — što nad šifrom artikla znači tuđi artikal u rezultatu.
     */
    const pojam = `%${filter.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    lista.push(sql`(
         c.name ILIKE ${pojam}
      OR r.article_code ILIKE ${pojam}
      OR coalesce(r.article_name, '') ILIKE ${pojam}
    )`);
  }
  return sql.join(lista, sql` AND `);
}

/**
 * Redovi za prikaz.
 *
 * Sortiranje je potpuno određeno i poslovno smisleno: prvo ono što najviše
 * kasni, pa po pouzdanosti, pa po kupcu i šifri. Poslednja dva ključa nisu
 * kozmetika — bez njih bi dva učitavanja iste strane mogla da vrate iste redove
 * u drugom redosledu.
 */
export async function recommendationRows(
  scope: LedgerScope,
  filter: RecommendationFilter = {},
): Promise<RecommendationRow[]> {
  const db = getDb();
  const redovi = await db.execute<{
    id: string; customer_id: string; customer_name: string;
    article_code: string; article_name: string | null;
    first_purchase_on: string; last_purchase_on: string; event_count: number;
    median_interval_days: number | null; dispersion_days: number | null;
    stability: string | null; expected_next_on: string | null;
    tolerance_days: number | null; window_from_on: string | null;
    window_to_on: string | null; days_until_expected: number | null;
    days_since_last_purchase: number; status: RecommendationStatus;
    confidence: RecommendationConfidence; reasons: string[];
    confidence_components: Record<string, unknown>; explanation: string;
    algorithm_version: string; as_of_date: string;
  }>(sql`
    SELECT r.id, r.customer_id, c.name AS customer_name,
           r.article_code, r.article_name,
           r.first_purchase_on::text AS first_purchase_on,
           r.last_purchase_on::text  AS last_purchase_on,
           r.event_count, r.median_interval_days, r.dispersion_days,
           r.stability::text AS stability,
           r.expected_next_on::text AS expected_next_on,
           r.tolerance_days,
           r.window_from_on::text AS window_from_on,
           r.window_to_on::text   AS window_to_on,
           r.days_until_expected, r.days_since_last_purchase,
           r.status, r.confidence, r.reasons, r.confidence_components,
           r.explanation, r.algorithm_version, r.as_of_date::text AS as_of_date
      FROM active_recommendations r
      JOIN customers c ON c.id = r.customer_id
     WHERE ${uslovi(scope, filter)}
     ORDER BY
       /*
        * Redosled odgovara pitanju „koga da zovem prvog".
        *
        * days_until_expected raste od najvećeg kašnjenja (najnegativnije)
        * ka budućnosti, pa je prirodni prvi ključ. NULLS LAST drži redove bez
        * procene na dnu umesto na vrhu, gde ih Postgres podrazumevano stavlja
        * kod rastućeg redosleda.
        */
       r.days_until_expected ASC NULLS LAST,
       CASE r.confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       c.name, r.article_code
     LIMIT ${filter.limit ?? 300}
  `);

  return redovi.map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    articleCode: r.article_code,
    articleName: r.article_name,
    firstPurchaseOn: String(r.first_purchase_on).slice(0, 10),
    lastPurchaseOn: String(r.last_purchase_on).slice(0, 10),
    eventCount: r.event_count,
    medianIntervalDays: r.median_interval_days,
    dispersionDays: r.dispersion_days,
    stability: r.stability === null ? null : Number(r.stability),
    expectedNextOn: r.expected_next_on ? String(r.expected_next_on).slice(0, 10) : null,
    toleranceDays: r.tolerance_days,
    windowFromOn: r.window_from_on ? String(r.window_from_on).slice(0, 10) : null,
    windowToOn: r.window_to_on ? String(r.window_to_on).slice(0, 10) : null,
    daysUntilExpected: r.days_until_expected,
    daysSinceLastPurchase: r.days_since_last_purchase,
    status: r.status,
    confidence: r.confidence,
    reasons: r.reasons ?? [],
    confidenceComponents: r.confidence_components ?? {},
    explanation: r.explanation,
    algorithmVersion: r.algorithm_version,
    asOfDate: String(r.as_of_date).slice(0, 10),
  }));
}

/**
 * Koliko ima redova po statusu, u opsegu i pod istim filterima.
 *
 * Broji se U BAZI, nad celim skupom — ne nad učitanom stranom. Brojanje
 * učitanih redova bi posle `LIMIT`-a davalo broj koji zavisi od veličine
 * strane, a to bi na ekranu izgledalo kao da preporuka ima manje nego što ih
 * stvarno ima.
 */
export async function recommendationStatusCounts(
  scope: LedgerScope,
  filter: RecommendationFilter = {},
): Promise<Record<string, number>> {
  const db = getDb();
  const redovi = await db.execute<{ status: string; broj: number }>(sql`
    SELECT r.status::text AS status, count(*)::int AS broj
      FROM active_recommendations r
      JOIN customers c ON c.id = r.customer_id
     WHERE ${uslovi(scope, filter)}
     GROUP BY 1
  `);
  const out: Record<string, number> = {};
  for (const red of redovi) out[red.status] = red.broj;
  return out;
}

/** Komercijalisti koji imaju bar jednog kupca u opsegu — za filter. */
export async function salespeopleInScope(
  scope: LedgerScope,
): Promise<{ id: string; name: string }[]> {
  const db = getDb();
  const redovi = await db.execute<{ id: string; name: string }>(sql`
    SELECT DISTINCT u.id, u.name
      FROM customer_assignments ca
      JOIN users u ON u.id = ca.user_id
     WHERE ${
       scope.customerIds === null
         ? sql`true`
         : scope.customerIds.length === 0
           ? sql`false`
           : sql`ca.customer_id IN (${sql.join(
               scope.customerIds.map((id) => sql`${id}`),
               sql`, `,
             )})`
     }
     ORDER BY u.name
  `);
  return redovi.map((r) => ({ id: r.id, name: r.name }));
}
