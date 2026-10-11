/*
 * 0045 — Opozvane pojedinačne sesije (revizija 2026-10-11, B8).
 *
 * Odjava je samo brisala kolačić; kopiran JWT je važio do isteka. Sada svaka
 * prijava nosi `sid`, odjava ga upisuje ovde, a serverska kapija takav token
 * odbija. Zapis traje do apsolutnog isteka tokena (`expires_at`).
 * Tabela nema stranih ključeva: `subject_id` je nalog zaposlenog ILI kupca.
 */
CREATE TABLE IF NOT EXISTS "auth_revoked_sessions" (
  "sid" uuid PRIMARY KEY,
  "subject" text NOT NULL,
  "subject_id" uuid NOT NULL,
  "revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "auth_revoked_sessions_subject_check" CHECK ("subject" IN ('internal', 'customer')),
  CONSTRAINT "auth_revoked_sessions_expiry_check" CHECK ("expires_at" > "revoked_at" - interval '1 day')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_revoked_sessions_expires_idx" ON "auth_revoked_sessions" ("expires_at");
