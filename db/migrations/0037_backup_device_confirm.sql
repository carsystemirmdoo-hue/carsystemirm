/*
 * Potvrda kopije sa firminog računara preko POTPISANOG kanala uređaja (0037).
 *
 * Do sada je računar za drugu kopiju upisivao `offsite_stored` i `pdf_backup`
 * ulogom baze sa lozinkom. Sada računar nema nikakav pristup bazi: šalje
 * potpisan izveštaj (Ed25519 ključ konektora) na /api/sync/backup, a aplikacija
 * ga upisuje ISKLJUČIVO kroz ovu funkciju.
 *
 * Aplikacija i dalje nema INSERT nad backup_runs (runtime-role.sql). Funkcija
 * sme samo:
 *   offsite_stored — ako postoji USPEŠAN `db_verified` zapis istog GitHub
 *                    prolaza sa ISTIM otiskom šifrovane kopije. Računar time
 *                    dokazuje da drži baš fajl koji je GitHub proverio; izmišljena
 *                    kopija ne može da postane „sačuvana van GitHub-a“.
 *                    Ponovljena potvrda istog prolaza sa istog uređaja ne pravi
 *                    nov red (stara kopija ne može da „osveži“ rok).
 *   pdf_backup     — samo brojevi (novih, promenjenih, nestalih, ukupno).
 * `db_verified` ne može nikako.
 */
CREATE OR REPLACE FUNCTION "record_device_backup"(
  p_kind backup_run_kind,
  p_device text,
  p_github_run_id text,
  p_encrypted_sha256 text,
  p_bytes bigint,
  p_files_new integer,
  p_files_changed integer,
  p_files_missing integer,
  p_objects bigint,
  p_started_at timestamptz
) RETURNS TABLE (run_id uuid, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_src backup_runs%ROWTYPE;
  v_by text;
  v_id uuid;
BEGIN
  IF p_device IS NULL OR p_device !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' THEN
    RAISE EXCEPTION 'neispravna oznaka uređaja' USING ERRCODE = '22023';
  END IF;
  v_by := 'uredjaj:' || p_device;

  IF p_kind = 'offsite_stored' THEN
    IF p_github_run_id IS NULL OR p_github_run_id !~ '^[0-9]{1,20}$'
       OR p_encrypted_sha256 IS NULL OR p_encrypted_sha256 !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'nepotpuna potvrda kopije' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_src FROM backup_runs
     WHERE kind = 'db_verified' AND ok AND github_run_id = p_github_run_id AND encrypted_sha256 = p_encrypted_sha256
     ORDER BY finished_at DESC LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'kopija nije poznata kao proverena' USING ERRCODE = 'P0002';
    END IF;
    SELECT id INTO v_id FROM backup_runs
     WHERE kind = 'offsite_stored' AND ok AND github_run_id = p_github_run_id AND recorded_by = v_by
     LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_id, false;
      RETURN;
    END IF;
    INSERT INTO backup_runs (kind, ok, started_at, source_label, dump_sha256, encrypted_sha256, bytes, migrations, tables, rows, detail, github_run_id, recorded_by)
    VALUES ('offsite_stored', true, v_src.started_at, v_src.source_label, v_src.dump_sha256, p_encrypted_sha256,
            greatest(coalesce(p_bytes, 0), 0), v_src.migrations, v_src.tables, v_src.rows,
            'potpisana potvrda uređaja ' || p_device, p_github_run_id, v_by)
    RETURNING id INTO v_id;
    RETURN QUERY SELECT v_id, true;
    RETURN;
  END IF;

  IF p_kind = 'pdf_backup' THEN
    IF least(coalesce(p_files_new, -1), coalesce(p_files_changed, -1), coalesce(p_files_missing, -1), coalesce(p_objects, -1)) < 0 THEN
      RAISE EXCEPTION 'nepotpun izveštaj PDF kopije' USING ERRCODE = '22023';
    END IF;
    INSERT INTO backup_runs (kind, ok, started_at, files_new, files_changed, files_missing, rows, detail, recorded_by)
    VALUES ('pdf_backup', true, p_started_at, p_files_new, p_files_changed, p_files_missing, p_objects,
            'potpisana potvrda uređaja ' || p_device, v_by)
    RETURNING id INTO v_id;
    RETURN QUERY SELECT v_id, true;
    RETURN;
  END IF;

  RAISE EXCEPTION 'uređaj ne može da potvrdi ovu vrstu kopije' USING ERRCODE = '42501';
END $$;
--> statement-breakpoint
-- Funkcije su podrazumevano izvršive za PUBLIC; ovu sme samo aplikacija (runtime-role.sql).
REVOKE ALL ON FUNCTION "record_device_backup"(backup_run_kind, text, text, text, bigint, integer, integer, integer, bigint, timestamptz) FROM PUBLIC;
