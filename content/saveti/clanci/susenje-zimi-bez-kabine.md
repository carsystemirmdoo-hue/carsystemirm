---
id: SV-0125
slug: susenje-zimi-bez-kabine
naslov: "Sušenje zimi bez kabine: toplota, pare rastvarača i bezbednost"
metaNaslov: "Sušenje laka zimi bez kabine i grejači"
opis: "Kako se zimi bez kabine obezbeđuje temperatura za sušenje i šta bezbednosni listovi kažu o grejačima, varnicama i parama rastvarača u garaži."
kategorija: uslovi-i-susenje
podtema: improvizovani uslovi
tip: resavanje-problema
publika:
  - hobista
glavnoPitanje: Kako sušiti popravku zimi u garaži bez kabine i šta pri tome nije bezbedno?
namera: rešavanje problema
dodatnaPitanja:
  - Koji grejači su opasni uz rastvarače?
  - Može li grejalica da radi dok lak odzračuje?
  - Sme li radna lampa u prostor gde se lakira?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Pitanje o sušenju zimi bez kabine je urednički predlog q239 u questions.json; pitanje kako pripremiti garažu bez profesionalne opreme postavlja se na domaćem forumu (q035), ali ne pominje grejanje."
brendovi:
  - norbin
  - carfit
  - carsystem
  - sata
proizvodi:
  - carsystem-2k-clear-voc-420
  - norbin-n15-v20-clear-voc
  - carfit-express-clearcoat
povezani:
  - SV-0117
  - SV-0120
  - SV-0192
  - SV-0204
  - SV-0214
izvori:
  - id: norbin-n15-v20-sds
    naziv: "Norbin, Safety Data Sheet N15-V20 Clear VOC 4L"
    url: https://www.norbin-paint.com/files/MSDS/MSDS_N15-V20_4L_en.PDF
    verzija: "3.0, 24.06.2021"
    datumIzvora: 2021-06-24
    pristupljeno: 2026-10-08
    tip: bezbednosni-list
  - id: carfit-express-clear-sds
    naziv: "August Handel GmbH, Safety Data Sheet C.A.R.FIT Express Clearcoat"
    url: https://carfitrepair.com/wp-content/uploads/2023/05/car-fit-expressclearcoat-safety-data-sheet.pdf
    verzija: "SDS 2.0, revizija 10/07/2022"
    datumIzvora: 2022-07-10
    pristupljeno: 2026-10-08
    tip: bezbednosni-list
  - id: cs-clear-420-tds
    naziv: "Carsystem, Technical Data Sheet CS 2K Clear VOC 420, 2K clear coat"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-clear-voc-420.pdf
    verzija: "V09, 11/2019"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: sata-truesun-bal
    naziv: "SATA, Operating Instructions SATA trueSun"
    url: https://www.sata.com/media/13/6b/6e/1793362240/BETRIEBSANLEITUNG-SATA-TRUESUN.PDF.PDF?ts=1793362240
    datumIzvora: 2025-11-27
    pristupljeno: 2026-10-08
    tip: uputstvo-proizvodjaca
  - id: cs-led-lamp-tds
    naziv: "Carsystem, Technical Data Sheet CS LED Lamp"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-led-lampe.pdf
    verzija: "V02, 01/2019"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 918
razlogPrioriteta: Rešava konkretan problem iz prakse; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvoreni SDS Norbin N15-V20 (3.0, 24.06.2021), C.A.R.FIT Express Clearcoat (2.0, 10.07.2022), TDS CS 2K Clear VOC 420, SATA trueSun uputstvo, CS LED Lamp; bezbednost grejača svedena na mere iz SDS-a; ispravke: P-oznake P241–P243 navedene samo za Norbin (C.A.R.FIT ih ima u odeljku 7, ne kao oznake), ventilacija potkrepljena sa oba lista, uklonjeno nabrajanje vrsta grejača koje SDS ne navodi, preciziran uvod."
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Zimi bez kabine prostor, deo i materijal treba zagrejati pre rada i držati na temperaturi iz tehničkog lista i tokom sušenja, ali bez izvora paljenja dok u prostoru ima para rastvarača. Taj drugi deo izričito traže bezbednosni listovi materijala za lakiranje: Norbin za bezbojni lak N15-V20 navodi da se pare rastvarača šire po podu i da sa vazduhom grade eksplozivne smeše, kao i da se izbegavaju toplota, varnice i otvoren plamen[^norbin-n15-v20-sds]. Grejač koji ima plamen, užarene delove ili vrele površine zato ne sme da radi u prostoru dok se lakira i dok pare nisu uklonjene.

## Šta traži tehnički list materijala

Za sušenje je važna temperatura dela i prostora, ne samo vazduha oko grejača. Carsystem za 2K Clear VOC 420 ne preporučuje nanošenje ispod 18 °C, a pre rada traži da se proizvod, prostor i objekat podese na oko 20 °C[^cs-clear-420-tds]. Vremena sušenja u tom listu data su za 20 °C i 60 °C[^cs-clear-420-tds]; za hladniji prostor vrednost nije data i ne treba je izračunavati.

Šta se na hladnom menja u nanošenju i sušenju, i kakve komponente proizvođači predviđaju za niže temperature, objašnjava vodič [Lakiranje po hladnom vremenu](/vodici/lakiranje-po-hladnom-vremenu). Ovde je reč o tome kako da se toplota obezbedi bezbedno.

