# baslac — content i media gap audit

Datum: 2026-08-20
Obim: `/brendovi/baslac` (`components/baslac-brand/*`), baslac zapisi u javnom
katalogu i baslac dokumentacija.

Sve u ovom izveštaju je pročitano iz repozitorijuma. Ništa nije pretpostavljeno,
zaključeno po analogiji, niti prepisano iz ranijih audita. Gde podatak ne
postoji, piše da ne postoji.

Izvori:

- `lib/carsystem-data.ts` — `productRecords`, `legacyProducts`
- `lib/documents.ts` — `brandDocuments`
- `public/products/baslac/`, `public/documents/products/baslac/`,
  `public/brands/baslac/documents/`, `public/images/brands/baslac/`
- `data/knowledge/baslac-documents.generated.json` (102 zapisa iz zvaničnog
  baslac TDS indeksa)
- `docs/BASLAC_PDP_DOCUMENT_MAP.md`
- renderovan HTML iz `npm run build:check` (`.next-verify/server/app/brendovi/baslac.html`)

---

## A. Trenutno objavljeni baslac proizvodi

Javno postoje **četiri** baslac proizvoda. Potvrđeno dvostruko: `productRecords`
filtriran po `brandSlug === "baslac"`, i lista `/proizvodi/...` linkova u
build-ovanom HTML-u brand stranice.

### A.1 `baslac-60-20-razredjivac`

| Polje | Vrednost |
| --- | --- |
| Naziv | Baslac 60-20 razređivač |
| SKU | `BASLAC-60-20-5L` |
| Slug / ruta | `baslac-60-20-razredjivac` → `/proizvodi/baslac-60-20-razredjivac` |
| Program / faza | `boje-i-lakovi` / `boja` |
| Status objave | Objavljen (SSG stranica postoji u build izlazu) |
| Putanja slike | `/products/baslac/baslac-60-20-razredjivac.jpg` |
| Slika postoji | Da |
| Dimenzije / format | 724 × 724, JPEG, RGB, 37 722 B |
| Dokumenti | TDS `/documents/products/baslac/60-20.pdf` (`available`); SDS `placeholder`; uputstvo `disabled` |
| Pouzdanost dokumenta | **EXACT** — tačna oznaka artikla `60-20`, potvrđena sadržajem PDF-a; sha256 zapisan u `docs/BASLAC_PDP_DOCUMENT_MAP.md` |
| Pojavljuje se u sekcijama | `#products` (CatalogPreview) na brand stranici; `/katalog?brend=baslac`; sopstveni PDP |

**Identitetski konflikt (slika):** etiketa na fotografiji čita
`45-W1150 Yellow Basecoat` — dakle bazna boja, a zapis je razređivač. Fotografija
je pogrešna; dokument nije sporan.

### A.2 `baslac-35-m214`

| Polje | Vrednost |
| --- | --- |
| Naziv | Baslac 35-M214 |
| SKU | `BASLAC-35-M214` |
| Slug / ruta | `baslac-35-m214` → `/proizvodi/baslac-35-m214` |
| Program / faza | `boje-i-lakovi` / `lak` |
| Status objave | Objavljen |
| Putanja slike | `/products/baslac/baslac-35-m214.jpg` |
| Slika postoji | Da |
| Dimenzije / format | 724 × 724, JPEG, RGB, 37 722 B |
| Dokumenti | **Nijedan** |
| Pouzdanost dokumenta | **AMBIGUOUS** — nijedan od 102 dokumenta ne nosi oznaku `35-M214`; kandidati su `35_Line.pdf` i `35_Line_variant_49.pdf`, oba opisuju liniju, ne komponentu |
| Pojavljuje se u sekcijama | `#products`; `/katalog?brend=baslac`; sopstveni PDP |

