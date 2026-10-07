# 44 — Lokalni prikaz jednog kupca za komercijalistu i stvarna provera ekrana za veze

**Status (2026-10-02): obuhvat potvrđen i upisan SAMO u lokalnu bazu
(§3); ekran za veze proveren u pregledaču; server za pregled radi na
`127.0.0.1:3420`; nalazi pregleda u §6, dve greške prikaza ispravljene;
baza premeštena u stalni lokalni klaster (§1, §7).** Pilot (Neon) i njegovi
nalozi nisu menjani.

## 1. Lokalno okruženje

| Šta | Kako |
|---|---|
| Baza | `carsystem_lokalni_prikaz` u sopstvenom Postgres 17 klasteru `~/.carsystem-private/pg-lokalni-prikaz/data` (700), samo `127.0.0.1:55434`, bez unix soketa, prijava samo lozinkom (scram-sha-256), FileVault; migracije 0000–0032, `carsystem_app` + `runtime-role.sql`, provere prava ✔ (`preview-db.mts verify` uz `PREVIEW_DB_LOCAL_TEST=1`) |
| Rezervna kopija | `~/.carsystem-private/rezervne-kopije/lokalni-prikaz-2026-10-02-pre-premestanja.dump` (+ `.sha256`), napravljena sa zaustavljenim portalom; vraćanje provereno: sve 52 tabele imaju isti broj redova i isti otisak sadržaja, ista prava, objekti i sekvence |
| Tajne | `~/.carsystem-secrets/lokalni-prikaz/` (700/600), sopstveni ključevi, oznaka `DATASET_ROLE=lokalni-prikaz`; lozinka vlasnika klastera u `pg-owner.env` |
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

## 3. Obuhvat za stvaran kupac (potvrđen i upisan lokalno)

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

Posle završenog pregleda — briše bazu, pristupe i snimke:

```bash
bash ~/.carsystem-private/pg-lokalni-prikaz/zaustavi.sh
rm -rf ~/.carsystem-private/pg-lokalni-prikaz ~/.carsystem-secrets/lokalni-prikaz ~/.carsystem-private/lokalni-prikaz-*
rm -f ~/.carsystem-private/rezervne-kopije/lokalni-prikaz-*
rm -rf ~/carsystem-work/portal-integration/.next-verify
```

Stara kopija u privremenom klasteru sesije (port 55433) nije obrisana; nestaje
sa tim klasterom.

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

**Rezultat upisa (kroz portal kao lokalni Vlasnik):** veza mapirana i
potvrđena; 59 izvornih dokumenata, svih 59 knjiženo, nijedan na pregledu; 59
faktura (izdavalac `CSRM`); 515 stavki; neto, PDV i bruto jednaki manifestu na
paru; kupac dodeljen lokalnom komercijalisti. Komercijalista vidi svog kupca
(200), nedodeljenog ne vidi (403), u spisku kupaca ima samo svog.

## 6. Pregled kartice kupca — šta nedostaje ili nije pouzdano

| Nalaz | Ocena |
|---|---|
| Bez obračuna preporuka svi artikli stoje u grupi „premalo istorije (1–2 kupovine)" — iako više od polovine ima tri ili više kupovina | **ispravljeno**: artikal bez rezultata obračuna sa dve ili više kupovina je „Nije obračunato" (posebna grupa i oznaka sažetka); jedna kupovina ostaje „Nedovoljno istorije". U pregledaču, na klonu bez obračuna: 86 „nije obračunato", 36 sa jednom kupovinom; posle obračuna iste grupe kao ranije |
| Prvi obračun preporuka: polje „Na dan" je prazno i obavezno kada obračuna još nema, pa pregledač tiho blokira slanje | **ispravljeno**: pre prvog obračuna polje dobija današnji dan (Europe/Belgrade), posle toga dan poslednjeg obračuna; menja se slobodno. Prazno, nepostojeći datum, pogrešan oblik ili datum posle danas daju poruku ispod polja |
| Svaki artikal: „Katalog: nije povezano" | nedostaje veza artikal → katalog (nikad po nazivu; čeka šifarnik artikala) |
| „Predlozi za proširenje" nisu dostupni | traže ≥ 5 firmi sa potvrđenim kupovinama; lokalno je samo jedan stvaran kupac |
| Privremene procene (artikal kupljen dva puta) | označene kao privremene; nisu ritam |
| Dugovanja i uplate | izvor nije povezan — ekran to i kaže |
| Cene | kartica i „Za razgovor" ne prikazuju cene; „Prodaja" prikazuje iznose sa faktura kao istoriju dokumenata, ne kao cenovnik |
| Ritam kupca i artikala | iz datuma izdavanja potvrđenih računa; storna ovaj kupac nema |

## 7. Pristup za pregled

Posle restarta Mac-a (ili kada server nije pokrenut), u sopstvenom Terminal.app
prozoru — pokreće bazu i portal; Ctrl+C gasi portal:

```bash
bash ~/.carsystem-private/pg-lokalni-prikaz/pokreni.sh
```

Gašenje baze i portala: `bash ~/.carsystem-private/pg-lokalni-prikaz/zaustavi.sh`.

Server: `http://127.0.0.1:3420/prijava`. Pristup lokalnom test nalogu (u
sopstvenom Terminal.app prozoru):

```bash
cd ~/carsystem-work/portal-integration && CARSYSTEM_SECRETS_DIR=~/.carsystem-secrets/lokalni-prikaz npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/local-view-login.mts rep
```

(`owner` ili `office` umesto `rep` za druge uloge.) Lozinka ide u clipboard,
kod drugog faktora se ispisuje u terminalu. Baza i pristupi ostaju do kraja
pregleda; uklanjanje po §4.

