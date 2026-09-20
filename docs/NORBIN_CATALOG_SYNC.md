# Norbin catalog sync

Ponovljiv, idempotentan uvoz aktuelnog EMEA Norbin asortimana. Isti standard kao
[Carsystem](CARSYSTEM_CATALOG_SYNC.md), [C.A.R.FIT](CARFIT_CATALOG_SYNC.md),
[Befar](BEFAR_CATALOG_SYNC.md), [R-M](RM_CATALOG_SYNC.md) i [baslac](BASLAC_CATALOG_SYNC.md);
kod je zaseban (`scripts/norbin-sync/`) i koristi samo generičke pomoćnike.

```bash
npm run norbin:sync            # acquire → plan → apply → validate → reconcile
npm run norbin:sync:acquire    # stranice opsega + dokaz o aktivnosti + model + plan (mreža)
npm run norbin:sync:plan       # dry run: reports/SYNC_DRY_RUN.md, sync-plan.generated.json
npm run norbin:sync:apply      # jedini korak koji menja katalog
npm run norbin:sync:check      # šta bi apply promenio (idempotentnost = prazna lista)
npm run norbin:sync:validate   # sadržaj, dokumenti, odnosi, runtime
npm run norbin:sync:reconcile  # COVERAGE GATE (A/B/C/D) + mereni broj kartica
npm run norbin:sync:inventory  # inventar svega što u repozitorijumu postoji za Norbin
npm run test:norbin-sync
```

Pretraga se proverava nad pokrenutim buildom:
`node scripts/norbin-sync/qa-search.mjs --base-url=http://localhost:3220`.

## Izvori i autoritet

| Izvor | Uloga |
| --- | --- |
| `norbin-paint.com/{en,tr,kz}/norbin-range.html` | jedini izvor identiteta: šifra, zvanični naziv, pakovanja, dokumenti |
| `norbin-paint.com/files/{TDS,MSDS}/*.pdf` | tehnički i bezbednosni listovi (reference, ne kopije) |
| `data/knowledge/norbin-tds-claims.generated.json` | commitovano izvlačenje činjenica iz listova (SHA256 + strana) |
| `data/knowledge/norbin-stock-evidence.generated.json` | dokaz o aktivnosti našeg artikla — SAMO lokalna dostupnost |

Nije izvor: distributeri, marketplace, Google Images, katalozi trećih strana.

**Branding.** Izvor i danas objavljuje „© BASF Coatings GmbH" i „NORBIN® is a registered
Trademark of BASF Coatings GmbH", iako je BASF Coatings 1. jula 2026. izdvojen u Surventis.
Status izvora je `CURRENT_BUT_LEGACY_BRANDING`: brend se NE preimenuje, „by Surventis" se ne
dodaje i Surventis logo se ne izmišlja.

## Dve ose koje se ne mešaju

| Osa | Odakle | Šta sme da tvrdi |
| --- | --- | --- |
| `CURRENT_MANUFACTURER_RANGE` | isključivo zvanični izvor | da je proizvod u aktuelnoj EMEA ponudi |
| `LOCAL_AVAILABILITY` | dokaz o aktivnosti artikla | `SELLABLE_CURRENT`, `SELLABLE_CURRENT_ZERO_STOCK`, `NOT_IN_OUR_PROGRAMME` |

Javni status je **uvek „Na upit"** — ni za jedan zapis se ne tvrdi da je na stanju. Proizvod
bez ERP potvrde i dalje je aktuelan proizvod proizvođača.

## Pravila modela

### Aktuelnost i regioni

CURRENT je šifra koju **aktuelna stranica opsega linkuje**. Zakomentarisan link je
proizvođačeva odluka da proizvod ne objavi (`unlinked-in-source`) i nikad nije ponuda.
Referentni region je `en` (EMEA): 13 proizvoda. Pet šifara živi samo u turskom programu i
ostaje `CURRENT_OTHER_REGION` — bez kartice i van pokrivenosti. Tri regiona (`me`, `de`, `pl`)
su neobjavljeni čuvari mesta, pa regionalnog izvora za naše tržište nema.

### Identitet, pakovanje, brojevi artikala

Zvanična šifra (`N15-020`) je identitet; pakovanje je varijanta. **Brojeva artikala nema
nigde na zvaničnom izvoru** — ne izmišljaju se, a naši interni brojevi (6 cifara) ostaju
poslovni podatak i ne izlaze u javni zapis. `N60-V20` je jedan proizvod-komplet: ista šifra
pokriva kit i njegov učvršćivač, pa učvršćivač nema zasebnu karticu.

