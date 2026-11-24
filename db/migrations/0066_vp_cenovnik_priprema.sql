/*
 * Priprema novog VP cenovnika (0066; odluka vlasnika 2026-11-18).
 *
 * Tok: menadžer prodaje (paket „cenovnik_priprema“) pravi PRIPREMU — nove VP cene po brendu,
 * grupi ili artiklu (procenat ili tačna cena), ili otpremi Excel. Šalje je kancelariji; kancelarija
 * proverava staru pored nove cene, preuzima Excel za BizniSoft i šalje vlasniku (ili vraća sa
 * napomenom). Slanjem vlasniku nastaje obično otpremanje cenovnika (`price_list_imports`, status
 * „pregled“) sa SAMO promenjenim cenama, pa primena ide postojećim putem: vlasnik, drugi faktor,
 * datum važenja. Ova migracija NE menja nijednu osnovnu cenu.
 *
 * price_list_drafts      — jedna priprema i njen korak (priprema → kancelarija → vlasnik).
 * price_list_draft_rows  — nova VP cena po artiklu; stara cena je snimak u trenutku čuvanja.
 *                          Menja se samo dok je priprema u koraku „priprema“ (ceo skup se zamenjuje).
 *
 * `price_list_stage` je nova vrsta obaveštenja (sledeći korak pripreme). Vrednost se u ovoj
 * migraciji ne koristi, pa je `ADD VALUE` u transakciji bezbedan (vidi 0012, 0063).
 */
ALTER TYPE "notification_kind" ADD VALUE IF NOT EXISTS 'price_list_stage';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_list_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "origin" text NOT NULL DEFAULT 'priprema',
  "stage" text NOT NULL DEFAULT 'priprema',
  "proposed_valid_from" date,
  -- Unos sa ekrana (procenti po brendu/grupi/artiklu, tačne cene) da bi se priprema mogla nastaviti.
  "edits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Zaokruživanje nove cene: na paru ili na ceo dinar.
  "rounding" text NOT NULL DEFAULT 'para',
  "prepared_note" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "sent_to_office_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "sent_to_office_at" timestamp with time zone,
  "office_checked_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "office_checked_at" timestamp with time zone,
  "office_note" text,
  "returned_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "returned_at" timestamp with time zone,
  "returned_note" text,
  "import_id" uuid REFERENCES "price_list_imports"("id") ON DELETE RESTRICT,
  "row_count" integer NOT NULL DEFAULT 0,
  "changed_count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "price_list_drafts_origin_check" CHECK ("origin" IN ('priprema', 'excel')),
  CONSTRAINT "price_list_drafts_rounding_check" CHECK ("rounding" IN ('para', 'dinar')),
  CONSTRAINT "price_list_drafts_stage_check" CHECK ("stage" IN ('priprema', 'kancelarija', 'vlasnik', 'odbaceno')),
  CONSTRAINT "price_list_drafts_text_check" CHECK (
    length(btrim("title")) BETWEEN 1 AND 120 AND
    ("prepared_note" IS NULL OR length("prepared_note") <= 1000) AND
    ("office_note" IS NULL OR length("office_note") <= 1000) AND
    ("returned_note" IS NULL OR length("returned_note") <= 1000)
  ),
  -- Kod vlasnika je priprema tačno kada postoji otpremanje za primenu.
  CONSTRAINT "price_list_drafts_import_check" CHECK (("stage" = 'vlasnik') = ("import_id" IS NOT NULL) OR "stage" = 'odbaceno'),
  CONSTRAINT "price_list_drafts_counts_check" CHECK ("row_count" >= 0 AND "changed_count" >= 0 AND "changed_count" <= "row_count")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_list_drafts_stage_idx" ON "price_list_drafts" ("stage", "updated_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_list_draft_rows" (
  "draft_id" uuid NOT NULL REFERENCES "price_list_drafts"("id") ON DELETE CASCADE,
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE RESTRICT,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "brand" text NOT NULL,
  "group_key" text NOT NULL,
  "vat_percent" numeric(5, 2) NOT NULL,
  "old_vp_price" numeric(14, 2),
  "new_vp_price" numeric(14, 2) NOT NULL,
  CONSTRAINT "price_list_draft_rows_pk" PRIMARY KEY ("draft_id", "article_id"),
  CONSTRAINT "price_list_draft_rows_check" CHECK (
    length("code") BETWEEN 1 AND 32 AND length("name") BETWEEN 1 AND 300 AND
    "vat_percent" BETWEEN 0 AND 100 AND "new_vp_price" > 0 AND ("old_vp_price" IS NULL OR "old_vp_price" > 0)
  )
);
--> statement-breakpoint
INSERT INTO "permission_packages" ("key", "name", "description", "sort_order")
VALUES
  ('cenovnik_priprema', 'Priprema VP cenovnika',
   'Nove VP cene po brendu, grupi ili artiklu (procenat ili cena), izvoz i otpremanje Excela, slanje kancelariji; primenu potvrđuje vlasnik', '20')
ON CONFLICT ("key") DO UPDATE
  SET "name" = EXCLUDED."name",
      "description" = EXCLUDED."description";
