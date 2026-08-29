/*
 * `revoked` kao zasebno stanje mapiranja, uz očuvanje prethodne veze.
 *
 * Aditivno i idempotentno.
 *
 * Zašto ne može ostati samo `rejected`
 * ------------------------------------
 * Jedna vrednost je značila dve različite stvari: „predlog nikad nije
 * prihvaćen" i „ranije potvrđena veza je poništena". To su različiti poslovni
 * događaji sa različitim posledicama — prvi kupcu nikad ništa nije pokazao,
 * drugi jeste pa je oduzeto. Spojeni u jednu vrednost, izveštaj „šta smo sve
 * poništili" ne može se napisati.
 *
 * Uz to je `decideMapping` brisao `catalog_product_slug` pri poništavanju, pa
 * tabela nije umela da odgovori NA ŠTA je artikal ranije bio mapiran. Taj
 * podatak je živeo samo u `audit_log`, gde ga niko ne traži.
 *
 * Enum se RECREIRA umesto `ALTER TYPE … ADD VALUE`, iz istog razloga kao u
 * 0012: nova vrednost se u istoj transakciji ne sme upotrebiti, a drizzle
 * migrator vrti ceo prolaz kao jednu transakciju.
 */

/* =========================================================================
 * 1. Kolone istorije — moraju postojati pre CHECK-a koji ih traži
 * ====================================================================== */

ALTER TABLE "article_catalog_mappings"
  ADD COLUMN IF NOT EXISTS "previous_catalog_product_slug" text,
  ADD COLUMN IF NOT EXISTS "previous_catalog_variant_id" text,
  ADD COLUMN IF NOT EXISTS "revoked_by" uuid,
  ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "article_catalog_mappings"
    ADD CONSTRAINT "article_catalog_mappings_revoked_by_users_id_fk"
    FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* =========================================================================
 * 2. Zamena enum tipa
 * ====================================================================== */

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'product_mapping_status' AND e.enumlabel = 'revoked'
  ) THEN
    RETURN;
  END IF;

  -- Sve što pominje `status` mora pasti pre zamene tipa.
  DROP INDEX IF EXISTS article_catalog_mappings_live_key;
  ALTER TABLE article_catalog_mappings
    DROP CONSTRAINT IF EXISTS article_catalog_mappings_mapped_needs_slug_ck;

  ALTER TYPE product_mapping_status RENAME TO product_mapping_status_old;

  CREATE TYPE product_mapping_status AS ENUM (
    'unmapped',
    'suggested',
    'mapped',
    'conflict',
    'rejected',
    'revoked'
  );

  ALTER TABLE article_catalog_mappings ALTER COLUMN status DROP DEFAULT;
  ALTER TABLE article_catalog_mappings
    ALTER COLUMN status TYPE product_mapping_status
    USING status::text::product_mapping_status;
  ALTER TABLE article_catalog_mappings ALTER COLUMN status SET DEFAULT 'unmapped';

  DROP TYPE product_mapping_status_old;

  /*
   * Zatečeni redovi se NE prevode automatski.
   *
   * `rejected` red ne nosi podatak o tome da li je ikad bio potvrđen — ta
   * razlika postoji samo u `audit_log`. Nagađanje bi proizvelo `revoked` redove
   * bez prethodnog sluga, koje bi CHECK ispod odbio, ili bi ih propustilo sa
   * izmišljenom vrednošću. Stari redovi ostaju `rejected`; razdvajanje važi od
   * ove tačke unapred.
   */

  ALTER TABLE article_catalog_mappings
    ADD CONSTRAINT article_catalog_mappings_mapped_needs_slug_ck
    CHECK (status <> 'mapped'
           OR (catalog_product_slug IS NOT NULL
               AND btrim(catalog_product_slug) <> ''));

  /*
   * Živi mapping je i dalje najviše JEDAN, ali sada ispadaju DVA istorijska
   * stanja. Bez proširenja predikata, poništena veza bi ostala u indeksu i
   * blokirala svako novo mapiranje istog artikla.
   */
  CREATE UNIQUE INDEX article_catalog_mappings_live_key
    ON article_catalog_mappings (article_id)
    WHERE status NOT IN ('rejected', 'revoked');

  /*
   * Poništena veza mora reći ŠTA je poništeno i ko je to uradio.
   *
   * Bez toga bi `revoked` bio samo drugo ime za `rejected`, a ceo smisao
   * razdvajanja je u tome što se za poništenu vezu zna šta je bila.
   */
  ALTER TABLE article_catalog_mappings
    ADD CONSTRAINT article_catalog_mappings_revoked_ck
    CHECK (
      status <> 'revoked'
      OR (previous_catalog_product_slug IS NOT NULL
          AND btrim(previous_catalog_product_slug) <> ''
          AND revoked_by IS NOT NULL
          AND revoked_at IS NOT NULL
          AND note IS NOT NULL
          AND btrim(note) <> '')
    );
END $$;
