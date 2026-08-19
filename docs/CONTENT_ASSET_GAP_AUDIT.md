# CONTENT / IMAGE / PRODUCT / DOCUMENTATION GAP AUDIT

**Datum:** 2026-08-08
**Grana:** `recovery/pre-claude-2026-08-07`
**Metod:** verifikacija stvarnih fajlova u `public/`, stvarnih referenci u komponentama i stvarnih product zapisa. Nije menjan nijedan fajl osim ovog dokumenta.

---

## 0. NAJVAŽNIJI NALAZ PRE SVEGA OSTALOG

Pre nego što se krene u prikupljanje, dve stvari menjaju ceo prioritet:

### 0.1 — 28 referenciranih slika UOPŠTE NE POSTOJI u `public/`

Skenirano je 1124 jedinstvenih asset referenci u `components/`, `lib/`, `data/`, `app/`. Nedostaje 28, i to nisu nasumične — to su **sve** slike dve kompletne brand stranice:

| Brend | Referencirano | Postoji | Nedostaje |
| ----- | ------------- | ------- | --------- |
| baslac | 15 | **0** | **15** |
| Carsystem | 13 | **0** | **13** |

Posledica: **baslac i Carsystem brand stranice trenutno renderuju isključivo placeholder kutije.** Na baslac-u je to doslovno vidljiv sivi box sa tekstom `IMAGE SLOT` + ime fajla (`components/baslac-brand/BaslacMediaSlot.tsx:63-70`). Na Carsystem-u isto (`CarsystemMediaSlot.tsx`). To nije "moglo bi bolje" — to je stranica bez ijedne fotografije.

Isto važi i za **C.A.R.FIT**: svih 17 media slotova u `lib/carfit-brand-data.ts` ima `src: null` (helper `media()` na liniji 98 ima `src` default `null`, i **nijedan poziv ne prosleđuje src**). Fallback je dizajniran modul mreže, pa nije ružan kao baslac box — ali fotografije nema nijedne.

**Tri od pet brand stranica trenutno nemaju nijednu fotografiju.**

### 0.2 — Veliki deo materijala je VEĆ PRIKUPLJEN, samo nije objavljen

U `assets/manufacturer/` stoji 646 MB već preuzetog proizvođačkog materijala sa `published: false`:

| Brend | Slike | Dokumenti | Ukupno | Status |
| ----- | ----- | --------- | ------ | ------ |
| Carsystem | **441** | **506** | 177 MB + docs | `published: false` |
| Cosmos Lac | **670** | — | 102 MB | `published: false` |
| C.A.R.FIT | **123** | **300** | 15.9 MB + docs | `published: false` |

Izvor: `data/knowledge/{carsystem,cosmos,carfit}-images.generated.json`.

**Ovo znači da packshot i dokumentacioni gap NIJE gap u nabavci — to je odluka o pravima korišćenja i objavljivanju.** Pre nego što se traži i jedan novi packshot, treba rešiti da li se ovaj materijal sme objaviti.

**ALI** — i ovo je ključno — pregledao sam sadržaj staging foldera i **tamo nema nijedne lifestyle/application fotografije.** Sve su packshotovi na beloj pozadini i TDS PDF-ovi. Znači:

> Packshot i dokument gap → verovatno rešiv već postojećim materijalom.
> Hero / application / workflow gap → **mora se fotografisati ili licencirati, nema ga nigde.**

To je prava podela posla.

---

## 1. SCOPE — POTVRĐENO

Rutiranje ide kroz `app/brendovi/[slug]/page.tsx`, koji granulisano bira komponentu po slugu:

| Stranica | Ruta | Komponenta | LOC (tsx+css) | U scope-u |
| -------- | ---- | ---------- | ------------- | --------- |
| Homepage | `/` | `components/home/CarsystemHomePage.tsx` | 31k + 81k | DA |
| R-M | `/brendovi/rm` | `components/rm-brand/RmBrandPage.tsx` | 23k + 85k | DA |
| baslac | `/brendovi/baslac` | `components/baslac-brand/BaslacBrandPage.tsx` | 20k + 36k | DA |
| C.A.R.FIT | `/brendovi/carfit` | `components/brand/carfit/CarfitBrandPage.tsx` | 30k + 36k | DA |
| Cosmos LAC | `/brendovi/cosmos-lac` | `components/brand/cosmos/CosmosBrandPage.tsx` | 6.6k + 25k | DA |
| Carsystem | `/brendovi/carsystem` | `components/carsystem-brand/CarsystemBrandPage.tsx` | 11k + 61k | DA |

**Nijednu dodatnu stranicu ne uključujem u audit.** Provereno i odbačeno:

- `/prodavnice`, `/kontakt`, `/katalog` — 33/34/43 linije, tanki wrapperi oko deljenih komponenti, nemaju custom brand dizajn.
- `/program`, `/program/[slug]` — generički program listing.
- `/vodici`, `/vodici/[slug]` — Tailwind utility styling, bez custom dizajna. **Napomena: sva 3 vodiča su `status: "draft"`, stranica je `noindex` i prazna.** Vraćam se na ovo u §9 jer utiče na homepage.
- `/interaction-demo/*`, `/social-exports/*`, `/preview/*` — interni dev/demo, ne javni sadržaj.
- `/portal/*` — B2B portal, van scope-a.

---

## 2. HOMEPAGE

### 2.1 Mapa blokova

| Sekcija | Funkcija | Trenutni sadržaj | Status | Šta nedostaje |
| ------- | -------- | ---------------- | ------ | ------------- |
| Hero | Glavni ulaz + locator kartica | `/images/home/hero-{dark,light}.png`, **1672×941 PNG, 1.8 MB** | `NEEDS BETTER ASSET` | Rezolucija premala za full-bleed (na 2560px ekranu se skalira ~1.53×). PNG umesto WebP → 1.8 MB na kritičnoj putanji. Treba isti kadar u ≥2560×1440 WebP |
| Kategorije proizvoda | Ulaz u katalog | 12 SVG ikonica u `/icons/categories/` | `FINAL` | — |
| Brand rail | Poverenje | 7 SVG logotipa, svi postoje | `FINAL` | — |
| Partnerska mreža | Locator + Leaflet mapa | Podaci iz `partner-stores.ts` | `FINAL` | — |
| Paint Takeover | Umetnički scroll blok | `/art/paint-takeover/paint-takeover-hero-strokes-final.svg` | `FINAL` | Autorska grafika, radi svoj posao |
| Tehnička podrška | Podrška + mikseri boja | `/products/carsystem/carsystem-finish-serija.png` (660×662) | `NEEDS BETTER ASSET` | **Semantički promašaj.** Naslov govori o savetu, nijansiranju i mikserima boja — a slika je packshot brusnog programa. Treba fotografija miksera/laboratorije. Uz to, 660px se prikazuje na 38vw (~730px na 1920) → blago razvučeno |
| Edukacija i znanje | 5 "članaka" | Tekst + **"4 min", "5 min", "7 min"** vreme čitanja | `PLACEHOLDER` | **Ovo je fake sadržaj.** 5 naslova sa vremenom čitanja koji ne vode na članke nego na `/kontakt?tema=tehnicka-podrska`. Članci ne postoje (`/vodici` ima 3 draft vodiča, nijedan objavljen) |
| Kontakt / centrala | Adresa + mapa | `CompanyLocationMap` | `GOOD ENOUGH` | Nema fotografije objekta; blok je funkcionalan i bez nje |
| Final CTA | Završni poziv | **`/images/home/hero-dark.png` — ISTI fajl kao hero** | `NEEDS BETTER ASSET` | Isti kadar dvaput na jednoj stranici, na vrhu i na dnu. Vizuelno osiromašuje |

### 2.2 Ponavljanje asseta

`/images/home/hero-dark.png` se koristi **2×** (hero + final CTA). Na stranici koja inače ima svega 2 fotografska asseta ukupno, to je 50% ponavljanja. Treba zaseban kadar za final CTA.

### 2.3 Homepage COPY GAP

- **Edukacija blok:** ili povezati na stvarne objavljene vodiče (3 postoje kao draft — treba ih dovršiti i expert-verifikovati), ili ukloniti vremena čitanja koja impliciraju postojanje članka. Trenutno stranica obećava sadržaj koji ne postoji.
- **Tehnička podrška blok:** copy je dobar, ne dirati. Problem je isključivo slika.

---

## 3. R-M

**Najjača stranica u projektu.** Jedina sa kompletnim setom kampanjskih vizuala.

### 3.1 Mapa blokova

