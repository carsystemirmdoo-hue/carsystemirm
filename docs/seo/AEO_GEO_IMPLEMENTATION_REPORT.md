# CARSYSTEM AEO/GEO FOUNDATION — IMPLEMENTATION REPORT

Datum: 2026-08-08
Grana: `recovery/pre-claude-2026-08-07`

Sve mere u ovom izveštaju su iz **izgrađenog produkcionog izlaza**, ne iz izvornog koda.

---

## 1. Files changed

### Novi fajlovi (20)

**Sloj znanja — tipovi i logika**
| Fajl | Uloga |
| --- | --- |
| `lib/knowledge/provenance.ts` | `Claim<T>`, `KnowledgeSource`, `VerificationStatus`, gate za objavljivanje |
| `lib/knowledge/entities.ts` | `Substrate`, `ProcessStep`, `Defect`, `Application` |
| `lib/knowledge/technical.ts` | 20 tehničkih polja proizvoda, sva kao `Claim` |
| `lib/knowledge/terminology.ts` | Srpski sinonimi sa statusom pregleda |
| `lib/knowledge/answer-intents.ts` | Answer intent model + izvedena spremnost |
| `lib/knowledge/guides.ts` | Vodiči + `isGuidePublishable()` gate |
| `lib/knowledge/product-knowledge.ts` | Spoj kataloga i znanja, upiti, statistika |
| `lib/knowledge/index.ts` | Javni ulaz u sloj |

**Sloj znanja — podaci**
| Fajl | Sadržaj |
| --- | --- |
| `data/knowledge/substrates.ts` | 9 podloga |
| `data/knowledge/process-steps.ts` | 8 koraka procesa |
| `data/knowledge/defects.ts` | 8 defekata (uzroci/sanacija prazni) |
| `data/knowledge/terminology.ts` | 10 pojmova, 35 sinonima |
| `data/knowledge/answer-intents.ts` | 20 pitanja iz audita |
| `data/knowledge/guides.ts` | 3 vodiča u `draft` stanju |

**Grupe proizvoda i rute**
| Fajl | Uloga |
| --- | --- |
| `lib/product-families.ts` | Izvođenje grupa, jedini predikat za konsolidaciju |
| `app/proizvodi/grupa/[slug]/page.tsx` | 41 stranica grupa |
| `app/vodici/page.tsx` | Indeks vodiča (noindex dok je prazan) |
| `app/vodici/[slug]/page.tsx` | Vodič (0 stranica dok nema odobrenih) |

**Alati i dokumentacija**
| Fajl | Uloga |
| --- | --- |
| `scripts/validate-knowledge.mjs` | Provera izgrađenog HTML-a |
| `scripts/export-technical-review.mjs` | Generisanje dokumenta za stručnjaka |
| `docs/seo/SEO_PRODUCT_GROUP_STRATEGY.md` | Obrazloženje Cosmos rešenja |
| `docs/seo/AEO_GEO_ARCHITECTURE.md` | Arhitektura sloja znanja |
| `docs/seo/CARSYSTEM_TECHNICAL_CONTENT_REVIEW.md` | **Generisano** — za vlasnika/stručnjaka |

### Izmenjeni fajlovi (10)

| Fajl | Izmena |
| --- | --- |
| `app/proizvodi/[slug]/page.tsx` | `canonicalPath` za varijante, relationship schema |
| `app/sitemap.ts` | Izuzimanje konsolidovanih varijanti, dodavanje grupa i vodiča |
| `lib/seo.ts` | `productGroupJsonLd()`, `productRelationshipJsonLd()`, `isVariantOf` |
| `lib/seo/metadata-builders.ts` | `canonicalPath` opcija, `buildProductFamilyMetadata()` |
| `lib/seo/product-breadcrumbs.ts` | Ubacivanje grupe u putanju |
| `lib/cosmos-lac-data.ts` | Export `cosmosColorCategories` |
| `scripts/validate-seo.mjs` | Razumevanje konsolidacije |
| `scripts/seo-audit.mjs` | Razdvajanje konsolidacije od `wrongCanonical` |
| `docs/seo/SEO_INDEXATION_MATRIX.md` | 4 nova tipa rute + 4 nova pravila |
| `package.json` | `knowledge:validate`, `knowledge:review` |

