# 11 — Oporavak naloga i bezbednosne radnje: runbook

**Status: 🟢 kod je kompletan i pokriven testovima; 🟡 dokaz transakcione brave nad pravim Postgresom je spoljni blocker.**

Ovaj dokument opisuje šta je izgrađeno u Fazi 1B-FINAL-2, kako se koristi i šta
još nije dokazano.

---

## Šta postoji

| Radnja | Ruta | Ko sme | Šta traži |
|---|---|---|---|
| Promena sopstvene lozinke | `/portal/bezbednost/lozinka` | svako sa punom sesijom | trenutna lozinka + svež TOTP |
| Vezivanje / promena drugog faktora | `/portal/bezbednost/mfa` | svako (i enrollment-only sesija) | lozinka + dozvola (prvi put) |
| Kod za promenu tuđe lozinke | `/portal/bezbednost/nalozi` | `users:manage` | razlog + svež TOTP |
| Dozvola za vezivanje | `/portal/bezbednost/nalozi` | `users:manage` | razlog + svež TOTP |
| Poništavanje tuđeg faktora | `/portal/bezbednost/nalozi` | `users:manage` | razlog + svež TOTP |
| Isključivanje / vraćanje naloga | `/portal/bezbednost/nalozi` | `users:manage` | razlog + svež TOTP |
| Postavljanje lozinke kodom | `/prijava/reset` | neprijavljen korisnik | e-pošta + kod + nova lozinka |

## Jedna kapija

`lib/authz/security-admin.ts` je **jedini** ispravan ulaz za radnje nad tuđim
nalogom. Traži troje: punu sesiju, sposobnost `users:manage` i **svež TOTP unet
baš za tu radnju**.

Treći uslov je ono što razlikuje ovu kapiju od obične provere dozvole. Potvrda
iz prijave ne važi — otvoren laptop ne sme biti dovoljan da se resetuje tuđa
lozinka. Kod ide kroz `verifyTotpForUser`, dakle sa istom zaštitom od ponovne
upotrebe kao pri prijavi.

**Nema izuzetka za vlasnika.** Prečica koja preskače drugi faktor bila bi tačno
ona rupa koju modul zatvara.

Nijedna radnja ne sme nad sopstvenim nalogom administratora — za svoje stvari
postoje samouslužni ekrani.

## Zaštita poslednjeg vlasnika

Tri puta vode do istog ishoda — isključivanje naloga, promena uloge i (buduće)
brisanje. Svi idu kroz `withOwnerGuard`, koji u jednoj transakciji:

1. uzima `pg_advisory_xact_lock(774155301)`,
2. prebrojava aktivne vlasnike **različite od cilja**,
3. odbija ako bi ostalo nula,
4. izvršava izmenu.

Redosled je bitan: prebrojavanje pre zaključavanja ne znači ništa, jer se stanje
može promeniti između brojanja i upisa.

Kriterijum „uklanja poslednjeg vlasnika" živi u
`lib/authz/owner-guard-policy.mjs` — čist modul bez baze, pokriven pravim
pozivima u `lib/authz/ownerGuard.test.mjs`.

## Kako se izdaje kod

1. Vlasnik otvori `/portal/bezbednost/nalozi`, izabere nalog, upiše razlog i
   svoj kod iz aplikacije.
2. Kod se prikazuje **jednom**. U bazi ostaje samo HMAC otisak.
3. Kod se predaje **lično ili telefonom**. Nikad e-poštom ni porukom — kopija bi
   ostala kod primaoca i na tuđem serveru.
4. Zaposleni otvara `/prijava/reset`, unosi e-poštu, kod i novu lozinku.

Kod ima ~147 bita entropije, važi 30 minuta i koristi se jednom. Izdavanje
odmah obara sve otvorene sesije cilja — kod se izdaje jer je pristup izgubljen
ili ugrožen, pa tuđa sesija ne sme da čeka.

## Jednokratni prikaz

Rezervni kodovi, kod za promenu lozinke i dozvola postoje samo u odgovoru koji
ih je napravio. Nijedna akcija ih ne čita iz baze.

Zaštita ima dva sloja:

- `no-store` zaglavlje za `/portal/bezbednost/*` i `/prijava/reset`
  (`lib/security/http-headers.mjs`, povezano u `next.config.ts`);
- `components/portal/useEphemeralReveal.ts` briše tajnu iz stanja komponente na
  `pagehide` i na `pageshow` sa `persisted`.

Drugi sloj postoji zato što `no-store` **ne pokriva back/forward kes**: tamo
pretraživač čuva celu živu stranu, sa React stanjem, pa bi „Nazad" vratio kod na
ekran.

## Dozvole na bazi

`db/provisioning/runtime-role.sql` već pokriva `password_reset_codes` i
`mfa_enrollment_grants`. `pg_advisory_xact_lock` je dostupan `PUBLIC` nalogu i
ne traži dodatan `GRANT`.

## Šta NIJE dokazano 🟡

**Transakciona serijalizacija brave nad pravim Postgresom.**

Invarijanta „uvek ostaje bar jedan aktivan gazda" ne živi u JavaScriptu nego u
Postgresu — u tome što `pg_advisory_xact_lock` natera drugu transakciju da čeka.
Dokazati to traži dve istovremene veze ka pravoj bazi.

Test je napisan i spreman: `db/integration/ownerGuard.integration.test.mjs`.
Pokriva oba smera — da brava serijalizuje, i da bez nje ista dva zahteva oba
prođu. Pokreće se sa:

```bash
TEST_DATABASE_URL=postgres://…/carsystem_test npm run test:integration
```

Bez `TEST_DATABASE_URL` test se **preskače i to jasno kaže**, umesto da tiho
prođe i ostavi utisak da je invarijanta dokazana.

Test odbija da radi ako je `TEST_DATABASE_URL` isti kao `DATABASE_URL` ili
`MIGRATION_DATABASE_URL`, ili ako ime baze ne sadrži „test".

**Zašto nije pokrenut:** na mašini nema pravog Postgresa (`psql`, `pg_ctl`),
nema Docker/Podman/Colima, i `TEST_DATABASE_URL` nije postavljen. Lokalni PGlite
most nije zamena — radi nad jednom instancom sa deljenom neimenovanom
pripremljenom izjavom, pa dve istovremene veze ruše protokol umesto da se
serijalizuju.
