/*
 * Povratni postupak za 0055_article_sales_names_sellout.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0055.
 * Ako tabele imaju zapise, postupak staje (odluke se ne brišu).
 */
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM article_sales_names) OR EXISTS (SELECT 1 FROM article_sellout) THEN
    RAISE EXCEPTION 'prodajni nazivi ili rasprodaje imaju zapise — povratak 0055 bi brisao odluke; prekinuto';
  END IF;
END $$;
DROP TABLE IF EXISTS "article_sellout";
DROP TABLE IF EXISTS "article_sales_names";
DROP FUNCTION IF EXISTS "article_sellout_guard"();
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1793196000000; -- `when` iz _journal.json za 0055
COMMIT;
