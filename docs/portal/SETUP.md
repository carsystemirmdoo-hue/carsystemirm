# Poslovni sistem — podešavanje

Uputstvo za pokretanje internog poslovnog sistema na `/portal`. Javni sajt radi
nezavisno i ne zahteva nijedan od ovih koraka.

## 1. Baza

Potreban je Postgres. Besplatan nivo kod **Neon**-a ili **Supabase**-a je dovoljan
za početak i ne uvodi mesečni trošak (vidi `COST_CONTROL.md`).

```bash
cp .env.example .env.local
```

Popunite `DATABASE_URL` i generišite ključeve (svaki posebno):

```bash
openssl rand -base64 32
```

- `AUTH_SECRET` — potpis sesije,
- `PORTAL_MFA_MASTER_KEY_V1` — šifrovanje TOTP tajni, kodova za reset i
  pozivnica (gubitak ključa = gubitak svih MFA vezivanja; čuvati i van servera),
- `AUTH_RATE_LIMIT_HMAC_KEY` — ograničavanje pokušaja (u produkciji obavezan).

Opis svake promenljive je u `.env.example`. Postupak za testnu bazu na
provajderu je u `docs/b2b/33-test-baza-runbook.md`.

### Baza za razvoj, bez instalacije

Ako Postgres nije instaliran na računaru, za razvoj i proveru je dovoljno:

```bash
npm run db:dev
```

Skripta pokreće PGlite (Postgres preveden u WebAssembly) na
`postgres://postgres:postgres@127.0.0.1:55432/postgres`. Podaci idu u
`tmp/portal-dev-db`. Prima jednu konekciju, pa uz nju treba `DATABASE_POOL_MAX=1`.

Namenjeno isključivo razvoju — produkcija koristi pravi Postgres.

## 2. Migracije

```bash
npm run db:migrate
```

Migracije `0000`–`0032` su u `db/migrations/`, redosled je u
`db/migrations/meta/_journal.json`. Pokreće ih nalog vlasnika šeme preko
`MIGRATION_DATABASE_URL` (u produkciji obavezno; lokalno pada na
`DATABASE_URL`). Nema „down" migracija, a neke menjaju podatke (npr. `0013`
briše lozinke odobrenih kupčevih naloga) — povratak je moguć samo iz backup-a.

**Ne koristiti `npm run db:generate`.** Drizzle snapshot postoji samo do
`0002`; migracije posle nje su pisane ručno, pa bi generator napravio
pogrešnu migraciju. Nova migracija se piše ručno i dodaje u `_journal.json`.

Posle migracija aplikacija dobija sopstvenu, užu ulogu:
`db/provisioning/runtime-role.sql` (vidi `docs/b2b/10-db-roles-runbook.md`).

## 3. Početni nalog

Popunite `BOOTSTRAP_ADMIN_EMAIL` i `BOOTSTRAP_ADMIN_PASSWORD` (najmanje 10
znakova), pa pokrenite:

```bash
npm run db:seed
```

Skripta upisuje sve pakete dozvola, podrazumevane pragove i **jedan** nalog
sa ulogom Vlasnik (interni ključ `gazda`). Ne upisuje nijednog kupca, fakturu, pošiljku ni iznos — vrednosti iz
dizajn prototipa su prikaz rasporeda, a ne podaci.

Posle prve prijave uklonite sve `BOOTSTRAP_ADMIN_*` vrednosti iz okruženja.
Drugi faktor (aplikacija za jednokratne kodove) je obavezan za sve interne
naloge. U režimu `enforced` (podrazumevan na Vercel-u) nalog bez faktora može
da se prijavi samo uz jednokratnu dozvolu za vezivanje; prvom Vlasniku je
izdaje `MFA_GRANT_EMAIL=… node scripts/issue-mfa-enrollment-grant.mjs`
(pokreće se lokalno, uz pristup bazi i `PORTAL_MFA_MASTER_KEY_V1`). Vidi
`docs/b2b/12-mfa-policy-closeout.md`.

Ostale korisnike Vlasnik otvara kroz **Korisnici i dozvole**. Uloge su:
`gazda`, `komercijalista`, `kancelarija`, `magacioner`. Uloga „Menadžer“ ne
postoji — dublji pristup se dodeljuje paketom dozvola, ne novom ulogom.

## 4. Pokretanje

```bash
npm run dev
```

Sistem je na `http://localhost:3000/portal`. Neprijavljen posetilac se
preusmerava na `/portal/prijava`.

## 5. Provera

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

## Kako je pristup uređen

Dva odvojena pojma:

