# Urednički vodič — Saveti i vodiči

Obavezan za svakog ko piše, proverava ili odobrava tekst u rubrici. Build (`npm run saveti:build`) automatski proverava deo ovih pravila. Ostala proverava čovek.

## 1. Šta rubrika jeste, a šta nije

- Firma objavljuje proverene stručne tekstove, novosti i odgovore na pitanja. Posetioci ih čitaju.
- Nema komentara, foruma, korisničkih objava, javnih profila ni razgovora sa posetiocima.
- Tekst rešava jedno konkretno pitanje. Ne piše se radi broja reči, ključnih reči ni popunjavanja kalendara.

## 2. Jezik

- Standardni srpski, **latinica, ekavica**, pravilna slova č, ć, š, ž, đ.
- Posetiocu se **persira**, a zamenica se piše velikim slovom: Vi, Vas, Vam, Vaš („Proverite tehnički list Vašeg proizvoda“). Opšte uputstvo može da ide i u bezličnom obliku („Površina se odmašćuje…“).
- Ne koristiti ijekavske, hrvatske, bosanske ni slovenačke oblike: *vrijeme, prije, dio, tijekom, otopina, tlak, zrak, tvrdilo, mlaznica, kist, točno, uputa, sigurnosni list*… Srpski: *vreme, pre, deo, tokom, rastvor, pritisak, vazduh, učvršćivač, dizna, četka, tačno, uputstvo, bezbednosni list*.
- Ne prevoditi doslovno („napraviti razliku“ → „razlikovati se“, „u cilju“ → „da bi“). Proveravati ceo kontekst: reč koja postoji u više jezika nije automatski greška.
- Zaštićeni nazivi proizvoda, robne marke i originalni nazivi dokumenata se ne menjaju (R-M, baslac, Carsystem, C.A.R.FIT, SATA, BEFAR, Cosmos Lac, Norbin, RUPES, „AirTOP“, „RACE WET FILL-R“…). Naziv brenda se piše kako ga piše proizvođač (baslac malim slovom).
- Navodnici: „…“ (srpski). Crtica u rasponu: 20–25 °C. Između broja i jedinice ide razmak: 20 °C, 60 min, 2 bara.
- Terminologija: [TERMINOLOGIJA.md](TERMINOLOGIJA.md). Ako izvor koristi drugi izraz, u zagradi se navodi jednom: „punilac (filer)“.

## 3. Struktura teksta

Prilagođava se pitanju. Gde ima smisla:

1. **Kratak neposredan odgovor**: prvi pasus, 2–4 rečenice, bez uvoda tipa „U današnje vreme…“.
2. Zašto je tema važna: samo ako to nije očigledno.
3. Provereni koraci ili objašnjenje.
4. Najčešće greške u radu. Pravilo za reč „najčešći“ je u odeljku 4.
5. Ograničenja: kada savet ne važi, kada treba pitati proizvođača ili stručnjaka.
6. Dodatna pitanja sa kratkim odgovorima, kao `###` podnaslovi ispod `## Pitanja i odgovori`. **FAQ označavanje se ne koristi.**
7. Povezani vodiči: u frontmatter-u `povezani`, a po potrebi i kao link u tekstu.
8. Proizvodi iz kataloga: `proizvodi` u frontmatter-u, samo kada su stvarno relevantni.

- Novost se piše kao vest, a ne po šablonu vodiča: šta je objavljeno, kada, ko je objavio, na koje tržište se odnosi, šta je u našem programu i šta nije potvrđeno.
- Bez praznih zaključaka („Nadamo se da vam je ovaj tekst pomogao…“).
- Bez izmišljenog iskustva firme, testova, izjava stručnjaka, rezultata rada i autorstva.

## 4. Tehnička tačnost

- **Podatak o konkretnom proizvodu** (odnos mešanja, vreme upotrebljivosti, vreme sušenja, temperatura, debljina sloja, dizna, pritisak, VOC, kompatibilnost) navodi se samo uz izvor za **taj proizvod i tu verziju dokumenta**. U tekstu ide citat `[^id-izvora]`, a izvor u frontmatter-u ima `verzija` kada je dokument navodi.
- Build odbija pasus, stavku ili red tabele koji ima vrednost sa jedinicom (°C, min, h, %, µm, bar, 2:1…) bez citata u istom bloku.
- Podaci se ne prenose sa jednog proizvoda na drugi. Ako dva proizvoda imaju različite vrednosti, tako se i piše: „za lak A tehnički list navodi…, za lak B…“.
- Treba razlikovati **preporuku proizvođača** („tehnički list navodi…“) od **opšteg objašnjenja postupka** („Odmašćivanje se radi pre brušenja da se nečistoća ne bi utrljala u površinu“).
- Kod mogućih uzroka greške ne tvrdi se sigurna dijagnoza. Formulacija je „mogući uzroci“, uz korake provere i napomenu da konačan uzrok zavisi od podloge, materijala i uslova rada.
- Ako izvor nedostaje ili su podaci protivrečni: tema dobija `strucnaPotvrda.potrebna: true` sa razlogom i **ne zakazuje se**. Praznine se ne popunjavaju pretpostavkom.
- „Najčešći“, „najtraženiji“ i slično pišu se samo uz dokaz. U suprotnom: „čest problem u praksi“ uz izvor, ili „urednička procena“.
- Bezbednost na radu, propisi i otpad: samo prema bezbednosnom listu, zvaničnom propisu ili zvaničnom izvoru (EUR-Lex, Pravno-informacioni sistem RS, EU-OSHA, proizvođač). Ako propis za Srbiju nije proveren, piše se da obaveze treba proveriti prema važećim propisima, bez izmišljanja člana zakona.

