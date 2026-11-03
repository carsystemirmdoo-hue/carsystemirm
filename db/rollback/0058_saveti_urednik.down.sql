/*
 * Povratni postupak za 0058_saveti_urednik.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0058:
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f db/rollback/0058_saveti_urednik.down.sql
 *
 * Briše SVE tekstove, verzije, istoriju i slike rubrike iz baze. Pre toga napraviti kopiju baze;
 * tekstovi uvezeni iz repozitorijuma ostaju u content/saveti, ali izmene iz panela ne.
 */
BEGIN;
DROP TABLE IF EXISTS "saveti_adrese";
DROP TABLE IF EXISTS "saveti_objave";
DROP TABLE IF EXISTS "saveti_zakazivanja";
DROP TABLE IF EXISTS "saveti_dogadjaji";
ALTER TABLE IF EXISTS "saveti_clanci" DROP CONSTRAINT IF EXISTS "saveti_clanci_javna_verzija_fk";
DROP TABLE IF EXISTS "saveti_verzije";
DROP TABLE IF EXISTS "saveti_clanci";
DROP TABLE IF EXISTS "saveti_slike";
DROP FUNCTION IF EXISTS "saveti_samo_dodavanje"();
DROP FUNCTION IF EXISTS "saveti_zakazivanja_guard"();
DROP FUNCTION IF EXISTS "saveti_clanci_guard"();
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1793455200000; -- `when` iz _journal.json za 0058
COMMIT;
