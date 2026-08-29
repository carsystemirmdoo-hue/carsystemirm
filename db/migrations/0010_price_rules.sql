/*
 * Pravila cene i grupe kupaca.
 *
 * Aditivno i idempotentno. Nijedna postojeća tabela se ne dira.
 *
 * Ključna odluka koja živi u ovoj šemi: `approved_pending_biznisoft` je
 * ZASEBNO stanje od `confirmed`. Odobrenje je odluka gazde; potvrda je dokaz
 * da je uslov stvarno upisan u BizniSoft. Da su isto stanje, portal bi kupcu i
 * komercijalisti prikazivao odobrenu cenu kao fakturisanu — a ona to nije dok
 * je knjigovodstvo ne upiše.
 */

DO $$ BEGIN
  CREATE TYPE "public"."price_customer_scope" AS ENUM ('customer', 'group', 'all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."price_product_scope" AS ENUM ('article', 'product_group', 'brand', 'all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."price_value_kind" AS ENUM ('discount_percent', 'net_price');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."price_rule_status" AS ENUM (
    'draft',
    'pending_approval',
    'approved_pending_biznisoft',
    'confirmed',
    'rejected',
    'reconciliation_failed',
    'revoked',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * Grupe kupaca
 * ====================================================================== */

CREATE TABLE IF NOT EXISTS "customer_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_groups"
    ADD CONSTRAINT "customer_groups_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "customer_groups_key_key"
  ON "customer_groups" ("key");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_group_members" (
  "group_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "added_by" uuid,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_group_members_pk" PRIMARY KEY ("group_id", "customer_id")
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_group_members"
    ADD CONSTRAINT "customer_group_members_group_id_customer_groups_id_fk"
    FOREIGN KEY ("group_id") REFERENCES "public"."customer_groups"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_group_members"
    ADD CONSTRAINT "customer_group_members_customer_id_customers_id_fk"
    FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_group_members"
    ADD CONSTRAINT "customer_group_members_added_by_users_id_fk"
    FOREIGN KEY ("added_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_group_members_customer_idx"
  ON "customer_group_members" ("customer_id");
--> statement-breakpoint

/* =========================================================================
 * price_rules
 * ====================================================================== */

CREATE TABLE IF NOT EXISTS "price_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_scope" "price_customer_scope" NOT NULL,
  "customer_id" uuid,
  "customer_group_id" uuid,
  "product_scope" "price_product_scope" NOT NULL,
  "article_id" uuid,
  "product_group" text,
  "brand" text,
  "precedence_level" integer NOT NULL,
  "scope_key" text NOT NULL,
  "value_kind" "price_value_kind" NOT NULL,
  "discount_percent" numeric(6, 3),
  "net_price" numeric(14, 4),
  "currency" text DEFAULT 'RSD' NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "status" "price_rule_status" DEFAULT 'draft' NOT NULL,
  "reason" text NOT NULL,
  "proposed_by" uuid,
  "proposed_at" timestamp with time zone,
  "decided_by" uuid,
  "decided_at" timestamp with time zone,
  "decision_reason" text,
  "confirmed_by" uuid,
  "confirmed_at" timestamp with time zone,
  "confirmation_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_customer_id_customers_id_fk"
    FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_customer_group_id_customer_groups_id_fk"
    FOREIGN KEY ("customer_group_id") REFERENCES "public"."customer_groups"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_article_id_articles_id_fk"
    FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_proposed_by_users_id_fk"
    FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_decided_by_users_id_fk"
    FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_confirmed_by_users_id_fk"
    FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "price_rules_customer_idx" ON "price_rules" ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_rules_article_idx" ON "price_rules" ("article_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_rules_status_idx" ON "price_rules" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_rules_conflict_idx"
  ON "price_rules" ("precedence_level", "scope_key", "status");
--> statement-breakpoint

/*
 * Vrednost: ILI rabat ILI fiksna cena, nikad oboje i nikad nijedno.
 *
 * Ovo je jedina brava koja to garantuje. Aplikativna provera pada čim neko
 * napiše drugi put upisa — uvoz, skriptu, ručnu ispravku.
 */
DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_value_ck"
    CHECK (
      (value_kind = 'discount_percent'
       AND discount_percent IS NOT NULL AND net_price IS NULL
       AND discount_percent >= 0 AND discount_percent <= 100)
      OR
      (value_kind = 'net_price'
       AND net_price IS NOT NULL AND discount_percent IS NULL
       AND net_price >= 0)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Opseg kupca mora nositi tačno ono polje koje mu pripada, i nijedno drugo. */
DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_customer_scope_ck"
    CHECK (
      (customer_scope = 'customer' AND customer_id IS NOT NULL AND customer_group_id IS NULL)
      OR (customer_scope = 'group' AND customer_group_id IS NOT NULL AND customer_id IS NULL)
      OR (customer_scope = 'all' AND customer_id IS NULL AND customer_group_id IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_product_scope_ck"
    CHECK (
      (product_scope = 'article' AND article_id IS NOT NULL
        AND product_group IS NULL AND brand IS NULL)
      OR (product_scope = 'product_group' AND product_group IS NOT NULL
        AND article_id IS NULL AND brand IS NULL)
      OR (product_scope = 'brand' AND brand IS NOT NULL
        AND article_id IS NULL AND product_group IS NULL)
      OR (product_scope = 'all' AND article_id IS NULL
        AND product_group IS NULL AND brand IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Klasa prvenstva mora odgovarati paru opsega.
 *
 * Broj se upisuje iz koda; ovde stoji ista matrica, da izmena u kodu koja bi
 * pomerila klase ne bi mogla tiho da uđe u bazu. Dve kopije istog pravila su
 * ovde prednost: razilaženje se vidi kao odbijen upis, ne kao pogrešna cena.
 */
DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_precedence_ck"
    CHECK (
      precedence_level = (
        CASE customer_scope WHEN 'customer' THEN 0 WHEN 'group' THEN 4 ELSE 8 END
        +
        CASE product_scope WHEN 'article' THEN 1 WHEN 'product_group' THEN 2
             WHEN 'brand' THEN 3 ELSE 4 END
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_effective_ck"
    CHECK (effective_to IS NULL OR effective_to >= effective_from);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Razlog predloga je obavezan i ne sme biti prazan niz razmaka. */
DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_reason_ck"
    CHECK (btrim("reason") <> '');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Odbijeno i opozvano pravilo mora imati razlog odluke.
 *
 * Isti razlog kao kod kupčevog naloga: oduzeta pogodnost bez zapisanog razloga
 * otkriva se tek kada kupac pozove.
 */
DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_decision_reason_ck"
    CHECK (
      status NOT IN ('rejected', 'revoked')
      OR (decision_reason IS NOT NULL AND btrim(decision_reason) <> '')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * `confirmed` mora imati i ko i kada je potvrdio.
 *
 * Bez ovoga bi postojalo pravilo koje tvrdi da je primenjeno u BizniSoftu, a
 * niko ne stoji iza te tvrdnje — što je tačno stanje koje `reconciliation_failed`
 * treba da hvata i koje bi ovako prošlo neprimećeno.
 */
DO $$ BEGIN
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_confirmed_ck"
    CHECK (
      status <> 'confirmed'
      OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * Paket dozvola za cene
 * ====================================================================== */

INSERT INTO "permission_packages" ("key", "name", "description", "sort_order")
VALUES
  ('cene_predlog', 'Predlaganje cena i rabata',
   'Predlaganje pravila cene za dodeljene kupce, bez aktiviranja', '11'),
  ('cene_odobravanje', 'Odobravanje cena i rabata',
   'Odobravanje ili odbijanje predloženih pravila cene', '12'),
  ('cene_primena', 'Evidentiranje primene u BizniSoftu',
   'Potvrda da je odobreno pravilo ručno upisano u BizniSoft', '13')
ON CONFLICT ("key") DO UPDATE
  SET "name" = EXCLUDED."name",
      "description" = EXCLUDED."description";
