/*
 * Povratni postupak za 0046_order_notifications.
 *
 * NIJE deo lanca migracija. Postgres ne briše vrednost enuma; povratak briše
 * obaveštenja tih vrsta i ostavlja vrednosti neiskorišćene (bezopasno).
 * Posle povratka VRATITI i kod na verziju pre 0046.
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 \
 *     -f db/rollback/0046_order_notifications.down.sql
 */
DELETE FROM "notifications" WHERE "kind" IN ('customer_order_submitted', 'customer_price_request_submitted');
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1792418400000; -- `when` iz _journal.json za 0046
