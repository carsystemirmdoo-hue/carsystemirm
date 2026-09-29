# baslac: vizuali sa Surventis Brand Portala

Datum preuzimanja: 2026-09-28
Izvor: **Surventis Brand Portal**, `https://brand.surventiscoatings.com/hub/54`
(baslac hub, Media Library, `/document/418`). Portal radi na Frontify-ju.
Dozvola: dobavljač je odobrio upotrebu materijala sa portala na našem sajtu.

## Originali nisu deo repozitorijuma

- `assets/manufacturer/baslac/portal/` je u `.gitignore`: originali (JPEG, PNG,
  TIFF, PDF, ukupno oko 30 MB) **nisu u Gitu** i ne smeju se dodavati.
- U Git ulaze samo produkcione WebP varijante u `public/`. One su dovoljne da
  sajt radi; lokalni originali nisu potrebni ni za build ni za deploy.
- `scripts/build-baslac-portal-assets.py` **zahteva lokalno preuzete
  originale**. Bez njih prekida rad i navodi ID asseta koji nedostaje.
  Pokreće se samo kada vizual treba ponovo izvesti.

### Šta treba preuzeti za ponovno generisanje

Na portalu (Media Library) pretražiti tačan naziv, proveriti ID, pa
Download → Download original. Fajl sačuvati kao `<ID>__<originalni naziv>`.

| Generisani fajl (`public/…`) | Portal ID → originalni naziv |
|---|---|
| `images/brands/baslac/process/baslac-repair-rhythm-desktop.webp`, `…-mobile.webp` | 13440 → `Baslac78.jpeg` |
| `images/brands/baslac/systems/baslac-45-line-system.webp` | 12081 → `baslac 5L 45-W00 50393402.jpeg`; 12121 → `Baslac_1L_45-W1010_50389480.jpeg`; 12094 → `baslac_0_5L_45-W1020_50390264.jpeg`; 12088 → `baslac 100ml 45-W1390 50562135.jpeg` |
| `images/brands/baslac/clearcoats/baslac-clearcoat-range.webp`, `…-mobile.webp` | 12116 → `baslac_1L_40-10__57015904.jpeg`; 12118 → `Baslac_1L_40-440_50400360.jpeg`; 12119 → `baslac_1L_40-450_50593869.jpeg`; 45627 → `40-620.tif`; 12146 → `baslac 2L 40-510 Ambient Clear 50669602.jpeg` |
| `images/brands/baslac/color/baslac-color-workflow.webp` | 12193 → `baslac e-finder star (2).jpeg` |
| `images/brands/baslac/commercial/baslac-commercial-vehicles.webp` | 15133 → `Baslac_Commercial-Vehicle_LightBlue_03b_RGB.png` (PNG, ne istoimeni TIF) |
| `products/baslac/baslac--line-45-1l-example-packshot.webp` | 12121 → `Baslac_1L_45-W1010_50389480.jpeg` |
| `images/brands/baslac/campaign/baslac-seasonal-new-year.webp` | 45532 → `baslac_SoMe_2025-01_New_Year_1080x1080px_No_Copy.jpeg` |
| `images/brands/baslac/campaign/baslac-seasonal-easter.webp` | 50625 → `BASLAC VIDE.jpeg` |

## Kako se preuzima i gradi

- Originali se preuzimaju isključivo portalovim dugmetom **Download → Download
  original**. CDN previewi (`media.ffycdn.net`) nisu originali, jer ih portal
  servira ponovo kompresovane (zaglavlje `x-ffy-quality: 85`).
- Originali se čuvaju u `assets/manufacturer/baslac/portal/<id>__<originalni naziv>`.
  Folder je u `.gitignore` i van je `public/`, pa ne ulazi ni u bundle ni u
  function trace.
- Produkcione WebP varijante pravi `python3 scripts/build-baslac-portal-assets.py`
  (deterministički; `--check` samo proverava da originali postoje).
- Obrada se svodi na isecanje, skaliranje i ređanje neizmenjenih packshotova
  na belu podlogu. Nema retuša, generisanja ni izmene ambalaže.

## Korišćeni asseti

