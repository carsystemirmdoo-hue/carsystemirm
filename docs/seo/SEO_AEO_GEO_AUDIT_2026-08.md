# SEO AUDIT — CARSYSTEM

**Date:** 2026-08-08
**Branch:** `recovery/pre-claude-2026-08-07`
**Method:** Static inspection of source + fresh `npm run build` (succeeded) + parsing of the 890 prerendered HTML files in `.next/server/app/`.
**Scope:** Audit only. No code changed.

> All evidence below is first-hand from this build, not from the pre-existing reports in `docs/seo/`. Those reports are dated **2026-07-29** and predate the Carfit and Cosmos LAC brand pages, so they are stale.

---

## Headline finding

The **SEO plumbing is genuinely strong** — better than most commercial builds. There is a real, centralised, deliberately-designed SEO layer (`lib/seo/`) with a documented route policy, and the decisions recorded in `docs/seo/` show engineering judgement (e.g. refusing to emit `Offer` markup without confirmed price/availability).

The weakness is **not technical, it is structural**: 742 of 832 product pages (89%) are Cosmos LAC colour variants that are individually indexed, individually in the sitemap, and near-duplicates of each other. The excellent metadata machinery is being applied uniformly to a product set that does not deserve uniform treatment.

That is a data-layer/config fix using abstractions that already exist. It is not a rebuild.

---

## 1. Already implemented correctly

### 1.1 Centralised SEO layer — PASS

`lib/seo/` is a properly factored module, not scattered metadata:

| File | Responsibility |
|---|---|
| `lib/seo/site-config.ts` | Origin, locale, language, defaults, environment-gated indexing |
| `lib/seo/route-policy.ts` | Declarative index/follow/sitemap/canonical/schema policy per route type |
| `lib/seo/metadata-builders.ts` | `buildPageMetadata` + per-entity builders |
| `lib/seo/product-breadcrumbs.ts` | Breadcrumb trail construction |
| `lib/seo/category-landings.ts` | Category landing definitions + product mapping |
| `lib/seo.ts` | JSON-LD helpers with safe serialisation |

Every public page routes through `buildPageMetadata()`. There is no page hand-rolling its own `<title>`.

### 1.2 Environment-gated indexing — PASS

`lib/seo/site-config.ts:26-31` disables indexing on Vercel preview/development and via `NEXT_PUBLIC_SEO_INDEXING=false`. `app/robots.ts:6-13` returns a blanket `disallow: /` when indexing is off. This correctly prevents preview deployments from being indexed — a very common production leak, handled here.

### 1.3 Canonical host enforcement — PASS

`middleware.ts:96-106` issues a **308** redirect from any non-canonical host to `seoSiteConfig.url` in production only. Correct status code, correct environment gate.

### 1.4 Canonical URLs — PASS

Verified in rendered HTML:

```
proizvodi/2210-onyx-activator.html
  <link rel="canonical" href="https://carsystemirm.com/proizvodi/2210-onyx-activator"/>
  <meta name="robots" content="index, follow"/>
```

Self-referencing, absolute, production origin, no query string. Confirmed on product, category, brand and catalog page types.

### 1.5 Filter / query-string policy — PASS

`middleware.ts:66-71` sets `X-Robots-Tag: noindex, follow, noarchive` on any `/katalog?…` or `/kontakt?…` URL, while `buildPageMetadata` keeps the canonical pointed at the clean route. This is the correct pattern for faceted navigation: the filter combinatorial explosion is never indexable, but link equity still flows.

Crucially it uses a **header**, not a `robots.txt` disallow — so crawlers can actually see the directive. `docs/seo/SEO_INDEXATION_MATRIX.md` states this rule explicitly.

### 1.6 Crawlable pagination behind infinite scroll — PASS

This is the strongest single piece of engineering in the SEO layer.

`/katalog` uses client-side infinite scroll (`components/catalog/CatalogExplorer.tsx`, a `"use client"` component calling `useSearchParams()` at line 223). Because it is wrapped in `<Suspense>` (`components/catalog/CatalogPage.tsx:38-49`), the static prerender emits the **fallback** — a static product grid plus real pagination links.

Verified in the built HTML:

```
katalog.html      words 828 | unique internal links 85 | product links 48
```

And a parallel crawlable route exists at `app/katalog/strana/[page]/page.tsx` (18 pages, `dynamicParams = false`), all in the sitemap. Every one of the 832 products is reachable by a crawler without executing JavaScript.

### 1.7 Structured data coverage — PASS (traditional entities)

All from `lib/seo.ts`, verified present in rendered HTML (4 JSON-LD blocks on a product page):

