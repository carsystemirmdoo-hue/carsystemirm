# 50 — DPAPI bez PowerShell-a: nativni modul `@primno/dpapi`

**Status (2026-10-07): uvedeno u grani `feat/konektor-dpapi-nativni` (konektor
0.3.5). Na Mac-u proverena logika, format i rukovanje greškama. Windows test
uz uključen Avast još nije urađen.**
Prethodno: [49](49-windows-konektor-0-3-0.md).

## 1. Zašto

Avast Behavior Shield na kancelarijskom računaru blokira DPAPI kroz PowerShell
u oba oblika: `-EncodedCommand` (IDP.HELU.PSE92) i čitljiv `-File` skript
(IDP.HELU.PSD11). Heuristika prepoznaje obrazac „PowerShell + ProtectedData“,
pa ga nijedna promena skripte ne rešava. Izuzetak u Avast-u se ne uvodi.

Konektor sada sam poziva `CryptProtectData` / `CryptUnprotectData` iz
`crypt32.dll`, kroz N-API modul, u procesu `node.exe`. PowerShell se za ključ
ne pokreće, i nema procesa-deteta.

## 2. Pregled kandidata

| Pitanje | Nalaz |
|---|---|
| Paket | `@primno/dpapi@2.0.1`, MIT, jedan održavalac, repo `github.com/primno/dpapi` |
| Integritet | sha512 i sha1 tarball-a jednaki vrednostima u npm registru |
| npm provenance | **nema** (paket nije objavljen sa atestacijom) |
| Izvor | `src/*.cpp`, `src/dpapi_addon.h`, `binding.gyp` iz paketa = tag `v2.0.1` na GitHub-u (razlika samo CRLF) |
| Šta kod radi | samo `CryptProtectData` / `CryptUnprotectData`, opis i prompt `null`, `LocalMachine` samo na izričit zahtev; rezultat se kopira, pa `LocalFree` |
| Binarni fajl | `prebuilds/win32-x64/@primno+dpapi.node`, PE32+ x64 DLL, 137 728 B, SHA-256 `386e7a52…6a3f` |
| Uvozi binarnog fajla | `KERNEL32.dll` (CRT/runtime) i `CRYPT32.dll` (`CryptProtectData`, `CryptUnprotectData`); nema mreže, registra ni pokretanja procesa |
| Izvoz | samo `napi_register_module_v1` |
| Poreklo build-a | PDB putanja `D:\a\dpapi\dpapi\build\Release\dpapi.pdb` = GitHub Actions Windows runner; vreme linkovanja 2025-01-12 ~11:11 UTC, oko 9 min posle izdanja `v2.0.1` (11:02 UTC); `publish.yml` gradi `prebuildify --napi` na `windows-latest` i objavljuje na npm |
| Ograničenje porekla | logovi CI-ja više ne postoje (zadržavanje je isteklo), a MSVC build nije bit-po-bit ponovljiv: poreklo je **posredno**, ne kriptografski dokazano |
| Node 24 | N-API (ABI-stabilan, bez vezivanja za verziju Node-a); `node-addon-api` funkcije postoje u Node 24 |

Zaključak: kandidat je prihvaćen uz ublažavanje rizika porekla:

- fajl je u repozitorijumu, a SHA-256 je u kodu;
- izmenjen fajl se odbija pre učitavanja;
- nema npm instalacije ni instalacionih skripti.

## 3. Šta je uvedeno

- `connector/src/keystore/native/dpapi-win32-x64.node` + `LICENSE-primno-dpapi.txt`.
- `windows-dpapi.mjs` radi ovim redom:
  1. Proverava da je platforma `win32` i arhitektura `x64`.
  2. Proverava SHA-256 modula (`dpapi_native_altered`).
  3. Učitava modul sa `process.dlopen`.
  4. Poziva DPAPI sa opsegom `CurrentUser` i entropijom `null`.
- Ulaz se kopira i posle poziva briše.
- **Format fajla ključa nepromenjen:** `cs-dpapi-v1\n<base64 DPAPI bloba>\n`.
  Blob koji je napravio .NET `ProtectedData.Protect` je standardan DPAPI blob
  i otključava ga `CryptUnprotectData`. Postojeći ključ se ne pravi ponovo.
