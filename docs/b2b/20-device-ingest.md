# 20 — Bezbedan serverski prijem sa uređaja (P2)

Oznake: 🟢 dokazano kodom i testom · 🔵 samo dokumentovan ugovor · 🔴 nedostaje dokaz

Nastavak na [19 — kanonski ugovor](19-canonical-ingest-contract.md).

**Šta P2 jeste:** ovlašćen uređaj može da pošalje potpisan canonical dokument,
server ga proveri i prosledi postojećem zajedničkom servisu.

**Šta P2 nije:** nema Windows agenta, scan/schedulera, outboxa, panela uređaja,
command pollinga, semantičke deduplikacije ni novih valuta/datumskih grana.
Automatski uvoz **nije** pušten — feature gate je podrazumevano isključen.

---

## 1. Validator: Ajv, isti ugovor

Ručno pisan interpreter iz P1 nije bio pogrešan; bio je dovoljan dok mu je
jedini pozivalac bio test. Od trenutka kada isti kod gleda telo sa mreže,
održavanje sopstvene implementacije standarda postaje odgovornost koju ne
želimo.

| | |
|---|---|
| Paket | `ajv` **8.20.0**, direktna runtime zavisnost, tačna verzija u lockfile-u |
| Klasa | `ajv/dist/2020` — ugovor nosi `$schema: draft/2020-12` |
| Zašto ne tranzitivni | `ajv@6` postoji kroz ESLint (draft-07); tuđe stablo bi obaralo prijem faktura |

Opcije su odluke, ne podrazumevane vrednosti:

| Opcija | Vrednost | Zašto |
|---|---|---|
| `strict` | `true` | Nepoznat/zanemaren keyword obara **kompilaciju** šeme 🟢 |
| `coerceTypes` | `false` | `"1"` ne sme postati `1` — iznosi su decimalni tekst |
| `useDefaults` | `false` | Dopisano polje bi ušlo u semantic hash kao da je stiglo |
| `removeAdditional` | `false` | Nepoznato polje se **odbija**, ne briše |
| `allErrors` | `false` | Duga lista grešaka nad tuđim telom je i sama kanal za curenje |
| `validateFormats` | `true` | Format koji se koristi mora biti stvarno proveren |

Kompajlira se **isključivo** lokalna šema iz `contracts/`, jednom pri učitavanju
modula. Ajv se pravi bez `loadSchema` i bez registrovanih udaljenih resursa, pa
`$ref` na tuđi URL nema odakle da se razreši.

Greške ne nose sadržaj: prenose se samo `instancePath` i naziv pravila. Jedini
izuzetak je naziv **nepoznatog** ključa — to je ono što je pošiljalac izmislio,
ne podatak o kupcu. Ajv verbose polja (`data`, `parentSchema`, `schemaPath`) ne
izlaze. 🟢

Zamenjeni interpreter je uklonjen u istom commitu. Nema dva produkcijska schema
validatora. Pozitivni P1 vektori, njihov canonical sadržaj i hash su
**nepromenjeni**, kao i nezavisna provera hash-a i provera TS tipa prema ugovoru.

---

## 2. Signing profil v1

| | |
|---|---|
| Verzija protokola | `cs-sync-v1` |
| Algoritam | **Ed25519** preko `node:crypto` — **konstanta, ne polje zahteva** |
| Runtime | potvrđen na Node **v20.20.2**: sign/verify i SPKI DER reimport rade 🟢 |
| Prozor | ±5 min prema serverskom vremenu, strogo u **oba** smera |
| Nonce | 32 heksadecimalna znaka (128 bita) |

Potpisuje se **tačno ovo**, **osam** polja razdvojenih `\n`:

```
cs-sync-v1
<device_id>
<key_id>
POST
/api/sync/ingest
2026-03-10T09:00:00.000Z
<nonce>
sha256:<otisak tela>
```

Zaglavlja: `x-cs-sync-version`, `x-cs-device-id`, `x-cs-key-id`,
`x-cs-timestamp`, `x-cs-nonce`, `x-cs-body-sha256`, `x-cs-signature`.

> **Ispravka.** Raniji P2 izveštaj i komentari su pisali „sedam polja“, a
> nabrajali osam. Kod spaja **osam**; test je i tada tvrdio svih osam. Omaška je
> bila samo u brojanju — wire format nije menjan.

