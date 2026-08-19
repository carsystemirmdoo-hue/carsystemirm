# CARSYSTEM — MASTER ACQUISITION REPORT

Datum: 2026-08-08
Grana: `recovery/pre-claude-2026-08-07`

Stanje prikupljanja podataka o proizvodima po brendovima.

---

## Status po brendu

| # | Brend | Status | Obrazloženje |
| ---: | --- | --- | --- |
| 1 | **Cosmos Lac** | **COMPLETE** | Ceo zvanični katalog otkriven i obrađen; slike preuzete; mapiranje urađeno. Tehnički dokumenti ne postoje na izvoru. |
| — | **baslac** | **COMPLETE** | Odrađeno u prethodnoj iteraciji, referentni standard. |
| — | **R-M** | **COMPLETE** | Odrađeno u Fazi 3. |
| 2 | **Carsystem** | **NOT STARTED** | Nije započeto u ovoj sesiji. |
| 3 | **C.A.R.FIT** | **NOT STARTED** | Katalog 2026 lociran, nije obrađen. |
| 4 | **Norbin** | **NOT STARTED** | BASF portfolio PDF lociran, nije obrađen. |
| 5 | **SATA** | **NOT STARTED** | — |
| 6 | **Befar** | **BLOCKED** | Zvanični proizvođač nije identifikovan. |
| 7 | **A.U.T.O. Fit** | **BLOCKED** | Zvanični proizvođač nije identifikovan. |

**Tri brenda su na standardu, četiri nisu započeta, dva su blokirana.**

---

## Master tabela

| Brend | Lokalnih | Kod proizvođača | Exact | Probable | Unmatched | Kandidata | Slika | TDS | PDS | SDS | Ostali dok. | Tvrdnji | Za pregled | Blokirano |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| **Cosmos Lac** | 742 | 679 | 630 | 6 | 106 | 56 | **670** | 0 | 0 | 0 | 0 | 630 | 630 | TDS/SDS ne postoje na izvoru |
| **baslac** | 4 | 94 | 1 | 0 | 3 | 93 | 0 | 94 | 0 | 0 | 8 | 540 | 540 | matrica podloga je grafička |
| **R-M** | 64 | 58 | 58 | 0 | 6 | 0 | 0 | 58 | 59 | 0 | 0 | 470 | 470 | 28 dok. sa spojenim kolonama |
| Carsystem | 9 | — | — | — | — | — | 0 | 6 | 0 | 0 | 0 | 0 | 0 | nije započeto |
| C.A.R.FIT | 2 | — | — | — | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | nije započeto |
| Norbin | 2 | — | — | — | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | nije započeto |
| SATA | 1 | — | — | — | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | nije započeto |
| Befar | 8 | — | — | — | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | izvor nije nađen |
| A.U.T.O. Fit | 0 | — | — | — | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | izvor nije nađen |
| **UKUPNO** | **832** | **831** | **689** | **6** | **115** | **149** | **670** | **158** | **59** | **0** | **8** | **1640** | **1640** | |

**Nijedan SDS nije prikupljen ni za jedan brend.**

---

## Kompletnost dosijea naših proizvoda

Od 832 proizvoda u Carsystem katalogu:

| Kriterijum | Broj | Udeo |
| --- | ---: | ---: |
| 1. Zvanična slika proizvođača | **626** | 75% |
| 2. Zvanični opis proizvođača | **631** | 76% |
| 3. Najmanje jedan tehnički dokument | **59** | 7% |
| 4. Strukturirane tehničke tvrdnje | **58** | 7% |
| 5. **Kompletan dosije** (1+2+3) | **0** | **0%** |

Nula kompletnih dosijea je tačan rezultat, ne greška: brendovi koji imaju slike i opise (Cosmos) nemaju tehničke dokumente, a brend koji ima tehničke dokumente (R-M) nema prikupljene zvanične slike ni opise. Ta dva skupa se zasad ne preklapaju.

| Brend | Lokalnih | Slika | Opisa | Dokumenata | Tvrdnji |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cosmos Lac | 742 | 626 | 630 | 0 | 0 |
| R-M | 64 | 0 | 0 | 58 | 58 |
| baslac | 4 | 0 | 1 | 1 | 0 |
| Ostali | 22 | 0 | 0 | 0 | 0 |

---

## Cosmos Lac — detaljno

### Otkrivanje

WordPress sajt sa Yoast sitemap-om. Tip zapisa `pran_products` **nije** izložen u REST API-ju, pa je otkrivanje išlo preko zvaničnog sitemap-a — 6 fajlova, 5.499 URL-ova, od toga **679 engleskih** (ostalo su Polylang prevodi istih proizvoda).

URL nosi hijerarhiju `/products/{kategorija}/{porodica}/{proizvod}/`, što se direktno mapira na postojećih 41 ProductGroup bez izmišljanja strukture.

| Metrika | Vrednost |
| --- | ---: |
| Zvaničnih proizvoda | 679 |
| Zvaničnih porodica | 29 |
| Sa zvaničnim opisom | 676 |
| Sa packshot slikom | 670 |
| Grešaka pri parsiranju | **0** |
| **TDS/SDS na stranicama proizvoda** | **0** |

