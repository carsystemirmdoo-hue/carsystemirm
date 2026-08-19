# Catalog + PDP Visual Handoff

**Datum:** 2026-08-17 · **Grana:** `recovery/pre-claude-2026-08-07`
**Obim:** Catalog kartica · `ProductVisualSurface` · PDP scena. Ništa izvan toga
nije menjano — homepage, navigacija, Cosmos LAC, Befar, `/katalozi`, portal i
brand stranice su netaknuti.

---

## A. Audit

### A.1 Šta zapravo postoji

| Površina | Fajl | Uloga |
| --- | --- | --- |
| PDP ruta | `app/proizvodi/[slug]/page.tsx` | `generateStaticParams` nad svih 832 proizvoda |
| PDP šablon | `components/product/ProductDetailPage.tsx` | server komponenta, dvokolonski `narrativeGrid` |
| PDP scena | `components/product/ProductStickyStage.tsx` | client, galerija + vizuelni panel |
| PDP stilovi | `components/product/ProductDetailExperience.module.css` | 2264 linije |
| Katalog | `app/katalog/page.tsx` → `CatalogPage` → `CatalogExplorer` | client explorer, infinite scroll |
| Kartica | `components/catalog/CatalogProductCard.tsx` | deli `ProductVisualSurface` sa PDP related redom |
| Zajednička površina | `components/product/ProductVisualSurface.tsx` (+ `.module.css`, 1107 linija) | katalog kartice, related, brand stranice |
| Skala | `lib/product-scale.ts` | `S ≤500ml · M ≤1200ml · L ≤3800ml · XL >3800ml`, fallback `M` |
| Taksonomija | `lib/productTaxonomy.mjs` + `lib/product-taxonomy.ts` | 12 kategorija, 832/832 klasifikovano |
| Boja (Cosmos) | `data/cosmos-lac-products.generated.json` | `backgroundColor`, `colorSource`, `foregroundTone` za 742 zapisa |
| Vizuelni preset | `components/product/productMotion.ts` | `treatment`, `productType`, `visualMode`, accent |

Entiteti: **41 family + 117 standalone + 715 variant = 873 zapisa u indeksu**,
**832 proizvoda** (873 − 41 family kartica). Build generiše **832 PDP ruta** i
**41 group rutu**.

### A.2 Glavni uzrok — izmeren, ne pretpostavljen

`scripts/extract-product-image-metrics.py` meri alfa bounding box svakog
proizvodnog rendera u `public/`. Rezultat za svih **826 rasterskih fajlova**:

| Metrika | Vrednost |
| --- | --- |
| Platno 800×800 | 745 od 826 fajlova |
| Udeo širine koji proizvod stvarno zauzima | min **0.198**, medijana **0.249**, max **1.000** |
| Udeo **površine** platna (832 kataloška proizvoda) | min **0.15**, medijana **0.19**, max **0.94** |
| Izvor content box-a | 810 alfa · 14 ivična pozadina (JPG) · 2 puno platno |

**Medijalni proizvod zauzima 19% površine svog fajla.** Ostalo je transparentna
margina koju je isporučilac zapekao u export.

Posledica: `object-fit: contain` uklapa **PLATNO**, ne proizvod. Skala
`S 66 / M 76 / L 84 / XL 92` iz `lib/product-scale.ts` primenjivala se na
kvadratni fajl, pa je „66% stage-a" u praksi značilo bilo šta između 13% i 66%
stvarnog proizvoda — odlučivala je količina praznog prostora, ne zapremina
pakovanja. To je bio ceo problem; nije bio ni loš izbor procenta ni pogrešan
container.

Merenje referentne stranice (1440 px, pre izmene):

- panel `537 × 634` px
- objekat `min(66%, 260px) = 260` px, minus `40` px rezerve za badge
- kvadratno platno uklopljeno u to → `260 × 260`, uz `scale(0.92)`
- vidljiva boca: **~222 px visine u panelu od 634 px = 35%**

### A.3 Ostali uzroci

| Simptom sa screenshota | Stvarni uzrok |
| --- | --- |
| „Levi panel prati visinu desne kolone" | **Nije bio stretch.** `.narrativeGrid` je već imao `align-items: start`, a `.stickyRail` je `position: sticky`. Panel je imao samo `min-height: clamp(430px, 44vw, 650px)` bez ikakvog `aspect-ratio` — dakle fiksnu, veliku, uglavnom praznu visinu koja *izgleda* kao rastezanje. |
| Previše praznog prostora | Kombinacija A.2 (proizvod na 35%) i panela od 634 px bez proporcije. |
| Proizvod nije optički centriran | Centriran je bio **fajl**, ne silueta. Content box referentne slike je pomeren: `offset-x 0.399`, širina `0.254` → centar sadržaja na 0.526, a ne 0.5. |
| Crna boca nestaje u crnom grafitu | `ProductHeroSprayBackdrop.module.css` je bojio potez u `--product-visual-background-color`, tj. **u boju samog proizvoda**. Za 427 od 832 proizvoda izmerenih kao tamni, u tamnoj temi to je crno na crnom. Ogledalo istog baga: 127 svetlih proizvoda u svetloj temi. |
| Grafit i proizvod kao jedan sloj | Panel je bio `background: transparent`, bez stage ploče, bez halo sloja i bez imenovane z-hijerarhije. |
| Vrh panela i desni čipovi nisu poravnati | `.hero` je imao `min-height: min(42rem, 100svh - 9rem)` + `align-items: center`, a `.heroCopy` `padding-block: 1rem`. Delta je bila 16 px. |
| Naslov prevelik | `clamp(3rem, 5.15vw, 5.7rem)` uz `max-width: 11ch` — 90 px tipografija pored proizvoda od 222 px. |
| Zoom kontrola preko proizvoda | **Zoom kontrola nije postojala.** Krug u uglu screenshota je Next.js dev overlay. Kontrola je sada napravljena, sa rezervisanim uglom. |

### A.4 Rizici zatečeni u repou

- Tri `next dev` procesa dele `.next-dev` (portovi 3100, 3000 i jedan dodatni).
  `/katalog` se u takvom stanju **nikad nije kompajlirao** — 7 minuta na 0% CPU.
  Skriptovi u ovom pasu se zato **kače na postojeći server i nikad ga ne pokreću**.
- `docs/audit-screenshots/` je u `.gitignore` (projektna konvencija za lokalne
  review artefakte). Snimci postoje lokalno; komanda za regeneraciju je u sekciji F.

---

## B. Reprezentativni proizvodi (18 stvarnih zapisa)

Svi su stvarni kataloški zapisi sa stvarnim renderima. Nijedan nije zamenjen,
generisan niti dopunjen.

