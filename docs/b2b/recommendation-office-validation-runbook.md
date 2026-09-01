# Kancelarijska validacija — Windows smoke, uvoz istorije i prve preporuke

> **Za koga je ovo:** za osobu koja ujutru sedne za kancelarijski računar i
> priključi ga. Ne pretpostavlja poznavanje koda. Svaki korak ima uslov za
> nastavak i uslov za prekid.
>
> **Šta ovaj dan JESTE:** prva provera da lanac radi od PDF-a do interne
> preporuke.
>
> **Šta ovaj dan NIJE:** nije dokaz da je algoritam poslovno tačan, nije
> puštanje u rad, i nije trenutak u kome iko iz sistema šalje bilo šta kupcu.

Oznake: 🟢 dokazano kodom i testom · 🟡 implementirano, neprovereno u kancelariji
· 🔴 nedostaje dokaz

Povezano: [21 — Windows konektor](21-windows-connector.md),
[22 — Sinhronizacija i komande](22-sync-operations.md),
[19 — kanonski ugovor](19-canonical-ingest-contract.md),
[18 — spremnost podataka](18-data-readiness.md),
[06 — preporuke v1](06-recommendation-engine-v1.md).

---

## 0. Pravila koja važe ceo dan

Ova pravila se ne pregovaraju u toku dana. Ako neko od njih padne, dan se
prekida i nastavlja se tek posle dogovora.

1. **Bez ispisa `SMOKE PASS` full scan se NE pokreće.** Nijedan izuzetak.
   `SMOKE INCOMPLETE` **nije** prolaz — nepotpuna provera je isto što i
   neizvršena. Testovi se ne broje ručno; kriterijum je ispis runnera.
2. **Neuspešan mali probni scan znači da se full scan NE pokreće.** Mali scan
   postoji upravo zato da se greška vidi na pet dokumenata, a ne na deset
   hiljada.
3. **Folder sa PDF-ovima ostaje read-only, i to se PROVERAVA ČITANJEM.**
   Servisni nalog ima Read i List, i ništa više. Nijedna provera se **nikada**
   ne izvodi nad pravom fakturom — ni izmena, ni preimenovanje, ni brisanje.
   Aktivna provera ide isključivo nad namenskim sentinel fajlom (vidi §7).
4. **Stvarni PDF-ovi ne ulaze u Git.** Ni jedan, ni kao primer, ni „privremeno".
5. **PII se ne kopira u izveštaj.** Bez naziva kupaca, PIB-a, adresa, brojeva
   dokumenata, imena fajlova i apsolutnih putanja.
6. **Rezultat preporuka se ne šalje kupcima.** Ni mejlom, ni porukom, ni kao
   izvoz koji neko prosledi. Sistem to ne radi sam i niko to ne radi ručno.
7. **Rezultat algoritma je danas početna validacija.** Prvi brojevi pokazuju da
   motor radi — ne da su preporuke poslovno tačne.

---

## 1. Potvrda isporučenog paketa

**Paket se ne pravi u kancelariji.** Nastao je na mašini koja pakuje, iz čistog
HEAD-a; ovde se samo dokazuje da je stigao neizmenjen. Pravljenje paketa na
Windowsu značilo bi da se meri nešto što niko pre toga nije video.

Uz ZIP je stigao **`WINDOWS-HANDOFF-<shortHead>.md`** — odvojen fajl, pored
arhive, ne u njoj. U njemu su tačno ime ZIP-a, njegov SHA-256, veličina i broj
fajlova. Arhiva ne može da sadrži sopstveni otisak, jer otisak nastaje tek kad
je zatvorena; zato hash nosi handoff, a ne ovaj dokument.

Provera otiska arhive (PowerShell, u folderu u kome je ZIP):

```powershell
Get-FileHash .\carsystem-windows-smoke-<shortHead>.zip -Algorithm SHA256
```

Zatim raspakovati i proveriti sadržaj naspram `MANIFEST.md` iz paketa:

