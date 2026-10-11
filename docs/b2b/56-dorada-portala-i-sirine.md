# 56 — Dorada internog portala i širine na velikim ekranima (2026-10-11)

Grana `design/dorada-portala-2026-10`, osnova `main` 0fe253e (#20 + #21). Bez promene poslovne logike,
cena, dozvola, prijave i podataka. Bez spajanja i objave do pregleda vlasnika.

## 1. Uzroci

Javni sajt — širina i poravnanje
- Postojao je zajednički token `--ds-container-max` (do 1600px), ali ga zaglavlje (74rem), footer (72rem),
  putanja (96rem), katalog/kontakt/program/proizvod (1320px + rast), prodavnice (1320px / do 2120px),
  R-M kampanja (80rem), SATA (94rem) i Befar/C.A.R.FIT (token minus razmak) nisu koristili direktno —
  svaki je računao sopstvenu širinu i bočni razmak, pa su leve ivice skakale 8–56px i na običnom desktopu.
- Početna je imala i sopstveni sistem `--home-wide-*` (do 2240px) koji se sudarao sa tokenom; sekcije
  „Tehnička podrška“ i „Edukacija“ su oduzimale razmak dvaput (najuže na strani).
- Cosmos Lac nije imao kontejner: sekcije su imale samo razmak od ivice ekrana (60px na 3440px).
- Na 3440px sadržaj je zauzimao 1600px (46% ekrana), a hero i trake su išli preko cele širine.

Portal — razmaci i poravnanje
- `.portal-panel` sam nema razmak. Razmak je dobijao samo panel čije je prvo dete `h2`/`h3` (18/20px)
  ili par zaglavlje + telo; panel koji počinje filterom, pasusom ili listom ostajao je bez razmaka
  (Spremnost, Izvorni dokumenti, mapiranja, Istorija pravila).
- Komponente pravljene za panel bez razmaka (obrazac podešavanja i filtera, prazno stanje i „Šta je
  potrebno“, traka cenovnika, sažetak kartice kupca, stanje Za razgovor, liste redova) imale su sopstveni
  razmak 18–34px — tekst je stajao 4–18px dalje od naslova panela, ili dvostruko kad je panel dobio razmak.
- Radna površina je bila centrirana (do 2200px), pa se putanja u traci i naslovi nisu poklapali na
  širokim ekranima; traka je imala 22px, sadržaj 28px.
- Red filtera sa periodom bio je poravnat po dnu: „Primenite/Prikažite“ i polje „Pretraga“ su se ravnali
  sa brzim izborima ispod datuma, ne sa poljima Od/Do. Napomena ispod filtera (podnožje) imala je
  ograničenje pasusa (78ch), pa se linija prekidala.

## 2. Pravila posle dorade

Javni sajt
- Jedan kontejner: `min(--ds-container-max, 100% − 2 × --ds-gutter)` za zaglavlje, putanju, footer i sve
  sekcije; trake i hero ostaju preko cele širine, ali njihov sadržaj počinje na liniji kontejnera.
- Ultrawide (od 2354px): kontejner raste `min(68vw, 2240px)` bez skoka (3440px → 2240px, 65%).
  Tekstovi zadržavaju čitljivu širinu (sopstveni `ch` limiti); mreže i mape koriste prostor;
  katalog dobija 5 kolona od 2700px i 6 od 3200px (kartica ~300–360px).

Portal
- Radna površina uz bočni meni, do 2880px; traka sa istim razmakom kao sadržaj.
- Panel = kartica sa razmakom 16px (kao `pn-card` u Zahtevima kupaca); tabele, trake filtera, sažeci i
  liste redova idu od ivice do ivice, sa sopstvenim razmakom 16px.
- Red filtera sa periodom: sve od vrha, oznake iste visine, dugme u visini polja datuma; na tabletu i
  telefonu polja i dugmad 44px; kalendar uvek ceo na ekranu.
- Odobravanje cena i Istorija pravila: naslov i tabela u istom panelu.
- Oznake podataka normalnim slovima (kartica kupca, Za razgovor, rabati); sporedna dugmad sa okvirom;
  srpski nazivi u putanji i razlozima ciklusa sinhronizacije; preostali ISO datumi u dd/mm/yyyy.

## 3. Provere (lokalna kopija, dev server)

- `npm test` 2228 + 9 testova paketa konektora koji se sa neprijavljenim izmenama preskaču (sa čistim stablom 13/13), `typecheck`, `lint` (0 grešaka),
  `test:integration` 560/560, `build:check`, `build:trace-check`.
- Chromium: portal 61 adresa × 1440, 3440×1440, 1366×768, 768×1024, 390×844 (Vlasnik) + 1440 za
  kancelariju i komercijalistu; javni sajt 12 strana × 1440, 2560×1440, 3440×1440, 768, 390 —
  bez vodoravnog prelivanja; svaki snimak proveren pikselima (stil učitan).
- Automatska provera razmaka panela (tekst i kontrole od unutrašnje ivice): sa 8 panela bez razmaka i
  ~35 dvostruko uvučenih na 0 stvarnih nalaza (preostala su tekst u uokvirenim karticama i nabrajanja).
- Poravnanje javnog sajta: leva ivica logotipa = putanja = naslovi odeljaka na 1440 / 3440 / 390
  (izuzeci su naslovi unutar kartica i kolone footera).
- Google Chrome sa stvarnim zumom 125/150/200% (1366×768): 7 ekrana portala i 6 javnih strana bez
  prelivanja; kalendar ceo u prozoru.
- Kalendar (Chromium): unos, Od/Do, mesec/godina, dan, Escape, brisanje na 390, 768, 1366×768, 1440.
- Kupčev panel i prijave: identični, osim poravnatog reda filtera na Fakturama i pomeraja od 1px na
  Izboru robe (ista visina oznake).

## 3a. Dopuna pre spajanja

- Sinhronizacija → Uređaji: kolona „Radnja“ je zalepljena uz desnu ivicu okvira tabele; na 1366 i 1440px
  dugme „Skenirajte i sinhronizujte“ je celo vidljivo i stvarni je element pod kursorom (provereno).
- Uske tabele na širokim ekranima (od 1500px, samo interni portal): tabela zauzima prirodnu širinu, najmanje
  1180px (720px za 2–3 kolone) ili ceo okvir ako je uži. Ispod 1500px i u kupčevom panelu bez promene.
- Funkcionalna provera (lokalna kopija, bez upisa osim probnog kupca): filteri Prodaje (period kucanjem +
  kupac → adresa i rezultat), brzi izbor perioda, neispravan datum, pretraga (Bez komercijaliste), filteri
  Za razgovor, provera cene sa izborom dana iz kalendara, checkbox (Cenovnik), radio (promena rabata),
  izbor fajla + „Proverite (bez upisa)“ (Kontakti, sintetički CSV), izbor PDF-a bez slanja (Importi) —
  sve prošlo na 1440 i 390px, bez JS grešaka. Kupčev tok zahteva + kancelarija (27 provera) — prošlo.
- Stari i drugi pregledači: Chromium 109.0.5414 (sa isključenim CSSColor4, kao izdati 109), Firefox 151
  i WebKit 26.5 (Playwright; WebKit nije pravi Safari): javni sajt, portal i kupčev panel na 1440 i 2560 —
  bez prozirnih boja, bez prelivanja, poravnanja ista, bez JS grešaka. Prvi prolaz Firefox/WebKit je imao
  ispade dev servera (strana bez stila, greške) koji se u ponovljenom prolazu nisu javili.

## 3b. Završna dorada (kod 4bad8b0)

- Mreža definicija (Raspon uvezenih datuma, zaglavlje fakture): broj kolona prati broj podataka, bez prazne ćelije
  (ranije fiksne 3 kolone); na uskom ekranu jedna ispod druge.
- Kartice pokazatelja: uravnoteženi redovi bez upita za širinu kontejnera — 6 → 6 / 3 × 2 / 2 × 3 / 1, 8 → 8 / 4 × 2 /
  2 × 4 / 1, 4 → 4 / 2 × 2, 3 → 3 / 1; kartica ≥ 240px, font nepromenjen. Provereno svakih 40px od 360 do 3440.
- Procenti u srpskom zapisu (`100,0 %`) na Spremnosti, rabatima, cenovniku i odobravanju. Tekstovi u `lib/pricing` koji
  se upisuju u razloge revizije nisu menjani.
- Duge strane (uzrok: prikaz svih već učitanih redova): Kartica kupca → „Predlozi za proširenje“ prvih 20 + „Prikažite
  ostalih N“ (54.556 → 18.995px); Rabati iz faktura → po odeljku prvih 20 + „Prikažite ostalih N“ (56.118 → 4.777px).
  Upit i podaci isti. „Artikli“ na kartici nisu sklopljeni jer predlozi vode na njihova sidra (`#artikal-…`).
- Naslov zalepljene prve kolone ostaje na mestu pri vodoravnom pomeranju (Sinhronizacija → Uređaji i ostale tabele sa
  zaglavljem reda).

Predlog za posebnu doradu (nije u ovom PR-u): Artikli na kartici kupca (272 reda, ~16.000px) — sklapanje grupa uz
automatsko otvaranje grupe kada se prati veza `#artikal-…` (mala skripta na klijentu) ili prikaz po grupama sa
brojem; na Spremnosti duga tabela meseci (720px, sama se pomera) određuje visinu reda kratkih panela na širokom ekranu,
pa ispod kratkih ostaje do ~400px sive površine — rešivo samo drugim redosledom panela.

## 4. Ograničenja

- Pravi Safari i Edge 109 nisu pokretani (Chromium 109, Firefox 151 i WebKit jesu — vidi 3a).
- Dugme za izbor fajla prikazuje jezik pregledača („Choose File“) — nije menjano.
- Čitač ekrana nije pokretan.
- Radnje koje menjaju podatke nisu pokretane — samo izgled.
