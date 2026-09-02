# SEO pre/posle

Audit je pokrenut nad lokalnim Next.js production buildom. Baseline je sačuvan pre izmene koda, a finalni rezultat koristi isti crawler, uz strožu proveru da metadata za indeksabilne stranice postoji u stvarnom head elementu.

| Metrika | Pre | Posle | Promena |
| --- | ---: | ---: | ---: |
| Indeksabilne stranice | 860 | 913 | +53 |
| Indeksabilne stranice bez title-a | 0 | 0 | 0 |
| Stranice sa dupliranim title-om | 5 | 0 | -5 |
| Indeksabilne stranice bez description-a | 0 | 0 | 0 |
| Stranice sa dupliranim description-om | 14 | 0 | -14 |
| Indeksabilne stranice bez canonical-a | 0 | 0 | 0 |
| Pogrešni canonical-i | 860 | 0 | -860 |
| Noindex URL-ovi u sitemap-u | 0 | 0 | 0 |
| Indeksabilne stranice bez H1 | 5 | 0 | -5 |
| Stranice sa više H1 | 1 | 0 | -1 |
| Orphan stranice | 28 | 0 | -28 |
| Stranice sa broken internim linkovima | 0 | 0 | 0 |
| Jedinstveni broken interni linkovi | 0 | 0 | 0 |
| Slike bez alt atributa | 0 | 0 | 0 |
| Indeksabilne stranice bez OG slike | 860 | 0 | -860 |
| Indeksabilne stranice bez structured data | 14 | 0 | -14 |
| PDP bez Product schema | 0 | 0 | 0 |
| Relevantne stranice bez Breadcrumb schema | 4 | 0 | -4 |
| Indeksabilni filter uzorci | 4 | 0 | -4 |
| Indeksabilne preview/demo stranice | 5 | 0 | -5 |
| Broken PDF linkovi | nije mereno | 0 od 117 | n/a |

Napomene:

- Posle izmene sitemap ima 198 canonical, indeksabilnih URL-ova sa HTTP 200.
- Finalni validator je proverio svih 832 PDP URL-a, svih 59 R-M PDP URL-a i svih 117 PDF fajlova.
- Prazan alt je dozvoljen za dekorativne slike; finalni audit nema nijedan img bez alt atributa.
- Jedanaest slika bez eksplicitnih dimenzija pripada samo noindex demo/social rutama, ne javnim indeksabilnim stranicama.
