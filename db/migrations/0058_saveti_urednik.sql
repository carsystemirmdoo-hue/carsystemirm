/*
 * „Saveti i vodiči“ — uređivanje u poslovnom panelu (0058; zahtevi vlasnika 15. 10. i 1. 11. 2026).
 *
 * Do sada su tekstovi bili fajlovi u repozitorijumu, a odobrenje se upisivalo commit-om. Panel na
 * Production-u ne može da piše fajlove, pa se izvor istine seli u bazu:
 *
 *  - `saveti_clanci`      članak: stalna adresa (slug), javna verzija, povlačenje.
 *  - `saveti_verzije`     SVAKO čuvanje je nova, nepromenljiva verzija sa otiskom sadržaja.
 *                         Odobrenje važi za tačno jednu verziju; izmena = nova verzija = novo odobrenje.
 *  - `saveti_dogadjaji`   ko je šta i kada uradio (sačuvao, poslao na pregled, odobrio, zakazao,
 *                         objavio, povukao, vratio verziju). Samo dodavanje.
 *  - `saveti_zakazivanja` odobrena verzija i trenutak objave koji je izabrao vlasnik (vreme Srbije).
 *                         Javnost je vidi od tog trenutka (javni upit poredi sa now()), bez zakazanog
 *                         posla. Otkazivanje i izvršenje su jednokratne oznake, ne brisanje.
 *  - `saveti_objave`      svaka objava (po terminu ili odmah) — jedna po zakazivanju.
 *  - `saveti_slike`       naslovne slike (WebP posle provere tipa i veličine) — u istoj bazi, bez novog servisa.
 *  - `saveti_adrese`      ranije adrese članka posle IZRIČITE promene adrese (preusmerenje).
 *
 * Raspored cele arhive ne postoji u ovom modelu: svaki članak zakazuje vlasnik pojedinačno.
 *
 * Stručna potvrda (`strucna_potvrda_potrebna`) je odvojena od uredničke provere i odobrenja
 * vlasnika: članak koji je traži ne može biti odobren dok potvrda stručnjaka nije upisana za
 * TAČNU verziju sadržaja. Zahtev se ne može ukloniti (okidač), samo ispuniti.
 */
