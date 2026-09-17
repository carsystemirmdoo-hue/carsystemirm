# Staging i kontrolisano puštanje JEDNOG kancelarijskog uređaja

**Status:** priprema. Nijedan korak iz ovog dokumenta nije izvršen nad stvarnim
serverom, bazom, uređajem ili fakturom. Automatski offline Windows smoke je
prošao na HEAD-u `48472d7` (kancelarijski računar, Windows 10 Pro 19045,
Node 24.20.0).

Ovaj dokument dopunjuje, ne zamenjuje:

- [`recommendation-office-validation-runbook.md`](recommendation-office-validation-runbook.md)
  — koren arhive (§8), inventar (§8.4), backfill (§13–§14), kapije i rollback (§20);
- [`20-device-ingest.md`](20-device-ingest.md) — potpisani device API;
- [`21-windows-connector.md`](21-windows-connector.md) i
  [`../../connector/windows/OFFICE-INSTALL.md`](../../connector/windows/OFFICE-INSTALL.md)
  — konektor i instalacija.

Svaki URL, nalog, tajna i hosting pojam ovde je **mesto koje vlasnik popunjava**.
Nijedan nije izmišljen i nijedan ne postoji u repozitorijumu.

---

## 1. Tok podataka — provereno u kodu

```
PDF (kancelarija) → skener → parser → canonical payload → potpisan POST /api/sync/ingest
  → ingestCanonicalInvoice → ingestParsedDocument (ISTI put kao ručni PDF uvoz)
  → source_documents / source_document_lines → invoices / invoice_lines
  → effective_sales_ledger (VIEW) → portal i preporuke
```

| Podatak | Gde živi | Napušta računar? |
|---|---|---|
| PDF bajtovi | samo u memoriji konektora, za otisak i parser | **nikad** |
| apsolutna putanja, ime fajla | lokalni red (`stavke.putanja`), lokalni ispis `dry-run`/`run-once` | **nikad** |
| izdvojen tekst dokumenta | samo u parseru | **nikad** |
| privatni ključ | `device-key.bin`, šifrovan DPAPI-jem | **nikad** (odlazi samo potpis) |
| lokalni log | `connector.log` u folderu stanja | **nikad** |
| canonical payload | lokalni red (`stavke.telo`) i telo zahteva | **da** — ovo je jedini poslovni sadržaj |
| brojači komande, heartbeat | telo zahteva | da, bez ijednog podatka o dokumentu |

**Payload** (`lib/sync/contract/fromParsedDocument.mjs`, šema sa
`additionalProperties:false`): verzije šeme/kanonikalizacije/parsera,
`source_system`, `issuer.code`, vrsta, broj i datum dokumenta, valuta,
**šifra partnera** (bez naziva, PIB-a i adrese), zbir sa dokumenta, stavke
(šifra artikla, opis, jedinica, količina, cena, rabat, PDV, iznosi), broj
strana i stavki, `source_hash` (SHA-256 bajtova PDF-a) i `semantic_hash`.

**Zaglavlja:** verzija protokola, oznaka uređaja, `key_id`, vreme, nonce,
SHA-256 tela i Ed25519 potpis.

**Server trajno čuva:** `source_documents` (otisak fajla kao `file_hash`,
izvedeno ime `canonical:<12 heks>` — ne originalno ime, broj i datum
dokumenta, šifra partnera, `issuer_code` iz REGISTRACIJE uređaja,
`origin='device'`, `delivered_by_device_id`, `semantic_hash` koji server sam
ponovo računa), stavke izvornog dokumenta, a ako je kupac mapiran i nema
konflikta: `invoices`, `invoice_lines` i šifre artikala u `articles`. Trag je u
`audit_log`, sa uređajem kao akterom. **Nema** PDF-a, putanje, originalnog
imena, sirovog teksta ni PIB-a.

**Ne pravi se nova baza ni drugi ledger.** Device put i ručni PDF uvoz završavaju
u istoj funkciji `ingestParsedDocument`; `effective_sales_ledger` je postojeći
VIEW nad `invoices` + `invoice_lines`. Preporuke čitaju
`recommendation_input_lines`, koji je uži od ledgera (samo validni, originalni,
mapirani dokumenti). **Sajt nikad ne kontaktira kancelarijski računar:** komande
uređaj sam preuzima (`/api/sync/commands/poll`).