| Sekcija | Funkcija | Trenutni sadržaj | Status | Šta nedostaje |
| ------- | -------- | ---------------- | ------ | ------------- |
| Campaign hero (4 slajda) | Rotirajući brand hero | 4× desktop **1600×900** + 4× mobile **960×720** WebP | `GOOD ENOUGH` | Svi postoje i tematski su tačni. 1600px je skroman za full-bleed na 2K/4K — ako postoji originalni R-M master, uzeti ga |
| Quick access rail | Navigacija u katalog | Tekstualni linkovi | `FINAL` | — |
| Proces (kompletan R-M tok) | Faze rada | Tekst + brojači proizvoda | `FINAL` | — |
| Product system gallery | Sistemi kroz proizvode | 59 packshotova | `FINAL` | — |
| **AGILIS feature** | Ključni sistem | `rm-agilis-editorial.webp` 1400×900 + 4 packshota | `GOOD ENOUGH` | Editorial slika je prava i dobra. Ali grid puni prazna mesta "tehničkim slotovima" — vidi 3.2 |
| **Refinity** | Digitalni tok | `rm-refinity-editorial.webp` **1200×1200** | `FINAL` | — |
| Serije (Pioneer/Advance/Element) | Pozicioniranje | Tekst | `FINAL` | — |
| **Color systems mozaik** | 5 sistema boja | Packshotovi + `Procesna grupa` fallback | `MISSING PRODUCT` | DIAMONT ima **samo 1 proizvod** za 4 slota |
| **Compatible brands marquee** | "R-M Color Coverage" | **44 imena marki automobila — ALI NIJEDAN LOGO** | `MISSING IMAGE` | `rmCompatibleBrands` mapira samo `{alt, id, name}`, `brand.logo` je uvek undefined → svih 44 renderuju kao **tekstualni box**. Dvoredni marquee od 88 sivih tekstualnih pravougaonika |
| Product families | Porodice | Packshotovi | `FINAL` | — |
| eSense editorial | Održivost | `rm-esense-editorial.webp` 1500×900 | `FINAL` | — |
| Emil Frey partnership | Racing proof | `rm-emil-frey-partnership.webp` 1500×900 | `FINAL` | — |
| Final CTA | Poziv | Tekst | `FINAL` | — |

### 3.2 Samopriznati placeholder

`RmBrandPage.tsx:242-244` sadrži copy koji je i sam priznanje da blok nije gotov:

> "Potvrđene fotografije prikazujemo iz kataloga, a ostale komponente ostaju jasni tehnički slotovi do odobrenja finalnih asseta."

To je poštena privremena formulacija, ali **ne sme ostati u produkciji.** Rešenje nije nova slika — AGILIS ima 7 packshotova u `/images/brands/rm/products/agilis/`, a grid traži 4. Slotovi se pale samo kada `productSlugs` ne pogodi zapis. Treba proveriti mapiranje slugova, ne fotografisati.

### 3.3 R-M product coverage

| Faza/kategorija | Šta imamo | Dovoljno | Šta nedostaje |
| --------------- | --------- | -------- | ------------- |
| Pioneer serija | 21 packshot | DA | — |
| Advance serija | 11 | DA | — |
| Onyx HD | 8 | DA | — |
| Element | 7 | DA | — |
| Agilis | 7 | DA | — |
| Graphite (GHD) | 5 | DA | — |
| **DIAMONT** | **1** (`rm-diamont-bazna-boja.jpg`, 724×724) | **NE** | Dizajn traži 4 slota: bazna boja, bezbojni lak, učvršćivač, razređivač. Imamo samo baznu. `PROVERITI LOKALNU DOSTUPNOST` za DIAMONT clearcoat + hardener + thinner |

**Ukupno R-M: 64 proizvoda, 63 sa pravom slikom, 1 placeholder.** Dokumentacija: 59 foldera sa TDS + Product Information PDF-ovima. Najbolje pokriven brend.

### 3.4 R-M dokumenti

| Tip | Postoji lokalno | Linkovano | Status |
| --- | --------------- | --------- | ------ |
| TDS | DA, 59 proizvoda | DA, na product stranicama | `FINAL` |
| Product Information | DA | DA | `FINAL` |
| SDS | **NE** | NE | `MISSING DOCUMENT` |
| Color chart | NE | NE | `MISSING DOCUMENT` — Refinity blok priča o formulama, ali nema nijednog color asseta |

---

## 4. BASLAC

**Stranica je tehnički kompletna i sadržajno ozbiljna, ali nema nijednu sliku.**

### 4.1 Mapa blokova

| Sekcija | Funkcija | Trenutni sadržaj | Status | Šta nedostaje |
| ------- | -------- | ---------------- | ------ | ------------- |
| Hero 1 — sistem | Brand ulaz | `IMAGE SLOT` box | `MISSING IMAGE` | `baslac-system-{desktop,mobile}.webp` |
| Hero 2 — 45 Line | Vodeni sistem | `IMAGE SLOT` box | `MISSING IMAGE` | `baslac-45-line-{desktop,mobile}.webp` |
| Hero 3 — color tools | Koloristika | `IMAGE SLOT` box | `MISSING IMAGE` | `baslac-color-tools-{desktop,mobile}.webp` |
| Hero 4 — fast process | Sušenje | `IMAGE SLOT` box | `MISSING IMAGE` | `baslac-fast-process-{desktop,mobile}.webp` |
| Brand position | Pozicioniranje | Tekst + 4 stavke | `FINAL` | Copy je dobar |
| **Repair rhythm** | Glavni proces (`priority: highest`) | `IMAGE SLOT` box | `MISSING IMAGE` | `baslac-repair-rhythm-{desktop,mobile}.webp` |
| Sistemske linije | 4 puta kroz sistem | Tekst | `FINAL` | — |
| **45 Line feature** | Glavni vodeni sistem | `IMAGE SLOT` box | `MISSING IMAGE` + `MISSING COPY` | Copy doslovno kaže *"Ovaj pregled rezerviše mesto za stvarni mixing sistem"* — to je placeholder tekst |
| Proces navigator | 8 faza | Interaktivno, tekst | `FINAL` | — |
| **Bezbojni lakovi** | Range | `IMAGE SLOT` box | `MISSING IMAGE` | `baslac-clearcoat-range.webp` |
| **Prajmeri** | 5 funkcija | `IMAGE SLOT` box | `MISSING IMAGE` | `baslac-primer-process.webp` |
| **Koloristika** | Digitalni tok | `IMAGE SLOT` box | `MISSING IMAGE` | `baslac-color-workflow.webp` |
| **Komercijalna vozila** | CV program | `IMAGE SLOT` box | `MISSING IMAGE` + `MISSING COPY` | Copy: *"Ovaj blok rezerviše jasan prostor za stvarnu primenu na kamionu"* — placeholder tekst |
| Podrška | 3 resursa | Tekst + link na `techinfo.baslac.com` | `FINAL` | Link je stvaran i radi |
| **Katalog preview** | 4 proizvoda | **Samo 4 proizvoda ukupno** | `MISSING PRODUCT` | Grid traži 4, imamo tačno 4 — nula rezerve |
| Final CTA | Poziv | Tekst | `FINAL` | — |

### 4.2 Ponovljeni / pogrešan asset — POTVRĐENA GREŠKA

MD5 provera je pokazala:

```
ee80e16608b277b9a3db603dc7cf7ef3  public/products/baslac/baslac-35-m214.jpg
ee80e16608b277b9a3db603dc7cf7ef3  public/products/baslac/baslac-60-20-razredjivac.jpg
```

**Ista slika, bajt u bajt, koristi se za dva različita proizvoda** — 35-M214 (hardener) i 60-20 (razređivač). Jedan od ta dva je sigurno pogrešan. `BROKEN`.

### 4.3 baslac product coverage

| Faza/kategorija | Šta imamo | Dovoljno | Šta nedostaje |
| --------------- | --------- | -------- | ------------- |
| Bazne boje (35/45 Line) | 1 (`35-M214` — a i to je verovatno pogrešna slika) | **NE** | Bar 1 potvrđen 45 Line bazni artikal |
| Bezbojni lakovi | **0** | **NE** | Sekcija nabraja 5 clearcoat sistema, nemamo nijedan lokalni zapis |
| Prajmeri / punioci | **0** | **NE** | Sekcija nabraja 5 grupa (20-22, 20-35, 25-30, 27-10, 21-xx), nemamo nijedan |
| Paste / poliranje | 1 (`35-M331`, 1100×1422) | Delimično | — |
| Razređivači | 1 (`60-20` — duplikat slike) | Delimično | Nova fotografija |
| S-serija | 1 (`30-S510`, 808×606) | Delimično | — |

**Ukupno baslac: 4 proizvoda.** Za stranicu koja opisuje 4 sistemske linije, 5 clearcoat sistema i 5 primer grupa, to je najveći product gap u projektu.

