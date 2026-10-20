# Kategorija „Abrazivi“ — provera i klasifikacija (2026-10-20)

## Referenca

Zvanična Carsystem kategorija „Schleifen“: https://www.carsystem.org/produkte/kategorie/schleifen
— 12 strana, 93 artikla (pregledano 2026-10-20, strane 1–12). Za poređenje i
„Finish“ (poliranje): https://www.carsystem.org/produkte/kategorie/finish — 8 strana, 59 artikala.
Za druge brendove: C.A.R.FIT kategorija „Abrasives and sanding“ (carfitrepair.com)
i Befar grupe „Sanding Pad Group“ / „Backing Pad Group“ (Befar katalog), kako su
sačuvane u `data/*-catalog-products.generated.json`.

## Pravila izvedena iz zvaničnih kategorija

Carsystem u „Schleifen“ drži:
- brusne materijale: filmske, papirne, mrežaste i penaste abrazive, runo
  (Schleifvlies), rolne i trake, mokri brusni papir, disk za grubo čišćenje i disk
  za skidanje nalepnica;
- podloške brusilica (Stützteller), međupodloške (Zwischenpolster, Interface Pad)
  i ručne brusne blokove;
- kontrolne materijale: Control-Spray, Dry Coat 2.0 i vodu za brušenje SW20;
- paste i gel za matiranje (Tec Line Matt Matting Mousse, Prep & Scuff) i
  pripadajuću četku. Ovo su abrazivne paste za matiranje pre lakiranja, ne paste
  za poliranje.

Paste za poliranje (i „Schleifpaste“ za poliranje), sunđeri, krzna, krpe i
podloške polirke su u „Finish“. Kod nas je to kategorija „Poliranje“.

Mašine (brusilice, polirke) ostaju u kategoriji „Oprema“. Carsystem ih deli
između „Schleifen“ i „Finish“, a kod nas je „Oprema“ kategorija za uređaje.

## Pokrivenost

**Carsystem „Schleifen“** je proveren 2026-10-20 i ponovo istog dana: 12 strana,
93 jedinstvena artikla (8 po strani, 5 na 12. strani; sajt navodi „von insgesamt
93“). Svaki od 93 artikla je povezan sa našim katalogom (spisak na kraju):

- 75 je u „Abrazivima“. Jedan od njih je verovatno uparen: Sanding Disc F.19
  150 mm ↔ naš ručni zapis „F19 brusni diskovi“, mera nije potvrđena šifrom.
- 15 mašina i alata je u „Opremi“.
- 1 je uklonjen ranijom odlukom vlasnika (Sanding Disc P.19).
- 2 nemamo u katalogu (WSP.26 i Sanding Disc F.19 Finish 152 mm).

**248 i 124.** Pretraga po ključnim rečima (brušenje, poliranje, disk, pad,
blok, sunđer, pasta, krpa i sl.) dala je 248 kartica iz svih kategorija i brendova.
To je bio spisak kandidata za ručni pregled, ne osnova tabele. Ključne reči nisu
uhvatile sve abrazive (npr. „ProFlex Jupiter“ ne sadrži nijednu od njih), pa je
završna tabela napravljena po pripadnosti, ne po nazivu:

- svi artikli koji su sada u „Abrazivima“: 94 (55 ranijih + 39 premeštenih);
- 9 podloški polirke premeštenih u „Poliranje“;
- 18 mašina i alata koji ostaju u „Opremi“: 15 sa „Schleifen“ i 3 Carsystem
  akumulatorske i pneumatske brusilice iz „Finish“;
- 3 sporna artikla koji ostaju u „Priboru“.

Ukupno 124 reda (zapisi proizvoda; porodica se broji kao jedan zapis). Ostali
kandidati sa spiska od 248 su paste, sunđeri, krzna i krpe za poliranje (81
kartica), krpe za čišćenje, pribor za boje i maskiranje. Pregledani su prema
Carsystem „Finish“ i ostali su gde su bili.

## Šta je promenjeno

48 artikala ima ispravku kategorije u `data/catalog/category-overrides.json`
(razlog i izvor po artiklu). Primenjuje se u `lib/carsystem-data.ts` posle
uvoza, a izvorni sync podaci se ne menjaju. Testovi:
`lib/catalog/categoryOverrides.test.mts` (`npm run test:category-coverage`).

- Carsystem, Befar i C.A.R.FIT: podloške i međupodloške za brušenje i ručni
  brusni blokovi prelaze iz „Pribora“ u „Abrazive“.
- Carsystem i Befar: podloške polirke prelaze iz „Pribora“ u „Poliranje“.

Nijedan artikal nije premešten iz „Abraziva“. Dve paste u abrazivima su paste
za matiranje, a ne za poliranje, i tu ostaju (vidi tabelu).

## Sporno, nije premešteno

| Šifra | Naziv | Kategorija sada | Predlog | Razlog nedoumice |
|---|---|---|---|---|
| 5-170-0014 | C.A.R.FIT Interface Pads (meka međupodloška Ø 150 mm, 15 rupa, 5 i 10 mm) | Pribor | Abrazivi, ako se koristi pri brušenju | carfitrepair.com: „Durable, soft foam for working with C.A.R.FIT abrasives“. U katalogu 2026 je u poglavlju za poliranje (str. 62), uz napomenu da se koristi „uz padove i brusne diskove“. Proizvođač je stavlja u poliranje, a opisuje je za abrazive. |
| 5-102-0005 | C.A.R.FIT Soft Interface Pads Micro (Ø 150 mm, 15 rupa, 5 i 10 mm) | Pribor | isto kao gore | Isti opis i isto mesto u katalogu (str. 62). |
| 130.992 | Carsystem Magnetic Sanding Protection (zaštita ivica) | Pribor | ostaje u Priboru | Carsystem je vodi u „Painting supplies“. Služi da zaštiti susedne delove od brušenja, a ne brusi. |

