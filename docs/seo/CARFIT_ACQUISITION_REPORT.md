# C.A.R.FIT — IZVEŠTAJ O AKVIZICIJI ZNANJA

**Brend:** C.A.R.FIT · **Proizvođač:** August Handel GmbH · **Izvor:** carfitrepair.com
**Datum:** 2026-08-08
**Status objave:** ništa nije objavljeno; nula tvrdnji ima status `expert-verified`

**FINALNI STATUS: PARTIAL** — obrazloženje u § 12.

---

## 1. DISCOVER — arhitektura izvora nije pretpostavljena

Zadatak je bio da se prvo utvrdi kojem tipu izvora C.A.R.FIT pripada. Odgovor nije nijedan od tri poznata čisto.

| Provera | Nalaz |
| --- | --- |
| `robots.txt` | `Disallow:` prazno — puzanje dozvoljeno; sitemap prijavljen |
| Platforma | WordPress + Yoast + Elementor |
| Sitemap | 256 postova, 24 stranice, 38 kategorija, dvojezično DE/EN |
| Tip proizvoda | proizvodi su obični WordPress **postovi**, ne poseban post type |
| REST API | **otvoren** — 128 postova, 20 kategorija, 301 PDF, 183 slike |
| Dokumenti | TDS i SDS postoje u znatnoj količini |

**Zaključak: hibrid.** Bogate stranice proizvoda kao kod Cosmos LAC-a, **i** korpus tehničkih dokumenata kao kod Carsystem-a. Nije portal dokumenata kao R-M/baslac, i nije „bogate stranice bez TDS-a" kao Cosmos.

**Izabrana strategija:** REST API kao primarni izvor kataloga umesto skrejpovanja Elementor markupa, uz uniju dve liste dokumenata (medijska biblioteka + linkovi sa stranica proizvoda), jer nijedna sama nije potpuna.

---

## 2. Gramatika je proučena pre pisanja parsera

Popis naslova nad celim korpusom (ne uzorkom):

| Naslov | Pojava |
| --- | ---: |
| Beschreibung | 123 |
| Weitere Produktinformation | 97 |
| Eigenschaften | 82 |
| Zweckbestimmung | 76 |
| Oberflächen | 68 |
| Downloads | 62 |
| Technische Daten | 2 |
| Haltbarkeit und Lagerbedingungen | 2 |

Uz to, podnaslovi `Härter` (6), `Scheiben` (4), `Klarlack` (4), `Streifen` (3), `Füller` (2) — **blokovi komponenti**, ne veličine.

### Dve odluke koje bi ravno čitanje teksta pogrešilo

**1. Specifikacije se čitaju iz dvokolonske strukture, ne uparivanjem naizmeničnih redova.**
Uparivanje se raspada na svakoj stranici koja meša oblike i pomera sve za jedan. Proizvodilo je labele `61°C` i `grau`, a prave labele (`Viskosität`, `Zündtemperatur`) tiho gubilo.

**2. `h3` blokovi su granice komponenti.**
`Rapid Air Klarlack VOC` navodi `7-325-1000` / `7-326-5000` pod *Klarlack* i `7-336-1000` / `7-337-2500` pod *Härter*. Tretiranje sva četiri kao varijanti jedne stvari pripisalo bi gustinu bezbojnog laka očvršćivaču.

---

## 3. ACQUIRE — šta je preuzeto

| Stavka | Broj |
| --- | ---: |
| Proizvoda proizvođača | **123** |
| Brojeva artikala | **348** |
| Porodica (više artikala na stranici) | 61 |
| Stranica sa blokovima komponenti | 10 |
| Kategorija proizvoda | 12 |
| Dokumenata otkriveno | **302** |
| — tehnički listovi (TDS) | 109 |
| — bezbednosni listovi (SDS) | 185 |
| — katalog | 1 (`CARFIT-FINAL-2026.pdf`) |
| — administrativni (nije dokumentacija) | 1 |
| — nečitljivi skenovi | 5 |
| — vraća grešku (HTTP 404) | 1 |
| Slika | **123** (sve jedinstvene) |

