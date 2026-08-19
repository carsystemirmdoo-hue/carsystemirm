# CARSYSTEM — IZVEŠTAJ O KOMPLETIRANJU TDS ZNANJA

**Faza:** Carsystem Phase 2 — ekstrakcija znanja iz tehničkih listova i kompletiranje dosijea
**Datum:** 2026-08-08
**Proizvođač:** Vosschemie GmbH · **Brend:** Carsystem
**Status objave:** ništa nije objavljeno; nula tvrdnji ima status `expert-verified`

---

## 1. Šta je ova faza radila, a šta nije

Akvizicioni sloj (462 stranice, 1.066 artikala, 243 TDS, 264 SDS, 441 slika) bio je prihvaćen kao završen. Ova faza nije preuzimala nove dokumente — obrađivala je **sadržaj** već preuzetih tehničkih listova.

Nije menjano: javni sajt, CSS, brend stranice, ProductGroup konsolidacija, postojeća SEO/AEO/GEO arhitektura. Izmenjeni su isključivo `scripts/`, `data/knowledge/`, `docs/seo/` i `package.json`.

---

## 2. Inventar tehničkih listova

`npm run carsystem:tds-inventory` → `data/knowledge/carsystem-tds-inventory.generated.json`

| Stavka | Broj |
| --- | ---: |
| Preuzetih TDS fajlova | 243 |
| **Jedinstvenih dokumenata (po SHA256)** | **242** |
| Dokumenata koje deli više proizvoda | 1 |
| Nečitljivih dokumenata | 0 |
| Jezik | 242 × nemački |
| Sa oznakom revizije u nazivu | 91 |
| Bez oznake revizije | 151 |
| Raspon strana | 1–16 |
| Medijana dužine teksta | 3.186 znakova |
| Pokrivenih proizvoda | 243 |
| Pokrivenih brojeva artikala | 628 |

Pretpostavka „243 fajla = 243 specifikacije" nije tačna: jedan dokument opslužuje dva proizvoda. Relacija je zabeležena kao **više-na-više** (dokument ↔ proizvod ↔ broj artikla), a ne kao 1:1. Zato jedinica rada u svim narednim koracima jeste dokument identifikovan heš vrednošću, a ne fajl.

Revizije se u nazivu pišu nedosledno (`-v2` i `-v02` oba postoje), pa se normalizuju na dvocifreni oblik — u suprotnom `v2` sortira ispred `v10`.

### Raspodela po kategorijama

| Kategorija | Dokumenata |
| --- | ---: |
| lackieren (lakiranje) | 54 |
| spachteln (kitovi) | 43 |
| schleifen (brušenje) | 34 |
| abdecken (maskiranje) | 25 |
| finish | 24 |
| kleben-beschichten (lepljenje) | 23 |
| reinigen (čišćenje) | 16 |
| arbeitsschutz (zaštita) | 14 |
| lackierbedarf (pribor) | 9 |

---

## 3. Gramatika dokumenata — proučena pre pisanja parsera

R-M i baslac parseri **nisu** ponovo iskorišćeni. Korpus je prvo pregledan, i pokazao je tri Vosschemie šablona:

| Šablon | Opis |
| --- | --- |
| **A** (stariji) | VELIKA SLOVA za naslove — `CHARAKTERISTIK`, `EINSATZGEBIET`, `PRODUKTANGABEN`, `VERARBEITUNG` |
| **B** (noviji) | Naslovi malim slovima sa ∙ tačkama — `Beschreibung`, `Einsatzgebiet`, `Produktangaben` |
| **C** (alati) | Dvokolonska `PRODUKTANGABEN` tabela u kojoj labela i vrednost padaju u **odvojene redove** |

Šablon C je otkriven tek u kontrolnoj proveri (v. § 12). Prvi prolaz je zahtevao `Labela: vrednost` u istom redu i zato je pneumatske alate ostavio praznim.

Korpus sadrži **552 različite labele**. To je razlog zašto je ekstrakcija **generička pre nego tipizovana**: svaki par labela/vrednost se hvata doslovno, a tek potom se poznate labele dodatno preslikavaju u tipizovana polja. Fiksna šema bi odbacila većinu korpusa.

---

## 4. Ekstrakcija specifična za kategoriju

Jedna univerzalna šema za automobilske lakove **nije** nametnuta. Tipizovana polja se primenjuju samo tamo gde imaju smisla:

