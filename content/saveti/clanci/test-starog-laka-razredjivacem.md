---
id: SV-0036
slug: test-starog-laka-razredjivacem
naslov: "Test starog laka razređivačem: da li podloga podnosi novi sloj"
metaNaslov: "Test starog laka razređivačem pre lakiranja"
opis: "Kako se proverava da li stara, nepoznata boja podnosi rastvarače novog sistema: test na probrušenom mestu, omekšavanje i kada se sloj uklanja."
kategorija: priprema-povrsine
podtema: provera podloge
tip: postupak
publika:
  - profesionalac
glavnoPitanje: Kako se proverava da li stara, nepoznata boja može bezbedno da se lakira?
namera: postupak
dodatnaPitanja:
  - Šta znači ako stari lak omekša?
  - Kada je potrebna izolacija?
poreklopitanja:
  tip: pronadjeno-u-izvoru
  napomena: "Pitanje zašto se boja nabira kada se prska preko stare boje postavlja se u FAQ proizvođača aerosola koji nije naš brend (q084, služi samo kao dokaz pitanja); pitanje o testu razređivačem je urednički predlog (q152)."
  izvori:
    - https://faq.edding.com/What-causes-the-paint-to-wrinkle-(%22lift%22)-when-I-use-edding-5200-permanent-spray%3F
brendovi:
  - rm
  - carfit
proizvodi:
  - rm-pk-1p10-silicone-remov-r
  - carfit-silicone-remover
povezani:
  - SV-0035
  - SV-0158
  - SV-0037
  - SV-0030
  - SV-0024
izvori:
  - id: glasurit-prirucnik
    naziv: "Glasurit (BASF), Technical Information AD3233G, tehnički priručnik za Severnu Ameriku, rev. 4/12/18 — brend koji nije u našem programu; kopija koju objavljuje Skills/Compétences Canada"
    url: https://www.skillscompetencescanada.com/wp-content/uploads/2018/05/SCNC18-36-AD3233G-Glasurit-Manual_EN.17May18.pdf
    verzija: "rev. 4/12/18"
    pristupljeno: 2026-10-08
    tip: strucni-izvor
  - id: rm-pk1p10-tds
    naziv: "R-M, Technical Information SILICONE Remov-R, PK 1P10 eSense solventborne cleaning agent"
    url: https://techinfo.rmpaint.com/unicorn/en/PK%201P10-eSense%20solventborne%20cleaning%20agent.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: carfit-silicone-remover-tds
    naziv: "C.A.R.FIT, Technical Data Sheet Silicone Remover"
    url: https://carfitrepair.com/wp-content/uploads/2023/05/car-fit-silicone-remover-technical-data-sheet.pdf
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: carfit-2k-epoxy-tds
    naziv: "C.A.R.FIT, Technical Data Sheet 2K Epoxy Primer 1:1"
    url: https://carfitrepair.com/wp-content/uploads/2023/05/car-fit-2k-epoxy-primer-11-technical-data-sheet.pdf
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: carsystem-silicone-remover-water-tds
    naziv: "Carsystem, Technical Data Sheet Silicone Remover Water 2.0, Silicone remover – water-based V02"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-silicone-remover-water-2.0-v02.pdf
    verzija: "V02, 09/2025"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 1311
razlogPrioriteta: Dopunjuje osnovni vodič teme konkretnim pitanjem; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: nije-provereno
  jezickaProvera: nije-provereno
strucnaPotvrda:
  potrebna: true
  razlog: "Postupak testa (krpa natopljena razređivačem na probrušenom mestu; bubrenje, lepljivost ili omekšavanje znače da se sloj uklanja) nije opisan u dokumentima proizvođača iz našeg programa. Oslanja se na Glasurit priručnik za Severnu Ameriku (brend van našeg programa; bilten iz 2009. pisan za fabrički KTL sloj, rečnik pojmova) i na upozorenja R-M i C.A.R.FIT o podlogama osetljivim na rastvarače. Koji razređivač se koristi za test u sistemima iz našeg programa nije potvrđeno. Odgovor na pitanje o izolaciji nema izvor iz našeg programa."
  status: potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Test se radi na mestu gde je stari lak probrušen kroz sve slojeve: krpa natopljena razređivačem prevuče se preko tog mesta i posmatra se da li neki sloj nabubri, postane lepljiv ili omekša. Ako se to desi, taj sloj je osetljiv na rastvarače i preko njega se ne nanosi nov sistem bez uklanjanja. Ako svi slojevi ostanu tvrdi, stari lak se dalje priprema kao zdrava podloga. Tumačenje rezultata zasnovano je na dokumentima brenda Glasurit, koji nije u našem programu, pa tekst čeka stručnu potvrdu.

## Zašto se radi test

