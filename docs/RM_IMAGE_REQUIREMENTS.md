# R-M — zahtevi za slike i plan produkcionih asseta

Ovaj dokument je jedini operativni spisak vizuela potrebnih za završetak stranice
`/brendovi/rm`. Namenjen je pripremi fotografija, cropova i transparentnih
packshotova bez menjanja sadržaja, etiketa ili komercijalnih tvrdnji.

## Statusi

- `FINAL` — odobren lokalni asset, spreman za produkciju.
- `USABLE` — može ostati u produkciji, ali nije idealan završni artwork.
- `TEMPORARY` — kontrolisana privremena zamena.
- `MISSING` — asset treba pripremiti.
- `REJECTED` — ne koristiti.
- `NEEDS MOBILE CROP` — izvor postoji, ali treba namenski mobilni kadar.
- `NEEDS HIGHER RESOLUTION` — kadar postoji, ali rezolucija nije dovoljna.
- `NEEDS TRANSPARENT BACKGROUND` — potreban je čist packshot/logo sa alfa kanalom.

## Pravila isporuke

- Hero i editorial fotografije: WebP ili AVIF, sRGB, bez ugrađenog HTML teksta i CTA-a.
- Packshotovi i logotipi: WebP sa alfa kanalom ili odobreni SVG.
- Originalni TIFF/PSD/PDF ostaje van `public/`; u browser ide samo optimizovan export.
- Lice, oprema, pištolj, ambalaža i etikete ne smeju biti generativno menjani.
- Ne izmišljati proizvod, pakovanje, OEM odobrenje, partnerstvo ili tehničku tvrdnju.
- Desktop hero: cilj do 500 KB. Mobile hero: cilj do 260 KB.
- Editorial: cilj do 420 KB. Packshot: cilj do 300 KB. Logo: cilj do 80 KB.
- `@2x` izvor je poželjan pre optimizacije; tabela navodi minimum i preporuku.
- Kada je „Ugrađen tekst: Ne“, svi naslovi, opisi, CTA-i i progress ostaju HTML.

## Sažetak

Identifikovano je **67 asset zahteva**:

| Primarni status | Broj |
| --- | ---: |
| `FINAL` | 8 |
| `USABLE` | 2 |
| `NEEDS MOBILE CROP` | 4 |
| `NEEDS HIGHER RESOLUTION` | 4 |
| `MISSING` | 49 |

Dodatno, **31 zahtev** traži transparentnu pozadinu ili alfa-ready isporuku.
Trenutna stranica koristi namerne tehničke slotove kada fotografija nedostaje;
broken-image fallback nije dozvoljen.

---

## A. Hero banneri

