# NORBIN — IZVEŠTAJ O AKVIZICIJI ZNANJA

**Brend:** NORBIN® · **Vlasnik brenda:** BASF Coatings GmbH · **Izvor:** norbin-paint.com
**Datum:** 2026-08-08
**Status objave:** ništa nije objavljeno; nula tvrdnji ima status `expert-verified`

**FINALNI STATUS: SOURCE-LIMITED** — obrazloženje u § 11.

---

## 1. DISCOVER — vlasništvo brenda je provereno, ne pretpostavljeno

Prethodni signal je bio da Norbin „možda pripada BASF ekosistemu". Provereno je na izvoru, a ne po sekundarnim izveštajima:

- footer svake regionalne stranice: „NORBIN® is a registered Trademark of BASF Coatings GmbH", uz „© BASF Coatings GmbH 2026";
- brošura `NORBIN_Broch_EN_2024_mai.pdf`: „A brand of BASF";
- tehnički listovi nose oznaku generatora `MPV 4.x` — isti BASF sistem za generisanje dokumenata.

**Potvrđeno:** NORBIN je BASF-ov brend vrednosnog segmenta, uz Glasurit, R-M i baslac.

### Arhitektura izvora — najjednostavnija do sada, i različita od BASF srodnika

| Provera | Nalaz |
| --- | --- |
| `robots.txt` | **404** — ne postoji |
| `sitemap.xml` | **404** — ne postoji |
| CMS / REST API | nema (WordPress `wp-json` vraća 404 stranicu) |
| `techinfo.norbin-paint.com` | 301 na samog sebe — nema tehničkog portala |
| Struktura | statički HTML, jedna `norbin-range.html` po regionu |
| Stranice proizvoda | **ne postoje** |
| Fotografije proizvoda | **ne postoje** |

**baslac/R-M parser nije ponovo iskorišćen.** Ta dva brenda imaju tehnički portal sa endpointom po šifri (`techinfo.baslac.com/en/{code}.pdf`). NORBIN nema ništa slično — stranica opsega **jeste** katalog, sa direktnim linkovima ka svakom dokumentu.

Gramatika stranice, identična u svim regionima:

```
<h3>Downloads</h3>   brošura, tehnički poster
<h4>TDS</h4>         jedan link po proizvodu — "NORBIN® N15-020 Clear"
<h4>MSDS</h4>        jedan link po pakovanju — "… N15-020 Clear 1L"
```

Tekst linka nosi šifru i zvanični naziv; MSDS blok je mesto gde su nabrojane varijante pakovanja.

---

## 2. Regionalna slika — i praznina koja se nas direktno tiče

Proizvođač sam kaže: „Our offer may differ from country to country due to local market requirements and legislation." To je provereno na svih 6 EMEA regiona:

| Region | Objavljen | TDS linkova | MSDS linkova | Zakomentarisano |
| --- | --- | ---: | ---: | ---: |
| **tr** (Turska) | da | 13 | 23 | 33 |
| **en** (EMEA) | da | 7 | 17 | 2 |
| **kz** (Kazahstan) | da | 1 | 4 | 0 |
| **me** (Crna Gora) | **ne** | 0 | 0 | 0 |
| **de** (Nemačka) | **ne** | 0 | 0 | 0 |
| **pl** (Poljska) | **ne** | 0 | 0 | 0 |

Tri regionalna sajta nisu objavljena — njihove stranice sadrže doslovno **„Inhalte ME"**, **„Inhalte DE"**, **„Inhalte PL"** (nemački za „sadržaj ME/DE/PL"), tj. nedovršene čuvare mesta.

**Crna Gora je regionalno najbliži sajt našem tržištu i on ne postoji.** Nema regionalnog izvora koji bi rekao šta se od NORBIN programa nudi u našem okruženju.

---

## 3. ACQUIRE

| Stavka | Broj |
| --- | ---: |
| Proizvoda (šifara) | **24** |
| — objavljenih | 18 |
| — samo u zakomentarisanom kodu | 6 |
| Varijanti (pakovanja) | 22 |
| Dokumenata otkriveno | **102** |
| — tehnički listovi (TDS) | 24 |
| — bezbednosni listovi (SDS) | 72 |
| — brošura | 1 |
| — tehnički poster | 1 |
| — pokvarenih linkova (HTTP 404) | 4 |
| Jedinstvenih po sadržaju | 98 |
| Stranica proizvoda | **0** — izvor ih nema |
| Slika proizvoda | **0** — izvor ih nema |

Ukupno 45 MB u `assets/manufacturer/norbin/`, **van `public/`**.

### Zakomentarisani sadržaj

