# 00 — Revizija stvarnog stanja

**Datum:** 2026-08-24 · **Grana:** `feature/faza-2h-putty-reveal` @ `c09fdea`
**Metod:** read-only pregled koda, importa i runtime ponašanja. Nijedan postojeći fajl nije izmenjen.

> ## ⚠️ Ovo je snimak stanja na dan 2026-08-24, PRE Faze 1A
>
> Dokument se namerno **ne prepisuje** — on je zapis zatečenog stanja i osnov za
> odluke. Faza 1A je u međuvremenu zatvorila deo opisanih slabosti:
>
> | Nalaz u ovom dokumentu | Stanje posle 1A |
> |---|---|
> | §4 „Dva paralelna modela dozvola" | Legacy izolovan u `features/portal/LegacyAccessGuard.tsx`, nedostižan iz `app/` |
> | §4 „`orders:create` — semantički sudar" | Razdvojeno na `procurement:order_create` i `customer_orders:create` |
> | §3 „Cookie postavke nisu eksplicitne" | `lib/auth/cookie-policy.mjs`, `__Host-` u produkciji |
> | §3 „Nema opoziva sesije" | `users.session_version` + provera u `getPortalUser` |
> | §3 „Nema CSP ni HSTS" | `lib/security/http-headers.mjs` |
>
> **Nepromenjeno i dalje:** nema MFA, nema rate limitinga, uloga `customer` ne
> postoji, kupčeva tenant izolacija ne postoji. Vidi
> `08-phased-implementation-plan.md` za Fazu 1B.

Legenda oznaka koja važi u svim dokumentima ovog seta:

- 🟢 **POTVRĐENO** — dokazano fajlom i simbolom iz repozitorijuma
- 🔵 **PREDLOŽENO** — naša preporuka, čeka odobrenje
- 🔴 **BLOKIRANO** — ne može se odlučiti bez podatka koji nedostaje
- 🟡 **ODLUKA VLASNIKA** — tehnički izvodljivo, poslovno neodlučeno

---

## 1. Verdict u sedam rečenica

1. Portal **nije demo**: postoji stvarna prijava (NextAuth v5 + scrypt), stvarna Postgres baza (12 tabela, 3 migracije) i dosledna serverska autorizacija. 🟢
2. Portal **nije ni produkcijski spreman**: nema MFA, nema rate limitinga, nema resetovanja lozinke, nema invite/approval toka i nema opoziva sesije. 🟢
3. Postojeći model uloga je **u celini interni** — `gazda`, `komercijalista`, `kancelarija`, `magacioner`. **Uloga `customer` ne postoji nigde.** 🟢
4. Tenant izolacija postoji, ali **samo za interne uloge** (komercijalista → dodeljeni kupci). Kupčeva izolacija ne postoji jer kupac kao subjekt ne postoji. 🟢
5. Javni sajt **ne koristi `output: "export"`** — statički je *generisan* (SSG), ali uz pun server runtime. Middleware, route handleri i baza već rade. 🟢
6. **BizniSoft i BEX: nula linija integracionog koda.** Postoje samo imena promenljivih u `.env.example` i objašnjenja na ekranima. 🟢
7. Ne postoje tabele za: cene, rabate, marže, porudžbine, korpu, lager, preporuke ni sync. 🟢

---

## 2. Repo i alati 🟢

| Stavka | Vrednost | Dokaz |
|---|---|---|
| Package manager | npm | `package-lock.json`, jedini lockfile |
| Framework | Next.js 15.5.19, App Router | `package.json` |
| React | 18.3.1 | `package.json` |
| ORM | Drizzle 0.45 + `postgres` 3.4 | `drizzle.config.ts`, `db/client.ts` |
| Auth | NextAuth v5 beta.32, Credentials | `auth.ts` |
| Validacija | zod 4 | `auth.ts`, `app/api/portal/izvoz/route.ts` |
| Testovi | `node --test`, bez frameworka | `package.json` → `test:*` |
| Monorepo | **Ne** — jedna aplikacija u korenu | nema `workspaces` |
| Deploy | Vercel | `.vercel/project.json`, `deployment/vercel/README.md` |

### Stanje radnog stabla

`git status --short` → **108 stavki**, sve nekomitovane. Sadrže:

- raniji vizuelni rad (Baslac, SATA, kampanjski karuseli),
- **upravo završeni i validirani product-variant rad** (`ProductVariantProvider` i pratilje).

**Sve je sačuvano.** Ovaj rad nije dodirnuo nijedan od tih fajlova — vidi §9.

---

## 3. Auth: produkcijski po konstrukciji, nedovršen za produkciju

