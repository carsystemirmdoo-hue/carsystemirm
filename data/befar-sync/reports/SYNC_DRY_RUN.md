# BEFAR catalog sync — DRY RUN

Primarni izvor: aktuelni sajt https://en.befar.com.tr (kontrola: https://www.befar.com.tr; crawl 2026-09-19T03:25:53.810Z).

Sekundarni izvor: **BEFAR Product Catalog** — https://en.befar.com.tr/_files/ugd/446a5e_9192e551cfa540ae95f10c5247f2587b.pdf

sha256 `c9fb37b15509ca717b4851bf9b44c6361695571b852804e242c5c76fa5f74503` · 48 strana.

Generisano komandom `npm run befar:sync:plan`. Ovaj korak ne menja katalog.

## Zbir

| Metrika | Vrednost |
| --- | ---: |
| CURRENT_ACTIVE_BEFAR_PRODUCT_FAMILIES | 56 |
| CURRENT_ACTIVE_BEFAR_CODES | 185 |
| CATALOGUE_FAMILIES | 41 |
| CATALOGUE_CODES | 249 |
| LOCAL_PRODUCTS_BEFORE | 8 |
| LOCAL_CODES_BEFORE | 0 |
| MATCHED | 0 |
| PROBABLE | 8 |
| LEGACY_LOCAL_ONLY | 0 |
| WEBSITE_AND_CATALOGUE | 50 |
| WEBSITE_ONLY | 6 |
| CATALOGUE_ONLY | 99 |
| SOURCE_CONFLICT | 7 |
| MISSING_PRODUCTS | 0 |
| MISSING_CODES | 0 |
| MISSING_IMAGES | 0 |
| MISSING_DESCRIPTIONS | 0 |
| newProducts | 0 |
| existingProducts | 56 |

## Akcije

| Akcija | Proizvoda |
| --- | ---: |
| IMPORT | 56 |

## Naši postojeći Befar zapisi

| Naš zapis | Klasifikacija | Zvanični kandidati | Dokaz |
| --- | --- | --- | --- |
| `befar-sundjer-narandzasti-25x150` | PROBABLE_MATCH | Befar Plus Velcro Polishing Pad (54402); Velcro Polishing Pad (04402); Waffle Velcro Polishing Pad (04502) | boja (orange) + dimenzija (25x150 mm) odgovaraju 3 zvaničnih šifara u 3 porodica (54402, 04402, 04502) — bez zvanične šifre se ne može znati koja je naša |
| `befar-sundjer-narandzasti-50x150` | PROBABLE_MATCH | Befar Plus With Applicator Compounding Pad (52402); Leo Plus Advance Velcro Compounding Pad (55402ADV); Leo Plus Advance with Applicator Compounding Pad (52402ADV) | boja (orange) + dimenzija (50x150 mm) odgovaraju 3 zvaničnih šifara u 3 porodica (52402, 55402ADV, 52402ADV) — bez zvanične šifre se ne može znati koja je naša |
| `befar-sundjer-crni-25x150` | PROBABLE_MATCH | Velcro Polishing Pad (04403); Waffle Velcro Polishing Pad (04503) | boja (black) + dimenzija (25x150 mm) odgovaraju 2 zvaničnih šifara u 2 porodica (04403, 04503) — bez zvanične šifre se ne može znati koja je naša |
| `befar-sundjer-crni-50x150` | PROBABLE_MATCH | Leo Plus Advance Velcro Compounding Pad (55403ADV); Leo Plus Advance with Applicator Compounding Pad (52403ADV) | boja (black) + dimenzija (50x150 mm) odgovaraju 2 zvaničnih šifara u 2 porodica (55403ADV, 52403ADV) — bez zvanične šifre se ne može znati koja je naša |
| `befar-sundjer-beli-25x150` | PROBABLE_MATCH | Velcro Polishing Pad (04401); Waffle Velcro Polishing Pad (04501) | boja (white) + dimenzija (25x150 mm) odgovaraju 2 zvaničnih šifara u 2 porodica (04401, 04501) — bez zvanične šifre se ne može znati koja je naša |
| `befar-sundjer-beli-50x150` | PROBABLE_MATCH | Leo Plus Advance Velcro Compounding Pad (55401ADV); Leo Plus Advance with Applicator Compounding Pad (52401ADV) | boja (white) + dimenzija (50x150 mm) odgovaraju 2 zvaničnih šifara u 2 porodica (55401ADV, 52401ADV) — bez zvanične šifre se ne može znati koja je naša |
| `befar-sundjer-plavi-25x150` | PROBABLE_MATCH | Befar Plus Velcro Polishing Pad (54405); Waffle Velcro Polishing Pad (04505) | boja (blue) + dimenzija (25x150 mm) odgovaraju 2 zvaničnih šifara u 2 porodica (54405, 04505) — bez zvanične šifre se ne može znati koja je naša |
| `befar-sundjer-plavi-50x150` | PROBABLE_MATCH | Befar Plus With Applicator Compounding Pad (52405); Leo Plus Advance Velcro Compounding Pad (55405ADV); Leo Plus Advance with Applicator Compounding Pad (52405ADV) | boja (blue) + dimenzija (50x150 mm) odgovaraju 3 zvaničnih šifara u 3 porodica (52405, 55405ADV, 52405ADV) — bez zvanične šifre se ne može znati koja je naša |

