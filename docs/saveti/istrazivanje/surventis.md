# Surventis brendovi — novosti i edukativni izvori (R-M, baslac, Norbin)

Datum istraživanja i pristupa svim otvorenim URL-ovima: **2026-10-08**.
Mašinski čitljiv spisak vesti: `tmp-saveti/research/surventis-news.json` (74 zapisa).

Metod: sve stranice otvorene su kroz WebFetch (HTML pretvoren u tekst, uz sažimanje). Direktan `curl` iz sandboxa nije mogao da razreši DNS, pa sirovi HTML nije sačuvan. Posledice:
- datumi i naslovi su preuzeti onako kako ih stranica prikazuje, u formatu DD/MM/YYYY na rmpaint.com i baslac.com;
- futer, logo i ikonice društvenih mreža se u tom pretvaranju često gube, pa su takve tvrdnje označene kao neproverene;
- svi sažeci na srpskom su napisani našim rečima, na osnovu pročitanog teksta.

Prethodno istraživanje nije ponavljano: `docs/NORBIN_BRAND_RESEARCH.md` (S10–S13), `docs/*_DOCUMENT_SOURCE_MAP.md`, `data/knowledge/brand-sources.ts`.

---

## 1. BASF Coatings → Surventis: utvrđeni datumi

| Događaj | Datum | Zvanični izvor | Napomena |
|---|---|---|---|
| Obavezujući ugovor BASF–Carlyle (u partnerstvu sa QIA) | **2025-10-10** | https://www.basf.com/global/en/media/news-releases/2025/10/p-25-203 (P-25-203) | Prodaju se OEM premazi, reparaturni premazi i površinska obrada. Vrednost posla (EV) je 7,7 mlrd €, BASF zadržava 40 %, a tada se očekivalo zatvaranje u Q2 2026. Kopija postoji i na surventiscoatings.com. |
| Najava promene rukovodstva posle zatvaranja | 2026-03-26 | https://www.basf.com/global/en/media/news-releases/2026/03/p-26-064 | Ime „Surventis“ se **još ne pominje** („standalone coatings company“). |
| Imenovan Steve Arndt za refinish | 2026-06-03 (na snazi od 2026-07-01) | https://www.surventiscoatings.com/media/news/steve-arndt-appointed-senior-vice-president-global-automotive-refinish-coatings | Nasleđuje Chrisa Titmarsha. |
| Imenovan izvršni komitet | 2026-06-26 po listi vesti (stranica daje 25. jun) | https://www.surventiscoatings.com/media/news/basf-coatings-names-executive-committee-lead-and-drive-success-standalone-company | Saopštenje i dalje potpisuje „BASF Coatings“. |
| **Pravno zatvaranje transakcije** | **2026-06-30** | https://www.basf.com/global/en/media/news-releases/2026/07/p-26-113 (P-26-113, objavljeno 2026-07-01) | Saopštenje kaže da je transakcija završena 30. juna 2026. To potvrđuje i BASF P132/26e od 2026-07-15 („closed on June 30, 2026“). |
| **Samostalno poslovanje i predstavljanje imena „Surventis“** | **2026-07-01** | https://www.surventiscoatings.com/media/news/surventis-launches-as-an-independent-global-leader (PDF: https://www.surventiscoatings.com/sites/default/files/2026-06/20260701_Press_Release_Surventis%20Launch_EN_0.pdf, nije otvaran) | Prema saopštenju, korporativna marka je predstavljena tog dana („unveiled today“). Sedište je u Minsteru. Većinski vlasnik su fondovi kompanije Carlyle u partnerstvu sa QIA, a BASF ima 40 %. |

