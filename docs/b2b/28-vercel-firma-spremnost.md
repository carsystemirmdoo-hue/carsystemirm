# 28 — Priprema za firmin Vercel

Status: **spisak, ništa nije podešeno.** Nijedna produkciona baza nije
dodirnuta, nijedna grana nije spojena, nijedan prekidač nije uključen.
Plaćeni planovi (Vercel Pro, plaćena baza, e-pošta) traže vaše odobrenje
(`CLAUDE.md` — kontrola troškova).

## A. Može se završiti sada (ne čeka BizniSoft izvoze)

### A1. Vercel projekat u timu firme
- Uvoz repozitorijuma u firmin Vercel tim; framework **Next.js**, build `npm run build`
  (bez `output: export`, middleware je obavezan), Node **22+** (`package.json` engines).
- Region funkcija **fra1 (Frankfurt)** — ista EU regija kao baza.
- Preview okruženja: zaključana (`MAINTENANCE_MODE=true` + `SITE_ACCESS_PASSWORD`)
  i sa **zasebnom bazom/granom**, nikad produkcionom (`db/integration/safety.mjs`
  već odbija produkcione mete za testove).
- Provera veličine funkcija: `npm run build:check && npm run build:trace-check`
  — na grani `feat/portal-f9-remaining` prolazi (nijedan pad, limit 250 MB).

### A2. Baza (odluka P14 — izbor provajdera i backup)
- Postgres 16+ u EU (npr. Neon Frankfurt). Treba nam: **pooled** URL za aplikaciju,
  **direktan** URL za migracije, grananje ili zasebna baza za Preview,
  **PITR/backup** (dnevni + tačka u vremenu). Besplatni nivoi obično nemaju
  dovoljan backup — odluka o trošku je vaša.
- Dve role (`10-db-roles-runbook.md`):
  1. `MIGRATION_DATABASE_URL` — vlasnik šeme, samo za migracije;
  2. `DATABASE_URL` — runtime rola `carsystem_app` iz
     `db/provisioning/runtime-role.sql` (bez UPDATE/DELETE nad `audit_log`).
  Provajder mora dozvoliti `CREATE ROLE` i `ALTER DEFAULT PRIVILEGES`.