## Zašto su pare rastvarača problem i na hladnom

Tačka paljenja je najniža temperatura na kojoj tečnost daje dovoljno para da se one zapale. Za dva bezbojna laka iz našeg programa bezbednosni listovi navode:

| Proizvod | Klasifikacija | Tačka paljenja prema bezbednosnom listu |
| --- | --- | --- |
| Norbin N15-V20 Clear VOC | zapaljiva tečnost i para (H226) | 27 °C[^norbin-n15-v20-sds] |
| C.A.R.FIT Express Clearcoat | lako zapaljiva tečnost i para (H225) | −17 °C[^carfit-express-clear-sds] |

Kada je tačka paljenja ispod temperature u garaži, materijal i na hladnom daje zapaljive pare. Norbin u istom listu navodi i da su pare teže od vazduha i da se šire po podu[^norbin-n15-v20-sds]. Zato je izvor toplote ili varnice pri podu posebno nepovoljno mesto. Kako se čitaju H i P oznake, objašnjava vodič [Oznake opasnosti na ambalaži](/vodici/oznake-opasnosti-na-ambalazi), a odeljke bezbednosnog lista vodič [Bezbednosni list: šta je u kom od 16 odeljaka](/vodici/bezbednosni-list-16-odeljaka).

## Šta bezbednosni listovi traže za izvore paljenja

Oba lista sadrže iste mere opreza. Norbin ih navodi kao oznake obaveštenja P210, P241, P242 i P243[^norbin-n15-v20-sds], a C.A.R.FIT među oznakama navodi P210, a ostale mere u odeljku 7 o rukovanju i skladištenju[^carfit-express-clear-sds]:

- **Dalje od toplote, vrelih površina, varnica i otvorenog plamena; zabranjeno pušenje**[^norbin-n15-v20-sds][^carfit-express-clear-sds].
- **Električna oprema, ventilacija i rasveta u izvedbi zaštićenoj od eksplozije**[^norbin-n15-v20-sds][^carfit-express-clear-sds].
- **Alat koji ne varniči i mere protiv statičkog elektriciteta**[^norbin-n15-v20-sds][^carfit-express-clear-sds].
- **Dovoljna ventilacija**[^norbin-n15-v20-sds][^carfit-express-clear-sds]. Norbin navodi i da treba poštovati odgovarajuće mere zaštite od požara[^norbin-n15-v20-sds].

Iz toga sledi da se pri lakiranju ne koristi grejač sa otvorenim plamenom, užarenim grejnim telom ili vrelom površinom, niti električni uređaj koji nije namenjen prostoru sa zapaljivim parama. Obaveze za Vaš prostor proverite prema važećim propisima o zaštiti od požara i bezbednosti na radu.

## Bezbedniji redosled rada

1. **Zagrejte prostor i deo pre rada.** Vozilo ili deo unesite ranije, da se lim izjednači sa prostorijom. Temperaturu dela proverite termometrom.
2. **Materijal držite na sobnoj temperaturi.** Carsystem traži da se proizvod do radne temperature dovede prirodno, bez naglog zagrevanja[^cs-clear-420-tds].
3. **Pre otvaranja ambalaže isključite i uklonite izvore paljenja** iz prostora.
4. **Tokom nanošenja i odzračivanja provetravajte prostor.** O tome piše vodič [Ventilacija pri lakiranju u garaži](/vodici/ventilacija-pri-lakiranju-u-garazi).
5. **Grejanje ponovo uključite tek kada u prostoru nema para.** Bezbednosni listovi ne navode posle koliko minuta je to bezbedno, jer zavisi od prostora i ventilacije. Ako niste sigurni, pitajte stručnjaka za zaštitu od požara.

Infracrvena lampa je poseban slučaj: koristi se samo kako navode tehnički list materijala i uputstvo lampe. Više u vodiču [Infracrveno sušenje](/vodici/infracrveno-susenje).

## Pitanja i odgovori

### Koji grejači su opasni uz rastvarače?

Prema merama iz bezbednosnih listova, opasan je svaki uređaj koji je izvor toplote, vrele površine, varnice ili plamena, kao i električna oprema koja nije u izvedbi zaštićenoj od eksplozije[^norbin-n15-v20-sds][^carfit-express-clear-sds]. To su, na primer, grejači sa otvorenim plamenom i uređaji sa užarenim grejnim telom ili vrelom površinom. Pare mogu da stignu do njih i kada su udaljeni od dela, jer se šire po podu[^norbin-n15-v20-sds].

### Može li grejalica da radi dok lak odzračuje?

Ne, ako nije uređaj namenjen prostoru sa zapaljivim parama. Pare se oslobađaju i posle nanošenja, dok sloj odzračuje i suši se. Zato se prostor grejanjem priprema pre rada, a tokom rada se oslanja na toplotu koju su prostor i deo već primili.

### Sme li radna lampa u prostor gde se lakira?

Samo ako je za to namenjena. SATA za lampu trueSun navodi da se lampa, baterija i punjač nikada ne koriste u prostoru sa opasnošću od eksplozije i da se drže dalje od izvora paljenja i grejača[^sata-truesun-bal]. Carsystem za svoju LED lampu navodi da se ne koristi blizu otvorenog plamena[^cs-led-lamp-tds]. Rad sa sprejom na hladnom opisuje tekst [Rad sa sprejom po hladnom vremenu](/vodici/sprej-po-hladnom-vremenu).
