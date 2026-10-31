---
id: SV-0136
slug: pistolj-pljuje-ili-prekida
naslov: "Pištolj pljuje ili prekida mlaz: mogući uzroci"
metaNaslov: "Pištolj pljuje ili prekida mlaz: mogući uzroci"
opis: "Mogući uzroci nemirnog mlaza i mehurića u čaši prema SATA uputstvima, redosled provere i kako se proverava zaptivka dizne za materijal."
kategorija: oprema-i-pistolji
podtema: kvarovi pištolja
tip: resavanje-problema
publika:
  - hobista
  - profesionalac
glavnoPitanje: Zašto pištolj za lakiranje pljuje, prekida mlaz ili pulsira?
namera: rešavanje problema
dodatnaPitanja:
  - Kako se proverava zaptivka dizne?
  - Šta znače mehurići u čaši?
  - "Pištolj kaplje na vrhu dizne: da li je to isti problem?"
poreklopitanja:
  tip: urednicka-procena
  napomena: "Pitanje zašto pištolj „pljuje“ ili prekida mlaz je urednička procena (q224 u questions.json); SATA isti kvar opisuje u tabelama za otklanjanje smetnji u uputstvima za pištolje."
brendovi:
  - sata
proizvodi:
  - sata-jet-x
  - satajet-x-5500
  - sata-nozzle-cleaning-needles
povezani:
  - SV-0134
  - SV-0135
  - SV-0132
  - SV-0141
  - SV-0130
izvori:
  - id: sata-jetx-uputstvo
    naziv: "SATA, Operating manual jet X DIGITAL pro, DIGITAL, DIGITAL ready, BASIC (višejezično, engleski deo str. 91–109, Troubleshooting str. 104–106)"
    url: https://www.sata.com/media/2d/dc/44/1793362233/MULTILINGUAL-SATA-OPERATING-MANUAL-JET-X-3266-240619-2.PDF.PDF?ts=1793362233
    verzija: "3266-240619-2"
    pristupljeno: 2026-10-08
    tip: uputstvo-proizvodjaca
  - id: sata-x5500-uputstvo
    naziv: "SATA, Operating Manual SATAjet X 5500 RP/HVLP (DIGITAL) (višejezično, engleski deo str. 109–125, pogl. 10 Troubleshooting)"
    url: https://www.sata.com/media/44/43/ef/1793362234/BETRIEBSANLEITUNG-SATAJET-X-5500.PDF.PDF?ts=1793362234
    verzija: "3240-200610-1"
    pristupljeno: 2026-10-08
    tip: uputstvo-proizvodjaca
  - id: sata-saveti
    naziv: "SATA, Practical advice on painting technology and SATA products"
    url: https://www.sata.com/en/service/professional-knowledge/practical-advice/
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: sata-video-zaptivka
    naziv: "SATA, Application Videos: „SATA - Exchange of the fluid tip seal“ (spisak videa na stranici Professional knowledge)"
    url: https://www.sata.com/en/service/professional-knowledge/application-videos/
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
prioritet: 719
razlogPrioriteta: Rešava konkretan problem iz prakse; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvorena tabela otklanjanja smetnji u uputstvima jet X i SATAjet X 5500 i spisak SATA video materijala; ispravljeno 11: uzroci razdvojeni po simptomu kako ih SATA navodi (nemiran mlaz vs. mehurići u čaši, nova kolona u tabeli), dijagnostičke tvrdnje ublažene i označene kao opšte objašnjenje, video naveden samo po naslovu, redosled provere označen kao urednički."
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Kada pištolj pljuje, prekida mlaz ili pulsira, a u čaši se pojavljuju mehurići, to po opštem objašnjenju može da znači da u kanal za materijal ulazi vazduh ili da materijal ne dotiče ravnomerno. Za nemiran mlaz koji pljuje SATA kao moguće uzroke navodi nedovoljno pritegnutu diznu za materijal i oštećenu ili istrošenu zaptivku dizne; za mehuriće u čaši još i olabavljenu vazdušnu kapu, zapušen procep između vazdušne kape i dizne, zapušen ili oštećen set dizni, premalo materijala u čaši i neispravnu zaptivku igle[^sata-jetx-uputstvo]. Uzroci se proveravaju redom, od najjednostavnijeg, a konačan uzrok zavisi i od materijala i uslova rada.

## Mogući uzroci i provera

