/*
 * Preporuke: prolaz i rezultat.
 *
 * DVE tabele, ne jedna. Prolaz je događaj (ko ga je pokrenuo, kada, sa kojim
 * `as_of_date`, šta je ušlo i šta je odbijeno); rezultat je red koji se
 * prikazuje. Spojene bi značile da se brojači ponavljaju uz svaki red, i da
 * neuspeo prolaz ostavlja polupraznu preporuku umesto nijedne.
 *
 * Rezultat NIKADA ne nosi količinu, jedinicu mere, cenu ni maržu. Nema kolonu u
 * koju bi stali — i to je namerno: GO/NO-GO audit je dokazao da istorijska JM
 * nije sačuvana na `invoice_lines`, pa bi svaka takva kolona bila mesto na koje
 * neko kasnije upiše pretpostavku.
 */

CREATE TYPE "recommendation_run_status" AS ENUM ('running', 'succeeded', 'failed');
--> statement-breakpoint

/*
 * Šta je pokrenulo prolaz — ZATVOREN skup sa JEDNOM vrednošću u V1.
 *
 * Automatski recompute posle svakog dokumenta se ne uvodi: uvoz istorije bi
 * pokrenuo hiljade prolaza, a prvi koji bi se poklopio sa polovinom uvoza dao
 * bi preporuke nad nepotpunim podacima. Proširenje je migracija, dakle svesna
 * odluka.
 */
CREATE TYPE "recommendation_trigger" AS ENUM ('manual');
--> statement-breakpoint

/*
 * Statusi ritma. Isti spisak kao `lib/recommendations/policy.mjs`.
 *
 * Enum, ne `text`: status se prikazuje, filtrira i broji, pa pogrešno napisana
 * vrednost ne sme da napravi četvrtu kolonu na ekranu koju niko ne očekuje.
 */
CREATE TYPE "recommendation_status" AS ENUM (
  'insufficient_history',
  'provisional',
  'dormant',
  'overdue',
  'due',
  'due_soon',
  'not_yet'
);
--> statement-breakpoint

CREATE TYPE "recommendation_confidence" AS ENUM ('low', 'medium', 'high');
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "recommendation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,

  /* Verzija algoritma i pragova; menja se pri svakoj izmeni formule. */
  "algorithm_version" text NOT NULL,
  /* Dan na koji je sve računato. Nikad izveden iz sata servera. */
  "as_of_date" date NOT NULL,
  "date_basis" text NOT NULL DEFAULT 'issued_on',

  "status" "recommendation_run_status" NOT NULL DEFAULT 'running',
  "trigger_source" "recommendation_trigger" NOT NULL DEFAULT 'manual',
  /* Ko je pokrenuo. `restrict` — trag ne sme da nestane ispod prolaza. */
  "requested_by" uuid,

  /*
   * Aktivan prolaz je onaj čiji se rezultati PRIKAZUJU.
   *
   * Postavlja se na `true` tek u istoj transakciji u kojoj je prolaz uspeo, i
   * to posle upisa svih rezultata. Zbog toga delimično objavljen prolaz ne
   * postoji: dok transakcija ne završi, nijedan njegov red nije aktivan.
   */
  "is_active" boolean NOT NULL DEFAULT false,

  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at" timestamp with time zone,

  /*
   * Opseg u kome je prolaz izvršen.
   *
   * `NULL` = bez ograničenja (gazda/kancelarija). Broj = koliko je kupaca bilo
   * u opsegu. Bez ovoga bi rezultat komercijaliste izgledao kao rezultat cele
   * firme, samo manji.
   */
  "scope_customer_count" integer,

  /* --- Brojači ulaza. Odvojeni, jer znače različite stvari. --- */
  "input_lines_accepted" integer NOT NULL DEFAULT 0,
  "input_lines_excluded" integer NOT NULL DEFAULT 0,
  "event_count" integer NOT NULL DEFAULT 0,
  "customer_count" integer NOT NULL DEFAULT 0,
  "article_count" integer NOT NULL DEFAULT 0,
  "pair_count" integer NOT NULL DEFAULT 0,
  /* Parovi sa najmanje dve kupovine na različite dane — jedini koji nose procenu. */
  "repeat_pair_count" integer NOT NULL DEFAULT 0,
  "result_count" integer NOT NULL DEFAULT 0,

  /* Razlog po razlog, ne jedan zbir: „koliko ih je otpalo" nije odgovor. */
  "exclusions" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status_counts" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "confidence_counts" jsonb NOT NULL DEFAULT '{}'::jsonb,

  /* Stabilan kod, nikad sirova poruka baze. */
  "failure_code" text,
  "failure_detail" text
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "recommendation_runs"
    ADD CONSTRAINT "recommendation_runs_requested_by_fk"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Ručni prolaz MORA imati čoveka. Bez toga „ko je pokrenuo" nema odgovor. */
