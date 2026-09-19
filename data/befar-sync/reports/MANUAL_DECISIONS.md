# Befar sync — odluke za vlasnika

Stanje posle `npm run befar:sync`. Ništa od navedenog ne blokira paritet (56/56 porodica, 185/185 šifara); ovo su mesta na kojima izvor nije jednoznačan ili odluka pripada vlasniku.

## 1. Konflikti izvora (7)

| Tip | Šifra | Nalaz | Primenjeno pravilo |
| --- | --- | --- | --- |
| `SAME_CODES_DIFFERENT_TITLES` | 59507ADV | Leo Premium Advance With Applicator Compounding Pad ↔ Leo Plus Advance with Applicator Compounding Pad (aplikatörlü-polisaj-süngerleri#1, leo-ürün-serisi#9) | isti skup šifara = isti proizvod; naziv: „Leo Premium Advance With Applicator Compounding Pad” |
| `SAME_CODES_DIFFERENT_TITLES` | 05712 | Leo Mini Detailing Cleaning Set ↔ Leo Mini Cleaning Set (diğer-ürünler#3, set-grubu#3) | isti skup šifara = isti proizvod; naziv: „Leo Mini Detailing Cleaning Set” |
| `SAME_CODES_DIFFERENT_TITLES` | 09901 | Leo Detailing Pad ↔ Leo Detailing Backing Pad (leo-ürün-serisi#3, taban-grubu#1) | isti skup šifara = isti proizvod; naziv: „Leo Detailing Backing Pad” |
| `SAME_CODES_DIFFERENT_QUALIFIER` | 93107 | Backing Pad: zımpara-grubu#2 „SOFT” ↔ zımpara-grubu#3 „HARD” | isti skup šifara naveden dvaput sa različitom oznakom tvrdoće; šifre su jedan proizvod, a oznaka se NE prenosi u naziv dok je proizvođač ne uskladi |
| `EN_TITLE_DUPLICATED_TR_TITLE_DIFFERS` | 55401ADV | EN „Leo Premium Advance Velcro Compounding Pad” stoji uz dva proizvoda; TR „Leo Plus Advance Cırtlı Polisaj Süngeri” | naziv prema turskom originalu: „Leo Plus Advance Velcro Compounding Pad” |
| `WEBSITE_VS_CATALOGUE_DIMENSION` | 91030 | sajt „15x25cm” ↔ katalog str. 28 „150 x 220 mm” | merodavan je aktuelni sajt; vrednost iz kataloga ostaje zabeležena uz varijantu |
| `WEBSITE_VS_CATALOGUE_DIMENSION` | 87101 | sajt „117x75mm” ↔ katalog str. 31 „115 x 75 mm” | merodavan je aktuelni sajt; vrednost iz kataloga ostaje zabeležena uz varijantu |

## 2. Zatečeni ručni Befar zapisi (8) — `PROBABLE_MATCH`

Ručni zapisi nemaju šifru proizvođača, a njihova boja i dimenzija odgovaraju više zvaničnih porodica. Nisu spojeni ni obrisani; zvanični proizvodi su uvezeni zasebno. Za spajanje upisati odluku u `data/befar-sync/manual-decisions.json` (`local.<slug>.sourceKey`).

| Ručni zapis | Mogući zvanični proizvod (šifra) | Zašto samo PROBABLE | Rizik duplikata za kupca |
| --- | --- | --- | --- |
| `befar-sundjer-narandzasti-25x150` | Befar Plus Velcro Polishing Pad (54402), Velcro Polishing Pad (04402), Waffle Velcro Polishing Pad (04502) | narandžasta + 150 × 25 mm postoji u 3 porodice; ručni zapis nema šifru ni profil (ravan/vafl/Plus) | HIGH |
| `befar-sundjer-narandzasti-50x150` | Befar Plus With Applicator Compounding Pad (52402), Leo Plus Advance Velcro (55402ADV), Leo Plus Advance with Applicator (52402ADV) | narandžasta + 150 × 50 mm u 3 porodice; ne zna se čičak ili navoj (aplikator) ni linija | MEDIUM |
| `befar-sundjer-crni-25x150` | Velcro Polishing Pad (04403), Waffle Velcro Polishing Pad (04503) | crna + 150 × 25 mm u 2 porodice; nepoznat profil | HIGH |
| `befar-sundjer-crni-50x150` | Leo Plus Advance Velcro (55403ADV), Leo Plus Advance with Applicator (52403ADV) | crna + 150 × 50 mm samo u liniji Leo, u 2 porodice; nepoznat prihvat | MEDIUM |
| `befar-sundjer-beli-25x150` | Velcro Polishing Pad (04401), Waffle Velcro Polishing Pad (04501) | bela + 150 × 25 mm u 2 porodice; nepoznat profil | HIGH |
| `befar-sundjer-beli-50x150` | Leo Plus Advance Velcro (55401ADV), Leo Plus Advance with Applicator (52401ADV) | bela + 150 × 50 mm samo u liniji Leo, u 2 porodice; nepoznat prihvat | MEDIUM |
| `befar-sundjer-plavi-25x150` | Befar Plus Velcro Polishing Pad (54405), Waffle Velcro Polishing Pad (04505) | plava + 150 × 25 mm u 2 porodice; nepoznata linija/profil | HIGH |
| `befar-sundjer-plavi-50x150` | Befar Plus With Applicator Compounding Pad (52405), Leo Plus Advance Velcro (55405ADV), Leo Plus Advance with Applicator (52405ADV) | plava + 150 × 50 mm u 3 porodice; nepoznat prihvat i linija | MEDIUM |

Rizik: HIGH = ručni zapis i zvanična porodica stoje u istoj kategoriji sa istom bojom i merom, a kandidat je osnovna Befar linija — kupac gotovo sigurno vidi „isti” sunđer dvaput. MEDIUM = poklapanje je samo sa Leo / Befar Plus linijom (drugačiji naziv i prihvat), pa je dupli utisak slabiji. Nijedan ručni zapis ne nosi zvaničnu šifru: u runtime-u nema šifre na dva zapisa (`DUPLICATE_ACTIVE_CODE = 0`).

## 3. Samo na aktuelnom sajtu (6 proizvoda, 35 šifara)

Uvezeni su — sajt je merilo aktivnog asortimana; katalog (avgust 2024) ih još ne sadrži, pa nemaju fabričko pakovanje.

- `befar-sanding-pad` — 93000
- `befar-sandwich-velcro-backing-pad` — 08401SND, 08402SND, 08403SND
- `befar-turkuaz-compound` — 70041
- `befar-turkuaz-polish` — 70046
- `befar-turkuaz-with-applicator-compounding-pad` — 77102, 77101
- `befar-with-applicator-compounding-pad` — 024012, 024022, 024032, 024042

## 4. Samo u katalogu — nije objavljeno (99 šifara, 28 strana)

Status `CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE`. Ne objavljuje se dok se šifra ne pojavi na sajtu ili vlasnik ne odluči drugačije.

| Str. | Naslovi strane | Šifre |
| --- | --- | --- |
| 4 | COMPOUNDING FOAM | 02401, 02402, 02403, 02404, 02405 |
| 5 | VELCRO / COMPOUNDING FOAM | 03401, 03402, 03403, 03404, 03405 |
| 6 | VELCRO / COMPOUNDING FOAM | 04405 |
| 8 | VELCRO COMPOUNDING FOAM / VELCRO CONICAL COMPOUNDING FOAM | 44311, 44312, 44313, 44314, 44315, 44317, 44511, 44512, 44513, 44514, 44515, 44517 |
| 9 | PLUS VELCRO COMPOUNDING FOAM / VELCRO CONICAL COMPOUNDING FOAM | 44809, 44808, 44811, 44812, 44813, 44814, 44815, 44817 |
| 10 | VELCRO / COMPOUNDING FOAM | 06405 |
| 11 | COMPOUNDING FOAM | 10105 |
| 12 | VELCRO COMPOUNDING FOAM FOR HAND APPLICATOR / WHEEL CLEANING HAND FOAM | 14101, 14102, 14103, 14104, 14105, 14107, 92201, 92202, 92203, 92204, 92205, 92206, 14250, 14255 |
| 13 | HAND COMPOUNDING FOAM / WAX PAD CONICAL PAD | 13101, 13102, 13103, 13104, 13105, 13107 |
| 15 | PLUS / COMPOUNDING FOAM | 52401 |
| 17 | POLISH OR ANTI HOLOGRAM / PLUS VELCRO | 54401 |
| 18 | POLISH OR ANTI HOLOGRAM / PLUS VELCRO | 56401 |
| 19 | POLISH OR ANTI HOLOGRAM / APPLICATOR | 11001 |
| 20 | POLISH OR ANTI HOLOGRAM / PLUS VELCRO | 58401, 58402 |
| 23 | VELCRO BASIC PAD POL YURETHANE / BEFAR VELCRO BASIC PAD FOR BUFFING PAD | 96125, 96150 |
| 24 | SOFT / BACKING PAD | 93007, 93015, 93062, 93207, 93215, 93262 |
| 25 | SOFT / ECO BACKING PAD | 77207, 77215, 93700, 93753 |
| 27 | STATIC FOIL / STATIC | 64100, 64300, 79100, 79300 |
| 28 | MIKROFIBER CLOTHES / PLUS MIKROFIBER CLOTHES | 01407 |
| 29 | SOFT / 0RANGE | 95001, 95002 |
| 30 | LEO SLIM SANDING BLOCK WHITE & BLACK / BEFAR SANDING BLOCK FOR | 77010, 90010, 90030 |
| 32 | HEADLIGHT CLEANING SET / 2PCS 76 MM 1000PS VELCRO WATER SANDING PAPER | 92100 |
| 33 | CREAM COMPOUND / EXTRA CREAM COMPOUND | 60150, 60400, 76150, 76400 |
| 37 | LEO PLUS TRIPPLE MIDDLE / HARD DETAILING VELCRO PAD | 59532 |
| 38 | LEO PLUS MINI DETAILING / CLEANING SET / LEO PLUS CERAMIC APLICATION BLOCK | 05717, 800120, 80012R |
| 39 | 1PCS MICROFIBER CLOTH / 1PCS DOUBLEFACE HAND FOAM | 68130L, 68160L, 68180L, 78130L, 78160L, 78180L |
| 40 | NANO CERAMIC SET / 1PCS CERAMIC LIQUD | 98030 |
| 41 | LEO PLUS MAGIC SPONGE / DOUBLE FACE HAND FOAM | 81011L, 20241 |

## 5. Zapažanja o izvoru

- Katalog štampa slovo O umesto nule u šiframa na str. 37 (`O9901`, `O9902`); čitaju se kao `09901`, `09902`.
- „Backing Pad” je na sajtu naveden dvaput (SOFT i HARD) uz iste šifre 93107/93115/93162 — tvrdoća nije preneta u naziv.
- Turkuaz Static Foil je u katalogu označen kao „HALF STATIC”; na sajtu te oznake nema, pa je nema ni kod nas.
- Leo Hamburger Pad: proizvođač ne navodi namenu; tekst je sveden na naziv, liniju i dimenzije.
- Proizvodi „Drill Type … Cleaning Pad”, „M14 Adapter”, „Turkuaz Compound/Polish” nemaju zasebnu fotografiju — prikazana je zvanična grupna fotografija bloka.
- Befar ne objavljuje opise, TDS ni SDS: karakteristike (`benefits`) su prazne, dokumenti su „na upit”.
- Pozadina slika se ne uklanja (automatski cut-out je zahvatao bele boce).

## 6. REŠENO — klik na red varijante nije menjao aktivnu varijantu (shared PDP)

**Status: rešeno 2026-09-19, task zatvoren.** Nije bila Befar greška niti greška Befar podataka: isto ponašanje imali su i već objavljeni Carsystem i C.A.R.FIT proizvodi. Ispravljeno je zajedničkim variant-selection fixom (`fix(product): enable in-place row variant selection`); Befar dataset i sync nisu menjani.

Reprodukcija pre ispravke (produkcijski build, `npm run build:check` + `npm run start:check`, port 3220):

| Brend | Stranica | Klik na | Očekivano | Dobijeno pre ispravke |
| --- | --- | --- | --- | --- |
| Carsystem | `/proizvodi/carsystem-sanding-disc-p-25-ceramic` | red „P80 · 159.995” | aktivna varijanta P80, šifra 159.995 | ostaje P40 / 160.273 |
| C.A.R.FIT | `/proizvodi/carfit-gold-paper-disc` | red „6-300-0080” | aktivna varijanta P80 | ostaje P40, `aria-pressed="false"` |
| Befar | `/proizvodi/befar-carved-velcro-polishing-pad` | „Bordo · 58407” | aktivna varijanta Bordo, slika boje | ostaje Bela / 05801 |

Uzrok: `ProductVariantProvider` je držao poglede izgrađene samo iz PROIZVODA (`toProductVariantView`). Varijante koje su REDOVI jednog proizvoda (tabela šifara: granulacije, pakovanja, boje) nemaju svoj slug, pa je takav proizvod imao jedan jedini pogled, a `chooseVariant()` za svaki red osim prvog nije nalazio ništa i izbor je tiho propadao.

Rešenje: svaki red dobija svoj pogled u istom provideru (`expandRowVariants`, ključ = šifra reda, `?varijanta=<šifra>`), pa klik i tastatura menjaju šifru, izvedbu, status i sliku varijante; red bez svoje slike zadržava slike proizvoda. Porodični model (Cosmos Lac, Baslac) je nepromenjen. Ponašanje zaključava `components/product/productRowVariantSelection.test.mjs`, koji prolazi kroz svaki proizvod kataloga sa redovima varijanti.
