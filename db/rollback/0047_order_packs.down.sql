/*
 * Povratni postupak za 0047_order_packs.
 *
 * NIJE deo lanca migracija. Pokreće se ručno, vlasnikom baze, tek POSLE
 * povratka koda na verziju pre 0047:
 *
 *   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 \
 *     -f db/rollback/0047_order_packs.down.sql
 *
 * Briše potvrđene količine pakovanja i broj pakovanja na stavkama (obračunska
 * količina `quantity` ostaje).
 */
ALTER TABLE "customer_order_lines" DROP COLUMN IF EXISTS "pack_quantity";
ALTER TABLE "customer_order_lines" DROP COLUMN IF EXISTS "pack_count";
ALTER TABLE "customer_cart_items" DROP CONSTRAINT IF EXISTS "customer_cart_items_pack_count_check";
ALTER TABLE "customer_cart_items" DROP COLUMN IF EXISTS "pack_count";
DROP TABLE IF EXISTS "article_pack_sizes";
DELETE FROM drizzle.__drizzle_migrations
 WHERE created_at = 1792504800000; -- `when` iz _journal.json za 0047
