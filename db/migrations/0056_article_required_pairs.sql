/*
 * Obavezan par artikala u jednakoj količini (0056; odluka vlasnika 16. 10. 2026).
 *
 * Blanko posude i poklopci su odvojeni artikli, ali se prodaju SAMO u paru: broj poklopaca mora biti
 * tačno jednak zbiru posuda koje taj poklopac zatvara (1:1, u JM — oba su 1 KOM po pakovanju).
 * Pravilo se sprovodi na serveru: korpa automatski usklađuje poklopce sa posudama, ručna izmena
 * poklopca se odbija, a slanje zahteva i izmenjen predlog kancelarije se odbijaju ako par nije
 * jednak. Predlog pribora (`article_companions`) ostaje kakav jeste; ovo je posebno, obavezno pravilo.
 * Zapis se ne briše; povlačenje je `revoked_at` sa razlogom.
 */
CREATE TABLE IF NOT EXISTS "article_required_pairs" (
  "article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE RESTRICT,
  "companion_article_id" uuid NOT NULL REFERENCES "articles"("id") ON DELETE RESTRICT,
  "evidence" text NOT NULL,
  "decided_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at" timestamp with time zone,
  "revoked_reason" text,
  CONSTRAINT "article_required_pairs_pkey" PRIMARY KEY ("article_id", "companion_article_id"),
  CONSTRAINT "article_required_pairs_self_check" CHECK ("article_id" <> "companion_article_id"),
  CONSTRAINT "article_required_pairs_text_check" CHECK (
    length(btrim("evidence")) BETWEEN 5 AND 1000 AND
    ("revoked_at" IS NULL OR length(btrim(coalesce("revoked_reason", ''))) >= 5)
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_required_pairs_companion_idx" ON "article_required_pairs" ("companion_article_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "article_required_pairs_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'obavezan par se ne briše (povlačenje: revoked_at)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW."article_id", NEW."companion_article_id", NEW."evidence", NEW."decided_by", NEW."decided_at") IS DISTINCT FROM
     (OLD."article_id", OLD."companion_article_id", OLD."evidence", OLD."decided_by", OLD."decided_at")
     OR OLD."revoked_at" IS NOT NULL THEN
    RAISE EXCEPTION 'obavezan par se samo povlači, jednom' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "article_required_pairs_guard" ON "article_required_pairs";
--> statement-breakpoint
CREATE TRIGGER "article_required_pairs_guard" BEFORE UPDATE OR DELETE ON "article_required_pairs" FOR EACH ROW EXECUTE FUNCTION "article_required_pairs_guard"();
