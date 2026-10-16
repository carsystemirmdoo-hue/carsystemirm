/*
 * Cene po kupcu: pamti se rabat, ne cena (0057; odluke vlasnika 16. 10. 2026).
 *
 *  - `price_rules.rule_kind`: redovni rabat ili privremena AKCIJA na istom opsegu. Dok akcija važi, ona
 *    pobeđuje redovni rabat istog opsega; redovni rabat se NE menja i posle isteka akcije ponovo važi,
 *    na tada važeću VP cenu. Dve akcije istog opsega u istom danu ostaju konflikt.
 *  - `article_new_defaults`: nov artikal iz uvoza VP cenovnika dobija podrazumevani rabat (30 %) za sve
 *    opcije plaćanja, dok ovlašćena osoba ne upiše dogovor za artikal. Izričiti dogovori za artikal se ne
 *    prepisuju — podrazumevani rabat važi samo kada pravilo za sam artikal ne postoji.
 *  - `article_code_aliases`: izričito povezivanje šifre iz cenovnika sa postojećim artiklom (bez
 *    povezivanja po sličnosti naziva).
 *  - `rebate_change_notices`: interno obaveštenje o izmeni rabata — izmena komercijaliste ide gazdi,
 *    gazdina dodeljenom komercijalisti. Kupac ga nikad ne dobija. Briše se posle 10 dana; brisanje ne
 *    dodiruje pravila cena (nema veze ka `price_rules`).
 *  - `price_list_imports`/`_rows`: uvoz iz tabele (CSV/XLSX) sa izborom kolona i jedinice cene.
 */
ALTER TABLE "price_rules" ADD COLUMN IF NOT EXISTS "rule_kind" text NOT NULL DEFAULT 'redovni';
--> statement-breakpoint
ALTER TABLE "price_rules" DROP CONSTRAINT IF EXISTS "price_rules_rule_kind_check";
--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_rule_kind_check" CHECK (
  "rule_kind" IN ('redovni', 'akcija') AND ("rule_kind" = 'redovni' OR "effective_to" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "article_new_defaults" (
  "article_id" uuid PRIMARY KEY REFERENCES "articles"("id") ON DELETE RESTRICT,
  "discount_percent" numeric(6, 3) NOT NULL DEFAULT 30 CHECK ("discount_percent" >= 0 AND "discount_percent" <= 100),
  "import_id" uuid REFERENCES "price_list_imports"("id") ON DELETE RESTRICT,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "article_code_aliases" (
  "code" text PRIMARY KEY CHECK (length(btrim("code")) BETWEEN 1 AND 64),
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE RESTRICT,
  "import_id" uuid REFERENCES "price_list_imports"("id") ON DELETE RESTRICT,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rebate_change_notices" (
  "id" bigserial PRIMARY KEY,
  "recipient_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "actor_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "source_batch" text NOT NULL,
  "period" text NOT NULL,
  "items" jsonb NOT NULL,
  "note" text CHECK ("note" IS NULL OR length("note") <= 500),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "read_at" timestamp with time zone,
  CONSTRAINT "rebate_change_notices_recipient_not_actor" CHECK ("recipient_user_id" <> "actor_user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rebate_change_notices_recipient_idx" ON "rebate_change_notices" ("recipient_user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rebate_change_notices_created_idx" ON "rebate_change_notices" ("created_at");
--> statement-breakpoint
ALTER TABLE "price_list_imports" ADD COLUMN IF NOT EXISTS "source_format" text NOT NULL DEFAULT 'biznisoft_pdf';
--> statement-breakpoint
ALTER TABLE "price_list_imports" ADD COLUMN IF NOT EXISTS "price_unit" text;
--> statement-breakpoint
ALTER TABLE "price_list_imports" ADD COLUMN IF NOT EXISTS "column_map" jsonb;
--> statement-breakpoint
ALTER TABLE "price_list_imports" ADD COLUMN IF NOT EXISTS "decisions" jsonb;
--> statement-breakpoint
ALTER TABLE "price_list_imports" DROP CONSTRAINT IF EXISTS "price_list_imports_format_check";
--> statement-breakpoint
ALTER TABLE "price_list_imports" ADD CONSTRAINT "price_list_imports_format_check" CHECK (
  "source_format" IN ('biznisoft_pdf', 'tabela') AND ("price_unit" IS NULL OR "price_unit" IN ('jm', 'pak'))
);
--> statement-breakpoint
ALTER TABLE "price_list_import_rows" ADD COLUMN IF NOT EXISTS "raw_price" numeric(14, 2);
--> statement-breakpoint
ALTER TABLE "price_list_import_rows" ADD COLUMN IF NOT EXISTS "file_unit" text;
--> statement-breakpoint
ALTER TABLE "price_list_import_rows" ADD COLUMN IF NOT EXISTS "file_pack" text;
