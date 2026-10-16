/*
 * Povratni postupak za 0056_article_required_pairs.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0056.
 * Ako postoje aktivni obavezni parovi, postupak staje (odluke vlasnika se ne brišu).
 */
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM article_required_pairs) THEN
    RAISE EXCEPTION 'obavezni parovi imaju zapise — povratak 0056 bi brisao odluke; prekinuto';
  END IF;
END $$;
DROP TABLE IF EXISTS "article_required_pairs";
DROP FUNCTION IF EXISTS "article_required_pairs_guard"();
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1793282400000; -- `when` iz _journal.json za 0056
COMMIT;
