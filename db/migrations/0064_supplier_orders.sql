/*
 * Roba u dolasku (0064; 2026-11-12, zahtev vlasnika).
 *
 * Porudžbina dobavljaču sa potvrđenim stavkama i rokom isporuke (raspon dana od dana porudžbine).
 * Stavka se smatra stiglom kada potvrđen lager pokaže POVEĆANJE stanja tog artikla posle porudžbine
 * (ili kada vlasnik ručno označi „stiglo“). Šifre dobavljača se razlikuju od naših, pa se jednom
 * potvrđena veza „dobavljač + njegova šifra → naš artikal“ pamti i sledeći put primenjuje sama.
 *
 * Samo dodaje tabele; ništa postojeće se ne menja.
 */
CREATE TABLE IF NOT EXISTS "supplier_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplier" text NOT NULL,
  "reference" text,
  "ordered_on" date NOT NULL,
  "lead_min_days" integer NOT NULL,
  "lead_max_days" integer NOT NULL,
  "source" text NOT NULL,
  "file_name" text,
  "note" text,
  "status" text NOT NULL DEFAULT 'otvoreno',
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "closed_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "closed_at" timestamp with time zone,
  CONSTRAINT "supplier_orders_supplier_check" CHECK (length(btrim("supplier")) BETWEEN 1 AND 60),
  CONSTRAINT "supplier_orders_lead_check" CHECK ("lead_min_days" >= 0 AND "lead_max_days" >= "lead_min_days" AND "lead_max_days" <= 365),
  CONSTRAINT "supplier_orders_source_check" CHECK ("source" IN ('excel', 'rucno', 'nabavka')),
  CONSTRAINT "supplier_orders_status_check" CHECK ("status" IN ('otvoreno', 'zatvoreno', 'otkazano'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_orders_open_idx" ON "supplier_orders" ("ordered_on") WHERE "status" = 'otvoreno';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_order_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL REFERENCES "supplier_orders"("id") ON DELETE CASCADE,
  "line_no" integer NOT NULL,
  "supplier_code" text,
  "supplier_name" text NOT NULL DEFAULT '',
  "article_id" uuid REFERENCES "articles"("id") ON DELETE RESTRICT,
  "quantity" numeric(14, 3) NOT NULL,
  "unit" text,
  "received" numeric(14, 3) NOT NULL DEFAULT 0,
  /* Stanje lagera pri unosu i poslednje viđeno stanje — iz njih se računa povećanje (prijem). */
  "baseline_stock" numeric(14, 3),
  "last_seen_stock" numeric(14, 3),
  "last_checked_import_id" uuid,
  "status" text NOT NULL DEFAULT 'ceka',
  "arrived_at" timestamp with time zone,
  "closed_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "supplier_order_lines_qty_check" CHECK ("quantity" > 0 AND "received" >= 0),
  CONSTRAINT "supplier_order_lines_status_check" CHECK ("status" IN ('ceka', 'stiglo', 'otkazano')),
  CONSTRAINT "supplier_order_lines_no_unique" UNIQUE ("order_id", "line_no")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_order_lines_article_idx" ON "supplier_order_lines" ("article_id") WHERE "status" = 'ceka';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_article_codes" (
  "supplier" text NOT NULL,
  "supplier_code" text NOT NULL,
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE RESTRICT,
  "confirmed_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "confirmed_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("supplier", "supplier_code")
);
