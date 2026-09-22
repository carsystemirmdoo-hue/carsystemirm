# Vodič za pripremu slika — owner supply pack (115)

Odobreni manifest: `data/catalog/image-supply/USER_IMAGE_SUPPLY_QUEUE.csv` (115 identiteta; zaključan u `manifest-lock.json`). Prvi probni krug: `data/catalog/image-supply/OWNER_SUPPLY_BATCH_01_CANDIDATES.csv`. Ovaj vodič ne uvozi slike i ne menja katalog.

## Šta NIJE u ovom spisku

- **SATA / RUPES / Cosmos Lac slike pod rights review** (198 identiteta) — za njih se čeka odluka o pravima, ne fotografija.
- **Kvalitet postojećih Carsystem/RUPES slika** — odvojen projekat (`IMAGE_QUALITY_QUEUE.csv`).
- Pribor SATA faze 2 bez zvanične slike — placeholder je prihvaćen.

## Opšta pravila

1. **Izvor slike — dozvoljena su dva izvora:**
   - **A) sopstvena fotografija** stvarnog proizvoda;
   - **B) originalni fajl koji je firma dobila direktno od proizvođača ili dobavljača.** Za svaki takav fajl obavezno evidentirati: **od koga** je dobijen, **originalni naziv fajla** (ako postoji) i **da li je firma potvrdila da se asset sme koristiti customer-facing**.
   - Samo posedovanje fajla NIJE dokaz prava objave. Ako pravo nije potvrđeno, identitet ide na **RIGHTS_REVIEW pre objave** — fajl se može primiti i pripremiti, ali se ne objavljuje.
   - Bez slika sa interneta, distributerskih sajtova, marketplace-a ili Google Images; bez AI-generisanih packshotova.
2. Fotografija NE menja podatke kataloga: pakovanje „na upit”, šifra i varijanta ostaju kakvi jesu dok ih ne potvrdi izvor proizvođača.
3. Ako proizvod nije na lageru ili više nije u programu — NE tražiti zamensku sliku; javiti, pa identitet ostaje na placeholderu.

## Kako mi dostaviti sliku

Ne treba ništa konvertovati u WebP — konverziju, cut-out i canonical target fajl pravi kasniji importer.

- Dostaviti **najbolji originalni fajl koji postoji**: PNG, JPG/JPEG ili WebP, u **punoj rezoluciji** (ne uvećavati manji original).
- **Bez WhatsApp / Viber / Instagram kompresije** — slati kao fajl/dokument (mejl, cloud folder, USB), ne kao „sliku” u četu.
- **Ceo proizvod u kadru**, sa praznim prostorom oko njega; **bez ručnog izrezivanja** ako postoji i najmanji rizik da se odseče deo proizvoda.
- Etiketa čitljiva koliko izvor dozvoljava.
- **Ne menjati boju, oblik ni etiketu**; bez filtera i retuša; **bez AI elemenata** (generisana pozadina, dorada, „upscale”).
- Ako je u pitanju fotografija: neutralna čista pozadina (bela/svetlosiva), ravnomerno meko svetlo, proizvod spreda, bez ruku, polica i drugih proizvoda u kadru.

### Naziv fajla (pravilo uparivanja)

`suggested_filename` iz manifesta je **FINALNI TARGET** naziv (uvek `.webp`). Izvorni fajl koji dostavljate mora imati **isti osnovni naziv (basename)**, a ekstenzija sme biti bilo koji dozvoljeni format:

| Manifest (`suggested_filename`) | Dozvoljeni izvorni fajl |
|---|---|
| `carsystem__carsystem-soft-plus-git.webp` | `carsystem__carsystem-soft-plus-git.png` |
| | `carsystem__carsystem-soft-plus-git.jpg` / `.jpeg` |
| | `carsystem__carsystem-soft-plus-git.webp` |

Determinističko pravilo (isto je zapisano u `data/catalog/image-supply/manifest-lock.json`):

