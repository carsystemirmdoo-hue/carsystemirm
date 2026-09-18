# OFFICIAL ASSET AUDIT — Carsystem / R-M / baslac

**Datum:** 2026-08-09
**Grana:** `recovery/pre-claude-2026-08-07`
**Izvor:** `~/Desktop/царсзстем слике` — 23 fajla (22 PDF + 1 PNG). Napomena: folder se zove `царсзстем`, ne `царсистем`.
**Obim:** samo Carsystem, R-M, baslac. Befar, Norbin, SATA, Rupes, C.A.R.FIT nisu dirani.

> **Napomena (2026-09-18):** BASF Coatings od 1. jula 2026. posluje kao samostalna kompanija **Surventis** (BASF SE zadržava 40 %). R-M i baslac su zadržali nazive. Gde ovaj audit kaže „tražiti od BASF”, danas se misli na Surventis / baslac. Tekst audita ispod je ostavljen kakav je bio na dan izrade.

**Metod:** forenzička analiza svakog PDF-a (broj strana, embedded raster XObjects, native rezolucija, DPI na mestu postavljanja, vektorski sadržaj, tekstualni sloj), zatim vizuelni pregled svake strane, pa mapiranje na stvarne media slotove deklarisane u `baslacBrandData.ts`, `carsystemBrandData.ts`, `rmBrandData.ts`.

**Nije menjan nijedan original.** Ništa nije kopirano u projekat. Sve probne izrezane slike su u scratchpad folderu radi odobrenja.

---

## 0. TRI NALAZA KOJI MENJAJU PRIORITET

### 0.1 — Postoji jedan asset koji rešava ceo Carsystem hero problem

`4C6FD15B-9C0E-42B5-9570-7DEC33600031.png` nije nasumičan fajl. To je **9449×7087 RGBA PNG sa transparentnom pozadinom** — kompletan Carsystem asortiman kao izrezana grupa (Multi Black Rapid, KS-1000, Uniflex PU/Glas, X-PRESS CC.20/CC.21, X-PERT, F.19, maska, disk, kanta). Trimovan na alfa granicu: **9126×4525**.

Bez pozadine, bez tipografije, bez postera. Može se komponovati na bilo koju pozadinu, u bilo kom formatu, desktop i mobile. To je najvredniji pojedinačni fajl u celom folderu.

### 0.2 — baslac praktično nema upotrebljiv materijal za svoje slotove

baslac ima 6 fajlova, ali to su **samo 2 jedinstvena vizuala** (Simple Choice, Perfect Balance) u 2 boje × 2 formata. Oba su **kampanjska ilustracija**, ne produkt/proces fotografija.

baslac stranica traži 10 slotova: sistem proizvoda, 45 Line u primeni, digitalni koloristički alati, sušenje, faze popravke, mixing sistem, grupa bezbojnih lakova, primer proces, e-finder/vaga/mixing stanica, komercijalno vozilo.

**Nijedan od tih 10 ne postoji u official materijalu.** Jedina prava fotografija u celom baslac setu je ruka sa pištoljem za farbanje na ravnoj pozadini. Sve ostalo je linijska ilustracija.

To znači: baslac gap se **ne može zatvoriti iz ovog foldera**. Mora se tražiti od BASF/baslac.

### 0.3 — R-M je već pokriven, ali su derivati poddimenzionisani

Svih 12 R-M campaign fajlova postoji. Ali su generisani na **1600×900**, dok su masteri 5724–7489 px široki. Na 2K/4K ekranu full-bleed hero na 1600px vidljivo omekša. Regeneracija na 2400×1350 je moguća iz istih izvora, bez ikakve nove nabavke — i to mogu sam.

---

## 1. INVENTAR IZVORA — šta je svaki fajl zapravo