**Nijedno zaglavlje ne nosi algoritam.** Da ga nosi, napadač bi ponudio slabiji
profil i server bi ga poslušao — klasičan `alg`-confusion.

**Query string je zabranjen**, ne ignorisan. Nije deo potpisnog niza, pa bi
nepotpisan bio slobodno izmenjiv; putanja sa `?` ili `#` se odbija. Putanja se
ne normalizuje — `/api/sync//ingest` se **odbija** umesto da se „popravi“, jer bi
popravka značila da dva različita niza daju isti potpis. 🟢

**Otisak tela se računa nad primljenim bajtovima.** `JSON.stringify` nad
parsiranim telom daje drugi niz bajtova (beline, redosled ključeva, escape), pa
bi potpisivao nešto što pošiljalac nikada nije poslao. 🟢

Budući timestamp je jednako strog kao prošli: bez toga bi uređaj sa pomerenim
satom „rezervisao“ nonce daleko unapred, preko roka koliko se nonce čuva.

---

## 3. Anti-replay

Jedinstvenost je **`(device_id, key_id, nonce)` u bazi**. Memorijski `Set` ne
preživljava restart procesa i ne dele ga dve instance, pa bi napadaču dao
onoliko ponavljanja koliko ima instanci — i sve bi izgledalo ispravno. 🟢

`INSERT` je **jedina** provera: čitanje pa upis bi ostavilo prozor u kome dva
istovremena zahteva oba vide slobodan nonce. Dokazano `Promise.all` testom —
tačno jedan `ingested`, jedan `nonce_replayed`, jedna faktura. 🟢

**Nonce se upisuje tek posle provere potpisa.** Da se upisuje ranije, bilo ko bi
trošio tuđe nonce-ove slanjem smeća i time onemogućio uređaju da radi.

Rok čuvanja se računa **od `signed_at`**, ne od upisa: prozor + 10 min rezerve.
Prerano brisanje bi ponovo otvorilo replay. Čišćenje ide usput iz samog prijema;
zaseban scheduler u P2 nije potreban i ne bi bio garancija — bez čišćenja tabela
raste, zaštita se ne gubi.

| Situacija | Ishod |
|---|---|
| Ponovljen **nonce** | `nonce_replayed` (409) — replay |
| Isti dokument, **nov** nonce | `duplicate_file` (200) — uredan retry posle izgubljenog odgovora 🟢 |
| Opoziv pa zahtev potpisan ranije | `device_not_active` — status se čita iz baze pri svakom zahtevu, nema keša 🟢 |

**Posle greške baze:** transakcija se poništava, dokument ne nastaje, a nonce
ostaje potrošen. Klijent ponavlja sa **novim** nonce-om; to je normalan retry i
ne duplira promet.

---

## 4. Uređaj, ključevi, akter

**Server čuva samo javne ključeve.** Privatni nastaje na uređaju i nema kolonu u
koju bi stao — test to i tvrdi, nad `information_schema` i nad dužinom
sačuvanog materijala (Ed25519 SPKI = 44 bajta). 🟢

| Radnja | Ko | Pravilo |
|---|---|---|
| Registracija | `devices:manage` | Nikad ne daje `active` |
| Aktivacija | `devices:manage` | Traži **potvrđen otisak** ključa 🟢 |
| Opoziv uređaja | `devices:manage` | Obara i sve njegove ključeve; iz `revoked` se ne vraća |
| Opoziv ključa | `devices:manage` | Uređaj ostaje u svom stanju |

**Opseg (`source_system`, `issuer_code`) dolazi isključivo iz registracije.**
Payload nosi svoj `issuer.code`, ali se samo poredi — sadržaj koji sam sebi
dodeli opseg nije opseg. Uređaj ne može sebi da menja opseg, da se registruje kao
aktivan, da rotira ključ ni da upravlja drugim uređajem.

### Autorizaciona matrica

| Uloga / paket | `view:importi` | `documents:resolve` | `devices:manage` |
|---|---|---|---|
| gazda | ✅ | ✅ | **✅** |
| kancelarija | ✅ | — | **❌** |
| kancelarija + `analitika` + `mapiranja` | ✅ | ✅ | **❌** 🟢 |
| komercijalista (bilo koji paket) | — | — | **❌** |
| magacioner | — | — | **❌** |

Konzervativno namerno: **nijedan paket** ne dodeljuje `devices:manage`. Širu
politiku kancelarije odlučujemo uz P4 — lakše je kasnije proširiti nego povući
pristup koji je već dat.

