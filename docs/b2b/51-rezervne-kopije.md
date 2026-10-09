# 51 — Rezervne kopije: baza i izvorni PDF-ovi

**Stanje (9. 10. 2026): dnevna kopija baze radi** (privatni repo firme, GitHub Actions; prvi
potpun prolaz, preuzimanje i dešifrovanje provereni). Kopija van GitHub-a i PDF kopija rade sa
kancelarijskog računara posle konektora 0.3.12 i migracije 0037. Ovaj dokument ne sadrži adrese,
lozinke ni ključeve.

Kancelarijski računar čuva kopije baze **lokalno**, uz ograničeno čuvanje (KANC-01: 7 dnevnih, 4 nedeljne,
3 mesečne). `offsite_stored` znači „sačuvano na firminom računaru (van GitHub-a)“ — **ne** kopija u oblaku:
Google Drive se otprema ručno i portal ga ne prati. PDF kopija je opciona i trenutno isključena (dokumenti su
u BizniSoftu; nezavisna kopija BizniSoft baze još nije potvrđena).

## Tri odvojene tvrdnje (portal → Sinhronizacija; upozorenje na Početnoj)

| Zapis (`backup_runs.kind`) | Šta dokazuje | Upozorenje |
|---|---|---|
| `db_verified` | kopija iz jednog snimka vraćena u praznu bazu; manifest se poklopio | posle 30 h |
| `offsite_stored` | šifrovana kopija preuzeta, otisak proveren, sačuvana VAN GitHub-a | posle 36 h |
| `pdf_backup` | dnevna inkrementalna šifrovana kopija izvornih PDF-ova | posle 36 h |

Proverena kopija nije isto što i kopija van GitHub-a — prikaz to izričito kaže.

## Kopija baze (`scripts/backup/db-backup.mjs`)

1. `dump` — transakcija REPEATABLE READ, `pg_export_snapshot()`, manifest u istom
   snimku, `pg_dump --snapshot` (custom format, sa dozvolama, bez vlasnika).
   Manifest: svaka tabela obe šeme (`public`, `drizzle`) sa brojem redova i md5
   sadržaja, migracije (broj + poslednji heš), sekvence, dozvole uloga iz kataloga
   (`relacl`, nezavisno od uloge koja čita), zbirovi prodaje po godini.
2. `verify` — nova prazna baza, uloge iz dozvola (NOLOGIN), `pg_restore`, isti
   manifest nad vraćenom bazom, poređenje; sekvenca >= max kolone. Neuspeh = izlaz 1.
3. `encrypt` — `age` javnim ključem; otvoren fajl se briše; `.sha256` uz šifrovan.
4. `status` / `record` — javni sažetak bez poslovnih iznosa u `backup_runs`.

Uloge (`db/provisioning/backup-roles.sql`): čitalac (`pg_read_all_data`, bez upisa) i
status (samo INSERT nad `backup_runs`). Aplikacija `backup_runs` samo čita (0036).

## Mesečna ručna proba (`scripts/backup/restore-drill.sh`)

Dešifrovanje privatnim ključem → provera otiska → vraćanje + manifest → aplikacija
kao `carsystem_app` nad vraćenom bazom: prijava sa MFA i „Neto promet“ jednak
manifestu (`scripts/backup/app-check.mjs`) → brisanje vraćene baze.

## PDF-ovi (`scripts/backup/pdf-backup.mjs`)

Skladište adresirano sadržajem (`objects/ab/<sha256>.pdf.age`): nov i promenjen
fajl → nov objekat, stara verzija ostaje; obrisan original → `missingSince` u
indeksu, objekat ostaje. Ništa se automatski ne briše. Indeks u skladištu je
šifrovan; stanje sa putanjama ostaje na računaru gde su PDF-ovi.

## Van GitHub-a (`scripts/backup/offsite-pull.mjs`)

Poslednji artefakt → provera SHA-256 → `<dest>/<vreme>/` → politika čuvanja
(14 dnevnih, 8 nedeljnih, 12 mesečnih; `lib/backup/retention.mjs`) → izveštaj (`--izvestaj`).
Privatni ključ nije potreban na tom računaru, a ni lozinka baze.

## Potpisana potvrda sa računara (0037, konektor 0.3.12)