### 4.4 baslac dokumenti

| Tip | Postoji lokalno | Linkovano | Status |
| --- | --------------- | --------- | ------ |
| TDS | **DA — 102 PDF-a** u `public/documents/products/baslac/` | Delimično | Imamo 102 dokumenta a samo 4 proizvoda. **Dokumentacija daleko prestiže katalog** |
| Tehnički portal | Eksterno | DA, `techinfo.baslac.com/en/` | `FINAL`, link stvaran |
| SDS | NE | NE | `MISSING DOCUMENT` |

> **Zapažanje:** 102 baslac TDS-a bez odgovarajućih product zapisa je obrnut problem od ostalih brendova. Ovde nedostaju **proizvodi**, ne dokumenti.

---

## 5. C.A.R.FIT

### 5.1 Mapa blokova

| Sekcija | Funkcija | Trenutni sadržaj | Status | Šta nedostaje |
| ------- | -------- | ---------------- | ------ | ------------- |
| Hero | Brand ulaz + 5 markera faze | Dizajnirani grid fallback (`src: null`) | `MISSING IMAGE` | `carfit-hero-workbench`, spec 2400×1600 |
| Task selector | 10 poslova | Interaktivno, tekst | `FINAL` | Najbolji deo stranice |
| Program / workbench | Pregled programa | 8 media slotova, svi `null` | `MISSING IMAGE` | 8 task vizuala |
| Gradacija | Abrazivi | Tekst | `GOOD ENOUGH` | — |
| Porodice | 5 kategorija | 5 media slotova, svi `null` | `MISSING IMAGE` | `carfit-abrasives`, `carfit-putties`, `carfit-masking`, `carfit-clearcoat`, `carfit-polishing` |
| Kategorije | Grid | Tekst | `GOOD ENOUGH` | — |
| **Maskiranje scena** | Application blok | `null` | `MISSING IMAGE` | `carfit-masking-scene`, spec 2000×1100 |
| **Finish scena** | Application blok | `null` | `MISSING IMAGE` | `carfit-finish-scene`, spec 2000×1100 |
| Abrasive detail | Macro | `null` | `MISSING IMAGE` | `carfit-abrasive-disc`, spec 1400×1400 |
| **Proizvodi** | Katalog showcase | **2 proizvoda, 1 sa slikom** | `MISSING PRODUCT` | Layout je "lead + prateći", `data-count` do 3. Sa 2 artikla (od kojih 1 bez slike) kompozicija ne funkcioniše |
| Dokumentacija | 4 tipa dokumenta | **Samo tekstualne kartice, bez ijednog linka** | `MISSING DOCUMENT` | Nabraja TDS/SDS/uputstvo/podršku ali ne linkuje ni na jedan fajl |
| Brand story | Priča | Tekst | `FINAL` | — |
| Final CTA | Poziv | Tekst | `FINAL` | — |

### 5.2 Mešanje Carsystem / Carfit — PROVERENO, ČISTO

Posebno sam proverio ovo jer si tražio. **Nema mešanja.** Jedina Carfit slika je `carfit-maskirna-folija-4x5m.jpg` (1000×1000), stvarno Carfit artikal. Carfit stranica ne referencira nijedan Carsystem asset. Čisto razdvojeno.

### 5.3 Carfit product coverage

| Faza/kategorija | Šta imamo | Dovoljno | Šta nedostaje |
| --------------- | --------- | -------- | ------------- |
| Maskiranje | 1 (maskirna folija) | Delimično | — |
| Abrazivi | **0** | **NE** | Dizajn ima celu porodicu + macro detalj |
| Kitovi | **0** | **NE** | `carfit-putties` slot postoji |
| Bezbojni lakovi | **0** | **NE** | `carfit-clearcoat` slot postoji |
| Poliranje | **0** | **NE** | `carfit-polishing` slot postoji |
| Prajmeri / spray | **0** | **NE** | — |

**Ukupno Carfit: 2 proizvoda u lokalnom katalogu.** Stranica opisuje 10 poslova i 5 porodica.

> **Ali:** `assets/manufacturer/carfit/images` ima **123 packshota** i `assets/manufacturer/carfit/documents` ima **300 TDS PDF-ova** (DE+EN). Imena su prepoznatljiva (`carfitrepair-2k-hs-perfekt-klarlack.jpg`, `carfitrepair-abdeckklebeband-*.jpg`). **Carfit product/document gap je gotovo u potpunosti već prikupljen — nedostaje odluka o objavljivanju i lokalna potvrda da te artikle stvarno držimo.**

---

## 6. COSMOS LAC

Ovde je razlika koju si tražio najoštrija.

### 6.1 Mapa blokova

| Sekcija | Funkcija | Trenutni sadržaj | Status | Šta nedostaje |
| ------- | -------- | ---------------- | ------ | ------------- |
| Hero (arc od 6 limenki) | Brand ulaz | 6 pravih packshotova, **800×800, can alpha box ~201×628** | `NEEDS BETTER ASSET` | Vodeća limenka se u CSS-u kapira da upscale ostane ispod ~1.4×. To znači da je hero **ograničen rezolucijom**, ne dizajnom. Za pravi impact treba ≥2000px verzija bar za 1-2 vodeće limenke |
| Family rail (pinned) | Sve istaknute linije | Packshotovi | `FINAL` | Odlično radi |
| Band A | Prelaz | Tipografija | `FINAL` | — |
| Range / siluete | Obim programa | Packshot siluete | `FINAL` | — |
| Band B | Prelaz + inverzija | Tipografija | `FINAL` | — |
| **Application finder** | Izbor po nameni | **Packshotovi proizvoda** | `MISSING IMAGE` | Blok se zove "primena" i nudi Auto / Metal / Drvo / Bicikl / Dekor / Art / Radionica — a prikazuje **limenke**, ne primenu. Ovde application fotografija najviše nedostaje |
| Commerce | 6 kuriranih | Packshotovi | `FINAL` | — |
| Credibility | Zašto kod nas | Tekst | `FINAL` | Kratko i tačno |
| Final CTA | Pronađi prodavnicu | Tekst | `FINAL` | — |

### 6.2 Ključna distinkcija koju si tražio

| | Stanje |
| --- | --- |
| **Nemamo sliku proizvoda** | **Ne postoji.** 742 proizvoda, **742 sa slikom, 0 placeholdera.** Najbolja product image pokrivenost u projektu |
| **Nemamo lifestyle/application asset** | **Potpuno.** Nula application, nula lifestyle, nula ambient, nula brand fotografije. Cela stranica je sagrađena isključivo od packshotova |

Ovo je jedina stranica gde je gap **čisto** lifestyle. Nema šta da se dokupljuje u packshotovima.

### 6.3 Cosmos rezolucija

Svih 400 proverenih published packshotova je **800×800**. U staging folderu `assets/manufacturer/cosmos-lac/images` postoje **3 fajla u 2560×2560** — znači viša rezolucija je bar delimično dostupna kod proizvođača. Vredi tražiti 2560 verziju za hero limenke.

### 6.4 Cosmos duplikati

MD5 je našao 5 parova identičnih fajlova koji se koriste kao različiti proizvodi:

| Slug A | Slug B | Problem |
| ------ | ------ | ------- |
| `flame-blue-fb-3004-transparent-black` | `flame-blue-fb-904-deep-black` | ista slika |
| `flame-blue-fb-3000-transparent-white` | `flame-blue-fb-900-pure-white` | ista slika |
| `flame-orange-fo-901-thick-black` | `flame-orange-fo-904-deep-black` | ista slika |
| `master-mechanic-ral-10-white-matt` | `master-mechanic-ral-10-white-gloss` | **mat i sjaj imaju istu sliku** |
| `master-mechanic-ral-10-black-matt` | `master-mechanic-ral-10-black-gloss` | **mat i sjaj imaju istu sliku** |

Na 742 proizvoda ovo je zanemarljivo (0.7%) i **ne prioritizujem ga** — ali mat/sjaj parovi su suštinski netačni jer je razlika u finišu upravo ono što kupac bira.

### 6.5 Cosmos dokumenti

| Tip | Postoji lokalno | Status |
| --- | --------------- | ------ |
| Color chart | **DA** — `data/cosmos-lac-color-chart.generated.json` (63 KB) | `MISSING DOCUMENT` — podatak postoji ali **stranica ga nigde ne prikazuje**. Za brend čiji je adut boja, to je propuštena prilika |
| TDS | **NE** | `MISSING DOCUMENT` |
| SDS | **NE** | `MISSING DOCUMENT` |

---

## 7. CARSYSTEM

Najdetaljniji audit, kako si tražio — i stranica sa najvećim raskorakom između kvaliteta dizajna i količine sadržaja.

### 7.1 Mapa blokova

