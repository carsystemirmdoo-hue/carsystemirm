# baslac sive nijanse: 20-24 / 20-34 / 20-94

Istraživanje, samo čitanje, 2026-10-19. Worktree (lokalna radna kopija) (97d753b2). Mašinski čitljiva verzija: `baslac-sive-nijanse.json`.

## Zaključak

**Poster daje tačnu tabelu mešanja. Ništa nije potrebno izmišljati.** Tabela ima pet nivoa i koristi samo 100 % ili 50/50 zapreminski. Poster nema SG01–SG07, nema mešavinu bela + crna, nema trokomponentne odnose i nema hex vrednosti.

## Izvori

| Dokument | Zvanični URL | Lokalno | Rev. |
|---|---|---|---|
| Poster „Technical Information 20-24, -34, -94, 2K Primerfiller“ (grey shade poster), 1 str. | https://techinfo.baslac.com/en/Grey-Shades_20-24_-34_-94.pdf | `/documents/products/baslac/Grey-Shades_20-24_-34_-94.pdf` = `/documents/baslac/guides/baslac-grey-shades-20-24-34-94.pdf` (isti md5) | Last-Modified 12.05.2025 |
| TDS 20-24 2K Primerfiller, grey | https://techinfo.baslac.com/en/20-24.pdf | `/documents/products/baslac/20-24.pdf` | 09/2025 |
| TDS 20-34 2K Primerfiller White | https://techinfo.baslac.com/en/20-34.pdf | `/documents/products/baslac/20-34.pdf` | 09/2025 |
| TDS 20-94 2K Primerfiller Black | https://techinfo.baslac.com/en/20-94.pdf | `/documents/products/baslac/20-94.pdf` | 06/2023 |
| TDS varijante (50-05, 80-10, high build) za sve tri šifre | techinfo.baslac.com | `/documents/products/baslac/20-xx_variant_*.pdf` | 03/2024 i 06/2023 |

Lokalne kopije imaju isti broj bajtova kao žive datoteke (HEAD provera 19.10.2026), pa su aktuelne. Poster je u `data/knowledge/baslac-documents.generated.json` zaveden kao „20-24, -34, -94 2K Primer Filler Grey Shade Poster“, `kind: colour-chart`, sha256 516dfb08…

## 1. Proizvodi

| Šifra | Zvanični naziv (TDS str. 1) | Pakovanja u katalogu | Porodični PDP |
|---|---|---|---|
| 20-24 | 2K Primerfiller, grey | 1 L, 4 L | `/proizvodi/grupa/20-24-2k-primerfiller-grey` |
| 20-34 | 2K Primerfiller White | 1 L, 4 L | `/proizvodi/grupa/20-34-2k-primerfiller-white` |
| 20-94 | 2K Primerfiller Black | 1 L, 4 L | `/proizvodi/grupa/20-94-2k-primerfiller-black` |

- **Namena** (TDS i poster): „High solids containing primer filler, fast drying and easy sandability“. Kod popravki sa većim golim limom prethodno se nanosi 27-10 2K Wash primer.
- **Pakovanja** nisu navedena u TDS-u. Izvor je `lib/baslac-catalog-products.ts`, `PRIMER_VARIANTS`, redovi 278–285.

## 2. Mešanje nijansi (potvrđeno)

Izvor je poster, str. 1, sekcija „1. Mixing of filler for correct undercoat solution“. Jedinica je „Mixing ratio % by vol.“

| Nijansa podloge | 20-34 bela | 20-24 siva | 20-94 crna |
|---|---|---|---|
| White (bela) | 100 % | — | — |
| Light grey (svetlosiva) | 50 % | 50 % | — |
| Grey (siva) | — | 100 % | — |
| Dark grey (tamnosiva) | — | 50 % | 50 % |
| Black (crna) | — | — | 100 % |

Svaki od tri TDS-a to potvrđuje na str. 1: „Can be mixed with … to get different grey shades, according to the grey shade poster.“

**Princip za vizuelni prikaz:** pet koraka od bele do crne. Tri čiste baze stoje na krajevima i u sredini, a između njih su dve mešavine 50/50 susednih baza. Uz svaki korak poster prikazuje lepezu uzoraka završnih boja: svetle i pastelne uz belu, srednje zasićene uz sivu, tamne uz crnu. Lepeze su ilustracija, ne spisak nijansi, pa se ne preuzimaju kao podatak.

## 3. Mešanje sa učvršćivačem i razređivačem (druga stvar)

### TDS, standardna primena (sve tri šifre)

- Odnos **4:1:1**: 100 % primerfiller + 25 % učvršćivača **50-15 ili 50-20** + 25 % razređivača **60-10, 60-20, 60-30 ili 60-40**.
- Izuzetak: TDS 20-94 (06/2023) ne navodi 60-40, a 20-24 i 20-34 (09/2025) ga navode.
- Potlife na 20 °C je 1 h. Viskozitet DIN 4: 20-24 s. Mlaznica 1,6–1,8 mm. Pritisak: HVLP 2 bar ulaz i 0,7 bar na mlaznici, compliant 2 bar.
- Nanosi se u 2 sloja, debljina filma 50–70 μm.
- Sušenje: 3 h na 20 °C, 30 min na 60 °C, IR kratki talas 8 min, IR srednji talas 10–15 min.
- Brušenje: mokro ručno P800, orbitalno suvo P400/P500.
- VOC 530 g/l, EU limit 540 g/l, IIB.cII.

