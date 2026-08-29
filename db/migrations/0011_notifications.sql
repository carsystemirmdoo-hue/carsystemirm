/*
 * Obaveštenja i paket za njihov pregled.
 *
 * Aditivno i idempotentno.
 *
 * Tabela NIJE audit i ne zamenjuje ga. Obaveštenje se čita i zatvara;
 * `audit_log` se ne menja ni briše. Zato ovde stoji referenca na entitet i
 * `correlation_id` ka audit zapisu iste radnje, a ne kopija vrednosti pre i
 * posle — dve kopije istorije bi se razišle, i niko ne bi znao koja važi.
 */

DO $$ BEGIN
  CREATE TYPE "public"."notification_kind" AS ENUM (
    'price_rule_proposed',
    'price_rule_approved',
    'price_rule_rejected',
    'price_rule_conflict',
    'price_rule_reconciliation_failed',
    'price_rule_revoked',
    'mapping_customer_facing_changed',
    'external_identity_conflict',
    'customer_account_status_changed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."notification_severity" AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."notification_status" AS ENUM ('unread', 'read', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "kind" "notification_kind" NOT NULL,
  "severity" "notification_severity" DEFAULT 'info' NOT NULL,
  "status" "notification_status" DEFAULT 'unread' NOT NULL,
  "required_capability" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "action_href" text,
  "context" jsonb,
  "correlation_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_at" timestamp with time zone,
  "read_by" uuid,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "resolution_note" text
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_read_by_users_id_fk"
    FOREIGN KEY ("read_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_resolved_by_users_id_fk"
    FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "notifications_status_idx"
  ON "notifications" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_capability_idx"
  ON "notifications" ("required_capability");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_entity_idx"
  ON "notifications" ("entity_type", "entity_id");
--> statement-breakpoint

/* Zatvoreno obaveštenje mora imati napomenu i potpis. */
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_resolved_ck"
    CHECK (
      status <> 'resolved'
      OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL
          AND resolution_note IS NOT NULL AND btrim(resolution_note) <> '')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Obaveštenje mora biti vezano za sposobnost, ne za praznu vrednost.
 *
 * Prazna vrednost bi značila „niko ga ne vidi" — obaveštenje koje niko ne vidi
 * je gore od nedostajućeg, jer sistem izgleda kao da je nekoga obavestio.
 */
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_capability_ck"
    CHECK (btrim("required_capability") <> '');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

INSERT INTO "permission_packages" ("key", "name", "description", "sort_order")
VALUES
  ('obavestenja_pregled', 'Pregled i zatvaranje obaveštenja',
   'Čitanje i zatvaranje sistemskih obaveštenja o cenama i mapiranjima', '14')
ON CONFLICT ("key") DO UPDATE
  SET "name" = EXCLUDED."name",
      "description" = EXCLUDED."description";
