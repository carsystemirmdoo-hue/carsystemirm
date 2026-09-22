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
| EXISTING PRODUCTS | 6 |
| EXISTING VARIANTS | 9 |
| EXACT MATCHES | 1 |
| HIGH CONFIDENCE MATCHES | 4 |
| PROBABLE MATCHES | 1 |
| MISSING PRODUCTS | 0 |
| MISSING VARIANTS | 0 |
| variantsSuppliedByEnrichment | 22 |
| AMBIGUOUS | 0 |
| LEGACY PRODUCTS | 0 |
| SOURCE CONFLICTS | 10 |
| MISSING IMAGES | 3 |
| MISSING IMPORTANT DATA | 1 |
| alreadyImported | 456 |
| existingToEnrich | 5 |
| heldPendingDecision | 0 |
| importedWebsiteOnly | 51 |
| heldInactivePage | 0 |
| heldNoProductPage | 3 |
| excludedMerchandising | 0 |
| markedNewBySource | 42 |

## Naši postojeći Carsystem zapisi

| Naš slug | Klasifikacija | Zvanični proizvod | Dokaz | Dopuna |
| --- | --- | --- | --- | --- |
| `carsystem-git-multi-green` | HIGH_CONFIDENCE_MATCH<br>VARIANT_MISSING<br>EXISTING_DATA_INCOMPLETE | Multi Green — Multifuncional polyester putty | identical-official-tds | +3 varijanti; sku je interni placeholder (CS-GIT-MULTI-GREEN); manufacturerCode nije upisan |
| `carsystem-git-elastic-weiss` | HIGH_CONFIDENCE_MATCH<br>VARIANT_MISSING<br>EXISTING_DATA_INCOMPLETE | Elastic white — Polyester - fine putty | identical-official-packshot | +3 varijanti; sku je interni placeholder (CS-GIT-ELASTIC-WEISS); manufacturerCode nije upisan |
| `carsystem-f19-brusni-diskovi` | HIGH_CONFIDENCE_MATCH<br>VARIANT_MISSING<br>EXISTING_DATA_INCOMPLETE | Sanding Disc F.19 — Film abrasive - 150 mm - 25 holes | series-article-range | +12 varijanti; sku je interni placeholder (CS-F19-DISC); manufacturerCode nije upisan |
| `carsystem-f23-brusni-diskovi` | EXACT_MATCH<br>EXISTING_DATA_INCOMPLETE | Sanding Disc F.23 Ceramic — Film abrasive - 150 mm - 25 holes | article-number | +0 varijanti; manufacturerCode nije upisan |
| `carsystem-finish-serija` | HIGH_CONFIDENCE_MATCH<br>VARIANT_MISSING<br>EXISTING_DATA_INCOMPLETE | Sanding Disc F.19 Finish — Film abrasive - 152 mm - 15 holes | series-article-range | +4 varijanti; sku je interni placeholder (CS-FINISH-SERIES); manufacturerCode nije upisan |
| `carsystem-zastitno-odelo` | PROBABLE_MATCH | Classic Coverall Jacket Anthracite — Protective coverall | identical-official-packshot | Jedini dokaz je identična zvanična slika; naziv zapisa je generički. |

## Zadržano ručnom odlukom ili sudarom šifara (0)

Nema.

## Uvezeno sa aktivne stranice carsystem.org iako nije u katalogu 2026/27 (51)

