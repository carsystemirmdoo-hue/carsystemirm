# Cosmos Lac ZIP audit

Datum audita: 17. jul 2026.

## Obim i metod

Audit obuhvata:

1. `/Users/miledulic/Downloads/BRAND KIT-20260717T165842Z-1-001.zip`
2. `/Users/miledulic/Downloads/BRAND KIT-20260717T165842Z-1-002.zip`

Arhive su prvo pregledane preko centralnog ZIP direktorijuma, bez potpunog
raspakivanja. Zatim je svih 847 PNG članova pojedinačno pročitanо radi provere
dimenzija, stvarne alpha providnosti i SHA-256 hasha. Selektivno je izdvojeno samo
791 PNG fajlova iz zvaničnog transparentnog product stabla.

Vizuelna provera je obuhvatila:

- 40 reprezentativnih proizvoda iz različitih linija;
- 25 transparentnih product PNG fajlova;
- svih 56 PNG fajlova van product stabla;
- svih 49 početnih packaging/cap varijanti;
- 40 članova potencijalnih duplikatnih grupa.

Pregled je rađen na checkerboard podlozi, kako bi alpha kanal bio vizuelno vidljiv.
Nije rađeno uklanjanje pozadine, OCR etiketa, korekcija boje, skaliranje,
kompresovanje niti konverzija formata.

## A. Sažetak obe arhive

### Arhiva 1

**Naziv:** `BRAND KIT-20260717T165842Z-1-001.zip`

- veličina ZIP-a: 2.115.727.959 B (oko 1,97 GiB);
- ukupna nekompresovana veličina: 2.135.998.703 B (oko 1,99 GiB);
- broj fajlova: 1.292;
- PNG: 622;
- JPG: 314;
- JPEG: 4;
- PDF: 281;
- MP4: 36;
- MOV: 2;
- GIF: 1;
- bez ekstenzije: 32;
- PSD/TIF/TIFF/EPS/AI/SVG: 0.

Glavne grupe sadržaja:

| Grupa | Broj fajlova |
| --- | ---: |
| `PRODUCTS` | 643 |
| `SOCIAL MEDIA` | 244 |
| `TDS files` | 226 |
| `LOGOS` | 54 |
| `FLAME images` | 54 |
| `VIDEOS` | 28 |
| `Carbon Neutral` | 18 |
| `COSMOS LAC Brochures` | 12 |
| `COSMOS LAC Color charts` | 7 |
| `COSMOS LAC Complete Catalogue` | 3 |

U product stablu je pronađeno 566 transparentnih 800×800 PNG kandidata:

- 399 u `COLOR LINES`;
- 100 u `SPECIAL-USE`;
- 67 u `OTHER-PRODUCTS`.

Od njih je 534 svrstano u sigurne glavne slike, a 32 u `uncertain`.

**Procena kvaliteta:** veoma dobra osnova za kartice proizvoda. Product PNG fajlovi
su tehnički ujednačeni, transparentni i bez marketinške pozadine. Arhiva je ipak
mešoviti brand kit: proizvodi, TDS, katalozi, logotipi, cap sistemi, social sadržaj,
fotografije i video nalaze se u istom ZIP-u. Postoje konfliktni identični fajlovi
pod različitim nazivima proizvoda.

### Arhiva 2

**Naziv:** `BRAND KIT-20260717T165842Z-1-002.zip`

- veličina ZIP-a: 1.123.431.255 B (oko 1,05 GiB);
- ukupna nekompresovana veličina: 1.123.066.854 B (oko 1,05 GiB);
- broj fajlova: 331;
- PNG: 225;
- JPG: 95;
- MP4: 6;
- MOV: 4;
- bez ekstenzije: 1;
- PDF/JPEG/PSD/TIF/TIFF/EPS/AI/SVG/GIF: 0.

Glavne grupe sadržaja:

| Grupa | Broj fajlova |
| --- | ---: |
| `PRODUCTS` | 315 |
| `VIDEOS` | 9 |
| `SOCIAL MEDIA` | 6 |
| `Carbon Neutral` | 1 |

Svih 225 PNG fajlova je u transparentnom 800×800 product stablu:

- 197 u `COLOR LINES`;
- 28 u `SPECIAL-USE`.

Od njih je 223 svrstano u sigurne glavne slike, a 2 Flame Orange fajla u
`uncertain` zbog potpuno identičnog sadržaja pod različitim šiframa/nazivima.