1. basename izvornog fajla (sve pre poslednje tačke) mora biti **znak-po-znak jednak** basename-u iz `suggested_filename` — mala slova, bez razmaka, bez dodataka tipa `-final`, `(1)`, `kopija`;
2. ekstenzija izvora ∈ `.png`, `.jpg`, `.jpeg`, `.webp` (velika/mala slova u ekstenziji se ne razlikuju);
3. za jedan basename sme postojati **tačno jedan** izvorni fajl — dva fajla istog basename-a (npr. `.png` i `.jpg`) importer odbija dok se ne ostavi jedan;
4. fajl čiji basename ne postoji u manifestu se ne uvozi.

Importer još NIJE implementiran; ovaj paket ništa ne uvozi.

## Kada jedna fotografija pokriva više artikala

| Tip | Pravilo |
|---|---|
| `SLIKA SERIJE` | 1 fotografija = CELA linija tonera: sve oznake i sve zapremine (baslac). |
| `REPREZENTATIVNA SLIKA GRUPE` | 1 fotografija = više zapisa istog naziva koji se razlikuju samo oznakom (R-M). Slika ne tvrdi da etiketa odgovara svakoj oznaci. |
| `PACKSHOT KARTICE` | 1 fotografija = svi brojevi artikala te kartice (SATA). |
| `PACKSHOT PROIZVODA` | 1 fotografija = 1 proizvod. |
| `PACKSHOT PAKOVANJA/VARIJANTE` | Potrebna je slika BAŠ tog pakovanja; slika drugog pakovanja iste kartice se ne koristi. |
| `SLIKA REDA (boja/dimenzija)` | Potrebna je slika BAŠ te boje/dimenzije (BEFAR). |

## baslac — 37 fotografija

Većina proizvoda nema zvaničnu sliku na baslac.com. Linije tonera (Basecoat 45, Basecoat 35, Topcoat 30, Topcoat 30 CV) imaju JEDNU sliku serije: limenke te linije izgledaju isto, razlikuje ih samo oznaka tonera na nalepnici, a zapremina se bira u kartici — ne traži se fotografija po toneru ni po pakovanju. Ostali zapisi su zasebni proizvodi sa svojom šifrom.

### SLIKA SERIJE (1)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | baslac Basecoat 45 | — | Na upit | 69 | `baslac__baslac-basecoat-45.webp` |

### PACKSHOT PAKOVANJA/VARIJANTE (4)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P3 | Baslac 20-24 2K Primerfiller Grey 4 L | — | 4 L | 1 | `baslac__baslac-20-24-2k-primerfiller-grey-4l.webp` |
| P3 | Baslac 20-34 2K Primerfiller White 1 L | 20-34 | 1 L | 1 | `baslac__baslac-20-34-2k-primerfiller-white-1l.webp` |
| P3 | Baslac 20-94 2K Primerfiller Black 1 L | 20-94 | 1 L | 1 | `baslac__baslac-20-94-2k-primerfiller-black-1l.webp` |
| P3 | Baslac 27-10 2K Washprimer 1 L | 27-10 | 1 L | 1 | `baslac__baslac-27-10-2k-washprimer-1l.webp` |

