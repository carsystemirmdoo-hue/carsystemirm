/*
 * Povratni postupak za 0061_sales_rep_tools.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0061.
 * Ako postoje beleške razgovora ili kontakti koje su upisali komercijalisti, postupak staje.
 * Snimci dugovanja su kopija tabele kancelarije i mogu se ponovo pročitati.
 */
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM customer_call_notes) OR EXISTS (SELECT 1 FROM customer_sales_contacts) THEN
    RAISE EXCEPTION 'beleške razgovora ili kontakti imaju zapise — povratak 0061 bi ih brisao; prekinuto';
  END IF;
END $$;
DROP TABLE IF EXISTS "receivable_lines";
DROP TABLE IF EXISTS "receivable_snapshots";
DROP TABLE IF EXISTS "customer_call_notes";
DROP TABLE IF EXISTS "customer_sales_contacts";
DROP FUNCTION IF EXISTS "receivable_lines_guard"();
DROP FUNCTION IF EXISTS "receivable_snapshots_guard"();
DROP FUNCTION IF EXISTS "customer_call_notes_guard"();
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1793800800000; -- `when` iz _journal.json za 0061
COMMIT;
