# Audit čitljivosti javnih URL-ova

Provera: 2026-10-01, grana `chore/content-qa-2026-10`, produkcioni build (`.next`). Nijedan URL nije menjan — ovo je predlog. Svaka promena traži trajni 301, novu canonical adresu, sitemap i interne linkove.

## Sažetak

| | Broj |
|---|---|
| Prerenderovane rute ukupno | 2014 |
| Javne rute (bez internih demo strana) | 2010 |
| **PASS** | 1412 |
| **REVIEW** | 598 — od toga 70 sadržajnih strana (PDP i porodice) i 528 adresa koje samo preusmeravaju na porodicu |
| **FAIL** | 0 |
| Interne demo strane (404 na Production/Preview, GAP-008) | 4 |
| URL-ovi u sitemap-u | 1216 (svi postoje kao strane; 0 nepostojećih) |
| Interni linkovi (jedinstveni ciljevi) | 2758 — **0 pokvarenih** |
| Pravila preusmerenja (`next.config.ts` + sync) | 82 — 0 sa nepostojećim ciljem |
| Varijantni ključevi `?varijanta=` | 1171 — 266 REVIEW |
| Dinamičke javne rute iz `app/` (prijava, nalog, portal) | 79 — sve srpske, opisne (`/prijava/kupac`, `/kupac/saglasnosti`, `/portal/cene/odobravanje` …) |

Nijedna javna adresa ne sadrži UUID, hash, build ID, `undefined`/`null`/`temp`/`copy`/`final`, dvostruku crticu, URL-kodiranje, velika slova, dijakritiku ni mešana pisma. Reč „test" postoji samo u `/proizvodi/carfit-metal-test-cards`, gde je deo zvaničnog naziva („Metal Test Cards") — PASS.

## Pravila

- **FAIL:** UUID/hash/ID, zabranjene reči (`undefined`, `null`, `test`, `demo`, `temp`, `copy`, `new`, `final`, `draft`) osim kad su deo naziva, `--`, crtica na kraju/početku, `%xx`, znakovi van `a-z0-9-`, canonical ili interni link ka nepostojećoj ruti.
- **REVIEW:** slug se završava veznikom/predlogom (odsečen naziv), ista reč (≥ 4 slova) ponovljena u slugu, slug duži od 80 znakova, manje od polovine reči iz sluga u naslovu/H1/opisu strane, slovna greška (ručno).
- **PASS:** sve ostalo. Šifra proizvoda u slugu je PASS kada je deo naziva (npr. `h-2p15-clear-harden-r`, `baslac-20-22-2k-primerfiller`).

## FAIL

Nema.

## REVIEW — sadržajne strane (70)

Posledice promene za svaki red: 301 sa starog na novi URL (trajno), nova canonical i `og:url`, novi `@id` u Product/ProductGroup JSON-LD, sitemap i svi interni linkovi; varijante (`?varijanta=`) na stranama porodica ostaju iste. SEO rizik: **srednji** za strane u sitemap-u (indeksirane; vrednost se prenosi kroz 301, ali uz kratkotrajnu promenu u indeksu), **nizak** za ostale.

Predlog sluga je polazna tačka (uklonjena ponavljanja; kod engleskih SATA slugova bez veze sa srpskim nazivom — slug iz srpskog naziva); konačan oblik potvrđuje vlasnik pre bilo kakve promene.

