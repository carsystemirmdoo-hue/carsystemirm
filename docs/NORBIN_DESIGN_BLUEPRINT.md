# NORBIN — Landing page blueprint (Phase 1)

**Phase 1 deliverable. Not an implementation.** No JSX, no CSS, no components, no routing.
**Date:** 2026-08-09.
**Read with:** `NORBIN_BRAND_RESEARCH.md`, `NORBIN_PRODUCT_INVENTORY.md`, `NORBIN_ASSET_GAP.md`.

**Recommended direction:** **"Ukrštanje" — The Crossing.**
**Signature interaction:** *Odnos* — the ratio pair.
**Sections:** 10 (hero + 9 content sections).

> **PHASE 1.5 CORRECTION (2026-08-09).** The commercial range changed materially: our ERP carries
> **8 of the 13 EMEA codes**, not 1. Only §7 (product experience) and risk R10 are affected and both
> are corrected in place below. **The recommended direction, the hero, the ratio spine, the token set,
> motion, responsive and accessibility specifications are unchanged** — the ratio spine in fact gets
> stronger, because four of the five mixing ratios are now buyable from us on both sides. See
> `NORBIN_PRODUCT_INVENTORY.md` §14.

Tags: `[F]` fact · `[R]` repository fact · `[I]` inference · `[D]` design interpretation.
Everything in this document is `[D]` unless marked otherwise.

---

## 1. The existing system we must fit into

`[R]` Verified in the working tree and in the browser, 2026-08-09.

### 1.1 Page shell — who owns what

| Element | Owner | Consequence for NORBIN |
| --- | --- | --- |
| `<Header />` | **Global** — `PublicSiteChrome` in `app/layout.tsx` renders it for every route outside `/portal`, `/site-u-pripremi`, `/interaction-demo`, `/social-exports` | **NORBIN must not render a `<Header>`.** This is the historical duplicate-header bug |
| `<Footer />` | **The brand page component** — every one of `BrandPage`, `BefarBrandPage`, `CarfitBrandPage`, `CosmosBrandPage`, `BaslacBrandPage`, `RmBrandPage`, `CarsystemBrandPage` imports and renders it | **NORBIN must render `<Footer />` itself**, or the page will have none |
| `<main>` | The brand page | One `<main>`, wrapping all sections |
| In-page section nav | Shared `BrandSectionNav` | Opt-in. Used by Befar, Carfit, baslac, Carsystem |
| Breadcrumb | Inside the page's own hero | Befar's comment is explicit: a separate dark bar under the global header *"reads as a second header — we have had that before"* |

**Verified on the current NORBIN page:** exactly `1` `<header>`, `1` `<footer>`, `1` `<main>`. The
current generic page is correct on chrome. **Any bespoke page must preserve exactly that count.**

### 1.2 The sticky-offset contract

`BrandSectionNav` measures the live global header and writes two custom properties onto the nearest
ancestor matching `[data-brand-page]`:

```
--brand-section-header-offset   /* real header height, 0 when the header is scroll-hidden */
--brand-section-nav-height      /* the section nav's own height */
```

Requirements on our shell:

1. The root element **must** carry `data-brand-page`.
2. Every anchored section **must** use the shared pattern:
   `scroll-margin-top: calc(var(--brand-section-header-offset, 5.5rem) + var(--brand-section-nav-height, 3.5rem) + 1rem)`.
3. The nav items array **must be a module-level constant**, not built inline. Both Befar and Carfit
   carry the comment *"Stabilna referenca — `BrandSectionNav` je drži u zavisnostima efekta"*. An
   inline array re-runs the effect every render.
4. The nav is themed through four variables the page sets: `--brand-nav-surface`, `--brand-nav-border`,
   `--brand-nav-ink`, `--brand-nav-accent`.

### 1.3 Shared conventions observed

| Convention | Established value |
| --- | --- |
| Container max width | `84rem` (Befar), nav rail `min(100%, 94rem)` |
| Gutter | `clamp(1rem, 4vw, 3.5rem)` |
| Section rhythm | `clamp(4rem, 8vw, 8.5rem)` |
| Display font | `var(--font-display)` — Archivo 500–900 |
| Body font | `var(--font-body)` — IBM Plex Sans 300–700 |
| Technical font | `var(--font-technical)` — IBM Plex Mono 400–600 |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Overflow guard | `overflow-x: clip` on the page shell |
| Reduced motion | `usePrefersReducedMotion` hook + `@media (prefers-reduced-motion: reduce)` |
| Images | `next/image`; brand pages are server components with client leaves |

### 1.4 What every existing brand page looks like

| Page | Background | Character | Accent |
| --- | --- | --- | --- |
| Carsystem | near-black | Technical schematic, wireframe car | Carsystem red |
| R-M | near-black | Cinematic, model photography, carousel | R-M red |
| baslac | near-black | Editorial process, huge grotesque | **lime green** |
| Cosmos Lac | near-black | Rotating aerosol showcase, chromatic | Warm orange |
| Car Fit | near-black | Workshop grid, task selector | Car Fit red |
| Befar | off-white `#f4f3f0` **alternating** with charcoal `#16191e` | Industrial slab, flat plates, macro foam | Befar red |
| **NORBIN (today)** | near-black | Generic `BrandPage` fallback | `#0082BB` |

**`[I]` Six of seven are dark, five are red-accented, and every hero is dark.** Befar is the only page
with any light surface, and it uses light as *alternation with heavy charcoal plates*.

---

## 2. The core idea

> **NORBIN is not a product you choose. It is a ratio you mix.**

`[F]` Thirteen products. `[F]` Five ratios. `[F]` Every clear and every filler in the range is defined
by what it is mixed with and in what proportion — and the brand's own graphic mark is two colours
crossing to make a third.

Three facts converge, and they are the whole page:

1. **The range is small and closed** — 13 products, unchanged since May 2024.
2. **The products only work in combination** — 21 manufacturer-declared relationships.
3. **NORBIN supplies no colour in our market** — the shop's colour system stays whatever it is.

**What a painter should understand in 60 seconds:**
*"NORBIN is the cheap-to-run supporting range around whatever colour system I already use. It's short,
it's from the Glasurit/R-M family, and each product has one job and one partner."*

**What the page is not:** not a colour system, not a premium claim, not a thirteen-card grid, not
another dark automotive hero.

---

## 3. What NORBIN must not borrow