35 dokumenata je **zakomentarisano u HTML-u** samog proizvođača (`<!-- <a href="--><!--files/TDS/TR/…-->`). Proizvođač ih je namerno sklonio sa stranice.

Zabeleženi su kao `unlinked-in-source` i **nikada se ne računaju kao objavljena ponuda**. Provereno je i da li fajlovi postoje: svih 35 je i dalje dostupno na serveru. To je zabeleženo, a ne ispravljano — 6 proizvoda postoji isključivo u tom skrivenom sloju.

### Klasifikacija po sadržaju, ne po fascikli

Fascikla `TDS/` odnosno `MSDS/` je konvencija arhiviranja, ne dokaz. Klasifikacija čita strukturu dokumenta (numerisane regulatorne sekcije i H/P oznake → SDS; blokovi primene i podloge → TDS). Samo **3** dokumenta je klasifikovano rezervom po fascikli i tako je i označeno.

---

## 4. Gramatika tehničkih listova — proučena pre parsera

Listovi su generisani BASF-ovim `MPV` sistemom i imaju sopstveni oblik:

```
<pravni boilerplate — identičan u svih 24 lista>
Technical Information
NORBIN Clear / N15-020
JSON created 2022-01-11T11:09:38+0000, MPV 4.0     ← oznaka generatora
Application:              2K clear coat for all basecoat finishes.
Storage temperature
5-40 °C
2:1                       ← odnos mešanja stoji IZNAD svoje labele
Mixing Ratio
N75-021 NORBIN Hardener Normal
Spray viscosity at 20°C   ← uslov je U SAMOJ LABELI
DIN 4:                    ← metod merenja
16-18 s                   ← tek ovo je vrednost
    HVLP spray gun        Compliant gravity-feed spray gun
Nozzle size    1.3        1.3-1.4
```

### Pet stvari koje bi naivni parser pogrešio

1. **Pravni boilerplate je duži od tehničkog sadržaja** i ponavlja se u svakom listu. Uklonjen je pre čitanja; u finalnom skupu ima **0** tvrdnji iz boilerplate-a.
2. **`JSON created …, MPV 4.0`** izgleda tačno kao `Label: value` par i pojavio se 12 puta u popisu labela. To je pečat generatora, ne podatak o proizvodu.
3. **Uslov je u labeli** — `Spray viscosity at 20°C`. Prva verzija je proveravala običan obrazac pre uslovnog i progutala temperaturu; sada je 19 tvrdnji sa uslovom.
4. **Metod merenja stoji između labele i vrednosti** — `Spray viscosity at 20°C` / `DIN 4:` / `16-18 s`. Prva verzija je zabeležila viskozitet kao „DIN 4:". Sada: vrednost `16-18 s`, metod `DIN 4`, uslov `at 20°C`.
5. **Tabela ima jednu kolonu po tipu pištolja.** Dve vrednosti se jednoznačno mapiraju na dve kolone; jedna vrednost ne kaže kojoj opremi pripada.

### Nazivi kolona se čitaju iz dokumenta

Engleski listovi imaju `HVLP spray gun` i `Compliant gravity-feed spray gun`. **Turski imaju `HVLP tabanca` i `Konvansiyonel tabanca`** — *konvencionalni* pištolj, što nije ista oprema. Fiksiranje engleskog naziva bi pogrešno označilo svaki turski red. Sada se prepoznaju sve četiri kolone posebno.

---

## 5. EXTRACT

| Stavka | Broj |
| --- | ---: |
| Obrađenih listova | 24 |
| Sa bar jednom tvrdnjom | 23 |
| **Tehničkih tvrdnji** | **301** |
| Tipizovanih | 285 |
| Sa jedinicom | 161 |
| Sa opsegom (oba kraja) | 92 |
| Sa uslovom | 19 |
| Sa metodom merenja | 5 |
| Vezano za tip pištolja | 38 |
| Označeno kao neodređeno po opremi | 33 |
| Iz boilerplate-a | **0** |
| Sa dokazom u vidu strane | **301 / 301** |

Sve `machine-extracted`, `sourceType: manufacturer-technical-document`, sa fajlom, SHA256, stranom i doslovnim citatom.

### Model porodica/varijanta/komponenta

Šifra nosi porodicu: `N15` bezbojni lakovi · `N55` prajmeri i fileri · `N60` kitovi · `N75` očvršćivači · `N85` razređivači · `N95` sredstva za čišćenje.

**21 veza proizvod↔komponenta je deklarisana u samim tehničkim listovima**, ne izvedena iz naziva. Primer: `N15-020` se meša **2:1** sa `N75-021 NORBIN Hardener Normal` ili `N75-022 NORBIN Hardener Slow` — dva očvršćivača za isti lak, dakle više-na-više veza.

---

## 6. MATCH

