# C.A.R.FIT catalog sync — DRY RUN

Primarni izvor: aktivne stranice proizvoda na https://carfitrepair.com/en/ (crawl 2026-09-18T19:30:53.804Z).

Sekundarni izvor: **C.A.R.FIT Catalogue 2026** — https://carfitrepair.com/wp-content/uploads/2025/09/CARFIT-FINAL-2026.pdf

sha256 `629d36da1a57bf6cdd05580aecf3d145d81dc7f0ae4209792ce58bf71f11d6d9` · 48 strana.

Generisano komandom `npm run carfit:sync:plan`. Ovaj korak ne menja katalog.

## Zbir

| Metrika | Vrednost |
| --- | ---: |
| CURRENT_ACTIVE_WEBSITE_PRODUCTS | 123 |
| CURRENT_ACTIVE_ARTICLE_NUMBERS | 357 |
| CATALOGUE_PRODUCTS | 82 |
| CATALOGUE_ARTICLE_NUMBERS | 294 |
| LOCAL_PRODUCTS_BEFORE | 2 |
| LOCAL_ARTICLE_NUMBERS_BEFORE | 0 |
| EXACT_MATCH | 0 |
| HIGH_CONFIDENCE_MATCH | 1 |
| PROBABLE_MATCH | 0 |
| LEGACY_NOT_ON_CURRENT_WEBSITE | 0 |
| LOCAL_ONLY_UNKNOWN | 1 |
| WEBSITE_AND_CATALOGUE | 88 |
| WEBSITE_ONLY | 35 |
| CATALOGUE_ONLY | 20 |
| SOURCE_CONFLICT | 16 |
| MISSING_PRODUCTS | 0 |
| MISSING_VARIANTS | 0 |
| MISSING_IMAGES | 0 |
| newProducts | 0 |
| existingProducts | 121 |

## Akcije

| Akcija | Proizvoda |
| --- | ---: |
| IMPORT | 121 |
| MATCHED_EXISTING | 1 |
| REPRESENTED_BY_OWNER | 1 |

## Naši postojeći C.A.R.FIT zapisi

| Naš zapis | Klasifikacija | Zvanični proizvod | Dokaz |
| --- | --- | --- | --- |
| `carfit-maskirna-folija-4x5m` | HIGH_CONFIDENCE_MATCH | Masking film 7mm with electrostatic effect | naša slika je bajt-identična zvaničnoj slici proizvoda; ručno pakovanje (4mx5m) = zvanična varijanta 1-201-0450 |
| `carfit-maskirna-folija-4x150m` | LOCAL_ONLY_UNKNOWN | — | nema zvanične šifre, slika nije zvanična, naziv ne odgovara nijednoj zvaničnoj stranici |

## Mapiranje kategorija

| C.A.R.FIT kategorija → naša | Proizvoda |
| --- | ---: |
| Abresives and sanding → abrazivi | 7 |
| Abresives and sanding → pribor | 5 |
| Accessories › Mixing Cups and Lids → pribor | 4 |
| Accessories › Ozone Generators → oprema | 1 |
| Accessories › Paint Related Accessories → abrazivi | 1 |
| Accessories › Paint Related Accessories → ciscenje | 6 |
| Accessories › Paint Related Accessories → maskiranje | 7 |
| Accessories › Paint Related Accessories → pribor | 8 |
| Accessories › Paint Related Accessories → radionica | 2 |
| Accessories › Paint Related Accessories → zastita | 3 |
| Aerosols → boje | 7 |
| Aerosols → ciscenje | 1 |
| Aerosols → pribor | 1 |
| Aerosols → sprejevi | 5 |
| Aerosols → zastita | 4 |
| Clearcoat → boje | 8 |
| Filler → boje | 7 |
| Masking › Masking Film → maskiranje | 3 |
| Masking › Masking Paper → maskiranje | 1 |
| Masking › Masking Tapes → lepkovi | 2 |
| Masking › Masking Tapes → maskiranje | 9 |
| Polishing Materials → poliranje | 9 |
| Polishing Materials → pribor | 2 |
| Protective Coatings → lepkovi | 2 |
| Protective Coatings → radionica | 1 |
| Protective Coatings → zastita | 1 |
| Putties → kitovi | 10 |
| Putties → pribor | 1 |
| Thinner & Silicone Remover → boje | 2 |
| Thinner & Silicone Remover → ciscenje | 2 |
| Thinner & Silicone Remover → radionica | 1 |

