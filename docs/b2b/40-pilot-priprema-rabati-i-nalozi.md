# 40 — Pilot: odluke, uputstvo za kontrolni zbir, istorijski rabati i nalozi kupaca

**Status (2026-10-02): priprema lokalna; pilot baza još ne postoji; ništa nije
uvezeno, nijedan nalog ni poziv nije napravljen.** Brojke i spiskovi sa
podacima kupaca su samo u `~/.carsystem-private/`. Prethodno: [39](39-veza-kupaca-i-pilot-koraci.md).

## 1. Odluke vlasnika (2026-10-02)

- **Baza:** Neon **Free** za početni kontrolisani test; bez plaćenih usluga.
- **Vercel:** Hobby **nije** rešenje za poslovni pilot; plan i naplata se
  rešavaju pre objave pilota. Do tada nema deploymenta pilota.
- **Oznaka izdavaoca: `CSRM`** — tačno tako, velikim slovima. Nema je u kodu
  ni u testnoj bazi (tamo je samo `QA`). Polje „izdavalac" pri uploadu je
  slobodan tekst i razlikuje velika i mala slova: „csrm" bi bio drugi izdavalac
  i šifre ne bi bile povezane. Ista vrednost ide u `customer-link.mts --izdavalac`.
- **Git istorija:** ne prepisuje se; izloženost je evidentirana privatno;
  odluka ostaje otvorena.

## 2. Pilot baza: šta je spremno i prvi korak

Lokalno spremno: fascikla tajni `~/.carsystem-secrets/pilot/` (700/600) sa
**novim** ključevima (različitim od testnih) i oznakom `DATASET_ROLE=pilot`;
nedostaje samo adresa baze. Alati iz [33 §4](33-test-baza-runbook.md) rade sa
`CARSYSTEM_SECRETS_DIR=~/.carsystem-secrets/pilot`.

**Prvi korak (Neon konzola, firmin nalog):** New Project → ime
`carsystem-pilot`, Postgres 17, region **AWS Europe Central 1 (Frankfurt)**,
plan Free → Connect: rola `neondb_owner`, baza `neondb`, **Connection pooling
isključen** → kopirati adresu i u terminalu je upisati skriveno:

```bash
CARSYSTEM_SECRETS_DIR=~/.carsystem-secrets/pilot bash scripts/ops/preview-secrets.sh set NEON_OWNER_URL
```

Posle toga, uz posebnu potvrdu: provera mete i migracije
(`preview-db.mts`) — prazna šema, bez ijednog stvarnog reda.

## 3. Uputstvo za koleginicu: kontrolni zbir za januar 2025.

Zbir koji izračunamo iz PDF arhive **nije** nezavisna potvrda — nastao je iz
istih dokumenata koje proveravamo. Zato broj mora doći direktno iz BizniSoft-a.

1. U BizniSoft-u otvorite izveštaj izdatih (izlaznih) računa koji koristite
   za knjigu izlaznih računa / PDV evidenciju. Ako niste sigurni koji, pitajte
   BizniSoft podršku za „pregled izdatih računa po datumu".
2. Postavite: period **01.01.2025 – 31.01.2025**, po **datumu izdavanja
   računa**; vrsta dokumenta **račun-otpremnica**; samo **proknjiženi**; svi
   kupci, sve poslovne jedinice.
3. Isključite: storna i stornirane račune, nacrte, predračune, otpremnice bez
   računa, povrate i knjižna odobrenja. Ako ih u januaru ima, zapišite posebno
   njihov broj dokumenta i iznos.
4. Zapišite: **broj računa**, ukupno **neto** (bez PDV-a, posle rabata),
   ukupno **PDV**, ukupno **bruto** (sa PDV-om).
5. Napravite **snimak ekrana** filtera i zbira. Ako izveštaj može po kupcu,
   sačuvajte i taj izvoz (XLSX) — neizmenjen.
6. Pošaljite brojeve i snimak privatno; ne menjajte i ne brišite ništa u
   BizniSoft-u.

## 4. Istorijski rabati (privatni pregled)

**Šta postojeći tok podržava** (`lib/pricing/rebateEvidence.mjs`, ekran
`/portal/cene/rabati-iz-faktura`): par (kupac, grupa artikla); samo procenat
rabata (ne cena); klase *dosledan / protivrečan / premalo dokaza / bez rabata
/ nedostaje grupa*; pragovi 3 stavke i 2 dokumenta; dosledan par postaje
**predlog pravila u toku odobravanja** — nikad direktno u cenovnik ili korpu.

**Šta je urađeno:** isti pragovi i klase, po kupcu, nad potvrđenim
računima-otpremnicama iz arhive, **bez** storna, njihovih originala,
revizija/duplikata i kandidata uz negativne dokumente. Privatno:
`rabati-istorija-po-kupcu.csv` — period (od–do), broj dokumenata i stavki,
dominantni rabat i njegov udeo, ostali rabati, dominantni po godinama,
poslednjih 12 meseci, klasa po postojećim pravilima.

