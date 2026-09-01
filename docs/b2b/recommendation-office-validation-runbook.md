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

1. **Windows smoke 0/10 znači da se full scan NE pokreće.** Nijedan izuzetak.
   `SMOKE INCOMPLETE` **nije** prolaz — nepotpuna provera je isto što i
   neizvršena.
2. **Neuspešan mali probni scan znači da se full scan NE pokreće.** Mali scan
   postoji upravo zato da se greška vidi na pet dokumenata, a ne na deset
   hiljada.
3. **Folder sa PDF-ovima ostaje read-only.** Servisni nalog ima Read i List, i
   ništa više. Ako konektor može da izmeni, obriše ili preimenuje ijedan PDF,
   dan se prekida.
4. **Stvarni PDF-ovi ne ulaze u Git.** Ni jedan, ni kao primer, ni „privremeno".
5. **PII se ne kopira u izveštaj.** Bez naziva kupaca, PIB-a, adresa, brojeva
   dokumenata, imena fajlova i apsolutnih putanja.
6. **Rezultat preporuka se ne šalje kupcima.** Ni mejlom, ni porukom, ni kao
   izvoz koji neko prosledi. Sistem to ne radi sam i niko to ne radi ručno.
7. **Rezultat algoritma je danas početna validacija.** Prvi brojevi pokazuju da
   motor radi — ne da su preporuke poslovno tačne.

---

## 1. Potvrda tačnog paketa i hash-a

Na razvojnoj mašini, pre nego što se išta prenese:

```bash
git rev-parse HEAD
```

Očekivano: `2ffb15beb2b3c25bb480297d27e7971adda1fc31` (grana
`fix/windows-smoke-portability`), ili commit koji je iz nje izrastao.

```bash
npm run connector:smoke:package
npm run connector:smoke:verify
```

Paket ide u `dist/` i sadrži `MANIFEST.md` sa SHA-256 otiskom **svakog** fajla i
sa izvornim HEAD-om.

Na kancelarijskom računaru, iz raspakovanog foldera (PowerShell):

```powershell
Get-ChildItem -Recurse -File | ForEach-Object {
  '{0}  {1}' -f (Get-FileHash $_ -Algorithm SHA256).Hash.ToLower(),
               (Resolve-Path $_ -Relative)
}
```

**Uslov za nastavak:** svaki otisak se poklapa sa `MANIFEST.md`, i HEAD u
manifestu je onaj koji je gore potvrđen.

**Prekid:** bilo koje neslaganje. Ne „verovatno je zbog prenosa" — paket se
pravi ponovo.

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

## 3. Svih 10 Windows smoke testova

```
smoke\RUN-SMOKE.cmd
```

**Ne pokretati kao Administrator.** Nijedna provera ne traži povišena prava. Ako
Windows sam ponudi — odbiti.

Deset provera koje se izvršavaju (🟡 — napisane i spremne, nijedna još nije
izvršena na Windows-u):

| # | Šta dokazuje |
|---|---|
| W01 | DPAPI Protect/Unprotect vraća isti ključ |
| W02 | tajna ne prolazi kroz komandnu liniju |
| W03 | DPAPI drugog naloga ne otključava ključ |
| W04 | putanja sa razmacima, srpskim slovima i UNC oblikom |
| W05 | fajl koji drži drugi proces se ODLAŽE, ne gubi |
| W06 | red preživljava restart procesa na Windows fajl sistemu |
| W07 | skripta zadatka je podrazumevano dry-run |
| W08 | registracija i uklanjanje Task Scheduler zadatka |
| W09 | spakovan konektor se pokreće preko `connector.cmd` |
| W10 | spakovan konektor odbija test skladište ključa |

Ispis na kraju je tačno jedan od tri:

| Ispis | Značenje | Nastavak |
|---|---|---|
| `SMOKE PASS` | sve provere prošle | da |
| `SMOKE INCOMPLETE` | ništa nije palo, ali ključna provera je preskočena | **ne** |
| `SMOKE FAIL` | bar jedna provera je pala | **ne** |

**Uslov za nastavak:** `SMOKE PASS`, 10/10.

**Prekid:** `SMOKE FAIL` ili `SMOKE INCOMPLETE` → dan se zaustavlja ovde. Nema
malog scan-a, nema full scan-a, nema recompute-a.

---

## 4. Čuvanje rezultata

