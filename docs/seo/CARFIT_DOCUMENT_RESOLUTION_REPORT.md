# C.A.R.FIT — IZVEŠTAJ O RAZREŠAVANJU DOKUMENATA

**Faza:** C.A.R.FIT Phase 2 — povezivanje dokumenata i kompletiranje dosijea
**Brend:** C.A.R.FIT · **Proizvođač:** August Handel GmbH
**Datum:** 2026-08-08
**Status objave:** ništa nije objavljeno; nula tvrdnji ima status `expert-verified`

**FINALNI STATUS: PARTIAL** — obrazloženje u § 12.

---

## 1. Šta je bilo usko grlo

Faza 1 je dokumente vezivala za proizvode na dva načina: linkom sa stranice proizvoda (117) i, kada toga nema, poklapanjem naziva fajla (25). Ostalo je 160 nepovezanih od 302, i 72 od 123 proizvoda bez tehničkog lista.

Uzrok nije bio kvalitet ekstrakcije. Naziv fajla je najslabiji signal koji ovaj korpus nudi, a nijedan drugi nije bio korišćen.

---

## 2. Indeks identiteta dokumenata

`npm run carfit:index` → `carfit-document-identity.generated.json`

Za svih 302 dokumenta prikupljeni su svi raspoloživi signali identiteta, ne samo naziv:

| Signal | Dokumenata |
| --- | ---: |
| **Brojevi artikala u tekstu** | **231** |
| Interni naslov PDF-a | 192 |
| Naziv proizvoda u nazivu/naslovu | 122 |
| Revizija / datum izdanja | 70 |
| Zaglavlje prve strane | 296 |
| WordPress metapodaci priloga | 302 |
| SHA256 | 302 |

Za poređenje: naziv fajla je u fazi 1 razrešio **25** dokumenata. Broj artikla ih nosi **231**.

Uz to su detektovani:
- **6 duplikata** po sadržaju (isti bajtovi, različito ime),
- **jezik iz sadržaja**: 148 nemačkih, 145 engleskih, 1 mešovit, 1 francuski, 7 neodređenih,
- **uloga komponente** iz internog naslova: 26 očvršćivač, 5 razređivač, 271 osnovni proizvod.

---

## 3. Katalog 2026 kao izvor za razrešavanje entiteta

Zvanični katalog (48 strana) je parsiran u registar artikala:

| Stavka | Broj |
| --- | ---: |
| Redova artikala | 296 |
| Različitih brojeva artikala | 293 |
| Imenovanih porodica | 56 |
| Trojezičnih EN/DE/FR parova naziva | 66 |

Katalog eksplicitno razdvaja proizvod od njegove komponente:

```
4-240-1000  2K US Filler, 1L, Grey     ← osnovni proizvod
4-241-0250  Hardener, 0.25L            ← očvršćivač iste porodice
```

**Marketinški tekst iz kataloga se ne koristi kao tehnički dokaz.** Redovi registra nose zasebnu provenijenciju `manufacturer-catalogue`.

### Trojezični most naziva

Katalog štampa `EN` / `DE` / `FR` markere iznad istog naziva porodice na tri jezika. To je prevod samog proizvođača, i on rešava najveći deo problema: polovina korpusa je engleska, a sve stranice proizvoda su nemačke, pa engleski list „Rapid Air Clear Coat VOC" nije mogao da nađe nemačku stranicu „Rapid Air Klarlack VOC".

---

## 4. Razrešavanje — broj artikla prvi

`npm run carfit:resolve` → `carfit-document-resolution.generated.json`

Redosled signala: **link sa stranice proizvođača → broj artikla → katalog → most naziva → naziv**.

Veza je namerno **više-na-više**: jedan list legitimno pokriva više pakovanja, više boja, celu porodicu ili proizvod zajedno sa očvršćivačem.

### Stanja

| Stanje | Dokumenata |
| --- | ---: |
| `EXACT_PRODUCT` | 216 |
| `EXACT_COMPONENT` | 10 |
| `FAMILY_LEVEL` | 8 |
| `MULTI_PRODUCT` | 0 |
| `PROBABLE` | 21 |
| `UNRESOLVED` | 34 |
| `IMAGE_ONLY_SCAN` | 1 |
| `UNRESOLVED_SCAN` | 4 |
| `DUPLICATE` | 6 |
| `NON_PRODUCT` | 2 |
| **Ukupno** | **302** |

`PROBABLE` nikada ne postaje `EXACT` prećutno — čuva se dokaz i oznaka pouzdanosti (`name-only`, `catalogue-name-bridge`, `role-conflict`).

---

## 5. Komponentno vezivanje

