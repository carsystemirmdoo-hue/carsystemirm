# C.A.R.FIT catalog sync

Ponovljiv, idempotentan uvoz celog aktivnog C.A.R.FIT asortimana (proizvođač
August Handel GmbH) u naš katalog. Isti standard kao
[Carsystem sync](CARSYSTEM_CATALOG_SYNC.md); kod je zaseban (`scripts/carfit-sync/`)
i od Carsystem synca koristi samo generičke pomoćnike (`http.mjs`, uzorak boje).

```bash
npm run carfit:sync            # acquire → plan → apply → validate → reconcile
npm run carfit:sync:acquire    # sajt + PDF + slike + provera dokumenata (mreža; --refresh osvežava keš)
npm run carfit:sync:plan       # dry run: reports/SYNC_DRY_RUN.md, .json, .csv
npm run carfit:sync:apply      # jedini korak koji menja katalog
npm run carfit:sync:check      # šta bi apply promenio (idempotentnost = prazna lista)
npm run carfit:sync:validate   # sadržaj, slike, dokumenti, runtime
npm run carfit:sync:reconcile  # COVERAGE GATE (A/B/C/D)
npm run test:carfit-sync
```

## Izvori i autoritet

| # | Izvor | Uloga |
|---|---|---|
| 1 | aktivna stranica proizvoda na `carfitrepair.com/en/` | da li je proizvod TRENUTNO aktivan, naziv, opis, šifre, slike, TDS/SDS |
| 2 | C.A.R.FIT Catalogue 2026 (PDF) | potvrda, broj komada u pakovanju, šifre koje sajt još ne navodi, kontrola razlika |
| 3 | naši lokalni podaci | samo za prepoznavanje ručnih zapisa |

Webshopovi i distributeri nisu izvor ni za jedno polje. Cene i zalihe se ne
uvoze; svaki uvezen zapis je „Na upit”.

**Arhitektura sajta proizvođača:** WordPress + Yoast + Elementor + TranslatePress,
otvoren REST API. Proizvod = objava u kategoriji ispod `produkte`. Lista se ne
sastavlja ručno: `/en/wp-json/wp/v2/posts` (strukturisan izvor) × Yoast
`post-sitemap.xml` × živa EN stranica svake objave (HTTP 200 + canonical).
Nemački REST služi kao kontrola parsera — skup šifara po objavi mora biti isti
u oba jezika. Adresa PDF kataloga se ne upisuje u kod: čita se sa
`/en/katalog/` (dFlip `source`), pa novo izdanje sync nalazi sam.

## Slojevi podataka

```
data/carfit-sync/
  raw/website-en.generated.json        RAW sajt (samo činjenice sa sajta)
  raw/catalogue-2026.generated.json    RAW PDF (ceo trojezični red, ništa se ne odseca)
  source-products.generated.json       sajt × PDF po šifri artikla + konflikti
  image-manifest.generated.json        zvanične slike, sha256
  document-manifest.generated.json     TDS/SDS linkovi, HEAD status, veličina
  taxonomy-map.json                    C.A.R.FIT kategorija → naša (ručno, determinističko)
  localization/*.json                  SR sadržaj po zvaničnoj kategoriji (sa `sourceHash`)
  manual-decisions.json                odluke vlasnika
  identity-registry.json               sourceKey/šifra → naš slug (samo dopuna)
  published-images.generated.json      javna putanja → zvanični izvor slike
  reports/                             SYNC_DRY_RUN, RECONCILIATION, validation, colour-decisions
data/carfit-catalog-products.generated.json   ono što čita lib/carfit-catalog-products.ts
public/products/carfit/catalog/*.webp         objavljene slike
```

Sirovi REST odgovori, HTML, PDF i originalne slike su u `.cache/carfit-sync/`
(gitignored).

## Pravila

### Identitet i spajanje izvora
Ključ je **zvanična šifra artikla** (`N-NNN-NNNN`). Naziv ne spaja izvore. Jedini
izuzetak: stranica sajta koja ne navodi NIJEDNU šifru preuzima šifru PDF porodice
potpuno istog naziva (Ozone Generator → 6-980-0001).

| Klasa | Značenje | U katalog? |
|---|---|---|
| `WEBSITE_AND_CATALOGUE` | bar jedna šifra stranice je i u PDF-u | da |
| `WEBSITE_ONLY` | aktivna stranica, nijedna šifra u PDF-u | **da** — aktivna stranica sa šifrom je dovoljan dokaz |
| `CATALOGUE_ONLY` | PDF porodica bez ijedne šifre na sajtu | ne (`CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE`), dok proizvođač ne objavi stranicu |
| `SOURCE_CONFLICT` | izvori se ne slažu | da; razrešenje je u izveštaju |

