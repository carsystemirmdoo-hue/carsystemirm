# Final image audit

> Status: **APPROVED_FOR_OWNER_IMAGE_SUPPLY**. Izmereno nad `main` = `621cbad9ae7cd3969dd4d255e888550124cf8a4a`. Ništa nije preuzeto, nijedna slika ni `productImage` referenca nije menjana.

**Praćeni (canonical) fajlovi** — `data/catalog/image-supply/`: `MISSING_PRODUCT_IMAGES.csv`, `USER_IMAGE_SUPPLY_QUEUE.csv`, `IMAGE_RIGHTS_REVIEW.csv`, `OWNER_SUPPLY_BATCH_01_CANDIDATES.csv`, `manifest-lock.json`. Provera: `npm run catalog:image-supply:check`. Vodič za vlasnika: `docs/catalog/USER_IMAGE_SUPPLY_GUIDE.md`. Runtime sajta ove fajlove ne čita.

**Image-quality workflow ima ODVOJEN canonical evidence** (nije deo supply lock-a, koji po dizajnu pokriva samo MISSING / USER_SUPPLY / RIGHTS): `data/catalog/image-quality/IMAGE_QUALITY_QUEUE.csv` (usklađeni queue; SHA-256 `66c50884505a6ad1b2f6190064f8d2f89efaf22857523dd5d9e92d8ff63eeef2`) i `docs/catalog/image-quality/CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md` (handoff, `HISTORICAL_IMPLEMENTATION_EVIDENCE`). Ni ti fajlovi nisu runtime.

**Kako se ovi fajlovi prave.** `npm run catalog:image-supply:generate` (`scripts/catalog/image-audit/`) ih gradi iz STVARNOG runtime kataloga i praćenih dokaza u `data/catalog/image-quality/evidence/`. Drugo pokretanje daje bajt-identične izlaze. Provera zatečenog stanja: `npm run catalog:image-supply:check`.

**Nepraćeni radni međuizlaz** (`.cache/image-audit/`, ne čita ga ni runtime ni budući importer): pun inventar `IMAGE_IDENTITY_INVENTORY.csv` (1823 redova; SHA-256 `bba2c8fba1c95ce3662f1a92ef7d9e5ed5e3f69009c1b1617c1e53d199f244cc`, otisak je u lock-u). Nazivi fajlova bez putanje u nastavku odnose se na taj radni inventar, osim canonical manifesta navedenih gore.

Kolone `USER_IMAGE_SUPPLY_QUEUE.csv`: odobreni owner supply pack (isti `image_id` / `suggested_filename` / `target_path` kao u `MISSING_PRODUCT_IMAGES.csv`), dopunjen sa `public_code`, `manufacturer_code`, `image_scope`, `members_sharing_identity`, `what_image_is_needed`, `why_image_is_needed`.

## 1. Kartice (izmereno iz runtime-a)

| Brend | Kartice | Image identities | Zapisi na placeholderu | Placeholder identities | Kartice čije je LICE placeholder |
|---|---|---|---|---|---|
| Carsystem | 437 | 437 | 0 | 0 | 0 |
| RUPES | 25 | 25 | 0 | 0 | 0 |
| C.A.R.FIT | 122 | 122 | 0 | 0 | 0 |
| BEFAR | 64 | 102 | 0 | 0 | 0 |
| R-M | 223 | 218 | 43 | 38 | 43 |
| baslac | 57 | 61 | 171 | 37 | 36 |
| Norbin | 13 | 14 | 13 | 13 | 12 |
| SATA | 164 | 164 | 164 | 164 | 164 |
| Cosmos Lac | 84 | 680 | 11 | 11 | 4 |
| **Ukupno** | **1189** | **1823** | 402 | 263 | 259 |

Aktivnih brendova: 9; najavljenih: 0. Opseg identiteta: CARD 1135 · VARIANT 644 · FAMILY 4 · ARTICLE 38 · SHARED_IMAGE_GROUP 2.

## 2. Klasifikacija (svaki identitet tačno jednom)