### Šta postoji 🟢

| Element | Fajl / simbol | Ocena |
|---|---|---|
| Provider | `auth.ts` → `Credentials({ authorize })` | radi |
| Hash lozinke | `lib/auth/password.mjs` → `hashPassword`, `verifyPassword` | scrypt N=16384, r=8, p=1, `timingSafeEqual` — solidno |
| Lockout | `auth.ts` → `MAX_FAILED_ATTEMPTS = 8`, `LOCK_MINUTES = 15` | po nalogu, upisuje u audit |
| Uniforman odgovor | `app/portal/actions.ts` → `GENERIC_ERROR` | ne otkriva postojanje naloga |
| Sesija | `auth.config.ts` → `strategy: "jwt"`, `maxAge: 8h` | potpisan `AUTH_SECRET`-om |
| Open-redirect zaštita | `auth.config.ts:redirect` → `normalizeCallback` | testirano, `lib/authz/redirects.test.mjs` |
| Edge/Node podela | `auth.config.ts` bez baze; `auth.ts` sa bazom | ispravno |
| Odjava | `app/portal/actions.ts` → `signOutAction` | radi |

**Najbolja postojeća odluka** (`auth.config.ts:session`): uloga i dozvole se **namerno ne stavljaju u JWT**, već se čitaju iz baze pri svakom zahtevu (`lib/authz/user-repository.ts:loadPortalUser`). Oduzimanje dozvole deluje **odmah**, bez odjave. Ovo se mora sačuvati.

### Šta ne postoji 🟢

Provereno pretragom nad `app`, `lib`, `db`, `auth.ts`, `auth.config.ts`, `middleware.ts` — **nula pogodaka**:

| Nedostatak | Posledica |
|---|---|
| **MFA / TOTP** | Ukradena lozinka je dovoljna za pun pristup |
| **Rate limiting po IP-u** | Postoji samo lockout po nalogu (8/15 min); distribuirani spor napad prolazi ispod praga |
| **Reset lozinke** | Ne postoji nijedan tok; zaboravljena lozinka = ručna intervencija u bazi |
| **Invite / approval tok** | Naloge otvara Gazda ručno; nema pozivnice ni prve promene lozinke |
| **Opoziv sesije** | JWT važi punih 8h; nema `session_version` ni liste sesija |
| **Eksplicitne cookie postavke** | `auth.config.ts` nema `cookies`/`useSecureCookies` — oslanja se na NextAuth default |

### Odgovori na postavljena pitanja

| Pitanje | Odgovor |
|---|---|
| Da li je auth produkcijski ili demonstracioni? | **Produkcijski po konstrukciji, nedovršen za produkciju.** Nije mock — pravi hash, prava baza, prava sesija. Ali bez MFA i rate limitinga ne sme pred eksterne korisnike. |
| Gde se stvarno čuvaju korisnici? | Postgres tabela `users` (`db/schema/users.ts`). Nije fajl, nije memorija, nisu fixtures. |
| Može li se sesija falsifikovati? | **Ne bez `AUTH_SECRET`** — JWT je potpisan. Ali **ne može se ni opozvati**: ukraden token važi do 8h. |
| Da li server proverava capability ili samo UI? | **Server.** 25 poziva `requireCapability()` u `app/`; **nijedna** `/portal` ruta nije bez kapije (provereno nad svim `page.tsx`). Skrivanje iz navigacije je izričito označeno kao kozmetika (`lib/authz/permissions.mjs:navGroupsFor`). |
| Postoji li prava baza? | **Da.** `db/client.ts` otvara pravi `postgres` pool; 3 migracije; PGlite za razvoj (`npm run db:dev`). |

---

## 4. Uloge i capability model 🟢

`db/schema/users.ts:userRole` — **tačno četiri vrednosti, sve interne**:

```
gazda | komercijalista | kancelarija | magacioner
```

Osam paketa dozvola (`lib/authz/permissions.mjs:PERMISSION_PACKAGES`):
`analitika`, `otprema`, `nabavka_predlog`, `porucivanje`, `limiti`, `korisnici`, `pragovi`, `zatvaranje`.

Model je **dvoslojan i dobar**: `resolveCapabilities(role, packages)` → skup sposobnosti. Rute se vezuju za sposobnosti, nikad za ulogu (`ROUTE_CAPABILITY`).

### Dva paralelna, nesaglasna modela ⚠️ 🟢

