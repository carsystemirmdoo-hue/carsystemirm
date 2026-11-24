/*
 * Povratni postupak za 0066_vp_cenovnik_priprema. Ručno, vlasnikom baze, posle povratka koda.
 * Pripreme cenovnika su rad menadžera prodaje i kancelarije: ako postoje, postupak staje.
 * Otpremanja koja je priprema napravila (`price_list_imports`) ostaju — to su obična otpremanja.
 * Vrednost enuma `price_list_stage` ostaje (Postgres ne briše vrednost enuma); obaveštenja te vrste se brišu.
 */
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM price_list_drafts) THEN
    RAISE EXCEPTION 'pripreme cenovnika postoje — povratak 0066 bi ih brisao; prekinuto';
  END IF;
  IF EXISTS (SELECT 1 FROM user_permissions WHERE permission_key = 'cenovnik_priprema') THEN
    RAISE EXCEPTION 'paket cenovnik_priprema je dodeljen — prvo ga oduzmite u Korisnici i dozvole; prekinuto';
  END IF;
END $$;
DELETE FROM notifications WHERE kind::text = 'price_list_stage';
DROP TABLE IF EXISTS "price_list_draft_rows";
DROP TABLE IF EXISTS "price_list_drafts";
DELETE FROM permission_packages WHERE key = 'cenovnik_priprema';
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794232800000; -- `when` za 0066
COMMIT;
