# R-M catalog sync

Ponovljiv, idempotentan uvoz aktuelnog R-M asortimana (brend u okviru Surventisa,
ranije BASF Coatings). Isti standard kao [Carsystem](CARSYSTEM_CATALOG_SYNC.md),
[C.A.R.FIT](CARFIT_CATALOG_SYNC.md) i [Befar](BEFAR_CATALOG_SYNC.md) sync; kod je zaseban
(`scripts/rm-sync/`) i koristi samo generičke pomoćnike (`http.mjs`, `rm-pdf-text.mjs`,
korak objave slika, `catalog-runtime.mjs`).

```bash
npm run rm:sync            # acquire → plan → apply → validate → reconcile
npm run rm:sync:acquire    # info portal + sajt + TDS indeks + TDS tekst + model + slike (mreža)
npm run rm:sync:plan       # dry run: reports/SYNC_DRY_RUN.md, .json, .csv
npm run rm:sync:apply      # jedini korak koji menja katalog
npm run rm:sync:check      # šta bi apply promenio (idempotentnost = prazna lista)
npm run rm:sync:validate   # sadržaj, slike, odnosi, runtime
npm run rm:sync:reconcile  # COVERAGE GATE (A/B/C/D)
npm run test:rm-sync
```

Pretraga se proverava nad pokrenutim buildom:
`node scripts/rm-sync/qa-search.mjs --base-url=http://localhost:3220`.

## Izvori i autoritet

| Izvor | Uloga |
| --- | --- |
| `info.rmpaint.com/products` | PRIMARNI identitet: zvanična OZNAKA proizvoda, tehnička kategorija, opis, slika, link TDS-a |
| `www.rmpaint.com/en-int` | dokaz da je proizvod u aktuelnoj ponudi + serija (Pioneer / Advance) |
| `techinfo.rmpaint.com/unicorn/en/*.pdf` | TDS: razmera mešanja, učvršćivači, razređivači, VOC, sušenje, pot-life |
| `rmpaint.com/en-int/sds` | SDS — bez linka po proizvodu („contact your local representative”) |

Nije izvor: distributeri, `refinish.basf.us` (severnoamerički asortiman) i BASF-era
dokumentacija osim kao istorijski trag. Zvanični katalog/product guide u PDF-u ne postoji.

**Javna zvanična šifra je oznaka proizvoda** (`C 2A64`, `H 2A14`). Brojevi artikala i
pakovanja nisu javno objavljeni ni na jednom zvaničnom izvoru — pakovanje ostaje „Na upit”,
a 8-cifreni brojevi se ne izmišljaju.

## Slojevi podataka

| Sloj | Fajl |
| --- | --- |
| RAW info portal | `data/rm-sync/raw/info-portal.generated.json` |
| RAW sajt | `data/rm-sync/raw/website.generated.json` |
| RAW TDS indeks | `data/rm-sync/raw/tds-index.generated.json` |
| Model proizvoda | `data/rm-sync/source-products.generated.json` |
| Slike (manifest / objavljene) | `image-manifest.generated.json`, `published-images.generated.json` |
| Identitet (append-only) | `data/rm-sync/identity-registry.json` |
| Ručne odluke | `data/rm-sync/manual-decisions.json` |
| Taksonomija | `data/rm-sync/taxonomy-map.json` |
| SR sadržaj | `data/rm-sync/localization/<uloga>.json` |
| Dataset sajta | `data/rm-catalog-products.generated.json` → `lib/rm-catalog-products.ts` |
| Izveštaji | `data/rm-sync/reports/` |

Tekst TDS-a i preuzeti PDF-ovi žive u kešu (`.cache/rm-sync/`), ne u repozitorijumu.

## Pravila

### Identitet