**Nije dirano:** nijedan vizuelni komponent, nijedan CSS modul, nijedan postojeći proizvodni zapis, nijedan brand page.

---

## 2. Architecture introduced

```
lib/carsystem-data.ts    činjenice o katalogu
lib/product-families.ts  grupe proizvoda (ProductGroup)
lib/knowledge/*          domensko znanje + poreklo + pregled
lib/seo/*                prezentacija ka crawlerima
```

Sloj znanja čita katalog. Katalog nikada ne čita sloj znanja.

---

## 3. Cosmos variant solution

Detaljno u `SEO_PRODUCT_GROUP_STRATEGY.md`.

```
grupa (>= 2 varijante)   -> indeksabilna, self-canonical, u sitemapu, ProductGroup
varijanta grupe          -> canonical na grupu, NIJE u sitemapu, robots ostaje index/follow
proizvod sa 1 varijantom -> nepromenjen
```

**Zašto varijante zadržavaju `index, follow`:** `noindex` uz cross-canonical su dva suprotna signala; Google može preneti `noindex` na canonical cilj i deindeksirati samu grupu.

| | Pre | Posle |
| --- | ---: | ---: |
| Grupa proizvoda | 0 | **41** |
| Konsolidovanih varijanti | 0 | **715** |
| Samostalnih proizvoda | 832 | **117** |
| Stranica proizvoda ukupno | 832 | 832 *(nijedna nije obrisana)* |

---

## 4. Knowledge model

9 entiteta. Tri su nova i bila su potpuno odsutna: `Substrate`, `Defect`, `AnswerIntent`.

Podržani lanci:

```
problem -> podloga -> proces -> tip proizvoda -> kompatibilan proizvod
        -> brend -> tehnička dokumentacija -> put do kupovine

pitanje -> potvrđen odgovor -> tehnički podaci -> primenjivi proizvodi
        -> dokumentacija -> srodni vodič
```

Struktura postoji u celosti. Podaci koji je pune ne postoje — vidi §12.

---

## 5. Provenance model

Dva **razdvojena** pitanja po tvrdnji:

1. Odakle potiče? → `KnowledgeSource` (5 tipova izvora, dokument/URL/strana/verzija)
2. Da li je Carsystem potvrdio? → `VerificationStatus` (5 stanja)

Samo `expert-verified` sme da se objavi. `publishedValue()` odbija sve ostalo, pa se `machine-extracted` vrednost ne može slučajno prikazati kao činjenica.

`Claim<T>` bez vrednosti je smislen zapis: *„polje je relevantno, pouzdanu vrednost nemamo."*

---

## 6. Expert-review model

`npm run knowledge:review` generiše `CARSYSTEM_TECHNICAL_CONTENT_REVIEW.md`:

| Sekcija | Stavki |
| --- | ---: |
| Visok prioritet — pitanja | 11 |
| Srednji prioritet — pitanja | 9 |
| Visok prioritet — tehnički podaci o proizvodima | 59 |
| Srednji prioritet — uzroci i sanacija defekata | 8 |
| Srednji prioritet — terminologija | 35 |
| Nizak prioritet — planirani vodiči | 3 |

Svako pitanje nosi format iz briefa: PITANJE / PREDLOŽENI ODGOVOR / ŠTA NEDOSTAJE / PRIMENJIVI PROIZVODI / IZVOR / STATUS (4 checkboxa) / NAPOMENA STRUČNJAKA.

Dokument **ne sadrži** canonical URL-ove, sitemap unose, metadata boilerplate, JSON-LD ni SEO konfiguraciju. Stručnjak pregleda domensko znanje, ne SEO inženjering.

Svako pitanje označava i **šta ga tačno blokira** — 8 pitanja ne čeka nijedan tehnički podatak, samo odobren tekst.

---

## 7. Serbian terminology model

