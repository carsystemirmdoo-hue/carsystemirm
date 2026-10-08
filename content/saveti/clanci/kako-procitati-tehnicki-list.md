---
id: SV-0203
slug: kako-procitati-tehnicki-list
naslov: Kako se čita tehnički list proizvoda
metaNaslov: "Kako se čita tehnički list proizvoda za lakiranje"
opis: "Šta sadrži tehnički list materijala za lakiranje, kojim redom ga čitati pre rada i kako proveriti verziju dokumenta, uz primere iz tri lista iz našeg programa."
kategorija: tehnicka-dokumentacija
podtema: tehnički list
tip: osnovni-vodic
publika:
  - hobista
  - profesionalac
glavnoPitanje: Šta sadrži tehnički list proizvoda i kojim redom ga čitati pre rada?
namera: informativna
dodatnaPitanja:
  - Šta ako tehnički list nije na srpskom?
  - Kako se proverava verzija dokumenta?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Pitanje o sadržaju i redosledu čitanja tehničkog lista je urednička procena iz pregleda tema; nije pronađeno u javnom izvoru koji bi se mogao navesti."
brendovi:
  - rm
  - baslac
  - carsystem
proizvodi:
  - c-2a40-airtop
  - baslac-40-100-high-speed-2k-clear-voc
  - carsystem-git-multi-green
povezani:
  - SV-0207
  - SV-0209
  - SV-0204
  - SV-0108
  - SV-0111
izvori:
  - id: rm-c2a40-tds
    naziv: "R-M, Technical Information C 2A40 AirTOP, Clear coat, air drying"
    url: https://techinfo.rmpaint.com/unicorn/en/C%202A40-Clear%20coat%20air%20drying.pdf
    dokument: /documents/products/rm/c-2a40-airtop/rm-c-2a40-airtop-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: baslac-40-100-tds
    naziv: "baslac, Technical Information 40-100 High Speed 2K Clear VOC"
    url: https://techinfo.baslac.com/en/40-100.pdf
    dokument: /documents/products/baslac/40-100.pdf
    verzija: "06/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: carsystem-multi-green-tds
    naziv: "Carsystem, Technical Data Sheet Multi Green, Polyester multifunctional putty V08"
    dokument: /documents/products/carsystem/carsystem-git-multi-green-tds.pdf
    verzija: "V08, 11/2024"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 25
razlogPrioriteta: Osnovni vodič teme — ulaz u tematsku celinu, objavljuje se rano da bi kasniji tekstovi imali na šta da se oslone.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: nije-provereno
  jezickaProvera: nije-provereno
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Tehnički list (TDS, engl. *technical data sheet*) je dokument proizvođača koji opisuje za šta je proizvod namenjen i kako se priprema, nanosi i suši. Pre rada se čita redom kojim teče posao: namena i podloge, napomene, mešanje, nanošenje, sušenje i dalja obrada. Pre svega toga proverite da li je list za tačno Vaš proizvod i koja je verzija. Vrednosti važe samo za taj proizvod i navedene uslove i ne prenose se na drugi materijal.

## Šta se nalazi u tehničkom listu

Tehnički listovi R-M i baslac imaju gotovo isti raspored, a listovi drugih proizvođača se razlikuju po izgledu, ne po suštini. Tipični blokovi su:

| Blok (naziv na engleskom) | Šta sadrži |
| --- | --- |
| Application, Key Features | za šta je proizvod namenjen i čime se ističe |
| Remarks | posebni uslovi i ograničenja: šta se mora dodati, šta se ne sme kombinovati |
| Handling | priprema podloge i podloge na koje proizvod može da se nanese |
| Mixing Ratio | odnos mešanja, učvršćivač i razređivač koji idu uz proizvod |
| Spray Viscosity, Potlife | viskozitet za nanošenje i vreme upotrebljivosti smeše |
| Application | pištolj, pritisak, dizna, broj slojeva, odzračivanje i debljina sloja |
| Drying, Sanding | vreme sušenja po temperaturi i granulacija za brušenje |
| Safety Advice | bezbednosne napomene i podatak o VOC |

Carsystem list za kit Multi Green ima drugačije naslove (*Description*, *Area of application*, *Product Data*, *Handling*, *Storage*), ali iste vrste podataka. Odeljak o bezbednosti u njemu ne ponavlja mere zaštite. Upućuje na bezbednosni list proizvođača za rukovanje i odlaganje otpada[^carsystem-multi-green-tds].

## Kojim redom ga čitati pre rada

