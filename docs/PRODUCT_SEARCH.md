# Product Search V1 — arhitektura

Jedna pretraga za Header, Homepage i Katalog. Ovaj dokument je ugovor: šta je
jedan izvor podataka, kako se rangira i šta sme da se menja bez regresije.

## 1. Tok

```
CarsystemProduct (data/…)                     ← izvor podataka
  → getCatalogListingData()                   ← katalog model (41 porodica, 117 samostalnih, 715 varijanti)
    → lib/search/buildSearchIndex.ts          ← jedan generator
      → /katalog/search-index.json            ← jedan lazy asset (force-static)
        → lib/search/productSearchClient.ts   ← jedan modul-level keš i promise
          → lib/search/productSearchWorker.mjs ← jedan engine, u Web Workeru
            → components/search/ProductSearchDialog  (Header + Homepage)
            → components/catalog/CatalogExplorer     (/katalog?q=)
              → PDP  ili  /katalog?q=<upit>
```

Nijedna od tri ulaznih tačaka nema sopstveni algoritam, sopstveni fetch niti
sopstveni keš. Panel i katalog dele isti rangirani rezultat; razlikuje ih samo
prikaz (panel grupiše, katalog prikazuje sve).

## 2. Indeks

Nastaje iz `getCatalogListingData()` — iste funkcije koju koristi katalog, pa
paralelni product model ne postoji. Varijante prolaze kroz javni
`expandVariant()`, tako da šifra, tehnička linija i vizuelna prezentacija izlaze
iz iste formule kao katalog kartica.

| Vrsta | Broj | `id` | `href` |
|---|---|---|---|
| `family` | 41 | `family:<slug>` | `/proizvodi/grupa/<slug>` |
| `standalone` | 117 | slug | `/proizvodi/<slug>` |
| `variant` | 715 | slug | `/proizvodi/<slug>` |
| **ukupno** | **873** | | |

Zapis nosi samo polja za pretragu i prikaz rezultata (`name`, `productCode`,
`brandName`, `categorySlugs`, `technicalLine`, `quantityLabel`, `familySlug`,
`familyName`, `variantName`, `imageSrc`, `terms`) plus `card` na varijantama —
podatke koje katalog koristi da nacrta karticu. `card` je razlog zašto je raniji
`/katalog/variant-index.json` mogao da nestane: jedan asset umesto dva.

Zabranjena polja (guard u `scripts/validate-catalog-search-index.mjs`): duži
opisi, `purpose`, `detail`, dokumenti, specifikacije, preporuke, povezani
proizvodi, galerije, `packages`, `catalogMetadata`, `sourceReference`,
`verificationStatus`, SEO opisi.

`terms` su samo tokeni koje NIJE moguće izvesti iz prikazanih polja (interna
šifra boje, RAL broj, naziv linije, tehnička kategorija). Sve što već postoji u
nazivu se odbacuje, pa asset ne nosi kopiju naziva po zapisu.

Family zapis dodatno nosi tokene koje deli VEĆINA njegovih varijanti (prag 50%),
bez mera. Bez toga se `Cosmos Lac Fast Acrylic` (27 od 29 varijanti u RAL
nijansama) i `Cosmos Lac Easy Max` (30 od 52) nisu nalazili upitom „ral", iako
su stvarno RAL linije — a njihove varijante jesu. Ukupno 64 tokena na 41 family
zapis; varijante i samostalni proizvodi se ne diraju.

Validator proverava staleness u oba smera (nijedan proizvod ne sme da nedostaje,
nijedan obrisan zapis ne sme da ostane), jedinstvenost ID-jeva, ispravnost svih
`href` vrednosti, determinizam dva uzastopna preuzimanja i da početni HTML
Homepage-a i `/katalog` ne referišu asset.

## 3. Normalizacija (`lib/search/normalize.mjs`)

| Ulaz | Ključ |
|---|---|
| `Razređivač`, `razredjivac` | `razredjivac` |
| `Učvršćivač`, `ucvrscivac` | `ucvrscivac` |
| `C 2E50`, `c2e50`, `c-2e50` | kompaktno `c2e50` |
| `600ml`, `600 ml` | tokeni `600`, `ml`, `600ml` |
| `3,5 l`, `3.5 l`, `3.5l` | tokeni `3.5`, `l`, `3.5l` |
| `Pasta 190.` | `pasta`, `190` |

