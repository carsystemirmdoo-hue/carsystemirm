/*
 * Izvorni dokumenti (BizniSoft PDF) iznad postojećih faktura.
 *
 * Aditivno i idempotentno. `invoices`, `invoice_lines`, `import_runs` i
 * `import_rows` se NE diraju — ovaj sloj ih koristi, ne zamenjuje. Nema druge
 * paralelne istorije prodaje.
 *
 * Zašto zaseban sloj
 * ------------------
 * `invoices` je poslovna istina. Izvorni dokument je ARTEFAKT: fajl sa svojim
 * otiskom, verzijom parsera i ishodom provere. Isti poslovni dokument može doći
 * kroz više fajlova (ponovni upload, revizija), a fajl koji ne prođe proveru ne
 * sme uopšte da napravi fakturu. Spajanje to dvoje značilo bi ili kolone o
 * fajlovima u `invoices`, ili poluprazne fakture od neuspelih uvoza.
 */

DO $$ BEGIN
  CREATE TYPE "public"."source_document_validation" AS ENUM (
    'valid', 'totals_mismatch', 'unparsable', 'unsupported_requires_sample'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."source_document_revision" AS ENUM (
    'original', 'superseded', 'conflict', 'pending_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."manual_review_status" AS ENUM (
    'not_required', 'pending', 'resolved'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "source_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_hash" text NOT NULL,
  "file_name" text NOT NULL,
  "page_count" integer NOT NULL,
  "line_count" integer DEFAULT 0 NOT NULL,
  "issuer_code" text NOT NULL,
  "business_document_type" "document_kind" NOT NULL,
  "business_document_number" text,
  "document_date" date,
  "ingestion_run_id" integer,
  "parser_version" text NOT NULL,
  "validation_status" "source_document_validation" NOT NULL,
  "validation_detail" text,
  "revision_status" "source_document_revision" DEFAULT 'original' NOT NULL,
  "supersedes_id" uuid,
  "superseded_by_id" uuid,
  "conflict_reason" text,
  "revision_confirmed_by" uuid,
  "revision_confirmed_at" timestamp with time zone,
  "manual_review" "manual_review_status" DEFAULT 'not_required' NOT NULL,
  "manual_review_note" text,
  "manual_review_by" uuid,
  "manual_review_at" timestamp with time zone,
  "invoice_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_ingestion_run_id_import_runs_id_fk"
    FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."import_runs"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_invoice_id_invoices_id_fk"
    FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_supersedes_id_fk"
    FOREIGN KEY ("supersedes_id") REFERENCES "public"."source_documents"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_superseded_by_id_fk"
    FOREIGN KEY ("superseded_by_id") REFERENCES "public"."source_documents"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_revision_confirmed_by_users_id_fk"
    FOREIGN KEY ("revision_confirmed_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_manual_review_by_users_id_fk"
    FOREIGN KEY ("manual_review_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Isti fajl ne moze uci dvaput.
 *
 * Ovo je brava iza idempotentnosti. Aplikativna provera ne prezivljava dva
 * paralelna uploada istog fajla; jedinstveni indeks prezivljava.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "source_documents_file_hash_key"
  ON "source_documents" ("file_hash");
--> statement-breakpoint

/*
 * Poslovni kljuc NIJE jedinstven — namerno.
 *
 * Dva fajla smeju tvrditi da su isti poslovni dokument; to je upravo situacija
 * koju treba PRIMETITI i staviti u `conflict`. Zabrana na nivou baze bi
 * izgubila dokaz da se desila.
 */
CREATE INDEX IF NOT EXISTS "source_documents_business_key_idx"
  ON "source_documents" ("issuer_code", "business_document_type", "business_document_number");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "source_documents_validation_idx"
  ON "source_documents" ("validation_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_documents_review_idx"
  ON "source_documents" ("manual_review");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_documents_invoice_idx"
  ON "source_documents" ("invoice_id");
--> statement-breakpoint

/*
 * Fakturu sme da napravi SAMO dokument koji je prosao proveru.
 *
 * Bez ovoga bi neispravan dokument mogao da ostavi red u `invoices` i time
 * zatruje jedini ledger — a upravo to se najlakse desi pri delimicnoj gresci.
 */
DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_invoice_needs_valid_ck"
    CHECK (invoice_id IS NULL OR validation_status = 'valid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Potvrdjena revizija mora imati potpis; `conflict` mora imati razlog. */
DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_revision_ck"
    CHECK (
      (revision_status <> 'superseded'
        OR (superseded_by_id IS NOT NULL
            AND revision_confirmed_by IS NOT NULL
            AND revision_confirmed_at IS NOT NULL))
      AND (revision_status <> 'conflict'
        OR (conflict_reason IS NOT NULL AND btrim(conflict_reason) <> ''))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Dokument ne moze sam sebe da zameni. */
DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_no_self_revision_ck"
    CHECK (supersedes_id IS DISTINCT FROM id AND superseded_by_id IS DISTINCT FROM id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "source_document_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_document_id" uuid NOT NULL,
  "line_number" integer NOT NULL,
  "article_code" text,
  "description" text,
  "unit" text,
  "quantity" text,
  "unit_price" text,
  "discount_percent" text,
  "tax_percent" text,
  "tax_amount" text,
  "gross_amount" text,
  "raw_cells" text,
  "line_status" text DEFAULT 'ok' NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "source_document_lines"
    ADD CONSTRAINT "source_document_lines_source_document_id_fk"
    FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "source_document_lines_key"
  ON "source_document_lines" ("source_document_id", "line_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_document_lines_article_idx"
  ON "source_document_lines" ("article_code");
