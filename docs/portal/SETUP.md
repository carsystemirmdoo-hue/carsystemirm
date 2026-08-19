# Poslovni sistem — podešavanje (faza 1)

Uputstvo za pokretanje internog poslovnog sistema na `/portal`. Javni sajt radi
nezavisno i ne zahteva nijedan od ovih koraka.

## 1. Baza

Potreban je Postgres. Besplatan nivo kod **Neon**-a ili **Supabase**-a je dovoljan
za početak i ne uvodi mesečni trošak (vidi `COST_CONTROL.md`).

```bash
cp .env.example .env.local
```

Popunite `DATABASE_URL` i generišite ključ sesije:

```bash
openssl rand -base64 32
```

Dobijenu vrednost upišite u `AUTH_SECRET`.

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

Migracije su aditivne i ne brišu postojeće podatke.

| Migracija | Šta radi |
|---|---|
| `0000_init_portal_core.sql` | Tabele `users`, `permission_packages`, `user_permissions`, `customers`, `customer_assignments`, `audit_log`, `system_settings`, `user_preferences` i tip `user_role` |
| `0001_audit_log_append_only.sql` | Okidači koji odbijaju `UPDATE` i `DELETE` nad `audit_log` |

Nove migracije se prave sa `npm run db:generate` posle izmene `db/schema/`.

## 3. Početni nalog

Popunite `BOOTSTRAP_ADMIN_EMAIL` i `BOOTSTRAP_ADMIN_PASSWORD` (najmanje 10
znakova), pa pokrenite:

```bash
npm run db:seed
```

Skripta upisuje osam paketa dozvola, podrazumevane pragove i **jedan** Gazda
nalog. Ne upisuje nijednog kupca, fakturu, pošiljku ni iznos — vrednosti iz
dizajn prototipa su prikaz rasporeda, a ne podaci.

Posle prve prijave uklonite `BOOTSTRAP_ADMIN_PASSWORD` iz okruženja.

Ostale korisnike Gazda otvara kroz **Korisnici i dozvole**. Uloge su:
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
- **Paket dozvola** — proširenje koje Gazda dodeljuje pojedinačnom korisniku.

Primer iz specifikacije: Miroslav Suljagić je **Komercijalista** sa paketom
`analitika`. Time dobija analitiku cele firme, ali ne i odobravanje limita,
poručivanje robe, administraciju korisnika ni globalno zatvaranje upozorenja.
Nigde u kodu ne postoji provera po imenu korisnika — isti paket bilo kom drugom
komercijalisti daje isti pristup, a oduzimanje paketa ga uklanja odmah, bez
ponovne prijave.

Dozvole se čitaju iz baze pri **svakom** zahtevu. Token sesije nosi samo
identitet korisnika, pa se oduzimanje dozvole ne može „preživeti“ starim tokenom.

Sakrivanje stavke iz navigacije je isključivo prikaz. Svaka ruta zove
`requireCapability(...)` na serveru i vraća **403** kada dozvole nema, bez obzira
na to da li je link bio vidljiv.

## Šta još ne radi i zašto

| Oblast | Stanje | Šta je potrebno |
|---|---|---|
| Promet, kupci, analitika | Ekrani postoje, podataka nema | Uvoz faktura iz BiznisSoft izvoza (faza 2) |
| Dugovanja, kašnjenja, naplata | Namerno nedostupno | Fakture **ne sadrže** podatak o plaćanju. Potreban je odvojen proveren izvor uplata. Do tada stoji „Podatak nije dostupan iz trenutnog izvora“ |
| Otprema, adresnice, BEX | Ekrani postoje, poziv nije povezan | `BEX_CLIENT_ID`, `BEX_API_KEY`, `BEX_BASE_URL`, `FEATURE_BEX=2` |
| Zalihe, nabavka, porudžbine | Ekrani postoje, računa nema | Izvor stanja zaliha i istorija dana bez zalihe (faza 4) |
| Obaveštenja, kreditni limiti | Ekrani postoje | Faza 5, nad proverenim podacima |
| Globalna pretraga | Prikazana isključeno | Faza 2 |

Nijedan od ovih ekrana nema dugme koje izgleda upotrebljivo a ne radi ništa —
umesto toga stoji šta tačno nedostaje.

## Uvoz faktura (priprema za fazu 2)

Folder sa BiznisSoft izvozom je na računaru u kancelariji, a sistem radi u
oblaku, pa server ne može da čita taj folder direktno. Predviđeno rešenje je
mali lokalni konektor koji svakog radnog dana u 09:00 pregleda folder i šalje
nove fajlove na zaštićenu adresu sistema.

Uslovi pre uključivanja:

- konektor instaliran na računaru gde se nalazi folder,
- `INGEST_API_KEY` podešen sa obe strane,
- `FEATURE_FOLDER_CONNECTOR=1`.

Konektor čita isključivo za čitanje i nikada ne menja ni ne briše izvorne
fajlove. Otisak fajla (hash) sprečava dvostruki uvoz.

## BEX (priprema za fazu 3)

Potrebno od BEX-a:

1. `ClientId` i API ključ za pristup,
2. odgovor da li postoji **test okruženje**; ako ne postoji, koristi se jasno
   označen razvojni adapter i nijedna stvarna pošiljka se ne kreira,
3. adresa servisa (`BEX_BASE_URL`).

Pristupni podaci se čuvaju isključivo u okruženju servera. Ne smeju se naći u
frontend kodu ni u repozitorijumu. Uključivanje ide preko `FEATURE_BEX`.

Procenjeni i fakturisani trošak isporuke se vode odvojeno; procena se nikada ne
prikazuje kao potvrđeno dugovanje. Ništa se ne knjiži i nijedno plaćanje se ne
pokreće.

## Vraćanje unazad

Migracije samo dodaju tabele i ne diraju postojeće podatke javnog sajta. Za
povratak na stanje pre ovog rada dovoljno je vratiti granu — radna grana je
`recovery/pre-claude-2026-08-07`. Ako je baza već migrirana, tabele mogu ostati
prazne bez uticaja na javni sajt, jer ih koristi isključivo `/portal`.