| Zvanični proizvod | Kategorija | Varijante | Naš slug |
| --- | --- | ---: | --- |
| [ProFlex Jupiter Soft](https://www.carsystem.org/en/products/detail/abrasives/proflex-jupiter-soft-film-abrasive-75-mm-multihole) — Film abrasive - 75 mm - multihole | Abrasives | 2 | `carsystem-proflex-jupiter-soft-75-mm` |
| [RUPES Mini Random Orbital Sander LD30](https://www.carsystem.org/en/products/detail/abrasives/rupes-mini-random-orbital-sander-ld30-mini-random-orbital-sander-pneumatic) — Mini random orbital sander, pneumatic | Abrasives | 1 | `carsystem-rupes-mini-random-orbital-sander-ld30` |
| [RUPES Random Orbital Sander ER](https://www.carsystem.org/en/products/detail/abrasives/rupes-random-orbital-sander-er-random-orbital-sander-electric) — Random orbital sander, electric | Abrasives | 2 | `carsystem-rupes-random-orbital-sander-er` |
| [RUPES Random Orbital Sander TA50](https://www.carsystem.org/en/products/detail/abrasives/rupes-random-orbital-sander-ta50-random-orbital-sander-pneumatic) — Random orbital sander, pneumatic | Abrasives | 2 | `carsystem-rupes-random-orbital-sander-ta50` |
| [Dispenser for 5 kg Polish](https://www.carsystem.org/en/products/detail/finish/dispenser-for-5-kg-polish-dispenser) — Dispenser | Finish | 1 | `carsystem-dispenser-for-5-kg-polish` |
| [Finish Back Pad M-14](https://www.carsystem.org/en/products/detail/finish/finish-back-pad-m-14-finish-back-pad) — Finish back pad | Finish | 1 | `carsystem-finish-back-pad-m-14` |
| [Polish – Coarse Step 1](https://www.carsystem.org/en/products/detail/finish/polish-coarse-step-1-polish) — Polish | Finish | 1 | `carsystem-polish-coarse-step-1` |
| [Polish – Fine Step 2](https://www.carsystem.org/en/products/detail/finish/polish-fine-step-2-anti-hologram-polish) — Anti-hologram polish | Finish | 1 | `carsystem-polish-fine-step-2` |
| [RUPES 47.105 Replacement carbon brush](https://www.carsystem.org/en/products/detail/finish/rupes-47105-replacement-carbon-brush-replacement-carbon-brush) — Replacement carbon brush | Finish | 1 | `carsystem-rupes-47-105-replacement-carbon-brush` |
| [Rupes 9. Holder BigFoot](https://www.carsystem.org/en/products/detail/finish/rupes-9-holder-bigfoot-wall-racket) — Wall racket | Finish | 1 | `carsystem-rupes-9-holder-bigfoot` |
| [RUPES Polishing Machine LHR75](https://www.carsystem.org/en/products/detail/finish/rupes-polishing-machine-lhr75-polishing-machine-pneumatic) — Polishing machine, pneumatic | Finish | 2 | `carsystem-rupes-polishing-machine-lhr75` |
| [RUPES Polishing Machine LHR75E](https://www.carsystem.org/en/products/detail/finish/rupes-polishing-machine-lhr75e-polishing-machine-bigfoot-electric) — Polishing machine Bigfoot, electric | Finish | 1 | `carsystem-rupes-polishing-machine-lhr75e` |
| [Wall Bracket for 5 kg Polish](https://www.carsystem.org/en/products/detail/finish/wall-bracket-for-5-kg-polish-wall-bracket) — Wall Bracket | Finish | 1 | `carsystem-wall-bracket-for-5-kg-polish` |
| [Easy Mask](https://www.carsystem.org/en/products/detail/masking/easy-mask-masking-film-roll) — Masking film - Roll | Masking | 2 | `carsystem-easy-mask` |
| [Hand Mask](https://www.carsystem.org/en/products/detail/masking/hand-mask-handy-masking-film-incl-tape) — Handy masking film incl. tape | Masking | 6 | `carsystem-hand-mask` |
| [MMIR-Mask Aqua Tec](https://www.carsystem.org/en/products/detail/masking/mmir-mask-aqua-tec-masking-film-roll) — Masking film - Roll | Masking | 2 | `carsystem-mmir-mask-aqua-tec` |
| [MMIR-Mask Light Green](https://www.carsystem.org/en/products/detail/masking/mmir-mask-light-green-masking-film-roll) — Masking film - Roll | Masking | 4 | `carsystem-mmir-mask-light-green` |
| [Carsystem Cap Black](https://www.carsystem.org/en/products/detail/merchandising-materials/carsystem-cap-black-onesize) — onesize | Merchandising Materials | 1 | `carsystem-cap-black` |
| [Carsystem Cap camouflage](https://www.carsystem.org/en/products/detail/merchandising-materials/carsystem-cap-camouflage-onesize) — onesize | Merchandising Materials | 1 | `carsystem-cap-camouflage` |
| [Carsystem car sticker plain](https://www.carsystem.org/en/products/detail/merchandising-materials/carsystem-car-sticker-plain-four-formats) — four formats | Merchandising Materials | 6 | `carsystem-car-sticker-plain` |
| [Coffee Cup Black](https://www.carsystem.org/en/products/detail/merchandising-materials/coffee-cup-black-300-ml) — 300 ml | Merchandising Materials | 1 | `carsystem-coffee-cup-black` |
| [Cutter Knife black](https://www.carsystem.org/en/products/detail/merchandising-materials/cutter-knife-black-140-mm) — 140 mm | Merchandising Materials | 1 | `carsystem-cutter-knife-black` |
| [Doormat logo black](https://www.carsystem.org/en/products/detail/merchandising-materials/doormat-logo-black-50-x-75-cm-and-90-x-60-cm) — 50 x 75 cm and 90 x 60 cm | Merchandising Materials | 2 | `carsystem-doormat-logo-black` |
| [Hoist flag](https://www.carsystem.org/en/products/detail/merchandising-materials/hoist-flag-120-x-300-cm) — 120 x 300 cm | Merchandising Materials | 1 | `carsystem-hoist-flag` |
| [Lighter black](https://www.carsystem.org/en/products/detail/merchandising-materials/lighter-black-refillable) — refillable | Merchandising Materials | 1 | `carsystem-lighter-black` |
| [Padded Jacket Black 2025](https://www.carsystem.org/en/products/detail/merchandising-materials/padded-jacket-black-2025-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | `carsystem-padded-jacket-black-2025` |
| [Padded Vest Black 2025](https://www.carsystem.org/en/products/detail/merchandising-materials/padded-vest-black-2025-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | `carsystem-padded-vest-black-2025` |
| [Padded Vest Black](https://www.carsystem.org/en/products/detail/merchandising-materials/padded-vest-black-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | `carsystem-padded-vest-black` |
| [Pen Trinity Gum black](https://www.carsystem.org/en/products/detail/merchandising-materials/pen-trinity-gum-black-blue-ink) — blue ink | Merchandising Materials | 1 | `carsystem-pen-trinity-gum-black` |
| [Socks CARSYSTEM black & white](https://www.carsystem.org/en/products/detail/merchandising-materials/socks-carsystem-black-white-2-size-ranges) — 2 size ranges | Merchandising Materials | 2 | `carsystem-socks-carsystem-black-white` |
| [Socks CARSYSTEM red & white](https://www.carsystem.org/en/products/detail/merchandising-materials/socks-carsystem-red-white-2-size-range) — 2 size range | Merchandising Materials | 2 | `carsystem-socks-carsystem-red-white` |
| [Sweatshirt Black #teamCARSYSTEM](https://www.carsystem.org/en/products/detail/merchandising-materials/sweatshirt-black-teamcarsystem-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | `carsystem-sweatshirt-black-teamcarsystem` |
| [Sweatshirt Grey #TeamCARSYSTEM](https://www.carsystem.org/en/products/detail/merchandising-materials/sweatshirt-grey-teamcarsystem-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | `carsystem-sweatshirt-grey-teamcarsystem` |
| [T-Shirt Black #teamCARSYSTEM](https://www.carsystem.org/en/products/detail/merchandising-materials/t-shirt-black-teamcarsystem-size-s-xxl) — size S - XXL | Merchandising Materials | 5 | `carsystem-t-shirt-black-teamcarsystem` |
| [USB-Stick](https://www.carsystem.org/en/products/detail/merchandising-materials/usb-stick-64-gb) — 64 GB | Merchandising Materials | 1 | `carsystem-usb-stick` |
| [Zip-Hoodie black](https://www.carsystem.org/en/products/detail/merchandising-materials/zip-hoodie-black-size-s-3xl) — size S - 3XL | Merchandising Materials | 6 | `carsystem-zip-hoodie-black` |
| [LED Lamp](https://www.carsystem.org/en/products/detail/painting-supplies/led-lamp-led-lamp) — LED lamp | Painting supplies | 1 | `carsystem-led-lamp` |
| [UV LED Lamp](https://www.carsystem.org/en/products/detail/painting-supplies/uv-led-lamp-uv-led-lamp) — UV LED lamp | Painting supplies | 1 | `carsystem-uv-led-lamp` |
| [UV Timer](https://www.carsystem.org/en/products/detail/painting-supplies/uv-timer-timer-for-uv-lamps) — Timer for UV Lamps | Painting supplies | 1 | `carsystem-uv-timer` |
| [2K Clear VOC 420](https://www.carsystem.org/en/products/detail/painting/2k-clear-voc-420-2k-clear-coat) — 2K Clear coat | Painting | 6 | `carsystem-2k-clear-voc-420` |
| [2K Clear VOC CC.19 AS](https://www.carsystem.org/en/products/detail/painting/2k-clear-voc-cc19-as-2k-clear-coat) — 2K Clear coat | Painting | 1 | `carsystem-2k-clear-voc-cc-19-as` |
| [2K Clear VOC HS-SR](https://www.carsystem.org/en/products/detail/painting/2k-clear-voc-hs-sr-2k-clear-coat) — 2K Clear coat | Painting | 5 | `carsystem-2k-clear-voc-hs-sr` |
| [2K Clear VOC Premium](https://www.carsystem.org/en/products/detail/painting/2k-clear-voc-premium-2k-clear-coat) — 2K Clear coat | Painting | 3 | `carsystem-2k-clear-voc-premium` |
| [2K Filler Wet on Wet Plus](https://www.carsystem.org/en/products/detail/painting/2k-filler-wet-on-wet-plus-2k-acryl-filler) — 2K Acryl filler | Painting | 3 | `carsystem-2k-filler-wet-on-wet-plus` |
| [Paint System CPS 2.0](https://www.carsystem.org/en/products/detail/painting/paint-system-cps-20-disposable-paint-cup-system-with-ring-lock) — Disposable paint cup system with ring lock | Painting | 12 | `carsystem-paint-system-cps-2-0` |
| [UV Filler Spray](https://www.carsystem.org/en/products/detail/painting/uv-filler-spray-uv-filler-spray) — UV Filler Spray | Painting | 1 | `carsystem-uv-filler-spray` |
| [Bodyshirt Black](https://www.carsystem.org/en/products/detail/personal-safety/bodyshirt-black-functional-shirt-short-sleeved) — Functional shirt - short-sleeved | Personal Safety | 2 | `carsystem-bodyshirt-black` |
| [Explorer Ltd. 2-Piece Coverall](https://www.carsystem.org/en/products/detail/personal-safety/explorer-ltd-2-piece-coverall-protective-coverall) — Protective coverall | Personal Safety | 13 | `carsystem-explorer-ltd-2-piece-coverall` |
| [Latex gloves](https://www.carsystem.org/en/products/detail/personal-safety/latex-gloves-protective-gloves) — Protective gloves | Personal Safety | 1 | `carsystem-latex-gloves` |
| [Elastic Green](https://www.carsystem.org/en/products/detail/putties/elastic-green-polyester-fine-putty) — Polyester - fine putty | Putties | 1 | `carsystem-elastic-green` |
| [Glass fibre fleece](https://www.carsystem.org/en/products/detail/putties/glass-fibre-fleece-40-g-per-m2) — 40 g per m² | Putties | 2 | `carsystem-glass-fibre-fleece` |

## Stranica u sitemap-u bez naziva ili šifre (neaktivna) (0)

Nema.

## Samo u katalogu — nema zvaničnu stranicu ni sliku (3)

| Zvanični proizvod | Kategorija | Varijante | Šifre | Napomena |
| --- | --- | ---: | --- | --- |
| [CAR CLEAN MULTI II](https://www.carsystem.org/fileadmin/CS-Kataloge-2026/Carsystem-product-catalogue-HQ-2026-27-EN.pdf#page=89) — Cleaning cloth | MASKINGPAINTINGFINISH | 1 | 160.515 | U katalogu je, ali nema stranicu na carsystem.org (nema zvanične slike ni opisa). |
| [CLASSIC COVERALL PANTS KNEEPADFIT](https://www.carsystem.org/fileadmin/CS-Kataloge-2026/Carsystem-product-catalogue-HQ-2026-27-EN.pdf#page=94) — Protective coverall pants - Kneepad pocket | MASKINGPAINTINGFINISHCLEANING ABRASIVESPUTTIES | 6 | 160.596, 160.597, 160.598, 160.599 … | U katalogu je, ali nema stranicu na carsystem.org (nema zvanične slike ni opisa). |
| [ERLKING LTD. 2-PIECE COVERALL](https://www.carsystem.org/fileadmin/CS-Kataloge-2026/Carsystem-product-catalogue-HQ-2026-27-EN.pdf#page=93) — Protective Coverall | MASKINGPAINTINGFINISHCLEANING ABRASIVESPUTTIES | 12 | 160.663, 160.669, 160.664, 160.670 … | U katalogu je, ali nema stranicu na carsystem.org (nema zvanične slike ni opisa). |

## Bez SR sadržaja (1)

| Zvanični proizvod | Kategorija | Varijante | Šifre | Napomena |
| --- | --- | ---: | --- | --- |
| [Sanding Disc P.19](https://www.carsystem.org/en/products/detail/abrasives/sanding-disc-p19-paper-abrasive-150-mm-25-holes) — Paper abrasive - 150 mm - 25 holes | Abrasives | 13 | 156.357, 156.358, 156.359, 156.361 … | Nema SR sadržaja. |

## Isključeno taxonomy mapom (0)

Nema.

## Sukobi izvora za pregled (10)

| Proizvod | Tip | Sajt | Katalog |
| --- | --- | --- | --- |
| CAR CLEAN MULTI II | NO_PRODUCT_PAGE | "—" | "Proizvod je u katalogu, ali nema stranicu na carsystem.org." |
| CLASSIC COVERALL PANTS KNEEPADFIT | NO_PRODUCT_PAGE | "—" | "Proizvod je u katalogu, ali nema stranicu na carsystem.org." |
| ERLKING LTD. 2-PIECE COVERALL | NO_PRODUCT_PAGE | "—" | "Proizvod je u katalogu, ali nema stranicu na carsystem.org." |
| Finish Back Pad M-14 | ARTICLE_NUMBER_DIFFERS | ["160.443"] | [{"articleNumber":"157.721","row":"123 mm 1 1"}] |
| Polishing Pad X1500 | SPECIFICATION_DIFFERS | "HC X1500 / Red / 125 mm / 140 mm" | "HC X1500 / 145 mm" |
| Polishing Pad X1500 | SPECIFICATION_DIFFERS | "HC X1500 / Red / 85 mm / 95 mm" | "HC X1500 / 85 mm" |
| Polishing Pad X1500 | SPECIFICATION_DIFFERS | "MC X1500 / White / 125 mm / 140 mm" | "MC X1500 / 145 mm" |
| Polishing Pad X1500 | SPECIFICATION_DIFFERS | "MC X1500 / White / 85 mm / 95 mm" | "MC X1500 / 85 mm" |
| Polishing Pad X8000 | SPECIFICATION_DIFFERS | "AH X8000 / White / 125 mm / 140 mm" | "145 mm" |
| Polishing Pad X8000 | SPECIFICATION_DIFFERS | "AH X8000 / White / 85 mm / 95 mm" | "85 mm" |

## Uvoz po našoj kategoriji (456)

| Kategorija | Proizvoda |
| --- | ---: |
| pribor | 95 |
| boje | 52 |
| zastita | 48 |
| oprema | 45 |
| abrazivi | 44 |
| kitovi | 44 |
| poliranje | 38 |
| maskiranje | 33 |
| ciscenje | 25 |
| radionica | 23 |
| lepkovi | 9 |