### PACKSHOT PROIZVODA (32)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | baslac 20-22 2K Primerfiller | 20-22 | Na upit | 1 | `baslac__baslac-20-22-2k-primerfiller.webp` |
| P2 | Baslac 21-11 2K Plastic Primer VOC 1 L | 21-11 | 1 L | 1 | `baslac__baslac-21-11-2k-plastic-primer-voc-1l.webp` |
| P2 | Baslac 21-20 Plastic Primer 400 ml | 21-20 | 400 ml | 1 | `baslac__baslac-21-20-plastic-primer-400ml.webp` |
| P2 | Baslac 30-S510 | — | Na upit | 1 | `baslac__baslac-30-s510-s-serija.webp` |
| P2 | baslac 45-R45 Dilutant | 45-R45 | 5 L | 1 | `baslac__baslac-45-r45.webp` |
| P2 | baslac 45-W10 3-Stage Additive and Blending Clear | 45-W10 | 0,5 L | 1 | `baslac__baslac-45-w10.webp` |
| P2 | baslac 50-05 2K Hardener Ambient UC | 50-05 | Na upit | 1 | `baslac__baslac-50-05-2k-hardener-ambient-uc.webp` |
| P2 | baslac 50-10 2K Primerfiller Hardener Extra Fast | 50-10 | Na upit | 1 | `baslac__baslac-50-10-2k-primerfiller-hardener-extra-fast.webp` |
| P2 | baslac 50-30 2K Hardener Slow | 50-30 | Na upit | 1 | `baslac__baslac-50-30-2k-hardener-slow.webp` |
| P2 | baslac 50-415 2K Clear Hardener Fast VOC | 50-415 | Na upit | 1 | `baslac__baslac-50-415-2k-clear-hardener-fast-voc.webp` |
| P2 | baslac 50-420 2K Clear Hardener Normal VOC | 50-420 | Na upit | 1 | `baslac__baslac-50-420-2k-clear-hardener-normal-voc.webp` |
| P2 | baslac 50-430 2K Clear Hardener Slow VOC | 50-430 | Na upit | 1 | `baslac__baslac-50-430-2k-clear-hardener-slow-voc.webp` |
| P2 | baslac 50-45 2K Activator | 50-45 | Na upit | 1 | `baslac__baslac-50-45-2k-activator.webp` |
| P2 | baslac 50-510 Ambient Clear Hardener | 50-510 | Na upit | 1 | `baslac__baslac-50-510-ambient-clear-hardener.webp` |
| P2 | baslac 50-530 Ambient Clear Hardener slow | 50-530 | Na upit | 1 | `baslac__baslac-50-530-ambient-clear-hardener-slow.webp` |
| P2 | baslac 51-515 2K Hardener CV fast | 51-515 | Na upit | 1 | `baslac__baslac-51-515-2k-hardener-cv-fast.webp` |
| P2 | baslac 51-520 2K Hardener CV Normal | 51-520 | Na upit | 1 | `baslac__baslac-51-520-2k-hardener-cv-normal.webp` |
| P2 | baslac 51-530 2K Hardener CV slow | 51-530 | Na upit | 1 | `baslac__baslac-51-530-2k-hardener-cv-slow.webp` |
| P2 | baslac 55-10 EP Hardener | 55-10 | Na upit | 1 | `baslac__baslac-55-10-ep-hardener.webp` |
| P2 | baslac 56-20 Bodyfiller Hardener | 56-20 | Na upit | 1 | `baslac__baslac-56-20-bodyfiller-hardener.webp` |
| P2 | baslac 57-10 Additive Washprimer | 57-10 | Na upit | 1 | `baslac__baslac-57-10-additive-washprimer.webp` |
| P2 | baslac 57-30 Additive Washprimer slow | 57-30 | Na upit | 1 | `baslac__baslac-57-30-additive-washprimer-slow.webp` |
| P2 | baslac 60-05 Speeding Reducer | 60-05 | Na upit | 1 | `baslac__baslac-60-05-speeding-reducer.webp` |
| P2 | baslac 60-10 Reducer Universal Fast | 60-10 | Na upit | 1 | `baslac__baslac-60-10-reducer-universal-fast.webp` |
| P2 | Baslac 60-20 razređivač | 60-20 | 5 L | 1 | `baslac__baslac-60-20-razredjivac.webp` |
| P2 | baslac 60-30 Reducer Universal Slow | 60-30 | Na upit | 1 | `baslac__baslac-60-30-reducer-universal-slow.webp` |
| P2 | baslac 60-40 Reducer Universal Extra Slow | 60-40 | Na upit | 1 | `baslac__baslac-60-40-reducer-universal-extra-slow.webp` |
| P2 | baslac 65-10 Blending Reducer | 65-10 | Na upit | 1 | `baslac__baslac-65-10-blending-reducer.webp` |
| P2 | baslac 70-10 Silicone Remover for oil, silicone and grease | 70-10 | Na upit | 1 | `baslac__baslac-70-10-silicone-remover-for-oil-silicone-and-grease.webp` |
| P2 | baslac 70-45 Cleaner | 70-45 | Na upit | 1 | `baslac__baslac-70-45-cleaner.webp` |
| P2 | baslac 80-30 Additive Plast | 80-30 | Na upit | 1 | `baslac__baslac-80-30-additive-plast.webp` |
| P2 | baslac 81-30 Additive Chassis | 81-30 | Na upit | 1 | `baslac__baslac-81-30-additive-chassis.webp` |

