CREATE TYPE "public"."document_kind" AS ENUM('faktura', 'povrat_robe', 'storno', 'knjizno_odobrenje', 'korekcija_cene', 'korekcija_popusta', 'nepoznato');--> statement-breakpoint
CREATE TYPE "public"."import_row_status" AS ENUM('ispravan', 'duplikat', 'upozorenje', 'neispravan');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('u_toku', 'uspesno', 'uspesno_sa_upozorenjima', 'greska', 'preskoceno_duplikat');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"product_group" text,
	"brand" text,
	"unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"article_id" uuid,
	"article_code" text NOT NULL,
	"description" text,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 4) NOT NULL,
	"discount_percent" numeric(6, 3) DEFAULT '0' NOT NULL,
	"tax_percent" numeric(6, 3) DEFAULT '0' NOT NULL,
	"line_amount" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"document_kind" "document_kind" NOT NULL,
	"source_document_type" text,
	"number" text NOT NULL,
	"year" integer NOT NULL,
	"issued_on" date NOT NULL,
	"customer_id" uuid NOT NULL,
	"salesperson_id" uuid,
	"net_amount" numeric(14, 2) NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"import_run_id" bigserial NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salespeople" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_code" text NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" bigserial NOT NULL,
	"row_number" integer NOT NULL,
	"status" "import_row_status" NOT NULL,
	"field" text,
	"message" text,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"source_path" text,
	"file_hash" text NOT NULL,
	"data_date" text,
	"status" "import_status" DEFAULT 'u_toku' NOT NULL,
	"rows_read" integer DEFAULT 0 NOT NULL,
	"rows_valid" integer DEFAULT 0 NOT NULL,
	"rows_duplicate" integer DEFAULT 0 NOT NULL,
	"rows_warning" integer DEFAULT 0 NOT NULL,
	"rows_invalid" integer DEFAULT 0 NOT NULL,
	"invoices_created" integer DEFAULT 0 NOT NULL,
	"invoices_updated" integer DEFAULT 0 NOT NULL,
	"started_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"message" text
);
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_salesperson_id_salespeople_id_fk" FOREIGN KEY ("salesperson_id") REFERENCES "public"."salespeople"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salespeople" ADD CONSTRAINT "salespeople_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_code_key" ON "articles" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lines_identity_key" ON "invoice_lines" USING btree ("invoice_id","line_number");--> statement-breakpoint
CREATE INDEX "invoice_lines_article_idx" ON "invoice_lines" USING btree ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_identity_key" ON "invoices" USING btree ("company_id","document_kind","number","year");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_issued_idx" ON "invoices" USING btree ("issued_on");--> statement-breakpoint
CREATE INDEX "invoices_salesperson_idx" ON "invoices" USING btree ("salesperson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "salespeople_source_code_key" ON "salespeople" USING btree ("source_code");--> statement-breakpoint
CREATE INDEX "import_rows_run_idx" ON "import_rows" USING btree ("run_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "import_runs_file_hash_key" ON "import_runs" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "import_runs_started_idx" ON "import_runs" USING btree ("started_at");