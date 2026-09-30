# 26 — F8: kupovina iz celog kataloga i redovno osvežavanje iz BizniSofta

Status: **lokalni demo** (`feat/portal-f8-catalog-buy`, baza `carsystem_demo_f8_dev`).
Stvarno poručivanje je i dalje isključeno (`CUSTOMER_ORDERING=off`; vidi `25-…`).
Lager se nigde ne prikazuje, jer izvor ne postoji.

## 1. Kupovina iz celog kataloga

- **Kartica kataloga:** prijavljeni kupac vidi „Vaša cena (od) … bez PDV-a" za
  proizvode sa potvrđenom vezom i cenom. Ostale kartice ostaju iste.
- **Stranica proizvoda:** panel „Za vašu firmu" prati izabranu varijantu (isti
  kontekst kao selektor). Kupac bira **pakovanje** — jedno pakovanje je jedan
  BizniSoft artikal vezan za tu varijantu. Vidi svoju cenu bez PDV-a, PDV i
  osnov (cenovnik − rabat), zatim bira količinu i dodaje u postojeću korpu.
- **Bez cene ili bez veze:** „Zatraži cenu/uslove" (količina + napomena), uz
  kontakt komercijaliste i kancelarije.
- **Cena bez rabata:** prikazuje se cenovnička cena i link „Zatražite posebne uslove".
- **Izvor ponuda:** `/api/kupac/ponude`. Jedan zahtev po strani, samo uz marker
  prijave. Kupac se određuje iz sesije, a anonimni posetilac i interni nalog
  dobijaju 401.
- **„Poručite ponovo"** ostaje dodatna pogodnost i koristi istu korpu.

## 2. Zahtevi za cenu i uslove

- Tabela `customer_price_requests` (migracija 0030), broj `U-2026-…`,
  idempotentni ključ.
- Zahtev nosi kupca, proizvod, tačnu varijantu (obaveznu kada proizvod ima
  redove šifara), BizniSoft artikal kada je vezan, količinu i napomenu.
- **Radna lista:** `/portal/zahtevi/uslovi`. Kancelarija vidi sve, a
  komercijalista samo svoje kupce (`price_requests:handle`). Koraci su
  preuzmi → odgovori (tekst je obavezan) → zatvori.
- **Odgovor ne menja cenu.** Dogovoren uslov se unosi u BizniSoft i u korpi
  važi tek kada stigne sa izvozom cenovnika.
- Kupac vidi odgovor u „Moj nalog → Upiti".

## 3. Rabati po grupama iz faktura

Ekran je `/portal/cene/rabati-iz-faktura`, a logika `lib/pricing/rebateEvidence.mjs`.

- **Ulaz:** samo potvrđeni računi-otpremnice (`recommendation_input_lines`) i
  samo **procenat rabata**. Istorijska cena se ne koristi.
- **Razvrstavanje po paru (kupac, grupa):**
  - dosledan rabat — kandidat;
  - protivrečno — čovek odlučuje;
  - bez rabata;
  - premalo dokaza;
  - nedostaje grupa.

  Uz svaku stavku idu dokazi: dokumenti, datumi, artikli i broj stavki po vrednosti.
- **Upozorenja:**
  - korekcije popusta, storna i povrati kod kupca;
  - razlika u odnosu na postojeći uslov (pravilo u portalu ili cenovnik).
