# 61 — Meni portala i kupovina preko javnog sajta: pregled i plan

Status: **predlog i plan, bez izmena koda.** Zasebna dopuna (grana
`plan/meni-i-kupovina-2026-10-11` od firminog `main`); PR #23 se ne dira.
Uloge i dozvole: [60](60-uloge-i-dozvole.md).

## A. Bočni meni — sve stavke

Stanje: ✅ radi · 🟡 delimično · ⬜ prazna strana (čeka podatke).

| Grupa · stavka | Posao i ko | Stanje | Preklapanje | Predlog |
|---|---|---|---|---|
| Pregled · **Početna** | dnevni pregled: spremnost, kopije, nalozi, upozorenja (svi osim magacina) | ✅ | — | zadržati |
| Pregled · **Analitika** | promet cele firme, poređenja perioda (vlasnik, „analitika“) | ✅ | Prodaja (isti podaci, drugi presek) | premestiti kao karticu u **Prodaja** |
| Prodaja · **Kupci** | spisak kupaca sa prometom, pretraga, filter po komercijalisti (svi koji rade sa kupcima) | ✅ | Bez komercijaliste | zadržati kao glavnu stranu celine **Kupci** |
| Prodaja · **Šifre partnera** | povezivanje BizniSoft šifre partnera sa kupcem (vlasnik; kancelarija čita) | ✅ | Registar partnera | spojiti sa Registrom u karticu **Kupci → Povezivanje sa BizniSoftom** |
| Prodaja · **Registar partnera** | snimak BizniSoft kartica partnera, grupna dodela po šifri komercijaliste | ✅ iza zastavice | Šifre partnera | isto kao gore |
| Prodaja · **Nalozi kupaca** | kontakti, pozivi, stanje naloga, poruke za predaju (vlasnik) | ✅ | — | kartica **Kupci → Nalozi** |
| Prodaja · **Bez komercijaliste** | kupci bez dodele, za odluku o zaduženju (vlasnik, kancelarija) | ✅ | filter „Bez komercijaliste“ na Kupcima (B5) | spojiti: filter na Kupcima + kolone „poslednja kupovina“ i sortiranje; strana ostaje kao adresa filtera |
| Prodaja · **Prodaja** | fakture i stavke, filteri, izvoz | ✅ | Analitika, Povrati | zadržati kao celinu **Prodaja** sa karticama Fakture / Povrati / Analitika |
| Prodaja · **Povrati i minus fakture** | minus stavke i storna | ✅ | Prodaja (filter) | kartica **Prodaja → Povrati** |
| Prodaja · **Zahtevi kupaca** | prijem, obrada i potvrda zahteva; upiti za cenu (kancelarija; komercijalista čita) | ✅ | — | zadržati, izdvojiti na vrh (glavni dnevni posao kancelarije) |
| Prodaja · **Za razgovor** | radna lista po kupcu: zašto se javiti, šta ponuditi (komercijalista) | ✅ | Preporuke (isti obračun) | zadržati kao glavnu |
| Prodaja · **Preporuke** | tabela kupac × artikal: ko će uskoro ponovo kupiti šta | ✅ | Za razgovor | kartica **Za razgovor → Po artiklima** (ništa se ne briše) |
| Finansije · **Cene i rabati** | pravila rabata, predlog (vlasnik, komercijalista uz paket) | ✅ | Istorija, Odobravanje | celina **Cene i rabati** sa karticama |
| Finansije · **Odobravanje cena** | odluka o predlozima (vlasnik) | ✅ | — | kartica u **Cene i rabati** |
| Finansije · **Istorija pravila** | trag promena pravila | ✅ | — | kartica u **Cene i rabati** |
| Finansije · **Rabati iz faktura** | rabati izvedeni iz faktura, predlozi po grupama | ✅ | Cene i rabati | kartica u **Cene i rabati** |
| Finansije · **Cenovnik** | osnovne cene iz BizniSofta (vlasnik) | ✅ | — | kartica u **Cene i rabati** (samo vlasnik) |
| Finansije · **Dugovanja** | dug i naplata po kupcu | ⬜ čeka uplate | — | **sakriti** do izvoza otvorenih stavki |
| Finansije · **Kreditni limiti** | limiti kupaca | ⬜ | Dugovanja | **sakriti** |
| Logistika · **Zalihe** | stanje robe | ⬜ čeka lager | — | **sakriti** |
| Logistika · **Nabavka** | predlog nabavke | ⬜ | Zalihe | **sakriti** |
| Logistika · **Mapiranja artikala** | veza BizniSoft artikla sa katalogom (vlasnik; kancelarija čita) | ✅ (0 veza) | — | **premestiti** u **Podaci iz BizniSofta → Artikli i katalog**; ključno za kupovinu na sajtu (§B) |
| Logistika · **Porudžbine** | porudžbine dobavljaču | ⬜ | Zahtevi (ime zbunjuje) | **sakriti**; kada nastane — „Nabavka od dobavljača“ |
| Logistika · **Otprema / Adresnice / BEX** | magacin, kurirske pošiljke | ⬜ | — | **sakriti** do BEX ugovora i zaliha |
| Sistem · **Obaveštenja** | zahtevi, upiti, promene pravila i naloga | ✅ | zvono u traci | zadržati (i zvono) |
| Sistem · **Izveštaji** | — | ⬜ zastareo tekst | Prodaja (izvoz već postoji) | **sakriti** |
| Sistem · **Importi** | ručni uvoz PDF-a, istorija, prijem sa konektora | ✅ | — | celina **Podaci iz BizniSofta** |
| Sistem · **Izvorni dokumenti** | pregled i odluke o verzijama dokumenata | ✅ | — | kartica u **Podaci iz BizniSofta** |
| Sistem · **Spremnost podataka** | šta je od podataka spremno | ✅ | Početna | kartica u **Podaci iz BizniSofta** |
| Sistem · **Sinhronizacija** | konektor KANC-01, ciklusi, kopije | ✅ | — | kartica u **Podaci iz BizniSofta** |
| Sistem · **Korisnici i dozvole** | zaposleni, uloge, paketi | ✅ | Nalozi zaposlenih | celina **Zaposleni** (Dozvole / Bezbednost) |
| Sistem · **Administracija** | sistemski pragovi (kod ih ne koristi) | 🟡 | — | **sakriti** |
| Sistem · **Aktivnosti** | trag revizije | ✅ | — | kartica u **Zaposleni → Trag** |
| Bezbednost · **Lozinka / Drugi faktor** | sopstveni nalog (svi) | ✅ | — | premestiti u meni naloga (inicijali gore desno) |
| Bezbednost · **Nalozi zaposlenih** | reset lozinke, MFA, aktivacija tuđih naloga | ✅ | Korisnici i dozvole | kartica **Zaposleni → Bezbednost** |

