---
id: SV-0168
slug: paucinasto-izvlacenje
naslov: Paučinasto izvlačenje mlaza pri nanošenju
metaNaslov: "Materijal izlazi u nitima: paučinasto izvlačenje"
opis: "Zašto boja ili lak izlaze iz spreja ili pištolja u nitima umesto u finoj magli, šta se proverava i šta tehnički listovi sprejeva navode o temperaturi i razmaku."
kategorija: greske-pri-lakiranju
podtema: izvlačenje niti
tip: resavanje-problema
publika:
  - hobista
glavnoPitanje: Zašto materijal pri nanošenju izlazi u nitima umesto u finoj magli?
namera: rešavanje problema
dodatnaPitanja:
  - Pojavljuje li se i kod spreja?
  - Šta da radim sa delom na koji su već pale niti?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Urednički predlog q248 u questions.json (paučinasto izvlačenje spreja, engl. cobwebbing); nije pronađen kao doslovno pitanje u javnom izvoru koji bi se mogao navesti."
brendovi:
  - cosmos-lac
  - carsystem
proizvodi:
  - cosmos-lac-automotive-030-400-ml-prefilled-030-1k
  - cosmos-lac-varnishes-370-providna-400-ml-metal-varnish-370-transparent
  - carsystem-clear-coat-spray
povezani:
  - SV-0214
  - SV-0213
  - SV-0206
  - SV-0130
  - SV-0161
izvori:
  - id: ppg-cobwebbing
    naziv: "PPG Refinish, Common Paint Defects Guide: Cobwebbing (proizvođač koji nije u našem programu)"
    url: https://www.ppg.com/en-AE/automotive-refinish/common-paint-defects-guide/cobwebbing
    pristupljeno: 2026-10-08
    tip: strucni-izvor
  - id: cosmos-prefilled-tds
    naziv: "Cosmos Lac, TDS Prefilled Spray"
    url: https://cosmoslac.com/pdfs/products/en/prefilled.pdf
    verzija: "02, 18/06/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cosmos-metal-varnish-tds
    naziv: "Cosmos Lac, TDS Metal Varnish (sprej)"
    url: https://cosmoslac.com/pdfs/products/en/metal-varnish.pdf
    verzija: "02, 17/06/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-clear-spray-tds
    naziv: "Carsystem, Technical Data Sheet Klarlack-Spray / Clear Coat Spray"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-klarlack-spray-clear-coat-spray.pdf
    verzija: "v.02, 03/2021"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-speed-plus-tds
    naziv: "Carsystem, Technical Data Sheet 2K Clear VOC Speed Plus, 2K clear coat"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-clear-voc-speed-plus-v06.pdf
    verzija: "V06, 01/2025"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 1621
razlogPrioriteta: Rešava konkretan problem iz prakse; raspoređeno naizmenično sa drugim temama.
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
Kada materijal izlazi u tankim nitima, kao paučina, umesto u finoj magli, to znači da se mlaz ne raspršuje kako treba. PPG (proizvođač koji nije u našem programu) ovu grešku (engl. *cobwebbing*) opisuje kao niti materijala koje se ne raspadnu u sitne kapi, a kao moguće uzroke navodi hladan materijal koji se zgusnuo, pogrešan pritisak ili previsok viskozitet i neodgovarajući razređivač[^ppg-cobwebbing]. Kod spreja je, po uredničkoj proceni, prvo što treba proveriti temperatura limenke i prostora.

Opšti redosled provere greške opisan je u vodiču [Greške pri lakiranju: kako se proverava uzrok pre sanacije](/vodici/greske-pri-lakiranju-kako-se-proverava-uzrok).

## Kako izgleda greška

- Iz dizne izlaze vidljive niti koje padaju na deo ili lebde u vazduhu.
- Na površini ostaju tanke linije ili mrežica, a ne ravnomeran sloj.
- Mlaz je neujednačen i „vlaknast“ već na probnoj površini.

Treba je razlikovati od suvog, hrapavog sloja: tamo se materijal raspršuje, ali kapi stignu suve na deo. To je tema vodiča [Suv, hrapav lak (suvo prskanje)](/vodici/suvo-prskanje-hrapav-lak).

## Kod spreja: šta proveriti