| Klasifikacija | Ukupno | Carsystem | RUPES | C.A.R.FIT | BEFAR | R-M | baslac | Norbin | SATA | Cosmos Lac |
|---|---|---|---|---|---|---|---|---|---|---|
| `APPROVED_RUNTIME_IMAGE` | **1080** | 72 | 0 | 121 | 87 | 117 | 14 | 0 | 0 | 669 |
| `LOCAL_LEGITIMATE_IMAGE` | **88** | 5 | 0 | 1 | 8 | 63 | 10 | 1 | 0 | 0 |
| `IMAGE_QUALITY_REVIEW_ONLY` | **360** | 360 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `OFFICIAL_IMAGE_RIGHTS_REVIEW` | **173** | 0 | 25 | 0 | 0 | 0 | 0 | 0 | 148 | 0 |
| `OFFICIAL_IMAGE_AVAILABLE_NOT_IMPORTED` | **11** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 11 |
| `OFFICIAL_IMAGE_NOT_PUBLISHED` | **79** | 0 | 0 | 0 | 0 | 37 | 27 | 12 | 3 | 0 |
| `USER_SUPPLY_REQUIRED` | **7** | 0 | 0 | 0 | 0 | 1 | 6 | 0 | 0 | 0 |
| `PACKAGE_OR_VARIANT_IMAGE_MISSING` | **12** | 0 | 0 | 0 | 7 | 0 | 4 | 1 | 0 | 0 |
| `PLACEHOLDER_ACCEPTED` | **13** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 13 | 0 |
| `WRONG_SIBLING_IMAGE` | **0** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `BROKEN_IMAGE_REFERENCE` | **0** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `NEEDS_MANUAL_REVIEW` | **0** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

| Akcija | Broj |
|---|---|
| `IMPORT_OFFICIAL_IF_APPROVED` | 11 |
| `KEEP_PLACEHOLDER` | 13 |
| `NONE` | 1168 |
| `QUALITY_REVIEW` | 360 |
| `RIGHTS_DECISION` | 173 |
| `USER_SUPPLY` | 98 |

## 3. Sažetak

- Image identities ukupno: **1823**
- Zadovoljavajuća runtime slika (APPROVED + LOCAL + samo-kvalitet): **1528**
- Runtime slika postoji, ali je pod rights review (RUPES): **25** — NISU u missing listi
- Missing identities (`MISSING_PRODUCT_IMAGES.csv`): **270**
- USER_SUPPLY (`USER_IMAGE_SUPPLY_QUEUE.csv`): **98**
- RIGHTS_DECISION + IMPORT_OFFICIAL_IF_APPROVED (`IMAGE_RIGHTS_REVIEW.csv`): **184**
- Quality queue (`IMAGE_QUALITY_QUEUE.csv`): **530** redova nalaza / **416** identiteta — potvrđeno merenjem **15**, neizmereni kandidati **366**, rendering **64**, asset **50**, ručni pregled **31** (vidi §6)
- BROKEN_IMAGE_REFERENCE: **0** · WRONG_SIBLING_IMAGE: **0** · NEEDS_MANUAL_REVIEW: **0**

## 4. Zašto „zapisi na placeholderu” NIJE isto što i „missing image identities”

Runtime ima **402** zapisa čiji je `productImage` placeholder, ali samo **263** placeholder identiteta (i **270** redova u missing listi, jer tu ulazi i 7 Befar redova koji imaju sliku kartice, ali ne svoju).
- **baslac:** 171 zapis je na placeholderu, ali 147 su toneri sa `packshotKind: family` — limenke iste linije i iste zapremine dele JEDAN porodični packshot. Potreban je jedan packshot po (linija, pakovanje), ne 147 fotografija.
- **SATA:** 181 kartica = 181 identitet (791 red artikala deli packshot kartice); razlog nije „nema slike” nego rights gate.
- **Obrnuto (Befar):** 0 zapisa na placeholderu, ali 7 redova nema svoju sliku dok je drugi redovi iste kartice imaju → 7 missing identiteta koje brojanje zapisa ne vidi.
- Kartice sa redovima artikala (Carsystem, C.A.R.FIT, RUPES, SATA) su po jedan identitet bez obzira na broj redova.

## 5. Rights gate (nepromenjen)