| ID / naziv | Svrha i sadržaj | Obavezna | Desktop: minimum → preporuka; odnos | Mobile: minimum → preporuka; odnos | Format / pozadina / maksimum | Safe zona, fokus, tekst, logo, mobile | Status / putanja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-HERO-01 — AGILIS Performance desktop | Slajd 01; lakirer sa pištoljem, zelena AGILIS atmosfera | Da | 1600×900 → 2400×1350; 16:9 | — | WebP/AVIF; puna; 500 KB | Levih 40% mirno; osoba i pištolj u desnih 55%; tekst Ne; logo opciono gore desno; mobile Da | `FINAL` — `/public/images/brands/rm/campaign/rm-hero-agilis-performance-desktop.webp` |
| RM-HERO-01M — AGILIS Performance mobile | Namenski kadar slajda 01 | Da | — | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 260 KB | Lice i pištolj celi; ne seći šake; tekst Ne; logo opciono; poseban mobile Da | `NEEDS MOBILE CROP` — zameniti `/public/images/brands/rm/campaign/rm-hero-agilis-performance-mobile.webp` |
| RM-HERO-02 — AGILIS Color desktop | Slajd 02; lakirerka, noge, obuća, pištolj i radna stanica u narandžastoj atmosferi | Da | 1600×900 → 2400×1350; 16:9 | — | WebP/AVIF; puna; 500 KB | Levih 40–43% bez važnih detalja; žena i mašina desnih 52–58%; tekst Ne; AGILIS logo dozvoljen gore desno; mobile Da | `FINAL` — `/public/images/brands/rm/campaign/rm-hero-agilis-color-desktop.webp` |
| RM-HERO-02M — AGILIS Color mobile | Namenski kadar slajda 02 | Da | — | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 260 KB | Žena, pištolj i obuća vidljivi; mašina namerno kadrirana; tekst Ne; logo Da; poseban mobile Da | `NEEDS MOBILE CROP` — zameniti `/public/images/brands/rm/campaign/rm-hero-agilis-color-mobile.webp` |
| RM-HERO-03 — Refinity desktop | Slajd 03; osoba desno, cijan/plavi/ljubičasti svetlosni prstenovi | Da | 1600×900 → 2400×1350; 16:9 | — | WebP/AVIF; puna; 500 KB | Levih 40% tamno i čisto; lice i prstenovi desno; tekst Ne; diskretan Refinity znak dozvoljen; mobile Da | `FINAL` — `/public/images/brands/rm/campaign/rm-hero-refinity-desktop.webp` |
| RM-HERO-03M — Refinity mobile | Namenski kadar slajda 03 | Da | — | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 260 KB | Ne seći lice/vrat; zadržati najmanje tri ključna prstena; tekst Ne; logo opciono; poseban mobile Da | `NEEDS MOBILE CROP` — zameniti `/public/images/brands/rm/campaign/rm-hero-refinity-mobile.webp` |
| RM-HERO-04 — eSense desktop | Slajd 04; R-M eSense porodica, pištolj i zeleni raspršeni motiv | Da | 1600×900 → 2400×1350; 16:9 | — | WebP/AVIF; puna; 500 KB | Levih 38–40% mirno za HTML; proizvodi i pištolj ne smeju biti presečeni CTA-em; tekst Ne; eSense logo dozvoljen; mobile Da | `USABLE` — `/public/images/brands/rm/campaign/rm-hero-esense-desktop.webp` |
| RM-HERO-04M — eSense mobile | Namenski kadar slajda 04 | Da | — | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 260 KB | Jedna jasna grupa proizvoda i pištolj; izbeći veliku praznu belu zonu; tekst Ne; logo Da; poseban mobile Da | `NEEDS MOBILE CROP` — zameniti `/public/images/brands/rm/campaign/rm-hero-esense-mobile.webp` |

## B. AGILIS sekcija

