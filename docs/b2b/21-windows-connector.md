# 21 — Windows konektor za lokalne PDF fakture (P3)

Oznake: 🟢 dokazano kodom i testom · 🟡 implementirano, **Windows neproveren** · 🔴 nedostaje dokaz

Nastavak na [19 — kanonski ugovor](19-canonical-ingest-contract.md) i
[20 — prijem sa uređaja](20-device-ingest.md).

**Šta P3 jeste:** lokalni konektor koji čita podržane BizniSoft PDF fakture,
pravi canonical dokument postojećim parserom i ugovorom, čuva ga u trajnom
lokalnom redu i šalje potpisan postojećem device API-ju.

**Šta P3 nije:** nema portala, command pollinga, ACK/progress protokola,
semantičke deduplikacije, novih valuta ni preporuka. **Windows acceptance i
kancelarijska provera nisu izvršeni.**

---

## 1. Šta se stvarno pokreće

| | |
|---|---|
| Entrypoint | `connector/bin/connector.mjs` (`main()` iz `src/cli.mjs`) |
| Pokretač u paketu | `connector.cmd` (Windows) · `connector.sh` (razvoj) |
| Build | `npm run connector:build` → `connector/dist/` |
| Testovi | `npm run connector:test` · `npm run connector:e2e` |

```
carsystem-connector doctor        # konfiguracija, runtime, izvor, key-store, kalendar
carsystem-connector init          # lokalni Ed25519 par; ispisuje SAMO javni ključ + otisak
carsystem-connector export-key    # ponovni ispis javnog ključa i otiska
carsystem-connector dry-run       # scan/parse/validate, BEZ mreže i bez označavanja poslatim
carsystem-connector run-once      # izričito ručni ciklus
carsystem-connector auto          # poštuje raspored; ovo zove Task Scheduler
carsystem-connector status        # red, poslednji ishodi, sledeći termin
carsystem-connector heartbeat     # potpisano javljanje
```

### Runtime

**Node 24.14.0 (Active LTS)**, testirano. Node 20 je **EOL**.

Zašto baš 24: `node:sqlite` je u jezgru, pa trajni red ima prave transakcije i
WAL **bez nativnog modula**. `better-sqlite3` bi na Windowsu tražio prevođenje
ili prebuilt binarije po arhitekturi — najčešći uzrok pada pakovanja na tuđem
računaru. Node 22 bi takođe radio (isti modul), ali 24 je aktuelni LTS.

> **`node:sqlite` je u Node 24 označen kao experimental.** Runtime je pinovan uz
> paket, pa se ponašanje ne menja samo od sebe; nadogradnja Node-a je namerna i
> testirana radnja. `doctor` to prijavljuje kao poznat status. 🟡

> **Server i dalje radi na Node 20.** To je zaseban **produkcioni rizik** i vodi
> se kao poseban zadatak pre produkcije. P3 ga ne rešava i ne nadograđuje web
> projekat usput. 🔴

### Pakovanje

`dist/` preslikava strukturu repozitorijuma:

```
dist/
  contracts/invoice-ingest/v1/schema.json
  lib/pdf/{biznisoftLayout.mjs, parseDocument.js}
  lib/sync/{device/signing.mjs, contract/*.mjs}
  connector/{src, bin}
  node_modules/{ajv, unpdf, …}
  package.json  connector.cmd  connector.sh
```

Isti relativni `import` radi u repozitorijumu i u paketu, pa pakovanje **ne
prepisuje nijedan uvoz** — a to je tačno mesto na kome se paket tiho raziđe sa
izvorom. `validate.mjs` čita ugovor preko `../../../contracts/…`, što iz
`dist/lib/sync/contract/` daje `dist/contracts/`.

Provereno pokretanjem **van repozitorijuma**, iz putanje sa razmacima i srpskim
slovima. 🟢

---

## 2. Ponovo korišćeni moduli

Nijedna logika nije prepisana:

| Modul | Uloga |
|---|---|
| `lib/sync/device/signing.mjs` | potpisni niz, zaglavlja, prozor — **isti** koji server proverava |
| `lib/pdf/parseDocument.ts` | čitanje PDF-a (u paketu prevedeno u `.js`) |
| `lib/pdf/biznisoftLayout.mjs` | geometrija i aritmetika |
| `lib/sync/contract/fromParsedDocument.mjs` | canonical payload i `semantic_hash` |
| `lib/sync/contract/validate.mjs` | **ista** validacija koju radi i server |
| `contracts/invoice-ingest/v1/schema.json` | ugovor |

**Jedina izmena u zajedničkom kodu:** `parseDocument.ts` uvozi susedni
`./biznisoftLayout.mjs` relativno umesto kroz `@/` alias. TypeScript alias ne
prepisuje pri emitovanju, pa bi prevedeni fajl u paketu nosio uvoz koji van
repozitorijuma nema šta da razreši. Pokriveno postojećim `npx tsc --noEmit` i
`test:pdf`. 🟢

### Ispravka u brojanju iz P2 izveštaja

P2 izveštaj i komentari kažu „sedam polja“, a nabrajaju **osam**. Kod je
proveren: `signingString` spaja **osam** polja — protokol, device ID, key ID,
metod, putanja, timestamp, nonce, body SHA-256. Test je i pre ove faze tvrdio
svih osam.

**Omaška je bila samo u brojanju.** Wire format nije menjan; ispravljeni su
komentar, naziv testa i dokument. 🟢

---

## 3. API ishod → lokalno stanje

Odluka se vezuje za `code` i HTTP status, **nikad za tekst poruke**.

| Ishod servera | HTTP | Lokalno stanje | Ponavlja se? |
|---|---|---|---|
| `ingested` | 200 | `potvrdjeno` | ne |
| `duplicate_file` | 200 | `potvrdjeno` | ne |
| `business_key_conflict` | 409 | `za_pregled` | **ne** |
| `already_imported_other_source` | 409 | `za_pregled` | **ne** |
| `source_hash_content_mismatch` | 409 | `za_pregled` | **ne** |
| `nonce_replayed` | 409 | `spremno` | **da, sa NOVIM nonce-om** |
| `timestamp_out_of_window` | 401 | `blokirano` | ne — dijagnostika sata |
| `unknown_device`, `device_not_active`, `signature_invalid`, `issuer_mismatch`, `not_found` | 401/404 | `blokirano` | ne — **zaustavlja ceo ciklus** |
| `currency_unsupported`, `trade_date_unsupported`, `totals_mismatch`, `schema_invalid`, … | 422 | `odbijeno` | ne |
| `rate_limited` | 429 | `odlozeno` | da, sledeći radni dan |
| 5xx, `temporarily_unavailable` | 5xx | `odlozeno` | da |
| timeout / prekid veze | — | `odlozeno` | da |
| **nepoznat kod ili nije JSON** | bilo koji | `odlozeno` | **da — nikad potvrda** |

Dve zamke koje su lako promašive i zato imaju svoj test:

- **`ok: true` nije dokaz knjiženja.** Ruta vraća `ok: true` i za ishode koje je
  server sačuvao za pregled (409). 🟢
- **HTTP 409 nosi dve različite stvari.** `nonce_replayed` traži ponavljanje;
  ishodi za pregled ga zabranjuju. Status sam po sebi nije dovoljan. 🟢

`Retry-After` se poštuje i ograničava na 24 h, ali **ne skraćuje** poslovni
raspored: server sme da traži duže čekanje, ne ranije slanje.

---

## 4. Lokalni red

`node:sqlite`, WAL, `synchronous=FULL`, `BEGIN IMMEDIATE`.

**Identitet reda** je `(origin, deviceCode, sourceSystem, issuerCode,
contractVersion)`. Promena servera ili uređaja daje `identity_mismatch` i staje —
tiho preuzimanje bi značilo da dokumenti izgledaju poslati serveru na koji nikad
nisu stigli. Stari red ostaje netaknut. 🟢