10 dokumenata je vezano za komponentu, ne za osnovni proizvod:

| Dokument | Vezan za | Komponenta |
| --- | --- | --- |
| `C.A.R.FIT-Haerter-fuer-2K-HS-Acryl-Grundierfueller-41-_DE_de.pdf` | 2K HS Acryl Grundierfüller 4:1 | očvršćivač |
| `car-fit-matt-klarlack-haerter-sicherheitsdatenblatt.pdf` | Matt Klarlack | očvršćivač |
| `car-fit-2k-washprimer-21-aktivator-sicherheitsdatenblatt.pdf` | 2K Washprimer 2:1 | očvršćivač |
| … i još 7 | | |

Bez ovoga bi list za očvršćivač pozajmio svoje vrednosti proizvodu koji očvršćava — greška klase „gustina bezbojnog laka → očvršćivač". Invarijanta 15 je proverava.

Uloga komponente se čita iz **naslova dokumenta**, ne iz tela strane. Prva verzija je skenirala celu prvu stranu i proglasila `Zink-Spray` razređivačem, jer svaki dvokomponentni list pominje razređivač u uputstvu za mešanje. To je dalo 29 lažnih konflikata uloge; posle ispravke ih je 6.

---

## 6. BEFORE / AFTER

### Dokumenti

| Metrika | Pre | Posle |
| --- | ---: | ---: |
| Povezano sa proizvodom | 142 | **254** |
| — pouzdano (`EXACT`/`FAMILY`) | 142 | **232** |
| — verovatno (`PROBABLE`) | 0 | 21 |
| — skenirano, samo identitet | 0 | 1 |
| Nepovezano | **160** | **38** |
| Duplikati prepoznati | 6 (nekorišćeno) | 6 (isključeno iz pokrivenosti) |
| Skenovi identifikovani | 0 | 1 (od 5) |
| Nije proizvodna dokumentacija | 1 | 2 |

### Proizvodi — pun katalog proizvođača (123)

| Metrika | Pre | Posle |
| --- | ---: | ---: |
| Sa tehničkim listom | 51 | **55** |
| Sa bezbednosnim listom | 54 | **57** |
| Sa tvrdnjama iz TDS-a | 48 | **52** |
| Sa slikom proizvođača | 123 | 123 |
| Sa opisom proizvođača | 123 | 123 |
| Sa tvrdnjama sa sajta | 103 | 103 |
| **Kompletan dosije** | **51** | **55** |

### Naš asortiman (3 artikla)

| Naš proizvod | Poklapanje | Dokumenti |
| --- | --- | --- |
| Car Fit maskirna folija 4 × 5 m | `exact-name` → `1-201-0450` | bez TDS-a (proizvođač ga nema za ovu foliju) |
| Car Fit prajmer | `ambiguous` | nije razrešeno — 4 kandidata |
| Car Fit maskirna folija 4 × 150 m | `ambiguous` | dimenzija ne postoji kod proizvođača |

Faza 2 nije promenila stanje našeg asortimana. Poboljšanje je na nivou kataloga proizvođača.

---

## 7. Zašto proizvod nema tehnički list

Nijedan proizvod se **ne** računa kao dokumentovan zato što drugi proizvod iz njegove kategorije ima dokument.

| Stanje | Proizvoda |
| --- | ---: |
| Ima tehnički list | 55 |
| **D** — samo podaci sa sajta proizvođača | 43 |
| **F** — nema tehničkog dokumenta | 20 |
| **E** — samo bezbednosni list | 3 |
| **B** — deli dokument na nivou porodice | 1 |
| **G** — mapiranje ostaje neodređeno | 1 |
| **A** — postoji nepovezan list koji mu verovatno pripada | 0 |
| **C** — postoji samo dokument za komponentu | 0 |
| **Ukupno** | **123** |

Da **A** iznosi nula je bitan nalaz: posle razrešavanja ne postoji nijedan nepovezan tehnički list za koji imamo dokaz da pripada nekom od preostalih proizvoda. Preostale praznine nisu neurađen posao nad postojećim dokazima.

---

## 8. Duplikati i deljeni dokumenti

- **6 fajlova je bajt-identično** drugom fajlu pod drugim imenom. Označeni su `DUPLICATE` i **isključeni iz pokrivenosti** — isti dokument pod dva imena nije dva nezavisna dokaza. Invarijanta 17 to proverava.
- **8 dokumenata je na nivou porodice** (npr. `car-fit-abdeckklebeband-wasserfest-120c` pokriva dva proizvoda).
- Jezične varijante (DE/EN istog lista) nisu bajt-identične i vode se kao zasebni dokumenti istog proizvoda, što je tačno — sadržaj im se razlikuje jezikom.