1. zvanična oznaka sa info portala → 2. zvanični naziv porodice/komponente →
3. normalizovan naziv → fuzzy samo kao pomoć. Naziv sam nikad ne spaja zapise: R-M nazive
menja kroz godine, a `GlossTOP` (`C 2A63`) i `GlossTOP+` (`C 2A64`) su različiti proizvodi.

**Jedna oznaka = jedan zapis.** Svaka oznaka ima svoju stranicu na portalu i svoj TDS
(218 različitih URL-ova, nijedan deljen), pa se zapisi ne grupišu po sličnom nazivu.

### Sistemi za nijansiranje

AGILIS, AGILIS eSense, AGILIS eSense X-TREME, AGILIS X-TREME, ONYX HD, ONYX HD TROPICAL,
DIAMONT i GHD TOPCOAT su SISTEMI (`kind: "system"`) — jedan zapis po sistemu. Pojedinačni
toneri se zvanično ne objavljuju (0 šifara tonera na javnim izvorima) i ne prave se kao
kartice.

`UNO HD` ima aktuelnu stranicu na sajtu, ali ga portal ne vodi: status
`CURRENT_WEBSITE_ONLY_SYSTEM`, bez izmišljene oznake, i ne ulazi u pokrivenost šifara.

### Mixing clear / adjusting baze

HB 002/004/006/010/010E/010X/010XE/020/030/030E/030X/030XE/040/040E nemaju ni portalnu
stranicu ni svoj TDS — pominju ih samo sistemski TDS-ovi. Vode se kao komponente sistema
(`systemComponents`), **bez zasebne kartice**, i ne računaju se u pokrivenost. Pet njihovih
marketinških stranica na sajtu vezuje se za matični sistem kao sekundarni izvor.

### Učvršćivač / razređivač / aditiv

Samostalni zapisi (`kind: "component"`), nikad varijanta laka — kompatibilnost nije
varijanta. Odnosi se čitaju iz TDS-a i čuvaju u oba smera:
`USES_HARDENER`, `USES_REDUCER`, `USES_ADDITIVE` i obrnuto `USED_BY`. Jedna komponenta
pripada većem broju proizvoda (`H 2A14` → 9 proizvoda).

### Current vs legacy

`CURRENT_ACTIVE` traži portalnu stranicu; TDS revizije 2026 i futer „by Surventis” su
dodatni dokaz. Proizvod bez aktuelnog TDS-a ostaje u katalogu sa
`documentationGap` — dokumentacija koja nedostaje nije razlog za izostavljanje, ali se
tehničke činjenice tada ne izmišljaju.

Lokalni zapisi kojih nema na zvaničnim izvorima ostaju u katalogu kao
`LEGACY_LOCAL_ONLY` i **ne** ulaze u pokrivenost.

### Postojeći zapisi se dopunjuju, ne dupliraju

59 zapisa iz ranije dostavljene arhive (`rm:import` → `lib/rm-imported-products.ts`) i
ručni Body Filler zadržavaju slug, sliku i lokalno hostovane PDF-ove; sync im kroz
`applyRmCatalogEnrichment` dodaje taksonomiju, seriju, tehničke činjenice iz aktuelnog
TDS-a, odnose i pojmove pretrage. `rm:import` se ne uklanja u ovoj fazi.

### Slike

Samo zvanični izvori (`info.rmpaint.com`, `www.rmpaint.com`), preuzete i objavljene lokalno
u `public/products/rm/catalog/` — bez hotlinka. **Pozadina se ne uklanja**: R-M packshot je
bela ili svetla ambalaža sa belom etiketom, pa bi maska pojela sam proizvod. PNG sa alfa
kanalom ostaje providan.

Portal isporučuje sličicu „Image missing” tamo gde fotografije nema. Prepoznaje se po
bilo kom od dva dokaza (`scripts/rm-sync/lib/placeholders.mjs`) i ne objavljuje se — zapis
ostaje `MISSING_OFFICIAL_ASSET` sa placeholderom sajta („Vizuel u pripremi”):

