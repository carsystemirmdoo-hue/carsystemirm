# 32 — Postavljanje na firmin Vercel nalog

Status (ažurirano 2026-10-01): **portal nije postavljen nigde.** Kod za izdanje
je lokalna grana `integration/portal-on-main-2026-10` (main 2e67921 + portal
F1–F10 + ispravke iz audita; sačuvana i kao proveren bundle van repoa). Ništa
od nje nije poslato na GitHub. Svaki korak ispod koji dira firmin nalog, bazu,
domen ili DNS radi se tek posle vašeg odobrenja.

Zatečeno prema podacima koje je dostavio vlasnik projekta (Vercel nije otvaran
iz ove sesije):
- Firmin Vercel tim **CARSYSTEM** (`vercel.com/carsystem1`), plan **Hobby**.
- Projekat `carsystemirm` na firminom timu, povezan sa
  `carsystemirmdoo-hue/carsystemirm`, deployment `main` 2e67921 uspešan;
  `MAINTENANCE_MODE=true` i `SITE_ACCESS_PASSWORD` postavljeni; baze nema.
- Domen `carsystemirm.com` prebačen na firmin Vercel nalog; povezivanje sa
  projektom se još proverava. Stari projekat na ličnom nalogu ostaje kao rezerva.
- Pristup DNS-u kod Burina.net ima vlasnik projekta.

## Stanje podataka iz spiska A (2026-10-01)

| # | Stanje |
|---|---|
| 1 Tim | ✅ CARSYSTEM, `vercel.com/carsystem1` |
| 2 Plan i naplata | ⏳ Hobby; po uslovima Vercela Hobby je za nekomercijalnu upotrebu → odluka o Pro i vlasniku naplate |
| 3 Poziv za naš nalog | nije potvrđeno |
| 4 GitHub | ✅ `carsystemirmdoo-hue/carsystemirm` |
| 5 Baza i backup | ⏳ odluka (vidi `33-test-baza-runbook.md`) |
| 6 Domen | ✅ `carsystemirm.com` (da li i `www` — nije potvrđeno) |
| 7 DNS / e-pošta na domenu | ✅ pristup DNS-u postoji; MX zapisi nisu provereni |
| 8 Prvi nalog Vlasnika | ✅ ime i e-adresa za prijavu dostavljeni — čuvaju se **van repozitorijuma**; postupak u `33-…` §5 |
| 9 Kontakt firme | ✅ primenjeno u `lib/company-contact.ts` (telefon, e-pošta, radno vreme, adresa, PIB, MB) |
| 10 Slanje e-pošte | ⏳ odluka; do tada ručno predavanje iz `customer_message_outbox` |
| 11 Računar za konektor | kasnije |

## A. Podaci koje firma treba da dostavi

| # | Podatak | Zašto |
|---|---|---|
| 1 | **Naziv/URL tima** na Vercelu (npr. `vercel.com/<tim>`) | tu se pravi projekat |
| 2 | **Plan tima** (Hobby ili Pro) i ko je vlasnik naplate | Vercel Hobby je samo za **nekomercijalnu** upotrebu; sajt firme traži **Pro** (trošak po članu) |
| 3 | **Poziv za naš nalog** u tim, sa ulogom (Member/Developer) i e-adresa na koju da stigne | da postavimo projekat i promenljive |
| 4 | **GitHub:** da li repozitorijum ostaje `posteriumin-ship-it/carsystemirm` ili prelazi u GitHub organizaciju firme; ko odobrava Vercel GitHub aplikaciju za taj repozitorijum | Vercel gradi iz repozitorijuma |
| 5 | **Baza:** izbor provajdera (predlog: Neon preko Vercel Marketplace-a u timu firme, region Frankfurt), plan i rok čuvanja backup-a (PITR) | P14; troškovi idu kroz naplatu tima |
| 6 | **Domen(i):** koji domen je produkcioni (u kodu je podrazumevano `carsystemirm.com`) i da li i `www` | kanonski URL, `AUTH_URL` |
| 7 | **DNS kod Burina.net:** ko može da doda zapise i da li na domenu radi e-pošta (MX) | premeštanje domena ne sme da prekine poštu firme |
| 8 | **Prvi „gazda" nalog:** ime i e-adresa osobe (lozinku postavlja sama; drugi faktor je obavezan) | jednokratni `db:seed` |
| 9 | **Kontakt firme za sajt:** tačan telefon, e-adresa, radno vreme (u kodu je telefon **šablon** `+381 22 000 000`; e-adresa `office@carsystemirm.com` nepotvrđena) | prikazuje se kupcima i na kontakt strani |
| 10 | **E-pošta:** ručno predavanje u pilotu ili provajder + adresa pošiljaoca (`31-…` §2) | pozivi i reset lozinke |
| 11 | **Kancelarijski računar za konektor** (P12) — kasnije, za redovan uvoz | `FEATURE_SYNC_DEVICE_INGEST` |

