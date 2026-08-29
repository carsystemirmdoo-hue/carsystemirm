/*
 * Kupčev nalog kao ODVOJEN identitet (AD-2).
 *
 * `users.role` se NE dira. Uloga „kupac" se ne dodaje u enum, i to je poenta
 * cele migracije: `resolveCapabilities(role, packages)` vraća skup sposobnosti
 * koji ne poznaje pojam „čiji", pa bi peta vrednost značila da svaka postojeća
 * provera mora dodatno pitati „a koji kupac?".
 *
 * Aditivno i idempotentno.
 */

DO $$ BEGIN
  CREATE TYPE "public"."customer_account_status" AS ENUM (
    'requested', 'approved', 'active', 'suspended', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "status" "customer_account_status" DEFAULT 'requested' NOT NULL,
  "session_version" integer DEFAULT 0 NOT NULL,
  "failed_login_attempts" integer DEFAULT 0 NOT NULL,
  "locked_until" timestamp with time zone,
  "last_login_at" timestamp with time zone,
  "decided_by" uuid,
  "decided_at" timestamp with time zone,
  "decision_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_users"
    ADD CONSTRAINT "customer_users_customer_id_customers_id_fk"
    FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_users"
    ADD CONSTRAINT "customer_users_decided_by_users_id_fk"
    FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * E-pošta je jedinstvena preko cele tabele, ne po kupcu.
 *
 * Po kupcu bi značilo da ista adresa ima nalog kod dve firme — a prijava zna
 * samo adresu, pa bi morala da bira između dva naloga.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "customer_users_email_key"
  ON "customer_users" ("email");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_users_customer_idx"
  ON "customer_users" ("customer_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_users_status_idx"
  ON "customer_users" ("status");
--> statement-breakpoint

/* Adresa se čuva u malim slovima; prijava normalizuje, ovo je brava. */
DO $$ BEGIN
  ALTER TABLE "customer_users"
    ADD CONSTRAINT "customer_users_email_lowercase_ck"
    CHECK ("email" = lower("email") AND btrim("email") <> '');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Odbijen i isključen nalog moraju imati razlog.
 *
 * Bez ovoga bi u bazi mogao postojati nalog koji je nekome oduzet a niko ne zna
 * zašto — i to bi se otkrilo tek kad kupac pozove.
 */
DO $$ BEGIN
  ALTER TABLE "customer_users"
    ADD CONSTRAINT "customer_users_decision_reason_ck"
    CHECK (
      status NOT IN ('rejected', 'suspended')
      OR (decision_reason IS NOT NULL AND btrim(decision_reason) <> '')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * Paket dozvola za upravljanje kupčevim nalozima
 * ====================================================================== */

INSERT INTO "permission_packages" ("key", "name", "description", "sort_order")
VALUES
  ('kupacki_nalozi', 'Nalozi kupaca',
   'Otvaranje, odobravanje i isključivanje naloga kupaca', '10')
ON CONFLICT ("key") DO UPDATE
  SET "name" = EXCLUDED."name",
      "description" = EXCLUDED."description";