**Stanja:** `spremno` → `salje_se` → `potvrdjeno` / `za_pregled` / `odbijeno` /
`odlozeno` / `blokirano`, plus `nepodrzano` za dokumente koji ni ne stižu do
mreže.

Dokazano testom:

1. **Pad usred slanja** → `oporaviZaglavljene()` vraća stavku u `spremno`. Bez
   toga bi ostala zauvek u `salje_se` — najtiši mogući gubitak. 🟢
2. **Izgubljen odgovor posle knjiženja** → nov proces otvara **isti** red i
   ponavlja sa **novim** nonce-om → `duplicate_file`, **jedna** faktura, promet
   7 redova. 🟢
3. **Potpis se računa iznova pri svakom pokušaju.** Gotov HTTP zahtev se ne čuva
   u redu: ponovljen nonce je replay, a stari timestamp ispada iz prozora. 🟢
4. **Potvrda tek posle prepoznatog odgovora.** HTML 200 od captive portala ne
   briše stavku iz reda. 🟢
5. **Neuspeh upisa nije uspeh** — `zavrsi()` odbija nezavršno stanje. 🟢
6. **Trajna brava** u istoj bazi; zastarela se preuzima tek posle punog perioda
   bez obnove, pa živa instanca ne može biti prekinuta. 🟢
7. **Nema automatskog resetovanja** pokvarenog reda i nema brisanja „starih
   neuspeha“. 🟢

> Mrežni **„exactly once“ se ne obećava**. Obećava se ponovljiv pokušaj slanja uz
> postojeće idempotentno knjiženje po otisku bajtova.

**Obim:** 12.000 sintetičkih stavki — upis 23 ms, serija ograničena na 50, bez
porasta heap-a. To je sintetički benchmark, **ne** kancelarijski acceptance. 🟢

---

## 5. Skeniranje

- Samo **eksplicitno konfigurisan folder**, neposredno u njemu, bez rekurzije.
- Folder se **nikada ne pravi automatski**: pogrešna putanja je greška, ne
  uspešan prazan uvoz. 🟢
- **Nedostupan izvor ≠ nema faktura** — različiti kodovi i različit status. 🟢
- Samo obični PDF fajlovi, `.PDF` uključivo; symlink/junction se preskaču, uz
  dodatnu `realpath` proveru korena. 🟡 *(Windows junction neproveren)*
- **Originali se ne diraju** — ne menjaju se, ne preimenuju, ne brišu, ne
  premeštaju. Red i karantin žive u folderu stanja.
- Stabilnost: dva ista očitanja `size`+`mtime`, pa **jedno** čitanje; posle
  čitanja se poredi ponovo. Delimično zapisan fajl se **odlaže**, ne proglašava
  trajno neispravnim. 🟢
- **Identitet je otisak sadržaja.** Isti sadržaj pod drugim imenom ne pravi novu
  stavku; promenjeni bajtovi na istoj putanji prolaze ponovo. 🟢
- Parser dobija **taj isti bafer** nad kojim je računat `source_hash` — ne
  putanju. 🟢

> **UNC / mrežni disk NIJE proglašen podržanim.** Nije testiran; ponašanje pri
> prekidu mreže se razlikuje od lokalnog diska. 🔴

---

## 6. Ključ i podaci

Privatni **Ed25519** ključ nastaje lokalno (`init`) i **nikada ne napušta
računar**. Na ekran idu samo javni ključ (SPKI base64) i otisak.

**Windows DPAPI, opseg `CurrentUser`.** `LocalMachine` nije zamena — Microsoft
izričito navodi da taj opseg mogu otključati svi procesi na mašini. `CurrentUser`
ne štiti od kompromitovanog naloga koji izvršava konektor (takav napadač ionako
može da pozove konektor), ali štiti od drugih naloga i od kopiranja fajla.

Posledica: **autostart i ručno pokretanje moraju ići pod istim nalogom.** Zadatak
kao `SYSTEM` ne bi otključao ključ, a „rešenje“ prelaskom na `LocalMachine` bi
poništilo zaštitu.

