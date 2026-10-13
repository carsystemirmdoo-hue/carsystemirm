/*
 * Povratni postupak za 0050_stock_imports.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE povratka koda na verziju pre 0050:
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f db/rollback/0050_stock_imports.down.sql
 *
 * Briše otpremanja lagera i njihove stavke (samo podaci uvoza; fakture, artikli i
 * pakovanja se ne diraju).
 */
DROP TABLE IF EXISTS "stock_import_lines";
DROP TABLE IF EXISTS "stock_imports";
DROP FUNCTION IF EXISTS "stock_import_lines_append_only"();
DROP FUNCTION IF EXISTS "stock_imports_guard"();
DROP TYPE IF EXISTS "stock_import_status";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1792764000000; -- `when` iz _journal.json za 0050