**Procena kvaliteta:** veoma dobra i čistija od prve arhive za PNG upotrebu. Svi PNG
fajlovi su proizvodni renderi, ali ZIP kao celina sadrži i JPG/video materijal.
Arhiva 2 deluje kao nastavak istog izvoza, posebno za Flame Orange, Flame Blue,
Automotive i Fluo Marking linije.

### Zbirni inventar

| Tip | Ukupno |
| --- | ---: |
| Svi fajlovi | 1.623 |
| PNG | 847 |
| JPG | 409 |
| JPEG | 4 |
| PDF | 281 |
| MP4 | 42 |
| MOV | 6 |
| GIF | 1 |
| Bez ekstenzije | 33 |
| PSD/TIF/TIFF/EPS/AI/SVG | 0 |

## B. Šta je pronađeno

### PNG klasifikacija

Konačna klasifikacija svih 847 PNG fajlova:

| Klasifikacija | Broj | Napomena |
| --- | ---: | --- |
| `product-images` | 757 | Sigurni frontalni 800×800 product kandidati |
| `packaging-variants` | 46 | 24 cap/nozzle asseta + 22 alternativna product prikaza |
| `uncertain` | 12 | Product PNG sa konfliktnim identičnim sadržajem |
| `logos-and-brand-assets` | 25 | Cosmos Lac, Flame i Carbon Neutral elementi |
| `marketing-and-print-assets` | 4 | B2B banner i RAL Smart Cap social grafike |
| `multi-product-images` | 3 | Velike Flame fotografije sa više proizvoda |
| `color-charts-and-swatches` | 0 | Color charts postoje kao PDF, ne kao PNG |

Od ukupno 847 PNG fajlova, 840 stvarno koristi alpha providnost. Svih 791
izdvojenih product kandidata ima alpha providnost i dimenziju 800×800. Preostalih
sedam PNG fajlova bez providnosti pripada marketinškim, multi-product ili brand
materijalima.

### Prepoznate linije i grupe

Brojevi ispod predstavljaju PNG product kandidate pre konačnog razdvajanja na
`selected-products` i `uncertain`:

| Linija ili grupa | Broj kandidata |
| --- | ---: |
| Flame Orange | 136 |
| Flame Blue | 120 |
| Spray.Bike | 88 |
| Molotow Premium | 66 |
| RAL | 62 |
| Easy Max | 52 |
| Chalk Effect | 34 |
| Sportpens | 30 |
| Fast Acrylic | 29 |
| Master Mechanic | 26 |
| Wood Putties | 18 |
| Automotive | 16 |
| Lubricants | 14 |
| Fluo Marking | 13 |
| Varnishes | 10 |
| Primers | 9 |
| W Wood Care | 8 |
| High Heat | 8 |
| Molotow Burner | 7 |
| Cleaners | 7 |
| Putties | 6 |
| Home | 6 |
| Metallic | 5 |
| Effect | 4 |
| Sealer | 4 |
| Wheel Rim | 4 |
| Wood Glue | 3 |
| Flame Booster | 2 |
| Zinc | 2 |
| Acrylic Paints | 1 |
| Plastic Paints | 1 |

### Organizacija i nazivi

- Product slike su organizovane po liniji, nameni i često po nijansi.
- 115 PNG zapisa ima prepoznatljiv RAL kod u nazivu.
- 542 PNG zapisa ima naziv nijanse koji je moguće izvesti iz imena fajla.
- 458 PNG zapisa ima prepoznatljivu internu šifru ili kod proizvoda/nijanse.
- 69 PNG zapisa eksplicitno navodi završnicu kao što su gloss, matt/matte, satin,
  metallic, chrome, fluorescent ili transparent.
- Samo 15 PNG naziva eksplicitno sadrži zapreminu/masu; zapremina se često vidi na
  etiketi, ali nije bezbedno čitana OCR-om u ovom auditu.
- Nije pronađen naziv PNG fajla sa barkod obrascem od 8–14 uzastopnih cifara.
- 165 product PNG naziva sadrži oznaku `v2`.
- Nema product PNG naziva sa eksplicitnom oznakom `old` ili `new`.

Oznaka `v2` ukazuje na verzionisanje asseta, ali sama po sebi nije dovoljan dokaz
da se radi o novom pakovanju. Vizuelni uzorak pokazuje uglavnom konzistentna
pakovanja po linijama; nije pronađena pouzdana, kompletna old/new matrica.

### Pogodnost za kartice proizvoda