```powershell
Get-ChildItem -Recurse -File | ForEach-Object {
  '{0}  {1}' -f (Get-FileHash $_ -Algorithm SHA256).Hash.ToLower(),
               (Resolve-Path $_ -Relative)
}
```

Verzija paketa se čita iz njega samog:

```
type smoke\package-meta.json
```

**Uslov za nastavak:** otisak ZIP-a je jednak onom iz handoff-a; svaki otisak
fajla se poklapa sa `MANIFEST.md`; `shortHead` iz `package-meta.json` je isti
kao u imenu handoff-a i ZIP-a.

**Prekid:** bilo koje neslaganje. Ne „verovatno je zbog prenosa" — paket se
prenosi ponovo, ili se pravi nov na mašini koja pakuje.

---

## 2. Windows x64 + Node 24.14.x

U novom Command Prompt-u:

```
node --version
```

**Uslov za nastavak:** `v24.14.x`, 64-bitni Windows.

**Prekid:** Node 20 ili 22. Konektor koristi `node:sqlite`, koji u njima ne
postoji; entrypoint odbija da radi i to nije greška koju treba zaobići.

Raspakovati u putanju sa **razmakom i srpskim slovima**, na primer:

```
C:\Users\<nalog>\Desktop\Carsystem Smoke ČĆŽŠĐ\
```

To je deo provere `W03`, ne stil. Bez razmaka i bar jednog od `ČĆŽŠĐ` ta provera
pada namerno.

---

## 3. Windows smoke — 16 provera, jedan kriterijum

```
smoke\RUN-SMOKE.cmd
```

**Ne pokretati kao Administrator.** Nijedna provera ne traži povišena prava. Ako
Windows sam ponudi — odbiti.

Runner izvršava šesnaest provera (🟡 — napisane i spremne, nijedna još nije
izvršena na Windows-u). Spisak je ovde da bi se ispis mogao pročitati, **ne da
bi se brojao**:

| ID | Šta dokazuje |
|---|---|
| `W01` | Windows izdanje i arhitektura |
| `W02` | Node 24.14.x |
| `W03` | paket raspakovan u putanju sa razmakom i `ČĆŽŠĐ` |
| `W04` | spakovan `connector.cmd` se pokreće |
| `W05` | `doctor` u izolovanoj konfiguraciji |
| `W06` | `init` pravi ključ kroz DPAPI, bez tajne na ekranu |
| `W07` | ponovljen `init` NE menja ključ |
| `W08` | privatni ključ ne prolazi kroz stdout ni stderr |
| `W09` | dry-run čita SAMO sintetički folder i ništa ne šalje |
| `W10` | red preživljava nov proces (`node:sqlite`, WAL) |
| `W11` | `poll-once` bez konfiguracije daje jasnu grešku |
| `W12` | `watch` bez konfiguracije STAJE, bez tight loop-a |
| `W13` | `task.ps1` ostaje dry-run i NE pravi zadatak |
| `W14` | spakovan konektor ne bira test skladište ključa |
| `W15` | postojeći connector testovi (uključujući `[WIN]`) |
| `W15-win` | `[WIN]` skup je stvarno izvršen na ovoj mašini |

Ključne provere — jedna preskočena među njima obara ceo prolaz: `W05`, `W06`,
`W07`, `W10`, `W14`, `W15-win`.

### Jedini kriterijum je ispis

| Ispis | Izlazni kod | Nastavak |
|---|---|---|
| `SMOKE PASS` | 0 | da |
| `SMOKE INCOMPLETE` | 4 | **ne** |
| `SMOKE FAIL` | 1 | **ne** |

**Ne broji testove i ne traži „sve zeleno" ručno.** Runner sam zna koliko
provera ima i koja sme da bude preskočena.

### Jedan `[WIN]` test je NAMERNO ručan

