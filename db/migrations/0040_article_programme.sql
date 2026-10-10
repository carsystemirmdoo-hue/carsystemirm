/*
 * 0040 — Program artikla: da li je artikal u aktuelnoj ponudi.
 *
 * Prisustvo šifre u lageru, cenovniku ili staroj fakturi NIJE odluka da je
 * artikal u ponudi. Artikal van programa (npr. 3M, sia, Molotow) zadržava
 * celu istoriju (fakture, osnovne cene, pravila), ali ne dobija cenu kupca,
 * ne poručuje se, ne preporučuje i ne ulazi u predloge rabata.
 *
 * article_programme_decisions — odluke se samo dodaju; važi poslednja po artiklu.
 * Artikal bez odluke je u programu (dosadašnje ponašanje).
 */
CREATE TABLE "article_programme_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE RESTRICT,
  "in_programme" boolean NOT NULL,
  "reason" text NOT NULL,
  "source_batch" text,
  "decided_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "article_programme_decisions_reason_check" CHECK (length(btrim("reason")) BETWEEN 5 AND 500)
);
--> statement-breakpoint
CREATE INDEX "article_programme_decisions_latest_idx" ON "article_programme_decisions" ("article_id", "decided_at" DESC, "id");
--> statement-breakpoint
CREATE TRIGGER "article_programme_decisions_append_only_trg" BEFORE UPDATE OR DELETE ON "article_programme_decisions"
  FOR EACH ROW EXECUTE FUNCTION "base_prices_append_only"();
--> statement-breakpoint
CREATE VIEW "articles_out_of_programme" AS
SELECT x.article_id, x.reason, x.decided_at, x.source_batch
  FROM (
    SELECT DISTINCT ON (d.article_id) d.article_id, d.in_programme, d.reason, d.decided_at, d.source_batch
      FROM "article_programme_decisions" d
     ORDER BY d.article_id, d.decided_at DESC, d.id DESC
  ) x
 WHERE NOT x.in_programme;
