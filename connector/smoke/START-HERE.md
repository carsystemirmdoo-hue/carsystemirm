# Carsystem — Windows smoke, PRVI prolaz

Paket odgovara izvornom stanju `90374b1` (grana `feature/biznisoft-sync-operations`).

Ovo **nije** kancelarijska prihvatna proba, **nije** produkciono puštanje i
**ne dodiruje** nijednu pravu fakturu. Cilj je jedan: proveriti da konektor na
Windows-u radi ono što na macOS-u nije moguće dokazati — DPAPI, Windows putanje,
`node:sqlite` na Windows fajl sistemu i Task Scheduler plan.

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

| Ispis | Značenje |
|---|---|
| `SMOKE PASS` | sve provere prošle |
| `SMOKE INCOMPLETE` | ništa nije palo, ali ključna Windows provera je preskočena |
| `SMOKE FAIL` | bar jedna provera je pala |

`INCOMPLETE` **nije** prolaz. Ako ključna provera (DPAPI, restart reda,
produkcijski adapter) nije izvršena, rezultat je nepotpun.

## 4. Šta vratiš

Runner upisuje u `%TEMP%\Carsystem Smoke ČĆŽŠĐ\`:

- **`windows-smoke-result-90374b1.md`** ← ovo pošalji
- `windows-smoke-result-90374b1.json` ← opciono, uz gornji
- `testovi-tap.log` ← **NE šalji.** Detaljan lokalni log; ostaje na računaru dok
  ga zajedno ne pregledamo i redigujemo.

Redigovani rezultat ne sadrži tvoje korisničko ime, ime računara, apsolutne
putanje, ključeve, potpise, PIB, nazive kupaca ni stack trace.

## 5. Šta smoke MENJA na tvom računaru

- Pravi jedan folder: `%TEMP%\Carsystem Smoke ČĆŽŠĐ\` i u njemu lokalni red
  (`queue.db`), **sintetički** uređajni ključ i rezultat.
- Taj ključ je zaštićen Windows DPAPI-jem za tvoj nalog — to je i deo provere.

## 6. Šta smoke NE menja i NE radi

- **Ne čita** BizniSoft izlaz, Downloads, Documents ni bilo koji tvoj folder.
  Jedini ulaz su dva sintetička PDF-a iz ovog paketa.
- **Ne šalje ništa na mrežu.** Konfiguracija pokazuje na `https://smoke.invalid`,
  host koji ne postoji, i nijedna provera ne poziva server.
- **Ne registruje uređaj** i ne uključuje `FEATURE_SYNC_DEVICE_INGEST` ni
  `FEATURE_SYNC_OPERATIONS`.
- **Ne pravi Scheduled Task**, servis, registry unos ni autostart. Task
  Scheduler skripta se poziva isključivo u `dry-run` režimu i posle nje se
  proverava da zadatak ne postoji.
- Ne menja sistemsko vreme, firewall, sertifikate ni Windows politike.
- Ne traži i ne koristi administratorska prava.

## 7. Čišćenje — tek kad ti kažeš

Runner **namerno ne briše** ključ ni bazu po uspehu; rezultat mora ostati
dostupan za proveru. Kad završimo:

```
smoke\RUN-SMOKE.cmd cleanup
```

Briše **samo** `%TEMP%\Carsystem Smoke ČĆŽŠĐ`. Ništa drugo.

---

## 8. Šta je automatizovano, a šta ostaje ručno

Postojeći `[WIN]` skup ima deset testova. Runner ih pokreće sve, i dodaje
provere koje taj skup ne pokriva.

| # | Tražena provera | Kako se dokazuje |
|---|---|---|
| 1 | Windows verzija/arhitektura, Node 24.14.x guard | `W01`, `W02` — nove u runneru |
| 2 | pokretanje iz putanje sa razmakom i `ČĆŽŠĐ` | `W03` (putanja paketa) + `[WIN]` test putanja/UNC |
| 3 | `doctor` u izolovanoj konfiguraciji | `W05` — nova u runneru |
| 4 | `node:sqlite`, WAL, zatvaranje i ponovno otvaranje | `W10` + `[WIN]` „red preživljava restart“ + `scanner-store` |
| 5 | DPAPI `CurrentUser` protect/unprotect, pravi adapter | `[WIN]` 3 testa + `W06` |
| 6 | ponovljen `init` ne menja ključ | `W07` — nova u runneru |
| 7 | javni ključ izvodiv, privatni nigde ne curi | `W06` (fajl) + `W08` (stdout/stderr/log) |
| 8 | scanner i parser samo nad sintetičkim folderom | `W09` + `scanner-store` testovi |
| 9 | restart nad istim stanjem, oporavak lock-a | `W10` + `[WIN]` restart + `[WIN]` zauzet fajl |
| 10 | Task Scheduler ostaje dry-run | `W13` + `[WIN]` „skripta je dry-run“ |
| 11 | `watch`/`poll-once` bez tight loop-a | `W11`, `W12` + `commands` testovi |
| 12 | produkcijski entrypoint odbija test keystore | `W14` + `[WIN]` „paket odbija test skladište“ |

### Ostaje RUČNO, izvan ovog prolaza

- **Registracija i uklanjanje Scheduled Task-a** (`task.ps1 -Action install -Apply`,
  pa `-Action uninstall -Apply`). Postojeći test to sam preskače, izričito, jer
  menja sistem. Radi se tek na izolovanoj mašini i po dogovoru.
- **Zaključavanje foldera stanja** (`harden-state-dir.ps1 -Apply`) — menja ACL,
  ne izvršava se u prvom prolazu.
- **DPAPI drugog naloga**: automatski test pokriva da tuđi kontekst ne otključava
  ključ, ali stvarna provera „drugi Windows nalog ne može da pročita ključ“
  traži drugi nalog i radi se ručno kad za to bude potrebe.
- **Sve što traži server**: registracija uređaja, `heartbeat`, `run-once` slanje,
  stvarni `poll-once`/`watch` protiv portala. Gate-ovi ostaju isključeni.

## 9. Ako nešto padne

Pošalji `windows-smoke-result-90374b1.md`. U njemu je za svaku palu proveru
kratak kod (npr. `keystore_not_dpapi`, `queue_not_persisted`,
`watch_tight_loop_or_hang`). Kod je dovoljan da se problem lokalizuje —
`testovi-tap.log` ne šalji dok ga ne pregledamo.