## Proizvodi i mapiranje kategorija

| Linija | Zvanični proizvod | Šifara | Izvor | Naša kategorija | Akcija |
| --- | --- | ---: | --- | --- | --- |
| Befar | Anti Hologram | 2 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Auto Polish | 2 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Backing Pad | 3 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Befar Plus | Befar Plus Hand Compounding Pad | 7 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar Plus | Befar Plus Velcro Polishing Pad | 8 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar Plus | Befar Plus Velcro Woolpad | 3 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar Plus | Befar Plus Wax Pad Conical Pad | 7 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar Plus | Befar Plus With Applicator Compounding Pad | 8 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Carved Velcro Polishing Pad | 5 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Cream Compound | 3 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Drill Type Headlight Cleaning Pad | 1 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Drill Type Wheel Cleaning Pad | 1 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Ellipse Corrugated Polishing Compounding Pad | 4 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Extra Cream Compound | 3 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Hard Velcro Backing Pad | 4 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Befar | Headlight Cleaning Set | 1 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Ceramic Aplication Block | 4 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Leo | Leo Ceramic Cloth | 1 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Leo | Leo Compound - Polish Set | 1 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Detailing Backing Pad | 3 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Leo | Leo Hamburger Pad | 1 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Mini Detailing Cleaning Set | 1 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Nano Ceramic Paint Protector Set | 1 | WEBSITE_AND_CATALOGUE | zastita | IMPORT |
| Leo | Leo Plus Advance Velcro Compounding Pad | 6 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Plus Advance with Applicator Compounding Pad | 6 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Plus Air Lines Orbital Velcro Compounding Pad | 6 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Plus Air Lines with 16 Holes Orbital Velcro Compounding Pad | 6 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Premium Advance Velcro Compounding Pad | 1 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Premium Advance With Applicator Compounding Pad | 1 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Premium Air Lines Velcro Compounding Pad | 2 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Leo | Leo Premium Compounding Pad | 1 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Liquid Compound | 2 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | M14 Adapter | 1 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Befar | Medium Hard Velcro Backing Pad | 3 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Befar | Mikrofiber Clothes | 2 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Non Wowen Abrasive | 2 | WEBSITE_AND_CATALOGUE | abrazivi | IMPORT |
| Befar | Paint Protector | 2 | WEBSITE_AND_CATALOGUE | zastita | IMPORT |
| Befar | Plastic Putty Aplicatior | 1 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Befar | Plate Type Felt Backing Pad | 1 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Befar | Polishing Sponge with Applicator | 4 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Sanding Block · Hard Red | 3 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Befar | Sanding Block · Soft Orange | 3 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Befar | Sanding Pad | 1 | WEBSITE_ONLY | pribor | IMPORT |
| Befar | Sandwich Velcro Backing Pad | 3 | WEBSITE_ONLY | pribor | IMPORT |
| Befar | Soft Velcro Backing Pad | 4 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Befar | Static Fail | 2 | WEBSITE_AND_CATALOGUE | maskiranje | IMPORT |
| Befar | Tack Cloth | 3 | WEBSITE_AND_CATALOGUE | ciscenje | IMPORT |
| Turkuaz | Turkuaz Compound | 1 | WEBSITE_ONLY | poliranje | IMPORT |
| Turkuaz | Turkuaz Polish | 1 | WEBSITE_ONLY | poliranje | IMPORT |
| Turkuaz | Turkuaz Sanding Block · Blue | 3 | WEBSITE_AND_CATALOGUE | pribor | IMPORT |
| Turkuaz | Turkuaz Static Fail | 4 | WEBSITE_AND_CATALOGUE | maskiranje | IMPORT |
| Turkuaz | Turkuaz With Applicator Compounding Pad | 2 | WEBSITE_ONLY | poliranje | IMPORT |
| Befar | Velcro Polishing Pad | 15 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Velcro Woolpad | 4 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | Waffle Velcro Polishing Pad | 11 | WEBSITE_AND_CATALOGUE | poliranje | IMPORT |
| Befar | With Applicator Compounding Pad | 4 | WEBSITE_ONLY | poliranje | IMPORT |

