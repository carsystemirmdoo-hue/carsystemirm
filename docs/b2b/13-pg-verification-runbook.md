# 13 — PostgreSQL verifikacija Faze 1B: runbook

**Status: 🟡 harness je kompletan i spreman; nedostaje jedino disposable baza.**

Ovaj dokument opisuje šta treba uraditi jednom, ručno, i šta se posle toga
izvršava samo.

---

## Zašto ne može bez prave baze

Invarijante koje Faza 1B tvrdi ne žive u JavaScriptu nego u PostgreSQL-u:

| Invarijanta | Gde zaista živi |
|---|---|
| uvek ostaje bar jedan aktivan `gazda` | `pg_advisory_xact_lock` + transakcija |
| kod za lozinku važi tačno jednom | `UPDATE … WHERE used_at IS NULL … RETURNING` |
| TOTP se ne može ponoviti | `UPDATE … WHERE last_accepted_counter < $n` |
| trag revizije se ne može izmeniti | okidači na `audit_log` |
| dozvola ne može biti izmišljena | strani ključ ka `permission_packages` |

Nijedan mock ih ne pokazuje. Lokalni PGlite most takođe ne — služi jednu vezu, a
sa više njih ruši protokol jer deli neimenovanu pripremljenu izjavu. **Ne treba
ga ponovo pokušavati.**

## Šta projekat trenutno ima

- Provajder **nije izabran** — `docs/b2b/09-owner-decisions-and-blockers.md`
  vodi tu odluku kao otvorenu. `docs/portal/SETUP.md` i `.env.example` pominju
  Neon i Supabase kao besplatne opcije.
- Lokalni `DATABASE_URL` gađa PGlite most na `127.0.0.1`, ne pravi Postgres.
- Klijent je `postgres` (postgres.js) — radi sa bilo kojim PostgreSQL-om.

## Šta ti treba da uradiš — jednom

### Varijanta A: Neon (preporučeno)

Neon ima „branch" instance koje su zasebne baze sa sopstvenim kredencijalima i
brišu se jednim klikom.

1. `console.neon.tech` → napravi projekat (ili otvori postojeći).
2. **Branches** → **New branch**.
3. Ime: `qa-1b-verify`. Ime je bitno — kapija odbija metu bez oznake
   `test/qa/staging/preview/dev/sandbox` u imenu baze ili hosta.
4. **Create new branch** bez opcije „Copy data from parent" ako je ponuđena;
   traži se prazna baza.
5. **Connection string** → **obavezno `Direct connection`**, ne `Pooled`.
6. Po završetku QA: **Branches** → `qa-1b-verify` → **Delete**.

### Varijanta B: Supabase

1. `supabase.com/dashboard` → **New project**.
2. Ime: `carsystem-qa-1b`. Region bilo koji.
3. **Project Settings → Database → Connection string → URI**.
4. Po završetku: **Project Settings → General → Delete project**.

### U oba slučaja

- **Ne kopiraj produkcione podatke.** Baza mora biti prazna.
- **Ne koristi istu bazu kao razvoj ili produkcija.** Kapija to odbija, ali
  provera nije razlog da se pokuša.
- **Direktna veza, ne spojnica.** Host ne sme sadržati `-pooler`, `.pooler.`
  ni `pgbouncer` — kapija ga odbija sa razlogom
  `pooled-connection-not-allowed`.

#### Zašto spojnica ne prolazi

