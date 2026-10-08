/*
 * Evidencija rezervnih kopija (prikaz u portalu).
 *
 * Tri odvojene vrste zapisa, jer svaka dokazuje nešto drugo:
 *   db_verified    — kopija baze napravljena iz jednog snimka i VRAĆENA u praznu
 *                    bazu; manifest (sve tabele obe šeme, sekvence, dozvole,
 *                    zbirovi prodaje) se poklopio;
 *   offsite_stored — šifrovana kopija preuzeta, otisak proveren, sačuvana VAN
 *                    GitHub-a;
 *   pdf_backup     — dnevna inkrementalna kopija izvornih PDF-ova završena.
 *
 * Zapisi se samo dodaju. Upisuje ih posebna uloga sa pravom INSERT samo nad
 * ovom tabelom (db/provisioning/backup-roles.sql); aplikacija sme samo da čita.
 * Nema poslovnih iznosa ni imena fajlova — samo otisci, brojevi i vreme.
 */
CREATE TYPE "backup_run_kind" AS ENUM ('db_verified', 'offsite_stored', 'pdf_backup');
--> statement-breakpoint
CREATE TABLE "backup_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" "backup_run_kind" NOT NULL,
  "ok" boolean NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source_label" text,
  "dump_sha256" text,
  "encrypted_sha256" text,
  "bytes" bigint,
  "migrations" integer,
  "tables" integer,
  "rows" bigint,
  "files_new" integer,
  "files_changed" integer,
  "files_missing" integer,
  "detail" text,
  "github_run_id" text,
  "recorded_by" text DEFAULT current_user NOT NULL,
  CONSTRAINT "backup_runs_sha_check" CHECK (
    ("dump_sha256" IS NULL OR "dump_sha256" ~ '^[0-9a-f]{64}$') AND
    ("encrypted_sha256" IS NULL OR "encrypted_sha256" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "backup_runs_text_check" CHECK (
    ("detail" IS NULL OR length("detail") <= 300) AND
    ("source_label" IS NULL OR length("source_label") <= 60) AND
    ("github_run_id" IS NULL OR "github_run_id" ~ '^[0-9]{1,20}$')
  ),
  CONSTRAINT "backup_runs_counts_check" CHECK (
    coalesce("bytes", 0) >= 0 AND coalesce("rows", 0) >= 0 AND coalesce("files_new", 0) >= 0 AND
    coalesce("files_changed", 0) >= 0 AND coalesce("files_missing", 0) >= 0
  )
);
--> statement-breakpoint
CREATE INDEX "backup_runs_kind_recent_idx" ON "backup_runs" ("kind", "finished_at" DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "backup_runs_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'backup_runs se samo dodaju' USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER "backup_runs_guard_trg"
  BEFORE UPDATE OR DELETE ON "backup_runs"
  FOR EACH ROW EXECUTE FUNCTION "backup_runs_guard"();
