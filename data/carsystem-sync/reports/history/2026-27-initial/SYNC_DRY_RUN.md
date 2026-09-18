# Carsystem catalog sync — DRY RUN

Referentni izvor: **CARSYSTEM Product Catalogue 2026/27 (EN)** — https://www.carsystem.org/fileadmin/CS-Kataloge-2026/Carsystem-product-catalogue-HQ-2026-27-EN.pdf

sha256 `ac4f63d9b65109f15de5f5cb3f3caed672741ddd97a76eea78bbacf35d643961` · sekundarni izvor: carsystem.org (EN), 462 stranica proizvoda.

Generisano komandom `npm run carsystem:sync:plan`. Ovaj korak ne menja katalog.

## Zbir

| Metrika | Vrednost |
| --- | ---: |
| catalogue | CARSYSTEM Product Catalogue 2026/27 (EN) |
| catalogueSha256 | ac4f63d9b65109f15de5f5cb3f3caed672741ddd97a76eea78bbacf35d643961 |
| SOURCE PRODUCTS | 465 |
| SOURCE VARIANTS | 1089 |
| EXISTING PRODUCTS | 9 |
| EXISTING VARIANTS | 9 |
| EXACT MATCHES | 1 |
| HIGH CONFIDENCE MATCHES | 4 |
| PROBABLE MATCHES | 2 |
| MISSING PRODUCTS | 404 |
| MISSING VARIANTS | 906 |
| AMBIGUOUS | 0 |
| LEGACY PRODUCTS | 3 |
| SOURCE CONFLICTS | 11 |
| MISSING IMAGES | 3 |
| MISSING IMPORTANT DATA | 0 |
| alreadyImported | 0 |
| existingToEnrich | 5 |
| heldPendingDecision | 2 |
| heldWebsiteOnly | 32 |
| heldNoProductPage | 3 |
| excludedMerchandising | 19 |
| markedNewBySource | 42 |

## Naši postojeći Carsystem zapisi

| Naš slug | Klasifikacija | Zvanični proizvod | Dokaz | Dopuna |
| --- | --- | --- | --- | --- |
| `carsystem-git-multi-green` | PROBABLE_MATCH | Multi Green — Multifuncional polyester putty | exact-normalized-name | Naziv je isti, ali se naša pakovanja ne poklapaju sa zvaničnim. |
| `carsystem-git-elastic-weiss` | HIGH_CONFIDENCE_MATCH<br>VARIANT_MISSING<br>EXISTING_DATA_INCOMPLETE | Elastic white — Polyester - fine putty | identical-official-packshot | +3 varijanti; nema tabelu varijanti sa šiframa artikala; sku je interni placeholder (CS-GIT-ELASTIC-WEISS); manufacturerCode nije upisan |
| `carsystem-soft-plus-git` | LEGACY_NOT_IN_CATALOGUE<br>LEGACY_NOT_IN_2026_27 | — | none | — |
| `carsystem-p19-brusni-diskovi` | HIGH_CONFIDENCE_MATCH<br>LEGACY_NOT_IN_2026_27<br>VARIANT_MISSING<br>EXISTING_DATA_INCOMPLETE | Sanding Disc P.19 — Paper abrasive - 150 mm - 25 holes | series-article-range | +13 varijanti; nema tabelu varijanti sa šiframa artikala; sku je interni placeholder (CS-P19-DISC); manufacturerCode nije upisan |
| `carsystem-f19-brusni-diskovi` | HIGH_CONFIDENCE_MATCH<br>VARIANT_MISSING<br>EXISTING_DATA_INCOMPLETE | Sanding Disc F.19 — Film abrasive - 150 mm - 25 holes | series-article-range | +12 varijanti; nema tabelu varijanti sa šiframa artikala; sku je interni placeholder (CS-F19-DISC); manufacturerCode nije upisan |
| `carsystem-f23-brusni-diskovi` | EXACT_MATCH<br>EXISTING_DATA_INCOMPLETE | Sanding Disc F.23 Ceramic — Film abrasive - 150 mm - 25 holes | article-number | +0 varijanti; manufacturerCode nije upisan |
| `carsystem-p23-brusni-diskovi` | LEGACY_NOT_IN_CATALOGUE<br>LEGACY_NOT_IN_2026_27 | — | none | — |
| `carsystem-finish-serija` | HIGH_CONFIDENCE_MATCH<br>VARIANT_MISSING<br>EXISTING_DATA_INCOMPLETE | Sanding Disc F.19 Finish — Film abrasive - 152 mm - 15 holes | series-article-range | +4 varijanti; nema tabelu varijanti sa šiframa artikala; sku je interni placeholder (CS-FINISH-SERIES); manufacturerCode nije upisan |
| `carsystem-zastitno-odelo` | PROBABLE_MATCH | Classic Coverall Jacket Anthracite — Protective coverall | identical-official-packshot | Jedini dokaz je identična zvanična slika; naziv zapisa je generički. |

