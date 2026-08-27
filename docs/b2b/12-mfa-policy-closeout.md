# 12 — Jedinstvena MFA politika: closeout Faze 1B

**Status: `code-complete, PostgreSQL verification pending`.** Nije produkcijski spremno.

---

## Šta je bilo pokvareno

Ista odluka — „sme li ovaj korisnik u portal" — donosila se na **dva mesta**:

| stanje | `resolveMfaAccess` (prijava) | grana u `loadAuthenticatedSession` |
|---|---|---|
| `off` + bez MFA | pun pristup | pun pristup |
| `enroll` + bez MFA | **pun pristup** | **samo vezivanje** |
| `enforced` + bez MFA | odbijeno | samo vezivanje |

Red za `enroll` je kontradikcija. Koji odgovor važi zavisilo je od toga koji se
kod izvrši prvi, a ne od pravila.

Uz to, uslov u `authorize` je bio **mrtav**:

```ts
if (!access.allowFullAccess && mode !== "enforced" && mode !== "enroll") return null;
```

Nijedan režim nije zadovoljavao sva tri člana. Posledica: korisnik bez drugog
faktora prolazio je prijavu i u režimu `enforced`, bez ijedne provere da li
uopšte ima dozvolu za vezivanje.

Treći problem je bio strukturni: ekran za vezivanje živi pod `/portal`, a
`app/portal/layout.tsx` je tražio pun pristup. Korisnik u režimu `enroll` bio bi
poslat na vezivanje, a vezivanje je iza layouta koji ga odbija — zaključan
napolju bez izlaza.

## Jedan vlasnik odluke

`lib/auth/mfa-policy.mjs` je jedini modul koji odlučuje. Čist je: bez baze, bez
`process.env`, bez `server-only`. Sve ulazi kao argument, pa se cela matrica
proverava pravim pozivima u testu.

Potrošači:

| Potrošač | Šta pita |
|---|---|
| `auth.ts` → `authorize` | sme li prijava, i sa kojim nivoom pouzdanosti |
| `lib/authz/session.ts` → `loadAuthenticatedSession` | važi li postojeća sesija i šta sme |

