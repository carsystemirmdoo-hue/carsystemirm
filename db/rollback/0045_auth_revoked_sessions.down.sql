/*
 * Povratni postupak za 0045_auth_revoked_sessions.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze:
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 \
 *     -f db/rollback/0045_auth_revoked_sessions.down.sql
 *
 * Posle povratka VRATITI i kod na verziju pre 0045: kod bez tabele ne može da
 * proveri opoziv i odbija svaku sesiju (fail-closed).
 */
DROP TABLE IF EXISTS "auth_revoked_sessions";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1792332000000; -- `when` iz _journal.json za 0045