Neke boje se suše samo isparavanjem rastvarača i posle toga se mogu ponovo rastvoriti u istom ili sličnom rastvaraču. Glasurit u rečniku pojmova takve slojeve naziva reverzibilnim i kao primer navodi nitro i termoplastične akrilne boje, za razliku od alkidnih i drugih sintetičkih boja koje se ne mogu vratiti u tečno stanje[^glasurit-prirucnik]. Na vozilu koje je ranije lakirano ne znate uvek šta je ispod.

Kada se preko takvog sloja nanese materijal sa jakim rastvaračima, stari sloj može da nabubri i podigne nov. Glasurit to opisuje kao podizanje (lifting) i kao primer navodi nanošenje nitro materijala preko sintetičke boje koja se suši na vazduhu[^glasurit-prirucnik]. Mogući uzroci i izgled te greške opisani su u vodiču [Podizanje i nabiranje boje preko stare podloge](/vodici/podizanje-i-nabiranje-boje).

Proizvođači iz našeg programa takve podloge izdvajaju u tehničkim listovima. R-M za SILICONE Remov-R navodi da se ne koristi na podlogama osetljivim na rastvarače[^rm-pk1p10-tds], a C.A.R.FIT za Silicone Remover kao primer takve podloge navodi termoplastične slojeve[^carfit-silicone-remover-tds].

## Kako se test radi

1. **Izbor mesta.** Mesto na delu koji se popravlja, po mogućnosti manje vidljivo.
2. **Probrušavanje.** Urednička preporuka: stari lak se na malom mestu probrusi kroz sve slojeve, tako da se na ivici vide svi slojevi, od laka do podloge. Tako se proverava svaki sloj, ne samo gornji.
3. **Čišćenje** mesta od prašine.
4. **Test.** Čista krpa se natopi razređivačem i prevuče preko probrušenog mesta. Glasurit u servisnom biltenu za fabrički KTL sloj koristi razređivač iz sopstvenog sistema[^glasurit-prirucnik]. Koji razređivač je odgovarajući za sistem u kome Vi radite, proverite kod proizvođača ili dobavljača tog sistema.
5. **Posmatranje.** Prati se da li neki sloj nabubri, postane lepljiv ili omekša, odnosno da li se boja skida na krpu.

## Šta znače rezultati

- **Svi slojevi ostaju tvrdi.** Stari lak se priprema kao zdrava podloga, prema vodiču [Priprema starog laka za novo lakiranje](/vodici/priprema-starog-laka).
- **Neki sloj nabubri, postane lepljiv ili omekša.** Glasurit za fabrički sloj navodi da se tada mora ukloniti[^glasurit-prirucnik]. Uklanjanje opisuje vodič [Skidanje stare boje](/vodici/skidanje-stare-boje).
- **Rezultat nije jasan.** Ponovite test na drugom mestu ili napravite probu sistema na manjoj površini pre lakiranja celog dela.

Test pokazuje osetljivost na rastvarač, a ne prianjanje. Stari lak koji ne omekšava i dalje može da se ljušti od podloge, pa se i to proverava pre izbora postupka.

## Ograničenja

Ovaj test ne zamenjuje tehnički list. Odmašćivači i materijali iz našeg programa navode podloge na kojima su provereni: C.A.R.FIT, na primer, za 2K Epoxy Primer 1:1 navodi stare završne slojeve u dobrom stanju[^carfit-2k-epoxy-tds]. I blaga sredstva mogu da reaguju sa nekim slojevima: Carsystem za vodeni odmašćivač upozorava da može da rastvori neke 1K prajmere i preporučuje probu na podlozi[^carsystem-silicone-remover-water-tds].

## Pitanja i odgovori

### Šta znači ako stari lak omekša?

Da je bar jedan sloj osetljiv na rastvarač i da može da nabubri kada se preko njega nanese novi materijal. Takav sloj se ne ostavlja ispod novog sistema, nego se uklanja do čvrste podloge.

### Kada je potrebna izolacija?

U tehničkim listovima iz našeg programa nismo pronašli izolacioni sloj namenjen za nanošenje preko starog laka osetljivog na rastvarače, pa ovde ne dajemo postupak izolacije. Glasurit izolaciju (sealer) opisuje kao sredstvo koje zatvara upojne i porozne površine[^glasurit-prirucnik], a za omekšali fabrički sloj navodi uklanjanje, ne izolaciju[^glasurit-prirucnik]. Ako sistem koji koristite ima proizvod za ovu namenu, postupite po njegovom tehničkom listu.

### Radi li se test i na novim delovima?

Može da pomogne kod fabričkog sloja na novom delu, ali tamo važe posebna pravila: vidi [Nov deo sa fabričkim KTL slojem](/vodici/novi-deo-sa-fabrickim-ktl-slojem) i [Nov branik sa fabričkim prajmerom](/vodici/nov-branik-sa-fabrickim-prajmerom).
