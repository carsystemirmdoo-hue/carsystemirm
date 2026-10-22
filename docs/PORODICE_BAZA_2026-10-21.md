# Porodice baza R-M i Baslac — jedan izbor, fotografije po zapremini — 2026-10-21

## 1. Zajednički izbor porodice (Baslac je uzor)

`components/product/family/FamilyBasePdp.tsx` je jedna komponenta za Baslac i R-M porodice baza. Obe imaju isti raspored:
- širinu fotografije i zone izbora (352 / 800 px na 1440);
- pretragu, filter završnice i dugmad zapremine sa brojem baza;
- kartice (kvadratić, šifra, naziv, zapremina · završnica, oznaka izbora);
- broj kolona (4 na računaru, 2 na telefonu);
- grupe po zapremini i prikaz izabrane stavke.

Brend se razlikuje samo akcentom (plava / crvena) i sadržajem.

Baslac baza je svoj proizvod (izbor po slug-u). R-M baza je red kartice, pa izbor ide kroz `ProductVariantProvider`. Panel kupovine i korpa tako dobijaju tačan red i pakovanje: BC 101 → 1 L, BC 100 → 4 L.

R-M porodice na ovom izboru: DIAMONT bazna boja, DIAMONT CRYSTAL BASE, paste za mešanje.

## 2. Fotografija prati izabranu zapreminu

Jedna fotografija po sistemu i zapremini, bez promene po boji. Fotografija prati IZABRANU bazu, ne grupu u vidnom polju. Etiketa i zapremina se ne prepravljaju. Izvor je Surventis Brand Portal; originali su preuzeti kroz „Download original“, a poreklo je u `data/catalog/family-packshots.json` (skripta `scripts/build-family-packshots.py`).

| Sistem | Zapremina | Portal asset | Napomena |
|---|---|---|---|
| R-M DIAMONT | 0,5 L / 1 L / 4 L | 34847 / 34851 / 30822 | generička sistemska limenka, bez šifre nijanse |
| R-M CRYSTAL BASE | 125 ml | 30817 | generička bočica |
| R-M UNO HD | 4 L | 34856 | preuzeta za SC 10 (4 L); UNO HD kartica i dalje ima 1 L limenku 30820 |
| Baslac Line 35 | 3,5 L | (postojeća) | generička „35-M“ |
| Baslac Line 35 | 1 L / 0,5 L | 12115 / 12092 | portal ima samo fotografiju sa šifrom jedne baze (35-M1020 / 35-M1120); strana to kaže |
| Baslac Line 30 | 3,5 L / 1 L | (postojeća) / 12114 | 1 L: na fotografiji 30-S110 |
| Baslac Line 45 | 5 L / 1 L / 0,5 L / 0,1 L | 12081 / 12121 / 12094 / 12088 | na fotografijama 45-W00 / 45-W1010 / 45-W1020 / 45-W1390 |

**Nedostaci**
- Baslac portal nema generičke limenke za 1 L, 0,5 L, 5 L i 0,1 L. Prikazana je reprezentativna fotografija uz natpis koja baza je na etiketi.
- R-M paste nemaju potvrđen sistem, pa nemaju ni fotografiju (ne prikazuje se limenka drugog sistema).
- ONYX HD nema izbor baza (vidi tačku 3), pa nema fotografiju po zapremini.

## 3. ONYX HD blok

Blok „R-M … u katalogu“ je podeljen na četiri dela:
- **Izbor baza po pakovanju:** kartice zapremina, direktno na izbor;
- **Boje i baze linije;**
- **Pomoćni proizvodi (aditivi, blenderi):** isprekidan okvir;
- **link „O sistemu: …“:** običan tekstualni link, ne kartica.

Grupa se određuje iz zvaničnog tipa proizvoda. CV izvedbe su označene kao „druga formulacija, za komercijalna vozila (CV)“.

Za ONYX HD nema stvarnih mešnih baza u našoj ponudi. 57 HB baza je u šifarniku, ali nijedna nije u cenovniku ni prodata u 12 meseci. Zato nema ni izbora baza; to piše u bloku.

## 4. „R-M paste za mešanje“ — razvrstavanje

Proverene su zvanična dokumentacija (BASF Diamont tabela 2020, R-M Technical Manual, techinfo.rmpaint.com), naše šifre i Surventis R-M portal. Nijedna od 20 oznaka nije potvrđena u nekom sistemu, pa nijedna nije premeštena. Pripadnost se ne izvodi iz prefiksa BC/CB/SC. Grupa ostaje jedna kartica (nije serija), sa jasnim natpisom da linija nije potvrđena.

| Šifra | Naziv | Potvrđen sistem | Namena | Zapremina | Predložena grupa | Izvor |
|---|---|---|---|---|---|---|
| SC 403 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 111 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 190 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L · 4 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 196 | — | nije potvrđen | mešna pasta (po etiketi) | 0,5 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 301 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 404 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 408 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 475 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 512 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 601 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 616 | — | nije potvrđen | mešna pasta (po etiketi) | 0,5 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 617 | — | nije potvrđen | mešna pasta (po etiketi) | 0,5 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 740 | — | nije potvrđen | mešna pasta (po etiketi) | 0,5 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 816 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 881 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 1182 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 1245 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 1265 | — | nije potvrđen | mešna pasta (po etiketi) | 1 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| BC 7610 | — | nije potvrđen | mešna pasta (po etiketi) | 0,5 L | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |
| CB 48V | — | nije potvrđen | mešna pasta (po etiketi) | 125 ml | ostaje u „paste za mešanje“ (za odluku) | nema u BASF tabeli 2020, R-M Technical Manual, Surventis R-M portalu (pretraga po šifri) ni na techinfo.rmpaint.com |