| From | Must not borrow | Because |
| --- | --- | --- |
| **R-M** | Dark cinematic hero, model photography, carousel | R-M owns the emotional register; NORBIN's identity is flat and white |
| **baslac** | Lime-green accent, "od pripreme do završnog sjaja" process spine | Same corporate parent — two sibling brands sharing a green accent and a process narrative would be genuinely confusing |
| **Carsystem** | "Ceo proces. Jedan sistem." | NORBIN is explicitly *not* a complete system in EMEA. Copying this would be a false claim |
| **Cosmos Lac** | Rotating product showcase, chromatic drama | Cosmos is about colour choice; NORBIN has no colour |
| **Car Fit** | Task selector, workshop grid | Car Fit is a broad consumable catalogue; NORBIN is 13 items |
| **Befar** | Alternating off-white/charcoal slabs, section numbers in red blocks, macro-material photography | Closest neighbour and therefore the greatest risk. **NORBIN's white is continuous and airy; Befar's is a slab that alternates with charcoal.** NORBIN uses no charcoal sections and no numbered red blocks |
| **norbin-paint.com** | The site itself | Broken on mobile, lime template chrome, no product pages |

### 3.1 Brand-page character

**precizno · kratko · belo · odnosno · bez preterivanja**
*(precise · short · white · relational · understated)*

**Emotional target:** recognition and relief. *"Finally, someone wrote down what goes with what."* Not
excitement — NORBIN does not earn excitement and claiming it would be read as marketing.

**Commercial target:** an enquiry naming a specific code and pack size, or a route to the nearest
partner store. The primary site CTA — *Pronađi najbližu prodavnicu* — must be present.

---

## 4. Three design directions

### Concept A — "Tehnički list" (The Datasheet)

| | |
| --- | --- |
| **Metaphor** | The TDS itself, beautifully typeset |
| **Hierarchy** | Tables first. Prose is a caption |
| **Hero** | No image. A full-width typographic masthead: code, name, mixing ratio, set like a specification header |
| **Background** | Pure white throughout. Hairline rules `#DDE3E5` |
| **Brand graphics** | Almost none — a single blue rule under each section head |
| **Products** | Dense specification tables; one row per product |
| **Process** | A numbered list |
| **Technical content** | Is the entire page |
| **Imagery** | None except A1 (logo) and A2 (our packshot) |
| **Motion** | Anchor scroll only |
| **Light/dark** | Light only |
| **Mobile** | Tables become stacked definition lists |
| **Why NORBIN** | Honest to a brand with no marketing assets; the code-first typography is genuinely NORBIN |
| **Risks** | Cold. No emotional entry. Reads as a PDF. Wastes M1 and M2. Would be the least-shared page on the site |

### Concept B — "Ukrštanje" (The Crossing) — **recommended**

| | |
| --- | --- |
| **Metaphor** | The brand's own wave, enlarged: two components crossing to produce a third |
| **Hierarchy** | Ribbon geometry establishes the structure; the ratio is the recurring unit of content |
| **Hero** | White field. Two flat ribbons — blue rising from the left, gold rising from the bottom-left — crossing right of centre. The workshop photograph (M2) is **clipped into the wedge the ribbons leave**. Headline in the white area at the left |
| **Background** | Continuous white `#FFFFFF`, no alternation. Ribbons are the only large colour |
| **Brand graphics** | Ribbons do structural work: hero mask, section separators, the "crossing" that visualises each mixing ratio |
| **Products** | Two layers — the 13-product system as a compact relational map; our stocked programme as real product cards |
| **Process** | Horizontal 5-step spine, with step 4 (colour) drawn as a visible gap |
| **Technical content** | Per-product panels, `value` strings as printed, mono type |
| **Imagery** | M1 cut-out packshot, M2 clipped, A2 for our product, local shots 2 and 4 |
| **Motion** | Ribbons draw once on entry via `clip-path`; the ratio pair converges on scroll |
| **Light/dark** | Light-dominant; one deep-ink section for the closing CTA |
| **Mobile** | Ribbons rotate to a vertical crossing; photo moves above the headline at 4:5 |
| **Why NORBIN** | It *is* NORBIN's own graphic system, used for its actual meaning rather than as decoration. Nothing here is invented |
| **Risks** | Ribbon masks are the hardest part to make responsive; risk of decoration if the ribbons are not tied to real relationships; white pages expose weak typography |

### Concept C — "Trinaest" (The Thirteen)

| | |
| --- | --- |
| **Metaphor** | The shortness of the range as the headline claim |
| **Hierarchy** | One enormous number, then thirteen objects |
| **Hero** | A single vast `13` in Archivo Black, the cut-out group packshot (M1) sitting on its baseline |
| **Background** | Light warm grey `#F2F2F0` |
| **Brand graphics** | A thin blue/gold/green rule only |
| **Products** | All thirteen laid out as a physical shelf; scroll moves along the shelf |
| **Process** | A secondary filter over the shelf |
| **Technical content** | Revealed per object in a side panel |
| **Imagery** | M1 carries almost the whole page |
| **Motion** | Horizontal shelf scroll; objects lift on focus |
| **Light/dark** | Light |
| **Mobile** | Shelf becomes a vertical list; the `13` shrinks to a kicker |
| **Why NORBIN** | "Lean range" is the brand's own claim; the packshot is our strongest asset |
| **Risks** | **Presents 13 products we mostly do not sell as if they were our shelf** — the exact confusion the inventory warns against. Horizontal scroll is poor on desktop trackpads and worse for accessibility. One asset carrying a whole page is fragile |

### 4.1 Scoring

Scored 1–10; higher is better.

| Criterion | A — Datasheet | **B — Ukrštanje** | C — Trinaest |
| --- | ---: | ---: | ---: |
| Brand authenticity | 8 | **10** | 6 |
| Distinctiveness on our site | 6 | **9** | 7 |
| Usability | 7 | **8** | 4 |
| Technical clarity | **10** | 9 | 5 |
| Asset feasibility | **10** | 8 | 6 |
| Performance | **10** | 8 | 5 |
| Consistency with Carsystem i R-M | 6 | **9** | 7 |
| Longevity | 7 | **9** | 5 |
| **Total** | **64** | **70** | **45** |

### 4.2 Recommendation

**Concept B, "Ukrštanje", with Concept A's discipline applied to every technical block.**

1. **It is the only direction derived from NORBIN's own artwork.** The crossing ribbons are on the
   brand's homepage banner and, in straight-edged form, on every can. We are not inventing a language.
2. **The metaphor carries real information.** Two things crossing to make a third *is* what the
   products do. In A the ribbons would be absent; in C they would be trim. In B the same shape that
   masks the hero also draws the `2:1` between a clear and its hardener.
