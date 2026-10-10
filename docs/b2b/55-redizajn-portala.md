# 55 — Redizajn internog portala (2026-10)

Grana `design/redizajn-portala-2026-10`, osnova `main` 4defb72 (PR #19, redizajn kupčevog panela).
Cilj: interni portal (Vlasnik, kancelarija, komercijalisti) dobija isti vizuelni pravac kao kupčev
panel — bez novih funkcija, bez promene dozvola, računanja cena i rabata, tokova odobravanja,
MFA-a, konektora i uključenosti poručivanja.

## 1. Obuhvat (61 adresa, 3 uloge)

Pregled: Početna, Analitika, Obaveštenja, Aktivnosti.
Prodaja: Kupci, kartica kupca (sa predlozima za razgovor), Šifre partnera (mapiranja), Registar partnera,
Nalozi kupaca, Bez komercijaliste, Kontakti, Veze, Prodaja, detalj fakture, Povrati i minus fakture,
Zahtevi kupaca (lista, detalj, štampa A4, Cena i uslovi), Za razgovor, Preporuke.
Finansije: Cene i rabati, Odobravanje cena, Istorija pravila, Pravila, Cenovnik (lista i detalj),
Rabati iz faktura (pregled, po kupcu, kartica kupca, grupe artikala, grupni predlozi, za ručni pregled).
Sistem: Importi, Sinhronizacija, Izvorni dokumenti, Spremnost podataka, Korisnici i dozvole,
Administracija, Komercijalisti, Proizvodi → Mapiranja artikala.
Bezbednost: Lozinka, Drugi faktor, Nalozi.
Ekrani koji čekaju izvor podataka (isti obrazac, bez izmišljenog sadržaja): Adresnice, BEX, Dugovanja,
Izveštaji, Limiti, Nabavka, Otprema, Porudžbine, Zalihe. Portalska korpa i „Nemate pristup“ su
postojeći ekrani odbijanja.

## 2. Zajednička pravila (app/portal/portal.css)

- Tipografija: naslov strane 22/28, blok 16/22, tekst i polja 14, pomoćni 13; nijedan font ispod 12 px
  (282 stara pravila od 7–11 px podignuta na 12–13 px).
- Nadnaslov strane je mirna siva oznaka odeljka, ne crveni sitni monospace.
- Dugmad i polja visine 40 px, radius 4; glavno dugme grafitno, opasno = crveni obris; dugmad u
  ćeliji tabele uokvirena (`.portal-cell-actions`).
- Kartice pokazatelja: bez obojenih linija, iznos se nikad ne skraćuje (`337.773.083 RSD` ceo);
  mreža `auto-fit minmax(220px, 1fr)`.
- Tabele: zaglavlje 13 px normalnim slovima na sivoj podlozi; dugačke liste se pomeraju u svom
  okviru, zaglavlje ostaje na vrhu okvira, strana se nikad ne preliva vodoravno.
- Strane sa jednom formom (lozinka, drugi faktor) do 720 px (`.portal-narrow`).
- Fokus: plavi prsten 3 px na svim linkovima, dugmadima i poljima.
- Brojevi i datumi kroz `lib/ordering/panelFormat.mjs`: `dd/mm/yyyy` (i `mm/yyyy` za mesece),
  razdvajač hiljada, `30 %`, `1.234,56 RSD` sa neprelomnim razmakom.

## 3. Datumi i filteri (zajednička komponenta)

- Uzrok preklapanja „Od“/„Do“: polje unosa je imalo fiksnu širinu veću od svoje kolone. Sada je
  `.pd-input` elastičan (`flex: 1 1 0; min-width: 0`), par Od/Do je mreža sa granicama kolona, a
  dugme za slanje filtera je poravnato sa dnom polja.
- Samostalno polje datuma u redu filtera ne skuplja se na samo dugme kalendara (min 170 px).
- Na telefonu filteri su kolona pune širine (bez desnog poravnanja i bez „visine 200 px“).
- Kalendar: ispod polja, iznad ako dole nema mesta, a ako nema ni gore ni dole (nizak prozor,
  zum 125–200 %) postaje donji list sa ograničenom visinom — uvek ceo na ekranu.
- Format `dd/mm/gggg`, brze opcije perioda i ponašanje slanja nepromenjeni.

## 4. Sadržajne ispravke po ekranu (samo prikaz)

- Cene i rabati: matrica prvenstva sa srpskim nazivima opsega (jedan kupac / grupa kupaca / svi kupci;
  jedan artikal / grupa proizvoda / proizvođač / svi proizvodi) umesto `customer/product_group/...`.
- Pravila, Odobravanje, Istorija pravila: `Rabat 30 %` umesto `30.000%`, važenje `od 01/01/2026`;
  naslov „Istorija pravila“ usklađen sa menijem.
- Aktivnosti: srpski nazivi polja i stanja zahteva umesto tehničkih ključeva.
- Spremnost podataka: bez `issued_on` u tekstu, meseci `10/2026`, brojevi sa razdvajačem hiljada.
- Izvorni dokumenti, kartica kupca, Za razgovor, rabati, nalozi, obaveštenja, sinhronizacija: datumi
  `dd/mm/yyyy` umesto `2026-10-08` / `5. 10. 2026.`.
- Prodaja, Povrati, Analitika: iznosi u karticama sa `RSD`, tabele u celim dinarima; detalj fakture
  sa dve decimale.
- Množina: `1 artikal / 2 artikla / 5 artikala`, `grupa/grupe`, `stavka/stavke/stavki`.
- Mapiranja artikala: radnje u ćeliji kao uokvirena dugmad u redu.
- Kupci (komercijalista): umesto „vraća 403“ — „Kupac koji Vam nije dodeljen ne otvara se ni preko
  direktne adrese.“

## 5. Namerno nepromenjeno

Dozvole i opseg kupaca, dodele komercijalistima, računanje cena/rabata/PDV-a, tokovi odobravanja i
evidentiranja u BizniSoft, MFA, konektor, uključenost poručivanja, `LiveRefresh`, zaštita
nesačuvanih izmena, odbijanje zastarelih radnji. Nema ručnog unosa cene. Bez migracija.

## 6. Provere

- `npm test` 2220/2220, `npm run typecheck`, `npm run lint` (0 grešaka, 2 ranija upozorenja van
  obuhvata), `npm run test:integration` 560/560 (postojeća lokalna test baza), `npm run build:check`.
- Lokalna kopija, 61 adresa × uloge Vlasnik / kancelarija / komercijalista na 1440; Vlasnik na 390,
  768, 1366×768, 1920: bez vodoravnog prelivanja strane, bez engleskih oznaka, bez JS grešaka
  (jedini 403 u konzoli je postojeći ekran odbijanja portalske korpe).
- Kalendar (Playwright): unos, Od/Do bez preklapanja, otvaranje, izbor meseca i godine, izbor dana,
  Escape, brisanje; 390, 768, 1366×768, 1440, 1920 i zum 125/150/200 % na 1366×768 — kalendar ceo
  u prozoru. Zum je emuliran smanjenim CSS prozorom uz `deviceScaleFactor` (isti CSS raspored kao
  zum pregledača).
- Duge liste (261–500 redova): zaglavlje tabele ostaje na vrhu okvira, neprozirno, ispod trake portala.
- Kupčev panel i prijave (1440, 390, tamna tema): piksel-identični pre/posle, osim kupčevih Faktura
  gde deljeno polje perioda sada ima iste čitljive oznake kao interni portal. Javni sajt ne učitava
  portal.css.

## 7. Nije provereno

- Stvarni zum pregledača (Preferences) i pravi Safari/Firefox za interni portal — provereni su
  Chromium i emulirani zum.
- Čitač ekrana (VoiceOver/NVDA).
- Stariji Windows pregledači (vidi PR #20) — CSS ovog PR-a ne uvodi `oklch`/`color-mix`
  (`cssFallback.test.mjs`).
- Ekrani sa stvarnim radnjama koje menjaju podatke (odobravanje pravila, dodela, uvoz) — samo izgled,
  bez pokretanja radnji.
- Preview: dogovor o objavi sa mogućnošću povratka ostaje za završni pregled.
