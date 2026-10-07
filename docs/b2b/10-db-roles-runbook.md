# 10 — Razdvajanje DB naloga: runbook

**Status: 🟡 kod je spreman, primena na produkciji je spoljni blocker.**

> Dopuna 2026-10-01: skripta sada daje prava nad SVIM tabelama i view-ovima
> (ranije samo 18 tabela iz 0000–0007) i štiti sve četiri tabele samo za
> dodavanje. Primenjena je na lokalnu Postgres 17 bazu sa migracijama
> 0000–0032 u integracionom testu `db/integration/runtimeRole.integration.test.mts`.
> Na bazi kod provajdera još nije primenjena. Postupak: `33-test-baza-runbook.md`.

---

## Zašto

Aplikacija danas radi nalogom koji je **vlasnik tabela** i sme sve. Posledica:
kompromitovan portal može da izvrši `DROP TRIGGER audit_log_no_delete`, pa onda i
`DELETE FROM audit_log` — čime nestaje jedini trag o tome šta se dogodilo.

Okidač iz migracije `0001` štiti od **greške u kodu**. Ne štiti od naloga koji
sme da ga ukloni. Jedina prava zaštita je oduzimanje prava na nivou uloge.

## Ciljni ugovor

| Promenljiva | Nalog | Sme |
|---|---|---|
| `MIGRATION_DATABASE_URL` | vlasnik šeme | DDL, migracije |
| `DATABASE_URL` | ograničeni runtime | samo DML, bez `UPDATE`/`DELETE` nad `audit_log` |

**Migration nalog se nikada ne koristi iz request runtime-a.**

## Šta je već urađeno u kodu 🟢

`db/migrate.mjs`:

- u produkciji (`NODE_ENV=production` ili `VERCEL_ENV=production`) **zahteva**
  `MIGRATION_DATABASE_URL` i izlazi sa kodom 1 ako ga nema;
- u razvoju dozvoljava izričit povratak na `DATABASE_URL`, jer lokalna PGlite
  baza ima jedan nalog;
- ispisuje koji je nalog upotrebljen, da se u logu deploya vidi.

`db/provisioning/runtime-role.sql` — idempotentna skripta koja:

- oduzima `CREATE` na `public` šemi;
- daje `SELECT, INSERT, UPDATE, DELETE` nad poslovnim tabelama;
- daje **samo `SELECT, INSERT`** nad `audit_log`;
- izričito radi `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log`;
- postavlja `ALTER DEFAULT PRIVILEGES`, da nova migracija ne otvori rupu;
- **ne sadrži nijednu lozinku.**

## Šta nije urađeno 🔴

**Skripta nije izvršena ni na jednoj bazi** — ni produkcijskoj ni test.

Razlog: nema dostupne disposable Postgres baze u ovom okruženju. Lokalna
razvojna baza je PGlite (`npm run db:dev`), koja ima jedan ugrađen nalog i ne
podržava `CREATE ROLE` ni granularne grantove — pa se ugovor na njoj **ne može
proveriti**.

**Ne tvrdim da su privilegije aktivne.**

## Postupak primene (vlasnik / DevOps)

1. **Napravi runtime nalog** kod provajdera (Neon/Supabase/…), sa lozinkom koja
   se nigde ne zapisuje u repozitorijum:

   ```sql
   CREATE ROLE carsystem_app LOGIN PASSWORD '…' NOSUPERUSER NOCREATEDB NOCREATEROLE;
   ```

2. **Primeni grantove** vlasničkim nalogom:

   ```bash
   psql "$MIGRATION_DATABASE_URL" -v runtime_role=carsystem_app \
        -f db/provisioning/runtime-role.sql
   ```

3. **Proveri ishod** — očekivano `f`, `f`, `f`:

   ```sql
   SELECT has_table_privilege('carsystem_app', 'audit_log', 'UPDATE');
   SELECT has_table_privilege('carsystem_app', 'audit_log', 'DELETE');
   SELECT has_schema_privilege('carsystem_app', 'public', 'CREATE');
   ```

   i `t`, `t`:

   ```sql
   SELECT has_table_privilege('carsystem_app', 'audit_log', 'INSERT');
   SELECT has_table_privilege('carsystem_app', 'users', 'UPDATE');
   ```

4. **Prebaci promenljive**: `DATABASE_URL` → runtime nalog,
   `MIGRATION_DATABASE_URL` → vlasnički.

5. **Pokreni migracije** i potvrdi da log kaže „koristi se MIGRATION_DATABASE_URL".

6. **Provera zdravog razuma:** prijava u portal i jedan izvoz moraju raditi; ručni
   pokušaj `DELETE FROM audit_log` runtime nalogom mora **pasti**.

## Ograničenja provajdera

Neki upravljani Postgres servisi ne daju pravog superusera ni slobodno
kreiranje uloga. Pre primene proveriti da li provajder dozvoljava:

- `CREATE ROLE`;
- `ALTER DEFAULT PRIVILEGES` u `public` šemi;
- odvojene connection stringove.

Ako ne dozvoljava, ovo ostaje **otvoren rizik** i mora se rešiti izborom
provajdera — vidi `09-owner-decisions-and-blockers.md`, P14.

## Rollback

Grantovi se vraćaju istim putem (`GRANT ALL … TO carsystem_app`), a
`DATABASE_URL` na prethodni nalog. Ništa u aplikaciji ne zavisi od ove promene —
kod radi i sa jednim i sa dva naloga.