| # | Fajl | Brend | Šta je | Native raster | Struktura |
|---|------|-------|--------|---------------|-----------|
| 1 | `4C6FD15B-…31.png` | Carsystem | Asortiman, izrezan | **9449×7087 RGBA** | čist cutout, bez tipografije |
| 2 | `BRAND DESIGN-2024.pdf` | Carsystem | Packaging brand guideline, 9 str. | 5033×3580 /str. | **flattened raster** — tipografija zapečena, klaster se mora izrezati |
| 3 | `Premium Putty & Sanding Solutions_V4.pdf` | Carsystem | Brošura, 2 str. | 565–570 px | **144 DPI screen PDF** — makro foto neupotrebljive u punoj veličini |
| 4 | `CARSYSTEM_logo_red.pdf` | Carsystem | Logo | 2362×2362 | već imamo `/brands/carsystem.svg` |
| 5 | `PREZENTACIJA CS I R-M.pdf` | Firma | Prezentacija firme, 5 str. | 2550×3300 /str. | flattened; magacin + trening centar, telefonske fotke |
| 6 | `Baslac POSTER_1.pdf` | baslac | Landscape poster, bela verzija | **9449×7087 flat JPEG** | 1 slika, tipografija zapečena |
| 7 | `Baslac POSTER_2.pdf` | baslac | Landscape poster, plava verzija | **9449×7087 flat JPEG** | isto |
| 8 | `baslac_Simple_Choice_{blue,white}_A1_EN.pdf` | baslac | A1 portret | ~9170 px ekvivalent | **tile-flattened** (40 pločica) — koristiti landscape verziju |
| 9 | `baslac_Perfect_Balance_{blue,white}_A1_EN.pdf` | baslac | A1 portret | ~9170 px ekvivalent | isto |
| 10 | `R-M poster A1 refinity.pdf` | R-M | Refinity kampanja | 7489×5238 | ✅ već iskorišćen |
| 11 | `R-M_eSense_Poster_A1.pdf` | R-M | eSense kampanja | 7033×10419 | ✅ već iskorišćen |
| 12 | `R-M_AGILIS_VPU_Poster_A1_…Screen-2.pdf` | R-M | Agilis kampanja | 5817×8114 | ✅ već iskorišćen |
| 13 | `…Screen-4.pdf` / `…active_05.pdf` | R-M | Agilis varijante | 5724×7983 / 5930×8264 | alternativni kadrovi |
| 14 | `…Screen-1.pdf` | R-M | Agilis varijanta | tiled (111 pločica) | najlošiji izvor od Agilis setа |
| 15 | `R-M_Emil-Frey-Racing_.pdf` | R-M | Partnerstvo | — | ✅ već iskorišćen |
| 16 | `R-M OEM Poster.pdf` | R-M | OEM odobrenja | **7209×10348** | žuti pickup + zid logotipa proizvođača |
| 17 | `R-M OEM Poster copy.pdf` | R-M | — | — | **bajt-identičan duplikat** (isti MD5) |
| 18 | `RM POSTER - 2.pdf` | R-M | Refinity + Agilis, spojeni | 9449×7087 | isti vizuali kao #10/#12 |
| 19 | `RM POSTER - 3.pdf` | R-M | eSense + OEM, spojeni | 9449×7087 | isti vizuali kao #11/#16 |
| 20 | `Agilis R-M Presentation.pdf` | R-M | B2B prezentacija, 11 str. | do 2397×826 | interni sales deck; **ARRANGE mixing stanica na str. 5** je prava fotografija |

---

## 2. OBAVEZNA MAPA — OFFICIAL ASSET → BRAND → STRANICA → SEKCIJA

