# 38 — Završni test, prvi talas istorijskih faktura i pilot baza

**Status (2026-10-02): završni test izvršen jednom, bez izmene parsera; prvi
talas pripremljen kao privatni manifest; ništa nije upisano.** Brojke i
detalji su samo u `~/.carsystem-private/`. Prethodno: [36](36-provera-stvarnih-faktura-i-pilot-okruzenje.md),
[37](37-storna-partneri-i-prethodne-godine.md).

## 1. Završni test

| | |
|---|---|
| Uzorak | izdvojen po imenima fajlova, nasumično, sa zapisanim semenom, **pre** čitanja sadržaja (37 §5) |
| Zamrznuto pre pokretanja | parser `biznisoft-pdf-2`, commit `4fd2b09`, Node 24.20, otisci fajlova parsera i skripte, otisak manifesta — `zavrsni-test-zamrznuto.json` |
| Pokretanje | jednom, `BIZNISOFT_HOLDOUT_MODE=samo`, bez upisa; rezultat sačuvan pre analize |
| Izmene parsera tokom testa | nijedna |

**Rezultat:** nijedna faktura sa pogrešnim iznosom, stavkom ili zbirom; svaka
faktura i storno potvrđeni prema šifarniku (šifra + PIB); udeo ispravnih među
„Fak" fajlovima isti kao u skupu za podešavanje; po godinama isti raspored.
Neispravno pročitani dokumenti su isti tipovi kao u podešavanju (nisu
BizniSoft, negativni bez napomene o originalu) i ostaju na ručnom pregledu.
Unakrsno: original jedinog storna iz uzorka je u skupu za podešavanje, i
obrnuto — oba „storna bez originala" su razrešena.

**Nezavisnost:** test je potrošen. Za svaku sledeću izmenu parsera potreban je
nov, neviđen skup (npr. fakture izdate posle zamrzavanja).

**Zaokruživanje** je **model koji odgovara posmatranim dokumentima** (binarni
zapis, `osnovica × rabat / 100`, polovina od nule), a ne dokaz kako BizniSoft
računa iznutra. Ako se pojavi dokument koji mu ne odgovara, ide na ručni
pregled — tolerancija se ne širi.

## 2. Prvi talas

**Izbor:** jedan ceo mesec iz 2025. u kome nema nijednog isključenog
dokumenta. Privatni manifest `talas-01-2025-01.json`: putanja, SHA-256, broj,
datum, šifra partnera i PIB, broj stavki, neto i bruto, verzija parsera; plus
kontrolni zbirovi meseca.

**Kriterijumi (svi moraju da važe):** ispravna faktura (`valid`, vrsta
`faktura`); partner potvrđen šifrom i PIB-om prema sirovom izvozu kupaca;
naziv fajla „Fak"; nije u grupi duplikata/revizija (isti bajtovi ili isti broj
sa drugim sadržajem — traže se preko **cele** arhive, uključujući završni
uzorak); nije original nijednog storna; nije kandidat uz negativan dokument
bez napomene.

**Izdvojeno za zasebnu obradu** (`talas-izdvojeno.json`): grupe duplikata i
revizija, storna sa vezom na original, negativni dokumenti bez napomene,
dokumenti koji nisu prodajne fakture.

**Storna nisu rešena izostavljanjem.** U posmatranoj arhivi svako storno je u
istom mesecu kao original, pa izostavljanje para ne menja mesečni promet tih
meseci — ali to je **posmatranje, ne pravilo**: storno u kasnijem mesecu,
delimično storno ili ponovo izdata faktura menjaju promet drugačije. Dok
kancelarija ne potvrdi pravila (37 §2), mesečni promet koji obuhvata storna
nije konačan i tako se i označava.

## 3. Šta stvarno blokira uvoz istorijskih faktura

