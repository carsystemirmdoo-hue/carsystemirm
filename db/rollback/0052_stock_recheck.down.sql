/*
 * Povratni postupak za 0052_stock_recheck.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0052.
 * Ako isti fajl već ima dva zapisa (neuspešan stariji + nova provera), vraćanje jedinstvenosti po
 * SHA-256 nije moguće bez brisanja istorije — tada se postupak NE izvodi (zapisi otpremanja se ne brišu).
 */
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM stock_imports GROUP BY file_sha256 HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'isti fajl ima više zapisa — povratak 0052 bi brisao istoriju; prekinuto';
  END IF;
END $$;
DROP INDEX IF EXISTS "stock_imports_sha_live_key";
ALTER TABLE "stock_imports" DROP CONSTRAINT IF EXISTS "stock_imports_sha_parser_key";
ALTER TABLE "stock_imports" ADD CONSTRAINT "stock_imports_sha_key" UNIQUE ("file_sha256");
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1792936800000; -- `when` iz _journal.json za 0052
COMMIT;
