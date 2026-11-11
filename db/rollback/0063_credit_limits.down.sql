/*
 * Povratni postupak za 0063_credit_limits. Ručno, vlasnikom baze, posle povratka koda.
 * Upisani limiti su odluka vlasnika/komercijaliste: ako postoje, postupak staje.
 * Vrednost enuma `credit_warning` ostaje (Postgres ne briše vrednost enuma); obaveštenja te vrste se brišu.
 */
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM customer_credit_limits) THEN
    RAISE EXCEPTION 'upisani limiti postoje — povratak 0063 bi ih brisao; prekinuto';
  END IF;
END $$;
DELETE FROM notifications WHERE kind::text = 'credit_warning';
DROP TABLE IF EXISTS "customer_credit_limits";
-- Kolona `notifications.customer_id` ostaje: možda je postojala i pre 0063 (ADD COLUMN IF NOT EXISTS).
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793973600000; -- `when` za 0063
COMMIT;
