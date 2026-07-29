# SEO performance AFTER

- Datum: 2026-07-29T13:38:23.680Z
- Okruženje: lokalni Next.js production build na `http://localhost:3100`
- Alat: Lighthouse, laboratorijsko merenje
- Profili: mobile i desktop
- Napomena: ovo nisu CrUX/field podaci. INP zahteva realne korisničke interakcije; Lighthouse TBT je naveden kao laboratorijski signal odziva.

| Šablon | Profil | Performance | Accessibility | SEO | LCP | CLS | TBT | Napomena |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Početna | mobile | 74 | 100 | 100 | 14.96 s | 0.000 | 101 ms | |
| Katalog | mobile | 86 | 100 | 100 | 3.85 s | 0.000 | 140 ms | |
| R-M brend | mobile | 87 | 97 | 100 | 3.85 s | 0.000 | 106 ms | |
| Tipičan R-M PDP | mobile | 92 | 96 | 100 | 3.24 s | 0.000 | 115 ms | |
| R-M PDP sa tehničkim podacima | mobile | 92 | 96 | 100 | 3.25 s | 0.000 | 123 ms | |
| Prodavnice | mobile | 77 | 96 | 100 | 6.47 s | 0.000 | 81 ms | |
| Kontakt | mobile | 88 | 97 | 100 | 3.19 s | 0.000 | 247 ms | |
| Početna | desktop | 85 | 100 | 100 | 2.63 s | 0.000 | 33 ms | |
| Katalog | desktop | 99 | 100 | 100 | 856 ms | 0.000 | 30 ms | |
| R-M brend | desktop | 99 | 97 | 100 | 920 ms | 0.000 | 17 ms | |
| Tipičan R-M PDP | desktop | 99 | 96 | 100 | 866 ms | 0.000 | 11 ms | |
| R-M PDP sa tehničkim podacima | desktop | 99 | 96 | 100 | 864 ms | 0.000 | 7 ms | |
| Prodavnice | desktop | 95 | 96 | 100 | 1.52 s | 0.000 | 6 ms | |
| Kontakt | desktop | 99 | 97 | 100 | 856 ms | 0.000 | 5 ms | |

## Ciljevi

- LCP: do 2,5 s
- INP: do 200 ms u field podacima
- CLS: do 0,1

Sirovi JSON izveštaji su u `artifacts/seo/performance/after`.
