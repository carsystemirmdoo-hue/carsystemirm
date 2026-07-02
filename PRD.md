# PRD — Carsystem i R-M Inđija Website & B2B Platform

## 1. Executive Summary

Carsystem i R-M Inđija website is planned as a premium automotive refinish platform for the Serbian market. The project combines a high-end public website, partner/store locator, product catalog, and future B2B login system with customer-specific prices, discounts, sales representatives, regions, partner stores, and admin workflows.

The public website must immediately communicate that the company is a serious wholesale/distribution player connected with premium automotive refinish brands. It must not look like a basic catalog. It should feel like a high-tech, premium, modern automotive system that can also be used as a flagship Studio One case study.

MVP goal: launch a visually exceptional homepage and design system first, with architecture prepared for catalog, partners, SEO pages, login, admin, pricing and discount logic.

## 2. Mission

Help end customers in Serbia find the right automotive refinish products and the nearest partner store, while giving Carsystem i R-M a scalable digital system for B2B sales, partner support, customer pricing and product management.

## 3. Product Positioning

The website should position Carsystem i R-M Inđija as:

- a serious Serbian distributor/wholesale player,
- a trusted partner for paint shops, services, stores and professional users,
- a company with strong brands and technical knowledge,
- a company that supports partners, instead of bypassing them,
- a premium digital-first automotive refinish business.

## 4. Core Value Proposition

For end customers:

> Find professional automotive paint, refinishing and preparation products, then get directed to the nearest trusted partner store in Serbia.

For partner stores:

> Become more visible and receive better-qualified local demand from customers looking for products in your area.

For B2B customers:

> Log in, view your own prices, check product data and send structured purchase inquiries.

For the company:

> Centralize catalog, customer relationships, partner stores, regions, discounts and sales workflows in one controlled platform.

## 5. Target Users

### End customer

- Wants to find product or category.
- Needs guidance and nearest store.
- May not understand professional terminology.
- Should be guided clearly.

### Professional buyer

- Paint shop, body shop, service, workshop.
- Needs product data, technical sheets, prices, support and repeat orders.

### Partner store

- Sells Carsystem/R-M ecosystem products locally.
- Needs visibility and customer flow.

### Sales representative

- Manages customers in a region.
- Needs visibility into assigned customers, new signups and discount settings.

### Admin

- Manages products, partners, users, sales reps, regions, discounts and imports.

## 6. MVP Scope

### MVP Phase 1 — Design Showcase

Required:

- homepage concept,
- design system,
- dark/light theme direction,
- premium hero section,
- partner locator CTA concept,
- brand strip,
- catalog preview,
- partner preview,
- technical support section,
- responsive design,
- strong mobile experience,
- Studio One footer credit placeholder.

Not required in Phase 1:

- real authentication,
- live product database,
- real pricing logic,
- real admin dashboard,
- full partner map implementation,
- full SEO article system.

### MVP Phase 2 — Public Website

Required:

- homepage,
- catalog landing,
- categories,
- brand/category SEO pages,
- partner locator/map,
- partner detail pages,
- contact forms,
- product inquiry flow,
- basic CMS/admin for public content or static config files.

### MVP Phase 3 — B2B Platform

Required:

- login,
- customer accounts,
- sales representative accounts,
- admin role,
- product import,
- customer-specific pricing,
- discounts by brand/category/product,
- product inquiry/cart-like B2B flow,
- notifications for new registrations,
- dashboard charts.

## 7. Functional Requirements

### 7.1 Partner Locator

- User can click “Pronađi najbližu prodavnicu”.
- Browser asks for location permission.
- If permission is granted, nearest partner stores are shown.
- If permission is denied, user can manually choose city/region.
- Partner cards show name, address, phone, city, region, working hours and directions.
- Partner data must be editable by admin later.

### 7.2 Catalog

- Product catalog must support around 3000 products.
- Product list must support filters by brand, category, subcategory and search.
- Product page must support images, description, SKU, brand, technical sheets, safety sheets, package options and variants.
- Logged-out users see inquiry CTA.
- Logged-in users see their own prices.

### 7.3 Registration

- New user can create account.
- User selects type: store, service, workshop, individual, other.
- User enters PIB or marks no PIB.
- User enters city/region and contact details.
- System routes new signup to relevant sales rep and admin.

### 7.4 Pricing and Discounts

- Base product price can be imported in bulk.
- Discounts can be assigned by brand, category, product group or individual product.
- Discounts can be imported in bulk.
- Sales reps can edit discounts for their assigned customers, subject to company policy.
- Customer sees calculated price after login.

### 7.5 Admin

- Admin manages all products, partners, users, regions, reps, discounts and inquiries.
- Admin can bulk import products.
- Admin can bulk import discount rules.
- Admin can reassign customers between reps.
- Admin can see high-level stats.

### 7.6 Sales Rep Panel

- Sales rep sees assigned customers.
- Sales rep sees new registrations in their region.
- Sales rep can manage discounts for their customers.
- Sales rep can view customer inquiries.
- Sales rep can see simple charts.

## 8. Non-Functional Requirements

### Performance

- Homepage animation must not destroy load speed.
- Heavy 3D/video effects need mobile fallback.
- Product catalog must be paginated or virtualized.
- Images must be optimized.

### SEO

- Use semantic HTML.
- Support metadata per page.
- Prepare pages for brands, categories, locations and education/blog.
- Avoid JavaScript-only content for SEO-critical pages.

### Accessibility

- Keyboard navigation.
- Proper contrast.
- Visible focus states.
- Form labels.
- Reduced motion fallback.

### Maintainability

- Clear component structure.
- Design tokens.
- Data access separated from UI.
- Documented rules in `CLAUDE.md` and `AGENTS.md`.

### Cost Control

- Avoid paid monthly tools unless explicitly approved.
- Prefer open-source/custom/local-first solutions.

## 9. Suggested Technical Direction

Preferred frontend:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Component-based design system
- Framer Motion or Motion for animations
- Three.js / React Three Fiber only where justified
- Leaflet + OpenStreetMap for maps

Backend options to evaluate later:

- Postgres with Prisma or Drizzle
- Auth.js or custom auth
- Server actions/API routes
- CSV/XLSX import pipeline
- File storage strategy decided later

No paid SaaS dependency should be introduced without approval.

## 10. Success Criteria

### Phase 1 success

- Homepage looks visually stronger than typical Serbian B2B/catalog websites.
- Design clearly communicates premium automotive refinish positioning.
- CTA to nearest partner store is obvious.
- Mobile design is polished.
- Project is strong enough for Studio One portfolio.

### Later success

- Customers can find partner stores.
- Partners receive more relevant leads.
- B2B users can log in and view their prices.
- Admin can manage products and discounts without developer intervention.
- Sales reps can manage their customer relationships by region.

## 11. Open Decisions

- Exact public pricing policy.
- Exact legal wording for brand/distribution claims.
- Final category taxonomy.
- Final product import source/format.
- Final hosting/database plan.
- Whether discount change history is required.
- Whether brand pages are separate pages or combined into SEO hubs.