| # | Trenutni URL | Naslov / H1 | Razlog | Predlog novog sluga | Redirect | Canonical | SEO rizik |
|---|---|---|---|---|---|---|---|
| 1 | `/proizvodi/baslac-70-10-silicone-remover-for-oil-silicone-and-grease` | baslac 70-10 Silicone Remover for oil, silicone and grease | ponovljene reči: silicone | `/proizvodi/baslac-70-10-silicone-remover-for-oil-and-grease` | 301 `/proizvodi/baslac-70-10-silicone-remover-for-oil-silicone-and-grease` → novi | canonical na novi URL | srednji |
| 2 | `/proizvodi/carfit-clearcoar-matt` | Car Fit Clearcoat matt | slovna greška u slugu („clearcoar" umesto „clearcoat") — pronađeno ručnim pregledom | `/proizvodi/carfit-clearcoat-matt` | 301 `/proizvodi/carfit-clearcoar-matt` → novi | canonical na novi URL | srednji |
| 3 | `/proizvodi/carfit-mixing-cups-and-mixing-lids` | Car Fit Mixing Cups & Mixing Lids | ponovljene reči: mixing | `/proizvodi/carfit-mixing-cups-and-lids` | 301 `/proizvodi/carfit-mixing-cups-and-mixing-lids` → novi | canonical na novi URL | srednji |
| 4 | `/proizvodi/carfit-sanding-control-kit-and-sanding-powder` | Car Fit Sanding Control Kit and Sanding Powder | ponovljene reči: sanding | `/proizvodi/carfit-sanding-control-kit-and-powder` | 301 `/proizvodi/carfit-sanding-control-kit-and-sanding-powder` → novi | canonical na novi URL | srednji |
| 5 | `/proizvodi/carfit-very-fine-and-ultra-fine-abrasive-fleece` | Car Fit Very Fine and Ultra Fine Abrasive Fleece | ponovljene reči: fine | `/proizvodi/carfit-very-fine-and-ultra-abrasive-fleece` | 301 `/proizvodi/carfit-very-fine-and-ultra-fine-abrasive-fleece` → novi | canonical na novi URL | srednji |
| 6 | `/proizvodi/carsystem-air-hose-air-hose-coil` | Carsystem Air hose – Air hose coil | ponovljene reči: hose | `/proizvodi/carsystem-air-hose-air-coil` | 301 `/proizvodi/carsystem-air-hose-air-hose-coil` → novi | canonical na novi URL | srednji |
| 7 | `/proizvodi/carsystem-air-hose-air-hose-complete` | Carsystem Air hose – Air hose complete | ponovljene reči: hose | `/proizvodi/carsystem-air-hose-air-complete` | 301 `/proizvodi/carsystem-air-hose-air-hose-complete` → novi | canonical na novi URL | srednji |
| 8 | `/proizvodi/carsystem-socks-carsystem-black-white` | Carsystem Socks CARSYSTEM black & white | ponovljene reči: carsystem | `/proizvodi/carsystem-socks-black-white` | 301 `/proizvodi/carsystem-socks-carsystem-black-white` → novi | canonical na novi URL | srednji |
| 9 | `/proizvodi/carsystem-socks-carsystem-red-white` | Carsystem Socks CARSYSTEM red & white | ponovljene reči: carsystem | `/proizvodi/carsystem-socks-red-white` | 301 `/proizvodi/carsystem-socks-carsystem-red-white` → novi | canonical na novi URL | srednji |
| 10 | `/proizvodi/carsystem-spray-filler-spray` | Carsystem Spray Filler Spray | ponovljene reči: spray | `/proizvodi/carsystem-spray-filler` | 301 `/proizvodi/carsystem-spray-filler-spray` → novi | canonical na novi URL | srednji |
| 11 | `/proizvodi/carsystem-uniflex-adapter-nozzle-v-nozzle` | Carsystem UNIFLEX Adapter Nozzle – V-Nozzle | ponovljene reči: nozzle | `/proizvodi/carsystem-uniflex-adapter-nozzle-v` | 301 `/proizvodi/carsystem-uniflex-adapter-nozzle-v-nozzle` → novi | canonical na novi URL | srednji |
| 12 | `/proizvodi/cosmos-lac-effect-450-400-ml-chrome-effect-450` | Cosmos Lac Effect Chrome Effect 450 | ponovljene reči: effect | `/proizvodi/cosmos-lac-effect-450-400-ml-chrome-450` | 301 `/proizvodi/cosmos-lac-effect-450-400-ml-chrome-effect-450` → novi | canonical na novi URL | srednji |
| 13 | `/proizvodi/cosmos-lac-effect-451-400-ml-gold-effect-451` | Cosmos Lac Effect Gold Effect 451 | ponovljene reči: effect | `/proizvodi/cosmos-lac-effect-451-400-ml-gold-451` | 301 `/proizvodi/cosmos-lac-effect-451-400-ml-gold-effect-451` → novi | canonical na novi URL | srednji |
| 14 | `/proizvodi/cosmos-lac-home-400-400-ml-white-smalto-400-white` | Cosmos Lac Home White Smalto 400 | ponovljene reči: white | `/proizvodi/cosmos-lac-home-400-400-ml-white-smalto-400` | 301 `/proizvodi/cosmos-lac-home-400-400-ml-white-smalto-400-white` → novi | canonical na novi URL | srednji |
| 15 | `/proizvodi/cosmos-lac-master-mechanic-01-500-ml-master-mechanic-primer-01-grey` | Cosmos Lac Master Mechanic Primer 01 Grey | ponovljene reči: master, mechanic | `/proizvodi/cosmos-lac-master-mechanic-01-500-ml-primer-01-grey` | 301 `/proizvodi/cosmos-lac-master-mechanic-01-500-ml-master-mechanic-primer-01-grey` → novi | canonical na novi URL | nizak |
| 16 | `/proizvodi/cosmos-lac-master-mechanic-01-500-ml-master-mechanic-primer-01-white` | Cosmos Lac Master Mechanic Primer 01 Grey | ponovljene reči: master, mechanic | `/proizvodi/cosmos-lac-master-mechanic-01-500-ml-primer-01-white` | 301 `/proizvodi/cosmos-lac-master-mechanic-01-500-ml-master-mechanic-primer-01-white` → novi | canonical na novi URL | nizak |
| 17 | `/proizvodi/cosmos-lac-master-mechanic-02-500-ml-master-mechanic-filler-02-black` | Cosmos Lac Master Mechanic Filler 02 Black | ponovljene reči: master, mechanic | `/proizvodi/cosmos-lac-master-mechanic-02-500-ml-filler-02-black` | 301 `/proizvodi/cosmos-lac-master-mechanic-02-500-ml-master-mechanic-filler-02-black` → novi | canonical na novi URL | nizak |
| 18 | `/proizvodi/cosmos-lac-master-mechanic-02-500-ml-master-mechanic-filler-02-grey` | Cosmos Lac Master Mechanic Filler 02 Black | ponovljene reči: master, mechanic | `/proizvodi/cosmos-lac-master-mechanic-02-500-ml-filler-02-grey` | 301 `/proizvodi/cosmos-lac-master-mechanic-02-500-ml-master-mechanic-filler-02-grey` → novi | canonical na novi URL | nizak |
| 19 | `/proizvodi/cosmos-lac-master-mechanic-03-500-ml-master-mechanic-epoxy-primer-03-grey` | Cosmos Lac Master Mechanic Epoxy Primer 03 Grey | ponovljene reči: master, mechanic | `/proizvodi/cosmos-lac-master-mechanic-03-500-ml-epoxy-primer-03-grey` | 301 `/proizvodi/cosmos-lac-master-mechanic-03-500-ml-master-mechanic-epoxy-primer-03-grey` → novi | canonical na novi URL | srednji |
| 20 | `/proizvodi/cosmos-lac-master-mechanic-04-500-ml-master-mechanic-wash-primer-04-light-yellow` | Cosmos Lac Master Mechanic Wash Primer 04 Light Yellow | ponovljene reči: master, mechanic | `/proizvodi/cosmos-lac-master-mechanic-04-500-ml-wash-primer-04-light-yellow` | 301 `/proizvodi/cosmos-lac-master-mechanic-04-500-ml-master-mechanic-wash-primer-04-light-yellow` → novi | canonical na novi URL | srednji |
| 21 | `/proizvodi/cosmos-lac-master-mechanic-05-providna-500-ml-master-mechanic-plastic-primer-05-transparent` | Cosmos Lac Master Mechanic Plastic Primer 05 Transparent — providna | ponovljene reči: master, mechanic; predugačak slug (91 znakova) | `/proizvodi/cosmos-lac-master-mechanic-05-providna-500-ml-plastic-primer-05` | 301 `/proizvodi/cosmos-lac-master-mechanic-05-providna-500-ml-master-mechanic-plastic-primer-05-transparent` → novi | canonical na novi URL | srednji |
| 22 | `/proizvodi/cosmos-lac-master-mechanic-06-500-ml-master-mechanic-control-guide-06-black` | Cosmos Lac Master Mechanic Control Guide 06 Black | ponovljene reči: master, mechanic | `/proizvodi/cosmos-lac-master-mechanic-06-500-ml-control-guide-06-black` | 301 `/proizvodi/cosmos-lac-master-mechanic-06-500-ml-master-mechanic-control-guide-06-black` → novi | canonical na novi URL | srednji |
| 23 | `/proizvodi/cosmos-lac-master-mechanic-13-500-ml-master-mechanic-antigravel-paintable-13-black` | Cosmos Lac Master Mechanic Antigravel Paintable 13 Black | ponovljene reči: master, mechanic; predugačak slug (82 znakova) | `/proizvodi/cosmos-lac-master-mechanic-13-500-ml-antigravel-paintable-13-black` | 301 `/proizvodi/cosmos-lac-master-mechanic-13-500-ml-master-mechanic-antigravel-paintable-13-black` → novi | canonical na novi URL | nizak |
| 24 | `/proizvodi/cosmos-lac-master-mechanic-13-500-ml-master-mechanic-antigravel-paintable-13-grey` | Cosmos Lac Master Mechanic Antigravel Paintable 13 Black | ponovljene reči: master, mechanic; predugačak slug (81 znakova) | `/proizvodi/cosmos-lac-master-mechanic-13-500-ml-antigravel-paintable-13-grey` | 301 `/proizvodi/cosmos-lac-master-mechanic-13-500-ml-master-mechanic-antigravel-paintable-13-grey` → novi | canonical na novi URL | nizak |
| 25 | `/proizvodi/cosmos-lac-master-mechanic-13-500-ml-master-mechanic-antigravel-paintable-13-white` | Cosmos Lac Master Mechanic Antigravel Paintable 13 Black | ponovljene reči: master, mechanic; predugačak slug (82 znakova) | `/proizvodi/cosmos-lac-master-mechanic-13-500-ml-antigravel-paintable-13-white` | 301 `/proizvodi/cosmos-lac-master-mechanic-13-500-ml-master-mechanic-antigravel-paintable-13-white` → novi | canonical na novi URL | nizak |
| 26 | `/proizvodi/cosmos-lac-master-mechanic-20-providna-500-ml-master-mechanic-clear-coat-20-transparent` | Cosmos Lac Master Mechanic Clear Coat 20 Transparent — providna | ponovljene reči: master, mechanic; predugačak slug (87 znakova) | `/proizvodi/cosmos-lac-master-mechanic-20-providna-500-ml-clear-coat-20` | 301 `/proizvodi/cosmos-lac-master-mechanic-20-providna-500-ml-master-mechanic-clear-coat-20-transparent` → novi | canonical na novi URL | srednji |
| 27 | `/proizvodi/cosmos-lac-wheel-rim-229-mat-400-ml-wheel-rim-229-deluxe-silver-matte` | Cosmos Lac Wheel Rim 229 Deluxe Silver — mat | ponovljene reči: wheel | `/proizvodi/cosmos-lac-wheel-rim-229-mat-400-ml-rim-229-deluxe-silver-matte` | 301 `/proizvodi/cosmos-lac-wheel-rim-229-mat-400-ml-wheel-rim-229-deluxe-silver-matte` → novi | canonical na novi URL | srednji |
| 28 | `/proizvodi/cosmos-lac-zinc-500-400-ml-zinc-maximum-500` | Cosmos Lac Zinc 500 Maximum 500 | ponovljene reči: zinc | `/proizvodi/cosmos-lac-zinc-500-400-ml-maximum-500` | 301 `/proizvodi/cosmos-lac-zinc-500-400-ml-zinc-maximum-500` → novi | canonical na novi URL | srednji |
| 29 | `/proizvodi/cosmos-lac-zinc-501-400-ml-alu-zinc-501` | Cosmos Lac Zinc 501 Alu Zinc 501 | ponovljene reči: zinc | `/proizvodi/cosmos-lac-zinc-501-400-ml-alu-501` | 301 `/proizvodi/cosmos-lac-zinc-501-400-ml-alu-zinc-501` → novi | canonical na novi URL | srednji |
| 30 | `/proizvodi/grupa/cosmos-lac-fluorescent-marking-fluorescent-paint` | Cosmos Lac Fluorescent & Marking Fluorescent Paint 490 Red | ponovljene reči: fluorescent | `/proizvodi/grupa/cosmos-lac-fluorescent-marking-paint` | 301 `/proizvodi/grupa/cosmos-lac-fluorescent-marking-fluorescent-paint` → novi | canonical porodice + ciljevi varijantnih preusmerenja | srednji |
| 31 | `/proizvodi/grupa/cosmos-lac-fluorescent-marking-forest-trail-marking` | Cosmos Lac Fluorescent & Marking Forest & Trail Marking 571 Red | ponovljene reči: marking | `/proizvodi/grupa/cosmos-lac-fluorescent-marking-forest-trail` | 301 `/proizvodi/grupa/cosmos-lac-fluorescent-marking-forest-trail-marking` → novi | canonical porodice + ciljevi varijantnih preusmerenja | srednji |
| 32 | `/proizvodi/grupa/cosmos-lac-fluorescent-marking-road-construction-marking` | Cosmos Lac Fluorescent & Marking Road & Construction Marking 591 Orange | ponovljene reči: marking | `/proizvodi/grupa/cosmos-lac-fluorescent-marking-road-construction` | 301 `/proizvodi/grupa/cosmos-lac-fluorescent-marking-road-construction-marking` → novi | canonical porodice + ciljevi varijantnih preusmerenja | srednji |
| 33 | `/proizvodi/grupa/cosmos-lac-metallic-metallic-effect` | Cosmos Lac Metallic Metallic Effect 332 Blue | ponovljene reči: metallic | `/proizvodi/grupa/cosmos-lac-metallic-effect` | 301 `/proizvodi/grupa/cosmos-lac-metallic-metallic-effect` → novi | canonical porodice + ciljevi varijantnih preusmerenja | srednji |
| 34 | `/proizvodi/grupa/cosmos-lac-wood-putties-water-based-wood-putty` | Cosmos Lac Wood Putties Water-Based Wood Putty 1 Mahogany Light | ponovljene reči: wood | `/proizvodi/grupa/cosmos-lac-wood-putties-water-based-putty` | 301 `/proizvodi/grupa/cosmos-lac-wood-putties-water-based-wood-putty` → novi | canonical porodice + ciljevi varijantnih preusmerenja | srednji |
| 35 | `/proizvodi/sata-1-0-l-aluminium-pressure-pot-max-pressure-10-bar-hrs` | Aluminijumska posuda pod pritiskom 1,0 l (maks. 10 bar / 150 psi), komplet sa navojnim prstenom | ponovljene reči: pressure; slaba veza sa naslovom (3/8 reči iz sluga u naslovu/H1) | `/proizvodi/sata-aluminijumska-posuda-pod-pritiskom-1-0-l-maks-10-bar` | 301 `/proizvodi/sata-1-0-l-aluminium-pressure-pot-max-pressure-10-bar-hrs` → novi | canonical na novi URL | srednji |
| 36 | `/proizvodi/sata-air-hose` | SATA crevo za vazduh | slaba veza sa naslovom (1/3 reči iz sluga u naslovu/H1) | `/proizvodi/sata-crevo-za-vazduh` | 301 `/proizvodi/sata-air-hose` → novi | canonical na novi URL | srednji |
| 37 | `/proizvodi/sata-air-hose-one-connection-included-clean-rcs` | SATA crevo za vazduh, sa jednim priključkom, 13 mm, plavo, 0.5 m, G 1/2" unutrašnji navoj | slaba veza sa naslovom (3/8 reči iz sluga u naslovu/H1) | `/proizvodi/sata-crevo-za-vazduh-sa-jednim-prikljuckom-13-mm-plavo-0-5-m` | 301 `/proizvodi/sata-air-hose-one-connection-included-clean-rcs` → novi | canonical na novi URL | srednji |
| 38 | `/proizvodi/sata-air-tester-atomisation-air-quick-tester` | SATA air tester — brzi tester vazduha za raspršivanje | ponovljene reči: tester | `/proizvodi/sata-air-tester-atomisation-air-quick` | 301 `/proizvodi/sata-air-tester-atomisation-air-quick-tester` → novi | canonical na novi URL | srednji |
| 39 | `/proizvodi/sata-ball-tap-teflon-with-bilateral-thread-female-hose` | Kuglasta slavina (teflon) sa obostranim unutrašnjim navojem i priključkom za crevo, 9 mm, G 3/8" | slaba veza sa naslovom (4/9 reči iz sluga u naslovu/H1) | `/proizvodi/sata-kuglasta-slavina-teflon-sa-obostranim-unutrasnjim` | 301 `/proizvodi/sata-ball-tap-teflon-with-bilateral-thread-female-hose` → novi | canonical na novi URL | srednji |
| 40 | `/proizvodi/sata-care-set-spray-gun-care-bag-containing-1-large` | SATA care set spray gun care bag containing 1 large cleaning brush, 5 medium-sized cleaning brushes, 5 double-sided cleaning brushes, 12 nozzle cleaning needles, 1 tube high performance grease, silicone- and acid-free, 100 g | ponovljene reči: care | `/proizvodi/sata-care-set-spray-gun-bag-containing-1-large` | 301 `/proizvodi/sata-care-set-spray-gun-care-bag-containing-1-large` → novi | canonical na novi URL | srednji |
| 41 | `/proizvodi/sata-cleaning-brush` | Četka za čišćenje | slaba veza sa naslovom (1/3 reči iz sluga u naslovu/H1) | `/proizvodi/sata-cetka-za-ciscenje` | 301 `/proizvodi/sata-cleaning-brush` → novi | canonical na novi URL | srednji |
| 42 | `/proizvodi/sata-cleaning-kit-with-2-cleaning-brushes-medium-and-12` | SATA komplet za čišćenje: 2 srednje četke i 12 igala za čišćenje dizni | ponovljene reči: cleaning | `/proizvodi/sata-cleaning-kit-with-2-brushes-medium-and-12` | 301 `/proizvodi/sata-cleaning-kit-with-2-cleaning-brushes-medium-and-12` → novi | canonical na novi URL | srednji |
| 43 | `/proizvodi/sata-coupling-with` | Spojka, G 1/8" unutrašnji navoj za SATA BVD i Spray-Master | završava se veznikom/predlogom „with" (skraćen naziv) | `/proizvodi/sata-spojka-g-1-8-unutrasnji-navoj-za-bvd-i-spray-master` | 301 `/proizvodi/sata-coupling-with` → novi | canonical na novi URL | srednji |
| 44 | `/proizvodi/sata-door-wand-steel` | Čelična sonda za vrata | slaba veza sa naslovom (1/4 reči iz sluga u naslovu/H1) | `/proizvodi/sata-celicna-sonda-za-vrata` | 301 `/proizvodi/sata-door-wand-steel` → novi | canonical na novi URL | srednji |
| 45 | `/proizvodi/sata-door-wand-steel-with-flexible-guideway-hose` | Čelična sonda za vrata sa fleksibilnim vodećim crevom, Ø 8 mm, radna dužina 150 mm, 1000 mm, rotaciona mlaznica 360°, rotacioni mlaz i prskanje napred | slaba veza sa naslovom (1/8 reči iz sluga u naslovu/H1) | `/proizvodi/sata-celicna-sonda-za-vrata-sa-fleksibilnim-vodecim-crevom-8` | 301 `/proizvodi/sata-door-wand-steel-with-flexible-guideway-hose` → novi | canonical na novi URL | srednji |
| 46 | `/proizvodi/sata-foam-inlay-with-pinched-inlay-truesun` | Penasti uložak | ponovljene reči: inlay | `/proizvodi/sata-foam-inlay-with-pinched-truesun` | 301 `/proizvodi/sata-foam-inlay-with-pinched-inlay-truesun` → novi | canonical na novi URL | srednji |
| 47 | `/proizvodi/sata-intermediate-piece-and-for-material-connection` | Međukomad za priključak materijala, G 1/4" unutrašnji navoj, 3/8" spoljašnji navoj | slaba veza sa naslovom (3/7 reči iz sluga u naslovu/H1) | `/proizvodi/sata-medjukomad-za-prikljucak-materijala-g-1-4-unutrasnji` | 301 `/proizvodi/sata-intermediate-piece-and-for-material-connection` → novi | canonical na novi URL | srednji |
| 48 | `/proizvodi/sata-material-coupling-with-plug-in-nipple` | SATA spojka za materijal sa utičnom niplom, 3/8" spoljašnji navoj, G 3/8" unutrašnji navoj za SATA pištolje sa dovodom pod pritiskom | slaba veza sa naslovom (1/6 reči iz sluga u naslovu/H1) | `/proizvodi/sata-spojka-za-materijal-sa-uticnom-niplom-3-8-spoljasnji` | 301 `/proizvodi/sata-material-coupling-with-plug-in-nipple` → novi | canonical na novi URL | srednji |
| 49 | `/proizvodi/sata-material-hose` | SATA crevo za materijal | slaba veza sa naslovom (1/3 reči iz sluga u naslovu/H1) | `/proizvodi/sata-crevo-za-materijal` | 301 `/proizvodi/sata-material-hose` → novi | canonical na novi URL | srednji |
| 50 | `/proizvodi/sata-nozzle-cleaning-needles` | SATA igle za čišćenje dizni | slaba veza sa naslovom (1/4 reči iz sluga u naslovu/H1) | `/proizvodi/sata-igle-za-ciscenje-dizni` | 301 `/proizvodi/sata-nozzle-cleaning-needles` → novi | canonical na novi URL | srednji |
| 51 | `/proizvodi/sata-nylon-wand-flexible` | Fleksibilna najlonska sonda | slaba veza sa naslovom (1/4 reči iz sluga u naslovu/H1) | `/proizvodi/sata-fleksibilna-najlonska-sonda` | 301 `/proizvodi/sata-nylon-wand-flexible` → novi | canonical na novi URL | srednji |
| 52 | `/proizvodi/sata-protective-sleeve` | Zaštitni rukavac za par creva | slaba veza sa naslovom (1/3 reči iz sluga u naslovu/H1) | `/proizvodi/sata-zastitni-rukavac-za-par-creva` | 301 `/proizvodi/sata-protective-sleeve` → novi | canonical na novi URL | srednji |
| 53 | `/proizvodi/sata-pvc-air-hose-with-mini-quick-coupling-nipple-with-minijet-4400-b` | SATA PVC crevo za vazduh sa mini brzom spojkom i niplama, 2 m, G 1/4" unutrašnji navoj | ponovljene reči: with | `/proizvodi/sata-pvc-air-hose-with-mini-quick-coupling-nipple-minijet-4400-b` | 301 `/proizvodi/sata-pvc-air-hose-with-mini-quick-coupling-nipple-with-minijet-4400-b` → novi | canonical na novi URL | srednji |
| 54 | `/proizvodi/sata-pvc-compressed-air-hose-with-mini-quick-coupling-jet-20-b` | SATA PVC crevo za komprimovani vazduh sa mini brzom spojkom i niplom, providno, 3 m, G 1/4" unutrašnji navoj | slaba veza sa naslovom (3/10 reči iz sluga u naslovu/H1) | `/proizvodi/sata-pvc-crevo-za-komprimovani-vazduh-sa-mini-brzom-spojkom` | 301 `/proizvodi/sata-pvc-compressed-air-hose-with-mini-quick-coupling-jet-20-b` → novi | canonical na novi URL | srednji |
| 55 | `/proizvodi/sata-quick-coupling` | SATA brza spojka | slaba veza sa naslovom (1/3 reči iz sluga u naslovu/H1) | `/proizvodi/sata-brza-spojka` | 301 `/proizvodi/sata-quick-coupling` → novi | canonical na novi URL | srednji |
| 56 | `/proizvodi/sata-quick-coupling-nipple` | SATA nipla za brzu spojku | slaba veza sa naslovom (1/4 reči iz sluga u naslovu/H1) | `/proizvodi/sata-nipla-za-brzu-spojku` | 301 `/proizvodi/sata-quick-coupling-nipple` → novi | canonical na novi URL | srednji |
| 57 | `/proizvodi/sata-quick-coupling-with-hose-olive` | SATA brza spojka sa priključkom za crevo | slaba veza sa naslovom (1/6 reči iz sluga u naslovu/H1) | `/proizvodi/sata-brza-spojka-sa-prikljuckom-za-crevo` | 301 `/proizvodi/sata-quick-coupling-with-hose-olive` → novi | canonical na novi URL | srednji |
| 58 | `/proizvodi/sata-quick-coupling-with-hose-olive-and-quick-coupling` | SATA brza spojka sa priključkom za crevo i nipla za brzu spojku, 9 mm, crveno, G 1/4" unutrašnji navoj, po 2 kom. | ponovljene reči: quick, coupling; slaba veza sa naslovom (1/9 reči iz sluga u naslovu/H1) | `/proizvodi/sata-brza-spojka-sa-prikljuckom-za-crevo-i-nipla-za-brzu` | 301 `/proizvodi/sata-quick-coupling-with-hose-olive-and-quick-coupling` → novi | canonical na novi URL | srednji |
| 59 | `/proizvodi/sata-spray-gun-holder` | SATA držač pištolja | slaba veza sa naslovom (1/4 reči iz sluga u naslovu/H1) | `/proizvodi/sata-drzac-pistolja` | 301 `/proizvodi/sata-spray-gun-holder` → novi | canonical na novi URL | srednji |
| 60 | `/proizvodi/sata-spray-gun-holder-with-strainer-holder` | Držač pištolja sa držačem sita | ponovljene reči: holder | `/proizvodi/sata-spray-gun-holder-with-strainer` | 301 `/proizvodi/sata-spray-gun-holder-with-strainer-holder` → novi | canonical na novi URL | srednji |
| 61 | `/proizvodi/sata-spray-mix-double-hose-material-connection-air` | SATA spray mix dvostruko crevo (priključak materijala + priključak vazduha), 6 x 6 mm, 15 m, M16 x 1.6 unutrašnji navoj, G 1/4" unutrašnji navoj | slaba veza sa naslovom (3/8 reči iz sluga u naslovu/H1) | `/proizvodi/sata-spray-mix-dvostruko-crevo-prikljucak-materijala-vazduha` | 301 `/proizvodi/sata-spray-mix-double-hose-material-connection-air` → novi | canonical na novi URL | srednji |
| 62 | `/proizvodi/sata-spray-mix-hose-pair-material-connection-air` | SATA spray mix par creva (priključak materijala M16 + priključak vazduha) | slaba veza sa naslovom (3/8 reči iz sluga u naslovu/H1) | `/proizvodi/sata-spray-mix-par-creva-prikljucak-materijala-m16-vazduha` | 301 `/proizvodi/sata-spray-mix-hose-pair-material-connection-air` → novi | canonical na novi URL | srednji |
| 63 | `/proizvodi/sata-storage-case-sata-truesun-incl-foam-inlay-truesun` | Kofer za SATA trueSun, sa penastim uloškom | ponovljene reči: sata, truesun | `/proizvodi/sata-storage-case-truesun-incl-foam-inlay` | 301 `/proizvodi/sata-storage-case-sata-truesun-incl-foam-inlay-truesun` → novi | canonical na novi URL | srednji |
| 64 | `/proizvodi/sata-suction-hose-cpl-vario-top-spray` | Usisno crevo, komplet | slaba veza sa naslovom (1/7 reči iz sluga u naslovu/H1) | `/proizvodi/sata-usisno-crevo-komplet` | 301 `/proizvodi/sata-suction-hose-cpl-vario-top-spray` → novi | canonical na novi URL | srednji |
| 65 | `/proizvodi/sata-turbo-blow-with-quick-coupling-nipple-blow-gun` | SATA turbo blow — pištolj za izduvavanje, sa niplom za brzu spojku | ponovljene reči: blow | `/proizvodi/sata-turbo-blow-with-quick-coupling-nipple-gun` | 301 `/proizvodi/sata-turbo-blow-with-quick-coupling-nipple-blow-gun` → novi | canonical na novi URL | srednji |
| 66 | `/proizvodi/sata-universal-spray-gun-holder-foldable` | SATA univerzalni držač pištolja, sklopivi | slaba veza sa naslovom (1/6 reči iz sluga u naslovu/H1) | `/proizvodi/sata-univerzalni-drzac-pistolja-sklopivi` | 301 `/proizvodi/sata-universal-spray-gun-holder-foldable` → novi | canonical na novi URL | srednji |
| 67 | `/proizvodi/sata-vario-top-spray-f-double-diaphragm-pump-1-1-mobile-vario-top-spray` | SATA vario top spray F, double diaphragm pump 1:1, mobile, with material fine pressure regulator, suction tube + 2. gun connection, without spray gun and hoses | ponovljene reči: vario, spray | `/proizvodi/sata-vario-top-spray-f-double-diaphragm-pump-1-1-mobile-top` | 301 `/proizvodi/sata-vario-top-spray-f-double-diaphragm-pump-1-1-mobile-vario-top-spray` → novi | canonical na novi URL | srednji |
| 68 | `/proizvodi/sata-venturi-hook-wand-hook-nozzle-cpl-with-flexible` | Venturi hook wand Ø 5 mm, hook nozzle cpl. in 300 mm length, with flexible guide hose, Venturi spray tube, for cavity and surface application | ponovljene reči: hook | `/proizvodi/sata-venturi-hook-wand-nozzle-cpl-with-flexible` | 301 `/proizvodi/sata-venturi-hook-wand-hook-nozzle-cpl-with-flexible` → novi | canonical na novi URL | srednji |
| 69 | `/proizvodi/sata-venturi-hook-wand-with-flexible-guide-hose-venturi` | Venturi kukasta sonda sa fleksibilnim vodećim crevom, za šupljine i površine | ponovljene reči: venturi; slaba veza sa naslovom (3/9 reči iz sluga u naslovu/H1) | `/proizvodi/sata-venturi-kukasta-sonda-sa-fleksibilnim-vodecim-crevom` | 301 `/proizvodi/sata-venturi-hook-wand-with-flexible-guide-hose-venturi` → novi | canonical na novi URL | srednji |
| 70 | `/proizvodi/sata-viscosity-cup` | SATA čaša za merenje viskoziteta | slaba veza sa naslovom (1/3 reči iz sluga u naslovu/H1) | `/proizvodi/sata-casa-za-merenje-viskoziteta` | 301 `/proizvodi/sata-viscosity-cup` → novi | canonical na novi URL | srednji |

