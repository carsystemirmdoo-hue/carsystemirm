/*
 * Povratni postupak za 0051_stock_retention.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0051:
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f db/rollback/0051_stock_retention.down.sql
 *
 * Već obrisane stavke se ne vraćaju (vratiti ih može samo rezervna kopija baze). Vraćaju se
 * okidači iz 0050 i uklanja se postupak čuvanja i oznaka čišćenja.
 */
DROP FUNCTION IF EXISTS "stock_import_retention"();
CREATE OR REPLACE FUNCTION "stock_import_lines_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% se samo dodaje', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE OR REPLACE FUNCTION "stock_imports_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'otpremanje lagera se ne briše' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."status" <> 'pregled' OR NEW."status" NOT IN ('potvrdjeno', 'odbaceno') THEN
    RAISE EXCEPTION 'odluka o lageru je konačna' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW."file_sha256", NEW."file_name", NEW."file_bytes", NEW."file_format", NEW."parser_version", NEW."warehouse_code",
      NEW."warehouse_name", NEW."stock_date", NEW."printed_on", NEW."line_count", NEW."summary", NEW."problems",
      NEW."uploaded_by", NEW."uploaded_at")
     IS DISTINCT FROM
     (OLD."file_sha256", OLD."file_name", OLD."file_bytes", OLD."file_format", OLD."parser_version", OLD."warehouse_code",
      OLD."warehouse_name", OLD."stock_date", OLD."printed_on", OLD."line_count", OLD."summary", OLD."problems",
      OLD."uploaded_by", OLD."uploaded_at") THEN
    RAISE EXCEPTION 'podaci otpremljenog lagera se ne menjaju' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
ALTER TABLE "stock_imports" DROP CONSTRAINT IF EXISTS "stock_imports_purge_check";
ALTER TABLE "stock_imports" DROP COLUMN IF EXISTS "lines_purged_reason";
ALTER TABLE "stock_imports" DROP COLUMN IF EXISTS "lines_purged_at";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1792850400000; -- `when` iz _journal.json za 0051