Naš asortiman: **3 artikla**.

| Naš proizvod | Pouzdanost | Zvanični proizvod | Pakovanje |
| --- | --- | --- | --- |
| Norbin N15-020 5 L | **`exact-code`** | `N15-020` Clear | 5 L potvrđeno kod proizvođača |
| Norbin N15-020 1 L | **`exact-code`** | `N15-020` Clear | 1 L potvrđeno kod proizvođača |
| Norbin 2K bezbojni lak | `ambiguous` | 3 kandidata | — |

NORBIN je prvi brend gde naši zapisi nose **šifru proizvođača**. To je stvarno tačno poklapanje: `N15-020` pripada proizvođačevoj `N##-###` šemi, a ne lokalnoj šifri koja slučajno sadrži cifre. **Golo numeričko poklapanje nije prihvaćeno nigde.**

Dva naša zapisa su **jedan proizvod u dva pakovanja**, ne dva proizvoda — veličina pakovanja je potvrda, ne identitet.

„Norbin 2K bezbojni lak" je generički naziv; kandidati su `N15-020 Clear`, `N15-V20 Clear VOC`, `N15-V25 Fast Clear VOC`. Nijedan nije izabran.

**21 proizvod postoji samo kod proizvođača**, svi sa `catalogStatus: "manufacturer-catalog-candidate"` i `soldByCarsystem: false`.

---

## 7. Kompletnost dosijea (24 proizvoda proizvođača)

| Kriterijum | Ispunjeno |
| --- | ---: |
| Zvanični naziv | 18 / 24 |
| Tehnički list | 15 / 24 |
| Bezbednosni list | 18 / 24 |
| Tehničke tvrdnje | 15 / 24 |
| Varijante (pakovanja) | 16 / 24 |
| **Slika proizvođača** | **0 / 24** |
| **Opis sa sajta** | **0 / 24** |
| **Potpuno kompletnih** | **9 / 24** |

Nula slika i nula opisa nije praznina u obradi — **izvor ih ne objavljuje**. NORBIN nema stranice proizvoda; jedini opisni tekst je polje `Application:` unutar tehničkog lista, koje je izvučeno kao tvrdnja.

---

## 8. Nalazi o kvalitetu izvornih podataka