## Samo na sajtu (WEBSITE_ONLY) — ulaze u katalog

| Proizvod | Šifara | Akcija |
| --- | ---: | --- |
| 1K Etch Primer Spray | 1 | IMPORT |
| 1K Plastic primer Spray | 1 | IMPORT |
| 2K Fast Air Primer Filler 3:1 | 7 | IMPORT |
| 2K Clearcoat Spray | 1 | IMPORT |
| Coverpaper waterproof | 6 | IMPORT |
| Masking film with electrostatic effect | 3 | IMPORT |
| Cover tape up to 100°C | 4 | IMPORT |
| Cover tape orange up to 100°C | 1 | IMPORT |
| Cover tape water resistant up to 120°C | 5 | IMPORT |
| Masking film 7mm with electrostatic effect | 3 | MATCHED_EXISTING |
| Color Net Disc | 19 | IMPORT |
| Double-sided adhesive tape | 0 | REPRESENTED_BY_OWNER |
| Disposable Floor Mats | 1 | IMPORT |
| SONTARA® Degreasing & Cleaning Cloth | 2 | IMPORT |
| Hand Sanding Block | 1 | IMPORT |
| Woolen polishing disc Velcro | 2 | IMPORT |
| Logo Tape | 1 | IMPORT |
| Manual Polishing and Sanding Pad | 1 | IMPORT |
| Microfiber Cleaning Cloth | 1 | IMPORT |
| PE mounting tape | 3 | IMPORT |
| Wet Sanding Paper | 5 | IMPORT |
| Nitrile Gloves Palm Textured | 2 | IMPORT |
| Parking Sensor Masking Disc | 1 | IMPORT |
| Touch Up Bottles | 1 | IMPORT |
| Polyethylene Car Cover | 1 | IMPORT |
| Rapid air clear coat VOC | 4 | IMPORT |
| Stirring Sticks | 4 | IMPORT |
| Windglass Glue Black | 1 | IMPORT |
| Rubbing compound | 1 | IMPORT |
| Coverall Black Label Edition | 5 | IMPORT |
| Epoxy Metal Filler | 1 | IMPORT |
| SCR strainers | 2 | IMPORT |
| SCR mixing lids | 1 | IMPORT |
| Stone Chip Protection | 2 | IMPORT |
| Zinc Spray | 1 | IMPORT |

## Samo u PDF katalogu — `CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE`

| PDF porodica | Str. | Šifre |
| --- | ---: | --- |
| PREMIUM SOFT PLUS PUTTY | 5 | 2-253-1800, 2-253-4700 |
| ANTIRUST PRIMER | 13 | 4-442-1000 |
| CARFIT 2K CLEARCOAT | 20 | 7-204-0400 |
| CARFIT 1K EPOXY PRIMER | 21 | 4-390-0400 |
| STONE CHIP PROTECTION | 26 | 5-604-1000, 5-603-1000 |
| Pad for Polishing Disc Velcro | 32 | 5-100-0151, 5-100-0181 |
| (tabela bez naslova, ispod „Pad for Polishing Disc Velcro”) Winner Pad 15 Holes - 5/16”+M8, Medium Density Winner Pad 15 | 32 | 5-170-0021 |
| (tabela bez naslova, ispod „Soft Masking Foam Tape”) Universal Foam Masking Tape 20mm x 50m Universelles Schaum-A | 34 | 9-111-2050 |
| Electrostatic Masking Film | 35 | 1-200-0450, 1-200-0470, 1-200-0570, 1-204-4020, 1-204-4030, 1-204-5020, 1-204-6010, 1-204-5012 |
| Masking Paper | 36 | 1-220-2045, 1-220-4020, 1-220-6020, 1-220-6045, 1-220-9020, 1-220-9030, 1-220-9045 |
| Coverall | 37 | 3-266-0007, 3-266-0008, 3-266-0009, 3-266-0010, 3-266-0015, 3-266-0016, 3-266-0017, 3-266-0018, 3-266-0019, 3-266-0020 |
| Microfibre Cleaning Cloth | 37 | 8-803-0002N |
| (tabela bez naslova, ispod „Mobile Masking Paper Dispenser”) Silicone Body Half Mask (Set filters+holders) Halbmaske aus  | 38 | 3-268-1000, 3-268-1001, 3-268-1002, 3-268-1003 |
| Nitrile Gloves | 39 | 3-260-0350, 3-260-0450, 3-260-0550, 3-260-0650 |
| Touch Up Bottles | 39 | 3-115-0002, 3-115-0003 |
| (tabela bez naslova, ispod „Spongecut”) CF Abrasives Grey Matt, D 75mm, P3000, 6 Pcs/ Stk./ pieces/p | 45 | 6-400-3075, 6-400-3150, 6-400-5075, 6-400-5150 |
| Sanding Block for 150-mm Abrasive Disc | 45 | 5-170-0009 |
| Hand Block Kit 70x198 mm | 46 | 5-170-0016, 5-170-0019 |
| (tabela bez naslova, ispod „Hand Block Kit 70x198 mm”) Hand Block Kit 70x400, 1 pcs Polyurethane Handschleifblock 7 | 46 | 5-170-0017 |
| (tabela bez naslova, ispod „Hand Block Kit 70x198 mm”) Adjustable Radius Flex Longboard Hand Sanding File Block, 70 | 46 | 5-170-0018 |

