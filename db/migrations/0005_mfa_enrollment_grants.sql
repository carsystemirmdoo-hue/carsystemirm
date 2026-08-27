-- Jednokratna dozvola za vezivanje drugog faktora.
--
-- Sama lozinka ne sme biti dovoljna da se authenticator veže: napadač sa
-- ukradenom lozinkom bi inače prvi vezao svoj uređaj i zaključao pravog
-- vlasnika napolju. Grant je ono što napadač nema — izdaje ga vlasnik van
-- sistema, važi 30 minuta i troši se jednom.
--
-- Aditivno: samo nova tabela.
CREATE TABLE IF NOT EXISTS "mfa_enrollment_grants" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_fingerprint" text NOT NULL,
  "key_version" integer NOT NULL,
  "issued_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "superseded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mfa_enrollment_grants_fingerprint_key"
  ON "mfa_enrollment_grants" ("code_fingerprint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mfa_enrollment_grants_user_idx"
  ON "mfa_enrollment_grants" ("user_id", "used_at");