3. **White is simultaneously the most authentic and the most distinctive choice.** NORBIN's own field
   is white; six of our seven brand pages are dark and every hero is dark.
4. **It respects the two-layer problem.** *(Phase 1.5: the "one-product problem" was an artefact of
   reading only `carsystem-data.ts`; our ERP carries 8 of the 13 — Inventory §11. The two-layer
   argument is unchanged and now easier to satisfy.)* The two-layer structure lets the page teach a 13-product
   system while being honest that we stock a subset. C actively breaks this.
5. **It fails gracefully.** If local photography never happens, M1 and M2 carry the page. If the
   ribbon masks prove troublesome on a device, they degrade to flat diagonal blocks with no loss of
   meaning.

**Concept A is not discarded** — it is absorbed. Every technical panel in B is set with A's rules:
mono, tabular, printed values, no rounding, no invented labels.

---

## 5. Design tokens

Provenance for every colour is in `NORBIN_BRAND_RESEARCH.md` §7.3. **Values marked *official* come from
the official logo file; values marked *sampled* are read off official imagery and must never be
described as a corporate specification.**

```
/* Brand — official values, from public/brands/norbin.svg */
--nb-blue:        #0082BB;   /* official */
--nb-gold:        #EBB700;   /* official */
--nb-green:       #739600;   /* official */
--nb-logo-grey:   #4D5357;   /* official */

/* Working values — sampled from official imagery */
--nb-ink:         #204552;   /* packaging wordmark; body + heading ink */
--nb-hardener:    #C23557;   /* red band, hardeners only */
--nb-blue-bright: #25AAE3;   /* official banner; large ribbons only */

/* Accessible derivatives — computed, see §12 */
--nb-blue-text:   #006594;   /* 6.38:1 on white */
--nb-green-text:  #5C7700;   /* 5.13:1 on white */

/* Surfaces */
--nb-white:       #FFFFFF;   /* the page */
--nb-paper:       #F6F8F9;   /* recessed panels only */
--nb-line:        #DDE3E5;
--nb-line-strong: #B9C4C8;
--nb-muted:       #5B6670;   /* 5.9:1 on white */
--nb-deep:        #10222B;   /* the single dark section */

/* BrandSectionNav theme */
--brand-nav-surface: rgb(255 255 255 / 0.94);
--brand-nav-border:  #DDE3E5;
--brand-nav-ink:     #204552;
--brand-nav-accent:  #0082BB;

/* Geometry */
--nb-max:       84rem;
--nb-gutter:    clamp(1rem, 4vw, 3.5rem);
--nb-section-y: clamp(4rem, 8vw, 8.5rem);
--nb-ease:      cubic-bezier(0.22, 1, 0.36, 1);
--nb-ribbon-angle: 28deg;     /* measured off the official banner */
```

### 5.1 Colour rules — non-negotiable

1. **Gold and green are fills, never text.** `#EBB700` is 1.86:1 on white and `#739600` is 3.45:1.
2. **`#0082BB` at body size needs `#006594`.** The brand blue is 4.28:1 — fine for large text, UI
   borders and icons; **fails AA for normal text**.
3. **Red is reserved for hardeners.** It is the manufacturer's own code (`[F]`). Using it for a CTA
   would destroy the only real signal on the page — and it is also the Carsystem global accent, so a
   red CTA would read as site chrome.
4. **No lime green.** baslac owns it on our site, and it is website chrome on NORBIN's, not identity.
5. **Never sample from the brochure PNG.** Documented artefact.
6. **Colour is never the only carrier of meaning.** The hardener red always travels with the word
   *„učvršćivač"* or the `N75` code.

---

## 6. Hero specification

### 6.1 Intended impression

Open, bright, plainly organised. The reader should feel they have arrived at a **reference sheet**, not
a campaign. The first visual event is the crossing; the first read is a code.

### 6.2 Content hierarchy

1. Breadcrumb — *Početna / Brendovi / Norbin* — inside the hero surface, **never a separate bar**
2. Brand identity line — logo (A1) + `NORBIN` + `Surventis refinish porodica`
3. Kicker — `POMOĆNI PROGRAM ZA LAKIRNICU`
4. H1
5. Lead paragraph — 2 sentences
6. Fact strip — `13 proizvoda` · `5 odnosa mešanja` · `bez sistema boje`
7. CTAs
8. Ribbon crossing + clipped photograph

### 6.3 Headline strategy

The H1 must contain the brand name (SEO), must not claim colour, and must not use a superlative.

Recommended: **„Norbin: kratak program koji radi u odnosima."**
Alternatives: „Norbin — trinaest proizvoda, pet odnosa mešanja." / „Norbin. Sve što ide oko vašeg
sistema boje."

**Rejected:** anything with „vrhunski", „kompletan sistem", „obećanje boje".

### 6.4 Lead copy

Two sentences, factual, no adjectives of quality. Must convey: (a) auxiliaries, not colour;
(b) part of the Surventis/ex-BASF family; (c) the range is short by design.

### 6.5 CTA hierarchy

| Rank | Label | Style | Target |
| --- | --- | --- | --- |
| Primary | **Pronađi najbližu prodavnicu** | Solid `#006594`, white text | `/prodavnice` — the site's primary CTA per `CLAUDE.md` |
| Secondary | Pogledajte Norbin proizvode | Outline, `--nb-ink` | `/proizvodi?brand=norbin` |
| Tertiary | Pošaljite upit | Text link | `/kontakt` |

### 6.6 Desktop composition (≥ 64rem)

```
┌──────────────────────────────────────── global Header (not ours) ─┐
├───────────────────────────────────────────────────────────────────┤
│  breadcrumb                                                       │
│                                            ╱╱╱ blue ribbon ╲╲     │
│  [logo] NORBIN                       ╱╱╱                          │
│  POMOĆNI PROGRAM…              ╱╱╱      ┌────────────────────┐    │
│  ┌──────────────────────┐  ╱╱╱          │  M2 / local shot 4 │    │
│  │  H1, 2 lines         │╳ ← crossing   │  clipped into the  │    │
│  └──────────────────────┘  ╲╲╲ gold     │  ribbon wedge      │    │
│  lead …                        ╲╲╲      └────────────────────┘    │
│  13 · 5 · bez boje                                                │
│  [ Pronađi prodavnicu ] [ Proizvodi ]  Upit                       │
└───────────────────────────────────────────────────────────────────┘
   ← ~52 % text column →      ← ~48 % ribbon + image →
```