| ID / naziv | Svrha i sadržaj | Obavezna | Desktop: minimum → preporuka; odnos | Mobile: minimum → preporuka; odnos | Format / pozadina / maksimum | Safe zona, fokus, tekst, logo, mobile | Status / putanja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-AG-01 — glavni AGILIS editorial | Veliki crop lakirerke, pištolja i radne stanice | Da | 1400×900 → 2000×1286; 14:9 | 900×900 → 1200×1200; 1:1 crop iz odobrenog izvora | WebP/AVIF; puna; 420 KB | Fokus desnih 65%; leva ivica mirna; tekst Ne; logo opciono; poseban mobile nije obavezan | `FINAL` — `/public/images/brands/rm/campaign/rm-agilis-editorial.webp` |
| RM-AG-02 — mixing station | Tehnički kadar kompletne AGILIS mešaone u radionici | Da | 1200×900 → 1800×1350; 4:3 | 800×800 → 1200×1200; 1:1 | WebP/AVIF; puna; 380 KB | Cela stanica i radna površina u kadru; tekst Ne; logo samo stvarni na opremi; mobile crop Da | `MISSING` — `/public/images/brands/rm/agilis/rm-agilis-mixing-station.webp` |
| RM-AG-03 — digitalni kolor instrument | Odobren spektrofotometar/merni uređaj u radu | Da | 1200×900 → 1600×1200; 4:3 | 800×1000 → 1000×1250; 4:5 | WebP/AVIF; puna; 320 KB | Uređaj i ruka oštri; bez lažnog UI-ja; tekst Ne; logo samo stvarni; mobile crop Da | `MISSING` — `/public/images/brands/rm/agilis/rm-agilis-color-instrument.webp` |
| RM-AG-04 — automatizovana mešaona | Odobrena AGILIS automatizovana mixing mašina | Da | 1200×900 → 1800×1350; 4:3 | 800×1000 → 1000×1250; 4:5 | WebP/AVIF; puna; 380 KB | Cela mašina, vrata i radna zona; tekst Ne; logo samo stvarni; mobile crop Da | `MISSING` — `/public/images/brands/rm/agilis/rm-agilis-automated-mixing.webp` |
| RM-AG-05 — product family | Usklađena AGILIS porodica bez ponavljanja hero kadra | Da | 1400×900 → 2000×1286; 14:9 | 900×900 → 1200×1200; 1:1 | WebP/AVIF; transparentna ili puna neutralna; 420 KB | Sve etikete čitljive; nema HTML teksta u rasteru; R-M/AGILIS logo samo na originalnoj ambalaži; mobile crop Da | `MISSING` — `/public/images/brands/rm/agilis/rm-agilis-product-family.webp` |
| RM-AG-06 — bazne komponente packshot | 2–4 stvarne AGILIS bazne komponente | Da | 1200×1500 → 1600×2000; 4:5 | isto | WebP alfa; transparentna; 300 KB | 8% alfa margina; bez senke izvan platna; tekst Ne; logo samo etiketa; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/agilis/rm-agilis-basecoat-group.webp` |
| RM-AG-07 — prajmer/punilac packshot | Potvrđen proizvod podloge kompatibilan sa prikazanim tokom | Da | 1200×1500 → 1600×2000; 4:5 | isto | WebP alfa; transparentna; 300 KB | Cela ambalaža; etiketa neizmenjena; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/agilis/rm-agilis-primer-filler.webp` |
| RM-AG-08 — bezbojni lak packshot | Potvrđen završni lak za prikazani sistem | Da | 1200×1500 → 1600×2000; 4:5 | isto | WebP alfa; transparentna; 300 KB | Cela ambalaža; bez generičke limenke; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/agilis/rm-agilis-clearcoat.webp` |
| RM-AG-09 — učvršćivač packshot | Stvarni kompatibilni učvršćivač | Da | 1200×1500 → 1600×2000; 4:5 | isto | WebP alfa; transparentna; 300 KB | Cela ambalaža i čep; etiketa čitljiva; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/agilis/rm-agilis-hardener.webp` |
| RM-AG-10 — aditiv/razređivač packshot | Stvarna pomoćna komponenta procesa | Da | 1200×1500 → 1600×2000; 4:5 | isto | WebP alfa; transparentna; 300 KB | Cela ambalaža; bez zamene etikete; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/agilis/rm-agilis-additive.webp` |

## C. Refinity sekcija

| ID / naziv | Svrha i sadržaj | Obavezna | Desktop: minimum → preporuka; odnos | Mobile: minimum → preporuka; odnos | Format / pozadina / maksimum | Safe zona, fokus, tekst, logo, mobile | Status / putanja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-REF-01 — glavni Refinity editorial | Kvadratni crop osobe i spektralnih prstenova | Da | 1200×1200 → 1800×1800; 1:1 | isti izvor; 1:1 | WebP/AVIF; puna; 420 KB | Glava u gornjoj trećini; prstenovi ne smeju biti odsečeni sa obe strane; tekst Ne; logo Ne; mobile Ne | `FINAL` — `/public/images/brands/rm/campaign/rm-refinity-editorial.webp` |
| RM-REF-02 — ScanR uređaj | Stvarni ScanR uređaj i način upotrebe | Da | 1200×900 → 1600×1200; 4:3 | 800×1000 → 1000×1250; 4:5 | WebP/AVIF; puna; 320 KB | Uređaj i kontakt sa vozilom jasni; bez lažnog ekrana; tekst Ne; logo samo stvarni; mobile crop Da | `USABLE` (pločica koraka 02, 4:5, 900×1125; portal 76316, vidi `docs/RM_PORTAL_ASSETS.md`) — `/public/images/brands/rm/refinity/rm-refinity-step-02-scanr.webp`; veći 4:3 kadar i dalje nedostaje |
| RM-REF-03 — formula/software | Odobren Refinity interfejs sa formulom | Da | 1440×900 → 1920×1200; 8:5 | 900×1125 → 1080×1350; 4:5 | WebP; puna; 360 KB | Bez privatnih podataka; UI čitljiv; tekst samo originalni UI; logo opciono; mobile crop Da | `USABLE` (pločica koraka 03, 4:5; portal 50792, rad na Refinity stanici, UI nije čitljiv kao formula) — `/public/images/brands/rm/refinity/rm-refinity-step-03-formula.webp` |
| RM-REF-04 — automatsko mešanje | Odobrena mašina u Refinity toku | Da | 1200×900 → 1800×1350; 4:3 | 800×1000 → 1000×1250; 4:5 | WebP/AVIF; puna; 380 KB | Cela mašina i posuda; bez lažnog proizvoda; tekst Ne; logo samo stvarni; mobile crop Da | `USABLE` (pločica koraka 04, 4:5; portal 41774, render mašine sa sajma 2024, cela mašina ne staje u 4:5) — `/public/images/brands/rm/refinity/rm-refinity-step-04-mixing.webp` |
| RM-REF-05 — finalna mešavina | Završena boja/posuda kao kraj digitalnog toka | Da | 1200×900 → 1600×1200; 4:3 | 800×1000 → 1000×1250; 4:5 | WebP/AVIF; puna; 300 KB | Posuda i nijansa u fokusu; bez lažne etikete; tekst Ne; logo Ne; mobile crop Da | `USABLE` (pločica koraka 05, 4:5; portal 76311 prikazuje lakiran panel, ne posudu sa mešavinom) — `/public/images/brands/rm/refinity/rm-refinity-step-05-result.webp` |
| RM-REF-06 — spektralna tekstura | Diskretna digitalna pozadina za Refinity zonu | Opciono | 1600×900 → 2400×1350; 16:9 | 900×1200 → 1080×1440; 3:4 | WebP/AVIF; puna; 240 KB | Bez lica/proizvoda; bez teksta; bez logotipa; loop/crop-safe; mobile crop Da | `MISSING` — `/public/images/brands/rm/refinity/rm-refinity-spectral-texture.webp` |

## D. Sistemi boja

Za hero sistemske vizuale važna je stvarna ambalaža ili proces. Grupni packshot
mora imati transparentnu pozadinu i 8% margine. Tekst i CTA ostaju HTML.

| ID / naziv | Svrha i sadržaj | Obavezna | Desktop: minimum → preporuka; odnos | Mobile: minimum → preporuka; odnos | Format / pozadina / maksimum | Safe zona, fokus, tekst, logo, mobile | Status / putanja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-SYS-AG-01 — AGILIS sistemski vizuel | Dominantni mosaic kadar AGILIS procesa | Da | 1400×900 → 2000×1286; 14:9 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 420 KB | Desnih 55% proces/proizvod; leva safe zona 35%; tekst Ne; logo opciono; mobile Da | `MISSING` — `/public/images/brands/rm/systems/rm-system-agilis-hero.webp` |
| RM-SYS-AG-02 — AGILIS grupa | 3–4 potvrđena proizvoda sistema | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Cele etikete i čepovi; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/systems/rm-system-agilis-group.webp` |
| RM-SYS-OX-01 — ONYX HD sistemski vizuel | Vodeni ONYX HD proces ili odobrena porodica | Da | 1400×900 → 2000×1286; 14:9 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 420 KB | Fokus na sistemu; leva safe zona 35%; tekst Ne; logo opciono; mobile Da | `MISSING` — `/public/images/brands/rm/systems/rm-system-onyx-hd-hero.webp` |
| RM-SYS-OX-02 — ONYX HD grupa | Potvrđeni ONYX HD proizvodi | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Normalizovana skala ambalaže; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/systems/rm-system-onyx-hd-group.webp` |
| RM-SYS-DI-01 — DIAMONT sistemski vizuel | Solventni DIAMONT proces ili odobrena porodica | Da | 1400×900 → 2000×1286; 14:9 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 420 KB | Ne koristiti usamljeni 724 px packshot kao hero; tekst Ne; logo opciono; mobile Da | `MISSING` — `/public/images/brands/rm/systems/rm-system-diamont-hero.webp` |
| RM-SYS-DI-02 — DIAMONT grupa | Baza, lak i pomoćne komponente | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Cele etikete; isti ugao svetla; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/systems/rm-system-diamont-group.webp` |
| RM-SYS-UN-01 — UNO HD sistemski vizuel | 2K direktni sjaj u stvarnom procesu | Da | 1400×900 → 2000×1286; 14:9 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 420 KB | Fokus na punoj nijansi/završnici; tekst Ne; logo opciono; mobile Da | `MISSING` — `/public/images/brands/rm/systems/rm-system-uno-hd-hero.webp` |
| RM-SYS-UN-02 — UNO HD grupa | Potvrđene UNO HD komponente | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Ambalaža u punoj visini; tekst Ne; mobile Ne | `USABLE` (jedna generička sistemska limenka 1 L sa alfom, ne grupa; portal 30820) — kataloška slika zapisa `rm-uno-hd`, `/public/products/rm/supplied/rm__rm-uno-hd.webp`; brend stranica je čita iz kataloga |
| RM-SYS-CB-01 — CRYSTAL BASE sistemski vizuel | Specijalni efektni pigmenti/proces | Da | 1400×900 → 2000×1286; 14:9 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 420 KB | Efekat vidljiv bez preterane grafike; tekst Ne; logo opciono; mobile Da | `MISSING` — `/public/images/brands/rm/systems/rm-system-crystal-base-hero.webp` |
| RM-SYS-CB-02 — CRYSTAL BASE grupa | Potvrđene efektne komponente | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Boja/efekat veran izvoru; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/systems/rm-system-crystal-base-group.webp` |
| RM-SYS-GR-01 — GRAPHITE HD sistemski vizuel | Proces komercijalnih vozila | Da | 1400×900 → 2000×1286; 14:9 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 420 KB | Vozilo ili proces desno; leva safe zona 35%; tekst Ne; logo opciono; mobile Da | `MISSING` — `/public/images/brands/rm/systems/rm-system-graphite-hd-hero.webp` |
| RM-SYS-GR-02 — GRAPHITE HD grupa | Potvrđeni proizvodi za komercijalna vozila | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Cele etikete; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/systems/rm-system-graphite-hd-group.webp` |