---

## 9. Pet skeniranih dokumenata

OCR nije uveden. Za svih 5 pokušan je identitet kroz naziv fajla, metapodatke, link sa stranice i katalog.

**Samo jedan je stvarno identifikovan:**

| Dokument | Identitet | Stanje | Tehnička ekstrakcija |
| --- | --- | --- | --- |
| `car-fit-alu-soft-spachtel-technisches-datenblatt.pdf` | Alu & Soft Spachtel, preko linka sa stranice proizvođača | `IMAGE_ONLY_SCAN` | `UNREADABLE_WITH_CURRENT_PIPELINE` |
| `car-fit-universal-polishing-compound-technical-data-sheet.pdf` | — | `UNRESOLVED_SCAN` | `UNREADABLE_WITH_CURRENT_PIPELINE` |
| `car-fit-alu-soft-putty-technical-data-sheet.pdf` | — | `UNRESOLVED_SCAN` | `UNREADABLE_WITH_CURRENT_PIPELINE` |
| `car-fit-2k-uhs-low-voc-clearcoat-technical-data-sheet.pdf` | — | `UNRESOLVED_SCAN` | `UNREADABLE_WITH_CURRENT_PIPELINE` |
| `car-fit-2k-ms-clearcoat-industrial-use-technical-data-sheet.pdf` | — | `UNRESOLVED_SCAN` | `UNREADABLE_WITH_CURRENT_PIPELINE` |

Prva verzija ovog koraka prijavila je **svih 5 kao identifikovane**, jer je svaki neprazan interni naslov PDF-a računala kao identitet. Naslovi su, međutim, ostaci iz alata za izvoz:

- `dsaas (1).pdf`
- `Catalogue final 27 April.pdf`
- `CARFIT Catalogue 2020.pdf` (dva puta)

Nijedan ne govori koji proizvod dokument opisuje. Pravilo je pooštreno: identitet traži link sa stranice ili naziv proizvoda, ne bilo kakav neprazan naslov.

**Nijedna tehnička tvrdnja nije izvedena ni iz jednog od pet.** Invarijanta 18 to proverava, i jedna ranija verzija razrešavača ju je narušila: skenirani dokument povezan linkom prolazio je kroz „link" granu i dobijao `countsAsEvidence: true`. Ispravljeno tako da se čitljivost proverava pre svih puteva povezivanja.

---

## 10. Tvrdnje su prevezane, ne ponovo izvučene

Ekstrakcija nije ponovljena — isti tekst daje iste vrednosti. Promenjena je samo veza: proizvod, komponenta i brojevi artikala sada dolaze iz razrešavanja.

| Metrika | Pre | Posle |
| --- | ---: | ---: |
| TDS tvrdnji | 567 | 567 |
| Dokumenata koji se računaju kao dokaz | — | 93 |
| Proizvoda sa TDS tvrdnjama | 48 | **52** |
| Poređenja sajt ↔ TDS | 237 | **440** |
| Neslaganja | 9 | **16** |

Sva provenijencija je očuvana: fajl, SHA256, strana, doslovan citat. Više povezanih dokumenata znači i više poređenja, pa i više otkrivenih neslaganja — nijedno nije automatski razrešeno.

**„Ostale specifikacije" nisu normalizovane** samo da bi brojka izgledala bolje. Nijedna retka labela nije uvedena u strukturirano polje bez jasnog značenja i stabilne jedinice.

---

## 11. Validacija

| Provera | Rezultat |
| --- | --- |
| `npm run typecheck` | ✅ prolazi |
| `npm run lint` | ✅ prolazi, 0 upozorenja |
| `npm run build` | ✅ prolazi |
| `npm run knowledge:validate` | ✅ sve provere prolaze |
| `npm run seo:validate` | ✅ 198 URL-ova, 0 grešaka, 0 upozorenja |

**Svih 12 invarijanti iz faze 1 je zadržano.** Dodato je 7:

13. Svaki dokument ima tačno jedno važeće stanje razrešenja.
14. Dokument koji tvrdi poklapanje po broju artikla mora te brojeve i nositi.
15. Dokument vezan za komponentu — ciljni proizvod mora tu komponentu imati.
16. Nerazrešen dokument nikada nije dokaz o proizvodu.
17. Duplikati ne uvećavaju pokrivenost.
18. Identitet skena ne podrazumeva izvučen tehnički sadržaj.
19. Proizvod ne može imati TDS tvrdnje bez ijednog vezanog lista; klasifikacija pokrivenosti obuhvata svaki proizvod tačno jednom.

Uz to: katalog se ne sme računati kao tehnički dokaz.

### Provera curenja sa negativnim testom

