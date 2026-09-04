# SEO deployment checklist

Kod i lokalni production build su provereni. Sledeće stavke zahtevaju produkcioni deploy ili vlasnički pristup servisima i ne mogu se zaključiti samo iz repozitorijuma.

## Pre deploy-a

- [ ] NEXT_PUBLIC_SITE_URL je https://carsystemirm.com ili nije postavljen (bezbedni fallback je isti domen).
- [ ] VERCEL_ENV je production samo na produkcionom deployment-u.
- [ ] NEXT_PUBLIC_SEO_INDEXING nije postavljen na false u produkciji.
- [ ] MAINTENANCE_MODE nije slučajno uključen.
- [ ] Potvrđeni su stvarni telefon, email, adresa i radno vreme pre izmene structured data.
- [ ] npm run typecheck, lint, build, seo:validate i postojeći testovi prolaze.

## Odmah posle deploy-a

- [ ] Otvoriti https://carsystemirm.com/robots.txt i potvrditi Allow: / i sitemap URL.
- [ ] Otvoriti https://carsystemirm.com/sitemap.xml i potvrditi da skup jedinstvenih `<loc>` URL-ova odgovara lokalno generisanom sitemap-u iz istog commita; ukupan broj je dinamičan i raste sa katalogom.
- [ ] Proveriti da non-canonical Vercel/www/http host pravi 308 na HTTPS apex i čuva path/query.
- [ ] Proveriti HTTP 200 i self canonical za početnu, katalog, /brendovi/rm, jedan PDP, jednu kategoriju, prodavnice i kontakt.
- [ ] Proveriti X-Robots-Tag na /katalog?q=lak, jednoj demo ruti i dva PDF-a.
- [ ] Proveriti pravi 404 status i noindex na nepostojećem URL-u.
- [ ] Proveriti mobilni header, katalog, R-M hero, PDP, prodavnice i kontakt bez horizontalnog overflow-a.

## Google Search Console

- [ ] Dodati ili ponovo poslati https://carsystemirm.com/sitemap.xml.
- [ ] URL Inspection: /, /katalog, /brendovi/rm, /proizvodi/2220-agilis-activator, /kategorije/bezbojni-lakovi i /prodavnice.
- [ ] Rich Results test: Product, BreadcrumbList i Organization/LocalBusiness.
- [ ] Proveriti Pages/Indexing report i pratiti indexed query/filter URL-ove.
- [ ] Proveriti da mirrored PDF dokumentacija napušta indeks posle recrawl-a.
- [ ] Pratiti impressions/clicks za svih 59 R-M PDP-ova.
- [ ] Dodati verification token samo kroz environment konfiguraciju; ne hardkodovati token.

## Google Business Profile

- [ ] Potvrditi vlasništvo i NAP za svaku poslovno relevantnu lokaciju.
- [ ] Uskladiti kategoriju, radno vreme, telefon i website URL.
- [ ] Povezati samo potvrđene profile; ne izmišljati sameAs URL-ove.

## Field performanse

- [ ] Sačekati dovoljan realni saobraćaj za CrUX/Core Web Vitals.
- [ ] Posebno pratiti mobilni LCP početne i prodavnica.
- [ ] Lighthouse rezultate tretirati kao laboratorijski signal, ne kao field podatke ili garanciju rangiranja.
- [ ] Pratiti stvarni INP; Lighthouse TBT nije zamena za INP.
