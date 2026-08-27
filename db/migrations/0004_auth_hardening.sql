-- Faza 1B: MFA, trajni rate limiting, recovery kodovi i reset lozinke.
--
-- Migracija je ADITIVNA: samo dodaje tabele. Nijedan postojeći red se ne menja
-- ni ne briše, pa se postojeći nalozi nastavljaju bez ijedne izmene i bez
-- odjavljivanja.

-- Brojači pokušaja. U bazi, ne u memoriji: serverless instance ne dele memoriju,
-- pa bi `Map` u modulu davao napadaču onoliko pokušaja koliko ima instanci.
CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "scope" text NOT NULL,
  "dimension" text NOT NULL,
  -- HMAC identifikatora, nikad sirova IP adresa ni e-pošta.
  "subject_key" text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Blokada je uvek privremena; trajna bi dozvolila napadaču da isključi tuđi nalog.
  "blocked_until" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_rate_limits_key"
  ON "auth_rate_limits" ("scope", "dimension", "subject_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_rate_limits_window_idx"
  ON "auth_rate_limits" ("window_started_at");
--> statement-breakpoint

-- TOTP stanje. Tajna isključivo šifrovana (AES-256-GCM); u zasebnoj tabeli da
-- uobičajeni upiti nad korisnicima nikad ne dodiruju šifrovani materijal.
CREATE TABLE IF NOT EXISTS "user_mfa" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "secret_ciphertext" text,
  "secret_iv" text,
  "secret_auth_tag" text,
  "secret_key_version" integer,
  "enrolled_at" timestamp with time zone,
  -- Poslednji prihvaćeni TOTP prozor: brava protiv ponovne upotrebe istog koda.
  "last_accepted_counter" integer,
  "pending_ciphertext" text,
  "pending_iv" text,
  "pending_auth_tag" text,
  "pending_key_version" integer,
  "pending_expires_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Jednokratni recovery kodovi; čuva se samo HMAC otisak.
CREATE TABLE IF NOT EXISTS "mfa_recovery_codes" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_fingerprint" text NOT NULL,
  "key_version" integer NOT NULL,
  "batch" integer DEFAULT 1 NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mfa_recovery_codes_fingerprint_key"
  ON "mfa_recovery_codes" ("user_id", "code_fingerprint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mfa_recovery_codes_user_idx"
  ON "mfa_recovery_codes" ("user_id", "used_at");
--> statement-breakpoint

-- Administratorski reset lozinke, bez slanja e-pošte.
CREATE TABLE IF NOT EXISTS "password_reset_codes" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_codes_fingerprint_key"
  ON "password_reset_codes" ("code_fingerprint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_codes_user_idx"
  ON "password_reset_codes" ("user_id", "used_at");