757 fajlova je označeno kao neposredno pogodno za sledeću fazu pripreme kartica:

- transparentna pozadina;
- 800×800 rezolucija;
- kompletan proizvod u kadru;
- uglavnom frontalni prikaz;
- bez vidljivog watermarka u pregledanom uzorku;
- bez marketinškog teksta preko same slike;
- jedinstveno predloženo ime fajla.

To je broj sigurnih **slikovnih kandidata**, ne potvrđen broj komercijalnih SKU-ova.
Mnoge slike predstavljaju nijanse, završnice ili pakovanja iste linije.

## C. Problemi

### Potpuno identični fajlovi

Pronađeno je šest SHA-256 grupa sa ukupno 14 bajt-po-bajt identičnih PNG fajlova:

1. RAL 9003 matt fajl postoji i u `RAL Gloss` i u `RAL Matt` folderu.
2. Wood Varnish 374 gloss i 375 satin imaju identičan PNG sadržaj.
3. High Heat container fajlovi 350 silver, 351 black i 353 maroon imaju identičan
   PNG sadržaj.
4. Acrylic Varnish 376 gloss, 377 matt i 378 satin imaju identičan PNG sadržaj.
5. Flame Orange FO-313 i FO-314 imaju identičan PNG sadržaj.
6. `Logo-Social-Media.png` je dupliran u dva logo foldera.

Product članovi tih konfliktnih hash grupa nisu automatski prihvaćeni kao sigurni;
12 ih je izdvojeno u `uncertain`. Glavne High Heat spray-can slike 350 i 351 nisu
bajt-po-bajt identične container fajlovima i ostale su u sigurnom skupu.

### Moguće varijante

Ukupno je formirano 18 potencijalnih duplikatnih/varijantnih grupa, sa 50 povezanih
fajlova:

- deset Sportpens boja ima glavni prikaz i po dva alternativna ugla;
- Chrome Effect 450 i Gold Effect 451 imaju spray-can i container varijantu;
- High Heat ima spray-can i container veze, uz konflikt identičnih container slika;
- pet grupa sadrži konfliktne identične product fajlove;
- jedna grupa je identičan logo duplikat.

Duplikati nisu obrisani.

### Ostali rizici

- 24 cap/nozzle PNG fajla izgledaju kao product elementi, ali nisu kompletni
  proizvodi i nisu izdvojeni u product foldere.
- Tri `FLAME images` PNG fajla su velike marketinške fotografije sa više proizvoda,
  ne product card slike.
- RAL Smart Cap PNG fajlovi su social/marketing grafike, ne color chart podaci.
- Color chart materijal postoji kao sedam PDF fajlova i nije predmet ove PNG
  ekstrakcije.
- Nazivi nijansi i šifre su većinom dobri, ali format nije potpuno standardizovan
  (`matt`/`matte`, velika/mala slova, `v2`, Unicode `™`, razmaci u folderima).
- RAL veza postoji samo tamo gde je eksplicitno navedena. Flame, Molotow,
  Spray.Bike i druge linije često koriste sopstvene šifre i nazive nijansi.
- Nije moguće iz samog PNG naziva potvrditi zapreminu, dostupnost, srpski naziv,
  EAN/barkod niti prodajni status za svaki proizvod.
- Ne postoje PSD, TIFF, EPS, AI ili SVG izvori koji bi pomogli proveri ambalaže.

## D. Pripremljeni materijal

### Brojevi

- analizirano PNG fajlova: 847;
- selektivno izdvojeno product kandidata: 791;
- originalne strukture, arhiva 1: 566 PNG;
- originalne strukture, arhiva 2: 225 PNG;
- `selected-products`: 757 PNG;
- `uncertain`: 34 PNG;
- transparentnih izdvojenih product kandidata: 791;
- potencijalnih duplikatnih/varijantnih grupa: 18;
- potpuno identičnih hash grupa: 6.

Folder `uncertain` sadrži:

- 22 alternativna product prikaza (`packaging-variants`);
- 12 product PNG fajlova sa konfliktnim identičnim sadržajem.

### Putanje

- koren pripremljenih fajlova:
  `/Users/miledulic/Desktop/Projects/carsystem/tmp/cosmos-lac-assets/`
- originalna struktura arhive 1:
  `/Users/miledulic/Desktop/Projects/carsystem/tmp/cosmos-lac-assets/originals/archive-01/`
- originalna struktura arhive 2:
  `/Users/miledulic/Desktop/Projects/carsystem/tmp/cosmos-lac-assets/originals/archive-02/`
