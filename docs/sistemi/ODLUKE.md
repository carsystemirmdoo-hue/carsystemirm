# Sistemi i programi — odluke i otvoreno (2026-10-30)

Sedam stranica menija „Sistemi i programi“ prenete su iz prototipa (paket `sistemi-i-programi-pregled-2026-10-30`) u sajt:

| Stranica | Ruta |
|---|---|
| Boje i lakovi | `/program/boje-i-lakovi` |
| Priprema i abrazivi | `/program/priprema-i-abrazivi` |
| Pištolji i oprema | `/program/pistolji-i-oprema` |
| Poliranje | `/program/poliranje` |
| Potrošni materijal | `/program/potrosni-materijal` |
| Katalog i tehnički listovi | `/dokumentacija` |
| B2B saradnja | `/b2b-saradnja` |

68 pitanja iz paketa grupisano je u odluke ispod. Pitanja koja su tražila istu potvrdu spojena su u jednu stavku; uz svaku je navedeno gde se sadržaj koristi. Pojedinačna izostavljena mesta (83 u prvoj i još 33 u drugoj proveri konteksta, 2026-10-31) su u `IZOSTAVLJENO.md`, izvori vrednosti u `IZVORI.md`.

Načelo: tvrdnja u starom tekstu sajta, vodiču ili kodu nije dokaz njene tehničke ili poslovne tačnosti. Urednička provera uz pomoć AI-ja nije stručna potvrda. Što nije potvrđeno, nije objavljeno; oznake „za potvrdu“ ne postoje na javnim stranicama.

## A. Razrešeno ovim radom

| # | Pitanje iz paketa | Rešenje i dokaz | Gde |
|---|---|---|---|
| A1 | Norbin N15-020 (vodiči) ili N15-V20 (katalog) | Oba su u katalogu kao različiti proizvodi: porodica `norbin-n15-020` (N15-020 Clear, 1 L i 5 L) i `norbin-n15-v20-clear-voc`. Namena N15-020 iz tehničkog lista 01/2022, str. 1. Koraci ne navode nijednu od ovih šifri. | Boje i lakovi, pregled sistema |
| A2 | R-M C 2A40 / C 2P42 / C 2P45 „nisu u katalogu“ | Netačno: `c-2a40-airtop` i `c-2p42-race-finish-r` su u katalogu (svaki zapis kataloga je javan). Citiranje lista u koracima je edukativno i ne tvrdi ništa o zalihama. | Pištolji, Boje, Potrošni |
| A3 | X serija: dostupnost u Srbiji | Svih pet proizvoda je u katalogu. Prikazuju se kao proizvodi iz kataloga, bez ikakve tvrdnje o dostupnosti ili zalihama. | Poliranje |
| A4 | Proizvod `sata-filter-500-series` iz prototipa | Ne postoji u katalogu; uklonjen. | Pištolji |
| A5 | Stari Befar logotip | Sajt koristi verziju sa Production-a; asset na platnu prototipa je zadržan po odluci vlasnika. | — |
| A6 | Vodiči u doradi i veze ka vodičima | Raspored objave vodiča je isključen (`content/saveti/raspored.json`, `aktivan: false`), pa javno nema nijednog vodiča. Stranice prikazuju vezu samo ka objavljenom vodiču (`getPublicSavetBySlug`). Vodiči sa statusom „ispravke-potrebne“ nisu povezani ni kada budu objavljeni. | sve stručne stranice |
| A7 | Verzije R-M tehničkih listova | Vodiči navode 07/2026; dokumenti preuzeti 2026-10-30 su 10/2026 (AGILIS, ONYX HD, DIAMONT, PK 1P10, PK 2P10, PK 2P20). Strane su nađene u verziji 10/2026 i ona je navedena. | Boje, Potrošni |
| A8 | Naziv „Potrošni materijal“ | Ostaje u navigaciji; „Maskiranje, čišćenje i zaštita“ je podnaslov stranice. | Potrošni |
| A9 | Slike sa otvorenim pravom prikaza | Stranice sistema ne prikazuju sliku čije je pravo na čekanju u `IMAGE_RIGHTS_REVIEW.csv` (RUPES 25, SATA 140, Cosmos Lac 11); umesto nje je neutralno polje. Spisak: `content/sistemi/slike-bez-potvrde-prava.json`, usklađenost proverava `npm run test:sistemi`. | sve stručne stranice |
| A10 | Opis /katalozi sa rečju „zastupamo“ | U trenutnom kodu te reči više nema. | /katalozi |
| A11 | Biblioteka: uzorak od 44 dokumenta | Biblioteka koristi sve dostupne dokumente proizvoda i brendova (879) iz istog izvora kao stranice proizvoda; brojači, filteri i rezultati računaju nad istim spiskom. | /dokumentacija |

