# SATA — Content & Asset Map

**Datum:** 2026-08-20
**Vezano za:** `docs/SATA_RESEARCH.md`, `docs/SATA_IMPLEMENTATION_QA.md`
**Metod:** iscrpna pretraga repozitorija (`public/`, `assets/`, `data/`, `docs/`,
`_incoming/`, `artifacts/`, `tmp/`) po obrascima `sata`, `SATA`, `satajet`,
`X 5500`, `x5500`, plus provera svih `scripts/acquire-*`, `extract-*`, `match-*`
pipeline-ova.

---

## 1. Šta lokalno postoji

| Asset | Putanja | Format | Dimenzije | Kvalitet | Izvor | Upotrebljivost |
|---|---|---|---|---|---|---|
| SATA logo | `public/brands/sata.svg` | SVG | 500 × 172 | Vektor, čist, bez alfa kanala — bela pozadinska ploča pa crveni `#E2001A` sloj preko nje | nepoznat (u repou od 2026-06-30) | **Upotrebljivo** za logo ploče i navigaciju; koristi se u `BrandLogoPlate`, `Footer`, `navigation-data` |
| SATA manifest | `data/knowledge/brands/sata.manifest.generated.json` | JSON | — | Generisan 2026-08-08, prazan `families` i `products` | interni pipeline | Interna evidencija, ne prikazuje se |
| Brand source zapis | `data/knowledge/brand-sources.ts` (`sata` ključ) | TS | — | Tačan, ali zastareo (navodi da lokalno imamo 1 proizvod — i dalje tačno) | interno | Interno |
| Katalog stavka | `lib/carsystem-data.ts` → `satajet-x-5500` | TS | — | Očišćen 2026-08-20 (vidi QA) | interno | Objavljeno na `/proizvodi/satajet-x-5500` |

## 2. Šta lokalno NE postoji

| Kategorija | Status | Dokaz |
|---|---|---|
| Fotografije SATA proizvoda | **0** | Nema `public/products/sata/`, nema `public/brands/sata/` podfoldera |
| SATA PDF dokumenti | **0** | Nema `public/documents/*sata*`, nema `assets/manufacturer/sata/` |
| SATA TDS/SDS ekstrakcije | **0** | Nema `data/knowledge/sata-*.generated.json` |
| SATA katalog | **0** | `getDocumentBrandSlugs()` ne vraća `sata`, pa se brend ne pojavljuje ni u `/katalozi` filteru |
| Potvrda distributerskog statusa | **0** | Nema nijednog dokumenta ni zapisa |
| Cenovnik / lager | **0** | — |

