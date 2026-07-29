# SEO implementacija

## Obuhvat

- Centralni production origin i environment indexation.
- Metadata helperi i jedinstveni title/description/canonical/OG za javne template-e.
- Organization, WebSite, WebPage, Brand, CollectionPage, Product, BreadcrumbList, Store i LocalBusiness JSON-LD.
- 59 statičkih R-M OG slika dimenzije 1200 × 630.
- Četiri uređene category landing rute.
- Crawlable katalog paginacija koja pokriva svih 832 proizvoda.
- HTTP noindex za filter/contact query URL-ove, interne demo/draft rute i 117 PDF dokumenata.
- Sitemap sa 872 canonical URL-a i robots referencom.
- 308 konsolidacija potvrđenog H 2P15 duplikata i produkcionog hosta.
- Koristan 404 bez canonical-a na početnu.
- Ponovljivi audit, validator, performance i documentation generator.

## Pokretanje

1. npm run build
2. npm run seo:audit
3. npm run seo:validate
4. Pokrenuti production server na portu 3100, pa npm run seo:performance
5. npm run seo:docs

## Granice

- Nisu dodate cene, stanje lagera, recenzije, Offer markup, shipping ili return policy.
- Nisu dodate neproverene adrese, kontakt tačke ili društveni profili u Organization schema.
- Nije dodat plaćeni servis niti nova runtime SaaS zavisnost.
- Nisu uklanjane postojeće stabilne animacije.
- Google indeksacija i field Core Web Vitals zahtevaju post-deployment podatke.