| Brand | Source Asset | Page | Section | Purpose | Action | Human Required | Priority |
|---|---|---|---|---|---|---|---|
| Carsystem | `4C6FD15B…png` (9126×4525 cutout) | `/brendovi/carsystem` | Hero 1 | Ceo program kao jedan sistem | PREPARE BANNER | Ne — ali traži odobrenje `alt`/copy | **P0** |
| Carsystem | BRAND DESIGN str. 5 → X-PRESS/X-PERT klaster (2416×2613) | `/brendovi/carsystem` | `process-application` | Lak + filler + hardener + razređivač kao sistem | EXTRACT FROM PDF | Ne | **P0** |
| Carsystem | BRAND DESIGN str. 2 → BASIC red klaster (2466×3043) | `/brendovi/carsystem` | `process-preparation` | Zaštita, lepak, primer, čišćenje | EXTRACT FROM PDF | Ne | P1 |
| Carsystem | BRAND DESIGN str. 4 → BASIC BLACK klaster (2466×2757) | `/brendovi/carsystem` | — nema slot | Oprema/zaštita | EXTRACT, DRŽATI U REZERVI | Ne | P2 |
| Carsystem | BRAND DESIGN str. 9 → „EXPERIENCE. INNOVATION. QUALITY." + 30 YEARS | `/brendovi/carsystem` | Brand identitet | Potvrđen official claim (bezbedan copy) | USE DIRECTLY (kao copy) | Ne | P1 |
| Carsystem | `Premium Putty…V4` str. 2 makro foto (565–570 px) | `/brendovi/carsystem` | `process-*` | — | **DO NOT USE** na 1600×1050 | Da — tražiti print-res original | P1 |
| Carsystem | `Premium Putty…V4` str. 1 — 4-koračni dijagram | `/vodici` | Proces pripreme | Tehnički sadržaj, ne banner | EXTRACT (kao referenca) | Ne | P2 |
| Carsystem | — | `/brendovi/carsystem` | `hero-painting`, `hero-finishing` | Kabina / poliranje | **NEW PHOTO REQUIRED** | **Da** | **P0** |
| Carsystem | — | `/brendovi/carsystem` | `workflow-damage/prepared/painted/finished` | 4-fazna priča o panelu | **NEW PHOTO REQUIRED** | **Da** | P1 |
| Carsystem | `CARSYSTEM_logo_red.pdf` | — | — | Već postoji SVG | **DO NOT USE** | Ne | — |
| baslac | `Baslac POSTER_2` → pištolj, izrez (2787×3863) | `/brendovi/baslac` | Hero (jedan slot) | Application/brand banner | PREPARE BANNER | Ne — ali `alt` ne odgovara | **P0** |
| baslac | `Baslac POSTER_1/2` → Perfect Balance art (4442×4111) | `/brendovi/baslac` | Hero (jedan slot) | Brand filozofija: kvalitet/cena | PREPARE BANNER | Ne — `alt` ne odgovara | P1 |
| baslac | `Baslac POSTER_1` → limenka 1L (1464×1913) | `/brendovi/baslac` | Produkt akcenat | Jedini pravi baslac packshot | EXTRACT FROM PDF | Ne | P2 |
| baslac | — | `/brendovi/baslac` | `hero-system` | Kompletan asortiman | **MISSING REAL ASSET** | **Da — od BASF** | **P0** |
| baslac | — | `/brendovi/baslac` | `repair-rhythm` (`priority: highest`) | Faze popravke | **MISSING REAL ASSET** | **Da — od BASF** | **P0** |
| baslac | — | `/brendovi/baslac` | `line-45-system`, `clearcoat-range`, `primer-process` | Produkt grupe | **MISSING REAL ASSET** | **Da — od BASF** | P1 |
| baslac | — | `/brendovi/baslac` | `color-workflow` | e-finder, vaga, mixing | **MISSING REAL ASSET** | **Da — od BASF** | P1 |
| baslac | — | `/brendovi/baslac` | `commercial-vehicles` | Komercijalno vozilo | **MISSING REAL ASSET** | **Da — od BASF** | P2 |
| R-M | Refinity / eSense / Agilis / Emil Frey masteri | `/brendovi/rm` | Campaign hero + editorial | Regeneracija 1600→2400 px | PREPARE WEB DERIVATIVE | Ne | P1 |
| R-M | `Agilis R-M Presentation` str. 5 — ARRANGE mixing stanica (2397×826) | `/brendovi/rm` | Koloristika / mixing | Prava foto mixing banka, 2.9:1 | EXTRACT FROM PDF | Ne | P1 |
| R-M | `R-M OEM Poster` → žuti pickup (6921×3311, čist) | `/brendovi/rm` | — nema OEM sekciju | Wide editorial banner | PREPARE BANNER — **čeka odluku o sekciji** | Ne | P2 |
| R-M | `R-M OEM Poster` → zid logotipa proizvođača | — | — | 40+ tuđih žigova + „approved" tvrdnja | **DO NOT USE bez pravne potvrde** | **Da** | — |
| R-M | `Agilis R-M Presentation` ostale strane | — | — | Interni B2B deck, engleski | **DO NOT USE** | Ne | — |
| R-M | `RM POSTER - 2/3`, `…Screen-1`, `OEM Poster copy` | — | — | Duplikati/lošiji izvori | **DO NOT USE** | Ne | — |
| Firma | `PREZENTACIJA` str. 3 — magacin (4 foto, ~1150 px) | `/kontakt` ili „O nama" | Firma | Autentičan, ali telefonski snimak | HUMAN IMAGE EDIT | **Da** | P2 |
| Firma | `PREZENTACIJA` str. 4 — trening centar (4 foto) | „O nama" / edukacija | Obuke | Autentičan; **proveriti prava** (prostor se iznajmljuje) | HUMAN IMAGE EDIT | **Da** | P2 |
| Firma | `PREZENTACIJA` str. 1 i 5 — tekst | — | Copy | Osnovana 2009, Inđija, 7 zaposlenih; R-M od 1919, Detroit, BASF | USE DIRECTLY (kao copy) | Ne | P1 |

---

## 3. FINALNI CONTENT PROCUREMENT LIST

### A. ASSETS KOJE MOGU SAM DA PRIPREMIM

