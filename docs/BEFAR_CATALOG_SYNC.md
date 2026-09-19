# Befar catalog sync

Ponovljiv, idempotentan uvoz celog aktivnog Befar asortimana u naš katalog. Isti
standard kao [Carsystem sync](CARSYSTEM_CATALOG_SYNC.md) i
[C.A.R.FIT sync](CARFIT_CATALOG_SYNC.md); kod je zaseban (`scripts/befar-sync/`)
i od prethodnih synceva koristi samo generičke pomoćnike (`http.mjs`,
`rm-pdf-text.mjs`, korak objave slika, `catalog-runtime.mjs`).

```bash
npm run befar:sync            # acquire → plan → apply → validate → reconcile
npm run befar:sync:acquire    # sajt (EN + TR) + PDF katalog + slike (mreža; --refresh osvežava keš)
npm run befar:sync:plan       # dry run: reports/SYNC_DRY_RUN.md, .json, .csv
npm run befar:sync:apply      # jedini korak koji menja katalog
npm run befar:sync:check      # šta bi apply promenio (idempotentnost = prazna lista)
npm run befar:sync:validate   # sadržaj, slike, runtime
npm run befar:sync:reconcile  # COVERAGE GATE (A/B/C/D)
npm run test:befar-sync
```

Pretraga se proverava nad pokrenutim buildom:
`node scripts/befar-sync/qa-search.mjs http://localhost:3220`.

## Izvori i autoritet

| Izvor | Uloga |
| --- | --- |
| `https://en.befar.com.tr/` | PRIMARNI: šta je danas aktivno i poručivo |
| `https://www.befar.com.tr/` | drugi zvanični svedok (turski original) i kontrola parsera |
| `BEFAR Product Catalog` (PDF, 48 str.) | fabrička pakovanja, legenda tvrdoće, potvrda boje/dimenzije |

Sajt je Wix: 19 stranica u `pages-sitemap.xml`, **bez stranica pojedinačnih
proizvoda**. Proizvodi su blokovi (`ClassicSection`) na 10 stranica kategorija,
a ćelije tabela su zasebni tekstualni elementi raspoređeni CSS mrežom. Parser
(`lib/wix.mjs`) zato čita položaj elemenata, ne HTML tabele. Skup šifara po
stranici mora biti isti u EN i TR verziji — razlika je greška parsera
(`languageCodeMismatches`, trenutno 0).

PDF se ne zadaje ručno: link se otkriva na sajtu (`cataloguePdfLinks`), a RAW
dataset pamti URL, SHA-256, veličinu, broj strana i datum preuzimanja. Katalog
štampa i slovne greške u šiframa (`O9901` umesto `09901`) — čitaju se kao cifra,
a original ostaje u `rawCode`.

Redosled autoriteta: **aktuelni sajt → digitalni katalog → lokalni podaci**.
Ključ spajanja je isključivo zvanična šifra proizvoda.

## Slojevi podataka

| Sloj | Fajl |
| --- | --- |
| RAW sajt | `data/befar-sync/raw/website.generated.json` |
| RAW katalog | `data/befar-sync/raw/catalogue.generated.json` |
| Proizvodi + ukrštanje | `data/befar-sync/source-products.generated.json` |
| Slike (manifest / objavljene) | `image-manifest.generated.json`, `published-images.generated.json` |
| Identitet (append-only) | `data/befar-sync/identity-registry.json` |
| Ručne odluke | `data/befar-sync/manual-decisions.json` |
| Taksonomija | `data/befar-sync/taxonomy-map.json` |
| SR sadržaj | `data/befar-sync/localization/{befar,befar-plus,leo,turkuaz}.json` |
| Dataset sajta | `data/befar-catalog-products.generated.json` → `lib/befar-catalog-products.ts` |
| Izveštaji | `data/befar-sync/reports/` |

Keš mreže (`.cache/befar-sync/`) nije u repozitorijumu.

## Pravila

### Od bloka do proizvoda (P1–P7)

Testirana u `scripts/befar-sync/befar-sync.test.mjs`.

- **P1.** Blok čija kolona „Product” ima različite vrednosti je tabela
  proizvoda: Liquid Compound ≠ Auto Polish ≠ Anti Hologram ≠ Paint Protector.
  Naslov bloka je samo grupa. Isti proizvod u više takvih blokova iste stranice
  je jedan proizvod sa više pakovanja (1000 g + 250 g).
- **P2.** Svaki drugi blok je porodica: redovi su varijante (boja, dimenzija,
  broj rupa), svaka sa svojom šifrom.
- **P3.** Oznaka uz tabelu („Hard Red”, „Soft Orange”, „Premium”) je deo
  identiteta porodice.
- **P4.** Linija je deo identiteta: „Velcro Polishing Pad” linije Befar ≠ isti
  naslov linije Befar Plus.
- **P5.** Blokovi istog identiteta spajaju se kada im se varijante ne sudaraju po
  (boja, dimenzija, rupe) — isti sunđer u više dimenzija.
- **P6.** Isti skup šifara na više stranica je isti proizvod prikazan dvaput.
- **P7.** Boja ispisana uz jedan red je spojena ćelija i važi za celu tabelu
  samo kada je katalog potvrdi (Woolpad: „White”/„Yellow”).

### Linije, ne brendovi

Leo, Befar Plus i Turkuaz su **linije** proizvođača Befar (isti sajt, isti
katalog, iste serije šifara). Liniju određuje logo bloka. `brandSlug` je uvek
`befar`; linija je u polju `line`, u nazivu, bedžu i pojmovima pretrage.

### Setovi

