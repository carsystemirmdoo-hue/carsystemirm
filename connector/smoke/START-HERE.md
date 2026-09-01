# Carsystem — Windows smoke, PRVI prolaz

**OFFLINE SMOKE ONLY — NO REAL INVOICES.**

Ovo **nije** kancelarijska prihvatna proba, **nije** produkciono puštanje i
**ne dodiruje** nijednu pravu fakturu. Cilj je jedan: proveriti da konektor na
Windows-u radi ono što na macOS-u nije moguće dokazati — DPAPI, Windows putanje,
`node:sqlite` na Windows fajl sistemu i Task Scheduler plan.

## Koju verziju držiš u rukama

Verzija se **ne piše u ovo uputstvo.** Uputstvo putuje unutar paketa i ostalo bi
isto i posle novog pakovanja — pa bi tvrdilo verziju koje nema. Tačna verzija je
uvek u `smoke/package-meta.json`:

```
type smoke\package-meta.json
```

Zanimaju te `shortHead`, `sourceHead` i `sourceBranch`. Sve što je niže napisano
kao `<shortHead>` odnosi se na vrednost iz tog fajla.

Ime ZIP-a, njegovu veličinu i SHA-256 nosi **`WINDOWS-HANDOFF-<shortHead>.md`**,
koji je stigao **pored** arhive, ne u njoj: arhiva ne može da sadrži sopstveni
konačni otisak, jer otisak nastaje tek kad je zatvorena.

---

## 1. Preduslov — Node 24

Instaliraj **zvanični Windows x64 Node 24 LTS** sa <https://nodejs.org/>.
Paket **ne sadrži** Node i ne preuzima ga.

Proveri pre pokretanja, u novom Command Prompt-u:

```
node --version
```

Mora ispisati `v24.14.x`. **Node 20 nije podržan** — konektor koristi
`node:sqlite`, koji u njemu ne postoji, i entrypoint će odbiti da radi.

## 2. Raspakuj u putanju sa razmakom i srpskim slovima

To je deo provere, ne stil. Predlog:

```
C:\Users\<tvoj nalog>\Desktop\Carsystem Smoke ČĆŽŠĐ\
```

Ako putanja nema razmak i bar jedno od `ČĆŽŠĐ`, provera `W03` će pasti — i to
je namerno.

## 3. Pokreni

Dvoklik na `smoke\RUN-SMOKE.cmd`, ili iz Command Prompt-a:

```
smoke\RUN-SMOKE.cmd
```

**Ne pokreći kao Administrator.** Nijedna provera u ovom prolazu ne traži
povišena prava. Ako Windows to sam ponudi — odbij.

Traje nekoliko minuta. Na kraju ispisuje tačno jedno od:

| Ispis | Izlazni kod | Značenje |
|---|---|---|
| `SMOKE PASS` | 0 | jedini prolaz |
| `SMOKE INCOMPLETE` | 4 | ništa nije palo, ali je provera preskočena |
| `SMOKE FAIL` | 1 | bar jedna provera je pala |

`INCOMPLETE` **nije** prolaz. Nepotpuna provera vredi isto koliko i neizvršena.

**Ne broj testove.** Jedini kriterijum je gornji ispis. Runner sam zna koliko
provera ima i koja od njih sme da bude preskočena.

## 4. Šta vratiš

Runner upisuje u `%TEMP%\Carsystem Smoke ČĆŽŠĐ\`:

- **`windows-smoke-result-<shortHead>.md`** ← ovo pošalji
- `windows-smoke-result-<shortHead>.json` ← opciono, uz gornji
- `testovi-tap.log` ← **NE šalji.** Detaljan lokalni log; ostaje na računaru dok
  ga zajedno ne pregledamo i redigujemo.

`<shortHead>` je vrednost iz `smoke/package-meta.json`, i runner ga sam upisuje
u ime fajla. Ako fajl nosi drugi `<shortHead>` nego što piše u tom fajlu —
pokrenut je pogrešan paket i rezultat se ne šalje.

Redigovani rezultat ne sadrži tvoje korisničko ime, ime računara, apsolutne
putanje, ključeve, potpise, PIB, nazive kupaca ni stack trace.

## 5. Šta smoke MENJA na tvom računaru

- Pravi jedan folder: `%TEMP%\Carsystem Smoke ČĆŽŠĐ\` i u njemu lokalni red
  (`queue.db`), **sintetički** uređajni ključ i rezultat.
- Taj ključ je zaštićen Windows DPAPI-jem za tvoj nalog — to je i deo provere.

## 6. Šta smoke NE menja i NE radi

- **Ne čita** BizniSoft izlaz, Downloads, Documents ni bilo koji tvoj folder.
  Jedini ulaz su dva sintetička PDF-a iz ovog paketa.
- **Ne dodiruje nijednu pravu fakturu**, ni čitanjem ni pisanjem.
- **Ne šalje ništa na mrežu.** Konfiguracija pokazuje na `https://smoke.invalid`,
  host koji ne postoji, i nijedna provera ne poziva server.