1. **Naziv, šifra i verzija.** Uporedite naziv i šifru sa ambalažom. Mnogi proizvodi imaju slična imena, a jedna cifra u šifri znači drugi proizvod.
2. **Namena i podloge.** Proverite da li je proizvod predviđen za Vašu podlogu i vrstu popravke.
3. **Napomene.** Ovde su uslovi koje je lako prevideti. Za bezbojni lak R-M C 2A40 list navodi da se u svaki sloj vodene bazne boje ispod laka dodaje 5 % aktivatora A 2210 i da se smeše sa MIXINGBASE W ne mogu koristiti sa tim aktivatorom[^rm-c2a40-tds].
4. **Mešanje.** Odnos mešanja, i to po zapremini ili po težini, kao i vreme upotrebljivosti. Za C 2A40 list daje odnos 1:1 + 20 % po zapremini i vreme upotrebljivosti od 25 minuta na 20 °C[^rm-c2a40-tds]. Više o zapisu odnosa mešanja: [Odnos mešanja: kako se čita i meri](/vodici/odnos-mesanja-iz-tehnickog-lista).
5. **Nanošenje.** Pištolj, dizna, pritisak, broj slojeva i vreme između slojeva. Za baslac 40-100 list navodi dva sloja i najmanje 3 minuta odzračivanja između njih na 20 °C, kao i debljinu sloja od 40–50 µm[^baslac-40-100-tds].
6. **Sušenje.** Vreme sušenja važi za navedenu temperaturu, a često i za određeni učvršćivač. Za 40-100 sa normalnim učvršćivačem 50-420 list navodi 3 h na 20 °C, 25 min na 40 °C i 15 min na 60 °C[^baslac-40-100-tds].
7. **Dalja obrada.** Brušenje, prelakiranje i šta se nanosi preko proizvoda. Za Multi Green list navodi suvo brušenje granulacijama od P80 do P240 kada se koristi kao kit za popunjavanje[^carsystem-multi-green-tds].
8. **Bezbednost.** Odeljak o bezbednosti u tehničkom listu je kratak. Za zaštitu, skladištenje i otpad čita se [bezbednosni list](/vodici/bezbednosni-list-16-odeljaka).

Ako neki podatak nedostaje, to ne znači da ograničenje ne postoji. Pitajte prodavca ili proizvođača umesto da ga preuzmete iz lista za sličan proizvod.

## Kako se proverava verzija dokumenta

Verzija se obično vidi u zaglavlju ili podnožju svake strane. R-M i baslac listovi nose mesec i godinu na svakoj strani: C 2A40 ima oznaku 07/2026[^rm-c2a40-tds], a 40-100 oznaku 06/2026[^baslac-40-100-tds]. Carsystem uz naziv proizvoda navodi broj verzije i datum: Multi Green V08, 11/2024[^carsystem-multi-green-tds].

R-M u napomeni na kraju lista piše da najnovija verzija zamenjuje sve prethodne i da se može dobiti na sajtu proizvođača ili od prodajnog partnera[^rm-c2a40-tds]. Zato odštampan ili sačuvan list povremeno uporedite sa onim na sajtu. Gde se listovi nalaze opisuje vodič [Gde se nalazi tehnički i bezbednosni list za proizvod](/vodici/gde-naci-tehnicki-list).

## Šta tehnički list ne zamenjuje

- **Bezbednosni list.** Tehnički list opisuje rad sa proizvodom, a bezbednosni opasnosti, zaštitu i postupanje u nezgodi.
- **Vlastitu proveru.** U napomeni R-M navodi da podaci ne oslobađaju korisnika obaveze da sam ispita i proveri proizvod za svoju primenu[^rm-c2a40-tds]. Probni lim pre većeg posla je zato deo dobre prakse.
- **Uputstvo proizvođača vozila.** R-M i baslac listovi napominju da se uz njih uvek poštuju i uputstva proizvođača vozila za popravke, naročito kada su u blizini ugrađeni senzori[^baslac-40-100-tds].

## Pitanja i odgovori

### Šta ako tehnički list nije na srpskom?

Tehnički listovi koje proizvođači iz našeg programa objavljuju uglavnom su na engleskom ili nemačkom. Izrazi se ponavljaju od lista do lista, pa je dovoljno naučiti dvadesetak osnovnih. Prevodi su u vodiču [Tehnički list na nemačkom ili engleskom: ključni izrazi](/vodici/tehnicki-list-na-stranom-jeziku). Ako niste sigurni šta neki podatak znači, pitajte prodavca pre rada.

### Kako se proverava verzija dokumenta?

Pogledajte oznaku meseca i godine ili broj verzije na stranama lista i uporedite je sa listom na sajtu proizvođača. Ako se razlikuju, važi novija verzija.

### Da li vrednosti iz jednog lista važe za sličan proizvod?

Ne. Dva bezbojna laka istog proizvođača mogu imati različit odnos mešanja, vreme upotrebljivosti i sušenje. Za svaki proizvod koristi se njegov list.
