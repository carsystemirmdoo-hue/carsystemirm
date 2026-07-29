# SEO i regresioni testovi

Datum: 2026-07-29
Okruženje: lokalni Next.js production build

| Provera | Rezultat |
| --- | --- |
| npm run typecheck | prošao |
| npm run lint | prošao |
| npm run build | prošao; 897/897 statičkih stranica generisano |
| npm run seo:audit | prošao; 896 ruta auditovano, 872 indeksabilne, 0 kritičnih SEO nedostataka |
| npm run seo:validate | prošao; 872 sitemap URL-a, 832 PDP-a, 59 R-M PDP-a, 117 PDF-a, 0 failures, 0 warnings |
| npm run seo:og | prošao; 59 R-M OG slika |
| npm run seo:docs | prošao; 59/59 R-M statusa prošlo |
| npm run seo:evidence | prošao; sitemap 872, robots/PDF/query/redirect/404 dokazi sačuvani |
| npm run rm:validate | prošao; 59 proizvoda, 59 product PDF-a, 58 technical PDF-a, 3 content review stavke |
| npm run test:catalog | prošao; 4/4 testa |
| npm run test:product-motion | prošao; 18/18 testova |
| npm run locations:validate | prošao; 91 marker, 0 list-only, bez zabranjenih polja |
| npm run cosmos:validate | prošao; 742 objavljene varijante, 34 neizvesna fajla isključena |
| git diff --check | prošao |

## Browser i responsive

- Ručno pregledano na 1440 × 1000 i 390 × 844.
- Uzorci: početna, katalog, R-M brand, R-M A 2220 PDP i prodavnice.
- Horizontalni overflow: nije pronađen.
- H1: po jedan na svakom uzorku.
- Browser console: bez error/warning zapisa na pregledanim rutama.
- Mobilni R-M dupli breadcrumb primećen tokom QA i uklonjen pre finalnog builda.
- Finalni Lighthouse kontakt run nema runtime error ni run warning.

## Validator obuhvat

- Svaki sitemap URL vraća 200 i ima title, description, canonical, H1, OG image i JSON-LD.
- Svih 832 PDP canonical URL-ova je jedinstveno.
- Svih 59 R-M PDP stranica ima kod u title-u, Product + BreadcrumbList i posebnu 1200 × 630 OG sliku.
- Nema Product Offer/cene/lagera/recenzije.
- Filter/contact query URL-ovi imaju X-Robots-Tag noindex i čist canonical.
- Preview/demo/draft rute nisu indeksabilne.
- 404 vraća 404, ima noindex i nema canonical na početnu.
- H 2P15 duplikat vraća 308 na canonical PDP.
