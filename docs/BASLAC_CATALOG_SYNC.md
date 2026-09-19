# baslac catalog sync

Ponovljiv, idempotentan uvoz aktuelnog baslac asortimana (brend u okviru Surventisa,
ranije BASF Coatings). Isti standard kao [Carsystem](CARSYSTEM_CATALOG_SYNC.md),
[C.A.R.FIT](CARFIT_CATALOG_SYNC.md), [Befar](BEFAR_CATALOG_SYNC.md) i
[R-M](RM_CATALOG_SYNC.md) sync; kod je zaseban (`scripts/baslac-sync/`) i koristi samo
generičke pomoćnike (`http.mjs`, `rm-pdf-text.mjs`, korak objave slika, `catalog-runtime.mjs`).

```bash
npm run baslac:sync            # acquire → plan → apply → validate → reconcile
npm run baslac:sync:acquire    # sajt + indeks/direktorijum + tehnički listovi + model + slike (mreža)
npm run baslac:sync:plan       # dry run: reports/SYNC_DRY_RUN.md, sync-plan.generated.json
npm run baslac:sync:apply      # jedini korak koji menja katalog
npm run baslac:sync:check      # šta bi apply promenio (idempotentnost = prazna lista)
npm run baslac:sync:validate   # sadržaj, slike, odnosi, runtime
npm run baslac:sync:reconcile  # COVERAGE GATE (A/B/C/D) + mereni broj kartica
npm run test:baslac-sync
```

Pretraga se proverava nad pokrenutim buildom:
`node scripts/baslac-sync/qa-search.mjs --base-url=http://localhost:3220`.

## Izvori i autoritet

| Izvor | Uloga |
| --- | --- |
| `baslac.com/en-emea` (6 stranica kategorija) | dokaz da je proizvod U PONUDI, zvanični naziv, osobine, packshot |
| `baslac.com/en-emea/technical-data-sheets` | zvanični INDEKS dokumenata (9 strana) |
| `techinfo.baslac.com/en/` | otvoren direktorijum tehničkih listova; sadržaj lista = činjenice |

Nije izvor: distributeri, marketplace sajtovi, Google Images, mirori chartova.

**Pravilo aktuelnosti:** CURRENT je šifra koju potvrđuje stranica kategorije ILI indeks
tehničkih listova. Fajl koji postoji samo u otvorenom direktorijumu nije dokaz.

**Javna zvanična šifra je oznaka proizvoda** (`40-40`, `50-415`). Brojevi artikala postoje
samo u imenima zvaničnih slika (`Baslac_1L_20-24_50206943.png`) i **ne objavljuju se** —
ni u datasetu, ni u pretrazi, ni u SR tekstu.

## Slojevi podataka

| Sloj | Fajl |
| --- | --- |
| RAW sajt (kartice) | `data/baslac-sync/raw/website.generated.json` |
| RAW dokumenti | `data/baslac-sync/raw/techinfo.generated.json` |
| Činjenice iz tehničkih listova | `data/baslac-sync/raw/tds-facts.generated.json` |
| Model proizvoda | `data/baslac-sync/source-products.generated.json` |
| Slike (manifest / objavljene) | `image-manifest.generated.json`, `published-images.generated.json` |
| Identitet (append-only) | `data/baslac-sync/identity-registry.json` |
| Ručne odluke | `data/baslac-sync/manual-decisions.json` |
| Taksonomija | `data/baslac-sync/taxonomy-map.json` |
| SR sadržaj | `data/baslac-sync/localization/<uloga>.json` |
| Dataset sajta | `data/baslac-catalog-products.generated.json` → `lib/baslac-catalog-products.ts` |
| Izveštaji | `data/baslac-sync/reports/` |

Tekst listova se izvlači iz PDF-ova koje repozitorijum već hostuje
(`public/documents/products/baslac`, 49 od 52 aktuelna lista); ostatak ide u keš. Rezultat
se **commituje**, pa čist checkout može da ponovi sync bez mreže i bez keša.

## Pravila modela

### Stranica kategorije je lista KARTICA

