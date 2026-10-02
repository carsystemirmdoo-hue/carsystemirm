# 43 — Prvi talas (januar 2025.): uputstvo, stalna ulazna fascikla i zaduženja

**Status (2026-10-02): sve što ne zavisi od Aleksandra je spremno lokalno;
nema stvarnog uvoza, deploymenta ni promene naplate.** Smer: istorijska
arhiva sa Mac-a ([42](42-uvoz-sa-maca-i-windows-konektor.md)); firmin Windows
računar samo za buduću sinhronizaciju.

## 1. Šta je spremno

| Šta | Gde (privatno, van repozitorijuma) |
|---|---|
| Manifest talasa (otisci, broj, datum, partner, iznosi) | `~/.carsystem-private/talas-01-2025-01.json` |
| Zbirovi **izvedeni iz iste PDF arhive** (broj računa, stavki, partnera, neto, PDV, bruto) — **nisu nezavisna kontrola**; nezavisna potvrda je samo BizniSoft izveštaj | `~/.carsystem-private/talas-01-kontrolni-zbirovi.md` |
| Tabela predloga veza za pregled kancelarije | `~/.carsystem-private/veze-talas-01.csv` |
| Jednostavan list za kancelariju (firma, PIB, šifra iz BizniSoft-a, DA/NE) i povratak u pregledanu tabelu (`scripts/ops/office-link-sheet.mts`) | `~/.carsystem-private/kancelarija-veze-talas-01.csv` |
| Fascikla talasa (kopije, provereni otisci) | `~/.carsystem-private/talasi/2025-01/` |
| Rezervna kopija prazne pilot baze + proba vraćanja | `~/.carsystem-private/rezervne-kopije/` |
| Paketi konektora 0.2.0 (kancelarijski i probni Windows) + `SHA256SUMS.txt` | `~/.carsystem-private/paketi/` |
| Pilot baza (prazna, migrirana, ograničena uloga) | Neon `carsystem-pilot` |
| Primena veza samo kroz prijavljenog korisnika | `/portal/kupci/veze` |

## 2. Uputstvo, korak po korak

Lokalni server: `next start -H 127.0.0.1 -p 3419` sa
`~/.carsystem-secrets/pilot/local-build.env` uz `FEATURE_SYNC_DEVICE_INGEST=1`
i `FEATURE_PARTNER_REGISTRY=1` (samo lokalno, samo za ovaj rad).

**A. Pre dana uvoza**

1. Kancelarija vraća pregledanu tabelu (`odluka` = `potvrdi`/`odbij`,
   `potvrdio` = ime) i BizniSoft zbir za januar 2025. (40 §3).
2. Poređenje BizniSoft zbira sa zbirovima iz manifesta; razlika se objašnjava
   **pre** uvoza (npr. račun koji nije u PDF arhivi).

**B. Dan uvoza, uz Aleksandra** (Mac, lokalni server)

3. Vlasnik nalog: `CARSYSTEM_SECRETS_DIR=~/.carsystem-secrets/pilot bash scripts/ops/preview-owner.sh "<e-adresa>" "<ime>"`
   — lozinku kuca Aleksandar.
4. Drugi faktor: `… preview-mfa-grant.sh issue "<e-adresa>"` → Aleksandar
   otvara fajl sam, vezuje aplikaciju na `http://localhost:3419/portal/bezbednost/mfa` (adresa mora biti ista kao `AUTH_URL`),
   čuva kodove za oporavak van računara → `… clear` → odjava i ponovna prijava.
5. Rezervna kopija: Neon grana `pre-talas-01` (konzola) + `pilot-backup.sh dump`
   + `verify`.
6. Veze: `/portal/kupci/veze` — šifarnik (`Kupci.xlsx`), pregledana tabela,
   `CSRM` → „Proverite" → „Primenite potvrđene" (u roku od 10 minuta od
   prijave). Zatim `wave-control.mts pre` mora pokazati sve ✔.
7. Konektor na Mac-u — **tačna komanda u 42 §2 korak 3** (preko `node`, ne
   `connector.sh`): `init`; Aleksandar registruje `MAC-ARHIVA` (`biznisoft` /
   `CSRM`) na `/portal/importi/sinhronizacija` i aktivira ga izborom sa liste i
   potvrdom otiska.