Ukupno 111 MB u `assets/manufacturer/carfit/`, **van `public/`**. Nijedna postojeća slika sajta nije zamenjena.

Katalog za 2026. **nije bio kraj posla** — obrađen je ceo dostupni katalog proizvoda sa 123 stranice, a katalog PDF je samo jedan od 302 dokumenta.

---

## 4. Klasifikacija dokumenata po sadržaju, ne po nazivu

Klasifikacija po naslovu je odbačena nakon prvog pokušaja: listovi se sami nazivaju „Produktdatenblatt", „Technical Information", „TECHNICAL DATA" ili nikako (kada je zaglavlje rasterska slika). Prvi pokušaj je dao **8 TDS i 108 neklasifikovanih**.

Prešlo se na klasifikaciju po **strukturi**: SDS nosi numerisane regulatorne sekcije i H/P oznake, TDS nosi opis proizvoda uz blokove primene i podloge. Uz čitanje prve **tri** strane umesto jedne (nekoliko listova počinje slikom).

Rezultat: 109 TDS, 185 SDS, 1 katalog, 1 administrativni obrazac, 5 nečitljivih, 0 neklasifikovanih.

3 dokumenta su klasifikovana **rezervom po nazivu fajla** i tako su i označena (`classificationConfidence: "filename-fallback"`). Naziv nikada ne poništava sadržaj — konsultuje se samo kada sadržaj nije dovoljan da odluči.

---

## 5. EXTRACT — „nema TDS" ne znači „nema tehničkih podataka"

Stranice proizvoda nose podatke koji ne postoje nigde drugde:

| Izvor | Tvrdnji |
| --- | ---: |
| **Sajt proizvođača** | **1.096** |
| — specifikacije (strukturne) | 395 redova |
| — podloge (`Oberflächen`) | 202 |
| — svojstva | 398 |
| — namena | 77 |
| — kompatibilnost (Ja/Nein) | 12 |
| **Tehnički listovi** | **567** |

Sve `machine-extracted` / za proveru. Sajt-tvrdnje nose `sourceType: manufacturer-website`, tvrdnje iz listova `manufacturer-technical-document`.

### Opseg tvrdnje se čuva

| Opseg | Tvrdnji |
| --- | ---: |
| varijanta | 573 |
| porodica | 416 |
| porodica sa više komponenti | 107 |

523 tvrdnje su na nivou porodice. Nijedna nije tiho svedena na jedan SKU — `Farbe: braun, grün, violett` na stranici sa tri artikla opisuje porodicu, a stručni paket to izričito traži da se potvrdi.

### Dve vrste negacije se ne mešaju

Ovo je bila najopasnija zamka u korpusu:

| Vrsta | Broj | Primer |
| --- | ---: | --- |
| gramatička negacija | 50 | „kein Verstopfen" — **pozitivna** prodajna tvrdnja |
| stvarno ograničenje | 4 | „Frischer Lack: Nein" — **zabrana** |

Podizanje gramatičke negacije u ograničenje izmislilo bi zabrane koje proizvođač nikada nije izrekao. Polja su odvojena i validator to proverava.

Uslovi, opsezi i jedinice su očuvani: 64 tvrdnje sa uslovom, 26 sa opsegom (oba kraja), 333 sa jedinicom.

---

## 6. MATCH — sedmostepena lestvica

Naš asortiman: **3 artikla**.

| Naš proizvod | Pouzdanost | Kandidat | Artikal |
| --- | --- | --- | --- |
| Car Fit maskirna folija 4 × 5 m | `exact-name` | Abdeckmaterial mit elektrostatischen Eigenschaften | **1-201-0450** |
| Car Fit prajmer | `ambiguous` | 4 prajmera kod proizvođača | — |
| Car Fit maskirna folija 4 × 150 m | `ambiguous` | 3 kandidata | — |

**Nijedno golo numeričko poklapanje nije prihvaćeno.** Naše šifre (`CARFIT-FILM-4X5M`) i šifre proizvođača (`1-201-0450`) ne dele sistem numerisanja, pa bi svako numeričko preklapanje bilo slučajnost.