10 pojmova, 35 sinonima, registri: `formal`, `common`, `workshop`, `spelling-variant`, `loanword`.

**Svi su `needs-review`.** Primeri iz audita (`bezbojni lak ↔ klarlak`, `razređivač ↔ tiner`, `punilo ↔ filer`) nisu označeni kao potvrđeni jer nisu univerzalno zamenljivi. Tri nose eksplicitnu napomenu o dvosmislenosti — npr. `punilac ↔ prajmer`, gde R-M program pravi razliku koju deo majstora ne pravi.

---

## 8. Answer-intent status

| Spremnost | Broj |
| --- | ---: |
| ODGOVORIVO SADA | **0** |
| DELIMIČNO ODGOVORIVO | 11 |
| BLOKIRANO TEHNIČKIM PODACIMA | 1 |
| BLOKIRANO STRUČNOM VALIDACIJOM | 8 |

Nula odgovorivih je tačan rezultat. Nijedan odgovor nije napisan jer bi svaki bio izmišljena tehnička tvrdnja.

---

## 9. Guide architecture

Rute postoje, sadržaja nema, i to je sprovedeno kodom:

`isGuidePublishable()` traži `status === "published"` **i** neprazno telo **i** `expert-verified` telo **i** ≥120 reči. `generateStaticParams` i sitemap izvode se iz objavljenog skupa.

Rezultat: **0 generisanih stranica vodiča**, `/vodici` je `noindex` i van sitemapa. Verifikovano u pregledaču.

---

## 10. Structured-data changes

| Schema | Stranica | Uslov |
| --- | ---: | --- |
| `ProductGroup` + `hasVariant` | **41** | uvek na grupi |
| `isVariantOf` | **715** | pripada grupi |
| `isSimilarTo` | **90** | povezani proizvodi vidljivi |
| `subjectOf` → TDS | **65** | dokument dostupan i linkovan |
| `isRelatedTo` | **0** | *nijedna `compatibleProducts` sekcija nije `confirmed`* |
| `FAQPage` | **0** | tek kad Q&A bude vidljiv |

**1754 JSON-LD blokova, 0 neispravnih.**

`isRelatedTo: 0` je dokaz da disciplina radi — u podacima postoji tačno jedna `compatibleProducts` sekcija i ona je `needs_confirmation`.

Nigde nema `offers`, cene, dostupnosti, recenzija ni tvrdnji o distributerskom statusu.

---

## 11. SEO before/after

Sve mereno iz izgrađenog izlaza u ovoj sesiji.

| Metrika | PRE | POSLE |
| --- | ---: | ---: |
| URL-ova u sitemapu | 872 | **198** |
| Indeksabilnih stranica proizvoda u sitemapu | 832 | **158** |
| Stranica grupa | 0 | **41** |
| Konsolidovanih varijanti | 0 | **715** |
| `wrongCanonical` | 715¹ | **0** |
| Orphan stranica | 41¹ | **0** |
| Broken internih linkova | 0 | **0** |
| Parova canonical stranica >0.90 sličnih | mnogo² | **0** |
| Parova canonical stranica >0.75 sličnih | — | **6** |
| Najveća sličnost među canonical stranicama | ~0.90² | **0.79** |
| ProductGroup schema | 0 | **41** |
| Neispravnih JSON-LD blokova | 0 | **0** |
| Build greške | 0 | **0** |
| `npm run seo:validate` failures | — | **0** |

¹ Međurezultat otkriven **posle** prve implementacije, tokom provere izgrađenog HTML-a. Oba su ispravljena, nisu zatečena stanja.
² Mereno u Phase 1 auditu: sličnost susednih varijanti 0.85–0.90 u velikim porodicama.

### Dve greške koje je uhvatila verifikacija

1. **41 orphan stranica** — grupe su bile u sitemapu ali nijedan link nije vodio do njih. Rešeno ubacivanjem grupe u breadcrumb varijante.
2. **`/proizvodi/grupa/cosmos-lac`** — preagresivno skraćivanje naziva srezalo je `Cosmos Lac RAL` na `Cosmos Lac`. Rešeno čuvanjem reči koje su deo naziva linije.

