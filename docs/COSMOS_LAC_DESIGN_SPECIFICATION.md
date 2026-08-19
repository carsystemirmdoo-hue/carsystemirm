# COSMOS LAC × CARSYSTEM — Design Specification

**Phase:** 2 — specification only. **No implementation files were modified.**
**Primary source:** `docs/COSMOS_LAC_FORENSIC_DESIGN_AUDIT.md` (measured, 2026-08-07).
**Secondary source:** live inspection of our own catalogue data, assets and component architecture, performed for this document (all numbers below are measured from the repo, not estimated).
**Target route:** `/brendovi/cosmos-lac`

> Every quantity in this document is either **[audit]** (measured on cosmoslac.com), **[repo]** (measured in this repository today), or **[spec]** (a decision I am proposing). Nothing is carried over from memory or moodboarding.

---

# 1. DESIGN THESIS

> **COSMOS LAC is 742 real cans of colour. The page should feel like colour arriving — once, enormously — and then organising itself into seven families you can actually buy in Serbia.**

The forensic audit disproved the assumption that drove our previous attempts. COSMOS does not feel premium because everything is big, animated, or 3D. It feels premium because of **four acts of restraint**: one enormous product moment (71% of viewport) against small disciplined ones (23%); a page half as long as it "should" be (8.5 viewports); a type system with the middle deleted (75px / 13px, nothing between); and colour that only ever comes from the packaging.

Our page must therefore be **shorter, not richer**. The single biggest quality win available to us is deletion: from 12.7 desktop viewports to ~8, and from **40.4 mobile viewports to ~8** [repo].

Our page is also **not COSMOS's homepage**, and must not pretend to be. COSMOS sells a brand. We sell *availability of that brand in Serbia*. So our page inherits COSMOS's **pacing and hierarchy**, but its narrative resolves somewhere COSMOS's never does: **"gde ovo da kupim"** — the primary business CTA from `CLAUDE.md`, *Pronađi najbližu prodavnicu*.

---

# 2. AUDIT PRINCIPLES BEING TRANSFERRED

Transferred as hard constraints:

| # | Audit finding | Constraint on this spec |
|---|---|---|
| 1 | Homepage is 8.5 vp desktop / 8.3 vp mobile [audit] | Hard budget: 8–9 vp desktop, 8–9 vp mobile (§14) |
| 2 | Product scale contrast 71% / 23% / 14% [audit] | One dominant hero product; rail products deliberately small (§6, §7) |
| 3 | 7 families = one pinned rail, not 7 scenes [audit] | Exactly one family system (§7) |
| 4 | No WebGL, no canvas; video + type + one pin [audit] | No 3D, no new dependency (§17) |
| 5 | Rail runway = **exactly** the horizontal overflow (1440px = 8×360−1440) [audit] | Our runway must be computed, not hand-tuned (§7) |
| 6 | Pin at `(vh − panelH)/2` — exactly centred [audit] | Same rule, our numbers (§7) |
| 7 | Hover fills panel with the can's **own** colour [audit] | Colour from verified per-variant data, never invented (§8) |
| 8 | Mobile re-maps hover → scroll-entry wipe [audit] | Same re-map, not a deletion (§8, §5) |
| 9 | Commercial UI delayed to ~55% page depth [audit] | Our catalogue starts no earlier than ~60% (§11) |
| 10 | Marquee bands hinge between scenes; one carries the dark→light inversion [audit] | Adopted as a *transition device only* (§13) |
| 11 | Hero exits by parallax lag (0.72×), not by ending [audit] | Our hero must lag, not stop (§6) |
| 12 | Copy: 2 words per section title, 9 in hero, ≤25 in a statement [audit] | Enforced per scene (§4) |
| 13 | Type: one display size, mid-scale removed [audit] | Two-step type system (§4) |
| 14 | 13 scenes from 9 block types [audit] | Our 8 scenes from 6 block types (§17) |
| 15 | Scale claim made typographically, not with a grid [audit] | The 742 moment is type, not KPI cards (§9) |

Explicitly **not** transferred: pure-black-only palette (we are multi-brand), COSMOS's proof points (40 years, 1,500 partners — theirs, not ours), the 25-second pre-rendered can film (we do not have it — see §15), and the transparent-header-no-scrim pattern (we lack art-directed media to earn it).

---

# 3. PAGE MAP

```
01  HERO — COLOUR ARRIVES                    dark    1.00 vp
        ↓  parallax lag, no seam
02  FAMILY RAIL — 7 COSMOS LINES             dark    2.18 vp  (0.58 natural + 1.60 runway)
        ↓  rail unpins into band
03  BAND — family wordmarks                  dark    0.22 vp
        ↓
04  RANGE — "742 NIJANSE"                    dark    0.55 vp
        ↓  BAND carries dark → light inversion
05  ŠTA FARBATE? — application finder        light   1.00 vp
        ↓  full-bleed becomes inset card = COMMERCIAL BOUNDARY
06  COSMOS U CARSYSTEM-U — curated products  light   1.30 vp
        ↓
07  CREDIBILITY — one fact, one line         light   0.45 vp
        ↓
08  CTA — PRONAĐI PRODAVNICU                 dark    0.70 vp
        ↓
    global footer                            —       0.60 vp
                                             TOTAL ≈ 8.0 vp desktop
```

Brand experience = scenes 01–04 (≈4.0 vp, 50%). Commerce = scenes 05–08. **The boundary is scene 05→06.**

---

# 4. TYPOGRAPHY & COLOUR SYSTEM (governs all scenes)

## Type — two steps, no middle
| Role | Size (desktop) | Size (mobile) | Treatment |
|---|---|---|---|
| **Display** | `clamp(56px, 5.2vw, 76px)` | `clamp(38px, 11vw, 46px)` | condensed, 800 weight, uppercase, `line-height: 0.92`, `letter-spacing: -0.01em` |
| **Eyebrow** | 13px | 12px | uppercase, `letter-spacing: 0.14em`, 60% opacity |
| **Body** | 15–16px | 15px | max 10 words/line, max 4 lines |

There is deliberately **nothing between 16px and 56px** [spec, mirroring audit finding 13]. Existing Carsystem `h2`/`h3` mid-scale steps are not used inside this page.

**Font:** the repo's display face is Archivo [repo]. Use **Archivo Expanded/Condensed's condensed optical width** if the variable axis is available; otherwise apply `font-stretch: condensed` or `transform: scaleX(0.88)` on display type only. *Do not add a webfont dependency* — see §15 asset gap A3.

## Colour — structural pair + product-derived accents
| Token | Value | Use |
|---|---|---|
| `--cl-void` | `#08090A` | scenes 01–04, 08 background |
| `--cl-paper` | `#F7F7F8` | scenes 05–07 (matches existing site background [repo]) |
| `--cl-ink` | `#0B0B0C` | type on paper |
| `--cl-chalk` | `#F4F7F2` | type on void |
| `--cl-family-*` | **from data** | accent per family (§8) |

**Exactly one dark→light inversion**, at scene 04→05 [spec, mirroring audit finding 10]. No third background colour. No decorative gradient. The only saturated colour on the page comes from cans.

---

# 5. HERO SPECIFICATION (Scene 01)

### PURPOSE
Establish COSMOS as a colour company in one screen, and make the product — not the logo — the identity of the page.

### VIEWPORT HEIGHT
`100svh` desktop and mobile. **1.00 vp.**

### BACKGROUND
`--cl-void`. Full-bleed, edge to edge. **No card, no rounded corners, no breadcrumb above it.** The hero is the first thing under the global header.