| Sekcija | Funkcija | Trenutni sadržaj | Status | Šta nedostaje |
| ------- | -------- | ---------------- | ------ | ------------- |
| **Hero (3 varijante)** | Brand ulaz, prepare/apply/finish | **Placeholder box ×3** | `MISSING IMAGE` | `carsystem-hero-{preparation,painting,finishing}` + 3 mobile = **6 fajlova** |
| Section nav | Navigacija | Tekst | `FINAL` | — |
| **Metrics** | Sistem u brojkama | **`catalog-count` → renderuje "09"** | `MISSING DATA` | Metrika koja se hvali brojem doslovno prikazuje **09 javnih zapisa**. To radi protiv brenda |
| **Process (3 faze)** | Priprema/nanošenje/završetak | **Placeholder box ×3** | `MISSING IMAGE` | `carsystem-process-{preparation,application,finish}` |
| **Workflow story (4 koraka)** | Oštećenje → gotovo | **Placeholder box ×4** | `MISSING IMAGE` | `carsystem-workflow-{damage,prepared,painted,finished}` — **mora biti isti panel istog vozila u 4 faze** |
| **Families (4 porodice)** | Programske celine | Packshotovi 660px | `NEEDS BETTER ASSET` | Vidi 7.3 — teška reciklaža |
| Use cases (8) | Izbor po poslu | Packshotovi | `MISSING PRODUCT` | 8 use case-ova deli **istih 7 slika** |
| Product listing | Katalog | 9 proizvoda, 7 sa slikom | `MISSING PRODUCT` | `carsystem-soft-plus-git` i `carsystem-p23-brusni-diskovi` nemaju sliku |
| Documentation | 6 resursa | 4 linka rade, **`video` nema href** | `MISSING DOCUMENT` | Kartica "Video materijali / U pripremi" renderuje se kao vidljivo onemogućena (`data-disabled`) |
| Final CTA | Poziv | 3 packshota | `NEEDS BETTER ASSET` | Sva 3 su već viđena gore na stranici |

### 7.2 Reprezentativnost 4 porodice

Tražio si da proverim F.23 Ceramic, Multi Green, X-PERT i Finish, ali i da ne insistiram ako lokalni katalog kaže drugačije. **Lokalni katalog kaže drugačije:**

| Porodica u dizajnu | Proizvoda | Ocena |
| ------------------ | --------- | ----- |
| F.23 Ceramic | **1** | Nosi "featured" layout sa jednim artiklom |
| Multi Green | **1** | — |
| 19 serija (P19+F19) | 2 | Najzdravija |
| Finish sistem | 2 (od kojih je 1 opet F.23) | — |
| **X-PERT** | **0** | **Ne postoji u lokalnom katalogu.** Ne predlažem da se dodaje |

Realno: **Carsystem lokalno = abrazivi + kitovi + zaštita.** To je uska ali poštena reprezentacija. Preporuka: ili proširiti katalog (441 staged packshota čeka), ili prilagoditi dizajn stvarnom obimu — ne izmišljati porodice.

### 7.3 Reciklaža asseta — najteža u projektu

Brojanje `productSlugs` u `carsystemBrandData.ts`:

| Slug | Broj upotreba |
| ---- | ------------- |
| `carsystem-f23-brusni-diskovi` | **13×** |
| `carsystem-f19-brusni-diskovi` | **13×** |
| `carsystem-zastitno-odelo` | **10×** |
| `carsystem-p19-brusni-diskovi` | 7× |
| `carsystem-finish-serija` | 6× |
| `carsystem-git-multi-green` | 5× |
| `carsystem-git-elastic-weiss` | 4× |

**Jedna slika brusnog diska pojavljuje se 13 puta na jednoj stranici.** Uz to, tri od četiri diska (F19/F23/P19) izgledaju gotovo identično — okrugli disk sa rupama. Vizuelno stranica deluje kao da prikazuje isti proizvod stalno iznova. **Ovo je najveći razlog zašto Carsystem stranica izgleda nedovršeno, veći od nedostajućih hero slika.**

### 7.4 Carsystem PACKSHOT AUDIT

| Proizvod | Rezolucija | Alpha | Status |
| -------- | ---------- | ----- | ------ |
| `carsystem-f23-brusni-diskovi.png` | 660×650 | DA | `NEEDS HIGHER RES` — koristi se u "featured" layoutu na ~42vw |
| `carsystem-f19-brusni-diskovi.png` | 660×649 | DA | `NEEDS HIGHER RES` |
| `carsystem-p19-brusni-diskovi.png` | 660×650 | DA | `NEEDS HIGHER RES` |
| `carsystem-finish-serija.png` | 660×662 | DA | `NEEDS HIGHER RES` — koristi se i na homepage-u na 38vw |
| `carsystem-git-elastic-weiss.png` | 660×406 | DA | `NEEDS HIGHER RES` |
| **`carsystem-git-multi-green.jpg`** | **600×600** | **NE** | **`NEEDS TRANSPARENT VERSION`** — jedini JPG bez alfe u setu. U kompoziciji gde svi ostali lebde bez pozadine, ovaj ima belu kutiju oko sebe. Najvidljiviji packshot defekt na stranici |
| `carsystem-zastitno-odelo.png` | 660×650 | DA | `NEEDS HIGHER RES` |
| `carsystem-soft-plus-git` | — | — | `NEEDS NEW PACKSHOT` |
| `carsystem-p23-brusni-diskovi` | — | — | `NEEDS NEW PACKSHOT` |

> **Važno upozorenje:** staged `assets/manufacturer/carsystem/images` je proveren — **i on je 660px širine.** Objavljivanje staged materijala **neće** rešiti rezolucijski problem, samo problem broja artikala. Za veće packshotove treba tražiti master fajlove od Vosschemie GmbH.

### 7.5 Carsystem dokumenti

| Tip | Lokalno | Linkovano | Status |
| --- | ------- | --------- | ------ |
| TDS | 6 PDF-ova | DA | `GOOD ENOUGH` — pokriva 6 od 9 proizvoda |
| SDS | NE | "Na upit" | `MISSING DOCUMENT` |
| Uputstva | NE | "Na upit" | `MISSING DOCUMENT` |
| **Video** | NE | **Nema href** | `MISSING DOCUMENT` — jedina vidljivo onemogućena kartica |
| Staged | **506 PDF-ova** u `assets/manufacturer/carsystem/documents` | NE | Čeka odluku o objavljivanju |

---

## 8. MINIMUM / RECOMMENDED / IDEAL PO STRANICI

### HOMEPAGE
- **MINIMUM:** 1 hero u ≥2560×1440 WebP; zameniti packshot u "tehnička podrška" bloku application fotografijom; rešiti fake vremena čitanja u edukaciji.
- **RECOMMENDED:** + zaseban kadar za final CTA (da se hero ne ponavlja).
- **IDEAL:** + fotografija centrale/skladišta u kontakt bloku.
- **Brojevi:** 3 nove hero/application slike · 0 novih packshotova · 1 packshot za zamenu · 0 proizvoda · 1 copy gap · 0 dokumenata.

### R-M
- **MINIMUM:** 44 logotipa marki automobila (ili redizajn tog bloka); popraviti mapiranje AGILIS slugova da nestanu "tehnički slotovi"; ukloniti samopriznajući copy.
- **RECOMMENDED:** + 3 DIAMONT proizvoda; hero master fajlovi u ≥2560px.
- **IDEAL:** + SDS set, + color chart asset za Refinity.
- **Brojevi:** 0 novih hero slika (svi postoje) · 44 logotipa · 0 cleanup · 3 proizvoda · 1 copy gap · 2 tipa dokumenta.

### BASLAC
- **MINIMUM:** 4 hero (desktop+mobile = 8 fajlova) + repair rhythm (2 fajla) = **10 fajlova**; popraviti duplikat 35-M214 / 60-20.
- **RECOMMENDED:** + preostalih 5 sekcijskih slika; + bar 4 nova proizvoda (clearcoat, primer).
- **IDEAL:** + pun katalog koji odgovara 102 postojeća TDS-a.
- **Brojevi:** **15 novih slika** · 4+ novih packshotova · **1 kritični fix** · 8+ proizvoda · 2 copy gapa · 1 dokument.

### C.A.R.FIT
- **MINIMUM:** hero + 2 application scene (masking, finish) = **3 slike**; objaviti bar 6-8 packshotova iz staginga.
- **RECOMMENDED:** + 5 slika porodica + macro detalj; + linkovati TDS iz 300 staged dokumenata.
- **IDEAL:** svih 17 slotova + 123 staged packshota.
- **Brojevi:** **3-17 novih slika** · 0 novih (123 čekaju) · 0 cleanup · 6-8 proizvoda potvrditi · 0 copy gapova · dokumenti čekaju objavljivanje.

