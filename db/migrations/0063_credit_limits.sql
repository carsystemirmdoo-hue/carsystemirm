/*
 * Kreditni limiti (0063; 2026-11-11, odluka vlasnika).
 *
 * Limit kupca = podrazumevani procenat (sistemsko podešavanje `credit.defaultPercent`, 150 %)
 * prosečne mesečne kupovine sa PDV-om u poslednjih 12 meseci. Vlasnik ili komercijalista
 * kupca mogu kupcu da upišu SVOJ procenat ili tačan iznos (jedno od dva) uz obrazloženje.
 * Blokada porudžbina je opcija po kupcu, podrazumevano isključena — upozorenje je glavni alat.
 *
 * `credit_warning` je nova vrsta obaveštenja: dug preko limita ili faktura koja kasni.
 * Vrednost se u ovoj migraciji ne koristi, pa je `ADD VALUE` u transakciji bezbedan (vidi 0012).
 */
ALTER TYPE "notification_kind" ADD VALUE IF NOT EXISTS 'credit_warning';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_credit_limits" (
  "customer_id" uuid PRIMARY KEY REFERENCES "customers"("id") ON DELETE RESTRICT,
  "percent" numeric(6, 2),
  "amount" numeric(14, 2),
  "block_orders" boolean NOT NULL DEFAULT false,
  "note" text NOT NULL,
  "set_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "set_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "customer_credit_limits_one_check" CHECK ("percent" IS NULL OR "amount" IS NULL),
  CONSTRAINT "customer_credit_limits_percent_check" CHECK ("percent" IS NULL OR ("percent" >= 0 AND "percent" <= 1000)),
  CONSTRAINT "customer_credit_limits_amount_check" CHECK ("amount" IS NULL OR "amount" >= 0),
  CONSTRAINT "customer_credit_limits_note_check" CHECK (length(btrim("note")) BETWEEN 1 AND 500)
);
--> statement-breakpoint
/* Upozorenje o kupcu vidi komercijalista samo za SVOJE kupce (filter u listi obaveštenja). */
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "customer_id" uuid REFERENCES "customers"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_customer_idx" ON "notifications" ("customer_id") WHERE "customer_id" IS NOT NULL;
