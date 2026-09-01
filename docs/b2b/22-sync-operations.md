# 22 — Portal, uređaji i ručne komande (P4)

Oznake: 🟢 dokazano kodom i testom · 🟡 implementirano, neproveren u kancelariji · 🔴 nedostaje dokaz

Nastavak na [19 — kanonski ugovor](19-canonical-ingest-contract.md),
[20 — prijem sa uređaja](20-device-ingest.md) i
[21 — Windows konektor](21-windows-connector.md).

**Šta P4 jeste:** ekran u portalu koji pokazuje stanje kancelarijskog uređaja i
poslednje uvoze, dugme koje zakazuje JEDNU zatvorenu komandu, i protokol kojim
konektor tu komandu preuzima, izvršava i o njoj izveštava.

**Šta P4 nije:** nema daljinskog podešavanja, nema slanja putanja/URL-ova/skripti
uređaju, nema prekidanja pokrenutog posla, nema novih tipova komandi i nema
uključivanja u produkciji. Oba feature gate-a ostaju **isključena**.

---

## 1. Granica poverenja

Server uređaju šalje **identitet i tip**, nikad posao.

```json
{ "id": "…uuid…", "type": "scan_and_sync", "version": 1, "expiresAt": "…" }
```

Tačno četiri polja, i test to zaključava (`poll vraća zatvoren opis komande`).
Šta `scan_and_sync` znači, zna konektor — folder, raspored, server i identitet
ostaju u lokalnoj zaštićenoj konfiguraciji. Tip je **enum sa jednom vrednošću** u
bazi, ne `text`: jedna greška u kodu ne može da pošalje uređaju nešto što ovaj ne
razume. 🟢

Ručna komanda zaobilazi **samo čekanje do 09:00**. Ne zaobilazi bravu, stabilnost
fajla, granice, validaciju ugovora, idempotentnost ni kontrolisana odbijanja. 🟢

---

## 2. Endpointi

| Ruta | Šta radi |
|---|---|
| `POST /api/sync/commands/poll` | uređaj pita ima li komande; vraća najviše jednu |
| `POST /api/sync/commands/update` | uređaj prijavljuje napredak i završni ishod |

Oba idu kroz isti `withAuthenticatedDevice` kao `ingest`: gate, granica tela,
rate limit, prozor timestamp-a, Ed25519 potpis nad osam polja, anti-replay nonce.
`POST` sa potpisanim telom, ne `GET` — potpis pokriva otisak tela, a query string
je u profilu zabranjen.

**Opseg i akter dolaze IZ POTPISA.** Telo ne nosi `deviceId`; polje koje bi ga
nosilo odbija se kao `unknown_field` pre ijednog upita. 🟢

### Feature gate

```
FEATURE_SYNC_DEVICE_INGEST=1     # prijem dokumenata (P2)
FEATURE_SYNC_OPERATIONS=1        # ručne komande (P4)
```

Dva prekidača, ne jedan. Komande **traže** prijem (komanda bez prijema pokreće
ciklus koji ne sme ništa da pošalje), ali prijem ne pali komande. Traži se
doslovno `"1"`; `"0"`, `"true"`, `"yes"` i prazno su isključeno. Isključeno daje
**404**, ne 403 — isključen kanal se ne najavljuje. 🟢

---

## 3. Model komande i događaja

`sync_commands` — jedna komanda po redu, sa zamrznutim opsegom (`source_system`,
`issuer_code` prepisani sa uređaja), naručiocem (`requested_by`), lease-om,
rokom i osam odvojenih brojača.

`sync_command_events` — **append-only** (okidači zabranjuju `UPDATE` i `DELETE`),
sa jedinstvenim `(command_id, client_event_id)`.

### Zašto dvostruki klik ne pravi dve komande

```sql
CREATE UNIQUE INDEX "sync_commands_one_open_per_device"
  ON "sync_commands" ("device_id", "command_type")
  WHERE "status" IN ('queued','delivered','running','retry_pending');
```

Aplikativna provera „ima li već otvorene“ ima prozor između čitanja i upisa i ne
preživljava dva paralelna submit-a. Delimičan jedinstveni indeks ga nema. 🟢

