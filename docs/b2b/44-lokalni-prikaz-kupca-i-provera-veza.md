# 44 — Lokalni prikaz jednog kupca za komercijalistu i stvarna provera ekrana za veze

**Status (2026-10-02): lokalna baza, test nalozi i server spremni; ekran za
veze proveren u pregledaču; stvarni podaci kupca NISU upisani — čeka se
potvrda obuhvata (§3).** Pilot (Neon) i njegovi nalozi nisu menjani.

## 1. Lokalno okruženje

| Šta | Kako |
|---|---|
| Baza | `carsystem_lokalni_prikaz` na lokalnom Postgres 17 (127.0.0.1, samo ovaj Mac, FileVault); migracije 0000–0032, `carsystem_app` + `runtime-role.sql`, sve provere prava ✔ (`preview-db.mts all` uz `PREVIEW_DB_LOCAL_TEST=1`) |
| Tajne | `~/.carsystem-secrets/lokalni-prikaz/` (700/600), sopstveni ključevi, oznaka `DATASET_ROLE=lokalni-prikaz` |
| Nalozi | `scripts/ops/local-view-accounts.mts`: Vlasnik, kancelarija (bez „mapiranja"), komercijalista — svi sa drugim faktorom vezanim kroz servis; Vlasnik bez drugog faktora (za proveru) |
| Server | produkcioni build, `next start -H 127.0.0.1 -p 3420`, `PORTAL_MFA_MODE=enforced`; sluša samo na `127.0.0.1` (provereno) |

## 2. Ekran `/portal/kupci/veze` — stvarno ponašanje

`scripts/qa/local-veze-check.mts`, pravi pregledač, sintetički partneri
(PIB < 10.000.000), svaki ishod proveren i u bazi:

| Scenario | Rezultat |
|---|---|
| komercijalista (bez `mappings:manage`) | 403 |
| kancelarija bez paketa „mapiranja" | 403 |
| bez drugog faktora, bez dozvole za vezivanje | prijava odbijena |
| bez drugog faktora, sa dozvolom za vezivanje | sesija samo do `/portal/bezbednost/mfa`; ekran za veze se ne prikazuje |
| važeća sesija, „Proverite" | radi, ništa upisano |
| potvrda drugog faktora starija od 10 minuta, „Primenite" | 403, ništa upisano |
| važeća potvrda, bez izričite potvrde u formi | odbijeno porukom |
| važeća potvrda | kupci otvoreni i povezani; akter u tragu = prijavljeni korisnik |
| ponovna primena iste tabele | „zastarelo", bez duplikata |
| nov plan posle primene | „već povezano", bez radnje |

## 3. Predlog obuhvata za stvaran kupac (čeka potvrdu)

Kupac sa nedvosmislenim mapiranjem (šifra + PIB potvrđeni prema šifarniku,
nije blokiran, ima komercijalistu) i istorijom kroz šest godina, bez ijednog
storna ili revizije. Identitet je samo u privatnom fajlu
(`~/.carsystem-private/lokalni-prikaz-kupac.json`).

- **Dokumenti:** 59 računa-otpremnica, 515 stavki (2021: 3 · 2022: 5 ·
  2023: 6 · 2024: 14 · 2025: 19 · 2026: 12).
- **Upis, samo u lokalnu bazu, kroz postojeće servise i autorizaciju:**
  1. veza kupca: `/portal/kupci/veze` kao lokalni Vlasnik (svež drugi faktor),
     tabela sa jednim redom;
  2. računi: `/portal/importi`, upload 59 PDF-ova u dva slanja (≤ 50 fajlova,
     ≤ 4 MB), izdavalac `CSRM`;
  3. dodela kupca lokalnom komercijalisti na stranici kupca.
- **Provera:** 59 dokumenata, 59 faktura, 515 stavki, zbirovi jednaki
  manifestu tog kupca; komercijalista vidi tog kupca i njegove fakture, a
  kupca koji mu nije dodeljen ne vidi; kancelarija bez „mapiranja" ne menja
  veze. Snimci ekrana ostaju privatni.

## 4. Uklanjanje probne baze

```bash
pkill -f "next start -H 127.0.0.1 -p 3420"
/opt/homebrew/opt/postgresql@17/bin/psql -h 127.0.0.1 -p 55433 -U carsystem_qa -d postgres -c "DROP DATABASE carsystem_lokalni_prikaz"
rm -rf ~/.carsystem-secrets/lokalni-prikaz ~/.carsystem-private/lokalni-prikaz-*
rm -rf ~/carsystem-work/portal-integration/.next-verify
```

Lokalna baza već sadrži nekoliko sintetičkih kupaca iz provere u §2 (nazivi
„QA VEZE …"); nestaju sa bazom.

## 5. Pregled veza za kancelariju

`scripts/ops/office-link-sheet.mts napravi` pravi jednostavan list: firma,
PIB, **šifra kako je u BizniSoft-u**, mesto, broj računa u talasu,
„Potvrđujem (DA/NE)", „Napomena", „Proverio". `vrati` ga pretvara u pregledanu
tabelu za portal i zaustavlja se ako su firma, PIB ili šifra izmenjeni, ili
ako „DA" nema ime.

Zbirovi iz PDF manifesta su **izvedeni iz iste arhive** i nisu nezavisna
kontrola; nezavisna potvrda je samo BizniSoft izveštaj.