- Greške su samo kodovi; poruka modula se ne prosleđuje:
  - `dpapi_native_unsupported|missing|altered|load_failed|invalid`;
  - `dpapi_key_file_invalid`;
  - `dpapi_protect_failed[_hex]`;
  - `dpapi_unprotect_failed[_hex]`, na primer `_8009000b` za ključ drugog naloga;
  - `dpapi_*_empty`;
  - `dpapi_roundtrip_mismatch`.
- `windows-dpapi.ps1` je uklonjen. Nema rezervnog PowerShell puta.
- Dijagnostika:
  - D04 = učitavanje modula;
  - D05 = izmenjen blob se odbija kodom;
  - D06/D08 = zastiti → otkljucaj kroz adapter.

  D01–D03 i D07 i dalje mere PowerShell okruženje (za instalacione skripte i zadatak).

## 4. Provere na Mac-u

- `connector:test`: 241 prošlo, 0 palo, 40 `[WIN]` preskočeno.
- Jedinični testovi kanala (lažan `dlopen` i lažno vezivanje) pokrivaju:
  - platformu i arhitekturu;
  - nedostajući ili izmenjen modul (bez učitavanja);
  - neuspeo `dlopen`;
  - opseg i entropiju;
  - mapiranje Windows koda;
  - prazan izlaz;
  - format;
  - čitanje POSTOJEĆEG fajla bez izmene;
  - odsustvo `child_process`/PowerShell-a u adapteru.

## 5. Windows test (Avast uključen) — redosled

Ništa od ovoga ne aktivira uređaj, ne registruje zadatak i ne šalje fakture.

1. **Pre ažuriranja:** zabeležiti heš postojećeg ključa (fajl je šifrovan; heš
   ne otkriva ništa):
   `Get-FileHash "$env:LOCALAPPDATA\CarsystemConnector\device-key.bin" -Algorithm SHA256`.
2. **Smoke paket:** raspakovati u putanju sa razmakom i ČĆŽŠĐ, `Unblock-File`,
   `RUN-SMOKE.cmd`. Očekivano:
   - `[WIN]` testovi DPAPI (nativni modul) prolaze;
   - D04/D05/D06/D08 su OK;
   - Avast ne prijavljuje ništa.
3. **Ažuriranje** (administratorski prozor):
   `instaliraj.ps1 -JedanNalogSaUAC`, bez `-IzvorniFolder`/`-ServerOrigin`.
   `config.json`, ključ i red se čuvaju.
4. **Dokaz da se postojeći ključ otključava:**
   - `connector.mjs --packaged --config … export-key` vraća `fingerprint`
     jednak otisku koji je ranije ispisao `podesi.ps1`;
   - heš `device-key.bin` je jednak onom iz koraka 1.

   Jednak heš znači da fajl nije prepisan. Ispravan otisak znači da je nativni
   DPAPI otključao blob koji je napravio PowerShell.
5. `podesi.ps1 -JedanNalogSaUAC` staje na „Uređaj još nije aktiviran“ sa istim
   otiskom. Dalje (aktivacija `KANC-01`, prvo slanje, zadatak) samo uz posebno
   odobrenje.

## 6. Avast PSD11 na `task.ps1` (smoke d5e03d1) i proba zadatka (0.3.6)

**Nalaz.** Smoke d5e03d1 je dao PASS, a Avast je u 08:13:51 prijavio
IDP.HELU.PSD11 na `task.ps1`.

- `RUN-SMOKE` poziva `task.ps1` tri puta, svaki put kao
  `node` → `powershell -ExecutionPolicy Bypass -File`:
  - W13 (dry-run);
  - `[WIN]` dry-run test;
  - `[WIN]` test „bez -Mode".
- Sva tri su ispisala ono što test traži, pa skripta nije zaustavljena pre
  svog posla. Zadatak nije registrovan.
- Izveštaj nije imao vreme poziva, pa se prijava nije mogla povezati ni sa
  jednim pozivom.
- Test koji očekuje odbijanje prolazio je i kad proces prekine neko drugi.

**Production dry-run** iz administratorskog PowerShell-a (instalirana 0.3.3,
`&` poziv, bez novog `powershell.exe`): 08:20:33–08:20:34. Sve stroge provere
su prošle, izlaz 0, bez registracije.

**Izmene:**