The crossing point sits near the optical centre, roughly on the boundary between the two columns —
mirroring the official banner, where the crossing anchors the composition.

### 6.7 Mobile composition (< 48rem)

Order changes; it is not a collapsed desktop.

1. Breadcrumb (scrollable, one line)
2. Logo + brand line
3. **Image first** — a 4:5 crop with the ribbon crossing *above* it, rotated to a vertical crossing
4. Kicker
5. H1
6. Lead
7. Fact strip — a single horizontally scrollable row
8. CTAs — primary full-width, secondary full-width, tertiary as a text link

The ribbon crossing on mobile is a **vertical** intersection at the top of the image, not a
scaled-down diagonal — a 28° diagonal across a 375 px viewport is a sliver.

### 6.8 Logo handling — and the second-header trap

**The logo is a 28–36 px-tall identity mark on one line with the brand name. It is never a plate, never
centred, never above a horizontal rule spanning the viewport, and never inside a bar with its own
background colour.**

`[R]` The failure mode is documented in `BefarBrandPage.tsx`: a dark bar directly under the global
header *reads as a second header*. Our hero identity line must sit **inside the hero's white field**,
sharing its background, with no full-width rule between it and the content below.

`[F]` A1 has the *"A brand of BASF"* strapline baked in. Below ~120 px width it is illegible. If we
need it smaller than that, use the wordmark alone (asset gap P1-2) or set the ownership line as live
text — which is preferable anyway, since it can then say *"Surventis (ranije BASF Coatings)"* and stay
true as the rebrand progresses.

### 6.9 Motion, reduced motion, fallbacks

| | |
| --- | --- |
| Motion | The two ribbons draw in on load — `clip-path` inset animating from the outer edge toward the crossing, 620 ms, staggered 90 ms, `--nb-ease`. The photo fades from 0 → 1 opacity behind its static mask |
| Reduced motion | Both ribbons render at final state. No fade. No transform |
| No image available | The wedge fills with `--nb-paper` and a hairline. Layout is unchanged — the crossing is CSS, not part of the image |
| Image slow | `next/image` with an explicit aspect ratio; the wedge reserves its box. **Zero CLS by construction** |
| JS disabled | Everything renders. The ribbons are CSS-only |

---

## 7. Information architecture — 10 sections (hero + 9)

Section nav items (module-level constant, per §1.2):

| Nav label | `sectionId` | Section |
| --- | --- | --- |
| Program | `program` | 2 |
| Oznake | `kod` | 3 |
| Odnos | `odnos` | 4 |
| Proces | `proces` | 5 |
| Sivi tonovi | `sivi-tonovi` | 6 |
| Naš program | `nas-program` | 7 |
| Tehnički podaci | `tehnicki-podaci` | 8 |
| Dokumentacija | `dokumentacija` | 9 |
| Poreklo | `poreklo` | 10 |

**Nine nav items, nine anchored sections.** The hero is deliberately not in the nav — `BrandSectionNav`
is rendered immediately *after* the hero (the Befar and Car Fit pattern), so a hero entry would be a
link to the top of the page that is never the active item. Every `sectionId` above is unique; the hero
carries no `id`.

---

### Section 1 — Hero · *(no anchor)*

Fully specified in §6. `BrandSectionNav` is rendered directly beneath it.

---

### Section 2 — „Šta Norbin jeste, a šta nije" · `#program`

| | |
| --- | --- |
| **Purpose** | Kill the most damaging misconception before anything else: that NORBIN is a paint/colour programme. Our own current copy says exactly that |
| **Content** | Two facing statements. **Jeste:** clears, primer fillers, plastic primer, body filler, hardeners, thinner, silicone cleaner. **Nije:** no basecoat, no topcoat, no tinters, no mixing bank. Plus one line on where it sits in the Surventis portfolio |
| **Layout (desktop)** | Two columns separated by a single blue vertical rule, not two boxes. Left column ink on white; right column `--nb-muted` on white, each item struck through with a hairline |
| **Layout (mobile)** | Stacked; the rule becomes horizontal |
| **Asset** | None |
| **Interaction** | None |
| **Motion** | None |
| **Data** | Static copy, sourced from the 2024 brochure and the Surventis brand line |
| **CTA** | None — this section informs |
| **Notes** | The negative column is as important as the positive one and must not be visually demoted into a footnote |

---

### Section 3 — „Kako se Norbin čita" · `#kod`

| | |
| --- | --- |
| **Purpose** | Teach the code grammar. Once a reader knows `N15` = clear and `N75` = hardener, the rest of the page decodes itself |
| **Content** | The six prefixes with their families, and what `V` means. `[F]` Plus the observation that NORBIN sets the code larger than the name on its own labels |
| **Layout (desktop)** | A single wide row of six code chips in IBM Plex Mono at a large size, family names beneath in small caps. Below, one full-bleed band: local shot 3 (label macro) with a caption |
| **Layout (mobile)** | Chips wrap to a 2-column grid; the macro band keeps 3:2 |
| **Asset** | Local shot 3 (P1). **Fallback:** crop of A2 at the label. No new asset is strictly required |
| **Interaction** | Each chip is a same-page link to the relevant family in section 6 |
| **Motion** | None |
| **Data** | `code`, family prefix. Derivable from `norbin-catalog.generated.json` `[R]` |
| **CTA** | None |
| **Notes** | The `V` = VOC statement must be phrased as observed pattern, not as a manufacturer definition — the manufacturer never spells it out `[I]` |

---

### Section 4 — „Odnos" · `#odnos` — **the signature section**