Spojnica u „transaction" režimu ne garantuje da će sve naredbe jedne
transakcije završiti na istoj pozadinskoj vezi. `pg_advisory_xact_lock` je
vezan za konkretnu vezu: ako se naredbe razdvoje, brava se uzme na jednoj vezi,
a prebrojavanje i upis odu na drugu. Guard tada ne serijalizuje ništa, a
izgleda kao da radi — što je tačno ono što je prvi prolaz i pokazao
(„obe deaktivacije su prošle").

Zabrana važi **samo za QA i migracije**. Produkcijska aplikacija sme i treba da
koristi spojnicu; njoj advisory brava nije jedini oslonac, a spojnica joj štedi
veze. Uz to, `withOwnerGuard` sada i u produkciji **odbija radnju** ako brava
nije stvarno držana na tekućoj vezi, umesto da tiho nastavi.

## Gde postaviti promenljivu

U terminalu iz koga pokrećeš QA, **samo za tu sesiju**:

```bash
export TEST_DATABASE_URL='...'
```

Ne upisuj je u `.env`, `.env.local`, dokumentaciju ni bilo koji fajl u
repozitorijumu. Ne lepi je u razgovor.

Provera da promenljiva postoji, bez ispisivanja vrednosti:

```bash
node -e 'console.log(process.env.TEST_DATABASE_URL ? "present" : "missing")'
```

## Šta se posle toga izvršava samo

```bash
npm run qa:pg
```

Taj lanac radi tri stvari redom:

| Korak | Komanda | Šta radi |
|---|---|---|
| 1 | `qa:pg:migrate` | sigurnosna kapija, pa ceo lanac migracija (0000–0007) |
| 2 | `qa:pg:reset` | kontrolisano prazni test tabele, da se prolaz može ponoviti |
| 3 | `test:integration` | integracioni testovi nad pravom bazom, sekvencijalno |
| 4 | `qa:pg:browser` | tokovi u pravom pretraživaču, sa snimcima |

Korak 2 postoji zato što prekinut prolaz ostavlja naloge i tragove iza sebe.
Bez njega bi drugi pokušaj počeo nad zatečenim stanjem i padao iz razloga koji
nemaju veze sa onim što se testira.

Browser korak traži da je build već napravljen (`npm run build:check`).

## Sigurnosna kapija

`db/integration/safety.mjs` odbija metu koja:

- ima isti otisak kao `DATABASE_URL` ili `MIGRATION_DATABASE_URL`;
- radi pod `VERCEL_ENV=production`;
- nosi `prod`/`production`/`live` u imenu hosta ili baze;
- **nema** oznaku odvojenosti u imenu.

Poređenje ide preko SHA-256 otiska, ne nad samim vrednostima, pa poruka o grešci
nikada ne sadrži connection string. Kapija je pokrivena sa 10 jediničnih testova
(`npm run test:db-safety`) koji rade i bez baze — jer deo koji sprečava nesreću
mora biti tačan pre nego što nesreća postane moguća.

Drugi sloj traži vezu: broje se redovi u poslovnim tabelama (`customers`,
`invoices`, `articles`, …). Ako ijedna nije prazna, staje se **bez ijedne
izmene i bez čišćenja**. Ime se može slagati; sadržaj ne laže.

## Kako testovi zovu pravi kod

`db/integration/tsconfig.test.json` zamenjuje `server-only` praznim modulom, pa
se `lib/auth/*.ts` i `lib/authz/*.ts` uvoze u test proces. Aplikacijski
`tsconfig.json` se ne dira.

Bez toga bi integracioni test morao da **prepiše SQL koji testira** — i onda ne
bi testirao produkcijski kod nego svoju kopiju, propuštajući baš onu grešku koja
nastaje kada se kopija i original raziđu.

## Sintetički podaci

Svi nalozi nose prefiks `qa1bverify-` i domen `@qa-1b.invalid` — domen koji ne
postoji i ne može primiti poštu. Lozinke su nasumične i nigde se ne ispisuju.
Čišćenje briše samo redove sa tim prefiksom; `audit_log` ostaje, jer na njemu
stoji zabrana brisanja i to je smisao tog traga.

## Ako provajder ne dozvoljava `CREATE ROLE`

Managed provajderi često daju jedan nalog sa širokim pravima i to se ne može
promeniti spolja. Tada:

- razdvajanje runtime i migration naloga (`docs/b2b/10-db-roles-runbook.md`)
  ostaje **neproveren** na tom provajderu;
- to se prijavljuje odvojeno i ne meša sa ostalim rezultatima;
- `preflight.integration.test.mts` ispisuje da li je nalog superuser, da stanje
  bude vidljivo umesto pretpostavljeno.

## Posle QA

```bash
unset TEST_DATABASE_URL
```

pa obriši branch/projekat kod provajdera.

## Ugovor o brisanju naloga

Prvi prolaz je otkrio protivrečnost u modelu: `audit_log.actor_user_id` je imao
`ON DELETE SET NULL`, a nad istom tabelom stoji okidač koji zabranjuje `UPDATE`.
Brisanje korisnika je zato pokretalo izmenu koju okidač odbija.

Migracija `0007` to razrešava u korist nepromenljivog traga:

- interni nalozi se **ne brišu**; za prestanak rada postoje deaktivacija i
  reaktivacija;
- FK iz `audit_log` i `system_settings` koristi `RESTRICT`;
- pokušaj brisanja korisnika koji figurira u tragu baza **odbija**;
- red u tragu ostaje identičan, i pre i posle pokušaja;
- append-only okidač ostaje netaknut — `TRUNCATE` u QA resetu ga ne pokreće i
  ne isključuje ga.

Uklanjanje ličnih podataka, ako ikad zatreba, ide zasebnim kontrolisanim
postupkom anonimizacije koji i sam ostavlja trag — nikad brisanjem identiteta iz
istorije.

Nijedna aplikaciona akcija ne briše korisnike; provereno pretragom izvora.

## Ograde pokrivenosti

Prolaz „13/13" nije isto što i „svaka zaštita dokazana". Jedna tvrdnja zavisi od
uslova koji test ne može da izazove.

### BFCache restore

Korak „povratak Nazad ne vraća rezervne kodove" **jeste** potvrđen: posle
`goBack()` kodovi nisu ni vidljivi, ni prisutni u DOM-u, a jednokratni ekran nije
vraćen.

Ali `useEphemeralReveal` postoji zbog jednog određenog slučaja — kada pretraživač
vrati **živu** stranu iz back/forward keša, sa netaknutim React stanjem. Da li će
Chromium to uraditi ne odlučuje test: strana sa `no-store` zaglavljem i otvorenom
vezom često biva odbačena i ponovo iscrtana. Tada zaštita nije ni pozvana.

Runner to meri i **izričito prijavljuje**:

- `pageshow.persisted === true` → strana je stvarno došla iz keša, zaštita je
  bila na ispitu;
- inače → korak prolazi, ali se u sažetak upisuje ograda pod
  „Ograde pokrivenosti".

Sam mehanizam brisanja pokriven je jediničnim testovima nad hookom
(`lib/auth/accountRecovery.test.mjs`), koji tvrde da se sluša i `pagehide` i
`pageshow` sa `persisted`, i da se ne sluša `visibilitychange`.

**Šta ovo NIJE:** kvar. Ograda postoji da „13/13" ne bi ostavilo utisak jači od
onoga što je stvarno izmereno.

### Jednokratni dijagnostički alati

Tokom verifikacije su postojale dve privremene skripte (`probe-login`,
`probe-redirect`) za izolovanje tada otvorenih kvarova. Uklonjene su pošto su ti
kvarovi zatvoreni i zaključani ugovornim testovima; sve što su davale runner sada
prijavljuje sam — lanac adresa, faza odbijanja iz brojača pokušaja, HTTP status i
trajanje navigacije, stanje u bazi, filtriran serverski dnevnik i snimak ekrana.

## Opcione portal rute u browser QA

### Trajne invarijante

Runner ih proverava pri svakom prolazu:

1. **Runner ne uvozi cart ni commerce module.** Statički uvoz bi vezao QA za
   zaseban tok — ne bi se mogao pokrenuti dok ti moduli ne postoje, i padao bi
   iz razloga koji nema veze sa bezbednošću. Odluka se donosi po HTTP odgovoru,
   što radi u obe situacije.
2. **`/portal/korpa` je opciona browser ruta.** Ostaje na spisku i kada ne
   postoji.
3. **Kada ne postoji i vraća 404**, mora biti javna 404 bez poslovnog sadržaja —
   bez portal ljuske i bez teksta koji odaje korpu, dozvole, kupce ili
   porudžbine. Tek tada se upisuje ograda pokrivenosti:

   > Ruta /portal/korpa nije prisutna u portal baseline-u; browser pristup nije
   > bio na ispitu. Kanonska full-session politika za buduće portal rute
   > pokrivena je unit testom.

   Ako 404 ipak nosi poslovni sadržaj, korak **pada** — to bi bilo curenje.
4. **Čim ruta postoji** (bilo koji odgovor osim 404), važi isto pravilo kao za
   obavezne rute: enrollment-only sesija mora završiti na
   `/portal/bezbednost/mfa`. Ništa se ne podešava ručno; odluka ide po statusu.
5. **Broj proverenih ruta mora biti istinit.** Izveštaj sabira obavezne i
   *stvarno proverene* opcione, pa javlja na primer
   „3 rute preusmereno na vezivanje; 1 još ne postoji (vidi ogradu)".

Sve navedeno zaključano je u `scripts/qa/browserQaContract.test.mjs`.

### Obim commita — jednokratna potvrda

Ovo NIJE trajni test. Provera da neki fajl ne postoji oborila bi build onog dana
kada planirana funkcionalnost stigne.

Stanje u trenutku zatvaranja Faze 1B: commit **ne sadrži** `components/cart/`,
`lib/commerce/` ni `app/portal/korpa/`. Korpa i portal commerce dolaze zasebnim
tokom i nisu deo ovog obima.

Kada stignu, jedina posledica po QA je da `/portal/korpa` prestane da vraća 404 —
i time automatski pređe iz ograde u punu proveru.
