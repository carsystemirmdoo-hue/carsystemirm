# Revizija kataloga 2026-09-22

Odluka vlasnika: uklanjanje iz customer-facing programa, direct-to-PDP za porodice i konsolidacija
identiteta slika. Ovaj dokument beleži šta je promenjeno, šta je namerno ostavljeno i koji su
nalazi validatora **zatečeni**, da se kasnije ne bi pročitali kao posledica ove izmene.

## 1. Uklonjeno iz kataloga — 21 kartica

Izvor istine: [`data/catalog/removed-from-customer-catalog.json`](../../data/catalog/removed-from-customer-catalog.json).
Isti fajl filtrira runtime (`lib/carsystem-data.ts`) i gradi 308 preusmerenja (`next.config.ts`),
pa adresa ne može da ostane bez odredišta.

| Status | Šta znači | Zapisa |
|---|---|---|
| `BUSINESS_OUT_OF_PROGRAMME` | Firma ga više ne drži u programu. **Nije** tvrdnja da ga proizvođač više ne pravi. | 18 |
| `INVALID_MANUAL_RECORD` | Ručni zapis bez potvrđenog identiteta kod proizvođača. | 3 |

Obuhvata SATA respiratorni program (5 roditelja + 11 pribora sa `functionalClass: RESPIRATOR_AIR_SUPPLY`),
SATA LCS Hard Cups, Carsystem P19 i P23, Carsystem Soft Plus git i C.A.R.FIT foliju 4 × 150 m.

**Namerno zadržano** (provereno testom `lib/catalog/catalogRevision2026.test.mjs`): procesni filteri
za pripremu vazduha i boju (SATA serije 100/200/400/500, mini filter, strainer holder, filter cover,
high-flow coupling, Carsystem PG/FG fine filter), zaštitna odeća i ceo masking program.
Respiratorna maska i maskirna folija nisu ista kategorija.

Provenance ostaje: sync dataseti zadržavaju svaki zapis, a `carsystem-soft-plus-git` se vraća u
legacy bazen u `lib/carsystem-data.ts`.

## 2. Direct-to-PDP

Kartica porodice vodi pravo na PDP sa desnim selektorom varijanti — bez međukoraka sa mrežom članova.
Osam Cosmos Lac porodica (43 člana) prevedeno je iz `collection` u `variant-pdp`; adresa
`/proizvodi/grupa/<slug>` je ostala ista, pa nema nijednog novog preusmerenja.

Tri porodice ostaju `collection` kao `COSMOS_VARIANT_KEY_COLLISION_FOLLOWUP`
(`DEFERRED_VARIANT_PDP_FAMILIES` u `lib/product-families.ts`): više boja deli isti zvanični kod, pa
bi im `?varijanta=` adrese bile identične. Test traži da odlaganje ostane opravdano — kada ključevi
postanu jedinstveni, obara build dok se unos ne ukloni.

Ukupan broj sudarajućih parova (kartica, ključ varijante) je **15, isto kao pre revizije**.

## 3. Identiteti slika

- baslac linije tonera: 10 identiteta po pakovanju → 4 identiteta serije (jedna slika po liniji).
- R-M: dve grupe istog naziva (`GHD THINNER`, `GHD HARDENER`) dele jednu reprezentativnu sliku
  (`data/catalog/image-supply/shared-image-groups.json`). Deli se samo slika; slug, naziv, šifra,
  SKU, pretraga i PDP ostaju odvojeni i porodica se ne pravi.

Manifesti se prave komandom `npm run catalog:image-supply:generate`; detalji su u
[`FINAL_IMAGE_AUDIT.md`](FINAL_IMAGE_AUDIT.md).

## 4. `PRE_EXISTING_SEARCH_VALIDATION_DEBT`

Dva validatora pretrage su crvena i **bila su crvena pre ove revizije**. Nisu popravljana ovde:
to je zaseban zadatak o rangiranju i pojmovima pretrage, van opsega ove izmene. Izmereno stvarnim
buildom obe verzije, na istom serveru i istoj komandi.

| Validator | Baseline `621cbad` | Posle revizije | Ocena |
|---|---|---|---|
| `scripts/validate-search-deltas.mjs` | 695 grešaka, od toga **691 × „600 ml"** | isti nalaz, 691 × „600 ml" | bez regresije |
| `scripts/validate-catalog-search-index.mjs` | 1 greška: `purpose` se pojavljuje **2×** | isto: `purpose` 2× | bez regresije |

Ovo **nije PASS.** Od 691 pogođenog zapisa samo 19 dolazi iz osam novomigriranih porodica; 583 su iz
porodica koje su i pre bile `variant-pdp`, a 89 nije ni u jednoj porodici — dakle obrazac postoji
nezavisno od ove izmene. Broj grešaka nije povećan.

Preostala tri validatora kataloga (`validate-catalog-listing`, `validate-product-identity`,
`validate-catalog-payload`) prolaze.

## 5. Zatečeno, a popravljeno usput

Sedam `relatedProductSlugs` referenci na nepostojeće proizvode postojalo je i na baseline-u
(`norbin-n15-020`, `baslac-900-basecoat`, `carsystem-abraziv-p80-p2000`,
`carsystem-excenter-back-pad-t19`). Popravljene su jer revizija traži **0 dangling referenci**:
dokazive greške su preusmerene (`…-back-pad-t19` → `…-back-pad-t-19`), a veze bez naslednika uklonjene.
Norbin `usedBy` koji pokazuje na bazni slug porodice se ne prikazuje dok sync ne počne da upisuje
slug pakovanja.
