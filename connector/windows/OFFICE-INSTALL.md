# Kancelarijska produkciona instalacija konektora

**Ovo NIJE kućni/smoke test.** Za lažne PDF-ove u posebnom folderu, bez
pravog BizniSoft-a, koristi [`connector/smoke/START-HERE.md`](../smoke/START-HERE.md)
— i uradi taj prolaz PRVI, uvek pre ovog dokumenta.

Ovaj dokument je za **stvarno puštanje u rad na kancelarijskom računaru**, sa
pravim BizniSoft izvozom faktura. Razdvojen je od smoke uputstva namerno: koraci
ovde menjaju NTFS dozvole, prave trajni Task Scheduler zadatak i dotiču pravi
BizniSoft folder — smoke prolaz ništa od toga ne radi.

**Ne pokreći ovo dok ChatGPT/vlasnik ne odobri prelazak sa smoke-a na pravu
instalaciju**, i dok `DB-01` (razdvajanje DB naloga) nije zatvoreno — vidi
poslednji bezbednosni izveštaj.

**Status ovog toka: code-reviewed, NIJE operativno potvrđen.** Sve skripte
ispod su strukturno i statički testirane na macOS-u (bez `pwsh`), ali
NIJEDNA nije stvarno izvršena na Windows-u u ovom krugu. Prvi stvarni test
mora biti na kućnom Windows 11 smoke-u (`-Mode Smoke`), ne direktno ovde.

---

## 0. Preduslovi

- Smoke prolaz (START-HERE.md) je završen sa `SMOKE PASS`.
- Postoji **poseban Windows nalog** za konektor — NIJE administrator, NIJE
  isti nalog kojim se instalacija radi. Ova skripta taj nalog NE PRAVI i NE
  bira — operater ga unapred otvara (Local Users and Groups, ili domenski
  nalog), kao standardan (Standard User) nalog.