- `DATABASE_POOL_MAX=1`–`3` na Vercel-u (pool se deli po instanci — ispravka iz PR #3).

### A3. Migracije (redom, na praznoj bazi)
| Opseg | Gde je danas | Sadržaj |
|---|---|---|
| 0000–0027 | `main` | osnova, auth, MFA, cene, uvoz, sinhronizacija, preporuke |
| 0028 | PR #2 (draft) | registar partnera, potvrda kontakta |
| 0029 | `feat/portal-f7-cart` | cenovnik, korpa, zahtevi/porudžbine |
| 0030 | `feat/portal-f8-catalog-buy` | ispravka zahteva, upiti za cenu/uslove |
| 0031 | `feat/portal-f9-remaining` | „Zapamti me" tokeni |
| 0032 | `feat/portal-f10-release-prep` | automatski obračun preporuka posle uvoza |

Postupak: `MIGRATION_DATABASE_URL=… npm run db:migrate` (log mora reći da
koristi `MIGRATION_DATABASE_URL`) → runtime rola po runbooku `10` → jednokratni
`npm run db:seed` sa `BOOTSTRAP_ADMIN_*` (prvi gazda), pa te promenljive
**ukloniti**. Svaka migracija ima povratni postupak u `db/rollback/`.
Pre produkcije: pun `npm run qa:pg` nad kopijom/granom iste baze (`13-…`).

### A4. Promenljive okruženja
| Promenljiva | Production | Preview | Napomena |
|---|---|---|---|
| `DATABASE_URL` | runtime rola, pooled | zasebna baza/grana | tajna |
| `MIGRATION_DATABASE_URL` | vlasnik šeme, direktan | zasebna | tajna; samo za migracije |
| `DATABASE_POOL_MAX` | `2` | `1` | |
| `AUTH_SECRET` | `openssl rand -base64 32` | drugi ključ | tajna |
| `AUTH_URL`, `NEXT_PUBLIC_SITE_URL` | kanonski domen | preview URL | |
| `AUTH_RATE_LIMIT_HMAC_KEY` | nasumičan ključ | drugi ključ | bez njega prijava odbija |
| `PORTAL_MFA_MASTER_KEY_V1`, `PORTAL_MFA_ACTIVE_KEY_VERSION=1` | ključ 32 B | drugi ključ | tajna; rotacija preko `_V2` |
| `PORTAL_MFA_MODE` | `enforced` | `enforced` | udaljeno okruženje ionako prisiljava `enforced` |
| `MAINTENANCE_MODE`, `SITE_ACCESS_PASSWORD` | `true` + lozinka | `true` + lozinka | skida se tek pri lansiranju |
| `NEXT_PUBLIC_SEO_INDEXING` | `0` do lansiranja | `0` | build podešavanje |
| `BOOTSTRAP_ADMIN_*` | samo za prvi seed, pa brisanje | — | tajna |
| `FEATURE_SYNC_DEVICE_INGEST`, `FEATURE_SYNC_OPERATIONS` | `0` | `0` | uključiti tek sa registrovanim uređajem (B1) |
| `FEATURE_RECOMMENDATIONS`, `FEATURE_PARTNER_REGISTRY` | `0` | po potrebi `1` | |
| `PORTAL_COMMERCE` | `off` | `off` | |
| `CUSTOMER_ORDERING` | `off` | `off` (`demo` samo nad demo bazom) | stvarni režim ne postoji |
| `CUSTOMER_REMEMBER_ME` | `0` | `0` | uključiti posle pilota naloga |
| `RECOMMENDATIONS_AUTO_RECOMPUTE` | `0` | `0` | uključiti kada dnevni uvoz radi (uz `FEATURE_RECOMMENDATIONS=1`) |
| `NEXT_PUBLIC_CUSTOMER_LOGIN_LINK` | `0` | `0` | build podešavanje |
| `FEATURE_BEX`, `BEX_*` | `0` / prazno | `0` | čeka BEX ugovor |
| `INGEST_API_KEY`, `FEATURE_FOLDER_CONNECTOR` | **ne postavljati** | — | napušteno |

### A5. Grana za izdanje
Lokalna grana **`release/portal-2026-10`** (radno stablo `carsystem-release`) =
`origin/main` (e817797, sa PR #4, #8, #10) + ceo lanac PR #3 → PR #2 → F1 … F10.
Jedini sukob pri spajanju bio je `package.json` (unija `test` koraka).
Nije pushovana; PR-ovi nisu spojeni. Predlog: ova grana postaje jedan PR ka
`main` posle vašeg odobrenja (umesto deset zasebnih spajanja).

**Preduslov sa `main`-a — rešen na grani za izdanje:** test
`lib/auth/cookieAndHeaders.test.mjs` je padao već na `origin/main` (PR #10 je
proširio noindex pravilo). Ispravka `aaed73d` (`fix/test-docs-noindex-rule`)
je pregledana i unesena u `release/portal-2026-10` (`26f4c35`): proverava
sadašnje, šire pravilo zajedno sa vrednošću `noindex, follow`, pa je stroža
od stare provere. Kompletan `npm test` na grani za izdanje prolazi.

### A6. Provere pre prvog Production deploy-a
1. `npm run lint && npm run typecheck && npm test && npm run build:check && npm run build:trace-check`
2. `npm run qa:pg` na Preview bazi (integracije + pregledač)
3. Runtime rola: `has_table_privilege` za `audit_log` UPDATE/DELETE = `f`
4. Gazda i kancelarija upisuju drugi faktor; zaštita poslednjeg gazda naloga radi
5. Svi prekidači iz A4 isključeni; `MAINTENANCE_MODE=true`
6. Proveriti `Cache-Control` odgovora portala (`27-…`, delimično)
7. DNS (Burina.net → Vercel) tek na kraju, posle vaše odluke o lansiranju

## B. Čeka stvarne izvoze / spoljne podatke

| # | Stavka | Uslov |
|---|---|---|
| B1 | Konektor u produkciji (redovan uvoz faktura) | registrovan kancelarijski računar (P12), `FEATURE_SYNC_DEVICE_INGEST=1` |
| B2 | Šifarnik, cenovnik, rabati, lager | izvozi i ugovori podataka (`25-…`, `26-…` §5) |
| B3 | Stvarno poručivanje | aktivan `biznisoft` cenovnik + kontrola prema fakturama + postupak kancelarije; kod za stvarni režim još ne postoji namerno |
| B4 | Automatski obračun preporuka posle uvoza | stabilan dnevni uvoz; Vercel Cron ili okidač posle uvoza (migracija + odobrenje) |
| B5 | Upis porudžbine u BizniSoft (P5) | odgovor BizniSoft podrške; do tada ručni unos |
| B6 | E-pošta (pozivi, reset lozinke, obaveštenja) | izbor provajdera (trošak); do tada `customer_message_outbox` |
| B7 | BEX, dugovanja, limiti | BEX ugovor (P9), izvor uplata |

## C. Preostale prepreke (sažeto)
1. **P14** — izbor baze i backup-a (trošak).
2. **Odobrenje spajanja** lanca grana (A5).
3. **E-pošta** — bez provajdera kupci ne dobijaju poziv ni reset lozinke automatski.
4. **Stvarni izvozi** (B2) — preduslov za cene, lager i stvarno poručivanje.
