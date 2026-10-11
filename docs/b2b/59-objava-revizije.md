# 59 — Objava revizije portala (B0–B11): postupak za pregled

Status: **pripremljeno za pregled, ništa nije primenjeno na Production.**
Grana `fix/revizija-portala-2026-10-11`, spojena sa firminim `main` posle PR #22
(`d81267f` = trenutni Production, objavljen 11. 10. u 12:16). Lista stavki i
dokazi: [57](57-revizija-funkcija-portala.md).

## 1. Šta se objavljuje

| Stavka | Šta | Migracija |
|---|---|---|
| B0, B11 | obračun i aktivacija u transakciji ne traže drugu vezu | — |
| B1 | opseg komercijaliste u radnjama nad kupčevim nalozima | — |
| B2 | istorija uvoza: zatvaranje PDF uvoza, prijem sa konektora | — |
| B3 | obaveštenja kancelariji (zahtev, potvrđen predlog, upit); brojači liste u SQL-u | **0046** |
| B4, B5 | kartica kupca za kancelariju; pretraga i filter kupaca | — |
| B6 | pregled fakture za štampu (nije original) | — |
| B7 | loš unos u adresi ≠ 500 | — |
| B8 | odjava opoziva sesiju; apsolutni rok 8 h | **0045** |
| B9 | brojači pokušaja, kod sajta, reset otključava, 12 znakova | — |
| B10 | poruke za ručnu predaju | — |

Nove promenljive okruženja: **nema.** Zastavice se ne menjaju (stvarni kupci i
preporuke se uključuju tek posle provere objave i izbora pilot kupaca).

## 2. Kompatibilnost migracija sa kodom

| | Baza bez 0045/0046 | Baza sa 0045/0046 |
|---|---|---|
| **Sadašnji kod** (`d81267f`) | radi (danas) | **radi** — nova tabela i nove vrednosti enuma se ne koriste |
| **Novi kod** | **ne radi**: provera sesije čita `auth_revoked_sessions` → niko ne može da se prijavi; obaveštenja nove vrste se ne upisuju (ne obara zahtev) | radi |

Zaključak: **prvo migracije, pa kod.** Migracije su čisto dodavanje (nova
tabela bez stranih ključeva, dve nove vrednosti enuma); ništa postojeće se ne
menja ni briše.

**Provereno nad kopijom Production-a (11. 10.):** jutrošnja dnevna kopija (45 migracija) dešifrovana i vraćena
lokalno, vlasništvo kao na Neon-u (`neondb_owner`), migracije kao
`neondb_owner`: 45 → 47 bez greške; `carsystem_app` je automatski dobio
SELECT/INSERT/DELETE na novoj tabeli (podrazumevana prava baze — ručni GRANT
nije potreban); novi kod kao `carsystem_app` nad tom kopijom: brojači zahteva,
prijem KANC-01 po danu, opseg poruka, opoziv sesije, upis obaveštenja, dodele
— ispravno. Vraćena baza i dešifrovani fajlovi su posle toga obrisani
(`~/.carsystem-private/kompatibilnost-0045-0046/REZULTAT.md`).

## 3. Pre objave

1. **Pregled i odobrenje PR-a** (Vi).
2. **Vercel pristup**: prijava vlasnika (sačuvani token je nevažeći) — za
   praćenje izgradnje i za povratak (Promote).
3. **Sveža proverena kopija** neposredno pre migracija:
   - GitHub → `carsystemirmdoo-hue/carsystem-backup` → Actions → „Kopija baze“ →
     *Run workflow* (ili ja preko firminog pristupa, uz Vašu potvrdu);
   - sačekati zeleno (≈2 min; prolaz sam vraća kopiju i poredi je sa manifestom);
   - lokalno: preuzeti artefakt, dešifrovati, `db-backup.mjs verify` (kao gore);
     zapisati broj prolaza i otisak kopije.
4. **Snimak „pre“** (samo čitanje): broj migracija (45), broj redova ključnih
   tabela (fakture, kupci, pravila, zahtevi), poslednje javljanje KANC-01 — vrednosti u privatnoj belešci.

