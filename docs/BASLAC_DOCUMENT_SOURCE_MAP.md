# baslac Document Source Map

baslac is digital-first: no single master catalogue exists or was supplied.
Source material is 102 individual PDFs already published under
`public/documents/products/baslac/` by an earlier session's
`scripts/acquire-baslac-documents.mjs` (Phase 5, `docs/seo/PHASE5_BRAND_ACQUISITION_REPORT.md`).
Those files were never wired into any page — this phase is the first time
any of them become reachable from the live site.

## Classification pass

Splitting the 102 files by filename pattern showed two genuinely different
kinds of document:

- **87 files** are per-SKU technical data sheets, named by product code
  (`20-24.pdf`, `20-24_variant_50-05.pdf`, `27-10.pdf`, …). These describe one
  product/variant each. **Not published to `/katalozi`** — a brand-level
  document library is not the right home for 87 near-duplicate per-SKU
  sheets; see "Missing coverage" below for where they actually belong.
- **15 files** are brand/system-level technical guides — not tied to one
  SKU, useful on their own (Gloss Levels, Grey Shades comparison charts,
  Plastic Repair System VOC/Non-VOC, Chrome Silver System, Carbon Fibre
  System, Spray Guns, Temperature Charts, Mazda 51K process charts,
  Cleaners). **These are the ones published** — see table below.

## Published documents

All 15 copied (not moved — originals left untouched at
`public/documents/products/baslac/`) to `public/documents/baslac/guides/`
with generated covers at `public/brands/baslac/documents/`.

| `BrandDocument` id | Title | Type | Pages | Featured |
|---|---|---|---|---|
| `baslac-chrome-silver-system` | System Chrome Silver | technical-guide | 1 | ✓ |
| `baslac-plastic-repair-system-voc` | Plastic Repair System (VOC) | family-brochure | 3 | ✓ |
| `baslac-plastic-repair-system-non-voc` | Plastic Repair System (Non-VOC) | family-brochure | 3 | |
| `baslac-plastic-metallic-repair` | Plastic Metallic Repair | technical-guide | 1 | |
| `baslac-carbon-fibre-repair` | System Carbon Fibre | technical-guide | 1 | ✓ |
| `baslac-gloss-levels` | Gloss Levels — Mat Finish | technical-guide | 2 | |
| `baslac-cleaners` | Cleaners | technical-guide | 1 | |
| `baslac-spray-guns` | Recommended Spray Guns | technical-guide | 3 | |
| `baslac-temp-chart-voc` | Temperature Chart — VOC Clears | technical-guide | 1 | |
| `baslac-temp-chart-non-voc` | Temperature Chart — Non-VOC Clears | technical-guide | 1 | |
| `baslac-grey-shades-20-24-34-94` | Grey Shades — 2K Primerfiller 20-24/-34/-94 | technical-guide | 1 | |
| `baslac-grey-shades-20-35-95` | Grey Shades — 2K Primerfiller 20-35/-95 | technical-guide | 1 | |
| `baslac-mazda-51k-standard-process` | Mazda 51K — Standard Process | process-guide | 2 | |
| `baslac-mazda-51k-blend-in-process-1` | Mazda 51K — Blend-In Process (1) | process-guide | 3 | |
| `baslac-mazda-51k-blend-in-process-2` | Mazda 51K — Blend-In Process (2) | process-guide | 2 | |

4 featured on the baslac brand page rail (Chrome Silver, Plastic Repair
System VOC, Carbon Fibre, plus the catalogue equivalent doesn't exist for
baslac — no master catalogue, so featured slots are filled by the strongest
system guides instead).

## Historical/current brand attribution — SOURCE FACT, preserved as-is

Every sampled PDF footer reads: *"BASF Coatings GmbH, Automotive Refinish
Coatings Solutions, Europe, Glasuritstraße 1, 48165 Münster, Germany — A
brand of [BASF]"*, dated 02/2025–04/2024 on the samples checked. This predates
the 1 July 2026 BASF Coatings → Surventis carve-out referenced in Norbin's
research. Per instruction, this session does **not** rewrite that footer
attribution or silently relabel baslac as a Surventis brand anywhere in the
new copy — the PDFs are represented exactly as published, and the
`BrandDocument` descriptions written for them don't assert a company name
either way. If baslac's current corporate attribution needs updating
site-wide, that's a separate, deliberate decision — not something to infer
from a document's own historical footer.

## Missing coverage / follow-up

**Status kada je ova faza pisana:** svih 87 per-SKU listova bilo je bez ijedne
veze — zero referenci na `documents/products/baslac/` u `lib/carsystem-data.ts`,
svaki baslac proizvod na `status: "placeholder"`.

**Ažurirano:** per-SKU wiring je od tada urađen i dokumentovan u
`docs/BASLAC_PDP_DOCUMENT_MAP.md`. Rezultat: **1 od 87** listova je povezan
(`60-20.pdf` → `baslac-60-20-razredjivac`, tačna oznaka artikla). Preostalih 86
nije blokirano matchingom nego katalogom — javni model ima četiri baslac
proizvoda, a tri od njih nose mixing oznake (`35-M214`, `35-M331`, `30-S510`)
za koje postoji samo tehnički list linije, ne artikla. Klasifikacija svakog
kandidata i otvorena pitanja su u tom dokumentu.

## Product matching

Not applicable — these are system/technical guides, not product catalogues,
so there's no product-code list to match against SKUs the way Carfit/Cosmos
were matched.

## Conflicts

None identified.