DO $$ BEGIN
  ALTER TABLE "recommendation_runs"
    ADD CONSTRAINT "recommendation_runs_manual_needs_actor_ck"
    CHECK (trigger_source <> 'manual' OR requested_by IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Aktivan sme biti SAMO uspeo prolaz. */
DO $$ BEGIN
  ALTER TABLE "recommendation_runs"
    ADD CONSTRAINT "recommendation_runs_active_needs_success_ck"
    CHECK (NOT is_active OR status = 'succeeded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Završen prolaz ima vreme završetka; prolaz u toku ga nema. */
DO $$ BEGIN
  ALTER TABLE "recommendation_runs"
    ADD CONSTRAINT "recommendation_runs_finished_ck"
    CHECK ((status = 'running') = (finished_at IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * NAJVIŠE JEDAN aktivan prolaz po verziji algoritma.
 *
 * Ovo je brava iza „server restart ne sme napraviti duple aktivne rezultate".
 * Aplikativna provera („prvo ugasi stari, pa upali novi") ne preživljava dva
 * paralelna recompute-a ni pad procesa između dva koraka; delimičan jedinstveni
 * indeks preživljava.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "recommendation_runs_one_active"
  ON "recommendation_runs" ("algorithm_version")
  WHERE "is_active";
--> statement-breakpoint

/*
 * NAJVIŠE JEDAN prolaz u toku po verziji algoritma.
 *
 * Drugi klik na „preračunaj" dok prvi radi ne sme da pokrene drugi obračun nad
 * istim podacima. Serijalizacija ide i kroz advisory lock u servisu; ovo je
 * odbrana koja važi i kada servis nije jedini pisac.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "recommendation_runs_one_running"
  ON "recommendation_runs" ("algorithm_version")
  WHERE "status" = 'running';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "recommendation_runs_started_idx"
  ON "recommendation_runs" ("started_at" DESC);
--> statement-breakpoint

COMMENT ON TABLE "recommendation_runs" IS
  'Jedan recompute preporuka. is_active se postavlja tek u transakciji koja je uspela, pa delimicno objavljen prolaz ne postoji.';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "recommendation_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,

  "customer_id" uuid NOT NULL,
  /* EXACT BizniSoft šifra, TEKST, sa vodećim nulama. Jedini identitet artikla. */
  "article_code" text NOT NULL,
  /*
   * Snapshot naziva u trenutku prolaza.
   *
   * Snapshot, ne strani ključ ka registru: registar se menja, a preporuka mora
   * da ostane čitljiva onako kako je nastala. Naziv se NIGDE ne koristi za
   * povezivanje.
   */
  "article_name" text,

  "first_purchase_on" date NOT NULL,
  "last_purchase_on" date NOT NULL,
  "event_count" integer NOT NULL,

  /* `NULL` kada procena ne postoji — nikad nula kao zamena za „ne znam". */
  "median_interval_days" integer,
  "dispersion_days" integer,
  "stability" numeric(4, 2),
  "expected_next_on" date,
  "tolerance_days" integer,
  "window_from_on" date,
  "window_to_on" date,
  "days_until_expected" integer,
  "days_since_last_purchase" integer NOT NULL,

  "status" "recommendation_status" NOT NULL,
  "confidence" "recommendation_confidence" NOT NULL,
  /* Šifre razloga, radi kasnijeg merenja uspešnosti PO RAZLOGU. */
  "reasons" text[] NOT NULL DEFAULT '{}',
  "confidence_components" jsonb NOT NULL DEFAULT '{}'::jsonb,
  /* Rečenica koju komercijalista može da pročita kupcu. Bez količine i cene. */
  "explanation" text NOT NULL,

  /* Ponovljeno uz svaki red namerno: red se izvozi i mora sam sebe objasniti. */
  "algorithm_version" text NOT NULL,
  "as_of_date" date NOT NULL,
  "date_basis" text NOT NULL DEFAULT 'issued_on',

  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "recommendation_results"
    ADD CONSTRAINT "recommendation_results_run_fk"
    FOREIGN KEY ("run_id") REFERENCES "recommendation_runs"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * `restrict`, ne `cascade`: brisanje kupca ne sme tiho da odnese preporuke.
 * Rezultati se brišu isključivo kroz prolaz kome pripadaju.
 */
DO $$ BEGIN
  ALTER TABLE "recommendation_results"
    ADD CONSTRAINT "recommendation_results_customer_fk"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/* Šifra artikla ne sme biti prazna — ista granica kao u ulaznom pogledu. */
DO $$ BEGIN
  ALTER TABLE "recommendation_results"
    ADD CONSTRAINT "recommendation_results_article_code_ck"
    CHECK (btrim(article_code) <> '');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Procena postoji ili ne postoji U CELINI.
 *
 * Red sa očekivanim datumom a bez medijalnog intervala bio bi datum bez
 * obrazloženja — tačno ono što se na ekranu čita kao obećanje.
 */
DO $$ BEGIN
  ALTER TABLE "recommendation_results"
    ADD CONSTRAINT "recommendation_results_estimate_ck"
    CHECK (
      (median_interval_days IS NULL) = (expected_next_on IS NULL)
      AND (median_interval_days IS NULL) = (tolerance_days IS NULL)
      AND (median_interval_days IS NULL) = (window_from_on IS NULL)
      AND (median_interval_days IS NULL) = (window_to_on IS NULL)
      AND (median_interval_days IS NULL) = (days_until_expected IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

/*
 * Jedan par (kupac, artikal) — najviše jedan red po prolazu.
 *
 * Bez ovoga bi ponovljen upis unutar istog prolaza udvostručio preporuku, i to
 * tiho: ekran bi pokazao isti artikal dvaput, a niko ne bi znao koji red važi.
 */
CREATE UNIQUE INDEX IF NOT EXISTS "recommendation_results_pair_key"
  ON "recommendation_results" ("run_id", "customer_id", "article_code");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "recommendation_results_run_status_idx"
  ON "recommendation_results" ("run_id", "status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "recommendation_results_customer_idx"
  ON "recommendation_results" ("run_id", "customer_id");
--> statement-breakpoint

COMMENT ON TABLE "recommendation_results" IS
  'Rezultat jednog prolaza. Nema kolonu za kolicinu, jedinicu mere, cenu ni marzu — istorijska JM nije sacuvana i pretpostavka nema gde da se upise.';
--> statement-breakpoint

/*
 * Aktivne preporuke — jedini pogled sa kog portal čita.
 *
 * Prolaz koji nije uspeo i prolaz u toku nemaju `is_active`, pa njihovi redovi
 * ovde ne postoje. Zahvaljujući tome „neuspeh čuva prethodni rezultat" nije
 * pravilo u kodu koje neko može zaboraviti, nego osobina pogleda.
 */
CREATE OR REPLACE VIEW "active_recommendations" AS
SELECT r.*,
       run.started_at   AS run_started_at,
       run.finished_at  AS run_finished_at,
       run.requested_by AS run_requested_by
  FROM recommendation_results r
  JOIN recommendation_runs run ON run.id = r.run_id
 WHERE run.is_active;
--> statement-breakpoint

COMMENT ON VIEW "active_recommendations" IS
  'Rezultati aktivnog (uspesnog) prolaza. Portal cita iskljucivo odavde.';
