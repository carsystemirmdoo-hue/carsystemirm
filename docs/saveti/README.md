# Saveti i vodiči — kako rubrika radi

Stručna biblioteka i novosti na `/vodici`. Nije forum: nema komentara, korisničkih objava ni profila. Firma objavljuje proverene tekstove, a posetioci ih čitaju.

## Delovi

| Šta | Gde |
| --- | --- |
| Tekstovi (YAML frontmatter + Markdown) | `content/saveti/clanci/<slug>.md` |
| Raspored (podešavanja + termini) | `content/saveti/raspored.json` |
| Generisani skup koji sajt čita | `data/saveti/clanci.generated.json`, `data/saveti/status.generated.json` |
| Kapija objave (čista funkcija) | `lib/saveti/objava.mjs` |
| Planer kalendara | `lib/saveti/planer.mjs`, `npm run saveti:plan` |
| Vreme i zona Europe/Belgrade | `lib/saveti/vreme.mjs` |
| Markdown podskup i jezičke provere | `lib/saveti/markdown.mjs`, `lib/saveti/jezik.mjs` |
| Strane | `app/vodici/` (indeks, `[slug]`, `novosti`, `kategorije/[slug]`, `feed`) |
| Zakazani posao | `app/api/saveti/objava/route.ts` + `crons` u `vercel.json` |
| Pravila pisanja | [UREDNICKI_VODIC.md](UREDNICKI_VODIC.md), [TERMINOLOGIJA.md](TERMINOLOGIJA.md), [PROCES_PISANJA.md](PROCES_PISANJA.md) |
| Stanje tema | [INVENTAR.md](INVENTAR.md) i [PROVERA_SADRZAJA.md](PROVERA_SADRZAJA.md) (generisano) |
| Kalendar | [KALENDAR.md](KALENDAR.md) (generisano planerom) |
| Novosti i istraživanje | [NOVOSTI_PREGLED.md](NOVOSTI_PREGLED.md), `istrazivanje/` |

## Kako tekst postaje javan

Ništa se ne upisuje u trenutku objave. Kapija za svaki članak izračunava stanje iz podataka u repozitorijumu i trenutnog vremena. Članak je javan samo kada važi **sve** od sledećeg:

1. `raspored.json → podesavanja.aktivan: true` (glavni prekidač);
2. članak ima termin, a trenutak termina (lokalni datum + `vremeObjave`, Europe/Belgrade) je prošao;
3. članak ima `odobrenje` imenovane osobe, dato **pre** termina;
4. otisak odobrenog teksta se poklapa sa sadašnjim tekstom (izmena posle odobrenja traži novo odobrenje);
5. termin nije posle `pauzaOd`;
6. članak nije `povucen`;
7. novost: termin nije posle `proveraVaziDo`.

Nejavan članak nema stranu (404), nije u spiskovima, kategorijama, feedu ni sitemapu, a link ka njemu iz drugog teksta prikazuje se kao običan tekst. Generisani skup sa svim tekstovima uvozi se samo u serverske module (`server-only`).

### Keš i Vercel

- Strane rubrike i `sitemap.xml` koriste ISR sa `revalidate = 3600`. Svako generisanje ponovo pita kapiju, pa članak izlazi bez novog deploymenta, najkasnije oko sat vremena posle termina i po prvom zahtevu (stale-while-revalidate).
- `vercel.json` pokreće `/api/saveti/objava` jednom dnevno u 08:30 UTC (09:30 zimi / 10:30 leti po beogradskom vremenu; na Hobby planu bilo kada u tom satu). Posao osvežava keš spiskova, feeda, sitemapa i strana članaka iz poslednja 4 dana i loguje šta je objavljeno, preskočeno ili čeka, i zašto. Ništa ne menja, pa je ponovljeno pokretanje bezbedno.
- Ruta traži `Authorization: Bearer $CRON_SECRET`. Bez podešene tajne odbija svaki poziv (fail closed).
- `GET /api/saveti/objava?pregled=sve` (sa istom tajnom) vraća stanje svih termina sa razlozima. To je trajna evidencija koju Vercel logovi ne čuvaju dugo.
- Feed je na `/vodici/feed` (bez `.xml`, jer middleware propušta `*.xml` mimo režima održavanja).
- Nema baze, nema novog servisa i nema dodatnog troška: cron i ISR su deo svakog Vercel plana. Napomena: Vercel Hobby je samo za nekomercijalnu upotrebu. Izbor plana firme je posebna odluka vlasnika.

### Propušten termin, prazan termin, pauza, povlačenje

- **Nema spremnog teksta**: termin ostaje prazan. Izveštaj posla i `?pregled=sve` navode razlog. Ništa nepotpuno se ne objavljuje.
- **Tekst nije odobren na vreme**: ne objavljuje se unazad. `npm run saveti:plan` ga prebacuje u sledeći slobodan termin, a prošli termin ostaje zabeležen kao preskočen.
- **Pauza**: `pauzaOd: "2027-03-01"` u `raspored.json`, pa commit i deploy. Već objavljeno ostaje javno. Nastavak: ukloniti `pauzaOd` i pokrenuti `saveti:plan`, koji pomera buduće termine.
- **Povlačenje**: `npm run saveti:odobri -- --povuci --id=SV-0000 --razlog="…"`, pa build i deploy. Strana daje 404 čim novi deployment krene (keš je po deploymentu).
- **Glavni prekidač**: `aktivan: false` sakriva sve.

## Aktivacija (radi vlasnik ili ovlašćena osoba)

1. Pregledati i odobriti tekstove: `npm run saveti:odobri -- --id=… --odobrio="Ime Prezime" --uloga="…"`.
2. U `content/saveti/raspored.json` postaviti stvarni `pocetniDatum` (budući datum), `vremeObjave`, `aktivan: true` i `pocetakPretpostavljen: false`.
3. `npm run saveti:build && npm run saveti:plan`, pregledati `docs/saveti/KALENDAR.md`, pa commit.
4. U Vercel projektu podesiti `CRON_SECRET` (najmanje 16 nasumičnih znakova) za Production. Bez toga sve i dalje radi preko ISR-a, samo bez ciljanog osvežavanja u terminu.
5. Deploy po uobičajenom postupku (uz odobrenje).

## Stanje i sledeći koraci

Vidi odeljak „Stanje“ na dnu ovog dokumenta. Ažurira se posle svake serije.

## Stanje

- 2026-10-08: postoji infrastruktura, inventar od 224 teme i 1 pilot-tekst. Pisanje teče u serijama (vidi `INVENTAR.md`). Ništa nije odobreno. Raspored je **probni** (`aktivan: false`, pretpostavljeni početak 2026-11-02 u 09:00).
