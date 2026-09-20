# SATA — revizija izvora i modela (dry run)

> Generisano: `node scripts/sata-sync/audit.mjs`. Ništa nije uvezeno; runtime, slike i dokumenti nisu menjani. Cene se ne čitaju.

## Brojevi

```
SCOPE: APPROVED_SATA_EMEA_REFINISH_SCOPE
CURRENT_OUT_OF_SCOPE_FAMILIES: 31
CURRENT_PRODUCT_FAMILIES: 97
CURRENT_PRODUCT_FAMILIES_IN_PROPOSED_SCOPE: 66
CURRENT_OFFICIAL_ARTICLE_NUMBERS: 2608
CURRENT_OFFICIAL_ARTICLE_NUMBERS_EUROPE: 2554
CURRENT_VARIANT_MEMBERS: 873
CURRENT_VARIANT_MEMBERS_IN_PROPOSED_SCOPE: 655
CURRENT_ACCESSORIES: 310
CURRENT_SPARE_PARTS: 1170
CURRENT_PART_OR_ACCESSORY_UNSPLIT: 138
CURRENT_CONSUMABLES: 92
CURRENT_INDUSTRIAL_DEVICE_ARTICLES: 140
CURRENT_MERCHANDISE_ARTICLES: 57
CURRENT_REGION_ONLY: 54
UNCERTAIN_NOT_CUSTOMER_FACING: 42
EXISTING_LOCAL_RECORDS: 66
EXACT_MATCH: 47
HIGH_CONFIDENCE: 0
PROBABLE: 0
LEGACY_LOCAL_ONLY: 19
DUPLICATES: 0
NEW_PRODUCT_FAMILIES_TO_IMPORT: 20
EXISTING_PRODUCTS_TO_ENRICH: 46
OFFICIAL_PRODUCT_IMAGES: 2290
UNIQUE_USABLE_PACKSHOTS: 2219
SIBLING_IMAGES_NOT_ATTRIBUTABLE: 71
CURRENT_PRODUCTS_WITH_IMAGE: 61
MISSING_OFFICIAL_ASSETS: 5
UNDERLYING_SATA_RECORDS: 66
VARIANT_FAMILY_MEMBERS: 0
REDIRECT_ONLY_RECORDS: 0
VISIBLE_CUSTOMER_FACING_CARDS_BEFORE: 66
EXPECTED_VISIBLE_CUSTOMER_FACING_CARDS_AFTER: 66
EXPECTED_UNDERLYING_RECORDS_AFTER: 66
EXPECTED_ROW_VARIANTS_AFTER: 655
```

## Regionalna pokrivenost (brojevi artikala po sitemap-u lokala)

| lokal | artikala |
| --- | --- |
| en | 2608 |
| de-de | 2522 |
| en-gb | 2520 |
| it-it | 2552 |
| en-us | 2376 |
| en-ca | 2398 |

Referenca je `/en` (nadskup). Artikal iz `/en` koga nema ni u `de-de`, `en-gb`, `it-it` je `CURRENT_REGION_SPECIFIC`: 54.

## APPROVED_SATA_EMEA_REFINISH_SCOPE — 1 porodica = 1 kartica (ovo NIJE ceo SATA katalog)