| Entity | Where | Status |
|---|---|---|
| `Organization` | `organizationJsonLd()`, homepage | PASS |
| `WebSite` | same `@graph` | PASS |
| `WebPage` | same `@graph` | PASS |
| `Brand` + `CollectionPage` | `brandJsonLd()`, `/brendovi/[slug]` | PASS |
| `CollectionPage` + `ItemList` | `collectionPageJsonLd()`, catalog/category | PASS |
| `Product` | `productJsonLd()`, all 832 PDPs | PASS |
| `BreadcrumbList` | `breadcrumbJsonLd()`, all deep pages | PASS |
| `Store` / `LocalBusiness` | `localBusinessJsonLd()`, `/prodavnice` | PASS |

`@id` values are stable and cross-referenced (`isPartOf`, `about`, `publisher`, `parentOrganization`) — this is a proper entity graph, not disconnected blobs.

### 1.8 Deliberate omission of `Offer` — PASS

`lib/seo.ts:230-270` emits `Product` with **no** `offers`, no price, no availability. `docs/seo/SEO_INDEXATION_MATRIX.md` records the rule: *"Ne postoji Offer markup bez potvrđene cene, valute, dostupnosti i uslova."*

This is correct. Emitting fake `Offer` data to chase rich results is exactly the kind of manipulation that earns manual actions. Given `CLAUDE.md` forbids exposing prices to logged-out users, there is no honest `Offer` to emit. **Do not "fix" this.**

### 1.9 Review-gated public content — PASS

`types/product-detail.ts` implements a `Reviewable<T>` / `ReviewedSection<T>` pattern with `ContentReviewStatus`. `lib/seo.ts:213-227` (`visibleProductFacts`) only emits `additionalProperty` when both the detail block **and** the fact are `confirmed`.

This means structured data can never assert an unverified technical claim. For a business where wrong mixing ratios damage vehicles, this is the right architecture and directly satisfies the brand-safety rules in `CLAUDE.md`.

### 1.10 PDF handling — PASS

`next.config.ts:11-21` sets `X-Robots-Tag: noindex, follow` on `/documents/products/rm/:path*`. 117 TDS/SDS PDFs are reachable and link-followable but won't compete with the HTML PDPs. Header-based, not robots-disallowed — correct.

### 1.11 Duplicate slug consolidation — PASS

`next.config.ts:24-32` permanently redirects `/proizvodi/clear-harden-r-h-2p15` → `/proizvodi/h-2p15-clear-harden-r`. `docs/seo/SEO_CANNIBALIZATION_REPORT.md` documents the reasoning.

### 1.12 Internal-route noindex — PASS

`middleware.ts:73-86` noindexes `/interaction-demo/*`, `/social-exports/*`, `/portal/*`, `/site-u-pripremi*`. `/preview/*` is redirected outright (`middleware.ts:115-117`). None of the 17 demo routes or 20 portal routes can leak into the index.

### 1.13 Language and locale — PASS

`app/layout.tsx:95` sets `lang="sr-Latn"`. `og:locale` = `sr_RS`, verified in output. Serbian latinica throughout, per `CLAUDE.md`.

### 1.14 404 behaviour — PASS

`app/not-found.tsx` sets `index: false, follow: true`, returns a real 404, and offers navigation to catalog/brands/contact. Correct soft-404 avoidance.

---

## 2. Implemented but incomplete

### 2.1 Category landings cover only R-M — PARTIAL

`lib/seo/category-landings.ts` defines exactly **4** landings, and `getSeoCategoryProducts()` (line 88) hard-filters `product.brandSlug === "rm"`.

| Category | Products |
|---|---|
| `bezbojni-lakovi` | 20 |
| `prajmeri-i-punioci` | 17 |
| `bazne-boje` | 3 |
| `ucvrscivaci-i-razredjivaci` | 11 |

That is 51 of 832 products (6%). **The 742 Cosmos LAC products have no category landing page at all.** The categories that would carry real Serbian commercial intent — *sprej u boji*, *boja za felne*, *boja za branike*, *lak za drvo*, *kit*, *boja otporna na visoke temperature* — do not exist as routes, despite the underlying `technicalCategory` taxonomy already existing in `lib/cosmos-lac-data.ts:47-77` with 30 labelled groups.

There is also **no `/kategorije` index page** — only `app/kategorije/[slug]/`. The category tier has no hub.

Only 3 of the 4 landings are linked from the footer (`components/layout/Footer.tsx:13-15`); `ucvrscivaci-i-razredjivaci` is omitted.

### 2.2 Product relationships exist in data but not in schema — PARTIAL

`types/product-detail.ts:172-180` defines a rich `ProductRelationType` union: `similar | alternative | compatible | same-process-stage | next-process-step | same-brand | manual`. `lib/carsystem-data.ts:2677-2731` resolves these into real product lists.

These relationships render as HTML links (6 on an R-M PDP) but are **entirely absent from the JSON-LD**. `productJsonLd()` emits no `isRelatedTo`, `isSimilarTo`, `isAccessoryOrSparePartFor`, or `isConsumableFor`.

