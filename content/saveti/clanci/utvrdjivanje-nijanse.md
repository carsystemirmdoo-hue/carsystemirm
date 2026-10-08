---
id: SV-0082
slug: utvrdjivanje-nijanse
naslov: "Utvrđivanje nijanse: od šifre boje do probnog lima"
metaNaslov: "Utvrđivanje nijanse za popravku automobila"
opis: "Kako se dolazi do prave nijanse za popravku: šifra boje, baza recepata, karte nijansi, varijante, uređaji za merenje i probni lim, uz alate R-M i baslac."
kategorija: boje-i-nijanse
podtema: utvrđivanje nijanse
tip: osnovni-vodic
publika:
  - hobista
  - profesionalac
glavnoPitanje: Kako se utvrđuje tačna nijansa boje za popravku automobila?
namera: postupak
dodatnaPitanja:
  - Zašto ista šifra ima više varijanti?
  - Čemu služe karte nijansi?
poreklopitanja:
  tip: pronadjeno-u-izvoru
  napomena: "Na domaćem forumu kupac pita kako da traži boju u prodavnici i šta da kaže, jer ne zna gde je šifra boje; pitanje o više varijanti iste šifre postavlja se na drugom domaćem forumu."
  izvori:
    - https://bhtuning.com/threads/touch-up-paint-kako-lakirati-male-rupice-komadici-tacke-ostecenja.102772/
    - https://www.samsvojmajstor.com/portal/forums/uradi-sam/popravka-automobila/farbanje-auta?page=3
brendovi:
  - rm
  - baslac
  - carsystem
proizvodi:
  - rm-onyx-hd
  - rm-agilis
  - grupa:baslac-line-45
  - grupa:baslac-line-35
  - carsystem-colour-match-lamp
povezani:
  - SV-0083
  - SV-0084
  - SV-0022
  - SV-0096
  - SV-0005
izvori:
  - id: baslac-color-chips
    naziv: "baslac, Color Chips (baslac Effective Color Finder i postupak provere nijanse)"
    url: https://www.baslac.com/en-emea/color-chips
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: rm-color-competence
    naziv: "R-M, Color Competence"
    url: https://www.rmpaint.com/en-int/color-competence
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: baslac-efinder-star
    naziv: "baslac, A perfect finish with baslac® e-finder star"
    url: https://www.baslac.com/en-emea/news/perfect-finish-baslacr-e-finder-star
    datumIzvora: 2023-04-17
    pristupljeno: 2026-10-08
    tip: vest-proizvodjaca
  - id: inform-basic-color
    naziv: "Info R-M, Basic Knowledge „Color“ (javni opis modula 2026-0002-RM)"
    url: https://info.rmpaint.com/processes/basic-knowledge-color
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: inform-metamerism
    naziv: "Info R-M, Help Centre: Metamerism"
    url: https://info.rmpaint.com/help/metamerism
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: baslac-45-variant-49
    naziv: "baslac, Technical Information 45 Line, 45 Line variant 49-"
    dokument: /documents/products/baslac/45_Line_variant_49.pdf
    verzija: "03/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: carsystem-colour-match-lamp-tds
    naziv: "Carsystem, Technical Data Sheet CS Colour Match Lamp V03"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds-colour-match-lamp-v03.pdf
    verzija: "V03, 07/2021"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 15
razlogPrioriteta: Osnovni vodič teme — ulaz u tematsku celinu, objavljuje se rano da bi kasniji tekstovi imali na šta da se oslone.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvorene stranice baslac Color Chips, e-finder star (17. 4. 2023), R-M Color Competence, Info R-M Basic Knowledge Color i Metamerism, TDS baslac 45 Line var. 49 (03/2026) i Carsystem Colour Match Lamp V03; svi navodi se poklapaju, bez izmena u sadržaju."
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Nijansa za popravku se ne utvrđuje samo iz šifre boje. Šifra vodi do standardne recepture u bazi proizvođača boje, a zatim se proverava da li ta receptura odgovara baš Vašem vozilu: poređenjem karte nijanse ili merenjem uređajem, izborom varijante kada standard ne odgovara i, na kraju, probnim limom. baslac taj redosled opisuje kao proveru karte na očišćenom i ispoliranom delu vozila, traženje varijante u bazi i izradu probnog lima za izabranu varijantu[^baslac-color-chips].

## Korak 1: šifra boje vozila

Šifra boje je fabrička oznaka nijanse koju je proizvođač vozila propisao. Nalazi se na pločici ili nalepnici na vozilu, a gde je tačno zavisi od marke i modela. O tome više u vodiču [Gde se nalazi šifra boje na automobilu](/vodici/sifra-boje-na-automobilu). Uz šifru je korisno znati marku, model i godinu proizvodnje, jer se po tim podacima pretražuje baza recepata.

Šifra je polazna tačka, a ne garancija. Ista šifra može da ima više varijanti, a starija boja na vozilu ne mora više da izgleda kao nova (o tome vodič [Nijansa na izbledelom vozilu](/vodici/nijansa-i-izbledeli-lak)). Zato su sledeći koraci provera, a ne formalnost.

