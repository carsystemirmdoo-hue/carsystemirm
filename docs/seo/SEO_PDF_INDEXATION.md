# SEO strategija za R-M PDF dokumentaciju

## Inventar i odluka

- Lokalnih R-M PDF fajlova: 117.
- Canonical product-information dokumenata: 59.
- Canonical technical-data dokumenata: 58.
- PDP je glavni indeksabilni rezultat.
- PDF ostaje javno dostupan za preuzimanje i crawl, ali nije indeksabilan.
- PDF URL-ovi nisu u HTML sitemap-u niti u robots.txt disallow pravilima.

## Implementacija

next.config.ts postavlja sledeći response header za /documents/products/rm/:path*:

X-Robots-Tag: noindex, follow

To pravilo radi u Next/Vercel deployment-u i ne pokušava da koristi HTML meta tag unutar PDF-a.

## Test

- SEO validator je poslao zahtev ka svih 117 lokalnih PDF URL-ova.
- Rezultat: 117 dostupnih dokumenata i 117 odgovora sa X-Robots-Tag noindex.
- Broken PDF linkovi: 0.

## Fallback za drugi hosting

Ako se aplikacija premesti sa Next/Vercel hostinga, ekvivalentni response header mora da se podesi na reverse proxy, Apache/Nginx ili hosting control panel nivou. Posle migracije ponovo pokrenuti npm run seo:validate i ručno proveriti jedan PDF sa curl -I.

## Ručna provera posle deploy-a

1. Proveriti header na jednom product-information i jednom technical-data PDF-u.
2. U Search Console proveriti da PDF više nije indeksabilan.
3. Ne blokirati PDF robots.txt pravilom dok Google ne obradi noindex header.
4. Ako postoje ranije indeksirani PDF-ovi, sačekati recrawl; removal alat koristiti samo kada postoji poslovna potreba za ubrzanim uklanjanjem.