**Kupci, Šifre partnera, Registar partnera, Nalozi kupaca, Bez komercijaliste** —
da, jedna celina **Kupci** sa tri kartice: *Spisak* (uz filter „bez
komercijaliste“), *Nalozi*, *Povezivanje sa BizniSoftom* (šifre + registar).
Svaka kartica zadržava svoje pravo pristupa; komercijalista vidi samo *Spisak*.

**Za razgovor i Preporuke** — isti obračun, dva prikaza: po kupcu (šta raditi
danas) i po artiklu (detalj). Jedna stavka **Za razgovor** sa karticom
**Po artiklima**.

### Predloženi meni (po poslovima)

```
Početna
Zahtevi kupaca            (zahtevi | upiti)
Kupci                     (spisak | nalozi | povezivanje sa BizniSoftom)
Za razgovor               (po kupcima | po artiklima)
Prodaja                   (fakture | povrati | analitika)
Cene i rabati             (pravila | predlozi iz faktura | odobravanje | istorija | cenovnik | za unos u BizniSoft*)
Podaci iz BizniSofta      (uvoz | izvorni dokumenti | artikli i katalog | sinhronizacija | spremnost)
Obaveštenja
Zaposleni                 (dozvole | bezbednost | trag)          — samo vlasnik
[inicijali] → Lozinka, Drugi faktor, Odjava
```
Sakriveno do podataka (adrese ostaju, ništa se ne briše): Dugovanja, Limiti,
Zalihe, Nabavka, Porudžbine dobavljaču, Otprema, Adresnice, BEX, Izveštaji,
Administracija. Svaka uloga vidi samo kartice za koje ima pravo; komercijalista
dobija 5 stavki (Početna, Zahtevi, Kupci, Za razgovor, Prodaja), kancelarija 7.

### Poslovi koji nedostaju

