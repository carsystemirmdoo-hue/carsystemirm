/*
 * Uređaji, njihovi javni ključevi, anti-replay i akter koji nije korisnik.
 *
 * ADITIVNO. Nijedan postojeći red se ne menja, nijedan zaštitni okidač se ne
 * gasi, i postojeći korisnički uvozi nastavljaju da rade nepromenjeni.
 *
 * SERVER ČUVA SAMO JAVNE KLJUČEVE. Privatni ključ nastaje na uređaju i nikada
 * ne napušta ga — nema kolone u koju bi mogao da stane, i to je namerno.
 */

/* =========================================================================
 * Uređaj
 * ====================================================================== */

DO $$ BEGIN
  CREATE TYPE "public"."sync_device_status" AS ENUM (
    /*
     * Registrovan, ali NE SME da šalje.
     *
     * Uređaj se nikada ne registruje kao aktivan. Aktivaciju izvršava čovek sa
     * `devices:manage`, kao zaseban čin — inače bi svako ko ume da napravi
     * zahtev za registraciju time i otvorio kanal.
     */
    'registered',
    'active',
    /* Privremeno zaustavljen; može se vratiti u `active`. */
    'suspended',
    /* Trajno opozvan. Iz ovog stanja se ne vraća. */
    'revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sync_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  /** Stabilna oznaka koju uređaj šalje u zaglavlju; ne menja se kroz život uređaja. */
  "device_code" text NOT NULL,
  "label" text NOT NULL,
  /*
   * Opseg uređaja. OVO je jedini izvor tenant/issuer opsega pri prijemu.
   *
   * Payload nosi svoj `issuer.code`, ali se on samo POREDI sa ovim redom.
   * Sadržaj koji sam sebi dodeli opseg nije opseg.
   */
  "source_system" text NOT NULL,
  "issuer_code" text NOT NULL,
  "status" "sync_device_status" DEFAULT 'registered' NOT NULL,
  "registered_by" uuid NOT NULL,
  "registered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "activated_by" uuid,
  "activated_at" timestamp with time zone,
  "revoked_by" uuid,
  "revoked_at" timestamp with time zone,
  "revoked_reason" text,
  /** Poslednji AUTENTIFIKOVAN kontakt. Nepotpisan zahtev ga ne pomera. */
  "last_seen_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "sync_devices_code_key"
  ON "sync_devices" ("device_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_devices_scope_idx"
  ON "sync_devices" ("source_system", "issuer_code");
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sync_devices" ADD CONSTRAINT "sync_devices_registered_by_fk"
    FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sync_devices" ADD CONSTRAINT "sync_devices_activated_by_fk"
    FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sync_devices" ADD CONSTRAINT "sync_devices_revoked_by_fk"
    FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Aktivan uređaj mora imati potpis onoga ko ga je aktivirao; opozvan — razlog. */
DO $$ BEGIN
  ALTER TABLE "sync_devices" ADD CONSTRAINT "sync_devices_lifecycle_ck"
    CHECK (
      (status <> 'active' OR (activated_by IS NOT NULL AND activated_at IS NOT NULL))
      AND (status <> 'revoked' OR (
            revoked_by IS NOT NULL AND revoked_at IS NOT NULL
            AND revoked_reason IS NOT NULL AND btrim(revoked_reason) <> ''))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * Javni ključevi, verzionisani
 * ====================================================================== */

CREATE TABLE IF NOT EXISTS "sync_device_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "device_id" uuid NOT NULL,
  /** Oznaka ključa koju uređaj šalje uz potpis; par (uređaj, key_id) je jedinstven. */
  "key_id" text NOT NULL,
  /** Jedini podržan profil u v1. Kolona postoji da bi rotacija profila bila moguća. */
  "algorithm" text DEFAULT 'ed25519' NOT NULL,
  /** JAVNI ključ, SPKI DER u base64. Privatnog para ovde NEMA i ne sme ga biti. */
  "public_key_spki" text NOT NULL,
  /** SHA-256 nad SPKI DER bajtovima — za ljudsku proveru pri aktivaciji. */
  "fingerprint" text NOT NULL,
  "status" "sync_device_status" DEFAULT 'registered' NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "activated_by" uuid,
  "activated_at" timestamp with time zone,
  "revoked_by" uuid,
  "revoked_at" timestamp with time zone,
  "revoked_reason" text
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sync_device_keys" ADD CONSTRAINT "sync_device_keys_device_fk"
    FOREIGN KEY ("device_id") REFERENCES "public"."sync_devices"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sync_device_keys" ADD CONSTRAINT "sync_device_keys_created_by_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sync_device_keys" ADD CONSTRAINT "sync_device_keys_activated_by_fk"
    FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sync_device_keys" ADD CONSTRAINT "sync_device_keys_revoked_by_fk"
    FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * `(device_id, key_id)` je jedinstven i kada je ključ opozvan.
 *
 * Opozvana oznaka se NE sme ponovo upotrebiti: potpis star godinu dana bi tada
 * pokazivao na nov ključ, i istorija bi postala neproverljiva.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "sync_device_keys_key_id_key"
  ON "sync_device_keys" ("device_id", "key_id");
--> statement-breakpoint

/* Isti javni ključ ne sme pripadati dvama uređajima. */
CREATE UNIQUE INDEX IF NOT EXISTS "sync_device_keys_fingerprint_key"
  ON "sync_device_keys" ("fingerprint");
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sync_device_keys" ADD CONSTRAINT "sync_device_keys_algorithm_ck"
    CHECK (algorithm = 'ed25519');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sync_device_keys" ADD CONSTRAINT "sync_device_keys_lifecycle_ck"
    CHECK (
      (status <> 'active' OR (activated_by IS NOT NULL AND activated_at IS NOT NULL))
      AND (status <> 'revoked' OR (
            revoked_by IS NOT NULL AND revoked_at IS NOT NULL
            AND revoked_reason IS NOT NULL AND btrim(revoked_reason) <> ''))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Sada kada tabela postoji, dokument može da pokaže na uređaj koji ga je doneo. */
DO $$ BEGIN
  ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_delivered_by_device_fk"
    FOREIGN KEY ("delivered_by_device_id") REFERENCES "public"."sync_devices"("id")
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * Anti-replay
 * ====================================================================== */

/*
 * Nonce u BAZI, ne u memoriji.
 *
 * `Set` u modulu ne preživljava restart procesa i ne dele ga dve instance, pa
 * bi napadaču dao onoliko ponavljanja koliko ima instanci — i sve bi izgledalo
 * ispravno. Ovo je jedino zajedničko stanje koje već postoji.
 *
 * Jedinstvenost je `(device_id, key_id, nonce)`. Upis je taj koji odlučuje:
 * dva istovremena zahteva sa istim nonce-om oba prođu proveru potpisa, ali
 * `INSERT` propušta tačno jedan.
 */
CREATE TABLE IF NOT EXISTS "sync_request_nonces" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "device_id" uuid NOT NULL,
  "key_id" text NOT NULL,
  "nonce" text NOT NULL,
  /** Timestamp iz potpisanog zahteva; osnov za čišćenje. */
  "signed_at" timestamp with time zone NOT NULL,
  "seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  /*
   * Do kada red MORA da se čuva.
   *
   * Prerano brisanje ponovo otvara replay: zahtev čiji je timestamp još u
   * dozvoljenom prozoru mogao bi da prođe drugi put. Zato se rok računa od
   * `signed_at` plus prozor plus rezerva, a ne od trenutka upisa.
   */
  "retain_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sync_request_nonces" ADD CONSTRAINT "sync_request_nonces_device_fk"
    FOREIGN KEY ("device_id") REFERENCES "public"."sync_devices"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "sync_request_nonces_key"
  ON "sync_request_nonces" ("device_id", "key_id", "nonce");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_request_nonces_retain_idx"
  ON "sync_request_nonces" ("retain_until");
--> statement-breakpoint

/* =========================================================================
 * Akter koji nije korisnik
 * ====================================================================== */

DO $$ BEGIN
  CREATE TYPE "public"."audit_actor_kind" AS ENUM ('user', 'device', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Uređaj dobija STVARAN identitet u tragu, ne izmišljenog korisnika.
 *
 * Lažan `users` red bi se pojavio na svakom ekranu korisnika i mogao bi da se
 * deaktivira, resetuje mu lozinka ili dodeli dozvola. Korisnik koji je uređaj
 * registrovao takođe ne sme biti akter njegovih budućih uvoza — on je odobrio
 * kanal, nije uneo dokument.
 *
 * `actor_label` ostaje kao čitljiv dodatak, ne kao jedini identitet.
 */
ALTER TABLE "audit_log"
  ADD COLUMN IF NOT EXISTS "actor_kind" "audit_actor_kind" NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "audit_log"
  ADD COLUMN IF NOT EXISTS "actor_device_id" uuid;
--> statement-breakpoint

/*
 * `SET NULL`, ne `RESTRICT` i nikako `CASCADE`.
 *
 * Brisanje uređaja NE SME kaskadno obrisati trag — okidač `audit_log_no_delete`
 * bi ga ionako odbio, ali bi poruka pokazivala na okidač umesto na uzrok.
 * `RESTRICT` bi značio da se uređaj ne može obrisati nikada; `SET NULL` je
 * `UPDATE` nad tragom, koji okidač `audit_log_no_update` odbija — pa je i to
 * neprolazno. Zato NEMA stranog ključa: veza se čuva kao vrednost.
 *
 * Kolona ostaje `uuid` i poredi se sa `sync_devices.id` u upitima; integritet
 * se drži time što je jedini upisivač aplikacija, a red se nikad ne menja.
 */

DO $$ BEGIN
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_kind_ck"
    CHECK (
      (actor_kind = 'user'   AND actor_device_id IS NULL)
      OR (actor_kind = 'device' AND actor_device_id IS NOT NULL AND actor_user_id IS NULL)
      OR (actor_kind = 'system' AND actor_device_id IS NULL AND actor_user_id IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_log_actor_device_idx"
  ON "audit_log" ("actor_device_id")
  WHERE "actor_device_id" IS NOT NULL;
--> statement-breakpoint

/*
 * Isti akter i na uvoznom prolazu.
 *
 * `import_runs.started_by` je strani ključ ka `users` i ostaje nepromenjen za
 * korisničke uvoze. Uređaj dobija svoju kolonu; `started_by` je tada `NULL`.
 */
ALTER TABLE "import_runs"
  ADD COLUMN IF NOT EXISTS "started_by_device_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_started_by_device_fk"
    FOREIGN KEY ("started_by_device_id") REFERENCES "public"."sync_devices"("id")
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Prolaz ima NAJVIŠE jednog aktera.
 *
 * Bez ovoga bi red mogao da tvrdi i korisnika i uređaj, pa bi izveštaj „ko je
 * uvezao“ imao dva tačna odgovora.
 */
DO $$ BEGIN
  ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_single_actor_ck"
    CHECK (NOT (started_by IS NOT NULL AND started_by_device_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

COMMENT ON TABLE "sync_devices" IS
  'Registrovani uredjaji. Opseg (source_system, issuer_code) dolazi ISKLJUCIVO odavde, nikad iz payloada.';
--> statement-breakpoint
COMMENT ON TABLE "sync_device_keys" IS
  'Samo JAVNI kljucevi. Privatni kljuc nastaje na uredjaju i nema kolonu u koju bi stao.';
--> statement-breakpoint
COMMENT ON TABLE "sync_request_nonces" IS
  'Anti-replay. Jedinstvenost (device_id, key_id, nonce); upis odlucuje ko je prvi. Cuva se dok zahtev moze proci timestamp proveru, uz rezervu.';