- **Brusni materijali** — `Kornart`, `Körnungen`, `Lochung`, `Träger` (vezano za kategoriju `schleifen`)
- **Maskiranje** — `Gesamtdicke`, `Breiten`, `Temperaturbeständigkeit`
- **Lepkovi / zaptivači** — `Zugfestigkeit`, `Dichte`, `Reaktionstemperatur`
- **Lakovi i kitovi** — `V.O.C.`, `Düsengröße`, `Trockenschichtdicke`, `Mischungsverhältnis`, `Topfzeit`
- **Alati** — `Luftverbrauch`, `Max. Arbeitsdruck`, `Drehzahl`
- **Sve ostalo** — ostaje `otherSpecification` sa doslovnom labelom

Polja poput `Düsengröße` ne mogu se pojaviti na brusnom disku jer su vezana za kategoriju; polja koja nisu vezana (`categories: ["*"]`) primenjuju se šire, ali samo kada je labela stvarno prisutna u dokumentu.

---

## 5. Rezultat ekstrakcije

`npm run carsystem:tds-extract` → `data/knowledge/carsystem-tds-claims.generated.json`

| Stavka | Broj |
| --- | ---: |
| Obrađenih dokumenata | 242 |
| Dokumenata sa bar jednom tvrdnjom | 238 |
| Dokumenata bez ijedne tvrdnje | 4 |
| **Ukupno tvrdnji** | **1.911** |
| Tipizovanih | 1.021 |
| Netipizovanih (`otherSpecification`) | 890 |
| Sa jedinicom | 1.031 |
| Sa opsegom (oba kraja sačuvana) | 189 |
| Sa kvalifikatorom (`ca.`, `bis`, `min.`, `max.`) | 155 |
| Sa uslovom | 62 |
| Negativnih (polaritet očuvan) | 167 |
| Vezanih za blok varijante | 132 |
| **Sa dokazom u vidu broja strane** | **1.911 / 1.911** |
| Različitih izvornih labela | 552 |

**Svaka** tvrdnja nosi: naziv fajla, SHA256 dokumenta, izvorni URL, broj strane i doslovan citat. Nijedna nema status viši od `machine-extracted`.

### 5.1 Četiri dokumenta bez tvrdnji

`tm-star-mask.pdf`, `tm-h2o-cleaner.pdf`, `TM-Alu-Reparaturgitter.pdf`, `TM_CS_Glasvlies.pdf`

Sva četiri su čitljiva i sadrže tekst, ali **nemaju tabelu tehničkih podataka** — samo prozne sekcije `CHARAKTERISTIK` / `EINSATZGEBIET` / `VERARBEITUNG`. Prijavljeni su kao praznina, a ne kao „nula podataka". Za njih tehnički podaci ne postoje u TDS obliku i moraju doći iz drugog izvora ili od eksperta.

---

## 6. Očuvanje uslova i polariteta

Ovo je bio eksplicitan zahtev i proveren je i testom i ručnom kontrolom.

**Uslovi se ne odvajaju od vrednosti.** `Max. Wärmestand: 80 °C (mind. 1 h senkrecht)` zadržava trajanje kao `condition`, umesto da bude svedeno na „temperaturna otpornost: 80 °C" — što bi precenilo proizvod.

**Kvalifikatori se ne skidaju iz vrednosti.** `bis 90°C` ostaje `bis 90°C`; `bis` se dodatno beleži kao `qualifier`, ali se vrednost ne krati.

**Opsezi zadržavaju oba kraja.** 189 tvrdnji ima `range: {min, max}`; nijedna nije svedena na sredinu ili na jednu granicu.

**Polaritet.** Kontrolni primer `tm-elastic-green.pdf`:

| Podloga | Iskaz | Klasifikacija |
| --- | --- | --- |
| čelik | „Nur für Stahluntergründe" | dozvoljeno, **isključivo** |
| aluminijum | „Nicht für Zink- und Aluminiumuntergründe" | **NIJE dozvoljeno** |
| cink / pocinkovano | isto | **NIJE dozvoljeno** |

Čitanje reči „Aluminium" bez njenog kvalifikatora pretvorilo bi zabranu u preporuku. To je najskuplja greška raspoloživa u ovom korpusu i validator je sada eksplicitno traži (v. § 12).

---

## 7. Unakrsna provera: sajt proizvođača ↔ tehnički list

`npm run carsystem:crosscheck` → `data/knowledge/carsystem-source-crosscheck.generated.json`

Poređeno je samo ono što stvarno meri istu stvar (temperaturna otpornost, nijansa, vrsta zrna, podloge). **282 poređenja:**

