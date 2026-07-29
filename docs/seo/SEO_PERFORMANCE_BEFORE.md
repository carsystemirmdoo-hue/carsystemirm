# SEO performance BEFORE

- Datum: 2026-07-29T12:55:14.963Z
- Okruženje: lokalni Next.js production build na `http://localhost:3100`
- Alat: Lighthouse, laboratorijsko merenje
- Profili: mobile i desktop
- Napomena: ovo nisu CrUX/field podaci. INP zahteva realne korisničke interakcije; Lighthouse TBT je naveden kao laboratorijski signal odziva.

| Šablon | Profil | Performance | Accessibility | SEO | LCP | CLS | TBT | Napomena |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Početna | mobile | 74 | 100 | 100 | 14.96 s | 0.000 | 86 ms | |
| Katalog | mobile | 77 | 100 | 100 | 5.26 s | 0.000 | 128 ms | |
| R-M brend | mobile | 81 | 97 | 100 | 4.67 s | 0.000 | 96 ms | |
| Tipičan R-M PDP | mobile | 90 | 96 | 100 | 3.46 s | 0.000 | 103 ms | |
| R-M PDP sa tehničkim podacima | mobile | 84 | 96 | 100 | 4.13 s | 0.000 | 97 ms | |
| Prodavnice | mobile | 76 | 96 | 100 | 6.42 s | 0.006 | 60 ms | |
| Kontakt | mobile | 93 | 97 | 92 | 3.17 s | 0.000 | 36 ms | |
| Početna | desktop | 86 | 100 | 100 | 2.55 s | 0.000 | 0 ms | |
| Katalog | desktop | 85 | 100 | 100 | 1.12 s | 0.262 | 0 ms | |
| R-M brend | desktop | 99 | 97 | 100 | 901 ms | 0.000 | 0 ms | |
| Tipičan R-M PDP | desktop | 99 | 96 | 100 | 1.00 s | 0.000 | 0 ms | |
| R-M PDP sa tehničkim podacima | desktop | 100 | 96 | 100 | 791 ms | 0.000 | 0 ms | |
| Prodavnice | desktop | 95 | 96 | 100 | 1.54 s | 0.000 | 0 ms | |
| Kontakt | desktop | 99 | 97 | 92 | 833 ms | 0.000 | 0 ms | |

## Ciljevi

- LCP: do 2,5 s
- INP: do 200 ms u field podacima
- CLS: do 0,1

Sirovi JSON izveštaji su u `artifacts/seo/performance/before`.
