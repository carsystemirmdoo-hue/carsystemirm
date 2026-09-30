# Rekonstrukcija tamne teme — radni zapis

Grana `feat/dark-theme-reconstruction` (worktree `../carsystem-dark`, od `origin/main` 96bf57f).
Reopen je upisan u `docs/PAGE_LOCK_STATUS.md` (samo `.dark`; svetla tema ostaje zaključana).

## Sistem

- `app/globals.css` — jedna tamna skala površina `--dk-0…3`, linije `--dk-line(-strong)`,
  `--dk-text-faint`, tamna senka `--dk-shadow-color`, fokus `--dk-focus`.
  `--accent` je ISPUNA (beli tekst ≥ 4.5:1), `--accent-text` crveni TEKST na tamnom.
- Stranične palete (PDP ×2, katalog, početna, header) čitaju nivoe skale umesto
  sopstvenih „crnih" (ranije četiri različite crne + topao header).
- Brend atmosfere su namerno netaknute (Cosmos inverzija, Norbin „light only",
  Befar svetlo/grafit, R-M Agilis/Refinity, baslac, Carsystem 245-grafit).

## Fotografije proizvoda — tri režima (`lib/product-image-metrics.ts` → `resolveImageMatte`)

| režim | fajl | tamna tema |
| --- | --- | --- |
| `cutout` | providan render | proizvod na sceni, samo TAMNA senka |
| `backdrop` | neprovidna foto, RAVNA pozadina (≤ 8/255) | „light box": ploča u boji same pozadine, ivica utopljena maskom 4 % |
| `photo` | puna fotografija / studijski gradijent | cela, uokvirena fotografija (contain) — nikad `cover` |

Dodela je proverena za CEO katalog, ne uzorak: `data/catalog/image-remaster/MATTE_ASSIGNMENT.generated.csv`
(`node scripts/catalog/image-remaster/matte-report.mjs`) — 1912 kartica: 1526 izrez, 10 light box,
58 fotografija (glavna slika), 318 bez slike; 1987 slika scene (1558 / 54 / 375), 8 vektorskih
(Befar sunđeri, SVG → izrez). Svih 48 jedinstvenih light box fajlova i uzorak od 48 fotografija
pregledani su ručno. Prva verzija „fotografije" koristila je `cover`: merenje je pokazalo da bi
na 248 od 375 slika odsekla kadar (do 12,5 % po strani, često proizvod ili etiketu) — zamenjeno
uokvirenim `contain` prikazom, bez ikakvog odsecanja na desktopu i telefonu.

Generator metrika (`scripts/extract-product-image-metrics.py`) daje `backdrop` i
`--product-image-dark-*` promenljive u `ProductImageFit.generated.module.css`; čitaju ih
samo `.dark` pravila. Neuspelo učitavanje → „Vizuel u pripremi"
(`components/product/useProductImageLoadState.ts`), bez slomljene ikone i bez prazne ploče.

## Uzroci „grubih ivica" i rešenja

1. CSS (glavni uzrok, cela lokacija): svetli 1 px `drop-shadow` obris na PDP-u i beli
   „oreol" na karticama (senka bojena sa `--foreground`) → uklonjeno, senka je tamna.
2. Neprovidne fotografije na beloj/studijskoj pozadini (243 fajla) → režimi `backdrop`/`photo`.
3. Svetla senka za beli papir u zvaničnim renderima (47) → `shadow-premultiply`.
4. Poluprovidan okvir platna (10) → `clear-edge-frame`.
5. Stepenasta alfa + svetli ostatak (R-M Pasta 190 1 L/5 L) → `antialias-mask` + `defringe`.
6. Svetao rub uz tamnu ivicu (9 potvrđenih) → `defringe`.

Popravke asseta: `data/catalog/image-remaster/plan.json` (svaki unos pregledan na
tamnoj/sivoj/svetloj podlozi), skripta
`scripts/catalog/image-remaster/remaster.py --preview|--apply|--check|--revert`.
ORIGINAL SE NE MENJA: Carsystem sync koristi SHA lokalne slike kao dokaz identiteta,
a Cosmos Brand Kit je SHA-zaključan. Popravka je derivat za prikaz u
`public/remastered/<putanja originala>`, mapiran u `display-map.json`; čitaju ga samo
PDP scena i kartice (`lib/productImageDisplay.ts`). Nov izvor iz synca menja SHA
originala → `--check` pada, `--apply` izbacuje zastareli derivat.
Posle `--apply`: `npm run images:metrics` (derivati imaju svoje metrike).

## Preostale slike ograničene izvorom (prikazane pošteno, čekaju bolji materijal)

