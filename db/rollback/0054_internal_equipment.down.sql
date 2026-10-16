/*
 * Povratni postupak za 0054_internal_equipment.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0054.
 * Ako evidencija ima zapise, postupak staje (zapisi opreme se ne brišu).
 */
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.internal_equipment') IS NOT NULL AND EXISTS (SELECT 1 FROM internal_equipment) THEN
    RAISE EXCEPTION 'evidencija opreme ima zapise — povratak 0054 bi brisao podatke; prekinuto';
  END IF;
END $$;
DROP TABLE IF EXISTS "internal_equipment";
DROP FUNCTION IF EXISTS "internal_equipment_guard"();
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1793109600000; -- `when` iz _journal.json za 0054
COMMIT;
