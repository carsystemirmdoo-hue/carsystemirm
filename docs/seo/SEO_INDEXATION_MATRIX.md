# SEO indexation matrica

Produkcioni canonical origin je https://carsystemirm.com. Preview/development okruženja koriste environment-based noindex, a produkcioni alias hostovi se preusmeravaju na canonical host.

| Tip | Primer | Index | Canonical | Robots | Sitemap | Structured data | Obavezni interni linkovi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| home | / | da | self | index, follow | da | Organization, WebSite, WebPage | katalog, brendovi, programi, prodavnice, kontakt |
| catalog | /katalog | da | self | index, follow | da | CollectionPage | kategorije, paginacija, PDP, brendovi |
| catalog pagination | /katalog/strana/2 | da | self | index, follow | da | CollectionPage, BreadcrumbList | prethodna/sledeća strana, PDP |
| category | /kategorije/bezbojni-lakovi | da | self | index, follow | da | CollectionPage, BreadcrumbList | katalog, relevantni PDP |
| brand | /brendovi/rm | da | self | index, follow | da | Brand, CollectionPage, BreadcrumbList | programi, kategorije, PDP, kontakt |
| program | /program/boje-i-lakovi | da | self | index, follow | da | CollectionPage, BreadcrumbList | brendovi, povezani PDP |
| product | /proizvodi/2220-agilis-activator | da | self | index, follow | da | Product, BreadcrumbList | brand, program/category, povezani PDP, kontakt |
| store locator | /prodavnice | da | self | index, follow | da | CollectionPage, Store/LocalBusiness samo za verifikovane lokacije, BreadcrumbList | kontakt, katalog |
| contact | /kontakt | da | self | index, follow | da | BreadcrumbList | prodavnice, katalog |
| filtered catalog | /katalog?brend=rm | ne | /katalog | X-Robots-Tag noindex, follow | ne | nije target landing | čiste kategorije i PDP ostaju crawlable |
| contact prefill | /kontakt?tema=proizvod | ne | /kontakt | X-Robots-Tag noindex, follow | ne | nasleđen javni breadcrumb | čista kontakt ruta |
| preview | /preview/... | ne / redirect | nema ili čista produkciona ruta | redirect ili noindex | ne | nema | nema |
| demo/social export | /interaction-demo/... | ne | nema | X-Robots-Tag noindex, nofollow | ne | nema | nema zahteva |
| draft/maintenance | /site-u-pripremi | ne | nema | X-Robots-Tag noindex, nofollow | ne | nema | nema zahteva |
| PDF mirror | /documents/products/rm/...pdf | ne | n/a | X-Robots-Tag noindex, follow | ne | n/a | link sa odgovarajućeg PDP-a |
| not found | nepostojeći URL | ne | nema | noindex | ne | nema | katalog, prodavnice, kontakt |

## Centralna implementacija

- lib/seo/site-config.ts: origin, jezik, locale, default metadata i environment indexation.
- lib/seo/route-policy.ts: tipovi ruta i deklarativna politika.
- lib/seo/metadata-builders.ts: page/product/brand/program/category/store/contact metadata.
- lib/seo.ts: JSON-LD helperi sa bezbednim serijalizovanjem.
- middleware.ts: canonical host i HTTP robots direktive za query/internal rute.
- app/sitemap.ts i app/robots.ts: crawl ulazi.

## Pravila

- Samo canonical URL sa HTTP 200 ulazi u sitemap.
- Query string nikada nije deo canonical URL-a.
- Indeksabilne stranice imaju self-referencing canonical.
- Noindex i redirect rute nemaju canonical koji bi lažno predstavljao drugi sadržaj.
- PDF noindex nije robots.txt disallow; crawler mora da vidi response header.
- Ne postoji Offer markup bez potvrđene cene, valute, dostupnosti i uslova.
