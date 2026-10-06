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

## baslac — 4 fotografija

Većina proizvoda nema zvaničnu sliku na baslac.com. Linije tonera (Basecoat 45, Basecoat 35, Topcoat 30, Topcoat 30 CV) imaju JEDNU sliku serije: limenke te linije izgledaju isto, razlikuje ih samo oznaka tonera na nalepnici, a zapremina se bira u kartici — ne traži se fotografija po toneru ni po pakovanju. Ostali zapisi su zasebni proizvodi sa svojom šifrom.

### PACKSHOT PROIZVODA (4)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | Baslac 30-S510 | — | Na upit | 1 | `baslac__baslac-30-s510-s-serija.webp` |
| P2 | baslac 50-05 2K Hardener Ambient UC | 50-05 | Na upit | 1 | `baslac__baslac-50-05-2k-hardener-ambient-uc.webp` |
| P2 | baslac 50-530 Ambient Clear Hardener slow | 50-530 | Na upit | 1 | `baslac__baslac-50-530-ambient-clear-hardener-slow.webp` |
| P2 | baslac 80-30 Additive Plast | 80-30 | Na upit | 1 | `baslac__baslac-80-30-additive-plast.webp` |

## R-M — 17 fotografija

R-M (rmpaint.com) za ove proizvode ne objavljuje packshot. Svaka kartica je poseban proizvod sa svojom oznakom (npr. „A 2010”) → jedna fotografija po kartici. Izuzetak su dve grupe istog naziva (GHD THINNER i GHD HARDENER) gde se razlikuje samo oznaka brzine: za njih je dovoljna jedna reprezentativna slika grupe. Katalog pakovanje vodi kao „na upit”; fotografisati pakovanje koje je stvarno na lageru.

### PACKSHOT PROIZVODA (17)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | R-M AGILIS X-TREME | AGILIS X-TREME | Na upit | 1 | `rm__rm-agilis-x-treme.webp` |
| P2 | R-M WHEEL CLEAR COAT | C 2RM2 | Na upit | 1 | `rm__rm-c-2rm2-wheel-clear-coat.webp` |
| P2 | R-M DIAMONT bezbojni lak | — | 1 L | 1 | `rm__rm-diamont-bezbojni-lak.webp` |
| P2 | R-M FillCURE Plus | H 2A80 | Na upit | 1 | `rm__rm-h-2a80-fillcure-plus.webp` |
| P2 | R-M FillCURE Plus slow | H 2A81 | Na upit | 1 | `rm__rm-h-2a81-fillcure-plus-slow.webp` |
| P2 | R-M FILLER Harden-R Plus | H 2P80 | Na upit | 1 | `rm__rm-h-2p80-filler-harden-r-plus.webp` |
| P2 | R-M FILLER Harden-R Plus slow | H 2P81 | Na upit | 1 | `rm__rm-h-2p81-filler-harden-r-plus-slow.webp` |
| P2 | R-M WHEEL CLEAR COAT, HARDENER | H 2RM2 | Na upit | 1 | `rm__rm-h-2rm2-wheel-clear-coat-hardener.webp` |
| P2 | R-M GHD PROTECT FILLER HARDENER | H 340 | Na upit | 1 | `rm__rm-h-340-ghd-protect-filler-hardener.webp` |
| P2 | R-M GHD SLOW ACTIVATOR | H 5430 | Na upit | 1 | `rm__rm-h-5430-ghd-slow-activator.webp` |
| P2 | R-M Gleam Silver ONYX HD | HB 10S | Na upit | 1 | `rm__rm-hb-10s-gleam-silver-onyx-hd.webp` |
| P2 | R-M ONYX BLENDER PLUS | A 2525 | Na upit | 1 | `rm__rm-onyx-blender-plus.webp` |
| P2 | R-M ONYX HD TROPICAL | ONYX HD TROPICAL | Na upit | 1 | `rm__rm-onyx-hd-tropical.webp` |
| P2 | R-M SpeedFILLER White | P 2A81 | Na upit | 1 | `rm__rm-p-2a81-speedfiller-white.webp` |
| P2 | R-M SpeedFILLER Black | P 2A85 | Na upit | 1 | `rm__rm-p-2a85-speedfiller-black.webp` |
| P2 | R-M GHD PROTECT PRIMER FILLER | P 5540 | Na upit | 1 | `rm__rm-p-5540-ghd-protect-primer-filler.webp` |
| P2 | R-M AGILIS MIX | RA 040 | Na upit | 1 | `rm__rm-ra-040-agilis-mix.webp` |

## Norbin — 4 fotografija

Norbin izvor nema slike ni stranice proizvoda. Jedna fotografija po proizvodu; pakovanje je navedeno u tabeli. `N15-020 5 L` je poseban identitet jer 1 L već ima sliku.

### PACKSHOT PROIZVODA (4)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | Norbin N15-V25 Fast Clear VOC | N15-V25 | 5 L | 1 | `norbin__norbin-n15-v25-fast-clear-voc.webp` |
| P2 | Norbin N60-V20 Multifunctional Body Filler + Hardener | N60-V20 | 0,05 kg | 1 | `norbin__norbin-n60-v20-multifunctional-body-filler-hardener.webp` |
| P2 | Norbin N75-022 Hardener Slow | N75-022 | 2,5 L | 1 | `norbin__norbin-n75-022-hardener-slow.webp` |
| P2 | Norbin N95-060 Silicone cleaner | N95-060 | 5 L | 1 | `norbin__norbin-n95-060-silicone-cleaner.webp` |

## SATA — 1 fotografija

Samo porodice za koje SATA sliku uopšte NE objavljuje. SATA proizvodi za koje zvanična slika postoji NISU u ovom spisku — oni čekaju odluku o pravima (rights review) i ne treba ih fotografisati sada.

### PACKSHOT PROIZVODA (1)

| Prioritet | Proizvod | Šifra | Pakovanje / varijanta | Pokriva | Naziv fajla |
|---|---|---|---|---|---|
| P2 | SATA Release agent spray system | 187740 | Art. 187740 | 1 | `sata__sata-release-agent-spray-system.webp` |

## Predaja

Sve fajlove staviti u jedan folder, bez podfoldera, sa nazivima po pravilu uparivanja iz sekcije „Kako mi dostaviti sliku”. Uvoz u repo (`target_path`) radi se tek posle posebnog odobrenja — ovaj paket ništa ne uvozi.

## Owner Batch 01

`OWNER_SUPPLY_BATCH_01_CANDIDATES.csv` je mali probni krug (15–20 identiteta) za prvi end-to-end test. Ništa se ne pretpostavlja o lageru: u koloni `owner_has_product` upisati `YES`, `NO` ili `NEED_TO_CHECK`; ostale kolone se ne menjaju.