## REVIEW — adrese koje samo preusmeravaju na porodicu (528 od 786)

Ovo su stare PDP adrese pojedinačnih varijanti. Svaka već vraća preusmerenje na `/proizvodi/grupa/<porodica>?varijanta=<ključ>`, nema sopstveni sadržaj, nije u sitemap-u, a interni linkovi vode na porodicu. Ponovljene reči nastaju spajanjem naziva porodice i zvaničnog naziva varijante (npr. `cosmos-lac-chalk-effect-cl-n01-mat-400-ml-chalk-effect-n01-charcoal`). **Preporuka: ne menjati** — to su legacy ulazi koji čuvaju stare linkove; promena bi samo dodala lanac preusmerenja. SEO rizik: nizak.

| Porodica (cilj preusmerenja) | Broj adresa | Primer adrese |
|---|---|---|
| `/proizvodi/grupa/cosmos-lac-flame-orange` | 134 | `/proizvodi/cosmos-lac-flame-orange-fo-100-400-ml-flame-orange-fo-100-vanilla` |
| `/proizvodi/grupa/cosmos-lac-flame-blue` | 120 | `/proizvodi/cosmos-lac-flame-blue-fb-100-400-ml-flame-blue-fb-100-vanilla` |
| `/proizvodi/grupa/cosmos-lac-spray-bike` | 88 | `/proizvodi/cosmos-lac-spray-bike-100-400-ml-spray-bike-london-collection-100-blackfriars` |
| `/proizvodi/grupa/cosmos-lac-easy-max` | 52 | `/proizvodi/cosmos-lac-easy-max-cl-800-ral-9010-400-ml-easy-max-ral-9010-800-white` |
| `/proizvodi/grupa/cosmos-lac-chalk-effect` | 34 | `/proizvodi/cosmos-lac-chalk-effect-cl-n01-mat-400-ml-chalk-effect-n01-charcoal` |
| `/proizvodi/grupa/cosmos-lac-fast-acrylic` | 29 | `/proizvodi/cosmos-lac-fast-acrylic-r307-sjaj-400-ml-fast-acrylic-r307-bright-silver` |
| `/proizvodi/grupa/cosmos-lac-wood-putties-water-based-wood-putty` | 18 | `/proizvodi/cosmos-lac-wood-putties-1-water-based-wood-putty-1-mahogany-light` |
| `/proizvodi/grupa/cosmos-lac-w-wood-impregnating-varnish` | 6 | `/proizvodi/cosmos-lac-w-wood-care-sjaj-w-wood-impregnating-varnish-transparent-gloss` |
| `/proizvodi/grupa/cosmos-lac-fluorescent-marking-forest-trail-marking` | 5 | `/proizvodi/cosmos-lac-fluorescent-marking-571-forest-trail-marking-571-red` |
| `/proizvodi/grupa/cosmos-lac-high-heat-700-c` | 5 | `/proizvodi/cosmos-lac-high-heat-700-c-350-400-ml-high-heat-350-silver` |
| `/proizvodi/grupa/cosmos-lac-master-mechanic-ral` | 5 | `/proizvodi/cosmos-lac-master-mechanic-10-500-ml-master-mechanic-ral-paint-10-silver` |
| `/proizvodi/grupa/cosmos-lac-metallic-metallic-effect` | 5 | `/proizvodi/cosmos-lac-metallic-332-400-ml-metallic-effect-332-blue` |
| `/proizvodi/grupa/cosmos-lac-fluorescent-marking-fluorescent-paint` | 4 | `/proizvodi/cosmos-lac-fluorescent-marking-490-fluorescent-paint-490-red` |
| `/proizvodi/grupa/cosmos-lac-fluorescent-marking-road-construction-marking` | 4 | `/proizvodi/cosmos-lac-fluorescent-marking-591-road-construction-marking-591-orange` |
| `/proizvodi/grupa/cosmos-lac-sealer` | 4 | `/proizvodi/cosmos-lac-sealer-260-400-ml-sealer-260-black` |
| `/proizvodi/grupa/cosmos-lac-master-mechanic-brake-caliper-paint` | 3 | `/proizvodi/cosmos-lac-master-mechanic-15-500-ml-master-mechanic-brake-caliper-paint-15-blue` |
| `/proizvodi/grupa/cosmos-lac-wheel-rim` | 3 | `/proizvodi/cosmos-lac-wheel-rim-326-400-ml-wheel-rim-326-aluminium` |
| `/proizvodi/grupa/cosmos-lac-flame-booster` | 2 | `/proizvodi/cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black` |
| `/proizvodi/grupa/cosmos-lac-master-mechanic-bumper-paint` | 2 | `/proizvodi/cosmos-lac-master-mechanic-11-sjaj-500-ml-master-mechanic-bumber-paint-11-black-gloss` |
| `/proizvodi/grupa/cosmos-lac-master-mechanic-heat-resistant-paint` | 2 | `/proizvodi/cosmos-lac-master-mechanic-12-500-ml-master-mechanic-heat-resistant-paint-12-black` |
| `/proizvodi/grupa/cosmos-lac-master-mechanic-wheel-paint` | 2 | `/proizvodi/cosmos-lac-master-mechanic-14-500-ml-master-mechanic-wheel-paint-14-black` |
| `/portal/korpa (307)` | 1 | `/korpa` |