- sadržaj: isti bajtovi na tri ili više zapisa (`Image missing_0.png` na H 2A81, H 2P80, H 2P81);
- izvorni fajl: portal ga imenuje `Image missing[_N].png`, i to hvata i varijantu koja se
  pojavljuje na jednom jedinom zapisu.

**H 2RM2 WHEEL CLEAR COAT, HARDENER (2026-09-30).** Jedina slika na portalu je bila
`Image missing_1.png` (SHA-256 `6aa98ae0…0922`, 200 × 280, natpis „Image missing” na
engleskom). Pošto se varijanta `_1` javlja samo na tom zapisu, pravilo po sadržaju je nije
uhvatilo i sajt je grafiku objavio kao fotografiju proizvoda
(`public/products/rm/catalog/rm-h-2rm2-wheel-clear-coat-hardener.webp`). Slika je odbačena
jer nije fotografija proizvoda; fajl je uklonjen, zapis ima `image: null` i
`missingOfficialAsset: true`, a proizvod je u redu za dostavu slike vlasnika
(`rm__rm-h-2rm2-wheel-clear-coat-hardener`). Zvanične zamene nema (ni na rmpaint.com, ni za
C 2RM2). `approvedAt` / `approvedBy` u image-supply lock-u ostaju `null` dok stvarna slika ne
bude dostavljena i odobrena.

### Boja kartice

`STATED_PRODUCT_COLOUR` samo kada zvanični naziv/opis navodi boju MATERIJALA i uloga je
obojen materijal (podloge, kitovi, gotove boje). Sve ostalo je `KEEP_BRAND` — boja ambalaže
nije boja materijala. Odluke: `reports/colour-decisions.generated.json`.

### Taksonomija

Mapira se ULOGA, ne brend (`data/rm-sync/taxonomy-map.json`): čistači → `ciscenje`,
kitovi i njihovi učvršćivači → `kitovi`, aerosoli → `sprejevi`, podloge/boje/lakovi i
njihove komponente → `boje` uz fazu (`podloga`/`boja`/`lak`). Komponenta nasleđuje fazu
proizvoda koji je koristi.

### SR sadržaj

`LOCALIZATION_GUIDE.md` + `check-localization.mjs`: svaki broj u tekstu mora postojati u
zvaničnom ulazu, a `productType` mora nositi tačan termin uloge (učvršćivač ≠ razređivač ≠
kit ≠ prajmer). Unos nosi `sourceHash`; kada se izvor promeni, tekst je zastareo i proizvod
čeka (`HELD_MISSING_LOCALIZATION`).

### TDS / SDS, cene

TDS se vodi kao **referenca** na `techinfo.rmpaint.com` (218 dokumenata, svi HTTP 200, bez
sesijskih tokena i preusmeravanja). SDS je „na upit”. Cene i zalihe se ne uvoze.

## Coverage gate

`npm run rm:sync:reconcile` — A (zvanični zapisi) = B (zastupljeni lokalno),
C (zvanične oznake) = D (zastupljene lokalno), uz `ACTIVE_PRODUCT_MISSING = 0`,
`ACTIVE_CODE_MISSING = 0`, `DUPLICATE_ACTIVE_CODE = 0`, bez siročadi i polomljenih slika.
Komponente sistema bez kartice i website-only sistem se izveštavaju zasebno.

## Novo izdanje / promene na izvoru

1. `npm run rm:sync:acquire` (osvežava keš), pa `npm run rm:sync:plan`.
2. Pregledati `reports/SYNC_DRY_RUN.md`: novi zapisi, nove oznake, zastareli SR tekstovi.
3. Dopuniti `localization/*.json` (ulaz je u `.cache/rm-sync/localization-input/`).
4. `npm run rm:sync:apply`, `npm run images:metrics`, pa `npm run rm:sync`.
5. Slug je trajan: čita se iz registra po `sourceKey`, pa preimenovanje na izvoru ne menja URL.
