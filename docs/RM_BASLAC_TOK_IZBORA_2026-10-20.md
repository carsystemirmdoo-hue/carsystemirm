# R-M i Baslac: od kataloga do izbora baza — 2026-10-20

Ulazne tačke koje su proverene, kroz normalnu navigaciju (crawler klikće stvarne linkove i učitava sve kartice beskonačnog skrola):

- glavni meni: Katalog proizvoda, Boje i lakovi, Bazne boje, Bezbojni lakovi, Brendovi → R-M, Brendovi → Baslac;
- katalog „Boje i lakovi“ (`/katalog?kategorija=boje`);
- brend filter u katalogu: R-M i Baslac.

Ukupno je pregledano 9 ulaza i 286 R-M/Baslac kartica. Za svaku je zabeleženo odredište, naslov, izbor zapremine i broj vidljivih baza.

## Uzroci

1. **R-M: kartica „R-M DIAMONT“ nije izbor baza.** `/proizvodi/rm-diamont` je na info.rmpaint.com proizvod sa oznakom **DIAMONT var CV**, odnosno metalik i uni varijanta za komercijalna vozila. Pod naslovom „R-M DIAMONT“ stajala je na 2. mestu u „Boje i lakovi“. Prava kartica sa izborom baza (`rm-diamont-bazna-boja`) bila je tek **144. od 313**, a paste za mešanje **304.**
2. **R-M: prezentacije sistema nisu imale vezu ka izboru.** ONYX HD, UNO HD i DIAMONT var CV nisu imale nijedan link ka karticama izbora, a kartice izbora nisu vodile nazad na prezentaciju.
3. **Baslac: 1 L i 0,5 L su se gubili pri otvaranju porodice, ne pri grupisanju, filtriranju ni povezivanju.** Porodica se otvarala na zapremini prve baze, a ostale zapremine su bile samo u padajućem meniju „Pakovanje“:
   - Line 35 se otvarala na 3,5 L (6 od 55 baza);
   - Line 45 se otvarala na koncentratu 0,1 L (**2 od 70**).

   Podaci su bili potpuni: Line 35 ima 1 L (18) i 0,5 L (31).
4. **Prijavljeni kupac:** lični redosled je potiskivao sisteme boja, pa kartica izbora DIAMONT baza nije bila među prvih 50. Pored toga, posle „Nazad“ se ~1.000 px pomerao položaj. Lični redosled i blok „Za Vas“ stizali su posle vraćanja skrola i preslagali kartice. Ova greška postoji i na `main` (58b81a7a).
5. **Slične kartice:** 17 grupa sa ukupno 41 R-M karticom delilo je isti naslov. Primeri: „R-M GHD THINNER“ za GV 100/200/300/400 i „R-M Pure black“ za SC T2A203 i SC T2P203.
6. **Prelivanje:** u donjoj traci ključnih činjenica tri vrednosti su delile četiri uske kolone, pa je „bazna boja za komercijalna vozila“ izlazila iz kolone.

## Ispravke

- U „Boje i lakovi“ DIAMONT mesto zauzima kartica izbora baza (1.). Slede ONYX HD, UNO HD, CRYSTAL BASE i paste. `rm-diamont` je preimenovan u **„R-M DIAMONT var CV“** i stoji 6.
- Svaka kartica R-M linije (DIAMONT, ONYX HD, UNO HD) ima blok „R-M … u katalogu“. U njemu su prezentacija sistema, kartice izbora sa brojem baza po zapremini i ostali proizvodi linije, uz namenu ili izvedbu (npr. „za komercijalna vozila“, „prezentacija sistema“).
  - Članstvo u liniji se čita iz zvaničnog polja `line`, ne iz sličnosti naziva.
  - Na prezentaciji je blok odmah ispod naslova, a na kartici izbora posle izbora.
- Baslac: padajući meni je zamenjen vidljivim karticama zapremina sa brojem baza. Ulaz iz kataloga otvara „Sva pakovanja“ u grupama, a ulaz sa jedne baze (pretraga, `?varijanta=`) prati njenu zapreminu. R-M porodice koriste isto pravilo.
- Lični redosled prijavljenog kupca zadržava sisteme boja na početku. Posle dolaska ličnog redosleda skrol se ponovo vraća na sačuvanu poziciju, osim ako je korisnik u međuvremenu sam skrolovao.
- R-M kartice sa istim zvaničnim nazivom dobijaju zvaničnu oznaku u naslovu (npr. „R-M GHD THINNER GV 300“).
- Kartice izbora više ne nose izmišljene oznake (RM-DIA-BASE, RM-CRYSTAL-BASE, RM-PASTE). Pakovanja DIAMONT kartice su iz potvrđenih redova (4 L, 1 L, 0,5 L), umesto starog „3.5 L“.
- Kolone ključnih činjenica se prilagođavaju broju činjenica, a duga vrednost se prelama u svojoj koloni.

## Tabela