1. **Carsystem hero** — kompozit iz transparentnog PNG-a (9126×4525) na studijskoj pozadini, desktop 1800×1200 + mobile 900×1125.
2. **Carsystem `process-application`** — X-PRESS/X-PERT klaster iz BRAND DESIGN str. 5, izrez bez tipografije → 1600×1050.
3. **Carsystem `process-preparation`** — BASIC red klaster iz str. 2 → 1600×1050.
4. **baslac hero banner** — pištolj iz `Baslac POSTER_2`, izrez bez tipografije → desktop + mobile.
5. **baslac brand banner** — Perfect Balance art → desktop + mobile.
6. **baslac limenka** — izrez packshota, 1464×1913.
7. **R-M ARRANGE mixing banner** — 2397×826 iz prezentacije str. 5.
8. **R-M retina regeneracija** — svih 12 campaign fajlova 1600×900 → 2400×1350 iz postojećih mastera.
9. **R-M OEM pickup banner** — 6921×3311, čist, spreman kad se odluči gde ide.

### B. ASSETS KOJE TREBA TI DA OBRADIŠ

| # | Asset | Šta treba | Zašto ne mogu ja |
|---|-------|-----------|------------------|
| 1 | Magacin (PREZENTACIJA str. 3) | Retuš perspektive, ujednačavanje ekspozicije, uklanjanje nereda | Telefonske fotke ~1150 px; potreban je uređivački sud šta sme da se vidi, ne algoritamska obrada |
| 2 | Trening centar (PREZENTACIJA str. 4) | Isto + **potvrda prava korišćenja** | Tekst prezentacije kaže da se centar iznajmljuje — ne smem tvrditi da je vaš |
| 3 | Carsystem makro foto (putty brošura) | Nabaviti print-res original od Vosschemie | Izvor je 144 DPI / 570 px; upscale na 1600 px bi bio vidljivo mek |

### C. NOVI REALNI ASSETS KOJE MORAMO NABAVITI / SNIMITI

**C1 — Carsystem `hero-painting`** · P0
Nedostaje: kontrolisano lakiranje u kabini. Kompozicija: lakirer u kombinezonu, pištolj u pokretu, panel u prvom planu, kabinsko osvetljenje. Desktop 1800×1200, mobile 900×1125 (vertikalni kadar, ne crop). Gde: hero slajd 2.
Zašto ne AI: prikazuje stvarni proces sa stvarnim proizvodima — generisana slika bi bila izmišljena scena.

**C2 — Carsystem `hero-finishing`** · P0
Nedostaje: poliranje i kontrola sjaja. Kompozicija: polirka na laku, refleksija svetla, ruka u rukavici. Desktop 1800×1200, mobile 900×1125. Gde: hero slajd 3.

**C3 — Carsystem workflow serija (4 slike)** · P1
`damage → prepared → painted → finished`, **isti panel, ista pozicija kamere, 4 faze**. 1200×900 svaka. Ovo je jedno snimanje od pola dana u partnerskoj radionici i ne postoji ni u jednom katalogu — po definiciji mora biti vaš.

**C4 — baslac kompletan set (7 slotova)** · P0/P1
`hero-system`, `repair-rhythm`, `line-45-system`, `clearcoat-range`, `primer-process`, `color-workflow`, `commercial-vehicles`.
**Preporuka: ne snimati — tražiti od BASF.** baslac ima official brand media biblioteku; ovo su standardni asseti koje distributeri dobijaju. Traženje je jeftinije i brendski tačnije od snimanja.
Ako BASF ne isporuči: `repair-rhythm` i `line-45-system` se mogu snimiti lokalno, ostalo ne.

### D. ASSETS KOJE NE TREBA KORISTITI

| Asset | Razlog |
|-------|--------|
| `R-M OEM Poster copy.pdf` | Bajt-identičan duplikat (MD5 `6891b7eb…`) |
| `RM POSTER - 2/3.pdf` | Isti vizuali kao pojedinačni A1 posteri, samo spojeni |
| `…AGILIS…Screen-1.pdf` | Tile-flattened na 111 pločica; Screen-2/4 su čisti |
| `baslac_*_A1_EN.pdf` (sva 4) | Tile-flattened; landscape `Baslac POSTER_1/2` su isti vizuali kao jedan čist JPEG |
| OEM zid logotipa proizvođača | 40+ tuđih žigova + „approved by" tvrdnja — pravni rizik, protivno pravilu o brand safety u `CLAUDE.md` |
| `Agilis R-M Presentation` str. 1–4, 6–11 | Interni B2B sales deck na engleskom, tržišne projekcije — nije za javni sajt |
| `CARSYSTEM_logo_red.pdf` | `/brands/carsystem.svg` je bolji (vektor) |
| Carsystem makro foto na 1600×1050 | 144 DPI izvor, 570 px maksimum |