- **Ne registruje uređaj** i ne uključuje `FEATURE_SYNC_DEVICE_INGEST` ni
  `FEATURE_SYNC_OPERATIONS`.
- **Ne pravi Scheduled Task**, servis, registry unos ni autostart. Task
  Scheduler skripta se poziva isključivo u `dry-run` režimu i posle nje se
  proverava da zadatak ne postoji.
- Ne menja sistemsko vreme, firewall, sertifikate ni Windows politike.
- Ne traži i ne koristi administratorska prava.
- Ne menja NTFS dozvole i ne pokušava upis ni u jedan folder van `%TEMP%`.

## 7. Čišćenje — tek kad ti kažeš

Runner **namerno ne briše** ključ ni bazu po uspehu; rezultat mora ostati
dostupan za proveru. Kad završimo:

```
smoke\RUN-SMOKE.cmd cleanup
```

Briše **samo** `%TEMP%\Carsystem Smoke ČĆŽŠĐ`. Ništa drugo.

---

## 8. Šta je automatizovano, a šta ostaje ručno

Runner pokreće ceo postojeći `[WIN]` skup i dodaje provere koje taj skup ne
pokriva. Tačan spisak i redosled provera je u samom runneru
(`smoke/run-smoke.mjs`) i u rezultatu koji on napiše — ovde se namerno **ne
prepisuje**, da se dva spiska ne raziđu.

| Tražena provera | Kako se dokazuje |
|---|---|
| Windows verzija/arhitektura, Node 24.14.x guard | `W01`, `W02` |
| pokretanje iz putanje sa razmakom i `ČĆŽŠĐ` | `W03` + `[WIN]` test putanja/UNC |
| `doctor` u izolovanoj konfiguraciji | `W05` |
| `node:sqlite`, WAL, zatvaranje i ponovno otvaranje | `W10` + `[WIN]` „red preživljava restart“ |
| DPAPI `CurrentUser` protect/unprotect, pravi adapter | `W06` + `[WIN]` DPAPI testovi |
| ponovljen `init` ne menja ključ | `W07` |
| javni ključ izvodiv, privatni nigde ne curi | `W06` (fajl) + `W08` (stdout/stderr/log) |
| scanner i parser samo nad sintetičkim folderom | `W09` |
| `watch`/`poll-once` bez tight loop-a | `W11`, `W12` |
| Task Scheduler ostaje dry-run | `W13` + `[WIN]` „skripta je dry-run“ |
| produkcijski entrypoint odbija test keystore | `W14` + `[WIN]` „paket odbija test skladište“ |
| ceo `[WIN]` skup je stvarno izvršen | `W15`, `W15-win` |

### Zašto `W15-win` ne traži svih deset

`[WIN]` skup ima deset testova. Devet se izvršava automatski; deseti
(**registracija i uklanjanje Scheduled Task-a**, `task.ps1 -Action install
-Apply`) sam sebe preskače, izričito, jer menja sistem. `W15-win` zato prihvata
tačno jedan preskočen `[WIN]` test — sve preko toga je `SMOKE INCOMPLETE`.

To znači: **„9 od 10" je očekivano stanje, ne nedostatak.**

### Ostaje RUČNO, izvan ovog prolaza

- **Trajni Scheduled Task** (`task.ps1 -Action install -Apply`, pa
  `-Action uninstall -Apply`). Ne radi se u prvom prolazu.
- **Zaključavanje foldera stanja** (`harden-state-dir.ps1 -Apply`) — menja ACL.
- **Aktivna provera NTFS dozvola** nad BizniSoft folderom. U prvom prolazu se
  `icacls` samo **čita**; pokušaj upisa dolazi kasnije, i to isključivo nad
  namenskim sentinel fajlom, nikad nad pravom fakturom.
- **DPAPI drugog naloga**: automatski test pokriva da tuđi kontekst ne otključava
  ključ; provera „drugi Windows nalog ne može da pročita ključ“ traži drugi
  nalog i radi se ručno kad za to bude potrebe.
- **Sve što traži server**: registracija uređaja, `heartbeat`, `run-once` slanje,
  stvarni `poll-once`/`watch` protiv portala. Gate-ovi ostaju isključeni.

## 9. Ako nešto padne

Pošalji `windows-smoke-result-<shortHead>.md`. U njemu je za svaku palu proveru
kratak kod (npr. `keystore_not_dpapi`, `queue_not_persisted`,
`watch_tight_loop_or_hang`). Kod je dovoljan da se problem lokalizuje —
`testovi-tap.log` ne šalji dok ga ne pregledamo.