PDF šifra koje nema na sajtu, a stoji u ISTOJ PDF tabeli sa šiframa tačno jedne
stranice, postaje varijanta tog proizvoda (`onWebsite: false`).

### Porodica i varijante
Jedna zvanična stranica = jedan proizvod = jedna kartica. Šifre (granulacije,
pakovanja, dimenzije, boje) su redovi `detail.variants`. Gold Paper Disc ima 22
šifre i jednu karticu.

### Komponente i učvršćivači
Pravilo je u `scripts/carfit-sync/lib/components.mjs`:

1. Šifra pod h3 blokom („Clearcoat”, „Hardener”, „Discs”…) pripada stranici na
   kojoj je navedena i nikad se ne gubi — red tabele šifara, sa komponentom u oznaci.
2. Prateća komponenta postaje zaseban proizvod samo kada je proizvođač tako
   predstavlja (sopstvena stranica). C.A.R.FIT trenutno nema nijednu takvu.
3. Učvršćivač naveden samo na stranici svog laka/filera ostaje red tog proizvoda:
   zasebna kartica bi bila proizvod bez zvaničnog opisa, slike i namene.
4. Gustina, VOC i tačka paljenja stranice važe za glavnu komponentu.
5. Šifra na VIŠE stranica dobija jednog vlasnika, redom: ručna odluka → stranica
   na kojoj je glavna komponenta → prefiks serije (9-171-xxxx) → ista PDF porodica →
   starija objava. Na ostalim stranicama šifra je „šifra u sistemu” + veza ka
   vlasniku. Stranica čija je JEDINA šifra u vlasništvu drugog proizvoda
   (`REPRESENTED_BY_OWNER`) je isti artikal pod drugim nazivom i ne dobija karticu.

### Konflikti izvora
Kada se sajt i PDF ne slažu oko mere, treći svedok je sama šifra: C.A.R.FIT u
poslednja četiri mesta upisuje meru (`6-500-1000` = P1000, `4-205-3600` = 3,6 l).
Ako šifra potvrđuje PDF, prikazuje se vrednost iz PDF-a; inače važi sajt. Kopiran
opis uz različite šifre na sajtu razrešava PDF red.

**Verovatna slovna razlika u šifri** (trenutno jedan slučaj, punilac 3,6 l crna):

| | Vrednost | Gde se koristi |
|---|---|---|
| Sajt (primarni izvor) | `4-304-3600`, opis „0,8 l, black” | red tabele šifara, coverage gate, `sku` reda; mera ispravljena na 3,6 l jer je nose i šifra i PDF |
| PDF 2026, str. 11 | `4-204-3600`, „3.6 L … black” | `alternateArticleNumbers` iste varijante: pretraživa (exact-code), navedena u napomeni tabele, NIJE druga varijanta |

Pravilo: šifra sa sajta čiji prefiks ne postoji nigde drugde, a od PDF šifre iste
PDF tabele i iste boje se razlikuje u TAČNO jednoj cifri. Nema dokaza da postoje dva
artikla, pa je to jedna varijanta sa dva zvanična zapisa šifre. Ako proizvođač
ispravi sajt, registar već vodi obe šifre na isti slug, pa se URL ne menja.

### PDF porodice bez stranice (`CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE`)
Ne uvoze se: nemaju aktivnu stranicu, zvaničan aktuelni opis ni zvaničnu sliku, a
sadržaj se ne izmišlja i slike trećih strana se ne koriste. Ništa ne treba ručno
pratiti — čim proizvođač objavi stranicu, `acquire-website` je nalazi kroz REST i
sitemap, šifra je veže za PDF red, a plan je prijavljuje kao nov proizvod
(`HELD_MISSING_LOCALIZATION` dok se ne napiše SR tekst).

### Slike
Samo `carfitrepair.com/wp-content/uploads`. Tok: original → keš → sha256 →
cut-out WebP → `public/products/carfit/catalog/<slug>.webp`. Zvanične slike su
JPEG na beloj podlozi; standard sajta (roletna kartice je IZA proizvoda) traži
alfa kanal, pa se uklanja samo belina **povezana sa ivicom slike** — etikete i
beli proizvodi ostaju celi. Slika čija ivica nije bela (fotografija) ostaje
netaknuta (`kept-background`). Bez rastezanja i uvećavanja; najviše 1200 px.
Aktivan proizvod bez zvanične slike se uvozi sa placeholderom i oznakom
`MISSING_OFFICIAL_ASSET`.