## Čeka ručnu odluku — mogući duplikat postojećeg zapisa (2)

| Zvanični proizvod | Kategorija | Varijante | Šifre | Napomena |
| --- | --- | ---: | --- | --- |
| [Classic Coverall Jacket Anthracite](https://www.carsystem.org/en/products/detail/personal-safety/classic-coverall-jacket-anthracite-protective-coverall) — Protective coverall | Personal Safety | 7 | 159.194, 159.195, 159.196, 159.197 … | Mogući duplikat ručnog zapisa „carsystem-zastitno-odelo” — potrebna odluka. |
| [Multi Green](https://www.carsystem.org/en/products/detail/putties/multi-green-multifuncional-polyester-putty) — Multifuncional polyester putty | Putties | 3 | 146.706, 147.337, 149.134 | Mogući duplikat ručnog zapisa „carsystem-git-multi-green” — potrebna odluka. |

## Na sajtu proizvođača, ali ne u katalogu 2026/27 (32)

| Zvanični proizvod | Kategorija | Varijante | Šifre | Napomena |
| --- | --- | ---: | --- | --- |
| [ProFlex Jupiter Soft](https://www.carsystem.org/en/products/detail/abrasives/proflex-jupiter-soft-film-abrasive-75-mm-multihole) — Film abrasive - 75 mm - multihole | Abrasives | 2 | 156.522, 156.523 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [RUPES Mini Random Orbital Sander LD30](https://www.carsystem.org/en/products/detail/abrasives/rupes-mini-random-orbital-sander-ld30-mini-random-orbital-sander-pneumatic) — Mini random orbital sander, pneumatic | Abrasives | 1 | 157.330 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [RUPES Random Orbital Sander ER](https://www.carsystem.org/en/products/detail/abrasives/rupes-random-orbital-sander-er-random-orbital-sander-electric) — Random orbital sander, electric | Abrasives | 2 | 158.283, 158.284 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [RUPES Random Orbital Sander TA50](https://www.carsystem.org/en/products/detail/abrasives/rupes-random-orbital-sander-ta50-random-orbital-sander-pneumatic) — Random orbital sander, pneumatic | Abrasives | 2 | 157.338, 159.007 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Dispenser for 5 kg Polish](https://www.carsystem.org/en/products/detail/finish/dispenser-for-5-kg-polish-dispenser) — Dispenser | Finish | 1 | 156.460 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Finish Back Pad M-14](https://www.carsystem.org/en/products/detail/finish/finish-back-pad-m-14-finish-back-pad) — Finish back pad | Finish | 1 | 160.443 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Polish – Coarse Step 1](https://www.carsystem.org/en/products/detail/finish/polish-coarse-step-1-polish) — Polish | Finish | 1 | 156.451 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Polish – Fine Step 2](https://www.carsystem.org/en/products/detail/finish/polish-fine-step-2-anti-hologram-polish) — Anti-hologram polish | Finish | 1 | 156.452 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [RUPES 47.105 Replacement carbon brush](https://www.carsystem.org/en/products/detail/finish/rupes-47105-replacement-carbon-brush-replacement-carbon-brush) — Replacement carbon brush | Finish | 1 | 158.290 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Rupes 9. Holder BigFoot](https://www.carsystem.org/en/products/detail/finish/rupes-9-holder-bigfoot-wall-racket) — Wall racket | Finish | 1 | 158.134 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [RUPES Polishing Machine LHR75](https://www.carsystem.org/en/products/detail/finish/rupes-polishing-machine-lhr75-polishing-machine-pneumatic) — Polishing machine, pneumatic | Finish | 2 | 157.332, 157.642 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [RUPES Polishing Machine LHR75E](https://www.carsystem.org/en/products/detail/finish/rupes-polishing-machine-lhr75e-polishing-machine-bigfoot-electric) — Polishing machine Bigfoot, electric | Finish | 1 | 157.340 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Wall Bracket for 5 kg Polish](https://www.carsystem.org/en/products/detail/finish/wall-bracket-for-5-kg-polish-wall-bracket) — Wall Bracket | Finish | 1 | 156.461 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Easy Mask](https://www.carsystem.org/en/products/detail/masking/easy-mask-masking-film-roll) — Masking film - Roll | Masking | 2 | 151.199, 151.181 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Hand Mask](https://www.carsystem.org/en/products/detail/masking/hand-mask-handy-masking-film-incl-tape) — Handy masking film incl. tape | Masking | 6 | 144.547, 144.549, 144.550, 144.551 … | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [MMIR-Mask Aqua Tec](https://www.carsystem.org/en/products/detail/masking/mmir-mask-aqua-tec-masking-film-roll) — Masking film - Roll | Masking | 2 | 151.038, 152.055 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [MMIR-Mask Light Green](https://www.carsystem.org/en/products/detail/masking/mmir-mask-light-green-masking-film-roll) — Masking film - Roll | Masking | 4 | 150.453, 150.454, 150.455, 149.587 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [LED Lamp](https://www.carsystem.org/en/products/detail/painting-supplies/led-lamp-led-lamp) — LED lamp | Painting supplies | 1 | 155.037 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [UV LED Lamp](https://www.carsystem.org/en/products/detail/painting-supplies/uv-led-lamp-uv-led-lamp) — UV LED lamp | Painting supplies | 1 | 154.645 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [UV Timer](https://www.carsystem.org/en/products/detail/painting-supplies/uv-timer-timer-for-uv-lamps) — Timer for UV Lamps | Painting supplies | 1 | 154.772 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [2K Clear VOC 420](https://www.carsystem.org/en/products/detail/painting/2k-clear-voc-420-2k-clear-coat) — 2K Clear coat | Painting | 6 | 144.138, 144.140, 144.139, 142.953 … | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [2K Clear VOC CC.19 AS](https://www.carsystem.org/en/products/detail/painting/2k-clear-voc-cc19-as-2k-clear-coat) — 2K Clear coat | Painting | 1 | 156.931 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [2K Clear VOC HS-SR](https://www.carsystem.org/en/products/detail/painting/2k-clear-voc-hs-sr-2k-clear-coat) — 2K Clear coat | Painting | 5 | 153.223, 153.774, 151.909, 151.910 … | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [2K Clear VOC Premium](https://www.carsystem.org/en/products/detail/painting/2k-clear-voc-premium-2k-clear-coat) — 2K Clear coat | Painting | 3 | 146.714, 147.019, 147.862 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [2K Filler Wet on Wet Plus](https://www.carsystem.org/en/products/detail/painting/2k-filler-wet-on-wet-plus-2k-acryl-filler) — 2K Acryl filler | Painting | 3 | 153.455, 153.456, 153.457 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Paint System CPS 2.0](https://www.carsystem.org/en/products/detail/painting/paint-system-cps-20-disposable-paint-cup-system-with-ring-lock) — Disposable paint cup system with ring lock | Painting | 12 | 159.311, 159.312, 159.670, 159.643 … | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [UV Filler Spray](https://www.carsystem.org/en/products/detail/painting/uv-filler-spray-uv-filler-spray) — UV Filler Spray | Painting | 1 | 159.169 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Bodyshirt Black](https://www.carsystem.org/en/products/detail/personal-safety/bodyshirt-black-functional-shirt-short-sleeved) — Functional shirt - short-sleeved | Personal Safety | 2 | 158.536, 158.537 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Explorer Ltd. 2-Piece Coverall](https://www.carsystem.org/en/products/detail/personal-safety/explorer-ltd-2-piece-coverall-protective-coverall) — Protective coverall | Personal Safety | 13 | 159.120, 159.121, 158.682, 158.683 … | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Latex gloves](https://www.carsystem.org/en/products/detail/personal-safety/latex-gloves-protective-gloves) — Protective gloves | Personal Safety | 1 | 157.981 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Elastic Green](https://www.carsystem.org/en/products/detail/putties/elastic-green-polyester-fine-putty) — Polyester - fine putty | Putties | 1 | 146.708 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |
| [Glass fibre fleece](https://www.carsystem.org/en/products/detail/putties/glass-fibre-fleece-40-g-per-m2) — 40 g per m² | Putties | 2 | 125.421, 125.422 | Na carsystem.org postoji, ali ga nema u katalogu 2026/27. |

## Samo u katalogu — nema zvaničnu stranicu ni sliku (3)

| Zvanični proizvod | Kategorija | Varijante | Šifre | Napomena |
| --- | --- | ---: | --- | --- |
| [CAR CLEAN MULTI II](https://www.carsystem.org/fileadmin/CS-Kataloge-2026/Carsystem-product-catalogue-HQ-2026-27-EN.pdf#page=89) — Cleaning cloth | MASKINGPAINTINGFINISH | 1 | 160.515 | U katalogu je, ali nema stranicu na carsystem.org (nema zvanične slike ni opisa). |
| [CLASSIC COVERALL PANTS KNEEPADFIT](https://www.carsystem.org/fileadmin/CS-Kataloge-2026/Carsystem-product-catalogue-HQ-2026-27-EN.pdf#page=94) — Protective coverall pants - Kneepad pocket | MASKINGPAINTINGFINISHCLEANING ABRASIVESPUTTIES | 6 | 160.596, 160.597, 160.598, 160.599 … | U katalogu je, ali nema stranicu na carsystem.org (nema zvanične slike ni opisa). |
| [ERLKING LTD. 2-PIECE COVERALL](https://www.carsystem.org/fileadmin/CS-Kataloge-2026/Carsystem-product-catalogue-HQ-2026-27-EN.pdf#page=93) — Protective Coverall | MASKINGPAINTINGFINISHCLEANING ABRASIVESPUTTIES | 12 | 160.663, 160.669, 160.664, 160.670 … | U katalogu je, ali nema stranicu na carsystem.org (nema zvanične slike ni opisa). |

## Bez SR sadržaja (0)

Nema.

## Isključeno — merchandising (19)

| Zvanični proizvod | Kategorija | Varijante | Šifre | Napomena |
| --- | --- | ---: | --- | --- |
| [Carsystem Cap Black](https://www.carsystem.org/en/products/detail/merchandising-materials/carsystem-cap-black-onesize) — onesize | Merchandising Materials | 1 | 158.927 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Carsystem Cap camouflage](https://www.carsystem.org/en/products/detail/merchandising-materials/carsystem-cap-camouflage-onesize) — onesize | Merchandising Materials | 1 | 160.493 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Carsystem car sticker plain](https://www.carsystem.org/en/products/detail/merchandising-materials/carsystem-car-sticker-plain-four-formats) — four formats | Merchandising Materials | 6 | 158.829, 158.830, 158.831, 158.832 … | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Coffee Cup Black](https://www.carsystem.org/en/products/detail/merchandising-materials/coffee-cup-black-300-ml) — 300 ml | Merchandising Materials | 1 | 157.219 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Cutter Knife black](https://www.carsystem.org/en/products/detail/merchandising-materials/cutter-knife-black-140-mm) — 140 mm | Merchandising Materials | 1 | 156.281 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Doormat logo black](https://www.carsystem.org/en/products/detail/merchandising-materials/doormat-logo-black-50-x-75-cm-and-90-x-60-cm) — 50 x 75 cm and 90 x 60 cm | Merchandising Materials | 2 | 158.622, 158.623 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Hoist flag](https://www.carsystem.org/en/products/detail/merchandising-materials/hoist-flag-120-x-300-cm) — 120 x 300 cm | Merchandising Materials | 1 | 137.325 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Lighter black](https://www.carsystem.org/en/products/detail/merchandising-materials/lighter-black-refillable) — refillable | Merchandising Materials | 1 | 148.281 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Padded Jacket Black 2025](https://www.carsystem.org/en/products/detail/merchandising-materials/padded-jacket-black-2025-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | 160.037, 160.038, 160.039, 160.040 … | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Padded Vest Black 2025](https://www.carsystem.org/en/products/detail/merchandising-materials/padded-vest-black-2025-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | 160.027, 160.028, 160.029, 160.030 … | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Padded Vest Black](https://www.carsystem.org/en/products/detail/merchandising-materials/padded-vest-black-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | 159.288, 159.289, 159.290, 159.291 … | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Pen Trinity Gum black](https://www.carsystem.org/en/products/detail/merchandising-materials/pen-trinity-gum-black-blue-ink) — blue ink | Merchandising Materials | 1 | 156.540 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Socks CARSYSTEM black & white](https://www.carsystem.org/en/products/detail/merchandising-materials/socks-carsystem-black-white-2-size-ranges) — 2 size ranges | Merchandising Materials | 2 | 160.540, 160.542 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Socks CARSYSTEM red & white](https://www.carsystem.org/en/products/detail/merchandising-materials/socks-carsystem-red-white-2-size-range) — 2 size range | Merchandising Materials | 2 | 159.837, 159.839 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Sweatshirt Black #teamCARSYSTEM](https://www.carsystem.org/en/products/detail/merchandising-materials/sweatshirt-black-teamcarsystem-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | 160.325, 160.326, 160.327, 160.328 … | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Sweatshirt Grey #TeamCARSYSTEM](https://www.carsystem.org/en/products/detail/merchandising-materials/sweatshirt-grey-teamcarsystem-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | 159.864, 159.865, 159.866, 159.867 … | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [T-Shirt Black #teamCARSYSTEM](https://www.carsystem.org/en/products/detail/merchandising-materials/t-shirt-black-teamcarsystem-size-s-xxl) — size S - XXL | Merchandising Materials | 5 | 159.827, 159.828, 159.829, 159.830 … | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [USB-Stick](https://www.carsystem.org/en/products/detail/merchandising-materials/usb-stick-64-gb) — 64 GB | Merchandising Materials | 1 | 158.871 | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |
| [Zip-Hoodie black](https://www.carsystem.org/en/products/detail/merchandising-materials/zip-hoodie-black-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | 158.084, 158.085, 158.086, 158.087 … | Promotivna odeća i reklamni materijal; naš sajt ih ne prodaje. Identifikuju se u izveštaju, ne uvoze se. |

## Sukobi izvora za pregled (11)

| Proizvod | Tip | Sajt | Katalog |
| --- | --- | --- | --- |
| CAR CLEAN MULTI II | NO_PRODUCT_PAGE | "—" | "Proizvod je u katalogu, ali nema stranicu na carsystem.org." |
| CLASSIC COVERALL PANTS KNEEPADFIT | NO_PRODUCT_PAGE | "—" | "Proizvod je u katalogu, ali nema stranicu na carsystem.org." |
| ERLKING LTD. 2-PIECE COVERALL | NO_PRODUCT_PAGE | "—" | "Proizvod je u katalogu, ali nema stranicu na carsystem.org." |
| Finish Back Pad M-14 | ARTICLE_NUMBER_DIFFERS | ["160.443"] | [{"articleNumber":"157.721","row":"123 mm 1 1"}] |
| Polishing Pad X1500 | SPECIFICATION_DIFFERS | "HC X1500 / Red / 125 mm / 140 mm" | "HC X1500 / 145 mm" |
| Polishing Pad X1500 | SPECIFICATION_DIFFERS | "HC X1500 / Red / 85 mm / 95 mm" | "HC X1500 / 85 mm" |
| Polishing Pad X1500 | SPECIFICATION_DIFFERS | "MC X1500 / White / 125 mm / 140 mm" | "MC X1500 / 145 mm" |
| Polishing Pad X1500 | SPECIFICATION_DIFFERS | "MC X1500 / White / 85 mm / 95 mm" | "MC X1500 / 85 mm 2 500 Art.-No. Specification SP MOQ" |
| Polishing Pad X8000 | SPECIFICATION_DIFFERS | "AH X8000 / White / 125 mm / 140 mm" | "145 mm" |
| Polishing Pad X8000 | SPECIFICATION_DIFFERS | "AH X8000 / White / 85 mm / 95 mm" | "85 mm" |
| Speedmixer 3 kg | SPECIFICATION_DIFFERS | "Multi Green slow - Speedmixer / green / 2,523 kg cartridge inkl. hardener" | "—" |

## Uvoz po našoj kategoriji (404)

| Kategorija | Proizvoda |
| --- | ---: |
| pribor | 89 |
| boje | 46 |
| abrazivi | 43 |
| kitovi | 42 |
| oprema | 36 |
| poliranje | 36 |
| zastita | 33 |
| maskiranje | 29 |
| ciscenje | 25 |
| radionica | 16 |
| lepkovi | 9 |