| Ulazna kartica | Sadašnje odredište (main 58b81a7a) | Ispravljeno odredište | Baze po zapremini | Šta nedostaje |
|---|---|---|---|---|
| R-M DIAMONT (2. u „Boje i lakovi“) | `/proizvodi/rm-diamont`: DIAMONT var CV, bez izbora | DIAMONT mesto (1.) → `/proizvodi/rm-diamont-bazna-boja`; var CV je posebna kartica (6.) sa vezom na izbor | 4 L: 6 · 1 L: 15 · 0,5 L: 14 (35) | BC 101 bez podatka o boji; R-M ne objavljuje zapremine DIAMONT baza (zapremine su sa etiketa) |
| R-M DIAMONT bazna boja (144.) | `/proizvodi/rm-diamont-bazna-boja`, otvara 4 L | isto, 1. mesto, otvara „Sva pakovanja“ | 4 L: 6 · 1 L: 15 · 0,5 L: 14 | — |
| R-M ONYX HD (1.) | `/proizvodi/rm-onyx-hd`, prezentacija bez veza | isto (2.) + blok „ONYX HD u katalogu“ (7 kartica linije) | 0 | Mešne baze ONYX HD nemaju potvrđen artikal u ponudi (vidi „Za odluku“) |
| R-M ONYX HD TROPICAL | prezentacija | isto, označeno „prezentacija sistema“ + blok linije | 0 | isto kao ONYX HD |
| R-M UNO HD (3.) | `/proizvodi/rm-uno-hd`, jedini red SC 10 se ne prikazuje | isto (3.) + blok „UNO HD u katalogu“ (6 zvaničnih proizvoda linije) i napomena o SC 10 | SC 10, kanta 4 L: 1 | Ostale SC paste: linija nije potvrđena zvaničnim izvorom (vidi „Za odluku“) |
| R-M DIAMONT CRYSTAL BASE (4.) | izbor 17 baza, bez veze ka DIAMONT | isto + blok DIAMONT linije | 125 ml: 17 | — |
| R-M paste za mešanje (304.) | izbor 20 oznaka | isto (5.) + blok DIAMONT linije | 4 L: 1 · 1 L: 14 · 0,5 L: 5 · 125 ml: 1 | Linija i naziv nijanse nisu potvrđeni ni za jednu od 20 oznaka |
| R-M DIAMONT JET BLACK (D 403), DIAMONT BLENDER (A 1510) | stranica proizvoda | isto + blok DIAMONT linije | — | — |
| R-M HB 002, Gleam Silver HB 10S, ONYX HD Deep Black DB 403, ONYX INTERIOR, ONYX BLENDER PLUS | stranica proizvoda | isto + blok ONYX HD linije | — | — |
| R-M Pure black / Mat black (SC T2A/T2P), TopcoatMIX, TOPCOAT Mix-R | stranica proizvoda, isti naslovi | naslov sa oznakom + blok UNO HD linije | — | — |
| baslac Basecoat 35 (7.) | `/proizvodi/grupa/baslac-line-35`, padajući meni, otvara 3,5 L (6 od 55) | isto, kartice zapremina, „Sva pakovanja“ (55) | 3,5 L: 6 · 1 L: 18 · 0,5 L: 31 | — |
| baslac Basecoat 45 (8.) | otvara koncentrat 0,1 L (2 od 70) | „Sva pakovanja“ (70) | 5 L: 2 · 1 L: 7 · 0,5 L: 49 · 0,1 L: 12 | — |
| baslac Topcoat 30 (9.) | otvara 3,5 L (3 od 20) | „Sva pakovanja“ (20) | 3,5 L: 3 · 1 L: 17 | — |
| baslac Topcoat 30 CV (10.) | 1 baza | isto | 3,5 L: 1 | U podacima je samo jedna baza |

## ONYX HD i UNO HD — za odluku

Provereni su šifarnik, katalog, cenovnik (stanje zaliha i VP) i postojeće veze artikala. Spisak sa internim šiframa i stanjem je privatan, van repozitorijuma (`~/.carsystem-private/rm-baze-odluka-2026-10-20/rm-baze-za-odluku.csv`). Ovde su samo zbirovi:

| Grupa | Šifara | Status |
|---|---:|---|
| ONYX HD, HB baze | 57 | 2 imaju zvaničnu karticu (HB 002, HB 10S), ali **artikal postoji, nije povezan**. 55 je **podatak nedostaje** (nisu u zvaničnim izvorima po šifri). Nijedna nije u cenovniku ni prodata u 12 meseci. |
| UNO HD, SC paste (prefiks) | 35 | SC 10 je povezan (kartica UNO HD). SC 01 i SC T2A204 su **artikal postoji, nije povezan**. SC 403 je **moguće pogrešno grupisan** (na kartici pasta). 31 je **podatak nedostaje**: linija je izvedena samo iz prefiksa SC. |
| DIAMONT posebne (D) | 2 | D 403 i D 121 su **artikal postoji, nije povezan** (zvanične kartice postoje). |

Ništa od ovoga nije povezano automatski ni po sličnom nazivu.

## Otvoreno

- „R-M DIAMONT bezbojni lak“ (stari ručni zapis, „1 L / 5 L“) nema zvaničnu R-M oznaku. Nije menjan; treba ga potvrditi ili ukloniti.
