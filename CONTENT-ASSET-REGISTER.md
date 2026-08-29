# Content asset registar

Datum: 2026-08-22 (ažurirano)
Obim: sve javne rute — početna, bespoke i generičke brend stranice,
program/sistem stranice, katalog kartice, PDP template i stvarni product podaci.

Registrovana su **samo** prazna, placeholder, pogrešna, duplirana i nedovoljna
media mesta. Ispravne slike se ne izlistavaju — ~2 800 Cosmos LAC packshotova i
59 R-M packshotova su provereni i nisu u registru.

## Prateći fajlovi

| Fajl | Namena |
| --- | --- |
| `CONTENT-ASSET-REGISTER.md` | ovaj dokument — narativ, konvencije, workflow |
| `CONTENT-ASSET-REGISTER.csv` | tabelarni izvoz za filtriranje po statusu |
| `content-asset-manifest.json` | mašinski čitljiv manifest sa svim poljima |

`CSV` i `JSON` su **content-production manifesti, ne runtime dependency.**
Nijedna runtime komponenta ih ne čita. Generišu se sa:

```bash
node scripts/build-content-asset-register.mjs
```

## Kako je registar nastao

| Izvor | Šta je dalo |
| --- | --- |
| `scripts/scan-content-assets.mjs` | 133 referencirana asseta, 20 nepostojećih putanja, 28 deljenih referenci, placeholder upotrebe |
| sha256 hash svih `public/` slika | 7 stvarnih duplikata sadržaja (ne poklapanja po veličini fajla) |
| `lib/carsystem-data.ts` | product zapisi i `placeholderProductImage` reference |
| `data/rm-imported-products.generated.json` | potvrda da svih 59 R-M proizvoda ima stvarnu sliku (`image.src`) |
| `docs/BASLAC_PDP_DOCUMENT_MAP.md` | dokazani identitetski konflikti na baslac packshotovima |
| `BASLAC-CONTENT-AND-MEDIA-GAPS.md` | baslac slot analiza iz prethodnog zadatka |

Ključni nalaz skenera: **13 nepostojećih putanja na Carsystem brend stranici**
(hero ×3, proces ×3, workflow ×4, plus 3 mobilne varijante) i 7 na baslac
stranici. Sve su referencirane u brand data fajlovima, ali fajlovi ne postoje —
stranice se renderuju sa `mediaPlaceholder` fallbackom.

## Ukupno

<!-- GENERATED:totals — ne menjati rucno; `npm run assets:register` -->

| Status | Broj |
| --- | --- |
| `NEEDS_ASSET` | 32 |
| `NEEDS_PRODUCT_DECISION` | 4 |
| `OPTIONAL_UPGRADE` | 7 |
| `WRONG_ASSET` | 5 |
| **ukupno slotova** | **48** |

| Prioritet | Broj |
| --- | --- |
| `P0 — blokira javnu stranicu` | 4 |
| `P1 — glavni vidljivi sadržaj` | 25 |
| `P2 — product/section completion` | 12 |
| `P3 — polish` | 7 |

<!-- /GENERATED:totals -->

---

## Registar po prioritetu

<!-- GENERATED:registry — ne menjati rucno; `npm run assets:register` -->

### P0 — blokira javnu stranicu  (4)

