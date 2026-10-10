/*
 * 0042 — Poseban poslovni status kupca i rabat uslovljen plaćanjem.
 *
 * customer_commercial_status_decisions — odluke se samo dodaju; važi poslednja.
 *   van_pripreme_portala: istorija ostaje, ali kupac se ne priprema za portal
 *     (nema naloga, nema automatskog formiranja cena) — npr. fakturisanje za treće.
 *   kompenzacija: uslovi zavise od međusobnog prebijanja — samo ručni pregled.
 *   retka_saradnja: novi uslovi ostaju prazni, nalog se ne priprema.
 *   uslovi_placanja: rabat zavisi od roka/načina plaćanja — uslovi odvojeno, za potvrdu.
 *   poseban_dogovor: individualni dogovor — ručni pregled.
 *   redovan: povratak u redovan tok.
 *   Iz uslova ovih kupaca se ništa ne izvodi za druge kupce.
 *
 * price_rules.payment_condition — NULL = važi bez uslova. 'kratak_rok' = važi
 *   SAMO kada je taj uslov izabran i ispunjen; nikad podrazumevano. Uslov je deo
 *   opsega (scope_key), pa uslovno i bezuslovno pravilo istog artikla nisu sukob,
 *   a zamena i „jedan predlog na čekanju“ važe po uslovu.
 */
CREATE TABLE "customer_commercial_status_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "status" text NOT NULL,
  "reason" text NOT NULL,
  "decided_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_commercial_status_check" CHECK ("status" IN ('redovan', 'van_pripreme_portala', 'kompenzacija', 'retka_saradnja', 'uslovi_placanja', 'poseban_dogovor')),
  CONSTRAINT "customer_commercial_status_reason_check" CHECK (length(btrim("reason")) BETWEEN 5 AND 500)
);
--> statement-breakpoint
CREATE INDEX "customer_commercial_status_latest_idx" ON "customer_commercial_status_decisions" ("customer_id", "decided_at" DESC, "id");
--> statement-breakpoint
CREATE TRIGGER "customer_commercial_status_append_only_trg" BEFORE UPDATE OR DELETE ON "customer_commercial_status_decisions"
  FOR EACH ROW EXECUTE FUNCTION "base_prices_append_only"();
--> statement-breakpoint
CREATE VIEW "customer_commercial_status" AS
SELECT DISTINCT ON (d.customer_id) d.customer_id, d.status, d.reason, d.decided_at
  FROM "customer_commercial_status_decisions" d
 ORDER BY d.customer_id, d.decided_at DESC, d.id DESC;
--> statement-breakpoint
ALTER TABLE "price_rules" ADD COLUMN "payment_condition" text;
--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_payment_condition_check" CHECK ("payment_condition" IS NULL OR "payment_condition" IN ('kratak_rok'));
