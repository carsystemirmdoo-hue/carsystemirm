# Catalog Taxonomy — 12 platform kategorija

Izvor istine: `lib/productTaxonomy.mjs` (pravila) i `lib/product-taxonomy.ts`
(tipizovani omotač). Nema druge mapping tabele — Header, Homepage, Catalog URL
parser, filtriranje, testovi i validator izvršavaju istu implementaciju.

Regeneracija tabele:

```bash
npm run taxonomy:validate
```

## Zatečeno stanje

Svih 12 `?kategorija=` linkova u `PRODUCT_CATEGORIES`
(`components/layout/navigation-data.ts`) otvaralo je **nefiltriran** katalog:
`parseCatalogUrlFilters` nikada nije čitao taj parametar. Problem nije bio
divergentan mapping nego nepostojanje mappinga — lista kategorija je postojala
samo kao navigacioni tekst i ikonice.

Ono što je postojalo ranije, a **nije** izvor istine za ovih 12:

- legacy demo sloj (`data/categories.ts`, `lib/products.ts`) — uklonjen u
  cleanup-u 2026-09; nikada nije bio izvor istine za ovih 12;
- `lib/seo/category-landings.ts` — druga osa: 4 SEO landinga samo za R-M, po
  `rmMetadata.category`;
- `docs/CARSYSTEM_CATEGORY_MAPPING_PROPOSAL.md` — sekcijski predlog samo za
  Carsystem katalog, sa 4 od 10 redova označenih REVIEW/AMBIGUOUS.

## Dokazna lestvica

Klasifikacija koristi isključivo potvrđena polja proizvoda. Prvo pravilo koje se
primeni pobeđuje:

1. **`rmMetadata.category`** — proizvođačeva sopstvena kategorija (64 proizvoda);
2. **`catalogMetadata.technicalCategory`** + faza — ekstrakcija iz zvaničnog
   Cosmos Lac kataloga (742 proizvoda);
3. **badge vokabular**, pa **`programSlug`** — preostala 26 ručno pisana zapisa.

Poklapanje po nazivu se **ne koristi**. Pogrešna kategorija je lažna tvrdnja o
tome šta proizvod jeste, a u populaciji od 832 zapisa naziv bi mnoge promašio.

Proizvod za koji se nijedno pravilo ne primeni ostaje **neklasifikovan** i ne
ulazi ni u jednu kategoriju — namerno, umesto da padne u default kantu koja bi
onda lagala o svom sadržaju. Trenutno takvih nema (0 od 832).

### Aerosoli: funkcija pre formata

Platforma ima i „Boje" i „Sprejevi", pa je format značajan — ali samo tamo gde
format **jeste** identitet proizvoda. Sprej boje idu u Sprejeve; aerosolni
čistač je i dalje sredstvo za čišćenje i ide u Čišćenje. Pravilo je zato:
funkcija prvo, a Sprejevi preuzimaju aerosole čija je funkcija boja
(`phaseSlug === "boja"`).

Posledica na brojevima: od 691 Cosmos aerosola, 654 su boje → Sprejevi, a 37
zadržava funkcionalnu kategoriju (podloge → Boje, antichip → Zaštita, čistači →
Čišćenje, lepak → Lepkovi, održavanje → Radionica).

## Tabela svih 12 kategorija