| | |
| --- | --- |
| **Purpose** | The page's central idea. Show all five mixing ratios as manufacturer-declared pairs |
| **Content** | Five ratio rows: `N15-020 → 2:1 → N75-021 / N75-022`; `N15-V20 → 4:1 → N75-V21`; `N15-V25 → 3:1 → N75-V21 + N85-021`; `N55-V20 → 5:1:1 → N75-020 + N85-021`; `N55-V29 → 5:1 → N75-020`. Each with the printed pot life and spray viscosity `[F]` |
| **Layout (desktop)** | Each row is a horizontal crossing: base product entering from the left on a **blue** ribbon, hardener entering from the bottom-left on a **red** ribbon, meeting at a node where the ratio is set large in mono. Any thinner enters on a **gold** ribbon. Rows share a common crossing x-position so the column reads as a spine |
| **Layout (mobile)** | The crossing rotates: base above, hardener below, ratio in the middle at 2.5rem. Ribbons become short vertical connectors. **No horizontal scroll** |
| **Asset** | None required. Local shot 2 may head the section |
| **Interaction** | Hovering/focusing a row raises the ratio and reveals pot life + viscosity. **Keyboard-reachable; the data is present in the DOM regardless of hover** |
| **Motion** | On entering the viewport, each ribbon extends toward the node (`transform: scaleX`), staggered 80 ms. Fires once via `IntersectionObserver`, then the observer disconnects |
| **Data** | `relationships[].partnerCode`, `.ratio` + `potLife`, `sprayViscosity` claim `.value` strings. **Never `.range`** — Inventory §8.4 |
| **CTA** | Per row: *Tehnički list* where one exists |
| **Notes** | `N15-020` is the only row with two hardeners; the fork must be visible. *(Phase 1.5)* **Four of the five ratios are now buyable from us on both sides** — `N15-020`+`N75-021`, `N15-V20`+`N75-V21`, `N15-V25`+`N75-V21`+`N85-021`, and `N55-V20`'s hardener `N75-020`. Mark the `N55-V20`/`N55-V29` rows as manufacturer-range context, since we carry the hardener but not the fillers. `N85-025` in the `N55-V29` row is **a real article in our ERP that the manufacturer does not publish** — footnote, never a link, and never presented as available (Inventory §14.5) |

---

### Section 5 — „Proces" · `#proces`

| | |
| --- | --- |
| **Purpose** | Place the range in the repair sequence — and show the deliberate gap where colour goes |
| **Content** | Five steps: Čišćenje → Punjenje → Prajmer → **[boja — ne Norbin]** → Bezbojni lak. Products under each step |
| **Layout (desktop)** | A horizontal spine. Steps 1–3 and 5 are white cards on a hairline rail. **Step 4 is an empty outlined slot** carrying only *„vaš sistem boje"* |
| **Layout (mobile)** | Vertical spine, same gap treatment |
| **Asset** | Local shot 6 (P2), full-bleed and low, immediately beneath — the primed panel with no product in it |
| **Interaction** | Each step links to the family in section 6 |
| **Motion** | None. This section must feel like a printed diagram |
| **Data** | `Application:` and `Suitable surfaces:` claims `[F]` |
| **CTA** | None |
| **Notes** | **The empty step is the argument, not a design flourish.** It must not be filled, greyed into invisibility, or removed as "an odd gap" during implementation |

---

### Section 6 — „Sivi tonovi" · `#sivi-tonovi`

| | |
| --- | --- |
| **Purpose** | Publish genuine technical knowledge that exists on a manufacturer poster and on no website anywhere |
| **Content** | `N55-V20` Dark Grey and `N55-V29` Grey Black are two ends of a scale; 50/50 by volume gives the intermediate undercoat `[F]` |
| **Layout (desktop)** | A horizontal grey bar from the `N55-V20` grey to the `N55-V29` grey, with three labelled stops: 100 % / 50–50 / 100 % |
| **Layout (mobile)** | Same bar, full width, labels beneath |
| **Interaction** | **Optional, low cost:** a 3-position control moving the marker between the three *documented* stops. **Not a continuous slider** — the source documents three points, not a gradient. Radio-group semantics, arrow-key operable |
| **Motion** | Marker transition 240 ms. Respects reduced motion |
| **Asset** | Local shot 5 (P1) if the products are stocked. **Otherwise omit the photo, keep the section** |
| **Data** | Poster `NORBIN_A3-Sheet_Tech-Info_Grey-Shades_230221b_druck.pdf` `[F]` |
| **CTA** | *Preuzmite tehnički poster* |
| **Notes** | The exact grey values are **not** published as HEX. `[D]` Sample from the poster and label the swatches *„ilustrativni prikaz"*. Do not present them as colour specifications |

---

### Section 7 — „Naš Norbin program" · `#nas-program`

| | |
| --- | --- |
| **Purpose** | The commercial layer. The honest, separate answer to "what can I actually buy here?" |
| **Content** | Our stocked NORBIN products as real cards. **Phase 1.5 corrected this:** our ERP carries **8 of the 13 EMEA codes across 10 articles** — every clearcoat (`N15-020`, `N15-V20`, `N15-V25`), every hardener that serves them (`N75-020`, `N75-021`, `N75-V21`), the thinner (`N85-021`) and the body filler (`N60-V20`). See Inventory §14.2. Only `N15-020` (1 L, 5 L) has a published product record today |
| **Layout (desktop)** | A product card wide enough to hold the packshot, the code, both pack sizes as variant chips, the *„2:1 sa N75-021 / N75-022"* line, and both document links. Beside it, a short panel: *the full EMEA range has 13 products; availability is confirmed on enquiry* |
| **Layout (mobile)** | Card first, panel beneath |
| **Asset** | A2 (cut out, P1-1) and local shot 1 |
| **Interaction** | Card links to the PDP. Variant chips are labels, not a size selector — we do not sell online |
| **Motion** | None |
| **Data** | `getCarsystemProductsByBrandSlug("norbin")` `[R]` |
| **CTA** | Primary: **Pronađi najbližu prodavnicu**. Secondary: *Pošaljite upit* |
| **Notes** | *(Phase 1.5)* The section is now a **real card set of ~8 products, not one card** — the earlier "one deliberate card" instruction is withdrawn. Show `N15-020` with its 1 L / 5 L variants; the remaining seven need product records created before they can link anywhere, so until then present them as named articles without PDP links. **Never show the five codes absent from our ERP** (`N55-015`, `N55-V20`, `N55-V29`, `N75-022`, `N95-060`), nor `N55-V15` (legacy) or `N85-025` (unresolved). `norbin-2k-bezbojni-lak` is excluded permanently — it is an `INVALID_PRODUCT_RECORD`, not a pending decision |

---

### Section 8 — „Tehnički podaci" · `#tehnicki-podaci`

| | |
| --- | --- |
| **Purpose** | The reference layer. Concept A's discipline applied |
| **Content** | Per-product technical panels for the 8 EMEA products that have a TDS |
| **Layout (desktop)** | Left: product list (accordion or tab list). Right: the specification table, in `--font-technical`, values exactly as printed |
| **Layout (mobile)** | Accordion; one product open at a time; table becomes a definition list |
| **Asset** | None |
| **Interaction** | Accordion. Native `<details>`/`<summary>` or an explicit ARIA tab pattern. **Server-rendered content — all values are in the HTML before JS** |
| **Motion** | Height transition only, or none |
| **Data** | `records[].claims[].value` `[R]` — **`.value` only** |
| **CTA** | Per product: TDS + SDS |
| **Notes** | For the 5 products with no TDS, render an explicit statement: *„Proizvođač ne objavljuje poseban tehnički list; podaci se nalaze u listu proizvoda sa kojim se meša."* with a link to that product. **A silent empty panel would look like our bug rather than the manufacturer's choice.** Both film-thickness figures on the primer fillers are printed as printed (Inventory §6.2) |

