# ProductGroup i konsolidacija varijanti

Datum: 2026-08-08

Ovaj dokument objašnjava zašto je uvedena `/proizvodi/grupa/[slug]` ruta i zašto su varijante konsolidovane baš na ovaj način, a ne na neki drugi.

## Problem

SEO audit (`SEO_AEO_GEO_AUDIT_2026-08.md`) je utvrdio:

- 742 od 832 stranica proizvoda (89%) bile su Cosmos LAC varijante boja
- svaka je imala sopstveni indeksabilan URL i bila je u sitemapu
- sličnost susednih varijanti: **0.85–0.90** (5-gram Jaccard)
- **29 jedinstvenih `useCase` stringova na 742 proizvoda**
- opisi jedinstveni samo zato što se naziv proizvoda ubacuje u fiksni šablon
- nijedna nema TDS, kompatibilnost ni `detail` blok

To nisu 742 proizvoda. To je 41 proizvod u mnogo boja, plus 27 zaista samostalnih artikala.

## Razmatrane opcije

| Opcija | Odbačeno / prihvaćeno | Razlog |
| --- | --- | --- |
| `noindex` na sve varijante | **Odbačeno** | Gubi se svaka vrednost varijanti, a brief izričito traži da se ne noindeksira naslepo. |
| `noindex` + canonical na grupu | **Odbačeno** | Kontradiktoran signal. Google može preneti `noindex` na canonical cilj, čime bi se deindeksirala i sama stranica grupe. |
| Brisanje varijantnih URL-ova | **Odbačeno** | Kupci koriste direktne linkove ka nijansi; ruši se korisnički tok i postojeći linkovi. |
| **Canonical na grupu + izbacivanje iz sitemapa** | **Prihvaćeno** | Standardan obrazac za konsolidaciju bliskih duplikata. Stranice ostaju upotrebljive, prolazne za link equity i pune 200. |

## Implementirana strategija

```
grupa (>= 2 varijante)     -> indeksabilna, self-canonical, u sitemapu, ProductGroup schema
varijanta takve grupe      -> canonical na grupu, NIJE u sitemapu,
                              meta robots ostaje "index, follow"
proizvod sa 1 varijantom   -> nepromenjen; već jeste sopstveni najbolji entitet
```

Ključna odluka: **varijante zadržavaju `index, follow`.** Canonical sam po sebi saopštava konsolidaciju. Dodavanje `noindex` uz cross-canonical šalje dve suprotne instrukcije.

## Sprovođenje kroz kod

Jedan predikat određuje i canonical i pripadnost sitemapu, pa ne mogu da se raziđu:

- `lib/product-families.ts` — `getFamilyForProduct()` je jedini izvor istine
- `app/proizvodi/[slug]/page.tsx` — prosleđuje `canonicalPath` kada varijanta pripada grupi
- `app/sitemap.ts` — izuzima `getConsolidatedVariantSlugs()`
- `lib/seo/product-breadcrumbs.ts` — ubacuje grupu u putanju

## Otkrivenost stranica grupa

Prva verzija je proizvela **41 orphan stranicu**: grupe su bile u sitemapu ali nijedan link nije vodio do njih. Otkriveno tek proverom izgrađenog HTML-a, ne tokom pisanja koda.

Rešeno ubacivanjem grupe u breadcrumb varijante, čime 715 stranica sada linkuje ka svojoj grupi. Nakon izmene: `orphanPages: 0`.

## Imenovanje grupa

Naziv se izvodi kao najduži zajednički prefiks zvaničnih naziva varijanti:

```
"Cosmos Lac Automotive Antichip 250 White"
"Cosmos Lac Automotive Antichip 251 Black"   -> "Cosmos Lac Automotive Antichip"
```

Dve korekcije bile su neophodne nakon provere izlaza:

1. Prvo uklanjanje „šuma" bilo je preagresivno i skratilo je `Cosmos Lac RAL` na `Cosmos Lac` — grupa je dobila URL `/proizvodi/grupa/cosmos-lac`. Reči koje su deo naziva linije se sada čuvaju.
2. Ostaci šifara (`CL`, goli brojevi poput `01`) uklanjaju se sa kraja, ali `700°C` ostaje jer je deo naziva linije.

## `variesBy`

Prva verzija je zaključivala `color` iz postojanja `colorName` polja. To je pogrešno: generator koristi to polje i kao generičku oznaku varijante, pa su maziva i čistači dobijali `variesBy: color`.

Sada se `color` postavlja samo kada je `technicalCategory` u `cosmosColorCategories` (`lib/cosmos-lac-data.ts`). Kada nijedna osa nije odbranjiva, `variesBy` se **izostavlja** umesto da se pogodi — pogrešna osa je netačna mašinski čitljiva tvrdnja o proizvodu.

## Rezultat

| Metrika | Pre | Posle |
| --- | ---: | ---: |
| URL-ova u sitemapu | 872 | **198** |
| Indeksabilnih stranica proizvoda u sitemapu | 832 | **158** (117 samostalnih + 41 grupa) |
| Parova canonical stranica >0.90 sličnih | mnogo | **0** |
| Parova canonical stranica >0.75 sličnih | — | **6** |
| Najveća sličnost među canonical stranicama | ~0.90 | **0.79** |
| Orphan stranica | 0 | **0** |
| Broken internih linkova | 0 | **0** |

## Uticaj na postojeće skripte

Dve postojeće provere kodirale su staru politiku i morale su da se aktuelizuju:

- `scripts/validate-seo.mjs` je smatrao „validnim linkom" samo onaj koji je u sitemapu, pa je prijavio 1631 lažno „broken" link. Sada proverava da URL vraća 200 i da canonical pokazuje na grupu.
- `scripts/seo-audit.mjs` je brojao konsolidaciju kao `wrongCanonical` (715). Sada je razdvojeno u zasebnu metriku `consolidatedVariantCanonicals`.