| Klasifikacija | Broj |
| --- | ---: |
| TDS_MORE_SPECIFIC | 106 |
| CONSISTENT | 80 |
| WEBSITE_MORE_SPECIFIC | 71 |
| NOT_COMPARABLE | 19 |
| **VALUE_CONFLICT** | **4** |
| CONDITIONAL_DIFFERENCE | 2 |
| REVISION_DIFFERENCE | 0 |

**Automatski razrešeno: 0.** Tehnički list nosi veću dokaznu težinu od web stranice, ali „veća težina" nije „ovlašćenje da prepiše". Obe vrednosti se čuvaju.

### 7.1 Četiri konflikta — svi na temperaturnoj otpornosti

| Proizvod | Sajt | Tehnički list | Dokument |
| --- | --- | --- | --- |
| Silver Tape | 80 °C | −15 °C do +60 °C | `tm-silver-tape-v04.pdf` |
| WR Lifting Tape Premium | 120 °C | kratkotrajno do 110 °C | `tm-wr-lifting-tape-premium-v03.pdf` |
| Uniflex Glas HM | 5 °C do 40 °C | −40 °C / +100 °C, kratki vrhovi 140 °C | `tm-uniflex-glas-hm-v04.pdf` |
| Uniflex Glas | 5 °C do 40 °C | −40 °C / +100 °C, kratki vrhovi 140 °C | `tm-uniflex-glas-v04.pdf` |

