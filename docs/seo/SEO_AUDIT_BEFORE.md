# SEO audit BEFORE

- Datum: 2026-07-29T12:46:01.889Z
- Audit origin: `http://localhost:3100`
- Očekivani produkcioni canonical host: `https://carsystemirm.com`
- Izvor ruta: Next.js prerender i app-paths manifest, sitemap i kontrolni filter/preview/404 URL-ovi
- Napomena: filter metrika koristi četiri reprezentativna query URL-a, ne pokušava da generiše beskonačan skup kombinacija.

| Metrika | Broj |
| --- | ---: |
| Ukupno auditovanih URL-ova | 875 |
| Pronađenih HTML stranica | 873 |
| Indeksabilnih | 860 |
| Noindex | 10 |
| Redirect URL-ova | 2 |
| Bez title-a | 0 |
| Sa dupliranim title-om | 5 |
| Bez meta description-a | 0 |
| Sa dupliranim opisom | 14 |
| Bez canonical-a | 0 |
| Sa pogrešnim canonical-om | 860 |
| Bez H1 | 5 |
| Sa više H1 | 1 |
| Bez Open Graph slike | 860 |
| Bez structured data | 14 |
| Sa broken linkovima | 0 |
| Jedinstvenih broken linkova | 0 |
| Orphan stranica | 28 |
| Slika bez alt teksta | 0 |
| Slika sa praznim dekorativnim alt-om | 54552 |
| Slika bez dimenzija | 56035 |
| Indeksabilnih filter uzoraka | 4 |
| Indeksabilnih preview/demo/draft ruta | 5 |
| Noindex URL-ova u sitemapu | 0 |
| URL-ova u sitemapu | 851 |
| PDP bez Product schema | 0 |
| Relevantnih stranica bez Breadcrumb schema | 4 |

## Najčešći kritični problemi

- `wrong-canonical`: 851
- `unexpected-indexable`: 9
- `missing-h1`: 1
