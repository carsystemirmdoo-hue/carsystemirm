-- Uloge za rezervne kopije. IDEMPOTENTNO. Bez lozinki — postavljaju se van repozitorijuma.
--
-- Pokreće vlasnik šeme, nikad aplikacija:
--
--   psql "$MIGRATION_DATABASE_URL" -v reader_role=carsystem_backup_reader \
--        -v status_role=carsystem_backup_status -f db/provisioning/backup-roles.sql
--
-- reader_role — čita SVE (pg_dump cele baze). Ne sme da piše ništa.
--   Koristi se samo u tajnom koraku kopije (GitHub Actions privatnog repoa).
-- status_role — sme ISKLJUČIVO da doda red u backup_runs. Ne čita ni jednu
--   tabelu; ni sopstvene upise. Koristi je posao kopije i preuzimanje van GitHub-a.
--
-- Obe uloge se prave ranije, uz lozinku, u konzoli baze (Neon: Roles), sa
-- NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT izuzev članstva ispod.
--
-- ⚠️ NIJE PRIMENJENO. Primena je deo uključivanja automatike (odluka vlasnika).

\set reader_role :reader_role
\set status_role :status_role
SELECT set_config('my.reader_role', :'reader_role', false), set_config('my.status_role', :'status_role', false);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_setting('my.reader_role')) THEN
    RAISE EXCEPTION 'Uloga % ne postoji — napravite je uz lozinku van ove skripte.', current_setting('my.reader_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_setting('my.status_role')) THEN
    RAISE EXCEPTION 'Uloga % ne postoji — napravite je uz lozinku van ove skripte.', current_setting('my.status_role');
  END IF;
END $$;

-- Čitalac: ugrađena uloga pg_read_all_data (PG14+) = SELECT nad svim tabelama i
-- sekvencama, bez prava upisa. pg_dump traži još samo USAGE nad šemama.
GRANT pg_read_all_data TO :reader_role;
GRANT USAGE ON SCHEMA public, drizzle TO :reader_role;

-- Upis statusa: samo INSERT nad backup_runs.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :status_role;
GRANT USAGE ON SCHEMA public TO :status_role;
GRANT INSERT ON backup_runs TO :status_role;

-- PROVERA POSLE PRIMENE (očekivano: t, f, f, t, f):
--   SELECT has_table_privilege(:'reader_role', 'invoices', 'SELECT'),
--          has_table_privilege(:'reader_role', 'invoices', 'INSERT'),
--          has_table_privilege(:'status_role', 'invoices', 'SELECT'),
--          has_table_privilege(:'status_role', 'backup_runs', 'INSERT'),
--          has_table_privilege(:'status_role', 'backup_runs', 'SELECT');
