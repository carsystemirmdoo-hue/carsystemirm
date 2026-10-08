/*
 * Povratni postupak za 0030_catalog_buying. Ručno, vlasnikom baze, u jednoj transakciji.
 *
 * Vrednost enum-a `superseded` Postgres ne ume da ukloni; pre povratka zahteve u
 * tom stanju prevesti u `cancelled` (istorija ostaje u customer_order_events).
 */
UPDATE "customer_orders" SET "status" = 'cancelled' WHERE "status"::text = 'superseded';
DROP TABLE IF EXISTS "customer_price_requests";
DROP SEQUENCE IF EXISTS "customer_price_request_seq";
DROP TYPE IF EXISTS "price_request_status";
DROP TYPE IF EXISTS "price_request_kind";
ALTER TABLE "customer_cart_items" DROP COLUMN IF EXISTS "source_order_id";
DROP INDEX IF EXISTS "customer_orders_replaces_key";
ALTER TABLE "customer_orders" DROP COLUMN IF EXISTS "replaces_order_id";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1787588098288; -- `when` iz _journal.json za 0030