### Lease

`ROK_LEASE_MS = 30 min`. Preuzimanje je jedan `UPDATE … WHERE` sa uslovom nad
lease-om — dva istovremena `poll`-a ne mogu oba dobiti komandu, jer drugi ne
pogađa nijedan red. Istek lease-a dozvoljava **istom** uređaju da nastavi (posle
restarta), ne pravi novu komandu i ne daje je drugom uređaju. 🟢

### Rok

`ROK_KOMANDE_MS = 7 dana`. Istekle komande se zatvaraju **pre** preuzimanja:
komanda zadata pre mesec dana ne sme da se izvrši u trenutku kada neko upali
računar — to više nije ono što je čovek tražio. 🟢

### Tabela prelaza

| iz | u |
|---|---|
| `queued` | `delivered`, `expired`, `blocked` |
| `delivered` | `running`, `completed`, `completed_with_review`, `retry_pending`, `failed`, `blocked`, `expired` |
| `running` | `running`, `completed`, `completed_with_review`, `retry_pending`, `failed`, `blocked` |
| `retry_pending` | `running`, `delivered`, `completed`, `completed_with_review`, `failed`, `blocked`, `expired` |
| završna | — |

`delivered → completed` **bez** `running` nije popuštanje. Uređaj prvo šalje
„počeo sam“, ali taj ACK ume da se izgubi; posao se svejedno obavi i završni
izveštaj stigne prvi. Da se prelaz odbija, gotova komanda bi na ekranu zauvek
stajala kao „preuzeto“. Zakašnjeli `running` posle toga pada kao
`command_terminal` — ishod se ne otvara ponovo. 🟢

---

## 4. Idempotentnost izveštaja

`client_event_id` nastaje **na uređaju** i upisuje se lokalno **pre** slanja.

| slučaj | ishod |
|---|---|
| isti ID, isti sadržaj | `already_recorded`, bez drugog reda |
| isti ID, drugi sadržaj | `409 event_id_content_mismatch` |
| tuđa komanda | `409 command_not_yours` |
| završena komanda | `409 command_terminal` |
| unazadan prelaz | `409 transition_not_allowed` |

Konflikt konektor **ne ponavlja u petlji**: događaj se lokalno označava
potvrđenim da ne bi zauvek visio i blokirao sve iza sebe. Mrežni neuspeh se
ponavlja — sa istim ID-em, u istom redosledu. 🟢

Brojači su ograničeni (`MAX_BROJAC = 100 000`) i odvojeni: `postedCount` nije
`reviewCount`. `failureCode` prolazi kroz `ogranicenKod` — najviše 64 znaka,
samo `[a-z0-9_:.-]`. Putanja, ime kupca i sirova poruka drajvera ne prežive. 🟢

---

## 5. Ritam pitanja

```
zdravo:      45 s ± 15 s jitter
posle greške: 45 s × 2^n, najviše 30 min, uvek + jitter
```

Bez backoff-a bi konektor bez interneta pitao svakih 45 s zauvek i punio log. Bez
jitter-a bi se više uređaja (ili isti posle restarta) poravnalo u isti trenutak.
Blokiran uređaj nema tight loop. **Termin u 09:00 je nezavisan** i ne zna da
komande postoje. 🟢

```
carsystem-connector poll-once   # jedan prolaz: nepotvrđeni događaji → komanda
carsystem-connector watch       # dugotrajno: raspored + komande, sa backoff-om
```

`doctor` proverava kompatibilnost protokola (tip, verzija, šema lokalnog reda,
pokrivenost potpisanih putanja) i **namerno ne poll-uje**: poll bi na serveru
preuzeo stvarnu komandu i označio je isporučenom, a doctor je ne izvršava. 🟢

Lokalni red je podignut na **šemu 2** uz nadogradnju na mestu — neposlate stavke
ostaju. Noviji red sa starijim konektorom je greška (`schema_newer`), ne
„snađi se“. 🟢

---

## 6. Ovlašćenja

