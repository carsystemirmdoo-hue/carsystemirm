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