### Akter u tragu

`audit_log.actor_kind` + `actor_device_id`, uz CHECK koji brani nevažeću
kombinaciju. `device` traži uređaj i **zabranjuje** korisnika. 🟢

Nema lažnog `users` reda — pojavio bi se na svakom ekranu naloga i mogao bi da
se deaktivira ili mu se dodeli dozvola. Čovek koji je uređaj registrovao **nije**
akter njegovih budućih uvoza: on je odobrio kanal, nije uneo dokument.

`actor_device_id` je namerno **bez stranog ključa**: i `CASCADE` i `SET NULL` bi
udarili u append-only okidače, pa bi brisanje uređaja pucalo porukom o okidaču
umesto o uzroku.

`import_runs.started_by_device_id` uz CHECK da prolaz ima **najviše jednog**
aktera. Postojeći korisnički uvozi rade nepromenjeni. Server kreira/razrešava
prolaz; `runId` se iz zahteva **uopšte ne prima** — nije ni polje ugovora.

---

## 5. Endpointi

`POST /api/sync/ingest` · `POST /api/sync/heartbeat` · `runtime: "nodejs"`

**Svaki sam sprovodi gate i autentifikaciju.** Middleware nije zamena —
konfiguriše se na drugom mestu i jedna izmena `matcher`-a bi tiho otvorila rutu.
Portal kolačić takođe nije: on dokazuje pretraživač prijavljenog čoveka, ne
uređaj. Test to tvrdi nad izvorom obe rute. 🟢

Redosled, gde svaki korak štiti sledeći:

1. **gate** — isključen kanal ne troši ništa (404, ne 403);
2. metod i content type — jeftino, bez baze;
3. rate limit `sync_unknown`;
4. **ograničeno telo** — nad stvarnim bajtovima;
5. autentifikacija: uređaj, ključ, vreme, otisak tela, potpis, **pa** nonce;
6. rate limit `sync_device`;
7. posao.

### Telo

Granica **512 KB**, izvedena iz ugovora: 500 stavki × ~220 B najgoreg slučaja
≈ 400 KB, uz rezervu. Broje se bajtovi **kako stižu**; `Content-Length` je
tvrdnja klijenta, može nedostajati (chunked) i može lagati. Kompresija se
**odbija** — dekompresija pre provere granice znači da mali zahtev postaje
ogroman u memoriji. 🟢

### Rate limit

Postojeći mehanizam, dva nova scope-a:

| Scope | Kada | Limit (nalog / IP) |
|---|---|---|
| `sync_unknown` | pre nego što se zna ko šalje | 20 / 60 po 5 min |
| `sync_device` | posle dokazanog identiteta | 600 / 1200 po 5 min |

Strogo za nepoznate; blago za uređaj koji šalje seriju dokumenata.

**Greška baze pri autentifikaciji ne propušta zahtev** — 503, posao se ne
izvršava. Bez toga bi ispad baze pretvorio provere potpisa i nonce-a u
„prošlo je“. 🟢

### Odgovori

Samo ishod, `requestId` i interni ID-evi. **Bez** naziva kupca, iznosa, broja
računa, imena fajla, hash-a, potpisa, SQL-a i stack trace-a. 🟢

### Heartbeat

Dokazuje **tačno jedno**: uređaj se autentifikovano javio u tom trenutku.
Odgovor nosi izričito `meaning: "authenticated_contact_only"`, jer bi neko inače
iz `ok: true` izveo uspešnu sinhronizaciju. Ne znači uvoz, lager ni završen
sync. Nepotpisan zahtev **ne** osvežava status. 🟢

---

## 6. Poreklo, valuta, datumi

Aditivne kolone na `source_documents` i `invoices`. Metapodaci koji zavise od
**verzije** stoje uz izvorni dokument; projekcija ih preuzima od verzije koja
važi, i prepisuju se pri izboru druge verzije zajedno sa iznosima. 🟢

| Podatak | Zatečeni redovi | Novi (device) |
|---|---|---|
| `origin` | `legacy_unknown` | `device` |
| `currency` / `currency_provenance` | `NULL` / `NULL` | `RSD` / `source_default` |
| `trade_date` / `date_basis` | `NULL` / `NULL` | `NULL` / `issued_on` |
| `semantic_hash` | `NULL` | verifikovan, serverski izračunat |

