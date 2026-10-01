# 33 — Testna baza i zaštićen Preview: runbook

**Status (2026-10-01): alati pripremljeni i probani nad lokalnim Postgres 17;
Neon projekat i Preview još ne postoje.** Sve što dira Neon ili Vercel radi
čovek sa pristupom firminim nalozima, korak po korak ispod.

Cilj: **zatvoren tehnički test** novog portala na Vercel **Preview**-u, nad
zasebnom testnom bazom sa **isključivo sintetičkim podacima**. Produkcija
(`main`, produkcioni projekat, domen) se ne dira.

---

## 1. Šta kod traži od baze

| Uslov | Zašto |
|---|---|
| PostgreSQL 13+ (testirano na 17) | `gen_random_uuid()` bez ekstenzije |
| Bez ekstenzija, bez superuser-a | migracije 0000–0032 ih ne traže |
| Vlasnik šeme sme `CREATE` na bazi | Drizzle pravi šemu `drizzle` za evidenciju migracija |
| `CREATE ROLE` i `ALTER DEFAULT PRIVILEGES` | runtime uloga iz `db/provisioning/runtime-role.sql` |
| Pooled **i** direktna adresa | runtime kroz pooler; migracije i zaštita Vlasnika direktno |
| TLS | `?sslmode=require` |
| EU region | Vercel funkcije su u `fra1` (Frankfurt) |

Lokalni dokaz: prazna baza → 33 migracije → `runtime-role.sql` → integracije
492/492; alati iz §4 prođeni nad lokalnom bazom, smoke provera 30/30.

## 2. Izbor: Neon Free, Frankfurt (uslovi provereni 2026-10-01)

neon.com/pricing: Free je trajan (nije proba), **bez kartice**; po projektu
100 CU-sati računanja, 1 GB prostora, 10 grana, istorija za povratak 6 sati,
računanje se gasi posle 5 min mirovanja (prvi zahtev posle toga je sporiji).
Za tehnički test je dovoljno. Za pilot sa stvarnim podacima Free nije dovoljan
(nema dužeg povratka u tačku vremena ni zakazanih snimaka).

**Važno — uloge na Neonu** (neon.com/docs/manage/roles): uloga napravljena u
konzoli, CLI-ju ili API-ju automatski dobija `neon_superuser` (CREATEROLE,
CREATEDB, BYPASSRLS, `pg_read_all_data`, `pg_write_all_data`). Runtime uloga
`carsystem_app` se zato pravi **isključivo SQL-om** (skripta u §4 to radi i
proverava da članstva nema). Lozinka uloge mora imati ≥ 60 bita entropije
(generisana ima 256).

**Važno — adresa:** Neonov connection string sadrži `channel_binding=require`.
Drajver `postgres.js` nepoznate parametre adrese šalje serveru kao podešavanja
i veza pada; alati iz §4 taj parametar uklanjaju, a adrese za Vercel prave bez
njega.

Ne koristiti Neon ↔ Vercel integraciju iz Marketplace-a: ona sama upisuje
adrese baze u okruženja projekta (i u Production).

## 3. Struktura

| Šta | Izbor |
|---|---|
| Neon nalog | na e-adresi firme (vlasništvo firme), plan Free |
| Projekat | `carsystem-preview-test` — **ceo projekat je testni**; produkcija će biti poseban projekat |
| Region | AWS Europe Central 1 (Frankfurt) — `aws-eu-central-1` |
| Postgres | 17 |
| Baza / vlasnik | podrazumevano `neondb` / `neondb_owner` |
| Vercel | samo **Preview**, promenljive vezane za granu `preview/portal-test` |

## 4. Alati (repozitorijum, `scripts/ops/`)

Sve se pokreće iz korena repozitorijuma. Tajne su u
`~/.carsystem-secrets/preview-test.env` (prava 600), van gita; alati ih nikad
ne ispisuju.

| Korak | Komanda | Šta radi |
|---|---|---|
| tajne | `bash scripts/ops/preview-secrets.sh init` | generiše `AUTH_SECRET`, `PORTAL_MFA_MASTER_KEY_V1`, `AUTH_RATE_LIMIT_HMAC_KEY`, `CARSYSTEM_APP_PASSWORD`, `SITE_ACCESS_PASSWORD`; ostavlja prazna mesta za `NEON_OWNER_URL`, `PREVIEW_URL`, `VERCEL_BYPASS_TOKEN` |
| baza | `npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/preview-db.mts all` | proveri metu (Neon Frankfurt, direktna adresa, bez stvarnih kupaca) → 33 migracije → `carsystem_app` SQL-om + `runtime-role.sql` → provera svih prava i članstava → upiše `PREVIEW_DATABASE_URL` (pooled) i `PREVIEW_DATABASE_DIRECT_URL` → proba obe kao `carsystem_app` |
| Vlasnik | `bash scripts/ops/preview-owner.sh "<e-adresa>" "<ime i prezime>"` | pokreće **sam Vlasnik**: lozinku kuca skriveno; `db:seed` + jednokratna dozvola za drugi faktor |
| sintetika | `npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/seed-synthetic-preview.mts` | demo oznaka, kupci A/B, nalozi, fakture, komercijalista (samo A), kancelarija, demo cenovnik, rabat 10 % za A; pristup u `preview-synthetic.env` (600) |
| provera | `npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/preview-smoke.mts` | 30 provera: noindex, robots, zaštita privatnih strana, `/api/sync` isključen, zaglavlja, izolacija kupaca, cene i korpa (demo), uloge |

