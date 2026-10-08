---
id: SV-0015
slug: sistem-materijala-jednog-proizvodjaca
naslov: Zašto materijale birati kao sistem jednog proizvođača
metaNaslov: "Materijali za lakiranje kao sistem jednog proizvođača"
opis: "Zašto tehnički list za lak, punilac ili prajmer navodi tačno određen učvršćivač i razređivač i šta se rizikuje kada se kombinuju materijali različitih sistema."
kategorija: osnove
podtema: kompatibilnost sistema
tip: osnovni-vodic
publika:
  - hobista
  - profesionalac
glavnoPitanje: Zašto proizvođači preporučuju da kit, prajmer, baza i lak budu iz istog sistema?
namera: informativna
dodatnaPitanja:
  - Šta se rizikuje mešanjem sistema?
  - Može li se uz lak jednog proizvođača koristiti učvršćivač ili razređivač drugog?
  - Gde proizvođač navodi kompatibilne proizvode?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Urednički predlozi q137, q211 i q292 u questions.json; javno postavljeno pitanje sa ovom formulacijom nije pronađeno."
brendovi:
  - rm
  - baslac
  - carsystem
proizvodi:
  - baslac-40-100-high-speed-2k-clear-voc
  - c-2a40-airtop
  - 2210-onyx-activator
  - p-5480-ghd-universal-epoxy
  - carsystem-git-multi-green
povezani:
  - SV-0010
  - SV-0108
  - SV-0113
  - SV-0203
  - SV-0215
izvori:
  - id: baslac-40-100-tds
    naziv: "baslac, Technical Information 40-100 High Speed 2K Clear VOC"
    url: https://techinfo.baslac.com/en/40-100.pdf
    dokument: /documents/products/baslac/40-100.pdf
    verzija: "06/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-c2a40-tds
    naziv: "R-M, Technical Information C 2A40 AirTOP, Clear coat, air drying"
    dokument: /documents/products/rm/c-2a40-airtop/rm-c-2a40-airtop-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-p5480-tds
    naziv: "R-M, Technical Information P 5480 GHD Universal Epoxy"
    dokument: /documents/products/rm/p-5480-ghd-universal-epoxy/rm-p-5480-ghd-universal-epoxy-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: rm-p2p63-tds
    naziv: "R-M, Technical Information MULTI Purpos-R Grey, P 2P63 eSense DTM, grey"
    dokument: /documents/products/rm/p-2p63-multi-purpos-r-grey/rm-p-2p63-multi-purpos-r-grey-technical-data-sheet.pdf
    verzija: "07/2026"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: carsystem-multi-green-tds
    naziv: "Carsystem, Technical Data Sheet Multi Green, Polyester multifunctional putty V08"
    dokument: /documents/products/carsystem/carsystem-git-multi-green-tds.pdf
    verzija: "V08, 11/2024"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
prioritet: 510
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
Proizvođač ispituje i opisuje materijale kao celinu: tehnički list za lak ili punilac imenuje tačno određene učvršćivače i razređivače, a često i podloge i slojeve sa kojima je proizvod proveren. Kada se uzme komponenta iz drugog sistema, vrednosti iz tehničkog lista (odnos mešanja, vreme upotrebljivosti, sušenje) više ne važe, jer niko nije proverio tu kombinaciju. Zato je sistem jednog proizvođača najsigurniji put da se dobije rezultat koji tehnički list opisuje.

## Šta „sistem“ znači u tehničkom listu

Sistem se vidi već u odeljku za mešanje. Za bezbojni lak baslac 40-100 tehnički list navodi odnos mešanja 2:1 po zapremini i tri učvršćivača iz iste linije: brzi, normalni i spori, uz napomenu da se spori koristi samo po vrlo toplom vremenu[^baslac-40-100-tds]. Za R-M punilac P 2P63 navedeni su jedan učvršćivač i nekoliko razređivača iz iste eSense linije[^rm-p2p63-tds].

Tehnički list ne kaže „bilo koji učvršćivač“. Imenuje šifre. Sve vrednosti koje slede u dokumentu (viskozitet, vreme upotrebljivosti, sušenje) izmerene su sa tim komponentama.

## Sistem nije samo lak i učvršćivač

Veze između slojeva mogu biti i složenije:

- **Bazna boja i lak.** Za R-M C 2A40 tehnički list traži da se u vodenu baznu boju ispod tog laka doda 5 % aktivatora A 2210, uključujući sive nijanse baze i sve slojeve troslojne boje[^rm-c2a40-tds]. Isti dokument navodi i da se mešavine koje sadrže MIXINGBASE W ne mogu koristiti sa tim aktivatorom[^rm-c2a40-tds]. Lak, dakle, postavlja uslov sloju ispod sebe.
- **Prajmer i završni sloj.** Za R-M P 5480 GHD Universal Epoxy tehnički list imenuje linije kojima se prajmer može prelakirati i navodi da je pre nanošenja ONYX HD ili DIAMONT obavezno odzračivanje od 1 h na 20 °C[^rm-p5480-tds].
- **Podešavanje viskoziteta.** Isti tehnički list za P 5480 upozorava da se proizvod ne podešava razređivačem GV, nego samo predviđenim aditivom A 5480[^rm-p5480-tds]. Razređivač koji je u istoj liniji za druge proizvode, za ovaj nije predviđen.