- **Uloga** — osnovni obim posla (4 uloge).
- **Paket dozvola** — proširenje koje Vlasnik dodeljuje pojedinačnom korisniku.

Primer: **Komercijalista** sa paketom `analitika`. Time dobija analitiku cele firme, ali ne i odobravanje limita,
poručivanje robe, administraciju korisnika ni globalno zatvaranje upozorenja.
Nigde u kodu ne postoji provera po imenu korisnika — isti paket bilo kom drugom
komercijalisti daje isti pristup, a oduzimanje paketa ga uklanja odmah, bez
ponovne prijave.

Dozvole se čitaju iz baze pri **svakom** zahtevu. Token sesije nosi samo
identitet korisnika, pa se oduzimanje dozvole ne može „preživeti“ starim tokenom.

Pakete „Korisnici i dozvole" i „Bezbednost naloga" dodeljuje i oduzima samo
Vlasnik, uz svež kod iz aplikacije; niko ne dodeljuje paket sam sebi ni
pristup koji sam nema, i bezbednosne radnje nad nalogom Vlasnika izvodi samo
Vlasnik (`lib/authz/owner-guard-policy.mjs`).

Sakrivanje stavke iz navigacije je isključivo prikaz. Svaka ruta zove
`requireCapability(...)` na serveru i vraća **403** kada dozvole nema, bez obzira
na to da li je link bio vidljiv.

## Šta još ne radi i zašto

| Oblast | Stanje | Šta je potrebno |
|---|---|---|
| Dugovanja, kašnjenja, naplata, limiti | Namerno nedostupno | Fakture **ne sadrže** podatak o plaćanju. Potreban je odvojen proveren izvor uplata |
| Otprema, adresnice, BEX | Ekrani postoje, integracija nije napisana | BEX pristupni podaci i ugovor; kod još ne čita `BEX_*` |
| Zalihe, nabavka, porudžbine dobavljaču | Ekrani postoje, računa nema | Izvor stanja zaliha |
| CSV uvoz faktura | Isključen (`lib/import/csv-gate.mjs`) | Stvaran uzorak BizniSoft izvoza i usklađen parser |
| Cene kupca na javnom katalogu | Samo demo režim | Cenovnik i rabati iz BizniSofta, potvrđene veze artikal ↔ katalog |
| Samostalna promena zaboravljene lozinke kupca | Isključena | Slanje e-pošte; do tada nova pozivnica |

Nijedan od ovih ekrana nema dugme koje izgleda upotrebljivo a ne radi ništa —
umesto toga stoji šta tačno nedostaje.

## Uvoz faktura

- **Ručno:** `/portal/importi`, PDF dokumenti iz BizniSofta (Račun-otpremnica),
  najviše 4 MB po otpremanju (`lib/import/upload-limits.mjs`). Traži dozvolu
  `imports:write` (Vlasnik, kancelarija). Original se ne čuva — samo otisak i
  pročitane stavke.
- **Automatski:** Windows konektor (`connector/`, `docs/b2b/21-windows-connector.md`)
  čita PDF-ove iz foldera na kancelarijskom računaru i šalje potpisan JSON
  (Ed25519, bez deljenog ključa). Uključuje se sa `FEATURE_SYNC_DEVICE_INGEST=1`
  tek posle registracije uređaja.

Otisak fajla sprečava dvostruki uvoz; ista faktura iz drugog fajla ide na
ručni pregled, ne u promet.

## BEX (planirano)

Potrebno od BEX-a:

1. `ClientId` i API ključ za pristup,
2. odgovor da li postoji **test okruženje**; ako ne postoji, koristi se jasno
   označen razvojni adapter i nijedna stvarna pošiljka se ne kreira,
3. adresa servisa (`BEX_BASE_URL`).

Pristupni podaci se čuvaju isključivo u okruženju servera. Ne smeju se naći u
frontend kodu ni u repozitorijumu. Kod ih još ne čita.

Procenjeni i fakturisani trošak isporuke se vode odvojeno; procena se nikada ne
prikazuje kao potvrđeno dugovanje. Ništa se ne knjiži i nijedno plaćanje se ne
pokreće.

## Vraćanje unazad

Kod se vraća granom; baza ne može samo granom. Migracije nemaju „down" korak
i neke menjaju podatke, pa je jedini pouzdan povratak baze backup / povratak u
tačku vremena (PITR) kod provajdera. Pre svake migracije nad bazom sa stvarnim
podacima napraviti backup i proveriti da se može vratiti. Javni sajt ne zavisi
od baze i radi i kada je portal isključen.
