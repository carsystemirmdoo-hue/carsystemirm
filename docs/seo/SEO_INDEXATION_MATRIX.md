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
| product group | /proizvodi/grupa/cosmos-lac-flame-orange | da | self | index, follow | da | ProductGroup, BreadcrumbList | brand, varijante, katalog |
| product variant | /proizvodi/cosmos-lac-flame-orange-fo-100-... | konsolidovano | **grupa** | index, follow | **ne** | Product + isVariantOf, BreadcrumbList | grupa, sestrinske varijante, brand |
| guide index | /vodici | samo ako postoji objavljen vodič | self | noindex dok je prazan | samo ako nije prazan | nema | kontakt, katalog |
| guide | /vodici/[slug] | samo ako je expert-verified | self | index, follow | da | Article, BreadcrumbList | proizvodi, srodni vodiči |
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
- lib/product-families.ts: izvođenje grupa proizvoda i jedini predikat za konsolidaciju varijanti.
- lib/knowledge/*: domenski sloj, poreklo tvrdnji i status stručnog pregleda.

## Pravila

- Samo canonical URL sa HTTP 200 ulazi u sitemap.
- Query string nikada nije deo canonical URL-a.
- Indeksabilne stranice imaju self-referencing canonical.
- Noindex i redirect rute nemaju canonical koji bi lažno predstavljao drugi sadržaj.
- PDF noindex nije robots.txt disallow; crawler mora da vidi response header.
- Ne postoji Offer markup bez potvrđene cene, valute, dostupnosti i uslova.
- Varijanta koja se konsoliduje na grupu nikada ne dobija noindex — canonical i noindex zajedno su kontradiktoran signal.
- URL koji nije u sitemapu mora ili da bude konsolidovan na grupu ili da bude noindex; ne sme biti indeksabilan siroče-duplikat.
- Nijedna indeksabilna stranica ne postoji samo zato što postoji zapis u podacima. Vodič bez stručno potvrđenog teksta nema URL.
- Schema se emituje samo za odnose koji su vidljivi na stranici.