---

### Section 9 — „Dokumentacija" · `#dokumentacija`

| | |
| --- | --- |
| **Purpose** | One predictable place for documents, grouped by product, never a link dump |
| **Content** | Per product: TDS, SDS by pack size. Separately: brochure + technical poster as brand-level documents |
| **Layout (desktop)** | Grouped by product with the code as the group heading. Two brand-level documents set apart above |
| **Layout (mobile)** | Same grouping, single column |
| **Asset** | None |
| **Interaction** | Direct links |
| **Motion** | None |
| **Data** | `norbin-documents.generated.json` `[R]` |
| **CTA** | None |
| **Notes** | **EMEA English documents only.** Turkish/Russian/Kazakh documents exist locally but describe other ranges and must not appear (Inventory §4.3). **The `N75-022` "2,5L" link points at a 0.5 L file at source** (Inventory §8.3) — either label it by the file's real content or link the correct one; do not propagate the error silently. `N55-V20`'s TDS URL contains `?asdb213ffe` and must be URL-handled correctly (Inventory §8.1) |

---

### Section 10 — „Poreklo i kontekst" + closing CTA · `#poreklo`

| | |
| --- | --- |
| **Purpose** | Establish credibility honestly, then convert |
| **Content** | Launched 2015; developed within what is now Surventis (formerly BASF Coatings); packaging still reads *A brand of BASF*; a value-tier brand alongside Glasurit, R-M and baslac. Closing CTA |
| **Layout (desktop)** | This is the **one deep-ink section** (`--nb-deep`). Text left, M2 photograph right, clipped by a single ribbon edge — closing the shape the hero opened |
| **Layout (mobile)** | Photo above, text below, CTAs full-width |
| **Asset** | M2 or local shot 4 |
| **Interaction** | None |
| **Motion** | None |
| **Data** | Brand research §2–3 |
| **CTA** | **Pronađi najbližu prodavnicu** (primary) · *Pošaljite upit* |
| **Notes** | The ownership sentence must be **live text**, not baked into an image, because it will need editing as the Surventis transition completes. Followed by `<Footer />` |

---

## 8. Product experience

**Two layers, always visually separated:**

| Layer | What it is | Where | Rule |
| --- | --- | --- | --- |
| **System education** | The 13-product EMEA range and how it fits together | §4 Odnos, §5 Proces, §6 Sivi tonovi, §8 Tehnički podaci | Presented as *the manufacturer's range*. Never links to a PDP that does not exist. Never implies availability |
| **Our programme** | What we actually sell | §7 | Real cards, real PDPs, real enquiry |

**Decisions:**

- **Family cards: no.** Six families over 13 products means families of 1–4 items. Not worth a card layer.
- **Individual product cards: only in §7.** For the other 12, a card promises a page we do not have.
- **Process-linked products: yes.** §5.
- **Horizontal rail: no.** Poor on desktop trackpads and for keyboard users, and 13 items do not need one.
- **Comparison: partly.** The three clears differ meaningfully (ratio, pot life, VOC, drying, shelf life) and comparing them is a real user need. Handle it inside §8, not as a separate tool.
- **Contextual "use with": yes — the most valuable link type on the page.** §4 and §7.
- **Documentation links: yes**, at product level in §8 and grouped in §9.

---

## 9. Documentation experience

| Question | Decision |
| --- | --- |
| Landing, PDP, or both? | **Both, different jobs.** Landing groups by product for browsing; the PDP shows only that product's documents |
| Grouped by product or by type? | **By product**, with type as the second level — a painter looks for "the sheet for N15-020", not "all SDS" |
| All 99 local files? | **No.** 10 EMEA English documents on the landing page |
| Where do the files live? | Currently `assets/manufacturer/norbin/documents/` — outside `public/`. Phase 2 must decide between a curated copy into `public/` and a served route. **Out of scope here; nothing has been moved** |
| Licensing | Confirm with the supplier before publishing (Asset gap §2.2) |

---

## 10. Motion system

Every animation must have a reason. Two do.

| What moves | Why | Trigger | Duration / easing | Scroll relation | Performance | Reduced motion |
| --- | --- | --- | --- | --- | --- | --- |
| Hero ribbons draw | Introduces the crossing as an event; the reader learns the shape before it is used to carry meaning | Page load, once | 620 ms, `--nb-ease`, 90 ms stagger | None | `clip-path` inset — compositor-friendly; two elements | Final state, no animation |
| Ratio ribbons extend | Enacts the mixing the row describes | `IntersectionObserver`, once per row, then disconnect | 480 ms, 80 ms stagger | Enter only. **No scroll-linked transform** | `transform: scaleX` only; ≤ 5 rows × 3 elements | Final state |
| Grey-shade marker | Feedback for a user action | User input | 240 ms | None | `transform: translateX` | Instant snap |

**Prohibited:** parallax, scroll-linked ribbon geometry, canvas, WebGL, any perpetual animation, any
scroll handler that reads layout, any animation of `width`/`height`/`top`/`left`.

**Rationale for the ceiling:** the page's whole argument is precision and plainness. A NORBIN page that
performs is off-brand as well as slow.

---

## 11. Responsive strategy

| Breakpoint | Behaviour |
| --- | --- |
| **320 px** | Single column. Hero fact strip becomes a 3-row list rather than a scroll row. Section nav rail scrolls. Ratio rows fully vertical. **No element may exceed 100 %** — the ribbons are the risk |
| **360 / 375 px** | Baseline mobile. Hero image 4:5. H1 at `clamp` floor, max 2 lines. CTAs full-width, 48 px min height |
| **390 / 430 px** | As above with more line length; hero image may go 1:1 |
| **Tablet ≥ 48rem** | Two columns return in §2 and §7. Ratio rows go horizontal but the ribbons stay short. Process spine still vertical |
| **Laptop ≥ 64rem** | Full design. Hero crossing diagonal. Process spine horizontal. §8 splits into list + table |
| **Large ≥ 96rem** | Container capped at `84rem`. **Ribbons extend to the viewport edge, content does not.** Type does not keep growing — `clamp` ceilings on every display size |

**Per-element:**