| Slug | Naziv | Rezultata | Reprezentativni proizvodi | Izvor dokaza (top pravila) |
| --- | --- | --- | --- | --- |
| `boje` | Boje | 104 | `2210-onyx-activator`, `2220-agilis-activator`, `2520-onyx-easy-blender` | rmMetadata.category=clearcoat ×21; primer-filler ×17; technicalCategory=varnish ×13; primer ×10; additive ×7; filler-primer ×7 |
| `abrazivi` | Abrazivi | 4 | `carsystem-p19-brusni-diskovi`, `carsystem-f19-brusni-diskovi`, `carsystem-f23-brusni-diskovi` | programSlug=abrazivi ×4 |
| `kitovi` | Kitovi | 8 | `b-2p93-uv-bodyfill-r`, `carsystem-soft-plus-git`, `rm-body-filler-white-b-2e11` | badge „Git"/„Body filler" ×3; technicalCategory=putty ×3; rmMetadata.category=bodyfiller ×2 |
| `maskiranje` | Maskiranje | 2 | `carfit-maskirna-folija-4x5m`, `carfit-maskirna-folija-4x150m` | badge „Maskiranje" ×2 |
| `sprejevi` | Sprejevi | 654 | `cosmos-lac-automotive-030-400-ml-prefilled-030-1k`, `…-510-vinyl-fabric`, `…-560-bumper-paint` | technicalCategory=art-and-graffiti ×329; bicycle-paint ×88; acrylic-spray ×82; ral-spray ×65; chalk-effect ×34; marking ×9 |
| `oprema` | Oprema | 1 | `satajet-x-5500` | programSlug=oprema ×1 |
| `pribor` | Pribor | **0** | — | — |
| `lepkovi` | Lepkovi | 1 | `cosmos-lac-home-741-providna-400-ml-power-glue-741-transparent` | technicalCategory=adhesive ×1 |
| `ciscenje` | Čišćenje | 7 | `cosmos-lac-cleaners-205-…-contact-cleaner-205`, `…-718-sticker-glue-remover`, `…-732-air-duster` | technicalCategory=cleaner ×7 |
| `zastita` | Zaštita | 25 | `carsystem-zastitno-odelo`, `cosmos-lac-automotive-250-…-antichip-250-white`, `…-251-antichip-251-black` | technicalCategory=wood-care ×18; antichip ×6; badge „Zaštita" ×1 |
| `poliranje` | Poliranje | 12 | `rm-pasta-190-1l`, `rm-pasta-190-5l`, `carsystem-finish-serija` | programSlug=poliranje ×8 (Befar sunđeri); rmMetadata.category=polishing-compound ×2; badge ×2 |
| `radionica` | Radionica | 14 | `cosmos-lac-automotive-719-…-quick-start`, `cosmos-lac-lubricants-200-…-multimax-1000`, `…-203-silicone-oil` | technicalCategory=lubricant ×12; automotive-maintenance ×2 |

Zbir: **832 / 832 klasifikovano, 0 neklasifikovanih.**

## Prazna kategorija — Pribor

`Pribor` nema nijedan proizvod. To nije greška klasifikatora nego stanje
kataloga: nijedan od 832 zapisa nije prateći pribor. Predlog mappinga je isti
problem već označio kao AMBIGUOUS — sekcija `LACKIERBEDARF` Carsystem kataloga
(iz koje bi Pribor došao) nije bila otvorena stranicu po stranicu.

Link se ne skriva, ali ni ne laže: `/katalog?kategorija=pribor` prikazuje
eksplicitnu poruku „Nijedan proizvod iz trenutnog kataloga nije klasifikovan u
kategoriju „Pribor"." umesto generičkog „promenite filtere".

## Otvorene ljudske odluke

1. **Učvršćivači, razređivači i aditivi u „Boje"** (18 proizvoda). Platforma
   nema kategoriju „Aditivi", pa su svrstani uz sistem boje — isto kako
   `lib/seo/category-landings.ts` već predstavlja „Učvršćivači i razređivači".
   Alternativa je 13. kategorija, što je product odluka, ne tehnička.
2. **Prajmeri i punioci u „Boje"** (34 proizvoda: 17 R-M `primer-filler` + 17
   Cosmos podloga). Predlog mappinga je ovo označio kao REVIEW jer platforma ne
   razdvaja „boju" od „laka/podloge".
3. **Aerosolna granica.** 654 sprej boja je ubedljivo najveća kategorija i
   praktično ceo Cosmos program. Ako vlasnik želi da Cosmos boje budu pretražive
   i pod „Boje", potrebna je višekategorijska pripadnost — trenutni model je
   jedna kategorija po proizvodu.
4. **`wood-care` u „Zaštita"** (18 proizvoda). Cosmos „W Wood Care" je zaštita
   drveta; alternativno čitanje je „Boje" (premaz). Odabrana je zaštita jer je
   funkcija konzervacija, ne nijansa.
5. **Pribor** — treba proći `LACKIERBEDARF` sekciju i odlučiti koji artikli su
   Pribor, a koji Oprema ili Radionica.

## Ponašanje URL parametra

| Slučaj | Ponašanje |
| --- | --- |
| `?kategorija=<validan>` | Filtrira, chip „Kategorija: X" vidljiv, radi posle direktnog reload-a |
| `?kategorija=<nepoznat>` | Parametar se odbacuje, katalog nefiltriran, **bez** lažnog aktivnog filtera i bez pada |
| Kombinacija sa `brend`, `q`, `program`, `faza`, `sistem`, `serija`, `rm-kategorija`, `dostupnost`, `sortiranje` | Podržana; kategorija je nezavisna osa |
| Uklanjanje chipa | Briše `kategorija` iz URL-a, ostali parametri ostaju |
| Back restoration | `kategorija` je deo `paginationKey`, pa se broj učitanih kartica i scroll pozicija vezuju za konkretnu kategoriju |
