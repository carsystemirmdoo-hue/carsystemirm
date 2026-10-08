---
id: SV-0012
slug: fabricki-i-reparaturni-lak
naslov: "Fabrički i reparaturni lak: zašto se popravka radi drugačije"
metaNaslov: "Fabrički i reparaturni lak: u čemu je razlika"
opis: "Zašto se reparaturni lak suši na nižoj temperaturi od fabričkog, šta to menja u radu i može li popravka da traje kao fabrički lak."
kategorija: osnove
podtema: OEM i reparaturni sistemi
tip: osnovni-vodic
publika:
  - pocetnik
  - hobista
glavnoPitanje: Po čemu se reparaturni lak razlikuje od fabričkog laka na automobilu?
namera: informativna
dodatnaPitanja:
  - Zašto se popravka ne suši na fabričkoj temperaturi?
  - Može li popravka da bude izdržljiva kao fabrički lak?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Osnovno pitanje za razumevanje reparaturnih sistema; nije pronađeno kao doslovno pitanje u pregledanim izvorima."
brendovi:
  - rm
  - baslac
  - carsystem
proizvodi:
  - c-2a40-airtop
  - rm-onyx-hd
  - carsystem-af-21-1k-filler
povezani:
  - SV-0010
  - SV-0011
  - SV-0124
  - SV-0126
  - SV-0153
izvori:
  - id: basf-rm-porsche
    naziv: "BASF, R-M Automotive Refinish Wins Global Technical Approval for Porsche"
    url: https://www.basf.com/jp/en/media/news-releases/global/2015/03/R-M-Porsche
    datumIzvora: 2015-03-05
    pristupljeno: 2026-10-08
    tip: vest-proizvodjaca
  - id: glasurit-nev
    naziv: "Glasurit, Glasurit launches first NEV Repair solutions for body shops"
    url: https://www.glasurit.com/gb/news/glasuritr-launches-first-nev-repair-solutions-body-shops
    datumIzvora: 2025-02-17
    pristupljeno: 2026-10-08
    tip: vest-proizvodjaca
  - id: rm-c2a40-tds
    naziv: "R-M, Technical Information C 2A40 AirTOP, Clear coat, air drying"
    dokument: /documents/products/rm/c-2a40-airtop/rm-c-2a40-airtop-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-onyx-hd-tds
    naziv: "R-M, Technical Information ONYX HD, Waterborne basecoat line"
    url: https://techinfo.rmpaint.com/unicorn/en/ONYX%20HD-ONYX%20HD%20Waterborne%20basecoat%20line.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: baslac-30-line-tds
    naziv: "baslac, Technical Information 30 Line, 30- Topcoat, direct gloss"
    dokument: /documents/products/baslac/30_Line.pdf
    verzija: "12/2025"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-af21-1k-tds
    naziv: "Carsystem, Technical Data Sheet AF.21 1K Filler, 1K Hybrid filler"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-af-21-1k-filler-v02.pdf
    verzija: "V02, 02/2025"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 210
razlogPrioriteta: Dopunjuje osnovni vodič teme konkretnim pitanjem; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: nije-provereno
  jezickaProvera: nije-provereno
strucnaPotvrda:
  potrebna: true
  razlog: "Za tok i temperature fabričkog lakiranja (pečenje u pećima na liniji) nije pronađen zvaničan izvor proizvođača iz našeg programa. Tekst zato ne navodi brojeve za fabrički postupak; opis fabričkog postupka treba da potvrdi stručnjak."
  status: potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Fabrički lak nanosi se na liniji u fabrici, na karoseriju koja još nije sklopljena, i stvrdnjava u pećima. Reparaturni lak nanosi se na gotovo vozilo, sa plastičnim delovima, elektronikom i, kod električnih vozila, baterijom. Zato je napravljen tako da se suši na sobnoj ili umereno povišenoj temperaturi. R-M, na primer, bezbojni lak C 2A40 AirTOP opisuje kao lak koji se suši na vazduhu[^rm-c2a40-tds], a za baslac 30 Line tehnički list navodi sušenje na 20 °C ili na 60 °C[^baslac-30-line-tds]. Razlika nije u tome da je jedan lak „pravi“, a drugi ne, već u uslovima pod kojima svaki mora da očvrsne.

## Kako nastaje fabrički lak