| Posao | Zašto | Ko |
|---|---|---|
| **Za unos u BizniSoft** — lista odobrenih rabata koje treba uneti u BizniSoft, sa oznakom „uneto“ | odobrena pravila danas nemaju radnu listu za kancelariju; postoji samo pravo „primena“ (`prices:apply`) | kancelarija (odluka vlasnika, dok. 60) |
| **Artikli i katalog** — uvoz šifarnika i predlog veza po tačnom kataloškom broju, grupna potvrda | bez veza nema cene kupca na sajtu (§B) | vlasnik / kancelarija |
| **Obaveštenje komercijalisti** o zahtevu i upitu **njegovog** kupca | danas ih vidi samo ako otvori listu | komercijalista |
| **Podaci firme** u kupčevom nalogu | kupac nema gde da vidi svoje podatke, opcije plaćanja i svog komercijalistu | kupac |
| **Dugovanja** — kada stigne izvoz otvorenih stavki | komercijalista i kancelarija pre isporuke | posle uzorka |

## B. Kupovina preko javnog sajta

### B.1 Šta već postoji

| Deo | Stanje | Napomena |
|---|---|---|
| Prijava kupca i povratak na stranu sa koje je došao | ✅ (`callbackUrl`, provera adrese) | dok je sajt **u pripremi**, vraća u nalog umesto na katalog |
| Link „Prijava za kupce“ i meni naloga u zaglavlju sajta | ✅ iza `NEXT_PUBLIC_CUSTOMER_LOGIN_LINK` (isključeno) | |
| Katalog, kategorije, pretraga, strane proizvoda, varijante | ✅ javno | 924 proizvoda, 2.209 varijanti; 2.024 varijante imaju kataloški broj proizvođača i pakovanje |
| Cena na kartici i strani proizvoda (`/api/kupac/ponude`) | 🟡 radi, ali **stari demo obračun** (`price_lists`) — za stvarne kupce nikad ne prikazuje cenu | bez keširanja, kupac samo iz sesije (izolacija postoji i testirana) |
| Izbor pakovanja i količine, „u korpu“ na strani proizvoda | 🟡 postoji (stari obračun) | treba preusmeriti na novi |
| Upit za cenu sa strane proizvoda | ✅ (proveren 11. 10.) | |
| Korpa na serveru (`customer_cart_items`, po firmi) | ✅ | ostaje posle ponovne prijave; broj u zaglavlju (`/api/kupac/sesija`) |
| Korpa i slanje zahteva u nalogu (`/kupac/korpa`) | ✅ novi obračun, provera cene pri slanju (otisak), obrada u kancelariji | |
| „Poručite ponovo“ | 🟡 lista iz stvarnih faktura postoji; „može se poručiti“ vezano za stari obračun | u nalogu postoji „artikli koje kupujete“ (novi obračun) |
| Moj nalog: fakture, zahtevi, upiti | ✅ | **nedostaju podaci firme** |
| Veze katalog ↔ BizniSoft šifra (`article_catalog_mappings`) | ✅ ekran i pravila (samo tačna šifra, potvrda čoveka) | **0 veza**; katalog nema nijednu BizniSoft šifru, pa automatski predlog danas nema po čemu da radi |
| Cena pakovanja | ✅ obračun (`packPrice`) | samo uz potvrđenu vezu **i** potvrđenu količinu u pakovanju |

### B.2 Plan dovršavanja

| # | Korak | Uslov završetka | Zavisi od | Programiranje | Vaš rad / podaci |
|---|---|---|---|---|---|
| K1 | **Potvrđene veze** varijanti sa BizniSoft šiframa: uvoz šifarnika → predlog veze **samo** kada je BizniSoft „Kat. br.“ tačno jednak kataloškom broju varijante (ili BizniSoft šifra tačno jednaka šifri u katalogu); dvosmisleno → sukob; potvrda čoveka, grupno po proizvodu; prioritet = artikli koje pilot kupci zaista kupuju | za pilot artikle: veza potvrđena ili svesno „na upit“; nijedna veza po nazivu | **šifarnik sa Kat. br. i pakovanjem** (kancelarija) | 1,5–2,5 dana | pregled predloga: 1–3 h (zavisi od broja i kvaliteta Kat. br.) |
| K2 | **Jedan serverski obračun** za sajt i nalog: ponude kataloga iz `customerPrices` (osnovna cena + odobreni rabat + opcija plaćanja), isti kao korpa i slanje; stari demo put isključen za stvarne kupce | ista cena na kartici, strani proizvoda, korpi i zahtevu (test) | K1 za cene; kod može ranije | 1 dan | — |
| K3 | **Prikaz cene**: cena po JM bez PDV-a, PDV, cena pakovanja samo uz potvrđenu količinu; „Cena na upit“ + upit kad nema veze, cene ili rabata | kartica i strana proizvoda, telefon i desktop | K2 | 0,5–1 dan | potvrda prikaza |
| K4 | **Dodavanje iz kataloga u jedinstvenu korpu**: varijanta → pakovanje → količina (korak po JM) → korpa firme; brzo dodavanje i sa liste; broj u zaglavlju; „Poručite ponovo“ puni istu korpu | ista korpa na sajtu i u nalogu, posle odjave i prijave | K1–K3 | 1–1,5 dan | — |
| K5 | **Slanje uz proveru**: postojeći tok (ponovni obračun, otisak, opcija plaćanja, komercijalni status) + **Podaci firme** u nalogu | promena cene između korpe i slanja traži novu potvrdu (već postoji) | K4 | 0,5–1 dan | — |
| K6 | **Provera u pregledaču**: ceo tok na desktopu i telefonu; dva kupca sa različitim rabatom + neprijavljen posetilac + nazad/osvežavanje + keš (CDN): nijedna personalizovana cena ne curi | sintetički tok prolazi; ručna provera na Preview-u | K1–K5 | 1 dan | 30–60 min pregled |