## Samo u digitalnom katalogu — `CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE`

| Str. | Naslovi strane | Šifre |
| ---: | --- | --- |
| 4 | COMPOUNDING FOAM | 02401, 02402, 02403, 02404, 02405 |
| 5 | VELCRO / COMPOUNDING FOAM | 03401, 03402, 03403, 03404, 03405 |
| 6 | VELCRO / COMPOUNDING FOAM | 04405 |
| 8 | VELCRO COMPOUNDING FOAM / VELCRO CONICAL COMPOUNDING FOAM | 44311, 44312, 44313, 44314, 44315, 44317, 44511, 44512, 44513, 44514, 44515, 44517 |
| 9 | PLUS VELCRO COMPOUNDING FOAM / VELCRO CONICAL COMPOUNDING FOAM / VELCRO WAFFLE COMPOUNDING FOAM | 44809, 44808, 44811, 44812, 44813, 44814, 44815, 44817 |
| 10 | VELCRO / COMPOUNDING FOAM | 06405 |
| 11 | COMPOUNDING FOAM | 10105 |
| 12 | VELCRO COMPOUNDING FOAM FOR HAND APPLICATOR / WHEEL CLEANING HAND FOAM / VELCRO HAND APPLICATOR | 14101, 14102, 14103, 14104, 14105, 14107, 92201, 92202, 92203, 92204, 92205, 92206, 14250, 14255 |
| 13 | HAND COMPOUNDING FOAM / WAX PAD CONICAL PAD / WAX PAD | 13101, 13102, 13103, 13104, 13105, 13107 |
| 15 | PLUS / COMPOUNDING FOAM / POLISH OR ANTI HOLOGRAM | 52401 |
| 17 | POLISH OR ANTI HOLOGRAM / PLUS VELCRO / COMPOUNDING FOAM | 54401 |
| 18 | POLISH OR ANTI HOLOGRAM / PLUS VELCRO / COMPOUNDING FOAM | 56401 |
| 19 | POLISH OR ANTI HOLOGRAM / APPLICATOR / COMPOUNDING FOAM | 11001 |
| 20 | POLISH OR ANTI HOLOGRAM / PLUS VELCRO / COMPOUNDING FOAM | 58401, 58402 |
| 23 | VELCRO BASIC PAD POL YURETHANE / BEFAR VELCRO BASIC PAD FOR BUFFING PAD | 96125, 96150 |
| 24 | SOFT / BACKING PAD / HARD | 93007, 93015, 93062, 93207, 93215, 93262 |
| 25 | SOFT / ECO BACKING PAD | 77207, 77215, 93700, 93753 |
| 27 | STATIC FOIL / STATIC / HALF STATIC FOIL | 64100, 64300, 79100, 79300 |
| 28 | MIKROFIBER CLOTHES / PLUS MIKROFIBER CLOTHES / RED NON WOVEN ABRASIVE 280 P | 01407 |
| 29 | SOFT / 0RANGE / SANDING BLOCK | 95001, 95002 |
| 30 | LEO SLIM SANDING BLOCK WHITE & BLACK / BEFAR SANDING BLOCK FOR / ABRASIVE PAPER RED & BLACK | 77010, 90010, 90030 |
| 32 | HEADLIGHT CLEANING SET / 2PCS 76 MM 1000PS VELCRO WATER SANDING PAPER / 2PCS 76MM 2000PS VELCRO WATER SANDING PAPER | 92100 |
| 33 | CREAM COMPOUND / EXTRA CREAM COMPOUND | 60150, 60400, 76150, 76400 |
| 37 | LEO PLUS TRIPPLE MIDDLE / HARD DETAILING VELCRO PAD / LEO PLUS MIDDLE | 59532 |
| 38 | LEO PLUS MINI DETAILING / CLEANING SET / LEO PLUS CERAMIC APLICATION BLOCK / LEO PLUS CERAMIC CLOTH | 05717, 800120, 80012R |
| 39 | 1PCS MICROFIBER CLOTH / 1PCS DOUBLEFACE HAND FOAM / LEO COMPOUND POLISH SET | 68130L, 68160L, 68180L, 78130L, 78160L, 78180L |
| 40 | NANO CERAMIC SET / 1PCS CERAMIC LIQUD / 1PCS MICROFIBER CLOTH | 98030 |
| 41 | LEO PLUS MAGIC SPONGE / DOUBLE FACE HAND FOAM / PROFESSIONAL | 81011L, 20241 |

