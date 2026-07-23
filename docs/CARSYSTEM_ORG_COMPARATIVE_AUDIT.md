# Carsystem.org comparative audit

**Project:** Carsystem i R-M Inđija, Serbia

**Comparison:** current repository vs. [carsystem.org](https://www.carsystem.org/)

**Audit date:** 16 July 2026

**Scope:** audit and strategy only; no application code changes

**Recommended direction:** **Option C — controlled hybrid**

## Executive conclusion

The current Serbian site should not be discarded and should not become a direct visual clone of Carsystem.org. Its strongest assets—Serbian task-based discovery, multi-brand architecture, product inquiry paths, MapLibre locator, theme system, responsive controls, and future B2B readiness—solve needs that the global single-brand site does not address.

Carsystem.org is materially stronger in three areas that matter to the owner and to market credibility: unmistakable Carsystem identity, disciplined product photography, and deep technical product information (especially article/variant tables and document access). Those strengths should be adopted deliberately. The correct result is a light-first, Carsystem-recognisable public presentation with the existing Serbian UX underneath, not an imitation of the global site's dated or inaccessible patterns.

Before visual alignment work, the project also has launch-blocking trust and SEO details to resolve: placeholder company contact data, unverified public claims, a homepage locator counter showing zero despite available locations, and production URL configuration.

## Method and evidence

### Repository inspection

The audit covered:

- Next.js route structure and static generation;
- home, catalog, brand, program, product, locator, contact, header, and footer implementations;
- design tokens, typography, light/dark themes, motion, transition, and reduced-motion behavior;
- public product/store data models and future B2B/ERP notes;
- metadata, canonical URLs, JSON-LD, robots, and sitemap generation;
- project documentation: `README.md`, `PRD.md`, `ARCHITECTURE.md`, `UI_DESIGN_BRIEF.md`, `MASTER_REQUIREMENTS.md`, `DATA_MODEL_DRAFT.md`, `SEO_CONTENT_PLAN.md`, and `TODO.md`;
- built output and representative responsive states.

Key implementation paths:

- shell: `app/layout.tsx`, `components/layout/Header.tsx`, `components/layout/Footer.tsx`;
- homepage: `components/home/CarsystemHomePage.tsx` and `CarsystemHomePage.module.css`;
- catalog: `app/katalog/page.tsx`, `components/catalog/CatalogExplorer.tsx`, `CatalogFilters.tsx`, `CatalogProductCard.tsx`;
- product detail: `app/proizvodi/[slug]/page.tsx`, `components/product/*`;
- brand/program: `app/brendovi/*`, `app/program/*`, `components/brand/*`, `components/program/*`, `components/brand-program/*`;
- locator: `components/stores/StoreLocator.tsx`, `PartnerMap.tsx`, `lib/partner-stores.ts`, `lib/nearest-store.ts`;
- contact: `components/contact/ContactPage.tsx`, `components/contact/ContactForm.tsx`;
- data/SEO: `lib/carsystem-data.ts`, `lib/company-contact.ts`, `lib/seo.ts`, `app/robots.ts`, `app/sitemap.ts`;
- motion/theme: `components/motion/*`, `components/layout/ThemeScript.tsx`, `ThemeToggle.tsx`.

### Official-site inspection

The official review included the homepage, desktop/mobile navigation, `/produkte`, all ten primary categories, representative category pages, five product-detail pages, global search, partner finder, catalogs/brochures, news, about, multilingual switching, footer, legal links, product-safety links, robots, and sitemap.

Representative products were:

1. Sanding Disc F.23 Ceramic;
2. Multi Blue Rapid Changer SF;
3. 2K Clear VOC Speed Plus;
4. Compound X1500 HC;
5. Explorer two-piece coverall.

Search was tested with an exact article number (`159.218`), an exact product phrase, a typo, a partial country name, a misspelled country name, and Serbian terminology.

### Validation and responsive evidence

- `npm run lint`: passed.
- `npm run build`: passed; 69 static pages generated.
- `npm run typecheck`: passed when run sequentially after the build. The initial concurrent run collided with `.next/types` regeneration; this is a CI sequencing concern, not a TypeScript defect.
- Local built app inspected at 1440×900, 1280×800, and 390×844.
- Official site inspected at 1440×900, 1280×800, and 390×844.
- Local mobile routes `/`, `/katalog`, `/proizvodi/carsystem-f23-brusni-diskovi`, `/prodavnice`, and `/kontakt` showed no horizontal overflow at 390 px.
- A requested 844×390 emulation was overridden by the browser environment to 1280×720; true mobile-landscape interaction remains a follow-up device test.

Useful screenshots are in `docs/audit-screenshots/`. The clearest pairs are:

- `official-home-1440x900.png` and `comparative-local-home-1440x900.png`;
- `official-home-390x844.png` and the locally inspected 390 px route set;
- `official-product-f23-1440x900.png` and `comparative-local-product-f23-1440x900.png`;
- `official-partner-finder-1440x900.png` and the local locator screenshots already in the audit folder.

## Current repository baseline

### Architecture and routes

The project is a sound Phase 1 foundation: Next.js 15, React 18, TypeScript, Tailwind 4, static product routes, and MapLibre/OpenStreetMap-based location discovery. Public routes currently include:

- `/`, `/katalog`, `/proizvodi/[slug]`;
- `/brendovi`, `/brendovi/[slug]`;
- `/program`, `/program/[slug]`;
- `/prodavnice`, `/kontakt`.

The build includes 35 demonstration products, eight active brand pages, five public program groups, five repair-process phases, and 69 generated pages. This is adequate for a demonstrator, not yet for the planned thousands of SKUs.

There are two apparently obsolete/unused component families (`components/products/*` and `components/ContactForm.tsx`) alongside the active catalog/product/contact implementations. They are a low-priority maintainability issue after direction approval; this audit does not remove them.

### Data-model readiness

`CarsystemProduct` already anticipates useful integrations: ERP/external/BizniSoft identifiers, documents, packages, stock flags, gallery, specifications, related products, and SEO fields. It does not yet model official-style sellable variants as first-class records. Article number, grit/dimension/specification, packaging unit, safety sheet, and availability need to attach to each variant, not remain only free-form product-level text.

The public site correctly avoids public customer-specific pricing. Future B2B price, stock, order quantity, repeat ordering, and history should be an authenticated overlay on the same product/variant truth—not a second catalog.

## A–S comparative findings

### A. Strategic and business fit

Carsystem.org serves global brand presentation and technical product reference. The Serbian site must additionally route retail/professional customers to local supply, represent multiple brands, generate inquiries, and later support authenticated ordering. The local direction therefore has the stronger business fit.

The current local catalog can scale visually beyond 35 items, but not technically to 3,000 products because all products are passed into a client component and filtered in-browser. Server-side search, indexed query handling, real pagination, and a proper variant/category model are required before full import.

### B. Brand alignment

**Align closely:** approved Carsystem logo lockup, official red/black/white/light-neutral palette, photography standards, product packshots, industrial restraint, official product naming, and verified partner wording.

**Keep distinct:** Serbian navigation, multi-brand hierarchy, repair-process discovery, store locator, inquiry system, B2B shell, accessibility, and information density.

The current dark theme is polished but weakens immediate Carsystem recognition when it is the first experience: the official brand is strongly associated with a white field, large red square, black typography, and bright product imagery. Make light mode the primary branded presentation; retain dark as an optional user preference after photography and contrast are validated. The existing small monochrome/outlined header mark should be replaced with an approved local partner lockup, not an improvised imitation.

### C. Visual design quality

The local site is more contemporary in typography, controls, cards, and motion, with stronger task hierarchy and responsive composition. It is also too dense and visually busy in places: the homepage combines process storytelling, animated program deck, locator, support, education placeholders, contact, and multiple repeated CTAs. Placeholder images/cards undermine the otherwise premium finish.

The official site gains authority from large consistent photography, generous white space, condensed industrial headings, and a simple palette. It loses efficiency through oversized empty areas, weak first-screen messaging, inconsistent accessibility, and limited conversion emphasis. Its homepage is image-led but has no `h1` and no explicit above-fold value proposition.

### D. Information architecture

The local site reaches catalog, store locator, or contact in one click and individual products in two. Carsystem.org provides a deeper professional category tree and direct technical-document access, but its global partner/contact paths are less locally actionable.

The Serbian catalog should support both required mental models:

1. **repair-process phase** for users thinking “what step am I working on?”;
2. **professional category/subcategory** for users thinking “I need an abrasive disc / clear coat / masking product.”

Brand is a third browse axis, not the primary category tree. Breadcrumbs should express the stable professional hierarchy (`Katalog > Brušenje > Diskovi > F23`) while phase and brand remain filters/related links. Article-number search must bypass browsing.

### E. Homepage

The official hero communicates brand through imagery but not purpose. The local hero communicates purpose and CTAs but does not immediately look official. The hybrid opening should combine an approved red logo/partner signal, one credible workshop/product photograph, one restrained Serbian value proposition, and two CTAs: `Pregledajte katalog` and `Pronađite prodavnicu`.

Recommended section disposition:

| Current/official section | Disposition | Direction |
|---|---|---|
| Local hero | **Redesign** | Light-first official brand frame; keep Serbian message and two primary CTAs; remove the third competing CTA above fold. |
| Brand logo rail | **Keep, clarify** | Label Carsystem and R-M roles; visually separate partner brands so they are not presented as Carsystem sub-brands. |
| Local five-step process | **Keep, simplify** | Retain as a distinctive discovery path; one static overview plus links, less repeated card copy. |
| Local homepage locator | **Keep our version, fix** | Preserve nearest/city logic; correct zero counters and shorten the on-home treatment. |
| Local animated program deck | **Move/simplify** | Move fuller interaction to `/program`; homepage gets compact category/program access. |
| Local technical support band | **Keep** | One concrete support promise with verified wording and a single CTA. |
| Local education placeholders | **Remove until real** | Do not present contact links as articles/training; add only when owned content exists. |
| Local contact section and final CTA | **Consolidate** | One conversion block; avoid repeating inquiry choices already in header/footer. |
| Official category overview | **Add/adapt** | Add ten professional categories using approved icons/photography and Serbian taxonomy. |
| Official featured/new products | **Add/adapt** | Use 3–4 real, complete, approved products; no carousel required. |
| Official brand/company proof | **Add/adapt** | Local company/partner proof only after claims, dates, and legal naming are approved. |
| Official catalogs/brochures | **Add/adapt** | Create a current document center; show edition/year and owner. |
| Official video/education | **Add later** | Only approved, useful Serbian or subtitled technical content. |
| Official social feed | **Do not copy** | It adds third-party weight and freshness risk without helping core product/store tasks. |
| Official news | **Move off homepage initially** | Add a dated news/resource route only when a publishing owner and cadence exist. |

Preferred mobile order: hero → professional categories → search/catalog entry → selected products → compact process path → locator → verified support/company proof → single CTA.

### F. Catalog and taxonomy

Carsystem.org exposes ten primary categories with meaningful category introductions and stable paginated URLs (eight products per page). Counts observed on 16 July 2026 were: Schleifen 92, Spachteln 57, Abdecken 33, Lackieren 76, Finish 59, Kleben/Beschichten 36, Reinigen 24, Arbeitsschutz 27, Lackierbedarf 39, Werbemittel 19.

Its strengths are depth, professional terminology, indexable category pages, and article/variant detail. Its weaknesses are no useful filters on `/produkte`, limited visible search assistance, repeated generic category meta descriptions, and separation from Serbia-specific language and stock/inquiry needs.

The local catalog has better filters (brand, program, phase, status, type), URL-backed query state for most controls, and richer product context. However:

- it needs a professional category/subcategory hierarchy in addition to process;
- type is not encoded as cleanly as the other query state;
- exact client substring matching is not enough for Serbian synonyms/typos;
- dimensions, grit, substrate, packaging, technology, and compatibility are not first-class facets;
- rendering 35 products at once is acceptable, but 3,000 is not;
- indexable category landing pages should not be replaced by indexable arbitrary filter combinations.

Use server-side paginated category results (24–48 per page), a non-indexed filter layer, and canonical category URLs. “Load more” can enhance the experience, but must preserve page URLs and back-button state.

### G. Product cards

Local cards are more commercially useful: brand, program/phase, use, package, status, inquiry, and detail are available without opening the product. Their product surfaces and hover treatment feel premium. They can become slower to scan because every card carries two actions, multiple metadata bands, and inconsistent real/placeholder imagery.

Official cards scan faster and are photographically consistent but omit information a multi-brand Serbian buyer needs. Keep the local card system, then tighten it to: image, brand, subtype/category, product name, one high-value specification, optional document indicator, and one primary link. Availability should remain truthful (`Na upit`) until integrated. Quick inquiry is useful on desktop but can be secondary on mobile.

### H. Product-detail pages

Official product pages are the clearest area to adapt. The sampled F23 page included multiple images, TDS, nine article/specification rows, description, usage, benefits, and recommended products. Other samples demonstrated per-variant safety-sheet columns, flyers, video, packaging sizes, and application notes.

The local page has better commercial hierarchy, inquiry CTA, process context, related products, mobile CTA, breadcrumbs, canonical metadata, and JSON-LD. It lacks exact official-style variants/article tables and several complete documents. The current thumbnail strip also looks interactive while behaving mostly as a static gallery presentation.

Ideal Serbian hierarchy:

1. Breadcrumb, brand, professional category, and process phase.
2. Product title, verified subtype, short professional purpose, primary packshot/gallery.
3. Primary actions: `Pošaljite upit`; authenticated future actions occupy the same area (`Cena za vaš nalog`, stock, quantity, `Dodaj u porudžbinu`).
4. Variant/article table: article number, specification (grit/dimension/color/size), package unit, sales unit, document links, public availability state. Mobile rows become labelled cards or a horizontally scrollable table with a clear cue.
5. Intended use/application, key benefits, substrate/compatibility, and process guidance.
6. Technical documents: TDS, SDS, flyer, instructions—each with language, version/date, and file type.
7. Compatible system products and related alternatives.
8. Approved video.
9. Store/contact availability and future authenticated order actions.

Avoid exposing prices publicly. Product schema should model product identity and variants; authenticated prices must not enter public HTML or JSON-LD.

### I. Search and discovery

Official global search found F23 exactly by article number `159.218`; exact product wording returned broad related results, a typo returned some useful related discs, and Serbian `brusni disk` produced poor semantic matches. The floating search trigger is a `div` without button semantics, and keyboard submission was inconsistent; clicking the submit control was required in one test.

The local catalog search is visible, keyboard-native, and searches several useful fields, but it is only catalog-local and exact-normalized substring matching. Add a global search entry that groups products, categories, brands, stores, and documents. Use normalized Serbian Latin/Cyrillic aliases, common professional synonyms, exact article-number prioritization, and conservative typo tolerance. Search suggestions should state why a result matched. No-result behavior should offer spelling alternatives, category shortcuts, and technical support—not an empty grid.

### J. Location finder

Keep the local MapLibre implementation. It offers Serbian city/name/address search, geolocation, nearest-location calculation, filterable list, calls, OpenStreetMap directions, clustering, reduced-motion behavior, and a map alternative. This is more useful and more cost-conscious than copying the official Google map.

Carsystem.org provides a global country search and 59-partner list. It corroborates a Serbia entry (`CARSYSTEM Serbia`, CAR SYSTEM I R-M DOO, Ive Andrica 3, 22320 Indjija, +381 22 367 139), but this must be verified by the business before replacing local placeholders. Its finder lacks the local routing emphasis and typo tolerance expected here.

Immediate local issues: the homepage shows `0` locations and `0` cities despite rendering a location; public store records must be approved and consistently marked verified; map/list controls need device and screen-reader validation at full data volume.

### K. Multi-brand architecture

Carsystem should be the most recognisable anchor where the company has approved rights to present that relationship, but it must not make R-M, baslac, SATA, or other brands look like Carsystem-owned sub-brands. The header should identify the local business first, then clearly name its Carsystem/R-M relationship using approved language. Avoid recreating a global Carsystem masthead with other logos inserted beneath it.

Keep independent brand landing pages, a mixed catalog, and browse-by-brand filters. Use neutral brand plates, equal factual structure, and approved assets. Homepage prominence can reflect commercial priority, while taxonomy remains product/category-first.

### L. Conversion and calls to action

The local site is much stronger at catalog → inquiry, locator → call/route, and support routing. The official site excels at product → technical document but is weak at visible sales/support conversion.

Use a stable hierarchy:

- primary public: `Pregledajte katalog` / product-specific `Pošaljite upit`;
- secondary public: `Pronađite prodavnicu` / `Preuzmite tehnički list`;
- tertiary: phone/email/contact topic;
- future authenticated: `Prijavite se`, `Dodaj u porudžbinu`, `Ponovi porudžbinu`.

Do not show inactive B2B controls as if the service exists. A small “B2B portal u pripremi” explanation may be added only when onboarding and launch timing are approved.

### M. Content and credibility

Official strengths: real product photography, detailed technical text, article tables, documents, company history, certifications, and an explicit product-safety link. Weaknesses: old brochure dates (including 2020 material), a visible flyer typo, news without prominent dates, and official claims that vary by page (for example “nearly 70 years” vs. “over 60 years”).

Required before Serbian launch:

- approved legal company name, address, phone, email, registration/footer copy, privacy and cookie position;
- approved wording for official-partner/distributor status and each brand relationship;
- replacement of placeholders in `lib/company-contact.ts`;
- validation/removal of generic claims such as “Brza isporuka” and other unsubstantiated trust-strip wording;
- real approved imagery for every featured product/brand;
- complete product names, article/variant data, package units, TDS/SDS, language/version/date;
- verified store list and ownership of update workflow;
- dated current catalog/brochure library;
- company/about and technical-support pages with named, verifiable capabilities;
- privacy/legal/product-safety links in the footer.

### N. SEO

The local implementation is structurally ahead: static routes, canonical metadata, Organization/Brand/CollectionPage/Product/BreadcrumbList JSON-LD, descriptive Serbian copy, and a 54-URL sitemap in the current demo. Product JSON-LD correctly omits public offers/prices.

Launch issues:

- without `NEXT_PUBLIC_SITE_URL`, served `robots.txt` and sitemap URLs point to `http://localhost:3000`;
- every sitemap entry receives build time as `lastmod`, not true content modification time;
- category landing routes do not yet exist;
- no LocalBusiness/store-detail schema/route exists;
- Product schema needs approved identifiers/variant modeling when real data arrives;
- filter states need explicit `noindex`/canonical handling;
- product image alt and metadata quality depend on currently incomplete data.

Official category pages have canonical links and long useful copy, but sampled product pages lacked canonical links and Product JSON-LD. Official Lighthouse also flagged a relative sitemap URL in robots and invalid `it_IT` hreflang. A direct request to the product sitemap returned a server error during the audit; treat this as a point-in-time observation, not proof of a persistent outage.

**For the 30-product demonstration:** configure the production origin, validate all metadata/claims, keep filters non-indexed, add professional category pages for populated groups, keep one canonical per product, and publish real documents only.

**For the full catalog:** server-side category pagination, persistent variant/article records, stable content `lastmod`, automated sitemap partitioning, brand/category/product schema, controlled facet canonicals, search analytics without private data, and import validation are required.

### O. Accessibility

Local strengths include semantic headings/regions, visible labels, native links/buttons, keyboard-aware comboboxes, map list alternatives, error messages, reduced-motion CSS, and good automated baseline. Local Lighthouse scored 96/100; the detected failure was 9×9 px mobile program carousel dots, below touch-target size.

Manual concerns still requiring validation:

- no obvious skip-to-content link;
- mobile menu and filter sheet lack explicit `dialog`/`aria-modal` semantics, do not mark the background inert, and expose multiple close controls in the accessibility tree;
- gallery thumbnails should become real controls or stop looking selectable;
- map clusters, focus order, escape behavior, and focus restoration need screen-reader/device checks;
- theme/control touch targets should consistently reach at least 24 px automated minimum and preferably 44 px for primary mobile controls.

Official Lighthouse scored 78/100 and flagged unnamed buttons/links, contrast, malformed list semantics, and touch targets. Its floating search/contact `div` controls are not keyboard-semantic. Do not copy these patterns.

### P. Performance and technical quality

The following are **single-run Lighthouse mobile lab measurements**, useful for direction but not a production SLA:

| Metric | Local built homepage | Carsystem.org homepage |
|---|---:|---:|
| Performance score | 46 | 67 |
| Accessibility | 96 | 78 |
| Best practices | 100 | 100 |
| SEO | 100* | 85 |
| FCP | 2.11 s | 3.02 s |
| LCP | 16.00 s | 6.17 s |
| Total blocking time | 1,149 ms | 13 ms |
| CLS | 0 | 0 |
| Transfer | 3.87 MB | 5.55 MB |
| Requests | 70 | 48 |

\*The local SEO score was measured on localhost and does not detect the production-origin misconfiguration described above.

Local measured opportunities were approximately 1.73 MB next-generation image savings, 1.50 MB responsive-image savings, and 192 KiB unused JavaScript. The reported LCP element was the hero media surface; main-thread work was 4.3 s. Build output also shows a 425 KiB first-load JS total for `/` and 394 KiB for `/prodavnice`, largely reflecting motion/map responsibilities. The site has no measured layout shift and prepaints theme to avoid a dark/light flash.

The hybrid redesign must therefore reduce, not add, weight: responsive AVIF/WebP sources, correct `sizes`, a truly priority-loaded hero, lazy-loaded below-fold map, less client-side homepage interactivity, route-level code splitting, and motion that does not delay meaningful paint. No paid service is required.

### Q. Responsive behavior

Both sites stack major content without horizontal overflow in tested portrait views. The local catalog moves filters into a sheet, product cards remain legible, the product detail stacks cleanly, and locator retains a list alternative. Official product tables successfully transform into labelled mobile rows; this is worth adapting.

Local mobile homepage length and control count are high (61 buttons in the accessibility snapshot); locator route exposed 104 buttons including map/location controls. This is functional but cognitively dense. Official mobile search permanently consumes significant header space, and the menu contains some duplicated/hidden submenu content in the accessibility tree. Use the local compact-header pattern, add a discoverable search action, and validate true landscape on physical Safari/Chrome.

### R. Motion and interaction

Official motion is restrained; its authority mainly comes from imagery and scale. Local motion adds polish through route/theme transitions, process states, hover surfaces, program progression, and pointer effects, but the combined system can compete with professional product discovery and contributes to JavaScript/main-thread cost.

Recommended hierarchy:

- **Essential:** focus/pressed/loading/error state, menu/filter transitions, clear route feedback, map selection, reduced-motion support.
- **Useful:** brief product-card reveal, process selection, theme transition, one subtle hero entrance after content is visible.
- **Decorative:** cursor pigment, continuous ambient movement, autoplay/progress choreography, large route overlays.
- **Remove or disable by default:** any motion delaying hero/product content, pointer-only effects on coarse pointers, continuous effects while offscreen, or duplicate reveal systems.

Keep durations short (roughly 120–240 ms for controls, up to 400 ms for section transitions), stop autoplay after interaction, and treat `prefers-reduced-motion` as a complete static mode.

### S. Maintainability and future development

The active components are reasonably separated, CSS modules constrain complex pages, design tokens/themes are centralized, and static data types document future ERP fields. Risks are content ownership, duplicate component families, monolithic local data, all-client catalog filtering, broad homepage client behavior, placeholder assets, and no explicit import validation pipeline.

Recommended ownership model:

- product master/variant/article identifiers: BizniSoft/import owner;
- public names, descriptions, taxonomy, SEO: marketing + technical reviewer;
- TDS/SDS/versioning: technical/product-safety owner;
- store records: sales-network owner with approval state;
- images: documented crop/background/rights standard;
- brand claims/assets: owner/legal approval;
- releases: automated lint → typecheck → build → smoke/accessibility checks in sequence.

A paid CMS is not required for Phase 1. Validated CSV/XLSX imports into a normalized self-owned data store are the cost-conscious next step. Translation support should be modeled but not exposed until content ownership exists.

## Scorecard

Scores are relative audit judgments (1 = poor, 10 = excellent), not compliance certifications. The hybrid target assumes the P0/P1 recommendations are completed.

| Criterion | Current Serbia | Carsystem.org | Hybrid target |
|---|---:|---:|---:|
| Brand alignment | 6 | 10 | 9 |
| Modern visual quality | 8 | 7 | 9 |
| Product discoverability | 8 | 6 | 9 |
| Catalog scalability | 6 | 8 | 9 |
| Product-detail quality | 6 | 9 | 9 |
| Technical-document access | 6 | 9 | 9 |
| Mobile UX | 8 | 7 | 9 |
| Accessibility | 8 | 5 | 9 |
| Performance | 5 | 6 | 8 |
| SEO | 8 | 6 | 9 |
| Local-market usefulness | 9 | 4 | 10 |
| B2B readiness | 8 | 3 | 9 |
| Conversion quality | 9 | 5 | 9 |
| Maintainability | 7 | 6 | 9 |
| Trust and authority | 5 | 9 | 9 |
| **Total** | **107/150** | **100/150** | **135/150** |

The current site wins usefulness and conversion; the official site wins recognition, technical depth, and established authority. Neither is the right direct template for the final Serbian platform.

## Three strategic options

| Dimension | Option A — Keep current | Option B — Strong official alignment | Option C — Controlled hybrid |
|---|---|---|---|
| Benefits | Fastest; preserves all work; strong Serbian UX and B2B path. | Immediately familiar to owner; strong Carsystem recognition; easier visual reference. | Combines official authority/technical depth with local utility, multi-brand clarity, accessibility, and B2B future. |
| Disadvantages | Brand gap and placeholder content remain conspicuous; owner concern only partly addressed. | Risks clone appearance, weaker conversion, single-brand mismatch, dated/inaccessible patterns, and discarded work. | Requires disciplined design system and content/data approval; more decisions than cosmetic polish. |
| Implementation cost | Low–medium | High | Medium–high, phased |
| Likely owner reaction | May feel insufficiently changed. | Strong initial visual approval; later concern if utility regresses. | Positive if the first visible milestone clearly changes logo, light palette, photography, header, and product detail. |
| Likely customer reaction | Useful but not fully authoritative. | Familiar Carsystem look, but poorer Serbia/multi-brand task completion. | Clearest mix of trust, speed, product facts, stores, and support. |
| Long-term scalability | Medium | Low–medium for multi-brand/B2B | High |
| Risk of looking unofficial | Medium–high | Medium (clone/rights ambiguity) | Low if partner wording/assets are approved |
| Risk of looking outdated | Low | High | Low |
| Risk of wasting completed work | Low | High | Low–medium |
| Recommendation | Not sufficient alone | Do not choose | **Choose** |

### Recommended phased expression of Option C

1. **P0 truth and launch integrity:** approve identity/claims/contact/store/product data; fix homepage counters and production origin; add legal/product-safety footer paths.
2. **P1 visible owner-alignment milestone:** approved logo/partner lockup, light-first palette, photography standard, simpler header/hero/homepage, professional category entry.
3. **P1 product authority:** category routes, article/variant model, specification table, TDS/SDS/flyer architecture, card simplification, global/article search design.
4. **P1/P2 performance and accessibility:** hero images, lazy map, motion reduction, menu/filter semantics, touch targets, physical device checks.
5. **P2 platform scale:** server search/pagination, validated imports, store detail/LocalBusiness, content ownership, authenticated B2B overlay.

## Unresolved decisions requiring owner/business input

1. What exact Serbian legal/marketing phrase may describe the Carsystem relationship, and which official logo/lockup assets are approved?
2. Should the first experience be light-only, light-default with optional dark, or theme-following? Audit recommendation: light-default, optional dark.
3. What is the verified public company contact information? The repository placeholder conflicts with the Serbia entry on Carsystem.org.
4. Which brands are active at launch, in what commercial order, and which logo/image assets are approved?
5. Who owns product article/variant data and document version approval, and which source is authoritative before BizniSoft integration?
6. Which partner/store locations may be public, and who approves changes?
7. Is there a maintained source for catalogs, education, video, and news? If not, those sections should remain absent.
8. Which claims—delivery speed, technical support coverage, partner-network status, history, certifications—can be evidenced and approved?

## Final recommendation

Approve **Option C — controlled hybrid**. The redesign brief should explicitly require Carsystem recognisability through approved identity, light palette, photography, technical product structure, and professional taxonomy, while protecting the local site's stronger discovery, multi-brand, locator, conversion, accessibility, and future B2B architecture. The decision matrix contains the implementation-level classifications and priorities.