CREATE TABLE IF NOT EXISTS "saveti_slike" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sha256" text NOT NULL,
  "mime" text NOT NULL,
  "sirina" integer NOT NULL,
  "visina" integer NOT NULL,
  "bajtova" integer NOT NULL,
  "sadrzaj" bytea NOT NULL,
  "izvorno_ime" text,
  "napravio" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "napravljeno" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "saveti_slike_sha_key" UNIQUE ("sha256"),
  CONSTRAINT "saveti_slike_mime_check" CHECK ("mime" IN ('image/webp')),
  CONSTRAINT "saveti_slike_velicina_check" CHECK ("bajtova" > 0 AND "bajtova" <= 2097152 AND "sirina" BETWEEN 1 AND 4000 AND "visina" BETWEEN 1 AND 4000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saveti_clanci" (
  "id" text PRIMARY KEY,
  "slug" text NOT NULL,
  "tip" text NOT NULL,
  "kategorija" text NOT NULL,
  "napravio" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "napravljeno" timestamp with time zone NOT NULL DEFAULT now(),
  "javna_verzija_id" uuid,
  "prvi_put_objavljeno" timestamp with time zone,
  "javno_od" timestamp with time zone,
  "povuceno" timestamp with time zone,
  "povucen_razlog" text,
  "povukao" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "strucna_potvrda_potrebna" boolean NOT NULL DEFAULT false,
  "strucna_potvrda_razlog" text NOT NULL DEFAULT '',
  CONSTRAINT "saveti_clanci_slug_key" UNIQUE ("slug"),
  CONSTRAINT "saveti_clanci_id_check" CHECK ("id" ~ '^SV-[0-9]{4,}$'),
  CONSTRAINT "saveti_clanci_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("slug") <= 120),
  CONSTRAINT "saveti_clanci_tip_check" CHECK ("tip" IN ('novost', 'osnovni-vodic', 'postupak', 'resavanje-problema')),
  CONSTRAINT "saveti_clanci_povucen_check" CHECK (("povuceno" IS NULL) = ("povucen_razlog" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saveti_verzije" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clanak_id" text NOT NULL REFERENCES "saveti_clanci"("id") ON DELETE RESTRICT,
  "broj" integer NOT NULL,
  "naslov" text NOT NULL,
  "meta_naslov" text NOT NULL DEFAULT '',
  "opis" text NOT NULL,
  "telo" text NOT NULL,
  "izvori" jsonb NOT NULL DEFAULT '[]',
  "podaci" jsonb NOT NULL DEFAULT '{}',
  "interne_napomene" text NOT NULL DEFAULT '',
  "nepotvrdjeno" text NOT NULL DEFAULT '',
  "slika_id" uuid REFERENCES "saveti_slike"("id") ON DELETE RESTRICT,
  "slika_alt" text NOT NULL DEFAULT '',
  "otisak" text NOT NULL,
  "poreklo" text NOT NULL,
  "napravio" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "napravljeno" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "saveti_verzije_broj_key" UNIQUE ("clanak_id", "broj"),
  CONSTRAINT "saveti_verzije_broj_check" CHECK ("broj" >= 1),
  CONSTRAINT "saveti_verzije_slika_alt_check" CHECK ("slika_id" IS NULL OR length(btrim("slika_alt")) > 0)
);
--> statement-breakpoint
ALTER TABLE "saveti_clanci" ADD CONSTRAINT "saveti_clanci_javna_verzija_fk"
  FOREIGN KEY ("javna_verzija_id") REFERENCES "saveti_verzije"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saveti_dogadjaji" (
  "id" bigserial PRIMARY KEY,
  "clanak_id" text NOT NULL REFERENCES "saveti_clanci"("id") ON DELETE RESTRICT,
  "verzija_id" uuid REFERENCES "saveti_verzije"("id") ON DELETE RESTRICT,
  "radnja" text NOT NULL,
  "korisnik" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "korisnik_ime" text,
  "vreme" timestamp with time zone NOT NULL DEFAULT now(),
  "detalji" jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT "saveti_dogadjaji_radnja_check" CHECK ("radnja" IN (
    'uvezeno', 'sacuvano', 'poslato_na_pregled', 'vraceno_na_doradu', 'odobreno', 'zakazano',
    'otkazano_zakazivanje', 'objavljeno', 'objavljene_izmene', 'povuceno', 'vracena_verzija',
    'promenjena_adresa', 'strucno_potvrdjeno', 'oznaceno_za_strucnu_potvrdu'
  ))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saveti_dogadjaji_clanak_idx" ON "saveti_dogadjaji" ("clanak_id", "vreme");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saveti_zakazivanja" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "verzija_id" uuid NOT NULL REFERENCES "saveti_verzije"("id") ON DELETE RESTRICT,
  "clanak_id" text NOT NULL REFERENCES "saveti_clanci"("id") ON DELETE RESTRICT,
  "termin" timestamp with time zone NOT NULL,
  "zakazao" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "zakazano" timestamp with time zone NOT NULL DEFAULT now(),
  "otkazano" timestamp with time zone,
  "otkazao" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "izvrseno" timestamp with time zone,
  CONSTRAINT "saveti_zakazivanja_jedan_ishod_check" CHECK ("otkazano" IS NULL OR "izvrseno" IS NULL)
);
--> statement-breakpoint
-- Jedan članak ima najviše jedan termin koji čeka (više članaka sme imati isti trenutak).
CREATE UNIQUE INDEX IF NOT EXISTS "saveti_zakazivanja_clanak_key" ON "saveti_zakazivanja" ("clanak_id") WHERE "otkazano" IS NULL AND "izvrseno" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saveti_zakazivanja_ceka_idx" ON "saveti_zakazivanja" ("termin") WHERE "otkazano" IS NULL AND "izvrseno" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saveti_objave" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "termin" timestamp with time zone,
  "zakazivanje_id" uuid REFERENCES "saveti_zakazivanja"("id") ON DELETE RESTRICT,
  "clanak_id" text REFERENCES "saveti_clanci"("id") ON DELETE RESTRICT,
  "verzija_id" uuid REFERENCES "saveti_verzije"("id") ON DELETE RESTRICT,
  "ishod" text NOT NULL,
  "razlog" text NOT NULL,
  "korisnik" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "vreme" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "saveti_objave_ishod_check" CHECK ("ishod" IN ('objavljeno', 'objavljene_izmene')),
  CONSTRAINT "saveti_objave_objava_check" CHECK ("clanak_id" IS NOT NULL AND "verzija_id" IS NOT NULL)
);
--> statement-breakpoint
-- Jedno zakazivanje daje najviše jednu objavu (ponovljeno usklađivanje ne objavljuje dvaput).
CREATE UNIQUE INDEX IF NOT EXISTS "saveti_objave_zakazivanje_key" ON "saveti_objave" ("zakazivanje_id") WHERE "zakazivanje_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saveti_adrese" (
  "slug" text PRIMARY KEY,
  "clanak_id" text NOT NULL REFERENCES "saveti_clanci"("id") ON DELETE RESTRICT,
  "do" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Verzije, događaji, objave i slike se samo dodaju (i za vlasnika tabele, osim kroz migraciju).
CREATE OR REPLACE FUNCTION "saveti_samo_dodavanje"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% se samo dodaje', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "saveti_verzije_samo_dodavanje" ON "saveti_verzije";
--> statement-breakpoint
CREATE TRIGGER "saveti_verzije_samo_dodavanje" BEFORE UPDATE OR DELETE ON "saveti_verzije"
  FOR EACH ROW EXECUTE FUNCTION "saveti_samo_dodavanje"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "saveti_dogadjaji_samo_dodavanje" ON "saveti_dogadjaji";
--> statement-breakpoint
CREATE TRIGGER "saveti_dogadjaji_samo_dodavanje" BEFORE UPDATE OR DELETE ON "saveti_dogadjaji"
  FOR EACH ROW EXECUTE FUNCTION "saveti_samo_dodavanje"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "saveti_objave_samo_dodavanje" ON "saveti_objave";
--> statement-breakpoint
CREATE TRIGGER "saveti_objave_samo_dodavanje" BEFORE UPDATE OR DELETE ON "saveti_objave"
  FOR EACH ROW EXECUTE FUNCTION "saveti_samo_dodavanje"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "saveti_slike_samo_dodavanje" ON "saveti_slike";
--> statement-breakpoint
CREATE TRIGGER "saveti_slike_samo_dodavanje" BEFORE UPDATE OR DELETE ON "saveti_slike"
  FOR EACH ROW EXECUTE FUNCTION "saveti_samo_dodavanje"();
--> statement-breakpoint
-- Zakazivanje: jedina izmena je jednokratna oznaka — otkazano ILI izvršeno (termin i verzija se ne menjaju).
CREATE OR REPLACE FUNCTION "saveti_zakazivanja_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'zakazivanje se ne briše, samo otkazuje' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."otkazano" IS NOT NULL OR OLD."izvrseno" IS NOT NULL
     OR NEW."verzija_id" IS DISTINCT FROM OLD."verzija_id"
     OR NEW."clanak_id" IS DISTINCT FROM OLD."clanak_id"
     OR NEW."termin" IS DISTINCT FROM OLD."termin"
     OR NEW."zakazao" IS DISTINCT FROM OLD."zakazao"
     OR NEW."zakazano" IS DISTINCT FROM OLD."zakazano"
     OR (NEW."otkazano" IS NULL) = (NEW."izvrseno" IS NULL) THEN
    RAISE EXCEPTION 'zakazivanje se menja samo jednokratnim otkazivanjem ili izvršenjem' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "saveti_zakazivanja_guard" ON "saveti_zakazivanja";
--> statement-breakpoint
CREATE TRIGGER "saveti_zakazivanja_guard" BEFORE UPDATE OR DELETE ON "saveti_zakazivanja"
  FOR EACH ROW EXECUTE FUNCTION "saveti_zakazivanja_guard"();
--> statement-breakpoint
-- Javna verzija mora pripadati istom članku.
CREATE OR REPLACE FUNCTION "saveti_clanci_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'članak se ne briše, samo povlači' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."javna_verzija_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "saveti_verzije" v WHERE v."id" = NEW."javna_verzija_id" AND v."clanak_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'javna verzija ne pripada članku %', NEW."id" USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."strucna_potvrda_potrebna" AND NOT NEW."strucna_potvrda_potrebna" THEN
    RAISE EXCEPTION 'zahtev za stručnu potvrdu se ne uklanja, samo ispunjava' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "saveti_clanci_guard" ON "saveti_clanci";
--> statement-breakpoint
CREATE TRIGGER "saveti_clanci_guard" BEFORE INSERT OR UPDATE OR DELETE ON "saveti_clanci"
  FOR EACH ROW EXECUTE FUNCTION "saveti_clanci_guard"();
