# 63 — Predlog: stanje zaliha iz BizniSofta u portalu (2026-10-13)

Status: **predlog, bez implementacije na Production-u.** Uslov za predlog pribora „ako je na stanju“
(dok. 61, `lib/ordering/companionRule.mjs`) i za bilo kakvu tvrdnju o dostupnosti na sajtu.
Danas portal ne čuva stanje (0038: „stanje se NE čuva“), pa nijedan prikaz ne tvrdi „na stanju“.

## 1. Raspoloživi izvori

| Izvor | Šta sadrži | Kako stiže danas | Ocena |
|---|---|---|---|
| PDF „STANJE ZALIHA - NABAVNA I VP CENA“ | šifra, naziv, PDV, **količina**, nabavna i VP cena/vrednost; zaglavlje: „Na dan“, „Datum štampe“, „Poslovni objekti: 021 VELEPRODAJA“, „Stanje artikala: Svi artikli, uključujući stanje 0“, „Definisana jedinica mere“ | ručno otpremanje u Portal → Finansije → Cenovnik (dok. 52); `lib/pricing/stockPriceReport.mjs` **već čita i proverava količinu** (količina × VP cena = VP vrednost po redu, zbir = „Ukupno stanje zaliha“), pa je odbacuje | **preporučen prvi izvor** — format je strogo prepoznat, kontrola čitanja već postoji |
| Izvoz šifarnika (xlsx, „BSRep“) | šifra, naziv, JMR, …, VP cena, Cena RSD, **„Količina na zal.“** | ručni izvoz | rezervni izvor; bez kontrolnog zbira i bez datuma stanja u fajlu |
| Konektor (KANC-01) | danas šalje samo PDF fakture iz foldera | automatski, po rasporedu | kasnije: isti konektor može otpremati i PDF stanja zaliha (nova vrsta dokumenta) |

## 2. Značenje podataka

- **Ključ:** interna BizniSoft šifra (tekst, vodeće nule se čuvaju) — ista kao `articles.code`.
- **Jedinica:** količina je u JM artikla iz BizniSofta (KOM, LIT, KG…), sa decimalama (npr. 1,5 LIT).
  Nikad se ne preračunava u pakovanja bez potvrđenog pakovanja (`article_pack_sizes`).
- **Magacin / poslovni objekat:** izveštaj je filtriran na „021 VELEPRODAJA“. Snimak čuva oznaku objekta;
  stanje iz drugog objekta se ne meša. Ako firma ima više objekata za prodaju, odluka vlasnika je koji se računaju.
- **Vreme snimka:** „Na dan“ iz izveštaja (datum stanja), ne vreme otpremanja. Čuva se i ko je otpremio i kada.
- **Negativno stanje / 0:** čuva se kako jeste; za prikaz „nema“ znači ≤ 0.

## 2a. Izmereno na uzorku (izveštaj od 09.10.2026, ista štampa kao za cenovnik)

| Pitanje | Nalaz | Sigurnost |
|---|---|---|
| Šta je količina i u kojoj JM | knjižno stanje artikla u **JM iz BizniSofta** (izveštaj nema kolonu JM; filter „Definisana jedinica mere“). LIT artikli imaju decimale (npr. 7,5 L = tri kante od 2,5 L); KOM može biti decimalan (manji broj redova, npr. 0,5 KOM kod deljivih pakovanja). | izmereno |
| Rezervisana roba | izveštaj ne prikazuje rezervacije ni poručenu robu; da li je stanje umanjeno za rezervacije **ne može se videti iz izveštaja** | otvoreno — pitanje za knjigovodstvo |
| Jedan ili više magacina | jedan poslovni objekat po štampi („Filteri: Poslovni objekti: 021 VELEPRODAJA“); drugi objekti zahtevaju posebnu štampu ili drugačiji filter | izmereno |
| Nule i izostavljeni artikli | „Stanje artikala: Svi artikli, uključujući stanje 0“: velik deo redova je 0; nijedan negativan. Svi aktivni artikli i svi artikli sa osnovnom cenom su u izveštaju (brojevi u privatnoj evidenciji). Zato: **red sa 0 = nema na stanju; artikal kog nema u izveštaju = nepoznato** (nije u objektu ili nije obuhvaćen vrstom artikla). | izmereno |
| Datum i vreme snimka | „Na dan: dd.mm.gggg“ i „Datum štampe: dd.mm.gggg“ — **bez vremena**. Vreme snimka = vreme otpremanja (beleži portal) ili vreme iz naziva fajla, ako ga kancelarija dodaje. | izmereno |
| Kontrola čitanja | 0 problema; zbir VP vrednosti se slaže sa „Ukupno stanje zaliha“ | izmereno |
| Pakovanja | broj celih prodajnih pakovanja = ⌊količina ÷ potvrđeno pakovanje⌋ u istoj JM (npr. LIT 7,5 ÷ 2,5 = 3; KOM 230 ÷ 100 = 2 kutije rukavica); artikal bez potvrđenog pakovanja nema prikaz u pakovanjima | pravilo (predlog) |