339 markera × 832 izgrađene stranice → **0 propusta**. Negativni test: citat `Degree of gloss: (at measurement angle 60° ac` ubačen u izgrađenu stranicu → validator pao sa `SIGURNOSNI PROPUST`; posle vraćanja ponovo prolazi.

### Ispravke koje je validacija iznudila

| Nalaz | Priroda | Ishod |
| --- | --- | --- |
| **Katalog kao tehnički dokaz za 87 proizvoda** | greška projektovanja — katalog je prošao normalnim putem i 43 proizvoda je izgledalo kao da ima deljeni list | katalog dobija zasebno stanje, `countsAsEvidence: false` |
| 29 lažnih konflikata uloge | greška detekcije — uloga čitana iz tela strane | uloga se čita iz naslova dokumenta |
| Skenirani dokument sa `countsAsEvidence: true` | greška redosleda — link se proveravao pre čitljivosti | čitljivost se proverava prva |
| 7 proizvoda izgubilo TDS u odnosu na fazu 1 | greška propusta — link sa stranice uopšte nije korišćen kao signal | link vraćen kao primarni signal |
| `seo:validate` prijavio 82 greške | nadmetanje — menjao sam build izlaz dok je server radio | ponovljeno čisto: 198 URL-ova, 0 grešaka |

---

## 12. FINALNI STATUS: PARTIAL

C.A.R.FIT **ne** može biti označen kao COMPLETE, i razlog nije nedostatak truda nad postojećim dokazima.

**Šta je rešeno:**
- nepovezanih dokumenata: 160 → **38** (76 % smanjenje);
- pouzdano povezano 232 dokumenta na konkretan proizvod, od toga 10 na nivou komponente (uz još 2 `FAMILY_LEVEL` identifikovana samo preko kataloga, koja se ne računaju kao dokaz);
- proizvoda sa tehničkim listom: 51 → 55; sa bezbednosnim: 54 → 57;
- svih 302 dokumenta ima tačno jedno stanje; nijedan nije ostao neklasifikovan;
- kategorija **A** (postoji nepovezan list koji pripada proizvodu bez lista) je **nula** — nema preostalog posla koji naši postojeći dokazi mogu rešiti.

**Zašto ipak PARTIAL:**
- **38 dokumenata ostaje nerazrešeno** (34 uobičajenih — 24 SDS, 9 TDS, 1 neuspelo preuzimanje — plus 4 skena bez identiteta). To su uglavnom engleske verzije čiji naslovi nemaju par u trojezičnom mostu i listovi za artikle kojih nema ni na sajtu ni u katalogu 2026 — verovatno povučeni proizvodi. Njihovo razrešavanje traži izvor koji nemamo (stariji katalog ili potvrdu proizvođača), ne dodatnu obradu.
- **5 skeniranih listova** ostaje nečitljivo bez OCR-a, koji je nova zavisnost i nije uveden jednostrano; kod 4 od njih ni identitet nije utvrđen.
- **20 proizvoda nema nikakav tehnički dokument**, a 43 ima samo podatke sa sajta. To je stanje kod proizvođača, ne praznina u obradi.
- **1 dokument vraća HTTP 404** na sajtu proizvođača.

**Zašto nije SOURCE-LIMITED:** deo bi se i dalje mogao pomeriti — OCR bi otvorio 5 listova, a stariji katalog verovatno deo od 38. Ograničenje nije isključivo u izvoru.

**Zašto nije BLOCKED:** ništa nije sprečilo rad; sve je dostupno i obrađeno.

---

## 13. Stručni paket

`docs/seo/EXPERT_REVIEW_CARFIT.md` — regenerisan, organizovan po porodici, proizvodu, komponenti i deljenom listu.

Nove sekcije:
- **DEO 5 — DOKUMENTI KOJI JOŠ NISU POUZDANO POVEZANI**: za svaki od 60 nepouzdano vezanih dokumenata naveden je već pronađen dokaz, grupisano po stanju. Ekspert ne otvara 302 dokumenta pojedinačno.
- **DEO 6 — ZAŠTO PROIZVOD NEMA TEHNIČKI LIST**: klasifikacija A–G sa obrazloženjem po proizvodu.

---

## 14. Reproduktivnost

```bash
npm run carfit:phase2
```

Izvršava: indeks identiteta → razrešavanje → prevezivanje TDS tvrdnji → unakrsna provera → dosije i stručni paket → validacija.

---

## 15. Sledeći korak

Stručna provera `docs/seo/EXPERT_REVIEW_CARFIT.md`. Do tada C.A.R.FIT ostaje na nula objavljenih tehničkih tvrdnji.

Norbin i SATA nisu započeti.