### TDS varijante

- **Varijanta 50-05** (03/2024): 4:1:1 sa **50-05** i **60-05**. Potlife 30 min, sušenje 1 h na 20 °C, IR kratki talas 4 min.
- **Varijanta 80-10** (06/2023): PreMix od 100 % primerfillera + 25 % **80-10**, zatim 4:1:1 sa 50-15/-20 i 60-10/-20/-30/-40.
- **High build** (06/2023): isti 4:1:1. Nanosi se u 3–4 sloja, 100–200 μm, suši se 16 h na 20 °C ili 40 min na 60 °C.

### Poster, sekcija „2. Temperature Chart for baslac primer filler“ (odnos 4 : 1 : 1)

Kolone nemaju tekstualno zaglavlje. Ispod tabele je skala sa oznakama 15, 20, 25 i 30 °C, vizuelno poravnatim sa četiri kolone.

| Primena | Komponenta | ~15 °C | ~20 °C | ~25 °C | ~30 °C |
|---|---|---|---|---|---|
| More than one panel | Hardener | 50-15 | 50-15 | 50-15 | 50-15 |
| | Reducer | 60-10 | 60-20 | 60-20 | 60-20 |
| Up to one panel | Hardener | 50-05 | 50-15 | 50-15 | 50-15 |
| | Reducer | 60-05/10 | 60-10 | 60-10 | 60-20 |
| Spot repair | Hardener | 50-05 (sve) | | | |
| | Reducer | 60-05/10 (sve) | | | |

## 4. Katalog

- Zapisi ne postoje u `products` delu `data/baslac-catalog-products.generated.json`. Tamo su samo u `enrichments` (slugovi `baslac-20-24-2k-primerfiller-grey-1l`, `-20-34-…-white-1l`, `-20-94-…-black-1l`) i kao `usedBy` kod učvršćivača i razređivača.
- Proizvode gradi `lib/baslac-catalog-products.ts` (`PRIMER_VARIANTS` → `toPrimerProduct`, slug `${family}-${volumeKey}`).
- Href daje `productCanonicalHref()` iz `lib/product-families.ts:355`. Sve tri porodice su `variant-pdp`, pa je link `/proizvodi/grupa/<porodica>?varijanta=<SKU>`. Vrednosti sam izračunao pozivom same funkcije kroz tsx.

| Slug | SKU | Href | Slika | Pouzdanost |
|---|---|---|---|---|
| baslac-20-24-2k-primerfiller-grey-1l | 20-24-1L | /proizvodi/grupa/20-24-2k-primerfiller-grey?varijanta=20-24-1L | /products/baslac/baslac--20-24-2k-primerfiller-grey-1l-packshot.webp | confirmed |
| baslac-20-24-2k-primerfiller-grey-4l | 20-24-4L | …?varijanta=20-24-4L | /products/baslac/supplied/baslac__baslac-20-24-2k-primerfiller-grey-4l.webp | unverified |
| baslac-20-34-2k-primerfiller-white-1l | 20-34-1L | /proizvodi/grupa/20-34-2k-primerfiller-white?varijanta=20-34-1L | /products/baslac/supplied/baslac__baslac-20-34-2k-primerfiller-white-1l.webp | unverified |
| baslac-20-34-2k-primerfiller-white-4l | 20-34-4L | …?varijanta=20-34-4L | /products/baslac/baslac--20-34-2k-primerfiller-white-4l-packshot.webp | confirmed |
| baslac-20-94-2k-primerfiller-black-1l | 20-94-1L | /proizvodi/grupa/20-94-2k-primerfiller-black?varijanta=20-94-1L | /products/baslac/supplied/baslac__baslac-20-94-2k-primerfiller-black-1l.webp | unverified |
| baslac-20-94-2k-primerfiller-black-4l | 20-94-4L | …?varijanta=20-94-4L | /products/baslac/baslac--20-94-2k-primerfiller-black-4l-packshot.webp | confirmed |

Svih šest slika postoji u `public/`, kao i naslovna slika postera `/brands/baslac/documents/baslac-grey-shades-20-24-34-94-cover.webp`.

Učvršćivači i razređivači sa postera i iz TDS-a su svi u katalogu. Linkovi su u JSON-u, `hardenerMix.catalogLinks`. Ostaje jedna sitnica: 50-05 je bez slike (placeholder).

## Napomene za blok „Sive nijanse“

- Link u `BaslacGreyShade.tsx` (`/documents/baslac/guides/baslac-grey-shades-20-24-34-94.pdf`) vodi na isti fajl kao zvanični poster.
- Tekst „tačan odnos mešanja potvrđuje se prema tehničkom listu“ može da se zameni stvarnom tabelom iz postera, sa pet nivoa i odnosima 100 % ili 50/50.
- Boje swatcheva u komponenti (#8a8f8e itd.) su procena. Izvor ne daje kolorimetrijske vrednosti.