- **SATA:** `APPROVED_RUNTIME_IMAGES = 0`. Zvanična slika postoji za većinu, ali to NIJE dozvola: akcija je `RIGHTS_DECISION`, ne `USER_SUPPLY`. U supply queue ide samo 5 porodica faze 1 za koje SATA sliku uopšte ne objavljuje; pribor faze 2 bez zvanične slike je `PLACEHOLDER_ACCEPTED`.
- **RUPES:** svih 25 runtime slika potiče sa carsystem.org; `RUPES_IMAGE_RIGHTS_REVIEW` ostaje vidljiv. Ništa nije preuzeto sa rupes.com.
- **Cosmos Lac:** 11 novih zapisa nema asset u zvaničnom Brand Kit-u (`NO_BRAND_KIT_ASSET`); slika postoji samo na cosmoslac.com → `IMPORT_OFFICIAL_IF_APPROVED`, ne automatski uvoz.
- Ostali brendovi: status prava je onaj koji nosi sync manifest porekla (`OFFICIAL_SOURCE_SYNCED`) ili `LOCAL_ASSET`; ništa nije izvedeno iz „sajt ima sliku”.

## 6. Carsystem kvalitet — usklađeno sa handoffom (FINAL RECONCILIATION)

Izvor istine: `historical-evidence/CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md` i njegovi stvarni fajlovi merenja (`pipeline-tone-measurements.json`, `CARSYSTEM_IMAGE_AUDIT.csv`, `css-rendering-candidates.csv`, `alpha-frame-simulation.json`). Ništa nije ponovo mereno, nijedan prag nije menjan, nijedan neizmeren par nije dobio rezultat.

**Remap na današnji runtime.** 462/463 istorijskih primary asseta ima današnji identitet sa istim slugom i istom putanjom slike; danas Carsystem 437 + RUPES 25 (1 nalaz otpada jer je kartica uklonjena iz kataloga 2026-09-22: `carsystem-p19-brusni-diskovi`; identiteti bez istorijskog reda su placeholderi `` → `USER_SUPPLY`, nisu quality redovi). Kontinuitet asseta: 457 sa istim `sourceSha256` i veličinom fajla, 5 legacy bez sync manifesta (ista veličina), 0 promenjenih → istorijski nalazi važe za današnje fajlove. Nalazi RUPES proizvoda nose `todays_brand = rupes` (24 identiteta).

**Ton — ispravka prethodne verzije.** Prethodni queue je označio 381 redova kao `TONE_SOURCE_REEXPORT_CANDIDATE`, što se čitalo kao 381 defekata. Ispravno:

| Nalaz | evidence_level | treatment_status | Broj |
|---|---|---|---|
| `MEASURED_TONE_DEFECT` (izmeren par original ↔ runtime, γ 2,07–2,27) | MEASURED | CONFIRMED_QUALITY_ISSUE | **15** |
| `TONE_NOT_DETECTED` (izmeren par, γ 1,00 — `socks`, kontrola) | MEASURED | NO_ACTION_APPROVED | **1** |
| `SOURCE_PIPELINE_REEXPORT_CANDIDATE_UNMEASURED` (izvor je `_processed_` PNG; par NIJE meren) | RULE_BASED_CANDIDATE | CANDIDATE_NOT_YET_MEASURED | **366** |

Istorijski `pipelineToneStatus` je prenet bez izmene: confirmed 15 · not_detected 1 · unknown 447. Kandidati NISU potvrđeni defekti i ne sabiraju se sa 15 izmerenih.

**Ostali nalazi (odluke handoffa su prepisane, ne donose se ponovo).**

| Nalaz | evidence_level | treatment_status | Redova |
|---|---|---|---|
| `BORDER_FRAME` — 1 px poluprovidan okvir — 4 PASS simulacije, 2 REJECT (`slp41a` R4, `skorpio-e-rx` R1/R2: nikad u automatsku obradu) | MEASURED | KNOWN_ASSET_ISSUE | 6 |
| `EDGE_ALPHA_SIGNAL_NOT_IN_HANDOFF` — signal ivice iz ove sesije koji handoff NE potvrđuje (2 full-bleed kadra, 2 za ručni pogled) — nije BORDER_FRAME | MANUAL_REVIEW_REQUIRED | CANDIDATE_NOT_YET_MEASURED / NO_ACTION_APPROVED | 4 |
| `FIT_MEASURES_BAKED_SHADOW` — fit meri zapečenu senku (kartica manja); rešenje V6A — nije na main | HISTORICAL_CONFIRMED | KNOWN_RENDERING_ISSUE | 64 |
| `CLASS_B_DETERMINISTIC_FIX` — klasa B (bez 6 okvira koji imaju svoj red) | HISTORICAL_CONFIRMED | KNOWN_ASSET_ISSUE | 34 |
| `CLASS_E_SOURCE_REPLACEMENT_PREFERRED` — klasa E — zamena izvora boljim zvaničnim packshotom | HISTORICAL_CONFIRMED | KNOWN_ASSET_ISSUE | 8 |
| `CLASS_D_AI_HIGH_RISK` — klasa D — bez AI | MANUAL_REVIEW_REQUIRED | NO_ACTION_APPROVED | 1 |
| `CLASS_F_SPECIAL_MARKETING_IMAGE` — klasa F — ne dira se | MANUAL_REVIEW_REQUIRED | NO_ACTION_APPROVED | 25 |
| `V6_EXCLUDED_SLUG` — `multi-flow`, `paint-system-cps-3-0`, `h2o-cleaner` | HISTORICAL_CONFIRMED | EXCLUDED_FROM_V6 | 3 |
| `V6B_OFFICIAL_SHADOW_UNKNOWN` — `glass-fibre-reinforced-putty` = unknown | MANUAL_REVIEW_REQUIRED | NO_ACTION_APPROVED | 1 |
| `PILOT_CASE_LHR75` — LHR75 = LANCZOS_660, pilot nije integrisan | HISTORICAL_CONFIRMED | KNOWN_ASSET_ISSUE | 1 |
| `OFFICIAL_SHADOW_PLATE_VISIBLE_IN_DARK` — `glas` — svetla ploča senke u tamnoj temi | HISTORICAL_CONFIRMED | KNOWN_ASSET_ISSUE | 1 |