| # | Blokira | Zašto | Kako se otklanja |
|---|---|---|---|
| B1 | Zasebna pilot baza i odluka o planu | stvarni podaci ne smeju u testnu bazu (36 §3) | §4; odluka vlasnika A/B (36 §5) |
| B2 | Isporuka servera sa `biznisoft-pdf-2` u pilot okruženje | server prima samo v2; uvoz ide kroz isti parser | deployment grane u **zasebno** pilot okruženje (ne Preview test, ne Production) — tek uz odobrenje |
| B3 | Nalozi sa vezanim drugim faktorom u pilot bazi | uvoz traži `imports:write`; MFA je obavezan | prvi Vlasnik u pilot bazi (novi ključevi — Preview vezivanje se ne prenosi) |
| B4 | Kupci i veza šifre | uvoz povezuje kupca **samo po tačnoj šifri sa fakture** („00028"); šifarnik nosi „28"; nepoznata šifra ide u „čeka mapiranje" | (a) kancelarija ručno mapira partnere talasa kroz postojeći red, ili (b) mali alat koji iz šifarnika predlaže vezu (šifra + PIB, `partnerRegisterMatch`), a kancelarija potvrđuje — preporuka (b), nije napravljen |
| B5 | Kontrolni zbir iz BizniSoft-a za mesec talasa | bez nezavisnog broja nema prihvatanja | broj faktura, neto i bruto za mesec iz BizniSoft-a |

**Ne blokira istorijske fakture** (potrebno za katalog, važeće cene i
poručivanje):

- sirov šifarnik artikala i veza artikal → katalog (stavka nosi šifru; veza sa
  katalogom je naknadna i nikad po sličnom nazivu);
- važeći cenovnik i rabati (cene sa faktura nisu cenovnik);
- lager i prikaz dostupnosti;
- poručivanje (ostaje isključeno);
- Windows konektor (talas ide kroz portal; konektor je za redovan rad);
- pravila za storna i revizije — **ne blokiraju talas bez njih**, ali blokiraju
  svaki mesec koji ih sadrži i svaki „konačan" promet.

Napomena o uslovima: rad sa stvarnim podacima kupaca je poslovna upotreba;
Vercel Hobby je po uslovima samo za ličnu, nekomercijalnu upotrebu (36 §5).

## 4. Predlog pilot baze, rezervne kopije i kontrole uvoza

**Baza**

- Neon projekat `carsystem-pilot`, region AWS Frankfurt, Postgres 17, odvojen
  od `carsystem-preview-test`; vlasništvo na firminom nalogu.
- Migracije 0000–0032 i `carsystem_app` SQL-om, kao u [33 §4](33-test-baza-runbook.md);
  provera da u bazi nema reda `dataset.kind` ni sintetičkih naloga/PIB-ova.
- Zasebna Vercel grana (npr. `pilot/istorija`) sa sopstvenim promenljivim
  (Preview opseg te grane), Vercel Authentication uključen, `CUSTOMER_ORDERING`
  i `PORTAL_COMMERCE` isključeni, `NEXT_PUBLIC_SEO_INDEXING=false`, novi ključevi.

**Rezervna kopija i oporavak**

1. Pre talasa: Neon grana `pre-talas-01` + `pg_dump -Fc` u šifrovanu lokaciju
   (dump sadrži heševe lozinki i šifrovane MFA tajne).
2. Proba oporavka pre talasa: `pg_restore` u praznu lokalnu bazu i poređenje
   broja redova (postupak dokazan nad sintetičkom bazom, 36 §4).
3. Posle talasa: nov dump; čuva se do prihvatanja sledećeg talasa.
4. Prozor povratka u vremenu zavisi od plana (Free 6 h, Launch do 7 dana) —
   zato je dump obavezan bez obzira na plan.

**Kontrola uvoza**

| Faza | Provera | Prekid ako |
|---|---|---|
| pre | otisci svih fajlova talasa jednaki manifestu; parser na serveru = `biznisoft-pdf-2`; baza bez demo oznake; kupci talasa postoje i mapirani | bilo šta odstupa |
| tokom | slanje u paketima ≤ 50 fajlova i ≤ 4 MB; svaki paket: obrađeno = poslato | ijedan dokument nije `valid`, ili je „čeka mapiranje" / sukob revizije |
| posle | broj faktura, stavki, partnera, neto i bruto u bazi = manifest = BizniSoft kontrolni zbir; ponovni upload istog paketa daje „isti fajl, preskočeno" | bilo koja razlika |
| odluka | kancelarija potvrđuje prikaz za nekoliko kupaca | neslaganje → povratak na granu `pre-talas-01` |

Sledeći talasi idu mesec po mesec, uz isti postupak; meseci sa stornima ili
revizijama tek posle potvrđenih pravila.
