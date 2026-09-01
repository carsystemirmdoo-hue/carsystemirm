/*
 * Ručne komande konektoru i njihov append-only trag napretka.
 *
 * ADITIVNO. Postojeći `sync_devices`, `sync_device_keys`, `audit_log`,
 * `import_runs`, `invoices` i ledger se NE diraju — nema paralelnog modela
 * uređaja ni faktura.
 *
 * Šta ova tabela NIJE
 * -------------------
 * Nije knjigovodstvena istina. `completed` znači „ciklus je završen“, ne „sve
 * fakture su knjižene“. Za knjiženje su merodavni `invoices` i `import_runs`;
 * brojači ovde su izveštaj uređaja o sopstvenom prolazu, ograničen serverom.
 *
 * Šta se OVDE ne čuva
 * -------------------
 * Nema privatnog ključa, potpisa, PDF-a, sirovog canonical JSON-a, putanje
 * kancelarijskog foldera, imena fajla, PIB-a ni bilo kog podatka sa fakture.
 * Komanda nosi identitet i brojače; sadržaj ostaje tamo gde je i bio.
 */

/* =========================================================================
 * Tip komande — ZATVOREN skup
 * ====================================================================== */

/*
 * Jedan jedini tip u P4.
 *
 * Enum, ne slobodan tekst: server ne sme da prosledi ništa što uređaj tumači
 * kao program, putanju ili argument. Proširenje skupa je migracija, dakle
 * svesna odluka, a ne posledica jednog `INSERT`-a.
 */
DO $$ BEGIN
  CREATE TYPE "public"."sync_command_type" AS ENUM ('scan_and_sync');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Stanja komande.
 *
 * `queued` i `delivered` su NAMERNO razdvojeni: „portal je sačuvao zahtev“ i
 * „uređaj ga je preuzeo“ su različite tvrdnje, i spajanje bi značilo da ekran
 * kaže „radi“ za komandu koju niko nije video.
 *
 * `completed_with_review` postoji da `completed` ne bi lagalo. Ciklus u kome je
 * pola dokumenata otišlo na ručni pregled JESTE završen, ali NIJE knjižen.
 */