## E. Serije

| ID / naziv | Svrha i sadržaj | Obavezna | Desktop: minimum → preporuka; odnos | Mobile: minimum → preporuka; odnos | Format / pozadina / maksimum | Safe zona, fokus, tekst, logo, mobile | Status / putanja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-SER-PI-01 — Pioneer editorial | Vizuel procesa/serije Pioneer | Da | 1400×900 → 2000×1286; 14:9 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 420 KB | Proces u desnih 55%; tekst Ne; logo opciono; mobile Da | `MISSING` — `/public/images/brands/rm/series/rm-series-pioneer-hero.webp` |
| RM-SER-PI-02 — Pioneer grupa | Potvrđeni Pioneer proizvodi | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Cele etikete; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/series/rm-series-pioneer-group.webp` |
| RM-SER-AD-01 — Advance editorial | Vizuel procesa/serije Advance | Da | 1400×900 → 2000×1286; 14:9 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 420 KB | Jedan jasan procesni fokus; tekst Ne; logo opciono; mobile Da | `MISSING` — `/public/images/brands/rm/series/rm-series-advance-hero.webp` |
| RM-SER-AD-02 — Advance grupa | Potvrđeni Advance proizvodi | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Cele etikete; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/series/rm-series-advance-group.webp` |
| RM-SER-EL-01 — Element editorial | Vizuel procesa/serije Element | Da | 1400×900 → 2000×1286; 14:9 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 420 KB | Čist, pregledan proces; tekst Ne; logo opciono; mobile Da | `MISSING` — `/public/images/brands/rm/series/rm-series-element-hero.webp` |
| RM-SER-EL-02 — Element grupa | Potvrđeni Element proizvodi | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Cele etikete; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/series/rm-series-element-group.webp` |

## F. Grupe proizvoda

Svaka grupa je jedan kompozitni packshot sa 2–4 stvarna proizvoda. Ako proizvodi
nisu potvrđeni, tehnički slot ostaje na stranici.

| ID / naziv | Svrha i sadržaj | Obavezna | Desktop: minimum → preporuka; odnos | Mobile: minimum → preporuka; odnos | Format / pozadina / maksimum | Safe zona, fokus, tekst, logo, mobile | Status / putanja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-GRP-01 — bazne boje | Porodica AGILIS/ONYX HD/DIAMONT/UNO HD/CRYSTAL BASE | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Normalizovana visina; tekst Ne; logo samo etikete; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/groups/rm-group-basecoats.webp` |
| RM-GRP-02 — bezbojni lakovi | Brzo, vazdušno, univerzalno, mat/low-bake — samo potvrđeni proizvodi | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | 2–4 proizvoda; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/groups/rm-group-clearcoats.webp` |
| RM-GRP-03 — prajmeri i punioci | Brušenje, wet-on-wet, DTM, UV — samo potvrđeni proizvodi | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Cele etikete; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/groups/rm-group-primers-fillers.webp` |
| RM-GRP-04 — kitovi | Univerzalni, fini i specijalni kitovi | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Ambalaža i učvršćivač celi; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/groups/rm-group-bodyfillers.webp` |
| RM-GRP-05 — učvršćivači | Potvrđene sistemske komponente | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Bez mešanja nekompatibilnih sistema; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/groups/rm-group-hardeners.webp` |
| RM-GRP-06 — razređivači | Potvrđeni razređivači/regulatori procesa | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Cele etikete; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/groups/rm-group-thinners.webp` |
| RM-GRP-07 — aditivi | Procesni, završni i blend-in dodaci | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Samo potvrđene namene; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/groups/rm-group-additives.webp` |
| RM-GRP-08 — čistači | Čistači i odmašćivači | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | 2–4 proizvoda; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/groups/rm-group-cleaners.webp` |
| RM-GRP-09 — specijalni efekti | CRYSTAL BASE i potvrđene efektne komponente | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Efektne boje verne izvoru; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/groups/rm-group-effects.webp` |
| RM-GRP-10 — komercijalna vozila | GRAPHITE HD boja, podloga i završnica | Da | 1400×1100 → 1800×1414; ~9:7 | isto | WebP alfa; transparentna; 360 KB | Samo potvrđene komponente; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/groups/rm-group-commercial.webp` |

## G. Partnerstva i automotive coverage

Referentni OEM poster sadrži sledeće nazive, koji su trenutno prikazani kao
tekstualni wordmark fallback: Acura, Alfa Romeo, Audi, Buick, BMW, Cadillac,
Chevrolet, Chrysler, Dodge, Faraday Future, Fiat, Ford, Genesis, GM, GMC,
Honda, Hyundai, Infiniti, Isuzu, Jaguar, Jeep, Kia, Lucid, Land Rover, Lincoln,
Lexus, Mazda, Mercedes-Benz, Mini, Mitsubishi, Nissan, Porsche, Ram, Rivian,
Saab, Scion, Stellantis, Subaru, Suzuki, Tesla, Toyota, VinFast i Volkswagen.
Lista ne predstavlja tvrdnju o OEM odobrenju.

| ID / naziv | Svrha i sadržaj | Obavezna | Desktop: minimum → preporuka; odnos | Mobile: minimum → preporuka; odnos | Format / pozadina / maksimum | Safe zona, fokus, tekst, logo, mobile | Status / putanja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-PAR-01 — automotive logo paket | 43 odobrena logotipa sa referentnog postera | Da | SVG viewBox ili 600×240 po logotipu | isto | SVG ili WebP alfa; transparentna; 80 KB po fajlu | Bez istezanja; originalne proporcije; bez dodatnih marki; tekst je sam wordmark; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/automotive/{brand-id}.svg` |
| RM-PAR-02 — Emil Frey Racing editorial | R-M/Emil Frey kampanjski kadar sa Pirelli i R-M detaljima | Da | 1500×900 → 2200×1320; 5:3 | 900×1125 → 1080×1350; 4:5 crop | WebP/AVIF; puna; 420 KB | R-M i trkački detalj ostaju vidljivi; tekst Ne; ugrađeni stvarni logotipi Da; mobile crop kroz CSS | `FINAL` — `/public/images/brands/rm/campaign/rm-emil-frey-partnership.webp` |
| RM-PAR-03 — dodatno partnerstvo | Samo budući, pismeno potvrđen partner | Ne | 1500×900 → 2200×1320; 5:3 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 420 KB | Bez tvrdnje bez odobrenja; tekst Ne; logo samo odobren; mobile Da | `MISSING` — `/public/images/brands/rm/partnerships/rm-confirmed-partner-editorial.webp` |