Kartica nosi šifru(e), naziv, osobine i packshot. Grupna kartica („50- /55- /57- Hardeners")
nabraja proizvode u `<li>` stavkama — tu je jedna stavka jedan proizvod. U kartici
proizvoda stavka sa šifrom NIJE proizvod nego kombinacija („Hardener 55-10 EP").

Vodeća šifra se iz naziva skida kao ceo token: „12-20 2K Universal Bodyfiller" →
„2K Universal Bodyfiller". Brisanje vodećih cifara bi pojelo „2" iz „2K".

### Sistemi za nijansiranje

`Topcoat 30`, `Topcoat 30 CV`, `Basecoat 35`, `Basecoat 45` su SISTEMI. Pojedinačni toneri
se zvanično ne objavljuju (0 javnih toner šifara) i ne dobijaju kartice — ostaju varijante
svoje porodice, sa preusmerenjem na porodicu.

Zapis sistema nosi javni identitet porodice (`catalogMetadata.familyIdentity`): zvanično
ime i **postojeću adresu**, pa preimenovanje ne pomera URL (`/proizvodi/grupa/baslac-line-30`
i dalje radi, a kartica se zove „baslac Topcoat 30").

### Mixing clear / konverter

`30-S00`, `30-S01`, `35-M00`, `45-W00` imaju svoj tehnički list, ali ih sajt ne navodi kao
proizvode. Vode se kao UGNJEŽDENE činjenice sistema (`systemComponents`), bez kartice, i ne
ulaze u pokrivenost. `30-S01 Converter CV` pripada CV liniji — tako ga vodi
`lib/baslac-systems.ts`, a potvrđuju i istovetni varijantni listovi.

### Promocija iz linije

`45-R45` i `45-W10` imaju sopstveni zvanični identitet (razređivač i aditiv za trostepene
nijanse), pa napuštaju porodicu 45 i postaju samostalne kartice — pod svojim POSTOJEĆIM
slugom, koji od sada renderuje njihov PDP umesto preusmerenja.

### Učvršćivač / razređivač / aditiv

Samostalni zapisi, nikad varijanta laka. Odnosi se čitaju iz DVA zvanična traga:
tabele udela u listu premaza („50 % by volume 50-20, -30") i rečenice u listu komponente
(„This product is used in baslac 2K Primerfiller … and Clears 40-10, -40."). Čuvaju se u
oba smera (`relations`, `usedBy`).

### Nesigurne šifre

`11-40` ima uredan tehnički list, ali ga aktuelni sajt ne potvrđuje:
`UNCERTAIN_NOT_CUSTOMER_FACING`, izvan kataloga i izvan pokrivenosti.

### Slike

Samo `baslac.com`, preuzete i objavljene lokalno u `public/products/baslac/catalog/` — bez
hotlinka. Slika se vezuje za šifru samo uz dokaz: šifra je u imenu zvaničnog fajla, ili
kartica ima tačno jednu šifru. **Pozadina se ne uklanja** (bela ambalaža sa belom etiketom).
20 aktuelnih proizvoda ima zvaničnu sliku; ostalih 32 koriste placeholder sajta.

### Taksonomija

Mapira se ULOGA, ne brend (`data/baslac-sync/taxonomy-map.json`). Kada odnos iz lista ne
postoji, fazu nosi zvanični naziv komponente (Bodyfiller → kitovi, Primerfiller/Washprimer/
EP/UC → podloga), pa tek onda podrazumevana faza uloge.

### SR sadržaj

`LOCALIZATION_GUIDE.md` + `check-localization.mjs`: svaki broj u tekstu mora postojati u
zvaničnom ulazu, `productType` mora nositi tačan termin uloge, a broj artikla je zabranjen.
Unos nosi `sourceHash`; kada se izvor promeni, tekst je zastareo i proizvod čeka
(`HELD_MISSING_LOCALIZATION`).

### TDS / SDS, cene

TDS se vodi kao lokalna kopija zvaničnog dokumenta kada je imamo, inače kao referenca na
`techinfo.baslac.com`. SDS je „na upit". Cene, zalihe i pakovanja se ne uvoze.

## Coverage gate

`npm run baslac:sync:reconcile` — A (zvanični zapisi) = B (zastupljeni lokalno),
C (zvanične oznake) = D (zastupljene lokalno), uz `ACTIVE_PRODUCT_MISSING = 0`,
`ACTIVE_CODE_MISSING = 0`, `DUPLICATE_ACTIVE_CODE = 0`, bez siročadi i polomljenih slika.

Ista šifra sme da stoji na više zapisa samo kada su to pakovanja ISTE porodice
(`20-24` kao 1 L i 4 L — jedna kartica). Broj vidljivih kartica se **meri** iz runtime
modela (porodice + samostalni zapisi), nikada se ne upisuje unapred.

## Novo izdanje / promene na izvoru

1. `npm run baslac:sync:acquire` (osvežava keš), pa `npm run baslac:sync:plan`.
2. Pregledati `reports/SYNC_DRY_RUN.md`: novi zapisi, nove oznake, zastareli SR tekstovi.
3. Dopuniti `localization/*.json` (ulaz je u `.cache/baslac-sync/localization-input/`).
4. `npm run baslac:sync:apply`, `npm run images:metrics`, pa `npm run baslac:sync`.
5. Slug je trajan: čita se iz registra po `sourceKey`, pa preimenovanje na izvoru ne menja URL.

## Follow-up (traži odobrenje: PDP je `DESIGN + UX LOCKED`)

Dve stavke su izmerene u QA i namerno NISU dirane u ovom commitu, jer bi menjale zaključan
PDP/template. Podaci za obe već postoje u datasetu:

1. **Sistem kartice ne prikazuju zvanični tehnički list.** `components/baslac-brand/BaslacSystemPdp.tsx`
   renderuje svoj prikaz bez dokumentacione sekcije, pa `30_Line.pdf`, `30_Line_CV.pdf`,
   `35_Line.pdf` i `45_Line.pdf` — koje zapis sistema nosi u `documents` — kupac ne vidi.
2. **12 dopunjenih zapisa ne prikazuje „Bezbednosni list — na upit".** `getDocuments` u
   `components/product/ProductDetailPage.tsx` za zapise BEZ `detail` bloka izostavlja dokumente
   sa `status: "placeholder"`, pa se na njima vidi samo tehnički list. Uvezeni zapisi (44) imaju
   `detail` blok i prikazuju oba reda.

Obe tražе izmenu zaključane površine i idu kroz zaseban, odobren zahvat sa novim lock dokazom.