---

## 2. Kapije za staging

`READY` — urađeno i testirano u repozitorijumu. `MISSING` — traži rad u repu.
`EXTERNAL_EVIDENCE_REQUIRED` — zavisi od hostinga, stvarne tajne ili stvarnog
okruženja i dokazuje se tamo.

| # | Kapija | Stanje | Dokaz / šta nedostaje |
|---|---|---|---|
| 1 | HTTPS staging endpoint | EXTERNAL_EVIDENCE_REQUIRED | konektor odbija `http://` i redirekcije (`connector/src/client.mjs`); u repu nema deploy konfiguracije ni staging adrese |
| 2 | migracije na čistoj staging bazi | EXTERNAL_EVIDENCE_REQUIRED | 28 migracija, test lanca i ponovljivosti (`db/integration/migrations.integration.test.mts`); `db/migrate.mjs` samo `VERCEL_ENV=production` tretira kao produkciju — na Preview-u pada na `DATABASE_URL` |
| 3 | backup i dokazan restore | MISSING + EXTERNAL | nema skripte ni dokaza; `07-threat-model.md` T24 i `09-owner-decisions…` P14 su otvoreni |
| 4 | enrollment i aktivacija uređaja | READY (kod) / EXTERNAL (stvarni uređaj) | `lib/sync/device/registry.ts`, portal `Sistem → Sinhronizacija`, aktivacija traži ponovno upisan otisak ključa |
| 5 | vezivanje za izdavaoca | READY | `issuer.code` iz payloada mora biti jednak registrovanom (`validate.mjs`, `issuer_mismatch`); `source_system` je u šemi zaključan na `biznisoft` |
| 6 | gazda nalog sa MFA | READY (kod) / EXTERNAL (stvarni nalog) | MFA je obavezan na svakom `VERCEL_ENV` osim `development`; `devices:manage` ima samo gazda |
| 7 | opoziv uređaja | READY | status uređaja i ključa se čita pri SVAKOM zahtevu; test „opoziv zatvara pristup…" |
| 8 | rotacija ključa | MISSING (rotacija) / READY (zamena) | šema dozvoljava više ključeva, ali nema funkcije za dodavanje; **zamena** = opoziv + registracija novog uređaja + nov folder stanja |
| 9 | audit prijema i odluka | READY, uz dve rupe | registracija/aktivacija/opoziv, prijem, knjiženje, duplikat, komande; **ne beleže se** neuspele autentifikacije; odbijen payload (422) upisuje se pod pogrešnom oznakom `pdfDuplicateSkipped` |
| 10 | zaštita od replay-a | READY | ±5 min, SHA-256 tela, jedinstven nonce u `sync_request_nonces`; testovi u `deviceIngest.integration.test.mts` |
| 11 | redosled gate-ova | READY (kod) / EXTERNAL (hosting) | runbook §20B: ingest → operations → recommendations; gašenje obrnuto |
| 12 | bezbedno gašenje gate-ova | READY posle ove grane | ranije je dokument poslat u trenutku gašenja ostajao trajno `blokirano`; vidi §5 |
| 13 | ograničenje na jedan uređaj | MISSING (tehnički) | ništa ne sprečava drugi uređaj u istom opsegu; ograničenje je **procedura**: tačno jedna registracija, proverava se u portalu |
| 14 | Node verzija na serveru | EXTERNAL_EVIDENCE_REQUIRED | `.nvmrc` = 24.20.0, `engines >=22`; stariji dokumenti (`20`, `21`, `22`) još pominju Node 20 — merodavna je podešena verzija na hostingu |
| 15 | oporavak lokalnog SQLite reda | READY, uz rupu | `schema_newer`, `identity_mismatch` i pokvaren fajl staju i ne brišu red; zaglavljeno slanje se oporavlja; `watch` nad pokvarenim fajlom ponavlja pokušaj umesto da stane — zato se `watch` ovde ne koristi |
| 16 | kancelarijski internet ne radi | READY | mrežna greška → stavka ostaje, sledeći radni dan; HTML/nepoznat odgovor nikad nije potvrda |
| 17 | nastavak posle restarta | READY, uz ograničenje | zastarela brava posle 15 min, otvorena komanda se nastavlja, `salje_se` se vraća u red; bravu **niko ne obnavlja** tokom dugog ciklusa — zato jedan pokretač u isto vreme (Faza F/G) |
| 18 | zadržavanje podataka i privatnost | MISSING + EXTERNAL | nema politike zadržavanja ni postupka brisanja; audit je append-only; odluka vlasnika |

