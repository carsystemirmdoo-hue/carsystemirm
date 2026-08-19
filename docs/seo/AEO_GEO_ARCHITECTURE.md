# Carsystem AEO/GEO arhitektura — V1

Datum: 2026-08-08

Sistem je izgrađen. Domensko znanje nije popunjeno, i to je namerno.

## Vodeći princip

> Ako se tehnički podatak ne može potvrditi iz pouzdanog izvora u projektu, kreira se struktura za njega i ostavlja prazna.

Nijedna tvrdnja o autolakirerstvu nije generisana da bi se popunilo polje. Nijedna vrednost nije izvedena iz naziva proizvoda, kategorije ili sistema.

Ovo je sprovedeno tipovima, ne dogovorom: vrednost se ne može prikazati bez prolaska kroz `publishedValue()`, koja odbija sve osim `expert-verified`.

## Slojevi

```
lib/carsystem-data.ts    činjenice o katalogu (proizvodi, brendovi, programi)
lib/knowledge/*          domensko znanje + poreklo + status pregleda
lib/seo/*                kako se sve to prikazuje crawlerima
```

Sloj znanja sme da čita katalog. Katalog nikada ne čita sloj znanja.

## Model porekla (`lib/knowledge/provenance.ts`)

Svaka tvrdnja odgovara na dva **razdvojena** pitanja:

1. Odakle potiče? → `KnowledgeSource`
2. Da li je Carsystem potvrdio da je tačno? → `VerificationStatus`

Razdvojeni su namerno. Vrednost izvučena iz zvaničnog R-M tehničkog lista ima odlično poreklo, ali je i dalje nepotvrđena dok je stručnjak ne odobri. Spajanje ta dva u jedan „pouzdano" flag je način na koji nepotvrđeni tehnički podaci završe objavljeni kao činjenica.

| Tip izvora | Značenje |
| --- | --- |
| `manufacturer-technical-document` | TDS / SDS — najjači dokumentarni izvor |
| `manufacturer-product-information` | Marketinški materijal proizvođača |
| `manufacturer-website` | Zvanični sajt proizvođača |
| `carsystem-expert` | Imenovani Carsystem stručnjak |
| `carsystem-internal-verified` | Interni podaci potvrđeni drugim procesom |

| Status | Značenje |
| --- | --- |
| `imported` | Ušlo kroz strukturirani import, niko nije čitao |
| `machine-extracted` | Skripta izvukla iz dokumenta — najviši rizik |
| `needs-review` | Čeka čoveka |
| `expert-verified` | Imenovani stručnjak potvrdio, sa datumom |
| `rejected` | Čovek pogledao i rekao da je netačno |

**Samo `expert-verified` sme da se objavi.**

### `Claim<T>`

`value` je opciono. `Claim<T>` bez vrednosti je smislen zapis: „ovo polje je relevantno za ovaj proizvod, a nemamo pouzdanu vrednost."

To je reprezentacija koja se koristi svuda gde bi se nepoznat tehnički podatak inače izmislio.

## Entiteti (`lib/knowledge/entities.ts`)

| Entitet | Status | Napomena |
| --- | --- | --- |
| `Substrate` | **novo** | 9 podloga. Bilo je potpuno odsutno. |
| `ProcessStep` | **novo** | 8 koraka, mapirani na postojeći `phaseSlug`. |
| `Defect` | **novo** | 8 defekata. Uzroci i sanacija prazni. |
| `Application` | **novo** | Spoj podloga + korak + metoda. |
| Product, Brand, Category | postoji | `lib/carsystem-data.ts` |
| ProductFamily, Variant | **novo** | `lib/product-families.ts` |

### Zašto su uzroci defekata prazni

Isti vidljivi simptom ima više mogućih uzroka. Pogrešna dijagnoza šalje radionicu u skupu preradu. Navođenje uzroka bez izvora je upravo ona vrsta uverljive izmišljotine koju brief zabranjuje.

## Tehnički profil proizvoda (`lib/knowledge/technical.ts`)

20 polja, sva kao `Claim`: podloge, faza procesa, način nanošenja, prethodni/sledeći proizvodi, odnos mešanja, učvršćivač, razređivač, vreme upotrebljivosti, pištolj i dizna, broj slojeva, odzračivanje, debljina sloja, brušenje, sušenje, temperatura, VOC, izdašnost, upozorenja, rešeni problemi.

Profili za svih **59 R-M proizvoda** generišu se automatski (`lib/knowledge/product-knowledge.ts`) sa:

- stvarnim `KnowledgeSource` zapisima koji pokazuju na TDS koji **već postoji u repozitorijumu**
- svim poljima kao `needs-review` bez vrednosti

