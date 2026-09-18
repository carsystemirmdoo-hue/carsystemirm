# Carsystem catalog sync

Ponovljiv uvoz zvaničnog Carsystem asortimana u katalog sajta. Napravljen za
katalog 2026/27; sledeće izdanje se uvozi istim komandama.

```bash
npm run carsystem:sync            # ceo lanac: acquire → plan → apply → validate
npm run carsystem:sync:acquire    # samo preuzimanje izvora (jedini korak koji dira mrežu)
npm run carsystem:sync:plan       # DRY RUN: izveštaji, katalog se ne menja
npm run carsystem:sync:apply      # plan + upis u katalog
npm run carsystem:sync:check      # plan + provera da apply ne bi ništa promenio (exit 1 ako bi)
npm run carsystem:sync:validate   # provera rezultata u stvarnom runtime katalogu
npm run carsystem:sync:reconcile  # revizija: svaki source proizvod i svaka šifra imaju tačno jedan status
npm run test:carsystem-sync       # pravila matchinga i čitanja atributa
```

## Izvori i autoritet

Prioritet za pitanje „da li je proizvod TRENUTNO aktivan” (pravilo od 2026-09-18):

| # | Izvor | Uloga |
|---|---|---|
| 1 | **carsystem.org (EN)** — aktivna stranica proizvoda iz zvaničnog sitemap-a | **autoritet za trenutni asortiman**: stranica sa nazivom i šifrom artikla = aktivan, naručiv proizvod → mora biti u našem katalogu. Daje i šifre, specifikacije, opise, slike, TDS/SDS, preporuke, oznaku „New”. |
| 2 | **CARSYSTEM Product Catalogue (EN), PDF** sa `carsystem.org/en/catalogues` | referentni dokument: potvrda asortimana, varijante koje sajt ne navodi, istorijske šifre, oznaka „NEW”. Proizvod koji je SAMO u PDF-u (bez stranice, slike i opisa) se ne uvozi. |
| 3 | naši lokalni podaci | samo za prepoznavanje postojećih ručnih zapisa |

Merchandising se uvozi kao i sve ostalo: svaka stavka na carsystem.org je naručiv
artikal sa šifrom i prodajnim pakovanjem. PDF katalozi, brošure i download
materijali nisu stranice proizvoda i ne ulaze u sitemap proizvoda.

Distributeri, webshopovi i pretraživači nisu izvor ni za jedno polje. EAN ne
objavljuje nijedan od dva zvanična izvora, pa ga sync nema.

Spoj dva izvora ide **isključivo po šifri artikla**. Svaka razlika se beleži
(`conflicts` u source datasetu), ništa se ne ispravlja tiho.

## Lanac

| # | Skripta | Ulaz → izlaz |
|---|---|---|
| 1a | `acquire-website.mjs` | sitemap + stranice → `data/carsystem-sync/raw/website-en.generated.json` |
| 1b | `acquire-catalogue.mjs` | PDF → `raw/catalogue-<izdanje>.generated.json` |
| 2 | `build-source.mjs` | oba RAW fajla → `source-products.generated.json` (normalizovano, sa atributima varijanti) |
| 3 | `acquire-images.mjs`, `acquire-documents.mjs` | zvanični packshotovi i TDS u `.cache/` + manifesti sa sha256 |
| 4 | `plan.mjs` | source + naš runtime katalog + registar + odluke → `reports/*` |
| 5 | `apply.mjs` | plan → `data/carsystem-catalog-products.generated.json`, registar, `public/products/carsystem/catalog/*.webp` |
| 6 | `validate.mjs` | runtime katalog → greške / upozorenja |

RAW i normalizovani dataset su odvojeni: koraci 2, 4, 5 i 6 rade bez mreže, pa
se transformacija može ponavljati bez ponovnog scrapinga. Sirovi HTML, PDF i
originalne slike su u `.cache/carsystem-sync/` (gitignored).

Sajt čita samo `data/carsystem-catalog-products.generated.json`, kroz
`lib/carsystem-catalog-products.ts` — isti obrazac kao R-M i Baslac uvoz.