| Mogući uzrok | Uz koji simptom ga SATA navodi | Kako se proverava i otklanja |
| --- | --- | --- |
| premalo materijala u čaši | mehurići u čaši[^sata-jetx-uputstvo] | dopuniti čašu i ponoviti probu[^sata-jetx-uputstvo] |
| dizna za materijal nije dovoljno pritegnuta | nemiran mlaz koji pljuje, mehurići u čaši[^sata-jetx-uputstvo] | pritegnuti diznu; za SATAjet X 5500 uputstvo navodi moment od 11 Nm[^sata-x5500-uputstvo] |
| oštećena ili istrošena zaptivka dizne za materijal | nemiran mlaz koji pljuje, mehurići u čaši[^sata-jetx-uputstvo] | zameniti zaptivku[^sata-jetx-uputstvo] |
| olabavljena vazdušna kapa | mehurići u čaši[^sata-jetx-uputstvo] | pritegnuti kapu rukom[^sata-jetx-uputstvo] |
| zapušen procep između vazdušne kape i dizne | mehurići u čaši[^sata-jetx-uputstvo] | očistiti, prema poglavlju o čišćenju[^sata-jetx-uputstvo] |
| zapušen ili oštećen set dizni | mehurići u čaši[^sata-jetx-uputstvo] | očistiti set ili ga zameniti[^sata-jetx-uputstvo] |
| neispravna zaptivka igle | mehurići u čaši[^sata-jetx-uputstvo] | zameniti zaptivku igle[^sata-jetx-uputstvo] |

Iste uzroke za nemiran mlaz i mehuriće u čaši navodi i uputstvo za SATAjet X 5500[^sata-x5500-uputstvo]. Pre svake provere i rastavljanja pištolj se odvaja od vazduha[^sata-jetx-uputstvo].

## Redosled provere

Redosled je urednički predlog, od najjednostavnijeg ka složenijem; uzroci su iz SATA tabela, a objašnjenja uz njih su opšta.

1. **Količina materijala.** Najjednostavniji uzrok: kada je materijala malo, pištolj uz materijal može da povuče i vazduh.
2. **Pritegnutost.** Proverite vazdušnu kapu i diznu za materijal. Olabavljen spoj može da propušta vazduh u kanal za materijal.
3. **Čistoća.** Skinite set dizni i proverite procep između kape i dizne, otvore kape i vrh igle. Čistite samo SATA četkama i iglama za čišćenje dizni, kako je opisano u vodiču [Čišćenje pištolja posle rada](/vodici/ciscenje-pistolja-posle-rada).
4. **Zaptivke.** Ako ništa od prethodnog ne pomogne, na red dolaze zaptivka dizne za materijal i zaptivka igle.
5. **Set dizni.** Oštećenu diznu ili iglu SATA ne menja pojedinačno nego kao ceo set[^sata-saveti]. Više u vodiču [Redovno održavanje pištolja](/vodici/odrzavanje-pistolja).

Opšte objašnjenje: mlaz može da bude nemiran i kada materijal ne dotiče ravnomerno iz drugih razloga, na primer kada je cedilo u čaši zapušeno ili je materijal pregust za tu diznu. Te mogućnosti nisu u SATA tabeli za ovaj kvar, ali ih vredi proveriti; o cedilu piše vodič [Ceđenje materijala pre sipanja u pištolj](/vodici/cedjenje-materijala-pre-pistolja). Ako je mlaz miran, ali nepravilnog oblika, to je drugi problem, opisan u vodiču [Test lepeze na papiru](/vodici/test-lepeze-na-papiru).

## Pitanja i odgovori

### Kako se proverava zaptivka dizne?

Opšte objašnjenje: zaptivka dizne za materijal zaptiva spoj između dizne i tela pištolja. Opšti način provere: skinite iglu, vazdušnu kapu i diznu tim redom, pregledajte zaptivku i dosedne površine, pa ih očistite. Ako je zaptivka zarezana, deformisana ili nedostaje, zamenite je; SATA za oštećenu ili istrošenu zaptivku navodi zamenu kao rešenje za nemiran mlaz[^sata-jetx-uputstvo]. Zaptivke se za SATAjet X 5500 prodaju u pakovanju od pet komada[^sata-x5500-uputstvo]. Na stranici sa video materijalima SATA navodi i video pod nazivom „SATA - Exchange of the fluid tip seal“[^sata-video-zaptivka]; njegov sadržaj ovde ne prepričavamo. Posle zamene dizna se priteže prema uputstvu i proverava se lepeza.

### Šta znače mehurići u čaši?

Opšte objašnjenje: mehurići koji izlaze u čašu tokom prskanja ukazuju na to da vazduh ulazi u kanal za materijal. Prema SATA tabelama, uzrok može biti olabavljena vazdušna kapa, nepritegnuta dizna, oštećena zaptivka dizne, zapušen procep oko dizne, zapušen set dizni, neispravna zaptivka igle ili premalo materijala[^sata-jetx-uputstvo].

### Pištolj kaplje na vrhu dizne: da li je to isti problem?

Ne. Curenje na vrhu dizne SATA vezuje za nečistoću između vrha igle i dizne, oštećen set dizni ili zaprljanu zaptivku igle; rešenje je čišćenje dizne i igle ili zamena seta[^sata-jetx-uputstvo]. Ako materijal curi iza zaptivke igle, ona je neispravna ili nedostaje, ili je igla zapušena ili oštećena[^sata-jetx-uputstvo].