| Proizvod | Slug | Brend | Grupa | Image path | Platno | Content box | Fill % | Tone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cosmos Lac Flame Booster B-901 Thick Black | `cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black` | Cosmos Lac | sprejevi | `/products/cosmos-lac/flame-booster/…-thick-black.webp` | 800×800 | 203×744 | 25×93 | very-dark |
| Cosmos Lac Molotow Burner Copper 600 ml | `cosmos-lac-molotow-burner-600-ml-mb-600ml-copper` | Cosmos Lac | sprejevi | `/products/cosmos-lac/molotow-burner/…-copper.webp` | 800×800 | 203×789 | 25×99 | very-dark |
| Cosmos Lac Home White Smalto 400 | `cosmos-lac-home-400-400-ml-white-smalto-400-white` | Cosmos Lac | sprejevi | `/products/cosmos-lac/home/…-white.webp` | 800×800 | 199×624 | 25×78 | very-light |
| Cosmos Lac Easy Max CL 800 RAL 9010 White | `cosmos-lac-easy-max-cl-800-ral-9010-400-ml-easy-max-ral-9010-800-white` | Cosmos Lac | sprejevi | `/products/cosmos-lac/easy-max/…-800-white.webp` | 800×800 | 199×624 | 25×78 | very-dark |
| Cosmos Lac Flame Blue FB-106 Signal Yellow | `cosmos-lac-flame-blue-fb-106-400-ml-flame-blue-fb-106-signal-yellow` | Cosmos Lac | sprejevi | `/products/cosmos-lac/flame-blue/…-signal-yellow.webp` | 800×800 | 199×604 | 25×76 | mid |
| Cosmos Lac Fluorescent & Marking 591 Orange | `cosmos-lac-fluorescent-marking-591-road-construction-marking-591-orange` | Cosmos Lac | sprejevi | `/products/cosmos-lac/fluorescent-marking/…-591-orange.webp` | 800×800 | 203×744 | 25×93 | mid |
| B 2P93 UV Bodyfill-R | `b-2p93-uv-bodyfill-r` | R-M | kitovi | `/images/brands/rm/products/pioneer/rm-b-2p93-uv-bodyfill-r.webp` | 800×667 | 158×502 | **20**×75 | mid |
| R-M Body Filler White B 2E11 | `rm-body-filler-white-b-2e11` | R-M | kitovi | `/products/rm/rm-body-filler-white-b-2e11.jpg` | 800×600 | 550×293 | 69×49 | mid |
| Carsystem Git Elastic Weiss | `carsystem-git-elastic-weiss` | Carsystem | kitovi | `/products/carsystem/carsystem-git-elastic-weiss.png` | 660×406 | 536×304 | 81×75 | dark |
| Carsystem P19 brusni diskovi | `carsystem-p19-brusni-diskovi` | Carsystem | abrazivi | `/products/carsystem/carsystem-p19-brusni-diskovi.png` | 660×650 | 599×599 | 91×92 | mid |
| Carsystem F19 brusni diskovi | `carsystem-f19-brusni-diskovi` | Carsystem | abrazivi | `/products/carsystem/carsystem-f19-brusni-diskovi.png` | 660×649 | 599×598 | 91×92 | very-dark |
| Carsystem Finish serija | `carsystem-finish-serija` | Carsystem | poliranje | `/products/carsystem/carsystem-finish-serija.png` | 660×662 | 642×643 | **97**×97 | very-dark |
| A 2520 ONYX EASY BLENDER | `2520-onyx-easy-blender` | R-M | boje | `/images/brands/rm/products/onyx/rm-2520-onyx-easy-blender.webp` | 1170×1170 | 436×1067 | 37×91 | very-light |
| R-M Pasta 190 5 L | `rm-pasta-190-5l` | R-M | poliranje | `/products/rm/rm-pasta-190-5l.jpg` | 600×600 | 391×548 | 65×91 | light |
| Car Fit maskirna folija 4 × 5 m | `carfit-maskirna-folija-4x5m` | Car Fit | maskiranje | `/products/carfit/carfit-maskirna-folija-4x5m.jpg` | 1000×1000 | 923×878 | 92×88 | dark |
| Baslac 60-20 razređivač | `baslac-60-20-razredjivac` | baslac | boje | `/products/baslac/baslac-60-20-razredjivac.jpg` | 724×724 | 541×312 | 75×43 | mid |
| Befar sunđer crni 25×150 | `befar-sundjer-crni-25x150` | Befar | poliranje | `/products/befar/befar-sundjer-crni-25x150.svg` | — (SVG) | — | — | — |
| Norbin N15-020 5 L | `norbin-n15-020-5l` | Norbin | boje | `/images/products/placeholder-product.svg` | — (nema slike) | — | — | — |

Isti uzorak, izvedene odluke:

| Proizvod | Skala | Content aspect | Stage format | Palette source | Contrast mode |
| --- | --- | --- | --- | --- | --- |
| Flame Booster B-901 Thick Black | S | 0.2728 | portrait | variant | dark-product |
| Molotow Burner Copper 600 ml | M | 0.2573 | portrait | attribute | dark-product |
| Home White Smalto 400 | S | 0.3189 | portrait | variant | light-product |
| Easy Max CL 800 RAL 9010 White | S | 0.3189 | portrait | variant | **dark-product** |
| Flame Blue FB-106 Signal Yellow | S | 0.3295 | portrait | variant | balanced |
| Fluorescent & Marking 591 Orange | M (fallback) | 0.2728 | portrait | attribute | balanced |
| B 2P93 UV Bodyfill-R | M (fallback) | 0.3147 | portrait | image-extracted | balanced |
| R-M Body Filler White B 2E11 | M (fallback) | 1.8771 | **landscape** | image-extracted | balanced |
| Carsystem Git Elastic Weiss | M (fallback) | 1.7632 | landscape | group-neutral | dark-product |
| Carsystem P19 brusni diskovi | M (fallback) | 1.0000 | square | image-extracted | balanced |
| Carsystem F19 brusni diskovi | M (fallback) | 1.0017 | square | image-extracted | dark-product |
| Carsystem Finish serija | M (fallback) | 0.9984 | square | image-extracted | dark-product |
| A 2520 ONYX EASY BLENDER | M (fallback) | 0.4086 | portrait | image-extracted | light-product |
| R-M Pasta 190 5 L | M (fallback) | 0.7135 | portrait | image-extracted | light-product |
| Car Fit maskirna folija | M (fallback) | 1.0513 | square | image-extracted | dark-product |
| Baslac 60-20 razređivač | M (fallback) | 1.7340 | landscape | group-neutral | balanced |
| Befar sunđer crni 25×150 | M (fallback) | — | square | group-neutral | balanced |
| Norbin N15-020 5 L | M (fallback) | — | square | group-neutral | balanced |

**Easy Max CL 800 RAL 9010 White** je najkorisniji red u tabeli: nijansa je
potvrđeno bela (RAL 9010), a `contrastMode` je `dark-product`. To nije greška —
`colorSource` opisuje **boju koju proizvod nanosi**, a `tone` **kako ambalaža
izgleda**. Odluku o kontrastu dekoracije sme da donese samo drugo.

### Populacija u celini (832 proizvoda)

- **contrast:** 427 dark-product · 127 light-product · 264 balanced · 14 bez metrika
- **stage format:** 773 portrait · 37 square · 8 landscape
- **skala:** `M` je najčešća jer 832 zapisa nemaju svi parsabilnu zapreminu —
  `lib/product-scale.ts` namerno ne pogađa iz naziva.

---

## C. Vizuelni pravci

Sve scene su statične i determinističke (seed iz sluga, FNV-1a). Nijedna ne
ispisuje broj, jedinicu, granulaciju ni dimenziju: dekorativna linija koja
liči na specifikaciju je izmišljena tvrdnja o proizvodu.

