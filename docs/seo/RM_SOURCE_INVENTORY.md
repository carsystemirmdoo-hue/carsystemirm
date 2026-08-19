# R-M izvorna dokumentacija — inventar

Datum: 2026-08-08

Provera čitljivosti izvora pre bilo kakve ekstrakcije. Dokument koji ne prođe ove provere se ne parsira.

| Metrika | Vrednost |
| --- | ---: |
| R-M proizvoda | 59 |
| Dokumenata ukupno | 117 |
| Tehničkih listova (TDS) | 58 |
| Product information listova | 59 |
| — od toga sa punim setom sekcija (premazi) | 42 |
| — od toga komponentnih listova (učvršćivači, razređivači, aditivi) | 16 |
| **Podobno za ekstrakciju** | **58** |
| Nečitljivih TDS-ova | 0 |
| Isključeno po tipu dokumenta (product information) | 59 |
| Sa rizikom spajanja kolona | 28 |
| Ukupno strana | 265 |
| Jezici | unknown, en |
| Revizije | 07/2026 |

## Proizvodi bez tehničkog lista

- `hb-032-hydromix`

## Problematični dokumenti

Obuhvata samo tehničke listove koji se ne mogu pouzdano pročitati. Product-information PDF-ovi nisu ovde — oni nisu pokvareni, nego nisu tehnički izvor.

Nema dokumenata koji su pali provere čitljivosti.

## Poznata ograničenja ekstrakcije

- **Ligature.** PDF-ovi sadrže tipografske ligature (ﬁ, ﬂ, ﬀ), pa sirovi tekst daje "ﬂash oﬀ" i "ﬁlm". Sva obrada ide kroz `normaliseText()`.
- **Spojene kolone.** 28 dokumenata ima dve kolone pištolja (Compliant Gravity + HVLP) koje se pri ekstrakciji spajaju u jedan red. Vrednosti dizne i pritiska u tim dokumentima se ne dodeljuju automatski.
- **Product information listovi (59).** Provera sadržaja pokazuje da su to sačuvane veb-stranice sa linkom ka TDS-u (oko 177 znakova teksta, bez tehničkih vrednosti). Nisu izvor i ne ulaze u ekstrakciju.
- **Komponentni listovi (16).** Učvršćivači, razređivači i aditivi imaju samo sekcije "Application" i "Remarks". Njihovi parametri mešanja stoje u listu premaza, ne u sopstvenom. Čitljivi su, ali daju malo strukturiranih vrednosti.

