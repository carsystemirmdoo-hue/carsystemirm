# COSMOS LAC — Live Browser Forensic Design Audit

**Subject:** https://cosmoslac.com/ (homepage)
**Date of capture:** 2026-08-07
**Method:** Live rendered-browser audit. Real Google Chrome driven via Playwright (`playwright-core` 1.61.1, `channel: 'chrome'`, H.264 decode available), plus the in-app browser pane for DOM/CSS interrogation. Cookie banner dismissed with **Reject All** on every run.
**Viewports:** 1440×900 (primary), 390×844 (mobile), 768×1024 and 1024×800 (breakpoint spot-checks).
**Research captures:** 102 PNGs in `tmp/cosmos-audit/` — research only, deliberately kept out of `public/` and production assets.

> **Scope note.** This is an observation phase document. No Carsystem code was modified. Every claim below is tagged as **[measured]** (read from the DOM/CSSOM or from geometry), **[observed]** (seen in a rendered capture), or **[inferred]** (reasoning from evidence, explicitly not verified). Anything I could not verify is listed in **UNKNOWNS**.

---

# EXECUTIVE DIAGNOSIS

COSMOS LAC's homepage is not a long site with a lot of animation. It is a **short site with very few, very expensive moments**.

The three numbers that matter most:

| Metric | cosmoslac.com | Our `/brendovi/cosmos-lac` |
|---|---|---|
| Desktop document height | **7,614px ≈ 8.5 viewports** [measured] | **11,443px ≈ 12.7 viewports** [measured] |
| Mobile (390) document height | **7,044px ≈ 8.3 viewports** [measured] | **34,067px ≈ 40.4 viewports** [measured] |
| `<video>` elements on the page | **23** [measured] | **0** [measured] |
| `<canvas>` / WebGL | **0** [measured] | 0 [measured] |
| `<img>` elements | 23 [measured] | 58 [measured] |
| Body background | `rgb(0,0,0)` → inverts to light mid-page [measured] | `rgb(247,247,248)` only [measured] |
| `h1` size | 74.99px condensed [measured] | 64px Archivo [measured] |

The headline finding: **there is no WebGL, no 3D engine, no scroll-scrubbed canvas.** The entire "premium" feel is produced by (a) pre-rendered video, (b) one enormous type scale, (c) a single pinned horizontal scroll, and (d) ruthless brevity. This is entirely reproducible with our approved stack — no paid animation library is required, and nothing here violates `COST_CONTROL.md`.

The second finding, and the one that explains our repeated failures: **COSMOS does not make products big everywhere.** It makes the product *enormous exactly once* (the hero, ~71% of viewport height) and then deliberately small and repetitive everywhere else (~23% in the product rail). The impact is **contrast**, not size. Our page has neither the enormous moment nor the disciplined restraint — every product sits at a uniform ~14% of viewport height inside a card.

The third finding is structural: **our COSMOS page is not a brand page at all.** It renders through the generic `components/brand/BrandPage.tsx` template — breadcrumbs, a brand banner card, then a filter sidebar and a product grid that alone is **8,897px tall** [measured]. Carfit received a bespoke page (`components/brand/carfit/CarfitBrandPage.tsx`); COSMOS did not.

---

# LIVE HOMEPAGE MAP

Section order and heights, read from the DOM at 1440×900 after lazy content settled [measured]. Class names are COSMOS's own (`pran-block__*` — the site is built by PRAN, designed by FAZE, per the footer credit).

| # | Block class | Height | Scene |
|---|---|---|---|
| 1 | `pran-block__hero is--full-height` | 900px | Hero — full-bleed video + headline |
| 2 | `pran-block__clipped-media` | 312px | "FEATURED LINES" — video clipped inside letterforms |
| 3 | `pran-block__featured-horizontal` | **1,961px** | Pinned horizontal product-line rail (8 panels) |
| 4 | `pran-block__marquee` | 184px | "OVER 600 SPRAYS / FOR EVERY USE" |
| 5 | `pran-block__hero` (2nd) | 720px | Production-facility video statement |
| 6 | `pran-block__marquee` | 184px | "SUSTAINABILITY GOALS / ENVIRONMENT" |
| — | `disable--dark` boundary | — | **Theme inverts: dark → light** |
| 7 | `pran-block__content-side-media` | 389px | "GO GREEN OR GO HOME!" + collage |
| 8 | `pran-block__catalogue-download` | 533px | "SPRAY CATALOGUE" black card |
| 9 | `pran-block__banners` | 645px | Store Locator + Private Label, 2-up |
| 10 | `pran-block__clipped-media` | 305px | "UPDATES" — gold foil clipped in letters |
| 11 | `pran-block__links` | 114px | "VIEW ALL NEWS" |
| 12 | `pran-block__featured-blog` | 587px | 2-up news grid |
| 13 | Footer | ~430px | Logo-shaped video, 3 contact columns |

Note the block-type reuse: `pran-block__clipped-media` and `pran-block__marquee` each appear **twice**, `pran-block__hero` twice. Thirteen scenes are built from **nine block types**. This is a design system, not a pile of bespoke sections.

---

# SCENE 01 — HERO

**Captures:** `hero-fine/y0000.png`, `interact/03-menu-open.png` (a different frame of the same video), `hero-fine/y0450.png`

## Initial state
Pure black. A single **Chalk Effect 06 Aegean Blue** can, tilted roughly 20° off vertical, cap at upper-left, occupying the centre-right of the frame. Nothing else but the header.

## Final state (immediately before Scene 02 takes over)
The video has advanced to a **dense wall of Easy Max cans** filling the entire frame edge-to-edge, with the headline sitting on top of it [observed, `y0450.png`].

## Viewport composition [measured at 1440×900]
- **Media:** `<video src="hero-compressed.mp4">`, `1440×900` — **100% of the viewport**. Not a background image, not a canvas.
- **Headline** `IN GREEK, "COSMOS" MEANS WORLD`: `x=30, y=690, w=828, h=67`, `font-size: 74.9952px`. Bottom-left. Left margin **30px** — nearly flush to the viewport edge.
- **Body copy:** 3 lines, ~15px, directly under the headline.
- **Negative space:** the entire upper-left quadrant and the full right third are empty black.
- **Layering:** video is the background layer; type sits directly on it with **no scrim, no gradient overlay, no dark box**. It works because the video's own composition keeps that corner dark.

## Dominant visual
**The product, unambiguously.** Typography is second and does not compete — it is anchored in the bottom-left dead zone the video leaves open.

## Product scale
The can spans roughly **y=130 → y=890 of 900px ≈ 71% of viewport height** [observed]. Width ≈ 45% of viewport. This is the single largest product moment on the entire site.

## Text density
**Nine words** in the headline. ~30 words of body copy. That is the entire hero.