### COSMOS LAC
- **MINIMUM:** 1 application fotografija za Application finder; 2560px verzija vodeće hero limenke.
- **RECOMMENDED:** + 3 application kadra (auto / drvo / bicikl); + prikazati postojeći color chart.
- **IDEAL:** + 7 kadrova, po jedan za svaku namenu u finderu.
- **Brojevi:** **1-7 novih slika** · 0 novih packshotova · 1-2 hi-res + 2 mat/sjaj fix · 0 proizvoda · 0 copy gapova · 1 (color chart, već postoji kao podatak).

### CARSYSTEM
- **MINIMUM:** hero preparation (desktop+mobile) + 4 workflow koraka = **6 slika**; transparentni Multi Green.
- **RECOMMENDED:** + 2 preostala hero + 3 process = **11 slika**; + 8-10 proizvoda iz staginga da se prekine 13× reciklaža.
- **IDEAL:** + hi-res packshotovi od Vosschemie; + video resurs.
- **Brojevi:** **13 novih slika** · 2 nova packshota · **7 za cleanup/hi-res** · 8-10 proizvoda · 0 copy gapova · 3 tipa dokumenta.

**UKUPNO PROJEKAT:** ~35-56 novih slika (od čega **28 blokirajućih**), ~10 cleanup packshotova, ~25 proizvoda za potvrdu, 4 copy gapa.

---

## 9. MASTER ASSET LIST

Prioritet: `P0 — BLOCKING` · `P1 — IMPORTANT` · `P2 — POLISH`

| ID | Page | Section | Asset | Exact content | Type | Ratio | Resolution | Mobile | Priority | Status |
| -- | ---- | ------- | ----- | ------------- | ---- | ----- | ---------- | ------ | -------- | ------ |
| A01 | Carsystem | Hero | `carsystem-hero-preparation.webp` | vidi §10 | HERO/BRAND | 3:2 | 1800×1200 min / 2600×1734 ideal | SEPARATE MOBILE IMAGE REQUIRED (900×1125) | P0 | NEEDS NEW ASSET |
| A02 | Carsystem | Workflow | `carsystem-workflow-damage.webp` | vidi §10 | WORKFLOW | 4:3 | 1200×900 / 1800×1350 | SAME ASSET OK | P0 | NEEDS NEW ASSET |
| A03 | Carsystem | Workflow | `carsystem-workflow-prepared.webp` | isti panel, posle pripreme | WORKFLOW | 4:3 | 1200×900 | SAME ASSET OK | P0 | NEEDS NEW ASSET |
| A04 | Carsystem | Workflow | `carsystem-workflow-painted.webp` | isti panel, posle boje | WORKFLOW | 4:3 | 1200×900 | SAME ASSET OK | P0 | NEEDS NEW ASSET |
| A05 | Carsystem | Workflow | `carsystem-workflow-finished.webp` | isti panel, završen | WORKFLOW | 4:3 | 1200×900 | SAME ASSET OK | P0 | NEEDS NEW ASSET |
| A06 | baslac | Hero 1 | `baslac-system-desktop.webp` | vidi §10 | HERO/BRAND | 40:27 | 1600×1080 / 2400×1620 | SEPARATE MOBILE IMAGE REQUIRED (900×1080) | P0 | NEEDS NEW ASSET |
| A07 | baslac | Repair rhythm | `baslac-repair-rhythm-desktop.webp` | vidi §10 | WORKFLOW | 8:5 | 1600×1000 | SEPARATE MOBILE IMAGE REQUIRED (900×1125) | P0 | NEEDS NEW ASSET |
| A08 | C.A.R.FIT | Hero | `carfit-hero-workbench` | vidi §10 | HERO/BRAND | 3:2 | 2400×1600 | SEPARATE MOBILE CROP | P0 | NEEDS NEW ASSET |
| A09 | Carsystem | Families | `carsystem-git-multi-green` transparent | isti proizvod, PNG sa alfom | PRODUCT PACKSHOT | 1:1 | 1200×1200 | SAME ASSET OK | P0 | NEEDS REPLACEMENT |
| A10 | baslac | Katalog | `baslac-60-20-razredjivac` | prava fotografija 60-20 | PRODUCT PACKSHOT | 1:1 | 1200×1200 | SAME ASSET OK | P0 | NEEDS REPLACEMENT |
| A11 | Homepage | Hero | `home-hero-{dark,light}` | isti kadar, veći | HERO/BRAND | 16:9 | 2560×1440 WebP | SAME ASSET OK | P1 | NEEDS REPLACEMENT |
| A12 | Homepage | Podrška | `carsystem-mixing-support` | vidi §10 | APPLICATION | 1:1 | 1400×1400 | SAME ASSET OK | P1 | NEEDS NEW ASSET |
| A13 | Homepage | Final CTA | `home-final-cta` | zaseban kadar | AMBIENT | 16:9 | 2560×1440 | SAME ASSET OK | P1 | NEEDS NEW ASSET |
| A14 | R-M | Compatible brands | 44 logotipa marki | monohromatski, jednoredni | DOCUMENT/GRAPHIC | var | SVG | SAME ASSET OK | P1 | NEEDS NEW ASSET |
| A15 | Cosmos | App finder | `cosmos-application-auto` | vidi §10 | APPLICATION | 16:9 | 2000×1125 | SEPARATE MOBILE CROP | P1 | NEEDS NEW ASSET |
| A16 | Cosmos | Hero | hi-res vodeća limenka | 2560×2560 verzija | PRODUCT PACKSHOT | 1:1 | 2560×2560 | SAME ASSET OK | P1 | NEEDS REPLACEMENT |
| A17 | C.A.R.FIT | Masking scena | `carfit-masking-scene` | vidi §10 | APPLICATION | 20:11 | 2000×1100 | SEPARATE MOBILE CROP | P1 | NEEDS NEW ASSET |
| A18 | C.A.R.FIT | Finish scena | `carfit-finish-scene` | vidi §10 | APPLICATION | 20:11 | 2000×1100 | SEPARATE MOBILE CROP | P1 | NEEDS NEW ASSET |
| A19 | Carsystem | Hero | `carsystem-hero-painting` + mobile | maskiranje i lakiranje u kabini | HERO/BRAND | 3:2 | 1800×1200 | SEPARATE MOBILE IMAGE REQUIRED | P1 | NEEDS NEW ASSET |
| A20 | Carsystem | Hero | `carsystem-hero-finishing` + mobile | poliranje i kontrola sjaja | HERO/BRAND | 3:2 | 1800×1200 | SEPARATE MOBILE IMAGE REQUIRED | P1 | NEEDS NEW ASSET |
| A21 | Carsystem | Process ×3 | `carsystem-process-{preparation,application,finish}` | 3 procesna kadra | WORKFLOW | 32:21 | 1600×1050 | SAME ASSET OK | P1 | NEEDS NEW ASSET |
| A22 | baslac | Hero 2-4 | `baslac-{45-line,color-tools,fast-process}` ×2 | 6 fajlova | HERO/BRAND | 40:27 | 1600×1080 | SEPARATE MOBILE IMAGE REQUIRED | P1 | NEEDS NEW ASSET |
| A23 | baslac | 45 Line / clearcoat / primer / color / CV | 5 sekcijskih slika | vidi §10 | APPLICATION / PRODUCT FAMILY | var | 1400-1600px | SAME ASSET OK | P2 | NEEDS NEW ASSET |
| A24 | C.A.R.FIT | Porodice | 5 packshot kompozicija | abrazivi, kitovi, maskiranje, lak, poliranje | PRODUCT FAMILY | 1:1 / 16:9 | 1200-1600px | SAME ASSET OK | P2 | USE EXISTING (staging) |
| A25 | C.A.R.FIT | Abrasive detail | `carfit-abrasive-disc` | macro abrazivne površine | DETAIL/MACRO | 1:1 | 1400×1400 | SAME ASSET OK | P2 | NEEDS NEW ASSET |
| A26 | Carsystem | Packshots | 7× hi-res zamena | isti proizvodi, ≥1200px | PRODUCT PACKSHOT | 1:1 | 1200×1200 | SAME ASSET OK | P2 | NEEDS REPLACEMENT |
| A27 | Cosmos | App finder | `cosmos-application-{drvo,bicikl}` | 2 dodatna kadra | APPLICATION | 16:9 | 2000×1125 | SEPARATE MOBILE CROP | P2 | NEEDS NEW ASSET |
| A28 | R-M | Hero ×4 | master fajlovi u 2560px | isti kadrovi | HERO/BRAND | 16:9 | 2560×1440 | SEPARATE (postoji) | P2 | NEEDS REPLACEMENT |