Mašine i alati za brušenje (sada „Oprema“):

| Šifra | Naziv | Kategorija sada | Carsystem kategorija | Predlog |
|---|---|---|---|---|
| 160.108 | Carsystem CORDLESS SANDER CSH-COS01 | Oprema | Finish | ostaje u Opremi dok se ne odluči |
| 139.653 | Carsystem Excenter Classic | Oprema | Schleifen (str. 11) | ostaje u Opremi dok se ne odluči |
| 143.388 | Carsystem Finish Sander RC 9332 | Oprema | Schleifen (str. 12) | ostaje u Opremi dok se ne odluči |
| 143.724 | Carsystem Mini Sanding Machine RC 9330 | Oprema | Finish | ostaje u Opremi dok se ne odluči |
| 159.067 | Carsystem Orbital Sander CSH-CMS01 kit | Oprema | Finish | ostaje u Opremi dok se ne odluči |
| 142.995 | Carsystem Paint Planer | Oprema | Schleifen (str. 10) | ostaje u Opremi dok se ne odluči |
| 133.172 | Carsystem Tape Off Tool | Oprema | Schleifen (str. 12) | ostaje u Opremi dok se ne odluči |
| 157.318 | RUPES iBrid Nano | Oprema | Schleifen (str. 12) | ostaje u Opremi dok se ne odluči |
| HQM83 | RUPES iBrid Nano Q-MAG | Oprema | Schleifen (str. 12) | ostaje u Opremi dok se ne odluči |
| LD30 | RUPES Mini Random Orbital Sander LD30 | Oprema | Schleifen (str. 11) | ostaje u Opremi dok se ne odluči |
| RE21ALN | RUPES Orbital Sander RE21ALN | Oprema | Schleifen (str. 11) | ostaje u Opremi dok se ne odluči |
| SL42AES | RUPES Orbital Sander SL42AES | Oprema | Schleifen (str. 11) | ostaje u Opremi dok se ne odluči |
| SLP41A | RUPES Orbital Sander SLP41A | Oprema | Schleifen (str. 11) | ostaje u Opremi dok se ne odluči |
| 158.283 | RUPES Random Orbital Sander ER | Oprema | Schleifen (str. 11) | ostaje u Opremi dok se ne odluči |
| TA50 | RUPES Random Orbital Sander TA50 | Oprema | Schleifen (str. 11) | ostaje u Opremi dok se ne odluči |
| RA75 | RUPES Random Orbital Single-Hand Sander RA75 | Oprema | Schleifen (str. 12) | ostaje u Opremi dok se ne odluči |
| 157.326 | RUPES Skorpio E RX | Oprema | Schleifen (str. 11) | ostaje u Opremi dok se ne odluči |
| 157.334 | RUPES Skorpio III RH | Oprema | Schleifen (str. 10) | ostaje u Opremi dok se ne odluči |

Nedoumica za mašine: Carsystem brusilice drži u „Schleifen“, a polirke u
„Finish“. Kod nas je „Oprema“ kategorija za uređaje (pištolji, mašine). Ako mašine
pređu u „Abrazive“, kupac ih nalazi uz brusni materijal, ali se „Oprema“ deli. To
je odluka o strukturi kataloga, ne o pojedinačnom artiklu.

## Carsystem „Schleifen“ — svih 93 artikla

