/*
 * Prodajni naziv i prodaja do rasprodaje (0055; odluke vlasnika 16. 10. 2026).
 *
 * `article_sales_names`: naziv koji vidi KUPAC kada se izvorni BizniSoft naziv ne sme prikazati
 * (npr. „PVC POSUDA SA POKLOPCEM BLANKO 2,4L“ → „PVC posuda blanko 2,4 L“ — poklopac se prodaje
 * odvojeno). Izvorni naziv u `articles.name` i u istoriji dokumenata se ne menja.
 *
 * `article_sellout`: artikal se prodaje do isteka zalihe (npr. Autofit papir 60 × 150). Kada
 * POTVRĐEN lager pokaže stanje 0 (ili manje), potvrda lagera ga trajno povlači iz ponude
 * odlukom „van programa“ (istorija ostaje) i beleži kojim uvozom je rasprodaja završena.
 */
CREATE TABLE IF NOT EXISTS "article_sales_names" (
  "article_id" uuid PRIMARY KEY REFERENCES "articles"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "evidence" text NOT NULL,
  "decided_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "article_sales_names_check" CHECK (length(btrim("name")) BETWEEN 2 AND 200 AND length(btrim("evidence")) BETWEEN 5 AND 1000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "article_sellout" (
  "article_id" uuid PRIMARY KEY REFERENCES "articles"("id") ON DELETE RESTRICT,
  "evidence" text NOT NULL,
  "decided_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone NOT NULL DEFAULT now(),
  "ended_at" timestamp with time zone,
  "ended_import_id" uuid REFERENCES "stock_imports"("id") ON DELETE RESTRICT,
  CONSTRAINT "article_sellout_check" CHECK (length(btrim("evidence")) BETWEEN 5 AND 1000 AND (("ended_at" IS NULL) = ("ended_import_id" IS NULL)))
);
--> statement-breakpoint
-- Ni jedno ni drugo se ne briše; rasprodaja se završava jednom (ended_* se ne poništava).
CREATE OR REPLACE FUNCTION "article_sellout_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% se ne briše', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_TABLE_NAME = 'article_sellout' AND (
       (NEW."article_id", NEW."evidence", NEW."decided_by", NEW."decided_at") IS DISTINCT FROM (OLD."article_id", OLD."evidence", OLD."decided_by", OLD."decided_at")
       OR (OLD."ended_at" IS NOT NULL AND (NEW."ended_at", NEW."ended_import_id") IS DISTINCT FROM (OLD."ended_at", OLD."ended_import_id"))) THEN
    RAISE EXCEPTION 'odluka o rasprodaji se ne menja; završetak se upisuje jednom' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_TABLE_NAME = 'article_sales_names' AND NEW."article_id" IS DISTINCT FROM OLD."article_id" THEN
    RAISE EXCEPTION 'prodajni naziv pripada jednom artiklu' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "article_sellout_guard" ON "article_sellout";
--> statement-breakpoint
CREATE TRIGGER "article_sellout_guard" BEFORE UPDATE OR DELETE ON "article_sellout" FOR EACH ROW EXECUTE FUNCTION "article_sellout_guard"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "article_sales_names_guard" ON "article_sales_names";
--> statement-breakpoint
CREATE TRIGGER "article_sales_names_guard" BEFORE UPDATE OR DELETE ON "article_sales_names" FOR EACH ROW EXECUTE FUNCTION "article_sellout_guard"();