## REVIEW — varijantni ključevi `?varijanta=` (266 od 1171)

Ključ je deo canonical adrese varijante na strani porodice. Dugi ključevi sa ponovljenim rečima (npr. `CL-FAST-ACRYLIC-RAL-1007-SJAJ-400-ML-FAST-ACRYLIC-RAL-1007-DAFFODIL-YELLOW`) su tačni, ali nečitljivi. Predlog: kraći ključ iz zvanične oznake i nijanse (npr. `RAL-1007-SJAJ-400-ML`), uz mapu starih ključeva na nove; menja se `variantRedirectTarget` i canonical sa query parametrom. SEO rizik: nizak (canonical je porodica sa parametrom; 785 varijanti već prolazi kroz jedno preusmerenje).

| Strana porodice | Ključeva za pregled | Primer ključa | Razlog |
|---|---|---|---|
| `/kontakt` | 263 | `560` | samo broj |
| `/proizvodi/grupa/cosmos-lac-ral` | 1 | `CL-RAL-RAL-3002-SJAJ-400-ML-500-ML-RAL-3002-CARMINE-RED` | predugačak ključ (55 znakova) |
| `/proizvodi/grupa/cosmos-lac-fast-acrylic` | 1 | `CL-FAST-ACRYLIC-RAL-2010-SJAJ-400-ML-FAST-ACRYLIC-RAL-2010-SIGNAL-ORANGE` | predugačak ključ (72 znakova); ponovljene reči: fast, acrylic |
| `/proizvodi/grupa/cosmos-lac-spray-bike` | 1 | `CL-SPRAY-BIKE-400-ML-SPRAY-BIKE-COBWEB-CELADON` | predugačak ključ (46 znakova); ponovljene reči: spray, bike |

