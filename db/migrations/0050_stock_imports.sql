/*
 * Ručni uvoz lagera iz BizniSofta — izveštaj „STANJE ZALIHA", objekat 021 VELEPRODAJA (0050, dok. 65).
 *
 * stock_imports       — jedno otpremanje XLSX/CSV fajla = jedan zapis. SHA-256 fajla je
 *                       jedinstven: isto otpremanje ne pravi duplikat. Datum stanja („Na dan")
 *                       i datum štampe dolaze iz SADRŽAJA izveštaja; vreme otpremanja i potvrde
 *                       vodi portal odvojeno. Vreme izvoza se ne izmišlja (izveštaj ga nema).
 *                       Fajl koji ne prođe proveru dobija status 'neuspesno' — zapis ostaje kao
 *                       evidencija, a važeći snimak se ne menja.
 * stock_import_lines  — izvorna šifra (tekst, kakva je u fajlu), ključ za vezu, naziv i izvorna
 *                       količina. Prazna količina je NULL (nije 0); negativna se čuva.
 *                       Cene, vrednosti i marže iz izveštaja se NE čuvaju.
 *
 * Važeći snimak = poslednje potvrđeno otpremanje (decided_at). Veza sa artiklom, JM i
 * pakovanjem se računa pri čitanju iz potvrđenih tabela (articles, article_pack_sizes),
 * da nova potvrda pakovanja važi i za postojeći snimak.
 */
CREATE TYPE "stock_import_status" AS ENUM ('pregled', 'potvrdjeno', 'odbaceno', 'neuspesno');
--> statement-breakpoint
CREATE TABLE "stock_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_sha256" text NOT NULL,
  "file_name" text NOT NULL,
  "file_bytes" integer NOT NULL,
  "file_format" text NOT NULL,
  "parser_version" text NOT NULL,
  "warehouse_code" text,
  "warehouse_name" text,
  "stock_date" date,
  "printed_on" date,
  "line_count" integer NOT NULL,
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "problems" jsonb DEFAULT '{"errors":[],"warnings":[]}'::jsonb NOT NULL,
  "status" "stock_import_status" DEFAULT 'pregled' NOT NULL,
  "uploaded_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone,
  "decision_note" text,
  CONSTRAINT "stock_imports_sha_key" UNIQUE ("file_sha256"),
  CONSTRAINT "stock_imports_sha_check" CHECK ("file_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "stock_imports_text_check" CHECK (
    length("file_name") BETWEEN 1 AND 200 AND length("parser_version") <= 60 AND
    "file_format" IN ('xlsx', 'csv') AND
    ("warehouse_code" IS NULL OR "warehouse_code" ~ '^[0-9]{2,4}$') AND
    ("warehouse_name" IS NULL OR length("warehouse_name") <= 120) AND
    ("decision_note" IS NULL OR length("decision_note") <= 500)
  ),
  CONSTRAINT "stock_imports_counts_check" CHECK ("file_bytes" > 0 AND "line_count" >= 0),
  -- 'neuspesno' je odluka sistema u trenutku otpremanja (bez potvrđivača);
  -- 'potvrdjeno' i 'odbaceno' su odluka čoveka; potvrđeni snimak ima objekat i datum stanja.
  CONSTRAINT "stock_imports_decision_check" CHECK (
    ("status" IN ('pregled', 'neuspesno')) = ("decided_by" IS NULL) AND
    ("status" = 'pregled') = ("decided_at" IS NULL) AND
    ("status" <> 'potvrdjeno' OR ("warehouse_code" IS NOT NULL AND "stock_date" IS NOT NULL AND "line_count" > 0))
  )
);
--> statement-breakpoint
CREATE INDEX "stock_imports_status_idx" ON "stock_imports" ("status", "decided_at" DESC);
--> statement-breakpoint
CREATE INDEX "stock_imports_uploaded_idx" ON "stock_imports" ("uploaded_at" DESC);
--> statement-breakpoint
CREATE TABLE "stock_import_lines" (
  "import_id" uuid NOT NULL REFERENCES "stock_imports"("id") ON DELETE RESTRICT,
  "line_no" integer NOT NULL,
  "source_row" integer NOT NULL,
  "source_code" text NOT NULL,
  "code_key" text,
  "name" text DEFAULT '' NOT NULL,
  "quantity" numeric(14, 3),
  CONSTRAINT "stock_import_lines_pk" PRIMARY KEY ("import_id", "line_no"),
  CONSTRAINT "stock_import_lines_check" CHECK (
    length("source_code") BETWEEN 1 AND 32 AND ("code_key" IS NULL OR length("code_key") BETWEEN 1 AND 32) AND
    length("name") <= 300 AND "line_no" > 0 AND "source_row" > 0
  ),
  CONSTRAINT "stock_import_lines_code_key" UNIQUE ("import_id", "source_code")
);
--> statement-breakpoint
CREATE INDEX "stock_import_lines_key_idx" ON "stock_import_lines" ("import_id", "code_key");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "stock_import_lines_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% se samo dodaje', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER "stock_import_lines_append_only_trg" BEFORE UPDATE OR DELETE ON "stock_import_lines"
  FOR EACH ROW EXECUTE FUNCTION "stock_import_lines_append_only"();
--> statement-breakpoint
-- Otpremanje: menja se samo jednom, iz 'pregled' u odluku; podaci fajla nikad.
CREATE OR REPLACE FUNCTION "stock_imports_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'otpremanje lagera se ne briše' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."status" <> 'pregled' OR NEW."status" NOT IN ('potvrdjeno', 'odbaceno') THEN
    RAISE EXCEPTION 'odluka o lageru je konačna' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW."file_sha256", NEW."file_name", NEW."file_bytes", NEW."file_format", NEW."parser_version", NEW."warehouse_code",
      NEW."warehouse_name", NEW."stock_date", NEW."printed_on", NEW."line_count", NEW."summary", NEW."problems",
      NEW."uploaded_by", NEW."uploaded_at")
     IS DISTINCT FROM
     (OLD."file_sha256", OLD."file_name", OLD."file_bytes", OLD."file_format", OLD."parser_version", OLD."warehouse_code",
      OLD."warehouse_name", OLD."stock_date", OLD."printed_on", OLD."line_count", OLD."summary", OLD."problems",
      OLD."uploaded_by", OLD."uploaded_at") THEN
    RAISE EXCEPTION 'podaci otpremljenog lagera se ne menjaju' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "stock_imports_guard_trg" BEFORE UPDATE OR DELETE ON "stock_imports"
  FOR EACH ROW EXECUTE FUNCTION "stock_imports_guard"();
