/*
 * Automatski obračun preporuka posle uspešnog uvoza.
 *
 *   1. `recommendation_trigger` dobija `ingest`: prolaz koji nije pokrenuo
 *      čovek, pa nema `requested_by` (CHECK iz 0027 važi samo za `manual`).
 *   2. `recommendation_recompute_requests` — red zahteva. Uvoz upisuje zahtev,
 *      obrada ga izvršava posle odgovora. Najviše JEDAN čeka i najviše JEDAN
 *      radi (delimični jedinstveni indeksi), pa niz dokumenata iz jednog
 *      skeniranja daje jedan obračun. `input_fingerprint` (broj ulaznih
 *      stavki + poslednji uvoz) sprečava obračun kada ponovljen uvoz nije
 *      doneo ništa novo. Neuspeh ostaje zapisan i može se ponoviti.
 *
 * Povratni postupak: `db/rollback/0032_recompute_after_ingest.down.sql`.
 */
ALTER TYPE "recommendation_trigger" ADD VALUE IF NOT EXISTS 'ingest';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "recommendation_recompute_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL CHECK ("source" IN ('device', 'manual_upload', 'customer_mapping')),
  "status" text DEFAULT 'pending' NOT NULL
    CHECK ("status" IN ('pending', 'running', 'succeeded', 'failed', 'superseded')),
  "input_fingerprint" text NOT NULL,
  "document_count" integer DEFAULT 1 NOT NULL CHECK ("document_count" > 0),
  "attempts" integer DEFAULT 0 NOT NULL,
  "run_id" uuid REFERENCES "recommendation_runs"("id") ON DELETE restrict,
  "failure_code" text,
  "failure_detail" text,
  "retried_by" uuid REFERENCES "users"("id") ON DELETE restrict,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  CONSTRAINT "recompute_requests_failed_has_reason"
    CHECK ("status" <> 'failed' OR "failure_code" IS NOT NULL),
  CONSTRAINT "recompute_requests_succeeded_has_run"
    CHECK ("status" <> 'succeeded' OR "run_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recompute_requests_one_pending"
  ON "recommendation_recompute_requests" ((true)) WHERE "status" = 'pending';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recompute_requests_one_running"
  ON "recommendation_recompute_requests" ((true)) WHERE "status" = 'running';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recompute_requests_recent_idx"
  ON "recommendation_recompute_requests" ("requested_at" DESC);
