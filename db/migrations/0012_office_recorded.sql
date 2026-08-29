/*
 * `confirmed` traži DOKAZ sa fakture, ne ljudsku tvrdnju.
 *
 * Postflight audit (F-1) je našao da `confirmed` istovremeno znači dve stvari:
 * „kancelarija kaže da je unela u BizniSoft" i „uslov je stvarno fakturisan".
 * Prvo je tvrdnja čoveka, drugo je dokaz. Spojeni u jedno stanje, tvrdnja je
 * izgledala kao dokaz — labela je glasila „Potvrđeno u BizniSoftu", ton je bio
 * `success`, a `PricingPreview.confirmed` je bio `true`.
 *
 * Ova migracija uvodi `office_recorded` između odobrenja i potvrde.
 *
 * Zašto se enum RECREIRA umesto `ALTER TYPE … ADD VALUE`
 * ------------------------------------------------------
 * `ALTER TYPE … ADD VALUE` sme u transakciji, ali nova vrednost se u TOJ ISTOJ
 * transakciji ne sme upotrebiti — ni u `UPDATE`-u, ni u `CHECK` izrazu. Drizzle
 * migrator vrti ceo prolaz kao jednu transakciju, pa je prvi pokušaj (dodavanje
 * u 0012, upotreba u 0013) pao i povukao oba fajla unazad. `CREATE TYPE` nema
 * to ograničenje: vrednost je upotrebljiva odmah.
 *
 * Zamena tipa je bezbedna jer je jedini nosilac `price_rules.status`; dva
 * indeksa nad njim se automatski prave ponovo uz `ALTER COLUMN … TYPE`.
 *
 * Idempotentno: `DO` blok preskače ceo posao ako vrednost već postoji.
 */

/* =========================================================================
 * 1. Evidence kolone — moraju postojati pre bloka koji ih puni
 *
 * `office_*` popunjava čovek iz kancelarije. `reconciled_*` popunjava
 * isključivo budući read-only reconciliation servis nad `invoices` /
 * `invoice_lines`. Matching algoritam NIJE deo ove faze i nijedan dokument se
 * ne izmišlja — ovo je samo mesto na koje se taj servis kači.
 * ====================================================================== */

ALTER TABLE "price_rules"
  ADD COLUMN IF NOT EXISTS "office_recorded_by" uuid,
  ADD COLUMN IF NOT EXISTS "office_recorded_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "office_record_note" text,
  ADD COLUMN IF NOT EXISTS "reconciled_invoice_id" uuid,
  ADD COLUMN IF NOT EXISTS "reconciled_invoice_line_id" uuid,
  ADD COLUMN IF NOT EXISTS "reconciled_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "reconciliation_note" text;
--> statement-breakpoint

/* =========================================================================
 * 2. Zamena enum tipa i prevod zatečenih redova
 * ====================================================================== */

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'price_rule_status' AND e.enumlabel = 'office_recorded'
  ) THEN
    RETURN;
  END IF;

  -- CHECK-ovi koji pominju `status` moraju pasti pre zamene tipa.
  ALTER TABLE price_rules DROP CONSTRAINT IF EXISTS price_rules_decision_reason_ck;
  ALTER TABLE price_rules DROP CONSTRAINT IF EXISTS price_rules_confirmed_ck;

  ALTER TYPE price_rule_status RENAME TO price_rule_status_old;

  CREATE TYPE price_rule_status AS ENUM (
    'draft',
    'pending_approval',
    'approved_pending_biznisoft',
    'office_recorded',
    'confirmed',
    'rejected',
    'reconciliation_failed',
    'revoked',
    'expired'
  );

  ALTER TABLE price_rules ALTER COLUMN status DROP DEFAULT;
  ALTER TABLE price_rules
    ALTER COLUMN status TYPE price_rule_status
    USING status::text::price_rule_status;
  ALTER TABLE price_rules ALTER COLUMN status SET DEFAULT 'draft';

  DROP TYPE price_rule_status_old;

  /*
   * Zatečeni `confirmed` redovi su semantički bili evidencija kancelarije —
   * nastali su ljudskom radnjom, bez ijednog pogleda na fakturu. Prevode se u
   * `office_recorded` da im ime odgovara onome što jesu.
   */
  UPDATE price_rules
     SET status = 'office_recorded',
         office_recorded_by = confirmed_by,
         office_recorded_at = confirmed_at,
         office_record_note = COALESCE(NULLIF(btrim(confirmation_note), ''),
                                       'Preneto iz ranijeg stanja „confirmed" (migracija 0012).'),
         updated_at = now()
   WHERE status = 'confirmed';

  ALTER TABLE price_rules
    ADD CONSTRAINT price_rules_decision_reason_ck
    CHECK (
      status NOT IN ('rejected', 'revoked')
      OR (decision_reason IS NOT NULL AND btrim(decision_reason) <> '')
    );
END
$$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules"
    ADD CONSTRAINT "price_rules_office_recorded_by_users_id_fk"
    FOREIGN KEY ("office_recorded_by") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * `ON DELETE RESTRICT`: dokaz sa fakture ne sme da ispari brisanjem fakture.
 */
DO $$ BEGIN
  ALTER TABLE "price_rules"
    ADD CONSTRAINT "price_rules_reconciled_invoice_id_invoices_id_fk"
    FOREIGN KEY ("reconciled_invoice_id") REFERENCES "public"."invoices"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "price_rules"
    ADD CONSTRAINT "price_rules_reconciled_invoice_line_id_invoice_lines_id_fk"
    FOREIGN KEY ("reconciled_invoice_line_id") REFERENCES "public"."invoice_lines"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Evidencija kancelarije mora imati potpis i obrazložnu napomenu.
 *
 * Napomena je OBAVEZNA jer je jedini trag o tome ŠTA je tačno uneto u
 * BizniSoft. Bez nje bi kasnije usaglašavanje poredilo pravilo sa fakturom bez
 * ijednog podatka o tome šta je čovek mislio da je uneo.
 */
DO $$ BEGIN
  ALTER TABLE "price_rules"
    ADD CONSTRAINT "price_rules_office_recorded_ck"
    CHECK (
      status <> 'office_recorded'
      OR (office_recorded_by IS NOT NULL
          AND office_recorded_at IS NOT NULL
          AND office_record_note IS NOT NULL
          AND btrim(office_record_note) <> '')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * `confirmed` je NEDOSTIŽAN bez reference na fakturu.
 *
 * Stari `price_rules_confirmed_ck` je tražio samo `confirmed_by`/`confirmed_at`,
 * što je čovek mogao da popuni. Ovaj traži red iz `invoices` — a te redove pravi
 * uvoz iz knjigovodstva, ne portal. Zabrana živi u bazi, pa zaobilaženje
 * aplikativnog sloja ne pomaže.
 */
DO $$ BEGIN
  ALTER TABLE "price_rules"
    ADD CONSTRAINT "price_rules_confirmed_needs_invoice_ck"
    CHECK (
      status <> 'confirmed'
      OR (reconciled_invoice_id IS NOT NULL AND reconciled_at IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * `reconciliation_failed` je takođe nalaz usaglašavanja, ne ljudska odluka.
 * Traži se obrazloženje koje je servis upisao.
 */
DO $$ BEGIN
  ALTER TABLE "price_rules"
    ADD CONSTRAINT "price_rules_reconciliation_failed_ck"
    CHECK (
      status <> 'reconciliation_failed'
      OR (reconciliation_note IS NOT NULL AND btrim(reconciliation_note) <> '')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
