# Cosmos Lac — produkcijska implementacija kataloga

Datum implementacije: 17. jul 2026.

## Rezultat

Cosmos Lac je dodat u postojeći Carsystem model proizvoda i postojeće javne
rute. Nije napravljen paralelni katalog niti demo stranica.

| Stavka | Broj |
| --- | ---: |
| Objavljeni SKU/variant zapisi | 742 |
| Varijante | 742 |
| Osnovne grupe proizvoda | 68 |
| Korišćene izvorne slike | 742 |
| Optimizovane produkcijske slike | 742 |
| Blokirani kandidati iz `selected-products` | 15 |
| Isključeni kandidati iz `uncertain` | 34 |
| Dokumentovane pixel-identical grupe | 5 grupe / 10 slika |

Javni status svih novih zapisa je `Na upit`. Implementacija ne objavljuje
cene, lager, dostupnost po lokaciji, barkodove ili druge privatne B2B podatke.

## Zvanični izvori

Iz prve dostavljene arhive selektivno je izdvojeno 119 zvaničnih PDF dokumenata:

- engleski kompletni katalog iz marta 2026;
- šest ne-grčkih kolor-karti;
- 112 engleskih tehničkih listova.

PDF dokumenti služe samo kao lokalni izvori za proveru podataka i nalaze se u
`tmp/pdfs/cosmos-lac-official`. Nisu kopirani u `public` niti javno linkovani.
Originalne ZIP arhive i izvorni audit manifest nisu menjani.

Izvorne slike su uzete isključivo iz `classification === "product-images"` u
`tmp/cosmos-lac-assets/manifest.json`, unutar `selected-products`. Generator
odbija sve što je u `uncertain` i poznate konfliktne varijante.

## Distribucija po linijama

| Linija | Objavljeno |
| --- | ---: |
| Automotive | 16 |
| Chalk Effect | 34 |
| Cleaners | 7 |
| Easy Max | 52 |
| Effect | 2 |
| Fast Acrylic | 29 |
| Flame Blue | 120 |
| Flame Booster | 2 |
| Flame Orange | 134 |
| Fluorescent & Marking | 13 |
| High Heat 700°C | 5 |
| Home | 6 |
| Lubricants | 14 |
| Master Mechanic | 26 |
| Metallic | 5 |
| Molotow Burner | 7 |
| Molotow Premium | 66 |
| Primers | 9 |
| Putties | 6 |
| RAL | 60 |
| Sealer | 4 |
| Spray.Bike | 88 |
| Varnishes | 5 |
| W Wood Care | 8 |
| Wheel Rim | 4 |
| Wood Putties | 18 |
| Zinc | 2 |

Mapiranje u postojeće Carsystem faze:

| Faza | Broj |
| --- | ---: |
| Priprema | 25 |
| Podloga | 31 |
| Boja | 672 |
| Lak | 14 |
| Poliranje | 0 |

## Boje i vizuelni tokeni

Boja kartice nije nasumična i ne određuje identitet proizvoda. Svaki zapis čuva
izvor i nivo pouzdanosti mapiranja:

| Izvor boje | Broj |
| --- | ---: |
| `official-chart` — zvanična Cosmos Lac kolor-karta | 296 |
| `ral` — potvrđen RAL kod | 113 |
| `cap-sample` — potvrđen uzorak obojenog dela PNG-a | 66 |
| `name-derived` — fiksna procena iz potvrđenog naziva nijanse | 197 |
| `manual-estimate` — ručna/provizorna fiksna procena | 70 |

Skripta `scripts/extract-cosmos-lac-color-charts.py` čita vektorske swatch
elemente iz šest zvaničnih kolor-karti i generiše 422 mapiranja u
`data/cosmos-lac-color-chart.generated.json` (125 CL, 48 RAL, 116 FB i 133 FO).

Svaka varijanta u generisanom dataset-u čuva jednu fiksnu `backgroundColor`
vrednost, `foregroundTone`, `colorSource`, `colorConfidence` i
`visualMode: "color-on-hover"`. Stari `backgroundBase`, `backgroundLight` i
`backgroundDark` tokeni su uklonjeni.

Prioritet mapiranja je: zvanična kolor-karta, potvrđen RAL, jasno obojen deo
zvaničnog PNG-a, potvrđen naziv nijanse, pa ručna/provizorna procena. Uzorak sa
PNG-a se obrađuje samo tokom generisanja dataset-a i prihvata se samo kada se
razumno slaže sa nijansom izvedenom iz naziva; u browseru nema ekstrakcije ili
generisanja boje.

Cosmos Lac kartica je u idle stanju neutralna u obe teme. Hover ili
`focus-within` direktno postavlja punu `backgroundColor` vrednost bez
gradijenta, blendovanja, opacity sloja ili interpolacije boje. Ostali brendovi
bez eksplicitnih vizuelnih podataka dobijaju `visualMode: "neutral"`, pa Baslac,
Carsystem i druge kartice ne nasleđuju Cosmos Lac obojenu površinu.

Fizički uzorak boje i zvanična kolor-karta ostaju autoritativni; ekran ne može
biti garancija nijanse.

## Obrada slika

