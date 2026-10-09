/*
 * Osnovne (VP) cene artikala iz BizniSoft cenovnika i pojedinačne izmene (0038).
 *
 * Tri odvojena pojma, nikad pomešana:
 *   osnovna cena  — ova migracija (cenovnik ili ručna izmena gazde);
 *   rabat kupca   — price_rules (ne dira se);
 *   konačna cena  — izračunava se iz ova dva na dati dan, ne čuva se ovde.
 * Istorijske fakture (invoices, invoice_lines) se ne diraju.
 *
 * price_list_imports       — jedno otpremanje PDF-a = jedna verzija za pregled.
 *                            SHA-256 fajla je jedinstven: isto otpremanje ne
 *                            pravi duplikat. Datum „Na dan“ iz izveštaja je
 *                            datum STANJA; datum važenja bira gazda pri primeni.
 * price_list_import_rows   — tačno pročitane stavke (šifra, naziv, PDV, VP cena).
 *                            Nabavna cena, stanje i marža se NE čuvaju.
 * article_base_prices      — istorija osnovne cene po artiklu (samo dodavanje).
 *                            Važeća cena na dan D = poslednji valid_from <= D.
 */
CREATE TYPE "price_import_status" AS ENUM ('pregled', 'primenjeno', 'odbaceno');
--> statement-breakpoint
CREATE TYPE "base_price_source" AS ENUM ('cenovnik', 'rucno');
--> statement-breakpoint
CREATE TABLE "price_list_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_sha256" text NOT NULL,
  "file_name" text NOT NULL,
  "file_bytes" integer NOT NULL,
  "parser_version" text NOT NULL,
  "report_title" text NOT NULL,
  "report_date" date NOT NULL,
  "print_date" date,
  "business_unit" text,
  "currency" text DEFAULT 'RSD' NOT NULL,
  "page_count" integer NOT NULL,
  "row_count" integer NOT NULL,
  "checks" jsonb NOT NULL,
  "problems" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" "price_import_status" DEFAULT 'pregled' NOT NULL,
  "uploaded_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone,
  "valid_from" date,
  "decision_note" text,
  "applied_count" integer,
  CONSTRAINT "price_list_imports_sha_key" UNIQUE ("file_sha256"),
  CONSTRAINT "price_list_imports_sha_check" CHECK ("file_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "price_list_imports_text_check" CHECK (
    length("file_name") BETWEEN 1 AND 200 AND length("parser_version") <= 60 AND
    ("decision_note" IS NULL OR length("decision_note") <= 500) AND "currency" ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT "price_list_imports_counts_check" CHECK ("file_bytes" > 0 AND "page_count" > 0 AND "row_count" >= 0 AND coalesce("applied_count", 0) >= 0),
  -- Odluka postoji tačno kada status nije 'pregled'; primena traži datum važenja.
  CONSTRAINT "price_list_imports_decision_check" CHECK (
    ("status" = 'pregled') = ("decided_by" IS NULL AND "decided_at" IS NULL) AND
    ("status" = 'primenjeno') = ("valid_from" IS NOT NULL AND "applied_count" IS NOT NULL) AND
    ("valid_from" IS NULL OR "valid_from" >= "report_date")
  )
);
--> statement-breakpoint
CREATE INDEX "price_list_imports_status_idx" ON "price_list_imports" ("status", "uploaded_at" DESC);
--> statement-breakpoint
CREATE TABLE "price_list_import_rows" (
  "import_id" uuid NOT NULL REFERENCES "price_list_imports"("id") ON DELETE RESTRICT,
  "line_no" integer NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "vat_percent" numeric(5, 2) NOT NULL,
  "vp_price" numeric(14, 2) NOT NULL,
  "page" integer NOT NULL,
  CONSTRAINT "price_list_import_rows_pk" PRIMARY KEY ("import_id", "line_no"),
  CONSTRAINT "price_list_import_rows_check" CHECK (
    length("code") BETWEEN 1 AND 32 AND length("name") BETWEEN 1 AND 300 AND
    "vat_percent" BETWEEN 0 AND 100 AND "page" > 0 AND "line_no" > 0
  )
);
--> statement-breakpoint
CREATE TABLE "article_base_prices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE RESTRICT,
  "net_price" numeric(14, 2) NOT NULL,
  "vat_percent" numeric(5, 2) NOT NULL,
  "currency" text DEFAULT 'RSD' NOT NULL,
  "valid_from" date NOT NULL,
  "source" "base_price_source" NOT NULL,
  "import_id" uuid REFERENCES "price_list_imports"("id") ON DELETE RESTRICT,
  "reason" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "article_base_prices_value_check" CHECK ("net_price" > 0 AND "vat_percent" BETWEEN 0 AND 100 AND "currency" ~ '^[A-Z]{3}$'),
  -- Cenovnik nosi svoje otpremanje; ručna izmena nosi obrazloženje.
  CONSTRAINT "article_base_prices_source_check" CHECK (
    ("source" = 'cenovnik') = ("import_id" IS NOT NULL) AND
    ("source" <> 'rucno' OR length(btrim(coalesce("reason", ''))) BETWEEN 5 AND 500)
  ),
  -- Isto otpremanje ne upisuje isti artikal dvaput.
  CONSTRAINT "article_base_prices_import_article_key" UNIQUE ("import_id", "article_id")
);
--> statement-breakpoint
CREATE INDEX "article_base_prices_effective_idx" ON "article_base_prices" ("article_id", "valid_from" DESC, "created_at" DESC);
--> statement-breakpoint
-- Istorija cena i pročitane stavke se samo dodaju.
CREATE OR REPLACE FUNCTION "base_prices_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% se samo dodaje', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER "article_base_prices_append_only_trg" BEFORE UPDATE OR DELETE ON "article_base_prices"
  FOR EACH ROW EXECUTE FUNCTION "base_prices_append_only"();
--> statement-breakpoint
CREATE TRIGGER "price_list_import_rows_append_only_trg" BEFORE UPDATE OR DELETE ON "price_list_import_rows"
  FOR EACH ROW EXECUTE FUNCTION "base_prices_append_only"();
--> statement-breakpoint
-- Otpremanje: menja se samo jednom, iz 'pregled' u odluku; podaci fajla nikad.
CREATE OR REPLACE FUNCTION "price_list_imports_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'otpremanje cenovnika se ne briše' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."status" <> 'pregled' THEN
    RAISE EXCEPTION 'odluka o cenovniku je konačna' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW."file_sha256", NEW."file_name", NEW."file_bytes", NEW."parser_version", NEW."report_title", NEW."report_date",
      NEW."print_date", NEW."business_unit", NEW."currency", NEW."page_count", NEW."row_count", NEW."checks", NEW."problems",
      NEW."uploaded_by", NEW."uploaded_at")
     IS DISTINCT FROM
     (OLD."file_sha256", OLD."file_name", OLD."file_bytes", OLD."parser_version", OLD."report_title", OLD."report_date",
      OLD."print_date", OLD."business_unit", OLD."currency", OLD."page_count", OLD."row_count", OLD."checks", OLD."problems",
      OLD."uploaded_by", OLD."uploaded_at") THEN
    RAISE EXCEPTION 'podaci otpremljenog cenovnika se ne menjaju' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "price_list_imports_guard_trg" BEFORE UPDATE OR DELETE ON "price_list_imports"
  FOR EACH ROW EXECUTE FUNCTION "price_list_imports_guard"();