Ovi primeri pokazuju da ni „isti proizvođač“ nije dovoljan uslov. Odlučuje ono što piše u tehničkom listu konkretnog proizvoda.

## Ima i proizvoda koji su otvoreni prema drugim slojevima

Ne traže svi proizvodi isti stepen vezanosti. Za kit Carsystem Multi Green tehnički list navodi da se može prekriti svim uobičajenim materijalima na poliesterskoj ili akrilnoj osnovi[^carsystem-multi-green-tds]. Istovremeno, za isti kit traži tačno doziranje učvršćivača od 2–3 % i upozorava da i previše i premalo učvršćivača može da izazove slabije prianjanje i promenu boje završnog sloja[^carsystem-multi-green-tds].

Pravilo je, dakle: koliko je proizvod otvoren prema drugim materijalima, piše u njegovom tehničkom listu. Ako tamo ne piše, kombinacija nije proverena.

## Šta se rizikuje kombinovanjem sistema

Ovo je opšte objašnjenje, a ne spisak sigurnih posledica. Šta će se tačno desiti zavisi od materijala, podloge i uslova rada.

- **Nepoznata reakcija.** Učvršćivač drugog sistema može imati drugačiji sastav i odnos sa vezivom. Sloj tada može sporije ili nepotpuno da otvrdne.
- **Pogrešan odnos mešanja.** Odnos mešanja važi za tačno navedene komponente. Sa drugim učvršćivačem ne zna se koji je odnos ispravan. Više o tome u vodiču [Odnos mešanja: kako se čita i meri](/vodici/odnos-mesanja-iz-tehnickog-lista).
- **Problemi koji se pojave kasnije.** Slabije prianjanje, gubitak sjaja ili podizanje sloja ne moraju se videti odmah posle lakiranja.
- **Nema na šta da se pozovete.** Kada nešto krene loše, tehnički list i tehnička podrška proizvođača mogu da pomognu samo za kombinaciju koju su opisali.

Isto važi i za sprejeve: boja i lak iz različitih linija mogu da reaguju jedan sa drugim, što je posebna tema u tekstu [Kompatibilnost boje i laka u spreju](/vodici/kompatibilnost-spreja-boje-i-laka).

## Gde se nalaze kompatibilni proizvodi

1. **Odeljak za mešanje u tehničkom listu.** Tu su učvršćivači, razređivači i aditivi sa šiframa.
2. **Napomene i opis podloga.** Tu proizvođač navodi na šta se proizvod nanosi i čime se prekriva, kao kod P 5480[^rm-p5480-tds].
3. **Tehnički list sloja iznad.** Kao kod C 2A40, uslov ponekad postavlja tek sledeći sloj[^rm-c2a40-tds].

Tehničke listove za proizvode iz našeg programa naći ćete na stranicama proizvoda u [katalogu](/katalog). Kako se dokument čita, objašnjava vodič [Kako se čita tehnički list proizvoda](/vodici/kako-procitati-tehnicki-list).

## Ograničenja

Tekst ne tvrdi da je svaka kombinacija različitih proizvođača neispravna. Tvrdi samo da je proverena ona kombinacija koju proizvođač opisuje. Ako morate da odstupite od nje, pitajte tehničku podršku proizvođača ili prodavca i uradite probu na probnom limu pre rada na vozilu.

## Pitanja i odgovori

### Mogu li uz lak jednog proizvođača da koristim učvršćivač drugog?

Tehnički listovi koje smo pregledali navode samo učvršćivače iz iste linije[^baslac-40-100-tds]. Za drugi učvršćivač nema podataka o odnosu mešanja, vremenu upotrebljivosti ni sušenju, pa rezultat ne može da se predvidi.

### Da li je univerzalni razređivač bezbedan izbor?

Ne može se uopšteno reći. Neki proizvodi traže poseban razređivač ili aditiv, a neki izričito zabranjuju razređivač koji se inače koristi u istoj liniji, kao P 5480[^rm-p5480-tds]. O razlici između nitro razređivača i razređivača za 2K materijale piše tekst [Nitro razređivač i 2K materijali](/vodici/nitro-razredjivac-i-2k-materijali).

### Da li sistem mora biti od istog proizvođača od kita do laka?

Ne nužno. Neki kitovi, kao Multi Green, navode da se mogu prekriti uobičajenim poliesterskim ili akrilnim materijalima[^carsystem-multi-green-tds]. Kod laka, učvršćivača, razređivača i baze, međutim, tehnički listovi po pravilu imenuju tačne komponente, i tu se ne odstupa.
