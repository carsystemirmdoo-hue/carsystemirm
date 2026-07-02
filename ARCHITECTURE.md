# Architecture Draft — Carsystem i R-M

## 1. Architectural Goal

Build the project as a scalable public website first, then evolve into a B2B platform without rewriting everything.

The architecture must support:

- high-end public frontend,
- partner locator,
- SEO pages,
- product catalog,
- login and role-based dashboards,
- customer-specific prices,
- discounts,
- bulk imports,
- admin management.

## 2. Suggested Application Structure

```txt
app/
  page.tsx
  katalog/
    page.tsx
    [category]/page.tsx
  proizvodi/
    [slug]/page.tsx
  brendovi/
    page.tsx
    [brand]/page.tsx
  partneri/
    page.tsx
    [slug]/page.tsx
  tehnicka-podrska/
    page.tsx
  edukacija/
    page.tsx
    [slug]/page.tsx
  kontakt/
    page.tsx
  login/
    page.tsx
  dashboard/
    page.tsx
  admin/
    page.tsx
components/
  layout/
  sections/
  ui/
  catalog/
  partners/
  dashboard/
lib/
  data/
  pricing/
  geo/
  validation/
  seo/
  utils/
content/
  placeholder-data/
  legal-copy/
public/
  images/
  brands/
  products/
```

## 3. Public Frontend Modules

### Homepage

- Hero/refinish story.
- Partner locator CTA.
- Brand ecosystem.
- Catalog preview.
- Partner network.
- Technical support.
- B2B login preview.
- Footer.

### Catalog

- Product listing.
- Search/filter.
- Product cards.
- Product details.
- Inquiry CTA.
- Future price visibility logic.

### Partner Locator

- Location permission.
- Manual city/region selector.
- Store cards.
- Map view.
- Directions link.

### SEO/Education

- Category pages.
- Brand pages.
- Location pages.
- Educational articles.

## 4. Future Backend Modules

### Auth

Roles:

- admin,
- sales_rep,
- customer,
- partner_store.

### Product Import

- CSV/XLSX upload.
- Validation step.
- Preview before import.
- Error rows report.
- Upsert products by SKU.

### Discount Engine

Priority needs to be defined. Suggested rough order:

1. individual product/customer override,
2. product-specific rule,
3. category/group rule,
4. brand rule,
5. default customer discount,
6. base price.

This must be tested before production use.

### Partner Routing

- User location or selected city maps to nearest partner.
- New signup maps to region.
- Region maps to sales rep.

## 5. Cost-Control Architecture

### Maps

Use Leaflet + OpenStreetMap by default.

### Search

Start with database search and filters. Avoid paid search until proven necessary.

### CMS

Start with code/content files or internal admin. Avoid paid CMS.

### Forms/Notifications

Use built-in app routes or existing SMTP. Avoid paid form tools if possible.

### Analytics

Use privacy-friendly, low-cost/free option only if approved. Avoid adding tracking by default.

## 6. Performance Strategy

- Keep 3D/video hero optional and lazy-loaded.
- Use optimized images.
- Use reduced-motion fallback.
- Use mobile-specific simpler animation.
- Use pagination or virtualization for catalog.
- Avoid loading all 3000 products on the client.

## 7. SEO Strategy

SEO pages should be server-rendered where possible.

Use clean URLs:

```txt
/brendovi/rm
/brendovi/carsystem
/katalog/lakovi
/katalog/poliranje
/partneri/novi-sad
/edukacija/kako-izabrati-lak-za-automobil
```

## 8. Security Notes

- Never expose private pricing in public API responses.
- Protect dashboard and admin routes.
- Validate imports.
- Sanitize user input.
- Store roles server-side.
- Avoid trusting client-side discount calculations.
