# baslac — audit izvora i modela (bez apply)

Generisano iz `.cache/baslac-sync/probe` + `data/knowledge/baslac-documents.generated.json`. Katalog NIJE menjan.

## Izvori

| Izvor | Uloga | Nalaz |
| --- | --- | --- |
| `baslac.com/en-emea` (Drupal, isti sistem kao rmpaint.com) | dokaz aktuelne ponude, naziv, opis, packshot | 5 stranica kategorija, 37 šifara, 39 slika |
| `techinfo.baslac.com/en/` (otvoren direktorijum) | TDS po šifri, dokumenti sistema i procesa | 57 TDS proizvoda, 38 varijantnih listova, 9 listova linija, 16 procesnih |
| `baslac.com/en-emea/technical-data-sheets` | indeks dokumenata (9 strana) | 102 dokumenata, već preuzeto lokalno (32.9 MB) |
| `baslac.com/en-emea/safety-data-sheets` | SDS | bez linka po proizvodu — „contact your local representative”, biranje zemlje |
| `baslac.com/en-emea/tinting-chart-and-mixing-machine` | tinting chart | stranica OPISUJE chart, ali ga ne objavljuje kao dokument |
| `surventiscoatings.com/refinish` | vlasništvo brenda | potvrđuje da je baslac Surventis brend; bez asortimana |

Nisu korišćeni distributeri ni treće strane.

## Klasifikacija izvora

- **CURRENT** — sve što je linkovano sa aktuelnog `baslac.com/en-emea` (stranice kategorija + indeks tehničkih listova).
- **CURRENT_BUT_LEGACY_BRANDING** — TDS PDF-ovi nose „BASF Coatings GmbH” u futeru, a linkovani su sa aktuelnog Surventis sajta: sadržaj je aktuelan, brendiranje je zateklo promenu vlasnika.
- **HISTORICAL** — tinting chart skenovi sa distributerskih mirora (`virtualtry.tech`, `carus.lt`, `rsbautoandindustrial.co.za`) iz kojih su ranije izvedene nijanse tonera; NISU aktuelan zvanični izvor.
- **UNCERTAIN** — `11-40` (TDS bez naziva u indeksu; tekst nosi samo bezbednosni deo).

## Model

| grupa | šifara |
| --- | --- |
| hardener | 16 |
| primer | 11 |
| clearcoat | 7 |
| reducer | 7 |
| additive | 7 |
| system | 4 |
| cleaner | 3 |
| putty | 2 |

Svaka od 57 šifara ima SVOJ tehnički list — po istom pravilu kao R-M, svaka je zaseban proizvod. Pakovanje nije deo šifre: TDS i naziv fajla slike navode veličinu (1 L, 4 L, 5 L, 2 L, 1,5 kg) uz isti kod.
