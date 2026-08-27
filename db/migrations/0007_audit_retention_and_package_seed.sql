/*
 * Dve ispravke koje je otkrio prvi prolaz nad pravim PostgreSQL-om.
 *
 * Migracija je forward-only i idempotentna: radi i na praznoj bazi i na onoj
 * koja već ima 0001–0006, i sme se pokrenuti više puta.
 */

/* =========================================================================
 * 1. Trag revizije se ne menja ni pri brisanju korisnika
 *
 * Zatečeno stanje je bilo protivrečno samo sebi. `audit_log.actor_user_id` je
 * imao `ON DELETE SET NULL`, a nad istom tabelom stoji okidač koji zabranjuje
 * `UPDATE`. Brisanje korisnika je zato pokretalo izmenu koju okidač odbija —
 * i brisanje je padalo uz poruku koja izgleda kao greška okidača, iako je
 * problem u modelu podataka.
 *
 * Odluka: trag je nepromenljiv, pa se korisnik koji u njemu figurira NE BRIŠE.
 * `RESTRICT` to čini izričitim — baza odbija brisanje umesto da tiho pokuša
 * izmenu istorije. Za prestanak rada postoje deaktivacija i reaktivacija.
 *
 * Uklanjanje ličnih podataka, ako ikad zatreba, ide zasebnim kontrolisanim
 * postupkom anonimizacije koji i sam ostavlja trag — nikad brisanjem identiteta
 * iz istorije.
 * ====================================================================== */

ALTER TABLE "audit_log"
  DROP CONSTRAINT IF EXISTS "audit_log_actor_user_id_users_id_fk";
--> statement-breakpoint

ALTER TABLE "audit_log"
  ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint

/*
 * `system_settings.updated_by` je isti obrazac, ali bez okidača nad tabelom.
 * Ipak se poravnava: „ko je promenio prag" je podatak koji ne sme da ispari
 * brisanjem naloga.
 */
ALTER TABLE "system_settings"
  DROP CONSTRAINT IF EXISTS "system_settings_updated_by_users_id_fk";
--> statement-breakpoint

ALTER TABLE "system_settings"
  ADD CONSTRAINT "system_settings_updated_by_users_id_fk"
  FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint

/* =========================================================================
 * 2. Svi paketi dozvola postoje na svežoj instalaciji
 *
 * `user_permissions.permission_key` ima strani ključ ka `permission_packages`.
 * Do sada je tu tabelu punio isključivo `db/seed.mjs`, koji nije deo migracija —
 * pa je sveža instalacija imala capability model koji očekuje pakete, i praznu
 * tabelu koja ih nema. Svaka dodela je padala na strani ključ.
 *
 * Lista je kanonska kopija `PERMISSION_PACKAGES` iz `lib/authz/permissions.mjs`.
 * Test `permissionPackages.integration` poredi to dvoje, pa razilaženje ne može
 * proći neprimećeno.
 *
 * `ON CONFLICT DO UPDATE` osvežava naziv i opis, ali NE dira `sort_order` ako
 * ga je neko ručno menjao, i ne briše pakete koji nisu na listi.
 * ====================================================================== */

INSERT INTO "permission_packages" ("key", "name", "description", "sort_order")
VALUES
  ('analitika', 'Napredna analitika i izveštaji',
   'Prodaja po danima, mesecima i godinama, poređenja, drill-down, izvoz i sačuvani filteri', '0'),
  ('otprema', 'Otprema i BEX pošiljke',
   'Kreiranje pošiljaka, bulk obrada, adresnice i štampa', '1'),
  ('nabavka_predlog', 'Predlog nabavke (bez poručivanja)',
   'Pregled i priprema predloga, bez potvrde količina', '2'),
  ('porucivanje', 'Poručivanje robe',
   'Potvrda konačnih količina i kreiranje porudžbine', '3'),
  ('limiti', 'Kreditni limiti',
   'Potvrda i izmena limita', '4'),
  ('korisnici', 'Korisnici i dozvole',
   'Dodela uloga i individualnih dozvola', '5'),
  ('bezbednost_naloga', 'Bezbednost naloga',
   'Reset lozinke i drugog faktora, dozvole za vezivanje, isključivanje naloga', '6'),
  ('pragovi', 'Sistemska pravila i pragovi',
   'Izmena pragova upozorenja', '7'),
  ('zatvaranje', 'Globalno zatvaranje upozorenja',
   'Zatvaranje ozbiljnih upozorenja za sve korisnike', '8')
ON CONFLICT ("key") DO UPDATE
  SET "name" = EXCLUDED."name",
      "description" = EXCLUDED."description";