---

## 3. Faza A — server / staging

Izvodi vlasnik hostinga. Ništa od ovoga repo ne može da dokaže.

1. **Izolovana staging baza** bez stvarnih podataka. Ime baze sadrži `staging`.
   Nije nova poslovna baza: posle staging-a se ne koristi i ne spaja.
   > `db/integration/safety.mjs` prihvata `staging` kao testno ime. Zato se
   > `qa:pg:reset` i integracioni testovi **nikad** ne usmeravaju na bazu koja
   > sadrži ijedan podatak koji treba sačuvati.
2. **Migracije:** `MIGRATION_DATABASE_URL=<staging, vlasnik šeme> npm run db:migrate`.
   Dokaz: broj redova u `drizzle.__drizzle_migrations` jednak broju unosa u
   `db/migrations/meta/_journal.json`.
3. **Backup pa restore — pre Faze E.** Napraviti backup prazne migrirane baze i
   dokazati restore u zasebnu bazu (isti broj migracija, iste tabele). Ovaj
   backup je i postupak čišćenja posle Faze E.
4. **HTTPS:** staging origin mora biti `https://`, bez redirekcije na putanji
   `/api/sync/*`. Deployment protection hostinga ne sme presretati `/api/sync/*`
   (konektor ne prati redirekcije i HTML odgovor ne smatra potvrdom).
5. **Node** na hostingu: 24.x.
6. **Obavezne promenljive:** `AUTH_RATE_LIMIT_HMAC_KEY` (≥ 32 bajta; bez njega
   remote okruženje odbija prijavu i sync), MFA ključevi, `DATABASE_URL`
   (runtime nalog). Gate-ovi **isključeni**:
   `FEATURE_SYNC_DEVICE_INGEST=0`, `FEATURE_SYNC_OPERATIONS=0`,
   `FEATURE_RECOMMENDATIONS=0`.
7. **Gazda nalog sa MFA:** `BOOTSTRAP_ADMIN_*` + `npm run db:seed`, zatim
   `npm run mfa:grant` i upis drugog faktora pri prvoj prijavi.
8. **Rollback staging-a:** gate-ovi na 0 (obrnutim redosledom), pa restore iz
   koraka 3.

**Izlaz Faze A:** zapisnik sa staging origin-om, brojem migracija, dokazom
restore-a i potvrdom da je gazda prijavljen sa MFA.

## 4. Faza B — registracija uređaja

Tačno **jedan** uređaj. Staging uređaj **nije** produkcioni uređaj: za
produkciju se kasnije pravi nov ključ u novom folderu stanja i nova
registracija na produkcionom serveru.

1. Na kancelarijskom računaru, pod postojećim Windows nalogom, u folderu stanja
   namenjenom staging-u:
   ```
   set CS_CONNECTOR_STATE_DIR=%LOCALAPPDATA%\CarsystemConnector-staging
   connector.cmd init
   ```
   Ispis nosi **samo** javni ključ (SPKI base64) i otisak. Privatni ključ ostaje
   u `device-key.bin`, šifrovan DPAPI-jem za taj nalog; ne prikazuje se, ne
   kopira i ne prenosi.
2. Gazda u portalu (`Sistem → Sinhronizacija`, `devices:manage`) registruje
   uređaj: oznaka uređaja, izvorni sistem `biznisoft`, **šifra izdavaoca** koju
   potvrđuje vlasnik, javni ključ. Stanje: `registered`.