To je iskrena reprezentacija onoga što danas znamo:

> „Tehnički list postoji na ovoj putanji, ova polja su relevantna za ovaj proizvod, i niko još nije izvukao ni potvrdio vrednost."

Koja su polja relevantna po kategoriji je *procena relevantnosti*, ne tehnička tvrdnja — određuje koja se pitanja pojavljuju na listi za pregled, nikad kakvi su odgovori.

## Terminologija (`lib/knowledge/terminology.ts`)

10 pojmova, 35 sinonima. **Svi su `needs-review`.**

Audit je izričito upozorio da se ne pretpostavi da su primeri univerzalno zamenljivi, i to upozorenje je opravdano: „punilo" i „prajmer" su jednom majstoru isti proizvod a drugom dva različita.

Sinonimi se koriste za razumevanje unosa korisnika — nikada kao skriveni tekst ni u metapodacima.

## Answer intents (`lib/knowledge/answer-intents.ts`)

20 pitanja iz audita. Spremnost se **izvodi**, ne čuva:

```
resolveAnswerIntentReadiness(intent)
```

Uskladišten flag se razilazi sa podacima i tako blokirano pitanje završi objavljeno.

### Trenutni status svih 20

| Spremnost | Broj |
| --- | ---: |
| ODGOVORIVO SADA | **0** |
| DELIMIČNO ODGOVORIVO | 11 |
| BLOKIRANO TEHNIČKIM PODACIMA | 1 |
| BLOKIRANO STRUČNOM VALIDACIJOM | 8 |

Nula odgovorivih pitanja je **tačan i očekivan rezultat**. Nijedan odgovor nije napisan jer bi svaki bio izmišljena tehnička tvrdnja. Sistem radi upravo tako što ih zadržava.

Podela na dva tipa blokade je bitna za planiranje: **8 pitanja** ne čeka nijedan tehnički podatak, samo odobren tekst. To su najjeftinija pitanja za otključavanje i logično prvo mesto za rad sa stručnjakom.

## Vodiči (`lib/knowledge/guides.ts`)

Pravilo iz briefa sprovedeno je kodom, ne disciplinom:

> Nijedna indeksabilna stranica ne sme postojati samo zato što postoji zapis u podacima.

`isGuidePublishable()` zahteva sve četiri: `status === "published"`, neprazno telo, `expert-verified` telo, minimum 120 reči sopstvenog teksta.

`generateStaticParams` i sitemap izvode se iz objavljenog skupa, pa nedovršen vodič **nema URL** — vraća 404 umesto prazne ljuske.

Danas: 3 vodiča u `draft` stanju, **0 generisanih stranica**. `/vodici` je `noindex` i nije u sitemapu dok je prazan; automatski postaje indeksabilan kada prvi vodič bude odobren.

## Structured data

Dodato samo tamo gde odgovara vidljivom sadržaju:

| Schema | Gde | Uslov |
| --- | --- | --- |
| `ProductGroup` + `hasVariant` | 41 stranica grupa | uvek |
| `isVariantOf` | 715 varijanti | pripada grupi |
| `isSimilarTo` | 90 stranica | povezani proizvodi prikazani na stranici |
| `subjectOf` → TDS | 65 stranica | dokument dostupan i linkovan |
| `isRelatedTo` | **0 stranica** | nijedna `compatibleProducts` sekcija nije `confirmed` |
| `Article` | vodiči | tek kada budu objavljeni |
| `FAQPage` | **nigde** | tek kada Q&A bude vidljiv na stranici |

`isRelatedTo: 0` je dokaz da disciplina radi: u podacima postoji tačno jedna `compatibleProducts` sekcija i ona je `needs_confirmation`, pa se ništa ne emituje. Schema prati vidljiv sadržaj.

Nigde nema `offers`, cene, dostupnosti ni recenzija.

## Sigurnost brend tvrdnji

Nigde — ni u vidljivom sadržaju ni u schema podacima — ne postoji „zvanični distributer", „ovlašćeni zastupnik" ni „ekskluzivni partner".

`ProductGroup.brand` navodi samo naziv brenda. `Organization` ne tvrdi distributivni odnos. Ovo ostaje tako dok poslovni podaci ne potvrde status.

## Alati

```bash
npm run knowledge:validate   # provera izgrađenog HTML-a, ne izvornog koda
npm run knowledge:review     # generiše CARSYSTEM_TECHNICAL_CONTENT_REVIEW.md
```

`validate-knowledge.mjs` proverava izgrađeni izlaz jer je bitno šta crawler dobije, ne šta izvorni kod namerava.