| # | Pravac | Za koje stvarne grupe | Proizvod u probi | Statično | Animacija | Rizik | Preporuka |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | **Pigmentno polje** | `boje` (104) | Flame Blue FB-106 | ✅ | zone se pojavljuju, 600 ms | generično ako se pusti na sve | **selective** — samo `paletteSource = variant` |
| B | **Kontrolisani grafit** | `sprejevi` (654) | Flame Booster B-901 | ✅ **već u produkciji** | postojeći 6-pass reveal | 654 proizvoda deli isti potez | **production** (uz kontrastni ton) |
| C | **Icon rain → pile** | stranice grupa, hero | P19 · Finish serija · Car Fit folija | ✅ (pile = idle stanje) | **implementirano, 1040 ms** — vidi poglavlje *ICON RAIN → PILE IMPLEMENTATION* | lako sklizne u dekoraciju | **A/C needs refinement · B experiment only** |
| D | **Material layers** | `abrazivi` (4), `maskiranje` (2) | Carsystem P19 | ✅ | slojevi se slažu | mala populacija | **selective** |
| E | **Blueprint** | `oprema` (1), `radionica` (14), `ciscenje` (7) | Car Fit folija | ✅ | linije se crtaju | sci-fi ako se preteruje | **selective** |
| F | **Material trace** | `kitovi` (8), `lepkovi` (1), `zastita` (25) | B 2P93 UV Bodyfill-R | ✅ | trag se izvlači | može ličiti na fleku | **selective** |
| G | **Exploded halo** | sistemi, setovi | Flame Blue FB-106 | ✅ | elementi se razmiču | **sugeriše sadržaj pakovanja** | **experiment** — visok rizik |
| H | **Repeated silhouettes** | porodice istog oblika (41) | Flame Booster B-901 | ✅ | siluete se slažu | „lažni proizvodi" ako nisu apstraktne | **experiment** |
| I | **Cross-section** *(novo)* | `zastita` (25), sistemske stranice | White Smalto 400 | ✅ | trake se grade odozdo | mora ostati apstraktno, bez debljina | **selective** |
| J | **Swatch ladder** *(novo)* | color porodice (41 family) | Flame Blue FB-106 | ✅ | stepenici se pale redom | samo uz potvrđenu nijansu | **selective** |
| K | **Grain arc** *(novo)* | `poliranje` (12), `abrazivi` (4) | Carsystem P19 | ✅ | gustina raste ka spolja | **ne sme sugerisati granulaciju** | **experiment** |

Implementacija: `components/interaction-demo/LabScene.tsx` (statične scene) i
`components/interaction-demo/IconRainPileScene.tsx` (animirana C).

Danas je u produkciji **samo B** (postojeći spray reveal), sada sa kontrastno
korigovanim tonom. Sve ostalo živi u labu do odobrenja.

**Dorada nakon prve revizije (2026-08-17):** četiri najjača pravca su prepravljena
da govore o procesu umesto o apstraktnim oblicima, i prikazana u tri stvarna
formata (katalog kartica 1.1∶1, PDP panel 5∶6, group hero 16∶9) u labu, sekcija 6:

| Pravac | Šta je promenjeno | Ocena |
| --- | --- | --- |
| Kontrolisani grafit | Meki rub kroz gradijentnu masku + overspray tačkice duž pojasa — čita kao prolaz spreja, ne kao potez markerom | **production-ready** |
| Material layers | Stepenasta desna ivica = presek prebrušene reparature (podloga → kit → prajmer → boja → lak) + abrazivna tekstura preko izloženih stepenika | **needs refinement** |
| Material trace | Trag povučen gletericom: gradijentno tanjenje, rebra od ivice sečiva, mesto gde se alat podigao | **needs refinement** |
| Blueprint | Konstrukciona geometrija (mreža, ose, presečni krug, radijalne konstrukcione linije, registracione oznake). **Uklonjen je niz crtica** — čitao je kao merna skala, a ovi proizvodi je ne objavljuju | **needs refinement** |
| Exploded halo · Repeated silhouettes · Cross-section · Swatch ladder · Grain arc | Nepromenjeni | **experiment only** |

---

## D. Implementirane izmene

### D.1 Novi fajlovi

| Fajl | Šta radi |
| --- | --- |
| `scripts/extract-product-image-metrics.py` | Meri alfa bbox + paletu svih 826 rendera. Emituje manifest i CSS. `--check` režim za CI. |
| `data/product-image-metrics.generated.json` | 826 zapisa: platno, content box, fill, offset, aspect, luminance, tone, paleta. **Generisano — ne uređivati ručno.** |
| `components/product/ProductImageFit.generated.module.css` | Po jedno pravilo po slici, ključ = `data-product-fit` (public path). **156 KB raw / 12,4 KB gzip u produkciji, u sopstvenom CSS chunk-u.** |
| `lib/product-image-metrics.ts` | `server-only` čitač manifesta + `resolveContrastMode`. |
| `lib/product-visual-recipe.ts` | `server-only`. Deterministički spaja skalu, taksonomiju i piksele u `sceneKind / paletteSource / accentColors / contrastMode / seed`. |
| `components/product/productStageImages.ts` | `server-only`. Razrešava PDP galeriju + `contrastMode` + `stageFormat` na serveru. |
| `app/interaction-demo/product-visual-lab/page.tsx` + `components/interaction-demo/{ProductVisualLab.tsx, ProductVisualLab.module.css, LabScene.tsx}` | Interni visual lab. |
| `scripts/capture-product-visual-evidence.mjs` | 61 snimak, 4 viewporta × 2 teme. |
| `scripts/verify-product-visual-matrix.mjs` | 66 mernih slučajeva + catalog round trip. |

### D.2 Izmenjeni fajlovi

| Fajl | Izmena | Zašto | Utiče na |
| --- | --- | --- | --- |
| `components/product/ProductDetailExperience.module.css` | Layer tokeni (`--layer-plate/art/halo/product/ui`); `.stage` dobija `aspect-ratio` + `container-type: size`; novi `.stagePlate` i `.stageHalo`; envelope u `cqw/cqh`; `.heroProductObject` content-fit geometrija; `.zoomControl`; `--product-art-color` po kontrastu; `.hero` `align-items: start`; `.heroTitle` clamp `4.5vw / 4.6rem`, `max-width: 14ch` | Sekcije A.2–A.3 | samo PDP |
| `components/product/ProductStickyStage.tsx` | Spojen `.stage`/`.heroVisualSurface` u jedan slojeviti element; prima `images` i `stageFormat` sa servera; dodata zoom kontrola; `data-product-fit`, `data-product-contrast`, `data-stage-format` | Metrike moraju ostati van klijent bundle-a | samo PDP |
| `components/product/ProductDetailPage.tsx` | `getProductStageImages` + `getProductStageFormat` na serveru | isto | samo PDP |
| `components/product/ProductVisualSurface.tsx` | `fit.fit` klasa + `data-product-fit` | katalog kartice, related, brand stranice |
| `components/product/ProductVisualSurface.module.css` | `container-type: size`; `.objectWrap` content-fit; envelope u `cq` jedinicama; uklonjen `padding` sa `.productImage`; reduced-motion čuva centriranje | katalog, related, brand redovi |
| `components/product/ProductHeroSprayBackdrop.module.css` | `color: var(--product-art-color, var(--product-visual-background-color))` | crno-na-crnom | PDP spray scene |
| `components/product/productDetailLayout.test.mjs` · `productHeroSpray.test.mjs` | Ažurirani na novi ugovor: umesto `--product-stage-image-scale` sada tvrde layer redosled, `--product-stage-aspect`, content-fit geometriju i da spray treatment **ne sme** dirati envelope | ugovor je namerno promenjen | testovi |
| `package.json` | `images:metrics`, `images:metrics:check`, `visual:evidence` | — | skriptovi |

