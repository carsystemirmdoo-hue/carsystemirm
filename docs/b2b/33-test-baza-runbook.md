# 33 — Testna baza kod provajdera: runbook

**Status: pripremljeno, ništa nije kreirano.** Ovaj dokument opisuje postupak.
Bazu kreira firma (ili mi uz izričito odobrenje), na nalogu u vlasništvu firme.

Cilj prve baze je **zatvoren tehnički test** sa izmišljenim i anonimizovanim
podacima: migracije, uloge, prijava Vlasnika sa drugim faktorom, uvoz jedne
anonimizovane fakture. Stvarni kupci i stvarne fakture u nju ne ulaze.

---

## 1. Šta kod traži od baze (provereno lokalno, 2026-10-01)

| Uslov | Zašto |
|---|---|
| PostgreSQL 13+ (testirano na 17) | `gen_random_uuid()` bez ekstenzije |
| Bez ekstenzija, bez superuser-a | migracije 0000–0032 ih ne traže |
| Vlasnik šeme sme `CREATE` na bazi | Drizzle pravi šemu `drizzle` za evidenciju migracija |
| `CREATE ROLE` i `ALTER DEFAULT PRIVILEGES` | runtime uloga iz `db/provisioning/runtime-role.sql` |
| Pooled **i** direktna adresa | runtime ide kroz pooler; migracije i zaštita Vlasnika direktno |
| TLS | `?sslmode=require` u adresi |
| EU region | podaci kupaca; Vercel funkcije u istom regionu |

Lokalni dokaz: prazna baza → migracije 0000–0032 (33 unosa, 51 tabela) →
`runtime-role.sql` → integracioni paket 492/492 (`npm run test:integration`).

## 2. Preporučeni izbor

**Neon, besplatni nivo, region Frankfurt (AWS eu-central-1)**, projekat na
nalogu firme. Kod radi bez izmena: `prepare: false` u `db/client.ts` je
kompatibilan sa Neon pooler-om.

Pre otvaranja proveriti na sajtu provajdera (nije potvrđeno u ovom repou):
- trenutna ograničenja besplatnog nivoa (veličina, broj grana, gašenje u
  mirovanju i hladan start);
- koliko unazad besplatni nivo čuva istoriju za povratak (PITR) — za pilot sa
  stvarnim podacima verovatno treba plaćeni plan;
- da li se uloga može napraviti SQL-om (`CREATE ROLE`) ili samo u konzoli.

Alternativa: Supabase (pauzira neaktivne besplatne projekte; direktna adresa
je IPv6 — za migracije sa lokalnog računara proveriti dostupnost), ili
Postgres na serveru firme (pun nadzor, ali backup i TLS su naš posao).

## 3. Struktura

| Šta | Ime (predlog) | Namena |
|---|---|---|
| Projekat | `carsystem-portal` | nalog firme, Frankfurt |
| Grana/baza | `test` | zatvoren tehnički test; povezuje se sa Vercel **Preview** |
| Grana/baza | `qa` | samo za `npm run qa:pg` — testovi je **prazne i brišu** |
| Produkcija | — | ne pravi se dok ne postoji odluka o planu sa backup-om |

`qa` i `test` se nikada ne mešaju: integracioni testovi brišu redove, a
`db/integration/safety.mjs` pušta samo bazu čije ime sadrži `test`/`qa`/… i
koja je prazna. Za `qa` granu ime baze mora sadržati `qa` ili `test`.

## 4. Uloge

| Uloga | Ko je pravi | Koristi je | Adresa |
|---|---|---|---|
| vlasnik šeme (podrazumevani nalog projekta) | provajder | `npm run db:migrate`, `runtime-role.sql`, `db:seed` — **samo sa lokalnog računara** | direktna |
| `carsystem_app` | mi, `CREATE ROLE … LOGIN PASSWORD …` | aplikacija na Vercel-u | pooled (`DATABASE_URL`) i direktna (`DATABASE_DIRECT_URL`) |

Lozinke se generišu u menadžeru lozinki ili sa `openssl rand -base64 32`,
upisuju se samo u konzolu provajdera i Vercel, nikad u repozitorijum, chat ni
e-poštu.

## 5. Postupak (posle odobrenja)

Sve komande sa lokalnog računara, iz grane `integration/portal-on-main-2026-10`,
sa vrednostima u okruženju terminala (ne u fajlu koji se commituje).

1. **Projekat i grana `test`** u Neon konzoli (Frankfurt).
2. **Migracije** — vlasnik šeme, direktna adresa:
   ```bash
   MIGRATION_DATABASE_URL="<direktna adresa vlasnika>" NODE_ENV=production npm run db:migrate
   ```
   Očekivano: „Migracije su primenjene", 33 unosa u `drizzle.__drizzle_migrations`.