## Model varijanti

Jedna zvanična stranica = **jedan proizvod** na sajtu. Šifre artikala
(granulacije, pakovanja, dimenzije, veličine) su redovi `detail.variants`, isto
kao kod ručno uređenog F.23 — ne zasebne kartice. 404 proizvoda nose 874 šifre.

Kada više zvaničnih stranica ima isti naziv (F.19 150 mm i 77 mm), naziv dobija
razlikovni deo zvaničnog podnaslova: „Carsystem Sanding Disc F.19 – 77 mm”.

## Matching sa postojećim zapisima

`scripts/carsystem-sync/lib/match.mjs`, pokriveno testovima. Lestvica dokaza:

1. šifra artikla koju zapis sam nosi → `EXACT_MATCH`
2. EAN → (izvori ga ne objavljuju)
3. raspon serije potvrđen u `lib/productNamedColors.mjs` → `HIGH_CONFIDENCE_MATCH`
4. naša slika bajt-identična zvaničnom packshotu **i** naziv/kôd → `HIGH_CONFIDENCE_MATCH`
5. jedinstven tačan normalizovan naziv → `HIGH_CONFIDENCE_MATCH`; uz sukob pakovanja → `PROBABLE_MATCH`
6. samo slika, ili kôd serije sa jednim kandidatom → `PROBABLE_MATCH`
7. kôd serije sa više kandidata → `AMBIGUOUS`
8. ništa → `LEGACY_NOT_IN_<izdanje>`

Nivo 4 važi i za bajt-identičan zvanični TDS koji ručni zapis hostuje (tako je
„Carsystem Git Multi Green” prepoznat kao zvanični „Multi Green”).

Fuzzy sličnost naziva se ne koristi ni na jednom nivou. Automatski se spajaju
samo `EXACT` i `HIGH_CONFIDENCE`. Kandidat `PROBABLE`/`AMBIGUOUS` zapisa se
**uvozi kao zaseban proizvod**, a veza se beleži (`relatedLegacySlug`): takav
ručni zapis nema nijednu zvaničnu šifru, pa duplikat po šifri nije moguć, a
aktivan proizvod ne sme da ostane nepredstavljen. Spajanje naknadno radi vlasnik
kroz `manual-decisions.json`.

Kada proizvođač prenumeriše artikal (Finish Back Pad M-14: katalog 157.721 →
sajt 160.443), trenutna šifra je ona sa sajta; stara ostaje kao
`legacyArticleNumbers` / `legacyManufacturerCodes`, prikazuje se na PDP-u kao
„Prethodna šifra artikla” i pretraživa je, ali nije varijanta i ne pravi drugi
proizvod.

Ručni zapis se nikad ne briše i ne prepisuje. Pouzdano prepoznat zapis dobija
samo ono što mu fali (tabelu šifara artikala), kroz
`applyCarsystemCatalogEnrichment`.

## Idempotentnost

Slug se ne izvodi svaki put iz naziva: `data/carsystem-sync/identity-registry.json`
trajno vezuje **šifru artikla → naš slug**. Preimenovanje na carsystem.org zato
ne menja naš URL, a nova varijanta postojećeg proizvoda se prepoznaje po ostalim
šiframa. Registar se samo dopunjuje; red se ne briše jer je slug javni URL.

Drugo pokretanje nad istim izvorom: `0 new products`, `filesChanged: []`,
generisani fajlovi bajt-identični (`npm run carsystem:sync:check`).

## Ručne odluke

`data/carsystem-sync/manual-decisions.json`, čita se pri svakom pokretanju:

```json
{
  "local":  { "carsystem-git-multi-green": { "decision": "match", "sourceKey": "putties/multi-green-multifuncional-polyester-putty", "note": "potvrdio vlasnik" } },
  "source": { "merchandising-materials/lighter-black-refillable": { "decision": "skip", "note": "ne prodajemo" } }
}
```

