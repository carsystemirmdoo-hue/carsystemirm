import { sql } from "drizzle-orm";
import { date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/*
 * Ručni uvoz lagera iz BizniSofta (migracija 0050, dok. 65).
 * Čuvaju se samo šifra, naziv i izvorna količina — bez cena, vrednosti i marži.
 * Veza sa artiklom, JM i pakovanjem se računa pri čitanju (articles, article_pack_sizes).
 */

export const stockImportStatus = pgEnum("stock_import_status", ["pregled", "potvrdjeno", "odbaceno", "neuspesno"]);

/** Jedno otpremanje XLSX/CSV fajla. SHA-256 je jedinstven: isti fajl ne pravi duplikat. */
export const stockImports = pgTable(
  "stock_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileSha256: text("file_sha256").notNull(),
    fileName: text("file_name").notNull(),
    fileBytes: integer("file_bytes").notNull(),
    fileFormat: text("file_format").notNull(),
    parserVersion: text("parser_version").notNull(),
    warehouseCode: text("warehouse_code"),
    warehouseName: text("warehouse_name"),
    /** „Na dan" iz izveštaja — datum STANJA. Vreme izvoza izveštaj ne nosi. */
    stockDate: date("stock_date"),
    printedOn: date("printed_on"),
    lineCount: integer("line_count").notNull(),
    summary: jsonb("summary").notNull().default({}),
    problems: jsonb("problems").notNull().default({ errors: [], warnings: [] }),
    status: stockImportStatus("status").notNull().default("pregled"),
    uploadedBy: uuid("uploaded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "restrict" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    /** Pravilo čuvanja (0051): stavke uklonjene; zapis otpremanja ostaje. */
    linesPurgedAt: timestamp("lines_purged_at", { withTimezone: true }),
    linesPurgedReason: text("lines_purged_reason"),
    /** 0053: otisak normalizovanog sadržaja (magacin, datum stanja, stavke ≠ 0) — isti za PDF i XLSX. */
    contentSha256: text("content_sha256"),
  },
  (t) => [
    // 0052: isti fajl + ista verzija čitača jednom; najviše jedan zapis koji nije „neuspešno“.
    unique("stock_imports_sha_parser_key").on(t.fileSha256, t.parserVersion),
    uniqueIndex("stock_imports_sha_live_key").on(t.fileSha256).where(sql`${t.status} <> 'neuspesno'`),
    uniqueIndex("stock_imports_content_live_key").on(t.contentSha256).where(sql`${t.contentSha256} IS NOT NULL AND ${t.status} IN ('pregled', 'potvrdjeno')`),
    index("stock_imports_status_idx").on(t.status, t.decidedAt),
    index("stock_imports_uploaded_idx").on(t.uploadedAt),
  ],
);

/** Pročitane stavke (samo dodavanje). `quantity` NULL = prazna ćelija, ne nula. */
export const stockImportLines = pgTable(
  "stock_import_lines",
  {
    importId: uuid("import_id").notNull().references(() => stockImports.id, { onDelete: "restrict" }),
    lineNo: integer("line_no").notNull(),
    sourceRow: integer("source_row").notNull(),
    sourceCode: text("source_code").notNull(),
    codeKey: text("code_key"),
    name: text("name").notNull().default(""),
    quantity: numeric("quantity", { precision: 14, scale: 3 }),
  },
  (t) => [
    primaryKey({ name: "stock_import_lines_pk", columns: [t.importId, t.lineNo] }),
    unique("stock_import_lines_code_key").on(t.importId, t.sourceCode),
    index("stock_import_lines_key_idx").on(t.importId, t.codeKey),
  ],
);

/**
 * Interna evidencija opreme (0054): BizniSoft šifra (tekst) → „Oprema — izdaje se na revers“.
 * Ne prodaje se i nema prodajno pakovanje; nije „van programa“. Brisanje nije dozvoljeno (okidač).
 */
export const internalEquipment = pgTable("internal_equipment", {
  code: text("code").primaryKey(),
  codeKey: text("code_key").notNull().unique("internal_equipment_key_unique"),
  name: text("name").notNull(),
  unit: text("unit"),
  classification: text("classification").notNull().default("oprema_revers"),
  evidence: text("evidence").notNull(),
  note: text("note"),
  decidedBy: uuid("decided_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 0055: naziv za kupca (izvorni BizniSoft naziv u `articles.name` ostaje). */
export const articleSalesNames = pgTable("article_sales_names", {
  articleId: uuid("article_id").primaryKey(),
  name: text("name").notNull(),
  evidence: text("evidence").notNull(),
  decidedBy: uuid("decided_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 0055: prodaja do rasprodaje — potvrđen lager sa stanjem 0 trajno povlači artikal iz ponude. */
export const articleSellout = pgTable("article_sellout", {
  articleId: uuid("article_id").primaryKey(),
  evidence: text("evidence").notNull(),
  decidedBy: uuid("decided_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endedImportId: uuid("ended_import_id"),
});