### D.3 Kako geometrija radi

```
objectBox.width  = min(envelopeW, envelopeH × contentAspect) / contentFillX
objectBox.aspect = canvasAspect
transform        = translate(−(offsetX + fillX/2)·100%, −(offsetY + fillY/2)·100%)
```

`min()` radi tačno ono što bi `object-fit: contain` uradio — samo nad **siluetom**
umesto nad fajlom. Box se zatim proširi na celo platno (`/ fillX`) i dobije
aspect platna, pa `object-fit: contain` unutar njega ne ostavlja letterbox.
`translate` u procentima se razrešava prema sopstvenom boksu elementa, pa je
pomeraj egzaktan.

Sve su statične vrednosti iz build-time manifesta: **nema merenja u browseru,
nema hydration razlike, nema CLS-a.**

`container-type: size` je nužan jer `min()` mora da poredi ograničenje po širini
i po visini u istoj jedinici, a odnos stranica površine se razlikuje po varijanti
(1.1∶1 u katalog gridu, slobodna visina u PDP related redu, 5∶6 / 1∶1 / 4∶3 na PDP-u).

### D.4 Zašto generisani CSS a ne generisani modul

Katalog renderuje kartice iz **klijentske** komponente (`CatalogExplorer` uvozi
`expandVariant` iz `lib/catalog-listing.ts`), pa bi lookup tabela morala ili da
se pošalje kao JavaScript (~300 KB) ili da se provuče kroz svih osam mesta koja
montiraju product surface. Stylesheet pogađa sva ta mesta preko atributa koji
komponenta ionako emituje, ne troši JS parse vreme, i za sliku bez pravila
degradira na dosadašnji canvas-fit. **Merena cena: 12,4 KB gzip, u zasebnom chunk-u.**

### D.5 Skala — rekalibracija i zašto

| | Staro (na fajl) | Novo PDP (na siluetu) | Novo kartica |
| --- | --- | --- | --- |
| S | `min(66%, 260px)` / 66% | 58cqw / 74cqh | 58cqw / 72cqh |
| M | `min(76%, 320px)` / 76% | 66cqw / 80cqh | 66cqw / 78cqh |
| L | `min(84%, 390px)` / 84% | 74cqw / 86cqh | 74cqw / 84cqh |
| XL | `min(92%, 440px)` / 92% | 82cqw / 92cqh | 82cqw / 90cqh |

Procenti su viši jer su **promenili značenje**. Px plafoni su uklonjeni jer su
postojali da spreče da preterano ispunjen fajl eksplodira — posao koji content
box sada radi direktno. Klasa i dalje dolazi isključivo iz potvrđene zapremine
(`lib/product-scale.ts`), bez pogađanja iz naziva.

**Referentni proizvod je ostao klasa `S`.** Traženih 2–2,4× nije postignuto
podizanjem klase nego ispravnom primenom postojeće: 222 px → **476 px** = **2,14×**.

### D.6 Stage format

Frame prati izmerenu siluetu (`resolveStageFormat`):
`aspect < 0.8 → portrait 5∶6` · `< 1.45 → square 1∶1` · `≥ 1.45 → landscape 4∶3`.

Nije kozmetika. Pošto envelope ograničava proizvod po **obe** dimenzije, zdepasta
limenka od 1 L u okviru 5∶6 je uvek limitirana širinom i nikad ne može iskoristiti
visinu — punila je 29% panela bez obzira na procente. Ovo je jedina korekcija
koja ne seče proizvod i ne pušta ga da probije panel.

### D.7 Šta ostaje za batch

Ekstrakcija palete **je** urađena build-time i upisana u manifest, ali se u
produkciji koristi samo za `contrastMode`. `paletteSource = image-extracted`
akcenti (za non-color proizvode) su spremni i vidljivi u labu, ali nijedna javna
scena ih još ne koristi — čeka dizajnersku odluku iz sekcije H. Runtime
ekstrakcija nije uvedena i ne treba da bude.

---

## ICON RAIN → PILE IMPLEMENTATION

> Dodato 2026-08-17, nakon revizije koja je utvrdila da prethodni `icon-rain` /
> `icon-pile` **nije bio animacija** — `IconField` je crtao 28 krugova i kvadrata,
> a prop `settled` je samo birao dve različite Y pozicije. Ta funkcija je
> **obrisana** iz `LabScene.tsx`; naziv je obećavao više nego što je davao.

### Šta je sada

Stvarna animacija: ikonice se otpuštaju iznad okvira, padaju sa gravitacionim
easing-om, udaraju u pod prelazeći liniju mirovanja, odskoče i slegnu se u
gomilu ispod proizvoda. Kontakt sa podom se pojavljuje zajedno sa komadima.

| | |
| --- | --- |
| Komponenta | `components/interaction-demo/IconRainPileScene.tsx` (client) |
| Geometrija | `components/interaction-demo/iconRainPile.mjs` (čiste funkcije) |
| Stilovi | `components/interaction-demo/IconRainPileScene.module.css` |
| Glyph sistem | `components/interaction-demo/categoryGlyphs.tsx` |
| Testovi | `components/interaction-demo/iconRainPile.test.mjs` — 12 testova |
| Broj elemenata | **precise 30 · spill 34 · cascade 28** (budžet 24–40) |
| Trajanje | stagger **280 ms** + najduži pad **760 ms** = **1040 ms** ukupno |
| Easing | pad `cubic-bezier(0.45, 0.05, 0.75, 0.35)` · udar `cubic-bezier(0.2, 0.85, 0.35, 1)` · sleganje `cubic-bezier(0.4, 0, 0.55, 1)` |
| Physics biblioteka | **nema** |
| JavaScript po frejmu | **nema** — nijedan `requestAnimationFrame` loop |

### Kako se određuju putanje

`planIconRain({ seed, variant, glyphIds })` iz seed-a proizvoda gradi kompletan
plan. Za svaku ikonicu **četiri unapred izračunate tačke**:

1. **release** — iznad okvira (`y` između −12 i −38 cqh), rotacija odstupa od
   konačne za do ±rotationRange;
2. **contact** — prvi dodir, namerno **ispod** linije mirovanja (overshoot);
3. **bounce** — odskok **iznad** linije mirovanja;
4. **rest** — konačni položaj u gomili.

Te četiri tačke postaju custom properties na elementu, a jedan CSS `@keyframes`
interpolira između njih na 0 % / 62 % / 78 % / 100 %. Koordinate su u
**container-query jedinicama** (`cqw` / `cqh`), pa 390 px telefon i 1920 px
desktop pokazuju istu kompoziciju, a ne iste piksele.

Seed je `productSeed(slug)` (FNV-1a) — čist, bez `Math.random()`, pa server i
browser računaju identične koordinate. **Nema hydration mismatch-a** (izmereno:
0 grešaka na 4 viewporta).

### Kako se formira gomila

`buildPileSlots()` gradi slotove odozdo naviše: donji red ima `baseSlots`
mesta, svaki sledeći jedno manje, pomeren za pola slota tako da komad sedne u
prazninu ispod sebe, a ne u rešetku. Ako ponestane redova pre nego što ponestane
komada, višak **širi pod** umesto da gradi toranj.

