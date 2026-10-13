/*
 * Povratni postupak za 0048_article_companions.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE
 * povratka koda na verziju pre 0048:
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 \
 *     -f db/rollback/0048_article_companions.down.sql
 *
 * Briše potvrđene parove artikal → pribor (predlog poklopca nestaje; korpe i zahtevi ostaju).
 */
DROP TABLE IF EXISTS "article_companions";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1792591200000; -- `when` iz _journal.json za 0048
