# 54 — Redizajn kupčevog panela i kancelarijskog dela za zahteve (2026-10)

Grana `design/redizajn-panela-2026-10`, osnova `main` 13710db (PR #18). Production ostaje na proverenoj
verziji dok se redizajn ne pregleda.

## 1. Zatečeni problemi (pregled pre izmena, lokalna kopija, 1440 / 1366 / 390 px)

Raspored i veličine
- Kupčev deo ograničen na 1120 px — na 1440–1920 px zbijen u sredini, tabele lome nazive i iznose.
- Naslov strane je bio naziv firme (26 px), a stvarni naslov ekrana mali h2; iste rečenice ponovljene u zaglavlju i panelu.
- Kancelarijski detalj: radnje („Preuzmite u obradu“, odluka) na dnu, posle 60 stavki; obrazac izmene skriven bez oznake.
- Na telefonu meni naloga sečen bez naznake da se pomera; iznosi u karticama stavki prelamani.

Cene i iznosi
- „Cena po jedinici bez PDV-a“ i „Ukupno za količinu sa PDV-om“ istog izgleda; osnovna cena i rabat kao sitan tekst „cenovnik X − 44 %“.
- Opcije plaćanja bez iznosa po opciji — kupac nije video šta koja opcija znači za ceo zahtev.
- Štampa: font 8,5–9 pt, kolona „PDV“ uvek prisutna, iznosi preko 99.999,99 rizik od isecanja.

Statusi i radnje
- Status bez „ko je na potezu“; status stare verzije i važeće slabo razdvojeni.
- `window.confirm` za otkazivanje i potvrdu (nema fokusa, nema Escape pravila, izgled pregledača).
- Odbijanje i potvrda predloga iste težine; nema objašnjenja zašto je dugme onemogućeno.
- Poruka osvežavanja: „Korpa je u međuvremenu promenjen“ (rod).

Dostupnost i kompatibilnost
- Kupčev deo i prijava kupca nasleđivali su prelaz stranica javnog sajta: sloj je sakriven, ali je
  `body[aria-busy]` i blokada tastera Tab trajala ~1,5 s posle svakog učitavanja/prelaza.
- Prijava kupca: oznake polja 11 px, dekorativni tamni panel sa ogromnim naslovom, dupli znak firme; aktivacija zalepljena uz levu ivicu.
- Svi tokeni portala i tamne teme sajta bili su samo u `oklch()` (Chrome 111+). U pregledaču bez podrške
  (npr. Chrome 109, poslednji za Windows 7/8.1) token postaje nevažeći → tekst, pozadine i okviri bez boje.
  **Ovo je verovatan, ali NE potvrđen uzrok prijave sa starijih Windows računara** — pravi pregledač i verzija nisu poznati.

## 2. Zajednička pravila (app/portal/panel.css, prefiks `pn-`)

- Širina: tabele i liste do 1680 px (kao interni portal); tekstualne forme do 720 px.
- Tipografija: naslov strane 22/28, blok 17/24, tekst i polja 15, ćelije i oznake 14, pomoćni 13 (nikad cena ni status).
- Dugmad i polja visine 44 px; glavna radnja desno, grafitna; opasna odvojena linijom, crveni obris, uvek kroz dijalog.
- Uz onemogućeno dugme stoji rečenica „zašto“; tokom radnje dugme je zauzeto („Šalje se…“), drugi klik ne šalje.
- Status = tekst + oblik oznake (krug, romb, kvačica, x, prazan kvadrat) + „Na potezu: …“ (`lib/ordering/statusView.mjs`).
- Iznosi: `lib/ordering/panelFormat.mjs` — 1.234,56 RSD (neprelomni razmak), datumi dd/mm/yyyy (Beograd).
- Cena kupca po jedinici je glavna vrednost; osnovna cena i rabat su prateći redovi; zbirovi podebljani.
- Stavka na upit: oznaka „Na upit“, nikad 0,00; „Iznos još nije utvrđen“ ili „Zbir poznatih cena — nije konačan“.
- Tabela šira od prostora pomera se SAMO u svom okviru (senka + rečenica); na < 720 px redovi postaju kartice.
- Zaglavlje tabele je lepljivo ispod trake portala samo kada tabela staje u širinu.
- Fokus: plavi prsten 3 px u obe teme. Dijalog: izvorni `<dialog>`, Escape zatvara, fokus se vraća na dugme.
- Boje isključivo kroz tokene; bez `oklch`/`color-mix` u novom CSS-u. Tamna tema samo za kupčev deo.

## 3. Promene po ekranu

Kupac
- Okvir: tanak red sa firmom i odjavom, meni „Zahtevi i porudžbine“ sa brojem zahteva koji čekaju kupca; meni se pomera na telefonu (aktivna stavka u vidnom polju, senka na ivici).
- Pregled: „Čeka Vas“ traka, poslednji zahtevi, poslednje fakture, firma, kontakt kancelarije (bez izmišljenih pokazatelja).
- Fakture: filteri sa vidljivim oznakama i postojećim izborom perioda; tabela; detalj sa iznosima i stavkama.
- Izbor robe: pretraga, cena kupca za svaku odobrenu opciju (osnovna + rabat prateće), količina + „Dodajte u korpu“ sa porukom uz red.
- Korpa: opcije plaćanja kao izbori sa zbirom za svaku opciju; tabela stavki; bočni zbir i slanje; vidljiva lista promena (postojeća ponovna potvrda); napomena/adresa/telefon preživljavaju promenu opcije (sessionStorage, samo u kartici).
- Zahtevi i porudžbine: „Čeka Vas“ izdvojeno; kolone Stanje i Na potezu.
- Detalj: stanje + potez → blok „šta sledi“ sa radnjama → podaci i zbir → stavke preko cele širine (označene izmene u odnosu na prethodnu verziju, uklonjene stavke ispod) → istorija i verzije. Odbijanje i otkazivanje kroz dijalog.
- Upiti, saglasnosti, bezbednost: naslovi strana, kartice, dijalog za „Odjavite me sa svih uređaja“ i „Zaboravite uređaj“.
- Prijava, aktivacija, zaboravljena lozinka: jedna kartica, vidljive oznake, obe teme; logotip ostaje u zaglavlju.

Kancelarija (svetla tema, bez nove interne teme)
- Lista: filteri stanja sa brojem (Otvoreni, Novi, U obradi, Čeka kupca, Potvrđene — za BizniSoft, …), kolona Na potezu, važeće verzije podrazumevano; kontrolisana proba sklopiva, samo vlasniku.
- Detalj: radnje na vrhu (prijem, odluka kroz dijaloge sa razlogom, potvrda onemogućena uz objašnjenje kad ima stavki na upit), evidencija broja ručnog unosa u BizniSoft sa greškom uz polje.
- Izmenjen predlog: široke kolone šifre i naziva, kolona „Bilo“, uklonjena stavka može da se vrati, zbir ispod tabele sa poređenjem, traka radnji na dnu. Cena se ne unosi ručno (kao i do sada).
- A4: stavke 10 pt, osnovna cena / rabat / cena kupca / iznos razdvojeni, kolona PDV samo kad stope nisu iste, zaglavlje tabele na svakoj strani, broj dokumenta i „Strana X od Y“ u margini, stara verzija označena na svakoj strani.

## 4. Sačuvano poslovno ponašanje (namerno nepromenjeno)

Računanje cena, rabata, PDV-a i zaokruživanja (svi iznosi iz postojećih funkcija; novo je samo prikaz zbira po
opciji preko istog `orderTotals` i istog izbora stavki); odobrene opcije plaćanja; dozvole i opseg kupaca;
razlika zahtev / porudžbina / faktura; tok potvrđivanja i čuvanje verzija; `staleVersionProblem` i ključ slanja;
`LiveRefresh` (15 s + povratak u karticu, `data-unsaved`); istorijski snimak cena; ograničenje na probnog kupca.
Odbijanje predloga kupca i dalje nema razlog (server ga ne prima). Novo u servisu je samo za prikaz:
`biznisoftDocumentNumber` u listi, `countCustomerOrdersAwaiting`, `optionTotals` u ponudi korpe, osnovna cena i iznosi u pregledu izmene.

## 5. Provere (lokalni klon, samo probni kupac PROBA-0001; ništa u BizniSoft)

- `npm test` (2220 provera), `npm run typecheck`, `npm run lint` (0 grešaka; 2 ranija upozorenja van obuhvata),
  `npm run test:integration` 560/560 na praznoj test bazi (uz novu proveru zbira po opciji), `npm run build:check`.
- Tok u dva prozora (Chromium): dvostruki klik = jedan zahtev; automatsko osvežavanje drugog prozora kancelarije
  (≤ 15 s) i kupčeve liste bez skoka; obaveštenje umesto prepisivanja kada postoji neposlat razlog / napomena;
  zastarela radnja odbijena sa vezom ka važećoj verziji; stara verzija bez radnji; kupčeve oznake izmena;
  zastarelo odbijanje kupca odbijeno; dijalog tastaturom, Escape, vraćanje fokusa; potvrđena porudžbina + broj BizniSoft dokumenta.
- Širine 360, 390, 768, 1024, 1280, 1366, 1440, 1920 i zum 125/150/200 % na 1366×768: bez vodoravnog prelivanja strane,
  bez engleskih statusa, dodirne mete na telefonu.
- Firefox i WebKit (Playwright): bez JS grešaka i prelivanja. Simulacija pregledača bez `oklch`: boje iz hex rezervi.
- PDF (Chrome 154): kratak, 60 stavki (4 strane), sve na upit, mešano, stara verzija (4/4 strane označeno), potvrđena porudžbina;
  bez isečenih ćelija, iznosi 10 pt, zaglavlje tabele i „Strana X od Y“ na svakoj strani.

## 6. Ostaje za ručnu proveru

- Pravi Safari (automatizovan je samo WebKit), pravi stariji Windows računar sa poznatom verzijom pregledača.
- Štampa iz Firefox-a i Safarija nije proverena; broj strane i dokumenta u margini (`@page` margin boxes) proveren je samo u Chrome-u. Zaglavlje dokumenta i oznaka stare verzije na prvoj strani su u samom sadržaju i ne zavise od toga.
- Čitač ekrana (VoiceOver/NVDA) nije pokretan; proveren je samo redosled tastature i ARIA oznake.
- Preview je iza Vercel SSO; pregled na Preview-u radi vlasnik.
