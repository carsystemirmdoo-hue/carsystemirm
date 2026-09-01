import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  recommendationResults,
  recommendationRuns,
  type RecommendationRunRow,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import type { LedgerScope } from "@/lib/ledger/effective-sales";
import {
  assertAsOfDate,
  inputDiagnostics,
  purchaseEvents,
} from "@/lib/ledger/recommendation-input";
import { evaluateAll } from "@/lib/recommendations/cadence.mjs";
import { ALGORITHM_VERSION, DATE_BASIS, DEFAULT_POLICY } from "@/lib/recommendations/policy.mjs";

/**
 * Recompute preporuka.
 *
 * Jedan prolaz = jedan red u `recommendation_runs` + skup redova u
 * `recommendation_results`. Rezultati postaju vidljivi tek kada se prolaz
 * označi kao aktivan, a to se dešava u ISTOJ transakciji, POSLE upisa svega —
 * pa delimično objavljen prolaz ne postoji ni na trenutak.
 *
 * Šta ovaj modul ne radi
 * ----------------------
 * Ne čita `invoices` ni `invoice_lines` (to radi isključivo ulazni sloj), ne
 * računa nijednu vrednost sam (to radi isključivo `cadence.mjs`), i ne odlučuje
 * ko sme da ga pokrene (to radi pozivalac, kroz `requireCapability`).
 */

export class RecomputeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RecomputeError";
  }
}

export type RecomputeActor = { id: string; name: string; role: string };

export type RecomputeSummary = {
  runId: string;
  algorithmVersion: string;
  asOfDate: string;
  resultCount: number;
  pairCount: number;
  repeatPairCount: number;
};

/**
 * Prolaz koji je ostao „u toku" posle pada procesa.
 *
 * Bez ovoga bi jedan restart trajno zaključao recompute: delimičan jedinstveni
 * indeks dozvoljava tačno jedan prolaz u toku, a zaostali nikada ne bi završio.
 * Granica je namerno velika — prolaz koji legitimno traje sat vremena ne sme da
 * bude proglašen mrtvim dok radi.
 */
const ZASTOJ_MINUTA = 60;

/**
 * Pokreće recompute i objavljuje ga atomično.
 *
 * @param scope opseg razrešen NA SERVERU iz sesije; nikad iz zahteva
 * @param input `asOfDate` je obavezan i eksplicitan
 * @param actor ko je pokrenuo; ulazi u trag revizije i u red prolaza
 */
