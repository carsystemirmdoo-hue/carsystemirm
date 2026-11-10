/*
 * Povratni postupak za 0062_receivable_sheets. Ručno, vlasnikom baze, posle povratka koda.
 * Ručne veze naziva su rad kancelarije: ako postoje, postupak staje.
 */
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM receivable_customer_links) THEN
    RAISE EXCEPTION 'ručne veze naziva postoje — povratak 0062 bi ih brisao; prekinuto';
  END IF;
END $$;
DROP TABLE IF EXISTS "receivable_sheet_customers";
DROP TABLE IF EXISTS "receivable_customer_links";
DROP FUNCTION IF EXISTS "receivable_sheet_customers_guard"();
DROP INDEX IF EXISTS "receivable_lines_label_idx";
ALTER TABLE "receivable_lines" DROP COLUMN IF EXISTS "label_key";
ALTER TABLE "receivable_lines" DROP COLUMN IF EXISTS "source_label";
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793887200000; -- `when` za 0062
COMMIT;