## R-M — 38 fotografija

R-M (rmpaint.com) za ove proizvode ne objavljuje packshot. Svaka kartica je poseban proizvod sa svojom oznakom (npr. „A 2010”) → jedna fotografija po kartici. Izuzetak su dve grupe istog naziva (GHD THINNER i GHD HARDENER) gde se razlikuje samo oznaka brzine: za njih je dovoljna jedna reprezentativna slika grupe. Katalog pakovanje vodi kao „na upit”; fotografisati pakovanje koje je stvarno na lageru.

### REPREZENTATIVNA SLIKA GRUPE (2)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | R-M GHD HARDENER | H 700 H 750 H 770 | — | 3 | `rm__group-rm-ghd-hardener.webp` |
| P2 | R-M GHD THINNER | GV 100 GV 200 GV 300 GV 400 | — | 4 | `rm__group-rm-ghd-thinner.webp` |

### PACKSHOT PROIZVODA (36)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | R-M BRIL 852 | A 2010 | Na upit | 1 | `rm__rm-a-2010-bril-852.webp` |
| P2 | R-M AGILIS BLENDER X-TREME | A 2540 | Na upit | 1 | `rm__rm-a-2540-agilis-blender-x-treme.webp` |
| P2 | R-M HYDROPURE | A 2810 | Na upit | 1 | `rm__rm-a-2810-hydropure.webp` |
| P2 | R-M GHD DECO A | A 5200 | Na upit | 1 | `rm__rm-a-5200-ghd-deco-a.webp` |
| P2 | R-M GHD TINTING PASTE | A 5700 | Na upit | 1 | `rm__rm-a-5700-ghd-tinting-paste.webp` |
| P2 | R-M AGILIS X-TREME | AGILIS X-TREME | Na upit | 1 | `rm__rm-agilis-x-treme.webp` |
| P2 | R-M BLENDING Thinn-R | AM 2P35 | Na upit | 1 | `rm__rm-am-2p35-blending-thinn-r.webp` |
| P2 | R-M MatTOP | C 2A95 | Na upit | 1 | `rm__rm-c-2a95-mattop.webp` |
| P2 | R-M WHEEL CLEAR COAT | C 2RM2 | Na upit | 1 | `rm__rm-c-2rm2-wheel-clear-coat.webp` |
| P2 | R-M ULTRA FLASH FLAKE DIAMOND | D 121 | Na upit | 1 | `rm__rm-d-121-ultra-flash-flake-diamond.webp` |
| P2 | R-M ONYX HD Deep Black | DB 403 | Na upit | 1 | `rm__rm-db-403-onyx-hd-deep-black.webp` |
| P2 | R-M DIAMONT bezbojni lak | — | 1 L | 1 | `rm__rm-diamont-bezbojni-lak.webp` |
| P2 | R-M GHD CV 12 | GHD CV 12 | Na upit | 1 | `rm__rm-ghd-cv-12.webp` |
| P2 | R-M GHD CV 40M | GHD CV 40M | Na upit | 1 | `rm__rm-ghd-cv-40m.webp` |
| P2 | R-M FillCURE Slow | H 2A31 | Na upit | 1 | `rm__rm-h-2a31-fillcure-slow.webp` |
| P2 | R-M FillCURE Plus | H 2A80 | Na upit | 1 | `rm__rm-h-2a80-fillcure-plus.webp` |
| P2 | R-M FillCURE Plus slow | H 2A81 | Na upit | 1 | `rm__rm-h-2a81-fillcure-plus-slow.webp` |
| P2 | R-M FILLER Harden-R Plus | H 2P80 | Na upit | 1 | `rm__rm-h-2p80-filler-harden-r-plus.webp` |
| P2 | R-M FILLER Harden-R Plus slow | H 2P81 | Na upit | 1 | `rm__rm-h-2p81-filler-harden-r-plus-slow.webp` |
| P2 | R-M MATSHADE Harden-R | H 2P96 | Na upit | 1 | `rm__rm-h-2p96-matshade-harden-r.webp` |
| P2 | R-M GHD PROTECT FILLER HARDENER | H 340 | Na upit | 1 | `rm__rm-h-340-ghd-protect-filler-hardener.webp` |
| P2 | R-M GHD SLOW ACTIVATOR | H 5430 | Na upit | 1 | `rm__rm-h-5430-ghd-slow-activator.webp` |
| P2 | R-M AGILIS Minor Repair | HB 015 | Na upit | 1 | `rm__rm-hb-015-agilis-minor-repair.webp` |
| P2 | R-M Gleam Silver ONYX HD | HB 10S | Na upit | 1 | `rm__rm-hb-10s-gleam-silver-onyx-hd.webp` |
| P2 | R-M ONYX BLENDER PLUS | A 2525 | Na upit | 1 | `rm__rm-onyx-blender-plus.webp` |
| P2 | R-M ONYX HD TROPICAL | ONYX HD TROPICAL | Na upit | 1 | `rm__rm-onyx-hd-tropical.webp` |
| P2 | R-M SpeedFILLER White | P 2A81 | Na upit | 1 | `rm__rm-p-2a81-speedfiller-white.webp` |
| P2 | R-M SpeedFILLER Black | P 2A85 | Na upit | 1 | `rm__rm-p-2a85-speedfiller-black.webp` |
| P2 | R-M GHD SURFACER WHITE | P 5430W | Na upit | 1 | `rm__rm-p-5430w-ghd-surfacer-white.webp` |
| P2 | R-M GHD CHASSISMIX | P 5433 | Na upit | 1 | `rm__rm-p-5433-ghd-chassismix.webp` |
| P2 | R-M GHD MULTI PRIMER FILLER CF | P 5520 | Na upit | 1 | `rm__rm-p-5520-ghd-multi-primer-filler-cf.webp` |
| P2 | R-M GHD PROTECT PRIMER FILLER | P 5540 | Na upit | 1 | `rm__rm-p-5540-ghd-protect-primer-filler.webp` |
| P2 | R-M AirtopTHINN | R 2A20 | Na upit | 1 | `rm__rm-r-2a20-airtopthinn.webp` |
| P2 | R-M CLEAR Thinn-R | R 2P45 | Na upit | 1 | `rm__rm-r-2p45-clear-thinn-r.webp` |
| P2 | R-M AGILIS MIX | RA 040 | Na upit | 1 | `rm__rm-ra-040-agilis-mix.webp` |
| P2 | R-M UNO HD | — | Na upit | 1 | `rm__rm-uno-hd.webp` |

