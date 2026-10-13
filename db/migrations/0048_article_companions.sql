/*
 * 0048 — Odgovarajući pribor koji se prodaje odvojeno (odluka vlasnika 2026-10-13).
 *
 * Posuda i njen poklopac, odnosno lak/filer i njegov učvršćivač (herter), su
 * zasebni artikli. Kada kupac izabere osnovni artikal, sajt mu u malom panelu
 * PREDLAŽE odgovarajući pribor; nikad ga ne dodaje sam.
 *
 * `article_companions` — potvrđena kompatibilnost artikal → pribor (npr.
 * posuda 400 ml → poklopac 400 ml; lak → herter iz tehničkog lista). Upisuje
 * je čovek uz dokaz; predlog važi dok `revoked_at` nije popunjen.
 * Herter: obavezan link na tehnički list proizvođača; odnos mešanja i njegova
 * osnova (zapremina ILI masa — nikad se ne izjednačavaju) samo kada ih list navodi.
 * Stanje zaliha se ovde NE čuva (izvor ne postoji) — vidi lib/ordering/companions.ts.
 * Samo dodavanje; ništa postojeće se ne menja.
 */
CREATE TABLE IF NOT EXISTS "article_companions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "article_id" uuid NOT NULL,
  "companion_article_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "evidence" text NOT NULL,
  "confirmed_by" uuid NOT NULL,
  "confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_reason" text,
  -- Herter: razlika među opcijama iz zvaničnih podataka (npr. „50-415 · brzi, VOC“) i izvor.
  "option_label" text,
  "source_url" text,
  -- Odnos mešanja osnova : pribor (npr. 100 : 50) i osnova odnosa; prazno kada izvor ne navodi osnovu.
  "ratio_base" numeric(8, 3),
  "ratio_companion" numeric(8, 3),
  "ratio_basis" text,
  CONSTRAINT "article_companions_kind_check" CHECK ("kind" IN ('poklopac', 'herter', 'kompatibilno')),
  CONSTRAINT "article_companions_source_check" CHECK ("kind" <> 'herter' OR length(btrim(coalesce("source_url", ''))) >= 10),
  CONSTRAINT "article_companions_ratio_check" CHECK (
    ("ratio_base" IS NULL AND "ratio_companion" IS NULL AND "ratio_basis" IS NULL)
    OR ("ratio_base" > 0 AND "ratio_companion" > 0 AND ("ratio_basis" IS NULL OR "ratio_basis" IN ('zapremina', 'masa')))
  ),
  CONSTRAINT "article_companions_self_check" CHECK ("article_id" <> "companion_article_id"),
  CONSTRAINT "article_companions_evidence_check" CHECK (length(btrim("evidence")) BETWEEN 5 AND 500),
  CONSTRAINT "article_companions_revoked_check" CHECK ("revoked_at" IS NULL OR length(btrim(coalesce("revoked_reason", ''))) >= 5),
  CONSTRAINT "article_companions_article_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE RESTRICT,
  CONSTRAINT "article_companions_companion_fk" FOREIGN KEY ("companion_article_id") REFERENCES "public"."articles"("id") ON DELETE RESTRICT,
  CONSTRAINT "article_companions_user_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "article_companions_active_key" ON "article_companions" ("article_id", "companion_article_id") WHERE "revoked_at" IS NULL;
