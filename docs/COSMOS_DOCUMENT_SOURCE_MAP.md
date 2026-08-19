# Cosmos LAC Document Source Map

Source: `ENG_Catalogue2022_FINAL_DIGITAL USE.pdf`, supplied directly 2026-08-15.
42 pages, English, created 2022-10-04 (Adobe InDesign 17.3, Macintosh).
Classification: **MASTER_CATALOG**.

Published to: `public/documents/cosmos-lac/catalogs/cosmos-lac-catalogue-2022.pdf`
Cover: `public/brands/cosmos-lac/documents/cosmos-lac-catalogue-2022-cover.webp`
(page 1 render — an abstract cropped monogram + "Product catalogue", the
catalogue's actual official cover design, not a rendering artifact)
`BrandDocument` id: `cosmos-lac-catalogue-2022`, `featured: true`.

## Why this is treated as SOURCE FACT, not extracted claims

Per `docs/seo/COSMOS_QUALITY_PASS_REPORT.md` (existing, pre-dating this
session), the Cosmos LAC product-matching pipeline (`match-cosmos-products.mjs`)
already extracted 3,323 claims from **live product pages** at cosmoslac.com —
not from this catalogue — and matched 637 of 742 products against our local
catalog. That work stands; this session does not repeat it. This catalogue
PDF is used here only as:

1. an official downloadable document (the "Preuzmi katalog" action on
   `/katalozi` and the Cosmos brand page);
2. structural/portfolio validation — confirming the colour-line taxonomy
   already reflected in `lib/cosmos-lac-brand-data.ts` matches the
   manufacturer's own catalogue structure;
3. source traceability for the colour-line list surfaced in the document
   card's `categories` field.

No new product records were created and no existing product claim was
overwritten from this PDF.

## Portfolio structure confirmed against the catalogue

Table of contents (p. 3, p. 6) — colour lines with their printed page:

| Colour line | Page | Cross-check vs. `cosmosFamilies` (existing site data) |
|---|---|---|
| RAL | 14 | Present — RAL confirmed 48 shades in-catalogue (p. 8: "Shades: 48, Content: 400ml & 500ml, Package: 6 pcs"), matches the site's existing RAL family entry |
| Fast Acrylic | 18 | Present in site data |
| Easy Max | 24 | Present in site data |
| Spray.Bike | 28 | Present in site data |
| Chalk Effect | 34 | Present in site data |
| Flame | 38 | Present in site data |
| Special Use (High Heat, Primers, Varnishes, Zinc, Lubricants, Automotive, Wheel Rim, Home, Cleaners, Effect, Metallic Effect, Fluorescent/Marking) | 54+ | Category-level match — these appear as `cosmosApplications`/broader use-case groupings in existing site data rather than as named "families," consistent with the catalogue's own "Special Use" grouping being use-case-driven rather than a colour-line |

No conflicts found between the catalogue's stated structure and the existing
site's `cosmosFamilies` data — the catalogue corroborates rather than
contradicts what's already published.

## Existing website coverage vs. this document

- **Covered**: all 6 primary colour lines (RAL, Fast Acrylic, Easy Max,
  Spray.Bike, Chalk Effect, Flame) already have dedicated presentation on
  the Cosmos brand page (`CosmosFamilyRail`, `CosmosRange`) and in the
  product catalog (637 matched products per the existing acquisition report).
- **Not individually covered**: the granular "Special Use" sub-lines (High
  Heat 700°C, Zinc, Lubricants, Wheel Rim, Fluorescent/Marking, etc.) are not
  broken out as distinct site categories — they exist in the catalogue (p.
  54+) but the site currently presents Cosmos LAC through 6 headline families
  plus application-based finders, not a 1:1 mirror of every catalogue
  sub-section. This is a deliberate platform taxonomy choice already in place
  (`cosmosFamilies`), not a gap introduced by this phase.

## Items requiring review

- Pages 54+ ("Special Use") were sampled, not read exhaustively page-by-page
  in this pass — if a future phase wants to expose these as their own
  filterable categories, a dedicated read-through is needed.
- Catalogue is dated 2022; `cosmosCounts`/`cosmosFamilies` in the live site
  may already reflect newer SKUs added since. No numeric count in
  `lib/cosmos-lac-brand-data.ts` was changed based on this PDF — it remains
  the pre-existing, independently maintained source of truth for counts.

## Conflicts

None identified.