Nijedan drugi modul ne poredi režim niti čita `PORTAL_MFA_MODE`. To je
zaključano testom (`mfaPolicy.test.mjs` → „promenljiva se čita samo kroz
politiku").

Stari `lib/auth/mfa-enforcement.mjs` je **obrisan**, ne ostavljen kao omotač —
omotač bi bio poziv da se stara odluka jednog dana vrati.

## Matrica posle izmene

`access` ima tri vrednosti: `denied`, `enrollment-only`, `full`.

| Stanje | `off` (van prod.) | `off` (prod.) | `enroll` | `enforced` |
|---|---|---|---|---|
| nalog isključen | denied | denied | denied | denied |
| zastarela sesija | denied | denied | denied | denied |
| MFA aktivan, bez koda | denied | denied | denied | denied |
| MFA aktivan, TOTP | full (`mfa`) | full (`mfa`) | full (`mfa`) | full (`mfa`) |
| MFA aktivan, rezervni kod | full (`recovery`) | full (`recovery`) | full (`recovery`) | full (`recovery`) |
| bez MFA | **full** | enrollment-only | enrollment-only | denied |
| bez MFA + važeća dozvola | full | enrollment-only | enrollment-only | enrollment-only |
| vezivanje u toku (`pending`) | full | enrollment-only | enrollment-only | enrollment-only |

Dva pravila koja se lako previde:

- **Aktivan MFA bez koda se ne spušta na vezivanje.** Ponuditi mu da veže nov
  uređaj značilo bi put za preuzimanje naloga.
- **Režim `off` ne isključuje faktor onome ko ga je već aktivirao.** Inače bi se
  zaštita ukidala promenom jedne promenljive, bez znanja vlasnika naloga.

## Konfiguracija

Kanonsko ime je `PORTAL_MFA_MODE`. Staro `PORTAL_MFA_ENFORCEMENT` se i dalje
čita kada kanonsko nije podešeno, uz upozorenje u dnevniku.

| Okruženje | Vrednost podešena | Vrednost nedostaje ili je neispravna |
|---|---|---|
| production | primenjuje se | **`enforced`** (fail-closed) |
| development | primenjuje se | `off` |
| test | primenjuje se | `off` |

Okruženje se određuje po `VERCEL_ENV` pre `NODE_ENV`: `next start` postavlja
`NODE_ENV=production` i na preview grani i lokalno, pa bi sam `NODE_ENV`
proglasio produkcijom i ono što to nije.

Provera se izvršava **na granici zahteva**, nikad pri uvozu modula — inače bi
`next build` javnih statičkih strana pao zbog promenljive koja u tom trenutku ne
postoji.

`enroll` i `enforced` bez `PORTAL_MFA_MASTER_KEY_V<n>` **odbijaju prijavu**.
Propustiti je značilo bi da nedostatak ključa tiho ukida drugi faktor.

U dnevnik ide isključivo naziv režima i okruženja — nijedan ključ, kod ni tajna.

## Sposobnost za bezbednost naloga

`users:manage` je bio prešitok: paket „Korisnici i dozvole" ga daje i
magacioneru kome je poveren unos zaposlenih.

Uvedena je uža sposobnost `users:manage_security` i zaseban paket
`bezbednost_naloga` (migracija `0006`, jer `user_permissions.permission_key` ima
strani ključ ka `permission_packages`).

| Sposobnost | Nosi je |
|---|---|
| `users:manage` | uloga `gazda`; bilo koja uloga + paket „korisnici" |
| `users:manage_security` | uloga `gazda`; bilo koja uloga + paket „bezbednost naloga" |

Migracija je aditivna: nijedna postojeća dodela se ne menja i niko ne dobija
nove moći automatski.

## Kapija po radnji

| Radnja | Sposobnost | Svež TOTP | Owner guard |
|---|---|---|---|
| promena svoje lozinke | — (svoja) | da | ne |
| admin reset lozinke | `users:manage_security` | da | ne |
| isključivanje naloga | `users:manage_security` | da | **da** |
| vraćanje naloga | `users:manage_security` | da | da (bez efekta) |
| poništavanje tuđeg faktora | `users:manage_security` | da | ne |
| izdavanje dozvole | `users:manage_security` | da | ne |
| **promena uloge** | `users:manage_security` | **da** | **da** |
| dodela paketa dozvola | `users:manage` | ne | ne |

Promena uloge je premeštena sa `users:manage` na istu kapiju kao reset lozinke:
prebacivanje poslednjeg vlasnika u drugu ulogu nikoga ne isključuje, ali
ostavlja firmu bez upravljanja nalozima; dodela uloge `gazda` radi suprotno.

## Šta je još popravljeno u ovom prolazu

- **Brojanje pokušaja na bezbednosnim radnjama.** Kod ima šest cifara. Zaštita
  od ponovne upotrebe sprečava da presretnut kod prođe drugi put, ali ne
  sprečava **pogađanje** iz otvorene sesije. Brojač je dodat u centralnu kapiju
  (pokriva d2–d5 i promenu uloge) i u promenu sopstvene lozinke.
- **Vremenski otisak u javnom oporavku.** `scrypt` se računao samo za postojeći
  nalog, pa je razlika u vremenu odgovora otkrivala koje adrese postoje. Sada se
  lozinka heši uvek, pre provere naloga.
- **Provera lozinke i koda se ne prekida ranije.** U promeni lozinke se obe
  provere izvršavaju, da razlika u vremenu ne kaže koja je promašena.

## Šta i dalje NIJE dokazano 🟡

Blocker je jedan i nepromenjen: **potreban je disposable PostgreSQL preko
`TEST_DATABASE_URL`.**

Bez njega se ne može tvrditi:

- transakciona serijalizacija advisory brave (`db/integration/ownerGuard.integration.test.mjs`, preskočen);
- pun DB tok promene lozinke kodom;
- pun DB tok poništavanja drugog faktora;
- BFCache ponašanje u prijavljenoj sesiji;
- pun live enrollment/login tok kroz sve režime.

Lokalni PGlite most nije zamena i **ne treba ga ponovo pokušavati**: služi
jednu vezu, a sa više veza ruši protokol jer deli neimenovanu pripremljenu
izjavu. Vidi `docs/b2b/11-account-recovery-runbook.md`.
