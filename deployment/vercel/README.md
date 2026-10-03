# Vercel Deployment

Ovo je preporučena deployment varijanta dok kod Burina.net postoji samo domen/DNS, bez aktivnog shared hosting paketa.

## Rute

- Kada je `MAINTENANCE_MODE=true`, javne rute vode na `/site-u-pripremi`.
- Nakon uspešnog internog pristupa, pravi sajt radi na `/`, `/katalog`, `/prodavnice`, `/kontakt` i ostalim javnim rutama.
- `/preview` i sve `/preview/...` rute ne prikazuju posebnu preview verziju sajta.

## Maintenance pristup

Zaštita je implementirana u root `middleware.ts`.

Middleware:

- čita `MAINTENANCE_MODE`;
- dozvoljava `/site-u-pripremi` i `/site-u-pripremi/access`;
- ne štiti statičke assete,
- proverava `httpOnly` access cookie za otključan pristup,
- preusmerava `/preview` na `/site-u-pripremi` bez cookie-ja ili na `/` sa validnim cookie-jem.

## Env varijable

U Vercel Project Settings → Environment Variables dodati:

```txt
MAINTENANCE_MODE=true
SITE_ACCESS_PASSWORD
```

`PREVIEW_ACCESS_PASSWORD` je podržan kao fallback naziv, ali preporučeni naziv
za novi flow je `SITE_ACCESS_PASSWORD`.

Podesiti ih za environment-e koji treba da budu zaključani, najčešće:

- Production
- Preview

Ne upisivati pravu lozinku u kod, dokumentaciju, `.env.local`, commit ili chat log.

## Build

Vercel treba da koristi standardni Next.js build:

```bash
npm run build
```

Projekat više ne koristi `output: "export"` za Vercel, jer maintenance zaštita
zavisi od Next middleware-a i route handlera.

## DNS napomena

Kada je Vercel projekat spreman, domen/DNS sa Burina.net treba usmeriti prema Vercel uputstvu za custom domain.

`.htaccess` se ne uploaduje i nema efekat na Vercel-u.

## `vercel.json` (od 2026-10-01)

- `regions: ["fra1"]` — Vercel funkcije rade u Frankfurtu, blizu EU baze.
  Podrazumevani region novih projekata je `iad1` (SAD). Hobby dozvoljava jedan
  region. Važi za deployment koji sadrži ovaj fajl; podešavanje u kontrolnoj
  tabli (Settings → Functions → Function Regions) treba uskladiti na isto.
- `git.deploymentEnabled: { "integration/**": false }` — push grane
  `integration/…` ne pravi deployment ni Preview. `main` (produkcija) i ostale
  grane rade kao do sada.
- **Kontrolisan testni deployment:** isti commit se gurne na posebnu granu
  (npr. `preview/portal-test`), ili član firminog tima pokrene `vercel deploy`
  (Preview) iz te grane. Pre toga proveriti da Preview okruženje nema promenljive
  stvarne baze — vidi `docs/b2b/33-test-baza-runbook.md` §6.