The machine-readable graph is therefore strictly poorer than the visible page — the inverse of what you want for AEO/GEO.

### 2.3 Documentation not exposed to machines — PARTIAL

Every R-M product has TDS + product-information PDFs (`data/rm-imported-products.generated.json`, `documents` key; only 1 of 59 missing a TDS). They render as links and are noindexed (correct).

But `productJsonLd()` emits no `subjectOf`, `associatedMedia`, or `hasPart` pointing at them. An answer engine reading the page cannot tell that an authoritative technical document backs the claims. **This is the single highest-leverage citation signal currently being discarded.**

### 2.4 Confirmed detail content covers ~25 products — PARTIAL

Only ~25 products have a `detail:` block with process stages, benefits, technology and confirmed technical facts. The remaining ~807 fall back to `specifications` + `shortDescription`.

The `ProductDetailContent` type is excellent and clearly designed for this. It is simply under-populated.

### 2.5 Sitemap is minimal — PARTIAL

`app/sitemap.ts:47-49` emits **only** `url`. No `lastModified`, no `changeFrequency`, no `priority`. At 872 URLs this measurably hurts recrawl efficiency — Google has no signal about which of 742 near-identical variant pages changed.

`lastModified` is derivable: `data/cosmos-lac-summary.generated.json` has `generatedAt`, and the R-M import has source hashes.

### 2.6 Brand hub link equity is badly distributed — PARTIAL

Measured outbound `/proizvodi/*` links per brand page:

| Brand page | Words | Product links | Products in catalogue |
|---|---:|---:|---:|
| `rm` | 2117 | 20 | 59 |
| `baslac` | 1208 | 4 | — |
| `carfit` | 1169 | 2 | — |
| `carsystem` | 1078 | 9 | — |
| `poliranje`/`befar` | 570 | 8 | — |
| **`cosmos-lac`** | **416** | **9** | **742** |
| `norbin` | 406 | 2 | — |
| `sata` | 374 | 1 | — |

The brand hub for 742 products — 89% of the catalogue — is the second-thinnest page on the site and links to 9 of them. The Cosmos brand page (`components/brand/cosmos/`, currently uncommitted) is visually built but is not doing any information-architecture work.

### 2.7 OpenGraph image dimensions — PARTIAL

`app/layout.tsx:70-76` sets `width: 1672, height: 941` on the root OG image. `buildPageMetadata()` (`lib/seo/metadata-builders.ts:73-83`) does **not** — so every non-root page emits `og:image` with no dimensions. Verified absent in output. Minor, affects social preview rendering.

---

## 3. Missing

### 3.1 Substrate / application data — FAIL (blocks AEO entirely)

This is the most important gap in the repository.

Searched `lib/carsystem-data.ts`, `data/rm-imported-products.generated.json`, `data/cosmos-lac-products.generated.json`:

| Term | carsystem-data | rm json | cosmos json |
|---|---:|---:|---:|
| `aluminij*` | 0 | 0 | 0 |
| `plastik*` | 0 | 0 | 0 |
| `pocinkovan*` | 0 | 0 | 0 |
| `čelik` / `celik` | 0 | 0 | 0 |
| `galvaniz*` | 0 | 0 | 0 |
| `staklopl*` / `GRP` | 0 | 0 | 0 |

**There is zero substrate data anywhere in the product model.**

The motivating query from the brief — *"Koji prajmer ide na aluminijum?"* — is **not answerable from current data at any price**. Not by schema, not by an LLM reading the pages, not by a human browsing the site. The information exists only inside the noindexed TDS PDFs.

Related absences: `odnos mešanja` (0), `VOC` (0), `debljina sloja` (0), `dizna` (0). The closest existing structure is a free-text `label: "Površina"` used on 12 hand-curated products — free text, no controlled vocabulary.

### 3.2 Answer-engine structured data — FAIL

`grep` for `FAQPage`, `Question`, `acceptedAnswer`, `HowTo` across `app/`, `components/`, `lib/`: **zero matches.**

No question/answer surface exists. This is expected at this stage and is the point of Phase 2 — recorded here as a baseline, not a criticism.

### 3.3 `ProductGroup` / variant consolidation — FAIL

See §4.1. `docs/seo/SEO_CANNIBALIZATION_REPORT.md` explicitly considered `ProductGroup` and rejected it — **but reasoned only about the 59 R-M products**, where the rejection is correct (59 genuinely distinct products with distinct codes and documentation).

The report never addresses the 742 Cosmos variants, which are precisely the case `ProductGroup` exists for. The right conclusion was reached about the wrong dataset.

### 3.4 `hreflang` / `alternates.languages` — NOT APPLICABLE (for now)

Absent, verified in output. Correct for a single-language site. Becomes relevant only if Cyrillic or regional variants are added.

---

## 4. Incorrect / risky