### Mapiranje

| Pouzdanost | Broj |
| --- | ---: |
| `exact-code` | 555 |
| `normalized-code` | 69 |
| `exact-name` | 6 |
| **Primenjeno** | **630** |
| `probable` (nikad automatski) | 6 |
| `unmatched` | 106 |

Ključ za poklapanje je URL slug proizvođača, ne prikazni naziv: naša šifra `FO-100` stoji u njihovom slug-u `flame-orange-fo-100-vanilla`, dok njihov prikazni naziv (`Flame™ Orange Fo - 100 Vanilla`) ima zaštitni znak i nedosledne razmake koji ruše poređenje po imenu.

Prva verzija matchera dala je 195 poklapanja; nakon prelaska na slug-token ključ — **630**.

### Nalaz: Molotow nije Cosmos proizvod

**73 naša proizvoda** (66 Molotow Premium + 7 Molotow Burner) **ne postoje u zvaničnom Cosmos katalogu.**

Molotow je zaseban nemački proizvođač. Verovatno su ili pogrešno svrstani pod Cosmos Lac u našem katalogu, ili ih Cosmos više ne distribuira. Ovo je pitanje za vas — ne odluka koju sistem sme da donese.

Ostali nepoklopljeni: Spray.Bike 15, W Wood Care 6, po nekoliko iz manjih linija.

### Slike

| Metrika | Vrednost |
| --- | ---: |
| Preuzeto | **670** |
| Jedinstvenih po sadržaju | 664 |
| Duplikata (deljeni packshot) | 6 |
| Sa očitanim dimenzijama | 670 |
| Ukupno | 102 MB |

Preuzeto isključivo sa `cosmoslac.com/wp-content/uploads`. WordPress resize varijante (`-300x300`) su odbačene pri otkrivanju; deduplikacija po sadržaju urađena sha256 heševima.

**Slike su smeštene u `assets/manufacturer/cosmos-lac/images/`, van `public/` direktorijuma**, da ih build ne bi mogao slučajno servirati. Dodato u `.gitignore`. Postojeće slike na sajtu nisu menjane.

### Blokada

Cosmos **ne objavljuje TDS ni SDS** na stranicama proizvoda. Za tehničke podatke je potreban direktan kontakt sa proizvođačem (`support@cosmoslac.com`).

Postoje REST taksonomije `product_descriptions`, `product_applications`, `product_features` sa zvaničnim tekstovima — nisu iscrpljene u ovoj iteraciji i predstavljaju sledeći korak za Cosmos.

---

## Zaštita — provereno

| Provera | Rezultat |
| --- | ---: |
| Cosmos tvrdnji sa `expert-verified` | **0** |
| baslac tvrdnji sa `expert-verified` | **0** |
| R-M tvrdnji sa `expert-verified` | **0** |
| Cosmos opisa × stranica | 542 × 832 → **0 curenja** |
| baslac vrednosti × stranica | 19 × 832 → **0 curenja** |
| R-M markera × stranica | 12 × 832 → **0 curenja** |
| Preuzetih asseta u `public/` | **0** |
| JSON-LD propusta | **0** |

| Validacija | Rezultat |
| --- | --- |
| `npm run typecheck` | ✓ |
| `npm run lint` | ✓ |
| `npm run build` | ✓ 954/954 |
| `npm run knowledge:validate` | ✓ |
| `npm run seo:validate` | ✓ 0 grešaka |

Sitemap 198 URL-ova, ProductGroup konsolidacija netaknuta, PDP tekstovi i SEO metapodaci nepromenjeni.

---

## Greške uhvaćene tokom rada

1. **Generički builder je prepisao Cosmos manifest.** `build-brand-manifests.mjs` je ponovnim pokretanjem sveo bogati dosije (68 grupa, 798 proizvoda) na prazan zapis. Dodata zaštita: brendovi sa namenskim builderom zadržavaju svoj manifest.
2. **R-M je prijavljivao 0 dokumenata** iako ima 117 — builder je tražio `documentLocalPath`, a R-M zapisi nose `documentHref`.
3. **Inventar je bio zastareo** u prvom izveštaju jer je pokrenut pre preuzimanja; baslac je prikazivao 0 dokumenata umesto 102.

---

## Sledeći korak

| # | Brend | Procena | Napomena |
| ---: | --- | --- | --- |
| 1 | **Carsystem** | veliki | ~2.000 proizvoda kod proizvođača, 9 kod nas; 10 kategorija |
| 2 | **C.A.R.FIT** | srednji | katalog 2026 PDF lociran |
| 3 | **Norbin** | mali | BASF portfolio PDF lociran |
| 4 | **SATA** | mali | drugačiji tehnički model (oprema) |
| 5 | Cosmos REST taksonomije | mali | `product_applications`, `product_features` |
| 6 | Befar / A.U.T.O. Fit | blokirano | traži podatak od Carsystem-a o proizvođaču |

Svaki od ovih brendova traži namenski parser, kao što su ga tražili baslac i Cosmos. Nisu započeti da ne bi bili odrađeni površno.
