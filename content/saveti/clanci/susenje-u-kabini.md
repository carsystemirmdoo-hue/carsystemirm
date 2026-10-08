---
id: SV-0121
slug: susenje-u-kabini
naslov: "Sušenje u kabini: faze ciklusa i temperatura objekta"
metaNaslov: "Sušenje u kabini: ciklus i temperatura objekta"
opis: "Kako izgleda ciklus sušenja u kabini od odzračivanja do hlađenja, zašto se vreme računa po temperaturi dela i koliko se čeka pre poliranja."
kategorija: uslovi-i-susenje
podtema: kabina
tip: postupak
publika:
  - profesionalac
  - vlasnik-radionice
glavnoPitanje: Kako se odvija ciklus sušenja u kabini i zašto je bitna temperatura objekta, a ne vazduha?
namera: postupak
dodatnaPitanja:
  - Koliko traje hlađenje pre poliranja?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Pitanje o ciklusu kabine je urednička procena; srodno pitanje koliko se čeka pre poliranja postavlja se na forumu za negu vozila (q095 u questions.json, https://autogeekonline.net/goto/post?id=1632037), a odgovori sa foruma nisu korišćeni kao izvor."
brendovi:
  - rm
  - baslac
  - carsystem
proizvodi:
  - c-2e50-clear-coat
  - c-2a46-ultratop
  - baslac-40-510-ambient-clear
  - carsystem-2k-clear-voc-speed-plus
  - carsystem-2k-clear-voc-420
povezani:
  - SV-0119
  - SV-0120
  - SV-0126
  - SV-0173
  - SV-0201
izvori:
  - id: rm-c2e50-tds
    naziv: "R-M, Technical Information C 2E50 Clear coat"
    dokument: /documents/products/rm/c-2e50-clear-coat/rm-c-2e50-clear-coat-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-c2p55-tds
    naziv: "R-M, Technical Information C 2P55 MULTI Finish-R, eSense clear coat, universal"
    dokument: /documents/products/rm/c-2p55-multi-finish-r/rm-c-2p55-multi-finish-r-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-c2a46-tds
    naziv: "R-M, Technical Information C 2A46 UltraTOP, Clear coat, performance"
    dokument: /documents/products/rm/c-2a46-ultratop/rm-c-2a46-ultratop-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: baslac-40-510-tds
    naziv: "baslac, Technical Information 40-510 Ambient clear"
    dokument: /documents/products/baslac/40-510.pdf
    verzija: "01/2024"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: baslac-gloss-levels
    naziv: "baslac, Technical Information Gloss levels – Mat finish"
    dokument: /documents/products/baslac/Gloss_levels.pdf
    verzija: "02/2025"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-speed-plus-tds
    naziv: "Carsystem, Technical Data Sheet 2K Clear VOC Speed Plus, 2K clear coat"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-clear-voc-speed-plus-v06.pdf
    verzija: "V06, 01/2025"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-clear-420-tds
    naziv: "Carsystem, Technical Data Sheet CS 2K Clear VOC 420, 2K clear coat"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-2k-clear-voc-420.pdf
    verzija: "V09, 11/2019"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 518
razlogPrioriteta: Dopunjuje osnovni vodič teme konkretnim pitanjem; raspoređeno naizmenično sa drugim temama.
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
Ciklus sušenja u kabini ima četiri dela: odzračivanje posle poslednjeg sloja, zagrevanje, zadržavanje na temperaturi sušenja i hlađenje. Vreme sušenja iz tehničkog lista važi od trenutka kada deo dostigne propisanu temperaturu, a ne od uključenja grejanja. R-M za bezbojni lak C 2E50 navodi 30 min na 60 °C i upozorava da se u kombinovanim kabinama uračuna dodatno vreme zagrevanja dok lim ne dostigne tu temperaturu[^rm-c2e50-tds]. Carsystem vremena za 2K Clear VOC Speed Plus daje izričito za temperaturu objekta: 25–30 min na 40 °C i 15 min na 60 °C[^cs-speed-plus-tds].

## Faze ciklusa

### 1. Odzračivanje pre sušenja

Zahtevi se razlikuju od laka do laka. Za C 2P55 R-M navodi da odzračivanje pre sušenja u kabini nije potrebno[^rm-c2p55-tds]. Carsystem za 2K Clear VOC 420 navodi 10 min odzračivanja pre sušenja na povišenoj temperaturi[^cs-clear-420-tds]. baslac za mat bezbojni lak traži odzračivanje dok površina ne postane potpuno mat i navodi da trajanje zavisi od brzine vazduha i temperature kabine, ali da ne treba da bude duže od 25 min[^baslac-gloss-levels].

### 2. Zagrevanje

Kabina prvo zagreva vazduh, a deo dostiže temperaturu tek posle nekog vremena. Koliko traje to zagrevanje, tehnički list laka ne navodi, jer zavisi od kabine i dela. Zato R-M za C 2E50 traži da se ono doda vremenu sušenja[^rm-c2e50-tds].

### 3. Sušenje na temperaturi objekta

Vreme se čita za temperaturu koju navodi tehnički list. Primeri:

| Proizvod | Sušenje prema tehničkom listu |
| --- | --- |
| R-M C 2E50 | 30 min na 60 °C[^rm-c2e50-tds] |
| R-M C 2A46 UltraTOP | 20 min na 40 °C ili 15 min na 60 °C[^rm-c2a46-tds] |
| baslac 40-510 sa 50-530 | 10 min na 60 °C temperature objekta, poliranje posle hlađenja[^baslac-40-510-tds] |
| Carsystem 2K Clear VOC Speed Plus | 25–30 min na 40 °C ili 15 min na 60 °C temperature objekta, do poliranja[^cs-speed-plus-tds] |

Viša temperatura nije uvek dozvoljena. Kod električnih vozila važe ograničenja zbog baterije, a R-M u tehničkim listovima napominje da se uputstva proizvođača vozila za popravku poštuju i zbog ugrađenih senzora[^rm-c2e50-tds]. Više o tome piše vodič [Lakiranje električnih i hibridnih vozila](/vodici/lakiranje-elektricnih-vozila).

### 4. Hlađenje

Posle sušenja na povišenoj temperaturi deo se hladi pre poliranja. R-M uz C 2E50 i C 2A46 navodi da se polira posle navedenog vremena sušenja i hlađenja[^rm-c2e50-tds][^rm-c2a46-tds], a baslac za 40-510 da je lak spreman za poliranje posle hlađenja[^baslac-40-510-tds]. Carsystem jedini u pregledanim listovima daje trajanje: pre poliranja laka 2K Clear VOC 420 sušenog na 60 °C treba sačekati do 1 h da se ohladi[^cs-clear-420-tds].

## Zašto temperatura objekta, a ne vazduha

Sloj boje ili laka nalazi se na delu i suši se na njegovoj temperaturi. Lim, plastika i deblji delovi ne zagrevaju se istom brzinom kao vazduh u kabini, pa termometar kabine može da pokaže temperaturu sušenja dok deo još nije stigao do nje. Ako se vreme računa od tog trenutka, sloj se suši kraće nego što tehnički list predviđa. Kako se vremena za različite temperature čitaju u tehničkom listu, objašnjava vodič [Faze sušenja iz tehničkog lista](/vodici/faze-susenja-iz-tehnickog-lista).

## Greške koje se lako naprave

Ovo je urednički izbor grešaka koje proizlaze iz pogrešnog razumevanja ciklusa, a ne statistika učestalosti.

- **Vreme se računa od uključenja grejanja**, a ne od trenutka kada deo dostigne temperaturu.
- **Preskače se odzračivanje** kod laka čiji ga tehnički list traži.
- **Polira se topao lak**, odmah po izlasku iz kabine.
- **Ciklus se podešava „po navici“**, iako drugi lak ili drugi učvršćivač traže drugo vreme.

Održavanje kabine i filtera opisuje tekst [Održavanje kabine za lakiranje i filteri](/vodici/filteri-kabine-odrzavanje).

## Pitanja i odgovori

### Koliko traje hlađenje pre poliranja?

Zavisi od proizvoda i dela. Carsystem za 2K Clear VOC 420 navodi do 1 h posle sušenja na 60 °C[^cs-clear-420-tds], dok R-M i baslac u pregledanim listovima traže hlađenje, ali ne daju broj minuta. Kada list ne navodi trajanje, sačekajte da se deo potpuno ohladi i proverite sa tehničkom podrškom. O samom poliranju piše vodič [Poliranje posle lakiranja](/vodici/poliranje-posle-lakiranja-osnove).

### Može li se ciklus skratiti višom temperaturom?

Samo ako tehnički list za tu temperaturu daje vreme. Za C 2A46 R-M navodi vremena za 20 °C, 40 °C i 60 °C[^rm-c2a46-tds]; temperatura koje nema u listu nije predviđena i rezultat se ne može proceniti iz tabele.