| Portal ID | Naziv na portalu | Originalni fajl | Format i dimenzije | Na portalu od | Kampanja / godina | Mesto na sajtu | Produkcioni fajl(ovi) |
|---|---|---|---|---|---|---|---|
| 13440 | Baslac78 | `Baslac78.jpeg` | JPEG 2000×1333, 389 KB | 2020-12-09 | kolekcija „baslac Fotoshooting 2020“ | `/brendovi/baslac`, sekcija „Proces popravke“ (`BaslacRepairRhythm`) | `public/images/brands/baslac/process/baslac-repair-rhythm-desktop.webp` (16:10, 2000×1250), `…-mobile.webp` (4:5, 1066×1333) |
| 12081 | baslac 5L 45-W00 50393402 | `baslac 5L 45-W00 50393402.jpeg` | JPEG 3000×3600, bela pozadina | 2020-09-03 | kolekcija „EMEA / Asia Pacific - 45 Line packshots“ | 45 Line kompozicija | `public/images/brands/baslac/systems/baslac-45-line-system.webp` (4:3, 2800×2100) |
| 12121 | Baslac_1L_45-W1010_50389480 | `Baslac_1L_45-W1010_50389480.jpeg` | JPEG 3000×3600 | 2020-09-03 | isto | 45 Line kompozicija; Line 45 kartica („Primer ambalaže“) | isto + `public/products/baslac/baslac--line-45-1l-example-packshot.webp` (840×1066) |
| 12094 | baslac_0_5L_45-W1020_50390264 | `baslac_0_5L_45-W1020_50390264.jpeg` | JPEG 3000×3600 | 2020-09-03 | isto | 45 Line kompozicija | `baslac-45-line-system.webp` |
| 12088 | baslac 100ml 45-W1390 50562135 | `baslac 100ml 45-W1390 50562135.jpeg` | JPEG 3000×5071 | 2020-09-03 | isto | 45 Line kompozicija | `baslac-45-line-system.webp` |
| 12116 | baslac_1L_40-10__57015904 | `baslac_1L_40-10__57015904.jpeg` | JPEG 3000×3600 | 2020-09-03 | packshot (Creator: Creanimation, Copyright status: Public) | Bezbojni lakovi | `public/images/brands/baslac/clearcoats/baslac-clearcoat-range.webp` (3600×1350), `…-mobile.webp` (1600×1400) |
| 12118 | Baslac_1L_40-440_50400360 | `Baslac_1L_40-440_50400360.jpeg` | JPEG 3000×3600 | 2020-09-03 | isto | Bezbojni lakovi | isto |
| 12119 | baslac_1L_40-450_50593869 | `baslac_1L_40-450_50593869.jpeg` | JPEG 3000×3600 | 2020-09-03 | isto | Bezbojni lakovi | isto |
| 45627 | 40-620 | `40-620.tif` | TIFF 3000×3600, RGBA (prava providnost) | 2024-11-19 | packshot | Bezbojni lakovi | isto (poravnat na belu podlogu) |
| 12146 | baslac 2L 40-510 Ambient Clear 50669602 | `baslac 2L 40-510 Ambient Clear 50669602.jpeg` | JPEG 3600×3000 | 2020-09-03 | packshot | Bezbojni lakovi | isto |
| 12193 | baslac e-finder star (2) | `baslac e-finder star (2).jpeg` | JPEG 5184×3456, bez ICC | 2020-09-09 | kolekcija „baslac e-finder star“ | Koloristika | `public/images/brands/baslac/color/baslac-color-workflow.webp` (16:9, 2400×1350) |
| 15133 | Baslac_Commercial-Vehicle_LightBlue_03b_RGB | `Baslac_Commercial-Vehicle_LightBlue_03b_RGB.png` | PNG 3508×2480, RGBA ali potpuno neprovidan (bela pozadina) | 2021-02-19 | key visual (tagovi: commercial vehicle, cv, key visual) | Komercijalna vozila | `public/images/brands/baslac/commercial/baslac-commercial-vehicles.webp` (2400×1575) |
| 45532 | baslac_SoMe_2025-01_New_Year_1080x1080px_No_Copy | `baslac_SoMe_2025-01_New_Year_1080x1080px_No_Copy.jpeg` | JPEG 1080×1080 | 2024-11-18 | „baslac / 2024-12 Holidays / 2025-01 New Year“, tag „xmas2024“; agencija Volt | Sezonski slajd „Nova godina“ — **pripremljeno, neaktivno** (samo `campaign-only`) | `public/images/brands/baslac/campaign/baslac-seasonal-new-year.webp` (1019×1019) |
| 50625 | BASLAC VIDE | `BASLAC VIDE.jpeg` | JPEG 1080×1080 | 2025-04-04 | Uskrs 2025, tag „happy easter 2025“ | Sezonski slajd „Vaskrs“ — **pripremljeno, neaktivno** (samo `campaign-only`) | `public/images/brands/baslac/campaign/baslac-seasonal-easter.webp` (1014×1014) |
| 45524 | baslac_2024-12_Holidays_2025-01_New_Year_Text | `….pdf` | PDF, 1 strana | 2024-11-18 | prateći tekst za 45532 | nije na sajtu; dokaz o kampanji | — |