- sigurni kandidati:
  `/Users/miledulic/Desktop/Projects/carsystem/tmp/cosmos-lac-assets/selected-products/`
- kandidati za proveru:
  `/Users/miledulic/Desktop/Projects/carsystem/tmp/cosmos-lac-assets/uncertain/`
- JSON manifest:
  `/Users/miledulic/Desktop/Projects/carsystem/tmp/cosmos-lac-assets/manifest.json`
- CSV manifest:
  `/Users/miledulic/Desktop/Projects/carsystem/tmp/cosmos-lac-assets/manifest.csv`
- radni README:
  `/Users/miledulic/Desktop/Projects/carsystem/tmp/cosmos-lac-assets/README.md`

Manifest sadrži zapise za svih 847 PNG fajlova. Za neizdvojene logotipe, cap
sisteme, marketinške i multi-product fajlove `extractedPath` je `null`.

## E. Preporuka za naredni korak

### 1. Ne uvoziti još 757 fajlova direktno kao 757 proizvoda

Prvo napraviti verifikacionu tabelu, idealno iz zvaničnog Cosmos Lac kataloga,
color chart PDF-a ili potvrđenog Excel/CSV izvora. Brand kit već sadrži complete
catalogue, color chart i TDS PDF dokumente u arhivi 1; oni su najbolji sledeći
izvor, ali ih treba obraditi kao poseban zadatak.

Preporučena polja:

| Polje | Svrha |
| --- | --- |
| `name` | Zvanični naziv proizvoda na srpskoj latinici |
| `cosmosCode` | Zvanična Cosmos Lac šifra |
| `ralCode` | Samo potvrđen RAL kod |
| `colorName` | Zvanični naziv nijanse |
| `volume` | Potvrđena zapremina ili masa |
| `category` | Color line, special use ili druga poslovna kategorija |
| `finish` | Gloss, matt, satin, metallic, transparent itd. |
| `imagePath` | Putanja do odobrene glavne slike |
| `cardBackgroundColor` | Dizajn token, ne boja nasumično uzeta sa fotografije |
| `textContrast` | `light`/`dark`, uz proveru kontrasta |
| `verificationStatus` | `unverified`, `catalog-matched`, `brand-confirmed` |
| `sourceReference` | Katalog/TDS/Excel red ili dokument |
| `assetHash` | SHA-256 odobrene slike |

### 2. Povezivanje spreja i boje

Povezivanje je relativno pouzdano kada naziv eksplicitno sadrži:

- RAL kod;
- liniju i internu šifru, npr. `FB-...` ili `FO-...`;
- jasan naziv nijanse.

Ipak, nije bezbedno tvrditi da se **svaki** sprej može automatski povezati sa
pripadajućom bojom:

- samo 115 od 847 PNG zapisa eksplicitno sadrži RAL kod;
- Flame, Molotow, Spray.Bike i druge linije koriste interne palete;
- postoje potvrđeni konflikti identičnih fajlova pod različitim nazivima;
- `v2` ne potvrđuje samo po sebi aktuelno pakovanje ili aktuelnu nijansu;
- barkodovi nisu prisutni u nazivima fajlova.

Zato sledeći najbezbedniji korak nije implementacija, već spajanje manifesta sa
zvaničnim katalogom/Excel/PDF izvorom po kombinaciji:

`linija + Cosmos šifra + RAL (ako postoji) + naziv nijanse + završnica + zapremina`.

Tek redovi sa statusom `catalog-matched` ili `brand-confirmed` treba da budu
pretvoreni u podatke proizvoda i prebačeni u produkcioni `public/products` folder.

### 3. Redosled rada

1. Ručno razrešiti 34 fajla iz `uncertain`.
2. Izvući strukturisane podatke iz zvaničnog complete catalogue/color chart/TDS
   materijala.
3. Napraviti CSV/XLSX verifikacionu tabelu sa poljima iznad.
4. Upariti 757 sigurnih slika sa potvrđenim redovima.
5. Tek tada planirati mali, pregledan katalog import bez javnih B2B cena.

## Zaključak

Brand kit sadrži veoma kvalitetan i tehnički konzistentan set PNG proizvoda.
Za vizuelnu fazu je spremno 757 sigurnih kandidata, ali naziv fajla nije zamena za
zvanični proizvodni izvor. Posebno za RAL/nijanse, završnice i zapremine potrebno
je uraditi kataloško uparivanje pre implementacije.