### STRUCTURE (5 layers, back to front)
1. **Atmosphere layer** — a single soft radial vignette in the hero's lead-family colour at 8–12% opacity, positioned behind the product. Pure CSS. Its only job is to stop the black from reading as "empty div".
2. **Product layer** — the dominant object (below).
3. **Typography layer** — bottom-left, `x = 30px` gutter [spec, matching audit], sitting *directly on the background* with no scrim.
4. **Header relationship** — the global Carsystem header stays. It already hides on scroll via `data-scroll-hidden` [repo]. The hero reserves the **top 140px as a dead zone**: no product silhouette, no type. This is how we earn a legible header without a scrim.
5. **CTA layer** — one primary CTA, one text link.

### PRODUCT LAYER — and the asset constraint that shapes it

**Measured constraint [repo]:** all 742 packshots are `800×800` WebP with alpha, and the actual can occupies a bounding box of **201×628px** (400 ml) or 212×749px (Master Mechanic 500 ml).

That means:

| Displayed can height | Upscale at DPR 1 | Upscale at DPR 2 | Verdict |
|---|---|---|---|
| 628px (70% of 900vh) | 1.00× | **2.00×** | ✗ visibly soft on retina |
| 540px (60%) | 0.86× | 1.72× | ✗ soft |
| **440px (49%)** | 0.70× | **1.40×** | ⚠ acceptable on dark |
| 314px (35%) | 0.50× | 1.00× | ✓ pixel-perfect |

**Conclusion (§21 answered): our local packshots do NOT support a 60–70% viewport-height hero on a retina display.** The strongest available source tops out at 628 real pixels of can.

**Therefore the hero does not use one giant upscaled can.** It uses a **receding arc of real cans** — the composition I directly observed in the COSMOS hero video itself (`interact/03-menu-open.png`, a diagonal arc of cans fading into black):

- **Lead can:** 440px tall (≈49% of viewport), 1.40× upscale — acceptable because it sits on near-black with a soft vignette, where upscaling artefacts are least visible.
- **4–6 supporting cans** receding diagonally up-right at 340 / 265 / 200 / 150px, each progressively more blurred (`filter: blur(0.5px → 3px)`) and darkened (`brightness(0.75 → 0.35)`). **Every supporting can is displayed at or below its native resolution**, so the depth is genuinely sharp.
- Total product mass ≈ **58% of viewport height, ~46% of width** — more visual authority than a single 49% can, achieved with zero upscaling penalty on 5 of 6 objects.

This satisfies the brief's requirement that "the hero product has substantially more visual authority than products later on the page": **58% hero mass vs 24% rail cans (§7) — a 2.4× ratio**, close to the audit's 71/23 = 3.1×.

### MEDIA (§3 answered)
**We have no COSMOS video. [repo]** `public/` contains only Carsystem-generated social exports (`spray-reveal`, `product-showcase`, `refinish-systems` `.mp4`) — these are our own assets but are square/story social crops, not hero footage. Using them would be a mismatch.

**We will not hotlink or copy COSMOS's proprietary video.**

**Fallback that preserves the design logic** (the brief explicitly forbids letting missing video collapse the hero into a static banner):

- The arc is composed of **real `<img>` elements**, each independently transformed.
- On load, they perform a **staggered arrival**: each can translates 40px up and fades 0→1, 90ms apart, back-to-front, 700ms, `cubic-bezier(0.16, 1, 0.3, 1)`. Total 1.1s. This reads as choreography, not as a page load.
- On scroll, the cans move at **three different parallax rates** (lead 0.82×, mid 0.74×, far 0.66×) — reproducing the audit's key finding that the hero has independently-moving layers, without any video at all.
- The atmosphere vignette drifts at 0.5×.

This is the audit's *mechanism* (layered parallax, choreographed entry) delivered with the *assets we own*. See §15 A1 for the optional upgrade.

### COPY (§3: one dominant statement, one supporting, ≤2 CTAs)
```
eyebrow    COSMOS LAC · AEROSOLNI PROGRAM
display    BOJA KOJA STIŽE ODMAH.
support    742 verifikovane nijanse iz sedam COSMOS linija —
           dostupne kroz Carsystem partnersku mrežu.
primary    Pronađi najbližu prodavnicu  →
secondary  Pogledaj sve COSMOS proizvode
```
Display headline: **4 words.** Support: 17 words. **One primary CTA** (the business objective), one plain text link. The current three-equal-button row is deleted.

> **Copy note:** "742 verifikovane nijanse" is defensible — `verificationStatus` is `verified-official-source` for all 742 records [repo]. "Dostupne kroz Carsystem partnersku mrežu" uses `CLAUDE.md`-approved safe wording. No distributor-status claim is made.

### MOTION
| Property | Trigger | Behaviour |
|---|---|---|
| can `translateY` + `opacity` | page load | staggered 90ms, 700ms, back-to-front |
| can `translateY` | scroll progress | 3 parallax rates, 0.82 / 0.74 / 0.66 |
| vignette | scroll progress | 0.50× |
| type | scroll | **1.0× — the headline does not parallax** |

Type moving at 1.0× against media at 0.7× is precisely the audit's measured hero relationship (section −600 / video −433 / headline 257 at `scrollY=600`) [audit].

### EXIT (§4 answered)
The hero **does not end — it lags.**

- Hero section height: `100svh`. Content flow is normal; nothing pins.
- At the moment the hero's bottom edge reaches the viewport top (`scrollY = 100vh`), the product layer has only travelled `0.74 × 100vh`, leaving **≈26% of viewport height (≈235px) of hero product still visible at the top of the screen** while Scene 02 is already entering below.
- **Background transition: none.** Scene 01 and Scene 02 are both `--cl-void`. There is no seam, no divider, no colour change. This is the audit's single most important transition finding: *black meets black, and the parallax lag is the entire transition* [audit].
- **Persisting across the boundary:** the product layer only. Typography exits at 1.0× and is gone.
- Parallax clamps at `scrollY ≥ 100vh` and reverts to 1.0×, matching the audit's measured clamp.

### MOBILE TRANSLATION
- `100svh`. Arc reduces to **3 cans** (lead 300px ≈ 36% vh + 2 supporting), because a 6-can arc at 390px wide becomes noise.
- Lead can 300px at DPR3 = 0.95× upscale from 628px source → **sharper on mobile than desktop.**
- Display type wraps to 2 lines; support copy capped at 3 lines.
- Parallax rates unchanged; entry stagger shortened to 60ms.
- Primary CTA becomes full-width; secondary link sits beneath.

### DATA SOURCE
`data/cosmos-lac-products.generated.json` — hand-pick 6 `slug`s across ≥4 families for maximum colour spread. Lead can should be a **vivid** variant (e.g. a Fast Acrylic with `backgroundColor: #EC6725` or `#FCEB3D` [repo]) so the vignette has a real colour to sample.

### PERFORMANCE
`priority` on lead can only; `loading="lazy"` on supporting cans; explicit `width`/`height` to reserve layout; `sizes` capped so Next/Image never requests above 800px. Target hero payload **< 220KB**.

---

