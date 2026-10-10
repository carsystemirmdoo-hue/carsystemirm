/*
 * 0041 — Promena postojećeg rabata bez sukoba i bez duplikata.
 *
 * replaces_rule_id: predlog koji MENJA važeće pravilo istog opsega. Pri
 *   odobrenju se staro pravilo zatvara (effective_to = početak novog − 1 dan),
 *   pa u svakom trenutku važi tačno jedno pravilo, a istorija ostaje cela.
 *   Bez ovoga bi odobrena promena napravila dva aktivna pravila iste klase —
 *   sukob — i kupac bi dobio „cenu na upit“.
 *
 * price_rules_one_pending_per_scope: za isti opseg (klasa + ključ) najviše
 *   jedan predlog čeka odluku. Ponovljeno slanje istog predloga se odbija.
 */
ALTER TABLE "price_rules" ADD COLUMN "replaces_rule_id" uuid REFERENCES "price_rules"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX "price_rules_one_pending_per_scope" ON "price_rules" ("precedence_level", "scope_key")
  WHERE "status" IN ('draft', 'pending_approval');