### 4.1 742 near-duplicate indexable variant pages — FAIL (primary risk)

**Evidence — content distribution across all 832 built PDPs:**

| Group | Pages | Median words | Median outbound product links |
|---|---:|---:|---:|
| Cosmos LAC variants | 742 | 533 | 65 |
| Everything else | 90 | 462 | 6 |

**Evidence — source-data uniqueness (`data/cosmos-lac-products.generated.json`):**

- unique `seoTitle`: 742/742
- unique `seoDescription`: 739/742
- **unique `useCase`: 29/742**

The descriptions are unique only because a product name is interpolated into a fixed template:

```
"Automotive 030 u Cosmos Lac katalogu. Proverite namenu i pošaljite upit Carsystem i R-M timu."
```

329 products share the identical `useCase` string *"Akrilno aerosolno bojenje za umetničke i dekorativne površine."*

**Evidence — rendered near-duplication (5-gram Jaccard similarity between sibling variant pages, 41 families sampled):**

| Family | Variants | Similarity |
|---|---:|---:|
| `cosmos-lac-ral` | 60 | **0.90** |
| `cosmos-lac-flame-orange` | 134 | **0.86** |
| `cosmos-lac-spray-bike` | 88 | **0.86** |
| `cosmos-lac-flame-blue` | 120 | **0.85** |
| `cosmos-lac-molotow-premium` | 66 | 0.83 |
| median across all families | — | 0.72 |

And these pages have **no differentiating substance**: `lib/cosmos-lac-data.ts:206-213` gives every Cosmos product a single `status: "disabled"` document placeholder and `relatedProductSlugs: []`. No TDS, no compatibility, no process, no `detail` block. The word count is inflated by the variant selector listing up to 133 sibling colour names — not by prose.

27 pages have **zero** outbound product links (small families where the variant selector suppresses itself below 2 verified rows) — genuine dead-end leaves at 255 words.

**Why this matters:** all 742 are `index, follow` with self-canonicals and all 742 are in the sitemap. The likely outcomes are crawl-budget waste on 742 pages that recrawl to no change, Google electing not to index most of them ("Crawled – currently not indexed"), and dilution of the site's topical signal — the catalogue reads as 89% aerosol colour codes rather than as professional refinish expertise.

**Note the prior audit missed this.** `docs/seo/SEO_ISSUES_AFTER.json` reports `duplicateDescriptionPages: 0` — a false negative, because `scripts/seo-audit.mjs` tests exact string equality and the template interpolation defeats it.

### 4.2 Heading hierarchy skips a level on PDPs — FAIL (minor)

Rendered heading order on `/proizvodi/2210-onyx-activator`:

```
h1: A 2210 ONYX ACTIVATOR
h3: Sistemska komponenta
h3: Dokumentovana uloga proizvoda
h3: ONYX HD · Aditiv
h2: Slični proizvodi
```

`h1 → h3` with no intervening `h2`. Accessibility and document-outline issue; also weakens section-level extraction by answer engines. Source: `components/product/ProductDetailPage.tsx:102` (h1) and the `h3` blocks around line 351.

### 4.3 Maintenance mode is a live production kill-switch — RISK

`middleware.ts:14-16` + `120-128`: with `MAINTENANCE_MODE=true`, **every** public route redirects to `/site-u-pripremi`, which is itself `noindex, nofollow`. If this is ever left on in production, the entire site deindexes.

`docs/seo/SEO_DEPLOYMENT_CHECKLIST.md:10` has an unchecked manual checkbox for this. There is no automated guard. Given the site is on a `recovery/` branch, verify the production value before any SEO work is measured.

### 4.4 Bundle weight on map and program routes — RISK

From the build output:

```
/prodavnice        4.25 kB   395 kB First Load JS
/program/[slug]      222 B   300 kB First Load JS
```

`maplibre-gl` on `/prodavnice` pushes it to 395 kB. `/prodavnice` is the destination of the primary business CTA (*"Pronađi najbližu prodavnicu"*, per `CLAUDE.md`), so this is the worst page to have an INP/LCP problem on — especially on mobile in Serbia. Not measured here; flagged for a real field-data check.

---

## 5. Technical debt