**Najava naspram stupanja na snagu.** Posao je najavljen 2025-10-10, pravno je zatvoren 2026-06-30, a Surventis posluje kao samostalna kompanija od 2026-07-01. Ime „Surventis“ je, prema zvaničnim izvorima, prvi put javno predstavljeno **istog dana kada je stupilo na snagu**, 2026-07-01. Ranije javno saopštenje imena nismo pronašli: saopštenja od 26. marta i 25./26. juna ga ne pominju, a sekundarna štampa (jul 2026) takođe datira predstavljanje imena na 1. jul. Postoje nagoveštaji da je ime bilo poznato ranije: PDF saopštenja leži u folderu `2026-06/`, a na stranici o izvršnom komitetu, koja se sada nalazi na surventis domenu, stoji futer „Until July 1, 2026, our business was part of BASF“. To su verovatno naknadne ili pripremne izmene i nisu dokaz ranije objave.

**Provera tvrdnje iz `brand-sources.ts`.** Tvrdnja „samostalna od 1. jula 2026“ je **tačna** za početak samostalnog poslovanja. Ako tekst govori o pravnom zatvaranju prodaje, tačan datum je 30. jun 2026. Kupac je potvrđen: fondovi kojima upravlja **Carlyle**, u partnerstvu sa **Qatar Investment Authority (QIA)**. BASF zadržava **40 %**.

