# AGENTS.md — Rules for AI Coding Agents

## Mission

Build a premium, maintainable, cost-conscious website and future B2B platform for Carsystem i R-M Inđija.

This project must be treated as both:

1. a real business system for automotive refinish distribution in Serbia,
2. a flagship Studio One showcase project.

## Non-Negotiable Rules

1. Do not add paid monthly services without explicit approval.
2. Do not expose private B2B prices publicly.
3. Do not invent legal/brand claims.
4. Do not build heavy animation without mobile and reduced-motion fallback.
5. Do not skip validation.
6. Do not make unrelated refactors while implementing a focused task.
7. Do not store secrets in code.
8. Do not use external assets/logos unless they are approved or placeholders.

## Preferred Workflow

Use PIV:

1. Plan
2. Implement
3. Validate

For every feature:

- define expected behavior,
- identify affected files,
- implement smallest useful slice,
- validate with lint/typecheck/build,
- manually inspect responsive states when UI is affected.

## First Phase Priority

The first phase is not backend. The first phase is:

- homepage design,
- design system,
- visual identity,
- partner locator CTA concept,
- catalog preview,
- future B2B preview,
- responsive UI.

Do not overbuild backend in Phase 1.

## Business Priorities

Highest priorities:

1. Partner store locator and local routing.
2. Premium presentation of brand/product ecosystem.
3. Clear catalog structure.
4. Future B2B login/pricing readiness.
5. Technical support positioning.
6. SEO architecture for Serbia.

## Language and Copy

Public-facing copy should be Serbian latinica.

Tone:

- professional,
- confident,
- premium,
- clear for non-experts,
- credible for professionals.

Avoid cheesy, exaggerated copy.

## Design Direction

Desired feel:

- high-tech automotive,
- premium refinish industry,
- dark/light theme capable,
- polished and modern,
- visually strong enough for portfolio.

Design should not look like a generic ecommerce theme.

## Cost-Conscious Technology

Prefer:

- Next.js,
- TypeScript,
- Tailwind,
- open-source UI patterns,
- OpenStreetMap/Leaflet,
- CSV/XLSX import,
- local or self-owned data flows.

Avoid unless approved:

- Algolia,
- Mapbox/Google Maps paid usage,
- paid CMS,
- paid form tools,
- paid animation plugins,
- paid no-code automations,
- unnecessary AI/SaaS dependencies.

## Data Model Awareness

Future system includes:

- products,
- brands,
- categories,
- partner stores,
- regions,
- users,
- sales reps,
- customers,
- discount rules,
- inquiries,
- imports.

Do not design components in a way that blocks this later.

## Validation Checklist

Before reporting done:

- [ ] lint passes or missing script is reported,
- [ ] typecheck passes or missing script is reported,
- [ ] build passes or blocking issue is explained,
- [ ] affected UI checked on mobile,
- [ ] no private data exposed,
- [ ] no paid tool added,
- [ ] no unrelated files changed.

## Reporting Format

When finishing work, report:

- what changed,
- files changed,
- validation run,
- known limitations,
- next recommended step.
