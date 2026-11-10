/*
 * Povratni postupak za 0060_customer_article_dismissals.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0060.
 * Ako postoje oznake „ne uzima više“, postupak staje (beleške komercijalista se ne brišu).
 */
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM customer_article_dismissals) THEN
    RAISE EXCEPTION 'oznake „ne uzima više“ imaju zapise — povratak 0060 bi ih brisao; prekinuto';
  END IF;
END $$;
DROP TABLE IF EXISTS "customer_article_dismissals";
DROP FUNCTION IF EXISTS "customer_article_dismissals_guard"();
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1793714400000; -- `when` iz _journal.json za 0060
COMMIT;
