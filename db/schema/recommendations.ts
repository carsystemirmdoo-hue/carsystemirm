import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./permissions";
import { users } from "./users";

/**
 * Preporuke — prolaz i rezultat.
 *
 * Spisak vrednosti mora da odgovara `lib/recommendations/policy.mjs`; test
 * `recommendationRecompute.integration.test.mts` to i proverava, da se enum u
 * bazi i enum u algoritmu ne bi razišli tiho.
 */

export const recommendationRunStatus = pgEnum("recommendation_run_status", [
  "running",
  "succeeded",
  "failed",
]);

/**
 * Šta je pokrenulo prolaz.
 *
 * Jedna vrednost u V1. Automatski recompute posle svakog dokumenta bi tokom
 * uvoza istorije pokrenuo hiljade prolaza, a prvi koji bi se poklopio sa
 * polovinom uvoza dao bi preporuke nad nepotpunim podacima.
 */
export const recommendationTrigger = pgEnum("recommendation_trigger", ["manual"]);

export const recommendationStatus = pgEnum("recommendation_status", [
  "insufficient_history",
  "provisional",
  "dormant",
  "overdue",
  "due",
  "due_soon",
  "not_yet",
]);

export const recommendationConfidence = pgEnum("recommendation_confidence", [
  "low",
  "medium",
  "high",
]);

export type RecommendationRunStatus =
  (typeof recommendationRunStatus.enumValues)[number];
export type RecommendationStatus = (typeof recommendationStatus.enumValues)[number];
export type RecommendationConfidence =
  (typeof recommendationConfidence.enumValues)[number];

export const recommendationRuns = pgTable(
  "recommendation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    algorithmVersion: text("algorithm_version").notNull(),
    /** Dan na koji je sve računato; nikad izveden iz sata servera. */
    asOfDate: date("as_of_date").notNull(),
    dateBasis: text("date_basis").notNull().default("issued_on"),
    status: recommendationRunStatus("status").notNull().default("running"),
    triggerSource: recommendationTrigger("trigger_source").notNull().default("manual"),
    requestedBy: uuid("requested_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    /**
     * Rezultati ovog prolaza su ono što se prikazuje.
     *
     * Postavlja se tek u transakciji koja je uspela, i to POSLE upisa svih
     * rezultata — pa delimično objavljen prolaz ne postoji.
     */
    isActive: boolean("is_active").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** `null` = bez ograničenja; broj = koliko je kupaca bilo u opsegu. */
    scopeCustomerCount: integer("scope_customer_count"),

    inputLinesAccepted: integer("input_lines_accepted").notNull().default(0),
    inputLinesExcluded: integer("input_lines_excluded").notNull().default(0),
    eventCount: integer("event_count").notNull().default(0),
    customerCount: integer("customer_count").notNull().default(0),
    articleCount: integer("article_count").notNull().default(0),
    pairCount: integer("pair_count").notNull().default(0),
    repeatPairCount: integer("repeat_pair_count").notNull().default(0),
    resultCount: integer("result_count").notNull().default(0),

    exclusions: jsonb("exclusions").notNull().default({}),
    statusCounts: jsonb("status_counts").notNull().default({}),
    confidenceCounts: jsonb("confidence_counts").notNull().default({}),

    failureCode: text("failure_code"),
    failureDetail: text("failure_detail"),
  },
  (table) => [
    /*
     * Najviše jedan AKTIVAN i najviše jedan prolaz U TOKU po verziji.
     *
     * Brava iza „server restart ne sme napraviti duple aktivne rezultate" i
     * „dva paralelna recompute-a". Aplikativna provera ne preživljava pad
     * procesa između dva koraka; delimičan jedinstveni indeks preživljava.
     */
    uniqueIndex("recommendation_runs_one_active")
      .on(table.algorithmVersion)
      .where(sql`${table.isActive}`),
    uniqueIndex("recommendation_runs_one_running")
      .on(table.algorithmVersion)
      .where(sql`${table.status} = 'running'`),
    index("recommendation_runs_started_idx").on(table.startedAt),
  ],
);

export type RecommendationRunRow = typeof recommendationRuns.$inferSelect;

export const recommendationResults = pgTable(
  "recommendation_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => recommendationRuns.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    /** EXACT BizniSoft šifra, tekst, sa vodećim nulama. */
    articleCode: text("article_code").notNull(),
    /** Snapshot naziva; prikaz, nikad identitet i nikad osnov povezivanja. */
    articleName: text("article_name"),

    firstPurchaseOn: date("first_purchase_on").notNull(),
    lastPurchaseOn: date("last_purchase_on").notNull(),
    eventCount: integer("event_count").notNull(),

    /** `null` kada procena ne postoji — nikad nula kao zamena za „ne znam". */
    medianIntervalDays: integer("median_interval_days"),
    dispersionDays: integer("dispersion_days"),
    stability: numeric("stability", { precision: 4, scale: 2 }),
    expectedNextOn: date("expected_next_on"),
    toleranceDays: integer("tolerance_days"),
    windowFromOn: date("window_from_on"),
    windowToOn: date("window_to_on"),
    daysUntilExpected: integer("days_until_expected"),
    daysSinceLastPurchase: integer("days_since_last_purchase").notNull(),

    status: recommendationStatus("status").notNull(),
    confidence: recommendationConfidence("confidence").notNull(),
    reasons: text("reasons").array().notNull().default([]),
    confidenceComponents: jsonb("confidence_components").notNull().default({}),
    explanation: text("explanation").notNull(),

    /*
     * Ponovljeno uz svaki red namerno: red se izvozi, i izvezen mora sam sebe
     * objasniti bez pristupa tabeli prolaza.
     */
    algorithmVersion: text("algorithm_version").notNull(),
    asOfDate: date("as_of_date").notNull(),
    dateBasis: text("date_basis").notNull().default("issued_on"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("recommendation_results_pair_key").on(
      table.runId,
      table.customerId,
      table.articleCode,
    ),
    index("recommendation_results_run_status_idx").on(table.runId, table.status),
    index("recommendation_results_customer_idx").on(table.runId, table.customerId),
  ],
);

export type RecommendationResultRow = typeof recommendationResults.$inferSelect;