**Identitetski konflikt:** fajl je bajt-identičan fajlu za `60-20`
(oba 37 722 B, ista fotografija) — jedna fotografija stoji na dva proizvoda.
Uz to postoje tri različite tvrdnje o tome šta je `35-M214`: naš zapis kaže faza
„lak", oznaka `35-` upućuje na basecoat liniju, a `docs/CONTENT_ASSET_GAP_AUDIT.md`
ga na jednom mestu naziva hardener-om. **Ne rešavati nagađanjem.**

### A.3 `baslac-35-m331-pasta`

| Polje | Vrednost |
| --- | --- |
| Naziv | Baslac 35-M331 pasta |
| SKU | `BASLAC-35-M331` |
| Slug / ruta | `baslac-35-m331-pasta` → `/proizvodi/baslac-35-m331-pasta` |
| Program / faza | `poliranje` / `poliranje` |
| Status objave | Objavljen |
| Putanja slike | `/products/baslac/baslac-35-m331-pasta.webp` |
| Slika postoji | Da |
| Dimenzije / format | 1100 × 1422, WebP, RGB, 39 012 B |
| Dokumenti | **Nijedan** |
| Pouzdanost dokumenta | **CONFLICT** — oznaka `35-` i etiketa na packshot-u („35-M … Basecoat") slažu se međusobno, ali naš zapis proizvod vodi kao pastu za poliranje |
| Pojavljuje se u sekcijama | `#products`; `/katalog?brend=baslac`; sopstveni PDP |

**Identitetski konflikt:** ovo je najverovatnije greška product zapisa, a ne
dokumentacije. Pitanje za vlasnika podataka: je li `35-M331` pasta za poliranje
ili mixing komponenta linije 35? Odgovor menja i program i fazu na javnoj
stranici.

### A.4 `baslac-30-s510-s-serija`

| Polje | Vrednost |
| --- | --- |
| Naziv | Baslac 30-S510 S serija |
| SKU | `BASLAC-30-S510` |
| Slug / ruta | `baslac-30-s510-s-serija` → `/proizvodi/baslac-30-s510-s-serija` |
| Program / faza | `boje-i-lakovi` / `boja` |
| Status objave | Objavljen |
| Putanja slike | `/products/baslac/baslac-30-s510-s-serija.webp` |
| Slika postoji | Da |
| Dimenzije / format | 808 × 606, WebP, RGB, 12 266 B |
| Dokumenti | **Nijedan** |
| Pouzdanost dokumenta | **AMBIGUOUS** — pet kandidata (`30_Line.pdf`, `30_Line_CV.pdf`, dve `81-30` varijante, `30_CV_Gloss_levels.pdf`). Linija 30 ima dva različita sistema sa različitim učvršćivačima (`50-15/-20/-30` naspram `51-515/-520`); pogrešan izbor dao bi pogrešan recept mešanja |
| Pojavljuje se u sekcijama | `#products`; `/katalog?brend=baslac`; sopstveni PDP |

**Identitetski konflikt (slika):** etiketa čita `35-M1020 White Blue Flip Basecoat`
— dakle proizvod linije 35, a zapis je `30-S510`.

### A.5 Legacy zapis bez javne stranice

`baslac-900-basecoat` postoji u `legacyProducts`, ne u `productRecords`. Nema
javnu stranicu, koristi `placeholder-product.svg`, ali ga **pet** referenci u
`relatedProductSlugs` i dalje navodi. Postojeći problem, izvan obima ovog zadatka.

### A.6 Rezime A

- 4 objavljena proizvoda, sva 4 sa stvarnom slikom (nijedan placeholder).
- 3 od 4 slike su dokazano **pogrešne** — etiketa na konzervi ne odgovara zapisu.
- 2 slike su isti fajl.
- 1 od 4 proizvoda ima per-SKU dokument.
- Na disku je **102** baslac PDF-a; 15 je objavljeno kao brand vodiči, 87 su
  per-SKU listovi od kojih je **1** povezan. Uzrok nije slab matching nego to što
  katalog ima 4 proizvoda za 87 dokumenata.

---

## B. Svi vizuelni slotovi na baslac stranici

Redosled prati render u `BaslacBrandPage.tsx`.

### B.1 Hero slider — `campaignVisual`

| Polje | Vrednost |
| --- | --- |
| Sekcija | Kampanjski hero (2 slajda) |
| Komponenta | `components/baslac-brand/BaslacHero.tsx` |
| Podaci | `baslacCampaignSlides` u `baslacBrandData.ts` |
| Čemu služi | Brend uvod: jubilej 20 godina + prelazak pod Surventis |
| Postojeći asset | `/images/brands/baslac/campaign/baslac-20-years-artwork.webp` (798 × 871, WebP+alpha, lossless); `/images/brands/baslac/campaign/baslac-surventis-desktop.webp` (3440 × 1440); `/images/brands/baslac/campaign/baslac-surventis-mobile.webp` (1800 × 1440) |
| Potreban tip fotografije | — (isporučeno) |
| Odnos / rezolucija | Artwork ~0.92:1 providno; foto 2.39:1 desktop, 1.25:1 mobilni |
| Proizvodi koji bi se tu pojavili | Nijedan — brend slot, ne product slot |
| Status | **READY** |

Jedino ograničenje: providni artwork je u originalu širok **718 px** (bounding
box unutar 3440 × 1440 platna). To je maksimum koji original nosi; renderuje se
do ~450 CSS px na desktopu, što drži ~1.6× gustinu. Za oštrinu na 2× displejima
bio bi potreban veći original od baslac-a.

### B.2 Glavni proces — `repair-rhythm`

| Polje | Vrednost |
| --- | --- |
| Sekcija | Ritam popravke (`#repair-rhythm`) |
| Komponenta | `BaslacRepairRhythm.tsx` → `BaslacMediaSlot` |
| Očekivane putanje | `/images/brands/baslac/process/baslac-repair-rhythm-desktop.webp`, `…-mobile.webp` |
| Asset postoji | **Ne** — folder `public/images/brands/baslac/process/` ne postoji |
| Trenutno se prikazuje | `mediaPlaceholder` („Fotografija u pripremi") |
| Potreban tip fotografije | Radionička scena koja pokazuje povezane faze popravke |
| Odnos / min. rezolucija | 1600 × 1000 (16:10) desktop, 900 × 1125 (4:5) mobilni |
| Proizvodi koji bi se tu pojavili | 20- serija, 35 / 45 Line, 40-440 / 40-450 — **nijedan nije u katalogu** |
| Status | **NEEDS ASSET** |

Prioritet u podacima je `highest`; ovo je najveći vizuelni slot na stranici.

### B.3 45 Line sistem — `line-45-system`

| Polje | Vrednost |
| --- | --- |
| Sekcija | Sistemi boja (`#color-systems`), blok `line45Feature` |
| Komponenta | `BaslacBrandPage.tsx` → `SystemLines` → `BaslacMediaSlot` |
| Očekivana putanja | `/images/brands/baslac/systems/baslac-45-line-system.webp` |
| Asset postoji | **Ne** |
| Potreban tip fotografije | Mixing sistem 45 Line ili aplikacija vodene baze na panelu |
| Odnos / min. rezolucija | 1400 × 1050 (4:3) |
| Proizvodi koji bi se tu pojavili | `45 Line Basecoat`, `45-R45 Dilutant`, `45-W10` — **nijedan nije u katalogu**, ali sva tri imaju zvanični TDS na disku |
| Status | **NEEDS PRODUCT DATA** (asset i proizvod oba nedostaju; proizvod je uslov) |

### B.4 Bezbojni lakovi — `clearcoat-range`

| Polje | Vrednost |
| --- | --- |
| Sekcija | Bezbojni lakovi (`#clearcoats`) |
| Komponenta | `BaslacBrandPage.tsx` → `ClearcoatSection` |
| Očekivana putanja | `/images/brands/baslac/clearcoats/baslac-clearcoat-range.webp` |
| Asset postoji | **Ne** |
| Potreban tip fotografije | Grupni packshot bezbojnih lakova poređanih po procesu |
| Odnos / min. rezolucija | 1600 × 1000 (16:10) |
| Proizvodi koji bi se tu pojavili | `40-100`, `40-510`, `40-440`, `40-450`, `40-10`, `40-620` — svih šest ima TDS na disku, **nijedan nije u katalogu** |
| Status | **NEEDS PRODUCT DATA** |

Sekcija već nabraja tih pet/šest kodova u tekstu (`baslacClearcoats`), pa je
raskorak između teksta i kataloga ovde najvidljiviji.

### B.5 Prajmeri i punioci — `primer-process`

| Polje | Vrednost |
| --- | --- |
| Sekcija | Prajmeri (`#primers`) |
| Komponenta | `BaslacBrandPage.tsx` → `PrimerSection` |
| Očekivana putanja | `/images/brands/baslac/primers/baslac-primer-process.webp` |
| Asset postoji | **Ne** |
| Potreban tip fotografije | Priprema podloge / nanošenje primer-fillera |
| Odnos / min. rezolucija | 1400 × 1050 (4:3) |
| Proizvodi koji bi se tu pojavili | `20-22`, `20-24`, `20-34`, `20-94`, `20-35`, `20-95`, `25-30`, `27-10`, `21-10`, `21-11`, `21-20` — svi imaju TDS, **nijedan nije u katalogu** |
| Status | **NEEDS PRODUCT DATA** |

### B.6 Sive nijanse — `BaslacGreyShade`

| Polje | Vrednost |
| --- | --- |
| Sekcija | Sive nijanse (`#grey-shade`) |
| Komponenta | `components/baslac-brand/BaslacGreyShade.tsx` |
| Vizuelni tip | **Nije foto slot** — CSS/SVG prikaz nijansi, bez `BaslacMediaSlot` |
| Asset potreban | Ne |
| Status | **READY** |

Napomena: dva zvanična Grey Shades postera (`20-24/-34/-94` i `20-35/-95`)
postoje kao PDF i objavljena su kroz `/katalozi`, ali nisu vezana za ovu sekciju.

### B.7 Digitalna koloristika — `color-workflow`

| Polje | Vrednost |
| --- | --- |
| Sekcija | Koloristika (`#koloristika`) |
| Komponenta | `BaslacBrandPage.tsx` → `ColorWorkflow` |
| Očekivana putanja | `/images/brands/baslac/color/baslac-color-workflow.webp` |
| Asset postoji | **Ne** |
| Potreban tip fotografije | Mixing radna stanica: merni uređaj, vaga, mixing bank, test karta |
| Odnos / min. rezolucija | 1600 × 900 (16:9) |
| Proizvodi koji bi se tu pojavili | e-finder star, Formula Finder, Refinity — **nijedan nije proizvod u podacima i ni za jedan ne postoji dokument** |
| Status | **NEEDS ASSET** |

Sekcija imenuje e-finder star, Formula Finder i Refinity u tekstu. To su
platformski/alatni pojmovi, ne katalogovani artikli, pa se ovde ne traži product
data — traži se fotografija.

### B.8 Komercijalna vozila — `commercial-vehicles`

| Polje | Vrednost |
| --- | --- |
| Sekcija | Komercijalna vozila (`#commercial`) |
| Komponenta | `BaslacBrandPage.tsx` → `CommercialSection` |
| Očekivana putanja | `/images/brands/baslac/commercial/baslac-commercial-vehicles.webp` |
| Asset postoji | **Ne** |
| Potreban tip fotografije | Kamion, autobus ili prikolica u lakirnici — velika površina |
| Odnos / min. rezolucija | 1600 × 1050 (~3:2) |
| Proizvodi koji bi se tu pojavili | `30 Line CV`, `81-30 Additive Chassis`, `51-515/-520/-530` hardeneri — svi imaju TDS, **nijedan nije u katalogu** |
| Status | **NEEDS PRODUCT DATA** |

### B.9 Katalog preview — `catalogImage`

| Polje | Vrednost |
| --- | --- |
| Sekcija | Svi proizvodi (`#products`) |
| Komponenta | `BaslacBrandPage.tsx` → `CatalogPreview`, `next/image` sa `fill` |
| Asset | Product slike iz `productImage.src`, filtrirane da isključe placeholder |
| Trenutno prikazuje | 4 proizvoda iz odeljka A |
| Potreban tip fotografije | Packshot na čistoj podlozi |
| Odnos / min. rezolucija | ~4:3, min. 800 × 600; postojeće su 724 × 724 do 1100 × 1422 |
| Status | **IDENTITY CONFLICT** — sve četiri kartice se renderuju, ali tri nose fotografiju koja ne odgovara proizvodu (vidi A.1, A.3, A.4), a dve dele isti fajl |

### B.10 Dokumentacija — `DocumentCard` cover

| Polje | Vrednost |
| --- | --- |
| Sekcija | Tehnička dokumentacija |
| Komponenta | `components/documents/DocumentCard.tsx` preko `getFeaturedDocuments("baslac")` |
| Asset | `/brands/baslac/documents/*-cover.webp` |
| Postoji | **Da** — 15 cover fajlova na disku za 15 baslac zapisa |
| Renderuje se | 3 (`featured: true`): System Chrome Silver, Plastic Repair System (VOC), System Carbon Fibre |
| Status | **READY** |

Preostalih 12 baslac vodiča ima cover i dostupno je preko `/katalozi?brand=baslac`,
samo nije `featured` na brand stranici.

### B.11 Brend logo

| Polje | Vrednost |
| --- | --- |
| Asset | `/brands/baslac.svg` |
| Postoji | Da |
| Status | **READY** |

Napomena: logo se više ne prikazuje u herou (hero je sada kampanjski slider).
Ostaje u upotrebi na `/brendovi` i u katalogu.

### B.12 Rezime B

| Status | Broj slotova |
| --- | --- |
| READY | 4 (hero, sive nijanse, dokumentacija, logo) |
| NEEDS ASSET | 2 (repair-rhythm, color-workflow) |
| NEEDS PRODUCT DATA | 4 (45 Line, clearcoats, primeri, komercijalna vozila) |
| IDENTITY CONFLICT | 1 (katalog preview) |

---

## C. Provera prioritetnih grupa

Za svaku grupu: postoji li u product podacima, postoji li dokument, i kako je
klasifikovana. „Dokument postoji" znači fajl na disku **i** zapis u
`data/knowledge/baslac-documents.generated.json` sa `sourceUrl` na zvanični
baslac TDS indeks.

| # | Grupa | U katalogu | Dokument | Slika | Napomena |
| --- | --- | --- | --- | --- | --- |
| 1 | **45 Line + 45-R45, 45-W10** | Ne | Da — `45_Line.pdf` („45 Line Basecoat"), `45-R45.pdf` („45-R45 Dilutant"), `45-W10.pdf` („45-W10 3-Stage Additive and Blending Clear"), `45_Line_variant_49.pdf`, `45_Line_variant_50-45.pdf` | Ne | Kompletan dokumentacioni set, nula proizvoda |
| 2 | **40-100, 40-510, 40-450** | Ne | Da — „40-100 High Speed 2K Clear VOC", „40-510 Ambient clear", „40-450 Universal Clear VOC" (+3 varijante) | Ne | Sekcija B.4 ih već imenuje u tekstu |
| 3 | **20-24, 25-30, 27-10, 12-20** | Ne | Da — „20-24 2K Primerfiller, grey" (+4 varijante), „25-30 2K Primerfiller EP" (+wet-on-wet), „27-10 2K Washprimer", „12-20 Bodyfiller Universal" | Ne | — |
| 4 | **35-M i 49-W linije** | Delimično | **Ne za tražene oznake** | Delimično | Vidi napomenu ispod |
| 5 | **80-20, 80-30** | Ne | Da — „80-20 Additive Mat", „80-30 Additive Plast" (postoji i „80-10 Additive Flex") | Ne | — |
| 6 | **Ambient Clear + hardener** | Ne | Da — `40-510` „Ambient clear"; hardeneri `50-510` „Ambient Clear Hardener", `50-530` „Ambient Clear Hardener slow" | Ne | Par proizvod+hardener je potpun u dokumentaciji |
| 7 | **Antisilikon i drugi aditivi** | Ne | **Nema dokumenta pod imenom „antisilikon"** | Ne | Vidi napomenu ispod |
| 8 | **e-finder Star** | Ne | **Ne** — nula pogodaka u 102 dokumenta | Ne | Postoji samo kao tekst na stranici |
| 9 | **Mixing machine / tinting chart** | Ne | **Ne za mixing machine.** Postoje 4 zvanična colour-chart/poster PDF-a: dva Grey Shades postera, „Gloss levels – Mat finish", „Gloss levels – baslac 30 Line CV", plus dva Temperature Chart-a | Ne | „Tinting chart" u traženom smislu ne postoji; postoje grey-shade i gloss posteri |
| 10 | **Refinity** | Ne | **Ne** — nula pogodaka | Ne | Nema odobrenog assetа; stranica ga već tretira kao digitalnu platformu, ne proizvod |

### C.1 Napomena uz grupu 4 (`35-M` / `49-W`)

Ovo zahteva pažljivo čitanje, jer se traženo i postojeće ne poklapaju.

- **`35-M…`**: u katalogu postoje dva zapisa (`35-M214`, `35-M331`), ali
  **nijedan od 102 dokumenta ne nosi oznaku `35-M`**. Postoje samo listovi linije:
  `35_Line.pdf` („35 Line Basecoat") i `35_Line_variant_49.pdf`. Zajednički
  prefiks linije nije identitet komponente — kačenje lista linije na konzervu
  objavilo bi tačno izgledajuću netačnu informaciju. Oba zapisa su uz to
  identitetski sporna (A.2, A.3).
- **`49-W`**: **ne postoji kao linija ni u jednom izvoru u repozitorijumu.**
  Jedino što se približava je oznaka „variant 49-" unutar listova linija 35 i 45
  (`35_Line_variant_49.pdf`, `45_Line_variant_49.pdf`), gde je `49-` oznaka
  varijante procesa, ne zasebna linija proizvoda. Odvojeno od toga postoji
  `45-W10`. Ne mogu potvrditi da „49-W linija" postoji — ne uvodim je.

### C.2 Napomena uz grupu 7 (antisilikon)

U 102 dokumenta nema nijednog sa rečju „antisilicone" / „silicone remover".
Najbliži stvarni proizvodi za čišćenje su:

- `70-20.pdf` — „70-20 Cleaner Plastic"
- `70-45.pdf` — „70-45 Cleaner"
- `Cleaners.pdf` — „Pre-treatment of substrates and old paintwork" (objavljen vodič)

Stvarni aditivi sa dokumentom: `80-10 Additive Flex`, `80-20 Additive Mat`,
`80-30 Additive Plast`, `81-30 Additive Chassis`, `57-10 Additive Washprimer`,
`57-30 Additive Washprimer slow`, `65-10 Blending Reducer`.

**Nalaz koji traži ispravku podataka:** `baslacProcessSteps` u
`baslacBrandData.ts` navodi `70-10` (korak „Čišćenje") i `11-40` (korak „Kit").
**Ni za jedan od ta dva koda ne postoji dokument u zvaničnom indeksu.** Ostali
kodovi navedeni u istoj strukturi (`70-20`, `70-45`, `12-20`, `56-20`, `25-30`,
`27-10`, `20-*`, `21-*`, `40-*`, `50-*`, `65-10`) svi imaju dokument. To su jedina
dva nepotvrđena koda na stranici.

### C.3 Šta ovo znači operativno

Devet od deset prioritetnih grupa **ima kompletnu zvaničnu dokumentaciju na
disku i nula proizvoda u katalogu**. Uska grla nisu dokumenti nego:

1. odluka koji se baslac artikli stvarno drže na stanju,
2. packshot fotografije za te artikle.

Do prve odluke, dodavanje slika bez proizvoda ne otključava nijednu sekciju.

---

## D. Konačna lista za korisnika

### MUST HAVE

| Prioritet | Potrebna slika | Proizvod / sistem | Gde ide | Preporučen format | Zašto je potrebna |
| --- | --- | --- | --- | --- | --- |
| 1 | Packshot razređivača 60-20 (5 L) | `baslac-60-20-razredjivac` | `#products`, PDP, katalog | 1600 × 1200, 4:3, WebP, bela/neutralna podloga | Trenutna slika prikazuje `45-W1150 Yellow Basecoat` — pogrešan proizvod na javnoj stranici |
| 2 | Packshot artikla `35-M214` | `baslac-35-m214` | `#products`, PDP, katalog | 1600 × 1200, 4:3, WebP | Deli isti fajl sa 60-20; dva proizvoda, jedna fotografija |
| 3 | Packshot artikla `30-S510` | `baslac-30-s510-s-serija` | `#products`, PDP, katalog | 1600 × 1200, 4:3, WebP | Etiketa na slici čita `35-M1020` — pogrešan proizvod |
| 4 | Packshot artikla `35-M331` | `baslac-35-m331-pasta` | `#products`, PDP, katalog | 1600 × 1200, 4:3, WebP | Etiketa čita „Basecoat", zapis kaže pasta za poliranje — konflikt vidljiv korisniku |
| 5 | Radionička scena: povezane faze popravke | Proces (20- serija → 35/45 Line → clear) | `#repair-rhythm`, `BaslacRepairRhythm` | 1600 × 1000 desktop **i** 900 × 1125 mobilni, WebP | Najveći slot na stranici, `priority: "highest"`, sada prikazuje placeholder |

### SHOULD HAVE

| Prioritet | Potrebna slika | Proizvod / sistem | Gde ide | Preporučen format | Zašto je potrebna |
| --- | --- | --- | --- | --- | --- |
| 6 | Mixing sistem 45 Line / aplikacija vodene baze | `45 Line`, `45-R45`, `45-W10` | `#color-systems`, `line45Feature` | 1400 × 1050, 4:3, WebP | 45 Line je istaknut kao glavni vodeni sistem, a nema nijedan vizual |
| 7 | Grupni packshot bezbojnih lakova | `40-100`, `40-510`, `40-440`, `40-450`, `40-10`, `40-620` | `#clearcoats` | 1600 × 1000, 16:10, WebP | Sekcija nabraja šest kodova bez ijedne slike |
| 8 | Priprema podloge / nanošenje primer-fillera | `20-24`, `20-35`, `25-30`, `27-10`, `21-*` | `#primers` | 1400 × 1050, 4:3, WebP | Pet funkcija podloge opisano samo tekstom |
| 9 | Mixing radna stanica (uređaj, vaga, mixing bank, test karta) | e-finder star, Formula Finder | `#koloristika` | 1600 × 900, 16:9, WebP | Jedini vizual za ceo koloristički tok |
| 10 | Komercijalno vozilo u lakirnici | `30 Line CV`, `81-30`, `51-*` | `#commercial` | 1600 × 1050, ~3:2, WebP | CV program nema nijednu fotografiju |

### OPTIONAL

| Prioritet | Potrebna slika | Proizvod / sistem | Gde ide | Preporučen format | Zašto je potrebna |
| --- | --- | --- | --- | --- | --- |
| 11 | Veći original jubilarnog artworka (20 godina) | Brend kampanja | Hero slajd 1 | ≥1600 px po dužoj stranici, PNG/WebP sa alfom | Isporučeni original nosi samo 718 px korisne širine; veći bi dao punu 2× oštrinu na retina ekranima |
| 12 | Packshot-i aditiva `80-10`, `80-20`, `80-30` | Aditivi | Buduća sekcija aditiva / katalog | 1200 × 1200, 1:1, WebP | Dokumentacija postoji; slike bi omogućile objavu kada se artikli dodaju |
| 13 | Packshot-i čistača `70-20`, `70-45` | Priprema podloge | `#primers` / katalog | 1200 × 1200, 1:1, WebP | Stvarna zamena za nepostojeći „antisilikon" |
| 14 | Fotografija e-finder star uređaja | Koloristika | `#koloristika`, blok `colorTools` | 1200 × 1200, 1:1, WebP sa alfom | Trenutno samo tekstualna kartica |

### Namerno NIJE na listi

- **Refinity vizuali** — ne postoji odobren asset u repozitorijumu, a stranica
  ga korektno predstavlja kao digitalnu platformu. Traženje slike bez odobrenog
  izvora nosi rizik pogrešnog brendiranja.
- **Tinting chart** — ne postoji kao dokument. Postoje grey-shade i gloss
  posteri, koji su već objavljeni kroz `/katalozi`.
- **Bilo šta za „49-W liniju"** — ne mogu potvrditi da postoji (vidi C.1).

---

## E. Otvorena pitanja za vlasnika podataka

Redom po posledici. Nijedno ne rešavam nagađanjem.

1. **Šta je stvarno `35-M331`?** Pasta za poliranje ili mixing komponenta linije
   35? Od odgovora zavise i program i faza na javnoj stranici.
2. **Koji sistem linije 30 je `30-S510`** — standardni Topcoat ili CV Topcoat?
   Različiti hardeneri, različit recept mešanja.
3. **Da li je `35-M214` mixing baza linije 35?** Postoje tri različite tvrdnje u
   repozitorijumu (faza „lak", oznaka basecoat, ranija beleška „hardener").
4. **Postoje li `70-10` i `11-40` kao stvarni baslac artikli?** Navedeni su u
   `baslacProcessSteps`, ali nemaju dokument u zvaničnom indeksu.
5. **Postoji li „49-W linija"?** U repozitorijumu ne postoji nijedan trag.
6. **Koji baslac artikli se stvarno drže na stanju?** To određuje koji od 87
   per-SKU listova uopšte treba da dobiju stranicu, i za koje artikle ima smisla
   naručivati fotografije.

---

## F. Nusnalaz

`docs/OFFICIAL_ASSET_AUDIT.md:82` referiše `hero-system` media slot kao
„MISSING REAL ASSET / P0". Taj slot je ovim zadatkom uklonjen — hero sada koristi
stvarne kampanjske assete. Red u tom dokumentu je zastareo. Nisam ga menjao jer
je izvan obima ovog zadatka.

---

## G. Napomena o skladištenju izvornih fajlova

Dva isporučena originala kopirana su u
`assets/manufacturer/baslac/campaign/` sa produkcionim nazivima:

- `baslac-20-years-header-source.webp` (3440 × 1440, RGBA)
- `baslac-surventis-header-source.webp` (3440 × 1440, RGB)

Taj folder je **gitignorovan** (`.gitignore:70` — `assets/manufacturer/`), po
postojećoj konvenciji projekta za izvorne materijale proizvođača (isto važi za
carsystem, carfit, cosmos-lac, norbin). Originali zato ostaju lokalni.

Posledica: `npm run baslac:campaign-assets` ne može da se pokrene iz čistog
klona. Izvedeni produkcioni asseti u `public/images/brands/baslac/campaign/`
**jesu** verzionisani, pa sajt radi bez originala — ali ponovna derivacija
zahteva da originali budu vraćeni u taj folder. Ako se želi puna
reproducibilnost, originale treba prebaciti u verzionisani folder ili dodati
izuzetak u `.gitignore`. Nisam menjao `.gitignore` jer bi to promenilo pravilo
koje važi za sve brendove.