Set sa svojom šifrom (Headlight Cleaning Set, Leo Compound-Polish Set, Leo Mini
Detailing Cleaning Set, Leo Nano Ceramic Paint Protector Set) je zaseban poručiv
proizvod. Ne rastavlja se na komponente; sadržaj se navodi samo ako ga
proizvođač štampa.

### Podloške i brusni pribor

Svaka kombinacija prečnika i broja rupa (7/15/62) je zasebna šifra iste
porodice. „Backing Pad” je na sajtu naveden dvaput, sa oznakama SOFT i HARD, uz
**iste** šifre — to je jedan proizvod, a sporna oznaka se ne prenosi u naziv
(`SAME_CODES_DIFFERENT_QUALIFIER`).

### Konflikti izvora

Beleže se u `source-products.generated.json → conflicts` i u
`reports/MANUAL_DECISIONS.md`. Pravila razrešenja: isti skup šifara = isti
proizvod; engleski naslov koji stoji uz dva proizvoda ispravlja se prema turskom
originalu; kod razlike u dimenziji merodavan je aktuelni sajt, a vrednost iz
kataloga ostaje uz varijantu.

### Samo u katalogu (`CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE`)

Šifre koje postoje samo u PDF-u (katalog je iz avgusta 2024) **ne objavljuju
se**: sajt je merilo aktivnog asortimana. Ostaju popisane po strani kataloga u
`source-products.generated.json → catalogueOnly`.

### Slike

Samo medijska biblioteka befar.com.tr (`static.wixstatic.com`), preuzeta i
objavljena lokalno u `public/products/befar/catalog/` — bez hotlinka, bez slika
distributera. Poštuje se zvanični isečak (crop) sa sajta. **Pozadina se ne
uklanja**: Befar snima bele boce i svetle sunđere na svetlom studijskom
gradijentu, pa automatska maska zahvata i proizvod. Slajd galerije pripada
proizvodu po turskom naslovu slajda; bez tog dokaza proizvodi bloka dele grupnu
fotografiju (`sharedGroupImages`). Slajd sa nazivom boje postaje slika te
varijante; ostali snimci idu u galeriju.

### Boja

Kod Befara boja znači tvrdoću/namenu sunđera, pa je prvo **činjenica
varijante**: uzorak boje, slika boje i legenda tvrdoće iz kataloga („Tvrdoća po
boji”). Boja kartice (`STATED_COLOUR`) dodeljuje se samo kada je materijal
proizvoda jedne jedine, zvanično navedene boje; porodice sa više boja i sva
hemija u ambalaži ostaju `KEEP_BRAND`. Odluke:
`reports/colour-decisions.generated.json`.

### TDS / SDS, cene

Befar ne objavljuje tehničke ni bezbednosne listove ni opise proizvoda. Zapis
nema dokumente, a SR tekst je sveden na zvanične činjenice (naziv, linija,
dimenzije, boje, tvrdoća, pakovanje); `benefits` je prazan. Cene i zalihe se ne
uvoze — „Na upit”.

### SR sadržaj

`LOCALIZATION_GUIDE.md` + `check-localization.mjs`: svaki broj i šifra u tekstu
moraju postojati u ulaznim činjenicama. Unos nosi `sourceHash`; kada se izvor
promeni, tekst je zastareo i proizvod čeka (`HELD_MISSING_LOCALIZATION`) dok se
tekst ne pregleda.

### Ručni zapisi

Zatečenih 8 ručnih Befar zapisa (sunđeri po boji i dimenziji, bez šifara) su
`PROBABLE_MATCH` — svaki odgovara dvema ili trima zvaničnim porodicama. Ne
spajaju se i ne brišu; zvanični proizvodi se uvoze zasebno i nose
`relatedLegacySlugs`. Spajanje je ručna odluka u `manual-decisions.json`.
Dokazi o podudarnosti čitaju se iz ručno pisanog izvora, ne iz runtime-a posle
obogaćivanja (zamka idempotentnosti iz C.A.R.FIT synca).

## Coverage gate

`npm run befar:sync:reconcile` — A (aktivne porodice na sajtu) = B (zastupljene
lokalno), C (zvanične šifre) = D (zastupljene lokalno), uz
`ACTIVE_PRODUCT_MISSING = 0`, `ACTIVE_CODE_MISSING = 0`,
`DUPLICATE_ACTIVE_CODE = 0`, bez siročadi i polomljenih slika.

## Cross-sync determinizam

Izlaz sync-a jednog brenda ne sme da zavisi od proizvoda drugih brendova: plan i
izveštaji ne upisuju nijednu veličinu CELOG runtime kataloga (raniji
`catalogProductsTotalBefore` je zato uklonjen iz Carfit i Befar plana).
`npm run test:sync-determinism` otkriva svaki `scripts/<brand>-sync/` sa
`<brand>:sync:check`, pokreće ga i sa simuliranim „kasnije dodatim proizvođačem”
(`CATALOG_RUNTIME_FOREIGN_PRODUCTS`) i traži da nijedan generisani fajl nijednog
brenda ne bude promenjen.

## Novo izdanje kataloga / promene na sajtu

1. `npm run befar:sync:acquire -- --refresh`, pa `npm run befar:sync:plan`.
2. Pregledati `reports/SYNC_DRY_RUN.md`: novi proizvodi, nove šifre, konflikti,
   zastareli SR tekstovi.
3. Dopuniti `localization/*.json` (ulaz je u `.cache/befar-sync/localization-input/`).
4. `npm run befar:sync:apply`, `npm run images:metrics`, `npm run befar:sync`.
5. Slug je trajan: čita se iz registra po šifri, pa preimenovanje bloka na sajtu
   ne menja URL. Registar se ne briše.
