---
id: SV-0045
slug: kit-preko-rdje
naslov: Može li kit preko rđe
metaNaslov: "Može li kit preko rđe ili loše očišćenog lima"
opis: "Zašto se kit ne nanosi preko rđe ni preko nedovoljno očišćenog lima, šta o podlozi kažu tehnički listovi kitova i šta se dešava sa takvom popravkom."
kategorija: korozija
podtema: kit i korozija
tip: resavanje-problema
publika:
  - pocetnik
  - hobista
glavnoPitanje: Može li se kit naneti preko rđe ili preko nedovoljno očišćenog lima?
namera: rešavanje problema
dodatnaPitanja:
  - Šta se dešava sa takvom popravkom posle nekoliko meseci?
  - Da li antikorozivni kit sme preko rđe?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Urednički predlog q162 u questions.json („Može li kit preko rđe?“); srodno pitanje o kitu na golom limu (q030) pronađeno je na domaćem forumu."
brendovi:
  - carsystem
  - carfit
proizvodi:
  - carsystem-anti-rust-putty
  - carfit-glas-plus-putty
  - carsystem-git-multi-green
povezani:
  - SV-0055
  - SV-0042
  - SV-0044
  - SV-0041
izvori:
  - id: cs-anti-rust-putty-tds
    naziv: "Carsystem, Technical Data Sheet Anti Rust Putty, anti corrosive putty"
    url: https://www.carsystem.org/fileadmin/products/datasheets/tds_anti_rust_putty_V03.pdf
    verzija: "V03, 08/2022"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: carfit-glas-plus-tds
    naziv: "C.A.R.FIT, Technical Data Sheet Glas Plus Putty"
    url: https://carfitrepair.com/wp-content/uploads/2023/05/car-fit-glass-plus-putty-technical-data-sheet.pdf
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: cs-multi-green-tds
    naziv: "Carsystem, Technical Data Sheet Multi Green, Polyester multifunctional putty V08"
    dokument: /documents/products/carsystem/carsystem-git-multi-green-tds.pdf
    verzija: "V08, 11/2024"
    pristupljeno: 2026-10-08
    tip: tehnicki-list
  - id: vetere-tannins
    naziv: "V. F. Vetere, R. Romagnoli, Chemical and electrochemical assessment of tannins and aqueous primers containing tannins (CIC Buenos Aires, repozitorijum)"
    url: https://digital.cic.gba.gob.ar/bitstreams/f8a335fc-4757-44cd-8f6c-8dec49e76ffb/download
    pristupljeno: 2026-10-08
    tip: strucni-izvor
prioritet: 412
razlogPrioriteta: Rešava konkretan problem iz prakse; raspoređeno naizmenično sa drugim temama.
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
Ne. Kit se nanosi na čistu, suvu, odmašćenu i dobro izbrušenu podlogu bez rđe, i to traže tehnički listovi kitova iz našeg programa, uključujući i kitove namenjene mestima oštećenim korozijom. Kit preko rđe ne zaustavlja koroziju, a rđa ispod njega oslabljuje prianjanje. Isto važi za lim koji je samo „otprilike“ očišćen: tamne tačke u udubljenjima su rđa koja ostaje ispod popravke.

## Šta tehnički listovi kitova traže

| Kit | Šta tehnički list navodi o podlozi |
| --- | --- |
| C.A.R.FIT Glas Plus | namenjen i mestima oštećenim korozijom, ali traži da se stara boja i korozija uklone brušenjem P80–P120 i da se kit ne nanosi na neizbrušenu površinu[^carfit-glas-plus-tds] |
| Carsystem Anti Rust Putty | podloga čista, suva i odmašćena; dobro prianjanje samo na dobro izbrušenoj podlozi[^cs-anti-rust-putty-tds] |
| Carsystem Multi Green | vrlo dobro prianjanje na grubo izbrušenim podlogama[^cs-multi-green-tds] |

Primer C.A.R.FIT Glas Plus je koristan jer pokazuje kako se čita opis proizvoda. „Za mesta oštećena korozijom“ znači da kit popunjava neravnine koje ostanu posle uklanjanja korozije, a ne da ide preko nje; uputstvo za pripremu u istom listu to jasno kaže[^carfit-glas-plus-tds].

## Da li antikorozivni kit sme preko rđe?

Ne. Carsystem Anti Rust Putty je dvokomponentni poliesterski kit sa ugrađenom zaštitom od korozije, ali tehnički list za njega traži istu pripremu: čistu, suvu, odmašćenu i dobro izbrušenu podlogu[^cs-anti-rust-putty-tds]. Zaštita od korozije u kitu dodatno štiti čist metal; ne zamenjuje uklanjanje rđe.

Napomena za pocinkovani lim: isti tehnički list u opisu navodi odlično prianjanje na pocinkovanim podlogama, a u odeljku o podlozi piše da kit nije pogodan za pocinkovane površine[^cs-anti-rust-putty-tds]. Dok proizvođač to ne razjasni, ne nanosite ga na pocinkovan lim bez potvrde tehničke podrške.

## Šta se dešava sa takvom popravkom posle nekoliko meseci

Opšte objašnjenje, bez tvrdnje o tačnom roku: korozija ispod kita se nastavlja, jer u rđi i oko nje ostaje vlaga, a kit i boja preko njega nisu zaptivna barijera koja bi to zaustavila. Proizvodi korozije zauzimaju više prostora od metala i podižu kit, pa se na popravljenom mestu pojave mehuri, pukotine ili ivica koja se odvaja. U stručnom radu o tretmanima zarđalih površina autori navode da premaz na zarđaloj površini rano otkazuje[^vetere-tannins]. Kada će se to videti, zavisi od količine preostale rđe, vlage i debljine kita, pa rok ne navodimo.

Mogući znaci da je kit nanet preko nedovoljno očišćene podloge:

- mehuri ili smeđi trag na ivici popravke;
- pukotina po obodu kita;
- kit koji se odvaja od lima u komadu.

Kako se proverava uzrok i kako se mesto ponovo radi, opisuju vodiči [Mehuri rđe ispod laka](/vodici/mehuri-rdje-ispod-laka) i [Uklanjanje rđe sa karoserije](/vodici/uklanjanje-rdje-sa-karoserije).

## Ispravan redosled

1. Rđa se uklanja do zdravog metala.
2. Lim se odmašćuje i brusi granulacijom iz tehničkog lista kita.
3. Kit se nanosi direktno na metal, ako ga tehnički list dozvoljava za tu podlogu, ili preko prajmera koji dozvoljava poliesterski kit. Koja varijanta važi za Vaš materijal, objašnjava vodič [Kit na goli lim ili preko prajmera](/vodici/kit-na-goli-lim-ili-preko-prajmera).
4. Rupa ili stanjen lim se ne popunjavaju kitom; to je posao za limarsku popravku.

## Pitanja i odgovori

### Može li kit sa vlaknima da premosti malu rupu od rđe?

Neki kitovi sa vlaknima su namenjeni i malim rupama. C.A.R.FIT Glas Plus, na primer, navodi pukotine, male rupe i mesta oštećena korozijom[^carfit-glas-plus-tds]. Ivica rupe i tada mora biti očišćena od korozije, a lim oko nje zdrav. Ako je lim oko rupe tanak, kit neće vratiti čvrstinu.