**Nalaz:** bez grupe artikla većina kupaca ima više stopa rabata i postojeća
pravila ih svrstavaju u „protivrečne" — to je očekivano kada rabat zavisi od
brenda/grupe. **Po grupama se ništa ne izvodi** dok grupa nije potvrđena
(šifarnik artikala). Svaki red nosi napomenu „istorijski rabat sa faktura —
nije važeći uslov"; ništa nije upisano kao predlog ni u cenovnik.

## 5. Kandidati za nalog kupca (privatni spisak)

Izvor: sirov izvoz kupaca (`Kupci.xlsx`). **Kandidat je samo partner sa
prodajom u arhivi** — ostali iz šifarnika se ne uključuju. Privatno:
`login-kandidati.csv` (firma, šifra, PIB, e-adresa iz sistema, poslednja
prodaja, broj dokumenata, komercijalista, status, razlozi). JMBG fizičkih lica
se ne prepisuje.

| Status | Značenje |
|---|---|
| `spreman_za_potvrdu_kontakta` | jedna ispravna adresa, samo kod ove firme, ispravan domaći PIB, nije blokiran, prodaja u poslednja 24 meseca — **i dalje treba potvrda osobe** |
| `treba_razjasniti` | nedostaje adresa, adresa kod više firmi, prodaja starija od 24 meseca, strana firma/neispravan PIB, fizičko lice, blokiran |
| `nije_kandidat` | nema prodaje u arhivi |

Adresa iz BizniSoft-a **nije** potvrda osobe (može biti knjigovođina, bivšeg
zaposlenog ili deljena) — vidi [23 §5](23-partner-registry-and-account-verification.md).

## 6. Tok aktivacije naloga: spremno i nedostaje

**Spremno** (23 §6): predlog kontakta (nalog `requested`, bez lozinke);
potvrda osobe sa načinom (povratni poziv na poznat broj, potpisano
ovlašćenje, lično), izvorom adrese i beleškom; kapija za poziv (firma
`mapped` + živa potvrda za tu adresu i firmu, ≤ 90 dana); jednokratni link
(vraća se jednom, outbox ga ne sadrži); kupac sam postavlja lozinku
(`/prijava/kupac/aktivacija`); ograničenje pokušaja aktivacije; opoziv pristupa
u jednoj transakciji; trag revizije bez e-adrese i beleške.

**Nedostaje / otvoreno:**

1. **Firma mora biti povezana pre poziva** — za istorijske kupce to radi alat
   iz 39 §1; postojeći ekran registra povezuje šifru **iz šifarnika** („28"),
   a fakture nose „00028" — oba oblika mogu stajati uz istog kupca, ali
   pravilo kog oblika se drži za nove veze treba usvojiti (preporuka: oblik sa
   fakture, kao alat).
2. **Isporuka linka:** nema servisa za slanje pošte (bez plaćenog SaaS-a);
   kancelarija preuzima link i predaje ga van sistema (`markOutboxHandedOver`).
3. **Samostalna promena zaboravljene lozinke za kupce je isključena**;
   zaboravljena lozinka = nov poziv kroz kancelariju.
4. Potvrda osobe je ručan rad po firmi; za pilot 5–10 firmi (23 §10).
5. Link za prijavu kupca na sajtu je skriven (`NEXT_PUBLIC_CUSTOMER_LOGIN_LINK=0`).
6. Otvorene odluke iz 23 §11 (ko sme da potvrdi, rok potvrde, deljene adrese,
   šifre komercijalista 1/2/3).

Ništa od ovoga nije pokrenuto: nema aktivnih naloga, zajedničkih lozinki ni
poslatih poziva.

## 7. Sledeći zadaci

| # | Zadatak | Zavisi od |
|---|---|---|
| 1 | Neon `carsystem-pilot` (Free) i upis adrese — §2 | vlasnik (konzola) |
| 2 | Provera mete i migracije pilota | 1 + potvrda |
| 3 | Kontrolni zbir januar 2025. iz BizniSoft-a — §3 | kancelarija |
| 4 | Vercel plan za poslovni pilot, pa zaštićena objava `pilot/istorija` | vlasnik (naplata) + odobrenje |
| 5 | Aleksandrov Vlasnik nalog i MFA u pilotu | 4 + njegovo prisustvo |
| 6 | `customer-link.mts` nad pilot bazom → pregled → potvrda → primena | 2, 5 |
| 7 | Upload talasa januar 2025. (`CSRM`) i kontrole 38 §4 | 3, 6 |
| 8 | Pravila za storna i revizije (37 §2, 38 §2) | kancelarija |
| 9 | Sirov šifarnik artikala (grupe) → rabati po grupi | kancelarija |
| 10 | Potvrda kontakata za 5–10 pilot firmi → pozivi | 6 + odluke 23 §11 |
| 11 | Odluka o čišćenju Git istorije | vlasnik |