Napomena:
- CB 48V nije na zvaničnoj listi CRYSTAL BASE; tamo su CB66V i CB67V.
- SC 403: prefiks upućuje na UNO HD, ali zvanično potvrđeni su samo SC 10 i SC 01.

## 5. CV artikli

- **R-M DIAMONT var CV** (`/proizvodi/rm-diamont`) je posebna formulacija za komercijalna vozila. Odnos mešanja je 100 + 50 %, a razređivači su GHD. Nije zamenljiva sa DIAMONT baznom bojom, pa ostaje zasebna kartica, jasno označena.
- **R-M HB 002 var CV** je ONYX HD formulacija za komercijalna vozila i označena je tako u bloku linije.
- **Baslac Topcoat 30 CV** je zaseban sistem. Ima sopstvenu mešnu komponentu 30-S01 i CV učvršćivače 51-515 / 51-520 / 51-530 (zvanični TDS). Zato ostaje odvojen od Topcoat 30, uz objašnjenje na strani. Topcoat 30 baze nisu predstavljene kao zamenljive.

## 6. Baslac — potpunost (Line 35, Line 45, Line 30)

Upoređeni su zvanični program (baslac.de KLW katalog, baslac.com, Surventis portal, Tinting Chart basecoat 35 03/2021), naš šifarnik i cenovnik i ono što sajt prikazuje.

**Imamo, nisu bili prikazani → povezano** (dodato u `lib/baslac-systems.ts`):

| Šifra | Zapremina | Izvor potvrde | Napomena |
|---|---|---|---|
| 35-M00 | 3,5 L | baslac.com: „35-M00 35- Basecoat“, aktuelna mešna komponenta | tehnička komponenta |
| 35-M05 | 3,5 L | Surventis 12152, art. 53232870, etiketa „Basecoat“ | naziv nijanse nije objavljen |
| 35-M351 | 1 L | Tinting Chart 03/2021 („M351“) | naziv nije objavljen |
| 49-W455, 49-W460, 49-W553, 49-W554, 49-W580 | 0,1 L | Tinting Chart 03/2021 | naziv nije objavljen |
| 49-W463, 49-W466 | 0,1 L | Surventis packshot (art. 50395465 / 50395481) | naziv nije objavljen |

Bez naziva i efekta kartica kaže „Naziv nije objavljen“ i ima neutralan kvadratić.

**Pogrešno povezano / za odluku**
- „baslac 30-S510 S serija“: ručni zapis sa oznakom koje nema kod proizvođača ni u našem šifarniku. Mi vodimo 30-S511, 30-S520 i 30-S530, a sve su u Line 30.
- „Crystal“ kod Baslac-a su 35-M215 „Silver Crystal fine“ i 35-M217 „Silver Crystal coarse“ (Line 35, prikazane). Baslac nema seriju „Crystal Base“; to je R-M linija.

**Imamo, a proizvođač ih povlači („Auslaufartikel“, baslac.de) — nisu prikazane, za odluku:** 35-M1541, 35-M1621, 35-M383, 35-M314, 30-S340.

**Imamo, ali ih nijedan zvanični izvor ne potvrđuje — za odluku:** 35-M1111, 35-M1522, 35-M1545, 35-M1622, 49-W430, 49-W496, 49-W497, 49-W513, 49-W544, 49-W560.

**Kod proizvođača, a nisu potvrđene u našoj ponudi:** svih **62 baze 45-W** (Line 45, vodena, uključujući 45-W00, 45-R45 i aditive). Nijedna nije u našem šifarniku, a sajt ih prikazuje kao zvanični program „na upit“. Od Line 45 u šifarniku su samo 49-W koncentrati. Line 35 i Line 30 sa baslac.de su u šifarniku kompletne. Treba odlučiti da li Line 45 baze ostaju javno prikazane. Spisak po šifri je privatan (`~/.carsystem-private/porodice-baza-2026-10-21/`).

## 7. Kartice po seriji i zapremini u katalogu

Svaka serija ima zasebnu ulaznu karticu za svaku potvrđenu zapreminu:

| Serija | Kartice |
|---|---|
| R-M DIAMONT | 0,5 / 1 / 4 L |
| R-M DIAMONT CRYSTAL BASE | 125 ml |
| baslac Basecoat 35 | 0,5 / 1 / 3,5 L |
| baslac Basecoat 45 | 0,1 / 0,5 / 1 / 5 L |
| baslac Topcoat 30 | 1 / 3,5 L |

Svaka kartica ima istaknutu seriju i zapreminu, fotografiju te zapremine i broj baza. Vodi direktno na izbor te zapremine (`?pakovanje=`), a unutar porodice ostaju dugmad za druge zapremine i „Sva pakovanja“.

Opšta kartica serije se ne prikazuje među njima; ostaje samo kao sidro za pretragu varijanti i lični redosled. Kartice ne dupliraju artikle, šifre, lager ni cene. Paste (bez potvrđene linije) i Topcoat 30 CV (jedna zapremina) ostaju po jedna kartica. Katalog nema poseban filter zapremine; brojanje rezultata broji kartice.