### Kako se brendovi danas predstavljaju (stanje 2026-10-08)
- **R-M (rmpaint.com):** početna strana kaže da Surventis (ranije BASF Coatings) sada posluje kao nezavisna kompanija, a da R-M ostaje brend za reparaturne premaze. Vest od 2026-07-01 na rmpaint.com eksplicitno kaže da su brendovi poput Chemetall i R-M vidljivi „with the new by Surventis logo“. Logo „R-M by Surventis“ je, dakle, potvrđen tekstom proizvođača. Starije vesti iz 2026. i dalje pišu „R-M … by BASF Coatings“; to je istorijski tekst. Portal info.rmpaint.com i dalje nosi oznaku „A brand of BASF“.
- **baslac (baslac.com):** početna strana nosi isti tekst o Surventisu („…baslac remains your trusted brand for cost-effective automotive refinish solutions“). Logo „by Surventis“ sam nisam mogao vizuelno da proverim jer WebFetch ne prenosi logo; navod u `brand-sources.ts` (provereno 2026-09-18) ostaje kao poslednja potvrda. Vesti iz februara i marta 2026. potpisane su „a brand of BASF Coatings“.
- **Norbin (norbin-paint.com):** futer i dalje glasi „© BASF Coatings GmbH 2026. NORBIN® is a registered Trademark of BASF Coatings GmbH.“ Nema pomena Surventisa, što potvrđuje stanje `CURRENT_BUT_LEGACY_BRANDING`. Na surventiscoatings.com/refinish NORBIN je naveden kao brend portfolija, sa linkom na `http://www.norbinpaint.com/` (drugačiji domen od norbin-paint.com; nije otvaran).
- **Surventis refinish portfolio** (https://www.surventiscoatings.com/refinish): Glasurit, R-M, baslac, NORBIN, LIMCO (samo Amerike), RODIM i Refinity.

---

## 2. Novosti po brendu

Legenda: **A** = aktuelno, **I** = istorijsko, **N** = nerelevantno. „Kat.“ = da li je proizvod u našem programu (slug). **Nijedna vest ne potvrđuje raspoloživost u Srbiji**; svuda važi `not-confirmed`.

### 2.1 Surventis / BASF (korporativno, relevantno za refinish)

| Datum | Naslov | Kat. | Kl. |
|---|---|---|---|
| 2025-10-10 | Joint News Release: BASF and Carlyle reach binding transaction agreement… | — | I |
| 2026-03-26 | BASF Coatings announces leadership transition post-closing | — | I |
| 2026-06-03 | Steve Arndt appointed Senior Vice President, Global Automotive Refinish Coatings | — | A |
| 2026-06-26 | BASF Coatings names Executive Committee… | — | I |
| 2026-07-01 | BASF and Carlyle complete coatings transaction (BASF P-26-113) | — | A |
| 2026-07-01 | Surventis launches as an independent global leader… | — | A |

Ostale Surventis vesti (lista: https://www.surventiscoatings.com/press-releases, 5 stranica, ?page=0–4) nisu uključene u JSON, osim kao ogledala R-M vesti. Razlog: tiču se Glasurita (koji nije u našem programu), OEM-a, Chemetalla ili vazduhoplovstva:
- Lola Cars × Surventis (2026-10-07, Glasurit 100 Line);
- WorldSkills Shanghai (2026-08-19 i 2026-09-29, Glasurit 100 Line; takmičenje od 22. do 27. septembra 2026);
- AUMOVIO, NST, Langelsheim, Blackman Township;
- „BASF Coatings wins sustainability award“ (2026-05-27), GM Supplier of the Year, renewable electricity (2026-04-29);
- partnerstva u Australiji (SAPE, Wholesale Paint Group, oktobar 2025).

Ogledala R-M vesti: LightAssist (Surventis 2026-09-09 / R-M 2026-09-10), Automechanika 2026 (Surventis 2026-08-05 sa halom 11.1 i štandom C53 / R-M 2026-07-29), Eco Impact TÜV (Surventis 2026-04-13 / R-M 08/04/2026), robotika (2026-05-28).

### 2.2 R-M (https://www.rmpaint.com/en-int/newsroom, 9 stranica, ?page=0–8; pregledane stranice 0–6, do 03/08/2023)

Vesti koje su sadržinski najkorisnije za „Saveti i vodiči“:

| Datum | Naslov | Proizvod u katalogu | Kl. |
|---|---|---|---|
| 2026-09-11 | Faster Repairs Start with Wet-on-Wet Technology | p-2p81 / p-2p85 RACE WET Fill-R, c-2p42, rm-agilis | A |
| 2026-09-10 | Refinish Mastery…: New LightAssist functionality in Refinity | — (softver) | A |
| 2026-07-29 | Surventis presents integrated solutions… at Automechanika 2026 | — | A |
| 2026-07-01 | Surventis launches as an independent global leader… | ceo program | A |
| 2026-05-28 | Application Expertise in Robotics | — | A |
| 2026-05-12 | R-M® optimizes body shops resource planning with … aspaara® AI | — | A |
| 2026-04-08 | Eco Impact Assessment tool receives TÜV Rheinland certification | — | A |
| 2026-02-20 | R-M® and Toyota Motor Europe | — | A |
| 2026-01-22 | Driving Transparency: … New PCF Solution | rm-agilis, rm-onyx-hd, c-2p42 | A |
| 2026-01-16 | Green Takes the Lead: … 2025 Automotive Color Report | — | A |
| 2025-12-17 | R-M and Stellantis Extend Global Partnership | — | A |
| 2025-10-24 | R-M® Pioneers Wet-on-Wet Technology with the Ccycled® certified RACE-WET FILL-R | **p-2p81-race-wet-fill-r-white, p-2p85-race-wet-fill-r-black** | A |
| 2025-07-23 | Toyota Motor Manufacturing France Trained… | rm-agilis, c-2p42 | I |
| 2025-07-07 | Sauber F1 … RACE Finish-R Clear Coat | c-2p42-race-finish-r | I |
| 2025-04-11 | Recommended by R-M: Refinity® new end-to-end digital color solutions | — (ScanR, ImagePLUS, Alfa CR4/6) | I |
| 2025-03-28 | AGILIS® launches eSense mixing clears… | unclear: rm-agilis-esense, rm-agilis-esense-x-treme (HB 010E/010XE/030E/030XE/040E nisu povezane po šifri) | I |
| 2025-02-10 | R-M® unveils its first NEV Repair solutions for body shops | rm-agilis, c-2p42 | I |
| 2025-01-06 | Strategic partnership (BMW/MINI, 50 tržišta) | rm-agilis | I |
| 2024-10-18 | R-M launches first RADAR Fit tool for Body shops | — | I |
| 2024-10-02 | A new fast-drying clear coat for PIONEER Series | c-2p42-race-finish-r | I |
| 2024-09-05 | R-M® unveils at Automechanika 2024 a new, sustainable clear coat… mass balance | c-2p42, rm-agilis-esense | I |
| 2024-04-16 | R-M AGILIS® is proven to be the fastest and greenest waterborne basecoat system | rm-agilis, rm-agilis-x-treme, 2560-agilis-amplifier | I |
| 2024-03-01 | R-M® speeds up with the Alfa CR4/CR6, Powered by Refinity | — | I |

Ostale R-M vesti u JSON-u su sportske, vezane za druga tržišta ili priče o kupcima: OpenRoad (Kanada), Emil Frey DTM i Valensija, Geely UK, Volvo UK, Benecar, NADA (SAD), Južna Afrika, Garage Italia, GuerreroCar, Sauber F1 (više vesti), CESVI Meksiko, Mercedes APAC, JLR (Evropa i Severna Amerika), Bahrein, INEOS, Renault R5 (dve vesti), Color Trends 2024-25, Color Report 2023 i 2024, Peugeot, Women's Day (2025 i 2026), Falcone masterclass, Toyota Europe 2025, Eco Impact 2025. Ukupno R-M: **59 zapisa** (12 A / 25 I / 22 N). Vesti starije od januara 2024. (stranica 6: AMOY Training Center 11/12/2023, Citroën oli 07/12/2023, AGILIS Amplifier award 29/09/2023, Best Painter 03/08/2023) nisu unete. Stranice 7–8 nisu otvarane.

Napomena o URL-u: kartica „Faster Repairs…“ vodi na `/en-int/news/faster-repairs-smarter-processes-start-wet-wet-technology`, a kraći slug takođe vraća sadržaj. U JSON je upisan duži.

### 2.3 baslac (https://www.baslac.com/en-emea/news-and-testimonials, 2 stranice)

`/en-emea/news` i `/en-emea/newsroom` vraćaju 404. Ispravna lista je `news-and-testimonials`.

| Datum | Naslov | Proizvod u katalogu | Kl. |
|---|---|---|---|
| 2026-03-20 | baslac® celebrates 20 years of global growth and customer success | unclear: linija 45 (families: baslac-line-45; komponente baslac-45-r45, baslac-45-w10) | A |
| 2026-02-10 | Refinity® platform now available to baslac® users worldwide | — | A |
| 2025-12-17 | baslac Customers Connect Through Education and Passion (Poljska) | — | N |
| 2025-12-09 | Trusted by Lanchi Group in China | unclear: linija 45 | N |
| 2025-12-05 | baslac and Distrigo Strengthen Partnership with Advanced Training… | — | I |
| 2025-11-18 | baslac® speeds up repairs with the new 40-100 High Speed 2K Clear VOC | **baslac-40-100-high-speed-2k-clear-voc** | A |
| 2025-11-18 | baslac® introduces the 40-620: The Fast, Reliable Matte Clearcoat… | **baslac-40-620-2k-clear-mat-voc** (+ 40-440, 40-450) | A |
| 2024-08-07 | Launching of baslac showroom | — (baslacshowroom.com sada vraća 301 na baslac.com) | I |
| 2023-04-17 | What's on : Tech tips series from baslac | — | I |

Starije stavke (17/04/2023 #Justmakessense, e-finder star; 2022 Koreja i Malezija, „Top choice: baslac 45“) nisu unete u JSON.

### 2.4 Norbin (https://www.norbin-paint.com/en)

**Na zvaničnom sajtu nema sekcije sa vestima niti datiranih vesti.** Ni pretraga nije našla zvaničnu Norbin vest iz perioda 2024–2026; jedini pogoci su iz lansiranja 2015/2016 (već u `NORBIN_BRAND_RESEARCH.md` S13). Jedini datirani materijali na stranici asortimana (https://www.norbin-paint.com/en/norbin-range.html):
- brošura „Refinish a winner with NORBIN® (EN)“, maj 2024;
- poster sivih nijansi, 2021-02-23;
- TDS fajlovi sa datumima iz 2022.

To je dokumentacija, ne vesti, i ostaje iza postojećeg rights gate-a (`docs/NORBIN_DOCUMENT_SOURCE_MAP.md`). Zvanične društvene mreže navedene na sajtu: https://www.facebook.com/NORBINpaint/, https://www.instagram.com/norbin_paint (nisu otvarane). Za Norbin u JSON-u nema zapisa.

---

## 3. Edukativni i tehnički izvori

| Izvor | URL | Šta pokriva | Datum / pristup |
|---|---|---|---|
| R-M Expert Knowledge (centralna stranica) | https://www.rmpaint.com/en-int/expert-knowledge | Linkovi ka tehničkoj obuci, tehničkoj podršci, seminarima, trening centrima, Refinityju i vodiču za NEV | bez datuma; javno |
| R-M Technical Training (InfoR-M) | https://www.rmpaint.com/en-int/technical-training | Online platforma InfoR-M: video uputstva, e-knjige, tutorijali (priprema, boja, nanošenje, poliranje) | navodi se da je „namenjena R-M radionicama“, pa je za pun pristup verovatno potreban nalog |
| Info R-M portal | https://info.rmpaint.com/ | Katalog proizvoda po kategorijama, procesi, saveti za greške u laku, color explorer | javno, uz opcioni login za lični feed; brending „A brand of BASF“ |
| R-M vodič za NEV | https://www.rmpaint.com/en-int/new-energy-vehicles | Reparatura električnih vozila: baterija ne sme preko 60 °C duže od 45 min, niskotemperaturni procesi, Pioneer/AGILIS | bez datuma; poster PDF: https://info.rmpaint.com/system/files/documents/R-M_NEV_Campaign_Poster.pdf (nije otvaran) |
| R-M Refinish Competence Centers | https://www.rmpaint.com/en-int/rccs | Mreža trening centara (u pretvorenom tekstu nema spiska lokacija) | bez datuma |
| R-M Technical Support | https://www.rmpaint.com/en-int/technical-support | Podrška na terenu i na daljinu, pomoć pri traženju nijanse, rešavanje problema; kontakt preko dilera | bez datuma |
| R-M Sustainability | https://www.rmpaint.com/en-int/sustainability | VOC, eSense, Ccycled, biomasni bilans, PCF (ISO 14067) | bez datuma |
| R-M Chemical Recycling (Ccycled) | https://www.rmpaint.com/en-int/chemical-recycling | Reciklirane gume kao sirovina, maseni bilans (REDcert²); pominje C 2P42 | brojke „do aprila 2026“ |
| R-M AGILIS | https://www.rmpaint.com/en-int/agilis | Tvrdnje o AGILIS sistemu (VOC <250 g/l, Amplifier, Extreme, Tricoat) | bez datuma |
| R-M TDS repozitorijum | https://techinfo.rmpaint.com/ | Javni indeks foldera (PIONEER/ADVANCE/ELEMENT/unicorn), više jezika | javno (već u `brand-sources.ts`) |
| Refinity | https://www.refinity-solutions.com/ | Moduli Color / Business / Training („Learning University“); podržava Glasurit, R-M i baslac; brending Surventis | nalog za korišćenje |
| baslac Training Solutions | https://www.baslac.com/en-emea/training-solutions | Online „baza podataka i trening centar“, video serija „5-Minute baslac“, TDS, alat za tehničku podršku | bez datuma |
| baslac Technical Support Tool | https://www.baslac.com/en-emea/technical-support-tool | Uputstva sa filterima po liniji (30 CV, 35, 45), materijalu i koraku reparature (42 rezultata) | javno, bez logina u pretvorenom tekstu |
| baslac TDS | https://www.baslac.com/en-emea/technical-data-sheets | Tehnički listovi i informativni dijagrami | već u `brand-sources.ts` |
| baslac YouTube | https://www.youtube.com/@baslac | Kratki video saveti (npr. 80-30, 40-440 naspram 40-450, 65-10 blend-in, čišćenje) | link sa zvanične stranice; sam kanal nije otvaran |
| R-M YouTube | https://www.youtube.com/@rmpaint (youtube.com/rmpaint) | zvanični kanal prema starijim BASF saopštenjima | WebFetch nije prikazao sadržaj kanala; nije provereno |
| Surventis YouTube | https://www.youtube.com/@Surventis | korporativni kanal, link sa surventiscoatings.com/refinish | nije otvaran |
| Godišnji izveštaji o bojama | npr. https://www.rmpaint.com/en-int/news/green-takes-lead-2025-automotive-color-report | Trendovi boja novih vozila po regionima | 2026-01-16 (za 2025), 2025-01-14 (za 2024) |

---

## 4. Ograničenja pristupa (ništa nije zaobiđeno)
- `curl` iz sandboxa: DNS se ne razrešava (`Could not resolve host`), pa je sve čitano kroz WebFetch.
- WebFetch na rmpaint.com povremeno je vraćao `ECONNREFUSED` (IPv6); ponovni pokušaj je uspeo za sve stranice osim newsroom stranica 7–8, koje nisu ni tražene.
- Sadržaj YouTube kanala se ne prikazuje kroz WebFetch.
- InfoR-M obuke i Refinity zahtevaju nalog; nisu otvarani.
- Nismo naišli na geo-blokade. rmpaint.com nema vidljiv izbor za Srbiju/region (nema lokalnog sajta `sr-rs`); svi linkovi su `en-int` / `en-emea`.

## 5. Sekundarni izvori (samo potvrda, nisu otvarani; viđeni u rezultatima pretrage)
- Repairer Driven News, 2026-07-07: https://www.repairerdrivennews.com/2026/07/07/basf-coatings-now-officially-surventis/
- CollisionWeek, 2026-07-01: https://collisionweek.com/2026/07/01/basf-coatings-completes-sale-carlyle-relaunches-surventis/
- Autosphere, 2026-07-02: https://autosphere.ca/collision/2026/07/02/basf-closes-landmark-e7-7b-coatings-sale-to-carlyle-rebrands-as-surventis/
- FenderBender, oktobar 2025 (ugovor): https://www.fenderbender.com/news/latest-news/news/55322645/basf-automotive-refinish-basf-sells-majority-stake-in-oem-and-refinish-coatings-business

Svi se slažu sa zvaničnim datumima (ugovor 2025-10-10, zatvaranje 2026-06-30, Surventis od 2026-07-01).

## 6. Otvorena pitanja
1. Logo „by Surventis“ na baslac.com nije vizuelno proveren u ovoj sesiji (oslanjamo se na proveru od 2026-09-18). Za R-M ga potvrđuje tekst vesti.
2. Šifre AGILIS eSense mešajućih komponenti (HB 010E…) nisu povezane sa našim slugovima `rm-agilis-esense*`; to traži proveru na nivou artikla.
3. Datum objave izvršnog komiteta: lista kaže 26. jun, stranica 25. jun 2026.
4. U jednom čitanju Eco Impact TÜV vest se pogrešno pojavila kao „August 4, 2026“. Ispravno je 8. april 2026: sajt koristi format DD/MM, a Surventis istu vest datira 13. aprilom 2026.
5. Raspoloživost u Srbiji: nijedan izvor je ne potvrđuje. Za novosti treba koristiti formulaciju „proizvod iz našeg programa; za dostupnost se obratite prodaji“ i ne tvrditi tržišnu dostupnost na osnovu globalnih saopštenja.