3. Aktivacija: gazda ponovo upisuje otisak koji **pročita sa ekrana
   kancelarijskog računara** (`connector.cmd export-key`). Neslaganje = nema
   aktivacije. Stanje: `active`.
4. Provera da postoji tačno jedan uređaj u opsegu. Drugi se ne registruje.
5. **Opoziv mora biti moguć:** gazda vidi dugme za opoziv; opoziv traži razlog i
   ne može se poništiti.

## 5. Faza C — kancelarijska konfiguracija

- Jedan postojeći Windows nalog; drugi nalog **nije potreban**
  (`RUCNO-DPAPI-NALOG` = `NOT_APPLICABLE_CURRENT_TOPOLOGY`; ponovo se otvara ako
  se uvede drugi ili servisni nalog).
- Node 24 (zvanični x64 installer).
- Namenski koren: `Desktop\Fakture` — putanja se upisuje u `izvorniFolder`, ne u kod.
- `connector.cmd` se pokreće **bez administratorskih prava**. Jedini izuzetak je
  Faza F, i to samo ako Windows odbije registraciju zadatka bez elevacije.
- `config.json` za staging:
  `serverOrigin` = staging HTTPS origin iz Faze A, `deviceCode`, `keyId`,
  `sourceSystem: "biznisoft"`, `issuerCode` iz Faze B, `izvorniFolder`.
  `maxPoCiklusu` (podrazumevano 50) je broj slanja po ciklusu i ostaje
  podrazumevan dok se u Fazi G ne odluči drugačije.

### Šta je ispravljeno pre ove faze (grana `fix/windows-smoke-office-findings`)

- **Server:** brojač nepoznatih pozivalaca (`sync_unknown`, 20 u 5 min po oznaci)
  brojao je i USPEŠNE zahteve aktivnog uređaja. Konektor na 429 odlaže stavku
  do sledećeg radnog dana, pa bi backfill napredovao ~20 dokumenata dnevno.
  Sada se broje samo odbijeni zahtevi.
- **Konektor:** blokada podešavanja (isključen gate, opozvan uređaj, pomeren
  sat) više ne izbacuje dokument iz reda — ciklus staje, stavka ostaje
  `spremno` i šalje se posle ispravke.

Konektor je promenjen, pa paket `48472d7` **više nije merodavan**: novi ZIP
mora proći Windows smoke pre Faze D.

## 6. Faza D — read-only inventar stvarne arhive

Stvarna arhiva: `Desktop\Fakture`, neposredni folderi `FAKTURE 2021`–`FAKTURE 2026`
(i svaki budući), očekivano **13.680 PDF-ova**, **12.319 kandidata**, **1.361**
preskočen po nazivu, ≈ **1,818 GB**. Kandidat je PDF čije ime nosi samostalno
`faktura` ili `fak`. Obilazi se koren i tačno jedan nivo; linkovi, junction,
reparse tačke i dublji folderi se ne prate.

### Da li dry-run piše u SQLite? DA.

`dry-run` ne šalje ništa i ne dira PostgreSQL, ali ide istim putem kao pravi
ciklus i **upisuje u lokalni red**:

- `meta`: `identitet` (origin, uređaj, izdavalac) i `sema_verzija`;
- `stavke`: do **200** novih dokumenata — `source_hash`, **apsolutna putanja**,
  veličina, canonical telo, `semantic_hash`, stanje `spremno` (ili `nepodrzano`
  sa razlogom).

Te stavke bi sledeći `run-once` ili zakazani ciklus POSLAO. Zato se inventar
radi nad **jednokratnim folderom stanja**, nikad nad staging/produkcionim:

```
set CS_CONNECTOR_STATE_DIR=%TEMP%\Carsystem Inventar
connector.cmd --config "<putanja do config.json>" dry-run > "%TEMP%\Carsystem Inventar\inventar.json"
echo %ERRORLEVEL%
```

Inventar ne traži ključ ni registraciju i ne otvara mrežu. PDF se samo čita:
ne menja se, ne preimenuje, ne briše i ne zaključava za pisanje.