Redosled otpuštanja prati redove: donji redovi kreću prvi, jer komad ne može da
legne na onaj koji još nije stigao. Test *„bottom rows are released first"* to i
tvrdi — prosečna visina mirovanja prve trećine mora biti niža od poslednje.

### Ikonice — zašto nove, a ne postojeće

`public/icons/categories/*.svg` **postoje za svih 12 kategorija** i jesu vizuelna
referenca koju ovaj set prati. Ne mogu se koristiti ovde: to su 1∶1 auto-trace
fajlovi supplied PNG-ova, **od 2 KB do 285 KB**, sastavljeni od hiljada
jednopikselnih `L x y` segmenata (`poliranje.svg` = 285 KB, `zastita.svg` = 211 KB,
`oprema.svg` = 133 KB). Header učitava tačno jednu kao `<img>`; trideset
inline instanci bi poslalo megabajte path podataka i dalo kompozitoru trideset
složenih oblika za rasterizaciju.

Zato su napravljene kompaktne siluete **istih objekata** na 24×24 mreži, po
nekoliko komandi svaka: disk, perforirani disk, brusna pločica, rolna trake,
folija, sprej limenka, nozzle, pad, gleterica, patrona, respirator, rukavica,
pištolj, posuda, kap, limenka, četka, swatch.

Mapiranje je po **stvarnoj kategoriji** (`lib/productTaxonomy.mjs`), pa abrazivna
scena nikad ne pušta sprej limenke. Nijedan glyph ne nosi broj, granulaciju,
meru ni količinu.

### Tri varijante

| | A · Precise | B · Workshop spill | C · Structured cascade |
| --- | --- | --- | --- |
| Ikonica | 30 | 34 | 28 |
| Veličina | 4.4–6.2 cqw | **3.8–8.2 cqw** | 4.6–6.4 cqw |
| Kolone | slobodno | slobodno | **4 fiksne** |
| Rotacija (rest) | ±16° | ±48° | ±8° |
| Jitter X | 1.1 | 3.4 | 0.7 |
| Širina gomile | 62 cqw | 78 cqw | 84 cqw |
| Komadi izvan gomile | 0 | **4** | 0 |
| Odskok | 1.5 | 2.6 | 1.0 |
| Namena | stranice grupa | radionički ton | najmirnije, B2B |
| Ocena | **needs refinement** | **experiment only** | **needs refinement** |

### Reduced motion

Mirno stanje (`data-phase="idle"`) **jeste gotova gomila**. To je ono što
renderuje server, što vidi čitalac sa `prefers-reduced-motion: reduce`, i što
ostaje ako JavaScript nikad ne izvrši. Komponenta proverava media query **pre**
nego što išta zakaže, pa se animacija ne može pokrenuti ni kasnije.

Izmereno: `phase=idle`, **0 zakazanih animacija**, sve ikonice u gomili.

Pošto je idle već završno stanje, pokretanje animacije **ne može pomeriti
layout** i ne može promeniti šta stranica znači. Faza se postavlja u
`useLayoutEffect`, pre paint-a, pa okvir koji je već na ekranu nikad ne bljesne
gotovom gomilom pre nego što krene.

### Okidač i ponavljanje

Pokreće se **jednom**, pri prvom ulasku u viewport (`IntersectionObserver`,
threshold 0.25). Ako je okvir već na ekranu pri montiranju, kreće sinhrono u
`useLayoutEffect`. `hasPlayedRef` sprečava drugo pokretanje. Nema beskonačne
animacije.

**Replay** postoji **samo u labu** — `showReplay` prop, koji nijedna
produkcijska površina ne prosleđuje.

### Performanse i pristupačnost

- dekorativni sloj je `aria-hidden="true"` i `pointer-events: none` (provereno na
  4 viewporta);
- horizontalni overflow **0 px** na 1920 / 1440 / 1024 / 390;
- 0 console grešaka, 0 hydration grešaka;
- `will-change: transform, opacity` samo dok se faza igra;
- proizvod je u zasebnom sloju (`z-index: 2`) i animacija ga ne dodiruje.

### Dokaz kretanja

`scripts/capture-icon-rain-evidence.mjs` ne veruje ni snimcima ni videu na reč.
Preuzima kontrolu nad stvarnim CSS animacijama kroz **Web Animations API**
(`pause()` + `currentTime`), pa čita transform matricu svake ikonice.

Izmereno na 3 varijante × 2 viewporta × 2 teme = **12 kombinacija**:

| Kombinacija | Ikonica | Max pad | Pomerenih na sredini | Na putanji |
| --- | --- | --- | --- | --- |
| precise · 1440 · light | 30 | 298 px | 30 | 30 |
| spill · 1440 · light | 34 | 288 px | 34 | 34 |
| cascade · 1440 · light | 28 | 299 px | 28 | 28 |
| precise · 1440 · dark | 30 | 290 px | 30 | 30 |
| spill · 1440 · dark | 34 | 280 px | 34 | 34 |
| cascade · 1440 · dark | 28 | 291 px | 28 | 28 |
| precise · 390 · light | 30 | 333 px | 30 | 30 |
| spill · 390 · light | 34 | 321 px | 34 | 34 |
| cascade · 390 · light | 28 | 334 px | 28 | 28 |
| precise · 390 · dark | 30 | 300 px | 30 | 30 |
| spill · 390 · dark | 34 | 290 px | 34 | 34 |
| cascade · 390 · dark | 28 | 301 px | 28 | 28 |

Skript tvrdi da svaka ikonica pređe >120 px, da je na polovini vremena stvarno
između svoje početne i završne tačke, i da sve kreću iznad okvira. Sirovi podaci:
`docs/audit-screenshots/icon-rain-2026-08/motion-measurements.json`.

### Zašto još nije u produkciji

1. **Nije odobrena vizuelno.** Zadatak izričito traži odobrenje u labu pre
   javnih stranica. Nijedna javna ruta ne uvozi `IconRainPileScene`.
2. **Namena je stranica grupe, a ne 832 PDP-a.** Kiša ikonica iza svakog
   pojedinačnog proizvoda bi bila dekoracija bez razloga; iza *grupe* opisuje šta
   grupa sadrži.
3. **Varijanta B (spill) nosi rizik tona** — najlakše sklizne u neozbiljno, što
   je direktno protiv „ne detinjasto, ne kao igrica".
4. **Glyph set traži brand reviziju.** Siluete su moje, izvedene iz postojećih
   ikonica; pre javne upotrebe treba ih potvrditi kao Carsystem vizuelni jezik.
5. **Nije mereno na stvarnom telefonu** — samo Chromium 390 px emulacija.

### V2 (2026-08-18) — dorada nakon pregleda videa

V1 je **netaknuta**. V2 živi u tri sopstvena fajla; brisanjem njih i vraćanjem
jedne lab konstante V2 nestaje bez traga.