## B. Čeka stručnu potvrdu (izostavljeno sa sajta)

| # | Odluka | Šta je izostavljeno | Gde |
|---|---|---|---|
| B1 | Opšta priprema za posao: oprema i zaštita | 19 redova „Pre početka“ (npr. zaštita disajnih puteva, rukavice, odsis) | sve stručne stranice |
| B2 | Koraci bez proverljivog izvora | 9 koraka, 3 varijante za podlogu, 1 česta greška; zbog njih su uklonjena 3 izbora: Priprema — „Pocinkovani lim“ (uklanjanje premaza) i „Lakiran plastični deo“ (postojeći premaz); Potrošni — „Tečna zaštita“ (zaštita vozila) | Priprema, Poliranje, Pištolji, Potrošni, Boje |
| B3 | Lična zaštita pri radu (bezbednosna uputstva) | Ceo posao; 5 vodiča teme čeka ispravke (izocijanati, maska za 2K, rukavice, ventilacija, samozapaljenje krpa) | Potrošni |
| B4 | 14 vodiča sa statusom „ispravke-potrebne“ | Veze se ne prikazuju | sve |
| B5 | Poliranje farova | Nije posao na stranici dok se vodič ne ispravi | Poliranje |

## C. Čeka dokument sa proverljivom stranom

| # | Odluka | Šta je izostavljeno | Gde |
|---|---|---|---|
| C1 | SATA uputstva (jet X, X 5500): potrošnja vazduha, rastojanje, moment pritezanja dizne, pH sredstva za čišćenje | 16 rečenica i 13 stavki skala čije vrednosti nisu nađene na jednoj strani dokumenta (Pištolji: 13 + 8). Potrebna su uputstva kao PDF sa tekstom ili potvrda vrednosti. | Pištolji, Boje, Poliranje, Priprema, Potrošni |
| C2 | Napomene uz izbor podloge koje upućuju na brojeve koraka | 18 napomena; tekst treba prepisati bez brojeva koraka | sve stručne stranice |
| C3 | Namena sistema bez rečenice u listu | R-M UNO HD (nema dokumenta na sajtu), baslac Basecoat 35 (list nema rečenicu o primeni), Norbin N15-V20 (list nije pročitan) prikazani su bez opisa namene, sa vezom na proizvod ili list | Boje, pregled sistema |

## D. Poslovne odluke vlasnika

| # | Odluka | Stanje na sajtu | Gde |
|---|---|---|---|
| D1 | Nalog u portalu posle dogovora o saradnji | Ne tvrdi se | B2B |
| D2 | Prikaz prodajnog mesta u pretrazi prodavnica kao deo saradnje | Ne tvrdi se | B2B |
| D3 | Tok posle predloga: otvaranje kupca, rad sa komercijalistom, rokovi | Prikazano je samo „pošaljite predlog; uslove dogovarate sa timom“ | B2B |
| D4 | Funkcije portala koje se najavljuju (cene, raspoloživost, „Zapamti me 30 dana“, zahtev za porudžbinu, porudžbine i upiti, fakture) | Ne najavljuje se nijedna; samo „Kupac sa nalogom se prijavljuje u portal. Cene se ne prikazuju na javnom sajtu.“ | B2B |
| D5 | Slanje upita | Sajt nema serverski prijem upita: forme pripremaju poruku u programu za e-poštu posetioca (isto kao /kontakt) i nikad ne prikazuju „poslato“. Pravo slanje traži odluku (servis za e-poštu ili tabela upita u bazi). | sve forme |
| D6 | Dugme „B2B“ na početnoj | Početna je zaključana, pa dugme i dalje vodi na `/kontakt?tema=b2b` (radi). Podnožje i meni vode na `/b2b-saradnja`. | Početna |
| D7 | Cosmos Lac u pregledu sistema boja | Proizvodi Cosmos Lac iz programa (aerosoli, lakovi za drvo) nisu u pregledu automobilskih sistema; jesu u katalogu programa | Boje |
| D8 | Mešanje boje po tonu u prodavnicama | Ne tvrdi se | Boje |
| D9 | Predlozi fotografija i ilustracija (16) | Ne prikazuju se | sve stručne stranice |

