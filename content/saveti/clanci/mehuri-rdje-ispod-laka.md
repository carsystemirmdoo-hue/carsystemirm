---
id: SV-0044
slug: mehuri-rdje-ispod-laka
naslov: "Mehuri rđe ispod laka: može li se samo prelakirati"
metaNaslov: "Mehuri rđe ispod laka: zašto prelakiranje ne pomaže"
opis: "Zašto se mehuri rđe ispod laka ne rešavaju prelakiranjem, kako se proverava koliko je korozija zahvatila i kojim redom ide popravka do zdravog metala."
kategorija: korozija
podtema: podlakovna korozija
tip: resavanje-problema
publika:
  - pocetnik
  - hobista
glavnoPitanje: Šta uraditi kada se ispod laka pojave mehurići rđe i da li je dovoljno prelakirati ih?
namera: rešavanje problema
dodatnaPitanja:
  - Zašto se mehuri vraćaju posle loše popravke?
  - Kako se razlikuju mehuri rđe od plikova u laku?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Urednički predlog q161 u questions.json („Zašto se ispod laka pojavljuju mehuri rđe i da li se mogu samo prefarbati?“); opšte pitanje o zaštiti od korozije postoji na forumu (q074)."
brendovi:
  - carsystem
  - rm
  - cosmos-lac
proizvodi:
  - rm-pm-2a32-1k-protect-light-grey
  - carsystem-1k-epoxy-primer
  - grupa:cosmos-lac-primers-metal-primer
povezani:
  - SV-0041
  - SV-0042
  - SV-0162
  - SV-0029
  - SV-0047
izvori:
  - id: cs-1k-epoxy-tds
    naziv: "Carsystem, Technical Data Sheet 1K Epoxy Primer"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-1k-epoxy-primer.pdf
    verzija: "v.01, 28-11-2014 (izdanje 03/2021)"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-pm2a32-tds
    naziv: "R-M, Technical Information 1K PROTECT Light Grey, PM 2A32 Primer, light grey"
    url: https://techinfo.rmpaint.com/unicorn/en/PM%202A32-Primer%20light%20grey.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cosmos-metal-primer-tds
    naziv: "Cosmos Lac, TDS Metal Primer"
    url: https://cosmoslac.com/pdfs/products/en/metal-primer.pdf
    verzija: "Version 02, 17/06/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: vetere-tannins
    naziv: "V. F. Vetere, R. Romagnoli, Chemical and electrochemical assessment of tannins and aqueous primers containing tannins (CIC Buenos Aires, repozitorijum)"
    url: https://digital.cic.gba.gob.ar/bitstreams/f8a335fc-4757-44cd-8f6c-8dec49e76ffb/download
    pristupljeno: 2026-10-08
    tip: strucni-izvor
prioritet: 312
razlogPrioriteta: Rešava konkretan problem iz prakse; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvoreni Carsystem 1K Epoxy Primer TDS v.01 (03/2021), R-M PM 2A32 (07/2026), Cosmos Lac Metal Primer (Version 02, 17/06/2026) i rad Vetere i Romagnoli; podloge, 3–4 sloja i 30–40 µm za PM 2A32 i uslovi bez rđe se poklapaju. Ispravljeno (3): „prajmeri iz našeg programa“ suženo na navedene listove; nalaz iz rada pripisan kao opšta stručna pozadina iz laboratorije, a ne kao dokaz uzroka vraćanja mehura; znak sa ispupčenjima preformulisan kao mogući znak."
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Ne, prelakiranje mehura rđe ne zaustavlja koroziju. Mehur znači da je korozija već ispod laka, a nov sloj boje preko nje samo prekriva mesto na kome se proces nastavlja. Popravka počinje otvaranjem cele zahvaćene površine do zdravog metala, zatim ide zaštita golog metala prajmerom i tek onda gradnja slojeva do laka. Ako je lim ispod mehura stanjen ili probijen, potrebna je limarska popravka.

## Zašto prelakiranje ne pomaže

