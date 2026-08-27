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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_setting('my.runtime_role', true)) THEN
    RAISE NOTICE 'Uloga % ne postoji — kreirajte je uz lozinku van ove skripte.', current_setting('my.runtime_role', true);
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
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, permission_packages, user_permissions,
  customers, customer_assignments,
  articles, salespeople, invoices, invoice_lines,
  import_runs, import_rows,
  system_settings, user_preferences,
  auth_rate_limits, user_mfa, mfa_recovery_codes,
  password_reset_codes, mfa_enrollment_grants
TO :runtime_role;

-- 5. AUDIT: samo čitanje i dodavanje.
--
--    Ovo je srž cele skripte. Okidač iz migracije 0001 odbija UPDATE i DELETE,
--    ali ga vlasnik tabele može ukloniti sa `DROP TRIGGER`. Oduzimanjem prava
--    na nivou uloge, aplikacija to ne može ni da pokuša.
GRANT SELECT, INSERT ON audit_log TO :runtime_role;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM :runtime_role;

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
--   SELECT has_schema_privilege(:'runtime_role', 'public', 'CREATE');
--
-- Očekivano `t` (true):
--
--   SELECT has_table_privilege(:'runtime_role', 'audit_log', 'INSERT');
--   SELECT has_table_privilege(:'runtime_role', 'users', 'UPDATE');
