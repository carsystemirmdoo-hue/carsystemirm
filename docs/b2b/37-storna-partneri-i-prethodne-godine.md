# 37 — Storna, potvrda partnera i provera prethodnih godina

**Status (2026-10-02): parser prepoznaje storna i vezu sa originalom; potvrda
partnera prema šifarniku napisana i testirana; ništa nije uvezeno.** Detaljni
rezultati nad stvarnim fakturama su samo u privatnom izveštaju
(`~/.carsystem-private/`). Nastavak na [36](36-provera-stvarnih-faktura-i-pilot-okruzenje.md).

## 1. Izbor dokumenata: naziv „Fak" + sadržaj

Firma: prodajne fakture u nazivu fajla imaju „Fak" i broj; ostali fajlovi su
drugi poslovni dokumenti. Naziv je **pomoć pri izboru**, ne dokaz — pisanje
varira (veliko/malo slovo, dodatna slova), a vrstu potvrđuje sadržaj:

| Dokaz iz sadržaja | Vrsta |
|---|---|
| naslov „Račun-otpremnica", sve stavke pozitivne, zbir se slaže | prodajna faktura |
| isti naslov, negativne stavke, napomena „…stornira dokument broj X od D…" | storno |
| negativne stavke bez napomene o originalu | ručni pregled |
| sve ostalo (izveštaji, nivelacije, kalkulacije, kartice, reklamacije, otpremnice) | van ovog uvoza |

Provera (`scripts/local/biznisoft-readonly-check.mts`) ispisuje i tabelu
„naziv fajla prema sadržaju"; svako neslaganje je nalaz za čoveka.

## 2. Storna

**Šta je izmereno nad stvarnim stornima** (sva su bila istog oblika):
naslov kao kod fakture, sve količine i iznosi negativni, napomena sa brojem i
datumom originala; original postoji, isti partner, iste stavke po istoj ceni
i rabatu, svaka količina tačno poništena, zbir storna + originala = 0.

**Šta parser sada radi**

- `header.reversesDocumentNumber` / `reversesDocumentDate` — samo iz izričite
  napomene; veza se ne izvodi iz iznosa ni datuma.
- `documentKind = "storno"` samo uz oba dokaza (negativne stavke + napomena).
- Negativni iznosi se zaokružuju **od nule**, simetrično originalu.
- Status ostaje `unsupported_requires_sample`: storno se prepoznaje i proverava,
  ali **ne ulazi u promet**.
- `lib/pdf/storno.mjs` — `compareStornoToOriginal`: `full` / `partial` /
  `mismatch`. Ne pretpostavlja se da storno poništava ceo original.

**Uticaj dok storno nije podržan:** original je ispravna faktura i ušao bi u
neto promet, količine i ulaz preporuka (kupovina koje nije bilo). Zato provera
ispisuje upozorenje — **promet, količine i preporuke bez storna nisu
konačni** — i u privatnom izveštaju vodi spisak storniranih originala.

**Predlog za prvi talas (čeka potvrdu):** par original + potpun storno iz istog
talasa ne uvozi se nijedan, nego ide na spisak za pregled; neto efekat potpunog
storna je nula, pa promet ostaje tačan. Delimično storno i storno bez originala
u talasu — ručni pregled.

**Šta je potrebno za punu podršku** (posle odgovora kancelarije): veza
`invoices` → original (kolona i migracija), pravilo u pogledu prometa
(`enters_net`, danas samo `faktura`), isključenje poništenih kupovina iz ulaza
preporuka, i testovi za delimično storno.

**Pitanja za kancelariju**

1. Može li storno biti delimičan (samo neke stavke ili deo količine)?
2. Izdaje li se posle storna nova, ispravljena faktura, i kako se vidi veza?
3. Kada je storno u drugom mesecu ili godini od originala: promet se umanjuje
   u mesecu storna ili originala?
4. Postoje li povrati robe i knjižna odobrenja kao zasebni dokumenti (ne
   storno), i pod kojim nazivom fajla?

## 3. Potvrda partnera prema šifarniku

Faktura štampa šifru partnera sa vodećim nulama („00028"), izvoz šifarnika
bez njih („28"). `lib/commercial/partnerRegisterMatch.mjs`:

- obe **izvorne** vrednosti se čuvaju neizmenjene;
- normalizovan ključ (cifre bez vodećih nula) koristi se **samo** kada je u
  šifarniku jedinstven — kolizija („028" i „28") ide čoveku, i tada ni tačno
  poklapanje teksta ne važi;
- PIB je **potvrda**, ne ključ: šifra mora postojati, i PIB sa fakture mora biti
  jednak PIB-u te šifre; poznat PIB pod nepoznatom šifrom se ne spaja;
- spajanje po nazivu ne postoji;
- šifarnik sadrži i dobavljače: potvrđen partner **nije time kupac**.

Nad stvarnim fakturama i pripremljenim spiskom partnera: nula kolizija,
svaka faktura i svako storno potvrđeni preko šifre i PIB-a. Opšte pravilo
`isSamePartnerCode` (samo tačan tekst) ostaje netaknuto; novi put se uključuje
u uvoz tek sa sirovim šifarnikom svih partnera.

**Traži se:** sirov izvoz šifarnika svih partnera — šifra (kao tekst),
naziv, PIB, matični broj, **tip partnera** (kupac/dobavljač, ako postoji),
aktivan, datum izvoza.

## 4. Prethodne godine i nezavisan završni test

Drugi raspored tabele (bez kolone barkoda) javlja se tek u najnovijim
fakturama, pa starije godine mogu imati i drugačije rasporede.

**Šta dostaviti**

- prodajne fakture („Fak…") za **2025. i 2024.** u celini (najmanje 24 meseca
  istorije); **2023.** ako postoji, makar nekoliko meseci, zbog starijih
  šablona;
- sva storna iz tih godina (ostaju u istim folderima);
- uz svaku godinu: broj izdatih faktura po mesecu iz BizniSoft-a — kontrola
  potpunosti;
- ostali dokumenti nisu potrebni.

**Podela — završni test se odvaja PRE nego što ga bilo ko pogleda**

1. Kancelarija za svaku godinu nasumično izabere **dva cela meseca** (npr.
   izvlačenjem) i te fakture stavi u poseban folder, npr.
   `~/Desktop/Carsystem-fakture-zavrsni-test/<godina>-<mesec>/`.
2. Sve ostalo ide u `~/Desktop/Carsystem-fakture-podesavanje/<godina>/`.
3. Završni folder se do kraja podešavanja **ne čita**: ne otvara se, ne
   parsira i ne koristi za odluke; beleži se samo broj fajlova.
4. Kada je parser zamrznut (zapisan commit), provera se nad završnim folderom
   pokreće **jednom**. Prolaz: nijedna faktura van ručnog pregleda sa pogrešnim
   iznosom, šifrom ili zbirom, i isti odnos ispravnih/odbijenih kao u
   podešavanju.
5. Ako završni test otkrije grešku, ispravka se pravi, ali taj skup posle toga
   više nije nezavisan — za novu potvrdu treba novi neviđen skup.

**Poređenje po godinama i rasporedima:** provera već ispisuje status po
(godina, raspored); novi raspored ili godina sa drugačijim odnosom je signal
za ručno poređenje sa PDF-om pre bilo kakve izmene parsera. Nejasni dokumenti
ostaju odbijeni ili na ručnom pregledu.
