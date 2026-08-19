import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const importStatus = pgEnum("import_status", [
  "u_toku",
  "uspesno",
  "uspesno_sa_upozorenjima",
  "greska",
  "preskoceno_duplikat",
]);

export const importRowStatus = pgEnum("import_row_status", [
  "ispravan",
  "duplikat",
  "upozorenje",
  "neispravan",
]);

/**
 * Jedan pokušaj uvoza jednog fajla.
 *
 * `fileHash` je otisak sadržaja i nosi jedinstveni indeks: isti fajl ne može da
 * se uveze dvaput. Ponovni pokušaj se evidentira kao `preskoceno_duplikat`, da
 * bi u istoriji ostao trag da je neko pokušao.
 */
export const importRuns = pgTable(
  "import_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fileName: text("file_name").notNull(),
    /** Identifikator izvora (folder, putanja) — bez pretpostavke o rednom broju. */
    sourcePath: text("source_path"),
    fileHash: text("file_hash").notNull(),
    dataDate: text("data_date"),
    status: importStatus("status").notNull().default("u_toku"),
    rowsRead: integer("rows_read").notNull().default(0),
    rowsValid: integer("rows_valid").notNull().default(0),
    rowsDuplicate: integer("rows_duplicate").notNull().default(0),
    rowsWarning: integer("rows_warning").notNull().default(0),
    rowsInvalid: integer("rows_invalid").notNull().default(0),
    invoicesCreated: integer("invoices_created").notNull().default(0),
    invoicesUpdated: integer("invoices_updated").notNull().default(0),
    startedBy: uuid("started_by").references(() => users.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    message: text("message"),
  },
  (table) => [
    // Otisak fajla je brava protiv dvostrukog uvoza.
    uniqueIndex("import_runs_file_hash_key").on(table.fileHash),
    index("import_runs_started_idx").on(table.startedAt),
  ],
);

/**
 * Privremeni sloj: svaki red iz fajla se prvo zapiše ovde sa rezultatom provere,
 * pa se tek ispravni redovi prenose u konačne tabele. Neispravan red nikada ne
 * ulazi u promet, ali ostaje vidljiv u izveštaju o greškama.
 */
export const importRows = pgTable(
  "import_rows",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: bigserial("run_id", { mode: "number" })
      .notNull()
      .references(() => importRuns.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    status: importRowStatus("status").notNull(),
    field: text("field"),
    message: text("message"),
    /** Izvorni red, radi ispravke u knjigovodstvu. */
    raw: jsonb("raw"),
  },
  (table) => [
    index("import_rows_run_idx").on(table.runId, table.status),
  ],
);
