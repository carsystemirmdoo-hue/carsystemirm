# Befar Document Source Map

## Finding: zero downloadable documents exist for Befar

Confirmed twice, independently, by prior research this session did not
redo:

- `docs/BEFAR_ASSET_INVENTORY.md` — line ~151: *"Technical data sheets,
  SDS: None published"*, after cataloguing ~330 image assets from
  `befar.com.tr` / `nargildisticaret.com` (44 selected into
  `public/brands/befar/**` as `.webp` images only).
- `docs/BEFAR_BRAND_RESEARCH.md` / `docs/BEFAR_CARSYSTEM_ASSORTMENT.md` —
  Befar's manufacturer was only recently identified; the only "acquisition"
  script that exists (`scripts/extract-befar-stock-evidence.py`) parses an
  **internal Carsystem ERP stock report**, not a manufacturer document, to
  confirm which article codes are actually live — it produces no publishable
  PDF.

## Sources checked (this phase)

- `assets/manufacturer/` — no `befar/` subfolder exists (the pattern used
  for Carfit/Cosmos/Norbin was never applied to Befar because there was
  nothing to scrape a document from).
- `public/documents/` — no `befar/` subfolder.
- Downloads/Desktop — no Befar-branded PDF present at any point in this
  phase or the prior Carsystem-only phase.

## Why nothing was published

There is no official Befar TDS, SDS, brochure, or catalogue anywhere in this
repository or supplied by you. Per this phase's explicit instruction, that
is an acceptable, honest state — **not** a reason to scrape the Befar
website into a fabricated PDF, generate a synthetic "catalogue" from image
assets, or otherwise invent documentation that doesn't exist. `/katalozi`
already handles this gracefully: `getDocumentBrandSlugs()` only returns
brands with at least one `public: true` entry, so no "Befar" filter chip
appears at all, and no empty/broken rail was added to the Befar brand page.

## Available materials (image-only, already in use, unrelated to this phase)

44 curated product/brand images live at `public/brands/befar/**`, already
used by `BefarBrandPage.tsx`'s existing sections (Material, Geometry,
Pairing, Families, OpenCell, Detail, InUse, Products). Not documents, not
touched by this phase.

## Recommended acquisition

Contact the Befar manufacturer directly for TDS/SDS/catalogue material. No
amount of further scraping or repo archaeology will produce it — it's
confirmed absent, not merely un-found.

## Product matching

Not applicable — no documents to match against products.

## Conflicts

None.
