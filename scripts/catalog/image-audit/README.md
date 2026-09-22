# Generator manifesta dostave slika

Jedna komanda pravi sve praćene manifeste iz **stvarnog runtime kataloga**:

```bash
npm run catalog:image-supply:generate   # napravi
npm run catalog:image-supply:check      # proveri zatečeno stanje (ništa ne piše)
```

`check` pada ako se praćeni manifesti raziđu sa runtime-om ili sa `manifest-lock.json` — koristi se
kao kapija, pa `generate` ne mora da se pokreće pri svakoj izmeni.

## Zašto je ovo praćeni kod

Manifesti su praćeni fajlovi po kojima vlasnik priprema fotografije. Dok je lanac živeo u
gitignored `.cache/`, odobreno stanje se nije moglo reprodukovati na drugoj mašini ni proveriti u
pregledu izmena. Sada je put do njih deo repozitorijuma.

## Koraci

| Korak | Šta radi |
|---|---|
| `inventory.mjs` | identiteti slika iz runtime-a (`loadCatalogRuntime()`), klasifikacija, missing / supply / rights |
| `reconcile-quality.py` | quality queue usklađen sa merenjima istorijskog Carsystem audita |
| `sync-quality-notes.py` | opisni `quality:` segment beleški u inventaru i rights listi |
| `build-supply-pack.py` | owner supply pack (`USER_IMAGE_SUPPLY_QUEUE`) i vodič za vlasnika |
| `build-owner-batch.py` | Owner Batch 01 kandidati |
| `promote.py` | upis u praćene canonical fajlove (jedini korak koji dodaje tekst: zaglavlje izveštaja i statusni blok handoffa) |
| `image-supply-manifests.mjs --write-lock` | `manifest-lock.json`: SHA manifesta + otisak identiteta kataloga |

`generate.mjs` ih pokreće tim redom. **Redosled je obavezan:** `inventory.mjs` piše queue po grubom
pravilu, koji `reconcile-quality.py` zatim zamenjuje usklađenim nalazima. Pokretanje samo
`inventory.mjs` ostavlja queue u zastarelom modelu.

## Ulazi

- runtime katalog (`lib/*`, `data/*-catalog-products.generated.json`, sync manifesti porekla)
- `data/catalog/removed-from-customer-catalog.json` (kroz runtime)
- `data/catalog/image-supply/shared-image-groups.json`
- `data/catalog/image-quality/evidence/` — merenja istorijskog Carsystem quality audita

## Izlazi

`data/catalog/image-supply/{MISSING_PRODUCT_IMAGES,USER_IMAGE_SUPPLY_QUEUE,IMAGE_RIGHTS_REVIEW,OWNER_SUPPLY_BATCH_01_CANDIDATES}.csv`,
`data/catalog/image-supply/manifest-lock.json`,
`data/catalog/image-quality/IMAGE_QUALITY_QUEUE.csv`,
`docs/catalog/{FINAL_IMAGE_AUDIT,USER_IMAGE_SUPPLY_GUIDE}.md`,
`docs/catalog/image-quality/CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md`.

Međuizlazi (pun inventar od ~1800 identiteta, sažeci) idu u `.cache/image-audit/` — runtime ih ne
čita. Drugi direktorijum se zadaje promenljivom `IMAGE_AUDIT_WORK`.

## Determinizam

Nijedan korak ne čita mrežu, ne gleda sat i ne zavisi od redosleda fajlova na disku. Drugo
pokretanje nad istim ulazima daje bajt-identične izlaze; `approvedAt` u lock-u je metapodatak koji
se čuva dok se sadržaj ne promeni.

Zahteva `python3` (bez dodatnih paketa), isto kao `scripts/extract-product-image-metrics.py`.

## `measure-edge-frames.py`

Jedini korak koji traži Pillow i **ne pokreće se** u lancu: piksel-provera poluprovidnog okvira uz
ivicu platna. Rezultat je praćen kao dokaz
(`data/catalog/image-quality/evidence/edge-frame.generated.json`); pokreće se ručno tek kad se
Carsystem asseti promene.

## Šta ovaj lanac NE radi

Ne uvozi slike, ne preuzima ništa sa interneta, ne menja `productImage` reference i ne dira katalog.
Importer slika ne postoji.