| Str. | Vrsta (Carsystem) | Naziv | Naš zapis | Kod nas |
|---|---|---|---|---|
| 1 | Folienschleifmittel - 150 mm - 25 Loch | Sanding Disc F.23 Ceramic | `carsystem-f23-brusni-diskovi` | abrazivi — ručni zapis „Sanding Disc F.23 Ceramic“, šifre 159.218–159.226 |
| 1 | Folienschleifmittel - 150 mm - 25-Loch | Sanding Disc F.19 | `carsystem-f19-brusni-diskovi` | abrazivi — verovatno: ručni zapis „F19 brusni diskovi“ (P80–P800), mera nije potvrđena šifrom |
| 1 | Folienschleifmittel - 152 mm - Multilochung | Sanding Disc F.19 Soft | `carsystem-sanding-disc-f-19-soft` | abrazivi |
| 1 | Folienschleifmittel - 152 mm - 15-Loch | Sanding Disc F.19 Finish | — | nije u našem katalogu |
| 1 | Folienschleifmittel - 77 mm | Sanding Disc F.19 | `carsystem-sanding-disc-f-19-77-mm` | abrazivi |
| 1 | Folienschleifmittel - 77 mm | Sanding Disc F.19 Finish | `carsystem-sanding-disc-f-19-finish-77-mm` | abrazivi |
| 1 | Papierschleifmittel - 150mm - 25-Loch | Sanding Disc P.25 Ceramic | `carsystem-sanding-disc-p-25-ceramic` | abrazivi |
| 1 | Papierschleifmittel - 150 mm - 25-Loch | Sanding Disc P.19 | `carsystem-p19-brusni-diskovi` | uklonjeno (odluka vlasnika) |
| 2 | Folienschleifmittel - 152 mm - 15-Loch | ProFlex Jupiter | `carsystem-proflex-jupiter-152-mm-15-holes` | abrazivi |
| 2 | Folienschleifmittel - 152 mm | ProFlex Jupiter | `carsystem-proflex-jupiter-152-mm` | abrazivi |
| 2 | Folienschleifmittel - 152 mm - Multilochung | ProFlex Jupiter Soft | `carsystem-proflex-jupiter-soft-152-mm` | abrazivi |
| 2 | Folienschleifmittel - 152 mm - Multilochung | ProFlex Jupiter Soft H2O | `carsystem-proflex-jupiter-soft-h2o-152-mm` | abrazivi |
| 2 | Folienschleifmittel - 75 mm - Multilochung | ProFlex Jupiter Soft | `carsystem-proflex-jupiter-soft-75-mm` | abrazivi |
| 2 | Folienschleifmittel - 75 mm | ProFlex Jupiter | `carsystem-proflex-jupiter-75-mm` | abrazivi |
| 2 | Folienschleifmittel - 77 mm - Multilochung | ProFlex Jupiter Soft H2O | `carsystem-proflex-jupiter-soft-h2o-77-mm` | abrazivi |
| 2 | Schaumschleifmittel - Ø 75 mm | ProFlex Hydra | `carsystem-proflex-hydra-75-mm` | abrazivi |
| 3 | Schaumschleifmittel - Ø 152 mm | ProFlex Hydra | `carsystem-proflex-hydra-152-mm` | abrazivi |
| 3 | Schaumschleifmittel – 150 mm | ProFlex Callisto | `carsystem-proflex-callisto-150-mm` | abrazivi |
| 3 | Schaumschleifmittel - 77 mm | ProFlex Callisto | `carsystem-proflex-callisto-77-mm` | abrazivi |
| 3 | Schaumschleifmittel - 33 mm | ProFlex Callisto | `carsystem-proflex-callisto-33-mm` | abrazivi |
| 3 | Netzschleifmittel - 150 mm | Tec Line Pro Finish | `carsystem-tec-line-pro-finish` | abrazivi |
| 3 | Papierschleifmittel – Rolle – 70 mm x 12 m | Sanding Strips P.25 Ceramic | `carsystem-sanding-strips-p-25-ceramic` | abrazivi |
| 3 | Folienschleifmittel - Rolle - 70 mm x 12 m | Sanding Strips F.23 Ceramic | `carsystem-sanding-strips-f-23-ceramic` | abrazivi |
| 3 | Netzschleifmittel - 70 x 400 mm | Tec Line N20 | `carsystem-tec-line-n20` | abrazivi |
| 4 | Schleifvlies - Rolle - 115 mm x 10 m | Schleifvlies V.19 | `carsystem-sanding-fleece-v-19-roll-115-mm-x-10-m` | abrazivi |
| 4 | Schleifvlies - Pad - 115 x 230 mm | Schleifvlies V.19 | `carsystem-sanding-fleece-v-19-pad-115-x-230-mm` | abrazivi |
| 4 | Schleifvlies - Scheibe | Schleifvlies V.19 | `carsystem-sanding-fleece-v-19-disc` | abrazivi |
| 4 | Schleifvlies - Rolle - 115 mm x 10 m | Tec Line Mattflex Premium | `carsystem-tec-line-mattflex-premium` | abrazivi |
| 4 | Schleifvlies - Pad - 115 x 230 mm | Tec Line Mattflex Pad | `carsystem-tec-line-mattflex-pad` | abrazivi |
| 4 | Papierschleifmittel - Rolle - 115 x 125 mm | Tec Line Softflex | `carsystem-tec-line-softflex` | abrazivi |
| 4 | Papierschleifmittel - Rolle - 115 x 125 mm | Soft-Roll | `carsystem-soft-roll` | abrazivi |
| 4 | Schaumstoffschleifmittel - 120 x 98 x 13 mm | Double Sanding Soft Pad | `carsystem-double-sanding-soft-pad` | abrazivi |
| 5 | Schaumstoffschleifmittel - 140 x 115 mm | Classicline Soft Pad | `carsystem-classicline-soft-pad` | abrazivi |
| 5 | Schaumstoffschleifmittel - 140 x 115 mm | Topline Soft Pad | `carsystem-topline-soft-pad` | abrazivi |
| 5 | Folienschleifmittel - 130 x 170 mm | ProFlex Neptune | `carsystem-proflex-neptune` | abrazivi |
| 5 | Folienschleifmittel - 130 x 85 mm - Multilochung | ProFlex Neptune Soft | `carsystem-proflex-neptune-soft` | abrazivi |
| 5 | Folienschleifmittel - 29 x 35 mm | ProFlex Mercury | `carsystem-proflex-mercury` | abrazivi |
| 5 | Folienschleifmittel - Ø 34 mm | ProFlex Pluto | `carsystem-proflex-pluto` | abrazivi |
| 5 | Schleifmittel - Ø 32 mm | ProFlex Styx | `carsystem-proflex-styx` | abrazivi |
| 5 | Nassschleifpapier - 230 x 280 mm | WSP.26 | — | nije u našem katalogu |
| 6 | Papierschleifmittel - 230 x 280 mm | Topline WP S | `carsystem-topline-wp-s` | abrazivi |
| 6 | Grobreinigungsscheibe | Stripping Disc | `carsystem-stripping-disc` | abrazivi |
| 6 | Folienradierer | Tape Off Disc Premium | `carsystem-tape-off-disc-premium` | abrazivi |
| 6 | Schleifwasser | Schleifwasser SW20 | `carsystem-sanding-water-sw20` | abrazivi |
| 6 | Stützteller - 150 mm | Excenter Back Pad T.19 | `carsystem-excenter-back-pad-t-19` | abrazivi |
| 6 | Stützteller, 150 mm | RUPES Back Pad | `carsystem-rupes-back-pad` | abrazivi |
| 6 | Stützteller - 150 mm | Excenter Back Pad Multi M | `carsystem-excenter-back-pad-multi-m` | abrazivi |
| 6 | Stützteller - 77 mm | Finish Sander Back Pad | `carsystem-finish-sander-back-pad` | abrazivi |
| 7 | Stützteller - 30 mm | ProFlex Back Pad 30 mm PSA | `carsystem-proflex-back-pad-psa` | abrazivi |
| 7 | Stützteller | Mini Back Pad | `carsystem-mini-back-pad` | abrazivi |
| 7 | Zwischenpolster - 150 mm | Interface Pad | `carsystem-interface-pad` | abrazivi |
| 7 | Zwischenpolster - 150 mm | Soft Interface Pad | `carsystem-soft-interface-pad` | abrazivi |
| 7 | Interface Pad - 150 mm - 15 Loch | ProFlex Interface Pad Finish | `carsystem-proflex-interface-pad-finish-150-mm-15-holes` | abrazivi |
| 7 | Interface Pad - 75 mm | ProFlex Interface Pad Finish | `carsystem-proflex-interface-pad-finish-75-mm` | abrazivi |
| 7 | Zwischenpolster - 150 mm - 15-Loch | ProFlex Interface Pad | `carsystem-proflex-interface-pad-150-mm-15-holes` | abrazivi |
| 7 | Zwischenpolster - 75 mm | ProFlex Interface Pad | `carsystem-proflex-interface-pad-75-mm` | abrazivi |
| 8 | Zwischenpolster - 30 mm | ProFlex Interface Pad | `carsystem-proflex-interface-pad-30-mm` | abrazivi |
| 8 | Zwischenpolster - 150 mm | Pad Saver | `carsystem-pad-saver` | abrazivi |
| 8 | Zwischenpolster - Ø 30 mm | Grip To Stick Interface Pad | `carsystem-grip-to-stick-interface-pad` | abrazivi |
| 8 | Hand Pad - 120 x 75 x 6 mm - Multilochung | ProFlex Neptune Pad Max Grip | `carsystem-proflex-neptune-pad-maxgrip` | abrazivi |
| 8 | Handschleifklotz - kletthaftend | Sanding Block 400 Grip Flex | `carsystem-sanding-block-400-grip-flex` | abrazivi |
| 8 | Handschleifklotz - kletthaftend | Sanding Block 400 2.0 | `carsystem-sanding-block-400-2-0` | abrazivi |
| 8 | Handschleifklotz – kletthaftend | Sanding Block 300 + 100 | `carsystem-sanding-block-300-100` | abrazivi |
| 8 | Handschleifklotz - kletthaftend | Sanding Block 198 2.0 | `carsystem-sanding-block-198-2-0` | abrazivi |
| 9 | Handschleifklotz Kit - kletthaftend | Sanding Block 198 Kit | `carsystem-sanding-block-198-kit` | abrazivi |
| 9 | Handschleifklotz Kit - kletthaftend | Sanding Block Disc Kit 150 | `carsystem-sanding-block-disc-kit-150` | abrazivi |
| 9 | Handschleifklotz – kletthaftend | Sanding Block 100 2.0 | `carsystem-sanding-block-100-2-0` | abrazivi |
| 9 | Handschleifblock - kletthaftend | Sanding Block Grip | `carsystem-sanding-block-grip` | abrazivi |
| 9 | Handschleifblock - kletthaftend | Sanding Block Grip Box | `carsystem-sanding-block-grip-box` | abrazivi |
| 9 | Handschleifklotz - hart | Sanding Block Hard | `carsystem-sanding-block-hard` | abrazivi |
| 9 | Schleifblock | ProFlex Pluto Sanding Block | `carsystem-proflex-pluto-sanding-block` | abrazivi |
| 9 | Schleifblock - 27 x 33 x 15 mm | ProFlex Mercury Sanding Block | `carsystem-proflex-mercury-sanding-block` | abrazivi |
| 10 | Feinschleifklotz | Fine Block | `carsystem-fine-block` | abrazivi |
| 10 | Lackhobel und Halter | Paint Planer | `carsystem-paint-planer` | oprema |
| 10 | Schleifkontroll System | Dry Coat 2.0 | `carsystem-dry-coat-2-0` | abrazivi |
| 10 | Schleifkontrollspray | Control-Spray | `carsystem-control-spray` | abrazivi |
| 10 | Mattierungspaste | Tec Line Matt Matting Mousse | `carsystem-tec-line-matt-matting-mousse` | abrazivi |
| 10 | Mattierungsgel | Prep & Scuff | `carsystem-prep-scuff` | abrazivi |
| 10 | Spezialpinsel | Prep-Brush | `carsystem-prep-brush` | abrazivi |
| 10 | Exzenterschleifer, pneumatisch | RUPES Skorpio III RH | `carsystem-rupes-skorpio-iii-rh` | oprema |
| 11 | Blütenschleifer, pneumatisch | RUPES Blütenschleifer LD30 | `carsystem-rupes-mini-random-orbital-sander-ld30` | oprema |
| 11 | Exzenterschleifer, elektrisch | RUPES Skorpio E RX | `carsystem-rupes-skorpio-e-rx` | oprema |
| 11 | Exzenterschleifer, pneumatisch | RUPES Exzenterschleifer TA50 | `carsystem-rupes-random-orbital-sander-ta50` | oprema |
| 11 | Exzenterschleifer, pneumatisch | Excenter Classic | `carsystem-excenter-classic` | oprema |
| 11 | Schwingschleifer, elektrisch | RUPES Schwingschleifer SL42AES | `carsystem-rupes-orbital-sander-sl42aes` | oprema |
| 11 | Schwingschleifer, pneumatisch | RUPES Schwingschleifer SLP41A | `carsystem-rupes-orbital-sander-slp41a` | oprema |
| 11 | Schwingschleifer, pneumatisch | RUPES Schwingschleifer RE21ALN | `carsystem-rupes-orbital-sander-re21aln` | oprema |
| 11 | Exzenterschleifer, elektrisch | RUPES Exzenterschleifer ER | `carsystem-rupes-random-orbital-sander-er` | oprema |
| 12 | Exzenterschleifer, pneumatisch | RUPES Einhand-Exzenterschleifer RA75 | `carsystem-rupes-random-orbital-single-hand-sander-ra75` | oprema |
| 12 | Exzenterschleifer 75 mm, pneumatisch | Finish Sander RC 9332 | `carsystem-finish-sander-rc-9332` | oprema |
| 12 | Akku Schleif- und Poliermaschine | RUPES Ibrid Nano | `carsystem-rupes-ibrid-nano` | oprema |
| 12 | Akku Schleif- und Poliermaschine | RUPES Ibrid Nano Q-MAQ | `carsystem-rupes-ibrid-nano-q-maq` | oprema |
| 12 | Stabschleifer | Tape Off Tool | `carsystem-tape-off-tool` | oprema |