- Node 24 LTS je instaliran sa <https://nodejs.org/> (zvanični Windows x64
  installer) — u `C:\Program Files\nodejs\`, ne preko per-user instalera
  (nvm-windows i sl.) koji piše u korisnički folder.
- Paket (`connector/dist/` + `connector/windows/*.ps1`) je prenet na
  kancelarijski računar i **integritet je proveren** — vidi §1.

## 1. Integritet prenosa

Build ovog paketa (`npm run connector:build`) trenutno **ne generiše
sopstveni potpisan SHA-256** finalnog paketa. Sledeći postupak je
determinističan i koristi ISKLJUČIVO alate koji već postoje na oba sistema —
bez nove zavisnosti i bez privatnog ključa.

**Na mašini gde se pakuje** (posle `npm run connector:build`, sa
`connector/dist/` i `connector/windows/*.ps1` spakovanim u JEDAN ZIP):

```bash
shasum -a 256 carsystem-connector-<verzija>.zip
```

Zapamćeni heš **pošalji operateru ODVOJENIM kanalom** od samog ZIP-a (drugi
chat, email, itd.) — isti obrazac kao `WINDOWS-HANDOFF-<shortHead>.md` u smoke
toku, koji takođe putuje POKRAJ arhive, ne unutar nje.

**Na Windows računaru**, PRE raspakivanja:

```
certutil -hashfile carsystem-connector-<verzija>.zip SHA256
```

ili, ako je PowerShell 5.1+ dostupan:

```powershell
Get-FileHash -Algorithm SHA256 carsystem-connector-<verzija>.zip
```

Heš mora biti **identičan** onom koji je stigao odvojenim kanalom. Ako se ne
poklapa — **ne raspakuj i ne pokreći ništa iz tog ZIP-a.**

**Šta ovo dokazuje, a šta ne:**
- Otkriva slučajnu izmenu ili grešku prenosa (prekinut upload, oštećen USB).
- **NIJE kriptografski dokaz izdavača.** Heš koji putuje ZAJEDNO sa izmenjenim
  paketom (npr. oba na istom kompromitovanom USB-u) ne dokazuje ništa — otuda
  zahtev da putuje ODVOJENIM kanalom.
- **Ovo NIJE code signing.** Prava zaštita POSLE instalacije dolazi iz
  admin-only write ACL-a na instalacionom folderu (§4), ne iz ovog heša —
  heš štiti samo trenutak prenosa, ne trajno stanje na disku.
- Ažuriranje konektora **mora biti eksplicitna administratorska radnja**
  (ponovi §1–§5 sa novim paketom). Server ne šalje i ne pokreće nikakav
  automatski update — potvrđeno u bezbednosnom auditu (nema mehanizma u kodu).

## 2. Raspakivanje — GDE, ne kako

Podrazumevana i preporučena putanja:

```
C:\Program Files\CarsystemConnector\
```

Raspakuj **ceo sadržaj** (`dist/` + `windows/*.ps1`) tu, tako da
`C:\Program Files\CarsystemConnector\connector.cmd` i
`C:\Program Files\CarsystemConnector\windows\task.ps1` oba postoje.

**Zabranjeno** (skripte u §4 ovo same odbijaju, ali proveri i ručno):

- Desktop, Downloads, Documents, OneDrive — bilo čiji, uključujući admin nalog;
- `%TEMP%`, `%APPDATA%`, `%LOCALAPPDATA%`;
- mrežna/UNC putanja;
- koren diska (`C:\`) ili ceo `C:\Program Files` bez podfoldera;
- symlink/junction/reparse-point umesto pravog foldera.

Raspakivanje u `Program Files` traži administratorska prava — to je i
namerno: obično kreiranje foldera tu je prva prepreka slučajnoj instalaciji na
pogrešnom mestu.

## 3. Config.json — U INSTALACIONI folder, NE u folder stanja

**Ovo je razlika od kućnog smoke toka i od podrazumevanog ponašanja
opisanog u `README.md`.** Podrazumevano, konektor traži `config.json` u
folderu stanja (`%LOCALAPPDATA%\CarsystemConnector\`) — folder koji
`RunAsAccount` MORA moći da piše (drži ključ i red). Da `serverOrigin` i
`izvorniFolder` ne bi bili upisivi istom nalogu koji svakodnevno pokreće
konektor, Production stavlja `config.json` u instalacioni (package) folder
umesto toga — folder koji je posle §4 admin-write-only.

Kao administrator, PRE ili POSLE §4 (Administrators zadržavaju FullControl
u oba slučaja):

```powershell
notepad 'C:\Program Files\CarsystemConnector\config.json'
```

Sadržaj — isti oblik kao u `README.md`, popunjen stvarnim vrednostima:

```json
{
  "serverOrigin": "https://portal.primer.rs",
  "deviceCode": "office-pc-01",
  "keyId": "k1",
  "sourceSystem": "biznisoft",
  "issuerCode": "QA01",
  "izvorniFolder": "C:\\BizniSoft\\Izvoz\\Fakture"
}
```

`task.ps1 -Mode Production` PROVERAVA da `config.json` postoji tačno na
`<instalacioni folder>\config.json` i ODBIJA registraciju ako ga nema —
nema podrazumevane vrednosti, nema tihog pada na folder stanja. Zadatak se
pokreće sa `--config "<instalacioni folder>\config.json"`, koje
`bin/connector.mjs` prevodi u `CS_CONNECTOR_CONFIG` PRE nego što bilo šta
drugo pročita konfiguraciju.

## 4. Učvršćivanje instalacionog foldera — `harden-install-dir.ps1`

**Administratorski PowerShell** (desni klik → "Run as Administrator"):

```powershell
cd 'C:\Program Files\CarsystemConnector\windows'

# 1. Dry-run — PROČITAJ izveštaj pre bilo čega.
.\harden-install-dir.ps1 -PackagePath 'C:\Program Files\CarsystemConnector' -RunAsAccount 'RACUNAR\konektor'

# 2. Stvarna primena — tek kad dry-run izveštaj ima smisla.
.\harden-install-dir.ps1 -PackagePath 'C:\Program Files\CarsystemConnector' -RunAsAccount 'RACUNAR\konektor' -Apply
```

Zameni `RACUNAR\konektor` stvarnim nazivom naloga iz §0.

**Očekivan ishod (`-Apply`):**
- `[PASS]` na svim proverama putanje, naloga i post-verifikaciji.
- Rezervna kopija prethodnog ACL-a zapisana u
  `C:\ProgramData\CarsystemConnector\install-acl-backup\` — ta putanja ostaje
  zapisana u izlazu, zapamti je za rollback (§8).

Ako bilo šta ispiše `[FAIL]`, **ne nastavljaj** — skripta sama pokušava
vraćanje prethodnog ACL-a i objašnjava zašto je stala.

Posle ovoga, `RunAsAccount` ima SAMO `ReadAndExecute` nad celim instalacionim
folderom — uključujući `config.json` iz §3. To je namerno: čitanje mu treba,
pisanje ne.

## 5. Folder stanja (ključ, lokalni red) — OBAVEZAN pre §6

```powershell
.\harden-state-dir.ps1 -Apply
```

Pokreni ovo **prijavljen kao `RunAsAccount`** (isti nalog kao zadatak) —
DPAPI `CurrentUser` ključ je vezan za taj nalog, pa i ACL folder stanja mora
biti postavljen dok si prijavljen kao on. `task.ps1 -Mode Production` ovo
proverava (`Test-StateDirHardened`) i ODBIJA registraciju ako nije urađeno —
ranije je ovaj korak bio samo preporučen, sada je blokirajući preduslov.

## 6. Least-privilege Task Scheduler — `task.ps1 -Mode Production`

**Preduslov: §3, §4 i §5 MORAJU već biti urađeni i PROŠLI.** `-Mode
Production` sam proverava sve troje i ODBIJA registraciju (baca grešku, ne
samo upozorava) ako paket ili folder stanja nisu učvršćeni, ako
`config.json` nedostaje u instalacionom folderu, ako je nalog
administrator/SYSTEM, ili ako Node nije u zaštićenoj lokaciji — nema
`-Force`/zaobilaznu opciju koja bi taj neuspeh pretvorila u upozorenje.

`-Mode` je OBAVEZAN. Bez njega se instalacija odbija pre bilo koje provere.
`Production` i kućni/smoke tok (`-Mode Smoke`, vidi
[`smoke/START-HERE.md`](../smoke/START-HERE.md)) registruju **različita
imena zadatka** (`CarsystemConnector` naspram `CarsystemConnectorSMOKE`) —
fizički ne mogu zameniti jedan drugog.

I dalje kao administrator, ili kao nalog iz §0 (principal u zadatku je uvek
`-RunAsAccount`, ne nalog koji instalira):

```powershell
# Dry-run prvo — Production provere se izvršavaju i ovde, i PUCAJU na prvi neuspeh.
.\task.ps1 -Action install -Mode Production -PackagePath 'C:\Program Files\CarsystemConnector' -RunAsAccount 'RACUNAR\konektor'

# Stvarna registracija.
.\task.ps1 -Action install -Mode Production -PackagePath 'C:\Program Files\CarsystemConnector' -RunAsAccount 'RACUNAR\konektor' -Apply
```

Akcija zadatka poziva **`node.exe` DIREKTNO** — apsolutna, PROVERENA Node
putanja kao izvršni, apsolutni entry point (`connector\bin\connector.mjs`)
unutar instalacionog foldera i `--config <instalacioni folder>\config.json`
kao argumenti, taj isti folder kao radni direktorijum. **Nema posrednog
`.cmd`/`.ps1` launchera u folderu stanja** — raniji nacrt je takav fajl
generisao pravo u `%LOCALAPPDATA%\CarsystemConnector\`, folderu koji
`RunAsAccount` mora imati pravo da piše (drži ključ i red), što je značilo
da bi kompromitovan proces POD ISTIM nalogom mogao da izmeni šta se sledeći
put izvršava, bez ikakve eskalacije. Ispravka to uklanja u celosti — vidi
izvorni komentar u `task.ps1` uz `New-ScheduledTaskAction`.

Ako je izlaz javio da Node NIJE u `Program Files` (npr. nvm-windows),
**vrati se na §0** i instaliraj zvanični Node pre nego što nastaviš —
`Production` to odbija, ne samo upozorava.

Proveri:

```powershell
.\task.ps1 -Action status -Mode Production
```

`Nalog` u izlazu mora biti tačno `RunAsAccount` iz §0 — **ne** administratorski
nalog kojim si instalirao. `Izvrsni` mora biti apsolutna `node.exe` putanja,
ne `.cmd`/`.ps1` fajl.

## 7. Provera BizniSoft foldera — READ-ONLY, bez izuzetka

```powershell
.\verify-invoice-folder.ps1 -InvoiceFolder 'C:\BizniSoft\Izvoz\Fakture' -RunAsAccount 'RACUNAR\konektor' -PackagePath 'C:\Program Files\CarsystemConnector'
```

Ova skripta **nema `-ProbeWrite` ni bilo koju opciju koja piše** u prosleđeni
folder — ranija verzija je imala opcioni probni upis nad sentinel fajlom;
uklonjen je u potpunosti, jer je nudio način da se piše u PRAVI BizniSoft
folder ako bi neko slučajno pozvao `-ProbeWrite` u produkciji. Provera je
isključivo `Get-Acl` + razrešavanje naloga/grupa preko .NET API-ja.

Kada članstvo u nekoj grupi iz ACL-a ne može pouzdano da se proveri
(domenska grupa bez AD modula, npr.), izlaz je:

```
[FAIL] NOT VERIFIED / FAIL-CLOSED — ...
```

To je OČEKIVAN, bezbedan ishod — ne pokušaj upisa, nego priznanje da ACL
inspekcija sama nije dovoljna. Rešenje je ručna provera tog članstva
(`Get-LocalGroupMember` ili domenski alat), ne pokretanje probnog upisa nad
pravim folderom.

Probni upis nad DISPOSABLE (jednokratnim, test-only) folderom postoji
isključivo kao Windows test u
`connector/test/windows-install-hardening.test.mjs` — pravi se, koristi i
briše u samom testu, nikad ne prihvata proizvoljnu putanju i nikad se ne
pokreće nad pravim BizniSoft folderom.

**Ako bilo šta ispiše `[FAIL]`** — folder NIJE spreman. Ne podešavaj
`izvorniFolder` u `config.json` (§3) dok se ne reši (obično: promeni NTFS
dozvolu na BizniSoft folderu tako da `RunAsAccount` ima SAMO čitanje).

## 8. Rollback

**ACL instalacionog foldera:**

```powershell
$sddl = Get-Content 'C:\ProgramData\CarsystemConnector\install-acl-backup\<fajl-iz-koraka-4>.sddl.txt' -Raw
$acl = Get-Acl 'C:\Program Files\CarsystemConnector'
$acl.SetSecurityDescriptorSddlForm($sddl)
Set-Acl 'C:\Program Files\CarsystemConnector' -AclObject $acl
```

**Task Scheduler zadatak:**

```powershell
.\task.ps1 -Action uninstall -Mode Production -Apply
```

Ne briše PDF-ove, ključ ni lokalni red — samo autostart.

**Folder stanja** nema poseban rollback (ranije stanje je "podrazumevane
NTFS dozvole nasleđene od roditelja") — ako treba, `icacls <folder> /reset`
vraća nasleđivanje.

## 9. Šta operater mora ručno potvrditi (ne automatizuje se ovim skriptama)

- Da je nalog iz §0 STVARNO standardan, ne administrator — `harden-install-dir.ps1`
  ovo proverava i ODBIJA ako nije, ali odluku KOJI nalog koristiti donosi
  operater unapred.
- Da Windows Firewall nema NIJEDNO inbound pravilo za `node.exe` ili
  `connector.cmd` — konektoru ne treba nijedno; ako postoji, obriši ga.
  Connector kod nikad ne otvara listener (potvrđeno u auditu), pa svako
  inbound pravilo za njega je ili ostatak, ili znak da nešto drugo treba
  istražiti.
- Da je BitLocker (ili ekvivalentna enkripcija diska) uključen, ako je
  dostupan — van dometa ovih skripti.
- Da je Windows Update aktivan.

## 10. Bezbednosne granice koje OSTAJU, i posle svega ovoga

- **DPAPI `CurrentUser` ne štiti ako je NALOG konektora već kompromitovan.**
  Malver koji dobije izvršavanje POD ISTIM nalogom (`RunAsAccount`) može
  pozvati konektor i pročitati/potpisati sve što taj nalog sme — ACL
  hardening iz ovog dokumenta štiti od DRUGIH naloga i od slučajne izmene
  koda, ne od kompromitovanog SAMOG naloga.
- **Kompromitovan administratorski ili SYSTEM nalog na ovom računaru ostaje
  van mogućnosti da spreči connector kod** — Administrators/SYSTEM uvek imaju
  FullControl nad instalacionim folderom (moraju, radi održavanja), pa admin
  kompromis na ovoj mašini nije nešto što softverski ACL može sprečiti. Ovo je
  granica cele arhitekture, ne propust ovog paketa — jedina odbrana je da se
  administratorski/SYSTEM pristup ovom računaru štiti van dometa connector
  koda (fizička bezbednost, ograničen broj admin naloga, MFA na Windows
  prijavi ako je dostupno).
- Server-side kompromis (portal, baza) i dalje ne može poslati proizvoljnu
  komandu, putanju ili kod konektoru — to je nezavisno dokazano u bezbednosnom
  auditu i ova izmena to ne menja.
- **`config.json` je od ove ispravke admin-write-only (§3+§4)** —
  `RunAsAccount` ima samo `ReadAndExecute` nad njim, isto kao nad ostatkom
  instalacionog foldera. Ovo zatvara raniji nalaz da su `serverOrigin` i
  `izvorniFolder` bili upisivi istom nalogu koji svakodnevno pokreće
  konektor. Ostaje otvoreno: `Smoke` tok i dalje koristi podrazumevanu
  putanju u folderu stanja (upisivu za `RunAsAccount`) — to je prihvatljivo
  ZA SMOKE, jer smoke po definiciji ne dotiče pravi BizniSoft folder ni pravi
  server origin.