| Nalaz | Broj | Postupak |
| --- | ---: | --- |
| Neobjavljeni regionalni sajtovi („Inhalte XX") | 3 | zabeleženo |
| Zakomentarisanih dokumenata | 35 | zabeleženo kao `unlinked-in-source` |
| Proizvoda samo u zakomentarisanom sloju | 6 | ne računaju se kao ponuda |
| Pokvarenih linkova (HTTP 404 na sopstvenom sajtu) | 4 | zabeleženo |
| Zvanični naziv na ruskom umesto engleskog | 1 | ispravljen izbor izvora, ne podatak |

Četiri pokvarena linka: `files/TDS/TR/N55-121_TR.pdf`, `N75-121_TR.pdf`, `N85-120_TR.pdf`, `N85-121_TR.pdf` — aktivno linkovani sa turske stranice, ali vraćaju 404.

Nijedna greška proizvođača nije tiho ispravljena.

---

## 9. Stručni paket

`docs/seo/EXPERT_REVIEW_NORBIN.md` — na srpskom, grupisan po porodici → proizvodu → varijanti/komponenti, sa deljenim dokumentima, neodređenim mapiranjima i kandidatima samo kod proizvođača.

Za svaki naš proizvod prikazano je: NAŠ PROIZVOD, ZVANIČNI PROIZVOD, ŠIFRA, POKLAPANJE, ZVANIČNI OPIS, SLIKA, WEBSITE CLAIMS, TDS, SDS, TEHNIČKE TVRDNJE, PODLOGE/NAMENA, POVEZANI PROIZVODI, NESLAGANJA, ŠTA NEDOSTAJE — uz akcije `[ ] POTVRDI  [ ] ISPRAVI  [ ] ODBACI  [ ] DODATI U NAŠU PONUDU`.

Korpus je mali (24 proizvoda), pa su svi prikazani u celini, bez uzorkovanja.

---

## 10. Validacija

| Provera | Rezultat |
| --- | --- |
| `npm run typecheck` | ✅ prolazi |
| `npm run lint` | ✅ prolazi, 0 upozorenja |
| `npm run build` | ✅ prolazi |
| `npm run knowledge:validate` | ✅ sve provere prolaze |
| `npm run seo:validate` | ✅ 198 URL-ova, 0 grešaka, 0 upozorenja |

Svi postojeći validatori su zadržani. Dodato je 9 invarijanti specifičnih za NORBIN:

1. Svaki proizvod je `manufacturer-catalog-candidate`, neprodavan i neobjavljen.
2. Svaki proizvod ima jasan status objavljenosti (`live` ili `unlinked-in-source`).
3. „Objavljen" proizvod mora imati bar jedan region.
4. Svaka tvrdnja ima fajl + SHA256 + stranu + citat.
5. Nijedna tvrdnja nije iznad `machine-extracted`.
6. **Nijedna tvrdnja ne potiče iz pravnog boilerplate-a ni oznake generatora.**
7. **Tvrdnja o opremi mora biti ili vezana za tip pištolja ili označena kao neodređena** — nikada tiho primenjena na oba.
8. Opsezi zadržavaju oba kraja.
9. Veza mešanja ne sme pokazivati na sam proizvod.

### Provera curenja sa negativnim testom

74 markera × 832 izgrađene stranice → **0 propusta**. Negativni test: citat `Application: 2K clear coat for all basecoat f` ubačen u izgrađenu stranicu → validator pao sa `SIGURNOSNI PROPUST`; posle vraćanja ponovo prolazi.

### Ispravke koje je validacija iznudila

| Nalaz | Priroda | Ishod |
| --- | --- | --- |
| **Bezbojni lak uparen sa očvršćivačem** | greška uparivanja — „Clear Hardener" sadrži „Clear" | koncept dobio `exclude` za komponente; dodata invarijanta 9 |
| 16 tvrdnji o opremi bez oznake | greška obuhvata — turska zaglavlja kolona nisu prepoznata | nazivi kolona se čitaju iz dokumenta; vezanih za opremu 12 → 38 |
| Viskozitet zabeležen kao „DIN 4:" | **greška podataka** — metod merenja uzet kao vrednost | metod se izdvaja zasebno |
| Uslovi = 0 | greška redosleda — obični obrazac pre uslovnog | uslovnih tvrdnji sada 19 |
| Zvanični naziv „Лак N15-020" | greška izbora izvora — kazahstanska verzija prepisala englesku | engleski naziv je referentni |
| Brošure = 0 | greška selektora — „Downloads" je `<h3>`, tražen `<h4>` | brošura i poster preuzeti |
| 10 „dokumenata" tipa imprint/legal/Facebook | greška granice sekcije — MSDS blok je poslednji `<h4>` pa je tekao do futera | prihvataju se samo `.pdf` linkovi |

---

## 11. FINALNI STATUS: SOURCE-LIMITED

Obrazloženje dokazima:

**Šta je kompletno obrađeno:**
- svih 6 EMEA regionalnih sajtova ispitano, sva 3 objavljena obrađena u celini;
- svih 24 šifara, 22 varijante, 102 dokumenta otkrivena i preuzeta;
- svih 24 tehnička lista pročitano; 301 tvrdnja sa punom proverom porekla;
- 21 veza proizvod↔komponenta deklarisana od proizvođača, ne izvedena;
- 2 od 3 naša artikla imaju **tačno poklapanje po šifri** sa potvrđenim pakovanjem;
- svih 9 invarijanti prolazi, uz negativni test.

**Zašto je SOURCE-LIMITED, a ne PARTIAL:**

Preostale praznine nisu neurađen posao — one su odsustvo sadržaja kod proizvođača:

- **0 slika i 0 opisa proizvoda** jer sajt nema stranice proizvoda. Nema šta da se preuzme.
- **3 od 6 regionalnih sajtova nisu objavljena**, uključujući Crnu Goru — jedini regionalno relevantan izvor za naše tržište ne postoji.
- **9 od 24 proizvoda nema tehnički list** kod proizvođača.
- **4 linka vraćaju 404** na sajtu proizvođača.
- **6 proizvoda postoji samo u zakomentarisanom kodu** — proizvođač ih je povukao sa stranice.

Nijedna od ovih praznina se ne može zatvoriti boljom obradom postojećih dokaza; sve traže da proizvođač objavi sadržaj koji trenutno ne objavljuje.

**Zašto nije COMPLETE:** 9 proizvoda bez tehničkog lista i tri neobjavljena regiona znače da slika programa nije potpuna.

**Zašto nije BLOCKED:** ništa nije sprečilo akviziciju — nema `robots.txt` ograničenja, svi objavljeni dokumenti su preuzeti.

---

## 12. Reproduktivnost

```bash
npm run norbin:pipeline
```

Izvršava: katalog → dokumenti → TDS ekstrakcija → uparivanje → dosije i stručni paket → validacija.

Keš u `.cache/norbin/` je ubrzanje, a ne ulaz.

---

## 13. Sledeći korak

Stručna provera `docs/seo/EXPERT_REVIEW_NORBIN.md`. Do tada NORBIN ostaje na nula objavljenih tehničkih tvrdnji.

SATA nije započet.
