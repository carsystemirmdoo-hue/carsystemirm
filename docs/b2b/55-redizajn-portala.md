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

Automatske: `npm test` 2220/2220, `npm run typecheck`, `npm run lint` (0 grešaka, 2 ranija upozorenja
van obuhvata), `npm run test:integration` 560/560 (postojeća lokalna test baza), `npm run build:check`.

Stvarno pokretano (lokalna kopija, dev server):
- Chromium (Playwright): 61 adresa × Vlasnik / kancelarija / komercijalista na 1440; Vlasnik na 390,
  768, 1366×768, 1920 — bez vodoravnog prelivanja, bez engleskih oznaka, bez JS grešaka.
- Google Chrome sa STVARNIM zumom pregledača (profil sa `default_zoom_level`, prozor 1366×768, novi
  headless; potvrđeno `devicePixelRatio` 1,25 / 1,5 / 2 i širina 1093 / 911 / 683 CSS px): Početna,
  Kupci, kartica kupca, Prodaja, Za razgovor, Cene, Rabati po kupcu, Sinhronizacija, Lozinka, Zahtevi —
  bez prelivanja; kalendar ceo u prozoru; unos, Od/Do bez preklapanja, izbor meseca/godine/dana, brisanje.
- Kalendar u Chromium-u na 390, 768, 1366×768, 1440, 1920: isto, plus Escape.
- Duge liste (261–500 redova): zaglavlje tabele ostaje na vrhu okvira, neprozirno, ispod trake.
- Kupčev panel i prijave (1440, 390, tamna tema): piksel-identični pre/posle, osim kupčevih Faktura gde
  deljeno polje perioda ima iste čitljive oznake kao interni portal. Javni sajt ne učitava portal.css.

Simulirano (nije pravi pregledač/zum): ranije provere zuma smanjenim CSS prozorom uz
`deviceScaleFactor` — zamenjene gornjom proverom stvarnog zuma u Chrome-u.

Snimci tokom restarta dev servera: snimak bez učitanog stila ne prijavljuje grešku, pa su svi skupovi
naknadno provereni pikselima (tamna bočna traka na desktopu, udeo tamnih piksela na telefonu; detektor
proveren na poznatom lošem snimku). Nađena 3 loša snimka (Kupci 390, Otprema 768, Administracija 1920)
ponovljena i pregledana. Detalj zahteva je imao isto skraćeno ime fajla kao njegova štampa — snimljen
posebno za sve tri uloge.

Greška 403 u konzoli: jedino `/portal/korpa` (provereno prolazom kroz svih 61 adresa). Očekivano —
`getPortalCommerceAccess()` traži uključen `PORTAL_COMMERCE`; lokalno je isključen pa strana namerno
vraća `forbidden()` (HTTP 403, ekran „Nemate pristup“). Kod nepromenjen u odnosu na main. Komercijalista
na fakturi kupca koji mu nije dodeljen dobija 404 (`loadInvoiceDetail` vraća null) — takođe namerno.

## 7. Odnos sa PR #20 (širina + stari pregledači)

- Zajednički fajl je samo `app/portal/portal.css`. PR #20 menja 4 boje radi kontrasta i širinu
  `.portal-main` (1680 → `clamp(1680px, 85vw, 2200px)`); ovaj PR menja veličine fonta u istim pravilima.
- Ova grana je preuzela identične linije boja iz PR #20, pa ni jedan redosled spajanja ne poništava
  ni boju ni veličinu. `git merge-tree` i dalje prijavljuje 3 trivijalna sukoba (samo `font-size`):
  pravilno rešenje je veličina iz ove grane (12 / 12 / 13 px). Širina iz PR #20 se spaja automatski.
- Spojeni CSS propušten kroz `scripts/postcss/legacy-browser-fallbacks.cjs` iz PR #20: bez upozorenja;
  ovaj PR ne dodaje `oklch`/`color-mix` (čuvar `cssFallback.test.mjs`).

## 8. Nije provereno

- Pravi Safari i Firefox za interni portal; stariji Windows pregledači (Chrome/Edge 109) — to je
  predmet PR #20.
- Čitač ekrana (VoiceOver/NVDA).
- Radnje koje menjaju podatke (odobravanje pravila, dodela, uvoz) — samo izgled, radnje nisu pokretane.
- Preview: dogovor o objavi sa mogućnošću povratka ostaje za završni pregled.
