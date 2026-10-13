/*
 * Povratni postupak za 0049_procurement_inquiry.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0049:
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f db/rollback/0049_procurement_inquiry.down.sql
 *
 * Briše odluke „samo upit za nabavku”. Vrednost `procurement` u tipu `price_request_kind` ostaje
 * (PostgreSQL ne briše vrednost enuma); postojeći upiti te vrste ostaju kao istorija.
 */
DROP VIEW IF EXISTS "articles_procurement_only";
DROP TABLE IF EXISTS "article_offer_decisions";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1792677600000; -- `when` iz _journal.json za 0049