| | V1 | V2 |
| --- | --- | --- |
| Komponenta | `IconRainPileScene.tsx` | `IconRainPileSceneV2.tsx` |
| Geometrija | `iconRainPile.mjs` | `iconRainPileV2.mjs` |
| Stilovi | `IconRainPileScene.module.css` | `IconRainPileSceneV2.module.css` |
| Varijante | cascade · precise · **spill** | cascade · precise (spill nije razvijan dalje) |
| Ikonica | 28 / 30 / 34 | **24** za obe |
| Veličina glypha | 3.8–8.2 cqw | 6.2–9.4 cqw (**1,44× izmereno na ekranu**) |
| Oblika po kategoriji | ceo set (do 4, ciklično) | najviše 4 (cascade) / 3 (precise) |
| Rotacija u mirovanju | ±16° / ±48° | ±5° / ±12° |
| Redovi gomile | taper 1 → mound | taper 2 → **9-7-5-3**, niska i široka |
| Senka | fiksnih 74 cqw preko cele scene | **prati stvarnu širinu gomile** + uži tamniji core pod baznim redom |
| Rastojanje proizvod–gomila | vidljiv vazdušni pojas | proizvod sedi na `pileTopY − 3 cqh` |
| Faze | idle → playing | idle → playing → **complete** |
| `will-change` posle sleganja | **ostaje na svim glyphovima** | **skinut** |
| Halo | nema | samo za `dark-product` / `light-product`, iz izmerene svetline |
| Kontrast | jedna siva, 0.16–0.30 | zasebni light/dark tokeni, 0.45–0.50 |

**Izmereno u compare redu** (identičan okvir 662×497, isti proizvod, isti seed):

| | V1 | V2 |
| --- | --- | --- |
| Širina glypha (% okvira) | 5,4% | **7,8%** |
| Opacity raspon | 0,16–0,30 | **0,45–0,50** |
| Broj ikonica | 28 | 24 |
| Proizvod (visina % okvira) | 61% | 58% |
| Faza posle sleganja | `playing` | `complete` |
| Glyphova sa aktivnim `will-change` | **184** | **0** |

Proizvod je u V2 nešto **manji** (58% naspram 61%) jer scena rezerviše prostor za
gomilu — to je razlika koju treba svesno oceniti, ne nusprodukt.

**Dve greške koje je V2 morala da ispravi u sebi pre nego što je merenje značilo išta:**

1. `rowStepY` je bio zapisan u `cqh`, a veličina glypha u `cqw`. Na 4∶3 okviru
   redovi su se preklapali >80% i 24 ikonice su se renderovale kao **jedan red**.
   Sada je korak funkcija visine glypha (`rowStep()` + `V2_FRAME_ASPECT`).
2. `floorY: 90` je sekao donji red van okvira; spušten na 86.

**Lab režimi:** `?rain=v1` · `?rain=v2` · `?rain=compare` (podrazumevano).
Trajni povratak na V1 je **jedan red**:
`RAIN_DEFAULT_VIEW = "v1"` u `components/interaction-demo/ProductVisualLab.tsx`.

**Proizvodi u V2 dokazima** — svi sa stvarnom alfom (`boxSource: "alpha"`):
Flame Booster B-901 (visok, crn) · Carsystem P19 (kružan, srednji ton) ·
Carsystem F19 (kružan, crn) · Home White Smalto 400 (svetao).
Car Fit maskirna folija je **izostavljena**: JPG sa zapečenom belom pozadinom
renderuje se kao beli pravougaonik i ne dokazuje ništa o sceni iza njega.
Fajl nije menjan i nijedan proizvod nije izmišljen kao zamena.

**Artefakti:** `docs/audit-screenshots/icon-rain-v2-2026-08/`

### 2026-08-18 — icon rain ODBAČEN, spray kompoziciona studija

**Icon rain / pile je odbačen kao pravac.** V1 i V2 ostaju u repozitorijumu
isključivo kao arhivirani eksperiment; nisu preporučeni pravac, nisu povezani sa
produkcijom i ne razvijaju se dalje. Precise, Structured Cascade i Workshop
Spill su zatvoreni. Nije napravljena biblioteka ikonica.

**Spray/paint animacija je zaključana.** Potvrđena je snimkom kao dobra: putanje,
`spray-draw` keyframes, trajanje, easing, trigger, redosled poteza, boja,
reduced-motion i gejt na potvrđene color/paint proizvode — ništa od toga nije
menjano u ovom krugu. Problem je bio isključivo **prostorni odnos** proizvoda i
art sloja.

#### Izmereno stanje pre studije (1440 px, scena 537×645)

| | art pojas | centar arta | proizvod | potez levo | potez desno |
| --- | --- | --- | --- | --- | --- |
| Effect Gold 451 | 242 px | 26 px levo od proizvoda | 125 px | 33,5% | **14,9%** |
| Flame Booster B-901 | 242 px | isto | 107 px | 37,2% | **18,6%** |
| Home White Smalto 400 | 226 px | isto | 125 px | 31,0% | **13,7%** |
| Molotow Burner 600 ml | 242 px | isto | 109 px | 36,8% | **18,2%** |
| R-M Diamont BC 100 | 242 px | isto | **256 px** | 6,6% | **−12,4%** |

Potez je meren kao udeo **sopstvene dužine poteza** vidljiv sa svake strane
siluete; cilj revizije je 25–35% sa obe strane. Zaključak: problem nije samo
veličina nego **asimetrija** — art pojas je pomeren levo, pa desna strana gladuje.
Širenje bez recentriranja pogoršalo bi levu stranu i ostavilo desnu kratkom.

#### Tri kompozicije (lab-only tokeni)

| | proizvod | art | offset-x | mehanizam |
| --- | --- | --- | --- | --- |
| **A — Current** | ×1 | ×1 (scale 1.12) | −11,5 px | produkcijsko stanje |
| **B — Balanced** | ×0,95 | ×1,12 (scale 1,254) | **+14,5 px** | `--product-stage-spray-scale`, `--product-stage-spray-offset-x`, lab `--study-product-scale` |
| **C — Art-forward** | ×0,92 | ×1,18 (scale 1,322) | **+14,5 px** | isto |

Prva dva tokena su **postojeći produkcijski hook-ovi**; studija okreće iste
ručice koje bi okrenula i buduća produkcijska izmena. Content-fit po alfa
bounding-box-u je identičan u sve tri kolone — nijedan proizvod nije smanjen
globalno, katalog kartice i non-color proizvodi nisu dirani.

#### Rezultat

| Slučaj | A levo/desno | B levo/desno | C levo/desno |
| --- | --- | --- | --- |
| Effect Gold 451 | 33,5 / **14,9** | **26,2 / 27,7** | **27,6 / 28,7** |
| Flame Booster B-901 | 37,2 / **18,6** | **29,2 / 31,8** | **30,8 / 31,8** |
| Home White Smalto 400 | 31,0 / **13,7** | 23,2 / 27,6 | **24,7 / 28,5** |
| Molotow Burner 600 ml | 36,8 / **18,2** | **29,2 / 30,6** | **30,4 / 31,5** |
| R-M Diamont BC 100 | 6,6 / **−12,4** | 2,2 / 4,4 | 4,9 / 5,6 |

**Preporuka: B — Balanced.** Pogađa cilj 25–35% na sva četiri sprej formata uz
najmanju izmenu odobrene kompozicije. C je bolji za 1–2 procentna poena, ali
smanjuje proizvod za 8% umesto 5% — skuplje nego što donosi.

**Strukturno ograničenje (ne greška podešavanja):** R-M Diamont je 256 px širok
naspram art pojasa od 274–286 px. **Nijedna globalna vrednost ne može ga
opslužiti** — pojas bi morao da preraste panel. Ako se studija odobri, sledeći
korak nije novi procenat nego **art scale koji reaguje na širinu proizvoda**.