### Porodica pakovanja

Dva postojeća zapisa (`N15-020` u 1 L i 5 L) zadržavaju svoje adrese i postaju varijante
`variant-pdp` porodice `norbin-n15-020`. Stari URL-ovi preusmeravaju na porodicu sa izabranim
pakovanjem; javni identitet porodice nosi zapis sa fotografijom.

### Komponente i odnosi

Učvršćivači, razređivač i sredstvo za čišćenje imaju svoj zvanični identitet i ostaju
SAMOSTALNI proizvodi, nikad varijante. Odnosi (`USES_HARDENER`, `USES_REDUCER`,
`COMPATIBLE_WITH` i obrnuto `USED_BY`) čitaju se iz odnosa mešanja u tehničkim listovima, sa
razmerom.

`N85-025` tehnički list imenuje kao razređivač, ali izvor za njega nema ni stranicu ni
dokument ni u jednom regionu: `OFFICIAL_REFERENCED_COMPONENT_NOT_CUSTOMER_FACING`. Bez
kartice, bez pojma pretrage, van pokrivenosti; ostaje u modelu kao nerazrešena referenca
bez sluga, pa ne može da napravi lažni PDP.

### Slike

**Izvor ne objavljuje nijednu fotografiju proizvoda: 0/13.** Jedini lokalni packshot
(`N15-020`, 1 L) je kupčev fajl i tako se i vodi — nije dokaz zvaničnog packshota ni broja
artikla. Ostalih 12 kartica koristi placeholder sajta. Slike trećih strana se ne koriste.

### Dokumenti

TDS i SDS se u ovom ciklusu **ne hostuju lokalno** — koriste se reference na
`norbin-paint.com`, sa URL-om prenetim DOSLOVNO, uključujući upitni token
(`N55-V20_2K_Primer_Filler_grey.pdf?asdb213ffe`). SDS je javan po pakovanju, pa se prikazuje
kao dokument, ne kao „Na upit". Pet proizvoda nema objavljen tehnički list i to se kaže
otvoreno. Četiri turska lista vraćaju 404 na samom izvoru — beleži se kao
`OFFICIAL_SOURCE_BROKEN`, bez izmišljanja zamenskog URL-a.

### SR sadržaj

`LOCALIZATION_GUIDE.md` + `check-localization.mjs`: svaki broj u tekstu mora postojati u
zvaničnom ulazu, uloga se ne sme pomešati, dostupnost se ne tvrdi, a interni broj artikla je
zabranjen. Proizvod bez ijedne zvanične tvrdnje ne sme dobiti tehničke činjenice.

## Coverage gate

`npm run norbin:sync:reconcile` — A (aktuelni zvanični EMEA proizvodi) = B (zastupljeni
lokalno), C (zvanične oznake) = D, uz `ACTIVE_PRODUCT_MISSING = 0`, `ACTIVE_CODE_MISSING = 0`,
`DUPLICATE_ACTIVE_CODE = 0`. Norbin nema sloj brojeva artikala, pa je **A ≡ C po
konstrukciji** — to izveštaj izričito navodi. Broj vidljivih kartica se MERI iz runtime
modela.

## Determinizam

`norbin:sync:check` ne dodiruje mrežu, keš, druge worktree-e ni `assets/manufacturer/`
(gitignore-ovan folder sa 99 pripremljenih PDF-ova). Ulazi su commitovani:
`data/norbin-sync/raw/website.generated.json`, `norbin-tds-claims.generated.json` i
`norbin-stock-evidence.generated.json` (koji se sam generiše iz commitovane tabele u
`docs/NORBIN_PRODUCT_INVENTORY.md` §11 — izvorni izveštaj sa cenama i količinama ostaje van
repozitorijuma).

## Follow-up (zaseban naredni zahvat, nije u ovom commitu)

`components/norbin-brand/norbinBrandData.ts` u `norbinRatios` još nosi hardkodirane `stocked`
zastavice (`N75-020`, `N75-021`) i napomenu „mi vodimo učvršćivač N75-020, ne i sam filler".
Od ovog synca dostupnost ima jedan izvor — `data/knowledge/norbin-stock-evidence.generated.json` —
pa te zastavice treba da se izvode iz njega, a ne da stoje u komponenti. Brend stranica je
zasebna vizuelna površina, zato se ne dira zajedno sa uvozom asortimana.