**Brisanje i ponavljanje:** obrisati ceo folder `%TEMP%\Carsystem Inventar`
(`queue.db`, `queue.db-wal`, `queue.db-shm`, `connector.log`, `inventar.json`).
Sledeći inventar počinje od nule. Ne dira ništa u `Desktop\Fakture`.

`inventar.json` sadrži apsolutne putanje (u `preskoceno` za prazne/prevelike
fajlove) — **ostaje na računaru**. Iz njega se u zapisnik prepisuje samo zbir.

### Šta operater čita i potvrđuje

- izabran koren (apsolutna putanja, lokalno);
- `ukupnoPdf`, `kandidata`, `nijeFakturaPoNazivu` — ukupno i u `poFolderu` za
  svaku godinu;
- `popis` = `pun`, izlazni kod **0**. `5` = nepotpun (`popis_prekinut` ili
  `folder_nedostupan`) → **FAIL**, nema nastavka;
- svaki unos u `preskoceno`: `folder_nedostupan`, `popis_prekinut`, `predubok`,
  `symlink`, `podfolder_symlink`, `podfolder_van_korena`, `van_korena`,
  `nije_obican_fajl`, `prazan`, `prevelik`, `nestao`;
- `necitljivo`, `preskocenoTehnicki`.

**Uslov:** zbir odgovara očekivanim brojevima (13.680 / 12.319 / 1.361) ili je
svako odstupanje objašnjeno, i to je upisano u zapisnik rečenicom iz runbook §8.5.
Bez toga nema Faze E.

## 7. Faza E — mali staging E2E

Tek posle zelenog inventara. **Ne nad stvarnom arhivom.**

1. Zaseban folder sa **jednim** dokumentom: sintetički fixture iz paketa
   (`fixtures\dev\biznisoft\vise-stavki.pdf`, preimenovan u
   `FAKTURA E2E 001.pdf`) ili posebno odobren uzorak. `izvorniFolder` u staging
   `config.json` pokazuje na taj folder.
2. U staging portalu mapirati šifru partnera tog dokumenta na testnog kupca.
3. `FEATURE_SYNC_DEVICE_INGEST=1` na staging-u.
4. `connector.cmd run-once` (staging folder stanja iz Faze B). Očekivano:
   `potvrdjeno: 1`.
5. Dokaz u staging bazi: 1 red u `source_documents` (`origin='device'`),
   1 `invoices`, ledger redovi = broj stavki dokumenta, 1 `pdfIngested` +
   `pdfPosted` u `audit_log`.
6. **Idempotentnost:** ponovo `run-once` — nema novog dokumenta ni fakture
   (dokument je poznat; i ponovljen prenos daje `duplicate_file`).
7. **Opoziv:** dodati drugi sintetički dokument, opozvati uređaj u portalu,
   `run-once` → `zaustavljeno: device_not_active`, izlazni kod 1, nijedna nova
   faktura, stavka ostaje u redu kao `spremno`.
8. **Čišćenje:** gate-ovi na 0, restore staging baze iz backup-a Faze A;
   kancelarijski staging folder stanja se briše. Za nastavak se registruje nov
   staging uređaj (opozvan se ne aktivira ponovo).

## 8. Faza F — Scheduled Task

Tek posle zelenog E2E. Zadatak pokreće `auto`: jednom po radnom danu, posle
09:00, nad konfiguracijom iz podrazumevanog foldera stanja naloga.

1. Dry-run: `task.ps1 -Action install -Mode Smoke -PackagePath <paket>` —
   ispis nosi `[dry-run]`, ništa se ne registruje.
2. `task.ps1 -Action install -Mode Smoke -PackagePath <paket> -Apply`.
   Administrator samo ako Windows odbije registraciju bez elevacije; to se
   upisuje u zapisnik.
3. `task.ps1 -Action status -Mode Smoke` — potvrditi: ime
   `\Carsystem\CarsystemConnectorSMOKE`, nalog = postojeći kancelarijski nalog,
   `RunLevel Limited`, izvršni = `node.exe`, argumenti
   `…connector\bin\connector.mjs --packaged auto`, radni folder = paket,
   sledeće vreme 09:05.