## Colour
Entirely from **the packaging** — the blue of the Chalk Effect can, later the orange/red of Easy Max labels. Background is `rgb(0,0,0)`. Typography is off-white `rgb(244,247,242)`. **Zero decorative colour.**

## What the hero actually is (§7 answered)
- **On load:** the video autoplays immediately, muted, looping. `duration = 25.877s` [measured].
- **The cans are pre-rendered video, not real-time 3D.** There is no canvas element anywhere on the page [measured].
- **The video is NOT scroll-scrubbed.** I initially suspected it was (an early reading showed `paused: true`), but that was a throttled background tab. Sampling `currentTime` against `scrollY` in a foreground window showed time advancing at **1.01× real-time independent of scroll position** [measured, `scrub.json`]. It is a plain autoplay loop.
- **What scrolling changes:** the video translates upward at **0.72× scroll speed** — a 28% parallax lag — for as long as the hero is in view. At `scrollY=100` the video is at `y=-72`; at 900, `y=-650` [measured]. Once the hero has fully exited (`scrollY ≥ 900`) the parallax clamps and it moves 1:1.
- **How the hero exits:** it does **not** pin, wipe, or fade. It simply scrolls away — but 250px slower than the page, so at the moment Scene 02 arrives there is still a **250px band of hero video visible at the top of the viewport** [measured: 900 − 650]. The next scene is revealed by ordinary document flow underneath it.

---

# SCENE 02 — "FEATURED LINES" (clipped media)

**Captures:** `hero-fine/y0450.png`, `hero-fine/y0900.png`

Only **312px tall** [measured] — a deliberately thin scene.

A single line of giant condensed uppercase type, `FEATURED LINES`, spanning `x≈300 → x≈1140` (58% of viewport width), centred, with a thin 1px rule directly beneath the word. **The letterforms are filled with playing video** — a hand shaking a spray can, visible only through the counters and stems of the letters. The fill visibly changes between `y0450` and `y0900` because the video is playing [observed].

This is the site's signature device: **the section title *is* the media window.** No separate image. No heading + image pair. The heading is the crop.

Dominant visual: typography and media simultaneously — they are the same object.
Text density: **two words.**

---

# SCENE 03 — PRODUCT LINE RAIL (the pinned horizontal scroll)

**Captures:** `desktop/01`–`04`, `interact/06-rail-hover-panel1.png`, `bp768/y1400.png`

This is the most mechanically interesting scene, and I measured it exactly.

## Mechanism [measured, `pin.js` output]
- **8 panels × 360px = 2,880px** track width. Viewport 1,440px → **1,440px of horizontal overflow**.
- Section height = **1,961px** = natural height 521px **+ exactly 1,440px** of added scroll runway. The section grows by precisely the horizontal distance it must travel.
- **Phase 1** (`scrollY < ~1130`): `.horizontal-wrapper` is `position: static`, `transform: none`. Rail scrolls up normally.
- **Phase 2 — pin:** switches to **`position: fixed; top: 189.641px`** and `translateX` runs **0 → −1440px at exactly 1:1 with vertical scroll** (y=1200 → −178; y=1600 → −578; y=2000 → −978; y=2400 → −1378).
- **Phase 3 — release** (`scrollY ≥ ~2640`): back to `position: static` with `transform: matrix(1,0,0,1,-1440,1440)` — the +1440px Y translate compensates for the runway so the rail lands exactly at the section's bottom. A clean, jump-free unpin.
- Pin offset `189.641px` with a 520px panel in a 900px viewport = `(900 − 520) / 2 = 190`. **The pinned rail is exactly vertically centred.**

It uses JS-driven `position: fixed` with a compensating translate, **not** `position: sticky` [measured]. This is GSAP-ScrollTrigger-style pinning [inferred — I did not confirm the library].

## Panel anatomy (identical for all 8)
`<a class="horizontal-wrapper__item-inner product_hover direction-hover">`, 361×519px:
1. Eyebrow — category descriptor, ~13px, letterspaced, uppercase, centred (`PREMIUM GLOSS LINE`, `SATIN SPRAY LINE`, `ULTRA MATT LINE`, `AFFORDABLE GLOSS COLOUR LINE`, `WORLDS FIRST BIKE LINE`, `100% GRAFFITI — PAINT LINE`, `CAR CARE IS AN ART`)
2. Line name — ~34px condensed bold uppercase, centred
3. Large vertical gap (~110px of pure black)
4. Can packshot, centred, **~205px tall**
5. `VIEW LINE` CTA — hidden until hover on desktop

The 8th panel is not a product: it is **`VIEW ALL PRODUCTS`** with a circular outlined arrow button — the exit ramp.

## Product scale here
Can ≈ **205px in a 900px viewport ≈ 23% of viewport height** [observed]. This is the number our team has been getting wrong in the opposite direction — but note the direction of the error. COSMOS's rail products are *small*. The hero product is *huge*. **The system is built on that 71% vs 23% contrast.**

## The hover interaction (§14 — this is the most transferable micro-interaction on the site)
On hover, `.hovered` is added and the panel:
- **fills with the featured product's own colour** — RAL → pink (matching the RAL 3015 Light Pink can), Easy Max → yellow/gold (matching its cap), Fast Acrylic → cyan, FLAME → magenta [observed, `interact/06`, `desktop/01`, `hero-fine/y0450`]
- flips the line name and eyebrow to **black** for contrast
- fades in the underlined `VIEW LINE` CTA

**The colour is derived from the packaging, not from a brand palette.** On a page that is otherwise pure black and off-white, one saturated product colour arriving on hover is the entire colour event. `href` targets are real: `/c/color-lines/easy-max/` [measured].

## §8 answered: separate components or one choreography?
**One shared choreography, unambiguously.** All 8 panels are the same DOM template with the same class list, the same internal rhythm, the same packshot scale, and the same hover behaviour — differing only in eyebrow text, name, can image, and hover colour. There is no per-line bespoke scene, no per-line video, no per-line background. RAL, Easy Max, Chalk Effect, Fast Acrylic, Spray.Bike, FLAME and Master Mechanic are **variations of one component**, presented as a single continuous horizontal move.

---

# SCENE 04 — MARQUEE: "OVER 600 SPRAYS / FOR EVERY USE" (§10)

**Capture:** `desktop/05-y2997-scroll.png`, `desktop/04-y2397-scroll.png`

184px tall. Full-bleed. White condensed uppercase, ~130px cap height, on black, scrolling horizontally and continuously. Separated by a **rainbow-gradient "≋" glyph** — a stacked zigzag lifted from the COSMOS logo language.

### Where the impact actually comes from
The user asked whether the "600 sprays" moment lands via typography, products, animation, repetition, layout, transition or media. Measured answer:

- **Not products.** There is not a single spray can in this scene.
- **Not media.** No video, no image.
- **It is typography + repetition + motion, and nothing else.**

The scene is one sentence — `FOR EVERY USE ≋ OVER 600 SPRAYS ≋` — set enormous and looped forever. The *number itself* is the hero. The scale claim is made by making the words physically too big to fit on screen, so they must move. **The typography enacts the claim: there are too many to show, so we show the words instead.**

This is directly relevant to Carsystem's 742 verified COSMOS variants, and it is the cheapest possible scene to build — a single CSS/JS marquee with two glyphs. It requires no product photography at all.

The second marquee (Scene 06) reuses the identical component with different copy and a **different gradient** on the glyph (blue/teal/violet instead of rainbow) [observed, `desktop/06`]. The glyph gradient is themed to the section that follows it.

---

# SCENE 05 — PRODUCTION FACILITY

**Capture:** `desktop/05-y2997-scroll.png`

720px tall (not full-height — deliberately shorter than the hero). Full-bleed video of a filling line: a nozzle head spattered with dried multicoloured paint, cans on a conveyor, shallow depth of field, desaturated.

- Eyebrow: `FOR OVER 40 YEARS` (~13px)
- Headline: `COSMOS LAC HAS ONE OF THE SAFEST AND MOST DYNAMIC PRODUCTION FACILITIES IN EUROPE.` — 2 lines, condensed, top-left, `x=30`
- CTA: `READ MORE` + circular arrow, bottom-left

Type sits directly on video again, top-left this time (the hero used bottom-left). **No scrim.** The video's own dark upper-left region carries the type.

Dominant visual: the video. **~24 words** — the densest copy block on the page so far, and still under 25 words.

---

# SCENE 07 — SUSTAINABILITY: "GO GREEN OR GO HOME!" (§11)

**Capture:** `desktop/07-y4197-scroll.png`, `mobile390/06`

**This is where the site inverts from dark to light.** The `disable--dark` wrapper flips the background to a warm off-white and all type to black [measured].

Composition — asymmetric 2-column, 389px tall:
- **Left (~40%):** eyebrow `SUSTAINABILITY`; headline `GO GREEN OR GO HOME!` in black condensed at hero scale, wrapping to 2 lines; sub-copy `THE 1ST EVER / CARBON NEUTRAL SPRAY`; CTA `ENTER THE GREEN COSMOS` + black circular arrow.
- **Right (~35%):** a **collage artwork** — cut-paper shapes in periwinkle, orange, hot pink and cobalt; a marbled texture; a chrome-rimmed oval mirror; a yellow blob; a lilac 3D torus — with a **Chalk Effect can standing upright at the centre of it**.

### Why this does NOT read as generic corporate sustainability
Every element that would make it generic is absent, and I can name them: no stock photography of leaves, hands, or globes; no green-tinted colour wash; no icon row of pillars; no percentage counters; no certification badge grid; no paragraph of ESG prose.

Instead: **~11 words total**, a joke in the headline (`GO GREEN OR GO HOME!`), and an art-directed collage that is *unmistakably made for this brand* and cannot be sourced from a stock library. The product is physically present in the artwork rather than illustrated alongside it. The green claim is made once, factually and specifically — *"the 1st ever carbon neutral spray"* — and then the section ends.

The sustainability scene is **389px tall**. It is one of the shortest scenes on the page. That restraint is the point.

---

# SCENE 08 — SPRAY CATALOGUE (§12: the commercial boundary)

**Capture:** `desktop/07`, `desktop/08`, `mobile390/06`, `mobile390/07`

**This is the exact boundary where COSMOS stops being a brand experience and becomes product discovery.**

A **black rounded-corner card inset into the light page** (~30px margin each side), 533px tall. The inset card is the visual signal: the full-bleed brand world has ended and a contained, functional module has begun.

- **Left half:** actual spreads from the printed catalogue — the `METALLIC EFFECT` spread, then the RAL colour-chart spread showing dozens of cans in a grid with RAL codes. These **scroll vertically inside the card** while the right column stays put [observed across `desktop/07` → `desktop/08`].
- **Right half:** `SPRAY CATALOGUE` headline; copy `WE DO SPRAYS. TONS OF SPRAYS. SCROLL THROUGH OUR CATALOGUE AND DISCOVER SHADES YOU DIDN'T EVEN KNOW EXISTED!…`; CTA `DOWNLOAD HERE ↓` underlined.

Note what this is **not**: it is not a filter UI, not a product grid, not a search box. The commercial transition is handled by showing the **physical catalogue as an object**. The density of hundreds of cans is delivered as *photography of a printed page*, not as a rendered grid of cards.

Everything after this point (banners, updates, blog, footer) is conventional, competent, light-mode UI. **The brand experience occupies scenes 1–7; commercial UX occupies 8–13.** The split is roughly 55% / 45% of page height.

---

# SCENE 09–13 — BANNERS, UPDATES, BLOG, FOOTER

- **Banners** (645px): two side-by-side dark cards, equal weight. `STORE LOCATOR / FIND A STORE NEAR YOU / OVER 1,500 TRUSTED PARTNERS ACROSS GREECE / CLICK HERE →` with a stylised gradient map-pin illustration; `OUR PRODUCTS YOUR BRAND / PRIVATE LABEL / LEARN HOW YOU CAN ENTER OUR COSMOS / CLICK HERE →` over a video of stacked bare aluminium cans on pallets. *Directly relevant to our primary CTA "Pronađi najbližu prodavnicu."*
- **UPDATES** (305px): the `clipped-media` device again — the word `UPDATES` with a **gold-foil video** playing inside the letterforms, underlined. Same component as `FEATURED LINES`, different fill.
- **Blog** (587px): 2-up, image / `NEWS` tag + date / condensed headline. Conventional.
- **Footer:** the **CL logo mark filled with a looping video of shifting pigment** (`Footer-Logo_smaller.mp4`) — red at `y=6597`, red-green at `y=6714` [observed, proving it is video]. Three contact columns (HQ / FACTORY / GENERAL ENQUIRIES). Credit line: `DESIGNED BY FAZE × DEVELOPED BY PRAN`.

---

# MOTION CHOREOGRAPHY

Every motion mechanism on the page, with what I verified:

| Motion | Trigger | What moves | Direction & distance | Scroll relationship |
|---|---|---|---|---|
| Hero video parallax | scroll progress | the `<video>` only | Y, 0.72× page speed, max 250px offset | continuous, clamped at section exit [measured] |
| Hero video content | autoplay | pre-rendered cans | — | **independent of scroll**, 25.877s loop [measured] |
| Clipped-text fill | autoplay | video inside letterforms | — | independent of scroll [observed] |
| Product rail | scroll progress | `.horizontal-wrapper` | X, 0 → −1440px, **1:1 with scroll** | pinned `position:fixed; top:190px`, released with compensating translate [measured] |
| Marquee | autoplay | text band | X, infinite | continuous, not scroll-linked [observed] |
| Panel colour fill | hover (desktop) | panel background + text colour | — | n/a [observed] |
| Panel colour fill | **scroll entry (mobile)** | panel background | vertical wipe downward | once per cell on entry [observed] |
| Header collapse | scroll | header height 168 → 94px | Y/scale | one-way at threshold [measured] |
| Header colour | section theme | text colour | — | inverts on `enable--dark` / `disable--dark` boundary [measured] |
| Catalogue spread | scroll progress | catalogue pages inside card | Y, inner scroll | continuous while card in view [observed] |
| Nav video reveal | hover (menu) | circular video | scale/opacity | n/a [observed — see UNKNOWNS] |

**Layer separation is real and I verified it on the hero:** at `scrollY=600` the section is at `y=-600` but the video is at `y=-433` and the headline is at `y=257`. Three independent rates in one viewport [measured].

**Timing/easing:** I did not inspect easing curves and will not invent cubic-bezier values. Perceptually the pin engages without a snap and the release is invisible; the parallax reads as a constant linear ratio, which the measurements confirm (exactly −72px per 100px of scroll across the whole range).

---

# TRANSITION MAP (§6 — how one scene becomes another)

This is where the site's quality actually lives. Verified transitions:

1. **Hero → Featured Lines.** Backgrounds meet directly — both are pure black, so **there is no visible seam at all**. The transition is created entirely by the hero video *lagging*: 250px of it is still on screen when the next scene arrives. Nothing wipes, nothing masks, nothing pins. **The parallax lag *is* the transition.**
2. **Featured Lines → Rail.** Direct abut on black. The rail's panels announce themselves with 1px vertical hairline dividers — the first non-black pixels since the hero.
3. **Rail → Marquee.** The rail *releases* from its pin and the marquee is already there underneath. Because the rail unpins by landing exactly at its section bottom, the marquee appears to slide up into place.
4. **Marquee → Facility hero.** Direct abut, black to black. The marquee acts as a **horizontal palate cleanser between two vertical scenes** — this is its structural job, not decoration.
5. **Facility → Marquee → Sustainability.** The second marquee sits exactly on the **dark→light theme boundary**. The white-on-black band is the last dark element; immediately below it the page is off-white. **The marquee is used as the hinge for the theme inversion** — the most sophisticated transition on the page.
6. **Sustainability → Catalogue.** Light page → **inset black card**. The card's 30px margins and rounded corners deliberately break the full-bleed rule that governed scenes 1–7. This is the brand-to-commerce boundary, and it is signalled typographically *and* geometrically.
7. **Catalogue → Banners → Updates → Blog → Footer.** Conventional stacking with generous white space. The site stops performing.

**Answers to the specific questions asked:**
- Do backgrounds meet directly? **Yes — almost always, and usually black-on-black.**
- Does one scene overlap another? **Only the hero, and only via parallax lag.**
- Does a product cross a boundary? **No.** Products never straddle scenes.
- Does text persist into the next viewport? **Yes — the hero headline is still visible at `y=597` while "FEATURED LINES" is already on screen** [observed, `desktop/01`].
- Masking / wiping? **Only within scenes** (text-clipped video), never between them.
- Does the next scene push the previous away? **No.** Normal document flow throughout.
- Does section height create the transition? **Yes, decisively** — the rail's +1440px runway and the 312px thinness of the clipped-media scenes are the primary pacing instruments.
- Does video bridge sections? **No.** Each video is contained within its scene.

---

# PRODUCT FAMILY SYSTEM

| Line | Eyebrow | Hover colour | Can |
|---|---|---|---|
| RAL | PREMIUM GLOSS LINE | pink | RAL 3015 Light Pink, pink cap |
| EASY MAX | SATIN SPRAY LINE | yellow/gold | black can, orange type, gold cap |
| CHALK EFFECT | ULTRA MATT LINE | (light blue) | pale blue can |
| FAST ACRYLIC | AFFORDABLE GLOSS COLOUR LINE | cyan | white can, cyan cap |
| SPRAY.BIKE | WORLDS FIRST BIKE LINE | (not captured) | white can, technical line-art, green cap |
| FLAME™ | 100% GRAFFITI — PAINT LINE | magenta | white can, magenta cap |
| MASTER MECHANIC | CAR CARE IS AN ART | (not captured) | grey can with alloy-wheel photo |
| — | — | — | `VIEW ALL PRODUCTS` + arrow |

Media: **still packshots only** — no video, no 3D, no rotation. Consistent lighting, consistent framing, consistent ~205px height, all shot on/composited to black. Typography identical across all panels. Background identical (black) until hover. CTA identical (`VIEW LINE`). Connection to the next line: **none — they are literally adjacent panels in one continuous horizontal move.**

The eyebrow copy is doing real strategic work: each line gets a **positioning claim**, not a category label. `CAR CARE IS AN ART` and `WORLDS FIRST BIKE LINE` are brand statements. Compare our eyebrows: `COSMOS LAC · AEROSOLI · BOJA` — a taxonomy path.

---

# TYPOGRAPHY SYSTEM

Not a font list — the system:

1. **Two roles only.** A **condensed grotesque, bold, uppercase** for every display element, and a **normal-width geometric sans** for body/UI. There is no third voice, no serif, no script, no accent face.
2. **One display size, reused everywhere.** The hero `h1`, the main nav links, `GO GREEN OR GO HOME!` and the section titles are all **74.9952px** [measured]. The site does not have a type *scale* at the display level — it has **one display size**, deployed at different scales of importance by context alone.
3. **Extreme contrast, no middle.** Display type is ~75px. Eyebrows and body are ~13–15px. **There is essentially nothing in between.** The 5:1 jump is the whole hierarchy.
4. **Uppercase is the default** for display, eyebrows, CTAs, nav, and footer headings. Sentence case appears only in blog body text.
5. **Typography as graphic object.** In `FEATURED LINES` and `UPDATES` the type is not describing the media — it *is* the aperture the media is seen through.
6. **Typography over media, unprotected.** Type is placed directly on video with **no scrim, no overlay, no text-shadow**. This only works because the video is art-directed to leave a dark quadrant free. It is a production decision disguised as a design decision.
7. **Deliberate mixed-scale wordplay.** `GO GREEN OR GO HOME!` renders with `GO GREEN` largest, `OR` and `GO` stepped down — typographic rhythm applied inside a single headline [observed, `desktop/06`].
8. **Line length.** Body copy is capped at roughly **8–10 words per line** and never exceeds 4 lines. Headlines wrap at 2 lines maximum.
9. **Left-flush at x=30.** Display type sits 30px from the viewport edge — almost no gutter. Centring is reserved for the rail panels and the two clipped-media words.

