---
id: SV-0043
slug: konvertor-rdje-pre-farbanja
naslov: "Konvertor rđe: kada pomaže, a kada ne"
metaNaslov: "Konvertor rđe pre farbanja: šta se zna"
opis: "Šta konvertor rđe hemijski radi, zašto ga nema u našem programu i zašto prajmeri iz našeg programa traže podlogu bez rđe, a ne pretvorenu rđu."
kategorija: korozija
podtema: konvertori rđe
tip: resavanje-problema
publika:
  - hobista
glavnoPitanje: Da li konvertor rđe zaista zaustavlja koroziju i može li se preko njega lakirati?
namera: rešavanje problema
dodatnaPitanja:
  - Kako se konvertor nanosi?
  - Šta proizvođač kaže o nanošenju sledećeg sloja?
  - Da li posle konvertora treba isprati površinu?
poreklopitanja:
  tip: pronadjeno-u-izvoru
  napomena: "Pitanje da li „antirost“ (konvertor rđe) radi i može li se farbati preko njega postavlja se na domaćem forumu (q040); srodna pitanja o sušenju i ispiranju su q131 i q144 u questions.json."
  izvori:
    - https://poljoprivredni-forum.com/threads/auto-limarija-i-priprema-za-farbanje.27833/page-10
brendovi:
  - carsystem
  - cosmos-lac
  - rm
proizvodi:
  - carsystem-1k-epoxy-primer
  - carsystem-zinc-spray
  - cosmos-lac-master-mechanic-03-500-ml-master-mechanic-epoxy-primer-03-grey
  - grupa:cosmos-lac-primers-metal-primer
povezani:
  - SV-0042
  - SV-0041
  - SV-0045
  - SV-0059
izvori:
  - id: vetere-tannins
    naziv: "V. F. Vetere, R. Romagnoli, Chemical and electrochemical assessment of tannins and aqueous primers containing tannins (CIC Buenos Aires, repozitorijum)"
    url: https://digital.cic.gba.gob.ar/bitstreams/f8a335fc-4757-44cd-8f6c-8dec49e76ffb/download
    pristupljeno: 2026-10-08
    tip: strucni-izvor
  - id: cs-1k-epoxy-tds
    naziv: "Carsystem, Technical Data Sheet 1K Epoxy Primer"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-1k-epoxy-primer.pdf
    verzija: "v.01, 28-11-2014 (izdanje 03/2021)"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-zinc-spray-tds
    naziv: "Carsystem, Technical Data Sheet Zink-Spray, anticorrosive"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-zinkspray.pdf
    verzija: "v.02, 14-05-2007 (izdanje 03/2021)"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cosmos-mm-epoxy-tds
    naziv: "Cosmos Lac, TDS Master Mechanic Epoxy Primer"
    url: https://cosmoslac.com/pdfs/products/en/master-mechanic-epoxy-primer.pdf
    verzija: "Version 03, 9/7/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cosmos-metal-primer-tds
    naziv: "Cosmos Lac, TDS Metal Primer"
    url: https://cosmoslac.com/pdfs/products/en/metal-primer.pdf
    verzija: "Version 02, 17/06/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-p5480-tds
    naziv: "R-M, Technical Information GHD UNIVERSAL EPOXY, P 5480"
    dokument: /documents/products/rm/p-5480-ghd-universal-epoxy/rm-p-5480-ghd-universal-epoxy-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cosmos-rust-shock-tds
    naziv: "Cosmos Lac, TDS Rust Shock Freeze Penetrating Oil"
    url: https://cosmoslac.com/pdfs/products/en/Rust-Shock-Freeze-Penetrating-Oil-V01_tds.pdf
    verzija: "Version 01, 19/9/25"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 212
razlogPrioriteta: Rešava konkretan problem iz prakse; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: nije-provereno
  jezickaProvera: nije-provereno
strucnaPotvrda:
  potrebna: true
  razlog: "U našem programu nema konvertora rđe, pa nema tehničkog lista iz koga bi se proverili nanošenje, vreme sušenja i kompatibilnost sa sledećim slojem. Jedini nezavisni izvor je stariji naučni rad o tanin-fosfatnim tretmanima, bez podataka za karoseriju. Odgovor na glavno pitanje (da li konvertor zaustavlja koroziju na automobilu) treba da potvrdi stručna osoba ili tehnička podrška proizvođača prajmera."
  status: potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Konvertor rđe hemijski menja deo rđe u drugo jedinjenje, ali to nije isto što i uklanjanje rđe. U našem programu konvertora rđe nema, a svi prajmeri i zaštitni materijali iz našeg programa čije smo tehničke listove proverili traže podlogu bez rđe. Zato za popravku karoserije materijalima iz našeg programa ne možemo da preporučimo konvertor kao zamenu za brušenje do zdravog metala. Da li određeni konvertor sme ispod određenog prajmera, može da kaže samo tehnički list tog konvertora i proizvođač prajmera.

