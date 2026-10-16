/*
 * Lager iz PDF-a i otisak sadržaja (0053, dok. 65 §1b; 15. 10. 2026).
 *
 * - `file_format` prima i 'pdf' (BizniSoft „Zbirni pregled po artiklima“, tekstualni PDF);
 * - `content_sha256`: otisak normalizovanog sadržaja (magacin, datum stanja, stavke sa stanjem ≠ 0).
 *   PDF i XLSX istog stanja imaju različit SHA-256 fajla, ali isti otisak sadržaja; najviše jedan
 *   zapis sa istim sadržajem može biti „pregled“ ili „potvrđeno“ — nema dva istovetna snimka.
 *   Otisak je deo podataka otpremanja i ne menja se (okidač čuvara).
 * Samo dodavanje kolone, indeksa i proširenje provere; postojeći redovi dobijaju NULL.
 */
ALTER TABLE "stock_imports" ADD COLUMN IF NOT EXISTS "content_sha256" text;
--> statement-breakpoint
ALTER TABLE "stock_imports" ADD CONSTRAINT "stock_imports_content_sha_check" CHECK ("content_sha256" IS NULL OR "content_sha256" ~ '^[0-9a-f]{64}$');
--> statement-breakpoint
ALTER TABLE "stock_imports" DROP CONSTRAINT "stock_imports_text_check";
--> statement-breakpoint
ALTER TABLE "stock_imports" ADD CONSTRAINT "stock_imports_text_check" CHECK (
  length("file_name") BETWEEN 1 AND 200 AND length("parser_version") <= 60 AND
  "file_format" IN ('xlsx', 'csv', 'pdf') AND
  ("warehouse_code" IS NULL OR "warehouse_code" ~ '^[0-9]{2,4}$') AND
  ("warehouse_name" IS NULL OR length("warehouse_name") <= 120) AND
  ("decision_note" IS NULL OR length("decision_note") <= 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_imports_content_live_key" ON "stock_imports" ("content_sha256")
  WHERE "content_sha256" IS NOT NULL AND "status" IN ('pregled', 'potvrdjeno');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "stock_imports_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  frozen_same boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'otpremanje lagera se ne briše' USING ERRCODE = 'insufficient_privilege';
  END IF;
  frozen_same := (NEW."file_sha256", NEW."file_name", NEW."file_bytes", NEW."file_format", NEW."parser_version", NEW."warehouse_code",
      NEW."warehouse_name", NEW."stock_date", NEW."printed_on", NEW."line_count", NEW."summary", NEW."problems",
      NEW."uploaded_by", NEW."uploaded_at", NEW."content_sha256")
     IS NOT DISTINCT FROM
     (OLD."file_sha256", OLD."file_name", OLD."file_bytes", OLD."file_format", OLD."parser_version", OLD."warehouse_code",
      OLD."warehouse_name", OLD."stock_date", OLD."printed_on", OLD."line_count", OLD."summary", OLD."problems",
      OLD."uploaded_by", OLD."uploaded_at", OLD."content_sha256");
  IF NOT frozen_same THEN
    RAISE EXCEPTION 'podaci otpremljenog lagera se ne menjaju' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Oznaka čišćenja: jednom, samo vlasnik tabele (postupak čuvanja), bez promene odluke.
  IF (NEW."lines_purged_at", NEW."lines_purged_reason") IS DISTINCT FROM (OLD."lines_purged_at", OLD."lines_purged_reason") THEN
    IF OLD."lines_purged_at" IS NOT NULL
       OR current_user <> (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = TG_RELID)
       OR (NEW."status", NEW."decided_by", NEW."decided_at", NEW."decision_note")
          IS DISTINCT FROM (OLD."status", OLD."decided_by", OLD."decided_at", OLD."decision_note") THEN
      RAISE EXCEPTION 'oznaka čišćenja se upisuje samo postupkom čuvanja' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."status" <> 'pregled' OR NEW."status" NOT IN ('potvrdjeno', 'odbaceno') THEN
    RAISE EXCEPTION 'odluka o lageru je konačna' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."status" = 'potvrdjeno' AND OLD."lines_purged_at" IS NOT NULL THEN
    RAISE EXCEPTION 'stavke ovog otpremanja su uklonjene — potvrda nije moguća' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