Proizvođači sprejeva iz našeg programa ne opisuju ovu grešku u tehničkim listovima koje smo pregledali. Daju, međutim, uslove nanošenja, i od njih vredi poći:

1. **Temperatura.** Cosmos Lac za Prefilled Spray i Metal Varnish navodi najbolju temperaturu nanošenja od 10–25 °C[^cosmos-prefilled-tds][^cosmos-metal-varnish-tds]. Hladna limenka, na primer iz automobila ili negrejane garaže, može biti hladnija od vazduha u prostoriji. Cosmos Lac navodi i da se proizvod čuva na 5–35 °C i da se nikada ne ostavlja u vozilu[^cosmos-prefilled-tds].
2. **Mućkanje.** Za Carsystem Clear Coat Spray navodi se mućkanje od najmanje 3 minuta pre upotrebe[^cs-clear-spray-tds]. Cosmos Lac navodi temeljno mućkanje[^cosmos-prefilled-tds].
3. **Razmak.** Cosmos Lac navodi 25–30 cm od površine[^cosmos-prefilled-tds], a Carsystem za svoj sprej oko 20–30 cm[^cs-clear-spray-tds]. Razmak važi za taj proizvod, ne za sve sprejeve.
4. **Proba.** Cosmos Lac preporučuje da se sprej prvo isproba na probnoj površini[^cosmos-prefilled-tds]. Ako niti izlaze i na probi, ne nastavljajte na delu.
5. **Ventil i kapica.** Opšte objašnjenje: delimično zapušena kapica takođe kvari mlaz. Kako se ventil čisti posle rada, opisuje vodič [Zapušen ventil spreja](/vodici/zapusen-ventil-spreja).

Ako je limenka bila hladna, ostavite je da se postepeno izjednači sa temperaturom prostorije. O radu sa sprejom kada je hladno piše vodič [Sprej po hladnom vremenu](/vodici/sprej-po-hladnom-vremenu).

## Kod pištolja: šta proveriti

PPG kao sanaciju navodi smanjenje pritiska vazduha i/ili viskoziteta dok niti ne nestanu[^ppg-cobwebbing]. U praksi to znači proveru tri stvari prema tehničkom listu materijala:

- **Viskozitet.** Tehnički list daje viskozitet za nanošenje uz temperaturu. Za Carsystem 2K Clear VOC Speed Plus to je 16–18 sekundi u DIN 4 čaši na 20 °C[^cs-speed-plus-tds]. Kako se meri, objašnjava vodič [Viskozitet i DIN 4 čaša](/vodici/viskozitet-din4).
- **Razređivač.** Da li je dodat razređivač iz istog sistema, u propisanoj količini.
- **Pritisak i podešavanje.** Prema uputstvu pištolja i tehničkom listu; vidi [Podešavanje pištolja](/vodici/podesavanje-pistolja).

## Ograničenja

PPG napominje da se neki specijalni materijali teško raspršuju i traže posebnu opremu[^ppg-cobwebbing]. Ako se niti javljaju i kada su temperatura, viskozitet i podešavanje u granicama tehničkog lista, pitajte tehničku podršku proizvođača materijala. Za sprejeve iz našeg programa nismo pronašli opis ove greške od samog proizvođača, pa se uzroci ovde oslanjaju na PPG vodič.

## Pitanja i odgovori

### Pojavljuje li se i kod spreja?

Može. Kod spreja se pritisak i sastav ne podešavaju, pa ostaju uslovi nanošenja koje tehnički list navodi: temperatura, mućkanje i razmak. Cosmos Lac za svoje sprejeve daje opseg temperature i razmak od površine[^cosmos-prefilled-tds], pa je to prvo što treba uporediti.

### Šta da radim sa delom na koji su već pale niti?

Opšte objašnjenje: niti u svežem sloju ne mogu da se razliju u ravan sloj. Pustite sloj da se osuši prema tehničkom listu, zatim mesto fino izbrusite i nanesite ponovo, pošto otklonite uzrok. Cosmos Lac za svoje sprejeve preporučuje dva do tri tanka sloja sa razmakom od 3–5 minuta[^cosmos-prefilled-tds], pa se i ponovni nanos radi u tankim slojevima.