**Zapažanje koje se prosleđuje ekspertu, a ne primenjuje kao odluka:** kod oba `uniflex-glas` zapisa vrednost sa sajta („5 °C do 40 °C") deluje kao **temperatura obrade**, a vrednost iz TDS-a kao **radna temperatura gotovog spoja**. Ako je tako, to nije protivrečnost nego sudar dve različite veličine u istom polju — ali to je tehnička procena koju alat ne sme doneti sam. Sva četiri ostaju otvorena.

### 7.2 Dve uslovne razlike

| Proizvod | Sajt | Tehnički list | Uslov |
| --- | --- | --- | --- |
| KS 200 Hohlraumkonservierung | Braun-transparent | hellbraun transparent | amber |
| EF21 EP Grundierfüller | Kieselgrau (ca. RAL 7032) | Kieselgrau | ca. RAL 7032 |

Nisu konflikti — jedan izvor navodi uslov/približnu oznaku koju drugi izostavlja.

---

## 8. SDS kao zasebna klasa dokumenata

264 bezbednosna lista **nisu** ušla u tehnički skup tvrdnji. Nijedna potrošački vidljiva tvrdnja nije izvedena iz H/P oznaka, signalnih reči ni GHS piktograma.

Validator to i proverava. Prva verzija te provere je pala sa 22 „propusta" — svih 22 su bile ISO oznake granulacije (`P180`, `P320`, `P2000`) na brusnim materijalima, a ne GHS mere predostrožnosti. Regularni izraz `\bP\d{3}\b` je u katalogu abrazivâ pogrešan test. Provera je ispravljena tako da P-oznaka računa samo uz prateći rečnik opasnosti. Stvarnih pojava teksta opasnosti u tehničkim tvrdnjama: **0**.

---

## 9. Razrešavanje lokalnih proizvoda

Naših 9 Carsystem zapisa ne mora odgovarati tačno jednom artiklu proizvođača. Umesto forsiranja 1:1 veze, beleži se **tip razrešenja**:

| Naš proizvod | Tip veze | Kandidata | Artikala |
| --- | --- | ---: | ---: |
| Carsystem F19 brusni diskovi | porodica sa varijantama (`f19`) | 5 | 33 |
| Carsystem Git Multi Green | porodica sa varijantama (`Multi Green`) | 3 | 5 |
| Carsystem Sanding Disc F.23 Ceramic | tačan proizvod | 1 | 9 |
| Carsystem P19 brusni diskovi | tačan proizvod | 1 | 13 |
| Carsystem Finish serija | traži odluku eksperta | 8 | 9 |
| Carsystem P23 brusni diskovi | traži odluku eksperta | 8 | 21 |
| Carsystem Soft Plus git | traži odluku eksperta | 8 | 8 |
| Carsystem zaštitno odelo | traži odluku eksperta | 8 | 49 |
| Carsystem Git Elastic Weiss | višeznačno | 1 | 3 |

Podržan je lanac **LOKALNI PROIZVOD → PORODICA PROIZVOĐAČA → VIŠE VARIJANTI ARTIKLA**. Zapis „Carsystem F19 brusni diskovi" legitimno pokriva 33 broja artikla; svođenje na jedan SKU podiglo bi procenat „tačnih poklapanja" i učinilo podatak netačnim. Cilj je semantička ispravnost, ne veštački procenat.

Četiri zapisa razrešena preko kategorijskog rezervnog puta ostaju `requires-expert-decision` — nisu proglašena poklapanjem.

---

## 10. Kompletnost dosijea

`data/knowledge/brands/carsystem.manifest.generated.json`

### Naši proizvodi (9)

| Kriterijum | Ispunjeno |
| --- | ---: |
| Slika | 9 / 9 |
| Opis proizvođača | 9 / 9 |
| Tehnički list | 6 / 9 |
| Bezbednosni list | 3 / 9 |
| Tvrdnje sa sajta | 9 / 9 |
| Tvrdnje iz TDS-a | 6 / 9 |
| **Potpuno kompletnih** | **6 / 9** |

### Katalog proizvođača (460 kandidata)

| Kriterijum | Ispunjeno |
| --- | ---: |
| Slika | 439 / 460 |
| Opis | 460 / 460 |
| Tehnički list | 241 / 460 |
| Bezbednosni list | 150 / 460 |
| Tvrdnje sa sajta | 424 / 460 |
| Tvrdnje iz TDS-a | 237 / 460 |
| **Potpuno kompletnih** | **222 / 460** |

Svih 460 zadržava `catalogStatus: "manufacturer-catalog-candidate"` — nisu označeni kao dostupni, na stanju ni u prodaji kod Carsystem-a.

---

## 11. Stručni paket

`docs/seo/EXPERT_REVIEW_CARSYSTEM.md` — regenerisan, na srpskom, 2.938 redova.

| Stavka | Broj |
| --- | ---: |
| Sirovih tvrdnji (TDS + sajt) | 3.820 |
| **Odluka za eksperta posle grupisanja** | **1.359** |
| Smanjenje | 64 % |

Grupisanje je po **specifikaciji**, a ne po dokumentu: `Lagerstabilität: 12 Monate` jeste jedna tehnička činjenica bez obzira na to da li se javlja u tri lista ili u trideset. Svi izvorni dokumenti ostaju navedeni uz odluku; ekspert ne dobija isto pitanje trideset puta.

Zvanični nazivi proizvoda i tehnički identifikatori nisu prevođeni.

---

## 12. Validacija

Svi zahtevani gejtovi prolaze. **Nijedan validator nije oslabljen** — dodato je deset novih invarijanti.

| Provera | Rezultat |
| --- | --- |
| `npm run typecheck` | ✅ prolazi |
| `npm run lint` | ✅ prolazi, 0 upozorenja |
| `npm run build` | ✅ prolazi |
| `npm run knowledge:validate` | ✅ sve provere prolaze |
| `npm run seo:validate` | ✅ 198 URL-ova, 0 grešaka, 0 upozorenja |

### Nove invarijante

1. Svaka TDS tvrdnja ima fajl + SHA256 + broj strane + citat.
2. Nijedna nije iznad `machine-extracted` / `manufacturer-technical-document`.
3. Negativna tvrdnja mora imati negaciju u citatu.
4. Naveden uslov mora imati uporište u citatu.
5. Opseg se ne sme svesti na jednu vrednost.
6. Tekst opasnosti (SDS) ne sme se naći u tehničkim tvrdnjama.
7. Broj jedinstvenih dokumenata ne sme preći broj fajlova; nijedan dokument ne sme ostati bez proizvoda.
8. Nijedno neslaganje izvora ne sme biti automatski razrešeno.
9. Obe strane konflikta moraju biti sačuvane.
10. `EXPERT_VERIFIED` i `PUBLISHABLE` moraju ostati na nuli.

### Provera curenja — sa negativnim testom

Sonda sada obuhvata i **doslovne citate iz tehničkih listova**, ne samo tekst sa sajta: 885 markera × 832 izgrađene stranice, **0 propusta**.

Negativni test je pokrenut da dokaže da provera stvarno puca: citat `Lagerzeit: 12 Monate ab Produktionsdatum in u` ubačen je u izgrađenu stranicu `/proizvodi/2210-onyx-activator` i validator je pao sa `SIGURNOSNI PROPUST`. Posle vraćanja fajla — ponovo prolazi. Provera se izvršava nad **izgrađenim HTML-om**, ne nad izvornim kodom.

### Ispravke koje je validacija iznudila

| Nalaz | Priroda | Ishod |
| --- | --- | --- |
| 1.911 tvrdnji „nije needs-review" | greška validatora — pogrešna imena polja | validator usklađen sa stvarnim ugovorom |
| 22 tvrdnje „sadrže tekst opasnosti" | greška validatora — `P180` je granulacija, ne GHS | uslovljeno rečnikom opasnosti |
| 2 negativne tvrdnje bez negacije | nepotpun rečnik validatora — `vermeiden` jeste negacija | rečnik dopunjen |
| Pneumatski alati bez ijedne tvrdnje | **stvarna greška parsera** — neprepoznat šablon C | dodat dvoredni šablon, +121 tvrdnja |
| `bis bis 90°C` u stručnom paketu | greška prikaza, ne podataka | kvalifikator se više ne dupli |

---

## 13. AEO spremnost

`data/knowledge/carsystem-aeo-readiness.generated.json` — 12 namera pretrage.

| Status | Broj |
| --- | ---: |
| `EVIDENCE_AVAILABLE_NEEDS_REVIEW` | 12 |
| `NO_EVIDENCE` | 0 |
| **`EXPERT_VERIFIED`** | **0** |
| **`PUBLISHABLE`** | **0** |

Sve namere imaju dokaznu podlogu, nijedna nema odobrenje. Primeri: „Na koje podloge sme ovaj kit / prajmer?" (55 dokaza), „Šta se NE sme koristiti na kojoj podlozi?", „Koja granulacija za koju fazu brušenja?", „Koliki je rok trajanja i kako se skladišti?".

---

## 14. Sredstva i objavljivanje

| Stavka | Stanje |
| --- | --- |
| 243 TDS + 264 SDS (413 MB) | `assets/manufacturer/carsystem/documents/` — **van `public/`** |
| 441 slika | `assets/manufacturer/carsystem/images/` — **van `public/`** |
| Objavljeno na sajtu | 0 |
| Zamenjenih postojećih slika sajta | 0 |

---

## 15. Poznata ograničenja

1. **890 od 1.911 tvrdnji (47 %) ostaje netipizovano** kao `otherSpecification`. To je posledica 552 različite labele, a ne propusta — vrednosti su sačuvane doslovno sa labelom, ali nisu svedene na zajedničku šemu. Dalja tipizacija zahteva stručnu odluku o tome koje labele zaslužuju polje.
2. **Sva 242 dokumenta su na nemačkom.** Nijedna tvrdnja nije prevedena. Ekspert čita nemački original.
3. **Četiri dokumenta nemaju tabelu tehničkih podataka** (§ 5.1).
4. **Četiri konflikta temperature ostaju otvorena** (§ 7.1), uključujući dva za koja postoji hipoteza da su sudar dve veličine, a ne protivrečnost.
5. **Jedinice se ponegde parsiraju grubo** — `Drehzahl U/min: 4000 U/min` beleži jedinicu kao `min` umesto `U/min`. Vrednost je netaknuta („4000 U/min"), pa nema gubitka podatka, ali polje `unit` nije pouzdano za sve tehničke veličine.
6. **Samo 2 od 9 naših proizvoda imaju tačno poklapanje sa jednim artiklom.** To je stvarno stanje, ne neuspeh — v. § 9.

---

## 16. Reproduktivnost

```bash
npm run carsystem:phase2
```

Izvršava: inventar TDS → ekstrakcija → unakrsna provera → dosije i stručni paket → validacija znanja.

Pojedinačno: `carsystem:tds-inventory`, `carsystem:tds-extract`, `carsystem:crosscheck`, `carsystem:knowledge`.

Ekstrakcija teksta iz 242 PDF-a se kešira u `.cache/carsystem/` (van verzionisanja), ali keš je ubrzanje, a ne ulaz — ako ga nema, gradi se iz preuzetih dokumenata. Provereno: pokretanje sa obrisanim kešom daje identične brojeve (1.911 tvrdnji, 282 poređenja, 1.359 odluka).

---

## 17. Zaključak

Carsystem se sada može smatrati **tehnički kompletnim na nivou znanja**, uz sledeće značenje te reči:

- svih 242 jedinstvena tehnička lista je pročitano, a ne samo preuzeto;
- 1.911 tvrdnji ima punu proveru porekla do strane i citata;
- uslovi, opsezi, jedinice i polaritet su očuvani;
- neslaganja između izvora su klasifikovana, nijedno nije automatski razrešeno;
- SDS je ostao zasebna klasa dokumenata;
- lokalni proizvodi su razrešeni semantički, ne nateranim 1:1 vezama;
- 3.820 sirovih tvrdnji svedeno je na 1.359 odluka za eksperta;
- ništa nije objavljeno i ništa ne može biti objavljeno pre stručne provere.

**Sledeći korak je stručna provera `docs/seo/EXPERT_REVIEW_CARSYSTEM.md`.** Do tada Carsystem ostaje na nula objavljenih tehničkih tvrdnji.

C.A.R.FIT nije započet.