## E. Prava slika

| # | Odluka | Stanje |
|---|---|---|
| E1 | RUPES packshotovi (`RUPES_IMAGE_RIGHTS_REVIEW`) | Na stranicama sistema neutralno polje; na stranicama proizvoda ostaje kao do sada |
| E2 | SATA slike (`RIGHTS_NOT_CONFIRMED`) | Neutralno polje |
| E3 | CSY-0507 ProFlex Mercury i CSY-0606 Sanding Disc F.19 Finish 77 mm: u odluci 29.10. „odluka sadržaja bez kandidata“ | Prikazuju se kao na stranici proizvoda (objavljene slike); čeka potvrdu vlasnika |
| E4 | 16 slika bez ID-a u kontroli slika (logotipi, naslovne strane, `rm-onyx-hd.webp`) | Stranice sistema ih ne koriste osim slika proizvoda iz kataloga |

## F. Druga provera vrednosti (2026-10-31)

Uzorak je pokazao da podudaranje broja na strani nije dovoljno (vrednost je bila vezana za stranu drugog proizvoda). Zato je svaka zadržana vrednost ponovo proverena u dokumentu proizvoda koji rečenica imenuje, sa ručnim pregledom konteksta; 33 stavke su dodatno izostavljene ili prepravljene (npr. pritisci za 35 Line koji stoje samo u posebnom uputstvu za utapanje, „9 mm“ crevo bez imenovanog proizvoda, odnos AGILIS 2:1 koji nije u listu, DIAMONT 100 : 50–60 umesto 100:60). Spisak: `IZOSTAVLJENO.md`, odeljak „Druga provera“.

## G. Razrešeno 2026-10-31 (druga runda)

| Stavka | Rešenje |
|---|---|
| C1 SATA vrednosti | Uputstva SATA jet X (3266-240619-2) i SATAjet X 5500 (izdanje 10.06.2020) preuzeta sa stranica proizvoda; ranije nisu bila preuzeta jer im adresa nema nastavak „.pdf“. Vraćeno uz vizuelnu proveru na strani: potrošnja vazduha, rastojanje, opseg pritiska i granica HVLP/compliant (jet X str. 102; X 5500 str. 110), crevo 9 mm, antistatičko, otporno na rastvarače i na 10 bara i pritezanje dizne 11 Nm (X 5500 str. 115), pH 6–8 i zabrana potapanja (jet X str. 94). I dalje izostavljeno: DIN EN 1953, zamena creva jednom godišnje, fabrička postavka lepeze, vrednosti čašica RPS/CPS. |
| C2 napomene uz izbor | 15 napomena prepisano tako da imenuju korak kako se prikazuje za taj izbor; 3 napomene pripadale su izostavljenim izborima. Test proverava da imenovani korak postoji. |
| C3 namena sistema | UNO HD (T 2A55, 10/2026, str. 1), Basecoat 35 (35 Line, str. 1, provereno na slici strane), N15-V20 (01/2022, str. 1). |
| D6 dugme na početnoj | Vodi na `/b2b-saradnja`; izgled nepromenjen (odobrenje vlasnika 2026-10-31). |
| Yachtcare na B2B | Blok „Brendovi u ponudi“ koristi isti spisak kao meni (bez Yachtcare); katalog i podnožje nepromenjeni. |
| Biblioteka: SATA dokumenti | Svih 66 SATA adresa fajlova u podacima kataloga vraća 404 (SATA menja adrese). U biblioteci 47 SATA dokumenata vodi na stranicu proizvoda kod SATA (66/66 stranica 200). Stranice proizvoda na sajtu i dalje imaju stare adrese — poseban posao (osvežavanje SATA podataka). |
| Brojači u biblioteci | Svi u jednom redu na računaru; 3 × 2 do 900 px; 2 × 3 do 560 px; poslednja usamljena kartica zauzima ceo red. |
| Vrednosti bez jedinice | Proširena provera obuhvata i brojeve bez jedinice; izostavljeno „više od 3.000 kartica“ i baslac 65-10 „grupa 40-, 2–3 sloja“; dodat izvor za mat 5–10 / 25–30 i 100 BF diznu (bez nepotvrđenog spiska punilaca). |
| Poređenje početne 31.10. | Dokumentovano poređenje (`~/Carsystem/zakljucane-stranice/pocetna/poredjenje-2026-10-31`), nije odobrena referenca dok ga vlasnik ne pregleda. |