- **`connector/test/task-poziv.mjs`** — ocena poziva. Svaki poziv nosi vreme
  (HH:mm:ss), trajanje i izlazni kod. Prolazi samo uz tačan izlaz i oznaku koju
  piše sama skripta. Ostali ishodi su imenovani:
  - `task_script_blocked_or_killed`;
  - `task_script_blocked_by_antivirus`;
  - `task_script_blocked_by_policy`;
  - `task_script_wrong_exit`;
  - `task_script_marker_missing`.
- **Gde se koristi:**
  - W13 i dva `[WIN]` testa (vreme ide u TAP dijagnostiku);
  - negativni `[WIN]` testovi u `windows-install-hardening.test.mjs` (umesto
    golog `assert.throws`).
- **`windows/proba-zadatka.ps1`** — zaseban zadatak `\Carsystem\CarsystemProba`:
  - bez okidača, `RunLevel Limited`, akcija `node.exe … --packaged --help`;
  - `Start-ScheduledTask`, pa provera da je `LastTaskResult` 0;
  - uklanjanje u `finally`.

  Ne pokreće novi PowerShell i ne dira pravi zadatak, ključ, konfiguraciju ni
  fakture. Ovo je dokaz registracije i izvršavanja kroz Task Scheduler uz
  uključen Avast.

## 7. `Get-ScheduledTask` vraća 0x80070002 (0.3.7)

**Nalaz (kancelarija, 0.3.6-880ba24):**

- Prošli su smoke (W13 08:32:03–08:32:05, izlaz 0), instalacija i ACL.
- Nativni DPAPI je otključao postojeći ključ: javni otisak i SHA-256 fajla
  ključa su isti kao pre.
- `proba-zadatka.ps1` nije prošla. `Get-ScheduledTask` (CIM/WMI) vraća
  HRESULT 0x80070002 i za opšte listanje. Uz `-ErrorAction SilentlyContinue`
  to je izgledalo kao „ne postoji", pa je proba pogrešno prijavila uklanjanje.
- Servis Schedule radi, i `schtasks.exe` radi:
  - zadatak je nađen, XML akcije je ispravan;
  - `/Run` je dao Last Result 0 u 08:41:49;
  - `/Delete` je uspeo i naknadni upit je potvrdio da zadatak ne postoji.

**Ispravka:**

- **`windows/Zadaci.ps1`** — stanje, pokretanje i uklanjanje kroz Task
  Scheduler COM (`Schedule.Service`), sa `schtasks.exe` kao nezavisnom
  potvrdom:
  - „ne postoji" se prijavljuje samo kada COM to određeno kaže (0x80070002 ili
    0x80070003 za folder ili zadatak) i `schtasks /Query` ne nađe zadatak;
  - ako `schtasks` nađe zadatak, rezultat je „postoji";
  - sve ostalo je izuzetak `zadatak_stanje_nepoznato`, nikad tiho „ne postoji";
  - `Remove-ZadatakCs` posle brisanja potvrđuje da zadatak više ne postoji;
  - registar i WMI se ne popravljaju.
- **`task.ps1`:**
  - `status` koristi `Get-ZadatakCs`;
  - posle `Register-ScheduledTask` registracija se potvrđuje kroz COM (akcija
    `node.exe`, `RunLevel Limited`);
  - `uninstall` koristi `Remove-ZadatakCs`;
  - nova akcija `-Action run` (`Start-ZadatakCs`) zamenjuje `Start-ScheduledTask`.
- **`provera.ps1`, `instaliraj.ps1`, `vrati-prethodnu.ps1`, `proba-zadatka.ps1`:**
  sve koriste `Zadaci.ps1`. Kada se stanje ne može utvrditi, `instaliraj` i
  `vrati-prethodnu` staju umesto da pretpostave da zadatak ne radi.
- **Smoke W13 i `[WIN]` testovi:** odsustvo zadatka proveravaju preko
  `schtasks.exe` iz Node-a, bez PowerShell-a i bez CIM-a.
- **Testovi:**
  - `zadaci-ps.test.mjs` proverava logiku sa lažnim COM servisom i lažnim
    `schtasks`-om (pwsh 7.6.6 na Mac-u);
  - statičko pravilo: nijedna `.ps1` skripta ne koristi `Get-ScheduledTask`,
    `Get-ScheduledTaskInfo`, `Start-ScheduledTask` ni `Unregister-ScheduledTask`.