Ovo se poklapa sa ranijim nalazima: `docs/DISTRIBUTOR_DOCUMENT_GAP_REPORT.md`
(„None found… Entire document set") i `docs/CONTENT_ASSET_GAP_AUDIT.md`
(„1 proizvod, 0 sa slikom").

## 3. Kako je stranica završena bez slika

Nijedna sekcija ne koristi sivi placeholder blok. Vizuelni teret nose:

| Sekcija | Vizuelno rešenje | Fajl |
|---|---|---|
| Hero | Tipografija + tri mono readouta + SVG kriva odstupanja pritiska | `SataDiagrams.tsx` → `SataPressureTrace` |
| Radni sistem → priprema vazduha | SVG prikaz tri stepena filtracije sa rastućom gustinom rastera i deklarisanim granicama | `SataDiagrams.tsx` → `SataFilterStack` |
| Tehnologija → mlaznice | Dva SVG oblika mlaza (`I` izdužen/suvlji centar, `O` ovalan/vlažno jezgro) | `SataDiagrams.tsx` → `SataSprayFan` |
| Program, izbor, servis | Linijski sistem — grid od 1 px linija, mono oznake, bez ilustracija | `SataBrandPage.module.css` |
| Kod nas | Sistemski „vizuel u pripremi" prikaz `ProductVisualSurface` | deljena komponenta |

Svi dijagrami su `aria-hidden` — podatak koji nose postoji i u tekstu pored njih.
Nijedan nije reprodukcija SATA grafike ni prikaz proizvoda.

## 4. Asset gap manifest

Prioritet: **P1** blokira kredibilitet stranice, **P2** je jasno poboljšanje,
**P3** je nice-to-have.

### P1 — packshot za `satajet-x-5500`

| Polje | Vrednost |
|---|---|
| Predloženi naziv | `public/products/sata/satajet-x-5500-body-three-quarter.png` |
| Tačan proizvod | SATAjet X 5500, standardna izvedba (ne PHASER, ne Custom Design Gun) |
| Ugao | Tri četvrtine, telo pištolja ka gledaocu, čaša montirana |
| Pozadina | Transparentna |
| Odnos stranica | 4:5 ili 1:1 |
| Min. rezolucija | 1600 px po dužoj strani |
| Transparentnost | Da (alfa) |
| Sekcija | „Kod nas" kartica i `/proizvodi/satajet-x-5500` PDP |
| Zvanični izvor | https://www.sata.com/en-amn/products/spray-guns/gravity-flow-cup-guns/satajet-x-5500 |
| Prava korišćenja | **Nepotvrđena** — traži se pisana dozvola ili asset od distributera |

### P1 — potvrda komercijalnog statusa

| Polje | Vrednost |
|---|---|
| Šta nedostaje | Da li Carsystem i R-M uopšte prodaje SATA opremu, i pod kojim uslovima |
| Zašto blokira | Bez toga stranica sme da bude samo informativna; svaki CTA mora ostati neutralan („provera dostupnosti") |
| Sekcija | „Kod nas", hero sekundarni CTA, `presentation` tekstovi |
| Izvor | Interno — vlasnik |
| Prioritet | P1 |

### P2 — hero motiv

| Polje | Vrednost |
|---|---|
| Predloženi naziv | `public/products/sata/sata-hero-gun-detail.png` |
| Motiv | Detalj mlaznice ili mikrometra, makro, hladno svetlo |
| Ugao | Makro, plitka dubina polja |
| Pozadina | Tamna ili transparentna |
| Odnos stranica | 3:2, landscape |
| Min. rezolucija | 2400 px po dužoj strani |
| Transparentnost | Poželjna |
| Sekcija | Hero (`.heroVisual`), kao dopuna readout panelu, ne kao zamena |
| Zvanični izvor | https://www.sata.com/en/ |
| Prava | **Nepotvrđena** |

### P2 — dokumenti po artiklu

| Polje | Vrednost |
|---|---|
| Šta nedostaje | Operating Instructions i Declaration of Conformity za konkretne artikle koje bismo držali |
| Zašto | Sekcija „Servis" trenutno upućuje na `sata.com` umesto na lokalni dokument |
| Zvanični izvor | Download blok na svakoj product detail stranici, npr. art. 1061564 i art. 1200386 |
| Prava | **Nepotvrđena** — dokumenti su javno dostupni, ali redistribucija nije potvrđena |
| Prioritet | P2 |

### P3 — packshotovi za širi program

Ako se program proširi, isti šablon važi za: `jet X`, `jet K`,
`SATAjet 100 B F`, `SATAminijet 4400 B`, `SATA filter 500 series`,
`adam X pro`, `LCS`. Bez potvrđenog komercijalnog statusa nemaju gde da idu —
ne dodavati ih u katalog samo zato što postoji slika.

## 5. Pravila koja su primenjena

1. **Nema hotlinkovanja.** Nijedna slika se ne učitava sa `sata.com`.
2. **Nema preuzetih fotografija u produkciji.** Zvanični materijal je korišćen
   isključivo kao referenca u istraživanju.
3. **Nema izmišljenih dokumenata.** Sekcija „Servis" eksplicitno kaže da
   nemamo objavljene SATA tehničke listove.
4. **Nema generisanih „tehničkih" slika proizvoda.** SVG dijagrami prikazuju
   odnose (stepeni filtracije, oblik mlaza), ne proizvode.