`đ` se mapira na `dj` eksplicitno — NFD dekompozicija ga ne dodiruje, i to je
bio uzrok nule rezultata za „razredjivac" u prethodnoj pretrazi.

Mera napisana kao dve reči (`600 ml`) spaja se u jednu grupu upita, pa razmak ne
menja rezultat, i traži se ISKLJUČIVO kao spojen token (`600ml`). Razlaganje na
„`600` i `ml` bilo gde u zapisu" je uklonjeno posle konkretnog promašaja:
`Cosmos Lac Flame Blue FB 600` je pakovanje od 400 ml sa šifrom 600, pa je
poklapao `600` u šifri i `ml` u tehničkoj liniji. Spojen oblik je dovoljan jer
ga indeksna strana emituje svuda gde mera stvarno postoji.

Mera nikada ne postaje termin PORODICE: porodica se upravo deli na varijante po
volumenu, pa `600 ml` opisuje varijantu, ne grupu.

Sinonimi (`lib/search/aliases.mjs`) su eksplicitna tabela, ne heuristika, i nose
najniži rang. **Nisu taxonomy mapping** i ne menjaju kategoriju proizvoda —
poslovna klasifikacija ostaje otvorena (`docs/CATALOG_TAXONOMY.md`).

## 4. Rangiranje (`lib/search/engine.mjs`)

Obrada: normalizacija → exact mape (šifra, id) → postings po tokenu → prefiks
opseg nad sortiranim rečnikom → fuzzy samo nad rečnikom tokena → bodovanje →
stabilan poredak. Nema linearnog fuzzy prolaza kroz zapise.

| Prioritet | Signal | Bodovi |
|---|---|---|
| 1 | ceo upit = šifra proizvoda | 1000 |
| 2 | ceo upit = id / slug / family slug | 950 |
| 3 | ceo upit = pun naziv varijante | 900 |
| 4 | ceo upit = pun naziv proizvoda/porodice | 880 |
| 5 | naziv počinje celim upitom | 700 |
| 6 | sve reči upita nađene u nazivu | 600 |
| 7 | token u šifri | 120 |
| 8 | token u nazivu | 100 |
| 9 | token u nazivu varijante | 92 |
| 10 | token u nazivu porodice | 70 |
| 11 | token u brendu | 52 |
| 12 | token u tehničkoj liniji | 44 |
| 13 | token u kategoriji | 36 |
| 14 | token u alias/terminu | 28 |
| 15 | token u pakovanju | 22 |

Množioci: prefiks ×0,6; alias ×0,28; fuzzy ×(0,55 − 0,22 × (distanca − 1)).
Bonus za pokrivenost svih reči: +2000 — veći od najveće moguće sume pojedinačnih
poklapanja, pa AND rezultat ne može da padne ispod OR rezultata. Kanonski
entitet dobija +18 (porodica) / +9 (samostalni), što odlučuje samo izjednačenja.

**AND pre OR**: ako ijedan zapis pokriva sve reči upita, rezultat su samo takvi
zapisi. Delimična poklapanja su fallback za upit u kome je jedna reč promašena.

Pragovi: fuzzy tek od 5 znakova u tokenu i 3 znaka u upitu; tolerancija 1 za
5–7 znakova, 2 od 8; jedan i dva znaka rade isključivo exact/prefiks. Prefiks
vredi samo u nazivu, šifri, varijanti, porodici i brendu.

Tie-breaker: `score → vrsta (porodica, samostalni, varijanta) → normalizovan
naziv → id`. Poslednja dva su jedinstvena po zapisu, pa je poredak totalan i isti
upit uvek daje isti niz.

Debug scorer: `searchIndex(index, query, { debug: true })` vraća `explain` sa
svakim doprinosom. Dostupan je testovima i dev okruženju; produkcijski poziv iz
UI-ja ga ne traži.

## 5. Grupisanje (`lib/search/grouping.mjs`)

