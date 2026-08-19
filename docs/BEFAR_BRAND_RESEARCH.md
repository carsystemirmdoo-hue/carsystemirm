# BEFAR — Deep Brand & Website Research (Phase 0)

**Status:** research / audit only. No design, no components, no production code changed.
**Date:** 2026-08-09.
**Companion documents:** `BEFAR_PRODUCT_ARCHITECTURE.md`, `BEFAR_ASSET_INVENTORY.md`.

**Source discipline used throughout.** Every material statement is tagged:

- **`[F]` Fact** — printed on an official Befar or Nargil source, quoted or transcribed.
- **`[C]` Their claim** — marketing language from an official source, not independently verifiable.
- **`[I]` Our interpretation** — inference or judgement by us.
- **`UNVERIFIED`** — could not be confirmed from any source.

---

## 1. Executive summary

**The most important finding of this phase is an identification, not an analysis.**

Our own knowledge base recorded Befar as unidentifiable. `data/knowledge/brand-sources.ts` currently
states: *"Pretraga nije pronašla zvaničnog proizvođača pod imenom „Befar" u oblasti poliranja… Moguće je
da je reč o privatnoj robnoj marki ili regionalnom dobavljaču"*, with
`acquisitionFeasibility: "no-official-source-found"`. **That is wrong and should be corrected.**

Befar is **Befar Otomotiv San. Tic. Ltd. Şti.**, a family-owned manufacturer in Bursa, Turkey, in
business since 2002, making polishing foam, backing and interface pads, wool and microfibre pads,
abrasive accessories and surface chemicals. `[F]` They have an official Turkish website
(`befar.com.tr`), a separate English export site run by their trading arm Nargil Dış Ticaret
(`nargildisticaret.com`), a 48-page bilingual product catalogue PDF, five distinct sub-brands, and a
photographic library of roughly 330 assets — 153 of them at 2000 px or wider. `[F]`

The identification was confirmed three ways: the archived Befar logo from Carsystem's own legacy
WordPress site matches the `befar.com.tr` mark exactly; the legacy Carsystem product image filenames
(`240100.jpg`, `930150.jpg`, …) are literally Befar's own article codes (`02401`, `93015`); and Serbia
appears in Befar's own printed export-market list. `[F]`

**What that means for the landing page.** Befar is not a thin accessories label to be presented as a
product grid. It is a manufacturer with a real, decodable system — colour equals hardness, article
code equals colour plus size plus line, pad diameter dictates backing-plate diameter — and a large,
under-used photographic library. Their own website expresses almost none of this. The gap between what
Befar *is* and what befar.com.tr *shows* is the largest of any brand we have researched so far, which
means the upside is also the largest.

**What is missing.** No vector logo, no TDS, no SDS, no certifications, no factory or laboratory
photography, no Serbian copy, and no clean (untinted) video. These are procurement items, not
research failures — see §17.

---

## 2. Brand identity

### 2.1 The mark

The Befar logo is a horizontal lockup: a **rounded-square icon** containing an abstract face —
two dots for eyes, a Y-shaped nose/brow form, a curved smile — followed by the lowercase wordmark
**`befar`** in a custom geometric rounded sans with a distinctive single-storey `a` and a straight-
terminal `f`. `[F]` A registered-trademark `®` appears after the wordmark in the catalogue. `[F]`

Two presentations are used interchangeably:

- **White on red** — a red rounded rectangle containing the white lockup. This is the primary form on
  the catalogue cover and brand page. `[F]`
- **Red on white/transparent** — the form archived from Carsystem's legacy site. `[F]`

The icon is also **embossed into the plastic backing plates** of the pads themselves, which makes it a
physical mark, not just a printed one. `[F]` (Visible in the catalogue cover photograph.)

`[I]` The face icon is genuinely distinctive and slightly odd — in the best way. Almost every
competitor in this category (Rupes, Flexipads, Menzerna, Farécla) uses a word or an abstract swoosh.
Befar has a *character*. It is under-used to the point of near-invisibility on their own site.

### 2.2 Slogan

| Turkish | English |
|---|---|
| **"Kalite Keyif Verir…"** | **"Enjoy Quality…"** |