DO $$ BEGIN
  CREATE TYPE "public"."sync_command_status" AS ENUM (
    'queued',
    'delivered',
    'running',
    'completed',
    'completed_with_review',
    'retry_pending',
    'failed',
    'blocked',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * Komande
 * ====================================================================== */

CREATE TABLE IF NOT EXISTS "sync_commands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "device_id" uuid NOT NULL,
  /*
   * Opseg se PREPISUJE sa uređaja u trenutku kreiranja.
   *
   * Ne čita se iz zahteva i ne poredi se kasnije sa telom: komanda pripada
   * opsegu za koji je uređaj registrovan, i to se zamrzava ovde.
   */
  "source_system" text NOT NULL,
  "issuer_code" text NOT NULL,
  "command_type" "sync_command_type" NOT NULL,
  /* Verzija ugovora komande; nepoznata se odbija, ne tumači. */
  "command_version" integer DEFAULT 1 NOT NULL,
  /** Ko je zatražio. Ostaje i posle izvršenja — uređaj ga ne može promeniti. */
  "requested_by" uuid NOT NULL,
  "status" "sync_command_status" DEFAULT 'queued' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  /** Od kada je komanda uopšte dostupna za preuzimanje. */
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  /*
   * Rok. Komanda koju uređaj ne preuzme do tada ističe.
   *
   * Bez roka bi komanda zadata pre mesec dana bila izvršena u trenutku kada
   * neko upali računar — a to više nije ono što je čovek tražio.
   */
  "expires_at" timestamp with time zone NOT NULL,
  /*
   * Lease: koji uređaj drži komandu i do kada.
   *
   * Dva istovremena `poll`-a ne smeju dobiti istu komandu. Lease se uzima
   * atomarno; istek dozvoljava ISTOM uređaju nastavak, ali ne pravi novu
   * poslovnu komandu.
   */
  "lease_owner_device_id" uuid,
  "lease_expires_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  /** Ograničen enum razloga; nikad sirova poruka. */
  "failure_code" text,
  /* --- Brojači. Odvojeni, jer znače različite stvari. --- */
  "found_count" integer DEFAULT 0 NOT NULL,
  "read_count" integer DEFAULT 0 NOT NULL,
  "posted_count" integer DEFAULT 0 NOT NULL,
  "duplicate_count" integer DEFAULT 0 NOT NULL,
  "review_count" integer DEFAULT 0 NOT NULL,
  "unsupported_count" integer DEFAULT 0 NOT NULL,
  "pending_count" integer DEFAULT 0 NOT NULL,
  "blocked_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sync_commands" ADD CONSTRAINT "sync_commands_device_fk"
    FOREIGN KEY ("device_id") REFERENCES "public"."sync_devices"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sync_commands" ADD CONSTRAINT "sync_commands_requested_by_fk"
    FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sync_commands" ADD CONSTRAINT "sync_commands_lease_device_fk"
    FOREIGN KEY ("lease_owner_device_id") REFERENCES "public"."sync_devices"("id")
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * NAJVIŠE JEDNA neizvršena `scan_and_sync` komanda po uređaju.
 *
 * Ovo je brava iza „dvostruki klik ne pravi dve komande“. Aplikativna provera
 * ne preživljava dva paralelna submit-a; delimičan jedinstveni indeks
 * preživljava. Nova komanda je dozvoljena tek posle terminalnog ishoda.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "sync_commands_one_open_per_device"
  ON "sync_commands" ("device_id", "command_type")
  WHERE "status" IN ('queued', 'delivered', 'running', 'retry_pending');
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sync_commands_device_status_idx"
  ON "sync_commands" ("device_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_commands_expires_idx"
  ON "sync_commands" ("expires_at")
  WHERE "status" IN ('queued', 'delivered', 'running', 'retry_pending');
--> statement-breakpoint

/* Terminalno stanje mora imati vreme završetka; otvoreno ga ne sme imati. */
DO $$ BEGIN
  ALTER TABLE "sync_commands" ADD CONSTRAINT "sync_commands_finished_ck"
    CHECK (
      (status IN ('completed', 'completed_with_review', 'failed', 'blocked', 'expired')
        AND finished_at IS NOT NULL)
      OR (status IN ('queued', 'delivered', 'running', 'retry_pending')
        AND finished_at IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Lease ide u paru: vlasnik i rok, ili nijedno. */
DO $$ BEGIN
  ALTER TABLE "sync_commands" ADD CONSTRAINT "sync_commands_lease_ck"
    CHECK ((lease_owner_device_id IS NULL) = (lease_expires_at IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Brojači ne mogu biti negativni. */
DO $$ BEGIN
  ALTER TABLE "sync_commands" ADD CONSTRAINT "sync_commands_counts_ck"
    CHECK (
      found_count >= 0 AND read_count >= 0 AND posted_count >= 0
      AND duplicate_count >= 0 AND review_count >= 0 AND unsupported_count >= 0
      AND pending_count >= 0 AND blocked_count >= 0
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

COMMENT ON TABLE "sync_commands" IS
  'Rucne komande konektoru. NIJE knjigovodstvena istina: `completed` znaci zavrsen ciklus, ne knjizene fakture.';
--> statement-breakpoint
COMMENT ON COLUMN "sync_commands"."requested_by" IS
  'Covek koji je zatrazio komandu. Uredjaj ga NE moze promeniti; akter izvrsenja je uredjaj.';
--> statement-breakpoint

/* =========================================================================
 * Događaji — append-only
 * ====================================================================== */

CREATE TABLE IF NOT EXISTS "sync_command_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "command_id" uuid NOT NULL,
  /*
   * Stabilan ID koji pravi UREĐAJ.
   *
   * Zahvaljujući njemu je ponovljen ACK idempotentan: isti `client_event_id`
   * sa istim sadržajem je no-op, a sa DRUGIM sadržajem je konflikt — jer bi to
   * značilo da dva različita događaja tvrde isti identitet.
   */
  "client_event_id" text NOT NULL,
  /** Uređaj koji je poslao događaj; server ga uzima IZ POTPISA, ne iz tela. */
  "actor_device_id" uuid NOT NULL,
  "sequence" integer NOT NULL,
  "status" "sync_command_status" NOT NULL,
  "failure_code" text,
  "found_count" integer DEFAULT 0 NOT NULL,
  "read_count" integer DEFAULT 0 NOT NULL,
  "posted_count" integer DEFAULT 0 NOT NULL,
  "duplicate_count" integer DEFAULT 0 NOT NULL,
  "review_count" integer DEFAULT 0 NOT NULL,
  "unsupported_count" integer DEFAULT 0 NOT NULL,
  "pending_count" integer DEFAULT 0 NOT NULL,
  "blocked_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sync_command_events" ADD CONSTRAINT "sync_command_events_command_fk"
    FOREIGN KEY ("command_id") REFERENCES "public"."sync_commands"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sync_command_events" ADD CONSTRAINT "sync_command_events_device_fk"
    FOREIGN KEY ("actor_device_id") REFERENCES "public"."sync_devices"("id")
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Isti događaj se ne upisuje dvaput — osnova idempotentnog ACK-a. */
CREATE UNIQUE INDEX IF NOT EXISTS "sync_command_events_client_key"
  ON "sync_command_events" ("command_id", "client_event_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sync_command_events_command_idx"
  ON "sync_command_events" ("command_id", "sequence");
--> statement-breakpoint

/*
 * Append-only, isto kao `audit_log`.
 *
 * Napredak je istorija, ne stanje koje se prepisuje. Bez ovoga bi uređaj mogao
 * da „popravi“ raniji izveštaj i niko ne bi video da je izveštavao drugačije.
 */
CREATE OR REPLACE FUNCTION sync_command_events_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'sync_command_events je append-only: % nad redom % nije dozvoljen', TG_OP, OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS sync_command_events_no_update ON "sync_command_events";
--> statement-breakpoint
CREATE TRIGGER sync_command_events_no_update
  BEFORE UPDATE ON "sync_command_events"
  FOR EACH ROW EXECUTE FUNCTION sync_command_events_is_append_only();
--> statement-breakpoint

DROP TRIGGER IF EXISTS sync_command_events_no_delete ON "sync_command_events";
--> statement-breakpoint
CREATE TRIGGER sync_command_events_no_delete
  BEFORE DELETE ON "sync_command_events"
  FOR EACH ROW EXECUTE FUNCTION sync_command_events_is_append_only();
--> statement-breakpoint

COMMENT ON TABLE "sync_command_events" IS
  'Append-only trag napretka. Uredjaj ne moze prepisati raniji izvestaj.';
