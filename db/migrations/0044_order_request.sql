/*
 * 0044 — Zahtev za porudžbinu iz stvarnog cenovnika (osnovne cene + odobreni rabati).
 *
 * - Izvor cene: 'demo' (demo cenovnik, kao do sada) ili 'cenovnik' (article_base_prices
 *   + odobrena pravila kupca za izabranu opciju plaćanja). Demo zahtev i dalje nosi cenovnik.
 * - Opcija plaćanja: šifra i naziv kakvi su bili pri slanju. Izbor nije dokaz uplate.
 * - Stavka „na upit“: nema potvrđene cene za izabranu opciju — bez iznosa, ne ulazi u zbir.
 * - Verzija: kancelarija priprema IZMENJEN PREDLOG kao novu verziju (replaces_order_id);
 *   original ostaje bez izmene. Kupac predlog potvrđuje ('awaiting_customer' → 'submitted')
 *   ili odbija ('cancelled'). Slanje ne pravi fakturu ni rezervaciju u BizniSoftu.
 */
ALTER TYPE "customer_order_status" ADD VALUE IF NOT EXISTS 'awaiting_customer';
--> statement-breakpoint
ALTER TABLE "customer_orders"
  ALTER COLUMN "price_list_id" DROP NOT NULL,
  ALTER COLUMN "price_list_kind" DROP NOT NULL,
  ALTER COLUMN "submitted_by" DROP NOT NULL,
  ADD COLUMN "pricing_source" text DEFAULT 'demo' NOT NULL,
  ADD COLUMN "payment_option" text,
  ADD COLUMN "payment_option_label" text,
  ADD COLUMN "revision" integer DEFAULT 1 NOT NULL,
  ADD COLUMN "delivery_address" text,
  ADD COLUMN "contact_phone" text,
  ADD COLUMN "prepared_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  ADD COLUMN "on_request_lines" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_orders"
  ADD CONSTRAINT "customer_orders_pricing_source_check" CHECK ("pricing_source" IN ('demo', 'cenovnik')),
  ADD CONSTRAINT "customer_orders_demo_has_list" CHECK ("pricing_source" <> 'demo' OR ("price_list_id" IS NOT NULL AND "price_list_kind" IS NOT NULL)),
  ADD CONSTRAINT "customer_orders_payment_option_check" CHECK ("payment_option" IS NULL OR "payment_option" ~ '^(avans|odlozeno_[0-9]{1,3})$'),
  ADD CONSTRAINT "customer_orders_revision_check" CHECK ("revision" >= 1),
  -- Zahtev šalje kupac; izmenjen predlog priprema kancelarija (kupac ga potvrđuje).
  ADD CONSTRAINT "customer_orders_author_check" CHECK ("submitted_by" IS NOT NULL OR "prepared_by" IS NOT NULL);
--> statement-breakpoint
DROP INDEX IF EXISTS "customer_orders_replaces_key";
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_orders_replaces_key" ON "customer_orders" ("replaces_order_id") WHERE "status" <> 'cancelled';
--> statement-breakpoint
ALTER TABLE "customer_order_lines"
  ALTER COLUMN "catalog_product_slug" DROP NOT NULL,
  ALTER COLUMN "catalog_name" DROP NOT NULL,
  ALTER COLUMN "list_price" DROP NOT NULL,
  ALTER COLUMN "discount_percent" DROP NOT NULL,
  ALTER COLUMN "net_price" DROP NOT NULL,
  ALTER COLUMN "line_net" DROP NOT NULL,
  ALTER COLUMN "line_vat" DROP NOT NULL,
  ALTER COLUMN "line_gross" DROP NOT NULL,
  ALTER COLUMN "vat_percent" DROP NOT NULL,
  ADD COLUMN "price_status" text DEFAULT 'cena' NOT NULL,
  ADD COLUMN "on_request_reason" text,
  ADD COLUMN "pack_confirmed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_order_lines"
  ADD CONSTRAINT "customer_order_lines_price_status_check" CHECK ("price_status" IN ('cena', 'na_upit')),
  ADD CONSTRAINT "customer_order_lines_priced_check" CHECK (
    ("price_status" = 'cena') = ("list_price" IS NOT NULL AND "net_price" IS NOT NULL AND "vat_percent" IS NOT NULL AND "line_net" IS NOT NULL AND "line_vat" IS NOT NULL AND "line_gross" IS NOT NULL)
  );
