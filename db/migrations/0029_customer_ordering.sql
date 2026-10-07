/*
 * Kupčevo poručivanje — cenovnik, korpa firme, zahtev i porudžbina.
 *
 * Sve aditivno. Ništa postojeće se ne menja: `price_rules` ostaju komercijalni
 * predlozi iz portala, `invoice_lines` ostaju istorija i NIKAD nisu izvor
 * važeće cene.
 *
 *   1. `price_lists` + `price_list_items` + `price_list_customer_terms` —
 *      verzija cenovnika sa cenom bez PDV-a, PDV-om, jedinicom i pakovanjem po
 *      artiklu, i rabatima po kupcu. Vrsta `demo` postoji samo za lokalni
 *      demo; `biznisoft` je mesto za potvrđeni izvoz iz kancelarije.
 *   2. `customer_cart_items` — korpa pripada FIRMI (`customer_id`), ne pregledaču.
 *   3. `customer_orders` + linije + događaji — ZAHTEV (broj Z-…) i POTVRĐENA
 *      PORUDŽBINA (broj P-…, dodeljuje se tek potvrdom) su isti zapis u dva
 *      jasno odvojena stanja. Cena se u liniju upisuje u trenutku slanja.
 *
 * Povratni postupak: `db/rollback/0029_customer_ordering.down.sql`.
 */

DO $$ BEGIN
  CREATE TYPE "price_list_kind" AS ENUM ('demo', 'biznisoft');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "price_list_status" AS ENUM ('draft', 'active', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "customer_order_status" AS ENUM (
    'submitted', 'under_review', 'changes_requested', 'confirmed', 'rejected', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "price_lists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "kind" "price_list_kind" NOT NULL,
  "status" "price_list_status" DEFAULT 'draft' NOT NULL,
  "currency" text DEFAULT 'RSD' NOT NULL,
  "valid_from" date NOT NULL,
  "source_note" text NOT NULL,
  "activated_by" uuid REFERENCES "users"("id") ON DELETE restrict,
  "activated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "price_lists_code_key" ON "price_lists" ("code");
--> statement-breakpoint
-- Najviše jedan aktivan cenovnik: dva aktivna bi značila dve važeće cene.
CREATE UNIQUE INDEX IF NOT EXISTS "price_lists_one_active" ON "price_lists" ((true)) WHERE "status" = 'active';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "price_list_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "price_list_id" uuid NOT NULL REFERENCES "price_lists"("id") ON DELETE cascade,
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE restrict,
  "unit" text NOT NULL,
  "pack_label" text NOT NULL,
  "net_price" numeric(14, 4) NOT NULL CHECK ("net_price" > 0),
  "vat_percent" numeric(5, 2) NOT NULL CHECK ("vat_percent" >= 0 AND "vat_percent" <= 100),
  "min_quantity" numeric(14, 3) DEFAULT 1 NOT NULL CHECK ("min_quantity" > 0),
  "quantity_step" numeric(14, 3) DEFAULT 1 NOT NULL CHECK ("quantity_step" > 0),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "price_list_items_article_key" ON "price_list_items" ("price_list_id", "article_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "price_list_customer_terms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "price_list_id" uuid NOT NULL REFERENCES "price_lists"("id") ON DELETE cascade,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE restrict,
  "product_scope" "price_product_scope" NOT NULL,
  "article_id" uuid REFERENCES "articles"("id") ON DELETE restrict,
  "product_group" text,
  "brand" text,
  "discount_percent" numeric(6, 3) NOT NULL CHECK ("discount_percent" > 0 AND "discount_percent" < 100),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_list_customer_terms_customer_idx" ON "price_list_customer_terms" ("price_list_id", "customer_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_cart_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE restrict,
  "quantity" numeric(14, 3) NOT NULL CHECK ("quantity" > 0),
  "added_by" uuid NOT NULL REFERENCES "customer_users"("id") ON DELETE restrict,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_cart_items_key" ON "customer_cart_items" ("customer_id", "article_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE restrict,
  "submitted_by" uuid NOT NULL REFERENCES "customer_users"("id") ON DELETE restrict,
  "request_number" text NOT NULL,
  "order_number" text,
  "status" "customer_order_status" DEFAULT 'submitted' NOT NULL,
  "idempotency_key" text NOT NULL,
  "price_list_id" uuid NOT NULL REFERENCES "price_lists"("id") ON DELETE restrict,
  "price_list_kind" "price_list_kind" NOT NULL,
  "currency" text NOT NULL,
  "net_total" numeric(14, 2) NOT NULL,
  "vat_total" numeric(14, 2) NOT NULL,
  "gross_total" numeric(14, 2) NOT NULL,
  "customer_note" text,
  "status_reason" text,
  "biznisoft_document_number" text,
  "biznisoft_recorded_by" uuid REFERENCES "users"("id") ON DELETE restrict,
  "biznisoft_recorded_at" timestamp with time zone,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE restrict,
  "reviewed_at" timestamp with time zone,
  "decided_by" uuid REFERENCES "users"("id") ON DELETE restrict,
  "decided_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Broj porudžbine postoji tačno onda kada je zahtev potvrđen.
  CONSTRAINT "customer_orders_number_only_when_confirmed"
    CHECK (("status" = 'confirmed') = ("order_number" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_orders_idempotency_key" ON "customer_orders" ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_orders_request_number_key" ON "customer_orders" ("request_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_orders_order_number_key" ON "customer_orders" ("order_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_orders_customer_idx" ON "customer_orders" ("customer_id", "submitted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_orders_status_idx" ON "customer_orders" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_order_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "customer_orders"("id") ON DELETE restrict,
  "line_number" integer NOT NULL,
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE restrict,
  "article_code" text NOT NULL,
  "article_name" text NOT NULL,
  "catalog_product_slug" text NOT NULL,
  "catalog_variant_id" text,
  "catalog_name" text NOT NULL,
  "unit" text NOT NULL,
  "pack_label" text NOT NULL,
  "quantity" numeric(14, 3) NOT NULL CHECK ("quantity" > 0),
  "list_price" numeric(14, 4) NOT NULL,
  "discount_percent" numeric(6, 3) DEFAULT 0 NOT NULL,
  "net_price" numeric(14, 4) NOT NULL,
  "vat_percent" numeric(5, 2) NOT NULL,
  "line_net" numeric(14, 2) NOT NULL,
  "line_vat" numeric(14, 2) NOT NULL,
  "line_gross" numeric(14, 2) NOT NULL,
  "price_basis" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_order_lines_key" ON "customer_order_lines" ("order_id", "line_number");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_order_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "customer_orders"("id") ON DELETE restrict,
  "from_status" "customer_order_status",
  "to_status" "customer_order_status",
  "kind" text NOT NULL,
  "actor_customer_user_id" uuid REFERENCES "customer_users"("id") ON DELETE restrict,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE restrict,
  "actor_name" text NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_order_events_one_actor"
    CHECK (("actor_customer_user_id" IS NULL) <> ("actor_user_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_order_events_order_idx" ON "customer_order_events" ("order_id", "created_at");
--> statement-breakpoint

CREATE SEQUENCE IF NOT EXISTS "customer_order_request_seq";
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "customer_order_number_seq";