---

# COLOUR SYSTEM

- **Structural palette: two colours.** `rgb(0,0,0)` black and `rgb(244,247,242)` off-white. That is the entire chrome of the site.
- **The page inverts once**, at the sustainability boundary, from dark to light [measured]. Dark carries the brand story; light carries the commerce.
- **All other colour comes from products.** Every saturated colour on the page is traceable to a can: the Chalk Effect blue in the hero, the pink/yellow/cyan/magenta hover fills, the orange Easy Max labels.
- **Two exceptions, both tightly quarantined:** the rainbow/blue gradient marquee glyph (a logo-language element), and the sustainability collage (a commissioned artwork). Neither leaks into UI.
- **The menu has its own colour state** — a deep indigo→violet gradient, used nowhere else [observed, `interact/20`].
- **No brand accent colour in UI.** There is no "COSMOS red" button. CTAs are black-on-white circles or plain underlined text.

---

# PRODUCT PRESENTATION

| Context | Product size (fraction of viewport height) | Treatment |
|---|---|---|
| Hero | **~71%** | pre-rendered video, moving, tilted, cinematic |
| Product rail | **~23%** | still packshot, static, upright, centred |
| Sustainability collage | ~14% | packshot composited into artwork |
| Catalogue card | ~2% each, ×100+ | photographed printed page |
| Our page (all contexts) | **~14%** | still packshot in a card |

The distribution is the lesson. **One 71% moment; everything else deliberately small.** Our page has a single uniform size and therefore no hierarchy of product importance at all.

---

# VIDEO / MEDIA SYSTEM (§9)

**Verified visually and in the DOM.** 23 `<video>` elements [measured]. All autoplay, muted, looping.

| Video | Size | Role |
|---|---|---|
| `hero-compressed.mp4` | 1440×900 | full-viewport hero, 25.877s |
| unnamed | 1440×720 | facility statement scene |
| `about-us`, `Products`, `sustainability`, `Location`, `contact`, `private`, `home`, `updates` — all `-vp9-chrome.webm` | 380×480 each | **one per main-nav item**, revealed on menu hover |
| 7 × unnamed | 295×150 | one per product-rail panel |
| `Footer-Logo_smaller.mp4` | 321×200 | pigment loop inside the footer logo mark |

Findings:
- **Codec-adaptive delivery.** Filenames ending `-vp9-chrome.webm` prove they serve **VP9/WebM to Chrome** and (by inference) H.264/MP4 elsewhere [measured filename convention; the fallback source was not verified].
- **Video is used as texture and as background, never as a player.** No controls, no poster CTA, no "play" affordance anywhere in content.
- **Cropping is aggressive.** The hero video is `object-fit: cover` — at 390px wide it crops to portrait and lands on a completely different composition (a single can ringed by a fan of others) rather than letterboxing the desktop framing [observed, `mobile390/00`].
- **Relationship with typography:** video is always the *ground*, type is always the *figure*, and the video is art-directed to leave the type's corner dark.
- **Relationship with packshots:** they never appear in the same scene. Video scenes have no still packshots; packshot scenes have no video.
- Playback is continuous while scrolling; I saw no scroll-pausing [observed].

*Per instruction: no proprietary video was downloaded or copied. This is compositional analysis only.*

---

# MICRO-INTERACTIONS

- **Rail panel hover** — the signature interaction. Panel adopts the product's own colour, text inverts to black, `VIEW LINE` fades in. (Detailed in Scene 03.)
- **Custom cursor** — a small circular blob follows the pointer, visible as a teal/blue dot in `hero-fine/y0450.png` and `interact/06`. It tints contextually [observed].
- **Circular arrow CTAs** — outlined circle with a ↗ glyph, used for `VIEW ALL PRODUCTS`, `READ MORE`, `ENTER THE GREEN COSMOS`, `CLICK HERE`. One CTA shape for the whole site.
- **Underline CTAs** — `VIEW LINE`, `DOWNLOAD HERE ↓`, `VIEW ALL NEWS`, `SUPPORT@COSMOSLAC.COM`. A thin rule offset below the text.
- **Burger → X** — the two-line burger becomes a thin X on open [observed].
- **Blurred decorative blobs** — elements with `filter: blur(20px)` produce soft coloured glows in the header/menu region [measured]; a yellow-green glow is visible near the X in `interact/20-menu-open.png`.
- **Search & language dropdown** use `backdrop-filter: blur(20px)` [measured].

---

# HEADER / NAV (§13)

[measured] `position: fixed`, `background-color: rgba(0,0,0,0)` — **permanently transparent, at every scroll position.** No solid bar ever appears.

| State | Height | Text colour | Logo |
|---|---|---|---|
| At top | **168px** | `rgb(244,247,242)` | CL mark **+ "COSMOS LAC" wordmark** |
| Scrolled (dark section) | **94px** | off-white | CL mark only |
| Scrolled (light section) | **94px** | `rgb(0,0,0)` | CL mark only, black |

Two independent behaviours: **height collapse on scroll**, and **colour inversion driven by section theme** (`enable--dark` / `disable--dark` wrappers). The header never gets a background — it relies entirely on the content beneath being art-directed to keep its corners clear.

Contents: logo (left); `SEARCH` with magnifier, `🇬🇧 EN ↓` language switch, burger (right).

**Menu overlay** [observed, `interact/20`]: full-screen, deep indigo→violet gradient. Left column — `HOME / ABOUT / SUSTAINABILITY / BLOG / FIND A STORE / CONTACT US` at **74.9952px**, the same size as the hero headline [measured]. Middle column — `PRODUCTS` (75px) with `COLOR LINES / SPECIAL USE / OTHER PRODUCTS` at 15px, then `PRIVATE LABEL` (75px). Bottom-left `FOLLOW US` + 5 social icons. **The entire right half is empty** — reserved for the hover video reveal.

On hovering `SUSTAINABILITY` a **circular reveal (~180px diameter)** appears in that empty right half [observed, `interact/21-navhover-2`]. Given the 8 nav-named videos at 380×480 in the DOM, this is the video preview surface. **However — in my capture the circle rendered as flat grey; I did not capture a frame with visible video content in it.** See UNKNOWNS.

---

# DESKTOP → MOBILE TRANSLATION (§16, §18)

**Mobile is not stacked desktop.** Document height barely changes: 7,614px desktop → **7,044px at 390px wide** [measured]. A naive stack would have doubled it.