Dva zapažanja koja se prosleđuju, a ne rešavaju:

- **„Car Fit prajmer"** je generičan naziv; proizvođač ima `Kunststoffgrundierung`, `2K Epoxid Grundierfüller 1:1`, `2K Washprimer 2:1` i `2K HS Acryl Grundierfüller 4:1`. Nijedan nije izabran.
- **„4 × 150 m"** ne postoji u katalogu proizvođača — postoje 4 × 200 m i 4 × 300 m. Dimenzija nije zaokružena na najbližu.

### Razdvojenost asortimana i kataloga

**112 proizvoda** postoji samo kod proizvođača. Svi nose `catalogStatus: "manufacturer-catalog-candidate"` i `soldByCarsystem: false`. Nijedan nalaz na nivou proizvođača nije tvrdnja da ga Carsystem i R-M prodaje, ima na stanju ili nudi. Validator to proverava.

---

## 7. VERIFY — unakrsna provera sajta i tehničkih listova

**237 poređenja:**

| Klasifikacija | Broj |
| --- | ---: |
| CONSISTENT | 88 |
| WEBSITE_MORE_SPECIFIC | 83 |
| TDS_MORE_SPECIFIC | 41 |
| NOT_COMPARABLE | 12 |
| **VALUE_CONFLICT** | **9** |
| CONDITIONAL_DIFFERENCE | 4 |

**Automatski razrešeno: 0.**

### Devet neslaganja

Sedam su stvarna neslaganja izvora, uglavnom sitne razlike u gustini:

| Proizvod | Sajt | Tehnički list |
| --- | --- | --- |
| Universalverdünner | 900 g/l | 880 g/L |
| Steinschlagschutz | 1460 g/l | 1450 ± 50 g/L |
| Staubschutzlack | 1065 g/l | 1024 g/L |
| Kunststoffspachtel | 1854 g/l | 1858 g/L |
| Carbon-Spachtel | 1820 – 1840 g/l | 1750 – 1800 g/L |
| Multi-Spachtel (VOC) | < 250 g/l | max. 6 g/L |
| 2K Ultra HS Klarlack (EU limit) | 2004/42/IIB(e) | Produktkategorie B/e 840 g/l |

Dva su **artefakti moje ekstrakcije, ne neslaganje izvora**, i tako se prijavljuju:

- `scheibenkleber-schwarz` — kao „gustina" je pročitano „bei 23°C und 50% r.L ≥ 300%", što je zapravo **izduženje**. Sudar labela u višekolonskom rasporedu.
- `pu-kleb-und-dichtmasse` — „bei 23°C 1270 g/L 1240 g/L" su gustine **dve komponente** spojene u jedan red.

Nijedno nije ispravljano u podacima; oba su označena za eksperta.

---

## 8. Kvalitet izvornih podataka — nalazi

Ovo su nalazi o **podacima proizvođača**, ne o parseru:

| Nalaz | Broj | Postupak |
| --- | ---: | --- |
| Naziv i URL slug se ne poklapaju | 49 | slug se ne koristi kao identifikator (koristi se WordPress id) |
| Ćirilični znakovi u latiničnom tekstu | 42 | folded u latinicu, svaki slučaj prebrojan |
| Neispravni linkovi ka dokumentima (`https://./#…`) | 9 | zabeleženi kao praznine |
| Isti broj artikla kod dva proizvoda | 3 | zabeleženo, **nije ispravljano** |
| Proizvod bez ijednog broja artikla | 1 | Ozongenerator |
| Slika bez alt teksta | 122 od 123 | zabeleženo |

### Dupli brojevi artikala kod proizvođača

- `7-401-1000` → 2K UHS LOW VOC Klarlack **i** 2K Ultra HS Klarlack
- `7-401-5000` → isti par
- `9-171-1905` → Montageklebeband PE **i** Doppelseitiges Klebeband

Nije tiho ispravljano. Potrebna je potvrda proizvođača.