export async function recomputeRecommendations(
  scope: LedgerScope,
  input: { asOfDate: string },
  actor: RecomputeActor,
): Promise<RecomputeSummary> {
  const asOfDate = assertAsOfDate(input.asOfDate);
  const db = getDb();

  await zatvoriZaostale();

  /*
   * Prolaz se otvara PRE računanja, van velike transakcije.
   *
   * Zahvaljujući tome „recompute je pokrenut i pao" ostaje vidljivo kao red sa
   * `failed`, umesto da nestane zajedno sa transakcijom. Delimičan jedinstveni
   * indeks nad `status = 'running'` ovde odbija drugi istovremeni prolaz — i to
   * je namerno prvi zid, pre ijednog skupog upita.
   */
  let run: RecommendationRunRow;
  try {
    [run] = await db
      .insert(recommendationRuns)
      .values({
        algorithmVersion: ALGORITHM_VERSION,
        asOfDate,
        dateBasis: DATE_BASIS,
        status: "running",
        triggerSource: "manual",
        requestedBy: actor.id,
        scopeCustomerCount: scope.customerIds === null ? null : scope.customerIds.length,
      })
      .returning();
  } catch {
    /*
     * Sirova greška baze se NE prosleđuje: naziv indeksa odaje šemu.
     * Jedini uzrok koji ovaj upis može imati je već otvoren prolaz.
     */
    throw new RecomputeError(
      "already_running",
      "Preračunavanje je već u toku. Sačekajte da se završi.",
    );
  }

  try {
    const [dijagnostika, events] = await Promise.all([
      inputDiagnostics(scope, { asOfDate }),
      purchaseEvents(scope, { asOfDate }),
    ]);

    /*
     * Matematika ide kroz ČISTU funkciju, bez ijednog upita.
     *
     * Sve što je ovde ulaz već je prošlo `recommendation_input_lines`; jezgro
     * ne zna odakle su datumi došli i ne može da ih dopuni.
     */
    const ocene = evaluateAll(events, asOfDate, DEFAULT_POLICY);

    /*
     * Parovi sa jednom jedinom kupovinom se NE upisuju.
     *
     * Njih ima onoliko koliko ima kombinacija kupca i artikla — nad 3000
     * artikala i stotinama kupaca to su stotine hiljada redova koji svi nose
     * istu poruku: „nema šta da se predvidi". Broj ostaje u dijagnostici
     * prolaza (`pairCount` vs `repeatPairCount`), pa se ne gubi.
     */
    const zaUpis = ocene.filter((o) => o.status !== "insufficient_history");

    const statusCounts = prebroj(zaUpis.map((o) => o.status));
    const confidenceCounts = prebroj(zaUpis.map((o) => o.confidence));

    await db.transaction(async (tx) => {
      /*
       * Serijalizacija na nivou BAZE, ne procesa.
       *
       * Dva Node procesa (razvoj + produkcija nad istom bazom, ili dva
       * instance-a) ne dele memoriju. `pg_advisory_xact_lock` se otpušta sam na
       * kraju transakcije, i to i pri padu — za razliku od zaključavanja koje
       * bi neko morao da otključa.
       */
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('recommendation_publish'))`);

      if (zaUpis.length > 0) {
        /*
         * Upis u komadima.
         *
         * Jedan `INSERT` sa 50.000 redova probija granicu broja parametara u
         * protokolu; komad od 500 redova je daleko ispod nje, a i dalje je
         * jedan mrežni obilazak po komadu.
         */
        const KOMAD = 500;
        for (let i = 0; i < zaUpis.length; i += KOMAD) {
          await tx.insert(recommendationResults).values(
            zaUpis.slice(i, i + KOMAD).map((o) => ({
              runId: run.id,
              customerId: o.customerId,
              articleCode: o.articleCode,
              articleName: o.articleName,
              firstPurchaseOn: o.firstPurchaseOn as string,
              lastPurchaseOn: o.lastPurchaseOn as string,
              eventCount: o.eventCount,
              medianIntervalDays: o.medianIntervalDays,
              dispersionDays: o.dispersionDays,
              stability: o.stability === null ? null : String(o.stability),
              expectedNextOn: o.expectedNextOn,
              toleranceDays: o.toleranceDays,
              windowFromOn: o.windowFromOn,
              windowToOn: o.windowToOn,
              daysUntilExpected: o.daysUntilExpected,
              daysSinceLastPurchase: o.daysSinceLastPurchase as number,
              status: o.status,
              confidence: o.confidence,
              reasons: o.reasons,
              confidenceComponents: o.confidenceComponents,
              explanation: o.explanation,
              algorithmVersion: o.algorithmVersion,
              asOfDate: o.asOfDate,
              dateBasis: o.dateBasis,
            })),
          );
        }
      }

      /*
       * Prethodni aktivan prolaz se GASI, ne briše.
       *
       * Njegovi rezultati ostaju u bazi i mogu se uporediti sa novim — bez toga
       * pitanje „šta se promenilo od jučerašnjeg prolaza" nema odgovor.
       * Redosled (prvo gašenje, pa paljenje) je jedini koji ne sudara delimičan
       * jedinstveni indeks unutar iste transakcije.
       */
      await tx
        .update(recommendationRuns)
        .set({ isActive: false })
        .where(
          and(
            eq(recommendationRuns.algorithmVersion, ALGORITHM_VERSION),
            eq(recommendationRuns.isActive, true),
          ),
        );

      await tx
        .update(recommendationRuns)
        .set({
          status: "succeeded",
          isActive: true,
          finishedAt: sql`now()`,
          inputLinesAccepted: dijagnostika.accepted,
          inputLinesExcluded: dijagnostika.excludedTotal,
          eventCount: events.length,
          customerCount: new Set(events.map((e) => e.customerId)).size,
          articleCount: new Set(events.map((e) => e.articleCode)).size,
          pairCount: ocene.length,
          repeatPairCount: zaUpis.length,
          resultCount: zaUpis.length,
          exclusions: dijagnostika.excluded,
          statusCounts,
          confidenceCounts,
        })
        .where(eq(recommendationRuns.id, run.id));

      /*
       * Trag revizije u ISTOJ transakciji.
       *
       * Bez `tx` bi mogao ostati prolaz bez traga ili trag bez prolaza. Trag ne
       * nosi nijedan naziv kupca ni šifru artikla — samo brojeve i identitet
       * prolaza; ko hoće detalje, otvara prolaz.
       */
      await recordAudit(
        {
          actor,
          action: AUDIT_ACTIONS.recommendationRecomputed,
          entityType: "Preporuke — prolaz",
          entityId: run.id,
          entityLabel: `${ALGORITHM_VERSION} @ ${asOfDate}`,
          after: {
            rezultata: zaUpis.length,
            parova: ocene.length,
            dogadjaja: events.length,
            ulaznihRedova: dijagnostika.accepted,
            iskljucenihRedova: dijagnostika.excludedTotal,
            opsegKupaca: scope.customerIds === null ? "svi" : scope.customerIds.length,
          },
          reason: "Ručno pokrenuto preračunavanje preporuka.",
        },
        tx,
      );
    });

    return {
      runId: run.id,
      algorithmVersion: ALGORITHM_VERSION,
      asOfDate,
      resultCount: zaUpis.length,
      pairCount: ocene.length,
      repeatPairCount: zaUpis.length,
    };
  } catch (error) {
    /*
     * Neuspeh se ZAPISUJE i ne dira prethodni aktivan prolaz.
     *
     * `is_active` ovog prolaza nikad nije bio `true`, pa `active_recommendations`
     * i dalje vraća jučerašnje rezultate. To nije oporavak koji neko mora da
     * pokrene — to je posledica toga gde se `is_active` postavlja.
     */
    await db
      .update(recommendationRuns)
      .set({
        status: "failed",
        finishedAt: sql`now()`,
        failureCode: error instanceof RecomputeError ? error.code : "unexpected",
        failureDetail: kratkoObjasnjenje(error),
      })
      .where(eq(recommendationRuns.id, run.id));
    throw error;
  }
}

/**
 * Poruka koja sme u bazu.
 *
 * Bez `stack`-a, bez SQL-a i bez sadržaja reda: `failure_detail` se prikazuje
 * kancelariji, a poruka drajvera ume da nosi deo upita i vrednosti.
 */
function kratkoObjasnjenje(error: unknown): string {
  if (error instanceof RecomputeError) return error.message;
  if (error instanceof Error) return error.message.slice(0, 200);
  return "Nepoznata greška.";
}

/** @param vrednosti spisak vrednosti; vraća `{vrednost: broj}` */
function prebroj(vrednosti: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of vrednosti) out[v] = (out[v] ?? 0) + 1;
  return out;
}

/**
 * Zatvara prolaz koji je ostao „u toku" posle pada procesa.
 *
 * Ne pretpostavlja da je pao — proverava koliko dugo traje. Prolaz koji
 * legitimno traje pola sata mora da nastavi; zaostali od juče ne sme trajno da
 * zaključa dugme.
 */
async function zatvoriZaostale(): Promise<number> {
  const db = getDb();
  const zatvoreni = await db
    .update(recommendationRuns)
    .set({
      status: "failed",
      finishedAt: sql`now()`,
      failureCode: "interrupted",
      failureDetail: `Prolaz je prekinut; nije završio u ${ZASTOJ_MINUTA} minuta.`,
    })
    .where(
      and(
        eq(recommendationRuns.status, "running"),
        sql`${recommendationRuns.startedAt} < now() - ${sql.raw(`interval '${ZASTOJ_MINUTA} minutes'`)}`,
      ),
    )
    .returning({ id: recommendationRuns.id });
  return zatvoreni.length;
}

/* =========================================================================
 * Čitanje
 * ====================================================================== */

/** Poslednji uspešan (aktivan) prolaz, ili `null` dok ga nema. */
export async function activeRun(): Promise<RecommendationRunRow | null> {
  const db = getDb();
  const [red] = await db
    .select()
    .from(recommendationRuns)
    .where(
      and(
        eq(recommendationRuns.algorithmVersion, ALGORITHM_VERSION),
        eq(recommendationRuns.isActive, true),
      ),
    )
    .limit(1);
  return red ?? null;
}

/** Poslednjih nekoliko prolaza, radi vidljivosti neuspeha. */
export async function recentRuns(limit = 5): Promise<RecommendationRunRow[]> {
  const db = getDb();
  return db
    .select()
    .from(recommendationRuns)
    .orderBy(desc(recommendationRuns.startedAt))
    .limit(limit);
}
