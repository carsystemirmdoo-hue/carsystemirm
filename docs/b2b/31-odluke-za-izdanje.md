# 31 — Konačan spisak prepreka za izdanje (2026-09-30)

## Kod — nema otvorenih prepreka
Grana `release/portal-2026-10` (origin/main + PR #3, #2, F1–F10 + ispravka
testa `aaed73d`): kompletan `npm test` prolazi (1858 prošlo, 0 palo, 18
Windows-testova konektora preskočeno na Mac-u), integracije 484/484 na praznoj
bazi sa migracijama 0000–0032, QA u pregledaču 22/22, build i provera veličine
funkcija prolaze. Nije poslata na GitHub.

## Preostalo — traži vaš izbor ili podatke firme
1. **Firmin Vercel:** podaci iz `32-…` §A (tim, plan — Hobby je samo za
   nekomercijalnu upotrebu, poziv za naš nalog, GitHub pristup, domen, DNS).
2. **Baza i backup** (§1 ispod).
3. **E-pošta** (§2 ispod).
4. **Kontakt podaci firme:** telefon na sajtu je šablon (`+381 22 000 000`).
5. **Stvarni BizniSoft izvozi** (§3 ispod) — potrebni za proveru cena, rabata,
   lagera i za stvarno poručivanje; nisu potrebni za prvo (zaključano) postavljanje.
6. **Odobrenja:** slanje grane kao PR ka `main` i njeno spajanje; lansiranje.

---

# Detalji

Sve ostalo za izdanje je u kodu i provereno na lokalnoj grani
`release/portal-2026-10` (`28-…`, izveštaj u odgovoru). Ove tri stvari kod ne
može da reši.

## 1. Baza i backup

**Zatečeno stanje** (provereno čitanjem, ništa nije menjano):
- Firma je otvorila svoj Vercel nalog (koraci: `32-…`). Postojeći projekat
  `carsystemirm` je još na **ličnom** nalogu (`miles-projects`). Production ima samo `MAINTENANCE_MODE`,
  `SITE_ACCESS_PASSWORD`, `PREVIEW_USERNAME`, `PREVIEW_PASSWORD`.
- **Nema baze** ni na jednom okruženju (`DATABASE_URL`, `AUTH_SECRET`,
  MFA ključevi ne postoje) — portal online nije podešen nigde.
- Lokalno postoji samo lokalni Postgres (demo i test baze).

**Šta birate:**
1. Nalog: nov projekat u **timu firme** (`32-…`); stari na ličnom nalogu ostaje dok domen ne pređe.
2. Provajder Postgresa u EU (Frankfurt), npr. Neon preko Vercel Marketplace-a
   ili Supabase. Uslov iz koda: `CREATE ROLE` i `ALTER DEFAULT PRIVILEGES`
   (runtime rola bez brisanja traga revizije), pooled + direktan URL,
   posebna baza/grana za Preview.
3. Backup: dnevni + povratak u tačku vremena (PITR), rok čuvanja (predlog 7–30
   dana). Besplatni nivoi obično nemaju PITR — to je stvar troška.

Posle izbora: postupak je u `28-…` A2–A6 (migracije 0000–0032, role, seed,
provere).

## 2. E-pošta

**Zatečeno stanje:**
- Nema provajdera ni paketa za slanje pošte.
- Pozivi kupcima, reset lozinke i bezbednosna obaveštenja čekaju u
  `customer_message_outbox`; kancelarija ih ručno preuzima i označava kao
  predate (`/portal/kupci/nalozi`).
- Kontakt obrazac na sajtu otvara klijent za poštu posetioca (`mailto:`), ne
  šalje sa servera.

**Šta birate:**
1. Da li pilot ostaje na ručnom predavanju (radi odmah, bez troška) ili se
   uvodi slanje sa servera.
2. Ako se uvodi: provajder (transakciona pošta ili SMTP firme), adresa
   pošiljaoca (npr. `nalog@…`), i DNS zapisi SPF/DKIM/DMARC kod registra domena
   (Burina.net).
3. Da li i kontakt obrazac šalje sa servera (tada treba i zaštita od spama).

## 3. Stvarni BizniSoft izvozi

Detaljno u `25-…` §2 i `26-…` §6. Minimum za proveru sa stvarnim podacima:
1. Šifarnik artikala (šifra, naziv, JM, pakovanje, šifra proizvođača, grupa, PDV, aktivan).
2. Važeći cenovnik (cena bez PDV-a, važi od).
3. Rabati/posebne cene po kupcu (na šta se odnosi, %, važi od/do).
4. Lager (po magacinu, raspoloživo, vreme stanja) i odluka šta kupac sme da vidi.
5. Odgovor: može li BizniSoft da izvozi po rasporedu i da uveze narudžbenicu iz fajla.
EOF
echo ok