| Model | Fajl | Uloge | Stanje |
|---|---|---|---|
| **Živi** | `lib/authz/permissions.mjs` | `gazda`, `komercijalista`, `kancelarija`, `magacioner` | koristi ga sav živi kod |
| **Legacy** | `permissions/portal-permissions.ts` + `types/portal.ts` | `owner`, `sales`, `office` | koristi ga samo `components/portal/PortalPrimitives.tsx:386` (`PermissionGate`) |

Legacy model sadrži baš pojmove koji nam trebaju — `prices:propose`, `prices:manage`, `prices:view_margin`, `approvals:decide`, `integrations:biznisoft` — ali sa **pogrešnim skupom uloga** i **bez ijedne serverske provere**.

**Rizik:** `PortalPrimitives.tsx` je uvezen u žive ekrane (`PageHeader`, `Panel`). Ako neko upotrebi njegov `PermissionGate`, dobija autorizaciju po modelu koji **ne poznaje `gazda`** — dakle uvek odbija ili uvek propušta, zavisno od unosa.

### `orders:create` — semantički sudar ⚠️ 🟢

`lib/authz/permissions.mjs:PACKAGE_GRANTS.porucivanje` daje `orders:create` uz `procurement:confirm` — dakle **poručivanje robe od dobavljača (nabavka)**.

Ali `lib/commerce/portal-commerce.ts:16` koristi **istu** dozvolu kao kapiju za korpu:

```
export const PORTAL_COMMERCE_CAPABILITY = "orders:create";
```

Kupčeva porudžbina i nabavka od dobavljača su **različiti poslovi**. Jedna dozvola ne sme pokrivati oba.

---

## 5. Tenant izolacija 🟢

### Šta radi

| Kontrola | Fajl / simbol |
|---|---|
| Opseg u SQL-u, ne posle učitavanja | `lib/sales/queries.ts:loadSalesLines` → `inArray(invoices.customerId, scope)` |
| Provera pristupa kupcu | `lib/authz/session.ts:requireCustomerAccess` → `lib/authz/scope.mjs:canAccessCustomer` |
| Filtriranje redova | `lib/authz/scope.mjs:filterCustomerRows`, `filterRowsByCustomer` |
| Izvoz koristi isti upit kao ekran | `app/api/portal/izvoz/route.ts` |
| Testovi | `lib/authz/*.test.mjs` — 35 testova |

Komentar u `lib/sales/queries.ts:56-58` to i objašnjava: *„Ograničenje se primenjuje u samom upitu… podaci izvan opsega nikada ne napuste bazu."*

### Šta ne radi

1. **`requireCustomerAccess` se koristi na tačno JEDNOJ ruti** — `app/portal/kupci/[id]/page.tsx:21`. Svaka buduća ruta sa `[id]` mora je zvati sama; ništa to ne prisiljava.
2. **Kupčeva izolacija ne postoji.** `customers` tabela **nema nikakvu vezu ka `users`**. Jedina veza je `customer_assignments`, koja vezuje **internog komercijalistu** za kupca — ne kupca za nalog.

| Pitanje | Odgovor |
|---|---|
| Postoji li prava tenant izolacija? | **Za interne uloge da, za kupce ne postoji** — jer kupac kao subjekt ne postoji. |
| Može li korisnik promenom ID-a pristupiti drugom kupcu? | **Danas ne**, jer ekstern­ih korisnika nema, a interne štiti `scope` u SQL-u. **Sutra da**, ako se kupci dodaju bez strukturne zaštite. Vidi `07-threat-model.md`, T4. |

---

## 6. Static javni sajt naspram dinamičkog portala 🟢

### Premisa zadatka je delimično netačna — bitno je razjasniti

Zadatak kaže „javni site kao Next.js static build". To je tačno u smislu **SSG** (1.114 prerenderovanih stranica), ali **netačno** ako se misli na `output: "export"`.

**Dokaz da `output: "export"` ne postoji:**

- `grep output next.config.ts` → samo `outputFileTracingRoot`
- `deployment/vercel/README.md`: *„Projekat više ne koristi `output: \"export\"` za Vercel, jer maintenance zaštita zavisi od Next middleware-a i route handlera."*
- Folder `out/` postoji, ali je od **29. juna 2026** i **nije praćen gitom**

**Dokaz da server runtime već radi:**

| Zavisnost | Fajl |
|---|---|
| Middleware (auth redirect, maintenance, kanonski host) | `middleware.ts`, 200 linija |
| Route handleri sa `runtime = "nodejs"` | `app/api/auth/[...nextauth]/route.ts`, `app/api/portal/izvoz/route.ts` |
| `force-dynamic` | **21 portal ruta**, uključujući `app/portal/layout.tsx` |
| Server actions | `app/portal/actions.ts`, `admin/actions.ts`, `dozvole/actions.ts`, `importi/actions.ts` |
| Baza | `db/client.ts` |

