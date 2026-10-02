# 42 — Uvoz istorijske arhive sa Mac-a i Windows konektor 0.2.0

**Status (2026-10-02): priprema; nema stvarnog uvoza, deploymenta ni promene
naplate.** Prethodno: [41](41-pilot-build-kontrole-i-prepreke.md).

## 1. Da li postojeći postupak podržava uvoz sa Mac-a

Da — kroz **postojeći ulaz za uređaje**: konektor na Mac-u čita fasciklu
talasa, parsira istim parserom (`biznisoft-pdf-2`), šalje potpisan canonical
dokument, a server ga proverava (`validateCanonicalInvoice`) i knjiži istim
servisom kao ručni upload (`ingestParsedDocument`). Trag revizije beleži
uređaj kao aktera. Nema direktnog upisa u tabele.

Ovlašćenje je postojeće i ne traži nove naloge: uređaj registruje i aktivira
**Vlasnik** (`devices:manage`, uz potvrdu otiska ključa) na ekranu
`/portal/importi/sinhronizacija`.

Šta je dodato da bi to radilo na Mac-u (ne menja Windows ponašanje):

| Izmena | Zašto | Granica |
|---|---|---|
| macOS Keychain skladište ključa (`connector/src/keystore/macos-keychain.mjs`) | konektor van Windows-a nije imao bezbedno skladište (samo test sa ključem u otvorenom fajlu) | bira se samo uz `CS_CONNECTOR_MACOS_KEYCHAIN=1`; ključ ide kroz standardni ulaz `security`, u fajl stanja samo oznaka; testovi nad privremenim keychain-om |
| `http` samo prema istom računaru (`CS_CONNECTOR_ALLOW_LOOPBACK_HTTP=1`) | lokalni server na Mac-u nema HTTPS | samo `127.0.0.1` / `localhost` / `[::1]`, samo izričito, **nikad u spakovanom konektoru**; spakovan Windows konektor i dalje prima isključivo HTTPS |
| `scripts/ops/wave-folder.mts` | konektor čita fasciklu, a talas je izbor fajlova | kopije fajlova iz manifesta u privatnu fasciklu (700/600), provera otiska, imena bez naziva kupca, originali se samo čitaju; ponovno pokretanje ne duplira |

**Probni prolaz** (`connector dry-run`, bez mreže) nad fasciklom talasa januar
2025: svaki dokument pročitan kao nov i ispravan, nijedan nepodržan, ništa
poslato.

**Alternativa samo za januar:** isti lokalni portal, ekran
`/portal/importi`, upload PDF-ova (do 50 fajlova i 4 MB po slanju) uz
izdavaoca `CSRM` — bez konektora. Za celu arhivu je nepraktično; konektor je
put za ostale talase.

## 2. Postupak za talas (prvo januar 2025.)

Sve na Mac-u; lokalni server sluša **samo** na `127.0.0.1`.

**Jednom, uz Aleksandra:**

1. Lokalni server sa pilot podešavanjima (`~/.carsystem-secrets/pilot/local-build.env`)
   + `FEATURE_SYNC_DEVICE_INGEST=1` (samo lokalno): `next build`, pa
   `next start -H 127.0.0.1 -p 3419`.
2. Vlasnik u pilotu: `preview-owner.sh` (lozinku kuca sam) i drugi faktor
   (`preview-mfa-grant.sh issue` → vezivanje na
   `http://127.0.0.1:3419/portal/bezbednost/mfa` → `clear`), sve sa
   `CARSYSTEM_SECRETS_DIR=~/.carsystem-secrets/pilot`.
3. Konektor na Mac-u: privatna fascikla stanja
   (`CS_CONNECTOR_STATE_DIR=~/.carsystem-private/konektor-mac`), `config.json`
   (`serverOrigin` `http://127.0.0.1:3419`, `deviceCode` `MAC-ARHIVA`,
   `sourceSystem` `biznisoft`, `issuerCode` `CSRM`, `izvorniFolder` = fascikla
   talasa), `CS_CONNECTOR_MACOS_KEYCHAIN=1`, `CS_CONNECTOR_ALLOW_LOOPBACK_HTTP=1`;
   `connector init` ispisuje javni ključ i otisak.
4. Aleksandar registruje `MAC-ARHIVA` (opseg `biznisoft` / `CSRM`) i aktivira
   ga potvrdom otiska koji je konektor ispisao.

**Po talasu:**

1. **Veze kupaca** za partnere talasa — vidi §4 (potvrda kancelarije).
2. **Rezervna kopija:** Neon grana `pre-talas-NN` (konzola) + `pilot-backup.sh dump`
   + `verify`.
3. `wave-control.mts pre` — sve ✔.
4. `wave-folder.mts` — fascikla talasa; `izvorniFolder` u `config.json` na nju.
5. `connector run-once` dok `status` ne pokaže sve potvrđeno (najviše 50 po
   ciklusu; prekid je bezbedan — red se nastavlja, server odbija duplikat).