| Item | Location | Note |
|---|---|---|
| No-op ternary in robots logic | `lib/seo/metadata-builders.ts:64,68` | `follow: shouldIndex ? follow : follow` — both branches identical. Either dead code or a lost intent (probably `follow: true` when noindexed). |
| Stale audit reports | `docs/seo/*.md`, `*.json` | Dated 2026-07-29; predate Carfit + Cosmos brand pages. `SEO_IMAGE_AUDIT.csv` is 17.9 MB in git. |
| Stale static export dir | `out/` | Left over from June; project is not a static export (middleware is active). Confusing artefact. |
| Uncommitted brand work | `components/brand/cosmos/`, `lib/cosmos-lac-brand-data.ts` | Wired into `app/brendovi/[slug]/page.tsx:98-99` and building, but untracked in git. |
| Misleading audit metric | `scripts/seo-audit.mjs` | Reports `imagesEmptyAlt: 54573` as if a finding. Empty `alt=""` on decorative images is *correct*. Sampling built HTML shows 1–5 per page. The metric creates false alarm. |
| Duplicate content fields | `data/rm-imported-products.generated.json` | For all 59 R-M products, `shortDescription === purpose === benefit`. Three fields, one string. |
| Two catalog grid paths | `CatalogPage.tsx` / `CatalogSeoContent.tsx` | Suspense-fallback duplication is intentional and correct, but undocumented in code — fragile if someone "simplifies" it and silently kills crawlable pagination. Deserves a comment. |

---

## 6. Recommended fixes before AEO/GEO

Ordered by leverage. Items 1–3 are prerequisites; 4–6 can run in parallel with Phase 2.

**1. Consolidate the Cosmos variant explosion.** *(largest single win)*
Pick one of two approaches — the first is preferred:
- **Family pages:** create `/proizvodi/[baseProductSlug]` for the 68 base groups as the indexable entity; make the 742 variants `noindex, follow` with a canonical to the family page, and drop them from the sitemap. Emit `ProductGroup` with `hasVariant` and `variesBy: color`. Sitemap drops 872 → ~200 high-quality URLs.
- **Or** keep variant URLs but canonical them to the family page and remove from sitemap.
The variant selector (`components/product/ProductVariantOptions.tsx`) already provides the UX; only the indexation policy changes. `lib/seo/route-policy.ts` already has the right shape for a new `product-variant` route type.

**2. Add a substrate/application controlled vocabulary to the product model.**
Without this, Phase 2 cannot be built. Minimum viable field set is specified in §7 below. This is a data-entry and TDS-extraction task, not an engineering task — engineering is ~1 day, the domain work is the real cost and needs the R-M technical team.

**3. Verify `MAINTENANCE_MODE=false` in production** and add an automated assertion to the deploy checklist.

**4. Expand category landings beyond R-M.** Remove the `brandSlug === "rm"` filter in `getSeoCategoryProducts()`, add landings for the Cosmos `technicalCategory` groups that carry commercial intent, and add a `/kategorije` hub. This is where Serbian commercial queries will land.

**5. Enrich `productJsonLd()`** with `isSimilarTo` / `isRelatedTo` / `isAccessoryOrSparePartFor` from the existing `ProductRelationType` data, plus `subjectOf` pointing at the TDS PDFs. Pure win — the data already exists and is already reviewed.

**6. Add `lastModified` to the sitemap**, and fix the heading hierarchy on PDPs (§4.2).

---

## 7. Files responsible for each finding

| Finding | File(s) |
|---|---|
| Centralised SEO layer, metadata | `lib/seo/site-config.ts`, `lib/seo/metadata-builders.ts`, `lib/seo.ts` |
| Route policy | `lib/seo/route-policy.ts` |
| Indexation, canonical host, query noindex | `middleware.ts`, `app/robots.ts` |
| Sitemap gaps | `app/sitemap.ts` |
| PDF noindex, redirects | `next.config.ts` |
| **Variant explosion (primary risk)** | `lib/cosmos-lac-data.ts`, `data/cosmos-lac-products.generated.json`, `scripts/generate-cosmos-lac-catalog.mjs`, `app/sitemap.ts` |
| Product schema gaps | `lib/seo.ts:230-270` |
| Relationship data (unused by schema) | `types/product-detail.ts:172-180`, `lib/carsystem-data.ts:2677-2731` |
| Category coverage | `lib/seo/category-landings.ts`, `app/kategorije/[slug]/page.tsx` |
| Brand hub linking | `app/brendovi/[slug]/page.tsx`, `components/brand/cosmos/CosmosBrandPage.tsx` |
| Crawlable pagination | `components/catalog/CatalogPage.tsx`, `components/catalog/CatalogSeoContent.tsx`, `app/katalog/strana/[page]/page.tsx` |
| Heading hierarchy | `components/product/ProductDetailPage.tsx` |
| Missing substrate data | `data/rm-imported-products.generated.json`, `data/cosmos-lac-products.generated.json`, `lib/carsystem-data.ts` |
| Bundle weight | `app/prodavnice/page.tsx` (maplibre-gl) |
| Stale/misleading audit tooling | `scripts/seo-audit.mjs`, `docs/seo/*` |

---

## SEO READINESS SCORE

| Area | Weight | Score |
|---|---:|---:|
| Indexation & crawling | 15 | 13 |
| Next.js metadata | 15 | 14 |
| Structured data (traditional) | 15 | 11 |
| Product SEO | 20 | 11 |
| Category SEO | 10 | 4 |
| Brand SEO | 10 | 7 |
| Technical SEO / CWV | 10 | 7 |
| Serbian-language targeting readiness | 5 | 3 |
| **Total** | **100** | **70** |

