# TODO — Carsystem i R-M Project Roadmap

## Phase 0 — Project Setup and Rules

- [ ] Create repository.
- [ ] Add `CLAUDE.md`.
- [ ] Add `AGENTS.md`.
- [ ] Add this `TODO.md`.
- [ ] Add `MASTER_REQUIREMENTS.md`.
- [ ] Add `PRD.md`.
- [ ] Decide initial stack.
- [ ] Create design assets folder.
- [ ] Add brand logo placeholders only if official assets are not ready.
- [ ] Define no-paid-tools rule in project docs.

## Phase 1 — Claude Design / Homepage Concept

- [ ] Use `CLAUDE_DESIGN_PROMPT.md` as starting prompt.
- [ ] Generate homepage concept.
- [ ] Validate desktop design.
- [ ] Validate mobile design.
- [ ] Confirm hero direction.
- [ ] Confirm dark/light theme direction.
- [ ] Confirm partner locator CTA placement.
- [ ] Confirm brand strip treatment.
- [ ] Confirm catalog preview section.
- [ ] Confirm technical support section.
- [ ] Confirm footer and Studio One credit.

## Phase 2 — Frontend Build Foundation

- [ ] Initialize Next.js + TypeScript project.
- [ ] Configure Tailwind.
- [ ] Add design tokens.
- [ ] Create layout structure.
- [ ] Create typography system.
- [ ] Create button components.
- [ ] Create card components.
- [ ] Create section wrapper components.
- [ ] Create theme toggle.
- [ ] Implement homepage without backend.
- [ ] Add responsive states.
- [ ] Add reduced motion support.
- [ ] Run lint/build.

## Phase 3 — Public Website Pages

- [ ] Homepage.
- [ ] Catalog landing page.
- [ ] Category page template.
- [ ] Product page template.
- [ ] Brands page.
- [ ] Partner stores page.
- [ ] Partner detail page.
- [ ] Technical support page.
- [ ] About page.
- [ ] Contact page.
- [ ] Blog/education landing page.
- [ ] Article template.

## Phase 4 — Partner Locator

- [ ] Define partner store schema.
- [ ] Add sample partner data.
- [ ] Implement city/region filter.
- [ ] Implement browser geolocation request.
- [ ] Implement nearest store calculation.
- [ ] Implement fallback if location is denied.
- [ ] Add map with Leaflet/OpenStreetMap.
- [ ] Add directions link.
- [ ] Add partner detail pages.
- [ ] Optimize mobile map experience.

## Phase 5 — Catalog Data Preparation

- [ ] Define product schema.
- [ ] Define category taxonomy.
- [ ] Define brand taxonomy.
- [ ] Define product import format.
- [ ] Create CSV/XLSX import template.
- [ ] Add validation rules for import.
- [ ] Add sample product data.
- [ ] Implement product search.
- [ ] Implement filters.
- [ ] Implement product detail.
- [ ] Implement technical/safety sheet attachment fields.

## Phase 6 — B2B Auth and Roles

- [ ] Decide auth implementation.
- [ ] Create roles: admin, sales_rep, customer, partner_store.
- [ ] Implement registration form.
- [ ] Add PIB/no-PIB logic.
- [ ] Add region selection.
- [ ] Add account approval flow.
- [ ] Add admin notification for new signup.
- [ ] Add sales rep notification for regional signup.
- [ ] Add login page.
- [ ] Add protected dashboard routes.

## Phase 7 — Pricing and Discounts

- [ ] Define price fields.
- [ ] Define discount priority rules.
- [ ] Support discount by brand.
- [ ] Support discount by category/product group.
- [ ] Support discount by individual product.
- [ ] Support customer-specific discount.
- [ ] Support bulk discount import.
- [ ] Show calculated customer price after login.
- [ ] Prevent logged-out users from seeing private prices.
- [ ] Add tests for price calculation.

## Phase 8 — Sales Rep Dashboard

- [ ] Assigned customer list.
- [ ] Customer profile page.
- [ ] New regional signups.
- [ ] Discount management for assigned customers.
- [ ] Customer inquiry list.
- [ ] Basic charts.
- [ ] Customer transfer request/visibility rules.

## Phase 9 — Admin Dashboard

- [ ] Product management.
- [ ] Bulk product import.
- [ ] Partner store management.
- [ ] User management.
- [ ] Sales rep management.
- [ ] Region management.
- [ ] Discount management.
- [ ] Bulk discount import.
- [ ] Customer reassignment.
- [ ] Inquiry overview.
- [ ] Dashboard metrics.

## Phase 10 — SEO and Content

- [ ] Define brand SEO pages.
- [ ] Define category SEO pages.
- [ ] Define city/region SEO pages for partner stores.
- [ ] Add educational article plan.
- [ ] Add structured metadata.
- [ ] Add sitemap.
- [ ] Add robots.txt.
- [ ] Add OpenGraph images.
- [ ] Add internal linking strategy.

## Phase 11 — Validation

- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run build.
- [ ] Test desktop.
- [ ] Test tablet.
- [ ] Test mobile.
- [ ] Test forms.
- [ ] Test map fallback.
- [ ] Test accessibility basics.
- [ ] Test SEO metadata.
- [ ] Test no price leak for logged-out users.

## Phase 12 — Launch Prep

- [ ] Confirm legal brand wording.
- [ ] Confirm official logos/assets.
- [ ] Confirm partner store data.
- [ ] Confirm contact routing.
- [ ] Confirm privacy policy.
- [ ] Confirm cookie/legal requirements if analytics are used.
- [ ] Deploy staging.
- [ ] Final QA.
- [ ] Deploy production.