Fabrički sistem ima više slojeva, od kataforetskog sloja (KTL, e-coat) preko punioca i bazne boje do bezbojnog laka. U objavi BASF-a iz 2015. R-M je opisan kao reparaturni brend koji je ujedno isporučilac cele tehnologije fabričkog lakiranja za Porsche, od kataforetskih slojeva do baznih boja i bezbojnih lakova[^basf-rm-porsche]. Isti proizvođač, dakle, može da pravi i fabrički i reparaturni lak, ali to su različiti proizvodi, jer su različiti uslovi rada.

Na liniji se cela karoserija lakira odjednom, u kontrolisanim uslovima, i peče se pre nego što se ugrade delovi osetljivi na toplotu. U radionici toga nema: lakira se jedan deo ili zona, na vozilu koje se posle popravke vraća vlasniku.

## Zašto popravka ne može na fabričkoj temperaturi

- **Delovi osetljivi na toplotu.** Na sklopljenom vozilu su plastika, zaptivke, kablovi i senzori. Svi tehnički listovi iz primera zato napominju da se uz uputstvo za materijal moraju poštovati i uputstva proizvođača vozila za popravku, posebno zbog ugrađenih senzora[^baslac-30-line-tds][^rm-onyx-hd-tds].
- **Električna vozila.** Glasurit, brend koji je 2025. pripadao BASF Coatings i nije u našem programu, objavio je u februaru 2025. da pri popravci električnih vozila temperatura sušenja mora ostati ispod 60 °C, najduže 45 minuta, da bi se zaštitila baterija[^glasurit-nev]. Na šta još treba paziti opisuje vodič [Lakiranje električnih i hibridnih vozila](/vodici/lakiranje-elektricnih-vozila).
- **Oprema radionice.** Kabina za lakiranje greje vazduh i objekat do temperature koju navodi tehnički list, a ne do temperature fabričke peći.

## Šta to menja u radu

Reparaturni materijali su prilagođeni tim uslovima, pa im se i vremena razlikuju od proizvoda do proizvoda:

| Proizvod | Vrsta | Sušenje prema tehničkom listu |
| --- | --- | --- |
| baslac 30 Line sa učvršćivačem 50-20 | boja sa direktnim sjajem | 8 h na 20 °C ili 30 min na 60 °C[^baslac-30-line-tds] |
| R-M ONYX HD | vodena bazna boja | 15 min na 20 °C ili 10 min na 40 °C[^rm-onyx-hd-tds] |
| Carsystem AF.21 1K Filler | 1K punilac | 20–25 min na 20 °C ili 5–10 min na 60 °C temperature objekta[^cs-af21-1k-tds] |

Vrednosti važe za navedene uslove i verzije dokumenata. Sušenje na nižoj temperaturi traje duže, pa je u radionici važno poštovati vremena pre brušenja, poliranja i montaže. Šta znače izrazi kao „suvo na prašinu“ i „suvo za montažu“ objašnjava vodič [Faze sušenja iz tehničkog lista](/vodici/faze-susenja-iz-tehnickog-lista), a koliko traje potpuno očvršćavanje tekst [Potpuno otvrdnjavanje laka](/vodici/potpuno-otvrdnjavanje-laka).

## Razlike koje se vide okom

Popravka treba da se uklopi u fabrički lak koji je već na vozilu. Zato se pri popravci usklađuju nijansa, tekstura površine i sjaj. Nijansa se proverava na probnom limu, a tekstura (narandžina kora) zavisi i od tehnike nanošenja. O tome pišu vodiči [Probni lim](/vodici/probni-lim-pre-lakiranja) i [Narandžina kora na laku](/vodici/narandzina-kora).

## Pitanja i odgovori

### Zašto se popravka ne suši na fabričkoj temperaturi?

Zato što vozilo u radionici više nije gola karoserija. Toplota koju podnosi lim ne podnose plastika, elektronika i baterija, pa reparaturni materijali moraju da očvrsnu na nižoj temperaturi. Granice za konkretno vozilo daje proizvođač vozila u uputstvu za popravku.

### Može li popravka da bude izdržljiva kao fabrički lak?

Proizvođači vozila odobravaju reparaturne sisteme tek posle ispitivanja. BASF je 2015. objavio da je R-M dobio globalno tehničko odobrenje Porschea za popravke posle udesa, uključujući garancijske popravke, i da Porsche odobrava samo proizvode koji ispune njegove zahteve za kvalitet i svojstva[^basf-rm-porsche]. Trajnost konkretne popravke ipak zavisi i od pripreme, izbora materijala i poštovanja tehničkih listova.