Ukupno programiranje: **≈ 5,5–8 dana** (procena obima). Najveća neizvesnost je
kvalitet kolone „Kat. br.“ u BizniSoftu. Ako je retko popunjena, veze se
potvrđuju ručno po artiklu: više Vašeg rada, a ne više programiranja.

### B.3 Pravila (ne menjaju se)

- Cena samo iz potvrđenog izvora: osnovna cena iz cenovnika i **odobreno** pravilo rabata. Bez veze, bez cene ili sa nepoznatim rabatom: **„Cena na upit“** i upit.
- Veze se **nikad** ne prave po sličnom nazivu: samo tačna šifra ili kataloški broj, a i tada samo predlog koji potvrđuje čovek.
- Personalizovana cena stiže samo iz `/api/kupac/ponude` (bez keša, kupac iz sesije). Javne strane ostaju statične i bez cena; neprijavljen posetilac i drugi kupac ne dobijaju ništa.
- Količina u pakovanju se ne izmišlja. Dok nije potvrđena, cena se prikazuje po JM iz BizniSofta (npr. po litru).

### B.4 Odluke pre K4

1. **Sajt u pripremi:** kupovina na javnom sajtu traži da katalog bude otvoren kupcima. Dve mogućnosti: otvoriti sajt, ili pilot kupcima dati kod za otključavanje (provereno, radi).
2. **Pilot kupci** (`ordering.trial`) i obim artikala za prvu proveru.
3. Da li cenu pakovanja potvrđuje šifarnik ili čovek pri potvrdi veze.

### B.5 Podaci iz kancelarije (dopuna dok. 58, korak 3)

| Podatak | Zašto | Gde |
|---|---|---|
| **Šifarnik svih artikala** sa kolonama: šifra, naziv, JM, **Kat. br.** (kataloški broj proizvođača), **količina u pakovanju**, EAN, grupa | K1 (veze) i cena pakovanja | BizniSoft, izvoz XLSX/CSV ako postoji |
| Odgovor: da li je „Kat. br.“ popunjen za većinu artikala (procena: ~sve / pola / retko) | od toga zavisi koliko veza se predlaže samo | pogled na nekoliko strana šifarnika |
| **Kontrolni uzorak**: 10 artikala koje dobro poznajete (BizniSoft šifra + koji je to proizvod u katalogu) | provera da predlog po Kat. br. daje tačnu vezu | ručno, papir ili poruka |
| JM kojom se prodaju lakovi i razređivači (LIT ili KOM po limenci) | prikaz cene po JM i pakovanju | šifarnik |

### B.6 Stanje (grana `feat/kupovina-na-sajtu`, nije spojeno ni objavljeno)

| Korak | Lokalno | Pregledač (sintetička baza) | Objavljeno |
|---|---|---|---|
| K1 alat za predloge veza (`scripts/catalog/biznisoft-catalog-proposals.mjs`; dokazi E1 šifra/kataloški broj, E2 kod proizvođača, E3 samo sličan naziv) | ✅ | — (izlaz privatan) | ne |
| K1 potvrda veza | ⏳ čeka potvrdu 10 kontrolnih veza; ništa nije upisano | — | ne |
| K2 jedan obračun (`loadCatalogRequestOffers`, isti `priceLines` kao korpa) | ✅ | ✅ | ne |
| K3 prikaz: pakovanje po BizniSoft artiklu, cena po JM bez/sa PDV-om po odobrenoj opciji, osnova (osnovna − rabat), „Cena na upit“ | ✅ | ✅ | ne |
| K4 ista serverska korpa iz kataloga i „Poručite ponovo“, broj stavki u zaglavlju | ✅ | ✅ | ne |
| K5 slanje uz ponovni obračun; stavka pamti potvrđenu katalošku vezu; „Moj nalog“ → Podaci firme | ✅ | ✅ | ne |
| K7 poručivanje u celim pakovanjima (0047): broj pakovanja × potvrđena zapremina = BizniSoft količina | ✅ | ✅ | ne (migracija 0047 nije primenjena na Production) |
| K6 tok `synthetic-portal-flow.mjs sajt` (status po varijanti, pakovanja, izuzetak kancelarije, štampa) | ✅ | ✅ 58/58 | — |