### Napomene po assetu

- **Ambalaža:** svi packshotovi nose štampani natpis „A brand of BASF – We
  create chemistry“. To je deo fotografije proizvoda i ne menja se. Isto važi
  za postojeće Line 30 i Line 35 packshotove (vidi `BASLAC-VISUAL-SOURCE-MAP.md`).
- **Kompozicije (45 Line, bezbojni lakovi):** svaki packshot je neizmenjen,
  a ređa se multiply stapanjem na belu podlogu, pa bela ostaje bela, a senka
  ostaje senka. Razmera se ujednačava po nominalnoj zapremini ambalaže, a ne
  po pikselima snimka. Zato visoka i niska limenka od 1 L imaju istu
  zapreminu, a kanister od 5 L je realno veći. Za kanister i bocu mere su
  približne (tabela `PACKAGES` u skripti). Svi prikazani artikli su u našem
  aktivnom programu (`lib/baslac-systems.ts`, sekcija bezbojnih lakova).
- **40-100:** na portalu nema packshota (postoji samo prodajna argumentacija,
  Document Library 50643–50646), pa ga kompozicija ne prikazuje.
- **Line 45 „Primer ambalaže“:** portal nema generičku „45-W“ limenku. Svi
  Line 45 packshotovi nose šifru konkretnog artikla, pa kartica prikazuje
  45-W1010 White 1 L sa potpisom „Primer ambalaže“. Slika ostaje na originalnoj
  beloj podlozi: bela etiketa dodiruje belu pozadinu na bočnim ivicama, pa bi
  izdvajanje alfe probušilo etiketu.
- **13440:** na mešalici pištolja se vidi sitna crvena oznaka proizvođača
  čaše. U originalu ima oko 15 px, zamućena je pokretom i nečitljiva je na
  prikazanoj veličini. Drugih logoa nema.
- **12193:** ekran uređaja prikazuje „Measure / Save job data“ (engleski UI
  uređaja) i datum 20200109.
- **15133:** render, ne fotografija, i tekst sekcije to navodi. Za dostavno
  vozilo na portalu nema fotografije iz stvarne primene.
- **Sezonski vizuali (45532, 50625): NISU aktivni.** Na slikama nema teksta
  ni godine, ali ih portal vezuje za jednu kampanju: tag „xmas2024“ i prateći
  PDF „baslac / 2024-12 Holidays / 2025-01 New Year“, odnosno tag „happy
  easter 2025“. Nigde ne piše da su generički ili evergreen. Dozvola za
  upotrebu materijala nije dokaz da se kampanja 2024/25 sme predstaviti kao
  2026/27. Zato su u `seasonalImageLibrary` označeni kao `campaign-only`, sa
  periodom originalne kampanje, i ne mogu se prikazati u kasnijim sezonama.
  Aktivacija posle potvrde dobavljača opisana je u `docs/SEASONAL_CAMPAIGNS.md`.
  Produkcijski fallback je CSS dekoracija. Donja plava traka social šablona
  je odsečena; nije deo motiva.

## Preuzeto, pa odbačeno posle pregleda originala

| Portal ID | Naziv | Razlog |
|---|---|---|
| 13439 | Baslac77 | Rezerva za proces popravke; gotovo isti kadar kao 13440, sa istom oznakom na čaši. 13440 ima čistiji kadar pištolja i ruke |
| 12197 | baslac e-finder star (6) | Ekran uređaja je taman, bez vidljivog rezultata merenja; 12193 bolje prikazuje funkciju |
| 62738 | BASLAC TEAMS BACKGROUND EASTER JPEG (tag „easter2026“) | 16:9 sa praznom desnom polovinom i dodatnim logom u uglu; motiv (zec) je delom iza limenke. Kvadratni 50625 je kompletna scena |

## Pregledano na portalu, bez preuzimanja

| Portal ID | Naziv | Razlog |
|---|---|---|
| 48043 | DSC00949 (mešačka banka, 2025) | Etikete su **35-M214, 35-M1010, 35-M1541** (Line 35, ne 45) i nose velike BASF bedževe |
| 48045 | DSC00951 (boce na polici) | 49-W497, 49-W455 i 49-W553 jesu Line 45 koncentrati, ali nijedan nije u našem aktivnom programu |
| 52934–52941 | CESVI sajam | Velike stare BASF korporativne oznake |
| 59604 | BASLAC NOUVEL AN 1080X1080 | Rezerva za Novu godinu; bela pozadina lošije se uklapa u tamni hero od 45532 |
| 62021 | baslac_20_Years_dpi | Poster sa ugrađenim tekstom na tamnoj pozadini, bez providnosti; postojeći hero artwork „20 godina“ ostaje |