8. `run-once` dok `status` ne pokaže svih 136 potvrđeno (najviše 50 po ciklusu;
   prekid je bezbedan). Na probi: 3 ciklusa, bez odbijanja.
9. `wave-control.mts posle --bs-broj … --bs-neto … --bs-pdv … --bs-bruto …` —
   sve ✔. Ako nešto padne: ništa dalje; povratak na granu `pre-talas-01`.
10. `pilot-backup.sh dump` posle talasa.
11. Preporuke i predlozi za razgovor posle talasa: [47 §4](47-ponedeljak-pilot.md).

Sledeći talasi (mesec po mesec) ponavljaju 1–2, 5–6, 8–10; uređaj ostaje
registrovan do kraja arhive, zatim opoziv i brisanje stavke iz keychain-a.

## 3. Redovna sinhronizacija: stalna ulazna fascikla

**Predlog:** na firminom računaru jedna stalna fascikla na lokalnom disku, npr.
`C:\CarsystemFakture\Ulaz\`, u koju kancelarija (ili BizniSoft, ako ume da
čuva PDF u zadatu fasciklu) **kopira** svaki nov račun. Konektor čita samo nju
(i neposredne podfascikle, npr. po mesecima) — putanja se ne menja svake
godine. Originalna arhiva ostaje netaknuta i konektor je ne čita.

- konektor fajlove ne menja, ne premešta i ne briše; fascikla raste, a već
  poslat fajl (isti otisak) se ne šalje ponovo;
- slučajno ubačen stari račun → server ga prepoznaje (isti fajl = duplikat;
  isti broj sa drugim sadržajem = ručni pregled), nikad dvostruko knjiženje;
- mrežni disk (UNC) nije podržan — fascikla mora biti na lokalnom disku;
- pitanje za kancelariju: može li BizniSoft sam da sačuva PDF računa u tu
  fasciklu, ili ga čovek kopira posle izdavanja?

## 4. Windows konektor (cilj: ponedeljak, uslovljeno)

Datum važi tek kada su ispunjeni: objavljen pilot server (HTTPS) sa
`FEATURE_SYNC_DEVICE_INGEST=1` — traži Vercel plan i odobrenje objave, koji
**nisu odobreni**; kućni Windows probni prolaz (`SMOKE PASS`); stvarne provere
na firminom računaru (42 §5). Windows testovi u repozitorijumu su preskočeni i
ne računaju se kao potvrda.

## 5. Zaduženja

**Ti:**

1. Proslediti kancelariji tabelu `veze-talas-01.csv` i uputstvo za BizniSoft
   zbir (40 §3) — privatnim kanalom.
2. Dogovoriti dan uvoza sa Aleksandrom; Neon granu `pre-talas-01` napraviti u
   konzoli tog dana.
3. Potvrditi limit prostora u Neon konzoli (0,5 GB).
4. Odluka o Vercel planu i objavi pilota — preduslov za Windows konektor.
5. Kućni Windows probni prolaz paketa (ili osoba koju odrediš) + prenos
   heša odvojenim kanalom.

**Kancelarija:**

1. Pregled 68 predloga veza: `potvrdi`/`odbij` + ime u `potvrdio`.
2. BizniSoft zbir za januar 2025. (broj, neto, PDV, bruto, snimak ekrana).
3. Odgovor o stalnoj ulaznoj fascikli (§3) i o tome ko kopira nove račune.
4. Kasnije: pravila za storna i revizije, šifarnik artikala.

**Aleksandar (lično, na dan uvoza):**

1. Postavlja svoju lozinku i vezuje drugi faktor u pilotu; čuva kodove za
   oporavak.
2. Registruje i aktivira uređaj `MAC-ARHIVA` (potvrda otiska).
3. Primenjuje pregledane veze u portalu (ili to radi korisnik sa paketom
   „mapiranja" koga on odredi).
4. Kasnije: isto za kancelarijski Windows uređaj, i nalog kancelarije.
