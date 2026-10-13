/*
 * 0049 — Upit za nabavku (odluka vlasnika 2026-10-13).
 *
 * Artikal ili proizvod koji trenutno ne prodajemo (nije na lageru, nije uvožen, ponuda se tek proverava)
 * ostaje vidljiv u katalogu, ali se NE dodaje u korpu: kupac šalje upit za nabavku. Upit za nabavku
 * se razlikuje od upita za cenu (`no_price`) i od porudžbine potvrđene ponude.
 *
 *   1. `price_request_kind` dobija vrednost `procurement` (isti tok upita: broj U-…, odgovor kancelarije).
 *   2. `article_offer_decisions` — odluka da se artikal nudi samo kroz upit za nabavku; zapisi se samo
 *      dodaju, važi poslednji po artiklu. Bez odluke važi dosadašnje pravilo (pakovanje + cena).
 * Samo dodavanje; ništa postojeće se ne menja.
 */
ALTER TYPE "price_request_kind" ADD VALUE IF NOT EXISTS 'procurement';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "article_offer_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE RESTRICT,
  "procurement_only" boolean NOT NULL,
  "reason" text NOT NULL,
  "source_batch" text,
  "decided_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "article_offer_decisions_reason_check" CHECK (length(btrim("reason")) BETWEEN 5 AND 500)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_offer_decisions_latest_idx" ON "article_offer_decisions" ("article_id", "decided_at" DESC, "id");
--> statement-breakpoint
CREATE TRIGGER "article_offer_decisions_append_only_trg" BEFORE UPDATE OR DELETE ON "article_offer_decisions"
  FOR EACH ROW EXECUTE FUNCTION "base_prices_append_only"();
--> statement-breakpoint
CREATE OR REPLACE VIEW "articles_procurement_only" AS
SELECT x.article_id, x.reason, x.decided_at
  FROM (
    SELECT DISTINCT ON (d.article_id) d.article_id, d.procurement_only, d.reason, d.decided_at
      FROM "article_offer_decisions" d
     ORDER BY d.article_id, d.decided_at DESC, d.id DESC
  ) x
 WHERE x.procurement_only;