Tajne (ključevi sesije, MFA, rate limit) **ne dostavlja firma** — generišemo ih
pri postavljanju i upisujemo direktno u Vercel; ne idu u chat, e-poštu ni repozitorijum.

## B. Koraci postavljanja (posle A1–A8 i vašeg odobrenja)

1. **Grana u repozitorijumu:** `integration/portal-on-main-2026-10` se šalje na
   GitHub kao jedan PR ka `main` (pregled, CI). Pre slanja odlučiti kako se
   sprečava Vercel Preview build grane (npr. `git.deploymentEnabled` u
   `vercel.json` ili podešavanje projekta). Spajanje je vaša odluka.
2. **Projekat u timu firme:** Import repozitorijuma → framework Next.js,
   build `npm run build`, Node 22+, region funkcija **fra1**.
3. **Baza (Marketplace u timu):** kreirati bazu u Frankfurtu; Production i
   Preview dobijaju **odvojene** baze/grane. Uključiti backup/PITR po izboru iz A5.
4. **Role u bazi** (`10-db-roles-runbook.md`): vlasnik šeme za migracije
   (`MIGRATION_DATABASE_URL`, direktan URL) i runtime rola `carsystem_app`
   (`DATABASE_URL`, pooled) iz `db/provisioning/runtime-role.sql`.
5. **Promenljive** po tabeli `28-…` A4 — sve funkcije isključene,
   `MAINTENANCE_MODE=true` + `SITE_ACCESS_PASSWORD`, `NEXT_PUBLIC_SEO_INDEXING=false` (kod gleda samo doslovno `false`; `0` NE isključuje indeksiranje),
   `AUTH_URL`/`NEXT_PUBLIC_SITE_URL` = `*.vercel.app` adresa dok domen ne pređe.
6. **Migracije 0000–0032** sa lokalnog računara nad praznom bazom:
   `MIGRATION_DATABASE_URL=… npm run db:migrate`, zatim runtime rola, zatim
   prvi nalog Vlasnika po `33-test-baza-runbook.md` §5 (lozinku kuca sam
   Vlasnik, skriveno; zatim dozvola za vezivanje drugog faktora).
7. **Prvi deploy** (zaključan). Provere iz `28-…` A6 na `*.vercel.app`:
   prijava gazde + drugi faktor, runtime rola bez brisanja traga, zaglavlja
   (`29-…`), `qa:pg` nad Preview bazom.
8. **Kontakt podaci (A9)** — ✅ urađeno u kodu (2026-10-01); stiže sa granom.
9. **Domen (poslednje):** dodati domen u projekat firme, DNS zapise kod
   Burina.net po uputstvu Vercela, **bez diranja MX zapisa**; zatim
   `AUTH_URL`/`NEXT_PUBLIC_SITE_URL` na produkcioni domen. Stari projekat na
   ličnom nalogu ostaje dok domen ne pređe; njegovo uklanjanje je posebna odluka.
10. **Lansiranje** (posebna odluka): `MAINTENANCE_MODE=false`,
    ukloniti `NEXT_PUBLIC_SEO_INDEXING` (ili vrednost različita od `false`), zatim funkcije jedna po jedna (nalozi kupaca,
    preporuke, uvoz sa uređaja…), kako budu stizali podaci.