### Odgovor

| Pitanje | Odgovor |
|---|---|
| Da li `/portal` može raditi na postojećem static hostingu? | **Ne.** Traži Node runtime, middleware i Postgres. Na čistom static hostingu (`output: export` + Apache) portal **fizički ne postoji**. |
| Postoji li konflikt static/dynamic danas? | **Ne.** Konflikt je razrešen napuštanjem `output: export`; obe grane koegzistiraju na Vercelu. |

**Posledica za plan:** razdvajanje javnog sajta i portala **nije nužno iz tehničkih razloga**. Ostaje opravdano iz **bezbednosnih**. Vidi `01-target-architecture.md`, AD-1.

---

## 7. Šta od B2B toka postoji, a šta ne

### Postoji 🟢

| Oblast | Dokaz |
|---|---|
| Prijava, sesija, odjava | `auth.ts`, `app/prijava/page.tsx` |
| Capability autorizacija | `lib/authz/*`, 35 testova |
| Append-only audit **sproveden okidačima u bazi** | `db/migrations/0001_audit_log_append_only.sql` |
| Uvoz faktura, transakciono i idempotentno | `lib/import/invoiceImport.ts:114` (`db.transaction`), `import_runs.file_hash` `uniqueIndex` |
| Izvoz izveštaja sa opsegom u SQL-u | `app/api/portal/izvoz/route.ts` |
| Korpa **bez cena**, iza dvostruke kapije | `lib/cart/cart-model.mjs`, `lib/commerce/portal-commerce.ts` |

### Ne postoji 🟢

Provereno grepom nad `db/schema/*.ts` — **nijedna tabela** za:

cene po kupcu · rabate · marže · cenovna pravila · odobravanje promena cena · korpu na serveru · porudžbine kupca · stavke porudžbine · statuse porudžbina · lager · preporuke · sync batch-eve · BEX pošiljke

### Korpa nikad ne stiže na server ⚠️ 🟢

- Model: `lib/cart/cart-model.mjs`, skladište `localStorage`, ključ `carsystem.cart.v1`
- **Bez cene** — potvrđeno testom `lib/cart/cart-model.test.mjs:64-65` (`"price" in item === false`)
- `grep cart|korpa` nad `app/api`, `lib/sales`, `lib/import` → **nula pogodaka**

Za fazu 1 je to **dobro** (nema šta da se falsifikuje), ali znači da **serverski deo korpe treba tek napisati**.

---

## 8. BizniSoft i BEX — nula implementacije 🟢

### BizniSoft

`grep -ri 'biznisoft'` nad `app`, `lib`, `db`, `scripts`, `components`, `types` daje **isključivo**:

| Vrsta pogotka | Primer |
|---|---|
| Tekst na `PhaseNotice` ekranima | `app/portal/nabavka/page.tsx:23` — „Uvoz faktura iz BiznisSoft izvoza (faza 2)" |
| Komentar u shemi | `db/schema/permissions.ts:49` |
| Komentar u parseru | `lib/import/invoiceRow.mjs:2` |
| **Jedno polje u modelu** | `lib/carsystem-data.ts:248` — `biznisSoftSku?: string` (nigde se ne popunjava) |
| Mrtav demo modul | `components/portal/PortalProvider.tsx:15` — `bizniSoftSyncRecords` iz `fixtures/dev/` |

**Nema:** API klijenta, konekcionog koda, SQL drajvera ka BizniSoftu, dokumentacije proizvođača, sync skripte, Windows task opisa.
`grep 'fetch(\|axios'` nad `app/portal`, `lib/sales`, `lib/import`, `lib/commerce` → **nula odlaznih poziva**.

### BEX

`grep -ri 'bex'` daje **isključivo** tri `PhaseNotice` ekrana (`bex`, `otprema`, `adresnice`) i `admin`. **Nula linija koda koji poziva BEX.**

### Imena promenljivih koja postoje samo u dokumentaciji ⚠️

`INGEST_API_KEY`, `FEATURE_FOLDER_CONNECTOR`, `FEATURE_BEX`, `BEX_BASE_URL`, `BEX_CLIENT_ID`, `BEX_API_KEY` stoje u `.env.example` i `docs/portal/SETUP.md`, ali **grep nad kodom ih ne nalazi**. To su **namere, ne funkcije**.

Promenljive koje kod **stvarno čita** (`grep process.env` nad `app`, `lib`, `db`, `middleware.ts`, `auth*.ts`):