## Šta konvertor radi

Postoji više vrsta konvertora; jedna dugo poznata vrsta su kisele vodene smeše sa taninima i fosfornom kiselinom. Naučni rad Veterea i Romanjolija opisuje da tanini reaguju sa jedinjenjima gvožđa i da na čeliku nastaje sloj tanata, a da fosforna kiselina pomaže stvaranju tog sloja i rastvaranju oksida[^vetere-tannins]. Isti rad navodi da su takvi tretmani alternativa kada temeljno mehaničko čišćenje nije moguće[^vetere-tannins].

Iz istog izvora vide se i ograničenja:

- Produkti reakcije tanina sa gvožđem delom ne prianjaju, pa se površina posle tretmana vodenim suspenzijama tanina pere da bi se uklonili labavi produkti[^vetere-tannins].
- Autori na početku rada navode da je potpuno uklanjanje rđe važan uslov trajnosti premaza i da dobra boja na zarđaloj površini rano otkazuje[^vetere-tannins].

Rad je laboratorijski i ne govori o karoseriji, šupljinama ni o konkretnom komercijalnom proizvodu. Zato iz njega ne izvodimo koliko konvertor štiti automobil.

## Kada konvertor ne pomaže

Ovo su ograničenja koja proizlaze iz načina rada i iz tehničkih listova prajmera, a ne iz ispitivanja konkretnog konvertora:

- **Debela, slojevita rđa.** Hemijska reakcija deluje na površinu do koje tečnost dopre. Labavi slojevi ispod ostaju.
- **Probijen ili stanjen lim.** Konvertor ne vraća izgubljeni metal. Takvo mesto traži limarsku popravku; vidi [Uklanjanje rđe sa karoserije](/vodici/uklanjanje-rdje-sa-karoserije).
- **Rđa ispod laka.** Konvertor ne stiže ispod laka koji se nije skinuo, pa korozija tamo nastavlja. Više u vodiču [Mehuri rđe ispod laka](/vodici/mehuri-rdje-ispod-laka).
- **Kit preko „pretvorene“ rđe.** Ni kitovi iz našeg programa ne predviđaju takvu podlogu; vidi [Može li kit preko rđe](/vodici/kit-preko-rdje).

## Šta tehnički listovi iz našeg programa traže od podloge

| Proizvod | Uslov za podlogu prema tehničkom listu |
| --- | --- |
| Carsystem 1K Epoxy Primer | rđu sa metalne podloge potpuno ukloniti[^cs-1k-epoxy-tds] |
| Carsystem Zink-Spray | površina čista, suva, bez rđe, masti i ulja[^cs-zinc-spray-tds] |
| Cosmos Lac Master Mechanic Epoxy Primer | ukloniti prašinu, rđu i ulje[^cosmos-mm-epoxy-tds] |
| Cosmos Lac Metal Primer | ukloniti prašinu, rđu i ulje[^cosmos-metal-primer-tds] |
| R-M GHD UNIVERSAL EPOXY P 5480 | podloga čista, bez prašine, rđe, ulja i masti[^rm-p5480-tds] |

R-M P 5480 je iz programa za komercijalna vozila i ovde je naveden samo kao još jedan primer istog uslova.

Nijedan od ovih listova ne pominje konvertor rđe kao dozvoljenu podlogu. To ne znači da je svaka kombinacija nemoguća, nego da nije opisana u dokumentima proizvođača, pa za nju nema garancije sistema.

## Pitanja i odgovori

### Kako se konvertor nanosi?

Prema uputstvu proizvođača tog konvertora. Pošto u našem programu nema takvog proizvoda, nemamo tehnički list iz koga bismo opisali nanošenje, vreme reakcije i sušenja. Uputstva drugih proizvođača ne prenosimo, jer se sastav i postupak razlikuju od proizvoda do proizvoda.

### Šta proizvođač kaže o nanošenju sledećeg sloja?

To piše u tehničkom listu konvertora, a mora se uporediti i sa tehničkim listom prajmera. Za prajmere iz tabele iznad uslov je podloga bez rđe. Kada se dva dokumenta ne slažu, važi stroži uslov, a pitanje se postavlja tehničkoj podršci proizvođača prajmera.

### Da li posle konvertora treba isprati površinu?

Zavisi od proizvoda. Za vodene suspenzije tanina naučni rad navodi ispiranje labavih produkata reakcije[^vetere-tannins], a kod drugih formulacija postupak može biti drugačiji. Pratite tehnički list konvertora.

### Da li je Cosmos Lac Rust Shock Freeze konvertor rđe?

Nije. Tehnički list ga opisuje kao proizvod sa jakim prodiranjem i podmazivanjem koji se koristi kod zarđalih delova, uz uputstvo o njihovom odblokiranju[^cosmos-rust-shock-tds]. Isti list ne navodi da je proizvod podloga za prajmer ili boju.