> **Deljeni asseti:** A02–A05 (workflow serija) MORAJU biti isti panel istog vozila — to je jedan foto-termin, ne četiri. A01 i A21 mogu doći sa istog snimanja, ali **ne smeju biti isti kadar**.

---

## 10. TAČNI BRIEFOVI ZA KLJUČNE SLIKE

Dajem pun brief samo za P0 i najvažnije P1. Ostali prate isti obrazac.

---

### ASSET NAME
`carsystem-hero-preparation.webp` + `carsystem-hero-preparation-mobile.webp`

**PAGE:** Carsystem brand stranica
**SECTION:** Hero, varijanta `prepare`

**PURPOSE:** Prvi kadar koji definiše Carsystem kao program za pripremu. Trenutno je placeholder box — ovo je najvidljivija rupa na stranici.

**EXACT CONTENT:** Profesionalni autolakirer brusi ekscentričnom brusilicom prednji blatobran tamnog vozila u fazi pripreme. Površina je delimično obrušena — vidi se prelaz između originalnog laka i pripremljene zone, sa jasnim tragom brušenja. Ruke i podlaktice u radnom odelu su u kadru, lice nije potrebno. Brusni disk je vidljiv u kontaktu sa površinom. U pozadini, blago van fokusa, radni sto sa kutijom brusnih diskova — može se nazirati Carsystem pakovanje, ali **ne sme delovati namešteno ili kao reklama**.

**COMPOSITION:**
- Glavni subjekt (ruka + brusilica + panel) u **desnoj polovini kadra**, od ~50% do ~90% širine.
- Negative space: **leva trećina** ostaje mirna, tamna, bez detalja — tu ide naslov i eyebrow.
- Desktop crop: 3:2 landscape, horizont brušene površine u donjoj trećini.
- Mobile crop: portret 4:5, subjekt centriran u donjoj polovini, gornja polovina ostaje prazna za copy.

**BRAND VISIBILITY:** Može diskretno da se vidi (pakovanje u pozadini, van fokusa). Ne sme biti dominantno.

**FORMAT:** landscape · 3:2 · min 1800×1200 · ideal 2600×1734 · WebP (fotografija, nema transparentnosti)

**MOBILE:** `SEPARATE MOBILE IMAGE REQUIRED` — 900×1125, portret. Dizajn eksplicitno traži zaseban 4:5 fajl.

**PRIORITY:** P0

**TYPE:** HERO / BRAND

---

### ASSET NAME
`carsystem-workflow-damage / -prepared / -painted / -finished` (serija od 4)

**PAGE:** Carsystem
**SECTION:** Workflow story

**PURPOSE:** Blok priča priču "od oštećenja do gotovog panela". Trenutno su 4 placeholder kutije jedna do druge — najprazniji deo stranice.

**EXACT CONTENT:** **Kritično: sva četiri kadra moraju biti ISTI PANEL ISTOG VOZILA, iz iste pozicije kamere, u četiri faze.** To je jedan foto-termin sa fiksiranim stativom.

1. **damage** — zadnja leva vrata tamnog vozila sa jasnom udubinom i oštećenim lakom. Bez alata u kadru.
2. **prepared** — isti panel, obrušen i kitovan, vidi se sivo-zelena zona gita i prelaz brušenja.
3. **painted** — isti panel, sa nanetim slojem, površina još mat/vlažna, maskirna traka i dalje na ivicama.
4. **finished** — isti panel, skinuta maska, pun sjaj, čist odsjaj svetla radionice u laku.

**COMPOSITION:**
- Panel popunjava **centralnih 70%** kadra u sva 4 kadra, identično uokviren.
- Negative space: uske margine gore i dole, bez copy overlay-a (tekst ide ispod slike).
- Desktop crop: 4:3.
- Mobile crop: isti, kartice se slažu vertikalno.

**BRAND VISIBILITY:** Ne treba da bude vidljiv. Ovo je dokaz procesa, ne reklama.

**FORMAT:** landscape · 4:3 · min 1200×900 · ideal 1800×1350 · WebP

**MOBILE:** `SAME ASSET OK`

**PRIORITY:** P0

**TYPE:** WORKFLOW

---

### ASSET NAME
`baslac-system-desktop.webp` + `baslac-system-mobile.webp`

**PAGE:** baslac
**SECTION:** Hero 1

**PURPOSE:** Prvi od 4 hero banera. Trenutno vidljiv sivi box sa tekstom `IMAGE SLOT baslac-system-desktop.webp` — najgori vizuelni defekt u celom projektu jer je iznad preloma.

**EXACT CONTENT:** Organizovana kompozicija baslac sistema na tamnoj radnoj površini: 5-7 limenki i kanti različitih veličina (bazna boja, bezbojni lak, prajmer, učvršćivač, razređivač) raspoređenih u blagom luku ili dijagonali, kao sistem a ne kao gomila. Etikete okrenute ka kameri i čitljive. Blaga refleksija na površini ispod. **Bez ljudi, bez vozila** — ovo je hero o sistemu, ne o radu.

**COMPOSITION:**
- Proizvodi u **donjoj desnoj dve trećine** kadra.
- Negative space: **gornja leva trećina** tamna i prazna, za naslov.
- Desktop crop: 40:27, proizvodi ne dodiruju donju ivicu.
- Mobile crop: 5:6 portret, proizvodi u donjoj polovini, gornja polovina prazna.

**BRAND VISIBILITY:** **Mora da se vidi** — baslac etikete su glavni sadržaj kadra.

**FORMAT:** landscape · 40:27 · min 1600×1080 · ideal 2400×1620 · WebP

**MOBILE:** `SEPARATE MOBILE IMAGE REQUIRED` — 900×1080, drugačija kompozicija (portret), ne crop.

**PRIORITY:** P0

**TYPE:** PRODUCT FAMILY (funkcioniše kao hero)

---

### ASSET NAME
`baslac-repair-rhythm-desktop.webp` + mobile

**PAGE:** baslac
**SECTION:** Repair rhythm — u kodu označen `priority: "highest"`

**PURPOSE:** Glavni procesni blok stranice, najviši prioritet u data modelu, trenutno prazan.

**EXACT CONTENT:** Široki kadar profesionalne lakirnice u kome se istovremeno vide dve-tri faze rada na različitim vozilima: u prednjem planu maskirano vozilo spremno za lakiranje, u srednjem planu lakirer u zaštitnom odelu, u dubini otvorena kabina sa osvetljenjem. Hladno neutralno radioničko svetlo. Prostor treba da deluje uređeno i profesionalno, **ne pretrpano**.

**COMPOSITION:**
- Glavni subjekt raspoređen po **širini kadra** — ovo je panoramski, kontekstualni kadar.
- Negative space: gornja četvrtina (plafon/osvetljenje) ostaje mirna za eventualni overlay.
- Desktop crop: 8:5.
- Mobile crop: 4:5 portret, fokus na centralnog lakirera.

**BRAND VISIBILITY:** Ne treba da bude vidljiv. Ovo je kadar o procesu.

**FORMAT:** landscape · 8:5 · min 1600×1000 · ideal 2400×1500 · WebP

**MOBILE:** `SEPARATE MOBILE IMAGE REQUIRED` — 900×1125.

**PRIORITY:** P0

**TYPE:** AMBIENT / WORKFLOW

---

### ASSET NAME
`carfit-hero-workbench`

**PAGE:** C.A.R.FIT
**SECTION:** Hero

**PURPOSE:** Jedini hero stranice; podržava 5 markera faze (Priprema / Maskiranje / Reparacija / Lakiranje / Finish) koji se pozicioniraju preko slike.

**EXACT CONTENT:** Pogled odozgo pod blagim uglom (~30°) na uredan radni sto u lakirerskoj radionici. Na stolu su raspoređeni Car Fit materijali koji odgovaraju s pet faza: brusni diskovi u lepezi, kutija kita sa špahtlom, rolna maskirne trake i folije, limenka bezbojnog laka, polirni pad. **Raspored mora biti prozračan, sa vidljivim razmacima** — markeri se pozicioniraju preko slike i ne smeju pasti na zauzeto mesto. Radna površina je siva/betonska ili čelična, ne drvena.

**COMPOSITION:**
- Predmeti raspoređeni po **celoj širini**, ali sa jasnim "praznim" zonama između grupa.
- Negative space: **leva trećina** slobodnija, jer tamo ide naslov i wordmark.
- Desktop crop: 3:2.
- Mobile crop: kvadrat ili 4:5, uže kadriranje na 3 centralne grupe.

**BRAND VISIBILITY:** **Mora da se vidi** — Car Fit pakovanja su sadržaj kadra.