```
AUTH_SECRET · AUTH_URL · DATABASE_URL · DATABASE_POOL_MAX
BOOTSTRAP_ADMIN_EMAIL · BOOTSTRAP_ADMIN_NAME · BOOTSTRAP_ADMIN_PASSWORD
MAINTENANCE_MODE · SITE_ACCESS_PASSWORD · PREVIEW_ACCESS_PASSWORD
PORTAL_COMMERCE · NEXT_PUBLIC_SITE_URL · NEXT_PUBLIC_SEO_INDEXING
NODE_ENV · VERCEL_ENV
```

*(Samo nazivi. Nijedna vrednost nije pročitana ni ispisana.)*

### Podaci — pretraga stvarnih izvoza

Pretraženi svi `*.csv`, `*.xlsx`, `*.xls`, `*.xml` van `node_modules`:

| Fajl | Šta je | Ocena |
|---|---|---|
| `fixtures/dev/import/probni-izvoz-2026.csv` | 18 kolona, `;` separator | **Izmišljeni podaci.** `fixtures/dev/README.md` to izričito kaže |
| `_incoming/Klijenti.csv` | 113 redova, **jedna kolona**, zaglavlje doslovno `Klijenti` | Nije tabelarni izvoz. Gitignorisan (`.gitignore:56`) |
| `data/internal/location-import-review.csv` | prodavnice/lokacije | Nevezano |

**Zaključak: nije pronađen nijedan stvarni BizniSoft izvoz.** 🔴

Kolone koje parser danas očekuje (`lib/import/invoiceRow.mjs:REQUIRED_COLUMNS`) su **naša pretpostavka izvedena uz izmišljeni fixture**, ne dokumentovan format proizvođača.

---

## 9. Mrtav i poluživ kod

`features/portal/` — 14 komponenti iz ranije verzije:

- **Živo** (uvezeno iz `app/portal/`): `SalesAnalytics`, `SalesFilters`, `ThresholdSettings`, `ImportUpload`, `PortalLoginForm`
- **Mrtvo** (nije ni na jednoj ruti): `CustomersModule`, `OrdersModule`, `PricingModule`, `PortalDashboard`, `IntegrationCenters`, `OperationsAdmin`, `EntityModules`, `PermissionMatrix`, `PortalLogin`

Mrtvi moduli čitaju `fixtures/dev/portal/` kroz `components/portal/PortalProvider.tsx:21`. **Provider se ne montira** u `app/portal/layout.tsx`, a `usePortal()` baca bez providera (`PortalProvider.tsx:604`) — demo podaci **ne mogu** procuriti na živi ekran.

Devet portal ruta su samo `redirect()` (`/portal/cene`, `/portal/biznissoft`, `/portal/proizvodi`, `/portal/odobrenja`, `/portal/komercijalisti`, `/portal/podesavanja`, `/portal/porudzbine/nova`, `/portal/porudzbine/[id]`, `/portal/prijava`).

> **Postojanje rute `/portal/cene` ne znači da cene postoje** — to je `redirect()` od 10 linija.

Sedam ruta su `PhaseNotice` ekrani (`zalihe`, `nabavka`, `porudzbine`, `otprema`, `adresnice`, `bex`, `limiti`, `dugovanja`, `obavestenja`, `izvestaji`) koji pošteno navode šta nedostaje.

---

## 10. Baseline validacija

> **Prethodno izmereno**, na kraju product-variant zadatka, na istom kodu.
> Ovaj rad nije menjao kod, pa se baseline ne ponavlja.

| Komanda | Rezultat |
|---|---|
| `npx tsc --noEmit` | prolazi, 0 grešaka |
| `npm run lint` | 0 grešaka, 9 upozorenja — sva postojala ranije, u vizuelnom kodu i `tmp/qa/` |
| `npm test` | **136 testova, 136 prošlo, 0 palo** |
| `NEXT_DIST_DIR=.next-verify next build` | prolazi, **1.114 statičkih strana** |
| `git diff --check` | čisto |

U ovoj fazi nije pokrenut dev server niti build.

---

## 11. Šta treba uraditi pre Faze 1 🔵

1. **Commitovati postojeći rad.** 108 nekomitovanih stavki, uključujući ceo product-variant sloj i korpu.
2. **Razrešiti `orders:create`** — jedna dozvola danas pokriva nabavku i (buduću) kupčevu porudžbinu.
3. **Ukloniti ili izolovati legacy model dozvola** (`permissions/portal-permissions.ts`, `PortalPrimitives.tsx:PermissionGate`).
4. **Tražiti stvaran BizniSoft izvoz.** Sve o formatu je nagađanje dok ga nema — vidi `09-owner-decisions-and-blockers.md`.
