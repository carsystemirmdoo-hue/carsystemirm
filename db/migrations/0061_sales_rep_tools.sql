/*
 * Alati komercijaliste (0061; 2026-11-10).
 *
 * 1. `customer_sales_contacts` — telefon i kontakt osoba kupca kako ih zna komercijalista
 *    (BizniSoft kartica partnera često nema broj). Jedan red po kupcu, izmena je dozvoljena.
 * 2. `customer_call_notes` — beleška posle razgovora, uz ishod i dan kada se kupcu javiti.
 *    Beleška se ne menja i ne briše; jedina izmena je jednokratno „urađeno“ za podsetnik.
 * 3. `receivable_snapshots` / `receivable_lines` — otvorene i delimično plaćene fakture iz
 *    tabele kancelarije (Google tabela ili otpremljen fajl). Snimak se pravi samo kada se
 *    sadržaj promeni; ponovna provera istog sadržaja menja samo `checked_at`.
 *    Faktura koje nema u tabeli smatra se plaćenom (tabela vodi samo neplaćene).
 */
CREATE TABLE IF NOT EXISTS "customer_sales_contacts" (
  "customer_id" uuid PRIMARY KEY REFERENCES "customers"("id") ON DELETE RESTRICT,
  "contact_name" text,
  "phone" text,
  "phone_alt" text,
  "email" text,
  "note" text,
  "updated_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "customer_sales_contacts_len_check" CHECK (
    coalesce(length("contact_name"), 0) <= 120 AND coalesce(length("phone"), 0) <= 40
    AND coalesce(length("phone_alt"), 0) <= 40 AND coalesce(length("email"), 0) <= 160
    AND coalesce(length("note"), 0) <= 300
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_call_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "outcome" text NOT NULL,
  "body" text,
  "follow_up_on" date,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "follow_up_done_at" timestamp with time zone,
  "follow_up_done_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "customer_call_notes_outcome_check" CHECK (
    "outcome" IN ('porucio', 'javice_se', 'nije_dostupan', 'ne_treba', 'poseta', 'drugo')
  ),
  CONSTRAINT "customer_call_notes_body_check" CHECK ("body" IS NULL OR length("body") <= 1000),
  CONSTRAINT "customer_call_notes_drugo_check" CHECK ("outcome" <> 'drugo' OR length(btrim(coalesce("body", ''))) >= 3),
  CONSTRAINT "customer_call_notes_done_check" CHECK (("follow_up_done_at" IS NULL) = ("follow_up_done_by" IS NULL)),
  CONSTRAINT "customer_call_notes_done_needs_date_check" CHECK ("follow_up_done_at" IS NULL OR "follow_up_on" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_call_notes_customer_idx" ON "customer_call_notes" ("customer_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_call_notes_follow_up_idx" ON "customer_call_notes" ("follow_up_on")
  WHERE "follow_up_on" IS NOT NULL AND "follow_up_done_at" IS NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "customer_call_notes_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'beleška razgovora se ne briše' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW."customer_id", NEW."outcome", NEW."body", NEW."follow_up_on", NEW."created_by", NEW."created_at")
     IS DISTINCT FROM
     (OLD."customer_id", OLD."outcome", OLD."body", OLD."follow_up_on", OLD."created_by", OLD."created_at")
     OR OLD."follow_up_done_at" IS NOT NULL THEN
    RAISE EXCEPTION 'beleška razgovora se ne menja; podsetnik se završava jednom' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "customer_call_notes_guard" ON "customer_call_notes";
--> statement-breakpoint
CREATE TRIGGER "customer_call_notes_guard" BEFORE UPDATE OR DELETE ON "customer_call_notes"
  FOR EACH ROW EXECUTE FUNCTION "customer_call_notes_guard"();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receivable_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" text NOT NULL,
  "source_ref" text NOT NULL,
  "content_sha256" text NOT NULL,
  "row_count" integer NOT NULL,
  "matched_count" integer NOT NULL,
  "total_remaining" numeric(16, 2) NOT NULL,
  "warnings" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "checked_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "receivable_snapshots_source_check" CHECK ("source" IN ('google_sheet', 'upload')),
  CONSTRAINT "receivable_snapshots_counts_check" CHECK ("row_count" >= 0 AND "matched_count" BETWEEN 0 AND "row_count")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receivable_snapshots_created_idx" ON "receivable_snapshots" ("created_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receivable_lines" (
  "snapshot_id" uuid NOT NULL REFERENCES "receivable_snapshots"("id") ON DELETE RESTRICT,
  "row_number" integer NOT NULL,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE RESTRICT,
  "customer_label" text NOT NULL,
  "pib" text,
  "partner_code" text,
  "invoice_number" text,
  "issued_on" date,
  "due_on" date,
  "amount" numeric(16, 2),
  "paid" numeric(16, 2),
  "remaining" numeric(16, 2) NOT NULL,
  "note" text,
  PRIMARY KEY ("snapshot_id", "row_number"),
  CONSTRAINT "receivable_lines_remaining_check" CHECK ("remaining" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receivable_lines_customer_idx" ON "receivable_lines" ("snapshot_id", "customer_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "receivable_lines_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'stavke stanja dugovanja se samo dodaju' USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "receivable_lines_guard" ON "receivable_lines";
--> statement-breakpoint
CREATE TRIGGER "receivable_lines_guard" BEFORE UPDATE OR DELETE ON "receivable_lines"
  FOR EACH ROW EXECUTE FUNCTION "receivable_lines_guard"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "receivable_snapshots_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'snimak stanja dugovanja se ne briše' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW."source", NEW."source_ref", NEW."content_sha256", NEW."row_count", NEW."matched_count", NEW."total_remaining", NEW."warnings", NEW."created_by", NEW."created_at")
     IS DISTINCT FROM
     (OLD."source", OLD."source_ref", OLD."content_sha256", OLD."row_count", OLD."matched_count", OLD."total_remaining", OLD."warnings", OLD."created_by", OLD."created_at") THEN
    RAISE EXCEPTION 'snimak stanja dugovanja: menja se samo vreme provere' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "receivable_snapshots_guard" ON "receivable_snapshots";
--> statement-breakpoint
CREATE TRIGGER "receivable_snapshots_guard" BEFORE UPDATE OR DELETE ON "receivable_snapshots"
  FOR EACH ROW EXECUTE FUNCTION "receivable_snapshots_guard"();