| grupa | proizvodi | razlog | trenutni prikaz | potrebno |
| --- | --- | --- | --- | --- |
| „Image missing" | `rm-h-2rm2-wheel-clear-coat-hardener` (H 2RM2) | zvanični izvor nema fotografiju | „Vizuel u pripremi" (sync pravilo popravljeno) | fotografija vlasnika |
| bela pozadina | 6 × baslac 40-10/40-40/40-440/40-450/40-510/50-15, R-M C 2P52, C 2P65, Diamont | neprovidan zvanični packshot; belo telo limenke dodiruje belu pozadinu → automatsko isecanje nije bezbedno | „light box" | providan zvanični render |
| studijski gradijent | 52 × Befar (npr. `befar-backing-pad`), `carfit-professional-nitrile-gloves`, `carsystem-glass-fibre-fleece` | fotografija sa pozadinom, ne isečak | cela uokvirena fotografija | isečak / render proizvođača |
| mala rezolucija (~400 px subjekt) | R-M H 2P15, H 2P05, H 2P35, H 2A34, T 2A55, C 2A40, AGILIS; Carsystem carbo-putty, Jupiter Soft 75/77, F.19 77 mm (2), steel; RUPES LHR75E | izvor je mali | normalno, blago mekano na retina ekranu | veći izvor |
| svetli rub — ne dira se | Cosmos Spray Bike (providni poklopci), hromirani delovi (KS dual gun, nipple), bele baslac limenke, C.A.R.FIT bele boce | stvarno svojstvo ambalaže ili bi popravka uvela artefakt | original | — |
| odraz umesto senke | `carsystem-multi-flow`, `carsystem-paint-system-cps-3-0(-2)` | ogledalski odraz; obrada bi ga pokvarila | original (odraz blago svetli) | render bez odraza |

## Dokazi

Van repozitorijuma (binarni dokazi se ne čuvaju u Git-u; `docs/visual-evidence/` je u
`.gitignore`): skup `dark-theme-2026-09` (182 JPEG, ~10 MB, `README.md` sa spiskom ruta) čuva
vlasnik u lokalnoj safety arhivi, sa SHA-256 spiskom. Sadržaj: tamna tema pre/posle na 1440 i
390 (`pairs-dark/`), regresija svetle teme (`pairs-light/`), stanja u obe teme (`states/`),
učitavanje/greška/keš i svih 65 popravki (`images/`), ručna provera dodele režima i nalaza
kontrasta (`sheets/`).

## Kontrast (ručno provereno, obe teme)

Audit čita izračunate boje; svaki nalaz je proveren isečkom snimka. Lažni nalazi (tekst preko
pseudo-elementa ili umetničke podloge): Cosmos paneli linija, „Boja nije sloj" na početnoj.
Popravljeno po uzroku (i u svetloj temi, kao dokazani bug pristupačnosti):

- `a { color: inherit }` jači od klase dugmeta — PDP hero „Pošalji upit" (tamno na crvenom u
  svetloj), završni CTA, Norbin primarno dugme, baslac sistemski PDP, Befar CTA, „Preuzmi" u
  kartici dokumenta;
- bledi sitni tekst: PDP, katalog, programske/entitetske strane, Carsystem, C.A.R.FIT, Befar,
  početna (lokator, nadnaslovi);
- crvena ispuna ispod belog teksta (#e5322a, #ff3b30, baslac #3f7ea6, Befar #ea080b) → isti ton,
  dublji za ispunu; crveni sitni tekst po podlozi (svetla/tamna sekcija);
- R-M: zvanična `#E3000F` ostaje za veliki tekst i identitet; sitan tekst nosi mastilo sekcije
  uz crveni marker (leva crta, podvlaka, donja crta); tekst na crvenim karticama puna bela;
- Cosmos dokumenti: sekcija redefiniše i `--ds-*` (kartica je bila tamna sa tamnim tekstom);
- SATA hero nadnaslov, baslac aktivna faza i nadnaslovi po sekciji, Norbin prazna pločica.

## Otvoreno / za vlasnika

- H 2RM2 (`/proizvodi/rm-h-2rm2-wheel-clear-coat-hardener`): zvanična zamena NE postoji
  (info.rmpaint.com i danas vraća „Image missing_1.png", rmpaint.com nema sliku; ni C 2RM2 nema
  sliku). R-M sync sada prepoznaje zamensku sličicu i po imenu izvornog fajla
  (`scripts/rm-sync/lib/placeholders.mjs`); proizvod prikazuje „Vizuel u pripremi" i ušao je u
  red za dostavu: `/products/rm/supplied/rm__rm-h-2rm2-wheel-clear-coat-hardener.webp`.
- Portal prijava (`features/portal/PortalLoginForm.tsx`, `portal-login-note`,
  `portal-login-brand`): sitan sivi tekst 3.2–4.3:1 u obe teme — portal se aktivno menja u grani
  `feature/faza-1b-security`, pa se ovde ne dira (konflikt).

## Status

- [x] Sistem tokena, PDP, katalog/kartice, header, CTA, zajednički CTA, početna
- [x] Popravke asseta (65 derivata za prikaz) + metrike
- [x] Režimi za ceo katalog (CSV), `contain` umesto `cover`, 65 derivata sa tačnim spiskom
- [x] Kontrast brend stranica ručno proveren i popravljen (obe teme); H 2RM2 pošten fallback
- [x] Završni snimci u repozitorijumu, lint/typecheck/30 test paketa/build/build:check/trace
- [x] Commit + PR (bez spajanja i bez Production deploya — čeka pregled vlasnika)
