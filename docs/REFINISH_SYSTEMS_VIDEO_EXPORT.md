# Video eksport za društvene mreže (interne scene)

Dva nezavisna sistema: **refinish-systems** (kompletan pregled programa) i
**spray-reveal** (čist promo motion asset: proizvod + spray reveal). Za
spray-reveal vidi sekciju na dnu dokumenta.

# Refinish Systems — video eksport za društvene mreže

Interna scena `/social-exports/refinish-systems` (sačuvani blok „Sistemi za ceo
refinish tok.") renderuje se u gotove MP4 fajlove deterministički,
frame-by-frame, jednom komandom.

## Zavisnosti

- **Node 20+** i projektni `npm install` (render koristi dev zavisnost
  `playwright-core` — bez download-a browsera).
- **Google Chrome** instaliran na mašini (skripta koristi sistemski Chrome;
  putanju možeš prepisati env promenljivom `CHROME_PATH`). Alternativa:
  `npm i -D playwright && npx playwright install chromium` pa postavi
  `CHROME_PATH` na taj binarni fajl.
- **FFmpeg + ffprobe u PATH-u** — obavezno (`brew install ffmpeg`).

## Render komande

```bash
# sva tri kompletna formata (story, feed, square)
npm run render:refinish-systems

# jedan format
npm run render:refinish-systems -- --format story

# pojedinačni program ili brend (id celine ili brend slug)
npm run render:refinish-systems -- --format story --program carsystem
npm run render:refinish-systems -- --format story --program rm
npm run render:refinish-systems -- --format story --program boje-i-lakovi

# sva tri formata eksplicitno
npm run render:refinish-systems -- --all

# preskoči next build ako .next već postoji (brže ponavljanje)
npm run render:refinish-systems -- --skip-build
```

Komanda sama pokreće `next build` (osim uz `--skip-build`), podiže
`next start` na portu 4310, renderuje i na kraju gasi server.

## Gde se čuvaju rezultati

`public/social-exports/refinish-systems/`:

- `refinish-systems-story.mp4` — 9:16, 1080×1920
- `refinish-systems-feed.mp4` — 4:5, 1080×1350
- `refinish-systems-square.mp4` — 1:1, 1080×1080
- pojedinačni izvoz: `refinish-systems-<format>-<program>.mp4`

Privremeni PNG frame-ovi se snimaju u OS temp direktorijum i brišu se posle
uspešnog encode-a — ne ulaze u repozitorijum.

## Kako pipeline radi (determinizam)

1. Scena se učitava sa `?render=1`; komponenta tada **ne startuje sama** —
   čeka `window.__refinishRender.start()`.
2. Skripta sačeka da preload završi (`data-export-ready="true"`, svi logotipi,
   packshot-ovi i fontovi — `document.fonts.status === "loaded"`).
3. Uključi se CDP **virtual time** (`Emulation.setVirtualTimePolicy`), pa se
   tek onda scena startuje: svi tajmeri, CSS tranzicije i progress animacija
   od tog trenutka teku isključivo po virtuelnom satu.
4. Sat se pomera za tačno `1000/fps` ms po frame-u; svaki frame se snima kao
   PNG preko `Page.captureScreenshot` u tačnoj ciljnoj rezoluciji (bez
   upscale-a). Frame N je uvek stanje scene u `N * 1000/fps` ms — render ne
   zavisi od brzine računara.
5. FFmpeg spaja frame-ove: `libx264`, `-preset slow -crf 17`, `yuv420p`,
   `+faststart`, bez audio strima.

Za ručnu proveru tačnog trenutka postoji i statički seek:
`/social-exports/refinish-systems?format=story&render=1&time=2000`
(vreme u ms; tranzicije su isključene, progress je pauziran na tačnom pomaku).

## Struktura i trajanje videa

Konstante u `components/social-exports/refinish-systems/RefinishSystemsExportStage.tsx`:

- `RENDER_HOLD_MS = 400` — stabilan uvodni kadar;
- `RENDER_STEP_MS = 3400` — trajanje jednog programskog koraka;
- `RENDER_END_MS = 2100` — završni Carsystem kadar (ostaje do kraja, bez
  fade-outa i bez crnog frame-a).

Ukupno za 5 koraka: `0.4 + 5×3.4 + 2.1 ≈ 19.5 s`. **Trajanje se menja** ovim
konstantama (skripta ukupan broj frame-ova čita iz scene, pa se prilagođava
automatski, i za pojedinačne programe sa manje koraka).

## FPS

Podrazumevano 60. Promena: `npm run render:refinish-systems -- --fps 30`.
FPS ne menja trajanje ni brzinu animacije — samo gustinu frame-ova.

## Ponavljanje rendera

Render je deterministički: ponovno pokretanje iste komande prepisuje MP4
fajlove istim sadržajem (do encoder varijacija). Za brzo ponavljanje koristi
`--skip-build` dok se kod scene ne menja.

---

# Spray Reveal — promo motion asset

Scena `/social-exports/spray-reveal`: jedan proizvod u prvom planu, spray
artwork (`public/product-hero-patterns/spray-six-pass.svg`, isti vizuelni
jezik kao product hero) koji se iscrtava potez po potez iza njega, diskretan
ulazak proizvoda i minimalan caption (logo + naziv). Bez web UI elemenata.

## Render

```bash
npm run render:spray-reveal                          # story + feed + square
npm run render:spray-reveal -- --format story
npm run render:spray-reveal -- --format wide         # bonus 16:9 (1920x1080)
npm run render:spray-reveal -- --format story --product basecoat
npm run render:spray-reveal -- --all                 # sva četiri formata
npm run render:spray-reveal -- --skip-build
```

Rezultati: `public/social-exports/spray-reveal/spray-reveal-<format>[-<product>].mp4`.

## Kako radi determinizam

Sve animacije scene su CSS animacije čiji delay uključuje `var(--seek)`.
Render skripta učita scenu u statičkom režimu (`?render=1&time=0`, sve
pauzirano) i za svaki frame samo postavi `--seek: -(frame * 1000/fps)ms` pa
snimi PNG — frame je čista funkcija vremena. FFmpeg parametri su isti kao za
refinish-systems (H.264, `-preset slow -crf 17`, `yuv420p`, `+faststart`, bez
audio). Ručna provera trenutka: `/social-exports/spray-reveal?render=1&time=1500`.

## Varijante proizvoda

`components/social-exports/spray-reveal/sprayRevealVariants.ts` — packshot,
boja spray art-a, glow, logo i naziv po varijanti (`cosmos-spray`, `basecoat`,
`filler-kit`); bira se sa `?product=` ili `--product`. Nove varijante se
dodaju u taj config bez izmene scene.

## Trajanje i tajming

Konstante u `SprayRevealStage.tsx`: `HOLD_MS` (400), `TOTAL_MS` (5600) i
`sprayTiming` (originalni stagger poteza iz product hero sistema); ulazak
proizvoda na 1250 ms, caption na 3600 ms — delay-i su u CSS modulu scene.

---

# Product Showcase — product page hero u light i dark temi

Scena `/social-exports/product-showcase`: hero blok stranice proizvoda
(eyebrow pills, naslov, kratka rečenica i vizuelna površina sa spray reveal
artworkom iza packshota), složen kao realan Carsystem product page modul —
bez galerija, tabela i ostalog UI šuma. Obavezne su obe teme.

## Render

```bash
npm run render:product-showcase                       # obe teme x story/feed/square (6 videa)
npm run render:product-showcase -- --theme dark
npm run render:product-showcase -- --theme light --format story
npm run render:product-showcase -- --format story --product basecoat
npm run render:product-showcase -- --all              # obe teme x sva četiri formata
npm run render:product-showcase -- --skip-build
```

Rezultati: `public/social-exports/product-showcase/product-showcase-<tema>-<format>[-<product>].mp4`.

## Parametri scene

`?theme=light|dark`, `?format=story|feed|square|wide`,
`?product=cosmos-spray|basecoat|filler-kit`, `?render=1[&time=MS]`.
Varijante (packshot, boja spray art-a, kategorija, lead) su u
`components/social-exports/spray-reveal/sprayRevealVariants.ts` — dele se sa
spray-reveal scenom.

## Tajming

`TOTAL_MS = 6000` u `ProductShowcaseStage.tsx`: stabilan page kadar, tekst
ulazi 240–1100 ms, spray reveal 700–2430 ms, proizvod 1500–2220 ms, finalni
hold do kraja. Determinizam kao kod spray-reveal scene: sve su CSS animacije
sa `var(--seek)` u delay-u; render skripta postavlja `--seek` po frame-u.
