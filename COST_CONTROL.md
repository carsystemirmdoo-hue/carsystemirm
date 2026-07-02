# Cost Control Rules — Carsystem i R-M

## 1. Main Rule

The project should avoid monthly paid tools wherever possible.

The company prefers slower/custom implementation over unnecessary recurring costs.

## 2. Default Decision Principle

Before adding any external service, ask:

1. Can we build this ourselves reasonably?
2. Is there an open-source library?
3. Can this be handled by the existing hosting/database?
4. Is the paid service critical, or just convenient?
5. What happens if the monthly cost increases?

If the paid tool is not essential, do not add it.

## 3. Maps

Default:

- Leaflet + OpenStreetMap.

Avoid by default:

- paid Google Maps usage,
- paid Mapbox plan,
- geocoding APIs that become expensive.

Manual lat/lng can be stored for partner stores.

## 4. Search

Default:

- database search,
- filters,
- indexed columns,
- simple full-text search if needed.

Avoid by default:

- Algolia,
- Typesense Cloud,
- paid hosted search.

Self-hosted Typesense/Meilisearch can be evaluated later only if catalog search becomes too weak.

## 5. CMS

Default:

- static content files,
- internal admin,
- database-managed content.

Avoid by default:

- paid CMS subscriptions.

## 6. Forms and Notifications

Default:

- app API routes,
- database-stored inquiries,
- SMTP using approved email provider,
- internal dashboard notifications.

Avoid by default:

- paid form tools,
- paid automation tools.

## 7. Analytics

Default:

- no analytics until launch decision,
- privacy-friendly option if needed.

Avoid by default:

- heavy tracking,
- expensive analytics suites.

## 8. Animation and 3D

Default:

- CSS,
- Motion/Framer Motion,
- Three.js only where justified,
- video/image sequence locally hosted if optimized.

Avoid by default:

- paid animation plugins,
- heavy assets that require expensive hosting/CDN,
- desktop-only effects with no mobile fallback.

## 9. Product Import

Default:

- CSV/XLSX import in admin.

Avoid by default:

- paid integration platforms,
- automation SaaS,
- recurring data-sync tools unless truly needed.

## 10. Approval Requirement

If an agent or developer proposes a paid tool, they must document:

- tool name,
- monthly cost,
- why it is needed,
- free/custom alternative,
- risk if removed later,
- recommendation.

No paid tool should be implemented without explicit approval.