### Jezik dokumenata

Naziv fajla tvrdi 108 nemačkih i 1 engleski. **Sadržaj to ne potvrđuje:** 52 nemačka, 56 engleskih, 1 mešoviti. Listovi su često dvojezični. Jezik se detektuje iz sadržaja, a obe vrednosti se čuvaju.

---

## 9. EXPERT PACKAGE

`docs/seo/EXPERT_REVIEW_CARFIT.md` — na srpskom, organizovan **po kategoriji i porodici**, ne kao sirovi ispis polja.

| Stavka | Broj |
| --- | ---: |
| Sirovih tvrdnji | 1.371 |
| **Odluka posle grupisanja** | **1.076** |

Sadrži odvojeno: naše proizvode, zvanične proizvode proizvođača, pouzdana poklapanja, višeznačna poklapanja, kandidate samo kod proizvođača, tvrdnje sa sajta, tvrdnje iz listova, dostupnost SDS-a, slike, tvrdnje na nivou porodice, tvrdnje na nivou varijante, neslaganja i praznine.

Tvrdnje na nivou porodice se prikazuju **prve** u svakoj kategoriji, jer su to one koje recenzent najčešće mora suziti ili odbiti.

---

## 10. VALIDATE

| Provera | Rezultat |
| --- | --- |
| `npm run typecheck` | ✅ prolazi |
| `npm run lint` | ✅ prolazi, 0 upozorenja |
| `npm run build` | ✅ prolazi |
| `npm run knowledge:validate` | ✅ sve provere prolaze |
| `npm run seo:validate` | ✅ 198 URL-ova, 0 grešaka, 0 upozorenja |

**Nijedan validator nije oslabljen.** Dodato je dvanaest invarijanti za C.A.R.FIT:

1. Svaki proizvod proizvođača je `manufacturer-catalog-candidate` i neobjavljen.
2. Viševarijantna stranica mora biti označena kao porodica.
3. Sajt-tvrdnje su `manufacturer-website` / `machine-extracted`.
4. Svaka sajt-tvrdnja ima izvor, sekciju i izvorni tekst.
5. Ograničenje mora imati uporište u izvornom tekstu.
6. Porodična tvrdnja mora pokrivati bar dva artikla.
7. Svaka TDS tvrdnja ima fajl + SHA256 + stranu + citat.
8. TDS tvrdnje su `manufacturer-technical-document` / `machine-extracted`.
9. Opseg se ne sme svesti na jednu vrednost.
10. Poklapanje nije primenjeno na javni katalog; nula golih numeričkih prihvatanja.
11. Nijedno neslaganje nije automatski razrešeno; obe strane sačuvane.
12. Nijedan dokument ni slika nisu u `public/`; nijedan SDS nije klasifikovan kao TDS.

### Provera curenja sa negativnim testom

339 markera (uključujući doslovne citate iz listova) × 832 izgrađene stranice → **0 propusta**.

Negativni test: citat „Zum Mattieren von Oberflächen mit komplexer F" ubačen je u izgrađenu stranicu i validator je pao sa `SIGURNOSNI PROPUST`; posle vraćanja ponovo prolazi. Provera radi nad **izgrađenim HTML-om**.

### Ispravke koje je validacija iznudila

| Nalaz | Priroda | Ishod |
| --- | --- | --- |
| Klasifikacija dala 8 TDS / 108 neklasifikovanih | greška pristupa — naslov nije stabilan | prešlo se na strukturnu klasifikaciju |
| `2,5 l` postalo `5 l` | **greška podataka** — zarez je decimalni separator | deljenje samo po separatorskim zarezima; ceo korpus pročešljan, 0 preostalih |
| 348 → 217 artikala | **greška parsera** — rep regexa gutao sledeći marker | markeri se lociraju pa seče između njih |
| Matcher našao 1 od 3 naša artikla | **greška parsera** — katalog meša dva oblika zapisa | granice zapisa po `slug:` ključu |
| 2 „ograničenja bez uporišta" | greška validatora — „Nein" jeste negacija | rečnik dopunjen |
| 185 nevezanih dokumenata | nepotpuna atribucija | uparivanje po nazivu fajla, 25 dodatno vezano, označene pouzdanosti |

