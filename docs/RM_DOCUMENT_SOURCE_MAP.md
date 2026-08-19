# R-M Document Source Map

## Finding: no brand-level document exists to publish

R-M does not get a `/katalozi?brand=rm` entry in this phase. This is a
genuine finding, not an oversight — see below.

## What was checked

1. **Existing `assets/manufacturer/` staging** — none for R-M; the newer
   scraping pipeline pattern (`acquire-*-catalog.mjs` used for
   Carfit/Cosmos/Norbin) was never built for R-M.
2. **`public/documents/products/rm/`** — 59 product folders, 117 PDFs
   (`rm-<slug>-product-information.pdf` + `rm-<slug>-technical-data-sheet.pdf`
   per folder), imported by an older, already-completed pipeline
   (`scripts/import-rm-products.mjs`, sourced from
   `~/Desktop/Proizvodi.zip` — still present on disk, 64 per-product
   subfolders, no brand-level file among them).
3. **Folder-name scan for anything system-level** (not per-SKU) — searched
   for `agilis`, `refinity`, `infinity`, `system`, `overview`, `guide` in
   the 59 folder names. Every hit was itself a per-product folder (e.g.
   `2220-agilis-activator`, `2530-agilis-blender` — individual Agilis-system
   *products*, not an Agilis system *overview document*). No brand-level PDF
   exists in the source zip or on disk.
4. **`docs/seo/RM_SOURCE_INVENTORY.md`, `RM_EXTRACTION_METHOD.md`,
   `PHASE3_EXTRACTION_REPORT.md`** (existing, pre-dating this session) —
   confirm the same 117-document set, used there for claims extraction
   (58/59 products matched exactly), not for a document library.

## Conclusion

R-M's 117 published PDFs are **100% per-SKU technical documentation**, no
different in kind from baslac's 87 per-SKU sheets (see
`docs/BASLAC_DOCUMENT_SOURCE_MAP.md`) — except R-M has no brand/system-level
document mixed in at all. A document library entry needs to represent
something a visitor would deliberately browse to (a catalogue, a system
guide, a campaign brochure); a lone product's TDS isn't that — it belongs on
that product's own page.

## Coverage — ISPRAVLJENO

Ranija verzija ovog dokumenta tvrdila je da su „svih ~120 PDF-ova orphaned".
**To nije tačno u runtime-u i tvrdnja je ovde ispravljena.**

Odakle je greška došla: provera je grepovala samo `lib/carsystem-data.ts`. R-M
dokumenti ne prolaze kroz taj fajl. Idu kroz generisani import put:

```
data/rm-imported-products.generated.json   (documents.productInformation / .technicalDataSheet)
  → lib/rm-imported-products.ts            (getLegacyDocuments, status: "available")
  → lib/carsystem-data.ts                  (...rmImportedProducts u productRecords)
  → app/proizvodi/[slug]/page.tsx          (PDP)
```

Grep po `carsystem-data.ts` zato nikad nije mogao da vidi te veze.

Takođe je pogrešan i navedeni dokaz: `lib/carsystem-data.ts:683-699` nije
`2210-onyx-activator`, nego placeholder blok legacy zapisa
`rm-diamont-bazna-boja`. `2210-onyx-activator` uopšte nije definisan u tom
fajlu.

Stvarno stanje, izmereno:

| Provera | Rezultat |
| --- | --- |
| Uvezenih R-M proizvoda | 59 |
| Proizvoda sa dokumentima na PDP-u | 59 (100%) |
| Product Information PDF-ova | 59 |
| Technical Data Sheet PDF-ova | 58 (`hb-032-hydromix` nema TDS u dostavljenom folderu) |
| Jedinstvenih fajlova povezanih | 117 |
| PDF-ova na disku u `public/documents/products/rm/` | 117 |
| Fajlova bez ijedne veze | **0** |
| Href-ova koji ne postoje na disku | **0** |

Reprodukcija: `npm run rm:validate` i `npm run documents:validate`.

## Preostali gap — pet legacy zapisa

Wiring iz uvoza pokriva 59 proizvoda. Pet R-M zapisa nastalo je van tog
pipeline-a, ručno u `lib/carsystem-data.ts`, i ostaje bez dokumenata:

| Slug | Oznaka | Zašto nema dokument |
| --- | --- | --- |
| `rm-diamont-bazna-boja` | `RM-DIA-BASE` | Nije artikal nego prikaz DIAMONT sistema (0.5/1/3.5 L, „toneri i pomoćni materijali"). Dostavljena arhiva nema DIAMONT basecoat list — nema ni jedan artikal na koji bi se odnosio |
| `rm-diamont-bezbojni-lak` | `RM-DIA-CLEAR` | Isto, na nivou sistema. Bezbojni lakovi u arhivi su konkretni artikli (`C 2E50`, `C 2E10`, `C 2Pxx Finish-R`) i svaki već ima sopstvenu stranicu sa svojim listom |
| `rm-body-filler-white-b-2e11` | `B 2E11` | Nije u dostavljenoj arhivi. Jedini bodyfiller je `B 2P93 UV Bodyfill-R` — drugi artikal |
| `rm-pasta-190-1l` | `RM-PASTA-190-1L` | Arhiva nema nijedan polishing artikal |
| `rm-pasta-190-5l` | `RM-PASTA-190-5L` | Isto |

Za nijedan od pet ne postoji `EXACT` ni `HIGH CONFIDENCE` kandidat, pa nijedan
nije povezan. Detaljna analiza po proizvodu je u istom pasusu izveštaja ovog
zadatka; ono što traži ljudsku odluku:

- Prva dva zapisa su **sistemske stranice, ne artikli**. Pitanje nije koji
  dokument dodati, nego treba li DIAMONT da bude family stranica koja upućuje
  na svoje artikle.
- `B 2E11` traži da se dokument nabavi — nije bio u `Proizvodi.zip`.
- Kod obe paste alt tekst slike glasi „R-M DIAMONT BC 190" odnosno
  „R-M DIAMONT BC 605", što su oznake **baznih boja**, a ne pasta za poliranje.
  Naziv, kategorija i slika se ne slažu; to je product-data pitanje, ne
  dokumentaciono, i nije menjano ovde.

## Product matching

Not applicable to this phase's scope (no new document was published). The
per-product matching for R-M's existing PDFs was already done implicitly by
`import-rm-products.mjs` (folder name = product slug, 1:1, no ambiguity).

## Conflicts

None identified.