| CF | zvanični naziv | SATA kategorija | naša kategorija | varijanti (EU) | ose | slika | dok. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CF1931072 | SATAjet X 5500 | spray-guns/gravity-flow-cup-spray-guns | oprema | 44 | Nozzle Size, Nozzle Technology, Nozzle type, Spray fan, Digital unit version | da | 3 |
| CF1931074 | SATAjet 5000 B | spray-guns/gravity-flow-cup-spray-guns | oprema | 20 | Nozzle Size, Nozzle Technology, Nozzle type | da | 2 |
| CF1931078 | SATAjet 3000 B | spray-guns/gravity-flow-cup-spray-guns | oprema | 1 | — | NE | 0 |
| CF1931079 | SATAjet 1500 B | spray-guns/gravity-flow-cup-spray-guns | oprema | 4 | Air connection thread, Nozzle Size, Nozzle Technology | NE | 2 |
| CF1931080 | SATAjet 1000 B | spray-guns/gravity-flow-cup-spray-guns | oprema | 52 | Air connection thread, Nozzle Size, Nozzle Technology, Nozzle type, Spraygun Cup System | da | 2 |
| CF1931082 | SATAjet 100 B | spray-guns/gravity-flow-cup-spray-guns | oprema | 34 | Nozzle Size, Nozzle Technology, Nozzle type, Spraygun Cup System | da | 2 |
| CF1931083 | SATAjet 20 B | spray-guns/gravity-flow-cup-spray-guns | oprema | 12 | Nozzle Size, Spraygun Cup System | da | 1 |
| CF1931085 | SATAminijet 4400 B | spray-guns/gravity-flow-cup-spray-guns | oprema | 33 | Nozzle Size, Nozzle Technology, Nozzle type, Spraygun Cup System | da | 2 |
| CF1931087 | SATA spray master RP | spray-guns/gravity-flow-cup-spray-guns | oprema | 3 | Nozzle Size | da | 0 |
| CF1931090 | SATAjet 1000 H | spray-guns/suction-cup-spray-guns | oprema | 4 | Nozzle Size | da | 2 |
| CF1931091 | SATAjet H | spray-guns/suction-cup-spray-guns | oprema | 3 | Nozzle Size, Nozzle type | da | 1 |
| CF1931095 | SATAjet 3000 K spray mix | spray-guns/pressure-fed-spray-guns | oprema | 2 | Description | da | 2 |
| CF1931096 | SATAjet 3000 K | spray-guns/pressure-fed-spray-guns | oprema | 16 | Nozzle Size, Nozzle Technology, Nozzle type | da | 2 |
| CF1931097 | SATAjet 1000 KK | spray-guns/pressure-fed-spray-guns | oprema | 1 | Description | da | 0 |
| CF1931098 | SATAjet 1000 K | spray-guns/pressure-fed-spray-guns | oprema | 34 | Nozzle Size, Nozzle Technology, Nozzle type | da | 2 |
| CF1931099 | SATAminijet 1000 K | spray-guns/pressure-fed-spray-guns | oprema | 11 | Nozzle Size, Nozzle Technology, Nozzle type | da | 1 |
| CF1931100 | SATAgraph 4 | spray-guns/airbrush-guns | oprema | 3 | Spraygun Cup System | da | 1 |
| CF1931121 | SATA air vision 5000 | respiratory-protection/full-face-respirator | zastita | 3 | Description | da | 3 |
| CF1931122 | SATA vision 2000 | respiratory-protection/full-face-respirator | zastita | 4 | Description | da | 3 |
| CF1931124 | SATA air star C | respiratory-protection/half-mask-respirator | zastita | 4 | Description | da | 2 |
| CF1931125 | SATA air star F | respiratory-protection/half-mask-respirator | zastita | 1 | Description | NE | 2 |
| CF1931127 | SATA filter series 100 | filter-technology | oprema | 3 | Direction of flow, Installation variation, Number of filter stages, Suitability for breathing protection, Suitability for water-based systems | da | 2 |
| CF1931128 | SATA filter series 200 | filter-technology | oprema | 5 | Direction of flow, Installation variation, Number of filter stages, Suitability for breathing protection, Suitability for water-based systems | da | 2 |
| CF1931129 | SATA filter series 400 | filter-technology | oprema | 12 | Direction of flow, Installation variation, Number of filter stages, Suitability for breathing protection, Suitability for water-based systems | da | 2 |
| CF1931204 | SATA suit race | all-products/additional-products | zastita | 5 | Clothing size | da | 0 |
| CF1931211 | SATA HKU | all-products/additional-products | oprema | 2 | Description | da | 2 |
| CF1931215 | SATA vario top spray | all-products/additional-products | oprema | 12 | Description | da | 1 |
| CF1931220 | SATA mini Set 2 | all-products/additional-products | oprema | 5 | Description | da | 1 |
| CF1931221 | Release agent spray system | all-products/additional-products | oprema | 1 | Description | NE | 0 |
| CF1931282 | SATAjet X 5500 PHASER | spray-guns/gravity-flow-cup-spray-guns | oprema | 12 | Nozzle Size, Nozzle Technology, Spray fan | da | 2 |
| CF1931293 | SATA filter 500 series | filter-technology | oprema | 7 | Direction of flow, Installation variation, Number of filter stages, Suitability for breathing protection, Suitability for water-based systems | da | 2 |
| CF1931300 | SATA HRS-E | all-products/additional-products | oprema | 4 | Description | da | 2 |
| CF1931301 | SATA HRS | all-products/additional-products | oprema | 5 | Description | da | 2 |
| CF1931303 | Reusable plastic flow cup | cup-systems/gravity-flow-cups | pribor | 13 | Cup capacity, Cup connection type | da | 0 |
| CF1931304 | Reusable aluminium flow cup | cup-systems/gravity-flow-cups | pribor | 8 | Cup capacity, Cup connection type | da | 0 |
| CF1931305 | Reusable plastic hanging cups | cup-systems/suspended-cups | pribor | 1 | Description | da | 0 |
| CF1931306 | Reusable aluminium hanging cups | cup-systems/suspended-cups | pribor | 2 | Cup capacity, Cup variant | da | 0 |
| CF1931308 | SATA dry jet Stativ | all-products/additional-products | oprema | 2 | Description | da | 1 |
| CF1931309 | SATA trueSun | all-products/additional-products | oprema | 1 | Power plug version | da | 2 |
| CF1931313 | SATA multi clean 2 | all-products/additional-products | radionica | 1 | Description | da | 3 |
| CF1931315 | SATAjet K 1800 spray mix | spray-guns/pressure-fed-spray-guns | oprema | 3 | Description | da | 3 |
| CF1931319 | SATAjet 1000 B Lignum 3 | spray-guns/gravity-flow-cup-spray-guns | oprema | 8 | Nozzle Size, Nozzle Technology | da | 3 |
| CF1931327 | SATA suit race ladies | all-products/additional-products | zastita | 5 | Clothing size | da | 0 |
| CF1931331 | SATAjet X 5500 Clear Coat Edition | spray-guns/gravity-flow-cup-spray-guns | oprema | 2 | Nozzle Size, Nozzle Technology, Nozzle type, Spray fan, Digital unit version | da | 2 |
| CF1931333 | SATA material pressure tank 10 | all-products/additional-products | oprema | 6 | Agitator version, Cup capacity, Description | da | 0 |
| CF1931334 | SATA material pressure tank 22 | all-products/additional-products | oprema | 8 | Agitator version, Cup capacity, Description | da | 0 |
| CF1931335 | SATA material pressure tank 45 | all-products/additional-products | oprema | 8 | Agitator version, Cup capacity, Description | da | 0 |
| CF1931336 | jet X | spray-guns/gravity-flow-cup-spray-guns | oprema | 68 | Nozzle Size, Nozzle Technology, Spray fan, Digital unit version | da | 2 |
| CF1931338 | LCS - the Liner | cup-systems/lcs-cups | pribor | 8 | Cup capacity, Sieve mesh size, Suitable for UV coating | da | 0 |
| CF1931339 | air star F 2.0 | respiratory-protection/half-mask-respirator | zastita | 1 | — | da | 2 |
| CF1931340 | adam X pro | all-products/additional-products | pribor | 1 | Description | da | 1 |
| CF1931341 | adam X | all-products/additional-products | pribor | 1 | Description | da | 1 |
| CF1931342 | SATA adam 2 | all-products/additional-products | pribor | 15 | Description | da | 2 |
| CF1931343 | SATA suit Standard Men | all-products/additional-products | zastita | 10 | Clothing size | da | 0 |
| CF1931345 | SATA suit Basic | all-products/additional-products | zastita | 5 | Clothing size | da | 0 |
| CF1931348 | RPS - the Original | cup-systems/rps-cups | pribor | 10 | Cup capacity, Packaging unit, Sieve mesh size, Sieve type, Suitable for UV coating | da | 2 |
| CF1931351 | Luftmikrometer | all-products/additional-products | pribor | 3 | Description | da | 0 |
| CF1931352 | Manometer | all-products/additional-products | pribor | 13 | Description | da | 0 |
| CF1931355 | SATA clean RCS | all-products/additional-products | radionica | 3 | Description | da | 3 |
| CF1931356 | jet K | spray-guns/pressure-fed-spray-guns | oprema | 35 | Air connection thread, Nozzle Size, Nozzle Technology, Nozzle type | da | 1 |
| CF1931357 | Lackierpistolenkoffer | all-products/accessories | pribor | 8 | Description | da | 0 |
| CF1931359 | SATA dry jet 2 | all-products/additional-products | oprema | 2 | Description | da | 2 |
| CF1931387 | LCS - Hard Cups | cup-systems/lcs-cups | pribor | 3 | Cup capacity | NE | 0 |
| CF1931392 | jet X clearcoat Edition | cup-systems/lcs-cups | oprema | 5 | Nozzle Size, Nozzle Technology, Spray fan, Digital unit version | da | 2 |
| CF1931393 | jet X basecoat Edition | cup-systems/lcs-cups | oprema | 17 | Nozzle Size, Nozzle Technology, Spray fan, Digital unit version | da | 2 |
| CF1931394 | jet X by Stilbruch Edition | cup-systems/lcs-cups | oprema | 17 | Nozzle Size, Nozzle Technology, Spray fan, Digital unit version | da | 2 |