Tajna ide kroz **procesne cevi** (`stdin`), ne kroz komandnu liniju —
interpolacija bi je ostavila u `Win32_Process` i u alatima za nadzor. 🟡

**Fail closed:** nema plaintext fallback-a. Test adapter za macOS/Linux traži
izričitu promenljivu **i** odsustvo produkcionog režima; spakovan konektor ga
odbija sa `insecure_keystore_refused` čak i kada je promenljiva postavljena. 🟢

**Ponovljen `init` ne menja postojeći ključ.** Tiha zamena bi obesmislila već
obavljenu aktivaciju: uređaj bi ostao „aktivan“, a potpisi mu više ne bi
odgovarali. Oporavak od izgubljenog ključa je **nova ovlašćena registracija**. 🟢

**Podaci i logovi:** canonical JSON nosi poslovne podatke iako PDF ne napušta
računar. Log i `status` po podrazumevanom nemaju sirov PDF/tekst/JSON, imena
kupaca i fajlova, PIB, putanje, ključeve ni stack — samo redigovane tehničke
reference (`sd:<12 hex>`), kodove i zbirne brojeve, uz rotaciju. 🟢
ACL foldera stanja se sužava `windows/harden-state-dir.ps1` (Node `chmod` na
Windowsu ne postavlja ACL). 🟡

### Registracija — granica prema P4

Konektor **ne dodaje** javnu bootstrap rutu i nema administrativni pristup bazi.
`init` ispisuje javni ključ i otisak; registraciju i aktivaciju obavlja ovlašćeno
lice postojećim tokom `devices:manage`.

> **Registracioni ekran u portalu je P4.** Do tada se koristi postojeći servis;
> u testovima kroz izolovani harness, bez zaobilaženja RBAC-a. 🔴

---

## 7. Raspored

**Radnim danima u 09:00, `Europe/Belgrade`**, kroz `Intl` — ne fiksni UTC+1/+2.
DST je pokriven testom (isti UTC sat daje 09:00 zimi i 10:00 leti). 🟢

**Kalendar:** `connector/src/calendar.mjs`.
Izvor: *Zakon o državnim i drugim praznicima u Republici Srbiji*
(„Sl. glasnik RS“, br. 43/2001, 101/2007, 92/2011), čl. 1, 2, 3 i 3a.
**Pokrivene godine: 2024–2030.**

- Fiksni: 1–2. januar, 7. januar, 15–16. februar, 1–2. maj, 11. novembar.
- Vaskršnji: Veliki petak → drugi dan Vaskrsa (julijanski Paschalion + 13 dana;
  provereno nad 2024–2028 sa ispisanim očekivanim datumima). 🟢
- Čl. 3a: **državni** praznik u nedelju pomera se na prvi naredni radni dan i
  **preskače** dan koji je ionako neradan. **Verski** praznik se ne pomera.
- Radna nedelja je **ponedeljak–petak**; subota se ne tretira kao radni dan.
- `dodatnaZatvaranja` u konfiguraciji — eksplicitna zatvaranja firme.

> Van 2024–2030 status je **`calendar_unverified`** i automatski ciklus je
> **blokiran**. Prećutno proglašavanje rasporeda validnim bi značilo slanje na
> Novu godinu čim istekne poslednja pregledana godina. 🟢
>
> Kalendar je zapis **zakona**, ne zvanične godišnje objave. Pojedinačna rešenja
> Vlade nisu uračunata. 🔴

### Konkretni termini

| Situacija | Sledeći termin |
|---|---|
| Petak 13.03.2026, ciklus izvršen | **ponedeljak 16.03.2026 09:00** |
| Subota 07.03.2026 | ponedeljak 09.03.2026 |
| Sreda 07.01.2026 (Božić) | četvrtak 08.01.2026 |
| Neuspeh u petak 13.03.2026 | ponedeljak 16.03.2026 |
| Neuspeh 06.01.2026 (pred Božić) | četvrtak 08.01.2026 |
| Restart 31.12.2026 posle ciklusa | **ponedeljak 04.01.2027** |
| Ručni `run-once` | odmah, i na neradni dan — uz oznaku `rucno_pokretanje` |

