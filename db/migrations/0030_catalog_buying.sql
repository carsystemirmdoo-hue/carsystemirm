/*
 * F8 — kupovina iz celog kataloga, zahtevi za cenu/uslove i nastavak izmene.
 *
 * Sve aditivno:
 *
 *   1. `superseded` — zahtev za koji je kancelarija tražila izmenu, a kupac ga
 *      vratio u korpu radi ispravke. Ostaje u istoriji; NIJE „otkazan".
 *   2. `customer_orders.replaces_order_id` — ispravljen zahtev pokazuje na
 *      prethodni. Jedinstven: jedan zahtev ima najviše jednu ispravku.
 *   3. `customer_cart_items.source_order_id` — stavka vraćena iz zahteva zna
 *      odakle je došla, pa novi zahtev zna koga ispravlja.
 *   4. `customer_price_requests` — kupac traži cenu ili posebne uslove za
 *      proizvod bez cene/rabata. Radna lista kancelarije i komercijaliste.
 *
 * Povratni postupak: `db/rollback/0030_catalog_buying.down.sql`.
 */

ALTER TYPE "customer_order_status" ADD VALUE IF NOT EXISTS 'superseded';
--> statement-breakpoint

ALTER TABLE "customer_orders"
  ADD COLUMN IF NOT EXISTS "replaces_order_id" uuid REFERENCES "customer_orders"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_orders_replaces_key" ON "customer_orders" ("replaces_order_id");
--> statement-breakpoint

ALTER TABLE "customer_cart_items"
  ADD COLUMN IF NOT EXISTS "source_order_id" uuid REFERENCES "customer_orders"("id") ON DELETE set null;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "price_request_status" AS ENUM ('open', 'in_progress', 'answered', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "price_request_kind" AS ENUM ('no_price', 'special_terms');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_price_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE restrict,
  "requested_by" uuid NOT NULL REFERENCES "customer_users"("id") ON DELETE restrict,
  "request_number" text NOT NULL,
  "kind" "price_request_kind" NOT NULL,
  "status" "price_request_status" DEFAULT 'open' NOT NULL,
  "idempotency_key" text NOT NULL,
  "catalog_product_slug" text NOT NULL,
  "catalog_variant_id" text,
  "catalog_name" text NOT NULL,
  "variant_label" text,
  "article_id" uuid REFERENCES "articles"("id") ON DELETE restrict,
  "quantity" numeric(14, 3) NOT NULL CHECK ("quantity" > 0),
  "customer_note" text,
  "answer" text,
  "handled_by" uuid REFERENCES "users"("id") ON DELETE restrict,
  "taken_at" timestamp with time zone,
  "answered_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Odgovor postoji tačno kada je zahtev odgovoren ili zatvoren posle odgovora.
  CONSTRAINT "customer_price_requests_answer_when_answered"
    CHECK ("status" <> 'answered' OR ("answer" IS NOT NULL AND btrim("answer") <> ''))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_price_requests_idempotency_key" ON "customer_price_requests" ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_price_requests_number_key" ON "customer_price_requests" ("request_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_price_requests_customer_idx" ON "customer_price_requests" ("customer_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_price_requests_status_idx" ON "customer_price_requests" ("status");
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "customer_price_request_seq";
