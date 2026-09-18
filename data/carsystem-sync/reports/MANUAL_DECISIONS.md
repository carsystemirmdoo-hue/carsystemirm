# Carsystem sync — stanje posle website-parity finalizacije (2026-09-18)

Pravilo izvora: aktivna stranica proizvoda na carsystem.org → katalog 2026/27 →
naši lokalni podaci. Svaki aktivan, naručiv proizvod sa sajta je u našem
katalogu: **462 / 462 stranica, 1068 / 1068 šifara** (`npm run carsystem:sync:reconcile`).

Odluke se i dalje upisuju u `data/carsystem-sync/manual-decisions.json`, pa
`npm run carsystem:sync:apply`. Ništa odavde ne blokira paritet.

## 1. Razrešeno u ovom koraku

| Slučaj | Ishod | Dokaz |
|---|---|---|
| **Multi Green** (`carsystem-git-multi-green`) | spojen sa zvaničnim „Multi Green”; dodate 3 aktuelne šifre: 146.706 (1.6 kg limenka), 147.337 (2.52 kg kartuša), 149.134 (8.11 kg kartuša) | tačan normalizovan naziv **+** naš hostovani TDS je bajt-identičan zvaničnom `tds-multi-green-v08.pdf` (sha256 `3fbb5ce88b460fbd…`). Ručna pakovanja „1.8 kg / 2 kg” ne postoje ni u jednom zvaničnom izvoru — ostala su u zapisu, a PDP ih odvaja napomenom ispod tabele šifara. |
| **Zaštitno odelo** (`carsystem-zastitno-odelo`) | NIJE spojeno; legacy zapis ostaje, zvanični „Classic Coverall Jacket Anthracite” uvezen zasebno (`carsystem-classic-coverall-jacket-anthracite`, 159.194–159.200), veza zabeležena u `relatedLegacySlug` | sve tri naše slike jesu zvanične slike te jakne, ali ostale činjenice se ne slažu: naš zapis je generičko „odelo”, „potrošni artikal”, bez šifre i veličina; zvanični artikal je samo JAKNA (pantalone se naručuju posebno), višekratna PPE kat. I, 7 veličina. Zajedničkih šifara nema → duplikat po šifri ne postoji. |
| **Finish Back Pad M-14** | uvezen jednom, trenutna šifra **160.443**; **157.721** sačuvana kao `legacyArticleNumbers` / „Prethodna šifra artikla” na PDP-u, pretraživa, nije varijanta | 08.08.2026. sajt je nosio 157.721; PDF od 09.09.2026. nosi 157.721; sajt 18.09.2026. nosi 160.443 (i slika se zove `160443-…`) → sajt je noviji. |
| **19 merchandising artikala** | svih 19 = `ORDERABLE_PRODUCT`, svih 19 uvezeno | svaki ima zvaničnu stranicu, šifru artikla, specifikaciju i prodajno pakovanje (KP). Spisak sa dokazom: `reconciliation.generated.json → merchandising`. |
| **32 proizvoda „samo na sajtu”** | svih 32 i dalje aktivno (HTTP 200, naziv + šifra), svih 32 uvezeno | spisak: `SYNC_DRY_RUN.md`, sekcija „Uvezeno sa aktivne stranice…” |

## 2. Činjenice koje je proizvođač sam upisao, a vlasnik treba da zna

| Proizvod | Zvanična napomena | Kako je prikazano |
|---|---|---|
| **Hand Mask** (144.547–144.553, 6 šifara) | u specifikaciji svake šifre: „Only in France available” | uvezen (aktivna stranica), ali kolona statusa svake varijante kaže „Proizvođač: dostupno samo u Francuskoj”. Ako ga ne želimo u katalogu: `source."masking/hand-mask-handy-masking-film-incl-tape": { "decision": "skip" }` — svesno ruši paritet za taj jedan proizvod. |
| **Explorer Ltd. 2-Piece Coverall** | 158.684 (jakna M) i 158.691 (pantalone XXL): „NOT LONGER IN STOCK” | te dve varijante nose status „Proizvođač: više nije na zalihama”. |

## 3. Naši ručni zapisi bez potvrđenog zvaničnog parnjaka (ostaju, nisu dirani)

| Naš zapis | Nalaz |
|---|---|
| `carsystem-p23-brusni-diskovi` | serija „P23” ne postoji ni na sajtu ni u katalogu. Najbliže: P.25 Ceramic (`carsystem-sanding-disc-p-25-ceramic`). |
| `carsystem-soft-plus-git` | „Soft Plus” ne postoji; zvanično postoji „Soft” (`carsystem-soft`). |
| `carsystem-zastitno-odelo` | vidi tačku 1; deli slike sa uvezenom jaknom → u katalogu su dve kartice sa istom fotografijom. |
| `carsystem-p19-brusni-diskovi` | prepoznat (156.357–156.371), aktivan na sajtu, nema ga u PDF-u 2026/27. |