Runner upisuje u `%TEMP%\Carsystem Smoke ČĆŽŠĐ\`:

- **`windows-smoke-result-2ffb15b.md`** ← ovo se čuva i šalje;
- `windows-smoke-result-2ffb15b.json` ← opciono, uz gornji;
- `testovi-tap.log` ← **NE šalje se.** Ostaje na računaru dok se zajedno ne
  pregleda i redigujem.

Ime fajla nosi kratak HEAD paketa. Ako se ne poklapa sa onim iz koraka 1, merena
je druga verzija.

Redigovani rezultat ne sadrži korisničko ime, ime računara, apsolutne putanje,
ključeve, potpise, PIB, nazive kupaca ni stack trace. 🟢

---

## 5. Potvrda identiteta servisnog naloga i zadatka

```powershell
schtasks /Query /TN "Carsystem Sync" /V /FO LIST
```

Zapisati (bez korisničkog imena u izveštaju — samo potvrda da je tačan):

- `Run As User` je **namenski servisni nalog**, ne lični nalog vlasnika i ne
  `SYSTEM`;
- `Scheduled Task State` je `Enabled`;
- zadatak **ne** traži „Run with highest privileges".

**Uslov za nastavak:** zadatak radi pod namenskim nalogom.

**Prekid:** zadatak pod ličnim nalogom ili pod `SYSTEM`. DPAPI ključ je vezan za
nalog (`W01`, `W03`) — pogrešan nalog znači da ključ ili ne radi, ili radi pod
identitetom koji ne treba da ga ima.

---

## 6. Dokaz Read/List-only NTFS prava

Nad folderom u kome BizniSoft ostavlja PDF-ove:

```powershell
icacls "<folder sa PDF-ovima>"
```

Servisni nalog sme da ima isključivo `(RX)` ili `(R)`. **Ne sme** da ima `(M)`,
`(W)`, `(F)` ni `(D)`.

Ako prava nisu takva, postavljaju se pre nastavka — to radi osoba koja
administrira taj računar, ne konektor.

---

## 7. Dokaz da konektor ne može da menja PDF

Pod **servisnim nalogom** (ne pod ličnim), u tom folderu:

```powershell
# 1. izmena sadržaja mora da padne
Add-Content -Path "<folder>\<neki>.pdf" -Value "x"

# 2. preimenovanje mora da padne
Rename-Item "<folder>\<neki>.pdf" "probni-naziv.pdf"

# 3. brisanje mora da padne
Remove-Item "<folder>\<neki>.pdf"
```

**Uslov za nastavak:** sva tri pokušaja padaju sa `Access to the path … is
denied`.

**Prekid:** bilo koji uspe. Tada folder nije read-only, i konektor koji tamo
radi može da ošteti originale — a original je jedini dokaz šta je stvarno
pisalo na dokumentu.

> Ako je neki fajl ipak izmenjen, on se **ne popravlja ručno**. Zapisuje se koji
> je i dan se prekida.

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
- ishod Windows smoke (10/10 ili tačno koje su pale),
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

| Nalaz | Posledica |
|---|---|
| hash paketa se ne poklapa | paket se pravi ponovo; ništa se ne pokreće |
| `node --version` nije 24.14.x | staje se dok se Node ne postavi |
| Windows smoke `FAIL` ili `INCOMPLETE` | **nema** malog scan-a ni full scan-a |
| zadatak radi pod ličnim nalogom ili `SYSTEM` | staje se dok se ne ispravi |
| folder nije read-only | staje se; konektor se ne pokreće nad njim |
| bilo koji PDF izmenjen, obrisan ili preimenovan | **prekid dana**, zapisati koji |
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
[ ]  1. hash paketa se poklapa sa MANIFEST.md, HEAD potvrđen
[ ]  2. Windows x64, node --version = v24.14.x, putanja sa razmakom i ČĆŽŠĐ
[ ]  3. RUN-SMOKE.cmd → SMOKE PASS, 10/10
[ ]  4. windows-smoke-result-<head>.md sačuvan; tap log NIJE poslat
[ ]  5. Scheduled Task pod namenskim servisnim nalogom, Enabled
[ ]  6. icacls: servisni nalog ima samo (R)/(RX)
[ ]  7. izmena / preimenovanje / brisanje PDF-a — sva tri odbijena
[ ]  8. mali scan (≤5 PDF-ova) završen: completed / completed_with_review
[ ]  9. heartbeat: uređaj active, javljanje od danas
[ ] 10. brojači: posted > 0, blocked = 0
[ ] 11. 3–5 dokumenata pregledano, bez odstupanja, bez PII u zapisu
[ ] 12. full scan pokrenut
[ ] 13. full scan završen; recompute NIJE pokretan u međuvremenu
[ ] 14. conflict / pending_review / unsupported / nemapirane šifre zapisani
[ ] 15. tri broja parova zapisana (ukupno / ≥2 fakture / ≥2 datuma)
[ ] 16. FEATURE_RECOMMENDATIONS=1, ručni recompute cadence_v1 uspeo
[ ] 17. rezultati pregledani; nijedan red ne tvrdi količinu, cenu ni porudžbinu
[ ] 18. redigovan tehnički izveštaj izvezen
[ ] 19. prekidi (ako ih je bilo) zapisani
```