# 6. WHAT IS DELETED FROM THE CURRENT HERO
`components/brand/BrandHero.tsx` output for this route is replaced entirely. Removed: the inset dark **card** with rounded corners; the **white box containing the COSMOS logo** (currently the hero's focal object); the **breadcrumb row above the hero**; the `3 programa` / `Dostupnost na upit` chip pair; **all three equal-weight CTAs**; the right-hand "Aktivan brend u Carsystem i R-M programu" panel.

---

# 7. PRODUCT-FAMILY RAIL SPECIFICATION (Scene 02)

## Catalogue verification (§5 — required before finalising)

Measured against `data/cosmos-lac-products.generated.json` [repo]:

| Family | `line` value(s) | Variants | Base product groups |
|---|---|---|---|
| RAL | `RAL` | 60 | 1 |
| Easy Max | `Easy Max` | 52 | 1 |
| Chalk Effect | `Chalk Effect` | 34 | 1 |
| Fast Acrylic | `Fast Acrylic` | 29 | 1 |
| Spray.Bike | `Spray.Bike` | 88 | 1 |
| **FLAME** | `Flame Orange` + `Flame Blue` + `Flame Booster` | **256** | 3 |
| Master Mechanic | `Master Mechanic` | 26 | 13 |
| **Total** | | **545** | **21** |

**Verification outcome — two findings that change the design:**

1. **The 7 COSMOS families cover only 545 of 742 variants (73%).** 197 variants sit outside them: Molotow Premium 66, Wood Putties 18, Automotive 16, Lubricants 14, Fluorescent & Marking 13, Primers 9, W Wood Care 8, Cleaners 7, Molotow Burner 7, Home 6, Putties 6, High Heat 5, Metallic 5, Varnishes 5, Sealer 4, Wheel Rim 4, Effect 2, Zinc 2 [repo].
   → **The rail must not claim to be the whole catalogue.** Panel 8 (`SVE COSMOS LINIJE`) is therefore not decorative — it is *required for accuracy*, and its eyebrow should read `+18 DODATNIH LINIJA`.

2. **`Molotow Premium` (66) + `Molotow Burner` (7) = 73 variants of a different brand (Molotow) are inside our Cosmos Lac dataset.** This is a data-modelling question, not a design one, but it must not be silently rendered as "COSMOS". Flagged in §16.

3. **FLAME is three `line` values, not one.** The adapter must merge them. Presenting them as three separate panels would break the audit's "one coherent family system" principle and would over-weight FLAME 3:1.

**Final rail contents: 7 family panels + 1 terminal panel = 8 panels.** Order (by narrative, not variant count): `RAL → EASY MAX → CHALK EFFECT → FAST ACRYLIC → SPRAY.BIKE → FLAME → MASTER MECHANIC → SVE COSMOS LINIJE`.

## RAIL GEOMETRY (§6 answered)

The audit's insight is not the number 360 — it is that **the scroll runway equals the horizontal overflow exactly**, which is why the pin never jumps [audit]. We adopt the *rule*, computed fluidly, which is an improvement on COSMOS's fixed 360px:

```
panelWidth   = 100vw / visibleCount
trackWidth   = 8 × panelWidth
travel       = trackWidth − 100vw = (8 − visibleCount) × panelWidth
runway       = travel                       ← the invariant
sectionH     = panelHeight + runway
pinTop       = (100vh − panelHeight) / 2    ← exact vertical centre
```

| Breakpoint | visible | panelWidth | travel = runway | panelH | sectionH | in vp |
|---|---|---|---|---|---|---|
| **≥1280px (1440×900)** | 4 | **360px** | **1440px** | 520px | **1960px** | **2.18 vp** |
| 1024–1279 | 3 | 341–426px | 1706–2131px | 500px | 2206–2631px | ~2.6 vp |
| 768–1023 | 3 | 256–341px | 1280–1706px | 460px | 1740–2166px | ~1.9 vp |
| **<768px** | — | **carousel, no pin** | — | 560px | **560px** | **0.66 vp** |

At 1440×900 this lands on `pinTop = (900 − 520)/2 = 190px` — the same figure the audit measured on COSMOS (189.641px) [audit]. That is convergence from the same rule, not copying.

### ENTRY / PIN / EXIT
- **Entry:** normal flow until the section's natural top reaches `pinTop`. Panels fade+rise in on approach (`translateY 24px → 0`, staggered 60ms L→R, once only).
- **Pin:** `position: sticky; top: pinTop` on the track wrapper. **We use CSS `sticky`, not JS `position: fixed`.** COSMOS uses JS-driven `fixed` with a compensating `translateY(1440px)` on release [audit] — that works, but `sticky` achieves the same result with no release compensation, no layout thrash, and no jump risk. This is a deliberate engineering improvement, not an imitation.
- **Horizontal travel:** `transform: translate3d(-Xpx,0,0)` where `X = progress × travel`, `progress = clamp(0, (scrollY − pinStart) / runway, 1)`. Updated in a `requestAnimationFrame` loop driven by a passive scroll listener (§13).
- **Exit:** at `progress = 1` the last panel's right edge is flush with the viewport right edge. `sticky` releases naturally; the rail scrolls away and Scene 03's band is directly beneath. **No background change** — both are `--cl-void`.

## RAIL PANEL DESIGN (§7 answered)

Each panel communicates exactly five things and **nothing else**:

```
┌─ 360 × 520 ─────────────────┐
│  eyebrow   POZICIONIRANJE   │  13px, 0.14em, 60% opacity, centred
│  display   IME LINIJE       │  34px condensed uppercase, centred
│                             │  ← 96px of deliberate empty space
│         [ can 210px ]       │  centred packshot, native-res sharp
│                             │
│  CTA       VIDI LINIJU      │  14px, underlined, hover/active only
└─────────────────────────────┘   1px hairline divider between panels
```

Can at **210px = 23.3% of a 900px viewport** [spec] — deliberately matching the audit's measured 23%, and **0.33× the 628px source, so pixel-sharp even at DPR 2** [repo].

**Explicitly forbidden on panels** (§7): price, availability/`Na upit` status, `Pošalji upit` button, volume, packaging metadata, technical category, any second button. These belong to Scene 06.

### Positioning statements (eyebrows)
COSMOS gives each line a *claim*, not a taxonomy path (`CAR CARE IS AN ART`, not `Aerosoli · Boja`) [audit]. Ours, in Serbian latinica, each derived from real `useCase`/`technicalCategory` data and reviewed for `CLAUDE.md` legal safety:

| Family | Eyebrow | Variants |
|---|---|---|
| RAL | `RAL STANDARD U SPREJU` | 60 |
| EASY MAX | `MAKSIMALNA POKRIVNOST` | 52 |
| CHALK EFFECT | `DUBOKI MAT ZA DEKOR` | 34 |
| FAST ACRYLIC | `BRZO SUŠENJE, PUN SJAJ` | 29 |
| SPRAY.BIKE | `PROGRAM ZA BICIKLE` | 88 |
| FLAME | `GRAFIT I STREET ART` | 256 |
| MASTER MECHANIC | `SERVIS I ODRŽAVANJE` | 26 |
| — | `+18 DODATNIH LINIJA` | 197 |

*No claim of exclusive/official distributor status anywhere.*

### DATA SOURCE
New adapter `lib/cosmos-lac-brand-data.ts` (§16) exposing a `CosmosFamily[]` with: `slug`, `name`, `eyebrow`, `variantCount`, `heroVariantSlug`, `accent`, `accentTone`, `catalogueHref`.

---

# 8. FAMILY COLOUR INTERACTION (§8 answered)

## The data we actually have [repo]
Every one of the 742 records carries `backgroundColor`, `foregroundTone`, `colorSource` and `colorConfidence`, and `visualMode` is already `"color-on-hover"` for all 742 — **the mechanism the audit identified is already anticipated in our data model.**

| `colorSource` | n | | `colorConfidence` | n |
|---|---|---|---|---|
| official-chart | 296 | | verified | 409 |
| name-derived | 197 | | derived | 263 |
| ral | 113 | | provisional | 70 |
| cap-sample | 66 | | | |
| manual-estimate | 70 | | | |

**Important negative finding:** the 66 `cap-sample` colours are mostly neutrals (`#B0AFB0` Pewter Silver, `#71706D` Grey, `#1C1C1C` Black) [repo]. **A family accent cannot be derived from cap samples.** 

**Therefore the rule is:** each family designates one **signature variant**, and that variant's *verified* `backgroundColor` becomes the family accent. This is exactly COSMOS's own logic — the panel takes the colour of *the can it is showing* [audit] — and it keeps us inside real data. **No invented palette, no rainbow.**

Selection rule for the signature variant, in order: (1) `colorConfidence === "verified"`, (2) `colorSource` of `official-chart` or `ral`, (3) highest chroma, (4) distinct from other families' accents by ΔE. Candidates visible in the data include Fast Acrylic `#EC6725`/`#FCEB3D` and RAL `#AA843D`/`#8C5132` [repo]. **The final 7 values must be locked by running the selection rule in Phase 3 and recorded in the adapter — I am not hard-coding them here, because doing so from a partial read would be exactly the invention this phase forbids.**

## Behaviour

### Desktop — hover / keyboard focus
| Property | From | To | Timing |
|---|---|---|---|
| panel `background-color` | transparent | `--cl-family-{slug}` | 420ms `cubic-bezier(.16,1,.3,1)` |
| eyebrow + name `color` | `--cl-chalk` | `accentTone === "light" ? --cl-ink : --cl-chalk` | 220ms |
| `VIDI LINIJU` | `opacity 0, translateY 6px` | `opacity 1, translateY 0` | 260ms, 80ms delay |
| can | `scale(1)` | `scale(1.04)` | 420ms, same easing |
| divider hairline | 12% | 0% | 220ms |

The panel is an `<a>`, so `:focus-visible` triggers the identical state — the interaction is keyboard-reachable by construction.

### Mobile — scroll-entry, not hover (§8, §9)
Hover does not exist on touch, so the effect is **re-mapped, not dropped** — precisely the translation the audit observed on COSMOS's own mobile [audit].

- The **active** panel (nearest the carousel's horizontal centre, via `IntersectionObserver` with a centre-line root margin) receives the accent fill.
- Fill animates as a **vertical wipe downward** (`clip-path: inset(0 0 100% 0)` → `inset(0)`), 380ms — matching the mid-wipe state I directly observed in `mobile390/01-y597-scroll.png` [audit].
- Only one panel is accented at a time. `VIDI LINIJU` is **always visible** on mobile (never hover-gated).

## Accessibility
- Contrast is **not** left to chance: `accentTone` is stored per family, and text colour is selected from it. Any accent whose computed contrast against both `--cl-ink` and `--cl-chalk` falls below **4.5:1** is rejected by the selection rule and the next candidate is used.
- The colour change is **decorative only** — it never encodes information. Family identity is carried by the name and the packshot.
- Panels are real links with real `href`s; the rail is a `<ul>`; the pinned region does not trap focus. Tabbing to an off-screen panel scrolls it into view via `scroll-margin`.

## Reduced motion (`prefers-reduced-motion: reduce`)
The repo already honours this in **46 files** with a `usePrefersReducedMotion` hook [repo] — we follow that convention, we do not invent a new one.
- Colour still changes, but as an **instant swap** (no wipe, no easing).
- Can `scale` is disabled.
- **The rail does not pin and does not translate.** It degrades to a horizontally scrollable list with `scroll-snap-type: x mandatory` — fully usable, zero scroll-hijack.

---

# 9. MOBILE RAIL (§9 answered)

The current mobile page is **34,067px / 40.4 vp** [repo]. The rail is where most of that must be reclaimed.

**Architecture: a self-contained horizontal carousel of fixed height — it does not lengthen the page.**

- **Height: 560px (0.66 vp), constant**, regardless of how many families exist. Seven families cost the same vertical space as one. *This single decision is worth roughly 6–8 vp against a stacked layout.*
- Panels: `width: 78vw`, `scroll-snap-align: center`, peeking the next panel by ~22vw so the horizontal affordance is self-evident.
- Native `overflow-x: auto` + `scroll-snap-type: x mandatory`. **No JS scroll-jacking, no vertical scroll trapping** — the brief's explicit requirement. Vertical page scroll always wins; the browser resolves the gesture.
- Progress: a 7-segment indicator beneath the rail; the active segment fills with the active family's accent.
- Scroll-entry colour response per §8.
- `VIDI LINIJU` always visible.

**Desktop pin vs mobile carousel share one component and one data source**; only the layout mode differs, selected by a media query and a `matchMedia` guard for the pin logic.

---

# 10. RANGE / 742 MOMENT (Scene 04) (§10 answered)

### The audit finding this is built on
COSMOS's "OVER 600 SPRAYS" scene contains **no product photography at all** — its impact is *typography + repetition + motion only*. The words are set too big to fit, so they must move; **the typography enacts the scale claim** [audit].

### PURPOSE
Communicate **range**, not analytics. The brief is explicit: no KPI cards, no 8,000px grid.

### SPECIFICATION
- **Height: 0.55 vp (500px desktop / 460px mobile).**
- Background `--cl-void`, full-bleed.
- Centre: one line, at **the largest type on the entire page** — larger than the hero:

```
742  NIJANSE
```

`742` set at `clamp(120px, 18vw, 260px)`; `NIJANSE` at `clamp(56px, 7vw, 100px)`. Beneath, one 13px eyebrow line:

```
SEDAM LINIJA · 68 GRUPA PROIZVODA · JEDNA MREŽA
```

Both numbers are measured facts: **742 records, 68 distinct `baseProductSlug` groups** [repo].

- **The only ornament:** a single row of **12–16 real can silhouettes** at ~90px height running edge-to-edge *behind* the numerals at 14% opacity, drawn from 12 different families. They are cans, not shapes — the range claim is made with the actual range.
- **`742` counts up** from 0 on entry, 900ms, ease-out, once, via the existing `components/ui/CounterUp.tsx` [repo] — no new code.
- **Reduced motion:** `742` renders immediately at its final value; silhouette row is static.

### Why not a marquee here
COSMOS uses an infinite marquee for this moment. We deliberately do **not**, for two reasons: (a) we already use a band device at scenes 03 and 04→05 (§13) and a third would dilute it; (b) a static, centred, enormous numeral is a *stronger* statement for a specific, verifiable number than a scrolling one. We are borrowing the principle (typography enacts scale) and rejecting the execution — which is the §23 test.

---

# 11. APPLICATION FINDER (Scene 05) (§12 answered)

### PURPOSE
Convert brand interest into a route into the catalogue — **without introducing filter-sidebar UI**, which is the single worst offender on the current page (it currently appears at ~15% page depth [repo]).

### PLACEMENT
**After** the brand story. This scene carries the **dark→light inversion** (§13).

### SPECIFICATION
- **Height: 1.00 vp.** Background `--cl-paper`, type `--cl-ink`.
- Display headline: **`ŠTA FARBATE?`** (2 words — audit copy discipline).
- **7 large tappable options**, laid out as a single wrapped row of oversized pills (not a sidebar, not dropdowns, not checkboxes):

`AUTO` · `METAL` · `DRVO` · `BICIKL` · `DEKOR` · `ART / GRAFITI` · `RADIONICA`

- Each option is ≥56px tall with ≥16px type — comfortably touch-legible on mobile without a separate layout.
- **On selection** (single-select, first option active by default so the scene is never empty):
  1. A short line of copy names the recommended family/families.
  2. **3 product cards** appear — a curated subset, never a grid.
  3. One link: `Vidi sve u katalogu →`, carrying the **existing catalogue filter state** in the URL.
- Selection updates via client state; **no navigation, no data fetch** — the mapping is static config.

### Mapping (derived from real `technicalCategory` / `programSlug` / `line` values [repo])
| Option | Primary families | Catalogue filter target |
|---|---|---|
| AUTO | Automotive, RAL, Fast Acrylic, Master Mechanic | `programSlug=aerosoli` + `primaryCategory=boja` |
| METAL | RAL, Easy Max, High Heat, Zinc, Primers | `technicalCategory` ∈ metal/primer set |
| DRVO | W Wood Care, Wood Putties, Chalk Effect | wood set |
| BICIKL | Spray.Bike | `line=Spray.Bike` |
| DEKOR | Chalk Effect, Metallic, Effect | decor set |
| ART / GRAFITI | FLAME, Molotow Premium | flame + molotow set |
| RADIONICA | Master Mechanic, Cleaners, Lubricants, Putties | `programSlug=potrosni-materijal` + prep |

> This mapping **must be re-validated against the live filter parameters in Phase 3** before it is wired — I verified the source fields exist but did not verify the catalogue route's query-param contract. Flagged in §22.

**Note:** this scene is the natural home for the **197 non-family variants** (§7 finding 1) — DRVO, RADIONICA and ART surface exactly the lines the rail cannot show.

---

# 12. COMMERCIAL TRANSITION & CARSYSTEM RANGE (Scene 06) (§13, §14 answered)

### The boundary
COSMOS signals brand→commerce **geometrically**: full-bleed becomes an **inset card with margins and rounded corners** [audit]. We adopt this signal, inverted to suit our light background.

**At scene 05→06, three things change simultaneously:**
1. Layout: full-bleed → **inset container** (32px side margins, 20px radius).
2. Voice: brand claim → availability. Eyebrow reads `COSMOS LAC U CARSYSTEM-U`.
3. Component vocabulary: bespoke COSMOS components → **existing shared Carsystem product cards**.

This is the point where the page stops being a brand experience and becomes a distributor page — and it is **~62% of the way down**, versus COSMOS's ~55% [audit] and our current ~15% [repo].

### SPECIFICATION
- **Height: 1.30 vp.** Background `--cl-paper`; the inset card is `--cl-void` (mirroring COSMOS's black catalogue card on light).
- Display headline: `DOSTUPNO IZ NAŠEG PROGRAMA`
- **Exactly 6 product cards** (2 rows × 3 desktop, 2 columns mobile) — one representative per family, excluding the terminal panel. Uses the **existing** product-card component with its existing `Pošalji upit` / `Detalji →` affordances. This is where commercial metadata is finally allowed.
- One terminal link: **`SVE COSMOS LAC PROIZVODE →`** to the filtered catalogue.
- **Hard rule: this page never renders more than 6 product cards.** The 8,897px grid section [repo] is deleted outright.

---

# 13. TRANSITION BANDS (§11 answered)

### Do we actually need one? — Yes, but only two, and for structural reasons.

The brief warns against adding a band merely because COSMOS has one. Two bands earn their place:

**Band A (Scene 03) — after the rail unpins.** The rail exits by *releasing*, which is a mechanically quiet moment; without a device, scene 04 would abut it with no articulation. Band A is **0.22 vp**, `--cl-void`, containing the seven family wordmarks scrolling horizontally:

`RAL · EASY MAX · CHALK EFFECT · FAST ACRYLIC · SPRAY.BIKE · FLAME · MASTER MECHANIC ·`

Separator: a small **Carsystem** glyph — **not** COSMOS's rainbow zigzag. Content is our families, execution is ours.

**Band B (Scene 04→05) — carries the theme inversion.** This is the audit's most sophisticated structural device: the marquee band is used as the *hinge* for the dark→light flip [audit]. Band B is **0.18 vp**, and it is the last dark element before the page becomes `--cl-paper`. It carries the application vocabulary:

`AUTO · METAL · DRVO · BICIKL · DEKOR · ART · RADIONICA ·`

— which also **pre-announces Scene 05**, so the band does narrative work, not just visual work.

**Motion:** CSS `@keyframes` translate, ~40s linear, infinite, duplicated track for seamless loop. **No JS.** `prefers-reduced-motion` → animation paused, band renders as a static centred row. Both bands are `aria-hidden` (the wordmarks are decorative repeats of content already present as real links).

---

# 14. PAGE-LENGTH BUDGET (§16 — mandatory)

### Desktop (1440 × 900)
| # | Scene | Height | vp | Cumulative |
|---|---|---|---|---|
| 01 | Hero | 900px | 1.00 | 1.00 |
| 02 | Family rail (520 natural + 1440 runway) | 1960px | 2.18 | 3.18 |
| 03 | Band A | 200px | 0.22 | 3.40 |
| 04 | Range — 742 | 500px | 0.55 | 3.95 |
| — | Band B (inversion hinge) | 160px | 0.18 | 4.13 |
| 05 | Šta farbate? | 900px | 1.00 | 5.13 |
| 06 | Carsystem range (inset) | 1170px | 1.30 | 6.43 |
| 07 | Credibility | 405px | 0.45 | 6.88 |
| 08 | CTA — Pronađi prodavnicu | 630px | 0.70 | 7.58 |
| — | Global footer | 540px | 0.60 | **8.18** |

**Total ≈ 7,365px ≈ 8.2 vp.** Target 8–11 ✓. Against current **12.7 vp — a 36% reduction** [repo].

Note that **scene 02 consumes 27% of the entire page**, and 73% of that is *runway* — scroll distance spent on one interaction rather than on content. That is the audit's core pacing lesson made explicit.

### Mobile (390 × 844)
| # | Scene | Height | vp | Cumulative |
|---|---|---|---|---|
| 01 | Hero | 844px | 1.00 | 1.00 |
| 02 | Family carousel (**fixed**) | 560px | 0.66 | 1.66 |
| 03 | Band A | 130px | 0.15 | 1.81 |
| 04 | Range — 742 | 460px | 0.55 | 2.36 |
| — | Band B | 110px | 0.13 | 2.49 |
| 05 | Šta farbate? | 1010px | 1.20 | 3.69 |
| 06 | Carsystem range (6 cards, 2-col) | 1350px | 1.60 | 5.29 |
| 07 | Credibility | 420px | 0.50 | 5.79 |
| 08 | CTA | 590px | 0.70 | 6.49 |
| — | Global footer | 760px | 0.90 | **7.39** |

**Total ≈ 6,234px ≈ 7.4 vp.** Target 8–12.

**Deviation, declared:** 7.4 vp is *below* the stated 8–12 target. I am not padding it to hit the range. The budget falls out of the fixed-height carousel and the 6-card cap; adding height to reach 8 would mean adding content the page does not need. If Phase 3 finds copy or cards need more room, there is **4.6 vp of headroom** before the ceiling. Against current **40.4 vp this is an 82% reduction** [repo].

---

# 15. ASSET PLAN (§20, §21 answered)

### What we have [repo, measured]
| Asset | Status |
|---|---|
| 742 product packshots | ✓ `public/products/cosmos-lac/**`, **800×800 WebP, alpha, uniform** |
| Actual can pixels | **201×628** (400 ml) / 212×749 (Master Mechanic 500 ml) |
| Per-variant colour | ✓ `backgroundColor` + `foregroundTone` on all 742 |
| Family logos / lockups | ✗ **none found** |
| COSMOS video | ✗ **none** (only Carsystem social exports, wrong crop) |
| Lifestyle / application photography | ✗ **none found** |

### Per-scene asset readiness
| Scene | Needs | Have? | Fallback if missing |
|---|---|---|---|
| 01 Hero | 6 packshots + CSS vignette | ✓ | — (arc design *is* the fallback) |
| 02 Rail | 8 packshots + 7 accents | ✓ | terminal panel is type-only |
| 03/B Bands | type only | ✓ | — |
| 04 Range | 12–16 packshots @ 14% | ✓ | — |
| 05 Šta farbate? | 3 packshots per option ×7 | ✓ | — |
| 06 Range | 6 packshots | ✓ | — |
| 07 Credibility | **none** — type only by design | ✓ | — |
| 08 CTA | existing store-locator map/illustration | ✓ [repo] | flat accent panel |

**Every scene is deliverable with assets we already own.** No scene is designed around media we do not possess — the brief's requirement.

### Optional asset gaps (upgrades, not blockers)
- **A1 — Hero-resolution packshot (recommended).** One 1600×1600 render of the lead can would take the hero from 1.40× upscale to 0.70× and permit a genuine 60–70% single-can hero. *Requires authorisation from COSMOS/the brand owner.* Until then the arc composition ships and looks intentional.
- **A2 — Family accent verification.** The 7 signature-variant colours should be eyeballed against real cans before launch; 70 records are `provisional` confidence [repo].
- **A3 — Condensed display face.** If Archivo's condensed width is unavailable, `scaleX(0.88)` on display type is the no-dependency fallback. **Do not add a webfont for this** (`COST_CONTROL.md`).

### Explicitly prohibited
Downloading, hotlinking, re-hosting or frame-grabbing any cosmoslac.com video, collage artwork, or catalogue spread.

---

# 16. DATA PLAN

**New:** `lib/cosmos-lac-brand-data.ts` — a pure adapter over the existing generated JSON. No new data file, no duplication.

```ts
export type CosmosFamily = {
  slug: string;              // "flame"
  name: string;              // "FLAME"
  eyebrow: string;           // "GRAFIT I STREET ART"
  lines: string[];           // ["Flame Orange","Flame Blue","Flame Booster"]  ← merge
  variantCount: number;      // 256   (computed, never hard-coded)
  productGroupCount: number; // 3
  signatureVariantSlug: string;
  accent: string;            // from signature variant backgroundColor
  accentTone: "light" | "dark";
  catalogueHref: string;
};
```

Rules:
1. **All counts computed at build time from the JSON.** `742`, `68` and every per-family number must never be literals — the data is regenerated and literals would silently rot.
2. **FLAME merges three `line` values.**
3. Accent selection follows §8's rule, including the 4.5:1 contrast rejection test.
4. Adapter is **server-side, pure, memoised** — it runs once at build, not per request.

### Data issue to resolve before Phase 3
**73 Molotow variants (`Molotow Premium` 66 + `Molotow Burner` 7) are inside the Cosmos Lac dataset** [repo]. Molotow is a distinct brand. They must not be presented as COSMOS families. Interim: they are excluded from the 7 rail families and surface only under `ART / GRAFITI` in Scene 05, labelled by their own `line` name. **A decision is needed on whether they should be a separate brand record.** This is a data-model question outside this spec's scope.

---

# 17. COMPONENT ARCHITECTURE (§18 answered)

### Which route renders COSMOS today
`app/brendovi/[slug]/page.tsx` dispatches per brand [repo]:

```
rm       → RmBrandPage
carsystem→ CarsystemBrandPage
baslac   → BaslacBrandPage
carfit   → CarfitBrandPage
else     → BrandPage        ← cosmos-lac falls here
```

**Four brands already have bespoke pages; COSMOS is the one that does not.** Adding a fifth branch is the established pattern, not a new architecture.

### Generic `BrandPage` limitations (why it cannot be adapted)
It is 145 lines composing `BrandHero` (logo-in-a-box) + `BrandProducts` (full grid) [repo]. It has no concept of a scene sequence, no pinning, no theme inversion, no family model, and it renders the entire product set. **Fixing it in place would either break the other brands that depend on it or turn it into a config-driven monster.** COSMOS gets its own component; `BrandPage` is left untouched for brands that suit it.

### Proposed structure
```
components/brand/cosmos/
  CosmosBrandPage.tsx          server   orchestrator, composes scenes
  CosmosHero.tsx               client   parallax arc            (rAF)
  CosmosFamilyRail.tsx         client   pin + translate         (rAF + matchMedia)
  CosmosFamilyPanel.tsx        server   pure presentational
  CosmosBand.tsx               server   CSS-only marquee
  CosmosRangeStatement.tsx     client   CounterUp only
  CosmosApplicationFinder.tsx  client   selection state
  CosmosBrandPage.module.css
```

**Reused as-is (no forking):** global `Header` / `Footer` / `PublicSiteChrome`; `BrandSectionNav` (§19); the shared product card in Scene 06; `components/ui/CounterUp.tsx`; `components/motion/usePrefersReducedMotion.ts`; `next/image`.

**COSMOS-specific (must not be generalised prematurely):** the rail pin, the family colour response, the hero arc, the two bands. If a second brand later needs a rail, generalise *then*, from two real cases.

### Server/client boundary
Server by default. Only 4 client components, each with a single reason: `CosmosHero` (scroll parallax), `CosmosFamilyRail` (pin), `CosmosRangeStatement` (counter), `CosmosApplicationFinder` (selection). Panels, bands and cards stay server-rendered — this keeps the page **SEO-friendly and server-renderable**, as `CLAUDE.md` requires. All family names, eyebrows, counts and product links are in the server HTML.

### Animation strategy — is a dependency needed? **No.**
Current dependencies are **`next`, `react`, `react-dom`, `maplibre-gl` — nothing else** [repo]. The audit proved COSMOS achieves its quality with no WebGL and a small motion vocabulary. Our needs map to primitives:

| Need | Primitive | Justification |
|---|---|---|
| Rail pin | **CSS `position: sticky`** | no JS; simpler and safer than COSMOS's JS `fixed` + compensating translate |
| Rail horizontal travel | **rAF + passive scroll → CSS var** | one rAF loop, one `transform`; genuinely needs per-frame scroll math |
| Hero parallax | **same rAF loop** | shared with the rail; one loop for the page, not two |
| Scene reveals | **`IntersectionObserver`** | already used in 9+ components [repo] |
| Family colour | **CSS transitions** | no JS |
| Bands | **CSS `@keyframes`** | no JS |
| 742 counter | **existing `CounterUp`** | already exists |

**rAF is justified in exactly one place** — a single shared loop that reads `scrollY` once per frame and writes two CSS custom properties (`--rail-progress`, `--hero-progress`). It self-cancels when neither scene intersects the viewport. **No animation library is required, and none should be added** (`COST_CONTROL.md`).

---

# 18. MOTION SYSTEM (§17 answered)

**Five systems. That is the whole budget.**

| # | Component | Trigger | Property | Timing / relationship | Purpose | Mobile | Reduced motion |
|---|---|---|---|---|---|---|---|
| 1 | Hero arc | load, then scroll | `translateY`, `opacity` | stagger 90ms/700ms; then 3 parallax rates 0.82/0.74/0.66 | product authority + seamless exit | 3 cans, 60ms stagger | no parallax; static arc, instant opacity |
| 2 | Family rail | scroll progress | `translate3d` X | 1:1 with runway, `progress ∈ [0,1]` | compact family discovery | none — native snap carousel | **no pin, no translate**; snap list |
| 3 | Family colour | hover / focus (D), scroll-centre (M) | `background-color`, `color`, `clip-path` | 420ms `cubic-bezier(.16,1,.3,1)` | product identity from real colour | wipe on active panel | instant swap, no wipe |
| 4 | Bands A/B | autoplay | `translateX` | ~40s linear infinite, CSS only | scene hinge + theme inversion | same, faster | **paused**, static row |
| 5 | Content reveal | `IntersectionObserver` | `opacity`, `translateY 16px` | 500ms, once, 60ms stagger | arrival, not decoration | same | disabled — content visible immediately |

Systems 1 and 2 share **one** rAF loop. Systems 3, 4, 5 are CSS-only or IO-driven. There is no sixth system, and none should be added without deleting one.

**Reduced-motion contract:** with `prefers-reduced-motion: reduce`, the page loses *all* scroll-linked motion and *all* autoplay, retains every piece of content and every link, and its height is **unchanged except scene 02, which shortens from 2.18 vp to 0.58 vp** (no runway needed). Reduced motion therefore produces a *shorter, calmer, fully functional* page — not a broken one.

---

# 19. HEADER ARCHITECTURE (§19 answered)

**Exactly one global header.** `components/layout/Header.tsx` is untouched. It already hides on scroll via a `data-scroll-hidden` attribute [repo], which the hero's 140px top dead zone accounts for.

**Secondary layer:** if COSMOS needs in-page section navigation, it uses the **existing shared `components/brand/BrandSectionNav.tsx`** — which already positions itself relative to the global header and honours `usePrefersReducedMotion` [repo]. **No new COSMOS-local nav component.**

> **Observed context, not changed:** the working tree currently shows `components/brand/carfit/CarfitLocalNav.tsx` **deleted** alongside edits to `BrandSectionNav.tsx` [repo] — i.e. a duplicate brand-local nav is in the process of being consolidated into the shared one. **COSMOS must not reintroduce the pattern that is being removed.** Per the brief, I have not modified any of this.

**Recommendation:** ship COSMOS **without** a section nav initially. At 8 scenes and 8 vp, the page is short enough that section navigation is redundant weight — and adding it would contradict §14.

---

# 20. PERFORMANCE STRATEGY

- **Images:** `next/image`, WebP already; `sizes` capped at 800px so no upscale request is ever generated; `priority` on the hero lead can only (1 image); everything else lazy. Explicit dimensions everywhere → **CLS target 0**.
- **Budget:** hero < 220KB; full page < 1.1MB on first load. (COSMOS ships 23 videos; we ship zero — we should comfortably beat them.)
- **JS:** 4 client components; the rail is the only non-trivial one. One shared rAF loop, cancelled when off-screen. All scroll listeners `{ passive: true }`.
- **Pinned-rail cost:** only `transform` is animated (compositor-only). No layout, no paint. `will-change: transform` applied on the track **only while pinned**, removed on release.
- **LCP:** the hero lead can, preloaded. Text renders server-side immediately.
- **Verification in Phase 3:** measure document height at 1440×900 and 390×844 and assert ≤ 8.5 vp / ≤ 8.5 vp — the same measurement method used in the audit, so the numbers are directly comparable.

---

# 21. ACCESSIBILITY

- **Reduced motion:** §18 contract. Follows the existing 46-file convention [repo].
- **Rail:** `<ul>` of `<a>` links; `:focus-visible` mirrors hover exactly; `scroll-margin` so off-screen focus scrolls into view; no focus trap; **native scrolling on mobile — vertical page scroll is never hijacked.**
- **Contrast:** every family accent must pass **4.5:1** against its paired text colour or be rejected by the selection rule (§8). Both themes checked.
- **Colour is never the sole carrier of meaning** — family identity is name + packshot.
- **Bands** are `aria-hidden` (decorative repetition of real links).
- **`742` counter:** the final value is present in the DOM from the server; the animation is a visual enhancement over already-correct text.
- **Application finder:** real radio-group semantics (`role="radiogroup"`), arrow-key navigable, not a div soup.
- **Headings:** one `h1` (hero), `h2` per scene, in order.
- **Images:** existing `imageAlt` values are populated on all 742 records [repo].

---

# 22. WHAT IS REMOVED FROM THE CURRENT PAGE (§26)

Deleted outright for this route — not preserved because it exists:

| # | Removed | Why |
|---|---|---|
| 1 | Generic `BrandPage` composition for `cosmos-lac` | replaced by `CosmosBrandPage`; `BrandPage` itself untouched for other brands |
| 2 | `BrandHero` inset dark **card** | hero must be full-bleed, not a component in a page |
| 3 | **White box containing the COSMOS logo** | the hero's focal object becomes the product, not the logo |
| 4 | Breadcrumb row above the hero | pushes the hero down and breaks the full-bleed opening |
| 5 | **Three equal-weight CTAs** | → one primary + one text link |
| 6 | `3 programa` / `Dostupnost na upit` chips | commercial metadata in a brand moment |
| 7 | **The 8,897px product grid section** [repo] | → 6 curated cards (§12) |
| 8 | **The filter sidebar** (`PRETRAGA`/`PROGRAM`/`LINIJA`/`TEHNIČKA KATEGORIJA`/`ZAVRŠNICA`/`NAMENA`) | catalogue UI on a brand page; replaced by `ŠTA FARBATE?` (§11), placed far later |
| 9 | `BRZI FILTER PO FAZI` pill row | same |
| 10 | Uniform ~14% product scale everywhere | → 58% hero / 23% rail hierarchy |
| 11 | Long descriptive paragraphs | → ≤25-word statements |
| 12 | Vertical mobile stacking of all products | → fixed-height carousel (**−82% mobile length**) |
| 13 | Single flat light background | → one deliberate dark→light inversion |

**Not removed:** the global header, the global footer, the shared product card, `BrandSectionNav`, `CounterUp`, `usePrefersReducedMotion`, and the entire catalogue route — which remains the destination, not the content.

---

# 23. COSMOS-INSPIRED vs ORIGINAL TO CARSYSTEM (§23)

| # | OBSERVED PRINCIPLE (cosmoslac.com) | OUR CARSYSTEM TRANSLATION |
|---|---|---|
| 1 | One pinned horizontal rail holds all product families | Same principle. **Our geometry is fluid** — `panelWidth = 100vw/visible`, `runway = travel` — so it is exact at every width, where theirs is fixed at 360px. Our families, eyebrows, colours and copy. |
| 2 | Product at ~71% of viewport in hero | Same *intent*, different execution forced by our assets: **a receding arc totalling ~58% mass**, because our source can is only 628px (§5). Depth substitutes for scale. |
| 3 | Panel adopts the can's own colour on hover | Same principle, **driven by our own `backgroundColor` data** (742 records, 409 verified) with a contrast-rejection rule they do not appear to have. |
| 4 | Mobile re-maps hover to scroll-entry wipe | Adopted directly as a *principle*. Our implementation is a native snap carousel with an IO centre-line — no scroll-jacking. |
| 5 | Hero exits via 0.72× parallax lag, black-on-black | Adopted. Our rates are 0.82/0.74/0.66 across three can layers rather than one video plane. |
| 6 | Marquee band hinges scenes; one carries theme inversion | Adopted as a **structural device only**, twice, with our family names and our application vocabulary. **Not** their rainbow zigzag glyph; not an infinite ornament elsewhere. |
| 7 | Scale claim made typographically ("OVER 600 SPRAYS") | Principle adopted, **execution deliberately rejected**: a static, centred `742 NIJANSE` with a counter, not a scrolling marquee — stronger for a specific verifiable number (§10). |
| 8 | Commerce delayed to ~55% depth | Adopted at ~62%, with the same **geometric** signal (full-bleed → inset card). |
| 9 | Section title *is* the media window (text-clipped video) | **Not adopted.** It requires video we do not own, and `CLAUDE.md` forbids hiding SEO-critical text in media. Our titles are plain, large, indexable type. |
| 10 | One display size for the whole site | Adopted as a two-step scale with the middle deleted. |
| 11 | Transparent header, colour-inverting, never solid | **Not adopted.** It requires art-directed media per section, which we lack. We keep the existing global Carsystem header and give the hero a 140px dead zone instead. |
| 12 | 13 scenes from 9 block types | Adopted: **8 scenes from 6 block types.** |
| 13 | Pure black canvas throughout the brand half | **Partially adopted.** We are a multi-brand distributor; a fully black site would fight our design system. Dark for scenes 01–04 and 08, our existing paper for 05–07. |
| 14 | Their proof points (40 years, 1,500 partners) | **Never adopted.** Ours are our own: 742 variants, 68 groups, our partner network. |

---

# 24. SCENE SPECIFICATION — CONDENSED REFERENCE

Scenes 01, 02, 04, 05, 06 are fully specified in §5, §7–§12. This table completes the remaining two and gives the whole page in one view.

### SCENE 07 — CREDIBILITY (§15 answered)
**Purpose:** one reason to trust, then stop. **Height:** 0.45 vp. **Background:** `--cl-paper`.
**Content:** a single centred statement, ≤20 words, plus one link.

The brief asks how much company/sustainability content belongs on a *distributor* page. My answer: **almost none.** COSMOS's 40-year history, production facility and carbon-neutral programme are **COSMOS's credibility, not Carsystem's** — reproducing them would (a) copy their content, (b) risk the exact unverified-claim problem `CLAUDE.md` warns about, and (c) cost ~1.5 vp we do not have.

**Retained:** one factual, verifiable line about *availability and support through Carsystem* — our credibility, not theirs. **No corporate timeline. No ESG panel. No production photography** (which we do not have anyway).

**If** a sustainability line is later required, it must (a) be a claim COSMOS has published, (b) be attributed to COSMOS, (c) connect to a specific line in our catalogue, and (d) fit in one sentence. Otherwise it is omitted.

### SCENE 08 — CTA
**Purpose:** deliver the primary business objective. **Height:** 0.70 vp. **Background:** `--cl-void` — the page returns to dark to close the loop opened by the hero.
**Content:** display `PRONAĐI NAJBLIŽU PRODAVNICU`; one line of support copy; one primary button to the store locator; one secondary text link to contact.
**Motion:** reveal only. **Data:** existing store-locator route [repo]. **Mobile:** full-width button.

---

# 25. FINAL TEST (§28)

| Question | Answer |
|---|---|
| Do COSMOS **products** become the main visual identity? | **Yes.** The logo-in-a-box is deleted; every scene except 03, 04-type and 07 is carried by real packshots. |
| Is there one clearly dominant hero moment? | **Yes.** 58% hero mass vs 23% rail = 2.4× ratio. |
| Is the family range compact rather than page-bloating? | **Yes.** 7 families = 2.18 vp desktop, **0.66 vp mobile (fixed height)**. |
| Does motion give energy without gimmicks? | **Yes.** Five systems, one rAF loop, zero libraries, no 3D. |
| Is mobile within 8–12 vp? | **7.4 vp** — below range, deliberately, with 4.6 vp headroom (§14). |
| Does commerce begin after brand storytelling? | **Yes.** ~62% depth, vs ~15% today. |
| Does every scene have a clear job? | **Yes** — one purpose each, stated per scene. |
| Implementable on our stack without 3D/WebGL? | **Yes.** CSS sticky + one rAF loop + IntersectionObserver + existing components. **No new dependency.** |
| Materially closer to COSMOS's quality while original? | **Yes** — 14 principles transferred, **4 explicitly rejected** (§23 rows 9, 11, 13, 14). |

---

# 26. IMPLEMENTATION CHECKLIST FOR PHASE 3

**Blockers to resolve first**
1. ☐ Decide how the **73 Molotow variants** are modelled (§16). Design-blocking for Scene 05.
2. ☐ Run the **family accent selection rule** and lock 7 values + contrast results (§8).
3. ☐ Verify the **catalogue route's query-param contract** before wiring §11's mapping.
4. ☐ Decide on **asset gap A1** (1600px hero packshot). Ships without it.

**Build order**
5. ☐ `lib/cosmos-lac-brand-data.ts` adapter — computed counts, FLAME merge, accents.
6. ☐ Add the `cosmos-lac` branch to `app/brendovi/[slug]/page.tsx` (5th case; leave the other four untouched).
7. ☐ `CosmosBrandPage` shell + design tokens + two-step type scale.
8. ☐ Scene 01 hero (arc, stagger, parallax) — the highest-risk piece; build second-to-nothing.
9. ☐ Scene 02 rail: **sticky pin → measure `runway === travel` → then** horizontal translate.
10. ☐ Family colour response: desktop hover/focus, then mobile IO wipe.
11. ☐ Scenes 03/B bands (CSS only).
12. ☐ Scene 04 range (reuse `CounterUp`).
13. ☐ Scene 05 application finder (radiogroup semantics from the start).
14. ☐ Scene 06 commercial boundary + 6 cards.
15. ☐ Scenes 07–08.

**Verification gates — do not close the phase without these**
16. ☐ `npm run lint` · `npm run typecheck` · `npm run build`.
17. ☐ **Measure document height** at 1440×900 and 390×844; assert **≤ 8.5 vp** each. Same method as the audit, so the numbers are comparable.
18. ☐ Test with `prefers-reduced-motion: reduce`: no pin, no parallax, no autoplay, all content present.
19. ☐ Keyboard-only pass through the rail and the application finder.
20. ☐ Contrast audit on all 7 accents, both text pairings.
21. ☐ Confirm **no more than 6 product cards** render on the page.
22. ☐ Confirm every family name, count and link is in the **server-rendered HTML** (view-source, JS disabled).
23. ☐ Confirm **no new dependency** was added to `package.json`.

---

# 27. UNKNOWNS & RISKS

1. **Family accent colours are not locked.** The rule is specified; the 7 values require a data pass (§8). I deliberately did not hard-code them from a partial read.
2. **Catalogue filter query-param contract unverified** (§11).
3. **Molotow brand modelling unresolved** (§16).
4. **Hero upscale is a judgement call.** 1.40× on the lead can is my recommendation, not a measured guarantee of acceptability. It should be reviewed on a retina display before the design is signed off; A1 removes the risk.
5. **Serbian copy is draft.** All headlines and eyebrows need a native review pass, and every claim re-checked against `CLAUDE.md`'s brand-safety rules.
6. **`svh` units:** `100svh` is used for the hero to avoid mobile URL-bar jump; verify against the browser support baseline the project targets.
7. **Archivo condensed availability unconfirmed** (§15 A3).
8. **Scene 07 content is intentionally minimal** and may need a stakeholder decision about how much COSMOS corporate credibility the distributor page should carry.
