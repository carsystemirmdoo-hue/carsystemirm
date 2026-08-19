# Norbin Document Source Map

## Finding: material exists but is rights-gated — not published in this phase

You confirmed (2026-08-15, in response to a direct question during this
phase) to **leave the rights gate in place**. Norbin gets zero
`/katalozi?brand=norbin` entries this round. This is a deliberate decision,
not a gap in effort.

## What exists

A prior session's scraping pipeline (`scripts/acquire-norbin-documents.mjs`,
sourced from static `norbin-paint.com` region pages) already produced:

- **99 files** staged at `assets/manufacturer/norbin/documents/` — 8 EMEA
  TDS (English), ~72 SDS, 1 brochure, 1 poster (counts per
  `docs/NORBIN_ASSET_GAP.md` and `docs/seo/NORBIN_ACQUISITION_REPORT.md`).
- A full per-product-code document matrix in `docs/NORBIN_PRODUCT_INVENTORY.md`
  §7, cross-referenced against actual ERP stock: we carry 8 of 13 EMEA
  product codes (not "1 of 13" as an earlier, shallower pass had estimated).
- Product matching already done: 2 exact-code matches, 1 ambiguous, of our 3
  local Norbin SKUs (`docs/seo/NORBIN_ACQUISITION_REPORT.md`).

**None of this was produced by, or verified by, this session.** It's cited
here for traceability, not re-validated.

## Why it's gated

`docs/CONTENT_PROCUREMENT_PLAN.md` (existing, pre-dating this session)
states explicitly: *"no license/rights file exists anywhere in the repo"*
for material staged under `assets/manufacturer/`. Every acquisition report
for the scraped-document pipelines (Carfit, Carsystem's newer set, Norbin)
marks its output `published: false` pending rights confirmation. This is a
deliberate safety gate a prior session put in place specifically to prevent
scraped manufacturer TDS/SDS from being republished on our production site
without confirmed redistribution rights — publishing it without that
confirmation would be undoing someone else's careful legal caution on my own
authority, which this phase does not have grounds to do.

## Ownership/brand context — kept separate from document content

Per your original instruction: BASF Coatings completed its carve-out to
Surventis on 1 July 2026. **This does not retroactively change what any
existing Norbin PDF says.** If/when Norbin documents are published, their
historical attribution (whatever company name appears in each PDF's own
footer, as of its own publication date) must be preserved as printed —
consistent with how `docs/BASLAC_DOCUMENT_SOURCE_MAP.md` handles the same
BASF/Surventis timing issue for baslac's PDFs. No Norbin PDF content was
read, rewritten, or modernized in this phase since none was published.

## Recommended path to publish

1. Obtain and record an explicit rights/license confirmation from
   norbin-paint.com's current operator (post-carve-out entity) — a real file
   in the repo, not an inference.
2. Once confirmed, the 99 staged files can move from
   `assets/manufacturer/norbin/documents/` into the established
   `public/documents/norbin/{brochures,guides}/` structure, following the
   exact pattern this phase used for Carfit/Cosmos/baslac (copy, generate
   cover, add `BrandDocument` entries, add a rail to `NorbinBrandPage.tsx`
   — which already has a static, unwired `DocumentationSection()` at
   `components/norbin-brand/NorbinBrandPage.tsx:411-448` that a real rail
   should sit alongside, not inside).
3. Alternative: you supply official Norbin PDFs directly (as you did this
   round for Carfit and Cosmos LAC) — that's an unambiguous authorization
   signal and skips the rights question entirely.

## Product matching

See `docs/seo/NORBIN_ACQUISITION_REPORT.md` (existing) — not repeated here.

## Conflicts

None identified. No new content was published, so none could be introduced.
