/*
 * Povratni postupak za 0032_recompute_after_ingest. Ručno, vlasnikom baze, u jednoj transakciji.
 * Vrednost `ingest` u `recommendation_trigger` Postgres ne ume da ukloni; prolazi sa njom ostaju
 * kao istorija. Posle povratka obračun je ponovo samo ručan.
 */
DROP TABLE IF EXISTS "recommendation_recompute_requests";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1787588098290; -- `when` iz _journal.json za 0032
