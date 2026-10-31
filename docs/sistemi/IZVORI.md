# Izvori tehničkih vrednosti

Stranice `/program/*` navode uz vrednost dokument, verziju i stranu PDF-a (1 = prva strana fajla).

Provera (2026-10-30 i 2026-10-31):

1. Tekst dokumenata je pretražen po stranama (pypdf).
2. Vrednost (granulacija, broj sa jedinicom, odnos mešanja) prihvata se samo iz dokumenta proizvoda koji rečenica ili red skale/tabele imenuje, i samo na navedenoj strani.
3. Kontekst je pregledan ručno za sve zadržane vrednosti (proizvod, postupak, jedinica, uslovi); pritisci, dizne, granulacije i rečenice iz više izvora posebno.
4. Završna provera: za svaki zapis navedene strane zajedno sadrže sve njegove vrednosti (58 zapisa, 0 nepokrivenih).

Rečenice bez vrednosti (opisi postupka) nemaju broj strane; potiču iz vodiča koji citiraju ove dokumente.

Ovo je urednička provera prema dokumentu proizvođača, uz pomoć AI-ja. Nije stručna potvrda tehnologa ili autolakirera.

Kolona „verzija iz“: `PDF` = verzija pročitana iz samog fajla na kome je strana nađena; `vodič` = verzija iz vodiča (za dokumente sa sajta proizvođača tada nije isključeno da se preuzeti fajl razlikuje).