`[WIN]` skup ima deset testova. Devet se izvršava; deseti — **registracija i
uklanjanje Scheduled Task-a** (`task.ps1 -Action install -Apply`) — sam sebe
preskače, jer menja sistem. `W15-win` zato prihvata tačno jedan preskočen
`[WIN]` test i ispisuje „9 od 10 izvršeno".

**„9 od 10" je očekivano stanje, ne nedostatak.** Deset izvršenih bi značilo da
je neko sistem ipak promenio.

**Uslov za nastavak:** ispis je `SMOKE PASS`.

**Prekid:** `SMOKE FAIL` ili `SMOKE INCOMPLETE` → dan se zaustavlja ovde. Nema
malog scan-a, nema full scan-a, nema recompute-a.

---

## 4. Čuvanje rezultata

Runner upisuje u `%TEMP%\Carsystem Smoke ČĆŽŠĐ\`:

- **`windows-smoke-result-<shortHead>.md`** ← ovo se čuva i šalje;
- `windows-smoke-result-<shortHead>.json` ← opciono, uz gornji;
- `testovi-tap.log` ← **NE šalje se.** Ostaje na računaru dok se zajedno ne
  pregleda i redigujem.

`<shortHead>` je vrednost iz `smoke/package-meta.json`; runner je sam upisuje u
ime fajla. Ako ime nosi drugi `shortHead` nego što piše u tom fajlu — pokrenut
je pogrešan paket i rezultat se ne šalje.

Redigovani rezultat ne sadrži korisničko ime, ime računara, apsolutne putanje,
ključeve, potpise, PIB, nazive kupaca ni stack trace. 🟢

---

## 5. Task Scheduler — očekuje se da zadatak NE POSTOJI

Smoke **ne instalira** trajni zadatak. `task.ps1` se poziva isključivo u
dry-run režimu (`W13`), a `[WIN]` test koji bi ga stvarno registrovao sam sebe
preskače.

```powershell
schtasks /Query /TN "Carsystem Sync" /V /FO LIST
```

**Očekivan odgovor danas: „ERROR: The system cannot find the file specified."**
— dakle zadatak ne postoji. To je **ispravno stanje pre instalacije**, ne kvar
smoke-a i ne razlog za prekid.

Ako zadatak **postoji**, znači da ga je neko ranije instalirao. Tada se
zapisuje (bez korisničkog imena u izveštaju — samo potvrda da je tačan):

- `Run As User` je **namenski servisni nalog**, ne lični nalog vlasnika i ne
  `SYSTEM`;
- `Scheduled Task State`;
- da li traži „Run with highest privileges".

**Uslov za nastavak:** zadatak ne postoji, ili postoji pod namenskim nalogom.

**Prekid MALOG E2E (ne smoke-a):** zadatak pod ličnim nalogom ili pod `SYSTEM`.
DPAPI ključ je vezan za nalog (`W06`, `W07`) — pogrešan nalog znači da ključ ili
ne radi, ili radi pod identitetom koji ne treba da ga ima.

Danas se **ne pokreće**: `task.ps1 -Action install -Apply`, autostart, ni
`watch` režim.

---

## 6. Read/List-only NTFS prava — SAMO ČITANJE ispisa

Nad folderom u kome BizniSoft ostavlja PDF-ove:

```powershell
icacls "<folder sa PDF-ovima>"
```

Servisni nalog sme da ima isključivo `(RX)` ili `(R)`. **Ne sme** da ima `(M)`,
`(W)`, `(F)` ni `(D)`.

Ovo je **čitanje ispisa i ništa više.** Za prvi offline prolaz je dovoljno.
Nijedan fajl se ne dira, nijedno pravo se ne menja.

Ako prava nisu takva, postavlja ih osoba koja administrira taj računar — ne
konektor, i ne osoba koja vodi smoke.

**Uslov za nastavak (mali E2E):** ispis pokazuje samo `(R)`/`(RX)` za servisni
nalog.

**Ne blokira offline smoke.** Smoke ne dodiruje taj folder uopšte.

---

## 7. Aktivna ACL provera — tek uz namenski sentinel, i tek kasnije

> **Ovo se sutra NE izvršava.** Ostaje za kancelarijsku prihvatnu proveru, kada
> postoji namenski servisni nalog. Zapisano je ovde da bi se, kada za to dođe
> vreme, izvelo tačno — a ne improvizovalo.

### Zabranjeno, bez izuzetka

Nijedna provera dozvola **nikada** se ne izvodi nad pravom fakturom. Ni izmena
sadržaja, ni preimenovanje, ni brisanje, ni „samo da probam na jednom".

Original PDF je jedini dokaz šta je na dokumentu stvarno pisalo. Provera koja ga
može oštetiti nije provera nego rizik, i to rizik nad podatkom koji se ne može
rekonstruisati. Ranija verzija ovog runbooka je tražila upravo to; bila je
pogrešna.

### Kako se izvodi kada dođe vreme

**Ovlašćeni administrator** — ne servisni nalog, ne osoba koja vodi test —
napravi jedan potrošan sentinel u tom folderu:

```
carsystem-permission-probe.txt
```

Pre bilo kakvog pokušaja zabeleži se njegov otisak, da bi se posle znalo da li
je ostao netaknut:

```powershell
Get-FileHash "<folder>\carsystem-permission-probe.txt" -Algorithm SHA256
```

Zatim se **pod servisnim nalogom** pokušava izmena, preimenovanje i brisanje
**isključivo nad tim sentinelom**. Sva tri pokušaja moraju pasti sa
`Access to the path … is denied`.

### Ako bilo šta uspe

1. **Ne dirati nijedan pravi PDF** — ni radi provere, ni radi potvrde.
2. **Prekinuti test odmah.**
3. Sentinel vraća ili uklanja **administrator**, ne servisni nalog.
4. Rezultat se zapisuje kao **ACL FAIL**, i mali E2E se ne izvodi dok se prava
   ne isprave.

### Posle provere

Administrator uklanja sentinel. Ako je otisak sentinela promenjen, to je već
`ACL FAIL` — bez obzira na to koji je pokušaj prošao.

---

## 8. Mali probni folder ili kontrolisani mali scan

Napraviti **poseban** folder sa **najviše 5** PDF-ova prekopiranih iz stvarnog
izlaza, i konektor usmeriti na njega. Original folder se ne dira.

Pokrenuti jedan ciklus. Kroz portal (`Sistem → Sinhronizacija`) to je dugme
**„Skeniraj i sinhronizuj"**, koje zaobilazi samo čekanje do 09:00 — ne zaobilazi
bravu, stabilnost fajla, granice, validaciju ugovora ni idempotentnost. 🟢

**Uslov za nastavak:** ciklus se završava sa `completed` ili
`completed_with_review`.

**Prekid:** `failed`, `blocked`, ili ciklus koji ne završava. Full scan se ne
pokreće.

---

## 9. Provera heartbeat-a i statusa

Portal → `Sistem → Sinhronizacija`.

Pročitati, i **ne mešati dve različite tvrdnje**:

- „Poslednje javljanje" znači samo da se uređaj autentifikovano javio u tom
  trenutku — **ne** da je sinhronizacija uspela;
- „Zatraženo" nije „pokrenuto";
- „Završeno uz pregled" nije potpuno knjiženje.

**Uslov za nastavak:** uređaj je `active`, poslednje javljanje je od danas.

---

## 10. Brojači ciklusa

Na istom ekranu, uz poslednju komandu:

| Brojač | Šta znači | Šta traži akciju |
|---|---|---|
| `found` | koliko je fajlova nađeno | — |
| `read` | koliko je pročitano | `read < found` → zaključan ili nestabilan fajl |
| `posted` | koliko je **proknjiženo** | ovo je jedini broj koji znači promet |
| `duplicate` | isti otisak fajla, već uvezen | očekivano pri ponovljenom scan-u |
| `review` | ide na ručni pregled | pregledati u koraku 14 |
| `unsupported` | oblik bez stvarnog uzorka | očekivano; nije greška |
| `pending` | čeka mapiranje šifre partnera | razrešiti pre recompute-a |
| `blocked` | odbijeno kontrolisano | pročitati razlog |

**Uslov za nastavak (mali scan):** `posted > 0`, `blocked = 0`.

---

## 11. Pregled nekoliko dokumenata, bez PII u logovima

Portal → `Sistem → Izvorni dokumenti`. Otvoriti 3–5 dokumenata i uporediti sa
papirom/PDF-om: izdavalac, datum, broj stavki, šifre artikala, zbir.

**U logove i izveštaj ne ide ništa od toga.** Zapisuje se samo:
„pregledano N dokumenata, odstupanja: 0" — ili opis odstupanja bez identiteta
kupca i bez broja dokumenta.

**Uslov za nastavak:** nijedno odstupanje u zbiru i broju stavki.

**Prekid:** odstupanje u zbiru. To je `totals_mismatch` klasa problema i rešava
se pre full scan-a.

---

## 12. Tek sada — full scan istorije

Konektor se vraća na stvarni folder (i dalje read-only) i pokreće se pun ciklus.

Pre pokretanja potvrditi da su koraci 3, 8, 10 i 11 svi prošli. Redosled nije
formalnost: full scan nad hiljadama dokumenata sa greškom u parseru pravi
hiljade karantiniranih redova koje neko mora ručno da pregleda.

---

## 13. Čekanje da se uvoz završi

Full scan se **ne prekida** i ne pokreće se drugi put dok prvi traje. Portal
prikazuje stanje komande; komanda je završena kada je u `completed` ili
`completed_with_review`.

Za vreme čekanja se **ne pokreće recompute preporuka**. Preporuke nad
polovičnim uvozom su tačan obračun nad netačnim ulazom, i izgledaju isto kao
ispravan rezultat.

---

## 14. Pregled revision conflicts i karantina

Portal → `Sistem → Izvorni dokumenti`, pa `Sistem → Spremnost podataka`.

| Stanje | Šta znači | Šta uraditi |
|---|---|---|
| `conflict` | dva fajla tvrde da su isti poslovni dokument | čovek bira verziju; sistem **ne bira** |
| `pending_review` | čeka odluku o verziji | isto |
| `manual_review = pending` | zahteva pregled | zatvoriti pregled ili ostaviti |
| `unsupported_requires_sample` | oblik koji nijedan stvaran uzorak ne pokriva | zabeležiti broj; nije greška |
| šifra partnera `unmapped` | ne zna se čiji je promet | mapirati **pre** recompute-a |

**Dokument u sudaru, na pregledu ili sa nemapiranim kupcem NE ulazi u
preporuke** — ni u promet. To nije zaobilaznica koju treba požuriti; to je
odbrana. 🟢

**Uslov za nastavak:** broj `conflict` i `pending_review` je zapisan, i za svaki
je poznato da čeka ljudsku odluku.

---

## 15. Merenje broja repeat parova `(customer_id, article_code)`

Portal → `Sistem → Spremnost podataka`.

Čitaju se **tri različita broja** i ne smeju se pomešati:

| Broj | Značenje |
|---|---|
| različitih parova (kupac, artikal) | koliko kombinacija uopšte postoji |
| parova na **najmanje dve fakture** | mogu biti i dve fakture istog dana |
| parova na **najmanje dva datuma** | ovo je jedini broj koji znači ponovljenu kupovinu |

Cadence engine gradi procenu isključivo iz **različitih dana**: dve fakture
istog kupca za isti artikal istog dana su **jedan** kupovni ciklus. 🟢

**Šta se očekuje danas:** ovaj broj je verovatno mali ili nula. To **nije
kvar** — GO/NO-GO audit je već utvrdio da tekući korpus nema ponovljene parove.
Ako je nula, koraci 16–17 se i dalje izvršavaju, ali rezultat je prazna strana
sa objašnjenjem, i to je tačan ishod.

---

## 16. Ručni `cadence_v1` recompute

Preduslov: `FEATURE_RECOMMENDATIONS=1` na serveru. Podrazumevano je
**isključeno**; uključuje ga osoba koja administrira server, izričito, tog dana.

Portal → `Prodaja → Preporuke` → polje **„Na dan"** i dugme
**„Preračunaj preporuke"**.

- **„Na dan"** se unosi ručno i ulazi u izveštaj. Ne popunjava se današnjim
  datumom automatski — obračun mora da bude ponovljiv za tačno određen dan.
- Recompute sme samo gazda (sposobnost `recommendations:recompute`). 🟢
- Dvostruki klik ne pravi dva obračuna: baza dozvoljava tačno jedan prolaz u
  toku. 🟢
- Neuspeo prolaz **ne briše** prethodni rezultat. 🟢

Posle prolaza, na dnu strane („Poslednji prolazi") zapisati:

- ulaznih stavki i isključenih stavki,
- parova i parova sa ritmom,
- broj rezultata.

**Prekid:** prolaz završi kao `failed`. Zapisati `failure_code`, ne ponavljati
u petlji.

---

## 17. Pregled rezultata u internom portalu

Na istoj strani, grupe redom kojim ih komercijalista čita:

1. **Treba kontaktirati sada** — kupac je u svom uobičajenom terminu;
2. **Kasni** — termin je prošao;
3. **Uskoro** — termin se približava;
4. **Privremene procene** — samo dve kupovine; odvojeno, nikad među radnim;
5. **Još nije vreme i uspavani** — stoji radi pregleda.

Za svaki red proveriti da rečenica objašnjenja odgovara brojevima u istom redu.
Primer ispravnog objašnjenja:

> Kupac je ovaj artikal kupovao 6 puta, tipično na 28–34 dana. Poslednja
> potvrđena kupovina bila je pre 31 dan. Sada je u uobičajenom terminu.

**Šta ekran NE sme da tvrdi**, i test to zaključava 🟢:

- nijednu količinu („uzeće X komada"),
- nijednu jedinicu mere,
- nijednu cenu, maržu ni profit,
- „poruči X" ni bilo kakav predlog nabavke,
- nijednu buduću cenu.

Ako se bilo šta od toga pojavi na ekranu — dan se prekida i prijavljuje se kao
greška, ne kao „sitnica u tekstu".

**Prazna strana je legitiman ishod.** Ako nema ponovljenih parova, ekran to i
kaže. Prazno stanje bez objašnjenja bi bio kvar; prazno stanje sa objašnjenjem
je tačan odgovor.

---

## 18. Izvoz redigovanog validation izveštaja

Izveštaj je **tehnički** i **redigovan**. Sadrži isključivo:

- HEAD paketa i grana,
- `node --version`,
- ishod Windows smoke (`SMOKE PASS` / `INCOMPLETE` / `FAIL`, i ID-jevi provera
  koje su pale ili preskočene),
- da li je servisni nalog namenski (da/ne, **bez imena naloga**),
- ishod tri pokušaja izmene PDF-a (sva tri odbijena: da/ne),
- brojače malog scan-a i full scan-a,
- broj `conflict`, `pending_review`, `unsupported`, nemapiranih šifri,
- tri broja parova iz koraka 15,
- `algorithm_version`, `as_of_date`, brojače prolaza i raspodelu po statusu i
  pouzdanosti,
- listu prekida, ako ih je bilo.

**Ne sadrži:** nazive kupaca, PIB, adrese, brojeve dokumenata, imena fajlova,
apsolutne putanje, korisnička imena, ime računara, ključeve, potpise, stack
trace, ni ijedan red preporuke.

Stvarni PDF-ovi i `testovi-tap.log` ostaju na kancelarijskom računaru.

---

## 19. Kriterijumi za prekid i rollback

### Prekid bez nastavka

### A. Kapije koje zaustavljaju i offline smoke

| Nalaz | Posledica |
|---|---|
| otisak ZIP-a se ne poklapa sa handoff-om | ništa se ne pokreće; paket se prenosi ponovo |
| otisak fajla se ne poklapa sa `MANIFEST.md` | isto |
| `shortHead` u imenu ZIP-a ≠ `package-meta.json` | pokrenut bi bio pogrešan paket |
| `node --version` nije 24.14.x, ili nije x64 | staje se dok se Node ne postavi |
| ispis nije `SMOKE PASS` | **nema** malog scan-a ni full scan-a |

### B. Kapije koje zabranjuju MALI E2E i FULL SCAN — ali NE offline smoke

Svaka od ovih šest sama za sebe je dovoljna. Offline smoke se izvršava i kada su
sve neispunjene, jer smoke ne dodiruje ni server, ni bazu, ni uređaj.

| Nalaz | Zašto zaustavlja |
|---|---|
| **nema dostupnog HTTPS servera** | konektor odbija sve što nije HTTPS i odbija redirekcije; bez origina nema kome da se pošalje |
| **nema potvrđenog backup/restore-a** ciljne baze | migracije su aditivne, ali down-migracija nema; bez PROVERENOG restore-a nema povratka |
| **uređaj nije registrovan i aktiviran** | uređaj koji se javi pre registracije biva odbijen, i to izgleda kao kvar uređaja |
| **migracije nisu potvrđene na ciljnoj staging bazi** | ingest bi pao na prvoj tabeli koje nema, posle prenosa dokumenata |
| **nema gazda naloga ili vezanog drugog faktora** | registracija uređaja traži `devices:manage`, a portal u produkciji traži MFA |
| **feature gate-ovi nisu kontrolisano podešeni** | uključen redosled je deo procedure, ne detalj — vidi §16 |

Kada bilo koja od ovih šest padne: dan se **ne prekida**, nego se svodi na
offline Windows smoke i na čitanje `icacls` ispisa. Ostalo se odlaže.

#### „Kontrolisano podešeni gate-ovi" znači ovaj redosled

Nijedan se ne uključuje unapred i nijedan se ne uključuje tokom smoke-a.
`FEATURE_SYNC_OPERATIONS` **zahteva** prijem — kod ga proverava, pa uključivanje
u pogrešnom redosledu ne radi ništa i izgleda kao kvar.

| # | Promenljiva | Uključiti tek kada |
|---|---|---|
| — | *(nijedan)* | tokom offline smoke-a; smoke ne dodiruje mrežu |
| 1 | `FEATURE_SYNC_DEVICE_INGEST=1` | smoke je `SMOKE PASS` **i** uređaj je registrovan i aktiviran |
| 2 | `FEATURE_SYNC_OPERATIONS=1` | prijem stvarno radi |
| 3 | `FEATURE_RECOMMENDATIONS=1` | mali scan je gotov i mapiranja su razrešena |

Gašenje ide obrnuto: 3 → 2 → 1.

### C. Kapije koje zaustavljaju posle početka

| Nalaz | Posledica |
|---|---|
| sentinel je izmenjen, preimenovan ili obrisan | **ACL FAIL**; nijedan pravi PDF se ne dira, test se prekida |
| mali scan `failed`/`blocked` | **nema** full scan-a |
| odstupanje u zbiru pri pregledu dokumenata | **nema** full scan-a |
| ekran preporuka tvrdi količinu, cenu ili porudžbinu | prekid, prijava kao greška |
| PII u izveštaju ili logu koji izlazi iz kancelarije | prekid, izveštaj se ne šalje |

### Rollback / isključivanje

Redosled je namerno ovakav — prvo se gasi ono što ima spoljni efekat:

1. **Preporuke:** `FEATURE_RECOMMENDATIONS=0` (ili ukloniti promenljivu).
   Ekran i ručni recompute prestaju odmah; postojeći rezultati ostaju u bazi i
   ne brišu se.
2. **Ručne komande:** `FEATURE_SYNC_OPERATIONS=0`. Dugme „Skeniraj i
   sinhronizuj" prestaje da zakazuje posao.
3. **Prijem sa uređaja:** `FEATURE_SYNC_DEVICE_INGEST=0`. Uređaj koji se javi
   biva odbijen; nijedan nov dokument ne ulazi.
4. **Zadatak:** `schtasks /Change /TN "Carsystem Sync" /DISABLE`.
5. Ako je uređaj kompromitovan — **opoziv uređaja** u portalu
   (`devices:manage`). Istorija ostaje; opozvan uređaj se ne aktivira ponovo,
   nego se registruje nov.

Gašenje gate-a **ne briše** ništa i ne poništava uvoz. Uvezeni dokumenti i
promet ostaju; prestaje samo ono što je posle njih.

---

## 20. Šta ostaje otvoreno posle ovog dana 🔴

Ovo se ne rešava sutra i ne treba pokušavati:

- **Poslovna tačnost algoritma.** Dok ne postoji korpus sa stvarnim ponovljenim
  kupovinama, pragovi u `lib/recommendations/policy.mjs` su polazni, ne
  kalibrisani. Nijedan nivo pouzdanosti nije verovatnoća.
- **Količina i jedinica mere.** Istorijska JM nije sačuvana na `invoice_lines`;
  dok se to ne promeni, prognoza količine se ne pravi.
- **Sezonalnost.** Traži najmanje dve godine istorije.
- **Lager i dostupnost.** Izvor ne postoji.
- **Cena u preporuci.** Efektivne cene su drugi tok i drugo odobravanje.
- **Cross-sell i zamene.** Nema dokazanog izvora.
- **Bilo šta okrenuto kupcu.** V1 je isključivo interni ekran.

---

## Kontrolna lista za štampu

```
--- OFFLINE SMOKE (izvodi se uvek) ---
[ ]  1. otisak ZIP-a = handoff; MANIFEST.md se poklapa; shortHead potvrđen
[ ]  2. Windows x64, node --version = v24.14.x, putanja sa razmakom i ČĆŽŠĐ
[ ]  3. RUN-SMOKE.cmd → ispis SMOKE PASS (ne brojati testove; „9 od 10 [WIN]" je očekivano)
[ ]  4. windows-smoke-result-<shortHead>.md sačuvan; tap log NIJE poslat
[ ]  5. schtasks: zadatak NE postoji — očekivano pre instalacije
[ ]  6. icacls pročitan: servisni nalog ima samo (R)/(RX)

--- MALI E2E (samo ako svih šest kapija iz §19B stoji) ---
[ ]  7. aktivna ACL provera SAMO nad sentinelom — ili preskočena, po dogovoru
[ ]  8. mali scan (≤5 PDF-ova) završen: completed / completed_with_review
[ ]  9. heartbeat: uređaj active, javljanje od danas
[ ] 10. brojači: posted > 0, blocked = 0
[ ] 11. 3–5 dokumenata pregledano, bez odstupanja, bez PII u zapisu

--- FULL SCAN (samo posle uspešnog malog scan-a) ---
[ ] 12. full scan pokrenut
[ ] 13. full scan završen; recompute NIJE pokretan u međuvremenu
[ ] 14. conflict / pending_review / unsupported / nemapirane šifre zapisani
[ ] 15. tri broja parova zapisana (ukupno / ≥2 fakture / ≥2 datuma)
[ ] 16. FEATURE_RECOMMENDATIONS=1, ručni recompute cadence_v1 uspeo
[ ] 17. rezultati pregledani; nijedan red ne tvrdi količinu, cenu ni porudžbinu
[ ] 18. redigovan tehnički izveštaj izvezen
[ ] 19. prekidi (ako ih je bilo) zapisani
```
