-- Razdvajanje migration i runtime naloga.
--
-- IDEMPOTENTNO. Bez lozinki — lozinka se postavlja odvojeno, van repozitorijuma.
--
-- ZAŠTO
-- =====
-- Aplikacija danas radi nalogom koji je vlasnik tabela i sme sve. To znači da
-- kompromitovan portal može da obriše audit trigger (`DROP TRIGGER`), pa onda i
-- same audit zapise — čime se gubi jedini trag o tome šta se dogodilo.
--
-- Posle ovoga aplikacija dobija tačno ono što joj treba, i ništa više.
--
-- KAKO SE PRIMENJUJE
-- ==================
-- Pokreće se nalogom koji je vlasnik šeme (obično isti onaj koji radi migracije),
-- nikad iz aplikacije:
--
--   psql "$MIGRATION_DATABASE_URL" -v runtime_role=carsystem_app \
--        -f db/provisioning/runtime-role.sql
--
-- Zatim se `DATABASE_URL` prebaci na taj nalog, a `MIGRATION_DATABASE_URL`
-- ostaje na vlasničkom.
--
-- ⚠️ NIJE PRIMENJENO NA PRODUKCIJI. Vidi docs/b2b/10-db-roles-runbook.md.

\set runtime_role :runtime_role

-- 1. Nalog postoji, ali bez ijednog nasleđenog prava.
--    psql promenljive se ne zamenjuju unutar `$$ … $$`, zato se ime uloge
--    prvo upisuje u podešavanje sesije, pa ga DO blok čita odatle.
SELECT set_config('my.runtime_role', :'runtime_role', false);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_setting('my.runtime_role')) THEN
    RAISE EXCEPTION 'Uloga % ne postoji — kreirajte je uz lozinku van ove skripte, pa ponovite.',
      current_setting('my.runtime_role');
  END IF;
END $$;

-- 2. Oduzimanje svega što je nalog mogao naslediti.
--    `PUBLIC` podrazumevano ima `CREATE` na `public` šemi u starijim verzijama.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :runtime_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :runtime_role;

-- 3. Osnovni pristup: sme da vidi šemu, ali ne i da pravi objekte u njoj.
GRANT USAGE ON SCHEMA public TO :runtime_role;

-- 4. Poslovne tabele — pun DML, bez DDL.
--
--    `ALL TABLES` obuhvata i view-ove (`effective_sales_ledger`,
--    `recommendation_input_lines`). Ranije je ovde stajao ručni spisak od 18
--    tabela iz migracija 0000–0007; svaka kasnija tabela je ostajala bez prava,
--    jer `ALTER DEFAULT PRIVILEGES` (korak 7) važi samo za tabele napravljene
--    POSLE primene skripte. Ograničenja za tabele samo za dodavanje slede u
--    koraku 5 i idu POSLE ovog koraka, da ga suze.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :runtime_role;

-- 5. Tabele samo za dodavanje: čitanje i dodavanje, bez izmene i brisanja.
--
--    Ovo je srž cele skripte. Okidači (0001, 0014, 0025, 0028) odbijaju
--    izmenu i brisanje, ali ih vlasnik tabele može ukloniti sa `DROP TRIGGER`.
--    Oduzimanjem prava na nivou uloge, aplikacija to ne može ni da pokuša.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log, customer_contact_consents, sync_command_events, sync_device_cycles FROM :runtime_role;
GRANT SELECT, INSERT ON audit_log, customer_contact_consents, sync_command_events, sync_device_cycles TO :runtime_role;

--    Osnovne cene (0038): istorija cena i pročitane stavke cenovnika se samo
--    dodaju. Otpremanje cenovnika se ne briše; jedina izmena je jednokratna
--    odluka (primena/odbacivanje), koju okidač iz 0038 sužava.
REVOKE UPDATE, DELETE, TRUNCATE ON article_base_prices, price_list_import_rows FROM :runtime_role;
GRANT SELECT, INSERT ON article_base_prices, price_list_import_rows TO :runtime_role;
REVOKE DELETE, TRUNCATE ON price_list_imports FROM :runtime_role;

--    Potvrda kontakta se ne briše; jedina dozvoljena izmena je opoziv
--    (`revoked_at`, `revoked_by`, `revocation_reason`), koju okidač iz 0028
--    sužava na te kolone.
REVOKE DELETE, TRUNCATE ON customer_contact_verifications FROM :runtime_role;

--    Zapis naknadnog storna (0033) se ne briše; aplikacija ga samo upisuje i
--    menja stanje (`lib/pdf/reversal.ts`), a okidač čuva odštampanu referencu.
--    UPDATE ostaje (prelaz stanja), DELETE i TRUNCATE se oduzimaju.
REVOKE DELETE, TRUNCATE ON invoice_reversals FROM :runtime_role;

--    Evidencija rezervnih kopija (0036): aplikacija je samo ČITA. Upisuje je
--    posebna uloga iz backup-roles.sql; portal ne sme da proglasi kopiju
--    uspešnom.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON backup_runs FROM :runtime_role;
GRANT SELECT ON backup_runs TO :runtime_role;
--    Potpisana potvrda uređaja (0037) ide SAMO kroz funkciju koja proverava da
--    li kopija odgovara proverenom GitHub prolazu; `db_verified` ne može.
DO $$
BEGIN
  IF to_regprocedure('record_device_backup(backup_run_kind, text, text, text, bigint, integer, integer, integer, bigint, timestamptz)') IS NOT NULL THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION record_device_backup(backup_run_kind, text, text, text, bigint, integer, integer, integer, bigint, timestamptz) TO %I',
                   current_setting('my.runtime_role'));
  END IF;
END $$;

-- 6. Sekvence — `nextval` za `bigserial` kolone.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :runtime_role;

-- 7. Buduće tabele nasleđuju isto pravilo, da nova migracija ne otvori rupu.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :runtime_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :runtime_role;

-- 8. Nalog ne sme menjati sopstvena prava ni preuzimati vlasništvo.
--    (`NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE` se postavljaju pri kreiranju.)
REVOKE ALL ON SCHEMA information_schema FROM :runtime_role;

-- PROVERA POSLE PRIMENE
-- =====================
-- Očekivano `f` (false) za sve:
--
--   SELECT has_table_privilege(:'runtime_role', 'audit_log', 'UPDATE');
--   SELECT has_table_privilege(:'runtime_role', 'audit_log', 'DELETE');
--   SELECT has_table_privilege(:'runtime_role', 'customer_contact_consents', 'UPDATE');
--   SELECT has_table_privilege(:'runtime_role', 'sync_command_events', 'DELETE');
--   SELECT has_table_privilege(:'runtime_role', 'customer_contact_verifications', 'DELETE');
--   SELECT has_schema_privilege(:'runtime_role', 'public', 'CREATE');
--
-- Očekivano `t` (true):
--
--   SELECT has_table_privilege(:'runtime_role', 'audit_log', 'INSERT');
--   SELECT has_table_privilege(:'runtime_role', 'users', 'UPDATE');
--   SELECT has_table_privilege(:'runtime_role', 'recommendation_results', 'INSERT');
--   SELECT has_table_privilege(:'runtime_role', 'effective_sales_ledger', 'SELECT');