## H. eSense i održivost

| ID / naziv | Svrha i sadržaj | Obavezna | Desktop: minimum → preporuka; odnos | Mobile: minimum → preporuka; odnos | Format / pozadina / maksimum | Safe zona, fokus, tekst, logo, mobile | Status / putanja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-ES-01 — eSense product family editorial | Proizvodi, zeleni motiv i pištolj za veliki eSense blok | Da | 1500×900 → 2200×1320; 5:3 | 900×1125 → 1080×1350; 4:5 crop | WebP/AVIF; puna; 420 KB | Proizvodi levo i pištolj u sredini; tekst Ne; logo u izvoru dozvoljen; mobile crop kroz layout | `FINAL` — `/public/images/brands/rm/campaign/rm-esense-editorial.webp` |
| RM-ES-02 — spray/pistol detalj | Uži editorial crop pištolja i zelenog raspršivanja | Ne | 1200×900 → 1600×1200; 4:3 | 800×1000 → 1000×1250; 4:5 | WebP/AVIF; puna; 300 KB | Pištolj i šaka celi; bez lažnog proizvoda; tekst Ne; logo Ne; mobile Da | `USABLE` — izvesti iz odobrenog eSense izvora u `/public/images/brands/rm/esense/rm-esense-spray-detail.webp` |
| RM-ES-03 — održivi proces | Stvarni radionički proces koji odgovara odobrenoj eSense poruci | Ne | 1400×900 → 2000×1286; 14:9 | 900×1125 → 1080×1350; 4:5 | WebP/AVIF; puna; 380 KB | Bez neproverenih eco tvrdnji u slici; tekst Ne; logo opciono; mobile Da | `MISSING` — `/public/images/brands/rm/esense/rm-esense-process.webp` |
| RM-ES-04 — eSense logo | Samostalan odobreni znak | Da | SVG viewBox ili 800×320 | isto | SVG ili WebP alfa; transparentna; 80 KB | Originalne proporcije i boje; tekst je sastavni deo znaka; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/images/brands/rm/esense/rm-esense-logo.svg` |

## I. Završni CTA

| ID / naziv | Svrha i sadržaj | Obavezna | Desktop: minimum → preporuka; odnos | Mobile: minimum → preporuka; odnos | Format / pozadina / maksimum | Safe zona, fokus, tekst, logo, mobile | Status / putanja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-CTA-01 — grafitna tekstura | Diskretan materijal/boja, bez prepoznatljivog proizvoda | Ne | 1600×900 → 2400×1350; 16:9 | 900×1200 → 1080×1440; 3:4 | WebP/AVIF; puna; 220 KB | Nizak kontrast ispod teksta; tekst Ne; logo Ne; mobile Da | `MISSING` — `/public/images/brands/rm/cta/rm-cta-graphite-texture.webp` |
| RM-CTA-02 — proizvodni detalj | Makro kadar stvarne ambalaže ili mešanja | Ne | 1200×900 → 1600×1200; 4:3 | 800×1000 → 1000×1250; 4:5 | WebP/AVIF; puna; 300 KB | Desnih 30%; ne ulazi pod CTA; tekst Ne; logo samo stvarni; mobile Da | `MISSING` — `/public/images/brands/rm/cta/rm-cta-product-detail.webp` |
| RM-CTA-03 — R-M geometrija | Dijagonalni grafitno-crveni završni okvir | Ne | Vektorski/CSS | Vektorski/CSS | CSS; bez rastera; 0 KB | Bez dodatnog teksta/logotipa; responsive; mobile isto | `FINAL` — implementirano u `RmBrandPage.module.css`; novi raster nije potreban |

## J. Postojeći kataloški packshotovi

Ovi fajlovi trenutno postoje, ali nisu dovoljno ujednačeni za premium sistemske
kompozicije. Ne menjati etiketu; traži se novi, veći, transparentan export.

| ID / naziv | Svrha i sadržaj | Obavezna | Desktop: minimum → preporuka; odnos | Mobile: minimum → preporuka; odnos | Format / pozadina / maksimum | Safe zona, fokus, tekst, logo, mobile | Status / putanja |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-PACK-01 — DIAMONT bazna boja | Glavni DIAMONT packshot | Da | postojeće 724×724; minimum 1200×1500 → 1600×2000; 4:5 | isto | WebP alfa; transparentna; 300 KB | Cela limenka i etiketa; 8% margina; tekst Ne; mobile Ne | `NEEDS HIGHER RESOLUTION` + `NEEDS TRANSPARENT BACKGROUND` — izvor `/public/products/rm/rm-diamont-bazna-boja.jpg` |
| RM-PACK-02 — DIAMONT bezbojni lak | Završni lak u galeriji i grupi | Da | 1200×1500 → 1600×2000; 4:5 | isto | WebP alfa; transparentna; 300 KB | Cela ambalaža; etiketa čitljiva; tekst Ne; mobile Ne | `MISSING` + `NEEDS TRANSPARENT BACKGROUND` — `/public/products/rm/rm-diamont-bezbojni-lak.webp` |
| RM-PACK-03 — Body Filler White B 2E11 | Kit u produktnoj porodici | Da | postojeće 800×600; minimum 1200×1500 → 1600×2000; 4:5 | isto | WebP alfa; transparentna; 300 KB | Ambalaža i učvršćivač celi; tekst Ne; mobile Ne | `NEEDS HIGHER RESOLUTION` + `NEEDS TRANSPARENT BACKGROUND` — izvor `/public/products/rm/rm-body-filler-white-b-2e11.jpg` |
| RM-PACK-04 — Pasta 190 1 L | Packshot za grupu završne obrade | Da | postojeće 600×600; minimum 1200×1500 → 1600×2000; 4:5 | isto | WebP alfa; transparentna; 300 KB | Potvrditi naziv proizvoda prema etiketi pre zamene; tekst Ne; mobile Ne | `NEEDS HIGHER RESOLUTION` + `NEEDS TRANSPARENT BACKGROUND` — izvor `/public/products/rm/rm-pasta-190-1l.jpg` |
| RM-PACK-05 — Pasta 190 5 L | Veće pakovanje u grupi završne obrade | Da | postojeće 600×600; minimum 1200×1500 → 1600×2000; 4:5 | isto | WebP alfa; transparentna; 300 KB | Potvrditi naziv proizvoda prema etiketi pre zamene; tekst Ne; mobile Ne | `NEEDS HIGHER RESOLUTION` + `NEEDS TRANSPARENT BACKGROUND` — izvor `/public/products/rm/rm-pasta-190-5l.jpg` |

## Prioritet pripreme

Najveći vizuelni uticaj imaju sledeći asseti, ovim redosledom:

1. RM-HERO-02M — finalni AGILIS Color mobile crop.
2. RM-HERO-03M — finalni Refinity mobile crop.
3. RM-HERO-01M — finalni AGILIS Performance mobile crop.
4. RM-HERO-04M — finalni eSense mobile crop.
5. RM-AG-05 — AGILIS product family.
6. RM-REF-02 — ScanR uređaj u radu.
7. RM-REF-03 — odobren formula/software vizuel.
8. RM-SYS-DI-02 — DIAMONT grupa proizvoda.
9. RM-GRP-02 — porodica bezbojnih lakova.
10. RM-PAR-01 — odobren automotive logo paket.

## Kontrola pre predaje

- Proveriti prava korišćenja i odobrenje svakog izvora.
- Proveriti da naziv u fajlu odgovara stvarnoj etiketi.
- Proveriti da transparentni export nema belu ili sivu pozadinu.
- Proveriti lice, ruke, pištolj, točkiće mašine, čepove i etikete na 100%.
- Proveriti desktop i mobile crop bez preklapanja sa HTML tekstom i kontrolama.
- Proveriti da nijedan export ne sadrži lažni CTA, countdown ili progress.
- Pokrenuti 404 proveru nakon dodavanja fajlova.