| Id | Dokument | Verzija | Verzija iz | Adresa |
|---|---|---|---|---|
| `baslac-20-22-tds` | baslac, Technical Information 20-22 2K Primerfiller | 06/2023 | vodič | /documents/products/baslac/20-22.pdf |
| `baslac-21-11-tds` | baslac, Technical Information 21-11 2K Plastic Primer VOC | 06/2023 | vodič | /documents/products/baslac/21-11.pdf |
| `baslac-30-line-cv-tds` | baslac, Technical Information 30 Line CV, 30 CV Topcoat | 12/2025 | vodič | /documents/products/baslac/30_Line_CV.pdf |
| `baslac-30-line-tds` | baslac, Technical Information 30 Line, 30- Topcoat, direct gloss | 12/2025 | vodič | /documents/products/baslac/30_Line.pdf |
| `baslac-35-line-tds` | baslac, Technical Information 35 Line, 35- Basecoat | 08/2023 | vodič | /documents/products/baslac/35_Line.pdf |
| `baslac-40-100-tds` | baslac, Technical Information 40-100 High Speed 2K Clear VOC | 06/2026 | PDF | /documents/products/baslac/40-100.pdf |
| `baslac-45-line-tds` | baslac, Technical Information 45 Line, 45- Basecoat | 03/2026 | PDF | /documents/products/baslac/45_Line.pdf |
| `baslac-blend-51k` | baslac, Technical Information Mazda Rhodium White Met, Color 51K for Basecoat — Blend in repair process on the adjacent panel | 03/2025 | vodič | /documents/products/baslac/Mazda51K_chart_blend_in_process_1.pdf |
| `carfit-etch-primer-tds` | C.A.R.FIT, Technical Data Sheet 1K Etch Primer Spray |  | vodič | https://carfitrepair.com/wp-content/uploads/2023/05/car-fit-1k-etch-primer-spray-technical-data-sheet.pdf |
| `carfit-finishing-tds` | C.A.R.FIT, Technical Data Sheet BLACK LABEL Finishing Compound | 01.12.2020 | vodič | https://carfitrepair.com/wp-content/uploads/2023/05/car-fit-finishing-compound-technical-data-sheet.pdf |
| `carfit-zinc-spray-tds` | C.A.R.FIT, Technical Data Sheet Zinc Spray |  | vodič | https://carfitrepair.com/wp-content/uploads/2023/05/car-fit-zinc-spray-technical-data-sheet.pdf |
| `carsystem-2k-epoxy-fill-primer-tds` | Carsystem, Technical Data Sheet 2K Epoxy Fill Primer, 2K Spot-repair epoxy primer V03 | V03, 03/2024 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-epoxy-grundierfueller-v03.pdf |
| `carsystem-multi-green-tds` | Carsystem, Technical Data Sheet Multi Green, Polyester multifunctional putty V08 | V08, 11/2024 | vodič | /documents/products/carsystem/carsystem-git-multi-green-tds.pdf |
| `carsystem-silicone-remover-water-tds` | Carsystem, Technical Data Sheet Silicone Remover Water 2.0, Silicone remover – water-based V02 | V02, 09/2025 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-silicone-remover-water-2.0-v02.pdf |
| `carsystem-speed-plus-tds` | Carsystem, Technical Data Sheet 2K Clear VOC Speed Plus | V06, 01/2025 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-clear-voc-speed-plus-v06.pdf |
| `carsystem-xpress-five-tds` | Carsystem, Technical Data Sheet CC.21 X-press FIVE | V02, 01/2025 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-cc.21-x-press-five-v02.pdf |
| `cs-c-wax-c80-tds` | Carsystem, Technical Data Sheet C-Wax C-80, high gloss finish sealer | V01, 11/2021 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-c-wax-c-80-v01.pdf |
| `cs-c05-tds` | Carsystem, Technical Data Sheet CS Polish C-05 cut | V02, 11/2020 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-polish-c-05-cut.pdf |
| `cs-c07-tds` | Carsystem, Technical Data Sheet CS Polish C-07 cut | V01, 09/2020 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-polish-c-07-cut.pdf |
| `cs-c10-tds` | Carsystem, Technical Datasheet CS Polish C-10 strong | V01, 09/2014 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-polish-c-10-strong.pdf |
| `cs-c30-tds` | Carsystem, Technical Datasheet CS Polish C-30 finish | V01, 09/2014 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-polish-c-30-finish.pdf |
| `cs-carbo-clear-tds` | Carsystem, Technical Data Sheet 2K Carbo Clear Plus | V02, 02/2018 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-carbo-clear-plus.pdf |
| `cs-cc26-tds` | Carsystem, Technical Data Sheet 2K Clear VOC CC.26 ECO-X 15/60 | V01, 04/2026 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-CC.26-ECO_X-v01.pdf |
| `cs-fine-line-tds` | Carsystem, Technical Data Sheet Fine Line Tape Blue, paint line tape | V03, 03/2025 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-fine-line-tape-blue-v03.pdf |
| `cs-jupiter-h2o-tds` | Carsystem, Technical Data Sheet CS ProFlex Jupiter Soft H2O, 152 mm i 77 mm | V02, 07/2020 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-proflex-jupiter-soft-h2o-disc-152-multi-hole.pdf |
| `cs-master-tape-green-tds` | Carsystem, Technical Data Sheet Master Tape Green, masking tape | v.01, 03/2021 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-master-tape-green.pdf |
| `cs-master-tape-ii-tds` | Carsystem, Technical Data Sheet Master Tape II, masking tape | v.02, 03/2021 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-master-tape-II.pdf |
| `cs-multi-black-rapid-tds` | Carsystem, Technical Data Sheet Multi Black Rapid, Multifunctional polyester putty | V01, 10/2024 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-multi-black-rapid-v01.pdf |
| `cs-paper-master-ii-tds` | Carsystem, Technical Data Sheet Masking Paper Master II | V03, 07/2025 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-masking-paper-master-II-v03.pdf |
| `cs-red-tape-tds` | Carsystem, Technical Data Sheet Red Tape, Masking Tape | V01, 01/2026 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-red-tape-v01.pdf |
| `cs-refinish1-tds` | Carsystem, Technical Data Sheet Refinish 1, cutting and polishing compound | v.02, 03/2021 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-refinish-1.pdf |
| `cs-slim-tape-tds` | Carsystem, Technical Data Sheet Slim Tape, special masking tape | v.02, 03/2021 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-slim-tape.pdf |
| `cs-step1-tds` | Carsystem, Technical Data Sheet CS Polish Step 1 coarse | V01, 06/2019 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-polish-step-1-coarse.pdf |
| `cs-top-tape-tds` | Carsystem, Technical Data Sheet Top Tape, masking tape | v.02, 03/2021 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-top-tape.pdf |
| `cs-uv-clear-tds` | Carsystem, Technical Data Sheet CS UV Clear | V02, 11/2019 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-uv-clear.pdf |
| `cs-vario-plus-tds` | Carsystem, Technical Data Sheet 2K Filler Vario Plus, 2K acrylic filler | V 01, 06.02.2015 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-filler-vario-plus.pdf |
| `cs-wr-lifting-premium-tds` | Carsystem, Technical Data Sheet WR-Lifting Tape Premium, masking tape with plastic edge – perforated | V03, 10/2025 | vodič | https://www.carsystem.org/fileadmin/products/datasheets/tds-wr-lifting-tape-premium-v03.pdf |
| `norbin-n15-020-tds` | Norbin, Technical Information N15-020 NORBIN Clear | 01/2022 | PDF | https://www.norbin-paint.com/files/TDS/NORBIN_TDS_N15-020_Clear_2022.pdf |
| `rm-agilis-tds` | R-M, Technical Information AGILIS, Waterborne basecoat | 10/2026 | PDF | https://techinfo.rmpaint.com/unicorn/en/AGILIS-Waterborne%20basecoat.pdf |
| `rm-b2p93-tds` | R-M, Technical Information UV Bodyfill-R B 2P93 UV body filler | 07/2026 | PDF | /documents/products/rm/b-2p93-uv-bodyfill-r/rm-b-2p93-uv-bodyfill-r-technical-data-sheet.pdf |
| `rm-c2a40-tds` | R-M, Technical Information C 2A40 AirTOP, Clear coat, air drying | 07/2026 | PDF | /documents/products/rm/c-2a40-airtop/rm-c-2a40-airtop-technical-data-sheet.pdf |
| `rm-c2p62-tds` | R-M, Technical Information BRIGHT Finish-R, C 2P62 eSense clear coat, superior gloss | 07/2026 | PDF | /documents/products/rm/c-2p62-bright-finish-r/rm-c-2p62-bright-finish-r-technical-data-sheet.pdf |
| `rm-c2p91-tds` | R-M, Technical Information C 2P91 MAT Finish-R, eSense clear coat, mat | 07/2026 | PDF | /documents/products/rm/c-2p91-mat-finish-r/rm-c-2p91-mat-finish-r-technical-data-sheet.pdf |
| `rm-diamont-tds` | R-M, Technical Information DIAMONT, Basecoat for basecoat / clearcoat systems | 10/2026 | PDF | https://techinfo.rmpaint.com/unicorn/en/DIAMONT-Basecoat%20for%20basecoat%20_%20clearcoat%20systems.pdf |
| `rm-onyx-hd-tds` | R-M, Technical Information ONYX HD, Waterborne basecoat line | 10/2026 | PDF | https://techinfo.rmpaint.com/unicorn/en/ONYX%20HD-ONYX%20HD%20Waterborne%20basecoat%20line.pdf |
| `rm-p2a41-tds` | R-M, Technical Information PerformFILLER White P 2A41 Sanding primer filler, white | 07/2026 | PDF | /documents/products/rm/p-2a41-performfiller-white/rm-p-2a41-performfiller-white-technical-data-sheet.pdf |
| `rm-p2e23-tds` | R-M, Technical Information P 2E23 Primer filler, grey | 07/2026 | PDF | /documents/products/rm/p-2e23-primer-filler-grey/rm-p-2e23-primer-filler-grey-technical-data-sheet.pdf |
| `rm-p2p51-tds` | R-M, Technical Information SANDING Fill-R+ White P 2P51 eSense primer filler, white | 07/2026 | PDF | /documents/products/rm/p-2p51-sanding-fill-r-white/rm-p-2p51-sanding-fill-r-white-technical-data-sheet.pdf |
| `rm-p2p63-tds` | R-M, Technical Information MULTI Purpos-R Grey, P 2P63 eSense DTM, grey | 07/2026 | PDF | /documents/products/rm/p-2p63-multi-purpos-r-grey/rm-p-2p63-multi-purpos-r-grey-technical-data-sheet.pdf |
| `rm-pk1p10-tds` | R-M, Technical Information SILICONE Remov-R, PK 1P10 eSense solventborne cleaning agent | 10/2026 | PDF | https://techinfo.rmpaint.com/unicorn/en/PK%201P10-eSense%20solventborne%20cleaning%20agent.pdf |
| `rm-pk2p10-tds` | R-M, Technical Information MULTI Clean-R, PK 2P10 eSense waterborne multi cleaning agent | 10/2026 | PDF | https://techinfo.rmpaint.com/unicorn/en/PK%202P10-eSense%20waterborne%20multi%20cleaning%20agent.pdf |
| `rm-pk2p20-tds` | R-M, Technical Information PRE Clean-R, PK 2P20 eSense waterborne cleaning agent, base-/topcoat | 10/2026 | PDF | https://techinfo.rmpaint.com/unicorn/en/PK%202P20-eSense%20waterborne%20cleaning%20agent%20base-_topcoat.pdf |