Opšte objašnjenje: rđa ispod laka nastaje kada vlaga dođe do metala kroz oštećenje, ivicu ili spoj limova. Proizvodi korozije podižu lak, pa se pojave mehurići. Kada se preko toga nanese nova boja, rđa i vlaga ostaju zarobljene ispod, a novi sloj nema dobru podlogu. Prajmeri koje ovde navodimo zato traže metal bez rđe: Carsystem za 1K Epoxy Primer traži da se rđa potpuno ukloni[^cs-1k-epoxy-tds], a Cosmos Lac za Metal Primer traži uklanjanje prašine, rđe i ulja[^cosmos-metal-primer-tds].

U stručnom radu o tretmanima zarđalih površina (laboratorijsko istraživanje, van našeg programa) autori navode da dobra boja na zarđaloj površini rano otkazuje[^vetere-tannins]. To je opšti razlog zbog kog „brza“ popravka preko rđe ne traje, a mehuri se mogu vratiti.

## Kako proveriti koliko je korozija zahvatila

1. **Pogledajte okolinu mehura pod kosim svetlom.** Sitna ispupčenja oko vidljivog mehura mogu da znače da je korozija šira.
2. **Otvorite jedan mehur.** Ispod se vidi da li je rđa površinska ili je lim izjeden.
3. **Brusite postepeno ka zdravom laku.** Prestaje se tek kada lak oko mesta dobro prianja i kada je metal svetao, bez tamnih tačaka.
4. **Proverite odakle vlaga dolazi.** Mehuri na ivici vrata, pragu ili blatobranu mogu poticati iznutra, iz šupljine ili spoja limova. Tada spoljna popravka nije dovoljna bez zaštite unutrašnjosti; vidi [Zaštita šupljina karoserije](/vodici/zastita-supljina-karoserije).

Ovo su koraci za procenu, a ne sigurna dijagnoza. Konačan obim popravke se vidi tek kada je stari lak skinut.

## Redosled popravke

1. **Uklanjanje rđe do zdravog metala**, prema vodiču [Uklanjanje rđe sa karoserije pre lakiranja](/vodici/uklanjanje-rdje-sa-karoserije).
2. **Odmašćivanje i priprema golog metala**, prema vodiču [Priprema golog čeličnog lima](/vodici/priprema-golog-lima).
3. **Prajmer za goli metal.** Za manja probrušena mesta R-M ima 1K PROTECT PM 2A32 u spreju; tehnički list navodi čelični i pocinkovani lim i aluminijum među podlogama, 3–4 sloja i debljinu sloja od 30–40 µm[^rm-pm2a32-tds]. Za drugi prajmer važe vrednosti iz njegovog lista.
4. **Kit ili punilac, ako treba**, pa bazna boja i bezbojni lak prema sistemu.

Za mesto na koje je rđa došla iznutra, popravka se završava zaštitom šupljine ili spoja, jer bi inače vlaga ponovo stigla do metala.

## Pitanja i odgovori

### Zašto se mehuri vraćaju posle loše popravke?

Mogući uzroci su rđa koja je ostala u udubljenjima ili ispod susednog laka, goli metal koji je predugo stajao pre prajmera, prajmer koji nije namenjen golom metalu i vlaga koja dolazi iznutra. Koji je uzrok u konkretnom slučaju, vidi se tek kada se mesto ponovo otvori.

### Kako se razlikuju mehuri rđe od plikova u laku?

Mehur rđe obično ima rđu ili smeđi trag ispod, a lim je na tom mestu napadnut. Plikovi koji se pojave nedeljama posle lakiranja mogu imati i druge uzroke, na primer vlagu ili nečistoću između slojeva, bez rđe na metalu. O njima piše tekst [Plikovi koji se pojave nedeljama posle lakiranja](/vodici/mehuri-nedeljama-posle-lakiranja).

### Može li se mehur samo izbrusiti i zaštititi sprejom?

Može samo ako se brušenjem stvarno dođe do zdravog metala na celoj zahvaćenoj površini i ako se metal zatim zaštiti prajmerom namenjenim golom metalu. Sprej sam po sebi ne rešava rđu koja je ostala ispod.
