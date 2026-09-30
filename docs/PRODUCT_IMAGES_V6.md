# V6 slike proizvoda

Status: **INTEGRISANO sa tamnom temom** (grana `integration/dark-theme-v6-2026-09`, 2026-09-30). Sačuvana
istorija: `feat/product-images-v6-preservation` (V6) i `feat/dark-theme-reconstruction` (tamna tema).

## Šta sadrži

- V6A — fit po subjektu: `scripts/extract-product-image-metrics.py` dodaje samo Carsystem polja
  (`subjectBox`, `subjectAspect`, `subjectCenter`, `fitModelVersion`, `officialShadow`); `box`/`aspect` se ne menjaju.
  Opseg (`SUBJECT_FIT_PREFIXES`): Carsystem originali i njihovi pregledani derivati za prikaz
  (`/remastered/products/carsystem/…`, tamna tema) — površine crtaju derivat, pa se V6 meri na njegovim pikselima.
  Override (`OFFICIAL_SHADOW_OVERRIDES`) je vezan za putanju originala i važi i za njegov derivat.
- V6B — tačno jedna senka: opt-in atributi `data-product-fit-model` / `data-product-shadow-model="v6"`
  (`lib/productFitModel.mjs`, server-only `lib/product-fit-model.ts`). Odluka se čita sa fajla koji se crta
  (`toDisplayImageSrc`), na kartici (`withProductFitModel`) i na PDP sceni (`toProductStageImage`).
  U tamnoj temi V6 ne vraća svetao obris siluete; `thin`/`unknown` je ista tamna senka, slabija.
- Gate senke: **jedna** implementacija stanja učitavanja — `components/product/productImageLoadState.mjs`
  (`loading → loaded | failed`, čeka `decode()`, pamti dekodirane adrese, generacija protiv zastarelih događaja).
  React je dobija samo kroz `components/product/useProductImageLoadState.ts` (tanak adapter, layout efekat,
  stanje vezano za `src`). Isto stanje koriste tamna tema („Vizuel u pripremi" za `failed`) i V6 senka
  (skrivena dok slika nije `loaded`, nikad za `failed`).
- Vlasnikov ograničeni reopen PDP-a: `docs/PAGE_LOCK_STATUS.md` („Reopen 2026-09-21”). V6C i pilot „enhanced”
  asseti NISU odobreni.

## Regeneracija

`npm run images:metrics` → `node scripts/catalog/image-remaster/matte-report.mjs` →
`node scripts/catalog/image-remaster/report.mjs --check` → `npm run catalog:image-supply:generate`.