## 4. Ispravljeno: slika ručnog zapisa Multi Green

`carsystem-git-multi-green` je prikazivao limenku „MULTI GREEN **GLAS**” (146.707,
1610 g) — i u commitovanom `.jpg` i u kasnijem necommitovanom `.webp`. Od
2026-09-18 PDP, kartica i pretraga koriste zvanični packshot SVOG proizvoda:
`public/products/carsystem/catalog/carsystem-git-multi-green.webp`, izvor
`carsystem.org/fileadmin/_processed_/a/4/csm_146.706-cs-multi-green-inkl-haerter-kg-1_6-3D_9d06d12c91.png`
(sha256 `592306fae51b9cb6…`, natpis „MULTI GREEN”, 1.560 g). Zamena ide kroz sync
(`manual-decisions.json` → `local."carsystem-git-multi-green".useOfficialImage`),
pa se ručni zapis i stare slike ne diraju. „Multi Green Glas” zadržava svoj
packshot (`csm_146.707-…`, sha256 `7a82fd30b60d0558…`).

Ostaje za vlasnika: stari fajlovi `public/products/carsystem/carsystem-git-multi-green.jpg`
(commitovan, već neupotrebljen) i `.webp` (necommitovan raniji rad; zapis ga i
dalje navodi, ali se više ne prikazuje) mogu da se uklone kada se zaključi taj
raniji rad. Bedž „1,8 kg” na slici potiče iz ručno upisanog pakovanja kog
proizvođač nema.

## 5. U katalogu 2026/27, ali bez stranice na sajtu — `CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE` (3)

| Proizvod | Šifre | Status 18.09.2026. |
|---|---|---|
| ERLKING LTD. 2-PIECE COVERALL | 160.663–160.674 (12) | nema stranicu, slike ni opisa |
| CLASSIC COVERALL PANTS KNEEPADFIT | 160.596–160.601 (6) | isto |
| CAR CLEAN MULTI II | 160.515 (1) | isto |

Ne blokiraju website-parity. Sledeći `npm run carsystem:sync` ih uvozi čim
Carsystem objavi stranicu.

## 6. Preostale razlike između zvaničnih izvora (informativno)

| Proizvod | Šifra | Katalog | Sajt | Uvezeno |
|---|---|---|---|---|
| Polishing Pad X1500 | 160.447 / 160.449 | 145 mm | 125 mm / 140 mm | sajt |
| Polishing Pad X1500 | 160.448 / 160.450 | 85 mm | 85 mm / 95 mm | sajt |
| Polishing Pad X8000 | 160.452 / 160.453 | 145 mm / 85 mm | 125 mm / 140 mm, 85 mm / 95 mm | sajt |
| Topline WP S | 136.683 (P 360) | ima | nema | varijanta iz kataloga (`onWebsite: false`) |
| Prep & Scuff | 137.779 (dozator 5,0 kg) | ima | nema | varijanta iz kataloga (`onWebsite: false`) |

## 7. Ostale poslovne odluke

1. **Kategorija za merchandising.** Platforma nema kategoriju za promotivne
   artikle. Bez uvođenja nove top-level kategorije: brendirana odeća (11) →
   „Zaštita”, skalpel → „Pribor”, ostalo (nalepnice, šolja, otirač, zastava,
   upaljač, olovka, USB — 7) → „Radionica” kao najbliže postojeće. Ako treba
   zasebna kategorija ili filter „Promo”, to je odluka o taksonomiji.
2. **TDS hosting.** 238 zvaničnih TDS-ova ≈ 100 MB; PDP vodi na zvanični PDF.
3. **Placeholder `sku`** na ručnim zapisima (`CS-F19-DISC`, `CS-GIT-MULTI-GREEN`…) nije diran.
4. **54 proizvoda čiji je materijal vidljiv na slici nema potvrđenu boju serije**
   → boja brenda. Spisak i preporuke: `COLOUR_WARNINGS.md`.
5. **PERFORMANCE FOLLOW-UP — početni `/katalog`.** Produkcija: svih 625 canonical
   entiteta u prvom odgovoru (RSC tok 939 KB, 102 KB gzip), prikazuje se 48;
   infinite scroll ne šalje zahteve za podatke. Otvoren arhitektonski zadatak
   (decision matrix C03/L18).