---

## 11. Poznata ograničenja

1. **160 dokumenata ostaje nevezano ni za jedan proizvod.** Stranice na njih ne linkuju, a naziv fajla ne odgovara nijednom od 123 proizvoda jednoznačno. Velikim delom su to engleske verzije i listovi za artikle kojih više nema na sajtu.
2. **5 tehničkih listova su skenirane slike** bez ijednog znaka teksta. Čitanje bi tražilo OCR, što je nova zavisnost i nije uvedena jednostrano.
3. **1 dokument vraća HTTP 404** na sopstvenom sajtu proizvođača (`aerosole-befuellbare-spraydose-sicherheitsdatenblatt.pdf`).
4. **9 linkova ka dokumentima je neispravno u izvoru** (`https://./#…`) — ti listovi se ne mogu preuzeti sa stranice proizvoda.
5. **567 TDS tvrdnji je skromno za 109 listova.** Listovi su složeni u novinskim kolonama koje ekstraktor teksta premešta; deo tabelarnih podataka ostaje van dohvata bez analize rasporeda.
6. **4 tehnička lista nisu dala nijednu tvrdnju** iako imaju tekst.
7. **20 od 123 proizvoda nema nijednu tvrdnju sa sajta** — to su pribor i alati sa samo proznim opisom.
8. **Samo 1 od 3 naša artikla ima pouzdano poklapanje.** To je stvarno stanje, ne neuspeh.
9. **Ćirilični znakovi se folduju pri akviziciji sajta, ali ne i pri ekstrakciji iz PDF-a.** U stručnom paketu je ostao jedan doslovan citat sa `20°С` (ćirilično С). Citat je time veran originalu, ali `20°C` i `20°С` se ne bi grupisali kao ista vrednost. Nedoslednost je poznata i nije sakrivena.

---

## 12. FINALNI STATUS: PARTIAL

Obrazloženje dokazima, ne time što je parser uspešno prošao:

**Šta jeste kompletno:**
- ceo dostupni katalog proizvoda: 123 od 123 stranice obrađeno, 348 artikala;
- sve stranice imaju opis (123/123) i sliku (123/123);
- 302 dokumenta otkrivena i preuzeta, 296 klasifikovano po sadržaju;
- 1.096 + 567 tvrdnji sa punom proverom porekla;
- uparivanje klasifikovano po svih sedam nivoa, bez nateranih poklapanja;
- svih 12 invarijanti prolazi, uz negativni test.

**Zašto nije COMPLETE:**
- 160 od 302 dokumenta (53 %) nije pripisano nijednom proizvodu, pa 72 od 123 proizvoda nema vezan tehnički list;
- 5 listova je nečitljivo bez OCR-a;
- ekstrakcija iz TDS-a je merljivo slabija nego iz stranica (567 naspram 1.096) zbog višekolonskog rasporeda.

**Zašto nije SOURCE-LIMITED:** deo praznina je popravljiv bez novih izvora — bolja atribucija dokumenata i analiza rasporeda PDF-a povećali bi pokrivenost. Ograničenje nije samo u izvoru.

**Zašto nije BLOCKED:** ništa nije sprečilo akviziciju; `robots.txt` dozvoljava, REST API je otvoren, dokumenti su dostupni.

---

## 13. Reproduktivnost

```bash
npm run carfit:pipeline
```

Izvršava: katalog → dokumenti → slike → tvrdnje sa sajta → uparivanje → TDS → unakrsna provera → dosije i stručni paket → validacija.

Keš u `.cache/carfit/` je ubrzanje, a ne ulaz.

---

## 14. Sledeći korak

Stručna provera `docs/seo/EXPERT_REVIEW_CARFIT.md`. Do tada C.A.R.FIT ostaje na nula objavljenih tehničkih tvrdnji.

Norbin i SATA nisu započeti.