**FORMAT:** landscape · 3:2 · min 2000×1333 · ideal 2400×1600 · WebP

**MOBILE:** `SEPARATE MOBILE CROP`

**PRIORITY:** P0

**TYPE:** PRODUCT FAMILY / HERO

---

### ASSET NAME
`cosmos-application-auto`

**PAGE:** Cosmos LAC
**SECTION:** Application finder

**PURPOSE:** Blok nudi izbor po nameni (Auto / Metal / Drvo / Bicikl / Dekor / Art / Radionica) ali prikazuje **limenke**. Za brend sa 742 packshota i nula application kadrova, ovo je jedina slika koja stvarno menja utisak.

**EXACT CONTENT:** Ruka u nitrilnoj rukavici drži Cosmos Lac sprej limenku i raspršuje boju na metalnu površinu — vidi se **fini oblak spreja u letu**, uhvaćen tako da se raspršivanje jasno čita. Površina je auto felna ili metalni panel. Limenka je u fokusu i etiketa je čitljiva. Pozadina tamna i neutralna, van fokusa.

**COMPOSITION:**
- Ruka i limenka ulaze **iz desne ivice**, sprej putuje ulevo.
- Negative space: **leva polovina** je oblak spreja i tamna pozadina — tu može ići copy.
- Desktop crop: 16:9.
- Mobile crop: 4:5, uže na limenku i mlaz.

**BRAND VISIBILITY:** **Mora da se vidi** — Cosmos Lac etiketa u fokusu.

**FORMAT:** landscape · 16:9 · min 2000×1125 · WebP

**MOBILE:** `SEPARATE MOBILE CROP`

**PRIORITY:** P1

**TYPE:** APPLICATION

---

### ASSET NAME
`carsystem-mixing-support` (homepage)

**PAGE:** Homepage
**SECTION:** Tehnička podrška i mikseri boja

**PURPOSE:** Blok govori o nijansiranju po formuli i savetovanju, a trenutno prikazuje packshot brusnog programa. Semantički promašaj.

**EXACT CONTENT:** Mikser boja u radu: vaga sa posudom na kojoj se odmerava komponenta boje, iza nje polica mixing banka sa nizom limenki toner-a sa čitljivim šiframa. Ruka doziranja u kadru, lice nije potrebno. Osvetljenje neutralno, tipično za prostoriju za mešanje boja.

**COMPOSITION:**
- Vaga i posuda u **donjoj polovini**, mixing bank kao dubina iza.
- Negative space: nije kritičan, blok je `figure` pored teksta.
- Desktop crop: kvadrat (zamenjuje 660×662 packshot).
- Mobile crop: isti.

**BRAND VISIBILITY:** Može diskretno (R-M ili baslac toner limenke u pozadini).

**FORMAT:** square · 1:1 · min 1400×1400 · WebP

**MOBILE:** `SAME ASSET OK`

**PRIORITY:** P1

**TYPE:** APPLICATION

---

## 11. MASTER PRODUCT GAP LIST

| ID | Brand/Page | Product or product type | Category | Why needed | Current state | Priority |
| -- | ---------- | ----------------------- | -------- | ---------- | ------------- | -------- |
| P01 | baslac | Bezbojni lak (bilo koji od 5 opisanih sistema) | Clearcoat | Cela sekcija opisuje 5 sistema, katalog ima 0 | `MISSING LOCALLY` / `PROVERITI LOKALNU DOSTUPNOST` | P0 |
| P02 | baslac | Primer-filler (20-22 ili 20-35) | Primer | Sekcija opisuje 5 grupa, katalog ima 0 | `PROVERITI LOKALNU DOSTUPNOST` | P0 |
| P03 | baslac | 45 Line bazna boja | Basecoat | 45 Line je "glavni vodeni sistem" stranice, nema nijedan artikal | `PROVERITI LOKALNU DOSTUPNOST` | P0 |
| P04 | baslac | `baslac-60-20-razredjivac` | Thinner | Postoji zapis, ali **slika je duplikat 35-M214** | `NEEDS IMAGE` | P0 |
| P05 | Carsystem | `carsystem-soft-plus-git` | Kit | U `carsystemProductOrder`, renderuje placeholder | `NEEDS IMAGE` | P0 |
| P06 | Carsystem | `carsystem-p23-brusni-diskovi` | Abraziv | U `carsystemProductOrder`, renderuje placeholder | `NEEDS IMAGE` | P0 |
| P07 | Carsystem | `carsystem-git-multi-green` | Kit | Postoji, ali JPG bez alfe 600×600 | `NEEDS IMAGE` (transparentna verzija) | P0 |
| P08 | C.A.R.FIT | Abrazivni program (disk/vlies) | Abraziv | Porodica + macro slot postoje, katalog ima 0 | `PROVERITI LOKALNU DOSTUPNOST` — **123 packshota u stagingu** | P1 |
| P09 | C.A.R.FIT | Kit / poliester | Kit | Porodica postoji, katalog 0 | `PROVERITI LOKALNU DOSTUPNOST` — staging | P1 |
| P10 | C.A.R.FIT | 2K bezbojni lak | Clearcoat | Porodica postoji, katalog 0 | `PROVERITI LOKALNU DOSTUPNOST` — staging | P1 |
| P11 | C.A.R.FIT | Polirni program | Poliranje | Porodica postoji, katalog 0 | `PROVERITI LOKALNU DOSTUPNOST` — staging | P1 |
| P12 | R-M | DIAMONT bezbojni lak | Clearcoat | Mozaik traži 4 slota, imamo 1 | `PROVERITI LOKALNU DOSTUPNOST` | P1 |
| P13 | R-M | DIAMONT učvršćivač | Hardener | isto | `PROVERITI LOKALNU DOSTUPNOST` | P1 |
| P14 | R-M | DIAMONT razređivač | Thinner | isto | `PROVERITI LOKALNU DOSTUPNOST` | P1 |
| P15 | Carsystem | 6-8 dodatnih artikala bilo koje kategorije | mešano | Da se prekine 13× reciklaža istih slika | `PROVERITI LOKALNU DOSTUPNOST` — **441 packshot u stagingu** | P1 |
| P16 | Cosmos | Master Mechanic mat/sjaj parovi | Sprej | Mat i sjaj varijante dele istu sliku | `NEEDS IMAGE` | P2 |
| P17 | baslac | Dodatni artikli za katalog grid | mešano | Grid traži 4, imamo tačno 4 | `PROVERITI LOKALNU DOSTUPNOST` | P2 |

**Nijedan proizvod nije dodat. Nijedan nije izmišljen.** Svi `PROVERITI LOKALNU DOSTUPNOST` unosi opisuju **vrstu** proizvoda koju dizajn traži, a gde je poznat zvanični kod (npr. baslac 20-22, R-M DIAMONT), naveden je iz postojeće `baslacBrandData.ts` / `rmBrandData.ts` — ne iz spoljnog izvora.

---

## 12. MASTER CONTENT GAP LIST

| ID | Page | Section | Missing content | Required content | Priority |
| -- | ---- | ------- | --------------- | ---------------- | -------- |
| C01 | Homepage | Edukacija | 5 "članaka" sa lažnim vremenom čitanja | Ili objaviti 3 postojeća draft vodiča iz `data/knowledge/guides.ts` i povezati ih, ili ukloniti "4 min / 5 min / 7 min" oznake | P0 |
| C02 | baslac | 45 Line feature | Placeholder copy: *"Ovaj pregled rezerviše mesto za stvarni mixing sistem…"* | 40-60 reči o tome šta 45 Line rešava i zašto je relevantan lokalnom kupcu | P0 |
| C03 | baslac | Komercijalna vozila | Placeholder copy: *"Ovaj blok rezerviše jasan prostor za stvarnu primenu na kamionu…"* | 40-60 reči o direct gloss sistemu za velike površine | P0 |
| C04 | R-M | AGILIS actions | Samopriznajući copy: *"…ostale komponente ostaju jasni tehnički slotovi do odobrenja finalnih asseta."* | Ukloniti nakon što se poprave slug mapiranja | P0 |
| C05 | Carsystem | Metrics | `catalog-count` prikazuje **09** | Ili proširiti katalog, ili zameniti metriku onom koja ne radi protiv brenda | P1 |
| C06 | C.A.R.FIT | Dokumentacija | 4 kartice bez ijednog linka | Povezati na TDS iz `assets/manufacturer/carfit/documents` (300 PDF-ova) nakon odluke o objavljivanju | P1 |
| C07 | Carsystem | Dokumentacija | Kartica "Video materijali" nema `href`, renderuje se onemogućena | Ili video resurs, ili ukloniti karticu | P1 |
| C08 | Cosmos | — | Color chart postoji kao podatak (`cosmos-lac-color-chart.generated.json`, 63 KB) ali se **nigde ne prikazuje** | Odlučiti gde ga prikazati — za brend čiji je adut boja, ovo je najveći propušteni sadržaj | P1 |
| C09 | R-M | Refinity | Nema color chart / formula asseta | Color chart ili formula vizual | P2 |
| C10 | Svi | Product stranice | **SDS nedostaje za sve brendove** | SDS set od proizvođača | P2 |
| C11 | baslac | Katalog | 102 TDS-a bez odgovarajućih product zapisa | Uskladiti katalog sa postojećom dokumentacijom | P2 |
| C12 | Homepage | Kontakt | Nema fotografije centrale | Opciono — blok radi i bez nje | P2 |