## Konflikti zvaničnih izvora

| Tip | Šifra | Nalaz | Razrešenje |
| --- | --- | --- | --- |
| SAME_CODES_DIFFERENT_TITLES | 59507ADV | Leo Premium Advance With Applicator Compounding Pad ↔ Leo Plus Advance with Applicator Compounding Pad (aplikatörlü-polisaj-süngerleri#1, leo-ürün-serisi#9) | isti skup šifara = isti proizvod; naziv: „Leo Premium Advance With Applicator Compounding Pad” |
| SAME_CODES_DIFFERENT_TITLES | 05712 | Leo Mini Detailing Cleaning Set ↔ Leo Mini Cleaning Set (diğer-ürünler#3, set-grubu#3) | isti skup šifara = isti proizvod; naziv: „Leo Mini Detailing Cleaning Set” |
| SAME_CODES_DIFFERENT_TITLES | 09901 | Leo Detailing Pad ↔ Leo Detailing Backing Pad (leo-ürün-serisi#3, taban-grubu#1) | isti skup šifara = isti proizvod; naziv: „Leo Detailing Backing Pad” |
| SAME_CODES_DIFFERENT_QUALIFIER | 93107 | Backing Pad: zımpara-grubu#2 „SOFT” ↔ zımpara-grubu#3 „HARD” | isti skup šifara naveden dvaput sa različitom oznakom tvrdoće; šifre su jedan proizvod, a oznaka se NE prenosi u naziv dok je proizvođač ne uskladi |
| EN_TITLE_DUPLICATED_TR_TITLE_DIFFERS | 55401ADV | EN „Leo Premium Advance Velcro Compounding Pad” stoji uz dva proizvoda; TR „Leo Plus Advance Cırtlı Polisaj Süngeri” | naziv prema turskom originalu: „Leo Plus Advance Velcro Compounding Pad” |
| WEBSITE_VS_CATALOGUE_DIMENSION | 91030 | sajt „15x25cm” ↔ katalog str. 28 „150 x 220 mm” | merodavan je aktuelni sajt; vrednost iz kataloga ostaje zabeležena uz varijantu |
| WEBSITE_VS_CATALOGUE_DIMENSION | 87101 | sajt „117x75mm” ↔ katalog str. 31 „115 x 75 mm” | merodavan je aktuelni sajt; vrednost iz kataloga ostaje zabeležena uz varijantu |