**Nema globalnog backfill-a RSD**, izmišljanja datuma prometa ni izvođenja
porekla iz naziva fajla. `canonical:<hash>` u `file_name` ostaje **prikazna
kompatibilnost** sa `NOT NULL` kolonom, ne dokaz porekla — poreklo ima svoje
polje.

`RSD` je i dalje **konfiguracija izvora** (`source_default`), ne tvrdnja da je
pročitan sa PDF-a. Čitač valutu ne čita uopšte.

**Postojanje kolone nije dokaz podrške.** EUR, stvarni `trade_date`,
storno/povrat i continuation ostaju odbijeni kontrolisanim P1 ishodima — i kada
stignu kao potpisan JSON. 🟢

### Semantic hash ≠ semantička deduplikacija

Hash se čuva i proverava, ali politika duplikata i revizija je **nepromenjena**.
Indeks je namerno **ne-jedinstven**: jedinstven bi tiho uveo semantičku
deduplikaciju, jer reprint u drugim bajtovima ima isti semantic hash i drugi
`file_hash`.

> **Reprint sa drugim bajtovima i dalje može zahtevati postojeći pregled
> konflikta verzija.** Semantička deduplikacija ostaje **nepokriven zahtev**, ne
> prećutno završena funkcionalnost. 🔴

### Zaštita od tuđeg source hash-a

Isti otisak fajla **ne daje bezuslovno** `duplicate_file`. Canonical put prima
`source_hash` kao tvrdnju izvora — server nema bajtove i ne može je nezavisno
proveriti ([19 §3](19-canonical-ingest-contract.md)).

| Stanje | Ishod |
|---|---|
| Oba verifikovana, **različita** | `source_hash_content_mismatch`, `comparable: true` |
| Zatečeni zapis **bez** hash-a | `source_hash_content_mismatch`, `comparable: false` |
| Oba verifikovana, ista | `duplicate_file` |

`comparable: false` je **druga tvrdnja** od „sadržaj se razlikuje“ — znači da se
poređenje uopšte nije moglo izvesti. Postojeća faktura se ni u jednom slučaju ne
dira, trag ne nosi nijedan hash, i tuđi ID ne curi u odgovor. 🟢

Da bi zaštita bila upotrebljiva, i **ručni upload** sada računa verifikovan
semantic hash — server drži bajtove i sam ih je pročitao, pa je hash njegov
nalaz. `NULL` posle P2 znači tačno jedno: red je nastao ranije.

---

## 7. Šta P3 sada može da koristi

- `lib/sync/device/signing.mjs` — **čist** modul, bez baze i Next-a. Isti kod
  računa potpisni niz na Windows uređaju i na serveru.
- `lib/sync/contract/fromParsedDocument.mjs` + `lib/pdf/parseDocument.ts` — PDF →
  canonical payload, bez `server-only`.
- Profil, zaglavlja i konstante prozora/nonce-a — `PROTOCOL_VERSION`,
  `HEADERS`, `TIMESTAMP_WINDOW_MS`, `SIGNED_PATHS`.
- Ishodi endpointa kao stabilni kodovi, za odluku agenta šta da ponovi.

Agent treba da: generiše par na uređaju, preda **javni** ključ i otisak za
aktivaciju, potpisuje po profilu iz §2, i na `nonce_replayed` ne ponavlja isti
nonce nego šalje nov.

---

## 8. Šta ostaje otvoreno

| | Faza |
|---|---|
| Windows proces, scan, raspored, outbox | P3 🔴 |
| Panel uređaja u portalu | P4 🔴 |
| Command polling i ACK/progress | P3/P4 — **nije započeto u P2** 🔴 |
| Semantička deduplikacija | nepokriveno 🔴 |
| EUR, stvarni `trade_date`, storno/povrat/continuation | traže uzorak i odluku 🔴 |
| Šira politika `devices:manage` za kancelariju | P4, odluka vlasnika 🔴 |

> **Prolazak testova na macOS/Linuxu ne dokazuje Windows ponašanje.** To ostaje
> prihvatna provera P3.

---

## 9. Provera

```bash
npm run test:signing            # 18 — potpisni profil
npm run test:contract           # 42 — ugovor
npm run test:contract-adapter   # 11 — lokalni adapter
npm run qa:pg                   # PG integracije + browser QA
```

Feature gate se uključuje **isključivo** u izolovanom test okruženju. Svi ključevi
su sintetički i nastaju u test procesu; nijedan stvarni uređaj, ključ ni PDF nije
korišćen.