### E. BANNERI KOJE PREPORUČUJEM

| Banner | Brand | Source | Page | Section | Desktop | Mobile | Ko priprema |
|---|---|---|---|---|---|---|---|
| Ceo program kao sistem | Carsystem | `4C6FD15B…png` | `/brendovi/carsystem` | Hero 1 | 1800×1200 | 900×1125 | **Ja** |
| Lak + filler sistem | Carsystem | BRAND DESIGN str. 5 | `/brendovi/carsystem` | `process-application` | 1600×1050 | — | **Ja** |
| Zaštita i priprema | Carsystem | BRAND DESIGN str. 2 | `/brendovi/carsystem` | `process-preparation` | 1600×1050 | — | **Ja** |
| Simple Choice — primena | baslac | `Baslac POSTER_2` | `/brendovi/baslac` | Hero | 1600×1080 | 900×1080 | **Ja** |
| Perfect Balance — filozofija | baslac | `Baslac POSTER_1` | `/brendovi/baslac` | Hero | 1600×1080 | 900×1080 | **Ja** |
| ARRANGE mixing stanica | R-M | Agilis prez. str. 5 | `/brendovi/rm` | Koloristika | 2397×826 | crop 900×1080 | **Ja** |
| OEM editorial (pickup) | R-M | `R-M OEM Poster` | `/brendovi/rm` | — čeka sekciju | 2400×1150 | 900×1125 | **Ja**, posle tvoje odluke |
| Campaign retina upgrade ×12 | R-M | postojeći masteri | `/brendovi/rm` | Hero + editorial | 2400×1350 | 1440×1080 | **Ja** |

---

## 4. DVA MESTA GDE TRAŽIM TVOJU ODLUKU PRE IMPLEMENTACIJE

**4.1 — Neslaganje `alt` teksta i stvarnog sadržaja.**
Najbolji Carsystem i baslac asseti **ne prikazuju ono što `alt` tekst trenutno tvrdi**:

| Slot | Trenutni `alt` | Šta asset zaista prikazuje |
|---|---|---|
| `carsystem/hero-preparation` | „priprema i brušenje panela" | grupu proizvoda, bez radionice |
| `carsystem/process-application` | „maskiranje, nanošenje i oprema" | limenke laka i fillera |
| `baslac/hero-45-line` | „45 Line vodeni sistem u primeni" | pištolj sa plavom čašom, bez 45 Line proizvoda |

Pravilo 12 iz tvog briefa je da prazno mesto ne popunjavamo samo zato što slika postoji. Zato **nisam ništa ubacio.** Dve opcije:

- **(a)** Uskladiti `alt`/copy sa onim što asset zaista jeste (produkt-sistem banner umesto scene iz radionice) — mala izmena copy-ja, tačan sadržaj.
- **(b)** Ostaviti slotove prazne dok ne stignu prave fotografije.

Preporučujem **(a)** za Carsystem (jer je asset zaista jak i tema „jedan sistem" mu odgovara), a **(b)** za baslac `hero-45-line` — jer bi generički pištolj pod tim naslovom bio poluistina.

**4.2 — R-M OEM sekcija.**
Pickup fotografija je odlična i čista. Ali za nju ne postoji sekcija, a pravilo 7 kaže da ne izmišljam nove sekcije. Zid OEM logotipa preporučujem da se ne koristi bez pravne provere.

---

## 5. ODNOS PREMA POSTOJEĆEM AUDITU

`docs/CONTENT_ASSET_GAP_AUDIT.md` (2026-08-08) je utvrdio **da** 28 slotova nedostaje. Ovaj dokument utvrđuje **šta od official materijala te slotove može popuniti** — folder sa Desktopa u tom auditu nije bio analiziran.

Rezultat, brojano po fajlovima (15 baslac + 13 Carsystem = 28):

| | Fajlova |
|---|---|
| Pokriveno official materijalom — uz usklađivanje `alt`/copy (§4.1) | **8** |
| Ostaje prazno | **20** |
| — od toga tražiti od BASF (baslac) | 11 |
| — od toga snimiti (Carsystem hero 2/3 + workflow ×4) | 8 |
| — od toga čeka print-res original (Carsystem `process-finish`) | 1 |

Nijedan od tih 8 se ne uklapa u postojeći `alt` bez izmene — zato ništa nije implementirano pre tvoje odluke.
