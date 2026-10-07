/*
 * Izveštaj ciklusa konektora (heartbeat posle svakog ciklusa, konektor 0.3.9).
 *
 * Razdvaja tri stvari koje je `last_seen_at` mešao:
 *   - poslednje javljanje       — `sync_devices.last_seen_at` (svaki potpisan zahtev);
 *   - poslednji ciklus          — `last_cycle_at` + `last_cycle_outcome`
 *                                 (obrađen, preskočen po rasporedu, greška);
 *   - poslednje USPEŠNO skeniranje — `last_scan_completed_at` (ceo izvor obiđen).
 * `next_expected_cycle_at` je okidač koji je uređaj sam izračunao (Europe/Belgrade,
 * radni dani, praznici); portal po njemu prepoznaje računar koji ne radi.
 *
 * Konektor 0.3.8 šalje prazno telo i radi kao i do sada: pomera samo
 * `last_seen_at`, a ova polja ostaju prazna.
 */
CREATE TYPE "sync_cycle_outcome" AS ENUM ('obradjeno', 'preskoceno', 'greska');
--> statement-breakpoint

CREATE TABLE "sync_device_cycles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "device_id" uuid NOT NULL REFERENCES "sync_devices"("id") ON DELETE RESTRICT,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  /* Početak ciklusa po satu uređaja (ISO sa zonom). */
  "cycle_at" timestamp with time zone NOT NULL,
  "outcome" "sync_cycle_outcome" NOT NULL,
  /* Kratak kod: raspored, rucno_pokretanje, ceka_sledeci_ciklus, posle_radnog_vremena… */
  "reason" text,
  "scan_completed" boolean NOT NULL,
  "scanned" integer,
  "new_documents" integer,
  "sent" integer,
  "confirmed" integer,
  "for_review" integer,
  "remaining" integer,
  "duration_ms" integer,
  "error_code" text,
  "connector_version" text,
  "next_expected_at" timestamp with time zone,
  CONSTRAINT "sync_device_cycles_counts_check" CHECK (
    coalesce("scanned", 0) >= 0 AND coalesce("new_documents", 0) >= 0 AND coalesce("sent", 0) >= 0
    AND coalesce("confirmed", 0) >= 0 AND coalesce("for_review", 0) >= 0
    AND coalesce("remaining", 0) >= 0 AND coalesce("duration_ms", 0) >= 0
  ),
  /* Skeniranje može biti završeno samo u obrađenom ciklusu. */
  CONSTRAINT "sync_device_cycles_scan_check" CHECK (NOT "scan_completed" OR "outcome" = 'obradjeno'),
  CONSTRAINT "sync_device_cycles_text_check" CHECK (
    coalesce(length("reason"), 0) <= 64 AND coalesce(length("error_code"), 0) <= 64
    AND coalesce(length("connector_version"), 0) <= 32
  )
);
--> statement-breakpoint

/* Ponovljen isti izveštaj (isti uređaj, isti početak) ne pravi drugi red. */
CREATE UNIQUE INDEX "sync_device_cycles_device_cycle_key" ON "sync_device_cycles" ("device_id", "cycle_at");
--> statement-breakpoint
CREATE INDEX "sync_device_cycles_recent_idx" ON "sync_device_cycles" ("device_id", "received_at" DESC);
--> statement-breakpoint

/* Zapis o ciklusu se ne menja i ne briše. */
CREATE OR REPLACE FUNCTION "sync_device_cycles_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'sync_device_cycles se samo dodaju' USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
CREATE TRIGGER "sync_device_cycles_guard_trg"
  BEFORE UPDATE OR DELETE ON "sync_device_cycles"
  FOR EACH ROW EXECUTE FUNCTION "sync_device_cycles_guard"();
--> statement-breakpoint

ALTER TABLE "sync_devices"
  ADD COLUMN "last_cycle_at" timestamp with time zone,
  ADD COLUMN "last_cycle_outcome" "sync_cycle_outcome",
  ADD COLUMN "last_scan_completed_at" timestamp with time zone,
  ADD COLUMN "next_expected_cycle_at" timestamp with time zone;
