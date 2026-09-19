# R-M — audit izvora i modela (milestone 1, bez apply)

Generisano iz `data/rm-sync/` (RAW + `source-products.generated.json` + `reports/local-audit.generated.json`). Katalog sajta NIJE menjan.

## 1. Zvanični izvori

| Izvor | Uloga | Nalaz |
| --- | --- | --- |
| `info.rmpaint.com/products` (Info R-M International) | identitet: zvanična oznaka proizvoda, tehnička kategorija, opis, slika, TDS link | 219 proizvoda, 219 jedinstvenih oznaka, 9 kategorija, 188 slika, 218 TDS |
| `www.rmpaint.com/en-int` | dokaz aktuelne ponude, serija (Pioneer / Advance), slika | 66 stranica proizvoda, bez oznake proizvoda; zvanično linkuje na info portal |
| `techinfo.rmpaint.com/unicorn/en/*.pdf` | TDS: razmera, učvršćivači, razređivači, VOC, pot-life, sušenje | 218 dokumenata, 218 HTTP 200, 56.8 MB, 0 tokena, 0 preusmeravanja |
| `rmpaint.com/en-int/sds` | SDS | nema linka po proizvodu — „contact your local representative” |
| `surventiscoatings.com` | korporativni sajt | nema asortimana ni kataloga; R-M sajt linkuje na njega |
| katalog / product guide (PDF) | — | **nije pronađen** ni na jednom zvaničnom izvoru |
| BASF legacy (`refinish.basf.us` i sl.) | — | **nije korišćen** |

8-cifreni brojevi artikala i pakovanja **nisu javno objavljeni**. Javna zvanična šifra je oznaka proizvoda (npr. `C 2A64`).

## 2. Model

- **1 zvanična oznaka = 1 zapis proizvoda.** Svaka oznaka ima svoju stranicu na portalu i SVOJ TDS (218 različitih URL-ova, nijedan deljen).
- **Sistem za mešanje = 1 zapis sistema** (`kind: system`). Toneri/bazne boje se zvanično NE objavljuju pojedinačno (0 šifara tonera u javnim izvorima).
- **Učvršćivač / razređivač / aditiv = samostalan zapis** (`kind: component`) sa odnosima iz TDS-a (`relations`, `usedBy`); nikad varijanta laka.
- Grupisanje po nazivu (MultiPROTECT White/Grey/Black) je samo prezentaciona opcija: stroga varijanta daje 167 porodica, ali naziv greši (GlossTOP `C 2A63` ≠ GlossTOP+ `C 2A64`).

| kind | broj |
| --- | --- |
| component | 89 |
| product | 122 |
| system | 8 |

| uloga | broj |
| --- | --- |
| additive | 21 |
| basecoat-topcoat | 30 |
| bodyfiller | 16 |
| cleaner | 10 |
| clearcoat | 25 |
| hardener | 40 |
| thinner | 28 |
| undercoat | 49 |

| serija | broj |
| --- | --- |
| Advance Series | 67 |
| GRAPHITE HD | 24 |
| Pioneer Series | 74 |
| — | 54 |

Sistemi: `AGILIS`, `AGILIS eSense`, `AGILIS eSense X-TREME`, `AGILIS X-TREME`, `DIAMONT`, `GHD TOPCOAT`, `ONYX HD`, `ONYX HD TROPICAL`

## 3. Current vs legacy

| status | broj | dokaz |
| --- | --- | --- |
| CURRENT_ACTIVE | 209 | portal + TDS revizije 2026 izdavača Surventis i/ili stranica na rmpaint.com |
| CURRENT_ACTIVE_SYSTEM | 8 | isto, sistem za mešanje |
| UNCERTAIN | 2 | `HB 015`, `HB 032` — na portalu, ali bez standardnog aktuelnog TDS-a |
| samo pomenuti u tuđem TDS-u | 23 | nemaju svoju stranicu ni TDS: `BC 101`, `H 9000`, `HB 002`, `HB 004`, `HB 006`, `HB 010`, `HB 010E`, `HB 010X`, `HB 010XE`, `HB 020`, `HB 030`, `HB 030E`, `HB 030X`, `HB 030XE`, `HB 040`, `HB 040E`, `PK 2000`, `PK 700`, `R 2100`, `R 2200`, `R 2300`, `SC 820`, `SC 850` |

## 4. Sajt ↔ portal

58 od 66 stranica sajta vezano je za oznaku (doslovno isti opis + naziv, ili oznaka u adresi). Nevezane:

- `822-promotor-de-adherencia` — 822 Promotor de adherencia
- `agilis-hb010e-esense-mixing-clears` — AGILIS HB010E eSense mixing clears
- `agilis-hb010xe-esense-mixing-clears` — AGILIS HB010XE eSense mixing clears
- `agilis-hb030e-esense-mixing-clears` — AGILIS HB030E eSense mixing clears
- `agilis-hb030xe-esense-mixing-clears` — AGILIS HB030XE eSense mixing clears
- `hb040e-esense-mixing-clears` — HB040E eSense mixing clears
- `uno-hd` — UNO HD
- `uv-blemding-thinn-r` — UV BLEMDING Thinn-R

## 5. Postojeći lokalni R-M zapisi

| metrika | vrednost |
| --- | --- |
| LOCAL_RM_PRODUCTS | 64 |
| GENERATED_PRODUCTS | 59 |
| MANUAL_PRODUCTS | 5 |
| PLACEHOLDER_SKUS | 5 |
| EXACT_MATCH | 60 |
| HIGH_CONFIDENCE_MATCH | 1 |
| PROBABLE_MATCH | 0 |
| LEGACY_LOCAL_ONLY | 3 |
| officialProducts | 219 |
| officialAlreadyLocal | 60 |
| officialMissingLocally | 159 |
| duplicateLocalForOneCode | 0 |

Zapisi koji NISU tačno poklapanje:

| zapis | klasifikacija | dokaz |
| --- | --- | --- |
| `rm-diamont-bazna-boja` | HIGH_CONFIDENCE_MATCH | linija DIAMONT + uloga basecoat-topcoat imaju jedan jedini zvanični SISTEM („DIAMONT”); lokalni zapis nema oznaku |
| `rm-diamont-bezbojni-lak` | LEGACY_LOCAL_ONLY | linija DIAMONT postoji, ali nijedan zvanični proizvod te uloge (clearcoat) |
| `rm-pasta-190-1l` | LEGACY_LOCAL_ONLY | bez oznake i bez linije; nema zvaničnog proizvoda tog naziva |
| `rm-pasta-190-5l` | LEGACY_LOCAL_ONLY | bez oznake i bez linije; nema zvaničnog proizvoda tog naziva |
