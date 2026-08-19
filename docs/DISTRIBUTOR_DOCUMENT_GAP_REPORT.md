# Distributor Document Gap Report

Covers Carfit, SATA, RUPES, Autofit — the brands explicitly grouped together
in this phase's brief. Cosmos LAC, baslac, R-M, Norbin, Befar each have
their own dedicated `docs/*_DOCUMENT_SOURCE_MAP.md`.

| Brand | Available source material | Published documents | Missing documentation | Recommended future acquisition | Confidence |
|---|---|---|---|---|---|
| **Carfit** | Two tiers: (1) `CARFIT-FINAL-2026.pdf`, the official 2026 catalogue, supplied directly this session; (2) 302 files (109 TDS, 185 SDS, 1 older catalogue) already scraped from carfitrepair.com and staged at `assets/manufacturer/carfit/documents/`, fully hashed and resolved to products (`docs/seo/CARFIT_DOCUMENT_RESOLUTION_REPORT.md`: 216 EXACT_PRODUCT matches, 38 unresolved) | **1** — `carfit-catalogue-2026` (`BrandDocument`, featured, rail added to `CarfitBrandPage.tsx`). The 302-file scraped set is **not** published — same `published: false` / unconfirmed-rights status as Norbin's set (both trace back to August Handel GmbH via `docs/CONTENT_PROCUREMENT_PLAN.md`); the fresh catalogue you handed over directly is a distinct, clearly-authorized artifact and was treated accordingly | The 302 individual TDS/SDS remain unpublished pending the same rights confirmation Norbin needs | If rights are confirmed for the scraped set, follow the same publish path used for baslac's guides this phase (copy → cover → `BrandDocument` entries → wire into existing `dokumentacija` section or the new katalozi rail) | High — the catalogue is unambiguous; the gap on the TDS/SDS set is a known, already-documented rights question, not new information |
| **SATA** | None found. No entry in any `scripts/acquire-*`/`extract-*`/`match-*` pipeline, no `assets/manufacturer/sata/`, no `public/documents/*sata*`, no `public/brands/sata/` subfolder (only `public/brands/sata.svg`, a logo) | 0 | Entire document set — TDS, SDS, spray-gun manuals, everything | Contact SATA (spray-gun equipment manufacturer) directly for product literature; note SATA renders through the **generic** `<BrandPage>` fallback (`app/brendovi/[slug]/page.tsx`) — it has no bespoke page component the way Carfit/Cosmos/baslac/Norbin/Befar/R-M/Carsystem do, so a document rail can't be added to it without first building a dedicated page, which is out of this phase's scope | High confidence that nothing exists — this was a direct, unambiguous repo/asset search, not an inference |
| **RUPES** | None. Not even a real brand page exists — `rupes` is a `status: "placeholder"` entry in `lib/carsystem-data.ts`'s `futureBrands[]` (line ~462), never passed to `getCarsystemBrandBySlug`, so `/brendovi/rupes` 404s today | 0 | Entire document set, and the page itself | Not a documents task — RUPES needs a real brand page built first (separate phase); until then there's nowhere on the site to link a document even if one existed | High — confirmed via the dynamic route dispatch logic and `futureBrands[]`, not guessed |
| **Autofit** | Same as RUPES — `futureBrands[]` placeholder only, no page, no data, no assets | 0 | Entire document set, and the page itself | Same as RUPES: build the brand page first | High |

## What this means for `/katalozi`

`lib/documents.ts`'s `getDocumentBrandSlugs()` only returns brands with at
least one `public: true` entry, so the brand-filter chip row on `/katalozi`
automatically shows **Carfit** now (alongside the existing Carsystem, plus
Cosmos LAC and baslac added this phase) and silently omits SATA/RUPES/Autofit
— no empty or broken filter chips, no code change needed for that behavior,
it was already built correctly in the prior phase.

## Explicitly not done

- No SATA/RUPES/Autofit brand pages were built — out of scope for a
  document-library phase.
- No attempt was made to scrape sata.com or any RUPES/Autofit source —
  the brief is clear that fabricating documents (or treating scraped HTML
  as a substitute PDF) is prohibited, and no legitimate source was found to
  scrape from in the first place.