Studija: `/interaction-demo/spray-composition` · artefakti:
`docs/audit-screenshots/spray-composition-2026-08/`

#### Nove ideje za ostale grupe

`docs/PRODUCT_SCENE_CONCEPTS.md` — **22 koncepta**, od kojih **16 ne traži
nijedan novi SVG element**. Tri vodeća (Product Echo, Material Signature,
Negative-space Reveal) imaju statične storyboard skice na stvarnim proizvodima:
`/interaction-demo/scene-storyboards` · `docs/audit-screenshots/scene-storyboards-2026-08/`

Ključna činjenica za obim: svih deset non-paint grupa zajedno je **74 proizvoda
(8,9% kataloga)** naspram 654 sprejeva. Preporuka je tri univerzalna pravca sa
parametrom po grupi, ne deset zasebnih jezika.

### Produkcijska granica — `spray-draw`, izmereno

Jedina animacija pozadine koja je danas javna. `scripts/verify-spray-draw-behaviour.mjs`
je meri umesto da je čita iz koda:

| Pitanje | Izmereno |
| --- | --- |
| Kada se pokreće | `idle@1212 ms → running@1315 ms → complete@3059 ms`. Čeka `load` event slike proizvoda, pa 300 ms uvoda — dakle zavisi od slike, ne od fiksnog kašnjenja. |
| Koliko traje | **1744 ms** od running do complete |
| Da li se izvršava samo jednom | Da. 2,5 s posle završetka faza je i dalje `complete`. Nema petlje. |
| Scroll away → back | Faza ostaje `complete` — **ne ponavlja se** |
| Povratak na stranicu (back navigacija) | Komponenta se remontira → **ponavlja se** i ponovo se slegne u `complete` |
| Promena varijante | Route change → nova montaža → **ponavlja se**, slegne se u `complete` |
| Promena slike u galeriji | Ne remontira backdrop. Nije moglo biti izvršeno na referentnom proizvodu — ima jednu sliku. |
| Non-color proizvod | Backdrop se **uopšte ne renderuje** (provereno na P19) |
| Reduced motion | `phase=static`, **0 animacija** |
| Mobilno (390 px, 4× CPU throttle) | **CLS 0**, overflow 0 px, 26 SVG čvorova u backdrop-u |

⚠️ **Nalaz:** 1744 ms je skoro dvostruko duže od budžeta 600–900 ms koji je
zadat za nove scene. To je zatečeno ponašanje, nije menjano u ovom pasu, ali je
neusklađenost koju treba svesno prihvatiti ili skratiti.

---

## E. Vizuelni artefakti

| Šta | Putanja |
| --- | --- |
| Visual lab (interno, `noindex`) | `http://localhost:3100/interaction-demo/product-visual-lab` |
| Lab izvor | `components/interaction-demo/ProductVisualLab.tsx` |
| Screenshotovi (61) | `docs/audit-screenshots/product-visual-2026-08/` |
| Manifest metrika | `data/product-image-metrics.generated.json` |
| Generisani fit CSS | `components/product/ProductImageFit.generated.module.css` |
| **Icon rain kadrovi (36)** | `docs/audit-screenshots/icon-rain-2026-08/` |
| **Icon rain video (2)** | `docs/audit-screenshots/icon-rain-2026-08/video/icon-rain--{1440x900,390x844}.webm` |
| **Icon rain filmstrip (9 kadrova)** | `docs/audit-screenshots/icon-rain-2026-08/filmstrip/` |
| **Icon rain GIF** | `docs/audit-screenshots/icon-rain-2026-08/filmstrip/icon-rain-precise.gif` |
| **Icon rain kontakt traka** | `docs/audit-screenshots/icon-rain-2026-08/filmstrip/icon-rain-precise-strip.png` |
| **Merenja kretanja** | `docs/audit-screenshots/icon-rain-2026-08/motion-measurements.json` |
| **V1 vs V2 side-by-side (54)** | `docs/audit-screenshots/icon-rain-v2-2026-08/v1-vs-v2-*.png` |
| **V1 vs V2 filmstrip** | `docs/audit-screenshots/icon-rain-v2-2026-08/filmstrip/` |
| **V2 GIF (2)** | `.../filmstrip/icon-rain-v2-{cascade,precise}.gif` |
| **V2 video (2)** | `.../video/icon-rain-v2-cascade--{1440,390}.webm` |
| **V2 slegnuta gomila bez animacije** | `.../v2-settled-pile-no-animation--1440--light.png` |

Imenovanje snimaka: `<slučaj>--<viewport>--<tema>.png`, npr.
`pdp-reference-flame-booster-thick-black--1440x900--dark.png`.
Viewporti: `1920x1080`, `1440x900`, `1024x820`, `390x844`.
Teme: `light` svuda; `dark` na 1440 i 390.

Ključni snimci:

- `pdp-reference-flame-booster-thick-black--1440x900--dark.png` — referentni slučaj
- `pdp-white-smalto-400--1440x900--light.png` — beli proizvod, obrnuti kontrast
- `pdp-wide-body-filler-b-2e11--1440x900--light.png` — landscape format
- `pdp-abrasive-p19--1440x900--light.png` — square format, non-color scena
- `pdp-long-title-marking-591--1440x900--dark.png` — najduži naziv
- `pdp-no-image-norbin--1440x900--light.png` — fallback bez slike
- `katalog-grid--1440x900--light.png` — katalog grid
- `lab-full--1440x900--light.png` — ceo lab (1440 × 7181)