## Konflikti zvaničnih izvora

| Tip | Šifra | Nalaz | Razrešenje |
| --- | --- | --- | --- |
| ARTICLE_ON_MULTIPLE_WEBSITE_PAGES | 9-171-1905 | Double-sided adhesive tape (19 mm x 5 m, thickness 0,8 mm) ↔ PE mounting tape (19 mm x 5 m) | vlasnik: montageklebeband-pe (pravilo: article-series-prefix); na ostalim stranicama šifra ostaje zabeležena kao deljena |
| ARTICLE_ON_MULTIPLE_WEBSITE_PAGES | 7-401-1000 | 2K Ultra HS Clearcoat (1 l) ↔ 2K UHS low VOC Clearcoat (1 l) | vlasnik: 2k-ultra-hs-klarlack (pravilo: catalogue-family); na ostalim stranicama šifra ostaje zabeležena kao deljena |
| ARTICLE_ON_MULTIPLE_WEBSITE_PAGES | 7-401-5000 | 2K Ultra HS Clearcoat (5 l) ↔ 2K UHS low VOC Clearcoat (5 l) | vlasnik: 2k-ultra-hs-klarlack (pravilo: catalogue-family); na ostalim stranicama šifra ostaje zabeležena kao deljena |
| CATALOGUE_ARTICLE_LISTED_TWICE_WITH_DIFFERENT_TEXT | 4-242-1000 | str. 11: 2K US Filler 4:1 WHITE 1L 2K US Füller Weiß 1L 2K Appret US Blanche 1L ↔ str. 11: 2K US Filler 4:1 BLACK 1L 2K US Füller SCHWARZ 1L 2K Appret US NOIR 1L | štamparska greška u PDF-u; merodavan je opis sa aktivne stranice sajta, a PDF red se ne koristi za atribute |
| CATALOGUE_ARTICLE_LISTED_TWICE_WITH_DIFFERENT_TEXT | 7-322-0501 | str. 16: 0.5 L, Hardener Slow 0,5 L, Langsamer Härter 0.5 L, Durcisseur rapide ↔ str. 16: 2.5 L, Hardener Slow 2,5 L, Langsamer Härter 2.5 L, Durcisseur rapide | štamparska greška u PDF-u; merodavan je opis sa aktivne stranice sajta, a PDF red se ne koristi za atribute |
| ARTICLE_LISTED_TWICE_ON_SAME_PAGE | 4-420-3000 | 2K Fast Air Primer Filler 3:1: „3 l, grey” ↔ „3 l, black” | jedna šifra = jedan red; oba zvanična opisa ostaju u oznaci varijante dok proizvođač ne ispravi stranicu |
| WEBSITE_VS_CATALOGUE_ATTRIBUTE | 4-205-3600 | volume: sajt „0.8 L” ↔ katalog „3.6 L” (3.6 L, 2K HS Acryl Filler white 2K HS Acryl Filler WEIß 3,6 L 3.6 L, Apprêt acrylique 2K HS blanc) | šifra 4-205-3600 sama nosi „3.6 L” → greška u unosu na sajtu; prikazuje se vrednost iz kataloga |
| WEBSITE_VS_CATALOGUE_ATTRIBUTE | 7-437-2501 | volume: sajt „2.5 L” ↔ katalog „0.2 L” (0.2 L, Standard hardener 2,5 L, Schneller Härter 2.5 L, Durcisseur rapide) | šifra 7-437-2501 sama nosi „2.5 L” → greška u PDF-u; merodavna je stranica sajta |
| WEBSITE_VS_CATALOGUE_ATTRIBUTE | 7-321-0501 | volume: sajt „0.5 L” ↔ katalog „2.5 L” (2.5 L, Fast Hardener 2,5 L, Schneller Härter 2.5 L, Durcisseur lent) | šifra 7-321-0501 sama nosi „0.5 L” → greška u PDF-u; merodavna je stranica sajta |
| WEBSITE_VS_CATALOGUE_ATTRIBUTE | 7-321-2501 | volume: sajt „2.5 L” ↔ katalog „0.5 L” (0,5 L Fast Hardener 0,5 L, Schneller Härter 0.5 L, Durcisseur lent) | šifra 7-321-2501 sama nosi „2.5 L” → greška u PDF-u; merodavna je stranica sajta |
| WEBSITE_VS_CATALOGUE_ATTRIBUTE | 6-500-1000 | grit: sajt „P500” ↔ katalog „P1000” (P1000, D 150 mm) | šifra 6-500-1000 sama nosi „P1000” → greška u unosu na sajtu; prikazuje se vrednost iz kataloga |
| WEBSITE_VS_CATALOGUE_ATTRIBUTE | 6-500-1500 | grit: sajt „P600” ↔ katalog „P1500” (P1500, D 150 mm) | šifra 6-500-1500 sama nosi „P1500” → greška u unosu na sajtu; prikazuje se vrednost iz kataloga |
| WEBSITE_VS_CATALOGUE_ATTRIBUTE | 6-500-2000 | grit: sajt „P800” ↔ katalog „P2000” (P2000, D 150 mm) | šifra 6-500-2000 sama nosi „P2000” → greška u unosu na sajtu; prikazuje se vrednost iz kataloga |
| WEBSITE_DESCRIPTOR_REPEATED_FOR_DIFFERENT_ARTICLES | 6-901-0001, 6-901-0002 | sajt: „115 mm x 230 mm (20 Stk.), Sehr fein” uz sve navedene šifre ↔ katalog: 6-901-0001 „Very Fine, sheets 115x230mm, red Very Fine, sheets 115x230mm, Rot Très Fin, feuilles 115x230mm, rouge”; 6-901-0002 „Ultra Fine, sheets 115x230mm, grey Ultra Fine, sheets 115x230mm, Grau Ultra Fin, feuilles 115x230mm, gris” | sajt ne može biti tačan za sve šifre; varijante se razlikuju prema redu iz PDF kataloga |
| WEBSITE_DESCRIPTOR_REPEATED_FOR_DIFFERENT_ARTICLES | 6-902-0001, 6-902-0002 | sajt: „115 mm x 10 m (Rolle), Ultra fein” uz sve navedene šifre ↔ katalog: 6-902-0001 „Very Fine, roll 115x10m, red Very Fine, Rolle 115x10m, Rot Très Fin, rouleau 115x10m, rouge”; 6-902-0002 „Ultra Fine, roll 115x10m, grey Ultra Fine, Rolle 115x10m, Grau Ultra Fin, rouleau 115x10m, gris” | sajt ne može biti tačan za sve šifre; varijante se razlikuju prema redu iz PDF kataloga |
| POSSIBLE_ARTICLE_NUMBER_TYPO | 4-304-3600 | sajt 4-304-3600 („0,8 l, black”) ↔ katalog 4-204-3600 („3.6 L, 2K HS Acryl Filler black 2K HS Acryl Filler SCHWARZ 3,6 L 3.6 L, Apprêt acrylique 2K HS noir”) — razlika u jednoj cifri | jedna varijanta: red tabele nosi šifru sa sajta (4-304-3600), šifra iz PDF-a (4-204-3600) je alternativni zapis iste varijante — pretraživa, nije zasebna varijanta; mera varijante sa sajta ispravljena (0.8 L → 3.6 L) jer je nose i šifra i PDF red |

## Zadržano

Nema zadržanih proizvoda.
