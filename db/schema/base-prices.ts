import { boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { customers } from "./permissions";
import { articles } from "./sales";
import { users } from "./users";

/*
 * Osnovne (VP) cene iz BizniSoft cenovnika i ručne izmene gazde (migracija 0038).
 * Rabati kupaca su u `price_rules`; konačna cena se izračunava, ne čuva se ovde.
 */

export const priceImportStatus = pgEnum("price_import_status", ["pregled", "primenjeno", "odbaceno"]);
export const basePriceSource = pgEnum("base_price_source", ["cenovnik", "rucno"]);

/** Jedno otpremanje PDF-a. SHA-256 je jedinstven: isti fajl ne pravi duplikat. */
export const priceListImports = pgTable(
  "price_list_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileSha256: text("file_sha256").notNull(),
    fileName: text("file_name").notNull(),
    fileBytes: integer("file_bytes").notNull(),
    parserVersion: text("parser_version").notNull(),
    reportTitle: text("report_title").notNull(),
    /** „Na dan“ iz izveštaja — datum STANJA, ne početak važenja. */
    reportDate: date("report_date").notNull(),
    printDate: date("print_date"),
    businessUnit: text("business_unit"),
    currency: text("currency").notNull().default("RSD"),
    pageCount: integer("page_count").notNull(),
    rowCount: integer("row_count").notNull(),
    checks: jsonb("checks").notNull(),
    problems: jsonb("problems").notNull().default([]),
    status: priceImportStatus("status").notNull().default("pregled"),
    uploadedBy: uuid("uploaded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "restrict" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** Datum važenja — bira gazda pri primeni (>= report_date). */
    validFrom: date("valid_from"),
    decisionNote: text("decision_note"),
    appliedCount: integer("applied_count"),
  },
  (t) => [unique("price_list_imports_sha_key").on(t.fileSha256), index("price_list_imports_status_idx").on(t.status, t.uploadedAt)],
);

/** Tačno pročitane stavke (bez nabavne cene, stanja i marže). Samo dodavanje. */
export const priceListImportRows = pgTable(
  "price_list_import_rows",
  {
    importId: uuid("import_id").notNull().references(() => priceListImports.id, { onDelete: "restrict" }),
    lineNo: integer("line_no").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    vatPercent: numeric("vat_percent", { precision: 5, scale: 2 }).notNull(),
    vpPrice: numeric("vp_price", { precision: 14, scale: 2 }).notNull(),
    page: integer("page").notNull(),
  },
  (t) => [primaryKey({ name: "price_list_import_rows_pk", columns: [t.importId, t.lineNo] })],
);

/** Istorija osnovne cene po artiklu. Važeća na dan D = poslednji valid_from <= D. Samo dodavanje. */
export const articleBasePrices = pgTable(
  "article_base_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id").notNull().references(() => articles.id, { onDelete: "restrict" }),
    netPrice: numeric("net_price", { precision: 14, scale: 2 }).notNull(),
    vatPercent: numeric("vat_percent", { precision: 5, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("RSD"),
    validFrom: date("valid_from").notNull(),
    source: basePriceSource("source").notNull(),
    importId: uuid("import_id").references(() => priceListImports.id, { onDelete: "restrict" }),
    reason: text("reason"),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("article_base_prices_import_article_key").on(t.importId, t.articleId),
    index("article_base_prices_effective_idx").on(t.articleId, t.validFrom, t.createdAt),
  ],
);

/**
 * Program artikla (0040): da li je artikal u aktuelnoj ponudi. Samo dodavanje;
 * važi poslednja odluka; artikal bez odluke je u programu. Istorija artikla
 * (fakture, cene, pravila) ostaje — van programa znači samo „nije u ponudi“.
 */
export const articleProgrammeDecisions = pgTable(
  "article_programme_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id").notNull().references(() => articles.id, { onDelete: "restrict" }),
    inProgramme: boolean("in_programme").notNull(),
    reason: text("reason").notNull(),
    sourceBatch: text("source_batch"),
    decidedBy: uuid("decided_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("article_programme_decisions_latest_idx").on(t.articleId, t.decidedAt, t.id)],
);

/**
 * Poseban poslovni status kupca (0042). Samo dodavanje; važi poslednja odluka.
 * Kupac bez odluke je redovan. Iz uslova posebnih kupaca ništa se ne izvodi.
 */
export const customerCommercialStatusDecisions = pgTable(
  "customer_commercial_status_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    reason: text("reason").notNull(),
    decidedBy: uuid("decided_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customer_commercial_status_latest_idx").on(t.customerId, t.decidedAt, t.id)],
);
