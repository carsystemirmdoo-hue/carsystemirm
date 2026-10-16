/*
 * Interna evidencija opreme (0054; potvrda vlasnika 16. 10. 2026).
 *
 * Mešači (npr. 000119 MESAC FIL-BLCA2028/6) su OPREMA koja se izdaje na revers: ne prodaju se i
 * nemaju prodajno pakovanje. Evidencija je po BizniSoft šifri (TEKST, sa vodećim nulama), jer većina
 * takvih šifara nikad nije bila na fakturi pa ih nema u `articles`. Klasifikacija nije „van programa“
 * i ne briše istoriju; samo izuzima šifru iz prodajne ponude, kupčevog prikaza lagera i spiska
 * nerešenih prodajnih pakovanja. Nedostajuća JM se ne izmišlja (NULL = podatak za dopunu).
 * Kome je konkretan mešač izdat vodi se posebno, prema stvarnim reversima (nije deo ove tabele).
 */
CREATE TABLE IF NOT EXISTS "internal_equipment" (
  "code" text PRIMARY KEY,
  "code_key" text NOT NULL,
  "name" text NOT NULL,
  "unit" text,
  "classification" text NOT NULL DEFAULT 'oprema_revers',
  "evidence" text NOT NULL,
  "note" text,
  "decided_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "internal_equipment_code_check" CHECK ("code" ~ '^[0-9A-Za-z][0-9A-Za-z./-]{0,39}$'),
  CONSTRAINT "internal_equipment_key_unique" UNIQUE ("code_key"),
  CONSTRAINT "internal_equipment_text_check" CHECK (
    length("name") BETWEEN 1 AND 300 AND
    ("unit" IS NULL OR "unit" ~ '^[A-ZČĆŠŽĐ]{1,5}$') AND
    "classification" IN ('oprema_revers') AND
    length("evidence") BETWEEN 3 AND 1000 AND
    ("note" IS NULL OR length("note") <= 500)
  )
);
--> statement-breakpoint
-- Zapis se ne briše (istorija); dopuna JM/napomene ostaje moguća (UPDATE), šifra i ključ se ne menjaju.
CREATE OR REPLACE FUNCTION "internal_equipment_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'evidencija opreme se ne briše' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW."code", NEW."code_key", NEW."decided_by", NEW."decided_at") IS DISTINCT FROM (OLD."code", OLD."code_key", OLD."decided_by", OLD."decided_at") THEN
    RAISE EXCEPTION 'šifra i odluka opreme se ne menjaju' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "internal_equipment_guard" ON "internal_equipment";
--> statement-breakpoint
CREATE TRIGGER "internal_equipment_guard" BEFORE UPDATE OR DELETE ON "internal_equipment"
  FOR EACH ROW EXECUTE FUNCTION "internal_equipment_guard"();
