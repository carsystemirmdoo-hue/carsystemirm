/*
 * „Zapamti me" za kupce (predlog: docs/b2b/24-customer-remember-me-proposal.md).
 *
 * JWT i dalje traje 8 h za SVE naloge. Ovaj token služi samo da se kupcu, kada
 * sesija istekne, izda NOVA 8-časovna sesija — najduže 30 dana od prijave
 * lozinkom. U bazi je samo heš. Token nosi `session_version` iz trenutka
 * izdavanja: odjava sa svih uređaja, promena/reset lozinke i isključenje naloga
 * povećavaju verziju i time gase i sesije i sve zapamćene uređaje.
 *
 * Povratni postupak: `db/rollback/0031_customer_remember_me.down.sql`.
 */
CREATE TABLE IF NOT EXISTS "customer_remember_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "customer_users"("id") ON DELETE cascade,
  "family_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "session_version" integer NOT NULL,
  "device_label" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Rok porodice: prijava lozinkom + 30 dana. Rotacija ga NE produžava.
  "expires_at" timestamp with time zone NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "revoked_reason" text,
  "replaced_by" uuid REFERENCES "customer_remember_tokens"("id") ON DELETE set null,
  -- Jednokratna dozvola za izdavanje sesije posle provere tokena (60 s).
  "grant_hash" text,
  "grant_expires_at" timestamp with time zone,
  CONSTRAINT "customer_remember_tokens_revoked_reason"
    CHECK (("revoked_at" IS NULL) = ("revoked_reason" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_remember_tokens_hash_key" ON "customer_remember_tokens" ("token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_remember_tokens_grant_key" ON "customer_remember_tokens" ("grant_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_remember_tokens_account_idx" ON "customer_remember_tokens" ("account_id", "revoked_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_remember_tokens_family_idx" ON "customer_remember_tokens" ("family_id");