Računar ne upisuje u bazu. Izveštaj kopije (samo brojevi, otisci i vreme; bela lista u
`lib/backup/deviceReport.mjs`) potpisuje konektor ključem uređaja (`prijavi-kopiju`) i šalje na
`/api/sync/backup` (isti Ed25519 kanal kao fakture). Aplikacija nema INSERT nad `backup_runs`;
upis ide samo kroz `record_device_backup` (SECURITY DEFINER, EXECUTE samo za `carsystem_app`):

- `offsite_stored` samo ako postoji USPEŠAN `db_verified` istog GitHub prolaza sa ISTIM otiskom
  šifrovane kopije (inače 409 `backup_unknown`); ponovljena potvrda istog prolaza ne pravi nov red;
- `pdf_backup` samo nenegativni brojevi;
- `db_verified` nikad.

## Tokovi (privatni repo, ne ovaj)

`Kopija baze` (dnevno 01:17 UTC) i `Nadzor kopije` (pada ako je poslednja uspešna
starija od 30 h). Fiksirane verzije: akcije po punom SHA, `postgres:17.11-bookworm`
po digestu, `age` v1.3.2 po SHA-256. Dozvole: globalno nijedna; posao kopije
`contents: read`; nadzor `actions: read`. Artefakt 7 dana, samo `.age`, status, otisci.

## Šta portal prikazuje

Vrsta kopije se prikazuje kao stvarna samo uz zapis **dokazivog porekla**: `db_verified` iz GitHub
prolaza (`github_run_id`, nije uređaj), `offsite_stored`/`pdf_backup` iz potpisane potvrde uređaja
(`recorded_by = uredjaj:<oznaka>`). Ručni ili probni upis nema to poreklo i ne računa se.

- nijedna vrsta nema takav zapis → **„Backup nije podešen“**;
- proverena kopija baze postoji, a druga lokacija ili PDF kopija ne → zelena „Kopija baze proverena“ i
  odvojeno **„Zaštita i čuvanje kopija nisu potpuno podešeni“** sa spiskom onoga što fali (portal NE
  kaže da kopija nema);
- `BACKUP_AUTOMATION` (npr. `db_verified,offsite_stored,pdf_backup`), ako je zadat, važi tačno — i za
  izričito isključenje; `BACKUP_SOURCE_LABEL` (oznaka `produkcija`) sužava kopiju baze na tu oznaku.

## Šta sme nešifrovano u GitHub artefaktu

Samo `.age` fajlovi, otisci (`.sha256`) i javni status koji prolazi belu listu
(`lib/backup/publicStatus.mjs`): vreme, broj tabela/redova/sekvenci/migracija, veličine, otisci i ime
šifrovanog fajla oblika `carsystem-<oznaka>-<vreme>.(dump|manifest.json).age`. Pun manifest (tabele,
zbirovi prodaje) je samo u `.manifest.json.age`. `db-backup.mjs check-artifact` zaustavlja posao pre
otpremanja ako fascikla sadrži bilo šta drugo.

## Prekid usred posla

SIGINT/SIGTERM/SIGHUP (`lib/backup/abort.mjs`): zaustavljaju se `pg_dump`/`pg_restore`/`age`, briše se
nepotpuna kopija (`.dump.part`), probna baza (`DROP … WITH (FORCE)`), dešifrovan privremeni fajl,
otvoren PDF indeks i nepotpuni objekti; ostaci prethodnog prekida se brišu pri sledećem pokretanju.
Proveru izvodi `scripts/backup/interrupt.test.mjs` (lokalne baze: `BACKUP_TEST_SOURCE_URL`,
`BACKUP_TEST_ADMIN_URL`).

## Windows paket (`scripts/backup/windows/`)

`napravi-paket.mjs` pravi ZIP sa skriptama za preuzimanje i PDF kopiju i omotačima `podesi-kopije.ps1` /
`kopije.ps1` / `zakazi-kopije.ps1` (DPAPI samo za GitHub token, `age.exe` po SHA-256 zvaničnog izdanja,
potvrda kroz konektor). Paket ne sadrži ključeve, tajne ni drajver baze; zakazani zadatak pravi samo
`zakazi-kopije.ps1` (schtasks, tekući nalog, bez povišenih prava). Uputstvo `UPUTSTVO-KOPIJE.md`.