Samo prikaz u panelu; ne menja rezultat engine-a ni njegov redosled.

- tačna varijanta (score ≥ 3400) → direktan red;
- generički upit → red porodice + najviše 3 najbolje varijante, uz ukupan broj;
- porodica nosi naslov i kad se sama nije poklopila (zapis porodice uvek postoji);
- samostalni proizvod → sopstveni red;
- najviše 8 grupa; `Prikaži sve rezultate` vodi na `/katalog?q=` gde su sve
  varijante pojedinačno vidljive.

## 5a. Najkraći upit

| Dužina (normalizovano, bez razmaka) | Ponašanje |
|---|---|
| 0 | početne instrukcije, indeks se ne dira |
| 1 | „Unesite najmanje 2 znaka" — pretraga se NE pokreće, asset se ne preuzima, `Enter` ne navigira |
| 2 | exact + prefiks nad nazivom, šifrom, varijantom, porodicom i brendom; bez fuzzy |
| ≥ 3 (token ≥ 5) | uključuje se fuzzy po pravilu tolerancije |

Pravilo živi u `engine.mjs` (`MIN_QUERY_LENGTH`), ne samo u UI-ju, pa i
`/katalog?q=c` i svaki budući potrošač dobijaju isti odgovor. Katalog u tom
slučaju ne kaže „nema rezultata" nego traži duži upit; panel isto, uz
`role="status"` najavu za čitače ekrana.

Izuzetak bi tražio stvarnu jednoslovnu šifru. U podacima je nema: najkraća je
dvoznakovna, a jednoslovni tokeni (`C`, `R`, `P`) su prvi deo dvodelnih oznaka
tipa `C 2E50`, koje se i dalje nalaze u celini.

## 6. Lenjo učitavanje

Asset se ne dodiruje pri otvaranju Homepage-a, Headera ni `/katalog` bez `q`.
Preuzima se pri prvom otkucanom znaku, jednom po učitanoj stranici, kroz
modul-level promise koji dele sve tri ulazne tačke. Remount, Back navigacija i
dva istovremeno otvorena ulaza ne prave nov zahtev. Pao zahtev se ne kešira, pa
ga „Pokušaj ponovo" može ponoviti. Zastareo odgovor ne može da pregazi noviji
(redni broj upita u `useProductSearch`).

Worker se ne gasi pri zatvaranju panela — instanca je jedna po učitanoj
stranici, pa 20 ciklusa otvaranja i zatvaranja i dalje daje jedan worker i jedan
mrežni zahtev.

## 7. Šta se ne sme regresirati

- kanonski model kataloga: 41 porodica + 117 samostalnih = 158 browse entiteta;
- P1-03: nijedna varijanta u početnom `/katalog` payload-u;
- `/katalog` bez `q` bez ijednog zahteva za indeks;
- `href` varijante ostaje `/proizvodi/<slug>`;
- Header motion theme lifecycle i custom kursor (panel se renderuje u
  `document.body` i koristi globalne tokene, ne header chapter promenljive).

## 7a. Izmereno na 3.959 zapisa

Ne procenjeno — generisano kroz istu shemu i isti `JSON.stringify` put
(`npm run search:benchmark`, fixture ide u gitignorovan `tmp/`):

| | 873 (danas) | 3.959 (cilj) |
|---|---|---|
| raw | 656 KB | 2.993 KB |
| gzip | 45 KB | **187 KB** (budžet 300 KB) |
| brotli | 34 KB | 117 KB |
| `JSON.parse` | 6,5 ms | 10,6 ms |
| gradnja indeksa (worker) | ~100 ms | 97,5 ms |
| structured clone UI → worker | — | 7,5 ms, jednom |
| odgovor: indeksi vs puni zapisi | — | 0,01 ms vs 0,62 ms (62×) |
| warm p50 / p95 / max | — | 0,30 / 0,82 / 1,60 ms |
| p95 na ×4 sporijem uređaju | — | 3,3 ms (limit 50 ms) |
| memorija indeksa | — | 15,2 MB |

