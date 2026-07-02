# CLAUDE.md — Carsystem i R-M Inđija

This file gives Claude Code instructions when working in this repository.

## Project Overview

This project is a premium Serbian automotive refinish distributor website and future B2B platform for **Carsystem i R-M Inđija d.o.o.** It must function as a public brand presentation, partner store locator, catalog, future login-based pricing system, sales representative dashboard and admin-controlled product/discount platform. It is also intended as a flagship Studio One portfolio project, so visual quality matters.

## Core Product Intent

The website should not be treated as a generic catalog. It should communicate a serious, high-tech, premium automotive refinish ecosystem.

Primary public CTA:

> Pronađi najbližu prodavnicu

The public flow should guide end customers toward the nearest partner store in Serbia. Partner store success is a primary business objective.

## Cost Control Rule

Do not add paid monthly SaaS tools without explicit approval.

Prefer:

- open-source libraries,
- custom implementation,
- local/config/database-managed content,
- browser-native APIs,
- OpenStreetMap/Leaflet for maps,
- self-owned admin flows,
- CSV/XLSX imports,
- local or approved storage.

Avoid by default:

- paid map APIs,
- paid search APIs,
- paid CMS platforms,
- paid animation libraries or locked plugins,
- paid analytics unless explicitly approved,
- unnecessary external SaaS dependencies.

## Suggested Stack

| Technology | Purpose |
|------------|---------|
| Next.js App Router | Frontend and full-stack app structure |
| TypeScript | Type safety |
| Tailwind CSS | Styling and design system |
| Postgres | Future relational data model |
| Prisma or Drizzle | Future database ORM/query layer |
| Auth.js or custom auth | Future authentication |
| Leaflet + OpenStreetMap | Partner store locator/map |
| Motion/Framer Motion | UI animation where justified |
| Three.js / React Three Fiber | Optional 3D only if performance remains acceptable |

If the repository already has a chosen stack, follow the existing stack instead of replacing it.

## Required Documentation Awareness

Before major work, read:

- `MASTER_REQUIREMENTS.md`
- `PRD.md`
- `TODO.md`
- `ARCHITECTURE.md`
- `DATA_MODEL_DRAFT.md`
- `UI_DESIGN_BRIEF.md`
- `COST_CONTROL.md`

## Development Commands

Adjust commands based on actual package manager.

```bash
# Install
npm install

# Development
npm run dev

# Lint
npm run lint

# Typecheck
npm run typecheck

# Build
npm run build
```

If scripts do not exist, inspect `package.json` and use the correct commands.

## Architecture Principles

- Keep UI components reusable and section-based.
- Keep data access separate from visual components.
- Keep business logic such as price calculation outside React components.
- Never expose private prices to logged-out users.
- Design public pages to be SEO-friendly.
- Heavy animation must have reduced-motion and mobile fallbacks.
- Do not hardcode long-term business data inside components if it should later be editable.

## Roles to Support Later

- `admin`
- `sales_rep`
- `customer`
- `partner_store`

Do not implement role logic until the feature plan is clear, but avoid architecture that makes it hard later.

## Product and Pricing Rules

Future catalog must support:

- around 3000 products,
- brand/category/product group filters,
- logged-out inquiry flow,
- logged-in customer-specific prices,
- discounts by brand, category/group, product and customer,
- bulk product import,
- bulk discount import.

Pricing logic must be tested before production use.

## Partner Locator Rules

The store locator must support:

- browser geolocation,
- manual city/region fallback,
- nearest partner calculation,
- partner cards,
- map/list view,
- mobile usability.

Use Leaflet/OpenStreetMap unless explicitly approved otherwise.

## Brand and Legal Safety

Do not invent legal claims about brands, distribution rights or official status. Use placeholder/safe wording until final approved copy is provided.

Allowed safe wording examples:

- “profesionalni refinish program”
- “brendovi u ponudi”
- “partnerska mreža”
- “tehnička podrška”

Risky wording must be confirmed before use:

- “zvanični distributer”
- “ovlašćeni zastupnik”
- “ekskluzivni partner”

## UI/UX Rules

- Premium, high-tech, automotive, precise.
- Do not use generic template sections.
- Mobile must be polished, not an afterthought.
- Use clear CTAs.
- Avoid excessive popups.
- Partner locator widget should be subtle and useful.
- Use strong spacing and typography.
- Dark/light theme should be supported if practical.

## SEO Rules

- Use Serbian latinica.
- Public pages should be server-renderable where possible.
- Prepare architecture for brand pages, category pages, location pages and education/blog.
- Avoid hiding SEO-critical text inside canvas-only animations.

## Validation Before Completion

For any code task, run the available checks:

```bash
npm run lint
npm run typecheck
npm run build
```

If a command is missing, state that clearly and use the closest available validation.

## Working Method

Follow Plan → Implement → Validate.

For non-trivial changes:

1. inspect existing structure,
2. write a short plan,
3. implement in small steps,
4. validate with commands,
5. report changed files and remaining risks.

Do not make broad unrelated changes.
