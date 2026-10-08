# 51 — Rezervne kopije: baza i izvorni PDF-ovi

**Stanje: kod i lokalna proba završeni; automatika NIJE uključena** (čeka privatni repo,
uloge u bazi i ključ — odluke vlasnika). Ovaj dokument ne sadrži adrese, lozinke ni ključeve.

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
(14 dnevnih, 8 nedeljnih, 12 mesečnih; `lib/backup/retention.mjs`) → `offsite_stored`.
Privatni ključ nije potreban na tom računaru.

## Tokovi (privatni repo, ne ovaj)

`Kopija baze` (dnevno 01:17 UTC) i `Nadzor kopije` (pada ako je poslednja uspešna
starija od 30 h). Fiksirane verzije: akcije po punom SHA, `postgres:17.11-bookworm`
po digestu, `age` v1.3.2 po SHA-256. Dozvole: globalno nijedna; posao kopije
`contents: read`; nadzor `actions: read`. Artefakt 7 dana, samo `.age`, status, otisci.

## Dok automatika nije uključena

Portal prikazuje **„Backup nije podešen“** (žuto, nikad zeleno) za svaku vrstu kopije koja nije navedena u
`BACKUP_AUTOMATION` (npr. `db_verified,offsite_stored,pdf_backup`). Zapisi neuključenih vrsta se ne prikazuju.
`BACKUP_SOURCE_LABEL` (npr. `pilot`) dodatno ograničava prikaz na zapise te oznake izvora — probe i ručne
kopije se ne mešaju sa stvarnim.

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

`napravi-paket.mjs` pravi ZIP sa skriptama za preuzimanje i PDF kopiju, zavisnostima i omotačima
`podesi-kopije.ps1` / `kopije.ps1` (DPAPI za tajne, `age.exe` po SHA-256 zvaničnog izdanja). Paket ne
sadrži ključeve ni tajne i ne registruje zakazane zadatke; uputstvo `UPUTSTVO-KOPIJE.md`.
