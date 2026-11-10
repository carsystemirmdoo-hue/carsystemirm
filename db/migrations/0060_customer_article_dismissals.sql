/*
 * „Ne uzima više“ (0060; 2026-11-10): komercijalista ili vlasnik beleži da kupac više ne kupuje
 * artikal, sa razlogom. Dok oznaka važi, artikal se ne pojavljuje u Preporukama, „Za razgovor“ ni
 * na kartici kupca među predlozima; u tabeli preporuka kupca stoji u delu „Ne kupuje više“.
 *
 * Ključ je šifra artikla (kao u preporukama), uz `article_id` kada je artikal u šifarniku.
 * Zapis se ne briše: „Vrati u preporuke“ je jednokratni UPDATE `revoked_at`/`revoked_by`.
 * Broj 0060: 0057–0059 su zauzeti na otvorenim granama (pri spajanju njima podići `when`).
 */
CREATE TABLE IF NOT EXISTS "customer_article_dismissals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "article_code" text NOT NULL,
  "article_id" uuid REFERENCES "articles"("id") ON DELETE RESTRICT,
  "reason" text NOT NULL,
  "replacement_article_id" uuid REFERENCES "articles"("id") ON DELETE RESTRICT,
  "note" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "customer_article_dismissals_reason_check" CHECK (
    "reason" IN ('drugi_dobavljac', 'drugi_brend', 'zamenjen', 'ne_radi_posao', 'cena', 'drugo')
  ),
  CONSTRAINT "customer_article_dismissals_code_check" CHECK (length(btrim("article_code")) BETWEEN 1 AND 80),
  CONSTRAINT "customer_article_dismissals_note_check" CHECK ("note" IS NULL OR length("note") <= 500),
  CONSTRAINT "customer_article_dismissals_replacement_check" CHECK (
    ("reason" = 'zamenjen') = ("replacement_article_id" IS NOT NULL)
  ),
  CONSTRAINT "customer_article_dismissals_drugo_check" CHECK (
    "reason" <> 'drugo' OR length(btrim(coalesce("note", ''))) >= 3
  ),
  CONSTRAINT "customer_article_dismissals_revoke_check" CHECK (("revoked_at" IS NULL) = ("revoked_by" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_article_dismissals_active_idx"
  ON "customer_article_dismissals" ("customer_id", "article_code") WHERE "revoked_at" IS NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "customer_article_dismissals_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'oznaka „ne uzima više“ se ne briše (vraćanje: revoked_at)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW."customer_id", NEW."article_code", NEW."article_id", NEW."reason", NEW."replacement_article_id", NEW."note", NEW."created_by", NEW."created_at")
     IS DISTINCT FROM
     (OLD."customer_id", OLD."article_code", OLD."article_id", OLD."reason", OLD."replacement_article_id", OLD."note", OLD."created_by", OLD."created_at")
     OR OLD."revoked_at" IS NOT NULL THEN
    RAISE EXCEPTION 'oznaka „ne uzima više“ se samo vraća, jednom' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "customer_article_dismissals_guard" ON "customer_article_dismissals";
--> statement-breakpoint
CREATE TRIGGER "customer_article_dismissals_guard" BEFORE UPDATE OR DELETE ON "customer_article_dismissals"
  FOR EACH ROW EXECUTE FUNCTION "customer_article_dismissals_guard"();