## 5. Redosled

1. **Neon** (čovek): nalog firme → projekat po §3 → u „Connect" isključiti
   *Connection pooling* i kopirati adresu za `neondb_owner` / `neondb`.
2. `preview-secrets.sh init`, pa nalepiti tu adresu u `NEON_OWNER_URL` u fajlu.
3. `preview-db.mts all` — mora se završiti bez ijednog ✖.
4. `preview-owner.sh` — Vlasnik (prvi nalog), lozinka skriveno; zapiše
   jednokratni kod za drugi faktor.
5. `seed-synthetic-preview.mts`.
6. **Vercel** (čovek): promenljive iz §6, okruženje **Preview**, grana
   `preview/portal-test`.
7. Objava: commit sa PR #1 se pošalje na granu `preview/portal-test` (grane
   `integration/**` se same ne objavljuju; ova se objavljuje kao Preview).
8. **Vercel** (čovek): Deployment Protection → *Protection Bypass for
   Automation* → napraviti ključ i upisati ga u `VERCEL_BYPASS_TOKEN`; adresu
   grane upisati u `PREVIEW_URL`.
9. `preview-smoke.mts`; Vlasnik se prijavljuje i vezuje drugi faktor.

## 6. Vercel → Settings → Environment Variables (samo Preview)

Za svaku: **Environments: samo Preview**, *Preview branch*: `preview/portal-test`.
Vrednosti iz `~/.carsystem-secrets/preview-test.env` označene su sa (fajl).

| Promenljiva | Vrednost | Napomena |
|---|---|---|
| `DATABASE_URL` | (fajl) `PREVIEW_DATABASE_URL` | pooled, `carsystem_app` |
| `DATABASE_DIRECT_URL` | (fajl) `PREVIEW_DATABASE_DIRECT_URL` | samo zaštita Vlasnika |
| `DATABASE_POOL_MAX` | `2` | |
| `AUTH_SECRET` | (fajl) | samo Preview |
| `PORTAL_MFA_MASTER_KEY_V1` | (fajl) | isti ključ koristi `preview-owner.sh` |
| `AUTH_RATE_LIMIT_HMAC_KEY` | (fajl) | |
| `AUTH_URL` | `https://carsystemirm-git-preview-portal-test-carsystem1.vercel.app` | potvrditi posle prve objave (adresa grane) |
| `PORTAL_MFA_MODE` | `enforced` | |
| `NEXT_PUBLIC_SEO_INDEXING` | `false` | Preview je i inače noindex |
| `MAINTENANCE_MODE` | `false` | Preview štiti Vercel Authentication; javni deo mora biti dostupan za proveru kupca |
| `CUSTOMER_ORDERING` | `demo` | radi SAMO nad demo oznakom i demo cenovnikom iz §4; stvarni režim ne postoji |
| `PORTAL_COMMERCE` | `off` | |
| `FEATURE_SYNC_DEVICE_INGEST`, `FEATURE_SYNC_OPERATIONS`, `FEATURE_RECOMMENDATIONS`, `FEATURE_PARTNER_REGISTRY`, `CUSTOMER_REMEMBER_ME`, `RECOMMENDATIONS_AUTO_RECOMPUTE`, `NEXT_PUBLIC_CUSTOMER_LOGIN_LINK` | `0` | |

Ne postavljati na Vercel: `NEON_OWNER_URL`, `MIGRATION_DATABASE_URL`,
`BOOTSTRAP_ADMIN_*`, `CARSYSTEM_APP_PASSWORD`, `TEST_DATABASE_URL`.

## 7. Provera posle objave

- `preview-smoke.mts`: 30/30 (sadržaj u §4).
- Ručno, Vlasnik: prijava → vezivanje aplikacije za kodove sa jednokratnom
  dozvolom → kodovi za oporavak sačuvani van računara → odjava → prijava sa kodom.
- Ručno: promena uloge sintetičkog naloga kancelarije i nazad (dokaz da
  `DATABASE_DIRECT_URL` drži zaštitu Vlasnika).
- Upload jedne izmišljene fakture iz `fixtures/dev/biznisoft/` kao Vlasnik i
  ponovni upload istog fajla → „isti fajl, preskočeno".

## 8. Brisanje

Ceo Neon projekat `carsystem-preview-test` se briše kada test završi; zatim se
u Vercelu uklanjaju promenljive grane `preview/portal-test` i ključ za
zaobilaženje zaštite, a lokalno `~/.carsystem-secrets/preview-*.env`. Ključevi
se ne prenose u produkciju — produkcija dobija nove.

## 9. Trošak

Neon Free i Vercel Preview: bez plaćanja. Plaćanje postaje realno pre pilota
sa stvarnim podacima (plan baze sa backup-om i povratkom u tačku vremena; po
uslovima Vercela Pro plan za komercijalnu upotrebu).
