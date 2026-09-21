# SATA catalog sync — faza 1

> Opseg: **SATA EMEA REFINISH FAMILY SCOPE**. Ovo NIJE ceo SATA katalog.

| | |
|---|---|
| Izvor | `https://www.sata.com/en/` (Shopware prodavnica proizvođača) — jedini izvor identiteta |
| Komanda | `npm run sata:sync` (mreža) · `npm run sata:sync:check` (bez mreže, iz commitovanog `raw/`) |
| Porodice u opsegu | 66 (65 uvezenih + 1 dopunjena: `satajet-x-5500`) |
| Brojevi artikala u opsegu | 655 (redovi tabele konfiguracija) |
| Pokrivenost | A = B = 66 · C = D = 655 · nedostaje 0 · duplikata 0 |
| Slike u runtime-u | 0 — rights gate (vidi niže) |

## Model

SATA sama vodi brojeve artikala kao **konfiguracije jedne porodice** (Shopware parent → varijante).
Zato je **jedna zvanična porodica = jedna kartica**, a broj artikla je **red** postojeće tabele
varijanti (isti row model kao Befar/C.A.R.FIT). PDP nije redizajniran: i `jet X` sa 68 redova je
tabela. Višeosni birač je zaseban, kasniji UX projekat.

Pripadnost artikla porodici se **nikad ne izvodi iz naziva**. Dokaz je Shopware `parentId` iz
`data-variant-switch-options` — isti na stranici porodice (`/…/CF<id>`) i na stranici svakog njenog
artikla. Ose i izabrane vrednosti čitaju se iz markupa konfiguratora (`<h4>` + `<input checked>`).

Prva kolona tabele je „Konfiguracija" — jedinstvena oznaka reda sklopljena iz zvaničnih vrednosti
osa (`RP · 1,3 · I · DIGITAL pro`). Kada ose ne razlikuju redove, razlikuje ih zvanični naziv
artikla, a tek na kraju broj artikla.

## Šta je van opsega (i NIJE „nedostaje")

Sve ispod je **aktuelno kod proizvođača**; nije discontinued, missing ni historical.

