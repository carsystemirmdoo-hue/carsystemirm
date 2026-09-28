/*
 * Povratni postupak za 0028_partner_registry_contact_verification.
 *
 * NIJE deo lanca migracija (drizzle čita samo `db/migrations`). Pokreće se
 * ručno, vlasnikom baze (MIGRATION_DATABASE_URL), u jednoj transakciji:
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 \
 *     -f db/rollback/0028_partner_registry_contact_verification.down.sql
 *
 * Posle povratka, VRATITI i kod na verziju pre 0028 — kod iz ove grane traži
 * tabelu potvrda i bez nje odbija svaki poziv (fail-closed, ne otvara pristup).
 *
 * Šta se gubi: snimci uvoza partnera (mogu se ponovo uvesti iz izvornog fajla)
 * i zapisi potvrda osoba. Potvrde su dokaz — pre povratka ih izvesti:
 *
 *   \copy (SELECT * FROM customer_contact_verifications) TO 'potvrde-0028.csv' CSV HEADER
 *
 * Trag revizije (`audit_log`) se NE dira: zapisi o potvrdama, opozivima i
 * dodelama ostaju.
 *
 * Proveren nad QA bazom: up → down → up daje istu šemu (vidi
 * docs/b2b/23-partner-registry-and-account-verification.md §9).
 */

DROP TRIGGER IF EXISTS "customer_contact_verifications_guard_trg" ON "customer_contact_verifications";
DROP FUNCTION IF EXISTS "customer_contact_verifications_guard"();
DROP TABLE IF EXISTS "customer_contact_verifications";
DROP INDEX IF EXISTS "customer_users_id_customer_key";
DROP TYPE IF EXISTS "contact_source";
DROP TYPE IF EXISTS "contact_verification_method";

DROP VIEW IF EXISTS "current_partner_records";
DROP TABLE IF EXISTS "partner_records";
DROP TABLE IF EXISTS "partner_imports";
DROP TYPE IF EXISTS "partner_classification";
DROP TYPE IF EXISTS "partner_pib_status";

ALTER TABLE "customer_assignments" DROP CONSTRAINT IF EXISTS "customer_assignments_basis_ck";
ALTER TABLE "customer_assignments" DROP COLUMN IF EXISTS "basis";

/*
 * Drizzle beleži primenjenu migraciju sa `created_at` = `when` iz journala.
 * Bez brisanja tog reda ponovno pokretanje bi 0028 smatralo primenjenom.
 * Briše se TAČNO taj red, ne „poslednji" — kasnija migracija ne sme stradati.
 */
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1787588098286; -- `when` iz _journal.json za 0028; drizzle ga upisuje kao created_at