Pravila koja važe u kodu:
- **Cela pakovanja (odluka vlasnika 2026-10-11).** Kupac bira broj pojedinačnih pakovanja; obračunska količina za BizniSoft = broj × potvrđena količina pakovanja u JM (`article_pack_sizes`, upisuje čovek sa dokazom; `lib/ordering/packRule.mjs`). JM LIT, 5 L: 2 pakovanja = 10 LIT; JM KOM: 2 = 2. Merna JM bez potvrde → nema preračuna, artikal ide na upit; mera iz naziva je samo predlog (`scripts/catalog/pack-sizes.mjs`). Prodaja na odmerene litre nije u početnoj verziji; kancelarija u izmenjenom predlogu i dalje radi u JM (izuzeci uz posebnu odluku). Katalog, korpa, zahtev i štampa pokazuju cenu celog pakovanja i „2 × kanta 5 L = 10 LIT“. Kada kancelarija u predlogu unese količinu koja nije ceo broj pakovanja, stavka se svuda prikazuje kao **izuzetak** („7 LIT · nije ceo broj pakovanja (kanta 5 L)“), nikad kao cele kante. „Poručite ponovo“ ne zaokružuje istorijsku količinu koja nije deljiva pakovanjem — predloga tada nema. Za JM KOM pakovanje se broji u celim komadima; zapremina limenke (npr. 0,5 L) je opis, cena po komadu se ne množi njome (pravilo, ograničenje baze `article_pack_sizes_piece_check`, alat za upis).
- „Kataloški broj“ iz BizniSofta se ne koristi kao broj proizvođača (najčešće ponavlja internu šifru).
- Šifra se poredi kao tekst od šest cifara (`000000`), bez dodavanja ili brisanja nula van tog pravila.
- Iz kataloga se u korpu dodaje samo artikal sa **potvrđenom** vezom (`mapped`); predlog nije potvrda.
- Komada u kutiji je informacija, nikad minimum. Kolone dobavljača (Carsystem „VE“/„MOQ“, Befar „BOX QUANTITY“) **nisu** dokaz broja komada u transportnoj kutiji — beleže se kao „količina dobavljača“ sa nazivom kolone, a komada u kutiji ostaje „nije potvrđeno“ dok dobavljač posebno ne potvrdi.
- Status na strani proizvoda prati izabranu varijantu i ponudu prijavljenog kupca (`components/customer-buy/offerStatus.mjs`, isto pravilo kao panel): cena potvrđena → „Vaša cena potvrđena“; povezan bez cene → „Cena na upit“; inače javni status. Server i neprijavljen posetilac dobijaju javni status.

Šta K6 proverava (sintetički podaci): neprijavljen posetilac (ni panel, ni cena u HTML-u, API `no-store`); dve firme sa različitim rabatom u dva prozora istovremeno; jedna i dve opcije plaćanja; prijava sa početne, iz kataloga i sa proizvoda (sa `?varijanta=`) i povratak na istu stranu; odjava na istu stranu bez cena i ponovna prijava; ista korpa iz kataloga i „Poručite ponovo“, i posle ponovne prijave; telefon; dva pakovanja jedne kartice; povezan artikal bez cene i nepovezana varijanta → „Cena na upit“; promena rabata pre slanja → nova potvrda; prijem u kancelariji i štampa.

Otvoreno:
1. Potvrda 10 kontrolnih veza i odgovori (LIT po litru ili po limenci, „5/1“, razlika zapremine, dva pakovanja na kartici).
2. Upis potvrđenih veza na Production — posebno odobrenje.
3. Potvrda transportnog pakovanja (komada u kutiji) od dobavljača — nijedan broj još nije potvrđen.
4. Stari demo put (`loadCustomerOffers`, `addToCartAction`) više ne koristi katalog; uklanja se posebno.
