import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Vrsta zapisa o rezervnoj kopiji (0036). Vidi lib/backup/status.mjs. */
export const backupRunKind = pgEnum("backup_run_kind", ["db_verified", "offsite_stored", "pdf_backup"]);

/** Evidencija rezervnih kopija — samo dodavanje; upisuje posebna uloga, aplikacija čita. */
export const backupRuns = pgTable(
  "backup_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: backupRunKind("kind").notNull(),
    ok: boolean("ok").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull().defaultNow(),
    sourceLabel: text("source_label"),
    dumpSha256: text("dump_sha256"),
    encryptedSha256: text("encrypted_sha256"),
    bytes: bigint("bytes", { mode: "number" }),
    migrations: integer("migrations"),
    tables: integer("tables"),
    rows: bigint("rows", { mode: "number" }),
    filesNew: integer("files_new"),
    filesChanged: integer("files_changed"),
    filesMissing: integer("files_missing"),
    detail: text("detail"),
    githubRunId: text("github_run_id"),
    recordedBy: text("recorded_by").notNull(),
  },
  (t) => [index("backup_runs_kind_recent_idx").on(t.kind, t.finishedAt)],
);