6. `wave-control.mts posle` sa BizniSoft zbirom — sve ✔.
7. `pilot-backup.sh dump` posle talasa.

**Posle cele arhive:** opozvati `MAC-ARHIVA` u portalu i obrisati stavku iz
keychain-a.

## 3. Uslovi — razdvojeno

**A. Lokalni uvoz sa Mac-a (bez Vercel-a i naplate):**

- pilot baza (✔ postoji, migrirana, prazna);
- lokalni server na `127.0.0.1` sa pilot podešavanjima;
- Vlasnik (Aleksandar) sa drugim faktorom — postojeći ovlašćeni postupak za
  registraciju uređaja (ili upload) to traži; nije dodatni nalog;
- registrovan i aktiviran uređaj `MAC-ARHIVA`;
- potvrđene veze kupaca za talas (kancelarija);
- BizniSoft kontrolni zbir za mesec talasa;
- rezervna kopija pre i posle.

**B. Objava pilota i korišćenje portala (drugi korisnici):** Vercel Pro na
timu, promenljive `pilot/istorija` (39 §3), jedan zaštićeni deployment uz
odobrenje, nalog kancelarije, potvrde kontakata i pozivi kupcima (40 §6).

**C. Windows konektor (ponedeljak):** sve iz **B** do objave, jer konektor
šalje serveru preko HTTPS-a — Mac nije dostupan kancelarijskom računaru, a
spakovan konektor ne prima `http` — plus `FEATURE_SYNC_DEVICE_INGEST=1` na
objavljenom pilotu i registracija uređaja kancelarije (§5).

## 4. Veze kupaca: koji put

- **Pregledana tabela** (`customer-link.mts plan` lokalno, bez upisa) →
  **portal** `/portal/kupci/veze`: grupna primena potvrđenih redova, samo za
  prijavljenog korisnika sa `mappings:manage` i drugim faktorom potvrđenim u
  poslednjih 10 minuta; akter je taj korisnik. (Ranije `apply` u komandi je
  uklonjen — navođenje naloga nije autentifikacija.)
- **Portal** (`/portal/kupci/partneri`, uz `FEATURE_PARTNER_REGISTRY=1`
  lokalno): uvoz `Kupci.xlsx`, pa „otvori kupca" po partneru — prijavljen
  korisnik sa drugim faktorom; registar sada upisuje i šifru sa fakture
  (41 §2). Ručno po partneru, ali kroz punu prijavu.

## 5. Windows konektor 0.2.0 za ponedeljak

**Unapred (bez firminog računara):**

1. `npm run connector:build` iz pregledanog commita; ZIP (`dist/` +
   `windows/*.ps1`) i SHA-256 — heš ide odvojenim kanalom
   ([OFFICE-INSTALL §1](../../connector/windows/OFFICE-INSTALL.md)).
2. `config.json`: `serverOrigin` = adresa objavljenog pilota (HTTPS),
   `deviceCode` npr. `KANC-01`, `sourceSystem` `biznisoft`, `issuerCode`
   `CSRM`, `izvorniFolder` = dogovorena fascikla (odluka ispod).
3. Kućni smoke prolaz na **bilo kom** Windows 11 računaru
   ([`connector/smoke/START-HERE.md`](../../connector/smoke/START-HERE.md)) —
   prvi stvarni Windows test; ne na firminom računaru.
4. Objavljen pilot sa `FEATURE_SYNC_DEVICE_INGEST=1` (uslovi **B/C**).

**Zahteva firmin računar** (OFFICE-INSTALL §0–§5): Node 24 sistemska
instalacija; poseban standardni Windows nalog za konektor; raspakivanje u
`C:\Program Files\CarsystemConnector\` i ACL skripte; `verify-invoice-folder.ps1`
(samo čitanje fascikle); `connector init` pod nalogom konektora (DPAPI);
registracija i aktivacija uređaja u portalu (Aleksandar, otisak); Task
Scheduler zadatak (`task.ps1`); prvi `run-once` i `status`; prekid i ponovno
pokretanje (nastavak reda); provera da već uvezena arhiva daje „duplikat",
ne novu fakturu.

**Nije potvrđeno:** Windows testovi u ovom repozitorijumu su **preskočeni**
na Mac-u (DPAPI, ACL, Task Scheduler, UNC, rad bez prijave). Ništa od toga
nije izvršeno na Windows-u; OFFICE-INSTALL je statički pregledan, ne
operativno potvrđen.

**Zaštita od duplikata arhive:** isti bajtovi → server `duplicate_file`, bez
nove fakture; isti broj računa sa drugim bajtovima → sukob revizije na
ručnom pregledu, ne dvostruko knjiženje; lokalni red takođe pamti otisak.
Konektor čita koren i **neposredne podfascikle**: ako kancelarijska fascikla
sadrži celu istoriju, ponudiće i stare fajlove (50 po ciklusu) — bezbedno, ali
sporo. **Odluka:** `izvorniFolder` = fascikla tekuće godine (u januaru
promena), ili koren uz prihvatanje sporog prvog prolaza posle uvoza arhive sa
Mac-a.
