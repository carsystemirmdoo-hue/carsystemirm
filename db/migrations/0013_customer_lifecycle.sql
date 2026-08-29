/*
 * Bezbedan lifecycle kupčevog naloga — postflight audit F-4, F-5, F-6.
 *
 * Tri nalaza koja ova migracija zatvara:
 *   F-6: kancelarija je postavljala trajnu početnu lozinku i predavala je van
 *        sistema; kupac je nikada nije mogao promeniti. Sada kancelarija
 *        lozinku NE ZNA — kupac je sam postavlja kroz jednokratni poziv.
 *   F-5: `failed_login_attempts` i `locked_until` su postojali i proveravali
 *        se, ali ih niko nije uvećavao — mrtva kontrola.
 *   F-4: neuspela prijava kupca nije ostavljala nijedan audit zapis.
 *
 * Aditivno i idempotentno.
 */

/* =========================================================================
 * 1. Lozinka postoji tek posle aktivacije
 * ====================================================================== */

ALTER TABLE "customer_users" ALTER COLUMN "password_hash" DROP NOT NULL;
--> statement-breakpoint

/*
 * Zatečeni nalozi koje je otvorila kancelarija imaju lozinku koju kancelarija
 * zna. Takav nalog se vraća u `approved` i lozinka se briše — pristup se
 * ponovo otvara tek pozivom koji kupac sam iskoristi.
 *
 * Ovo NIJE gubitak podataka: lozinka koju je postavio neko drugi ionako nije
 * smela da postoji, a nalog i njegova veza sa kupcem ostaju netaknuti.
 */
UPDATE "customer_users"
   SET "password_hash" = NULL,
       "status" = 'approved',
       "session_version" = "session_version" + 1,
       "updated_at" = now()
 WHERE "password_hash" IS NOT NULL
   AND "status" IN ('approved', 'active');
--> statement-breakpoint

/*
 * Lozinka postoji TAČNO u stanju `active`.
 *
 * Ovo je brava iza pravila „kancelarija ne unosi i ne saznaje lozinku": u
 * stanjima koja kancelarija postavlja (`requested`, `approved`) lozinka ne sme
 * ni da postoji, pa je nema šta da se sazna.
 */
DO $$ BEGIN
  ALTER TABLE "customer_users"
    ADD CONSTRAINT "customer_users_password_lifecycle_ck"
    CHECK (
      (status = 'active' AND password_hash IS NOT NULL)
      OR (status IN ('requested', 'approved') AND password_hash IS NULL)
      OR (status IN ('suspended', 'rejected'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * 2. Jednokratni tokeni
 * ====================================================================== */

DO $$ BEGIN
  CREATE TYPE "public"."customer_token_purpose" AS ENUM ('invitation', 'password_reset');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_account_tokens" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "customer_user_id" uuid NOT NULL,
  "purpose" "customer_token_purpose" NOT NULL,
  "token_fingerprint" text NOT NULL,
  "key_version" integer NOT NULL,
  "issued_by" uuid,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "superseded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_account_tokens"
    ADD CONSTRAINT "customer_account_tokens_customer_user_id_fk"
    FOREIGN KEY ("customer_user_id") REFERENCES "public"."customer_users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_account_tokens"
    ADD CONSTRAINT "customer_account_tokens_issued_by_users_id_fk"
    FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Otisak je jedinstven preko cele tabele.
 *
 * Dva reda sa istim otiskom značila bi da jedan token otvara dva naloga — a
 * `consume` bi tada morao da bira. Jedinstvenost to čini nemogućim.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "customer_account_tokens_fingerprint_key"
  ON "customer_account_tokens" ("token_fingerprint");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_account_tokens_open_idx"
  ON "customer_account_tokens" ("customer_user_id", "purpose", "used_at");
--> statement-breakpoint

/* =========================================================================
 * 3. Outbox — provider-neutralan ugovor
 * ====================================================================== */

DO $$ BEGIN
  CREATE TYPE "public"."customer_outbox_kind" AS ENUM
    ('invitation', 'password_reset', 'security_notice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."customer_outbox_status" AS ENUM
    ('pending', 'handed_over', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_message_outbox" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "customer_user_id" uuid NOT NULL,
  "kind" "customer_outbox_kind" NOT NULL,
  "status" "customer_outbox_status" DEFAULT 'pending' NOT NULL,
  "handed_over_at" timestamp with time zone,
  "handed_over_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_message_outbox"
    ADD CONSTRAINT "customer_message_outbox_customer_user_id_fk"
    FOREIGN KEY ("customer_user_id") REFERENCES "public"."customer_users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_message_outbox"
    ADD CONSTRAINT "customer_message_outbox_handed_over_by_users_id_fk"
    FOREIGN KEY ("handed_over_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_message_outbox_status_idx"
  ON "customer_message_outbox" ("status", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_message_outbox_user_idx"
  ON "customer_message_outbox" ("customer_user_id");
--> statement-breakpoint

/*
 * Outbox NE nosi token ni link.
 *
 * Kolona za njih namerno ne postoji: da postoji, kopija ove tabele bila bi
 * kopija svih otvorenih poziva i resetâ. Kancelarija link vidi tačno jednom,
 * u odgovoru radnje koja ga je izdala.
 */
DO $$ BEGIN
  ALTER TABLE "customer_message_outbox"
    ADD CONSTRAINT "customer_message_outbox_handover_ck"
    CHECK (
      status <> 'handed_over'
      OR (handed_over_at IS NOT NULL AND handed_over_by IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * 4. Paket za predlaganje kontakta (komercijalista)
 * ====================================================================== */

INSERT INTO "permission_packages" ("key", "name", "description", "sort_order")
VALUES
  ('kupacki_nalozi_predlog', 'Predlaganje kontakata kupaca',
   'Predlaganje kontakt-osobe za dodeljenog kupca, bez aktiviranja naloga', '15')
ON CONFLICT ("key") DO UPDATE
  SET "name" = EXCLUDED."name",
      "description" = EXCLUDED."description";