`[F]` Set in a formal English-roundhand script (the export site loads Google's `Italianno`),
underlined, with a trailing ellipsis. It appears on the catalogue back cover, in the running header of
every catalogue page, on the export site hero, and printed on product packaging (the masking-foil bag
and the microfibre towel band). `[F]`

`[I]` The Turkish is better than the English. *"Kalite Keyif Verir"* — "quality gives pleasure" — is a
real sentiment about craft satisfaction. "Enjoy Quality…" flattens it into generic export English. The
script typeface is the weakest part of their identity: it belongs to a wedding invitation, not to a
company that makes industrial foam.

### 2.3 Sub-brand architecture

Catalogue page 47 is an official lockup sheet — the single most valuable page in their literature. `[F]`

| Sub-brand | Lockup | Role |
|---|---|---|
| **befar** | White lockup on red rounded rectangle | Master brand, core range |
| **opencell** | White lowercase, softened/rounded lettering, on black | Newest technology line |
| **befar +Plus** | Red `befar` + white italic `+Plus` on black | Upgraded professional tier |
| **Leo** | Red `Le` + red dot-`O` + black **dog silhouette**, on white | Detailing / enthusiast line |
| **turQuaz** | White `turQuaz` with a leaf-and-swoosh over the `Q`, on cyan | Value / eco line |

`[I]` A note on Leo: the silhouette is a **standing pointer-type dog**, not a lion. It is printed on
pad faces as well as packaging. This is Befar's only mascot and, alongside the face icon, their most
ownable graphic asset. Do not describe it as a lion.

### 2.4 What Befar is *not*

`[I]` They are not a coatings company. No paints, primers, fillers, clears or hardeners — those all
come from R-M, baslac, Carsystem, Cosmos. Befar sits entirely in **interface and finishing**: the
things between the machine and the paint, plus the compounds that go on them. Positioning the Befar
page as "another paint brand page" would be factually wrong and would fight the product.

---

## 3. Company / positioning

### 3.1 Verified company facts

| Item | Value | Source |
|---|---|---|
| Legal name | BEFAR OTOMOTİV SAN. TİC. LTD. ŞTİ. | `befar.com.tr/contact-10`, `/general-6` `[F]` |
| Founded / producing since | **2002** | `befar.com.tr/hakkımızda`; `nargildisticaret.com` `[F]` |
| Ownership | Family-owned ("köklü ve başarılı bir aile şirketi") | `befar.com.tr/hakkımızda` `[F]` |
| Location | Yeni Yalova Yolu 3. Km, 3. Albay Sokak No: 10, Osmangazi, **Bursa**, Turkey | Catalogue p.48; export site `[F]` |
| Coordinates | ≈ 40.22568 N, 29.05856 E | Export-site Google Maps embed `[F]` |
| Phone (domestic) | 0224 253 73 78 · `befar@befar.com.tr` | `befar.com.tr` `[F]` |
| Export contact | +90 533 382 73 28 · `esra@nargildisticaret.com` | Catalogue p.48 `[F]` |
| Export arm | **Nargil Dış Ticaret** | Catalogue cover + p.48 `[F]` |
| Social | Instagram `@befar_tr`, Facebook `befar.tr` | `befar.com.tr` footer `[F]` |
| No YouTube / LinkedIn / Vimeo / TikTok | — | Not linked anywhere on either official site `[F]` |

### 3.2 Conflicting facts across their own sources

| Claim | `befar.com.tr` (current) | `nargildisticaret.com` (2019) | Catalogue PDF |
|---|---|---|---|
| Production area | **2500 m²** closed area | **1000 m²** closed area | — |
| Export markets | "50 ülke" badge | "50 + COUNTRY" | "**54** country" badge + a printed list of ~57 country names |

`[I]` The area difference is most plausibly growth (2019 → present), not error — but we must not print
either figure as settled without asking Befar. The country count is simply inconsistent across three
official artefacts; the *printed list* is the most defensible source, and Serbia is on it.

### 3.3 What they make and who they sell to

`[F]` From their own About text (both languages): surface polishing sponges, all apparatus used in
polishing, microfibre cloths, and **intermediate/interface pads used in the sanding industry**.

`[F]` Sectors served, stated explicitly: **automotive, aviation, rail transport vehicles, marine,
furniture**. The export site gives each its own tile.

`[F]` Route to market: a dealer network in Turkey and abroad. No direct e-commerce anywhere. No dealer
locator, no dealer list, no distributor page — on either site.

`[I]` This is a **B2B manufacturer selling through distributors**, which is precisely Carsystem's own
model. A Befar page on our site is not competing with Befar's site; it is doing the job Befar's site
does not do at all — being findable and usable by a Serbian bodyshop.

### 3.4 Market positioning

`[I]` Our reading, from packaging, price-tier structure and product range:

**Mid-market professional, with a deliberate ladder upward.** The tier structure
(`turQuaz` eco → `befar` core → `+Plus` → `Opencell`/`Leo` premium) is a value-brand structure, not a
premium-brand structure — a premium brand does not ship an "eco" line under its own roof. Against
Rupes or Menzerna they are a value alternative; against unbranded Far-East foam they are a real
manufacturer with a catalogue, article codes and a hardness system.

`[I]` For the Serbian market this is a **strength, not a weakness**, and the page should say so
honestly: a bodyshop that needs 200 velcro pads a month is not buying Rupes. Positioning Befar as
"affordable professional consumables with a real system behind them" is both true and commercially
correct. Positioning it as luxury would be a lie the product photography would immediately contradict.

### 3.5 Marketing claims — recorded, not endorsed

| Claim | Source | Status |
|---|---|---|
| *"Befar'a özel üretim teknikleriyle çok daha uzun ömürlü"* — much longer service life thanks to Befar-specific production techniques | `befar.com.tr` homepage & Opencell page | `[C]` No supporting test data published |
| *"one of the most reliable products providers in the region"* | Export site | `[C]` |
| *"sector leader Befar carries signature"* | Export site | `[C]` Also poor English |
| Great importance attached to R&D | Both sites | `[C]` No lab, no personnel, no evidence shown |
| 50 / 54 / 50+ countries | Three sources, three numbers | `[C]` Use the printed list instead |

`[I]` **None of these should be repeated verbatim on our page.** Under our own brand-safety rule
(`CLAUDE.md` → Brand and Legal Safety) we should describe what is demonstrable — range, article-code
system, hardness system, sector breadth, manufacturing since 2002 in Bursa — and avoid superlatives
Befar has not substantiated.

---

## 4. Product architecture

Full transcription lives in **`BEFAR_PRODUCT_ARCHITECTURE.md`**. Summary:

- **Two axes, never expressed together by Befar.** Function (foam / backing pads / wool & microfibre /
  abrasive accessories / chemicals / consumables / sets) × line
  (`turQuaz` → `befar` → `+Plus` → `Opencell` / `Leo`). `[I]`
- **Roughly 300 article codes** across ~40 product families. `[F]`
- **Colour = hardness**, expressed as a 1–5 star rating with a recommended chemical for each step —
  and the mapping **differs per line**, which their own site never explains. `[F]`
- **Article codes are decodable**: family + size class + colour, with `ADV` / `ORB` / `SND` / `L` /
  `OP` suffixes carrying the tier. `[I]`
- **A printed pairing rule**: 150 mm foam → 125 mm backing plate, 180 mm → 150 mm, 220 mm → 170 mm,
  each in soft / middle-hard / hard. `[F]`
- **Chemicals carry a two-digit family number** (60, 75, 76, 80, 85, 90) printed on the pack, which is
  also the code prefix — a ready-made visual system. `[F]`

---

## 5. Product systems

Befar never draws a process diagram, but four genuine systems are stated in their literature.
Detailed in `BEFAR_PRODUCT_ARCHITECTURE.md` §5.

| System | Chain | Why it matters to us |
|---|---|---|
| **A — Machine polishing stack** | Machine → backing plate (soft/mid/hard, diameter-matched) → foam (colour = hardness) → chemical → microfibre | The core story. Turns a pad grid into a configurator. |
| **B — Sanding interface stack** | Sander → sanding base → interface pad (7/15/62 holes, soft or hard) → pad protector → abrasive → non-woven matting → tack cloth | **The most relevant chain for Carsystem.** This is refinish preparation, not detailing, and it connects Befar directly to Carfit abrasives and to the priming/painting phases. |
| **C — Chemical ladder** | 60/76 cream → 75 liquid → 80 polish → 85 anti-hologram → 90 protection → 98 nano ceramic | The badge numbers *are* the ladder. Self-explaining. |
| **D — Headlight restoration set (05812)** | 1000P → 2000P → wool + scratch remover → black foam + polish → wipe | The only closed system Befar ships in one box. A perfect small "system" showcase. |

`[I]` System B is the strategic one. Every other brand page on our site tells a coatings story. Befar
is the only brand that can tell the **interface** story — what sits between the machine and the
surface — and that is a genuinely different chapter of the same refinish process.

---

## 6. Hero products

Ranked in `BEFAR_PRODUCT_ARCHITECTURE.md` §7. Top three:

1. **Opencell** — newest line, own logo, own hardness code, own claim, and by far the best
   photography (black foam, green/red/yellow, macro texture, dark studio, 3000–4021 px).
2. **Backing / interface pads (7 / 15 / 62 holes)** — graphically the strongest objects they make, and
   the ones Carsystem historically actually sold (`93015`, `93115`).
3. **Leo** — the only sub-brand with a mascot and a coherent colour identity (yellow + charcoal).

Plus one non-product hero: **the colour-hardness pad wall** — seven foam colours arranged as a
hardness scale. `[I]` This is the most useful interactive element we could build for this brand and it
does not exist anywhere in the category, including on Befar's own site.

---

## 7. Visual identity

**Critical distinction, per the brief: BEFAR BRAND LANGUAGE ≠ BEFAR CURRENT WEBSITE DESIGN.**
The brand language lives in the *packaging, the catalogue and the objects*. The Wix site is a thin,
recent, low-effort layer on top of it and should be treated as evidence of nothing except neglect.

### 7.1 Colour

Sampled directly from the logo file and the catalogue PDF. Values marked *sampled* are measured;
values marked *observed* are visually assessed and should be confirmed against a physical sample.

| Colour | Value | Where it lives | Centrality | Origin |
|---|---|---|---|---|
| **Befar Red** | `#EA080B` *(sampled, logo)* | Logo plate, catalogue accents, retail cartons, page-number tabs, the entire brand video's duotone | **Core.** The brand is unmistakably red. | Brand — predates the current site |
| Catalogue Red | `#E4072F` – `#DB052C` *(sampled, PDF)* | Catalogue cover block, header rules, legend tables | Core, but **inconsistent with the logo red** — the print red is measurably more crimson | Print production, not a defined brand value `[I]` |
| **Charcoal / near-black** | `#16191E` – `#0B0A10` *(sampled)* | Professional chemical cartons, `+Plus` and `Opencell` boxes, catalogue cover panel, pad velcro faces | **Core.** The second brand colour, and the one that carries all premium signalling | Brand — packaging-derived |
| **turQuaz Cyan** | `#00A6D2` *(sampled, catalogue p.47)* | `turQuaz` sub-brand only | Sub-brand | Brand |
| **Leo Yellow** | *observed*, a saturated warm yellow | Leo pads, Leo packaging, Leo backing plates | Sub-brand | Brand |
| White / light grey | — | Bottles, boxes, the entire photography backdrop | Supporting | Brand + photography |
| Plum / purple, blue, orange-red | — | Chemical colour-band coding (80, 90, 85) | Functional coding, not brand palette | Packaging |
| Foam colours (white, orange, yellow, blue, black, cherry, cream, green, red) | *not reliably samplable* | The products themselves | **Functional, and the most meaningful colour system Befar owns** | Product |

**Colour warning.** `[I]` Befar's product photography has **inconsistent white balance across shoots** —
the same "orange" foam reads as saturated orange in one image and salmon-pink in another; a red sanding
block samples as orange. Any colour swatch we publish must come from a controlled reshoot or a physical
sample, **not** from their JPEGs. This is a procurement item (§17).

**Not brand colours.** `[I]` The mid-grey header bar and gradient panels on the Wix site, and the
light-blue gradient sponge cartons in the older catalogue photography, are artefacts of a template and
an older packaging generation. Neither should inform our palette.

### 7.2 Typography

| Where | Typeface | Status |
|---|---|---|
| Wordmark | Custom geometric rounded sans, single-storey `a` | Brand asset `[F]` |
| Slogan | English roundhand script — export site loads Google `Italianno` | Brand-used, `[I]` weak |
| Catalogue headings | Heavy condensed grotesque, all-caps, tight tracking (`COMPOUNDING FOAM`, `PRODUCT CATALOG`) | `[I]` The strongest typographic voice they have — industrial, confident, legible |
| Catalogue tables | Narrow condensed sans, all-caps micro-labels | `[I]` Genuinely well-suited to spec data |
| Export site body | `Maven Pro` + `Montserrat` | `[F]` Agency default, not a brand decision |
| Wix site body | Wix template defaults | `[F]` No decision at all |

`[I]` There is a real typographic idea buried in the catalogue — heavy condensed caps for product
names, narrow condensed caps for spec labels — that nobody carried into digital.

### 7.3 Iconography and graphic devices

`[F]` Genuine, ownable devices found in their material:

- **The face icon** — embossed in plastic, printed on every pack.
- **The star hardness rating** (★ to ★★★★★) with a paired "apply with" column.
- **Two-digit product numbers** on chemical packs (60/75/76/80/85/90) and box-quantity numbers on
  sponge cartons (24, 36, 66, 200).
- **The hole constellations** on interface pads — 7, 15, 62 holes, plus a 53-hole variant and a
  16-hole orbital foam. Precise, mechanical, and beautiful.
- **Foam surface geometries** — flat, waffle, conical, elips die-cut, "air lines" orbital grooves,
  wave/egg-crate. Each is a distinct silhouette in profile.
- **The "red object per sector"** device — red car, red train, red jet, red yacht, red kitchen.

`[I]` The hole constellations and the foam profiles are the two most under-exploited assets in the
entire brand. They are already a visual system; nobody has ever drawn them as one.

### 7.4 Photography

Two entirely different registers coexist, and Befar treats them as interchangeable. `[I]` They are not.

**Register 1 — catalogue studio.** ~120 images, mostly 4608 × 3072, white/light-grey seamless,
consistent three-quarter low angle, soft top light, short cast shadow, product usually shown as a
face-plus-profile pair. `[I]` Honest, consistent, high-resolution, and — with white balance corrected
and backgrounds cut — genuinely good. This is a real asset base.

**Register 2 — dark studio.** A much smaller set (Opencell, Leo Nano, pads-on-black-with-reflection),
2240–4021 px, black background, hard rim light, reflective surface. `[I]` This is the premium register
and it is where Befar's product actually looks expensive. It is used on maybe six images.

**Register 3 — licensed stock.** The Lamborghini on catalogue p.42, the Porsche on p.46, the sector
tiles. `[I]` Composited with fake drop shadows. Unusable and, if we reused it, legally unwise.

**Register 4 — real work.** Exactly one shoot: gloved hands working a red car's headlight area, at
6720 × 4480. `[I]` The best photograph they own, and it is buried on the About page.

### 7.5 Video

One asset: `nargildisticaret.com/video/befar.mp4`, H.264, 1280 × 720, 42.9 s, 2.0 Mbps. `[F]` Genuine
workshop footage — a rotary polisher worked across a car bonnet from several angles — but a **heavy red
duotone is baked into the file** and cannot be reversed. `[I]` Usable only as a small stylised texture
panel; not adequate for a full-bleed hero.

---

## 8. Packaging language

`[I]` This is where Befar's real design system lives, and it is considerably better than their website.

### 8.1 The system

| Line | Carton / label | Signal |
|---|---|---|
| **Befar professional chemicals** | Charcoal/near-black carton, white lockup, **colour band across the top**, large **two-digit number badge**, bilingual TR/EN product name, "Türkey" at the foot | Serious, technical, systematic |
| **Befar accessories / retail** | **Red** carton or printed poly bag, white lockup, product photo window | Shelf-facing, consumer |
| **Befar +Plus** | Black box, gold/coloured wave, oversized `+`; bottles use a black label with a coloured wave and a number | Premium upgrade |
| **Opencell** | Black, minimal, wordmark only; the product is the graphic | Newest, most confident |
| **Leo** | Yellow + charcoal, dog silhouette | Enthusiast / detailing |
| **turQuaz** | Cyan + white, leaf-and-swoosh mark, simple numbered `1` / `2` | Value / eco |
| **Foam pads (bulk)** | No carton — the **pad itself is the packaging**: dark velcro face, white printed `befar` / `befar Plus` / `Leo`, plus `ROTARY SYSTEM` / `ORBITAL SYSTEM` | The product is the brand surface |

### 8.2 The three ideas worth stealing (as *ideas*, not as artwork)

1. **The number badge.** `75`, `80`, `85`, `90` on chemicals; `24`, `36`, `66`, `200` on pad cartons.
   A two-digit number as a primary graphic element is confident, industrial, and instantly
   systematises a range. `[I]`
2. **Colour as function, never as decoration.** Every colour on a Befar product means something —
   hardness, abrasive grade, line tier. Nothing is coloured to look nice. `[I]`
3. **The disc face as a badge.** A dark circular velcro face with a white wordmark is a strong,
   repeatable, circular brand unit — and the pads are already photographed face-on. `[I]`

### 8.3 Packaging problems

`[F]` The professional cartons are printed **"Türkey"** — a misspelling of "Turkey" — on multiple
products. `[I]` A small thing, but a real indicator of the production standard, and a reason to write
our own copy rather than transcribe theirs.

`[I]` Two product generations are visible side by side across their material: an older generation with
**red plastic backing hubs and a red-and-white sponge carton**, and a current generation with
**dark navy/charcoal velcro faces**. The catalogue PDF is largely the older generation; the Wix site is
largely the newer one. Any product imagery we use must be checked for generation consistency.

---

## 9. Website audit

Two official sites, both weak, weak in different ways.

### 9.1 `befar.com.tr` — the Turkish site

**Platform:** Wix. 19 pages. Sitemap `lastmod` 2025-04-11. Footer reads **"©2021, Befar Web Burak Bulut
Creative Studio"**. `[F]`

#### WHAT BEFAR WEBSITE DOES WELL

The honest list. It is short.

1. **The product tables are actually good data.** Every product page is a colour / code / dimension
   table. That is exactly the right information for a B2B buyer, and it is complete. `[F]`
2. **The photography is high-resolution and consistent.** 136 of 172 images are 3000 px+, shot in a
   consistent studio setup. `[F]` `[I]` They uploaded camera originals — sloppy for performance, but it
   means the assets survive.
3. **The Opencell page has a point of view.** One product, one claim, one dark hero image, one CTA.
   `[I]` It is the only page on the site that looks designed rather than assembled.
4. **The digital catalogue is real and complete.** A 48-page bilingual PDF, kept in one place, actually
   linked. `[F]`
5. **A fair-lead-capture flow exists.** A dedicated landing page and form for trade-show visitors.
   `[I]` Clumsily executed, but it shows commercial intent.

#### WHAT WE SHOULD NOT COPY

Being direct, as asked.

1. **The information architecture is a list of pages, not a structure.** Ten product pages sit flat in
   one dropdown. `Leo Ürün Serisi`, `Seramik Ürünleri` and `Setler` all contain the same Leo nano
   ceramic set. `Diğer Ürünler` ("Other products") and `Amatör Grubu` (titled "Diğer Ürünler" but
   `<title>` says "Yeni Ürünler") overlap and contradict each other. `[F]` There is **no way to
   navigate by hardness, by machine, by diameter, or by job** — the four things a buyer actually knows.
2. **The two-axis architecture is invisible.** A user cannot see that `+Plus`, `Opencell`, `Leo` and
   `turQuaz` are *tiers* of the same range. `[I]` The brand's best idea is unexpressed.
3. **The colour-hardness system does not exist on the website at all.** It is printed on almost every
   page of the PDF and appears on **zero** web pages. `[F]` `[I]` This is the single largest content
   failure on the site.
4. **Dead and broken navigation.** The export site's nav links `turkuaz.php` and `leo.php` both return
   **404**. `[F]` `befar.com.tr` ships a page literally called `/blank` ("Yeni Sayfa"), plus
   `/coming-soon-01` and two near-duplicate contact forms, all live in the sitemap. `[F]`
5. **An empty blog.** *"Henüz bu dilde yayınlanmış bir yazı yok"* — no posts have ever been published.
   `[F]` `[I]` An empty blog is worse than no blog.
6. **SEO is effectively absent.** Of 19 pages, **one** has a meta description. Most have **no `<h1>`**
   at all. **No** page has an `og:image`. `[F]` Page titles are generic (`Yeni Sayfa | Befar`).
7. **Performance is bad and the cause is self-inflicted.** Page HTML alone runs **605 KB – 2.36 MB**
   before images. `[F]` The velcro-foam page ships 41 images, many of them 4608 × 3072 originals.
   `[I]` This is a Wix gallery pointed at camera files.
8. **Turkish only.** No English, no localisation, despite claiming 50+ export markets. `[F]`
9. **Copyright frozen at 2021** while the sitemap says 2025. `[I]` It reads as abandoned even though it
   is not.
10. **No dealer locator, no distributor list, no "where to buy".** `[F]` For a company that sells
    exclusively through distributors, this is the most commercially damaging omission on the site.
11. **No technical documentation of any kind.** No TDS, no SDS, no application guides. `[F]`
12. **Generic template visual language.** Centred stock-photo hero, three feature tiles, a contact form.
    `[I]` Nothing on the page could not be swapped for any other manufacturer's site by changing the
    photos.

### 9.2 `nargildisticaret.com` — the English export site

**Platform:** hand-built Bootstrap, jQuery, Owl Carousel, Stellar parallax. Credited *"Designed by
Marsgen"*, *"2019 © Nargil"*. `[F]`

`[I]` Assessment: **better structured, worse maintained.** It has the things the Wix site lacks — an
English About with real substance, the five-sector story, a video, and product pages keyed by article
code. It also has broken nav links, an invalid TLS certificate, `document.write`-era browser-warning
scaffolding, and images that stop at 800 px on most pages.

`[I]` The most useful thing about it is structural: **its product images are addressed by Befar article
code** (`images/urunler/04401/04401.jpg`). That is the only machine-readable link between Befar's
codes and Befar's photography that exists anywhere.

### 9.3 Accessibility and technical notes

`[F]` Missing `<h1>` on most pages; product tables rendered as Wix layout components rather than
semantic tables in several places; no `og:image`; the export site's TLS certificate does not validate;
no visible focus styling on either site; the script slogan is delivered as an image in several places
with no text alternative.

---

## 10. Media asset inventory

Full table in **`BEFAR_ASSET_INVENTORY.md`**. Summary:

| Source | Assets | ≥3000 px | 2000–2999 px | Verdict |
|---|---|---|---|---|
| `befar.com.tr` (Wix) | 172 | 136 | 17 | Strong. Camera originals, consistent studio setup. |
| `nargildisticaret.com` | 111 | 11 | 11 | Useful because code-keyed; 74 files capped at 800 px. |
| Catalogue PDF | 48 pages | — | — | The authority for logos, hardness system, article codes. |
| Brand video | 1 | — | 720p | Red-baked, low-res. Reference only. |

**Roughly 153 images are usable at 2000 px or wider.** `[F]` That is more than enough to build a
landing page without commissioning new photography — with two caveats: white balance must be corrected,
and cut-outs must be produced by us (no PNG-with-alpha exists anywhere).

---

## 11. Content / claims inventory

### Usable, defensible content

| Content | Source | How we would use it |
|---|---|---|
| Manufacturer in Bursa, Turkey, since 2002 | Both official sites `[F]` | Origin line |
| Family-owned company | `befar.com.tr` `[F]` | Character detail |
| Foam, backing/interface pads, microfibre, polishing apparatus, surface chemicals | Both `[F]` | Range description |
| Also used in aviation, rail, marine, furniture | Both `[F]` | Credibility without superlatives — a strong, checkable fact |
| Sells through a dealer network, Turkey and abroad | Both `[F]` | Explains our own role |
| Colour = hardness, ★ to ★★★★★, with recommended chemical | Catalogue `[F]` | **The centrepiece.** |
| Foam diameter → backing-plate diameter pairing rule | Catalogue `[F]` | Configurator logic |
| Two-digit chemical family numbers | Packaging + catalogue `[F]` | Visual system |
| ~300 article codes across ~40 families | Catalogue `[F]` | Depth signal |
| Export market list including Serbia | Catalogue p.3 `[F]` | Legitimacy, and locally relevant |
| *"Kalite Keyif Verir…"* / *"Enjoy Quality…"* | Catalogue, packaging `[F]` | Quotable **with attribution**, in the original |

### Claims to avoid or heavily qualify

`[C]` "Much longer service life" · "sector leader" · "most reliable in the region" · "great importance
to R&D" · the 50 / 54 / 50+ country figure.

`[I]` Per `CLAUDE.md`, we must also avoid asserting any distribution status for Carsystem ("zvanični
distributer", "ekskluzivni partner") until confirmed. Safe wording: *"Befar program u ponudi"*,
*"partnerska mreža"*.

---

## 12. What is reusable

| Reusable | Not reusable |
|---|---|
| The colour-hardness system (as data and as an interaction) | Their presentation of it — a static red table |
| The article-code grammar | Their code lists as raw tables |
| The backing-plate ↔ foam pairing rule | — |
| The chemical number ladder (60→75→80→85→90) | The packaging artwork itself |
| The five-sector story (automotive / aviation / rail / marine / furniture) | Their 686 px stock sector tiles |
| ~153 product photographs at ≥2000 px | Their white balance; their backgrounds; anything composited onto supercars |
| The face icon and the Leo dog as brand marks | The 300 px transparent PNG we currently have |
| The hole constellations and foam profile geometries | Their 1080 px explainer diagrams |
| *"Kalite Keyif Verir…"* as an attributed quote | The `Italianno` script setting |
| The dark-studio photographic register | The mid-grey Wix template chrome |
| The catalogue's condensed-caps typographic voice | Wix and Bootstrap defaults |

---

## 13. What should not be copied

Consolidated, in priority order:

1. **A flat page-per-category IA.** Their fatal flaw. Our page must be navigable by *job, hardness,
   machine and diameter*, not by their internal category names.
2. **Overlapping, contradictory categories.** "Diğer Ürünler" vs "Yeni Ürünler" vs "Amatör Grubu" vs
   "Setler", with the same products in several.
3. **Hiding the system.** Never ship a Befar page without the colour-hardness key visible.
4. **Placeholder and dead pages.** No `/blank`, no empty blog, no 404s in nav.
5. **Uncompressed camera originals.** Their 2.36 MB HTML page is a cautionary tale.
6. **Stock supercars with fake shadows.** Legally risky and visually dishonest.
7. **The script slogan as a design system.** Quote it; do not build type on it.
8. **Unsubstantiated superlatives.**
9. **A contact form as the only conversion path.** Ours ends at *"Pronađi najbližu prodavnicu"*.
10. **Colour used decoratively.** On Befar products colour *means* something. Our page must respect
    that, which also means not tinting our UI in foam colours for fun.

---

## 14. Comparison with our existing brand pages

Reviewed without modification: `RmBrandPage` (8 sections), `BaslacBrandPage` (10),
`CarfitBrandPage` (12), `CosmosBrandPage`, `CarsystemBrandPage` (5), plus the generic `BrandPage`
fallback and the shared `BrandSectionNav`.

### 14.1 Patterns we already have

| Pattern | Where | Reuse for Befar? |
|---|---|---|
| Sticky in-page section nav (`BrandSectionNav`, scroll-spy) | Carfit, others | **Yes** — a shared UI convention worth keeping |
| Hero → system → families → products → documentation → CTA spine | R-M, baslac, Carfit | **Partly** — keep the spine, do not keep the section list |
| "One connected workflow" system narrative | R-M (*"Jedan povezan radni tok"*), baslac (*"Sistem za jasan radni tok"*) | **No** — three brands already say this. A fourth would be template-with-a-new-colour. |
| Job/task-first entry (*"Radionica ne radi po kategorijama. Radi po zadacima."*) | Carfit | **Conceptually yes, executionally no** — Carfit owns the "tasks" framing |
| Digital colour tooling (Color Coverage, eSENSE, Formula Finder) | R-M, baslac | **Not applicable** — Befar makes no tinted coatings |
| Variant-by-colour rail with swatches | Cosmos (RAL) | **Adaptable** — but Befar's colour means hardness, not appearance. Same component, opposite meaning. |
| Application/product finder | Cosmos | **Yes, and better** — Befar's data supports a genuine configurator |
| Manufacturer rail / credibility band | Generic `BrandPage` | Yes |
| Final CTA to partner network | All | **Mandatory** — the primary site CTA |

### 14.2 What must not be repeated

`[I]` Four of our five bespoke brand pages already open with some version of *"a connected system from
preparation to topcoat"*. R-M, baslac and Carsystem all lead with process-chain language; Carfit leads
with tasks; Cosmos leads with colour. **A Befar page that opens with "a connected workflow" would be
the moment the site starts to look like a template.**

### 14.3 Where Befar gets its own character

`[I]` Three things are true of Befar and of no other brand on our site:

1. **It is the only brand whose products are not coatings.** It is hardware and interface — the
   physical layer between machine and paint. Nothing else on the site occupies that space.
2. **It is the only brand where colour is a measurable property**, not an appearance. Cosmos colour is
   RAL. R-M colour is a formula. Befar colour is *hardness*. That inversion is a gift.
3. **It is the only brand with a decodable article-code grammar** that can drive navigation directly.

`[I]` The Befar page should therefore be the site's **tactile, mechanical, specification-led** chapter —
where the other pages are chemical, chromatic and process-led. Same design system, genuinely different
register.

### 14.4 Shared Carsystem principles to keep regardless

Serbian latinica; server-rendered SEO-critical text; sticky section nav; the *"Pronađi najbližu
prodavnicu"* end CTA; no private pricing exposed; reduced-motion and mobile fallbacks for any
animation; no hard-coded long-term business data inside components.

---

## 15. Opportunities

`[I]` Ranked by value against effort.

| # | Opportunity | Why it wins |
|---|---|---|
| 1 | **The hardness scale as the primary navigation.** Seven foam colours laid out as a ★→★★★★★ scale; picking a hardness filters the range and names the right chemical. | Befar's best idea, invisible everywhere including on their own site. Data already exists. |
| 2 | **A pad configurator.** Machine (rotary / orbital) → diameter (150 / 180 / 220) → hardness → the exact article code, plus the *required* backing plate. | The pairing rule is printed in their catalogue. We would be the only place in the region where this is usable. |
| 3 | **The interface / preparation chapter (System B).** Sanding base → interface pad (7/15/62 holes) → pad protector → non-woven → tack cloth. | Connects Befar to the refinish process rather than to detailing, and links naturally to Carfit. |
| 4 | **Article code as a first-class UI object.** Show `04403` the way a parts catalogue does, and let it be searched. | Their codes are decodable; bodyshops order by code. |
| 5 | **The hole-constellation motif.** 7 / 15 / 62 / 53 / 16 holes drawn as precise vector patterns — as section dividers, backgrounds, loading states, the favicon. | A ready-made, ownable, entirely un-exploited graphic system. |
| 6 | **Foam profile silhouettes.** Flat / waffle / conical / elips / air-lines / wave drawn in cross-section. | Explains a real product difference that photography cannot show. |
| 7 | **Line ladder made explicit.** `turQuaz` → `befar` → `+Plus` → `Opencell` / `Leo`, stated once, clearly. | Befar has never shown this. Instantly clarifies a 300-code range. |
| 8 | **The chemical number ladder as a visual sequence.** 60 → 75 → 80 → 85 → 90 → 98. | The numbers do the work; almost no design needed. |
| 9 | **The five-sector fact.** Aviation, rail, marine, furniture — quietly stated, not shouted. | A checkable credibility fact that costs nothing and is unusual for a consumables brand. |
| 10 | **Rescue the one great photograph.** The 6720 × 4480 gloved-hands headlight shot, currently buried on their About page. | Free hero. |

---

## 16. Three design territories

`[I]` Directions, not designs. Each is genuinely distinct in structure and atmosphere, not just in
palette. **Territory B is derived primarily from the packaging and the objects, not from their website**,
as required.

---

### Territory A — "The Hardness Scale"

**Core idea.** The page *is* the colour-hardness system. A single continuous scale from softest to
hardest runs down the page as the primary navigation; everything else — chemicals, backing plates,
machines, article codes — hangs off the position you select on it.

**Atmosphere.** Precise, calm, instrument-like. A measuring device rather than a brochure. Closer to a
well-made spec tool than to a marketing page.

**Palette.** Charcoal `#16191E` ground; the seven foam colours as the *only* saturated colour on the
page, each appearing exactly where it means something; Befar red reserved strictly for the brand mark
and the primary CTA. Large areas of near-black and white.

**Photography.** The dark-studio register, extended. Pads shot face-on, isolated, evenly lit, sequenced
by hardness. Product-as-specimen. Minimal lifestyle; one or two moments of real work at most.

**Product presentation.** Circular. The pad face is the unit — a disc with a wordmark, a colour, a star
rating and a code. Discs repeat down the page at consistent scale so hardness is readable by colour
alone.

**Motion.** Almost none, and all of it functional: the scale animates as you move along it; discs
cross-fade between hardness steps; numbers count. Nothing decorative. Trivially reduced-motion safe.

**Why it fits Befar.** It takes the one genuinely excellent idea Befar owns and makes it the entire
architecture. It is also the most defensible against "template with a new colour", because no other
brand on our site could use this structure — none of them has a scalar product property.

**Risk.** Can read cold or clinical, and it front-loads a lot of conceptual weight before the user sees
a product. It also depends on colour accuracy we do not yet have — if the swatches are wrong, the whole
page is wrong.

---

### Territory B — "Industrial Object" *(derived from the packaging and the products, not the site)*

**Core idea.** Build the page's language out of Befar's *physical* design system: the charcoal carton,
the two-digit number badge, the condensed caps of the catalogue, the embossed face icon, and above all
the hole constellations and foam profiles. The page looks like Befar's packaging shelf, not like
Befar's website.

**Atmosphere.** Workshop-industrial, confident, slightly rough. Print-like. Weight and edges rather than
glass and glow. The feeling of a well-made parts catalogue that someone actually enjoys using.

**Palette.** Charcoal and off-white as the ground, in large flat planes with hard edges — taken directly
from the professional chemical cartons. Befar red as a *structural* element (bands, tabs, page-number
blocks, rules) rather than as an accent. Sub-brand colours (Leo yellow, turQuaz cyan) appear only inside
their own sections, exactly as they do on the shelf.

**Photography.** The catalogue studio register, corrected and cut out — products on flat colour planes,
hard-edged, no soft glow, arranged like a printed page. Deliberately un-cinematic. Real macro texture of
open-cell foam where it earns its place.

**Product presentation.** Objects on planes, with big two-digit numbers and article codes set as
typography, not as metadata. Hole constellations drawn as vector patterns and used as section dividers
and backgrounds. Foam profiles drawn in cross-section beside the photographs.

**Motion.** Mechanical and stepped rather than eased — things snap and index rather than float. Hole
patterns rotate slowly in the background of section headers. Numbers flip like a counter.

**Why it fits Befar.** It is the only direction built from what Befar actually manufactures and prints.
It rescues the strongest part of their identity — the packaging — from the weakest — the website. It
also gives our site a genuinely different texture from the coating brands, which are all glossy.

**Risk.** Industrial-print aesthetics can tip into pastiche, and heavy flat planes plus condensed caps
can become hard to read on mobile. It also demands the most bespoke illustration work (the hole
patterns and profiles must be drawn, not photographed).

---

### Territory C — "Between the Machine and the Paint"

**Core idea.** Structure the page as the physical stack, in order, from the tool down to the surface:
machine → backing plate → interface pad → foam → compound → cloth → finished paint. The user descends
through the layers of the process, and Befar's products are what sit between each pair.

**Atmosphere.** Cinematic, dark, tactile. Close-focus. Depth and layering. The register of Befar's own
best photograph — gloved hands, red bodywork, reflected light — extended into a full narrative.

**Palette.** Deep charcoal to near-black ground with strong directional light; automotive red as the
surface being worked on rather than as a brand accent; foam colours emerging out of shadow. High
contrast, narrow midtones.

**Photography.** Register 4 (real work) plus Register 2 (dark studio), heavily macro. Hands, tools,
surfaces, reflections, the swirl pattern before correction and the flat gloss after. Depth of field used
deliberately as a layering device.

**Product presentation.** Exploded and stacked — the pad shown *mounted*, the interface pad shown
*between* things, the chemical shown *on* the pad. Products in context rather than isolated.

**Motion.** Scroll-driven depth: layers separate and recompose as you descend the stack. Slow, weighty
parallax. This is the most motion-dependent of the three and needs the most careful reduced-motion and
mobile fallback work.

**Why it fits Befar.** It is the only direction that dramatises what Befar actually *is* — the interface
layer — and it makes their strongest photograph the anchor of the page rather than a footnote. It also
tells the System B (preparation) story naturally, which is the story most relevant to Carsystem.

**Risk.** The highest asset dependency of the three: it needs good workshop photography, and Befar owns
exactly one usable shoot. Without a reshoot it will lean on stock, which is precisely what we criticised
them for. It is also the easiest of the three to make look like every other dark automotive site.

---

### Recommendation

`[I]` **Territory B as the foundation, with Territory A as the page's centrepiece section.**

B gives Befar a visual identity that is unmistakably theirs, derived from objects they actually make,
and gives our site a texture that no other brand page has. A supplies the one interaction that makes the
page genuinely useful rather than merely handsome. The two are compatible: an industrial-print page
whose central chapter is a working hardness scale.

C is the most seductive and the least buildable today — it should be revisited only if Befar or
Carsystem can fund a workshop shoot.

---

## 17. Missing assets / blockers

| # | Missing | Severity | Blocks |
|---|---|---|---|
| 1 | Vector or high-resolution transparent **Befar logo** | **Blocker** | Hero, header, any large mark. Current best is a 300 × 360 PNG with imperfect edges; `public/brands/befar.svg` in our repo is a placeholder, not the real mark. |
| 2 | Vector logos for `Opencell`, `+Plus`, `Leo`, `turQuaz` | **Blocker** for sub-brand UI | Catalogue p.47 can be traced as a stopgap, but not shipped as final. |
| 3 | **Accurate foam colour references** | **Blocker** for Territory A | Their photography has inconsistent white balance; we cannot derive true swatches from it. Needs physical samples or a controlled reshoot. |
| 4 | Confirmation of **which Befar codes Carsystem actually stocks** | **Blocker** for the product section | Business input. The legacy WP site carried 12 codes; current range unknown. |
| 5 | Technical data sheets (TDS) | High | Any "Documentation" section. None exist publicly. |
| 6 | Safety data sheets (SDS) for the chemical range | High | Legally relevant if we list compounds and polishes. |
| 7 | Serbian product naming and copy | High | Everything. Legacy WP names are inconsistent with Befar's own family names. |
| 8 | PNG-with-alpha packshots | High | We must cut out the 4608 px JPEGs ourselves — roughly 40–60 images for a first release. |
| 9 | Factory / production photography | Medium | Any credibility section. They claim 2500 m² and show none of it. |
| 10 | Clean, untinted workshop video | Medium | Territory C. The one asset is 720p with red baked in. |
| 11 | Foam technical specs (density, PPI, cell structure) | Medium | Star ratings only. "Opencell" implies open-cell foam but nothing is published. |
| 12 | Certifications (ISO / REACH / TSE) | Medium | None found on any source. |
| 13 | Instagram `@befar_tr` content audit | Medium | JS-gated; could not be read programmatically. `UNVERIFIED` — needs a manual look. |
| 14 | Resolution of the 2500 m² vs 1000 m², and 50 vs 54 country conflicts | Medium | Any "about the manufacturer" copy. Ask Befar. |

`[I]` Items 1–4 are the real gate. Everything else can be worked around or written by us.

---

## 18. Sources

### Official — Befar

| Source | URL | Retrieved |
|---|---|---|
| Turkish website (Wix, 19 pages) | `https://www.befar.com.tr/` | 2026-08-09 |
| Sitemap | `https://www.befar.com.tr/pages-sitemap.xml` (`lastmod` 2025-04-11) | 2026-08-09 |
| About | `https://www.befar.com.tr/hakkımızda` | 2026-08-09 |
| Product pages | `/befar-cırtlı-süngerler`, `/aplikatörlü-polisaj-süngerleri`, `/leo-ürün-serisi`, `/taban-grubu`, `/zımpara-grubu`, `/1-litre-pasta-grubu`, `/seramik-ürünleri`, `/set-grubu`, `/diğer-ürünler`, `/amatör-grubu`, `/general-6` (Opencell) | 2026-08-09 |
| Contact | `/contact-10`, `/general-6` | 2026-08-09 |
| Blog (empty) | `/blog` | 2026-08-09 |
| **Product catalogue, 48 pp., bilingual, co-branded with Nargil** | `https://www.befar.com.tr/_files/ugd/446a5e_9192e551cfa540ae95f10c5247f2587b.pdf` | 2026-08-09 |
| Instagram | `https://instagram.com/befar_tr` | Not readable — JS-gated `UNVERIFIED` |
| Facebook | `https://www.facebook.com/befar.tr` | Not audited |

### Official — Nargil Dış Ticaret (Befar's export arm)

| Source | URL | Note |
|---|---|---|
| Export site (English) | `https://www.nargildisticaret.com/` | TLS certificate does not validate |
| Product pages | `/cirtli-polisaj-sungerleri.php`, `/aplikatorlu-polisaj-sungerleri.php`, `/kuzu-postu-polisaj-pedleri.php`, `/mikrofiber-parlatma-bezleri.php`, `/yuzey-asindirici-aparatlar.php`, `/tabanlar.php`, `/aparatlar.php`, `/likit-ve-krem-pasta-cila.php`, `/pasta-cila-hare-giderici.php`, `/befar-plus.php`, `/diger.php` | |
| Broken pages | `/turkuaz.php`, `/leo.php` | **404** |
| Brand video | `/video/befar.mp4` | 1280 × 720, 42.9 s |
| Code-keyed image library | `/images/urunler/<code>/…` | |

### Carsystem legacy (archival — evidence for the identification)

| Source | URL |
|---|---|
| Wayback CDX index for `carsystemirm.com` | `http://web.archive.org/cdx/search/cdx?url=carsystemirm.com*` |
| Befar category (2022-07-07) | `web.archive.org/web/20220707035802/http://carsystemirm.com/proizvodi-kategorije/befar/` |
| Međupodloške (2022-08-15) | `.../20220815035130/.../befar/medjupodloske/` |
| Podloške (2022-08-15) | `.../20220815041029/.../befar/podloske/` |
| Sunđeri za poliranje (2022-08-15) | `.../20220815044434/.../befar/sundjeri-za-poliranje/` |
| Archived Befar logo | `.../20240109132828if_/http://carsystemirm.com/wp-content/uploads/2020/10/befar-logo-removebg-preview.png` |

### Our own repository (read only — nothing modified)

`lib/carsystem-data.ts` (Befar brand + 8 SKUs) · `data/knowledge/brand-sources.ts` (the incorrect
"no-official-source-found" entry) · `data/knowledge/brands/befar.manifest.generated.json` ·
`public/brands/befar.svg` (placeholder) · `public/products/befar/*.svg` (8 generated illustrations) ·
`components/brand/*`, `components/rm-brand/*`, `components/baslac-brand/*`,
`components/carsystem-brand/*` (structural comparison).

### Name collision — explicitly excluded

`[F]` **Befar Group Co., Ltd. / 滨化集团 (`befar.com`, `english.befar.com`)** is a large Chinese
petrochemical company in Binzhou, Shandong — caustic soda, propylene oxide, epichlorohydrin. It is
listed on the Shanghai Stock Exchange (601678) and has **no connection whatsoever** to Befar Otomotiv.
`befar.de` is a parked GoDaddy domain. Recorded here so that no future search mistakes one for the other
— which is very likely how the original "no official source found" conclusion was reached.

---

*End of Phase 0. No design work has begun. No production code has been changed.*
