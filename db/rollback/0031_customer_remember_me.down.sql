/*
 * Povratni postupak za 0031_customer_remember_me. Ručno, vlasnikom baze, u jednoj transakciji.
 * Posle povratka svi zapamćeni uređaji prestaju da važe (kupci se prijavljuju lozinkom).
 */
DROP TABLE IF EXISTS "customer_remember_tokens";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1787588098289; -- `when` iz _journal.json za 0031
