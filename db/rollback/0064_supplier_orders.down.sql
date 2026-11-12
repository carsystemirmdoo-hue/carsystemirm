/*
 * Povratni postupak za 0064_supplier_orders. Ručno, vlasnikom baze, posle povratka koda.
 * Upisane porudžbine i zapamćene šifre dobavljača su rad vlasnika: ako postoje, postupak staje.
 */
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM supplier_orders) OR EXISTS (SELECT 1 FROM supplier_article_codes) THEN
    RAISE EXCEPTION 'porudžbine ili zapamćene šifre dobavljača postoje — povratak 0064 bi ih brisao; prekinuto';
  END IF;
END $$;
DROP TABLE IF EXISTS "supplier_order_lines";
DROP TABLE IF EXISTS "supplier_orders";
DROP TABLE IF EXISTS "supplier_article_codes";
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794060000000; -- `when` za 0064
COMMIT;