## Norbin — 13 fotografija

Norbin izvor nema slike ni stranice proizvoda. Jedna fotografija po proizvodu; pakovanje je navedeno u tabeli. `N15-020 5 L` je poseban identitet jer 1 L već ima sliku.

### PACKSHOT PAKOVANJA/VARIJANTE (1)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P3 | Norbin N15-020 5 L | N15-020 | 5 L | 1 | `norbin__norbin-n15-020-5l.webp` |

### PACKSHOT PROIZVODA (12)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | Norbin N15-V20 Clear VOC | N15-V20 | 4 L | 1 | `norbin__norbin-n15-v20-clear-voc.webp` |
| P2 | Norbin N15-V25 Fast Clear VOC | N15-V25 | 5 L | 1 | `norbin__norbin-n15-v25-fast-clear-voc.webp` |
| P2 | Norbin N55-015 1K Plastic Primer | N55-015 | 1 L | 1 | `norbin__norbin-n55-015-1k-plastic-primer.webp` |
| P2 | Norbin N55-V20 2K Primer Filler grey | N55-V20 | 2,5 L | 1 | `norbin__norbin-n55-v20-2k-primer-filler-grey.webp` |
| P2 | Norbin N55-V29 2K Primer Filler black | N55-V29 | 2,5 L | 1 | `norbin__norbin-n55-v29-2k-primer-filler-black.webp` |
| P2 | Norbin N60-V20 Multifunctional Body Filler + Hardener | N60-V20 | 0,05 kg | 1 | `norbin__norbin-n60-v20-multifunctional-body-filler-hardener.webp` |
| P2 | Norbin N75-020 Hardener Fast | N75-020 | 0,5 L | 1 | `norbin__norbin-n75-020-hardener-fast.webp` |
| P2 | Norbin N75-021 Hardener Normal | N75-021 | 0,5 L | 1 | `norbin__norbin-n75-021-hardener-normal.webp` |
| P2 | Norbin N75-022 Hardener Slow | N75-022 | 2,5 L | 1 | `norbin__norbin-n75-022-hardener-slow.webp` |
| P2 | Norbin N75-V21 Clear Hardener VOC | N75-V21 | 1 L | 1 | `norbin__norbin-n75-v21-clear-hardener-voc.webp` |
| P2 | Norbin N85-021 Thinner | N85-021 | 1 L | 1 | `norbin__norbin-n85-021-thinner.webp` |
| P2 | Norbin N95-060 Silicone cleaner | N95-060 | 5 L | 1 | `norbin__norbin-n95-060-silicone-cleaner.webp` |

