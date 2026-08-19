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

## 11. Odluke — poslovni sistem (faza 1, 15.08.2026)

Interni poslovni sistem na `/portal` je dobio bazu, prijavu i ovlašćivanje.
Odabrane su samo besplatne i otvorene komponente; **nijedan plaćeni mesečni alat
nije uveden**.

| Potreba | Odabrano | Trošak | Zašto ne nešto drugo |
|---|---|---|---|
| Baza | Postgres na Neon ili Supabase besplatnom nivou | 0 | Odgovara `ARCHITECTURE.md`. Plaćeni nivo tek kada obim faktura to zatraži |
| Pristup bazi i migracije | `drizzle-orm` + `drizzle-kit` | 0, MIT | Bez plaćenog sloja; migracije su obični SQL fajlovi u repozitorijumu |
| Drajver | `postgres` (postgres.js) | 0, Unlicense | — |
| Prijava | `next-auth` (Auth.js v5), credentials | 0, ISC | Bez plaćenog servisa za identitet |
| Lozinke | `scrypt` iz `node:crypto` | 0 | Bez dodatne zavisnosti tipa bcrypt |
| Provera unosa | `zod` | 0, MIT | — |
| Granica server/klijent | `server-only` | 0, MIT | Sprečava da kod za bazu završi u pregledaču |

Zadržano kao pravilo za naredne faze:

- **BEX** se koristi kao postojeći ugovoreni prevoznik; integracija ne uvodi nov
  mesečni trošak. Procenjeni i fakturisani trošak isporuke se vode odvojeno i
  ništa se ne knjiži automatski.
- **Bez integracije sa bankom.** Ne traže se, ne čuvaju i ne obrađuju bankarski
  pristupni podaci, i nijedno plaćanje se ne pokreće.
- Izvoz u XLSX, CSV i PDF se radi otvorenim bibliotekama, bez plaćenih servisa za
  generisanje dokumenata.
- Uvoz faktura ide preko sopstvenog lokalnog konektora, bez platforme za
  automatizaciju sa pretplatom.
