# SEO fajlovi

Ovaj spisak obuhvata fajlove dodate ili ciljano izmenjene u SEO implementaciji. Radno stablo je pre početka sadržalo druge, korisničke UI izmene; one nisu pripisane ovom spisku.

## Centralni SEO i routing

- lib/seo.ts
- lib/seo/site-config.ts
- lib/seo/route-policy.ts
- lib/seo/metadata-builders.ts
- lib/seo/category-landings.ts
- lib/seo/product-breadcrumbs.ts
- middleware.ts
- next.config.ts
- package.json

## App rute

- app/layout.tsx
- app/page.tsx
- app/not-found.tsx
- app/robots.ts
- app/sitemap.ts
- app/katalog/page.tsx
- app/katalog/strana/[page]/page.tsx
- app/kategorije/[slug]/page.tsx
- app/brendovi/page.tsx
- app/brendovi/[slug]/page.tsx
- app/program/page.tsx
- app/program/[slug]/page.tsx
- app/proizvodi/[slug]/page.tsx
- app/prodavnice/page.tsx
- app/kontakt/page.tsx
- app/site-u-pripremi/page.tsx
- app/interaction-demo/layout.tsx
- app/preview/layout.tsx
- app/social-exports/layout.tsx

## Komponente

- components/seo/SeoBreadcrumbs.tsx
- components/seo/SeoBreadcrumbs.module.css
- components/catalog/CatalogHeroSearch.tsx
- components/catalog/CatalogSeoContent.tsx
- components/catalog/CatalogPage.tsx
- components/catalog/CatalogPage.module.css
- components/catalog/CatalogExplorer.tsx
- components/categories/ProductCategoryGrid.tsx
- components/contact/ContactPage.tsx
- components/contact/ContactQueryForm.tsx
- components/layout/Footer.tsx
- components/layout/Header.tsx
- components/product/ProductDetailPage.tsx
- components/stores/StoresPage.tsx
- components/stores/StoreLocator.tsx
- components/rm-brand/RmBrandPage.tsx
- components/rm-brand/RmCampaignStage.tsx
- components/rm-brand/RmCampaignStage.module.css

## Skripte i asseti

- scripts/seo-audit.mjs
- scripts/validate-seo.mjs
- scripts/seo-performance-audit.mjs
- scripts/generate-rm-og-images.mjs
- scripts/generate-seo-report-docs.mjs
- scripts/capture-seo-evidence.mjs
- public/images/og/products/rm/*.jpg (59 fajlova)

## Dokumentacija i izveštaji

- docs/seo/SEO_AUDIT_BEFORE.md
- docs/seo/SEO_ROUTE_INVENTORY.csv
- docs/seo/SEO_METADATA_BEFORE.csv
- docs/seo/SEO_ISSUES_BEFORE.json
- docs/seo/SEO_AUDIT_AFTER.md
- docs/seo/SEO_METADATA_AFTER.csv
- docs/seo/SEO_ISSUES_AFTER.json
- docs/seo/SEO_BEFORE_AFTER.md
- docs/seo/SEO_CANONICAL_MAP.csv
- docs/seo/SEO_INDEXATION_MATRIX.md
- docs/seo/SEO_FILTER_POLICY.md
- docs/seo/SEO_PDF_INDEXATION.md
- docs/seo/SEO_INTERNAL_LINK_REPORT.md
- docs/seo/SEO_LOCAL_BUSINESS_AUDIT.md
- docs/seo/SEO_KEYWORD_INTENT_MAP.csv
- docs/seo/SEO_CANNIBALIZATION_REPORT.md
- docs/seo/SEO_REDIRECT_MAP.csv
- docs/seo/SEO_IMAGE_AUDIT.csv
- docs/seo/SEO_RM_PRODUCT_STATUS.csv
- docs/seo/SEO_RM_PRODUCT_STATUS.md
- docs/seo/SEO_PERFORMANCE_BEFORE.md
- docs/seo/SEO_PERFORMANCE_AFTER.md
- docs/seo/SEO_PERFORMANCE_COMPARISON.md
- docs/seo/SEO_DEPLOYMENT_CHECKLIST.md
- docs/seo/SEO_TEST_RESULTS.md
- docs/seo/SEO_IMPLEMENTATION.md
- docs/seo/evidence/*
- artifacts/seo/performance/before/*.json
- artifacts/seo/performance/after/*.json
