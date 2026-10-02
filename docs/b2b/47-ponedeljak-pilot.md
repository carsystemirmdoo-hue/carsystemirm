# 47 — Ponedeljak: pilot, prvi talas i predlozi za razgovor

**Status (2026-10-02): priprema završena do granice koja traži Aleksandra ili
kancelariju. Neon pilot je prazan; nema deploymenta, promene naplate ni
stvarnog poručivanja.** Uputstvo korak po korak: [43 §2](43-prvi-talas-uputstvo.md).

## 1. Spremno

| Šta | Gde |
|---|---|
| Pilot baza (Neon Free, Frankfurt): migrirana, prazna, ograničena uloga; rezervna kopija i proba vraćanja | Neon `carsystem-pilot`, `~/.carsystem-private/rezervne-kopije/` |
| Prvi talas (januar 2025, 136 računa): manifest, fascikla sa proverenim otiscima, zbirovi izvedeni iz arhive | `~/.carsystem-private/talas-01-*`, `talasi/2025-01/` |
| Predlog 68 veza kupaca + jednostavan list za kancelariju i povratak u pregledanu tabelu | `veze-talas-01.csv`, `kancelarija-veze-talas-01.csv`, `scripts/ops/office-link-sheet.mts` |
| Ekran za veze (`/portal/kupci/veze`): primena samo uz svež drugi faktor (10 min) — provereno u pregledaču | [44 §2](44-lokalni-prikaz-kupca-i-provera-veza.md) |
| Konektor 0.2.0 (Mac keychain; Windows paket) + `SHA256SUMS.txt`; probni prolaz bez mreže nad talasom | `~/.carsystem-private/paketi/`, [42](42-uvoz-sa-maca-i-windows-konektor.md) |
| Kontrole talasa `wave-control pre/posle`, `pilot-backup.sh dump/verify` | `scripts/ops/` |
| Kartica kupca: R1 kao početni redosled, poređenje sa dosadašnjim, slabiji signali odvojeno; ispravljen zaključan skrol posle filtera | [45](45-predlozi-za-razgovor-i-filter.md), [46](46-provera-r1-nad-arhivom.md) |
| Provera redosleda nad bazom posle uvoza (samo čitanje, zbirno): `scripts/ops/ranking-check.mts --kraj …` | ovaj dokument §4 |
| Lokalni prikaz jednog kupca za pregled (stalni klaster, `pokreni.sh`) | [44 §7](44-lokalni-prikaz-kupca-i-provera-veza.md) |
| Kod: PR grana `integration/portal-release-2026-10` (draft PR #1), Vercel ne pravi deployment za `integration/**` | GitHub |

## 2. Kancelarija potvrđuje

1. **68 predloga veza** — u listu: „Potvrđujem DA/NE" i ime osobe koja je
   proverila u BizniSoft-u. Bez potvrđene veze kupac ne ulazi u uvoz ni u
   predloge.
2. **BizniSoft zbir za januar 2025.** — broj računa, neto, PDV, bruto i snimak
   ekrana ([40 §3](40-pilot-priprema-rabati-i-nalozi.md)). To je jedina nezavisna kontrola;
   naši zbirovi su iz iste PDF arhive.
3. **Komercijalisti:** koja BizniSoft šifra komercijaliste pripada kojoj osobi
   i ko od njih treba nalog u pilotu. Bez toga komercijalista u pilotu ne vidi
   nijednog kupca (vlasnik i kancelarija vide sve).
4. **Stalna ulazna fascikla** za nove račune i ko ih kopira ([43 §3](43-prvi-talas-uputstvo.md)).
5. Kasnije, pre šire upotrebe predloga: pravila za **storna i sporne
   revizije** (28 storna, 12 parova istog broja sa različitim sadržajem) i
   **šifarnik artikala sa grupama** (sada se na svakom predlogu piše „grupa nije
   potvrđena").

## 3. Aleksandar lično (ponedeljak)

1. Postavlja **svoju** lozinku za nalog Vlasnika u pilotu i vezuje drugi faktor;
   kodove za oporavak čuva van računara. Niko drugi to ne radi umesto njega.
2. Registruje i aktivira uređaj **`MAC-ARHIVA`** (`biznisoft` / `CSRM`) uz
   potvrdu otiska ključa.
3. Primenjuje pregledane veze na `/portal/kupci/veze` u roku od 10 minuta od
   potvrde drugog faktora — ili određuje osobu sa paketom „mapiranja".
4. Odlučuje ko dobija naloge (kancelarija, komercijalisti); pozive šalje portal,
   ne mi.

## 4. Posle prvog talasa (isti dan)

1. `wave-control posle` sa BizniSoft zbirom → sve ✔; zatim `pilot-backup.sh dump`.
2. Lokalni pilot server sa preporukama **samo za tu sesiju**:
   `FEATURE_RECOMMENDATIONS=1` uz ostala podešavanja iz
   `~/.carsystem-secrets/pilot/local-build.env` (fajl se ne menja), pa
   „Preračunajte preporuke" na `/portal/preporuke` (podrazumevani dan je današnji).
3. **Očekivanje:** posle samo januara 2025. kartice će uglavnom pisati
   „premalo istorije" — ritam traži više meseci. R1 počinje da ima smisla posle
   više talasa; `ranking-check.mts --kraj <poslednji potpuni dan>` pokrenuti
   kad je uvezena cela arhiva i uporediti sa [46](46-provera-r1-nad-arhivom.md).
   Ako smer nije isti, R1 ostaje iza prekidača.

## 5. Generalna proba talasa 01 (2026-10-02, lokalno — urađena)

Posebna privremena baza i server (`127.0.0.1:3421`), lokalni test nalozi sa
drugim faktorom, privremeni keychain; posle probe sve uklonjeno. Neon pilot i
lokalni prikaz (3420/55434) nisu dirani. Veze su primenjene nad **kopijom**
tabele; originalna tabela i list za kancelariju su nepromenjeni (otisak isti).

| Korak | Ishod |
|---|---|
| veze (Vlasnik, svež drugi faktor): „Proverite" pa „Primenite" | 68 / 68 povezano |
| `wave-control pre` | 7 / 7 ✔ |
| registracija i aktivacija uređaja kroz portal | uspelo **tek posle ispravki 1 i 2** |
| slanje (posle ispravke 3) | 136 / 136 knjiženo, 0 za pregled, 0 odbijeno |
| `wave-control posle` | 136/136 dokumenata, **895 stavki**, neto i bruto na paru prema manifestu; ✖ samo „BizniSoft zbir nije dostavljen" |
| `posle` sa zbirom iz manifesta (samo probni podatak) | sve ✔ — nezavisna BizniSoft potvrda ostaje obaveza kancelarije |
| ponovno slanje istim stanjem konektora | 0 poslato |
| ponovno slanje sa praznim stanjem (sve 136) | 136 × `duplicate_file`; faktura, stavki, dokumenata i kupaca isto |
| obračun preporuka | 843 para: 795 jedna kupovina, 46 privremeno, 2 „uspavano" — očekivano posle jednog meseca |

**Ispravljeno na probi (sva tri bi zaustavila ponedeljak):**

1. Registracija uređaja je odbijala javni ključ koji `connector init` ispisuje
   (Ed25519 SPKI, 60 znakova) — provera je tražila sirov ključ od 44 znaka.
2. Aktivacija i opoziv su tražili UUID uređaja koji se nigde ne prikazuje —
   sada se uređaj bira sa liste.
3. Svaki zahtev autentifikovanog uređaja trošio je i brojač nepoznatih
   pozivalaca (20 / 5 min, blokada 15 min) — posle 20 računa konektor je
   stajao. Sada se brojač nepoznatih proverava pre posla, a uvećava samo za
   zahtev koji ne prođe autentifikaciju; uređaj meri svoj brojač (600 / 5 min).
   Testovi: nepoznat pozivalac i dalje biva zaustavljen, uređaj ne troši
   brojač nepoznatih, a sopstveno ograničenje uređaja važi tačno od 601. zahteva.

## 6. Prepreke i napomene za ponedeljak

- **Lokalni server za pilot mora biti napravljen iz commita sa ovim
  ispravkama** (`next build` pre pokretanja na 3419), uz
  `FEATURE_SYNC_DEVICE_INGEST=1` i `FEATURE_PARTNER_REGISTRY=1` samo za tu sesiju.
- **Konektor na Mac-u se pokreće preko `node`**, ne `connector.sh` — tačna
  komanda u [42 §2](42-uvoz-sa-maca-i-windows-konektor.md).
- Stavka sa privremenom greškom čeka **sledeći radni dan 9:00**; ako talas mora
  da se završi isti dan — premestiti `queue.db` i ponovo `run-once` (server
  vraća `duplicate_file` za već uvezeno).
- Fascikla stanja konektora (`~/.carsystem-private/konektor-mac`) mora biti
  700: `queue.db` sadrži tela dokumenata, a konektor ga pravi sa pravima 644.
- `wave-control pre` upisuje stanje pored manifesta; za ponedeljak to je
  `~/.carsystem-private/talas-01-2025-01-kontrola-pre.json` (stari fajl se
  zamenjuje — očekivano).
- Talas se ne prihvata bez BizniSoft zbira od kancelarije (§2.2).

## 7. Nije odobreno / čeka odluku

- Vercel plan i objava pilota (preduslov za Windows konektor).
- Prepisivanje Git istorije (cena u 4fd2b09, LAN adresa u 35d1c05) — nije
  odobreno.