## Tabela

„Šifra (katalog)“ je javna šifra iz kataloga (šifra proizvođača ili naša
kataloška oznaka). Interne BizniSoft šifre nisu u javnom repou.

| Šifra (katalog) | Naziv | Brend | Sadašnja (pre) | Kategorija (posle) | Carsystem „Schleifen“ | Razlog | Izvor | Nejasnoća |
|---|---|---|---|---|---|---|---|---|
| 93107 | Befar Backing Pad | befar | pribor | abrazivi | — | Proizvođač ga vodi u grupi za brušenje; uloga je oslonac ili nošenje abraziva. | Befar katalog: grupa „Sanding Pad Group“ (officialCategories u data/befar-catalog-products.generated.json) |  |
| 91025 | Befar Non Woven Abrasive | befar | abrazivi | abrazivi | — | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Befar „Sanding Pad Group“ |  |
| 89010 | Befar Sanding Block · Hard Red | befar | pribor | abrazivi | — | Proizvođač ga vodi u grupi za brušenje; uloga je oslonac ili nošenje abraziva. | Befar katalog: grupa „Sanding Pad Group“ (officialCategories u data/befar-catalog-products.generated.json) |  |
| 88010 | Befar Sanding Block · Soft Orange | befar | pribor | abrazivi | — | Proizvođač ga vodi u grupi za brušenje; uloga je oslonac ili nošenje abraziva. | Befar katalog: grupa „Sanding Pad Group“ (officialCategories u data/befar-catalog-products.generated.json) |  |
| 93000 | Befar Sanding Pad | befar | pribor | abrazivi | — | Proizvođač ga vodi u grupi za brušenje; uloga je oslonac ili nošenje abraziva. | Befar katalog: grupa „Sanding Pad Group“ (officialCategories u data/befar-catalog-products.generated.json) |  |
| 78010 | Befar Turkuaz Sanding Block · Blue | befar | pribor | abrazivi | — | Proizvođač ga vodi u grupi za brušenje; uloga je oslonac ili nošenje abraziva. | Befar katalog: grupa „Sanding Pad Group“ (officialCategories u data/befar-catalog-products.generated.json) |  |
| 6-700-0080 | Car Fit Color Net Disc | carfit | abrazivi | abrazivi | — | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 5-170-0005 | Car Fit Flat Sanding Block | carfit | pribor | abrazivi | — | Proizvođač ga vodi među abrazivima; uloga je ručno brušenje sa brusnim papirom ili diskom. | carfitrepair.com: kategorija „Abrasives and sanding“ (officialCategory u data/carfit-catalog-products.generated.json) |  |
| 6-300-0040 | Car Fit Gold Paper Disc | carfit | abrazivi | abrazivi | — | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 5-170-0001 | Car Fit Hand Sanding Block | carfit | pribor | abrazivi | — | Proizvođač ga vodi među abrazivima; uloga je ručno brušenje sa brusnim papirom ili diskom. | carfitrepair.com: kategorija „Abrasives and sanding“ (officialCategory u data/carfit-catalog-products.generated.json) |  |
| 5-170-0004 | Car Fit Manual Polishing and Sanding Pad | carfit | pribor | abrazivi | — | Proizvođač ga vodi među abrazivima; uloga je ručno brušenje sa brusnim papirom ili diskom. | carfitrepair.com: kategorija „Abrasives and sanding“ (officialCategory u data/carfit-catalog-products.generated.json) | Proizvođač ga opisuje i za ručno poliranje; zadržan uz brušenje prema kategoriji proizvođača. |
| 6-510-0040 | Car Fit Purple Ceramic Film | carfit | abrazivi | abrazivi | — | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 6-500-0040 | Car Fit Red Film Abrasive Discs | carfit | abrazivi | abrazivi | — | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 5-170-0002 | Car Fit Rubber Sanding Block | carfit | pribor | abrazivi | — | Proizvođač ga vodi među abrazivima; uloga je ručno brušenje sa brusnim papirom ili diskom. | carfitrepair.com: kategorija „Abrasives and sanding“ (officialCategory u data/carfit-catalog-products.generated.json) |  |
| 5-201-0150 | Car Fit Sanding Control Kit and Sanding Powder | carfit | abrazivi | abrazivi | — | Kontrolni materijal ili voda za brušenje — koristi se tokom brušenja. | C.A.R.FIT: Paint Related Accessories; po ulozi uz brušenje (kao Carsystem „Schleifen“) |  |
| 5-170-0006 | Car Fit Semi-Round Sanding Block | carfit | pribor | abrazivi | — | Proizvođač ga vodi među abrazivima; uloga je ručno brušenje sa brusnim papirom ili diskom. | carfitrepair.com: kategorija „Abrasives and sanding“ (officialCategory u data/carfit-catalog-products.generated.json) |  |
| 6-200-0006 | Car Fit Sponge Cut | carfit | abrazivi | abrazivi | — | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 6-901-0001 | Car Fit Very Fine and Ultra Fine Abrasive Fleece | carfit | abrazivi | abrazivi | — | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 6-305-0600 | Car Fit Wet Sanding Paper | carfit | abrazivi | abrazivi | — | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 138.924 | Carsystem Classicline Soft Pad | carsystem | abrazivi | abrazivi | str. 5 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 125.779 | Carsystem Control-Spray | carsystem | abrazivi | abrazivi | str. 10 | Kontrolni materijal ili voda za brušenje — koristi se tokom brušenja. | Carsystem „Schleifen“: Schleifkontrolle / Schleifwasser |  |
| 160.183 | Carsystem Double Sanding Soft Pad | carsystem | abrazivi | abrazivi | str. 4 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 158.487 | Carsystem Dry Coat 2.0 | carsystem | abrazivi | abrazivi | str. 10 | Kontrolni materijal ili voda za brušenje — koristi se tokom brušenja. | Carsystem „Schleifen“: Schleifkontrolle / Schleifwasser |  |
| 156.570 | Carsystem Excenter Back Pad Multi M | carsystem | pribor | abrazivi | str. 6 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 156.564 | Carsystem Excenter Back Pad T.19 | carsystem | pribor | abrazivi | str. 6 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| CS-F19-DISC | Carsystem F19 brusni diskovi | carsystem | abrazivi | abrazivi | str. 1 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives | verovatno: ručni zapis „F19 brusni diskovi“ (P80–P800), mera nije potvrđena šifrom |
| 140.979 | Carsystem Fine Block | carsystem | pribor | abrazivi | str. 10 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 144.917 | Carsystem Finish Sander Back Pad | carsystem | pribor | abrazivi | str. 6 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.677 | Carsystem Grip To Stick Interface Pad | carsystem | pribor | abrazivi | str. 8 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 156.225 | Carsystem Interface Pad | carsystem | pribor | abrazivi | str. 7 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 144.768 | Carsystem Mini Back Pad | carsystem | pribor | abrazivi | str. 7 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 154.099 | Carsystem Pad Saver | carsystem | pribor | abrazivi | str. 8 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 137.547 | Carsystem Prep & Scuff | carsystem | abrazivi | abrazivi | str. 10 | Pasta/gel za matiranje sa abrazivnim zrnom — zamena za brušenje pre lakiranja, ne pasta za poliranje. | Carsystem „Schleifen“: Mattierungspaste / Mattierungsgel |  |
| 159.696 | Carsystem Prep-Brush | carsystem | pribor | abrazivi | str. 10 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 155.153 | Carsystem ProFlex Back Pad PSA | carsystem | pribor | abrazivi | str. 7 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 158.797 | Carsystem ProFlex Callisto – 150 mm | carsystem | abrazivi | abrazivi | str. 3 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 158.793 | Carsystem ProFlex Callisto – 33 mm | carsystem | abrazivi | abrazivi | str. 3 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 158.795 | Carsystem ProFlex Callisto – 77 mm | carsystem | abrazivi | abrazivi | str. 3 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 159.463 | Carsystem ProFlex Hydra – Ø 152 mm | carsystem | abrazivi | abrazivi | str. 3 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 159.461 | Carsystem ProFlex Hydra – Ø 75 mm | carsystem | abrazivi | abrazivi | str. 2 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 154.295 | Carsystem ProFlex Interface Pad – 150 mm - 15 holes | carsystem | pribor | abrazivi | str. 7 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 157.137 | Carsystem ProFlex Interface Pad – 30 mm | carsystem | pribor | abrazivi | str. 8 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 154.296 | Carsystem ProFlex Interface Pad – 75 mm | carsystem | pribor | abrazivi | str. 7 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.078 | Carsystem ProFlex Interface Pad Finish – 150 mm - 15 holes | carsystem | pribor | abrazivi | str. 7 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.079 | Carsystem ProFlex Interface Pad Finish – 75 mm | carsystem | pribor | abrazivi | str. 7 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 154.660 | Carsystem ProFlex Jupiter – 152 mm | carsystem | abrazivi | abrazivi | str. 2 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 154.449 | Carsystem ProFlex Jupiter – 152 mm - 15 holes | carsystem | abrazivi | abrazivi | str. 2 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 154.444 | Carsystem ProFlex Jupiter – 75 mm | carsystem | abrazivi | abrazivi | str. 2 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.509 | Carsystem ProFlex Jupiter Soft – 152 mm | carsystem | abrazivi | abrazivi | str. 2 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.522 | Carsystem ProFlex Jupiter Soft – 75 mm | carsystem | abrazivi | abrazivi | str. 2 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.515 | Carsystem ProFlex Jupiter Soft H2O – 152 mm | carsystem | abrazivi | abrazivi | str. 2 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.524 | Carsystem ProFlex Jupiter Soft H2O – 77 mm | carsystem | abrazivi | abrazivi | str. 2 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 154.437 | Carsystem ProFlex Mercury | carsystem | abrazivi | abrazivi | str. 5 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.555 | Carsystem ProFlex Mercury Sanding Block | carsystem | pribor | abrazivi | str. 9 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 153.472 | Carsystem ProFlex Neptune | carsystem | abrazivi | abrazivi | str. 5 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 158.097 | Carsystem ProFlex Neptune Pad MaxGrip | carsystem | abrazivi | abrazivi | str. 8 | Ručni pad za ProFlex Neptune abraziv. | Carsystem „Schleifen“: Hand Pad |  |
| 157.791 | Carsystem ProFlex Neptune Soft | carsystem | abrazivi | abrazivi | str. 5 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 154.428 | Carsystem ProFlex Pluto | carsystem | abrazivi | abrazivi | str. 5 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.557 | Carsystem ProFlex Pluto Sanding Block | carsystem | pribor | abrazivi | str. 9 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.738 | Carsystem ProFlex Styx | carsystem | abrazivi | abrazivi | str. 5 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 160.224 | Carsystem Sanding Block 100 2.0 | carsystem | pribor | abrazivi | str. 9 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.535 | Carsystem Sanding Block 198 2.0 | carsystem | pribor | abrazivi | str. 8 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 148.702 | Carsystem Sanding Block 198 Kit | carsystem | pribor | abrazivi | str. 9 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 160.172 | Carsystem Sanding Block 300 + 100 | carsystem | pribor | abrazivi | str. 8 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.534 | Carsystem Sanding Block 400 2.0 | carsystem | pribor | abrazivi | str. 8 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 150.088 | Carsystem Sanding Block 400 Grip Flex | carsystem | pribor | abrazivi | str. 8 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 151.904 | Carsystem Sanding Block Disc Kit 150 | carsystem | pribor | abrazivi | str. 9 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 137.439 | Carsystem Sanding Block Grip | carsystem | pribor | abrazivi | str. 9 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 142.009 | Carsystem Sanding Block Grip Box | carsystem | pribor | abrazivi | str. 9 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 137.431 | Carsystem Sanding Block Hard | carsystem | pribor | abrazivi | str. 9 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 156.647 | Carsystem Sanding Disc F.19 – 77 mm | carsystem | abrazivi | abrazivi | str. 1 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.904 | Carsystem Sanding Disc F.19 Finish – 77 mm | carsystem | abrazivi | abrazivi | str. 1 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.933 | Carsystem Sanding Disc F.19 Soft | carsystem | abrazivi | abrazivi | str. 1 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 159.218–159.226 | Carsystem Sanding Disc F.23 Ceramic | carsystem | abrazivi | abrazivi | str. 1 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives | ručni zapis „Sanding Disc F.23 Ceramic“, šifre 159.218–159.226 |
| 160.273 | Carsystem Sanding Disc P.25 Ceramic | carsystem | abrazivi | abrazivi | str. 1 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.691 | Carsystem Sanding Fleece V.19 – Disc | carsystem | abrazivi | abrazivi | str. 4 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.041 | Carsystem Sanding Fleece V.19 – Pad - 115 x 230 mm | carsystem | abrazivi | abrazivi | str. 4 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.039 | Carsystem Sanding Fleece V.19 – Roll - 115 mm x 10 m | carsystem | abrazivi | abrazivi | str. 4 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 159.227 | Carsystem Sanding Strips F.23 Ceramic | carsystem | abrazivi | abrazivi | str. 3 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 160.408 | Carsystem Sanding Strips P.25 Ceramic | carsystem | abrazivi | abrazivi | str. 3 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 157.446 | Carsystem Sanding Water SW20 | carsystem | abrazivi | abrazivi | str. 6 | Kontrolni materijal ili voda za brušenje — koristi se tokom brušenja. | Carsystem „Schleifen“: Schleifkontrolle / Schleifwasser |  |
| 140.585 | Carsystem Soft Interface Pad | carsystem | pribor | abrazivi | str. 7 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.422 | Carsystem Soft-Roll | carsystem | abrazivi | abrazivi | str. 4 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 127.999 | Carsystem Stripping Disc | carsystem | abrazivi | abrazivi | str. 6 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 152.013 | Carsystem Tape Off Disc Premium | carsystem | abrazivi | abrazivi | str. 6 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 151.947 | Carsystem Tec Line Matt Matting Mousse | carsystem | abrazivi | abrazivi | str. 10 | Pasta/gel za matiranje sa abrazivnim zrnom — zamena za brušenje pre lakiranja, ne pasta za poliranje. | Carsystem „Schleifen“: Mattierungspaste / Mattierungsgel |  |
| 152.686 | Carsystem Tec Line Mattflex Pad | carsystem | abrazivi | abrazivi | str. 4 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 151.616 | Carsystem Tec Line Mattflex Premium | carsystem | abrazivi | abrazivi | str. 4 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 157.438 | Carsystem Tec Line N20 | carsystem | abrazivi | abrazivi | str. 3 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 152.983 | Carsystem Tec Line Pro Finish | carsystem | abrazivi | abrazivi | str. 3 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 152.689 | Carsystem Tec Line Softflex | carsystem | abrazivi | abrazivi | str. 4 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 126.251 | Carsystem Topline Soft Pad | carsystem | abrazivi | abrazivi | str. 5 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 136.676 | Carsystem Topline WP S | carsystem | abrazivi | abrazivi | str. 6 | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 158.291 | RUPES Back Pad | rupes | pribor | abrazivi | str. 6 | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 160.108 | Carsystem CORDLESS SANDER CSH-COS01 | carsystem | oprema | oprema | — | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/finish | Carsystem je vodi u „Finish“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 139.653 | Carsystem Excenter Classic | carsystem | oprema | oprema | str. 11 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 143.388 | Carsystem Finish Sander RC 9332 | carsystem | oprema | oprema | str. 12 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 143.724 | Carsystem Mini Sanding Machine RC 9330 | carsystem | oprema | oprema | — | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/finish | Carsystem je vodi u „Finish“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 159.067 | Carsystem Orbital Sander CSH-CMS01 kit | carsystem | oprema | oprema | — | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/finish | Carsystem je vodi u „Finish“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 142.995 | Carsystem Paint Planer | carsystem | oprema | oprema | str. 10 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 133.172 | Carsystem Tape Off Tool | carsystem | oprema | oprema | str. 12 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 157.318 | RUPES iBrid Nano | rupes | oprema | oprema | str. 12 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| HQM83 | RUPES iBrid Nano Q-MAG | rupes | oprema | oprema | str. 12 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| LD30 | RUPES Mini Random Orbital Sander LD30 | rupes | oprema | oprema | str. 11 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| RE21ALN | RUPES Orbital Sander RE21ALN | rupes | oprema | oprema | str. 11 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| SL42AES | RUPES Orbital Sander SL42AES | rupes | oprema | oprema | str. 11 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| SLP41A | RUPES Orbital Sander SLP41A | rupes | oprema | oprema | str. 11 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 158.283 | RUPES Random Orbital Sander ER | rupes | oprema | oprema | str. 11 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| TA50 | RUPES Random Orbital Sander TA50 | rupes | oprema | oprema | str. 11 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| RA75 | RUPES Random Orbital Single-Hand Sander RA75 | rupes | oprema | oprema | str. 12 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 157.326 | RUPES Skorpio E RX | rupes | oprema | oprema | str. 11 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 157.334 | RUPES Skorpio III RH | rupes | oprema | oprema | str. 10 | Mašina ili alat — ostaje u Opremi. | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem je vodi u „Schleifen“; kod nas su uređaji u Opremi. Mesto mašina čeka odluku. |
| 09400 | Befar Hard Velcro Backing Pad | befar | pribor | poliranje | — | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 09901 | Befar Leo Detailing Backing Pad | befar | pribor | poliranje | — | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 09501 | Befar Medium Hard Velcro Backing Pad | befar | pribor | poliranje | — | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 77776 | Befar Plate Type Felt Backing Pad | befar | pribor | poliranje | — | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 08401SND | Befar Sandwich Velcro Backing Pad | befar | pribor | poliranje | — | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 08400 | Befar Soft Velcro Backing Pad | befar | pribor | poliranje | — | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 139.206 | Carsystem Finish Back Pad | carsystem | pribor | poliranje | — | Podloška polirke — nosi sunđer ili krzno pri poliranju, proizvođač je vodi u završnoj obradi. | https://www.carsystem.org/produkte/kategorie/finish (59 artikala, 8 strana, 2026-10-20); officialCategory „Finish“ |  |
| 160.443 | Carsystem Finish Back Pad M-14 | carsystem | pribor | poliranje | — | Podloška polirke — nosi sunđer ili krzno pri poliranju, proizvođač je vodi u završnoj obradi. | https://www.carsystem.org/produkte/kategorie/finish (59 artikala, 8 strana, 2026-10-20); officialCategory „Finish“ |  |
| 144.916 | Carsystem Polishing Back Pad | carsystem | pribor | poliranje | — | Podloška polirke — nosi sunđer ili krzno pri poliranju, proizvođač je vodi u završnoj obradi. | https://www.carsystem.org/produkte/kategorie/finish (59 artikala, 8 strana, 2026-10-20); officialCategory „Finish“ |  |
| 5-170-0014 | Car Fit Interface Pads | carfit | pribor | pribor | — | Nije premešteno. | kategorija proizvođača u sync podacima | Proizvođač je vodi pod „Polishing Materials“, a opis kaže „rad sa abrazivima“. Ostaje u Priboru dok se ne potvrdi upotreba. |
| 5-102-0005 | Car Fit Soft Interface Pads Micro | carfit | pribor | pribor | — | Nije premešteno. | kategorija proizvođača u sync podacima | Isto kao Interface Pads: kategorija proizvođača (poliranje) i opis (abrazivi) se ne slažu. |
| 130.992 | Carsystem Magnetic Sanding Protection | carsystem | pribor | pribor | — | Nije premešteno. | kategorija proizvođača u sync podacima | Zaštita ivica pri brušenju; proizvođač je vodi u „Painting supplies“. Ostaje u Priboru. |
