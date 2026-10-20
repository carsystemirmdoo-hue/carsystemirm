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

- C.A.R.FIT Interface Pads i Soft Interface Pads Micro: proizvođač ih vodi u
  poliranju, a opis kaže „rad sa abrazivima“.
- Carsystem Magnetic Sanding Protection: zaštita ivica.
- Mašine za brušenje i Tape Off Tool.

## Tabela

„Šifra (katalog)“ je javna šifra iz kataloga (šifra proizvođača ili naša
kataloška oznaka). Interne BizniSoft šifre nisu u javnom repou.

| Šifra (katalog) | Naziv | Brend | Sadašnja (pre) | Kategorija (posle) | Razlog | Izvor | Nejasnoća |
|---|---|---|---|---|---|---|---|
| 93107 | Befar Backing Pad | befar | pribor | abrazivi | Proizvođač ga vodi u grupi za brušenje; uloga je oslonac ili nošenje abraziva. | Befar katalog: grupa „Sanding Pad Group“ (officialCategories u data/befar-catalog-products.generated.json) |  |
| 91025 | Befar Non Woven Abrasive | befar | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Befar „Sanding Pad Group“ |  |
| 89010 | Befar Sanding Block · Hard Red | befar | pribor | abrazivi | Proizvođač ga vodi u grupi za brušenje; uloga je oslonac ili nošenje abraziva. | Befar katalog: grupa „Sanding Pad Group“ (officialCategories u data/befar-catalog-products.generated.json) |  |
| 88010 | Befar Sanding Block · Soft Orange | befar | pribor | abrazivi | Proizvođač ga vodi u grupi za brušenje; uloga je oslonac ili nošenje abraziva. | Befar katalog: grupa „Sanding Pad Group“ (officialCategories u data/befar-catalog-products.generated.json) |  |
| 93000 | Befar Sanding Pad | befar | pribor | abrazivi | Proizvođač ga vodi u grupi za brušenje; uloga je oslonac ili nošenje abraziva. | Befar katalog: grupa „Sanding Pad Group“ (officialCategories u data/befar-catalog-products.generated.json) |  |
| 78010 | Befar Turkuaz Sanding Block · Blue | befar | pribor | abrazivi | Proizvođač ga vodi u grupi za brušenje; uloga je oslonac ili nošenje abraziva. | Befar katalog: grupa „Sanding Pad Group“ (officialCategories u data/befar-catalog-products.generated.json) |  |
| 6-700-0080 | Car Fit Color Net Disc | carfit | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 5-170-0005 | Car Fit Flat Sanding Block | carfit | pribor | abrazivi | Proizvođač ga vodi među abrazivima; uloga je ručno brušenje sa brusnim papirom ili diskom. | carfitrepair.com: kategorija „Abrasives and sanding“ (officialCategory u data/carfit-catalog-products.generated.json) |  |
| 6-300-0040 | Car Fit Gold Paper Disc | carfit | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 5-170-0001 | Car Fit Hand Sanding Block | carfit | pribor | abrazivi | Proizvođač ga vodi među abrazivima; uloga je ručno brušenje sa brusnim papirom ili diskom. | carfitrepair.com: kategorija „Abrasives and sanding“ (officialCategory u data/carfit-catalog-products.generated.json) |  |
| 5-170-0004 | Car Fit Manual Polishing and Sanding Pad | carfit | pribor | abrazivi | Proizvođač ga vodi među abrazivima; uloga je ručno brušenje sa brusnim papirom ili diskom. | carfitrepair.com: kategorija „Abrasives and sanding“ (officialCategory u data/carfit-catalog-products.generated.json) | Proizvođač ga opisuje i za ručno poliranje; zadržan uz brušenje prema kategoriji proizvođača. |
| 6-510-0040 | Car Fit Purple Ceramic Film | carfit | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 6-500-0040 | Car Fit Red Film Abrasive Discs | carfit | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 5-170-0002 | Car Fit Rubber Sanding Block | carfit | pribor | abrazivi | Proizvođač ga vodi među abrazivima; uloga je ručno brušenje sa brusnim papirom ili diskom. | carfitrepair.com: kategorija „Abrasives and sanding“ (officialCategory u data/carfit-catalog-products.generated.json) |  |
| 5-201-0150 | Car Fit Sanding Control Kit and Sanding Powder | carfit | abrazivi | abrazivi | Kontrolni materijal ili voda za brušenje — koristi se tokom brušenja. | C.A.R.FIT: Paint Related Accessories; po ulozi uz brušenje (kao Carsystem „Schleifen“) |  |
| 5-170-0006 | Car Fit Semi-Round Sanding Block | carfit | pribor | abrazivi | Proizvođač ga vodi među abrazivima; uloga je ručno brušenje sa brusnim papirom ili diskom. | carfitrepair.com: kategorija „Abrasives and sanding“ (officialCategory u data/carfit-catalog-products.generated.json) |  |
| 6-200-0006 | Car Fit Sponge Cut | carfit | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 6-901-0001 | Car Fit Very Fine and Ultra Fine Abrasive Fleece | carfit | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 6-305-0600 | Car Fit Wet Sanding Paper | carfit | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | C.A.R.FIT „Abrasives and sanding“ |  |
| 138.924 | Carsystem Classicline Soft Pad | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 125.779 | Carsystem Control-Spray | carsystem | abrazivi | abrazivi | Kontrolni materijal ili voda za brušenje — koristi se tokom brušenja. | Carsystem „Schleifen“: Schleifkontrolle / Schleifwasser |  |
| 160.183 | Carsystem Double Sanding Soft Pad | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 158.487 | Carsystem Dry Coat 2.0 | carsystem | abrazivi | abrazivi | Kontrolni materijal ili voda za brušenje — koristi se tokom brušenja. | Carsystem „Schleifen“: Schleifkontrolle / Schleifwasser |  |
| 156.570 | Carsystem Excenter Back Pad Multi M | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 156.564 | Carsystem Excenter Back Pad T.19 | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| CS-F19-DISC | Carsystem F19 brusni diskovi | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 140.979 | Carsystem Fine Block | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 144.917 | Carsystem Finish Sander Back Pad | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.677 | Carsystem Grip To Stick Interface Pad | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 156.225 | Carsystem Interface Pad | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 144.768 | Carsystem Mini Back Pad | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 154.099 | Carsystem Pad Saver | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 137.547 | Carsystem Prep & Scuff | carsystem | abrazivi | abrazivi | Pasta/gel za matiranje sa abrazivnim zrnom — zamena za brušenje pre lakiranja, ne pasta za poliranje. | Carsystem „Schleifen“: Mattierungspaste / Mattierungsgel |  |
| 159.696 | Carsystem Prep-Brush | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 155.153 | Carsystem ProFlex Back Pad PSA | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 158.797 | Carsystem ProFlex Callisto – 150 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 158.793 | Carsystem ProFlex Callisto – 33 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 158.795 | Carsystem ProFlex Callisto – 77 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 159.463 | Carsystem ProFlex Hydra – Ø 152 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 159.461 | Carsystem ProFlex Hydra – Ø 75 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 154.295 | Carsystem ProFlex Interface Pad – 150 mm - 15 holes | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 157.137 | Carsystem ProFlex Interface Pad – 30 mm | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 154.296 | Carsystem ProFlex Interface Pad – 75 mm | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.078 | Carsystem ProFlex Interface Pad Finish – 150 mm - 15 holes | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.079 | Carsystem ProFlex Interface Pad Finish – 75 mm | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 154.660 | Carsystem ProFlex Jupiter – 152 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 154.449 | Carsystem ProFlex Jupiter – 152 mm - 15 holes | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 154.444 | Carsystem ProFlex Jupiter – 75 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.509 | Carsystem ProFlex Jupiter Soft – 152 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.522 | Carsystem ProFlex Jupiter Soft – 75 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.515 | Carsystem ProFlex Jupiter Soft H2O – 152 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.524 | Carsystem ProFlex Jupiter Soft H2O – 77 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 154.437 | Carsystem ProFlex Mercury | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.555 | Carsystem ProFlex Mercury Sanding Block | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 153.472 | Carsystem ProFlex Neptune | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 158.097 | Carsystem ProFlex Neptune Pad MaxGrip | carsystem | abrazivi | abrazivi | Ručni pad za ProFlex Neptune abraziv. | Carsystem „Schleifen“: Hand Pad |  |
| 157.791 | Carsystem ProFlex Neptune Soft | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 154.428 | Carsystem ProFlex Pluto | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.557 | Carsystem ProFlex Pluto Sanding Block | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.738 | Carsystem ProFlex Styx | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 160.224 | Carsystem Sanding Block 100 2.0 | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.535 | Carsystem Sanding Block 198 2.0 | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 148.702 | Carsystem Sanding Block 198 Kit | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 160.172 | Carsystem Sanding Block 300 + 100 | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.534 | Carsystem Sanding Block 400 2.0 | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 150.088 | Carsystem Sanding Block 400 Grip Flex | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 151.904 | Carsystem Sanding Block Disc Kit 150 | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 137.439 | Carsystem Sanding Block Grip | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 142.009 | Carsystem Sanding Block Grip Box | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 137.431 | Carsystem Sanding Block Hard | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 156.647 | Carsystem Sanding Disc F.19 – 77 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.904 | Carsystem Sanding Disc F.19 Finish – 77 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.933 | Carsystem Sanding Disc F.19 Soft | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 159.218–159.226 | Carsystem Sanding Disc F.23 Ceramic | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 160.273 | Carsystem Sanding Disc P.25 Ceramic | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.691 | Carsystem Sanding Fleece V.19 – Disc | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.041 | Carsystem Sanding Fleece V.19 – Pad - 115 x 230 mm | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 156.039 | Carsystem Sanding Fleece V.19 – Roll - 115 mm x 10 m | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 159.227 | Carsystem Sanding Strips F.23 Ceramic | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 160.408 | Carsystem Sanding Strips P.25 Ceramic | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 157.446 | Carsystem Sanding Water SW20 | carsystem | abrazivi | abrazivi | Kontrolni materijal ili voda za brušenje — koristi se tokom brušenja. | Carsystem „Schleifen“: Schleifkontrolle / Schleifwasser |  |
| 140.585 | Carsystem Soft Interface Pad | carsystem | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 159.422 | Carsystem Soft-Roll | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 127.999 | Carsystem Stripping Disc | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 152.013 | Carsystem Tape Off Disc Premium | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 151.947 | Carsystem Tec Line Matt Matting Mousse | carsystem | abrazivi | abrazivi | Pasta/gel za matiranje sa abrazivnim zrnom — zamena za brušenje pre lakiranja, ne pasta za poliranje. | Carsystem „Schleifen“: Mattierungspaste / Mattierungsgel |  |
| 152.686 | Carsystem Tec Line Mattflex Pad | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 151.616 | Carsystem Tec Line Mattflex Premium | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 157.438 | Carsystem Tec Line N20 | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 152.983 | Carsystem Tec Line Pro Finish | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 152.689 | Carsystem Tec Line Softflex | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 126.251 | Carsystem Topline Soft Pad | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 136.676 | Carsystem Topline WP S | carsystem | abrazivi | abrazivi | Brusni materijal (disk, list, rolna, traka, runo ili sunđer sa zrnom). | Carsystem „Schleifen“ / officialCategory Abrasives |  |
| 158.291 | RUPES Back Pad | rupes | pribor | abrazivi | Proizvođač ga vodi u kategoriji brušenja; uloga je nošenje ili vođenje abraziva pri brušenju. | https://www.carsystem.org/produkte/kategorie/schleifen (93 artikla, 12 strana, 2026-10-20); officialCategory „Abrasives“ u data/carsystem-catalog-products.generated.json |  |
| 160.108 | Carsystem CORDLESS SANDER CSH-COS01 | carsystem | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| 143.388 | Carsystem Finish Sander RC 9332 | carsystem | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| 143.724 | Carsystem Mini Sanding Machine RC 9330 | carsystem | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| 159.067 | Carsystem Orbital Sander CSH-CMS01 kit | carsystem | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| 133.172 | Carsystem Tape Off Tool | carsystem | oprema | oprema | Nije premešteno. | kategorija proizvođača u sync podacima | Alat (stabschleifer) — Carsystem ga vodi u „Schleifen“; kod nas mašine ostaju u Opremi. |
| LD30 | RUPES Mini Random Orbital Sander LD30 | rupes | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| RE21ALN | RUPES Orbital Sander RE21ALN | rupes | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| SL42AES | RUPES Orbital Sander SL42AES | rupes | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| SLP41A | RUPES Orbital Sander SLP41A | rupes | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| 158.283 | RUPES Random Orbital Sander ER | rupes | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| TA50 | RUPES Random Orbital Sander TA50 | rupes | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| RA75 | RUPES Random Orbital Single-Hand Sander RA75 | rupes | oprema | oprema | Mašina za brušenje — ostaje u Opremi (pištolji i oprema). | https://www.carsystem.org/produkte/kategorie/schleifen | Carsystem mašine za brušenje vodi u „Schleifen“; kod nas su oprema. Odluka o mestu mašina je otvorena. |
| 09400 | Befar Hard Velcro Backing Pad | befar | pribor | poliranje | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 09901 | Befar Leo Detailing Backing Pad | befar | pribor | poliranje | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 09501 | Befar Medium Hard Velcro Backing Pad | befar | pribor | poliranje | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 77776 | Befar Plate Type Felt Backing Pad | befar | pribor | poliranje | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 08401SND | Befar Sandwich Velcro Backing Pad | befar | pribor | poliranje | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 08400 | Befar Soft Velcro Backing Pad | befar | pribor | poliranje | Nosi čičak sunđer ili krzno na polirki — deo programa za poliranje. | Befar katalog: grupa „Backing Pad Group“ (podloške polirke) |  |
| 139.206 | Carsystem Finish Back Pad | carsystem | pribor | poliranje | Podloška polirke — nosi sunđer ili krzno pri poliranju, proizvođač je vodi u završnoj obradi. | https://www.carsystem.org/produkte/kategorie/finish (59 artikala, 8 strana, 2026-10-20); officialCategory „Finish“ |  |
| 160.443 | Carsystem Finish Back Pad M-14 | carsystem | pribor | poliranje | Podloška polirke — nosi sunđer ili krzno pri poliranju, proizvođač je vodi u završnoj obradi. | https://www.carsystem.org/produkte/kategorie/finish (59 artikala, 8 strana, 2026-10-20); officialCategory „Finish“ |  |
| 144.916 | Carsystem Polishing Back Pad | carsystem | pribor | poliranje | Podloška polirke — nosi sunđer ili krzno pri poliranju, proizvođač je vodi u završnoj obradi. | https://www.carsystem.org/produkte/kategorie/finish (59 artikala, 8 strana, 2026-10-20); officialCategory „Finish“ |  |
| 5-170-0014 | Car Fit Interface Pads | carfit | pribor | pribor | Nije premešteno. | kategorija proizvođača u sync podacima | Proizvođač je vodi pod „Polishing Materials“, a opis kaže „rad sa abrazivima“. Ostaje u Priboru dok se ne potvrdi upotreba. |
| 5-102-0005 | Car Fit Soft Interface Pads Micro | carfit | pribor | pribor | Nije premešteno. | kategorija proizvođača u sync podacima | Isto kao Interface Pads: kategorija proizvođača (poliranje) i opis (abrazivi) se ne slažu. |
| 130.992 | Carsystem Magnetic Sanding Protection | carsystem | pribor | pribor | Nije premešteno. | kategorija proizvođača u sync podacima | Zaštita ivica pri brušenju; proizvođač je vodi u „Painting supplies“. Ostaje u Priboru. |
