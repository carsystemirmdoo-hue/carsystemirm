# SEO politika filtera i pretrage

## Odluka

Glavni katalog /katalog je indeksabilan. Proizvoljne query kombinacije služe korisničkom interfejsu, ali nisu zasebne SEO landing stranice.

| Grupa | Primer | Index | Canonical | Razlog |
| --- | --- | --- | --- | --- |
| pretraga | ?q=lak | ne | /katalog | beskonačan skup upita i tanak/dupliran sadržaj |
| sortiranje | ?sort=naziv | ne | /katalog | isti skup proizvoda, drugačiji redosled |
| brend filter | ?brend=rm | ne | /katalog | primarni brand intent pripada /brendovi/rm |
| program/faza | ?program=... ili ?faza=... | ne | /katalog | primarni intent pripada čistoj program ruti |
| atributi | ?sistem=..., ?serija=..., ?rm-kategorija=... | ne | /katalog | kombinacije nisu uređene landing stranice |
| query paginacija | ?page=2 | ne | /katalog | zamenjena crawlable putanjom /katalog/strana/2 |
| čista kategorija | /kategorije/bezbojni-lakovi | da | self | uređena kopija, H1, breadcrumb i relevantni PDP linkovi |

## Implementacija

- Katalog i kontakt imaju statičke metadata u početnom head-u.
- Middleware za svaki query na /katalog i /kontakt dodaje X-Robots-Tag: noindex, follow, noarchive.
- Query URL zadržava čist canonical bez query stringa.
- Query URL-ovi nisu u sitemap-u.
- Četiri reprezentativna filter URL-a ulaze u svaki SEO audit; validator proverava i kontakt prefill URL.

## Infinite scroll

- Prvih 48 proizvoda je u server-rendered HTML-u kao crawlable linkovi.
- Ukupno 18 kataloških strana pokriva svih 832 proizvoda: osnovna strana plus 17 čistih paginated ruta.
- Svaka paginated ruta ima self canonical, jedinstven title/description, H1, prethodni/sledeći HTML link i linkove ka PDP-ovima.
- Klijentski infinite scroll ostaje UX sloj i nije jedini način otkrivanja proizvoda.

## Buduća pravila

Novi filter se podrazumevano tretira kao noindex query. Indeksabilna landing stranica se uvodi tek kada ima jasan intent, jedinstven koristan sadržaj, stabilan skup proizvoda, interne linkove i mesto u sitemap-u.
