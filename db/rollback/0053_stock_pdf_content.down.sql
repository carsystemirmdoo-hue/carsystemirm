/*
 * Povratni postupak za 0053_stock_pdf_content.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0053.
 * Ako postoje PDF otpremanja, vraćanje provere formata nije moguće bez brisanja istorije — postupak staje.
 */
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM stock_imports WHERE file_format = 'pdf') THEN
    RAISE EXCEPTION 'postoje PDF otpremanja — povratak 0053 bi brisao istoriju; prekinuto';
  END IF;
END $$;
DROP INDEX IF EXISTS "stock_imports_content_live_key";
ALTER TABLE "stock_imports" DROP CONSTRAINT IF EXISTS "stock_imports_text_check";
ALTER TABLE "stock_imports" ADD CONSTRAINT "stock_imports_text_check" CHECK (
  length("file_name") BETWEEN 1 AND 200 AND length("parser_version") <= 60 AND
  "file_format" IN ('xlsx', 'csv') AND
  ("warehouse_code" IS NULL OR "warehouse_code" ~ '^[0-9]{2,4}$') AND
  ("warehouse_name" IS NULL OR length("warehouse_name") <= 120) AND
  ("decision_note" IS NULL OR length("decision_note") <= 500)
);
CREATE OR REPLACE FUNCTION "stock_imports_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  frozen_same boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'otpremanje lagera se ne briše' USING ERRCODE = 'insufficient_privilege';
  END IF;
  frozen_same := (NEW."file_sha256", NEW."file_name", NEW."file_bytes", NEW."file_format", NEW."parser_version", NEW."warehouse_code",
      NEW."warehouse_name", NEW."stock_date", NEW."printed_on", NEW."line_count", NEW."summary", NEW."problems",
      NEW."uploaded_by", NEW."uploaded_at")
     IS NOT DISTINCT FROM
     (OLD."file_sha256", OLD."file_name", OLD."file_bytes", OLD."file_format", OLD."parser_version", OLD."warehouse_code",
      OLD."warehouse_name", OLD."stock_date", OLD."printed_on", OLD."line_count", OLD."summary", OLD."problems",
      OLD."uploaded_by", OLD."uploaded_at");
  IF NOT frozen_same THEN
    RAISE EXCEPTION 'podaci otpremljenog lagera se ne menjaju' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Oznaka čišćenja: jednom, samo vlasnik tabele (postupak čuvanja), bez promene odluke.
  IF (NEW."lines_purged_at", NEW."lines_purged_reason") IS DISTINCT FROM (OLD."lines_purged_at", OLD."lines_purged_reason") THEN
    IF OLD."lines_purged_at" IS NOT NULL
       OR current_user <> (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = TG_RELID)
       OR (NEW."status", NEW."decided_by", NEW."decided_at", NEW."decision_note")
          IS DISTINCT FROM (OLD."status", OLD."decided_by", OLD."decided_at", OLD."decision_note") THEN
      RAISE EXCEPTION 'oznaka čišćenja se upisuje samo postupkom čuvanja' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."status" <> 'pregled' OR NEW."status" NOT IN ('potvrdjeno', 'odbaceno') THEN
    RAISE EXCEPTION 'odluka o lageru je konačna' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."status" = 'potvrdjeno' AND OLD."lines_purged_at" IS NOT NULL THEN
    RAISE EXCEPTION 'stavke ovog otpremanja su uklonjene — potvrda nije moguća' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
ALTER TABLE "stock_imports" DROP CONSTRAINT IF EXISTS "stock_imports_content_sha_check";
ALTER TABLE "stock_imports" DROP COLUMN IF EXISTS "content_sha256";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1793023200000; -- `when` iz _journal.json za 0053
COMMIT;