| Grupa | Status | Broj |
|---|---|---|
| Industrijske / robotske / LAB porodice | `CURRENT_OUT_OF_SCOPE` | 12 porodica |
| Reklamni artikli | `CURRENT_OUT_OF_SCOPE` | 17 porodica |
| Porodice kompleta mlaznica (sa CF stranicom) | `CURRENT_OUT_OF_SCOPE` | 2 porodice |
| Porodice bez javne CF stranice (skoro sve „Nozzle set …") | sačuvane u `source-products` | 48 porodica / 500 artikala |
| Članovi porodica iz opsega koji postoje samo van Evrope | `CURRENT_REGION_SPECIFIC` | 19 artikala |
| Samostalni artikli (bez parenta) | podela ispod | 1215 |

### Podela 1215 samostalnih artikala (zaključana u `scope-lock.json`)

| Grupa | Broj |
|---|---|
| `SPARE_PART` | 872 |
| `ACCESSORY_TIED_TO_APPROVED_FAMILY` (faza 2) | 84 |
| `CONSUMABLE_TIED_TO_APPROVED_FAMILY` | 5 |
| `INDUSTRIAL_ROBOTIC_LAB` | 83 |
| `MERCHANDISING` | 7 |
| `REGION_ONLY` | 14 |
| `DUPLICATE_ALIAS` | 0 |
| `UNIDENTIFIED_NO_OFFICIAL_NAME` | 1 |
| `STANDALONE_CUSTOMER_FACING_PHASE_2` | 149 |

Uloga dolazi iz **zvanične kategorije artikla** (`item_category…` u `window.ga4Product` na njegovoj
stranici) i iz onoga što zvanični naziv doslovno kaže („for SATA air vision 5000"). Pravila se
čitaju redom, pa je svaki artikal u tačno jednoj grupi.

**Faza 2** (`CURRENT_OUT_OF_SCOPE_PHASE_2`, 149 + 84): creva, brze spojke, držači pištolja, četke,
sonde, pribor vezan za porodice… Pet samostalnih artikala zaštitne odeće (`SATA suit space`,
`SATA suit grey`) **nema zvaničnu porodicu** i ostaje u fazi 2 — ne grupiše se u izmišljenu
porodicu. Eventualno lokalno grupisanje u fazi 2 ne sme se predstaviti kao zvanična SATA porodica.

Podaci o rezervnim delovima i kompletima mlaznica se **ne bacaju**: ostaju u
`data/sata-sync/source-products.generated.json` za budući lookup kompatibilnosti.

### Zaključavanje opsega

`plan.mjs` poredi izmereni opseg sa `data/sata-sync/scope-lock.json` i **pada na svaku razliku**:

- `SCOPE_DRIFT_WITHOUT_SOURCE_CHANGE` — brojevi su se promenili, a otisak izvora nije → greška u pravilima;
- `SCOPE_CHANGED_WITH_SOURCE` — izvor se promenio → opseg traži novo odobrenje (svesna izmena lock fajla).

## Slike — rights gate

Pravo korišćenja SATA fotografija **nije potvrđeno**. Zato:

- nijedna SATA slika se ne preuzima, ne hostuje i ne hotlinkuje;
- dataset sajta ne sadrži nijednu adresu slike (validacija i test to obaraju);
- svih 66 kartica koristi placeholder sajta („Vizuel u pripremi").

| Metrika | Vrednost |
|---|---|
| `OFFICIAL_SOURCE_IMAGES_AVAILABLE` (artikli u opsegu sa sopstvenim packshotom) | vidi `reports/image-availability.generated.json` |
| `OFFICIAL_IMAGE_AVAILABLE_NOT_APPROVED_FOR_RUNTIME` | 61 porodica |
| `OFFICIAL_IMAGE_NOT_PUBLISHED` | 5 porodica (SATAjet 3000 B, SATAjet 1500 B, SATA air star F, Release agent spray system, LCS - Hard Cups) |
| `APPROVED_RUNTIME_IMAGES` | 0 |

Slika pripada artiklu samo kada fajl nosi NJEGOV broj (`<broj>_MAIN`); `og:image` srodnog artikla se
ne pripisuje. Kada pravo bude potvrđeno, uvoz slika je zaseban deterministički zahvat.

## Dokumenti

Na nivou porodice: uputstva (44), izjave o usaglašenosti (37), brošura na prihvatljivom jeziku (1).
Zvanična adresa se čuva **doslovno, sa `?ts=` tokenom**. Sedam brošura koje EN stranica nudi samo
na IT/DE/FR se ne prikazuje i beleži se kao `SOURCE_DOCUMENT_LANGUAGE_MISMATCH`. SATA nema TDS/SDS
model — takvi redovi se ne izmišljaju. Spare-parts dokumentacija ostaje interna.

## Sadržaj na srpskom

- `localization/families.sr.json` — tip proizvoda, kratak opis i namena po porodici; prepričava
  isključivo zvanični naziv, slogan, opis i nazive artikala. `sourceHash` veže tekst za zvanični ulaz.
- `localization/terms.sr.json` — rečnik etiketa i vrednosti. Brojevi i oznake (RP, HVLP,
  `DIGITAL pro`, `I (Control)`) prolaze doslovno; nepoznata reč se ne pogađa (činjenica se izostavlja,
  vrednost ose ostaje u zvaničnom obliku).
- `check-localization.mjs` obara broj koji ne postoji u zvaničnom ulazu i rizične tvrdnje.
- Tri porodice imaju nemački naziv i na EN sajtu; prikaz je funkcionalni prevod (`Mikrometar vazduha`,
  `Manometar`, `Kofer za pištolj za lakiranje`), a zvanični naziv ostaje u identitetu i pretrazi.

## Pravila koja se ne krše

- Cene se ne čitaju, ne čuvaju i ne uvoze (sajt ih objavljuje).
- `robots.txt`: `Disallow: /*?` → `switch?options=` i Spare Parts Finder se ne otvaraju; `/media/*?ts=` je dozvoljeno.
- `satajet-x-5500` zadržava slug, adresu, ime i opise; `SATA-X5500` je interna oznaka, ne broj artikla.
- Tri CF adrese istog Shopware parenta su jedna porodica; ostale adrese su `sourceAliases`.

## `satajet-x-5500` — javni identitet

`sku` je interni ključ: `canonicalVariantKey` iz njega pravi `?varijanta=` adrese, pa se NE menja
(`SATA-X5500` ostaje, i ostaje pojam pretrage). Javno se prikazuje zvanični identifikator porodice:
`publicCode = manufacturerCode = CF1931072`. `publicCode` je generičko, opciono polje
(`lib/carsystem-data.ts`); čitaju ga kartica (`lib/catalog-listing.ts`) i meta opis
(`lib/seo/metadata-builders.ts`). Bez njega prikaz je `sku`, kao i do sada — nijedan drugi brend se ne menja.

## Neprevedene zvanične vrednosti (`SOURCE_TERM_UNTRANSLATED`)

| Vrednost | Odluka | Razlog |
|---|---|---|
| `- 55 SK`, `- 79 SK` | ostaje zvanično | kod konfiguracije mlaznice (SATAjet 1000 K RP 2.5/3.0/4.0) |
| `DA Druck` | ostaje zvanično | „DA” je kod tipa mlaznice; značenje „Druck” uz njega nije nedvosmisleno |
| `Druckbecher BVD 0,7 l` | `čaša pod pritiskom BVD 0,7 l` | zvanični EN naziv ISTOG artikla (214320) kaže „pressurised cup … BVD add-on kit" |

Sirova vrednost uvek ostaje u `source-products` i kao pojam pretrage (`sourceAxisTerms`). Nova
neprevedena vrednost obara plan (`undecidedSourceTerm`) dok ne uđe u rečnik ili u
`sourceTermsUntranslated` sa razlogom.

## Price gate

SATA objavljuje cene, a `window.ga4Product` (odakle se čita kategorija) nosi i njih. Crawler čuva
samo imenovana polja; `check-no-price-data.mjs` (deo `sata:sync:validate`) skenira ceo opseg synca
na novčane ključeve i iznose — `price data stored = 0`. Reč „price" u zvaničnom nazivu artikla
(„… net price per meter") je tekst naziva bez iznosa i broji se zasebno.

## Zamke za sledeće pokretanje

1. Ekstenzije su VELIKIM slovima i duple (`.PDF.PDF`, `.WEBP.WEBP`) uz `?ts=` — regex mora biti case-insensitive.
2. `og:title` daje vrednosti osa bez naziva i nepouzdanim redom — osa se ne pogađa po poziciji.
3. `parentSku=CF…` postoji samo na delu artikala; jedini potpun dokaz pripadnosti je `parentId`.
4. `/en` je nadskup svih tržišta; region se dokazuje sitemap-ovima `de-de` / `en-gb` / `it-it`.
5. Naziv porodice je najkraća etiketa pločice kategorije, ne `<h1>` (to je naziv podrazumevanog artikla).
6. `window.ga4Product` nosi i cenu — čitaju se isključivo `item_category…` ključevi.
7. Novo polje u datasetu mora biti opciono u adapteru: plan učitava runtime iz PRETHODNOG dataseta.

## Faza 2 — samostalan i vezan pribor (`SATA PHASE 2 ACCESSORY SCOPE`)

Odobren model: `data/sata-sync/phase2-scope.json` (2026-09-21). Opseg je zaključana particija faze 1:
149 samostalnih + 84 vezana pribora + 5 vezanog potrošnog = **238 zvaničnih brojeva artikala**. Faza 1
(66 porodica / 655 artikala) se ne dira — faza 2 živi pod zasebnim ključem dataseta (`phase2`).

| Korak | Skripta |
|---|---|
| plan | `plan-phase2.mjs` (deo `sata:sync:plan`) → `phase2-plan.generated.json` + `reports/phase2-article-mapping.generated.csv` |
| apply | `apply.mjs` → `dataset.phase2` + `identity-registry.json › phase2` (slugovi, append-only) |
| validate + reconcile | `reconcile-phase2.mjs` (deo `sata:sync:reconcile`): A2 = B2 kartice, C2 = D2 artikli |
| search QA | `npm run sata:sync:qa-search-phase2` |

**Izvor ne daje grupisanje.** Svih 238 artikala ima `parentId: null`, nula opcija konfiguratora, nula dokumenata
i (osim 10) kategoriju „Accessories”. Jedini dokaz je zvanični naziv, pa je grupisanje gramatičko
(`lib/phase2-grouping.mjs`), bez sličnosti i pragova:

1. **nivo 1** — posle uklanjanja prepoznatih atributa (dužina, navoj, prečnik, pakovanje, veličina, ugao, tip
   mlaznice, šema prskanja, boja, tolerancija, broj adaptera, završeci creva, inox) ostatak naziva i klauzula
   „for …” moraju biti identični;
2. **nivo 2** — isti ostatak, razlikuje se samo „for …”: kompatibilnost je osa reda. Pojedinačni artikal se
   pridružuje grupi; dve višečlane grupe se nikad ne spajaju (nastavci za 1000 B i 1000 K su dve kartice).

Svaka višečlana kartica je **`LOCAL_CATALOG_GROUPING`** — kataloška grupa sajta, NIKAD zvanična SATA porodica.
Zvanični naziv svakog artikla ostaje sačuvan u redu. Više osa ide kroz postojeću tabelu redova (složena oznaka
reda); novi birač nije uveden.

**Svaki broj je `VISIBLE` ili `INTENTIONALLY_EXCLUDED:<razlog>`** — nijedan ne nestaje. Isključenja su odluke, ne
izvor: `MERCHANDISING_DISPLAY` (1750), `LAB_OUT_OF_APPROVED_SCOPE` (177238),
`SPARE_PARTS_KIT_OUT_OF_APPROVED_SCOPE` (1183425) i `ACCESSORY_FOR_PRODUCT_OUTSIDE_RUNTIME_CATALOGUE`
(`CURRENT_OUTSIDE_APPROVED_RUNTIME_CONTEXT`: pribor čija klauzula „for …” imenuje proizvod koga nema u katalogu —
spisak ciljeva je u scope fajlu). Isključeni ostaju aktuelni zapisi izvora; nisu discontinued.

**Ostale odluke.** Vezani pribor dobija svoju karticu/red i vezu `compatibleProducts` ka porodici faze 1 (postojeći
odeljak „Koristi se zajedno sa”; PDP prikazuje najviše 4 veze). `63974` (vario top spray F) je zasebna kartica,
ne 656. red faze 1. Dva broja artikla sa istim zvaničnim nazivom = jedna kartica, dva reda, sa oznakom porekla
(`SOURCE_PUBLISHES_TWO_ARTICLE_NUMBERS_UNDER_ONE_NAME`) — ne bira se „noviji”. **Scope gate ima prioritet:** pravilo
važi samo za proizvod koji je prošao isključenja. Par „SATA air warmer carbon” (214759, 1000132) je pribor za
„SATA air carbon regulator”, koga nema u katalogu → oba broja su isključena, bez kartice i sluga; dokaz o dva broja
pod istim nazivom ostaje u planu i datasetu (`sameOfficialNameAs`). `SGE` ostaje doslovan termin.

**Srpski nazivi** (`localization/phase2.sr.json`): samo standardni tehnički prevodi po ostatku naziva; bez unosa
kartica dobija zvanični naziv (`OFFICIAL_NAME_FALLBACK`). Atributi reda se prevode pravilima
(`lib/phase2-terms.mjs`); plan pada ako u oznaci ostane engleska reč ili broj koga nema u zvaničnom nazivu.
„price per meter” postaje samo „prodaje se na metar” — nikakav podatak o ceni se ne uvozi.

**Taksonomija** koristi postojeće kategorije: podrazumevano `pribor` (pravilo faze 1 za „Accessories”), odela i
pribor za zaštitu disanja → `zastita`, čišćenje pištolja → `radionica`; `63974` nasleđuje kategoriju svoje porodice.

**Slike i dokumenti.** `APPROVED_RUNTIME_IMAGES = 0`: sve kartice su na placeholderu, a dostupnost zvanične slike
(206/238) je samo činjenica u planu. SATA za ove artikle ne objavljuje dokumente — nijedan se ne prikazuje.

### Zamke

1. Plan faze 1 čita runtime: kartice faze 2 moraju biti u `ownSlugs` (`registry.phase2`), inače postaju kandidati za matching.
2. Redosled regexa atributa je deo pravila (`sprayPattern` pre `nozzleType`; `\bG` da navoj ne pojede „g” iz „coupling”; atributi pre klauzule „for”).
3. Price gate hvata znak dolara ispred cifre i u izvoru skripti — zamene u regexu pisati kao funkcije, ne kao povratne reference.
4. Izvor piše i „per metre” i „per meter”; „for thinner / wall mounting / optimum spray air” su namena, ne proizvod.
5. Adapter mora tolerisati dataset bez ključa `phase2` (bootstrap: plan učitava prethodni dataset).