| slotId | Ruta | Sekcija | Problem | Ocekivani fajl | Ciljna putanja | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `product.baslac-30-s510-s-serija.packshot` | `/proizvodi/baslac-30-s510-s-serija` | productImage | Etiketa cita `35-M1020 White Blue Flip Basecoat`, a zapis je 30-S510. | `baslac-30-s510-packshot-front.webp` | `public/products/baslac/` | `WRONG_ASSET` |
| `product.baslac-35-m214.packshot` | `/proizvodi/baslac-35-m214` | productImage | Ista fotografija na dva proizvoda (sha256 poklapanje). Uz to, identitet 35-M214 nije resen: zapis kaze faza 'lak', oznaka upucuje … | `baslac-35-m214-packshot-front.webp` | `public/products/baslac/` | `WRONG_ASSET` |
| `product.baslac-35-m331-pasta.packshot` | `/proizvodi/baslac-35-m331-pasta` | productImage | Etiketa cita `35-M ... Basecoat`, a zapis proizvod vodi kao pastu za poliranje (programSlug: poliranje). | `baslac-35-m331-packshot-front.webp` | `public/products/baslac/` | `WRONG_ASSET` |
| `product.baslac-60-20-razredjivac.packshot` | `/proizvodi/baslac-60-20-razredjivac` | productImage | Etiketa na konzervi cita `45-W1150 Yellow Basecoat`, a zapis je razredjivac 60-20. Fajl je uz to bajt-identican fajlu za 35-M214 (… | `baslac-60-20-5l-packshot-front.webp` | `public/products/baslac/` | `WRONG_ASSET` |

### P1 — glavni vidljivi sadržaj  (25)

| slotId | Ruta | Sekcija | Problem | Ocekivani fajl | Ciljna putanja | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `baslac.family.line-30-3.5l` | `/brendovi/baslac` | Line 30 family packshot (3.5L) | Family packshot za tacnu zapreminu. Prijavljeno je da dostavljeni fajlovi imaju checkerboard u pikselima i nemaju stvarnu alfu. | `baslac--line-30-3.5l-family-packshot.png` | `public/products/baslac/families/` | `NEEDS_ASSET` |
| `baslac.family.line-35-0.5l` | `/brendovi/baslac` | Line 35 family packshot (0.5L) | Family packshot za tacnu zapreminu. Prijavljeno je da dostavljeni fajlovi imaju checkerboard u pikselima i nemaju stvarnu alfu. | `baslac--line-35-0.5l-family-packshot.png` | `public/products/baslac/families/` | `NEEDS_ASSET` |
| `baslac.family.line-35-1l` | `/brendovi/baslac` | Line 35 family packshot (1L) | Family packshot za tacnu zapreminu. Prijavljeno je da dostavljeni fajlovi imaju checkerboard u pikselima i nemaju stvarnu alfu. | `baslac--line-35-1l-family-packshot.png` | `public/products/baslac/families/` | `NEEDS_ASSET` |
| `baslac.family.line-35-3.5l` | `/brendovi/baslac` | Line 35 family packshot (3.5L) | Family packshot za tacnu zapreminu. Prijavljeno je da dostavljeni fajlovi imaju checkerboard u pikselima i nemaju stvarnu alfu. | `baslac--line-35-3.5l-family-packshot.png` | `public/products/baslac/families/` | `NEEDS_ASSET` |
| `baslac.line-35.family-packshot-legacy` | `/brendovi/baslac` | Line 35 family hero | Dostavljena slika je AI-generisana (ChatGPT Image ...png, RGB bez alfe, checkerboard u pikselima) i ne sme se koristiti ni posle c… | `baslac-line-35-family-packshot-front.webp` | `public/products/baslac/families/` | `NEEDS_ASSET` |
| `baslac.line-45.family-packshot` | `/brendovi/baslac` | Line 45 family hero | Line 45 je istaknut kao glavni vodeni sistem, a nema nijednu stvarnu fotografiju ambalaze. | `baslac-line-45-family-packshot-front.webp` | `public/products/baslac/families/` | `NEEDS_ASSET` |
| `baslac.packshot.20-24-1l` | `/katalog?brend=baslac` | productImage (2K Primerfiller Grey, 1L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--20-24-2k-primerfiller-grey-1l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.20-24-4l` | `/katalog?brend=baslac` | productImage (2K Primerfiller Grey, 4L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--20-24-2k-primerfiller-grey-4l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.20-34-1l` | `/katalog?brend=baslac` | productImage (2K Primerfiller White, 1L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--20-34-2k-primerfiller-white-1l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.20-34-4l` | `/katalog?brend=baslac` | productImage (2K Primerfiller White, 4L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--20-34-2k-primerfiller-white-4l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.20-35-3l` | `/katalog?brend=baslac` | productImage (2K Primerfiller Wet-on-wet White, 3L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--20-35-2k-primerfiller-wet-on-wet-white-3l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.20-94-1l` | `/katalog?brend=baslac` | productImage (2K Primerfiller Black, 1 L) | 1 L packshot nedostaje. 4 L limenka se NE sme skalirati da glumi 1 L pakovanje; 1 L varijanta ostaje bez sopstvene fotografije dok… | `baslac--20-94-2k-primerfiller-black-1l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.20-94-4l` | `/katalog?brend=baslac` | productImage (2K Primerfiller Black, 4L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--20-94-2k-primerfiller-black-4l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.20-95-3l` | `/katalog?brend=baslac` | productImage (2K Primerfiller Wet-on-wet Black, 3L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--20-95-2k-primerfiller-wet-on-wet-black-3l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.21-11-1l` | `/katalog?brend=baslac` | productImage (2K Plastic Primer VOC, 1L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--21-11-2k-plastic-primer-voc-1l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.21-20-400ml` | `/katalog?brend=baslac` | productImage (Plastic Primer, 400ML) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--21-20-plastic-primer-400ml-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.25-30-4l` | `/katalog?brend=baslac` | productImage (2K EP Primerfiller, 4L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--25-30-2k-ep-primerfiller-4l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.27-10-1l` | `/katalog?brend=baslac` | productImage (2K Washprimer, 1L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--27-10-2k-washprimer-1l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.packshot.27-10-4l` | `/katalog?brend=baslac` | productImage (2K Washprimer, 4L) | Fajl je najavljen u isporuci ali nije pristupacan. Uz to je prijavljeno da svi dostavljeni PNG-ovi imaju checkerboard urezan u pik… | `baslac--27-10-2k-washprimer-4l-packshot.png` | `public/products/baslac/` | `NEEDS_ASSET` |
| `baslac.repair-rhythm` | `/brendovi/baslac` | Glavni proces (#repair-rhythm) | Nedostaje fotografija. | `baslac-repair-rhythm-desktop.webp` | `public/images/brands/baslac/process/` | `NEEDS_ASSET` |
| `carsystem.hero-finishing` | `/brendovi/carsystem` | Hero slajd 3 | Putanja je referencirana u carsystemBrandData.ts, ali fajl ne postoji. Ceo hero brend stranice je placeholder. | `carsystem-hero-finishing.webp` | `public/images/brands/carsystem/hero/` | `NEEDS_ASSET` |
| `carsystem.hero-painting` | `/brendovi/carsystem` | Hero slajd 2 | Putanja je referencirana u carsystemBrandData.ts, ali fajl ne postoji. Ceo hero brend stranice je placeholder. | `carsystem-hero-painting.webp` | `public/images/brands/carsystem/hero/` | `NEEDS_ASSET` |
| `carsystem.hero-preparation` | `/brendovi/carsystem` | Hero slajd 1 | Putanja je referencirana u carsystemBrandData.ts, ali fajl ne postoji. Ceo hero brend stranice je placeholder. | `carsystem-hero-preparation.webp` | `public/images/brands/carsystem/hero/` | `NEEDS_ASSET` |
| `home.campaign.cosmos-spray` | `/` | Homepage campaign carousel (peti slajd) | Ne postoji nijedan Cosmos Spray banner. Postoje samo 800x800 packshotovi na transparentnoj podlozi (assets/manufacturer/cosmos-lac… | `cosmos-spray-home-campaign-brand-desktop.webp` | `public/images/home/campaign/` | `NEEDS_ASSET` |
| `product.cosmos-spray-300.packshot` | `/proizvodi (Cosmos Spray)` | productImage | sha256 poklapanje sa `/interaction-demo/spray-paint.png`. Demo ilustracija se koristi kao product packshot. | `cosmos-spray-300-packshot-front.webp` | `public/products/cosmos-spray/` | `WRONG_ASSET` |

### P2 — product/section completion  (12)

| slotId | Ruta | Sekcija | Problem | Ocekivani fajl | Ciljna putanja | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `baslac.clearcoat-range` | `/brendovi/baslac` | Bezbojni lakovi (#clearcoats) | Nedostaje fotografija; sekcija uz to nabraja proizvode koji nisu u katalogu. | `baslac-clearcoat-range-desktop.webp` | `public/images/brands/baslac/clearcoats/` | `NEEDS_PRODUCT_DECISION` |
| `baslac.color-workflow` | `/brendovi/baslac` | Koloristika (#koloristika) | Nedostaje fotografija. | `baslac-color-workflow-desktop.webp` | `public/images/brands/baslac/color/` | `NEEDS_ASSET` |
| `baslac.commercial-vehicles` | `/brendovi/baslac` | Komercijalna vozila (#commercial) | Nedostaje fotografija; sekcija uz to nabraja proizvode koji nisu u katalogu. | `baslac-commercial-vehicles-desktop.webp` | `public/images/brands/baslac/commercial/` | `NEEDS_PRODUCT_DECISION` |
| `baslac.line-45-system` | `/brendovi/baslac` | 45 Line sistem (#color-systems) | Nedostaje fotografija; sekcija uz to nabraja proizvode koji nisu u katalogu. | `baslac-line-45-system-desktop.webp` | `public/images/brands/baslac/systems/` | `NEEDS_PRODUCT_DECISION` |
| `baslac.primer-process` | `/brendovi/baslac` | Prajmeri (#primers) | Nedostaje fotografija; sekcija uz to nabraja proizvode koji nisu u katalogu. | `baslac-primer-process-desktop.webp` | `public/images/brands/baslac/primers/` | `NEEDS_PRODUCT_DECISION` |
| `carsystem.process-application` | `/brendovi/carsystem` | Proces — nanosenje | Putanja referencirana u podacima, fajl ne postoji. | `carsystem-process-application.webp` | `public/images/brands/carsystem/process/` | `NEEDS_ASSET` |
| `carsystem.process-finish` | `/brendovi/carsystem` | Proces — zavrsna obrada | Putanja referencirana u podacima, fajl ne postoji. | `carsystem-process-finish.webp` | `public/images/brands/carsystem/process/` | `NEEDS_ASSET` |
| `carsystem.process-preparation` | `/brendovi/carsystem` | Proces — priprema | Putanja referencirana u podacima, fajl ne postoji. | `carsystem-process-preparation.webp` | `public/images/brands/carsystem/process/` | `NEEDS_ASSET` |
| `carsystem.workflow-damage` | `/brendovi/carsystem` | Workflow before/after niz | Cetiri faze istog panela. Moraju biti isti panel, isti ugao i isto osvetljenje, inace niz ne cita kao progresija. | `carsystem-workflow-damage.webp` | `public/images/brands/carsystem/workflow/` | `NEEDS_ASSET` |
| `carsystem.workflow-finished` | `/brendovi/carsystem` | Workflow before/after niz | Cetiri faze istog panela. Moraju biti isti panel, isti ugao i isto osvetljenje, inace niz ne cita kao progresija. | `carsystem-workflow-finished.webp` | `public/images/brands/carsystem/workflow/` | `NEEDS_ASSET` |
| `carsystem.workflow-painted` | `/brendovi/carsystem` | Workflow before/after niz | Cetiri faze istog panela. Moraju biti isti panel, isti ugao i isto osvetljenje, inace niz ne cita kao progresija. | `carsystem-workflow-painted.webp` | `public/images/brands/carsystem/workflow/` | `NEEDS_ASSET` |
| `carsystem.workflow-prepared` | `/brendovi/carsystem` | Workflow before/after niz | Cetiri faze istog panela. Moraju biti isti panel, isti ugao i isto osvetljenje, inace niz ne cita kao progresija. | `carsystem-workflow-prepared.webp` | `public/images/brands/carsystem/workflow/` | `NEEDS_ASSET` |

### P3 — polish  (7)

| slotId | Ruta | Sekcija | Problem | Ocekivani fajl | Ciljna putanja | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `home.campaign.carsystem.source-upgrade` | `/` | Homepage campaign carousel, slajd 1 | Izvor je 1672x941, sto je ~1.16x na 1440px sirokom viewportu. Za pun 2x na velikim ekranima trebao bi izvor >= 2880px. | `carsystem-home-campaign-brand-desktop.webp` | `public/images/home/campaign/` | `OPTIONAL_UPGRADE` |
| `product.cosmos-lac.flame-blue-900-3000.packshot` | `/katalog?brend=cosmos-lac` | productImage | FB-900 Pure White i FB-3000 Transparent White dele istu fotografiju. Gloss/matt i puna/transparentna varijanta nisu isti proizvod. | `cosmos-lac-{normalized-sku}-packshot-front.webp` | `public/products/cosmos-lac/{family}/` | `OPTIONAL_UPGRADE` |
| `product.cosmos-lac.flame-blue-904-3004.packshot` | `/katalog?brend=cosmos-lac` | productImage | FB-904 Deep Black i FB-3004 Transparent Black dele istu fotografiju. Gloss/matt i puna/transparentna varijanta nisu isti proizvod. | `cosmos-lac-{normalized-sku}-packshot-front.webp` | `public/products/cosmos-lac/{family}/` | `OPTIONAL_UPGRADE` |
| `product.cosmos-lac.flame-orange-901-904.packshot` | `/katalog?brend=cosmos-lac` | productImage | FO-901 Thick Black i FO-904 Deep Black dele istu fotografiju. Gloss/matt i puna/transparentna varijanta nisu isti proizvod. | `cosmos-lac-{normalized-sku}-packshot-front.webp` | `public/products/cosmos-lac/{family}/` | `OPTIONAL_UPGRADE` |
| `product.cosmos-lac.master-mechanic-10-black.packshot` | `/katalog?brend=cosmos-lac` | productImage | RAL 10 Black gloss i matt dele istu fotografiju. Gloss/matt i puna/transparentna varijanta nisu isti proizvod. | `cosmos-lac-{normalized-sku}-packshot-front.webp` | `public/products/cosmos-lac/{family}/` | `OPTIONAL_UPGRADE` |
| `product.cosmos-lac.master-mechanic-10-white.packshot` | `/katalog?brend=cosmos-lac` | productImage | RAL 10 White gloss i matt dele istu fotografiju. Gloss/matt i puna/transparentna varijanta nisu isti proizvod. | `cosmos-lac-{normalized-sku}-packshot-front.webp` | `public/products/cosmos-lac/{family}/` | `OPTIONAL_UPGRADE` |
| `rm.campaign.refinity.mobile-upgrade` | `/brendovi/rm` | Campaign hero — REFINITY | 960x720, dok su ostali R-M mobilni baneri 1448x1086. Na 430px logickih piksela to je ~2.2x, ali ispod nivoa ostalih slajdova. | `rm-hero-refinity-desktop.webp` | `public/images/brands/rm/campaign/` | `OPTIONAL_UPGRADE` |

<!-- /GENERATED:registry -->

---

## Konvencija naziva fajlova

Projekat **već ima jasnu konvenciju** sa jednom crticom, vidljivu u
`public/images/brands/rm/campaign/` i `public/images/brands/baslac/campaign/`:

```
rm-hero-agilis-performance-desktop.webp
baslac-surventis-desktop.webp
baslac-20-years-artwork.webp
```

Ta konvencija je zadržana umesto predložene dvostruke crtice (`--`), uz dodat
slot segment gde nosi informaciju (`home-campaign`). Razlog: rušenje postojeće
konvencije bi napravilo dva paralelna stila u istom folderu, a semantika koju
dvostruka crtica nosi već se postiže segmentima.

| Tip | Šablon |
| --- | --- |
| Campaign banner | `{brand}-home-campaign-{campaign-slug}-{desktop\|mobile}.webp` |
| Brand section slika | `{brand}-{section-slug}-{subject-slug}-{desktop\|mobile}.webp` |
| Product packshot | `{brand}-{normalized-sku-or-product-slug}-packshot-{front\|angle\|group}.webp` |
| Product gallery | `{brand}-{normalized-sku-or-product-slug}-gallery-01.webp` |
| Dokumenti | postojeća konvencija se ne menja — validni PDF-ovi se ne preimenuju |

Svi nazivi: lowercase, bez razmaka, bez dijakritike, bez `final`/`copy`/`new`/`v2`,
stabilni i izvedeni iz brenda, slota i stvarnog subjekta.

**Kada dva pakovanja predstavljaju isti proizvod**, filename mora sadržati
potvrđeni SKU ili oznaku varijante. Primer iz ovog registra: Cosmos Lac
`master-mechanic RAL 10` gloss i matt trenutno dele jedan fajl — ispravno je
`cosmos-lac-mm-10-white-gloss-packshot-front.webp` i
`cosmos-lac-mm-10-white-matt-packshot-front.webp`.

---

## Workflow za dostavu asseta

1. **Filtriraj** — otvori `CONTENT-ASSET-REGISTER.csv` i filtriraj kolonu
   `status` na `NEEDS_ASSET` (ili `priority` na `P0`/`P1`).
2. **Pripremi fajl** pod tačnim nazivom iz kolone `expectedDesktopFilename`
   (i `expectedMobileFilename` ako je popunjena). Poštuj `minDimensions`,
   `background` (transparent/full), `focalPoint` i `safeZone`.
3. **Ubaci** fajl u `_incoming/assets/`.
4. **Validiraj**:

   ```bash
   node scripts/validate-incoming-assets.mjs
   ```

   Validator je read-only. Proverava naziv (lowercase, bez razmaka, bez
   dijakritike, bez `final`/`copy`/`vN`), format, dimenzije protiv
   `minDimensions`, prisustvo alfa kanala protiv `background`, i sha256
   duplikate sa postojećim `public/` assetima.

   **Validator neće automatski povezati fajl** za slotove sa statusom
   `NEEDS_IDENTITY_RESOLUTION` ili `NEEDS_PRODUCT_DECISION` — tu je potrebna
   ljudska odluka, koju alat ne sme da pretpostavi.
5. **Povezivanje** — fajl se prebacuje u `targetPath` i referencira iz
   `dataSource` fajla navedenog u registru, po `slotId`.
6. **Izvedenice** — generišu se samo potrebne desktop/mobile varijante
   (`scripts/build-home-campaign-assets.py`,
   `scripts/build-baslac-campaign-assets.py`).
7. **Vizuelni QA.** Automatski ugovori koji moraju ostati zeleni:

   ```bash
   npm run test:carousel-core
   npm run test:carousel-consumers
   npm run test:home-campaign
   npm run test:rm-carousel
   npm run test:baslac-carousel
   ```

   Uz to je potreban **ručni vizuelni pregled** ruta `/`, `/brendovi/rm` i
   `/brendovi/baslac`, na desktop i mobilnom viewportu.

   Trajan automatski screenshot gate **trenutno ne postoji** — testovi iznad
   proveravaju podatke, redosled i ponašanje karusela, ali ne i to kako slika
   izgleda na ekranu.
8. **Slot prelazi u `READY`** i briše se iz registra pri sledećem generisanju.

---

## Identity i product blokeri

Ovi slotovi se **ne mogu zatvoriti dostavom slike** — prvo treba odluka
vlasnika podataka.

| Slot | Pitanje |
| --- | --- |
| `product.baslac-35-m331-pasta.packshot` | Je li `35-M331` pasta za poliranje ili mixing komponenta linije 35? Zapis i etiketa se ne poklapaju. |
| `product.baslac-35-m214.packshot` | Je li `35-M214` mixing baza linije 35? Tri različite tvrdnje u repozitorijumu. |
| `baslac.line-45-system`, `baslac.clearcoat-range`, `baslac.primer-process`, `baslac.commercial-vehicles` | Sekcije nabrajaju proizvode koji nisu u katalogu. Dokumentacija postoji (87 per-SKU TDS listova), ali **dokumentacija nije dokaz da se proizvod prodaje ili drži na stanju.** Prvo treba odluka koji se artikli objavljuju. |

---

## Napomena o obimu

Registar pokriva mesta koja stvarno postoje u kodu i podacima. Nije uključeno:

- Cosmos LAC packshotovi koji su ispravni (~2 800 fajlova),
- R-M product packshotovi (svih 59 ima stvarnu sliku, potvrđeno
  `data/rm-imported-products.generated.json` → `image.src`),
- SATA brend stranica — nju razvija paralelna sesija; njeni slotovi su
  dokumentovani u `docs/SATA_CONTENT_ASSET_MAP.md` i namerno nisu duplirani ovde,
- dokumentacioni PDF-ovi i njihovi cover-i (15 baslac cover-a postoji i ispravno je).
