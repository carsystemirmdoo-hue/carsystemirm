/*
 * Registar BizniSoft partnera, potvrda ovlašćene osobe i poreklo dodele.
 *
 * Tri stvari, sve aditivne i idempotentne:
 *
 *   1. `partner_imports` + `partner_records` — snimak matičnih podataka
 *      partnera po uvozu. Snimak, ne tekuće stanje: promena naziva, PIB-a ili
 *      komercijaliste između dva uvoza mora ostati vidljiva. Registar NIJE
 *      spisak kupaca i ništa odavde ne otvara pristup.
 *
 *   2. `customer_contact_verifications` — zapis da je čovek potvrdio da osoba
 *      koja kontroliše adresu e-pošte sme da vidi podatke firme. Poziv se bez
 *      žive potvrde ne izdaje (`lib/customers/contactVerification.mjs`).
 *
 *   3. `customer_assignments.basis` — zašto je komercijalista dodeljen
 *      (ručno ili iz BizniSoft šifre komercijaliste).
 *
 * Povratni postupak: `db/rollback/0028_partner_registry_contact_verification.down.sql`.
 */

/* =========================================================================
 * 1. Registar partnera
 * ====================================================================== */

DO $$ BEGIN
  CREATE TYPE "partner_pib_status" AS ENUM ('valid', 'invalid_checksum', 'nonstandard', 'missing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "partner_classification" AS ENUM ('rep_assigned_candidate', 'needs_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "partner_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_system" text NOT NULL,
  "issuer_code" text NOT NULL,
  "profile" text NOT NULL,
  "file_name" text NOT NULL,
  "file_sha256" text NOT NULL,
  "partner_count" integer NOT NULL,
  "summary" jsonb NOT NULL,
  "imported_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "imported_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "partner_imports_sha_ck" CHECK ("file_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint

/* Isti fajl istog izdavaoca se ne uvozi dvaput. */
CREATE UNIQUE INDEX IF NOT EXISTS "partner_imports_file_key"
  ON "partner_imports" ("source_system", "issuer_code", "file_sha256");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "partner_imports_latest_idx"
  ON "partner_imports" ("source_system", "issuer_code", "imported_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "partner_records" (
  "import_id" uuid NOT NULL REFERENCES "partner_imports"("id") ON DELETE CASCADE,
  /* Tekst, sa vodećim nulama — "0012" i "12" su različiti partneri. */
  "partner_code" text NOT NULL,
  "name" text NOT NULL,
  "pib" text,
  "pib_status" "partner_pib_status" NOT NULL,
  "city" text,
  "address" text,
  /* Kako stoji u izvoru. NIJE ovlašćeni kontakt i ne otvara nalog. */
  "email_raw" text,
  "emails" text[] DEFAULT '{}'::text[] NOT NULL,
  "phone_raw" text,
  "rep_code" text,
  "active_in_source" boolean,
  "classification" "partner_classification" NOT NULL,
  "source_sheet" text NOT NULL,
  "source_row" integer NOT NULL,
  CONSTRAINT "partner_records_pkey" PRIMARY KEY ("import_id", "partner_code"),
  CONSTRAINT "partner_records_pib_ck" CHECK (
    ("pib_status" = 'missing' AND "pib" IS NULL)
    OR ("pib_status" <> 'missing' AND "pib" IS NOT NULL)
  ),
  CONSTRAINT "partner_records_class_ck" CHECK (
    ("classification" = 'rep_assigned_candidate') = ("rep_code" IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "partner_records_pib_idx" ON "partner_records" ("pib");
--> statement-breakpoint

/*
 * Poslednji uvoz po (izvor, izdavalac). Portal i plan dodela čitaju odavde,
 * da stari snimak ne bi tiho važio posle novog uvoza.
 */
CREATE OR REPLACE VIEW "current_partner_records" AS
SELECT r.*, i.source_system, i.issuer_code, i.imported_at
  FROM partner_records r
  JOIN partner_imports i ON i.id = r.import_id
 WHERE i.id = (
   SELECT i2.id FROM partner_imports i2
    WHERE i2.source_system = i.source_system AND i2.issuer_code = i.issuer_code
    ORDER BY i2.imported_at DESC, i2.id DESC
    LIMIT 1
 );
--> statement-breakpoint

COMMENT ON TABLE "partner_records" IS
  'Snimak BizniSoft kartice partnera po uvozu. Nije spisak kupaca; e-mail nije ovlascen kontakt.';
--> statement-breakpoint

/* =========================================================================
 * 2. Potvrda ovlašćene osobe
 * ====================================================================== */

DO $$ BEGIN
  CREATE TYPE "contact_verification_method" AS ENUM ('callback_known_number', 'signed_authorization', 'in_person');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "contact_source" AS ENUM (
    'biznisoft_partner_record', 'provided_by_company', 'provided_by_sales_rep', 'public_business_listing'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Cilj za složeni strani ključ ispod: potvrda mora pripadati nalogu I firmi
 * tog naloga. Aplikacija to proverava, a baza ne dozvoljava da bude drugačije.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "customer_users_id_customer_key"
  ON "customer_users" ("id", "customer_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_contact_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_user_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  /* Šifra partnera kojom je firma identifikovana u trenutku potvrde. */
  "basis_identifier_id" uuid NOT NULL
    REFERENCES "customer_external_identifiers"("id") ON DELETE RESTRICT,
  /* Adresa za koju potvrda važi — promena adrese traži novu potvrdu. */
  "verified_email" text NOT NULL,
  "person_role" text NOT NULL,
  "method" "contact_verification_method" NOT NULL,
  "contact_source" "contact_source" NOT NULL,
  "source_reference" text,
  "evidence_note" text NOT NULL,
  "verified_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "verified_at" timestamptz DEFAULT now() NOT NULL,
  "revoked_at" timestamptz,
  "revoked_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "revoke_reason" text,
  CONSTRAINT "customer_contact_verifications_account_fk"
    FOREIGN KEY ("customer_user_id", "customer_id")
    REFERENCES "customer_users" ("id", "customer_id") ON DELETE RESTRICT,
  CONSTRAINT "customer_contact_verifications_email_ck"
    CHECK ("verified_email" = lower(btrim("verified_email"))),
  CONSTRAINT "customer_contact_verifications_evidence_ck"
    CHECK (length(btrim("evidence_note")) >= 15),
  CONSTRAINT "customer_contact_verifications_role_ck"
    CHECK (length(btrim("person_role")) >= 2),
  CONSTRAINT "customer_contact_verifications_public_source_ck"
    CHECK ("contact_source" <> 'public_business_listing' OR "source_reference" ~ '^https?://\S+$'),
  CONSTRAINT "customer_contact_verifications_revoke_ck" CHECK (
    ("revoked_at" IS NULL AND "revoked_by" IS NULL AND "revoke_reason" IS NULL)
    OR ("revoked_at" IS NOT NULL AND "revoked_by" IS NOT NULL AND length(btrim("revoke_reason")) >= 3)
  )
);
--> statement-breakpoint

/* Najviše jedna živa potvrda po nalogu; opozvane ostaju kao istorija. */
CREATE UNIQUE INDEX IF NOT EXISTS "customer_contact_verifications_live_key"
  ON "customer_contact_verifications" ("customer_user_id")
  WHERE "revoked_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "customer_contact_verifications_customer_idx"
  ON "customer_contact_verifications" ("customer_id");
--> statement-breakpoint

/*
 * Potvrda se ne briše i njen sadržaj se ne menja. Jedina dozvoljena izmena je
 * opoziv — jednom, i samo popunjavanjem kolona opoziva.
 */
CREATE OR REPLACE FUNCTION "customer_contact_verifications_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'customer_contact_verifications je samo za dodavanje; opoziv umesto brisanja'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'opozvana potvrda se ne menja' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW.id, NEW.customer_user_id, NEW.customer_id, NEW.basis_identifier_id, NEW.verified_email,
      NEW.person_role, NEW.method, NEW.contact_source, NEW.source_reference, NEW.evidence_note,
      NEW.verified_by, NEW.verified_at)
     IS DISTINCT FROM
     (OLD.id, OLD.customer_user_id, OLD.customer_id, OLD.basis_identifier_id, OLD.verified_email,
      OLD.person_role, OLD.method, OLD.contact_source, OLD.source_reference, OLD.evidence_note,
      OLD.verified_by, OLD.verified_at) THEN
    RAISE EXCEPTION 'sadrzaj potvrde se ne menja; dozvoljen je samo opoziv'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "customer_contact_verifications_guard_trg" ON "customer_contact_verifications";
--> statement-breakpoint

CREATE TRIGGER "customer_contact_verifications_guard_trg"
  BEFORE UPDATE OR DELETE ON "customer_contact_verifications"
  FOR EACH ROW EXECUTE FUNCTION "customer_contact_verifications_guard"();
--> statement-breakpoint

/* =========================================================================
 * 3. Poreklo dodele kupca komercijalisti
 * ====================================================================== */

ALTER TABLE "customer_assignments"
  ADD COLUMN IF NOT EXISTS "basis" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "customer_assignments"
    ADD CONSTRAINT "customer_assignments_basis_ck"
    CHECK ("basis" IN ('manual', 'biznisoft_rep_code'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