Queue: **530** redova nalaza nad **416** identiteta (Carsystem 392 · RUPES 24); jedan red = jedan nalaz, pa isti identitet može imati više redova. Po `treatment_status`: CANDIDATE_NOT_YET_MEASURED 368 · CONFIRMED_QUALITY_ISSUE 15 · EXCLUDED_FROM_V6 3 · KNOWN_ASSET_ISSUE 50 · KNOWN_RENDERING_ISSUE 64 · NO_ACTION_APPROVED 30.

Globalni poznati rendering nalazi bez liste po slugu u handoffu (nisu pretvoreni u redove): svetle CSS senke kartice u tamnoj temi; svetli oreol zvanične senke na tamnoj površini (36 od 80 asseta sa mekim proširenjem) — estetska odluka V6C, nije doneta. Odbačeni signali (luminanca, `SOFT_IMAGE`, `skinShare`) nisu nalazi.

**Stanje V6.** V6A, V6B i loading-shadow gate: istorijski `IMPLEMENTED_AND_VERIFIED` u starom worktree-u (HEAD `7d6b8df`, nekomitovano) — **NOT PRESENT** na današnjem `main` (`lib/productFitModel.mjs`: ne postoji, `lib/product-fit-model.ts`: ne postoji, `components/product/productImageLoadState.mjs`: ne postoji, `components/product/productFitModelV6.test.mjs`: ne postoji, `public/products/carsystem/enhanced`: ne postoji). V6C: **REJECTED / NOT APPROVED**. Pilot enhanced asseti: **0 odobreno / 0 integrisano**. Runtime `productImage` reference: **nepromenjene**. Ništa nije portovano.

**Zabrane koje ostaju na snazi.** Bez globalnog brightness/gamma/contrast; bez AI ulepšavanja; bez mass apply; bez enhanced runtime referenci bez odobrenja; original se nikad ne prepisuje.

**Napomena o inventaru i rights review.** Klasa `IMAGE_QUALITY_REVIEW_ONLY` (360) u inventaru znači „ima runtime sliku i nalazi se u quality queue”, NE „360 potvrđenih defekata”. Opisni segment `quality: …` u koloni `notes` (inventar 384 reda, `IMAGE_RIGHTS_REVIEW.csv` 24 RUPES reda) usklađuje `sync_quality_notes.py` sa nalazima ovog queue-a; nijedna druga kolona se pri tome ne menja.

Ostali brendovi nemaju urađen quality audit → `NEEDS_FUTURE_QUALITY_AUDIT` (nije izmišljan nalaz).

## 7. Cross-check

| Provera | Rezultat |
|---|---|
| Kartice accountovane | 1189/1189 |
| Zapisi accountovani | 1934/1934 |
| Dupli image_id | 0 |
| Dupli suggested_filename | 0 |
| Dupli target_path | 0 |
| Neklasifikovano | 0 |
| image_id iz `?varijanta=` ključa | 0 (gradi se iz sluga zapisa) |
| Cosmos parovi (kartica, ključ varijante) koji se sudaraju, a imaju jedinstven image_id | 9 |
