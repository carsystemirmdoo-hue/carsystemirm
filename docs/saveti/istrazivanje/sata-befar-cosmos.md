# SATA · BEFAR · Cosmos Lac — novosti i edukativni izvori

**Datum istraživanja:** 2026-10-08
**Namena:** sekcija „Saveti i vodiči“, kategorija „Novosti“
**Mašinski čitljiv spisak vesti:** `tmp-saveti/research/sata-befar-cosmos-news.json` (18 stavki)

Postojeće istraživanje nije ponavljano. Za osnovne podatke o brendovima, tehnologije i
izvore vidi `docs/SATA_RESEARCH.md`, `docs/BEFAR_BRAND_RESEARCH.md`,
`docs/BEFAR_PRODUCT_ARCHITECTURE.md`, `docs/COSMOS_DOCUMENT_SOURCE_MAP.md` i
`data/knowledge/brand-sources.ts`. Ovaj dokument dodaje samo vesti, edukativni materijal i
ograničenja pristupa.

Pravila koja važe za sve stavke:

- **Dostupnost u Srbiji nije potvrđena ni u jednom izvoru** (svuda `not-confirmed`).
- Svi sažeci su parafraze. Citati su izbegnuti.
- `accessedAt: 2026-10-08` stoji samo kod URL-ova koji su stvarno otvoreni. Kod Cosmos Lac
  tekstova sadržaj je pročitan kroz zvanični WordPress REST API istog sajta
  (`/wp-json/wp/v2/posts?slug=…`), a ne kroz HTML stranicu. Sadržaj je isti.
- „Aktuelno“ znači otprilike poslednjih 12 meseci (od oktobra 2025) i da je tema i dalje
  relevantna. Granični slučajevi su posebno označeni.

---

## 1. SATA

### 1.1 Zvanični kanali vesti

| Kanal | URL | Napomena |
|---|---|---|
| News & Campaigns | https://www.sata.com/en/service/news/news-campaigns/ | 9 stavki, od 2024-12-18 do 2026-06-09; bez paginacije |
| Practice Reports | https://www.sata.com/en/service/news/practice-reports/ | 16 stavki, od 2023-11-30 do 2026-05-12; uglavnom priče o korisnicima (custom, drvo, umetnost) |
| Trade shows & events | https://www.sata.com/en/service/news/trade-shows-and-events/ | sajmovi 2026; nijedan u Srbiji ni na Balkanu |
| YouTube RSS | https://www.youtube.com/feeds/videos.xml?user=SATAgmbh | stranica kanala se ne može pročitati; RSS radi |

Format datuma na sata.com je **M/D/YY**. To je potvrđeno stavkom „12/19/25“, jer 19 ne može
biti mesec. Zato je „6/9/26“ 9. jun 2026, a ne 6. septembar.
Regionalne verzije `en-us` i `en-gb` prikazuju samo 2 od 9 vesti (SATA Automation i Florian
Kaiser).

### 1.2 Vesti (detalji u JSON-u)

| Datum | Vest | Naš katalog | Klasa |
|---|---|---|---|
| 2026-09-07 (sajam 8–12. 9.) | Automechanika 2026: jet X basecoat EDITION, jet X clearcoat EDITION, jet X by Stilbruch, jetstream (autohaus.de, **sekundarni izvor**) | da: `sata-jet-x-basecoat-edition`, `sata-jet-x-clearcoat-edition`, `sata-jet-x-by-stilbruch-edition` | aktuelno |
| 2026-09-07 | ista izdanja za Australiju i Novi Zeland (paintandpanel.com.au, **sekundarni izvor**) | da (isti slugovi) | aktuelno |
| 2026-06-09 | SATA Automation: ulaganje u CurveRobot, robotski sistem jetstream | ne | aktuelno |
| 2025-12-19 (početak rada 1. 10. 2025) | SATA MEA, Dubai | ne | nerelevantno |
| 2025-08-21 | SATA QMR – Quick Material Regulator | da: `sata-qmr-quick-material-regulator` (+ kompatibilni pištolji) | aktuelno (granično, ~13,5 meseci; proizvod je aktuelan) |
| 2025-08-13 | intervju sa CEO o jet X | da: `sata-jet-x`, `sata-adam-x-pro` | istorijsko |
| 2025-06-27 | SATAjet 100 B Black (kampanja „THE FILLER BROTHERS“) | nejasno: porodica `satajet-100-b` postoji, crno izdanje nije poseban red | istorijsko |
| 2025-04-23 | jet X – iskustvo nemačkog servisa | da: `sata-jet-x` | istorijsko |
| 2025-04-17 | 13. Deutscher Lackierertag (održan 7–8. 2. 2025) | ne | nerelevantno |
| 2024-12-18 | jet X – od projekta do proizvoda | da | istorijsko |
| bez datuma | zvanična stranica jet K („the new premium spray gun“) | da: `sata-jet-k` | aktuelno (datum izlaska nije zvanično potvrđen) |