### Boja kartice
`decideShade` u `apply.mjs`, odluka po proizvodu u
`reports/colour-decisions.generated.json`:

- `PACKSHOT_SAMPLE` — na slici je sam proizvod (`packshotShade`), dominantna boja
  ≥ 30 % i slaže se sa zvaničnim „Color”. C.A.R.FIT crvena na slici je ambalaža i
  odbacuje se bez zvaničnog „Color: red”.
- `STATED_COLOUR` — zvanično „Color” je JEDNA boja materijala (`materialColour`).
- `PACKSHOT_NEUTRAL` — neutralan proizvod (crn/siv/beo) sa slike.
- `KEEP_BRAND` — više boja u porodici, bezbojno, ili hemija u ambalaži bez navedene boje.
- `NEEDS_MANUAL_REVIEW` — „Color” postoji, ali nije prepoznata reč.

### TDS / SDS
PDP vodi na zvanični dokument na carfitrepair.com (isto kao Carsystem i R-M).
`acquire-documents` proverava svaki link (HEAD) i meri veličinu; mrtav link se ne
objavljuje. PDF-ovi se ne komituju.

### SR sadržaj
`data/carfit-sync/LOCALIZATION_GUIDE.md`. Svaki unos nosi `sourceHash`; kada
proizvođač promeni stranicu, plan proizvod označava `HELD_MISSING_LOCALIZATION`
dok se tekst ne osveži. `check-localization.mjs` proverava šifre, dužine,
jedinstvenost oznaka, zabranjene izraze i temperature prema izvoru.

### Ručni zapisi
Ne prepisuju se i ne brišu. Lestvica uparivanja je u `lib/local-match.mjs`
(zvanična šifra → bajt-identična slika + pakovanje → tačan naziv + pakovanje;
fuzzy naziv nikad sam). Placeholder SKU (`CARFIT-FILM-4X5M`) nije identitet.
Pouzdano prepoznat zapis dobija dopunu (tabelu zvaničnih šifara); nepouzdan ostaje
legacy, a zvanični proizvod se uvozi zasebno.

Kada ručni NAZIV opisuje samo jednu varijantu, a zapis je dokazano cela porodica,
ručna odluka `local.<slug>.useOfficialPresentation` daje zapisu zvanični naziv i
opis porodice (adapter menja samo prikaz: naziv, opis, sažetak pakovanja, SEO i
prikazanu šifru). Slug — javni URL — i zapis u `lib/carsystem-data.ts` ostaju.
Primer: `carfit-maskirna-folija-4x5m` → „Car Fit Masking film 7 μm with
electrostatic effect”, tri dimenzije kao varijante.

Zapis bez dokaza (`carfit-maskirna-folija-4x150m`, `LOCAL_ONLY_UNKNOWN`) se ne
briše, ne spaja i ne dobija šifru proizvođača. Model proizvoda nema polje za
poreklo koje ne bi bilo vidljivo kupcu, pa status živi u izveštajima synca
(`reconciliation.generated.json → ourCatalogue.legacyLocal`, `SYNC_DRY_RUN.md`).

## Coverage gate

`npm run carfit:sync:reconcile` poredi zvanični izvor sa STVARNIM runtime
katalogom: A = aktivne naručive porodice, B = zastupljene kod nas, C = aktivne
zvanične šifre, D = zastupljene na pravom proizvodu. Prolaz: `B == A`, `D == C`,
0 duplih aktivnih šifara, 0 duplih slugova, 0 šifara na pogrešnom proizvodu.

## Novo izdanje kataloga / promene na sajtu

Svaki acquire korak prima `--refresh` (bez njega čita keš):

```bash
node scripts/carfit-sync/acquire-website.mjs --refresh
node scripts/carfit-sync/acquire-catalogue.mjs --refresh
npm run carfit:sync:plan        # pokazuje šta je novo i šta traži osvežen SR tekst
npm run carfit:sync:apply && npm run carfit:sync:validate && npm run carfit:sync:reconcile
npm run images:metrics
```

Godina izdanja je samo u `scripts/carfit-sync/lib/config.mjs`.

Zamke: EN tekst je TranslatePress prevod i delom ostaje na nemačkom; proizvođač
piše skraćenice šifara (`3-225-0002/0200/0400/0850`); u PDF-u broj komada ume da
stoji sam u sledećoj liniji, a prelomljen opis da se slučajno završi brojem;
neke PDF tabele nemaju kolonu „Pcs./pack”; flood fill nad slikom iz numpy niza
tiho ne radi bez `.copy()`.
