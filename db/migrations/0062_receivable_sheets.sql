/*
 * Dugovanja iz tri tabele kancelarije (0062; 2026-11-10).
 *
 * Kancelarija vodi po jednu Google tabelu za svakog komercijalistu („Milan“, „Aleksandar“,
 * „Miroslav“). Kupac je upisan kao „naziv, mesto“, bez PIB-a, pa:
 *   - `receivable_lines` dobija `source_label` (naziv tabele = komercijalista) i `label_key`
 *     (normalizovan naziv), a `customer_id` ostaje AUTOMATSKO poklapanje;
 *   - `receivable_customer_links` pamti RUČNU vezu „naziv iz tabele → kupac“ i ima prednost;
 *   - `receivable_sheet_customers` čuva spisak kupaca iz tabela (i onih bez duga), da se uporedi
 *     „čiji je kupac po tabeli“ sa dodelama u portalu.
 * Broj stavke u snimku je sada `redni broj tabele × 100000 + red`, pa se tabele ne sudaraju.
 */
ALTER TABLE "receivable_lines" ADD COLUMN IF NOT EXISTS "source_label" text;
--> statement-breakpoint
ALTER TABLE "receivable_lines" ADD COLUMN IF NOT EXISTS "label_key" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receivable_lines_label_idx" ON "receivable_lines" ("snapshot_id", "label_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receivable_customer_links" (
  "label_key" text PRIMARY KEY,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "label_example" text NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "receivable_customer_links_key_check" CHECK (length(btrim("label_key")) BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receivable_sheet_customers" (
  "snapshot_id" uuid NOT NULL REFERENCES "receivable_snapshots"("id") ON DELETE RESTRICT,
  "row_number" integer NOT NULL,
  "source_label" text NOT NULL,
  "customer_label" text NOT NULL,
  "label_key" text NOT NULL,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE RESTRICT,
  PRIMARY KEY ("snapshot_id", "row_number")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "receivable_sheet_customers_label_idx" ON "receivable_sheet_customers" ("snapshot_id", "label_key");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "receivable_sheet_customers_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'spisak kupaca iz tabele se samo dodaje' USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "receivable_sheet_customers_guard" ON "receivable_sheet_customers";
--> statement-breakpoint
CREATE TRIGGER "receivable_sheet_customers_guard" BEFORE UPDATE OR DELETE ON "receivable_sheet_customers"
  FOR EACH ROW EXECUTE FUNCTION "receivable_sheet_customers_guard"();