## CURRENT_OUT_OF_SCOPE — aktuelno kod proizvođača, ne prikazujemo (nije discontinued)

| CF | zvanični naziv | uloga | artikala (EU) | razlog |
| --- | --- | --- | --- | --- |
| CF1931104 | SATAjet 3000 A | COMPLETE_DEVICE_INDUSTRIAL | 31 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931105 | SATAjet 1000 A | COMPLETE_DEVICE_INDUSTRIAL | 12 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931107 | SATAjet 3000 ROB | COMPLETE_DEVICE_INDUSTRIAL | 44 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931108 | SATAjet 1000 ROB | COMPLETE_DEVICE_INDUSTRIAL | 3 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931110 | SATAminijet 1000 ROB | COMPLETE_DEVICE_INDUSTRIAL | 17 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931111 | SATAjet 5000 LAB | COMPLETE_DEVICE_INDUSTRIAL | 7 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931112 | SATAjet 4000 LAB | COMPLETE_DEVICE_INDUSTRIAL | 5 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931115 | SATAminijet 3000 LAB | COMPLETE_DEVICE_INDUSTRIAL | 1 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931116 | SATA LP90 | COMPLETE_DEVICE_INDUSTRIAL | 1 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931117 | SATAminijet 1000 A S | COMPLETE_DEVICE_INDUSTRIAL | 4 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931118 | SATA LP-S 2000 | COMPLETE_DEVICE_INDUSTRIAL | 5 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931131 | SATAminijet 1000 A | COMPLETE_DEVICE_INDUSTRIAL | 10 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931236 | Düsensatz SATAjet 3000 LAB ROB | SPARE_PART | 6 | industrijski/robotski/laboratorijski program, nije auto-reparatura |
| CF1931337 | Nozzle set jet X | SPARE_PART | 17 | rezervni delovi — interni katalog delova, ne customer-facing kartica |
| CF1931360 | Polo shirt in precious SATA design | MERCHANDISE | 5 | reklamni artikli — van asortimana sajta |
| CF1931361 | SATA Hoodie, version FUTURE | MERCHANDISE | 4 | reklamni artikli — van asortimana sajta |
| CF1931362 | SATA Hoodie, version SATAjet X 5500 | MERCHANDISE | 5 | reklamni artikli — van asortimana sajta |
| CF1931363 | SATA Hoodie, version Vintage | MERCHANDISE | 5 | reklamni artikli — van asortimana sajta |
| CF1931364 | T-Shirt SATA jet X (1) | MERCHANDISE | 4 | reklamni artikli — van asortimana sajta |
| CF1931365 | SATA T-Shirt jet X (2) | MERCHANDISE | 4 | reklamni artikli — van asortimana sajta |
| CF1931366 | T-Shirt SATA | MERCHANDISE | 5 | reklamni artikli — van asortimana sajta |
| CF1931367 | SATA suit Standard Ladies | MERCHANDISE | 4 | reklamni artikli — van asortimana sajta |
| CF1931368 | SATA suit Standard Men | MERCHANDISE | 6 | reklamni artikli — van asortimana sajta |
| CF1931372 | SATA knit beanie | MERCHANDISE | 1 | reklamni artikli — van asortimana sajta |
| CF1931374 | SATA gym bag | MERCHANDISE | 1 | reklamni artikli — van asortimana sajta |
| CF1931375 | SATA travel makeup bag | MERCHANDISE | 1 | reklamni artikli — van asortimana sajta |
| CF1931376 | SATA luggage compartment bag | MERCHANDISE | 1 | reklamni artikli — van asortimana sajta |
| CF1931377 | SATA backpack | MERCHANDISE | 1 | reklamni artikli — van asortimana sajta |
| CF1931378 | Key ring miniature spray gun jet X | MERCHANDISE | 1 | reklamni artikli — van asortimana sajta |
| CF1931386 | SATA United jersey 2026 | MERCHANDISE | 6 | reklamni artikli — van asortimana sajta |
| CF1931399 | SATA-Lette | MERCHANDISE | 1 | reklamni artikli — van asortimana sajta |