---

## 13. FINAL PROCUREMENT CHECKLIST

Ovo je lista po kojoj možeš fizički da ideš, jedan po jedan.

### KORAK 0 — ODLUKA PRE SVEGA (nije foto-nabavka)

- [ ] **0.1** Odlučiti da li smemo objaviti `assets/manufacturer/` materijal (Vosschemie / August Handel / Cosmos Lac S.A.). Ovo jedno pitanje rešava **~25 product gapova i ~800 dokumenata.** Sve ispod je pisano pod pretpostavkom da odgovor još nije poznat.
- [ ] **0.2** Potvrditi koje od tih artikala Carsystem i R-M DOO **stvarno drži** — packshot bez lokalne dostupnosti ne sme na sajt.

---

### PRVO PRONAĆI — P0 (bez ovoga stranice izgledaju nedovršeno)

1. **Carsystem workflow serija — 4 kadra, JEDAN foto-termin.** Isti panel istog tamnog vozila, fiksiran stativ, četiri faze: oštećeno → pripremljeno → obojeno → završeno. 4:3, min 1200×900. *Ovo je najveća vrednost po uloženom trudu u celom projektu — jedno snimanje popunjava četiri prazne kutije koje stoje jedna do druge.*

2. **Carsystem hero — priprema.** Lakirer brusi blatobran ekscentričnom brusilicom, subjekt desno, leva trećina prazna za naslov. Desktop 3:2 ≥1800×1200 **+ zaseban mobile portret 900×1125.**

3. **baslac hero #1 — sistem.** 5-7 baslac limenki u luku na tamnoj površini, etikete čitljive, gornja leva trećina prazna. Desktop 40:27 ≥1600×1080 **+ zaseban mobile 900×1080.** *Trenutno je na ovom mestu vidljiv sivi box sa tekstom `IMAGE SLOT`.*

4. **baslac repair rhythm.** Široki kadar lakirnice sa 2-3 vidljive faze rada. 8:5 ≥1600×1000 + mobile 900×1125. *Označen `priority: "highest"` u kodu.*

5. **C.A.R.FIT hero — radni sto.** Pogled odozgo pod uglom na uredan sto sa materijalima za 5 faza, sa **prozračnim razmacima** (markeri idu preko slike). 3:2 ≥2000×1333.

6. **Carsystem Multi Green — transparentni packshot.** Jedini JPG bez alfe u kompoziciji gde svi ostali lebde. 1200×1200 PNG. *Vidljiv defekt, jeftin fix.*

7. **baslac 60-20 razređivač — prava fotografija.** Trenutno koristi bajt-identičnu kopiju slike proizvoda 35-M214. *Jedan od ta dva proizvoda je sigurno pogrešno prikazan.*

8. **Copy fix — homepage edukacija.** Ukloniti "4 min / 5 min / 7 min" ili objaviti 3 postojeća draft vodiča.

9. **Copy fix — baslac ×2, R-M ×1.** Ukloniti tri placeholder pasusa koji doslovno kažu da blok rezerviše mesto.

---

### ZATIM — P1 (da stranice budu reprezentativne)

10. **Homepage hero u 2560×1440 WebP.** Isti kadar, veći, i konvertovan iz 1.8 MB PNG-a.
11. **Homepage — mikser boja / vaga.** Zamenjuje packshot brusnog programa u bloku o tehničkoj podršci. 1:1 ≥1400×1400.
12. **Homepage final CTA — zaseban kadar.** Da se hero ne ponavlja dvaput na istoj stranici.
13. **R-M — 44 logotipa marki automobila**, monohromatski SVG. *Trenutno je "R-M Color Coverage" marquee od 88 sivih tekstualnih pravougaonika.*
14. **Cosmos — 1 application kadar**, sprej u letu na metalnoj površini. 16:9 ≥2000×1125.
15. **Cosmos — hi-res vodeća hero limenka** u 2560×2560 (3 takva fajla već postoje u stagingu, znači proizvođač ih ima).
16. **C.A.R.FIT — masking scena + finish scena.** 2× 20:11 ≥2000×1100.
17. **Carsystem — hero painting + hero finishing** (+ 2 mobile) i **3 process kadra.**
18. **baslac — hero #2, #3, #4** (+ 3 mobile) = 6 fajlova.
19. **Cosmos color chart — odlučiti gde ga prikazati.** Podatak već postoji.
20. **C.A.R.FIT dokumentacija — povezati linkove.** 300 PDF-ova čeka u stagingu.

---

### KASNIJE — P2 (polish)

21. baslac — 5 sekcijskih slika (45 Line, clearcoat, primer, koloristika, CV).
22. C.A.R.FIT — 5 kompozicija porodica + macro detalj abraziva.
23. Carsystem — 7 packshotova u ≥1200px (traži master fajlove od Vosschemie; **staging je takođe 660px i neće pomoći**).
24. Cosmos — još 2 application kadra (drvo, bicikl).
25. Cosmos — Master Mechanic mat/sjaj razdvojiti (2 slike).
26. R-M — hero master fajlovi u 2560px.
27. SDS set za sve brendove.
28. R-M color chart / formula vizual.

---

## 14. BRAND PAGES NOT YET DESIGNED

Ovi brendovi postoje u `lib/carsystem-data.ts` i imaju rutu, ali padaju na generički `components/brand/BrandPage.tsx`. **Nisu deo ovog audita.**

| Brand | Route | Current state |
| ----- | ----- | ------------- |
| SATA | `/brendovi/sata` | Generička `BrandPage`. **1 proizvod, 0 sa slikom.** Logo postoji (`/brands/sata.svg`) |
| Norbin | `/brendovi/norbin` | Generička `BrandPage`. 2 proizvoda, 1 sa slikom. Logo postoji |
| Befar | `/brendovi/befar` | Generička `BrandPage`. 8 proizvoda, 8 sa slikom. Logo postoji |
| Rupes | `/brendovi/rupes` | Generička `BrandPage`. **0 proizvoda, 0 logotipa** — u `BrandLogoPlate` renderuje "Brend u najavi" |
| A.U.T.O. Fit | `/brendovi/autofit` | Generička `BrandPage`. **0 proizvoda, 0 logotipa** — "Brend u najavi" |

---

## 15. SAŽETAK BROJEVA

| Metrika | Vrednost |
| ------- | -------- |
| Stranica u scope-u | 6 |
| **Referenciranih slika koje ne postoje** | **28** |
| Stranica bez ijedne fotografije | **3** (baslac, Carsystem, C.A.R.FIT) |
| Potvrđenih duplikata (isti bajtovi, različit proizvod) | 6 parova (1 baslac + 5 Cosmos) |
| Novih slika — MINIMUM | ~15 |
| Novih slika — RECOMMENDED | ~35 |
| Novih slika — IDEAL | ~56 |
| Packshotova za cleanup / hi-res | ~10 |
| Product gapova | 17 stavki |
| Copy gapova | 4 (od toga 3 doslovna placeholder pasusa) |
| Dokumentacionih gapova | 12 stavki |
| **Već prikupljeno a neobjavljeno** | **1234 slike + 806 dokumenata (646 MB)** |

---

## 16. JEDNA REČENICA PO STRANICI

- **Homepage** — solidna, ali ponavlja hero dvaput i obećava članke koji ne postoje.
- **R-M** — jedina stvarno završena stranica; fali joj 44 logotipa i DIAMONT proizvodi.
- **baslac** — najozbiljniji tekstualni sadržaj u projektu, potpuno bez slika; 15 nedostajućih fajlova, 102 TDS-a bez proizvoda.
- **C.A.R.FIT** — najbolji interaktivni deo (task selector), nula fotografija, ali 123 packshota i 300 dokumenata čekaju u stagingu.
- **Cosmos LAC** — najbolja product pokrivenost u projektu (742/742), i jedina stranica čiji je gap **čisto** lifestyle.
- **Carsystem** — najveći raskorak dizajn/sadržaj: 13 nedostajućih slika, 9 proizvoda, i jedna slika brusnog diska upotrebljena 13 puta.
