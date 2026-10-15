---
id: SV-0116
slug: temperatura-i-vlaznost-pri-lakiranju
naslov: "Temperatura i vlažnost pri lakiranju: vazduh, deo i materijal"
metaNaslov: "Temperatura i vlažnost vazduha pri lakiranju"
opis: "Kako temperatura vazduha, dela i materijala i relativna vlažnost utiču na lakiranje, šta je tačka rose i gde su granice u tehničkim listovima."
kategorija: uslovi-i-susenje
podtema: uslovi rada
tip: osnovni-vodic
publika:
  - hobista
  - profesionalac
glavnoPitanje: Kako temperatura vazduha, temperatura podloge i vlažnost utiču na lakiranje?
namera: informativna
dodatnaPitanja:
  - Šta je tačka rose?
  - Koja temperatura je presudna?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Pitanja o temperaturi vazduha i lima i o tački rose su urednički predlozi q217 i q221 u questions.json; nisu pronađena kao doslovno pitanje u javnom izvoru koji bi se mogao navesti."
brendovi:
  - rm
  - baslac
  - carsystem
proizvodi:
  - c-2a40-airtop
  - carsystem-2k-voc-filler-540
  - carsystem-2k-clear-voc-speed-plus
  - rm-agilis
  - h-2p05-clear-harden-r
povezani:
  - SV-0117
  - SV-0118
  - SV-0119
  - SV-0109
  - SV-0164
izvori:
  - id: rm-c2a40-tds
    naziv: "R-M, Technical Information C 2A40 AirTOP, Clear coat, air drying"
    dokument: /documents/products/rm/c-2a40-airtop/rm-c-2a40-airtop-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-filler-540-tds
    naziv: "Carsystem, Technical Data Sheet 2K Filler VOC 540, 2K acrylic filler"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-fueller-voc-540.pdf
    verzija: "V11, 03/2019"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-speed-plus-tds
    naziv: "Carsystem, Technical Data Sheet 2K Clear VOC Speed Plus, 2K clear coat"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-clear-voc-speed-plus-v06.pdf
    verzija: "V06, 01/2025"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-h2p05-tds
    naziv: "R-M, Technical Information H 2P05 CLEAR Harden-R"
    dokument: /documents/products/rm/h-2p05-clear-harden-r/rm-h-2p05-clear-harden-r-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-agilis-tds
    naziv: "R-M, Technical Information AGILIS, Waterborne basecoat"
    url: https://techinfo.rmpaint.com/unicorn/en/AGILIS-Waterborne%20basecoat.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-2560-tds
    naziv: "R-M, Technical Information A 2560 AGILIS AMPLIFIER"
    dokument: /documents/products/rm/2560-agilis-amplifier/rm-2560-agilis-amplifier-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: baslac-gloss-levels
    naziv: "baslac, Technical Information Gloss levels – Mat finish"
    dokument: /documents/products/baslac/Gloss_levels.pdf
    verzija: "02/2025"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: wattyl-dew-point
    naziv: "Wattyl, InfoSheet I-05 Ambient Application Conditions (Air Temperature, Substrate Temperature, Relative Humidity, Dew Point)"
    url: https://info.wattyl.com.au/Content/Docs/P&M_20210615_InfoSheets_I-05%20AMBIENT%20APPLICATION%20CONDITIONS.pdf
    verzija: "Version 6, March 2021"
    pristupljeno: 2026-10-08
    tip: strucni-izvor
prioritet: 18
razlogPrioriteta: Osnovni vodič teme — ulaz u tematsku celinu, objavljuje se rano da bi kasniji tekstovi imali na šta da se oslone.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvoreni C 2A40, H 2P05, AGILIS, A 2560 07/2026, 2K Filler VOC 540 V11, 2K Clear VOC Speed Plus V06, baslac Gloss levels 02/2025 i Wattyl I-05 Version 6; Wattyl jasno označen kao proizvođač van programa, a pravilo 3 °C kao pravilo za industrijske zaštitne premaze, ne za reparaturne materijale; ispravljeno: formulacija o važenju podataka van opsega, viskozitet umesto gustine."
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Na lakiranje utiču tri temperature (vazduha u prostoru, dela koji se lakira i samog materijala) i relativna vlažnost vazduha. Proizvođači za svaki proizvod navode opseg u kome važe podaci iz tehničkog lista. R-M za bezbojni lak C 2A40 navodi najbolje rezultate pri vlažnosti od 20–80 % i temperaturi od 15–35 °C[^rm-c2a40-tds]. Carsystem za 2K Filler VOC 540 i 2K Clear VOC Speed Plus navodi uslove rada od 18–22 °C uz relativnu vlažnost od 40–60 %[^cs-filler-540-tds][^cs-speed-plus-tds]. Van tih granica podaci iz tehničkog lista, kao vremena sušenja i izgled sloja, ne moraju da važe.

## Tri temperature, ne jedna

Kada se kaže „temperatura pri lakiranju“, misli se na tri različite vrednosti:

- **Temperatura vazduha** u kabini ili prostoriji. Nju pokazuje termometar na zidu ili displej kabine.
- **Temperatura objekta** (lima, plastike). Deo koji je tek unet spolja ili je stajao na suncu može imati drugačiju temperaturu od vazduha oko njega.
- **Temperatura materijala** u limenci i pištolju. Proizvod iz hladnog magacina ostaje hladan još neko vreme posle unošenja.