| Scene | Desktop | 390px |
|---|---|---|
| Hero | video full-bleed, can ~71% vh, headline 1 line | video **re-cropped to portrait**, different composition, can ~50% vh, headline **2 lines**, body 4 lines |
| Featured Lines | word spans 58% width | spans ~95% width — **relatively larger** |
| Product rail | **pinned horizontal**, 4 visible, 1,961px tall | **2-column vertical grid** (`m-col--50`), no pin |
| Panel colour | **hover** | **scroll-entry colour wipe** — RAL fills pink as it enters, Easy Max shows a yellow top edge mid-wipe [observed, `mobile390/01`] |
| `VIEW LINE` | hover-gated | **always visible** |
| Marquee | full-bleed | full-bleed, unchanged |
| Sustainability collage | ~35% of width, right column | small centred graphic ~180px tall — **heavily de-emphasised** |
| Catalogue card | 2-column, spread left / copy right | stacked — spread on top, copy below |
| Header | 168 → 94px | compact; logo + SEARCH + EN + burger all retained |

**Breakpoints** [measured via class names `col--25 t-col--33 m-col--50` and confirmed visually]:
- **≥1024px:** rail 4-up, pinned horizontal.
- **768px:** rail **3-up, still pinned horizontal** [observed, `bp768/y1400.png`].
- **<768px:** rail collapses to a 2-up vertical grid; horizontal pinning is abandoned entirely.

The important translation principle: **the hover-colour idea was not dropped on mobile, it was re-mapped to a scroll trigger.** The *idea* survives the input-method change; only the *trigger* changes.

---

# PERFORMANCE OBSERVATIONS

- 23 autoplaying videos is heavy, but they are small (380×480 menu previews, 295×150 rail assets) and the two large ones are compressed (`hero-compressed.mp4`).
- Codec-adaptive delivery (VP9/WebM to Chrome) meaningfully reduces bytes.
- Document height grew from 5,979px to 7,614px during scroll [measured] — content is genuinely lazy-loaded, not just lazy-decoded.
- **The in-app browser pane could not scroll the page at all** (wheel events timed out, 30s). Real Chrome handled it without difficulty. This suggests the scroll implementation is sensitive to synthetic wheel events [observed] — worth noting as an accessibility/robustness risk.
- I did **not** measure Lighthouse scores, LCP, CLS, TBT, or total transfer size. See UNKNOWNS.

---

# COSMOS BRAND DNA (Layer A)

What belongs to COSMOS the company, and would exist without this website:

