/*
 * Pravilo čuvanja lagera (0051, dok. 65 §3a; odluka vlasnika 15. 10. 2026).
 *
 * Detaljne stavke (`stock_import_lines`) čuvaju se SAMO za poslednja dva potvrđena snimka.
 * Starijim potvrđenim snimcima i proverenim, ali nepotvrđenim ili odbačenim otpremanjima
 * starijim od 7 dana stavke se brišu; zapis otpremanja (datum stanja, ko je uvezao i potvrdio,
 * ishod, broj stavki, otisak fajla, sažetak) i audit ostaju trajno, uz oznaku
 * `lines_purged_at` / `lines_purged_reason`.
 *
 * Brisanje NE dobija aplikacioni nalog: on i dalje nema DELETE nad stavkama (runtime-role.sql),
 * a okidači dozvoljavaju brisanje stavki i upis oznake samo vlasniku tabele — tj. funkciji
 * `stock_import_retention()` (SECURITY DEFINER, bez parametara, fiksan search_path). Funkcija
 * i potvrda koriste isto transakciono savetodavno zaključavanje, pa se paralelne potvrde i
 * čišćenja izvršavaju jedno za drugim. Nov upload, neuspešna provera i nepotvrđen fajl ne mogu
 * obrisati nijedan od dva poslednja potvrđena snimka (pravilo se računa samo nad potvrđenima).
 */
ALTER TABLE "stock_imports" ADD COLUMN IF NOT EXISTS "lines_purged_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "stock_imports" ADD COLUMN IF NOT EXISTS "lines_purged_reason" text;
--> statement-breakpoint
ALTER TABLE "stock_imports" ADD CONSTRAINT "stock_imports_purge_check" CHECK (
  ("lines_purged_at" IS NULL) = ("lines_purged_reason" IS NULL) AND
  ("lines_purged_reason" IS NULL OR "lines_purged_reason" IN ('starija_od_dva_potvrdjena', 'nepotvrdjeno_7_dana'))
);
--> statement-breakpoint
-- Stavke: samo dodavanje; brisanje jedino kroz postupak čuvanja (vlasnik tabele).
CREATE OR REPLACE FUNCTION "stock_import_lines_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = TG_RELID) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% se samo dodaje', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;
--> statement-breakpoint
-- Otpremanje: jedna odluka iz 'pregled'; podaci fajla nikad; oznaka čišćenja samo kroz postupak.
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
      NEW."uploaded_by", NEW."uploaded_at")
     IS NOT DISTINCT FROM
     (OLD."file_sha256", OLD."file_name", OLD."file_bytes", OLD."file_format", OLD."parser_version", OLD."warehouse_code",
      OLD."warehouse_name", OLD."stock_date", OLD."printed_on", OLD."line_count", OLD."summary", OLD."problems",
      OLD."uploaded_by", OLD."uploaded_at");
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "stock_import_retention"()
RETURNS TABLE ("purged_imports" integer, "purged_lines" integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ids uuid[];
  v_lines integer := 0;
BEGIN
  -- Isti ključ drži i potvrda (lib/stock/stock-import-service.ts): potvrde i čišćenja idu jedno za drugim.
  PERFORM pg_advisory_xact_lock(hashtext('stock_imports_retention'));
  SELECT coalesce(array_agg(i.id), '{}') INTO v_ids
    FROM stock_imports i
   WHERE i.lines_purged_at IS NULL
     AND EXISTS (SELECT 1 FROM stock_import_lines l WHERE l.import_id = i.id)
     AND (
       (i.status = 'potvrdjeno' AND i.id NOT IN (
          SELECT k.id FROM stock_imports k WHERE k.status = 'potvrdjeno' ORDER BY k.decided_at DESC, k.id DESC LIMIT 2))
       OR (i.status IN ('pregled', 'odbaceno') AND i.uploaded_at < now() - interval '7 days')
     );
  IF cardinality(v_ids) = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;
  DELETE FROM stock_import_lines WHERE import_id = ANY (v_ids);
  GET DIAGNOSTICS v_lines = ROW_COUNT;
  UPDATE stock_imports
     SET lines_purged_at = now(),
         lines_purged_reason = CASE WHEN status = 'potvrdjeno' THEN 'starija_od_dva_potvrdjena' ELSE 'nepotvrdjeno_7_dana' END
   WHERE id = ANY (v_ids);
  RETURN QUERY SELECT cardinality(v_ids), v_lines;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "stock_import_retention"() FROM PUBLIC;