## 4. Redosled objave (svaki korak uz Vašu potvrdu)

1. Kopija iz §3.3 — proverena.
2. **Migracije** kao vlasnik baze (`neondb_owner`, direktna adresa bez `-pooler`):
   ```bash
   MIGRATION_DATABASE_URL='<vlasnik, direktno>' NODE_ENV=production npm run db:migrate
   ```
   Očekivano: 45 → 47.
3. **Provera baze** (samo čitanje):
   - `SELECT count(*) FROM drizzle.__drizzle_migrations` = 47;
   - `has_table_privilege('carsystem_app','auth_revoked_sessions','INSERT')` i `'DELETE'` = true;
   - `enum_range(NULL::notification_kind)` sadrži obe nove vrednosti.
   Sadašnji kod u ovom trenutku i dalje radi (§2).
4. **Spajanje PR-a** (squash) → Vercel gradi Production (≈5–8 min).
5. **Provera posle objave** (§5).

Napomena: posle objave **svi se jednom ponovo prijave** (stari tokeni nemaju
identitet sesije). KANC-01 se ne prijavljuje sesijom (potpisani zahtevi) — ne
dira se.

## 5. Provera posle objave

| Provera | Očekivano |
|---|---|
| `/`, `/katalog` | 307 → `/site-u-pripremi` (održavanje ostaje) |
| `/prijava`, `/prijava/kupac`, `/site-u-pripremi` | 200 |
| `/portal`, `/kupac` bez prijave | 307 na prijavu |
| Prijava vlasnika (lozinka + kod) | ulaz u portal; posle odjave isti prozor ne otvara portal |
| `/portal/zahtevi` | brojači stanja jednaki snimku „pre“ |
| `/portal/obavestenja` | radi; postojeća obaveštenja |
| `/portal/kupci` | pretraga i filter po komercijalisti; broj kupaca jednak snimku „pre“ |
| `/portal/kupci/<id>` kao kancelarija | istorija kupovine vidljiva |
| `/portal/importi` | „Prijem sa konektora“: KANC-01 07.–09. 10. |
| Prvi sledeći ciklus KANC-01 (radni dan, HH:02) | javljanje i ciklus „obrađeno“ |
| Kupac PROBA: prijava, fakture, pregled za štampu | radi, oznaka „nije original“ |
| Vercel logovi prvih 30 min | bez 500 |

Provere koje upisuju podatke (nov probni zahtev, upit za cenu) — samo uz Vašu
posebnu potvrdu, na test kupcu PROBA.

## 6. Povratak

**Kod** (bilo koji, bez diranja baze):
- A) Vercel → projekat `carsystemirm` → Deployments → deployment `d81267f` →
  *Promote to Production* (najbrže, bez izgradnje).
- B) `git revert` squash commita na firminom `main` → Vercel gradi.

**Baza**: migracije **ostaju** — sadašnji kod radi i sa njima (§2). Povratni
postupci postoje ako bi ipak bili potrebni, ručno, kao vlasnik, tek POSLE
povratka koda:
`db/rollback/0045_auth_revoked_sessions.down.sql`,
`db/rollback/0046_order_notifications.down.sql` (vrednosti enuma Postgres ne
briše; postupak briše obaveštenja tih vrsta).

Okidači za povratak: prijava ne radi ni posle ponovnog pokušaja; 500 na
`/portal` ili `/kupac`; zahtev kupca se ne može poslati.

## 7. Odvojeno (posebna potvrda)

Jedan zapis ručnog uvoza od 06. 10. stoji „u toku“ (B2 ispravlja nove, ne
stare). Jednokratno zatvaranje, samo uz Vašu potvrdu:
```sql
UPDATE import_runs
   SET status = 'greska', finished_at = now(),
       message = 'Zatvoreno ručno 2026-10: zapis otvoren pre ispravke B2; ishod dokumenta je u Izvornim dokumentima.'
 WHERE status = 'u_toku' AND started_at < '2026-10-07';
```
Očekivano: 1 red.