- `local.<slug>`: `match` (+ `sourceKey`) ili `keep-separate`
- `source.<sourceKey>`: `skip` (ne uvozi iako je aktivan na sajtu — ruši paritet, pa `reconcile` to prijavljuje)

## Taksonomija

`data/carsystem-sync/taxonomy-map.json`: zvanična kategorija → naša (12
kategorija iz `lib/productTaxonomy.mjs`). Pravila se čitaju redom i gledaju
zvanični **podnaslov** (proizvođačev tip proizvoda), ne naziv. Rezultat se upisuje
u `taxonomyCategory`, što je red 0 lestvice u `getProductCategorySlug`.

Merchandising nema svoju platformsku kategoriju: brendirana radna odeća ide u
„Zaštita”, alat u „Pribor”, a brendiranje i opremanje radionice u „Radionica”
(najbliže postojeće; nova top-level kategorija nije uvedena).
Kategorija bez mappinga zaustavlja proizvod (`HELD_UNMAPPED_CATEGORY`), ne pada u
catch-all.

## Boja kartice

Sync upisuje `manufacturerColor` (boja serije + `source`), koji čita postojeće
pravilo `getProductNamedColor` — ručna tabela u `lib/productNamedColors.mjs` ima
prednost. Redosled:

1. proizvod čiji je SAM materijal na slici (`packshotShade` u taxonomy mapi:
   abrazivi, sunđeri, trake, folije, krpe, rukavice): uzorak dominantne boje sa
   zvaničnog packshota, samo kada pokriva ≥ 30 % neprovidne površine i slaže se
   sa zvanično navedenom bojom;
2. zvanično navedena boja („Colour: green”) → orijentacioni token;
3. neutralan proizvod (crn/siv/beo): medijana površine;
4. inače `null` → boja brenda, kao i do sada.

Crvena na packshotu se bez zvanično navedene crvene odbacuje: Carsystem pakuje
robu u crvene kutije, pa je to ambalaža, ne proizvod. Hemija u ambalaži nikad ne
dobija boju sa slike (slika prikazuje etiketu).

## SR sadržaj

`data/carsystem-sync/localization/<kategorija>.json`, pravila u
`data/carsystem-sync/LOCALIZATION_GUIDE.md`. Svaki unos nosi `sourceHash`
zvaničnog teksta iz kog je nastao: kada proizvođač promeni tekst, plan proizvod
označi `HELD_MISSING_LOCALIZATION` i ispiše ga u
`reports/localization-worklist.generated.json`, umesto da tiho ostavi zastareo
opis. Proizvod bez SR sadržaja se ne uvozi.

## Šta sync ne radi

- ne upisuje cene ni zalihe (svaki zapis je „Na upit”, `stockStatus: unknown`);
- ne briše proizvode, slike ni redove registra;
- ne menja ručne zapise, slugove ni URL-ove;
- ne preuzima štamparske originale slika (do 43 MB) — koristi zvanični 660 px
  render, isti koji postojeći Carsystem proizvodi već koriste;
- ne hostuje TDS lokalno (238 PDF-ova ≈ 100 MB): PDP vodi na zvanični dokument.
  SDS ostaje „na upit” — zvanični SDS je dinamički endpoint bez srpskog izdanja.

## Novo izdanje kataloga (2027/28)

1. U `scripts/carsystem-sync/lib/config.mjs` promeniti `CATALOGUE` (edition,
   editionKey, title, pdfUrl).
2. `npm run carsystem:sync:acquire -- ` pa `npm run carsystem:sync:plan`.
3. Pročitati `reports/SYNC_DRY_RUN.md` i `reports/CARSYSTEM_<izdanje>_NEW_PRODUCTS.md`.
4. Napisati SR sadržaj za stavke iz `localization-worklist.generated.json`.
5. `npm run carsystem:sync:apply && npm run carsystem:sync:validate`
6. `npm run images:metrics`, zatim uobičajene provere (lint, typecheck, build).

Proizvod koji nestane iz izvora ostaje na sajtu i pojavljuje se u
`noLongerInSource` — odluka o povlačenju je poslovna, ne tehnička.