## 5. Izvori

- Prvenstveno zvanični izvori proizvođača: tehnički i bezbednosni listovi, katalozi, uputstva, stranice proizvoda, vesti, edukativni materijal.
- Lokalni dokumenti su u `public/documents/products/<brend>/…`. U frontmatter-u se navode kao `dokument`, uz `url` zvaničnog izvora kada postoji.
- Javne diskusije (forumi, Q&A) služe **samo** kao dokaz da se pitanje postavlja (`poreklopitanja`), nikada kao izvor tehničkog odgovora.
- Tekstovi drugih proizvođača (koji nisu u našem programu) mogu da posluže kao opšta stručna pozadina samo uz jasno pripisivanje. Ne preporučuju se njihovi proizvodi.
- Ne prepisivati tuđe tekstove. Citat je najviše jedna kratka rečenica, pod navodnicima i uz izvor. Sve ostalo je sopstveno objašnjenje.
- Slike se ne preuzimaju sa interneta. Rubrika za sada koristi samo podrazumevanu sliku sajta.
- Svaki izvor ima `pristupljeno` (datum kada je stvarno otvoren) i `tip`.

## 6. Brendovi i pravna bezbednost

- **Ne pominju se:** 3M, sia, Molotow (nisu u programu firme).
- Ne koriste se formulacije „zvanični distributer“, „ovlašćeni zastupnik“ i „ekskluzivni partner“. Bezbedne formulacije: „brendovi u ponudi“, „u našem programu“, „profesionalni refinish program“, „tehnička podrška“.
- **BASF / Surventis:** do 30. 6. 2026. refinish brendovi R-M, baslac i Norbin pripadali su BASF Coatings. Prodaja fondovima kompanije Carlyle (uz QIA) objavljena je 10. 10. 2025, a zatvorena 30. 6. 2026. Od 1. 7. 2026. kompanija posluje samostalno pod imenom **Surventis**. Događaj se opisuje imenom koje je važilo kada se desio („BASF Coatings je 2025. objavio…“). Dokument se navodi pod svojim originalnim nazivom. Norbin sajt i ambalaža i dalje nose oznake BASF (provereno 2026-09-18 i 2026-10-08), pa se njegov identitet ne menja dok ga proizvođač ne promeni.
- **Carsystem** je robna marka firme VOSSCHEMIE GmbH (Uetersen). **C.A.R.FIT** je August Handel GmbH. Ne pisati da imaju istog vlasnika.
- **RUPES**: samo proizvodi koji postoje u našem programu („RUPES proizvodi iz Carsystem programa“).
- **Dostupnost u Srbiji:** globalna objava ne znači dostupnost kod nas. Ako proizvod nije u našem katalogu ili dostupnost nije potvrđena, to se jasno kaže i ne poziva se na kupovinu.

## 7. Novosti

- Obavezno: datum događaja (`datumDogadjaja`), datum objave izvora (`datumObjaveIzvora`, ako se razlikuje), tržište (`trziste`), `dostupnostUSrbiji`, `istorijska`, `proveraVaziDo`.
- Datum događaja se navodi i u samom tekstu („R-M je 24. oktobra 2025. objavio…“).
- Istorijska vest dobija `istorijska: true` i u tekstu se tako i predstavlja. Stara vest se nikada ne predstavlja kao nova samo zato što je danas objavljujemo.
- `proveraVaziDo`: najkasnije 60 dana od provere. Posle tog dana novost se ne objavljuje dok se ponovo ne proveri.

## 8. SEO

- `naslov` (H1): jasan, prirodan, 15–110 znakova.
- `metaNaslov`: najviše 58 znakova, jedinstven. Sistem dodaje „| Carsystem i R-M“.
- `opis`: 70–160 znakova, jedinstven, opisuje šta čitalac dobija.
- `slug`: kratak, čitljiv, bez dijakritika, stabilan (ne menja se posle objave).
- Podnaslovi: samo `##` i `###`, logičnim redom.
- Interni linkovi: ka postojećim stranama (`/proizvodi/<slug>`, `/proizvodi/grupa/<slug>`, `/brendovi/<slug>`, `/kategorije/<slug>`, `/program/<slug>`, `/katalog?brend=…`, `/vodici/<slug>`). Link ka članku koji još nije objavljen prikazuje se kao običan tekst.
- Bez gomilanja ključnih reči. Dva teksta ne smeju ciljati isto pitanje: build upoređuje glavna pitanja i preklapanje teksta.

## 9. Statusi i odgovornost

| Polje | Ko ga menja | Značenje |
| --- | --- | --- |
| `status.pisanje: napisano` | pisac | tekst je kompletan |
| `status.tehnickaProvera: provereno` | recenzent (urednička provera, AI-asistirana) | svaka tvrdnja je upoređena sa navedenim izvorom |
| `status.jezickaProvera: provereno` | recenzent | jezik, pravopis, persiranje, terminologija |
| `strucnaPotvrda` | recenzent | `potrebna: true` kada izvor nedostaje ili je protivrečan; tema se ne zakazuje |
| `odobrenje` | **samo imenovana osoba iz firme**, kroz `npm run saveti:odobri` | jedino odobrenje koje dozvoljava objavu; vezano za otisak teksta |

Urednička i AI-asistirana provera **nije stručno odobrenje**. Objavljuje se samo tekst koji je odobrila imenovana osoba.