Tri razdvojene situacije:

1. **Redovan termin** — jedan logički ciklus po lokalnom radnom datumu.
2. **Neuspeh** — najranije **sledećeg radnog dana** u 09:00. Nema ponavljanja na
   svakih nekoliko sekundi, vikendom ni praznikom.
3. **Propušten termin** — pri kasnijem pokretanju istog radnog dana izvršava se
   **najviše jedan** naknadni ciklus. Konektor ugašen nedelju dana **ne** izvršava
   pet ciklusa; preostali red i novo skeniranje idu u jednom ograničenom prolazu. 🟢

Restart usred ciklusa oporavlja lokalna stanja, ali poštuje evidentiran sledeći
termin — broj pokušaja i raspored se ne brišu.

**Autostart:** `connector/windows/task.ps1` (Task Scheduler, 09:05, isti nalog,
`StartWhenAvailable`, `MultipleInstances IgnoreNew`). Task Scheduler **pokreće**
proces; **aplikacija** odlučuje da li je poslovni termin dozvoljen —
`StartWhenAvailable` nije zamena za praznični kalendar.

**Podrazumevano dry-run**; za izmenu treba `-Apply`. Uklanjanje zadatka **ne
briše** PDF-ove, ključ ni red. 🟡

> `-LogonType Interactive`: zadatak radi kada je nalog prijavljen. Rad **bez
> prijave** traži sačuvanu lozinku i **nije testiran**. Ne obećava se ni
> izvršavanje u 09:00 dok je računar ugašen. 🔴

---

## 8. Testovi

| Skup | Izvršeno | Rezultat |
|---|---|---|
| `connector:test` — čista logika + skener/red (iz paketa) | ✅ Node 24 | **49/49** |
| `connector:e2e` — pun tok preko HTTP-a do QA PG | ✅ Node 24 | **12/12** |
| Sintetički obim 12.000 stavki | ✅ | 23 ms, serija 50, bez porasta heap-a |
| Pakovanje + pokretanje van repoa | ✅ | putanja sa razmacima i ČĆŽŠĐ |
| **Windows smoke (10 testova)** | ❌ **NIJE IZVRŠENO** | napisano i spremno; `process.platform !== "win32"` |
| Fizička kancelarijska provera | ❌ **NIJE IZVRŠENO** | — |

Pod Node 20 (runtime web projekta) se E2E fajl **izričito preskače** uz razlog —
`node:sqlite` tamo ne postoji. Provera ide kroz stvarni `import`, jer
`getBuiltinModule` u Node 20 zna za ime a `import` puca.

> **macOS/Linux prolaz NIJE dokaz Windows ponašanja.** Windows smoke test
> pokriva DPAPI `Protect`/`Unprotect` pod predviđenim nalogom, Windows putanje,
> zaključan fajl, restart reda i dry-run zadatka — sve to čeka mašinu.

---

## 9. Otvoreno posle P3

| | Status |
|---|---|
| **P4**: portal kontrole, command polling, ACK/progress | 🔴 nije započeto |
| **Windows acceptance** (DPAPI, autostart, UNC, rad bez prijave) | 🔴 nije izvršeno |
| **Fizička kancelarijska provera** i stvarna istorija | 🔴 nije izvršeno |
| Registracioni ekran uređaja u portalu | 🔴 P4 |
| Realni korektivni uzorci (storno, povrat, knjižno odobrenje) i podrška za njih | 🔴 |
| Semantička deduplikacija | 🔴 nepokriveno |
| Nove valute i stvarni datum prometa | 🔴 |
| Preporuke i prognoza | 🔴 nije započeto |
| Nedostatak navigacije za `/portal/importi/dokumenti` | 🔴 P4 |
| **Server na Node 20 (EOL)** | 🔴 zaseban produkcioni rizik |

**Zaključak: P3 je implementiran; Windows i kancelarijski acceptance čekaju.**