3. **Runtime uloga** — prvo uloga sa lozinkom (konzola ili SQL), zatim:
   ```bash
   psql "<direktna adresa vlasnika>" -v runtime_role=carsystem_app -f db/provisioning/runtime-role.sql
   ```
   Skripta staje ako uloga ne postoji. Provera (sve `f` osim poslednje dve):
   ```sql
   SELECT has_table_privilege('carsystem_app','audit_log','DELETE'),
          has_table_privilege('carsystem_app','customer_contact_consents','UPDATE'),
          has_schema_privilege('carsystem_app','public','CREATE'),
          has_table_privilege('carsystem_app','recommendation_results','INSERT'),
          has_table_privilege('carsystem_app','effective_sales_ledger','SELECT');
   ```
4. **Prvi nalog Vlasnika** — jednom, pa obrisati vrednosti iz terminala:
   ```bash
   DATABASE_URL="<direktna adresa vlasnika>" BOOTSTRAP_ADMIN_EMAIL=… BOOTSTRAP_ADMIN_PASSWORD=… BOOTSTRAP_ADMIN_NAME=… npm run db:seed
   ```
   Lozinku bira sam Vlasnik (najmanje 10 znakova; predlog 16+).
5. **Dozvola za vezivanje drugog faktora** (u režimu `enforced` nalog bez
   faktora ne može da se prijavi bez nje):
   ```bash
   DATABASE_URL="<direktna adresa vlasnika>" PORTAL_MFA_MASTER_KEY_V1="<isti ključ kao na Vercel-u>" MFA_GRANT_EMAIL=… node scripts/issue-mfa-enrollment-grant.mjs
   ```
6. **Vercel promenljive** (§6) — tek posle odobrenja za izmenu Vercel-a.
7. **Provera** (§7).

## 6. Promenljive za Vercel (Preview prvo)

Region funkcija postaviti na **fra1** (podrazumevano je `iad1`, SAD).
Svaka promena važi tek za novi deployment.

| Promenljiva | Preview (test) | Production (kasnije) | Napomena |
|---|---|---|---|
| `DATABASE_URL` | pooled, `carsystem_app`, grana `test` | posebna baza | |
| `DATABASE_DIRECT_URL` | direktna, `carsystem_app`, grana `test` | posebna baza | samo zaštita Vlasnika |
| `DATABASE_POOL_MAX` | `2` | `2`–`3` | |
| `AUTH_SECRET` | nov ključ | **drugi** ključ | `openssl rand -base64 32` |
| `AUTH_URL` | adresa Preview deploymenta | `https://carsystemirm.com` | |
| `PORTAL_MFA_MASTER_KEY_V1` | nov ključ | **drugi** ključ | čuvati i van Vercel-a |
| `AUTH_RATE_LIMIT_HMAC_KEY` | nov ključ | **drugi** ključ | bez njega prijava se odbija |
| `PORTAL_MFA_MODE` | `enforced` | `enforced` | nikad `off` |
| `MAINTENANCE_MODE` | `true` | `true` do lansiranja | |
| `SITE_ACCESS_PASSWORD` | postoji | postoji | |
| `NEXT_PUBLIC_SEO_INDEXING` | `false` | `false` do lansiranja | `0` ne radi |
| `FEATURE_*`, `CUSTOMER_*`, `PORTAL_COMMERCE`, `RECOMMENDATIONS_AUTO_RECOMPUTE` | isključeno | isključeno | uključuju se pojedinačno |
| `MIGRATION_DATABASE_URL`, `BOOTSTRAP_ADMIN_*`, `TEST_DATABASE_URL` | **ne postavljati** | **ne postavljati** | samo lokalno |

Vercel Hobby je po uslovima Vercela namenjen nekomercijalnoj upotrebi; za pilot
sa stvarnim podacima firme računati na Pro (proveriti aktuelne uslove).

## 7. Provera posle podizanja

1. `npm run qa:pg` nad granom **`qa`** (direktna adresa u `TEST_DATABASE_URL`,
   nikad grana `test`): migracije, integracije, browser QA.
2. Na Preview adresi: prijava Vlasnika → vezivanje drugog faktora → odjava →
   prijava sa kodom.
3. Promena uloge drugog naloga prolazi (dokaz da `DATABASE_DIRECT_URL` radi);
   bez nje bi akcija bila odbijena sa porukom o spojnici.
4. Upload jedne **izmišljene** fakture iz `fixtures/dev/biznisoft/` (npr.
   `jedna-stavka.pdf`), pa ponovni upload istog fajla → „isti fajl, preskočeno".
5. U bazi: `SELECT count(*) FROM audit_log` raste; `DELETE FROM audit_log` kao
   `carsystem_app` vraća `permission denied`.

## 8. Brisanje

Testna grana se briše u konzoli provajdera kada test završi; zatim se sa
Vercel Preview-a uklanjaju `DATABASE_URL` i `DATABASE_DIRECT_URL`. Ključevi
(`AUTH_SECRET`, MFA, rate limit) se ne prenose u produkciju — produkcija dobija
nove.

## 9. Trošak

Tehnički test (§5–§7) ne bi trebalo da traži plaćanje (besplatni nivo
provajdera, Vercel Preview). Plaćanje postaje realno pre **pilota sa stvarnim
podacima**: plan baze sa backup-om/PITR i, po uslovima Vercela, Pro plan.