Svaka od 742 izvorne transparentne PNG slike dimenzije 800×800 obrađena je u
WebP bez promene kadra i bez generativnih intervencija. Alpha kanal i dimenzije
su sačuvani.

- zbirna veličina korišćenih PNG izvora: 121.769.452 B (oko 116,1 MiB);
- zbirna veličina produkcijskih WebP slika: 21.915.528 B (oko 20,9 MiB);
- smanjenje: oko 82%;
- javna putanja: `public/products/cosmos-lac/<line>/`.

Generator proverava SHA-256 izvora i produkcijske slike. Pet grupa izvornih PNG
fajlova ima različite izvorne hash vrednosti zbog metapodataka, ali postaje
pixel-identično nakon normalizacije u WebP:

1. Flame Blue FB-900 Pure White / FB-3000 Transparent White;
2. Flame Blue FB-904 Deep Black / FB-3004 Transparent Black;
3. Flame Orange FO-901 Thick Black / FO-904 Deep Black;
4. Master Mechanic RAL 10 Black matt / gloss;
5. Master Mechanic RAL 10 White matt / gloss.

Varijante ostaju odvojene jer ih potvrđuju zvanični naziv, šifra i kolor-karta.
Svaki zapis u grupi ima stabilan `duplicateImageGroup` i tekstualno
`duplicateImageResolution` obrazloženje.

## Blokirano i isključeno

Petnaest kandidata iz sigurnog slikovnog skupa nije objavljeno jer nema dovoljne
potvrde u dostavljenom engleskom katalogu ili TDS dokumentima:

| Linija | Broj |
| --- | ---: |
| Acrylic Paints | 1 |
| Plastic Paints | 1 |
| Sportpens | 10 |
| Wood Glue | 3 |

Još 34 fajla iz `uncertain` grupe su isključena pre generisanja. Poznati
konflikti koji se eksplicitno proveravaju:

- RAL 9003 matt je isključen; objavljena je samo potvrđena gloss varijanta;
- Wood Varnish 374/375 je isključen;
- Acrylic Varnish 376/377/378 je isključen;
- High Heat container 350/351/353 je isključen, a potvrđene aerosolne varijante
  su zadržane;
- FO-314 je isključen; FO-313 je vezan za potvrđenu `Cherry Dark` varijantu.

Blokirane stavke se nalaze u `data/cosmos-lac-blocked.generated.json` i nisu
tiho obrisane.

## Arhitektura i javne rute

Generisani podaci se u `lib/cosmos-lac-data.ts` mapiraju u postojeći
`CarsystemProduct` tip, a zatim se dodaju jedinstvenom nizu u
`lib/carsystem-data.ts`.

Katalog, brend i programske liste dobijaju kompaktnu projekciju istog modela.
Detaljne specifikacije, dokumenti i relacije zato se ne serijalizuju u veliki
klijentski listing bundle, ali ostaju dostupni na detalju proizvoda.

Javne rute:

- `/katalog`;
- `/katalog?brand=cosmos-lac`;
- `/brendovi/cosmos-lac`;
- `/proizvodi/<generisani-slug>`;
- postojeće `/program/<slug>` stranice za relevantne programe.

Pretraga obuhvata naziv, zvanični naziv, srpski prikazni naziv, šifru, RAL,
boju, liniju, tehničku kategoriju i završnicu. Dostupni su dodatni filteri za
liniju, tehničku kategoriju i završnicu, uz postojeću paginaciju od 48 kartica.

## Ponovno generisanje i provera

Kompletan tok:

```bash
npm run cosmos:update
```

Pojedinačni koraci:

```bash
npm run cosmos:colors
npm run cosmos:build
npm run cosmos:validate
```

Generator:

1. čita neizmenjeni audit manifest i `selected-products`;
2. spaja zvanične katalog/TDS i kolor-karta podatke;
3. ponovo pravi JSON zapise i WebP slike;
4. uklanja samo zastarele fajlove unutar namenskog
   `public/products/cosmos-lac` izlaza;
5. validator proverava identitete, hash vrednosti, alpha kanal, dimenzije,
   dozvoljene kategorije, SEO, poznate konflikte i zbirne brojeve.

Za dodavanje ili zamenu proizvoda prvo treba ažurirati izvorni audit/selektovani
asset kroz isti audit proces, dodati zvaničnu englesku potvrdu i zatim ponovo
pokrenuti `npm run cosmos:update`. Pozadina se menja kroz pravilo mapiranja ili
zvaničnu kolor-kartu, ne ručnim CSS izuzetkom na kartici.

## Potrebne poslovne potvrde

Pre konačne poslovne objave treba potvrditi:

1. da li svih 742 potvrđenih varijanti treba prikazati u javnom asortimanu;
2. stvarnu raspoloživost i način obrade upita — implementacija trenutno tvrdi
   samo `Na upit`;
3. engleski katalog/TDS izvor za 15 blokiranih kandidata, ako treba da se
   objave;
4. da li je potrebno tražiti jedinstvene fotografije za pet
   pixel-identical grupa;
5. da su fizičke kolor-karte merodavne za prodajnu komunikaciju o nijansi.
