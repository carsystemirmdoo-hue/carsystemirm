/*
 * Spoljni identitet kupca i mapiranje artikla na katalog.
 *
 * Aditivno: nijedna postojeća tabela ne gubi kolonu ni ograničenje, i nijedan
 * postojeći red se ne menja. `customers.pib` ostaje kakav jeste — i dalje je
 * jedinstven i i dalje je koristan podatak. Ono što se menja je da PIB više
 * nije JEDINI identitet kupca.
 *
 * Idempotentno: sme se pokrenuti više puta.
 */

DO $$ BEGIN
  CREATE TYPE "public"."external_identity_status" AS ENUM (
    'unmapped', 'mapped', 'conflict', 'disabled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."product_mapping_status" AS ENUM (
    'unmapped', 'suggested', 'mapped', 'conflict', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * customer_external_identifiers
 *
 * `external_partner_code` je `text`, i to je poslovno pravilo a ne detalj
 * tipa. Da je numerički, `'0012'` i `'12'` bi bili isti partner — a nisu.
 * ====================================================================== */

CREATE TABLE IF NOT EXISTS "customer_external_identifiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid,
  "source_system" text NOT NULL,
  "issuer_code" text NOT NULL,
  "external_partner_code" text NOT NULL,
  "source_name" text,
  "status" "external_identity_status" DEFAULT 'unmapped' NOT NULL,
  "note" text,
  "conflict_reason" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "verified_by" uuid,
  "verified_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_external_identifiers"
    ADD CONSTRAINT "customer_external_identifiers_customer_id_customers_id_fk"
    FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_external_identifiers"
    ADD CONSTRAINT "customer_external_identifiers_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_external_identifiers"
    ADD CONSTRAINT "customer_external_identifiers_verified_by_users_id_fk"
    FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Jedinstvenost je (izvor, izdavalac, šifra).
 *
 * Ista šifra kod dva izdavaoca je legitimna i ne sme se spojiti; ista šifra
 * kod istog izdavaoca je jedan partner i ne sme postojati dvaput. Ovo je
 * jedina brava koja to garantuje — aplikativna provera ne preživljava dva
 * paralelna uvoza.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "customer_external_identifiers_key"
  ON "customer_external_identifiers" ("source_system", "issuer_code", "external_partner_code");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_external_identifiers_customer_idx"
  ON "customer_external_identifiers" ("customer_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_external_identifiers_status_idx"
  ON "customer_external_identifiers" ("status");
--> statement-breakpoint

/*
 * Stanje i veza ne smeju da protivreče jedno drugom.
 *
 * `mapped` bez kupca bi bio red koji tvrdi da je razrešen a ne kaže čiji je;
 * `unmapped` sa kupcem bi bio red koji nosi vezu a prikazuje se kao da čeka
 * odluku. Oba oblika bi prošla svaku aplikativnu proveru napisanu kasnije, pa
 * se zabranjuju ovde.
 */
DO $$ BEGIN
  ALTER TABLE "customer_external_identifiers"
    ADD CONSTRAINT "customer_external_identifiers_status_customer_ck"
    CHECK (
      (status = 'mapped'   AND customer_id IS NOT NULL) OR
      (status = 'unmapped' AND customer_id IS NULL)     OR
      (status IN ('conflict', 'disabled'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Šifra ne sme biti prazna ni sastavljena samo od razmaka. */
DO $$ BEGIN
  ALTER TABLE "customer_external_identifiers"
    ADD CONSTRAINT "customer_external_identifiers_code_ck"
    CHECK (btrim("external_partner_code") <> '' AND btrim("issuer_code") <> '');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * article_catalog_mappings
 * ====================================================================== */

CREATE TABLE IF NOT EXISTS "article_catalog_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "article_id" uuid NOT NULL,
  "catalog_product_slug" text,
  "catalog_variant_id" text,
  "status" "product_mapping_status" DEFAULT 'unmapped' NOT NULL,
  "note" text,
  "conflict_reason" text,
  "proposed_by" uuid,
  "proposed_at" timestamp with time zone,
  "confirmed_by" uuid,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "article_catalog_mappings"
    ADD CONSTRAINT "article_catalog_mappings_article_id_articles_id_fk"
    FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "article_catalog_mappings"
    ADD CONSTRAINT "article_catalog_mappings_proposed_by_users_id_fk"
    FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "article_catalog_mappings"
    ADD CONSTRAINT "article_catalog_mappings_confirmed_by_users_id_fk"
    FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Najviše jedan ŽIVI red po artiklu.
 *
 * Ovo je brava iza pravila „jedan BizniSoft artikal ne sme tiho pokazivati dva
 * različita katalog proizvoda". Odbijeni redovi ostaju kao istorija i zato
 * ispadaju iz indeksa — inače se jednom odbijen artikal ne bi mogao ponovo
 * predložiti.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "article_catalog_mappings_live_key"
  ON "article_catalog_mappings" ("article_id")
  WHERE status <> 'rejected';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "article_catalog_mappings_status_idx"
  ON "article_catalog_mappings" ("status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "article_catalog_mappings_slug_idx"
  ON "article_catalog_mappings" ("catalog_product_slug");
--> statement-breakpoint

/*
 * Potvrđena veza mora imati kataloški proizvod.
 *
 * Bez ovoga bi `status = 'mapped'` sa praznim slugom prošao svaku proveru u
 * kodu i završio kao customer-facing link u nigde.
 */
DO $$ BEGIN
  ALTER TABLE "article_catalog_mappings"
    ADD CONSTRAINT "article_catalog_mappings_mapped_needs_slug_ck"
    CHECK (status <> 'mapped' OR (catalog_product_slug IS NOT NULL AND btrim(catalog_product_slug) <> ''));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * Novi paket dozvola: „Mapiranja kupaca i artikala"
 *
 * Isti razlog kao u 0007: `user_permissions.permission_key` ima strani ključ ka
 * `permission_packages`, pa paket koji postoji u kodu a ne u bazi obara svaku
 * dodelu. Lista je kanonska kopija iz `lib/authz/permissions.mjs`.
 * ====================================================================== */

INSERT INTO "permission_packages" ("key", "name", "description", "sort_order")
VALUES
  ('mapiranja', 'Mapiranja kupaca i artikala',
   'Razrešavanje šifri partnera i potvrda veza artikala sa katalogom', '9')
ON CONFLICT ("key") DO UPDATE
  SET "name" = EXCLUDED."name",
      "description" = EXCLUDED."description";