Carsystem to piše izričito: pre nanošenja temperaturu proizvoda, kabine i objekta treba podesiti na oko 20 °C, a proizvod treba da dostigne temperaturu za rad prirodno, bez naglog zagrevanja ili hlađenja[^cs-filler-540-tds]. Isti list ne preporučuje nanošenje ispod 18 °C, jer niska temperatura menja svojstva sloja i može da pokvari izgled[^cs-filler-540-tds].

I podaci za nanošenje vezani su za temperaturu. Viskozitet za 2K Filler VOC 540 dat je za 20 °C: 25–30 sekundi u DIN 4 čaši[^cs-filler-540-tds]. Isti materijal na nižoj ili višoj temperaturi neće imati isti viskozitet u pištolju.

## Vlažnost vazduha

Vlažnost deluje na više mesta, i to na različite načine kod rastvaračkih i vodenih materijala.

- **2K učvršćivači.** R-M u tehničkom listu učvršćivača H 2P05 upozorava da su učvršćivači osetljivi na vlagu i da posude sa ostatkom treba pažljivo zatvoriti[^rm-h2p05-tds]. O zamućenom učvršćivaču piše vodič [Zamućen ili kristalisan učvršćivač](/vodici/ucvrscivac-zamucen-ili-kristalisan).
- **Vodene bazne boje.** Voda iz sloja mora da ispari, pa vlažnost i strujanje vazduha utiču na odzračivanje. R-M za AGILIS predviđa posebne komponente sa oznakom X za visoke temperature, nisku vlažnost ili velike površine[^rm-agilis-tds]. Za AGILIS AMPLIFIER A 2560 navodi da pri nižoj temperaturi okoline ili većoj vlažnosti može biti potrebno duže odzračivanje[^rm-2560-tds]. Razlike između vodenih i rastvaračkih baza objašnjava vodič [Vodene i rastvaračke bazne boje](/vodici/vodene-i-rastvaracke-bazne-boje).
- **Odzračivanje laka.** Ni kod rastvaračkog laka vreme odzračivanja nije fiksno: baslac za mat bezbojni lak navodi da vreme odzračivanja zavisi od brzine vazduha i temperature kabine i da ne treba da traje duže od 25 minuta[^baslac-gloss-levels].

Previsoka vlažnost može da se vidi i na samom laku. Mogući uzroci i provera opisani su u tekstu [Mlečan ili zamućen lak pri visokoj vlažnosti](/vodici/mlecan-lak-pri-vlaznosti).

## Kako da proverite uslove pre rada

1. Izmerite temperaturu i relativnu vlažnost vazduha u prostoru gde lakirate.
2. Izmerite temperaturu dela, a ne samo vazduha. Beskontaktni termometar pokazuje temperaturu površine.
3. Proverite gde je materijal stajao pre rada i da li je imao vremena da se izjednači sa prostorom.
4. Uporedite izmerene vrednosti sa opsegom iz tehničkog lista proizvoda koji koristite.
5. Ako uslovi odstupaju, prilagodite izbor učvršćivača i razređivača prema tabeli proizvođača. Vodič [Brzi, normalni ili spori učvršćivač](/vodici/izbor-ucvrscivaca-po-temperaturi) pokazuje kako se ta tabela čita.

Rad na niskim i visokim temperaturama obrađuju posebni tekstovi: [Lakiranje po hladnom vremenu](/vodici/lakiranje-po-hladnom-vremenu) i [Lakiranje po velikoj vrućini](/vodici/lakiranje-po-vrucini).

## Ograničenja

Granice se razlikuju od proizvoda do proizvoda. Za C 2A40 R-M kao donju granicu navodi 15 °C[^rm-c2a40-tds], a Carsystem za svoj punilac ne preporučuje rad ispod 18 °C[^cs-filler-540-tds]. Zato se vrednost iz jednog tehničkog lista ne prenosi na drugi proizvod. Kada izmerite uslove koji su na samoj granici ili van nje, proverite sa tehničkom podrškom proizvođača da li i kako sme da se radi.

## Pitanja i odgovori

### Šta je tačka rose?

Tačka rose je temperatura na kojoj vlaga iz vazduha počinje da se kondenzuje. Australijski proizvođač industrijskih premaza Wattyl (nije u našem programu) u informativnom listu o uslovima nanošenja kao uobičajenu meru sigurnosti navodi da podloga bude najmanje 3 °C toplija od tačke rose[^wattyl-dew-point]. To pravilo je dato za industrijske zaštitne premaze (list kao primere navodi epoksidne i cink-silikatne premaze), a ne za reparaturne auto-boje, pa ga ne čitajte kao preporuku za materijale iz našeg programa. Tehnički listovi reparaturnih materijala iz našeg programa koje smo pregledali ne pominju tačku rose, ali njihovi opsezi vlažnosti i temperature objekta služe istoj svrsi: da na površini ne bude vlage kada se nanosi materijal. U praksi je rizik najveći kada se hladan deo unese u topliju i vlažniju prostoriju.

### Koja temperatura je presudna?

Sve tri, ali na različit način. Temperatura materijala utiče na viskozitet i nanošenje, temperatura vazduha na odzračivanje, a temperatura objekta na to kako sloj na delu reaguje i suši se. Carsystem vremena sušenja za 2K Filler VOC 540 daje prema temperaturi objekta, za 20 °C i 60 °C[^cs-filler-540-tds]. Kako se vremena za različite temperature čitaju iz tehničkog lista, objašnjava vodič [Faze sušenja iz tehničkog lista](/vodici/faze-susenja-iz-tehnickog-lista).