## BEFAR — 7 fotografija

Kartice već imaju packshot; nedostaje samo 7 redova određene boje/dimenzije. Ovo je najniži prioritet (P3): PDP do tada prikazuje sliku kartice.

### SLIKA REDA (boja/dimenzija) (7)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P3 | Befar Carved Velcro Polishing Pad | 05801 | Bela | 1 | `befar__befar-carved-velcro-polishing-pad__05801.webp` |
| P3 | Befar Velcro Polishing Pad | 44805 | Plava · 80 × 25 mm | 1 | `befar__befar-velcro-polishing-pad__44805.webp` |
| P3 | Befar Velcro Polishing Pad | 44806 | Krem · 80 × 25 mm | 1 | `befar__befar-velcro-polishing-pad__44806.webp` |
| P3 | Befar Velcro Polishing Pad | 44807 | Bordo · 80 × 25 mm | 1 | `befar__befar-velcro-polishing-pad__44807.webp` |
| P3 | Befar Waffle Velcro Polishing Pad | 04503 | Crna · 150 × 25 mm | 1 | `befar__befar-waffle-velcro-polishing-pad__04503.webp` |
| P3 | Befar Waffle Velcro Polishing Pad | 448031 | Crna · 80 × 25 mm | 1 | `befar__befar-waffle-velcro-polishing-pad__448031.webp` |
| P3 | Befar Waffle Velcro Polishing Pad | 448061 | Bordo · 80 × 25 mm | 1 | `befar__befar-waffle-velcro-polishing-pad__448061.webp` |

## SATA — 3 fotografija

Samo porodice za koje SATA sliku uopšte NE objavljuje. SATA proizvodi za koje zvanična slika postoji NISU u ovom spisku — oni čekaju odluku o pravima (rights review) i ne treba ih fotografisati sada.

### PACKSHOT KARTICE (1)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | SATAjet 1500 B | 1029562 1029702 1029710 1093575 | — | 4 | `sata__satajet-1500-b.webp` |

### PACKSHOT PROIZVODA (2)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | SATA Release agent spray system | 187740 | Art. 187740 | 1 | `sata__sata-release-agent-spray-system.webp` |
| P2 | SATAjet 3000 B | 190538 | Art. 190538 | 1 | `sata__satajet-3000-b.webp` |

## Predaja

Sve fajlove staviti u jedan folder, bez podfoldera, sa nazivima po pravilu uparivanja iz sekcije „Kako mi dostaviti sliku”. Uvoz u repo (`target_path`) radi se tek posle posebnog odobrenja — ovaj paket ništa ne uvozi.

## Owner Batch 01

`OWNER_SUPPLY_BATCH_01_CANDIDATES.csv` je mali probni krug (15–20 identiteta) za prvi end-to-end test. Ništa se ne pretpostavlja o lageru: u koloni `owner_has_product` upisati `YES`, `NO` ili `NEED_TO_CHECK`; ostale kolone se ne menjaju.