Nijedna se ne bi videla iz izvornog koda ni iz TypeScript provere.

### Dve postojeće skripte su kodirale staru politiku

- `validate-seo.mjs` je prijavio **1631 lažno „broken" linkova** jer je „validan link" definisao kao „u sitemapu". Sada proverava HTTP 200 + canonical na grupu.
- `seo-audit.mjs` je brojao konsolidaciju kao `wrongCanonical` (715). Razdvojeno u `consolidatedVariantCanonicals`.

---

## 12. Data still missing

Ovo je najvažniji deo izveštaja.

| Podatak | Stanje | Posledica |
| --- | --- | --- |
| **Podloge po proizvodu** | **0 zapisa** | „Koji prajmer ide na aluminijum" ostaje neodgovorivo |
| Odnos mešanja | 0 | Blokira 1 pitanje visokog prioriteta |
| Sušenje / temperatura | 0 | Blokira 1 pitanje visokog prioriteta |
| Debljina sloja / broj slojeva | 0 | Blokira 1 pitanje visokog prioriteta |
| Dizna i pritisak | 0 | Blokira 1 pitanje |
| VOC | 0 | Nije trenutno blokada |
| Izdašnost | 0 | Blokira procenu količine |
| Učvršćivač / razređivač po proizvodu | 0 | Blokira 1 pitanje visokog prioriteta |
| Uzroci i sanacija defekata | 0 od 8 | Blokira 2 pitanja |
| Kompatibilnost proizvoda | 1 sekcija, `needs_confirmation` | `isRelatedTo` prazan |
| Tekstovi vodiča | 0 od 3 | 0 objavljenih vodiča |
| Potvrda sinonima | 0 od 35 | Pretraga ne sme da širi upit |

**59 R-M proizvoda × relevantna polja = 655 praznih `Claim` slotova**, svaki sa stvarnom referencom na TDS koji već postoji u repozitorijumu.

---

## 13. Items requiring Carsystem expert review

Kompletno u `CARSYSTEM_TECHNICAL_CONTENT_REVIEW.md`. Redosled po povraćaju uloženog vremena:

1. **8 pitanja koja čekaju samo tekst** — priprema površine, 2K/1K, waterborne, AGILIS/ONYX, izbor nijanse, dva defekta, gde kupiti. Nijedan tehnički podatak ne nedostaje.
2. **Podloge za prajmere i punioce** (17 R-M proizvoda) — otključava 3 pitanja najvišeg prioriteta.
3. **Odnos mešanja + učvršćivač/razređivač** za bezbojne lakove (20 proizvoda).
4. **Sušenje i debljina sloja** za bezbojne lakove i punioce.
5. **35 sinonima** — brzo, a direktno utiče na pretragu.
6. **Uzroci i sanacija za 8 defekata.**

---

## 14. Recommended Phase 3

| # | Rad | Zavisi od |
| --- | --- | --- |
| 1 | Sesija sa stručnjakom za 8 „samo tekst" pitanja; objaviti prva 2–3 vodiča | — |
| 2 | Ekstrakcija podloga iz 59 R-M TDS-ova u `machine-extracted`, pa stručna potvrda | stručnjak |
| 3 | Rute `/podloge/[slug]` i `/problemi/[slug]` — programatske, ali tek kad ≥3 proizvoda kvalifikuju | 2 |
| 4 | `FAQPage` schema — tek kad Q&A bude vidljiv na stranici | 1 |
| 5 | Proširiti kategorije van R-M (742 Cosmos proizvoda nema kategorijsku stranicu) | — |
| 6 | Sinonimi u pretragu, tek nakon potvrde | stručnjak |
| 7 | `lastModified` u sitemapu; hijerarhija naslova na PDP-u (h1→h3) | — |
| 8 | Provera `MAINTENANCE_MODE=false` u produkciji + automatska provera | — |

Stavke 5, 7 i 8 su preostale iz Phase 1 audita i nisu deo ovog zadatka.

**Kritični put je stavka 2.** Ima najduže vreme isporuke i uslovljava skoro sve ostalo.
