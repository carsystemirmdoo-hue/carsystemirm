# Lighthouse pre/posle poređenje

Ovo su laboratorijski rezultati, ne CrUX/field podaci. INP nije dostupan iz ovih run-ova; TBT je samo laboratorijski signal odziva.

| Šablon | Profil | Perf pre | Perf posle | LCP pre | LCP posle | CLS pre | CLS posle | SEO posle |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Početna | mobile | 74 | 74 | 14.96 s | 14.96 s | 0.000 | 0.000 | 100 |
| Katalog | mobile | 77 | 86 | 5.26 s | 3.85 s | 0.000 | 0.000 | 100 |
| R-M brend | mobile | 81 | 87 | 4.67 s | 3.85 s | 0.000 | 0.000 | 100 |
| Tipičan R-M PDP | mobile | 90 | 92 | 3.46 s | 3.24 s | 0.000 | 0.000 | 100 |
| Tehnički R-M PDP | mobile | 84 | 92 | 4.13 s | 3.25 s | 0.000 | 0.000 | 100 |
| Prodavnice | mobile | 76 | 77 | 6.42 s | 6.47 s | 0.006 | 0.000 | 100 |
| Kontakt | mobile | 93 | 88 | 3.17 s | 3.19 s | 0.000 | 0.000 | 100 |
| Početna | desktop | 86 | 85 | 2.55 s | 2.63 s | 0.000 | 0.000 | 100 |
| Katalog | desktop | 85 | 99 | 1.12 s | 0.86 s | 0.262 | 0.000 | 100 |
| R-M brend | desktop | 99 | 99 | 0.90 s | 0.92 s | 0.000 | 0.000 | 100 |
| Tipičan R-M PDP | desktop | 99 | 99 | 1.00 s | 0.87 s | 0.000 | 0.000 | 100 |
| Tehnički R-M PDP | desktop | 100 | 99 | 0.79 s | 0.86 s | 0.000 | 0.000 | 100 |
| Prodavnice | desktop | 95 | 95 | 1.54 s | 1.52 s | 0.000 | 0.000 | 100 |
| Kontakt | desktop | 99 | 99 | 0.83 s | 0.86 s | 0.000 | 0.000 | 100 |

## Zaključak

- Najveći merljivi dobitak je katalog: desktop CLS 0.262 → 0.000, desktop performance 85 → 99, mobile LCP 5.26 s → 3.85 s.
- R-M i PDP mobilni LCP je poboljšan, ali je i dalje iznad cilja 2.5 s.
- Početna (14.96 s mobile LCP) i prodavnice (6.47 s) ostaju glavni performance dug.
- Kontakt mobile TBT je porastao u poslednjem laboratorijskom run-u; field INP treba pratiti posle deploy-a.
- Postojeće kvalitetne animacije nisu uklanjane radi sintetičkog skora.
