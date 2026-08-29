/*
 * Saglasnosti kupca za marketing i oglase.
 *
 * Aditivno i idempotentno. Nijedna postojeća tabela se ne dira.
 *
 * Model je append-only i to je poslovno pravilo, ne stil: povlačenje dodaje nov
 * red umesto da menja stari. Kolona `granted boolean` bi bila jednostavnija, ali
 * ne bi umela da odgovori kada je pristanak dat i kada povučen — a to je jedino
 * pitanje koje pravni pregled zaista postavlja.
 *
 * Tabela NE čuva ništa osim same odluke: bez adrese, bez PIB-a, bez telefona,
 * bez sadržaja poruka. „Ko, za šta, kada, po kojoj verziji teksta."
 */

DO $$ BEGIN
  CREATE TYPE "public"."consent_purpose" AS ENUM (
    'email_marketing', 'ad_personalization'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."consent_action" AS ENUM ('granted', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."consent_source" AS ENUM (
    'customer_self_service', 'office_recorded_offline'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_contact_consents" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "customer_user_id" uuid NOT NULL,
  "purpose" "consent_purpose" NOT NULL,
  "action" "consent_action" NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source" "consent_source" NOT NULL,
  "consent_text_version" text NOT NULL,
  "recorded_by" uuid,
  "note" text
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_contact_consents"
    ADD CONSTRAINT "customer_contact_consents_customer_user_id_customer_users_id_fk"
    FOREIGN KEY ("customer_user_id") REFERENCES "public"."customer_users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_contact_consents"
    ADD CONSTRAINT "customer_contact_consents_recorded_by_users_id_fk"
    FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Trenutno stanje se čita kao „poslednji red po (nalog, svrha)".
 *
 * Indeks prati tačno taj upit. `id DESC` je namerno: merodavan je redni broj
 * upisa, ne `occurred_at` — vreme sme da se poklopi ili stigne van redosleda
 * kod offline evidentiranja, redni broj ne može.
 */
CREATE INDEX IF NOT EXISTS "customer_contact_consents_current_idx"
  ON "customer_contact_consents" ("customer_user_id", "purpose", "id" DESC);
--> statement-breakpoint

/* Verzija teksta je uslov pravnog pregleda, pa ne sme biti prazna. */
DO $$ BEGIN
  ALTER TABLE "customer_contact_consents"
    ADD CONSTRAINT "customer_contact_consents_text_version_ck"
    CHECK (btrim("consent_text_version") <> '');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Offline evidentiran pristanak mora imati čoveka iza sebe, a povlačenje NE
 * sme biti evidentirano offline.
 *
 * Drugi deo je važniji: kupac mora moći da povuče pristanak jednako lako kao
 * što ga je dao. Da je povlačenje smelo da bude „evidentirano u kancelariji",
 * postojao bi put u kome neko drugi odlučuje da je kupac ipak pristao.
 */
DO $$ BEGIN
  ALTER TABLE "customer_contact_consents"
    ADD CONSTRAINT "customer_contact_consents_source_ck"
    CHECK (
      (source = 'customer_self_service' AND recorded_by IS NULL)
      OR (source = 'office_recorded_offline'
          AND recorded_by IS NOT NULL
          AND action = 'granted')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Append-only na nivou baze, isti obrazac kao `audit_log` (migracija 0001).
 *
 * Aplikacija nema putanju koja menja ili briše red, ali okidač je jedina
 * kontrola koja preživljava grešku u kodu, ručnu ispravku i budući uvoz.
 */
CREATE OR REPLACE FUNCTION customer_contact_consents_is_append_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'customer_contact_consents je append-only: povlacenje se upisuje kao nov red, ne kao izmena'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS customer_contact_consents_no_update ON "customer_contact_consents";
--> statement-breakpoint

CREATE TRIGGER customer_contact_consents_no_update
  BEFORE UPDATE OR DELETE ON "customer_contact_consents"
  FOR EACH ROW EXECUTE FUNCTION customer_contact_consents_is_append_only();