Raniji izveštaj je ovu veličinu procenio na „~110 KB gzip"; stvarno merenje je
187 KB. Procena je bila niska za 70%, što je i razlog zašto je zamenjena
merenjem.

## 8. Isporuka i kompresija

Deployment target je Vercel (`deployment/README.md`, linkovan projekat
`carsystemirm`). Asset je prerenderovan route handler — ista klasa kao
`/sitemap.xml`, sa istim `cache-control: public, max-age=0, must-revalidate`.
Izmereno na produkciji za tu klasu:

```
GET https://carsystemirm.com/sitemap.xml
content-encoding: br · etag: W/"…" · x-vercel-cache: HIT
identity 104.449 B → brotli 9.557 B (10,9×) · gzip 10.108 B
```

Kompresiju radi Vercel edge; aplikacija ne radi nikakvo ručno pakovanje ni
raspakivanje. `next start` (lokalni `npm run start:check`) NE kompresuje
prerenderovani izlaz — to je svojstvo samostalnog Node servera bez proxyja i ne
odnosi se na produkciju. Ako se ikad aktivira `deployment/shared-hosting`
(Apache), kompresiju treba uključiti u `.htaccess` (`mod_deflate` /
`mod_brotli` za `application/json`) pre nego što se pretraga pusti u rad tamo.

## 9. Provere

```bash
npm run test:search                                   # engine, normalizacija, grupisanje, benchmark
npm run catalog:validate                              # listing + payload + search indeks (traži pokrenut server)
node scripts/validate-search-deltas.mjs --base-url=…  # potvrđeni brojevi na stvarnim podacima
node --expose-gc scripts/benchmark-search-asset.mjs   # stvarna veličina i vreme na 3.500+ zapisa
node scripts/qa-product-search.mjs --base-url=…       # runtime QA u browseru
node scripts/qa-search-lifecycle.mjs --base-url=…     # worker/keš vlasništvo i teardown
```

### Vlasništvo workera

Worker pravi i drži modul-level keš u `lib/search/productSearchClient.ts`, ne
komponenta. Živi koliko i učitani dokument: zatvaranje panela, promena rute i
Back ga ne gase, jer bi svako sledeće otvaranje ponovo gradilo indeks. Gasi ga
`dispose()` iz `disposeSearchIndexForTeardown()` (testovi i QA) i sam browser
pri napuštanju dokumenta. Puna navigacija je nov dokument i legitimno pravi nov
keš i nov worker — mereno je da ih po dokumentu ima tačno jedan.

## Carsystem sync (2026-09-18)

Ponašanje pretrage nije menjano; promenili su se podaci.

- **Šifre artikala varijanti su termini.** `productTerms` sada dodaje `id` svakog
  reda `detail.variants` (Carsystem: jedna proizvođačka šifra po granulaciji ili
  pakovanju). Upit `160.273` (P40 diska P.25 Ceramic) nalazi proizvod iako je
  `sku` samo vodeća šifra. Zaključano u `validate-search-deltas.mjs`
  (`MUST_INCLUDE`). `detail` i dalje nije polje indeksa — u indeks ulaze samo
  tokeni šifara.
- **`ral`: 126 → 130.** Četiri zvanična proizvoda „Rallye-Spray” — prefiks reči,
  isto pravilo po kome se nalazi i „RAL”.
- **`1l`: 4 → 61, `3,5 l`: 1 → 10.** Stare vrednosti su zastarele još od Baslac
  kataloga (commit `b8d4b44`): čist HEAD vraća 50, odnosno 10, i validator je bio
  crven pre Carsystem uvoza i pre bilo kog necommitovanog rada. Carsystem sync na
  `1l` dodaje 11 proizvoda sa jednom varijantom čija je zvanična specifikacija
  tačno „1 L”; na `3,5 l` ne dodaje ništa. Svih 61/10 zapisa je provereno prema
  polju volumena — 0 lažnih pogodaka. Poznato ograničenje (nije regresija):
  proizvod sa VIŠE pakovanja ne nosi zapreminu kao termin („pakovanje je osa
  varijacije”), pa 17 uvezenih proizvoda koji imaju i varijantu od 1 L upit `1l`
  ne vraća.