Stavke koje nisu uvrštene kao vesti:

- **New talents in the national team of vehicle painters** (2025-04-17). Nemačka nacionalna
  ekipa lakirera, nije relevantno za nas.
- **SATAjet X 5500 FUTURE** („Green is more than just a colour…“). U pretrazi su ga našli
  samo stručni portali, bez datuma u opsegu i bez zvanične SATA stranice. Nije otvoreno, pa
  nije uvršteno.
- **Lansiranje jet X**. Sekundarni izvori iz pretrage (autosphere.ca, 2024-11-21) navode
  premijeru na Automechanici 2024 i dostupnost verzija BASIC i DIGITAL ready od januara
  2025, ali **za Severnu Ameriku**. Sajt vraća 403, pa podatak nije proveren. Zvanični SATA
  tekst od 2025-04-23 kaže samo da je pištolj na tržištu „nekoliko nedelja“.
- **jet K: datum izlaska**. Kanadski portal (collisionrepairmag.com, 403) prema rezultatu
  pretrage navodi 1. jun za jet K Basic u Kanadi, ali godina i tekst nisu provereni. Jedan
  prodavac u SAD navodi „preorder, end of June 2026“. Ništa od toga nije zvanično za Evropu.

**Neslaganje u izvorima:** paintandpanel.com.au sva tri izdanja jet X naziva „limited-edition“,
a zvanična SATA stranica jet X basecoat EDITION (https://www.sata.com/en/jet-x-basecoat-edition/CF1931393)
**ne navodi nikakvo ograničenje**. Ograničenje („strictly limited edition“, samo DIGITAL ready,
dok traju zalihe) zvanično je potvrđeno samo za
**jet X by Stilbruch** (https://www.sata.com/en/jet-x-by-stilbruch-edition/CF1931394). U tekstu
za sajt ograničenje pominjati samo za Stilbruch.

Zvanična stranica izdanja basecoat (otvorena): mlaznice 1,1–1,4, RP ili HVLP, mlaz I (Control)
ili O (Speed), verzija DIGITAL ready, laserski urezane oznake na telu. Poboljšanja: mikrometar
vazduha, zaptivka, okidač, površina tela koja se lakše čisti, priključak za vazduh (QAC).

### 1.3 Sajmovi 2026 (zvanična lista, otvorena)

Holzhandwerk Nürnberg (24–27. 3.), PaintExpo Karlsruhe (14–17. 4.), Collision Repair Expo
(14–16. 5.), UK Garage & Bodyshop Event (3–4. 6.), **Automechanika Frankfurt (8–12. 9. 2026)**,
SEMA Las Vegas (3–6. 11.), Automechanika Dubai (12/2026). Nijedan nije u Srbiji ni u regionu.
Na Automechanici 2026 SATA je bila u hali 11.1: štand C03 (SATA) i D13 (SATA Automation). Ovaj
podatak potiče iz sekundarnog izvora (autohaus.de).

### 1.4 Edukativni materijal (zvanični)

| Tema | Izvor | Datum | Napomena |
|---|---|---|---|
| **Uputstvo za upotrebu jet X** (višejezično, 638 str., ~43,5 MB) | https://www.sata.com/media/d2/3c/04/1790259009/MULTILINGUAL-SATA-OPERATING-MANUAL-JET-X-3266-240619-2.PDF.PDF?ts=1790259009 | oznaka dokumenta 3266-**240619**-2 | **Nema srpskog ni hrvatskog.** Ima BG, SI, HU, RO, SK, CZ, PL, TR i druge jezike. EN deo počinje na str. 91 |
| Izjava o usaglašenosti za jet X | https://www.sata.com/media/f3/8a/06/1790259009/MULTILINGUAL-SATA-DECLARATION-OF-CONFORMITY-JET-X-4390-240925-3.PDF.PDF?ts=1790259009 | 4390-240925-3 | link sa stranice proizvoda; PDF nije otvaran |
| Uputstvo za SATAjet X 5500 | https://www.sata.com/media/e1/ba/aa/1790259010/BETRIEBSANLEITUNG-SATAJET-X-5500.PDF.PDF?ts=1790259010 | — | link sa stranice art. 1061564; PDF nije otvaran |
| **Tabele za nanošenje boja po proizvođaču** (Paint Application Chart) | https://www.sata.com/en/service/downloads/ | PDF metapodaci: 2023-07-28 | 70+ proizvođača boja, metrički i imperijalni sistem. Za nas su posebno važne **R-M**: https://www.sata.com/media/42/93/a8/1772450421/Hersteller_R-M_metrisch_en.pdf?ts=1772453900 i generička SATA tabela: https://www.sata.com/media/76/0b/35/1772450424/Hersteller_SATA_metrisch_en.pdf?ts=1772453923. Pokrivaju **SATAjet X 5500 / 5000 B / 4000 B, ali ne i jet X**. Uz tabele stoji ograda da su podaci bez garancije i da važe uputstva proizvođača boje. Za baslac nema posebne tabele |
| Katalog proizvoda 2025 (EN) | https://www.sata.com/media/1d/fa/b1/1771494954/EN---SATA-Product-Catalogue-2025_uid_6788ce1e8b007.pdf?ts=1771937806 | 2025 | PDF nije otvaran |
| Brošure | Spray Guns (3890-220829-9), Cup System (3901-220829-6), Cleaning Systems (3911-220829-3), RPS leaflet (126995-4036-02), adam 2 leaflet, SATAjet X 5500 leaflet, Complete Car Refinish Programme | 2018–2022 (prema oznakama) | sve se nalaze na stranici Downloads; starije su od jet X |
| Debljina sloja boje | https://www.sata.com/en/news/paint-layer-thickness | 2025-08-20 | Stručni tekst: veća debljina sloja sama po sebi ne znači lošu popravku. Fabrička debljina se razlikuje od proizvođača do proizvođača, a merači ne razlikuju slojeve ni kit. Dobra tema za vodič |
| Tehnički podaci za jet K | https://www.sata.com/en/jet-k/CF1931356 | — | mlaz do 36 cm, 10 bar statički pritisak materijala, 380 l/min, rastojanje 15–21 cm, mlaznice 0,8–1,8 mm, RP/HVLP i MaxLayer |
| Spare Parts Finder, Premium Warranty | već u `docs/SATA_RESEARCH.md` | — | — |

**Šta uputstvo za jet X kaže (EN, str. 98–100, parafrazirano):**

- Ako potreban ulazni pritisak u pištolju nije postignut, pritisak se povećava u mreži
  komprimovanog vazduha. Previsok pritisak otežava okidanje i kvari rezultat.
- Kada je regulacija materijala potpuno otvorena, mlaznica i igla se najmanje troše. Veličina
  mlaznice bira se prema materijalu i željenoj brzini nanošenja.
- Pre čišćenja i održavanja pištolj se odvaja od vazduha. Pištolj se **ne potapa** u sredstvo
  za čišćenje, jer ostaci ulaze u vazdušni kanal.
- Posle rada skida se set mlaznica i pištolj se čisti ručno. Posle promene materijala radi se
  međučišćenje u mašini za pranje.
- Koriste se samo originalni rezervni delovi. Servis i delovi idu preko SATA prodavaca.

**Zvanični YouTube (iz RSS-a, otvoren 2026-10-08; video stranice nisu otvarane):**

| Datum | Naslov | URL | Napomena |
|---|---|---|---|
| 2026-10-05 | Automechanika Frankfurt 2026 | https://www.youtube.com/watch?v=kNbOoc1PDcg | snimak sa sajma |
| 2026-03-26 | SATA Spray Mix Pack | https://www.youtube.com/watch?v=yLt2ewm1zf0 | sadržaj nije proveren |
| 2025-11-27 | air Star F 2.0 | https://www.youtube.com/watch?v=KszExGXtYXM | **respiratorna zaštita, nije u našem programu** |
| 2025-07-10 | jet X – Works for you. | https://www.youtube.com/watch?v=DMGabOsS42Y | više verzija istog naslova |
| 2025-05-28 | Cleaning and Maintenance jet X DIGITAL EN | https://www.youtube.com/watch?v=qT5rl3PvOfc | **najkorisnije za vodič o čišćenju** |
| 2025-05-28 | Cleaning and Maintenance jet X BASIC EN | https://www.youtube.com/watch?v=z-aHqx4PtFI | isto |
| 2025-04-16 | adam X – the compact and intuitive digital unit. | https://www.youtube.com/watch?v=FSUynasAMEo | merenje pritiska |

Filteri i respiratorne maske nisu u našem programu, pa zvanične materijale o njima (brošura
filtera serije 500/100, air vision 5000, air star) **ne uključivati** u vodiče.

---

## 2. BEFAR (befar.com.tr, Bursa, Turska — ne kineski befar.com)

### 2.1 Vesti

**Befar ne objavljuje vesti.** Proveravano 2026-10-08:

- `https://www.befar.com.tr/blog` i dalje nema nijedan tekst („nema objavljenih tekstova na
  ovom jeziku“).
- Sitemap `https://www.befar.com.tr/pages-sitemap.xml` ima 19 stranica, sve sa `lastmod`
  2025-04-11. Novih stranica nema od istraživanja iz avgusta 2026.
- Izvozni sajt `nargildisticaret.com` nema sekciju vesti. Kontakt je i dalje e-pošta i
  telefon izvoznika.
- `https://www.befar.com.tr/coming-soon-01` („Fuar Müşteri Tanıma“) je obrazac za posetioce
  sajmova, **bez naziva sajma i bez datuma**. Ne koristi se kao vest.

Jedina proverljiva vest u opsegu:

| Datum | Stavka | Izvor | Klasa |
|---|---|---|---|
| sajam 8–12. 9. 2026 | Befar Otomotiv među izlagačima Automechanike Frankfurt 2026, **hala 11.1, štand F51** | lista izlagača Messe Frankfurt (organizator, **sekundarni izvor** u odnosu na Befar) | aktuelno |

Lista izlagača ne navodi proizvode ni novitete. Zaglavlje stranice već prikazuje sledeće
izdanje (5–9. 9. 2028), a naslov i dalje glasi „Aussteller Automechanika Frankfurt 2026“.
Pretraga turskih izvora (BTSO, ekonomigazetesi) nije našla nijedan pomen Befara na sajmovima.
Članak BTSO o AAPEX-u 2023 **ne pominje** Befar.

### 2.2 Edukativni materijal

| Tema | Izvor | Datum | Napomena |
|---|---|---|---|
| Zvanični katalog (48 str., dvojezičan, ko-brendiran sa Nargil) | https://www.befar.com.tr/_files/ugd/446a5e_9192e551cfa540ae95f10c5247f2587b.pdf | HTTP `last-modified` 2024-09-02 (to je datum na serveru, ne datum izdanja) | i dalje dostupan (HTTP 200, 9,4 MB) |
| Legenda tvrdoće (boja pene → ★ do ★★★★★ → preporučena pasta) | katalog; već obrađeno u `docs/BEFAR_PRODUCT_ARCHITECTURE.md` §2 | — | **tri linije imaju različito mapiranje boja.** Crna je meka u osnovnoj liniji. U vodiču ne uopštavati „boja = ista tvrdoća u svim linijama“ |
| Uparivanje prečnika pene i podloge (tanjira), izbor podloge soft / middle hard / hard | katalog str. 5–7, 10, 14, 16–20; `BEFAR_PRODUCT_ARCHITECTURE.md` §5 | — | već dokumentovano |
| TDS / SDS / uputstva za upotrebu | — | — | **ne postoje ni na jednom zvaničnom izvoru**; potreban je direktan kontakt |
| Video | `nargildisticaret.com/video/befar.mp4` | — | brend video, nije edukativni |

---

## 3. Cosmos Lac (cosmoslac.com, Grčka)

### 3.1 Kanal vesti i pouzdanost datuma

Blog je na WordPress-u: https://cosmoslac.com/blog/ (kategorija News). Kroz API ima ukupno 746
tekstova na svim jezicima, od toga 93 na engleskom.

**Zamka sa datumima:** veliki broj starih tekstova ima polje `date` iz aprila 2026
(2026-04-17 do 2026-04-28), a `modified` 2025-02-19, dakle datum izmene stariji od datuma
objave. To su ponovo objavljeni stari tekstovi (npr. *Korydallos Lake Park* opisuje događaj iz
juna 2022). **Datum objave kod tih tekstova nije pouzdan** i ne treba ga prikazivati kao datum
vesti. U JSON su ušli samo tekstovi čiji su datumi dosledni (2024).

Od 2025. blog skoro isključivo objavljuje portrete umetnika (street art, murali, digitalna
umetnost). **U 2025–2026 nije pronađena nijedna vest o novom proizvodu.** Najnoviji tekst je od
2026-09-23 (portret umetnika, nerelevantno).

### 3.2 Vesti (detalji u JSON-u)

| Datum | Vest | Naš katalog | Klasa |
|---|---|---|---|
| 2024-07-03 | EASY MAX Sand Effect (2 nijanse) i Granite Effect (4 nijanse) | da: `cosmos-lac-easy-max` (nijanse su varijante kartice) | istorijsko |
| 2024-07-02 | Home Improvement Awards: zlato za ambalažu CHALK EFFECT, srebro za održivost | da: `cosmos-lac-chalk-effect` | istorijsko |
| 2024-05-28 | 4 nova spreja: Sticker & Glue Remover, Anti-Spatter for Welding, Textile Cleaner, Quick Start | da (4 sluga) | istorijsko |
| 2024-05-20 | vodič za farbanje felne (Iron Filler → Acrylic Primer Filler → Wheel Rim → Acrylic Varnish) | da (4 sluga) | istorijsko |
| 2024-03-05 | FLAME ORANGE / BLUE dobijaju karbon-neutralni sertifikat | da: `cosmos-lac-flame-orange`, `cosmos-lac-flame-blue` | istorijsko |
| 2026-09-23 | portret umetnika GLEO (primer novijih tekstova) | ne | nerelevantno |

Nove zvanične stavke na sajtu (Acrylic Varnish, Chrome Effect Container, Effect Container,
High Heat Container, prema `docs/COSMOS_LAC_CATALOG_SYNC.md`) **nemaju vest sa datumom** na
blogu.

### 3.3 Edukativni materijal

| Tema | Izvor | Datum | Napomena |
|---|---|---|---|
| **TDS po proizvodu** | obrazac `https://cosmoslac.com/pdfs/products/en/<proizvod>.pdf`; provereni: `sticker-glue-remover.pdf`, `bumper-paint.pdf` | HTTP `last-modified` 2026-07-30; PDF za Sticker & Glue Remover napravljen 2026-06-18 | TDS sadrži opis, svojstva, korake primene i čuvanje. **Ispravka za `brand-sources.ts`:** napomena „nema strukturiran TDS repozitorijum“ je zastarela, jer TDS postoji po proizvodu (sync ga već koristi kao „Product info“) |
| Uputstvo na stranici proizvoda | npr. https://cosmoslac.com/products/special-use/cleaners/sticker-glue-remover/ | — | sekcije Description, Application, Features, Cap System, Color Range |
| Katalog 2022 (EN) | https://www.cosmoslac.com/pdfs/catalogs/ENG_Catalogue2022_FINAL_DIGITAL%20USE.pdf | HTTP `last-modified` 2024-11-25 | i dalje dostupan; noviji katalog nije pronađen |
| Tanki slojevi umesto jednog debelog | https://cosmoslac.com/blog/spray-your-cosmos-tips-hacks/ | datum nepouzdan (2026-04-23 / izmena 2026-09-23) | 2–3 min između slojeva; proizvođač navodi da se suši za 10–15 min |
| Mućkanje limenke | https://cosmoslac.com/blog/spray-your-cosmos-shake-it-off/ | datum nepouzdan | boja i potisni gas moraju da se izmešaju, inače dizna može da se začepi |
| Uslovi rada (zima) | https://cosmoslac.com/blog/how-weather-conditions-affect-spray-painting/ | 2023-12-07 | optimalno 10–25 °C i vlažnost ispod 65 %; limenke čuvati na toplom; više tankih slojeva |
| Uloga laka | https://cosmoslac.com/blog/spray-your-cosmos-the-power-of-varnish-in-your-spray-paint-masterpieces/ | 2024-01-29 | zaštita i promena stepena sjaja |
| Spray School (serija videa na društvenim mrežama) | https://cosmoslac.com/blog/spray-school/ | datum nepouzdan | DIY nivo |
| Saveti za efekte (15 min između slojeva, 10–25 °C, vlažnost ispod 65 %) | tekst o Sand/Granite efektima (vidi 3.2) | 2024-07-03 | — |

Ton Cosmos tekstova je DIY i lifestyle. Za vodiče namenjene radionicama koristiti TDS i
stranice proizvoda, a ne blog.

**Nesklad pakovanja (prijaviti vlasniku kataloga):** zvanični TDS za Sticker & Glue Remover
navodi **200 ml**, a naš slug je `cosmos-lac-cleaners-718-400-ml-sticker-glue-remover-718`.
Pre objave treba proveriti i stvarno pakovanje i slug.

---

## 4. Ograničenja pristupa (zaobilaženje nije pokušavano)

| Izvor | Šta se desilo |
|---|---|
| collisionrepairmag.com (jet K, Kanada) | HTTP 403 |
| autosphere.ca (lansiranje jet X, 2024) | HTTP 403 |
| youtube.com/user/SATAgmbh | stranica kanala se ne može pročitati; korišćen je zvanični javni RSS |
| cosmoslac.com/blog/contact-distributor-country/serbia/ | **WordPress „critical error“**; zvanični spisak distributera za Srbiju ne može da se pročita |
| cosmoslac.com/find-a-store/ | čitljiv deo pominje samo partnere u Grčkoj; Srbija se ne vidi |
| cosmoslac.com/blog/product_instructions/ral/ i …/chalk-effect/ | prikazuju sadržaj početne strane; uputstva nisu dostupna |
| nargildisticaret.com | TLS sertifikat i dalje nije validan. Početna strana je pročitana jednom, samo radi provere sekcije vesti, sa isključenom proverom sertifikata. Nijedan obrazac nije korišćen |
| Instagram (befar_tr, cosmoslacofficial) | nije otvaran (stranica traži JavaScript, ranije zabeleženo) |
| sata.com PDF uputstva | dostupni bez prijave; uputstvo za jet X ima ~43,5 MB |

## 5. Nesigurnosti

1. **Datum izlaska jet X i jet K u Evropi** nije potvrđen zvaničnom vešću. Postoje samo
   severnoamerički sekundarni izvori, a oni nisu otvoreni (403).
2. **Da li su jet X basecoat i clearcoat izdanja ograničena:** sekundarni izvor kaže da jesu,
   zvanična stranica to ne pominje.
3. Datumi objave na Cosmos blogu za tekstove ponovo objavljene u aprilu 2026 nisu pouzdani.
4. Za BEFAR nema nijednog zvaničnog teksta proizvođača sa datumom. Učešće na Automechanici
   2026 potvrđuje samo organizator sajma.
5. SATAjet 100 B Black: stranica ne kaže da li je izdanje ograničeno, a u našem katalogu
   nije poseban red.
6. Tabele za nanošenje (R-M, SATA) su iz 2023. i ne obuhvataju jet X.