- The **CL monogram** — a geometric mark that works as a container for video/texture.
- **Packaging design that is already excellent**: matte cans, bold condensed type on the can itself, colour-matched caps, distinct art direction per line (Spray.Bike's technical line-art, FLAME's graffiti codes, Master Mechanic's photographic wheel).
- **Colour-matched caps** — the single most important brand asset for this website, because it is what makes the hover-colour interaction possible.
- Line naming with attitude: `EASY MAX`, `CHALK EFFECT`, `FAST ACRYLIC`, `SPRAY.BIKE`, `FLAME™`, `MASTER MECHANIC`.
- Brand voice: short, confident, occasionally funny — `WE DO SPRAYS. TONS OF SPRAYS.`, `GO GREEN OR GO HOME!`, `IN GREEK, "COSMOS" MEANS WORLD`.
- The "cosmos = world" etymology as an ownable brand idea.
- Real proof points: 40+ years, 1,500 partners, 600+ sprays, carbon-neutral claim.
- Artist collaborations (`ART & THE CITY`) supplying genuinely striking editorial imagery.

# FAZE DIGITAL ART DIRECTION DNA (Layer B)

What the design studio contributed:

- **The 71% / 23% product-scale contrast.**
- **One display type size (75px) for the entire site.**
- **Two-colour structural palette with a single mid-page inversion.**
- **Type placed on video without a scrim** — and the corresponding demand that video be art-directed to permit it.
- **Type-as-aperture** (`FEATURED LINES`, `UPDATES`, footer logo).
- **The marquee as structural hinge**, not decoration.
- **Extreme copy discipline** — 2 words in a section title, 9 in the hero, ~11 in the sustainability scene.
- **Scene thinness as a pacing tool** — 312px and 305px scenes between 900px and 1,961px ones.
- **The inset black card** as the grammar for "the brand story has ended."
- **Colour sourced exclusively from packaging.**
- Commissioned collage art instead of stock imagery.

# INTERACTION / ENGINEERING DNA (Layer C)

What PRAN built:

- **Pinned horizontal scroll via JS `position: fixed` + compensating `translateY`**, with the section height extended by *exactly* the horizontal overflow (1,440px). Mathematically clean, no jump on release.
- **Ratio-based parallax (0.72×) clamped at section boundaries.**
- **Theme-scoped wrappers** (`enable--dark` / `disable--dark`) that drive automatic header contrast inversion.
- **Permanently transparent fixed header** with height collapse.
- **Codec-adaptive video delivery** (`-vp9-chrome.webm`).
- **Responsive re-mapping of triggers** — hover on desktop becomes scroll-entry on mobile, rather than dropping the effect.
- **Component reuse** — 13 scenes from 9 block types.
- **Real lazy-loading** of below-fold media.
- `backdrop-filter: blur(20px)` for overlay chrome; `filter: blur(20px)` for decorative glows.

---

# 15–25 TRANSFERABLE DESIGN PRINCIPLES

1. **Make the product enormous exactly once.** One ~70%-of-viewport product moment beats ten 25% ones.
2. **Then make it small and repetitive.** The rail's 23% packshots exist to make the hero's 71% feel huge.
3. **Cut the page in half.** 8.5 viewports for an entire brand homepage. Length is the enemy of premium.
4. **One display type size for the whole site.** Deploy it by context, not by scale steps.
5. **Delete the middle of your type scale.** ~75px and ~14px, nothing between.
6. **Two structural colours.** Let every other colour come from the packaging.
7. **Derive interaction colour from the product itself**, not from a brand palette.
8. **Invert the theme once, at the brand→commerce boundary.**
9. **Use a horizontal band as the hinge between vertical scenes.**
10. **Let section height do the pacing.** A 312px scene between two 900px scenes is a breath.
11. **Extend a pinned section's height by exactly its horizontal travel.** The maths must be exact or the release jumps.
12. **Parallax by ratio, clamp at boundaries.** 0.72× is enough. The lag *is* the transition.
13. **Put type on video with no scrim** — and art-direct the video to earn it.
14. **Make the section title the media window** instead of pairing a heading with an image.
15. **Give every product line a claim, not a category.** `CAR CARE IS AN ART`, not `Aerosoli · Boja`.
16. **State scale typographically when you can't show it.** "OVER 600 SPRAYS" set too big to fit, looping forever.
17. **Cap copy brutally.** 2 words for a section title, ≤25 for a statement, ≤10 words per line.
18. **Build many scenes from few components.** 13 scenes, 9 block types.
19. **Signal the commercial boundary geometrically** — full-bleed becomes an inset card.
20. **Re-map interactions across breakpoints, don't delete them.** Hover → scroll-entry.
21. **Keep the header transparent forever** and invert its colour per section theme.
22. **One CTA shape for the entire site** (circle + arrow, or underline).
23. **Commission artwork instead of buying stock** for any "values" section.
24. **Show density as a physical object** (the printed catalogue) rather than as a grid of cards.
25. **No WebGL required.** Everything premium here is video + type + one pinned scroll.

---

# DO NOT COPY 1:1

- **Do not copy any COSMOS video, packshot, collage artwork, or catalogue spread.** These are proprietary assets belonging to COSMOS LAC and FAZE.
- **Do not copy the "GO GREEN OR GO HOME!", "WE DO SPRAYS. TONS OF SPRAYS." or "IN GREEK, COSMOS MEANS WORLD" copy.** Brand-owned voice.
- **Do not replicate the CL monogram treatment.**
- **Do not adopt a pure-black-only aesthetic by default.** Carsystem is a *distributor* with multiple brands (COSMOS, R-M, Carfit…). A black canvas that reads as "COSMOS's own site" will fight our multi-brand architecture and our existing light design system.
- **Do not claim COSMOS's proof points as ours.** "40 years", "1,500 partners", "1st ever carbon neutral spray" belong to COSMOS. Per `CLAUDE.md`, we must not invent distributor/legal status — our numbers are our own (742 verified variants, our partner count).
- **Do not build a 25-second 3D can render as a prerequisite.** We do not have that asset and it is the most expensive item on the page. The marquee, the type scale, the pinned rail and the hover-colour interaction deliver most of the value at a fraction of the cost.
- **Do not adopt the transparent-header-no-scrim pattern** without art-directed media, or our type will become unreadable.
- Their scroll implementation **fails under synthetic wheel events** — do not reproduce that fragility.

---

# CARSYSTEM GAP ANALYSIS

Measured, side by side.

| Dimension | cosmoslac.com | `/brendovi/cosmos-lac` |
|---|---|---|
| Page length (desktop) | 7,614px / 8.5 vp | **11,443px / 12.7 vp** |
| Page length (mobile) | 7,044px / 8.3 vp | **34,067px / 40.4 vp** |
| Largest single section | 1,961px (the pinned rail — an *experience*) | **8,897px (a product grid)** |
| Video | 23 elements | **0** |
| Hero media | full-viewport video, product at 71% vh | **inset dark card, ~530px, no product at all** |
| Hero subject | the can | **the logo, in a white box** |
| Display type | 75px condensed uppercase | 64px Archivo, mixed case |
| Colour | black + off-white, product-derived accents, one inversion | single light grey `rgb(247,247,248)` |
| Product scale | 71% / 23% / 14% — a hierarchy | **uniform ~14%** |
| Motion | parallax + pin + marquee + hover-colour | none observed |
| Transitions | parallax lag, marquee hinge, theme inversion, inset card | section stacking |
| CTAs in hero | — (hero has none) | **3 buttons side by side** |
| Product line presentation | 7 named lines with positioning claims | filter dropdowns |
| First commercial UI | at ~55% of page depth | **at ~15% of page depth** |
| Component origin | bespoke 9-block design system | **generic `BrandPage.tsx` template** |

## WHY OUR CURRENT VERSION FAILS

Being specific, as requested.

1. **It is a catalog page wearing a brand banner.** By `y=1620` — the second screen — the user is looking at a filter sidebar (`PRETRAGA / PROGRAM / LINIJA PROIZVODA / TEHNIČKA KATEGORIJA / ZAVRŠNICA / NAMENA`) and a grid of product cards. COSMOS doesn't show a filter UI *anywhere* on its homepage. We reach commercial UI at ~15% page depth; they reach it at ~55%.

2. **The hero contains no product.** Our hero's focal object is the **COSMOS LAC logo inside a white rounded box** — a brand asset, not a thing you can buy or want. Their hero is a 71%-of-viewport can. This single decision accounts for most of the felt difference.

3. **The hero is a card, not a scene.** Ours is an inset dark rectangle with ~110px of light page visible around it, ~530px tall (59% of viewport), pushed further down by a breadcrumb row. Theirs is 900px of edge-to-edge black. **We are showing a component; they are showing a world.**

4. **Three competing CTAs in the hero.** `Pogledajte Cosmos Lac proizvode` / `Kontaktirajte nas` / `Pronađi prodavnicu`, all equal weight, side by side. COSMOS's hero has **zero** CTAs. Three equal CTAs is three times zero emphasis — and it actively buries our stated primary CTA, *Pronađi najbližu prodavnicu*.

5. **No type contrast.** Our `h1` is 64px and our body is ~16px — a 4:1 ratio in a mixed-case, normal-width face. Theirs is 75px condensed uppercase against 13px, and the *condensed* width is what makes 75px feel like 120px. We have no display voice at all.

6. **Uniform product scale kills hierarchy.** Every can on our page is ~130px inside a card, ~14% of viewport. Nothing is more important than anything else, so nothing feels important.

7. **Zero motion, zero transitions.** No parallax, no pin, no marquee, no hover-colour. Our sections simply stack. There is no continuity *between* scenes because there are no scenes — only blocks.

8. **The 7 product lines are invisible.** COSMOS's rail is the spine of their homepage: RAL, Easy Max, Chalk Effect, Fast Acrylic, Spray.Bike, FLAME, Master Mechanic — each with a positioning claim. On our page these are collapsed into a `LINIJA PROIZVODA` dropdown. **We have the same product lines and we present them as a filter value.**

9. **Our 742 variants are shown as 742 cards.** COSMOS has 600+ and shows them as (a) a marquee that says the number and (b) a photograph of a printed catalogue. We render an 8,897px grid. Their approach is more impressive *and* dramatically cheaper.

10. **Mobile is catastrophic.** 34,067px — **40 viewports, ~4.8× COSMOS's mobile page.** This is the clearest evidence that our mobile is desktop-stacked rather than designed, exactly the failure mode `CLAUDE.md` warns against ("Mobile must be polished, not an afterthought").

11. **Generic UI dominates.** Breadcrumbs, pill filters, dropdowns, cards with `Pošalji upit` / `Detalji →`, a global header with 5 nav dropdowns, a search circle, a dark-mode toggle and a red `Kontakt` button — all of it is competing with the brand content, at full contrast, above the fold.

12. **No theme moment.** The page is one flat light grey throughout. COSMOS's single dark→light inversion is what makes their commercial half feel like a deliberate arrival rather than the whole site.

13. **We already know how to do better in this repo.** Carfit has a bespoke page component. COSMOS routes through the generic template. The gap is not a skills gap — it is that the work was never done for COSMOS.

---

# UNKNOWNS

Things I could not verify and am not claiming:

1. **Nav hover video content.** I captured the circular reveal shape on `SUSTAINABILITY` hover but the circle rendered flat grey — I never saw a video frame paint inside it. The 8 nav-named `380×480` videos in the DOM make this the near-certain purpose, but the visual link is **inferred, not observed**.
2. **Easing curves.** I did not inspect any timing function and have deliberately not invented cubic-bezier values.
3. **Animation library.** The `position: fixed` + compensating-translate pin is GSAP-ScrollTrigger-*style*; I did not confirm GSAP (or Lenis, or Locomotive) is loaded.
4. **Hover colours for SPRAY.BIKE and MASTER MECHANIC** were not captured.
5. **Catalogue inner-scroll mechanism** — I observed the spreads changing between two captures but did not measure whether it is scroll-linked, autoplaying, or a carousel.
6. **The 295×150 rail videos** are in the DOM but I never saw video play in a rail panel. Their role is unconfirmed.
7. **Non-Chrome video fallback** — the `-vp9-chrome.webm` naming implies an H.264 sibling; I did not verify it exists.
8. **Performance metrics** — no Lighthouse run, no LCP/CLS/TBT, no transfer-size measurement.
9. **430px viewport** was not tested (§17 was optional; 390 was prioritised as instructed).
10. **Reduced-motion behaviour** (`prefers-reduced-motion`) was not tested — important for us given `CLAUDE.md`'s accessibility requirement.
11. **Search overlay and language switcher** were not opened.
12. **Interior pages** (`/c/color-lines/easy-max/` etc.) were not audited — homepage only, as scoped.

---

# SCREENSHOT INDEX

All research captures live in `tmp/cosmos-audit/` — **not** in `public/` or any production asset directory. 102 PNGs, ~24MB.

### `desktop/` — cosmoslac.com @ 1440×900, full page, ~600px steps
`00-y0-load.png` · `01-y597-scroll.png` · `02-y1197-scroll.png` · `03-y1797-scroll.png` · `04-y2397-scroll.png` · `05-y2997-scroll.png` · `06-y3597-scroll.png` · `07-y4197-scroll.png` · `08-y4797-scroll.png` · `09-y5398-scroll.png` · `10-y5997-scroll.png` · `11-y6597-scroll.png` · `12-y6714-scroll.png`

### `hero-fine/` — hero exit + rail entry @ 1440×900, 150px steps (+ `_measure.json` geometry)
`y0000.png` · `y0150.png` · `y0300.png` · `y0450.png` · `y0600.png` · `y0750.png` · `y0900.png` · `y1050.png` · `y1200.png` · `y1350.png` · `y1500.png` · `y1650.png` · `y1800.png`

### `interact/` — hovers, header states, menu
`01-header-top-dark.png` · `02-burger-hover.png` · `03-menu-open.png` *(actually a hero video frame — the diagonal can arc)* · `05-menu-closed.png` · `06-rail-hover-panel1.png` *(Easy Max → yellow)* · `07-rail-hover-panel2.png` · `08-rail-nohover.png` · `09-header-over-light.png` · `20-menu-open.png` *(real menu overlay)* · `21-navhover-0-HOME.png` · `21-navhover-1-ABOUT.png` · `21-navhover-2-SUSTAINABILI.png` *(circular reveal)*

### `mobile390/` — cosmoslac.com @ 390×844
`00-y0-load.png` … `11-y6199-scroll.png` (12 captures)

### `bp768/` · `bp1024/` — breakpoint spot-checks
`y0000.png` · `y0700.png` · `y1400.png` · `y2400.png` · `y3400.png` · `y4400.png` (each)

### `local1440/` · `local390/` — our page, `localhost:3000/brendovi/cosmos-lac`
`00-y0.png` … `14-y10544.png` (15 captures) · `00-y0.png` … `16-y12160.png` (17 captures)

### Data files
`scrub.json` — hero `currentTime` vs `scrollY`, proving the video is not scroll-scrubbed
`hero-fine/_measure.json` — per-position geometry for hero, clipped-media, rail, marquee
`desktop/_index.json`, `mobile390/_index.json` — capture logs with document metrics

### Scripts (reproducible)
`capture.js` · `fine.js` · `scrub.js` · `pin.js` · `interact.js` · `menu.js` · `menu2.js` · `local.js`

---

# FINAL OBJECTIVE — ANSWERED

## Why is cosmoslac.com so good?

Not because of animation quality — the motion vocabulary is small (one parallax ratio, one pin, one marquee, one hover state). Not because of technology — there is **no WebGL, no canvas, no 3D engine**.

It is good because of **four decisions that are all about restraint**:

1. **Product scale contrast.** One 71%-of-viewport product moment, then everything else at 23%. Impact comes from the ratio, not the size.
2. **A page half as long as it "should" be.** 8.5 viewports total, with 312px scenes used as breathing room between 900px and 1,961px ones. Pacing is engineered through section height.
3. **A type system with the middle removed.** One display size (75px condensed uppercase) and one small size. No mid-scale, so every display element reads as a headline.
4. **Colour that only ever comes from the product.** Two structural colours, one theme inversion at the brand→commerce boundary, and every saturated accent traceable to a can's cap.

And underneath all four: **copy discipline.** Two words in a section title. Nine in the hero. Eleven in the sustainability scene. There is nowhere for the design to hide behind text, so the design has to be right.

## What exact principles is our Carsystem version missing?

In priority order — **not to be solved in this phase**:

1. A hero that shows **a product**, at full-viewport scale, instead of a logo in a card.
2. **Product scale hierarchy** — currently one uniform 14% everywhere.
3. **A display type voice** — condensed, uppercase, ~75px, with the mid-scale deleted.
4. **Page-length discipline** — we are 1.5× longer on desktop and **4.8× longer on mobile**.
5. **The 7 product lines as the spine of the page**, with positioning claims, instead of a filter dropdown value.
6. **Any transition mechanism at all** — parallax lag, a marquee hinge, a theme inversion.
7. **A colour system sourced from packaging**, with hover/scroll-entry colour reveal.
8. **A clear brand→commerce boundary** — ours arrives at 15% page depth instead of ~55%.
9. **A designed mobile experience** rather than a stacked desktop one.
10. **A bespoke COSMOS page component**, as Carfit already has, instead of the generic `BrandPage.tsx` template.
11. **Radical copy reduction** across every section.
12. **Motion of any kind** — we currently have none.

The encouraging conclusion: **items 1–12 are all achievable within our approved stack and cost constraints.** The single most expensive thing COSMOS has — the 25-second pre-rendered can video — is also the single most replaceable, because principles 2–12 carry most of the perceived quality on their own.