## Porodice bez javne CF stranice (Shopware parent postoji, SATA ga ne izlaže kao porodicu)

| artikala (EU) | uloga | zajednički početak naziva | ose |
| --- | --- | --- | --- |
| 35 (35) | SPARE_PART | Nozzle set SATAjet 1000 K | Lifetime extension, Nozzle Size, Nozzle Technology, Nozzle type |
| 27 (19) | SPARE_PART | Nozzle set SATAjet 1000 B | Lifetime extension, Nozzle Size, Nozzle Technology, Nozzle type |
| 26 (26) | SPARE_PART | Nozzle set SATAjet X 5500 | Nozzle Size, Nozzle Technology, Spray fan |
| 24 (24) | SPARE_PART | Test air cap | Description |
| 22 (22) | SPARE_PART | Nozzle set SATAjet 3000 K | Lifetime extension, Nozzle Size, Nozzle Technology, Nozzle type |
| 22 (22) | SPARE_PART | Nozzle set SATAjet 3000 ROB | Lifetime extension, Nozzle Size, Nozzle Technology, Nozzle type |
| 21 (21) | SPARE_PART | Nozzle set SATAjet 3000 A | Nozzle Size, Nozzle Technology, Nozzle type |
| 21 (20) | SPARE_PART | Nozzle set SATAjet 4000 | Nozzle Size, Nozzle Technology, Nozzle type |
| 20 (20) | SPARE_PART | Nozzle set SATAjet 5000 B | Nozzle Size, Nozzle Technology, Spray fan |
| 18 (18) | SPARE_PART | Nozzle set SATAjet 3000 B | Lifetime extension, Nozzle Size, Nozzle type |
| 18 (18) | SPARE_PART | Nozzle set SATAminijet 4400 B | Nozzle Size, Nozzle Technology, Nozzle type |
| 17 (17) | SPARE_PART | Nozzle set jet K | Nozzle Size, Nozzle Technology, Nozzle type |
| 17 (17) | SPARE_PART | Air cap jet K | Nozzle Size, Nozzle Technology, Nozzle type |
| 12 (12) | SPARE_PART | Nozzle set SATAminijet 1000 ROB | Nozzle Size, Nozzle Technology, Nozzle type |
| 12 (12) | SPARE_PART | Nozzle set SATAjet 3000 LAB RP 1.2, with spray pattern and t | Nozzle Size, Nozzle Technology, Nozzle type |
| 12 (12) | SPARE_PART | Nozzle set SATAjet X 5500 | Nozzle Size, Nozzle Technology, Spray fan |
| 11 (11) | SPARE_PART | Nozzle set SATAminijet 1000 K | Lifetime extension, Nozzle Size, Nozzle Technology, Nozzle type |
| 11 (9) | SPARE_PART | Nozzle set SATA | Nozzle Size, Nozzle Technology, Nozzle type |
| 10 (10) | SPARE_PART | Nozzle set SATAjet 1000 A | Nozzle Size, Nozzle Technology, Nozzle type |
| 10 (10) | SPARE_PART | Nozzle set SATAminijet 1000 A | Nozzle Size, Nozzle Technology, Nozzle type |
| 10 (10) | SPARE_PART | Nozzle set SATAjet X 5500 | Nozzle Size, Nozzle Technology, Spray fan |
| 9 (9) | SPARE_PART | 15 ml glass cup with plug-in lid and plug-in connection (pac | Cup capacity |
| 9 (9) | UNCLASSIFIED | SATA | Control, Nozzle Size, Nozzle Technology |
| 9 (9) | SPARE_PART | Nozzle set SATAminijet 3000 B HVLP | Lifetime extension, Nozzle Size, Nozzle type |
| 9 (9) | SPARE_PART | Nozzle set SATAjet 4000 LAB | Nozzle Size, Nozzle Technology, Nozzle type |
| 8 (0) | SPARE_PART | Nozzle set SATAjet 4600 B | Lifetime extension, Nozzle Size, Nozzle Technology, Nozzle type |
| 8 (8) | SPARE_PART | Nozzle set SATAjet 5000 B | Nozzle Size, Nozzle Technology, Spray fan |
| 7 (7) | SPARE_PART | Nozzle set SATAjet 5000 LAB | Nozzle Size, Nozzle Technology, Nozzle type |
| 6 (6) | SPARE_PART | Nozzle set SATAjet GR | Nozzle Size, Nozzle type |
| 6 (6) | SPARE_PART | 25 ml glass cup with | Cup capacity, Cup variant |
| 6 (6) | SPARE_PART | Nozzle set SATAjet 1000 ROB RP | Lifetime extension, Nozzle Size, Nozzle type |
| 6 (6) | SPARE_PART | Nozzle set SATAjet 20 B | Nozzle Size |
| 5 (5) | SPARE_PART | 0.7 l pressure pot, aluminium without lid for SATA spray mas | Cup connection type |
| 4 (4) | SPARE_PART | Nozzle set SATAjet 1000 H RP | Nozzle Size, Nozzle Technology |
| 4 (4) | SPARE_PART | Nozzle set SATAminijet | Lifetime extension, Nozzle Size, Nozzle type |
| 4 (4) | SPARE_PART | Nozzle set SATA LPS R | Nozzle Size, Nozzle Technology, Nozzle type |
| 4 (4) | SPARE_PART | Nozzle set SATAjet 1500 B | Nozzle Size, Nozzle Technology |
| 3 (3) | SPARE_PART | Nozzle set SATA spray master RP | Lifetime extension, Nozzle Size, Nozzle type |
| 3 (3) | SPARE_PART | Nozzle set SATAminijet 3000 ROB HVLP | Lifetime extension, Nozzle Size, Nozzle type |
| 3 (3) | SPARE_PART | Nozzle set SATAjet H | Nozzle Size, Nozzle type |
| 2 (2) | ACCESSORY | Reusable aluminium cup with integrated agitator agitator cup | Cup connection type |
| 2 (2) | ACCESSORY | SATA spray mix underbody protection system 1:22, hose pair 10 m, SATAjet | Description |
| 2 (2) | SPARE_PART | Nozzle set SATAminijet 1000 H RP 1.4 | Nozzle Size, Nozzle Technology, Nozzle type |
| 1 (0) | SPARE_PART | Nozzle set SATAjet 800 W RP 1.3 | Lifetime extension, Nozzle Size, Nozzle type |
| 1 (1) | SPARE_PART | Nozzle set SATAgraph 4 0.5 | Nozzle Size |
| 1 (1) | SPARE_PART | Nozzle set SATAjet 100 B P | Nozzle Size, Nozzle Technology, Nozzle type |
| 1 (1) | SPARE_PART | Nozzle set SATA KLC RP 1.3 | Nozzle Technology, Nozzle type |
| 1 (1) | UNCLASSIFIED | SATAjet X 5500 RP DIGITAL Customized | Description |

## Lokalni inventar

```json
{
 "underlyingRecords": 66,
 "variantFamilyMembers": 0,
 "redirectOnlyRecords": 0,
 "visibleCards": 66,
 "records": {
  "EXACT_MATCH": 47,
  "HIGH_CONFIDENCE": 0,
  "PROBABLE": 0,
  "LEGACY_LOCAL_ONLY": 19,
  "DUPLICATE": 0,
  "UNKNOWN": 0
 },
 "brandPageFamilies": {
  "total": 21,
  "EXACT_MATCH": 17,
  "HIGH_CONFIDENCE": 2,
  "PROBABLE": 1,
  "UNKNOWN": 1
 },
 "citedArticleNumbers": {
  "total": 6,
  "EXACT_MATCH": 6,
  "UNKNOWN": 0
 }
}
```

| naziv na brend stranici | klasifikacija | zvanično |
| --- | --- | --- |
| jet X | EXACT_MATCH | CF1931336 |
| SATAjet X 5500 | EXACT_MATCH | CF1931072 |
| SATAjet 5000 B | EXACT_MATCH | CF1931074 |
| SATAjet 1000 B | EXACT_MATCH | CF1931080 |
| SATAjet 100 B F | HIGH_CONFIDENCE | CF1931082 (pod-linija zvanične porodice, ne zasebna porodica) |
| SATAjet 100 B P | HIGH_CONFIDENCE | CF1931082 (pod-linija zvanične porodice, ne zasebna porodica) |
| SATAjet 20 B | EXACT_MATCH | CF1931083 |
| SATAminijet 4400 B | EXACT_MATCH | CF1931085 |
| SATAminijet 1000 K | EXACT_MATCH | CF1931099 |
| jet K | EXACT_MATCH | CF1931356 |
| SATAjet 1000 K | EXACT_MATCH | CF1931098 |
| SATAjet 3000 K | EXACT_MATCH | CF1931096 |
| SATAjet H | EXACT_MATCH | CF1931091 |
| LCS — the Liner | EXACT_MATCH | CF1931338 |
| RPS | PROBABLE | CF1931348 RPS - the Original |
| QCC | UNKNOWN | — |
| SATA filter 500 series | EXACT_MATCH | CF1931293 |
| adam X pro | EXACT_MATCH | CF1931340 |
| SATA air vision 5000 | EXACT_MATCH | CF1931121 |
| SATA multi clean 2 | EXACT_MATCH | CF1931313 |
| SATA trueSun | EXACT_MATCH | CF1931309 |

## Slugovi

Sačuvan postojeći: `satajet-x-5500`, `satajet-5000-b`, `satajet-3000-b`, `satajet-1500-b`, `satajet-1000-b`, `satajet-100-b`, `satajet-20-b`, `sataminijet-4400-b`, `sata-spray-master-rp`, `satajet-1000-h`, `satajet-h`, `satajet-3000-k-spray-mix`, `satajet-3000-k`, `satajet-1000-kk`, `satajet-1000-k`, `sataminijet-1000-k`, `satagraph-4`, `sata-air-vision-5000`, `sata-vision-2000`, `sata-air-star-c`, `sata-air-star-f`, `sata-filter-series-100`, `sata-filter-series-200`, `sata-filter-series-400`, `sata-suit-race`, `sata-hku`, `sata-vario-top-spray`, `sata-mini-set-2`, `satajet-x-5500-phaser`, `sata-filter-500-series`, `sata-hrs-e`, `sata-hrs`, `sata-dry-jet-stativ`, `sata-truesun`, `sata-multi-clean-2`, `satajet-k-1800-spray-mix`, `satajet-1000-b-lignum-3`, `sata-suit-race-ladies`, `satajet-x-5500-clear-coat-edition`, `sata-material-pressure-tank-10`, `sata-material-pressure-tank-22`, `sata-material-pressure-tank-45`, `sata-adam-2`, `sata-suit-basic`, `sata-clean-rcs`, `sata-dry-jet-2`. Kolizija u predlogu: 0.
