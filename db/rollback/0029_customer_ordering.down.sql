/*
 * Povratni postupak za 0029_customer_ordering.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, u jednoj transakciji:
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 \
 *     -f db/rollback/0029_customer_ordering.down.sql
 *
 * Šta se gubi: cenovnici, korpe, zahtevi i porudžbine sa istorijom statusa.
 * Pre povratka ih izvesti. Posle povratka vratiti i kod na verziju pre 0029.
 */
DROP TABLE IF EXISTS "customer_order_events";
DROP TABLE IF EXISTS "customer_order_lines";
DROP TABLE IF EXISTS "customer_orders";
DROP TABLE IF EXISTS "customer_cart_items";
DROP TABLE IF EXISTS "price_list_customer_terms";
DROP TABLE IF EXISTS "price_list_items";
DROP TABLE IF EXISTS "price_lists";
DROP SEQUENCE IF EXISTS "customer_order_request_seq";
DROP SEQUENCE IF EXISTS "customer_order_number_seq";
DROP TYPE IF EXISTS "customer_order_status";
DROP TYPE IF EXISTS "price_list_status";
DROP TYPE IF EXISTS "price_list_kind";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1787588098287; -- `when` iz _journal.json za 0029