## 2b. Uputstvo: izvoz uzorka iz BizniSofta (za proveru)

1. BizniSoft → isti izveštaj kao za cenovnik: **„Stanje zaliha – nabavna i VP cena“** (dok. 52, korak 1).
2. Filteri — bez promene u odnosu na cenovnik: poslovni objekat **021 VELEPRODAJA**; „Stanje artikala: **Svi artikli, uključujući stanje 0**“; vrsta artikla kao do sada; „Definisana jedinica mere“; sortiranje po nazivu.
3. „Na dan“: **današnji datum**; štampa u **PDF** (ne skenirano), sve strane.
4. Naziv fajla: `stanje-zaliha-021-GGGG-MM-DD-HHMM.pdf` (vreme štampe, jer izveštaj ne nosi sat).
5. Ako postoje drugi poslovni objekti/magacini iz kojih se prodaje, ponoviti štampu sa tim objektom i nazvati fajl po objektu — ne spajati.
6. Fajl poslati kancelariji/meni privatno (ne u javni repo). Provera uzorka radi se lokalno istim parserom; ništa se ne upisuje na Production.

## 3. Predlog modela (nova migracija, samo dodavanje)

```
article_stock_snapshots   (id, source: 'stanje-zaliha-pdf' | 'sifarnik-xlsx', business_unit, as_of date,
                           uploaded_by, uploaded_at, file_sha256, rows, total_vp_value, status)
article_stock_levels      (snapshot_id, article_id, quantity numeric(14,3), unit)   -- samo dodavanje
view articles_current_stock  -- poslednji USPEŠAN snimak po artiklu, uz as_of
```

- Snimak je nepromenljiv; novi snimak ne briše stari (istorija i povratak).
- Artikal koga nema u snimku = „nepoznato“ (ne „0“).
- Nabavna cena, nabavna vrednost i marža se i dalje **ne čuvaju**.

## 4. Pravilo prikaza (predlog za odluku vlasnika)

| Stanje | Uslov | Kupac vidi | Predlog pribora |
|---|---|---|---|
| na_stanju | snimak ≤ N sati star i količina ≥ jedno potvrđeno pakovanje | (odluka: ništa / „na stanju“ / broj) | prikazuje se |
| nema | snimak svež i količina < jedno pakovanje | (odluka: ništa / „trenutno nema“) | ne prikazuje se |
| nepoznato | nema snimka, snimak zastareo (> N sati) ili artikal nije u snimku | ništa (bez tvrdnje) | po `ORDERING_COMPANION_STOCK` (podrazumevano: ne) |

`companionDecision({ stock })` već prima ova tri stanja; potrebno je samo napuniti `stock` iz `articles_current_stock`.

## 5. Osvežavanje i zastarelost

1. Prva faza: kancelarija uz cenovnik otprema isti PDF i za stanje (jedno otpremanje, dva ishoda); predlog: svakog radnog dana ujutru.
2. Druga faza: konektor otprema PDF stanja po rasporedu (npr. 07:00 i 13:00); portal ga obrađuje istim parserom.
3. Zastarelost: posle N sati (predlog 24 h radnim danima) stanje postaje „nepoznato“ — nikad se ne prikazuje staro stanje kao trenutno.
4. Neuspelo čitanje (format, zbir): snimak se odbacuje u celini, prethodni ostaje dok ne zastari; kancelarija dobija obaveštenje.

## 6. Šta treba odlučiti pre implementacije

1. Koji poslovni objekti (samo „021 VELEPRODAJA“?) čine stanje za online ponudu.
2. Šta kupac vidi: ništa, „na stanju / trenutno nema“, ili količinu.
3. Prag zastarelosti (N) i raspored otpremanja.
4. Da li rezervisana/poručena roba (zahtevi u obradi) umanjuje prikazano stanje (BizniSoft izveštaj to ne zna).
5. Ko odobrava uključivanje (vlasnik) i povratak (isključivanje bez brisanja snimaka).

## 6a. Odluke vlasnika 2026-10-13

- Izvor stanja: **samo poslovni objekat 021 VELEPRODAJA** (jedini magacin).
- Prijavljeni kupci vide **broj komada ili broj celih prodajnih pakovanja**, uz vreme ažuriranja snimka.
- Dok se ne razjasne rezervacije, knjižno stanje se ne prikazuje kao garantovano slobodna količina
  (predlog teksta: „Stanje u magacinu na dan … u … — raspoloživost potvrđuje kancelarija“).
- **Nije odlučeno:** učestalost osvežavanja i granica zastarelosti.
- BizniSoft podršci je pripremljen upit o WebService/API pristupu zalihama; odgovor nije stigao i servis se ne
  pretpostavlja kao aktivan — do tada izvor je PDF izveštaj (2b).

## 7. Datirane potvrde vlasnika (nisu izvor zaliha)

Pojedinačne potvrde („crnu i sivu zaštitu od kamenčića trenutno imamo“, 2026-10-13) vode se kao datirana
evidencija u privatnim beleškama i **ne** pune automatski prikaz stanja.