4. `task.ps1 -Action status -Mode Production` → „nije registrovan".
5. Jedno bezbedno pokretanje: konfiguracija i dalje pokazuje na staging i na
   folder sa jednim dokumentom iz Faze E; `schtasks /Run /TN "\Carsystem\CarsystemConnectorSMOKE"`;
   `task.ps1 -Action status -Mode Smoke` → `PoslednjiIshod` 0 (ili 1 uz
   objašnjen razlog u `connector.cmd status`).
6. `task.ps1 -Action uninstall -Mode Smoke -Apply`, pa status → „nije registrovan".
7. **Production zadatak se instalira tek uz posebno odobrenje**, po
   `OFFICE-INSTALL.md`.

Dok postoji zadatak, `run-once` i `watch` se ne pokreću ručno u isto vreme:
brava se tokom dugog ciklusa ne obnavlja (kapija 17).

## 9. Faza G — kontrolisan istorijski unos

Tek uz odobrenje vlasnika i posle Faza A–F na ciljnom serveru.

1. Gate-ovi redom: `FEATURE_SYNC_DEVICE_INGEST=1` → (kada prijem radi)
   `FEATURE_SYNC_OPERATIONS=1` → (kada su mapiranja razrešena)
   `FEATURE_RECOMMENDATIONS=1`. Gašenje obrnuto. Zadatak se prvo gasi
   (`task.ps1 -Action uninstall -Mode … -Apply` ili Disable u Task Scheduler-u),
   zatim gate-ovi.
2. Budžet: najviše **200** novih ili promenjenih dokumenata po ciklusu; poznati
   ne troše budžet. Slanje: `maxPoCiklusu` po ciklusu.
3. Posle svakog ciklusa zapisati: `preostalo`, `preostaloSerija`,
   `ostaloURedu`, `nepodrzano`, `odlozeno`, `necitljivo`, i u portalu:
   karantin, `business_key_conflict`, nemapirane šifre partnera, čeka pregled.
4. **Stop** ako `preostalo` ne opada, ako se pojavi konflikt koji niko ne ume da
   objasni, ili ako broj faktura raste brže od broja novih dokumenata.
5. Duplikati: isti fajl (`file_hash`) se ne knjiži dvaput; isti broj dokumenta
   sa drugim bajtovima ide u `conflict` i izlazi iz ledgera dok ga čovek ne reši.
   > Poznato ograničenje: ekrani prodaje, analitike i kupaca čitaju `invoices`
   > direktno, ne `effective_sales_ledger`. Faktura čiji izvorni dokument
   > naknadno uđe u konflikt nestaje iz ledgera i preporuka, ali ostaje vidljiva
   > na tim ekranima dok se konflikt ne reši.
6. Svih 12.319 kandidata se **ne pušta odjednom**: bez dnevnog nadzora i
   rollback-a (runbook §20) nema sledećeg ciklusa.

---

## 10. Jednostavno objašnjenje

- **Ne pravi se nova baza.** Fakture sa kancelarijskog računara ulaze u
  postojeću bazu sajta, istim putem kao ručno uvezen PDF, i u isti obračun prometa.
- **Zašto baza na serveru:** sajt radi i kada je kancelarijski računar ugašen.
  Portal i preporuke čitaju podatke koji su već stigli na server.
- **Šta odlazi:** broj, datum i vrsta fakture, šifra kupca iz BizniSoft-a,
  stavke (šifra, opis, jedinica, količina, cena, rabat, PDV, iznosi), zbir,
  otisci dokumenta i potpis uređaja.
- **Šta nikad ne odlazi:** sam PDF, ime fajla, putanja na računaru, tekst
  dokumenta, naziv i PIB kupca, privatni ključ.
- **Kada internet ne radi:** dokumenti čekaju u lokalnom redu i šalju se
  sledećeg radnog dana; ništa se ne gubi i ništa se ne potvrđuje bez odgovora
  servera.
- **Opoziv:** gazda u portalu opoziva uređaj; već sledeći zahtev tog uređaja se
  odbija. Brže od toga: isključiti prijem (`FEATURE_SYNC_DEVICE_INGEST=0`).