# SEO READINESS SCORE: 70/100

### Is the technical SEO foundation strong enough to begin AEO/GEO work without first doing a major SEO rebuild?

# YES WITH MINOR FIXES

**Reasoning.** Nothing in the foundation needs rebuilding. The metadata system, canonical policy, route policy, sitemap generation, structured-data helpers, middleware and crawlable-pagination design are all sound and would survive Phase 2 unchanged. New AEO/GEO surfaces plug into `lib/seo/route-policy.ts` and `lib/seo/metadata-builders.ts` as additional route types.

**Honest qualifier on "minor".** Fix #1 (variant consolidation) is a *moderate* piece of work — roughly 2–3 days of engineering — not a one-hour change. It is "minor" relative to a rebuild, not minor in absolute terms. Fix #2 (substrate vocabulary) is engineering-light but **blocked on domain expertise from the R-M technical team**, and it is a hard prerequisite: the flagship AEO query cannot be answered without it. That dependency should be started now, in parallel, because it has the longest lead time of anything in this plan.

---
---

# PHASE 2 — CARSYSTEM AEO/GEO ARCHITECTURE V1

Proposal only. Nothing below is implemented.

## 2.0 Data feasibility verdict

> *Can the required relationships be constructed programmatically from the existing dataset?*

**Partially — roughly 40%.**

| Relationship | Constructible today? | Source |
|---|---|---|
| product → brand | **Yes** | `product.brandSlug` |
| product → category | **Yes** | `rmMetadata.category`, `technicalCategory` |
| product → process phase | **Yes** | `phaseSlug` + `refinishPhases[].step` (ordered) |
| product → system/series | **Yes (R-M only)** | `rmMetadata.system`, `.series` |
| product → technology | **Yes (R-M only)** | `rmMetadata.technology` (e.g. `waterborne`) |
| product → variant | **Yes** | `baseProductSlug` / `variantId` |
| product → documentation | **Yes (R-M only)** | `documents.technicalDataSheet` |
| product → compatible product | **Partial (~25)** | `detail.compatibleProducts`, reviewed only |
| product → next process step | **Partial** | `detail.process.usedBeforeProductSlugs` / `usedAfterProductSlugs` |
| **product → substrate** | **NO** | *does not exist* |
| **product → defect/problem** | **NO** | *does not exist* |
| **product → mixing ratio / cure params** | **NO** | *TDS PDF only* |
| **product → application method** | **NO** | *free text only* |

The taxonomy backbone is real and machine-usable. The **application layer is entirely missing**, and that is exactly the layer answer engines query against.

## 2.1 Entity model

Nine entities. Six exist; three are new.

```
Brand ──distributes──> ProductFamily ──hasVariant──> Product
                                                       │
Category ──contains────────────────────────────────────┤
ProcessStep ──uses─────────────────────────────────────┤
System (R-M) ──includes────────────────────────────────┤
                                                       │
Substrate ──requires───────> Product      [NEW]
Defect ──solvedBy──────────> Product      [NEW]
AnswerIntent ──answeredBy──> Guide + Product  [NEW]
```

- **Substrate** — `aluminijum`, `pocinkovani lim`, `čelik`, `plastika (PP/EPDM/ABS)`, `stakloplastika/GRP`, `stara boja`, `e-coat`, `špahtl-masa`
- **Defect** — `korozija`, `rupice`, `pomorandžina kora`, `krateri`, `curenje`, `slabo prianjanje`, `matiranje`
- **AnswerIntent** — canonical Serbian question, resolving to a Guide plus a ranked, evidence-backed product set

## 2.2 Product data extensions (the critical path)

Minimum viable additions to `CarsystemProduct`, all `Reviewable` to preserve the existing review-gating discipline:

```ts
substrates?: Reviewable<{
  slug: SubstrateSlug;
  suitability: "recommended" | "suitable" | "requires-primer" | "not-suitable";
  requiresPrimerSlug?: string;
  sourceRef: string;        // TDS page/section — mandatory
}>[];

application?: ReviewedSection<{
  mixingRatio?: string;     // "4:1:1"
  potLifeMinutes?: number;
  flashOffMinutes?: number;
  dryingProfile?: { tempC: number; minutes: number }[];
  coats?: string;
  filmThicknessMicrons?: [number, number];
  nozzleMm?: [number, number];
  method: ("spray" | "brush" | "roller" | "aerosol")[];
}>;

solvesDefects?: Reviewable<{ slug: DefectSlug; note?: string }>[];
processOrder?: { beforeSlugs: string[]; afterSlugs: string[] };
```

