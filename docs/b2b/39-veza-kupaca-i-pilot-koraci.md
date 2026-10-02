# 39 — Veza kupaca za talas, koraci za pilot i zahtev za kontrolni zbir

**Status (2026-10-02): alat za vezu kupaca napravljen i testiran nad
sintetičkim podacima; predlozi za prvi talas pripremljeni privatno; pilot
ne postoji; ništa stvarno nije upisano.** Prethodno: [38](38-zavrsni-test-prvi-talas-i-pilot-baza.md).

## 1. Alat za vezu kupaca

Problem: uvoz povezuje kupca samo po šifri tačno kako je na fakturi
(„00028"), a šifarnik nosi „28" (38 §3, B4).

| Deo | Fajl |
|---|---|
| plan (čista logika) | `lib/commercial/customerLinkPlan.mjs` |
| primena potvrđenih (server) | `lib/commercial/customerLinkApply.ts` |
| komanda | `scripts/ops/customer-link.mts` (`plan`, `apply`) |
| testovi | `lib/commercial/customerLinkPlan.test.mjs`, `db/integration/customerLink.integration.test.mts` |

**Pravila**

- potvrda je `confirmInvoicePartner`: jedinstvena šifra bez vodećih nula u
  šifarniku + PIB sa fakture jednak PIB-u te šifre; izvorne šifre se čuvaju
  (veza se upisuje pod šifrom sa fakture, šifra iz šifarnika ide u napomenu i
  trag);
- nema spajanja po nazivu; naziv iz šifarnika je samo pomoć pri pregledu i
  postaje naziv novog kupca;
- izdvaja se (ne predlaže): PIB se ne slaže, šifra nije u šifarniku ili je
  nejasna, partner blokiran, isti PIB pod više šifara sa faktura, šifra u
  sukobu/isključena/već vezana za drugog kupca, nov kupac bez ispravnog domaćeg
  PIB-a;
- kupac sa istim PIB-om koji već postoji dobija vezu, ne duplikat;
- **nalog za prijavu se nikad ne pravi**.

**Tok**

1. `plan` → privatna tabela za pregled (`kljuc`, šifre, PIB, naziv, mesto, broj
   dokumenata, predlog; prazne kolone `odluka`, `potvrdio`, `napomena`) i
   privatni spisak izdvojenih slučajeva. Bez `DATABASE_URL` radi nad praznim
   stanjem.
2. Kancelarija u tabeli upisuje `potvrdi` ili `odbij` i svoje ime.
3. `apply` (podrazumevano probni prolaz) ponovo računa plan nad ciljnom bazom
   i primenjuje **samo** potvrđene redove čiji se otisak poklapa sa trenutnim
   stanjem; ostalo je „zastarelo" i traži nov `plan`. `--upisi` tek posle
   pregleda probnog prolaza.
4. Jedan partner = jedna transakcija (kupac + šifra + trag). Ponovno
   pokretanje ne pravi duplikate: već povezano je „bez radnje", stari otisci su
   „zastareli".

`apply` odbija: nalog koji nije aktivan Vlasnik/kancelarija; fajlove unutar
repozitorijuma; bazu označenu kao demo kada talas ima stvarne PIB-ove.

**Prvi talas:** predlog postoji za svakog partnera talasa (nad praznim
stanjem: otvaranje kupca + veza), bez izdvojenih slučajeva. Tabela je privatna
(`~/.carsystem-private/veze-talas-01.csv`). Oznaka izdavaoca je **`CSRM`**
(odluka 2026-10-02, [40 §1](40-pilot-priprema-rabati-i-nalozi.md)) — ista
vrednost u `plan` i kao „izdavalac" pri uploadu PDF-ova u pilotu.

## 2. Pilot: koraci

Rade ljudi sa pristupom firminim nalozima; ništa od ovoga nije urađeno.

1. **Neon** (firmin nalog): projekat `carsystem-pilot`, AWS Frankfurt,
   Postgres 17; plan prema odluci A/B (§4). U „Connect" isključiti pooling i
   kopirati direktnu adresu vlasnika.
2. **Tajne odvojeno od testa:** `export CARSYSTEM_SECRETS_DIR=~/.carsystem-secrets/pilot`,
   pa `bash scripts/ops/preview-secrets.sh init` (novi ključevi) i
   `… set NEON_OWNER_URL`; u isti fajl ručno dodati red `DATASET_ROLE=pilot`
   (sintetički seed tada odbija rad).
3. **Baza:** sa istim `CARSYSTEM_SECRETS_DIR`, `preview-db.mts all` (migracije,
   `carsystem_app`, provera prava, pooled/direktna adresa). Sintetički seed se
   **ne** pokreće.
4. **Rezervna kopija nule:** Neon grana `pocetak` + `pg_dump -Fc` u šifrovanu
   lokaciju; proba `pg_restore` u praznu lokalnu bazu (38 §4).
5. **Vercel promenljive** (§3), okruženje Preview, grana `pilot/istorija`.
6. **Objava** (traži odobrenje): grana `pilot/istorija` = pregledani commit sa
   PR grane; jedan zaštićeni Preview deployment. Grane `integration/**` se i
   dalje same ne objavljuju; Production i `main` se ne diraju.
7. **Provera posle objave:** adresa zahteva Vercel prijavu; `robots`/noindex;
   `/api/sync` isključen; prijava radi samo sa vezanim drugim faktorom;
   poručivanje isključeno; baza bez `dataset.kind`.
8. **Vlasnik — kada je Aleksandar prisutan:** `preview-owner.sh` (lozinku kuca
   sam), pa `preview-mfa-grant.sh issue` i vezivanje na adresi pilota, kodovi
   za oporavak van računara, odjava i ponovna prijava, `… clear` — sve sa
   `CARSYSTEM_SECRETS_DIR` pilota. Prethodno vezivanje na sintetičkom Preview-u
   **nije** uslov.
9. **Nalog kancelarije** za uvoz kreira Vlasnik u portalu (drugi faktor
   obavezan).
10. **Talas:** `customer-link.mts plan` nad pilot bazom → pregled → `apply`
    probno → `apply --upisi`; zatim upload PDF-ova talasa i kontrole iz 38 §4.

## 3. Vercel promenljive za `pilot/istorija` (samo Preview, samo ta grana)

| Promenljiva | Vrednost |
|---|---|
| `DATABASE_URL` | pilot, pooled, `carsystem_app` (iz fajla tajni pilota) |
| `DATABASE_DIRECT_URL` | pilot, direktna, `carsystem_app` |
| `DATABASE_POOL_MAX` | `2` |
| `AUTH_SECRET`, `PORTAL_MFA_MASTER_KEY_V1`, `AUTH_RATE_LIMIT_HMAC_KEY` | **novi**, iz fajla tajni pilota (ne iz testa) |
| `AUTH_URL` | adresa grane `pilot/istorija` — potvrditi posle prve objave |
| `PORTAL_MFA_MODE` | `enforced` |
| `NEXT_PUBLIC_SEO_INDEXING` | `false` |
| `MAINTENANCE_MODE` | `false` (pristup štiti Vercel Authentication) |
| `CUSTOMER_ORDERING` | `off` — **ne** `demo` |
| `PORTAL_COMMERCE` | `off` |
| `FEATURE_SYNC_DEVICE_INGEST`, `FEATURE_SYNC_OPERATIONS`, `FEATURE_RECOMMENDATIONS`, `FEATURE_PARTNER_REGISTRY`, `CUSTOMER_REMEMBER_ME`, `RECOMMENDATIONS_AUTO_RECOMPUTE`, `NEXT_PUBLIC_CUSTOMER_LOGIN_LINK` | `0` |

Ne postavljati na Vercel: `NEON_OWNER_URL`, `CARSYSTEM_APP_PASSWORD`,
`MIGRATION_DATABASE_URL`, `BOOTSTRAP_ADMIN_*`, `DATASET_ROLE`. Ne koristiti
Neon ↔ Vercel integraciju (upisuje adrese i u Production).

## 4. Troškovi (zvanični uslovi provereni 2026-10-02)

| Stavka | A: bez troška | B: preporuka |
|---|---|---|
| Neon | Free: $0; 1 GB/projekat, 100 CU-h, povratak 6 h | Launch: bez minimuma, $0,106/CU-h, $0,35/GB-mesec, povratak do 7 dana; procena ≈ $5/mesec uz pretpostavku 0,25 CU × 8 h × 22 dana i < 1 GB — važi za ceo nalog, uključujući testni projekat |
| Vercel | Hobby: $0, ali po uslovima samo lična, nekomercijalna upotreba | Pro: $20 po razvojnom sedištu mesečno (uz $20 kredita); Vercel Authentication uključen, zaštita lozinkom ($20/projekat) nije potrebna |
| Domen | nije potreban (adresa `*.vercel.app`) | isto |
| Rezervne kopije | lokalno, šifrovano: $0 | isto |
| **Ukupno** | $0 (uz ograničenja i rizik uslova) | ≈ $25/mesec (procena) |

Promena plana naplate je odluka vlasnika i radi se u nalozima firme; ovaj
dokument je ne pokreće.

## 5. Zahtev kancelariji: kontrolni zbir za januar 2025.

Iz BizniSoft-a, za **01.01.2025–31.01.2025**, po datumu izdavanja računa:

- **samo izlazni računi — „Račun-otpremnica"**, proknjiženi;
- **bez** storna, storniranih računa, nacrta, predračuna, otpremnica bez
  računa, povrata i knjižnih odobrenja (ako ih u januaru ima, navesti ih
  posebno: broj dokumenta i iznos);
- svi kupci, sve poslovne jedinice;

i za taj skup:

1. broj računa;
2. ukupno **neto** (osnovica bez PDV-a, posle rabata);
3. ukupno **PDV**;
4. ukupno **bruto** (sa PDV-om);
5. kako je izveštaj dobijen (meni, filteri) — snimak ekrana.

Uz to, ako je lako: isti brojevi po kupcu (šifra partnera). Brojevi se porede
sa privatnim manifestom talasa; razlika se objašnjava pre bilo kakvog uvoza.