> `docs/audit-screenshots/` je u `.gitignore` po postojećoj projektnoj konvenciji
> („Local generated and review artifacts"), zajedno sa
> `capture-page-lock-evidence.mjs` izlazom. Regeneracija: sekcija F.

---

## F. Validacija

Sve komande pokrenute 2026-08-17 protiv već pokrenutog dev servera na `:3100`.

| Komanda | Rezultat |
| --- | --- |
| `npm run typecheck` | ✅ bez grešaka |
| `npm run lint` | ✅ 0 errors, 2 warnings — obe pre-postojeće u `tmp/qa/*.mjs`, van obima |
| `npm run build:check` | ✅ compiled 25,6 s · **943 statičke stranice** · `/proizvodi/[slug]` **832 rute** · `/proizvodi/grupa/[slug]` **41 ruta** |
| `npm test` | ✅ 12/12 |
| `npm run test:product-motion` | ✅ **58/58** (3 su tražila ažuriranje na novi ugovor — vidi D.2) |
| `npm run test:catalog` | ✅ 11/11 |
| `npm run images:metrics:check` | ✅ 826 slika se poklapa sa manifestom |
| `node scripts/verify-product-visual-matrix.mjs` | ✅ **all checks passed (66 cases)** |
| `node scripts/capture-product-visual-evidence.mjs` | ✅ 61 snimak, 0 praznih |
| `npm run test:icon-rain` | ✅ **12/12** (determinizam, budžet 24–40, trajanje ≤1100 ms, stvarno kretanje, red slaganja gomile) |
| `node scripts/capture-icon-rain-evidence.mjs` | ✅ **all icon-rain checks passed** — 12 kombinacija, 36 kadrova, 9 filmstrip kadrova, 2 videa, 0 praznih |
| `node scripts/verify-spray-draw-behaviour.mjs` | ✅ **all spray-draw checks passed** |
| `npm run test:icon-rain` (V1 + V2) | ✅ **31/31** — 12 V1 + 19 V2, uključujući „V1 je nepromenjena" i „nijedna produkcijska površina ne uvozi V2" |
| `node scripts/capture-icon-rain-v2-evidence.mjs` | ✅ **all V1/V2 comparison checks passed** |

`verify-product-visual-matrix.mjs` po slučaju tvrdi:

- proizvod ne izlazi iz površine (worst overhang **0 px**);
- horizontalni overflow dokumenta **0 px**;
- horizontalno odstupanje od centra **≤ 2 px** (izmereno: 0);
- zoom kontrola **nikad** ne prelazi preko proizvoda;
- quantity badge i brand mark **nikad** ne prelaze preko proizvoda;
- naslov nije odsečen;
- zoom kontrola ima `aria-label`;
- slika ima `alt`;
- proizvod dostiže **≥ 97%** svog envelope-a u bar jednoj osi;
- **nula** hydration grešaka i **nula** console grešaka.

Pokriveno: referentni PDP, crn, beo, jaka boja, bez boje, visok, širok, velike
transparentne margine, najduži naziv, SVG bez metrika, bez slike, family varijanta
× 1920 / 1440 / 1024 / 390 × light / dark = **66 slučajeva**.

**Catalog → PDP → Back:** 48 → 68 kartica nakon dva infinite-scroll koraka;
klik na karticu; povratak vraća **68 kartica na y=8720** (kliknuto na y=8720).
URL, filteri i query parametri očuvani.

### Icon rain — dodatne provere

- horizontalni overflow **0 px** na 1920 / 1440 / 1024 / 390;
- **0** hydration grešaka, **0** console grešaka na sva 4 viewporta;
- dekorativni sloj `aria-hidden="true"` i `pointer-events: none` na sva 4;
- reduced motion: `phase=idle`, **0 zakazanih animacija**;
- build: `/interaction-demo/product-visual-lab` = **4,63 kB / 119 kB First Load JS**,
  odsutna iz `sitemap.xml`, `noindex` preko `app/interaction-demo/layout.tsx`.

### Šta nije moglo biti provereno

- **Realni uređaji i realni browseri** — sve je Chromium/Chrome 151. `container-type: size`,
  `color-mix()` i `oklch()` traže Safari 16.4+ / Firefox 128+; projekat ih je već
  koristio pre ovog pasa, ali `cqw/cqh` su nova zavisnost.
- **Vizuelna regresija na svih 832 PDP-a** — provereno 11 reprezentativnih;
  ostalo je pokriveno geometrijski (isti CSS, isti manifest), ne pogledom.
- **Produkcijski Lighthouse / CLS merenje** — build prolazi, ali performanse
  nisu profilisane na produkcijskom hostingu.
- **Brand stranice** koje koriste `ProductVisualSurface` (Cosmos, Befar, R-M)
  nisu snimljene; dele istu površinu, pa nasleđuju istu geometriju.
- **Icon rain na stvarnom telefonu** — samo Chromium 390 px emulacija; frame rate
  na srednjem Androidu nije meren.
- **Spray-draw promena slike u galeriji** — referentni proizvod ima jednu sliku,
  pa ta putanja nije mogla biti izvršena.

---

## G. Rangirana preporuka

Početna hipoteza je proverena i **potvrđena, uz jednu korekciju**.

**1. Hibrid: color scene samo za potvrđenu boju, materijal/tehnika za ostalo** — ✅ preporučeno

Podaci to podržavaju direktno: 654 od 832 proizvoda su `sprejevi` sa potvrđenom
nijansom, a preostalih 178 su rasuti po 11 grupa gde boja nije atribut. Sistem je
već implementiran (`sceneKind` degradira na `technical` kad nema potvrđene boje) i
nikada ne izmišlja nijansu. **Ovo je jedini pravac koji je siguran za produkciju
odmah.**

**2. Blueprint + material chips kao osnovna non-color kombinacija** — ✅ preporučeno, ali skromnije nego što hipoteza sugeriše

Non-color populacija je **178 proizvoda, od toga samo 4 abraziva i 1 komad opreme**.
Graditi dva puna vizuelna jezika za 5 proizvoda se ne isplati. Predlog: **jedan**
neutralni tehnički field kao default za svih 178, sa material-trace varijantom za
`kitovi + zastita + lepkovi` (34 proizvoda) gde tekstura zaista nosi značenje.

**3. Icon rain → pile samo na stranicama grupa** — ⚠️ tek nakon 1 i 2

Najskuplji pravac, najmanja pokrivenost i jedini sa animacijom. Statično završno
stanje već izgleda dobro (vidi lab, sekcija 6), pa ga treba uvesti **prvo kao
statičnu kompoziciju** na 41 family stranicu, a animaciju odobriti tek posle.

---

## H. Otvorene odluke — traže vlasnika projekta

1. **Katalog kartica ostaje 1.1∶1.** Format nije menjan da se ne pomeri gustina
   grida. Posledica: visoki sprejevi (773 od 832) su u kartici limitirani visinom.
   Prelazak na portret kartice bi ih uvećao ~30%, ali menja izgled celog kataloga.
   **Odluka: da li se dira gustina kataloga?**

2. **Kvalitet izvornih fajlova.** 14 slika je JPG/PNG **bez alfa kanala** (npr.
   `rm-body-filler-white-b-2e11.jpg`, `rm-pasta-190-5l.jpg`) — trim po ivičnoj
   pozadini radi, ali beli pravougaonik ostaje vidljiv kao ploča na sceni.
   **Odluka: tražiti transparentne rendere od dobavljača, ili prihvatiti?**

3. **Dva proizvoda nemaju render** (`norbin-n15-020-5l`, `satajet-x-5500`) i
   koriste placeholder. **Odluka: nabaviti slike ili ih skloniti iz kataloga?**

4. **Naslov na PDP-u** za najduže nazive (44 znaka) prelama u 6 redova na 1440.
   Nije odsečen i ne nadjačava proizvod, ali je visok. **Odluka: skratiti
   `displayNameSr` za marking liniju ili proširiti `max-width` naslova?**

5. **Palete izvučene iz slike** postoje u manifestu ali se ne koriste za akcente
   u produkciji. **Odluka: pustiti ih u non-color scene (pravac 2) ili ostati na
   neutralnim tonovima grupe?**

6. **Zoom kontrola** je uvedena jer je zadatak tražio stabilnu poziciju zoom-a.
   Trenutno skalira sloj proizvoda na 1.28×. **Odluka: zadržati, ili je pravi
   zahtev bio lightbox?**

---

## Regeneracija

```bash
# 1. metrike slika (posle svake promene u public/products ili public/images)
npm run images:metrics

# 2. provera da je manifest svež (za CI)
npm run images:metrics:check

# 3. dev server — koristiti POSTOJEĆI, ne pokretati drugi na istom dist dir-u
npm run dev

# 4. merni matriks
node scripts/verify-product-visual-matrix.mjs

# 5. screenshotovi
npm run visual:evidence

# 6. icon rain — testovi geometrije, pa kadrovi + video + merenja kretanja
npm run test:icon-rain
npm run visual:icon-rain
npm run visual:icon-rain-v2    # V1 vs V2 side-by-side + GIF + video

# 7. ponašanje jedine produkcijske animacije pozadine
npm run visual:spray
```