**Every field carries `sourceRef` back to a TDS.** No inferred technical values, ever — consistent with `CLAUDE.md` brand-safety rules and with the review pattern already in `types/product-detail.ts`.

**Sequencing:** populate for the 59 R-M products first. They have TDS PDFs, confirmed review status, and carry the professional intent. Cosmos aerosols need only `substrates` + `method`.

## 2.3 Content / knowledge model

Three tiers, deliberately different in how they are produced:

| Tier | Route | Count | Production | Indexation |
|---|---|---:|---|---|
| **Guide** (process) | `/vodici/[slug]` | 15–25 | **Manual, expert-reviewed** | index |
| **Answer** (Q&A) | `/pitanja/[slug]` | 40–60 | **Manual answer, programmatic product block** | index |
| **Substrate hub** | `/podloge/[slug]` | 8–10 | Programmatic from `substrates` | index |
| **Defect hub** | `/problemi/[slug]` | 7–10 | Programmatic from `solvesDefects` | index |

Guides are the authority layer and must be human-written. Substrate and defect hubs are safely programmatic **because they are assembled from reviewed structured fields, not generated prose** — the page is a curated index, not an essay.

## 2.4 Programmatic vs curated — the dividing line

**Programmatic is safe when** the page is an assembly of reviewed structured data with a stable template and ≥3 qualifying products. **Curated is required when** the page makes a recommendation, explains a process, or resolves a trade-off.

Hard rule: *no page is generated whose only variable content is a name substituted into a template.* That is precisely the failure mode §4.1 documents in the Cosmos set — the architecture must not repeat it at the guide layer.

## 2.5 Safeguards against thin/duplicate pages

Enforced in CI via an extension of `scripts/validate-seo.mjs`:

1. **Minimum yield** — a hub page with <3 qualifying products is not generated and not routed.
2. **Similarity ceiling** — reuse the 5-gram Jaccard method from this audit; any new page >0.75 similar to an existing page fails the build.
3. **Unique-prose floor** — ≥120 words of page-specific prose, excluding nav, footer and repeated component text.
4. **Source requirement** — every technical assertion renders a visible source reference or the section does not render (the existing `Reviewable` gate already does this; extend it to the new fields).
5. **No AI-authored technical claims.** Draft assistance is fine; publication requires a named human reviewer recorded in `reviewStatus`.

## 2.6 Structured data strategy

Additive to the existing `@graph`, reusing the `@id` convention already in `lib/seo.ts`:

| Page type | Schema |
|---|---|
| Guide | `HowTo` (only where genuinely step-based) or `Article` + `about` → substrate/product |
| Answer | `FAQPage` — **only** where the Q&A is visible on-page; `QAPage` where user-submitted |
| Substrate hub | `CollectionPage` + `ItemList` + `about` |
| Product (extended) | add `isSimilarTo`, `isRelatedTo`, `isConsumableFor`, `subjectOf` → TDS, `additionalProperty` from `application` |
| Product family | `ProductGroup` + `hasVariant` + `variesBy` |
| Organization | add `knowsAbout`, `areaServed`, `sameAs` |

**Discipline:** `FAQPage` only when the answer is visible to a human on that page. Google has repeatedly demoted FAQ markup used as an invisible rich-result grab — and the brief explicitly rules out that kind of optimisation.

## 2.7 Internal linking architecture

```
Guide ──> Substrate hub ──> Category ──> Product ──> TDS
  │            │                            │
  └────────────┴──> Answer ─────────────────┘
                      │
                      └──> /prodavnice   (primary business CTA)
```

Every answer path must terminate at either a product with documentation or the store locator. Per `CLAUDE.md`, *"Pronađi najbližu prodavnicu"* is the primary CTA — the knowledge layer should feed it, not bypass it.

Fixes the current dead-ends: 27 zero-link PDPs, and the Cosmos brand hub linking 9 of 742 products.

## 2.8 Brand authority architecture

Make the distribution relationship explicit and machine-readable — currently it is implied by page layout only:

```
Organization (Carsystem i R-M Inđija)
  └─ knowsAbout: [auto-refinish, priprema površine, lakiranje, kolorimetrija]
  └─ brand / makesOffer → Brand (R-M, Cosmos Lac, Carfit, baslac, …)
       └─ Brand ──hasProductFamily──> ProductFamily ──hasVariant──> Product
```

**Legal-safety constraint:** keep to `brendovi u ponudi` / `partnerska mreža` / `profesionalni refinish program`. Do **not** emit anything implying `zvanični distributer` or `ovlašćeni zastupnik` in schema until that wording is confirmed by the business — `CLAUDE.md` flags these as requiring approval, and schema claims are exactly where an unapproved claim becomes machine-readable and quotable at scale.

## 2.9 Technical-document integration

Currently 117 PDFs are `noindex` and invisible to schema. Proposal:

1. Keep the PDFs `noindex` (correct — they shouldn't outrank the HTML).
2. Add `subjectOf: { "@type": "DigitalDocument", name, url, encodingFormat: "application/pdf" }` to `productJsonLd()`.
3. Render **key TDS values as HTML** on the PDP (mixing ratio, drying, film thickness) with a visible "Izvor: TDS, v.X" reference.

This converts a locked archive into the site's strongest citation asset. Answer engines cite what they can read and attribute.

## 2.10 Serbian terminology / synonym architecture

Professionals and retail customers use different words for the same object, and neither matches the official product name. A `SynonymSet` per entity, used for on-page copy, internal anchors and on-site search — **never** for hidden text or keyword stuffing:

| Canonical | Real-world variants |
|---|---|
| bezbojni lak | lak, klarlak, klar, prozirni lak, bezbojka |
| prajmer | prajmer, temeljna boja, grund, podloga, primer |
| punilac | filer, fileri, punilo, kit za prskanje |
| bazna boja | baza, bazni sloj, basecoat, boja |
| učvršćivač | hardener, katalizator, otvrđivač |
| razređivač | razređivač, tiner, razrjeđivač |
| kit | kit, gitovanje, špahtlovanje, poliester kit |
| sprej u boji | sprej, sprej boja, boja u spreju, aerosol |

Note the frequent Croatian/Bosnian and English-borrowed forms (`klarlak`, `tiner`, `filer`) — these are what people actually type. The `sr-Latn` setup already handles the script; only vocabulary coverage is missing.

## 2.11 First 20 answer intents

Ranked by commercial value × feasibility. **Feasibility assumes §2.2 substrate/application data is populated** — without it, all of the top block is unanswerable.

| # | Serbian query | Entity path | Data ready? |
|---:|---|---|---|
| 1 | Koji prajmer ide na aluminijum? | Substrate→Product | ❌ needs `substrates` |
| 2 | Koji prajmer ide na plastiku (branik)? | Substrate→Product | ❌ needs `substrates` |
| 3 | Koji prajmer na pocinkovani lim? | Substrate→Product | ❌ needs `substrates` |
| 4 | Kako se priprema površina pre lakiranja? | ProcessStep→Guide | ✅ `refinishPhases` |
| 5 | Koji je odnos mešanja za bezbojni lak? | Product→application | ❌ TDS only |
| 6 | Koja je razlika između 2K i 1K laka? | Category→Guide | ⚠️ partial |
| 7 | Šta je vodena baza (waterborne)? | Technology→Guide | ✅ `rmMetadata.technology` |
| 8 | Koliko sloja bezbojnog laka treba? | Product→application | ❌ TDS only |
| 9 | Zašto nastaje pomorandžina kora? | Defect→Guide | ❌ needs `Defect` |
| 10 | Kako ukloniti krater u laku? | Defect→Guide | ❌ needs `Defect` |
| 11 | Koji lak za felne? | Category→Product | ⚠️ `wheel-rim` exists |
| 12 | Boja otporna na visoke temperature — koja? | Category→Product | ⚠️ `high-heat` exists |
| 13 | Koji kit za rupe na limu? | Category→Product | ⚠️ `bodyfiller` exists |
| 14 | Kako se bira nijansa / RAL? | Guide | ✅ RAL data exists |
| 15 | Šta je AGILIS a šta ONYX HD? | System→Guide | ✅ `rmMetadata.system` |
| 16 | Koliko se suši lak i na kojoj temperaturi? | Product→application | ❌ TDS only |
| 17 | Koji razređivač za koji lak? | Product→compatible | ⚠️ ~25 products |
| 18 | Koja dizna pištolja za bezbojni lak? | Product→application | ❌ TDS only |
| 19 | Gde kupiti auto lakove u Srbiji? | LocalBusiness | ✅ `/prodavnice` |
| 20 | Šta treba za lakiranje jednog dela? | Guide→ProductSet | ⚠️ partial |

**Readiness: 5 of 20 answerable today (25%). 8 need the substrate/application extension. 7 are partial.**

This is the clearest possible argument for sequencing Fix #2 before any content production.

## 2.12 Suggested sequencing

| Phase | Work | Depends on |
|---|---|---|
| **2a** | Variant consolidation + `ProductGroup`; sitemap `lastModified` | — |
| **2b** | Substrate/defect vocabulary + schema; TDS extraction for 59 R-M products | R-M technical team |
| **2c** | Substrate + defect hub routes (programmatic) | 2b |
| **2d** | 15–25 curated guides; intents 4, 7, 14, 15, 19 first (answerable now) | 2c |
| **2e** | `FAQPage`/`HowTo` schema, product relationship schema, TDS `subjectOf` | 2b, 2d |
| **2f** | Synonym coverage in copy and on-site search | 2d |

Start **2b in parallel with 2a** — it is the longest-lead item and it gates everything downstream.