- **Predlog:** dosledan kandidat postaje predlog pravila u **postojećem toku**
  (`proposePriceRule` → „čeka odobrenje"). Ne ulazi u cenovnik ni u korpu.
- **Nalaz za stvarne podatke:** artikli sa PDF faktura **nemaju grupu**, pa se
  rabat po grupi iz njih ne može izvesti. Grupa stiže tek sa šifarnikom iz
  BizniSofta (`25-…` §2-A). Otpremnica kao zaseban tip dokumenta ne postoji u
  modelu; današnji izvor je „Račun-otpremnica".

## 4. Nastavak kada kancelarija traži izmenu

1. Kancelarija traži izmenu (razlog je obavezan).
2. Kupac klikne „Vrati stavke u korpu". Stari zahtev prelazi u **„Vraćen na
   ispravku" (`superseded`)**. Ostaje u istoriji, stavke mu se ne menjaju i ne
   može se ponovo otvoriti.
3. Stavke dolaze u korpu sa oznakom izvora. Korpa prikazuje „Ispravljate zahtev
   Z-… — kancelarija je tražila: …".
4. Novo slanje pravi **nov zahtev** povezan sa starim (`replaces_order_id`). Oba
   prikazuju vezu, a istorija starog dobija događaj „Ispravka poslata kao Z-…".
5. **Zaštita:** ponovljen klik na „Vrati u korpu" je no-op (zaključan red, isti
   prelaz). Dvoklik na slanje daje isti zahtev (ključ). Jedan zahtev može imati
   najviše jednu ispravku (jedinstven indeks).

## 5. Šta nedostaje za redovno osvežavanje artikala, cena i lagera

| Deo | Danas | Nedostaje |
|---|---|---|
| Izvor u kancelariji | konektor čita samo `*.pdf` iz jedne fascikle (`connector/src/scanner.mjs`) | izvozi šifarnika, cenovnika, uslova po kupcu i lagera (XLSX/CSV/XML) u fasciklu koju konektor čita |
| Raspored | `connector.cmd auto` preko Task Scheduler-a, komanda `scan_and_sync` | isti raspored za nove izvoze; dogovor da li BizniSoft sam izvozi ili neko ručno klikne |
| Ugovor podataka | samo `contracts/invoice-ingest/v1` | ugovori `article-master`, `price-list`, `customer-terms`, `stock-snapshot`: pun snimak sa datumom stanja i verzijom (artikal kog nema u snimku = neaktivan) |
| Prijem na serveru | `/api/sync/ingest` samo za fakture | prijem novih vrsta sa istim potpisom uređaja; čuvanje snimka i razlike u odnosu na prethodni |
| Artikli | `articles`: šifra, naziv, grupa, brend, JM | pakovanje, šifra proizvođača, barkod, PDV, aktivan |
| Cenovnik | tabele postoje (F7), vrsta `biznisoft` | uvoz iz izvoza + ljudska aktivacija posle pregleda razlike; kontrola prema fakturama |
| Lager | ništa | snimak po magacinu sa vremenom stanja; pravilo zastarelosti (npr. stariji od 24 h se ne prikazuje); odluka šta kupac sme da vidi (P8) |
| Upis porudžbine | nema | ručni unos u pilotu; automatski tek ako BizniSoft može da uveze fajl |

## 6. Kratka pitanja za kancelariju / BizniSoft podršku

1. Može li BizniSoft **automatski, po rasporedu** da izveze šifarnik artikala,
   važeći cenovnik, rabate po kupcima i stanje lagera u fasciklu? Ako ne može —
   ko i kada ih izvozi ručno?
2. U kom formatu (XLSX, CSV, XML), sa kojom kodnom stranom i kojim decimalnim separatorom?
3. Postoji li čitanje baze samo za čitanje (ODBC/SQL) ili API, kao zamena za izvoz fajlova?
4. Da li šifarnik ima polja: pakovanje/količina u pakovanju, šifra
   proizvođača, barkod, PDV, aktivan?
5. Kako se vode uslovi kupaca: rabat po grupi, po artiklu, posebna cena, period važenja?
6. Lager: po magacinu? Raspoloživo ili ukupno (sa rezervacijama)? Koliko je sveže posle knjiženja?
7. Može li BizniSoft da **uveze narudžbenicu/predračun iz fajla**?
8. Sme li kupac na sajtu da vidi tačan lager ili samo „ima / nema / na upit"?

## 7. Otvoreno za vlasnika

- Odgovori na §6 i uzorci izvoza (`25-…` §2).
- Da li komercijalista sme da odgovara na zahteve za uslove bez kancelarije
  (u demou: sme, samo za svoje kupce).
- Ko odobrava predloge rabata iz faktura (postojeći tok: `prices:approve`, gazda).