| | `sync:monitor` | `sync:trigger` | `devices:manage` |
|---|---|---|---|
| gazda | ✅ | ✅ | ✅ |
| kancelarija | ✅ | ✅ | ❌ |
| komercijalista | ❌ | ❌ | ❌ |
| magacioner | ❌ | ❌ | ❌ |
| bilo koji paket | — | — | ❌ |

Kancelarija je ta koja gleda kada uvoz zapne i pokreće ga ponovo; da to traži
gazdu, jedina osoba koja radi sa fakturama ne bi mogla ništa. Registracija ključa
je druga odluka i ostaje samo gazdi — **nijedan paket** je ne otvara. 🟢

Svaka server akcija sama proverava sposobnost. Sakriveno dugme nije autorizacija:
akcija se može pozvati i bez ekrana. 🟢

### Popravljen nav nedostatak

`/portal/importi/dokumenti` nije imao unos u `ROUTE_CAPABILITY`, pa je
`navGroupsFor` tražio `capabilities.has(undefined)` — uvek `false`, i stavka se
**nikome** nije prikazivala. Dodat je unos sa `view:importi`, isto ovlašćenje
koje ruta ionako zahteva: serverska autorizacija se ovim **ne širi**. 🟢

---

## 7. Ekran `/portal/importi/sinhronizacija`

Razdvaja tvrdnje koje se lako pobrkaju:

- **„zatraženo“ nije „pokrenuto“** — komandu preuzima uređaj pri sledećem javljanju;
- **poslednje javljanje nije uspešna sinhronizacija** — heartbeat dokazuje samo kontakt;
- **„završeno — traži pregled“ nije potpuno knjiženje** — deo dokumenata čeka čoveka.

Brojači komande su **izveštaj uređaja o sopstvenom prolazu**. Merodavan zapis o
knjiženju je tabela poslednjih uvoza ispod njih.

Registracija uređaja prima **samo javni ključ**; privatni nema polje u koje bi
stao. Otisak računa server i prikazuje ga da ga čovek uporedi sa onim koji uređaj
ispisuje; aktivacija traži ručno potvrđen otisak, jer bi inače bila puko klikanje
na ono što je već u bazi — a upravo bi ubačen tuđi ključ tako i prošao. 🟢

---

## 8. Šta je dokazano, a šta nije

🟢 **Dokazano nad pravim PostgreSQL-om i stvarnim rukovaocima**
`db/integration/syncOperations.integration.test.mts` (22),
`db/integration/connectorEndToEnd.integration.test.mts` (17, Node 24),
`db/integration/deviceMigration.integration.test.mts` (15),
`connector/test/commands.test.mjs` (14),
`lib/authz/permissions.test.mjs`, `app/portal/importi/sinhronizacija/actions.test.mjs`.

Uključujući pun tok: portal → komanda → konektor → `ingest` → **jedna faktura**,
i najopasniji prozor — posao obavljen, završni ACK izgubljen, nov proces šalje
isti `event_id`, faktura ostaje jedna.

🟡 **Implementirano, nije provereno na Windows-u**
`watch` režim i `poll-once` iz spakovanog konektora rade na macOS-u; Windows
testovi su `[WIN]` i **NISU IZVRŠENI** (10 preskočenih, sa razlogom u izlazu).

🔴 **Nije urađeno i ne sme se predstaviti kao gotovo**
- kancelarijska (fizička) prihvatna proba nije izvršena;
- produkcioni gate-ovi ostaju **isključeni**;
- pravi uređaj i pravi ključ nisu registrovani;
- `node:sqlite` je u Node 24 i dalje **experimental** (prijavljuje se u `doctor`);
- serverski runtime je Node 20.20.2 (**EOL**) — zaseban produkcioni rizik;
- HTTPS/deployment i backup/restore lokalnog reda nisu rešeni.

---

## 9. Poznata ograničenja

- **Pokrenut posao se ne prekida daljinski.** Nema „stop“ komande; opoziv uređaja
  zaustavlja sledeće slanje, ne trenutni ciklus u toku.
- **`retry_pending` znači „ostalo je neslatih stavki“**, ne „ništa nije prošlo“.
- **Jedan uređaj po opsegu** je pretpostavka koju danas niko ne proverava —
  ograničenje je po uređaju, ne po firmi.