## Query parametri u internim linkovima

| Parametar | Različitih vrednosti | Linkova | Ocena |
|---|---|---|---|
| `tema` | 5 | 2695 | PASS — tema upita na `/kontakt` |
| `proizvod` | 1168 | 1437 | PASS — slug proizvoda kao kontekst upita |
| `varijanta` | 1171 | 1205 | vidi odeljak iznad |
| `brend` | 9 | 75 | PASS |
| `program` | 8 | 21 | PASS |
| `sistem` | 11 | 14 | PASS |
| `q` | 14 | 14 | PASS — pretraga |
| `kategorija` | 12 | 12 | PASS |
| `rm-kategorija` | 8 | 8 | PASS |
| `brand` | 3 | 7 | REVIEW — engleski alias za `brend`; isti filter ima dva imena. Predlog: interni linkovi samo `brend` (katalog prihvata oba, pa se javna adresa strane ne menja). |
| `faza` | 5 | 6 | PASS |
| `oblast` | 4 | 5 | PASS |
| `tema-saznanja` | 5 | 5 | PASS |
| `sifra` | 4 | 4 | PASS |
| `serija` | 3 | 3 | PASS |
| `tip` | 1 | 1 | PASS |

Strane `/katalog?…` i `/kontakt?…` sa parametrima šalju `noindex, follow` (middleware), pa filtrirane varijante ne prave duplikate u indeksu; canonical ostaje osnovna strana.

## Duplikati i canonical

- Svaka sadržajna strana ima canonical na postojeću rutu (0 canonical ka nepostojećoj ruti).
- 785 starih varijantnih PDP adresa preusmerava jednim skokom na porodicu sa `?varijanta=`, čiji je canonical sama porodica (potvrđuje i `seo:validate`).
- 82 pravila preusmerenja: svi ciljevi postoje.
- Interne demo strane `/interaction-demo/*`, `/social-exports/*` (4 prerenderovane) vraćaju 404 na Production i Preview.

## Šta je ispravljeno automatski

Ništa: nije pronađen interni link ka pogrešnoj postojećoj ruti (0 pokvarenih među 2758 ciljeva). Javni URL-ovi nisu menjani.