## Korak 2: receptura iz baze proizvođača boje

R-M i baslac vode sopstvene baze recepata. R-M navodi alate Color Explorer, Colormaster i Refinity, kao i spektrofotometar Colortronic 12/6[^rm-color-competence]. baslac uz svoju bazu Formula Finder ima kartu nijansi baslac Effective Color Finder sa više od 3.000 kartica, po jednu za svaku boju u standardnoj recepturi, razvrstanih po oznaci proizvođača vozila[^baslac-color-chips]. Kako je digitalna platforma Refinity otvorena i za korisnike baslac sistema, opisuje vest [Refinity za baslac korisnike](/vodici/refinity-za-baslac-korisnike).

Za neke posebne nijanse baza daje i dodatni podatak. Kod retko korišćenih pigmenata baslac upućuje da se za šifru boje u bazi proveri da li je za prvi korak potrebna posebna boja podloge[^baslac-45-variant-49].

## Korak 3: poređenje sa vozilom

Karta nijanse je uzorak nanete boje, pa se može prisloniti uz vozilo. baslac navodi da se karta proverava na očišćenom i ispoliranom delu vozila, na dnevnom svetlu ili pod lampom dnevnog svetla[^baslac-color-chips]. Polira se zato što oksidisan ili prljav površinski sloj menja utisak nijanse.

Svetlo je važno i iz drugog razloga. R-M objašnjava metamerizam: dve boje mogu izgledati isto na dnevnom svetlu, a različito pod veštačkim, posebno pod natrijumskom uličnom rasvetom[^inform-metamerism]. Zato se nijansa ne procenjuje samo pod jednim izvorom svetla. U našem programu je i ručna lampa Carsystem Colour Match Lamp, za koju tehnički list navodi tri temperature boje svetla: 2.700 K, 4.500 K i 6.500 K[^carsystem-colour-match-lamp-tds].

Uređaji za merenje rade isti posao digitalno. Za baslac e-finder star proizvođač navodi da meri iz pet uglova, da bi tačnije očitao jednobojne, metalik i biserne boje, i da se povezuje sa bazom Formula Finder[^baslac-efinder-star]. Šta takvi uređaji mogu, a šta ne, objašnjava vodič [Digitalno merenje boje](/vodici/digitalno-merenje-boje).

## Korak 4: varijanta, ako standard ne odgovara

Ako se karta standardne recepture vidno razlikuje od vozila, sledi provera varijanti. Kod baslac sistema varijanta je uvek opisana kao odstupanje od standarda, na primer tamnija, plavlja, sa sitnijim ili krupnijim metalik česticama[^baslac-color-chips]. Kako se varijanta bira opisuje vodič [Varijante nijanse iste šifre boje](/vodici/varijante-nijanse-iste-sifre).

## Korak 5: probni lim

Poslednja provera je probni lim: izabrana receptura se zameša, nanese na probnu pločicu i uporedi sa vozilom pre lakiranja dela. baslac izradu probnog lima navodi kao deo postupka za varijantu[^baslac-color-chips], a R-M u edukativnom modulu o boji obrađuje ceo put od faktora koji utiču na nijansu do izrade probnih limova[^inform-basic-color]. Postupak je opisan u vodiču [Probni lim: zašto se radi pre lakiranja](/vodici/probni-lim-pre-lakiranja).

## Ograničenja

Ovaj tekst opisuje redosled koraka, ne sadržaj baza recepata. Pristup bazama i uređajima dobija se preko proizvođača ili prodavca boje, a neki edukativni moduli R-M traže prijavu. Ni najbolja receptura ne nadoknađuje grešku u nanošenju: isti materijal nanet drugačijim brojem slojeva ili drugim podešavanjem pištolja može izgledati drugačije. Ako ste u nedoumici, potražite tehničku podršku prodavca ili proizvođača boje.

## Pitanja i odgovori

### Zašto ista šifra ima više varijanti?

Šifra označava nijansu koju je propisao proizvođač vozila, ali boja na stvarnim vozilima ne mora biti potpuno ista. Zato baze recepata uz standard vode i varijante. baslac ih opisuje kao odstupanja od standardne recepture u određenom smeru[^baslac-color-chips].

### Čemu služe karte nijansi?

Karta nijanse omogućava da se receptura uporedi sa vozilom pre mešanja boje. U baslac kolekciji svaka kartica predstavlja standardnu recepturu jedne boje, pa karta pokazuje polaznu tačku. Konačnu proveru i dalje daje probni lim[^baslac-color-chips].

### Mogu li da tražim boju samo po šifri?

Možete dobiti standardnu recepturu, ali bez provere na vozilu ne znate da li je to prava varijanta. Ako Vam prodavac boje može izmeriti nijansu ili uporediti kartu sa vozilom, iskoristite to. Prodavnice iz naše partnerske mreže nalaze se na strani [Prodavnice](/prodavnice).