| Element | Mobile transformation |
| --- | --- |
| Hero crop | 3:2 → 4:5, **cropped from the left** (the subject sits right-of-centre in M2) |
| Text width | `max-width: 34ch` desktop → full width minus gutter |
| Section order | Unchanged. Only the hero reorders internally (image before headline) |
| Sticky nav | `BrandSectionNav` rail scrolls horizontally and auto-centres the active item — existing shared behaviour, inherited |
| Ratio rows | Horizontal crossing → vertical stack |
| Process spine | Horizontal → vertical, the empty step preserved |
| Documentation | Two columns → one, grouping preserved |
| Decorative ribbons | Section-separator ribbons **hide below 48rem**. Semantic ribbons (hero, ratio) stay |
| Typography | Display `clamp(2rem, 7vw, 4.5rem)`; mono never below 0.75rem |

---

## 12. Accessibility

| Requirement | Specification |
| --- | --- |
| Heading order | One `<h1>` (hero). Each section `<h2>`. No level skipped. Each `<section>` has `aria-labelledby` |
| Contrast — body | `--nb-ink` `#204552` on white = **10.32:1** ✅ |
| Contrast — muted | `#5B6670` on white = **5.9:1** ✅ |
| Contrast — links | `--nb-blue-text` `#006594` = **6.38:1** ✅. **`#0082BB` = 4.28:1 — large text and UI only** |
| Contrast — on gold | `--nb-ink` on `#EBB700` = **5.56:1** ✅ |
| Contrast — on blue | White on `#0082BB` = 4.28:1 — **use `#006594` for the solid CTA** |
| Contrast — hardener red | `#C23557` on white = **5.33:1** ✅ |
| Colour independence | Hardener red always accompanied by the `N75` code or the word „učvršćivač" |
| Alt text | Ribbons and separators are `aria-hidden` decorative. Photographs get descriptive alt. **Packshot alt must not repeat codes already visible as page text** |
| Keyboard | Every ratio row, chip and accordion reachable and operable. Visible focus ring: 2 px `#006594` + 2 px offset. **Never `outline: none`** |
| Focus order | Follows DOM order; the hero's visual reorder on mobile is done with source order, not `order`, so focus stays correct |
| Reduced motion | Both the CSS media query and the `usePrefersReducedMotion` hook |
| Touch targets | ≥ 44×44 px; CTAs 48 px |
| Text over images | **Never.** The photograph is inside its wedge; text is on white. This is the failure on NORBIN's own mobile site |
| Screen readers | The grey-shade control is a radio group with a `<fieldset>`/`<legend>`; the ratio spine is a list, so „N15-020, odnos 2:1, sa N75-021" reads as one item |
| Language | `lang="sr-Latn"` inherited. Product codes and „VOC" need no `lang` switch; if English document titles are shown verbatim, mark them `lang="en"` |

---

## 13. Performance constraints

| Constraint | Target |
| --- | --- |
| Additional JS | **≤ 4 KB gzipped** beyond the shared `BrandSectionNav`. Three interactions: nav (shared), ratio reveal, grey-shade control |
| Server components | Everything except the ratio reveal and the grey-shade control |
| Images | `next/image`, AVIF + WebP, explicit `sizes`; **hero `priority`, everything else lazy** |
| Hero weight | ≤ 180 KB at 1× after conversion. M2 is 2489×1265 CMYK — **must be converted and resized, never shipped raw** |
| Ribbons | CSS `clip-path` / gradients. **Zero image weight.** No SVG filters |
| Video | **None.** Nothing on this page changes over time; a still is not merely sufficient, it is more accurate |
| Fonts | **No new font.** Archivo + IBM Plex are already loaded |
| CLS | Every image and the hero wedge carry a fixed aspect ratio. Target 0 |
| Observers | One `IntersectionObserver` for the ratio rows, disconnected after firing. **No scroll listener that reads layout** |
| Table data | Server-rendered — §8 must be fully readable and indexable with JS disabled |
| `overflow-x: clip` | On the page shell. Ribbons extend beyond the container by design |

---

## 14. SEO / AEO / GEO

`[I]` Our page would become the most substantial NORBIN resource in Serbian — the manufacturer
publishes none, and no regional site exists.

### 14.1 Headings

```
H1  Norbin: kratak program koji radi u odnosima
H2  Šta Norbin jeste, a šta nije
H2  Kako se Norbin čita — oznake N15, N55, N60, N75, N85, N95
H2  Odnosi mešanja u Norbin programu
H2  Norbin u procesu popravke
H2  Sivi tonovi — N55-V20 i N55-V29
H2  Naš Norbin program
H2  Tehnički podaci po proizvodu
H2  Dokumentacija — tehnički i bezbednosni listovi
H2  Poreklo brenda
```

### 14.2 Intent coverage

| Intent | Query shape | Section |
| --- | --- | --- |
| Brand | „norbin boje", „norbin lak srbija" | H1, §2 |
| Product code | „N15-020", „norbin n15 020 bezbojni lak" | §4, §7, §8 |
| Compatibility | „koji učvršćivač za norbin bezbojni lak" | §4 — **the highest-value intent on the page** |
| Ratio | „norbin 2:1 odnos mešanja" | §4 |
| Technical | „norbin vreme sušenja", „pot life" | §8 |
| Document | „norbin tehnički list pdf" | §9 |
| Comparison | „norbin ili baslac" | §2, §10 |
| Purchase | „norbin prodavnica", „gde kupiti norbin" | Hero CTA, §7 |

### 14.3 Entity relationships to express in prose

NORBIN → brand of → Surventis (formerly BASF Coatings) · sibling of → Glasurit, R-M, baslac ·
`N15-020` → mixes with → `N75-021`, `N75-022` · `N15-020` → is a → 2K clearcoat ·
Carsystem i R-M → distributes → NORBIN in Serbia.

### 14.4 Product-code visibility

Codes must be **live text in headings and body copy**, never only inside images. M1 and M4 have codes
printed on the labels — that is a bonus, not a substitute.

### 14.5 Structured data

Follow the existing pattern in `app/brendovi/[slug]/page.tsx` (`brandJsonLd`, `breadcrumbJsonLd`).
Additionally justified:

- `Product` for the `N15-020` entries in §7 — **without `offers`**, since we publish no prices.
- `HowTo` is **not** justified. We are documenting mixing ratios, not instructing a repair, and
  claiming `HowTo` for a specification table is the kind of markup Google discounts.
- `FAQPage` only if the questions are genuine (§14.6).

### 14.6 FAQ — only where genuinely useful

Three questions have real search demand and real documented answers:

1. *Koji učvršćivač ide uz Norbin N15-020?* — `N75-021` or `N75-022`, 2:1 `[F]`
2. *Ima li Norbin bazne boje?* — no, not in EMEA `[F]`
3. *Koja je razlika između N15-020 i N15-V20?* — VOC compliance, different hardener, different ratio `[F]`

**No invented questions.** Padding the FAQ is exactly the keyword-spam failure to avoid.

### 14.7 Internal linking

Out: `/prodavnice` (primary CTA), `/kontakt`, `/proizvodi/norbin-n15-020-1l` and `-5l`,
`/brendovi/baslac` and `/brendovi/rm` from the portfolio sentence, `/program/boje-i-lakovi`.
In: brand index, footer, `ManufacturerRail` on sibling pages, homepage `BrandLogoPlate`.

### 14.8 Metadata

`generateMetadata` in `app/brendovi/[slug]/page.tsx` needs a NORBIN branch using `buildPageMetadata`,
following the Befar and Car Fit precedent — **because the generic `buildBrandMetadata(brand)` derives
its description from `brand.description`, which currently says NORBIN is a colour programme.** Fixing
the data (P0-3) fixes the metadata; the branch gives us better control of length and phrasing.

---

## 15. Technical risk register

| # | Risk | P | I | Mitigation |
| --- | --- | :---: | :---: | --- |
| R1 | **Inverted numeric ranges** — 77/92 `range` objects have negated minima | **High** | **High** | **Render `claim.value` only.** Treat `.range` as unusable until the extractor is fixed. Add a lint/test asserting `range.min <= range.max` before any consumer reads it |
| R2 | **`N55-V20` EN TDS missing from the knowledge base** — the `?` query string broke registration | **Certain** | **High** | Re-run `npm run norbin:pipeline` with query-string handling **before** building §8, or the product renders with a Turkish-only record |
| R3 | Duplicate header | Medium | High | No `<Header>` in the component. Hero identity line inside the hero's white field. Assert `document.querySelectorAll('header').length === 1` in review |
| R4 | Missing footer | Medium | High | `<Footer />` is the page's own responsibility — the global chrome does not provide one |
| R5 | Sticky nav collides with the global header | Medium | Medium | Use `BrandSectionNav` unchanged; `data-brand-page` on the root; shared `scroll-margin-top` formula on every anchor |
| R6 | **Horizontal overflow from the ribbons** | **High** | Medium | `overflow-x: clip` on the shell; ribbons in an `inset-0` container with `clip-path`, never negative margins. Test at exactly 320 px |
| R7 | Ribbon masks break at extreme aspect ratios | Medium | Medium | Angle from a variable; ribbon geometry independent of the image. Fallback to flat diagonal blocks |
| R8 | Hero crop cuts the subject on mobile | Medium | Medium | M2's subject is right-of-centre — crop from the left. Named 4:5 and 1:1 crops in the asset spec |
| R9 | **Publishing the whole 13-product range as if we sell it** | **High** | **High** | Two-layer architecture (§8) with visual separation. §7 is the only section with PDP links |
| R10 | `norbin-2k-bezbojni-lak` shown beside `N15-020` | **Low** | Medium | *(Phase 1.5 — corrected)* It is **not** published and never has been: `productRecords` never pulls it out of the `legacyProducts` pool, and it appears in no route, sitemap or metadata artefact. Classified `INVALID_PRODUCT_RECORD` (Inventory §12). Simply never reference the slug |
| R11 | Legacy `N55-V15` reappears via a stock import | Low | Medium | Documented as `LEGACY_OFFICIAL` (Inventory §4.2) |
| R12 | `N85-025` rendered as a linkable product | Medium | Medium | Phantom code — footnote only, and a guard in whatever resolves partner codes |
| R13 | `N75-022` document mislabelled at source (2.5 L label → 0.5 L file) | Certain | Low | Label by real content; do not derive pack size from SDS filenames |
| R14 | **Brand colours sampled from the brochure PNG** | **High** | **High** | Tokens carry provenance comments. Brand research §7.3 is the citation. Only `public/brands/norbin.svg` values are official |
| R15 | Ownership copy goes stale | Medium | Medium | Ownership is live text in §10 and in `carsystem-data.ts`, never baked into an image |
| R16 | Asset licensing unconfirmed | Medium | Medium | One-line supplier confirmation before publishing M1/M2/M6/M7. A1 and A2 are unaffected |
| R17 | Hydration mismatch from the ratio reveal | Medium | Medium | Server-render the final state; the observer only adds a class. No `Math.random`, no `Date` |
| R18 | Global style leakage | Low | High | CSS Modules only. No global selectors. Follow `BefarBrandPage.module.css` |
| R19 | Reduced motion not honoured on the ratio reveal | Medium | Medium | Check the hook *before* creating the observer; render the final state and skip observation entirely |
| R20 | Motion jank on mid-range Android | Low | Medium | `transform`/`opacity`/`clip-path` only; observers disconnect after firing |
| R21 | White page exposes weak typography | Medium | Medium | There is no dark background to hide behind. Type scale and spacing need a dedicated review pass |
| R22 | §8 renders an empty panel for the 5 products with no TDS | High | Medium | Explicit "no separate TDS is published" state with a link to the mixing partner |
| R23 | Metadata inherits the wrong brand description | **Certain** | Medium | Fix `carsystem-data.ts` (P0-3) **and** add the metadata branch |
| R24 | Turkish/Russian documents leak into §9 | Medium | Medium | Filter on `region === "en"` |

---

## 16. Definition of done for Phase 2

- [ ] ~~P0-1~~ **closed by Phase 1.5** (Inventory §12.6); P0-2 answered from the ERP report and awaiting sales sign-off (Inventory §14.2); P0-3 still open (Asset gap §4)
- [ ] `norbin:pipeline` re-run with the `?` query-string fix; `N55-V20` EN TDS registered (R2)
- [ ] No consumer reads `claim.range` (R1)
- [ ] Exactly one `<header>`, one `<footer>`, one `<main>`, one `<h1>`
- [ ] No horizontal overflow at 320, 360, 390, 430, 768, 1024, 1440, 1920
- [ ] Reduced motion verified for all three interactions
- [ ] Every contrast pair in §12 measured in the built page
- [ ] Keyboard-only pass through all ten sections
- [ ] §8 fully readable with JS disabled
- [ ] Every displayed technical value traceable to a TDS excerpt
- [ ] No claim on the page exceeds what the manufacturer claims
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm run seo:validate`, `npm run knowledge:validate` all pass
