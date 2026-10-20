# Carsystem lifestyle odeća — uklonjena iz javnog kataloga (2026-10-20)

Odluka vlasnika: firma ne drži Carsystem clothing/lifestyle program. Uklonjeni
su artikli iz Carsystem kategorije „Merchandising Materials“ koji su odeća za
svakodnevno nošenje, a ne radna ili zaštitna oprema. Proveren je svaki artikal
po nameni iz zvaničnog opisa.

Upis: `data/catalog/removed-from-customer-catalog.json` (status
`BUSINESS_OUT_OF_PROGRAMME`, razlog i dokaz po artiklu). Artikal nestaje iz
javnog kataloga, pretrage, preporuka, povezanih proizvoda i brend prikaza.
Sync podaci, interne šifre i istorija dokumenata (fakture, porudžbine) se ne
menjaju. Stari URL vodi trajnim preusmerenjem (308) na Carsystem brend stranu
(`next.config.ts` gradi preusmerenja iz istog registra).

## Uklonjeno (11)

| Šifra (Carsystem) | Naziv | Slug | Postupak sa URL-om |
|---|---|---|---|
| 158.927 | Carsystem Cap Black | `carsystem-cap-black` | `/proizvodi/carsystem-cap-black` → 308 na `/brendovi/carsystem` |
| 160.493 | Carsystem Cap camouflage | `carsystem-cap-camouflage` | `/proizvodi/carsystem-cap-camouflage` → 308 na `/brendovi/carsystem` |
| 160.037 | Carsystem Padded Jacket Black 2025 | `carsystem-padded-jacket-black-2025` | `/proizvodi/carsystem-padded-jacket-black-2025` → 308 na `/brendovi/carsystem` |
| 159.288 | Carsystem Padded Vest Black | `carsystem-padded-vest-black` | `/proizvodi/carsystem-padded-vest-black` → 308 na `/brendovi/carsystem` |
| 160.027 | Carsystem Padded Vest Black 2025 | `carsystem-padded-vest-black-2025` | `/proizvodi/carsystem-padded-vest-black-2025` → 308 na `/brendovi/carsystem` |
| 160.540 | Carsystem Socks CARSYSTEM black & white | `carsystem-socks-carsystem-black-white` | `/proizvodi/carsystem-socks-carsystem-black-white` → 308 na `/brendovi/carsystem` |
| 159.837 | Carsystem Socks CARSYSTEM red & white | `carsystem-socks-carsystem-red-white` | `/proizvodi/carsystem-socks-carsystem-red-white` → 308 na `/brendovi/carsystem` |
| 160.325 | Carsystem Sweatshirt Black #teamCARSYSTEM | `carsystem-sweatshirt-black-teamcarsystem` | `/proizvodi/carsystem-sweatshirt-black-teamcarsystem` → 308 na `/brendovi/carsystem` |
| 159.864 | Carsystem Sweatshirt Grey #TeamCARSYSTEM | `carsystem-sweatshirt-grey-teamcarsystem` | `/proizvodi/carsystem-sweatshirt-grey-teamcarsystem` → 308 na `/brendovi/carsystem` |
| 159.827 | Carsystem T-Shirt Black #teamCARSYSTEM | `carsystem-t-shirt-black-teamcarsystem` | `/proizvodi/carsystem-t-shirt-black-teamcarsystem` → 308 na `/brendovi/carsystem` |
| 158.084 | Carsystem Zip-Hoodie black | `carsystem-zip-hoodie-black` | `/proizvodi/carsystem-zip-hoodie-black` → 308 na `/brendovi/carsystem` |

## Zadržano (radna i zaštitna oprema)

Ovi artikli su upisani u `keptExplicitly.protectiveClothing`, pa test pada ako
neki nestane iz kataloga:

- Carsystem 30 Years Ltd. Coverall Jacket, Classic Coverall Jacket Anthracite,
  Classic Coverall Pants, Coverall 2.0, Coverall Black Suit, Explorer Ltd.
  2-Piece Coverall, Paint Overall Blue, Carsystem zaštitno odelo;
- Carsystem Bodyshirt Black (funkcionalna majica bez silikona, nosi se ispod
  lakirerskog odela);
- SATA odela (već na spisku).

Rukavice ostaju (zaštitna oprema).

## Promotivni artikli koji nisu odeća — nepromenjeni, čekaju odluku

Ostalih 8 artikala iz Carsystem „Merchandising Materials“ nije odeća i nije
menjano. Ostaju u javnom katalogu do odluke vlasnika.

| Šifra (Carsystem) | Naziv | Kategorija kod nas | Namena (zvaničan opis) |
|---|---|---|---|
| 158.829 | Carsystem car sticker plain (4 formata) | Radionica | logo nalepnica za unutra i spolja |
| 157.219 | Carsystem Coffee Cup Black (300 ml) | Radionica | šolja za tople napitke |
| 156.281 | Carsystem Cutter Knife black (140 mm) | Pribor | nož za precizno sečenje |
| 158.622 | Carsystem Doormat logo black (50 × 75 i 90 × 60 cm) | Radionica | otirač sa logom |
| 137.325 | Carsystem Hoist flag (120 × 300 cm) | Radionica | zastava za jarbol |
| 148.281 | Carsystem Lighter black | Radionica | upaljač |
| 156.540 | Carsystem Pen Trinity Gum black | Radionica | hemijska olovka |
| 158.871 | Carsystem USB-Stick (64 GB) | Radionica | USB memorija |

Napomena: nož (Cutter Knife) je alat, pa verovatno ostaje i ako se ostali
promotivni artikli uklone.
