# BEFAR — Landing page blueprint

Phase 1 deliverable. **Not an implementation.** No JSX, no CSS, no components.
Read together with `BEFAR_BRAND_RESEARCH.md`, `BEFAR_PRODUCT_ARCHITECTURE.md`,
`BEFAR_ASSET_INVENTORY.md`, `BEFAR_CARSYSTEM_ASSORTMENT.md`.

**Primary design territory:** *Industrial Object* — a language built from Befar's packaging and the
physical products, not from their website.
**Signature interaction:** *Hardness Scale*.

---

## 1. Core idea

> **Befar is not a coating. It is the layer that touches the paint.**

Every other brand on this site sells something that *becomes* the surface — basecoat, clear, filler,
primer, aerosol. Befar sells the physical interface between the machine, the hand and the surface:
foam, discs, plates, perforated pads, blocks, cloths, and the compounds that go on them.

The page must therefore feel like **material, not marketing**. Weight, edge, density, perforation,
rotation, contact. The reader should come away understanding one thing they did not know before:

> **On a Befar pad, colour is not decoration. Colour is hardness.**

That single fact — printed on nearly every page of Befar's own catalogue and shown on **zero** pages of
their website — is the spine of the whole design.

**What the page is not:** not automotive lifestyle, not a detailing web-shop, not "a complete system
for professionals". Three of our brand pages already open with a connected-workflow statement. This one
must not.

---

## 2. Design principles

1. **Object first, copy second.** Every section leads with a thing, not a sentence. Headlines are
   short and declarative; explanation sits below in small technical type.
2. **Colour is data.** No colour appears on this page unless it means something — hardness, abrasive
   grade, line tier, or brand signal. Nothing is tinted to look nice.
3. **The number is a graphic.** Article codes, badge numbers (75/80/85/90), hole counts (7/15/62),
   diameters (125/150/170/180/220) and star ratings are set as typography at real size, not hidden in
   metadata.
4. **Flat planes, hard edges.** Taken from Befar's charcoal chemical cartons. No soft glows, no
   floating gradient orbs, no glassmorphism, no neon.
5. **Circles carry the brand.** The disc is Befar's fundamental unit. Circular geometry recurs;
   rectangles hold information.
6. **Honesty about stock.** The page shows what we can actually supply. Manufacturer range is clearly
   separated from Carsystem offer (see §12).
7. **Motion must be mechanical.** Things index, snap, rotate and compress. Nothing floats or drifts.
8. **Mobile is a different composition, not a squeeze.** Designed per section (§10).

---

## 3. Visual system

### 3.1 The ground

Two grounds alternate down the page, in large uninterrupted blocks:

- **Work surface** — off-white, very slightly warm, matte. The catalogue-studio register. Used for
  product, spec and discovery sections.
- **Charcoal block** — near-black, flat, no gradient. Taken from the professional chemical cartons.
  Used for the hero, the hardness scale, Opencell and the macro interlude.

Transitions between them are **hard horizontal edges**, full-bleed, never feathered. The alternation
itself is the page's rhythm.

### 3.2 Structural devices

| Device | Description | Source |
|---|---|---|
| **Red structural band** | A full-width or partial red bar carrying a section number or label. A *structural* element, not an accent. | Catalogue running header, page-number tab |
| **Number tab** | Section index (01…11) in a small red block at the section's left edge. | Catalogue page-number tab |
| **Spec rule** | A thin horizontal rule with a filled dot at the terminus, used under product titles. | Catalogue product-title rule (visible on p.4, p.42) |
| **Code chip** | Article code in mono, in a bordered chip. | Befar's own article numbering |
| **Star meter** | 1–5 filled marks. Never a generic 5-star rating widget — drawn as a discrete hardness meter. | Catalogue hardness legend |
| **Perforation field** | Vector hole constellations used as section backgrounds and dividers. | Interface pads (7 / 15 / 53 / 62 holes) |

### 3.3 Photography treatment

- **Product on work surface:** photographs cut out or placed on the off-white ground, hard-edged, with
  the original short cast shadow retained where usable. No drop shadows invented in CSS.
- **Object on charcoal:** the dark-studio register, full-bleed or in large circular masks.
- **Never** composite a product onto a licensed supercar. That is exactly what we criticised on
  Befar's own catalogue pages 42 and 46.
- **White balance must be corrected per image.** Befar's set is inconsistent (see §18).

---

## 4. Colour system

### 4.1 Brand colours

| Token | Value | Origin | Use |
|---|---|---|---|
| `befar-red` | `#EA080B` | **Sampled** from the official logo file | Logo plate, section number tabs, structural bands, primary CTA. Nothing else. |
| `befar-charcoal` | `#16191E` | **Sampled** from catalogue cover panel / chemical cartons | Dark ground |
| `befar-ink` | `#0B0A10` | **Sampled** from catalogue | Deepest ground, macro sections |
| `befar-surface` | off-white, warm | Our choice, derived from the photography backdrop | Light ground |
| `turquaz-cyan` | `#00A6D2` | **Sampled** from catalogue p.47 | turQuaz sub-brand only |
| `leo-yellow` | *observed, not sampled* | Leo packaging and pads | Leo sub-brand only |

> Note: Befar's print red (`#E4072F`–`#DB052C`, sampled from the catalogue PDF) differs measurably from
> their logo red (`#EA080B`). We should standardise on the **logo** value and record the discrepancy.
> Befar publishes no brand guidelines, so neither value is authoritative.

### 4.2 Hardness colours — **digital representation, not official brand colours**

**These are UI values we define.** They are *not* sampled from Befar and *not* official. Befar's
product photography is not colorimetrically reliable — measured from their own files, "orange" foam
reads as `#C46852` (salmon) and "yellow" as `#B7A816` (olive). Publishing those as brand colours would
be wrong.

Each swatch below is chosen to (a) read unambiguously as the named colour, (b) hold contrast on both
the charcoal and off-white grounds, and (c) remain distinguishable in greyscale and for the common
colour-vision deficiencies. **Every use must be paired with the colour name and the star rating — never
colour alone.**

#### Core line (`02xxx`, `03xxx`, `04xxx`)

| Colour | Hardness | Intended function (Befar's wording) | Apply with | Products in our range | Sizes | UI swatch *(digital representation)* |
|---|---|---|---|---|---|---|
| Orange | ★★★★★ | Hardest — heaviest correction | Liquid or cream compound | `02402`/`03402`, `04402` | 150 × 50, 150 × 25 | `#E2621B` |
| White | ★★★ | Controlled correction | Liquid or cream compound | `02401`/`03401`, `04401` | 150 × 50, 150 × 25 | `#F2F1ED` |
| Yellow | ★★★ | Controlled correction | Liquid or cream compound | **not stocked** (`02404`, `04404`) | 150 × 50, 150 × 25 | `#E8C21C` |
| Blue | ★★ | Refining, pre-finish | Liquid or cream compound | `02405`/`03405`, `04405` | 150 × 50, 150 × 25 | `#2F7FD1` |
| Black | ★ | Softest — finishing, hologram control | Polish or paint protector | `02403`/`03403`, `04403` | 150 × 45, 150 × 25 | `#1B1E22` |

#### `+Plus` line — **different mapping, must be scoped separately**

| Colour | Hardness | Apply with |
|---|---|---|
| Orange | ★★★★★ | Cream or liquid compound |
| White | ★★★★ | Cream or liquid compound |
| Cherry | ★★★ | Cream or liquid compound |
| Blue | ★★★ | Cream or liquid compound |
| Cream | ★ | Polish or anti hologram |

#### `Opencell` line — **its own colour code**

| Colour | Hardness | Apply with |
|---|---|---|
| Red | ★★★★ | Cream or liquid compound |
| Yellow | ★★★ | Cream or liquid compound |
| Green | ★★ | Cream or liquid compound |
| Black | ★ | Polish or anti hologram |

**Design consequence:** the hardness scale component must take the *line* as an input. A single global
colour key would be factually wrong — black is soft in two lines, cream is the soft one in `+Plus`.

### 4.3 Functional colours elsewhere

Sanding blocks: orange = soft, red = hard, turQuaz blue = eco.
Non-woven abrasive: red = 280 P, grey = 400 P.
Chemical bands: 75 red, 80 plum, 85 orange-red, 90 blue.

---

## 5. Typography direction

**No new font families.** The project already loads Archivo (`--font-display`), IBM Plex Sans
(`--font-body`) and IBM Plex Mono (`--font-technical`). Adding a condensed grotesque for one brand page
would cost a font payload and break site consistency. The catalogue's voice is reachable through
*treatment*, not through a new typeface.

| Role | Family | Treatment |
|---|---|---|
| Section titles / product names | `--font-display` (Archivo) | Heavy weight, all-caps, tight negative tracking, large. This is where the catalogue's condensed-caps voice comes from. |
| Hardness numerals, diameters, badge numbers | `--font-display` | Very large, tabular, often as the dominant object in a panel |
| Article codes, spec labels, hole counts | `--font-technical` (IBM Plex Mono) | Small, uppercase, letterspaced. Codes read as codes. |
| Body / explanatory | `--font-body` (IBM Plex Sans) | Restrained, short paragraphs, never more than ~3 lines per block |

**Optional, to evaluate at implementation:** Archivo ships a variable width axis. If the already-loaded
variable font exposes it, a narrower width for product names gets closer to the catalogue voice at zero
additional payload. Only if it costs nothing.

**Not used:** the `Italianno`-style script of *"Kalite Keyif Verir…"*. The slogan may be **quoted once**,
attributed, set in our own type — never used as a display face.

---

## 6. Graphic motifs

Derived from the products, in priority order:

1. **Perforation fields.** Hole constellations drawn as vector: 7, 15, 53 and 62 holes, plus the
   16-hole orbital pattern. Used as section backgrounds, dividers, loading states and the page's
   strongest ownable graphic. Accurate to the real pad layouts, drawn from
   `/brands/befar/products/befar-interface-pad-multihole-face.webp` and
   `/brands/befar/details/befar-interface-pad-6hole-angled.webp`.
2. **Foam profile silhouettes.** Cross-sections of flat, waffle, conical, elips die-cut, air-lines
   orbital and wave/egg-crate foam. Explains a real product difference that photography cannot show.
3. **Diameter rings.** Concentric circles at 75 / 125 / 145 / 150 / 170 / 180 / 220 mm, drawn to
   *relative* scale — the pairing rule made visible.
4. **The star meter.** A discrete 1–5 hardness mark, drawn as filled blocks or notches rather than
   literal stars.
5. **The number badge.** Two-digit numerals (75, 80, 85, 90) and box quantities (24, 36, 66, 200) at
   large size, from the packaging.
6. **The disc-as-badge.** A dark circle with a wordmark across it — the pad face treated as a
   repeatable brand unit.
7. **The face icon.** Befar's rounded-square face mark, used sparingly and at small size, as a
   punctuation mark.

**Explicitly banned:** floating gradient orbs, glassmorphism, neon, particle fields, generic
"tech" grids, ornamental parallax with no product logic.

---

## 7. Asset mapping

44 curated files are prepared in `public/brands/befar/`. Full provenance table in
`BEFAR_ASSET_INVENTORY.md` §6.

| Group | Files | Intended sections |
|---|---|---|
| `brand/` | 4 PNG logos (befar, +Plus, Leo, turQuaz) | Hero, line ladder. **Opencell logo missing.** |
| `hero/` | 6 (2 × Porsche detail, red panel swirls, Opencell stack, Leo Nano bottle, pads on black) | 01 Hero, 07 Opencell, 09 In use |
| `hardness/` | 6 (five code-identified foam colours + pad family row) | 03 Hardness Scale |
| `products/` | 17 (Opencell macro, interface pad, backing plates, Leo, +Plus, 5 chemicals, turQuaz, 3 sanding blocks, 2 non-woven) | 02 Material, 04 Geometry, 06 Line ladder, 10 Discovery |
| `details/` | 9 (velcro hook macro, pad profiles, hub macro, printed label, edge prints) | 04 Geometry, 08 Object detail |
| `workflow/` | 2 (gloved hand + bottle, chemicals row) | 09 In use |

**Key per-section anchors:**

| Section | Primary asset |
|---|---|
| 01 Hero | `hero/befar-pads-black-reflection.webp` or `products/befar-opencell-foam-macro.webp` |
| 03 Hardness | `hardness/befar-foam-0440{1..5}-*.webp` (5472 px originals, one shoot, code-identified) |
| 04 Geometry | `products/befar-interface-pad-multihole-face.webp`, `details/befar-interface-pad-6hole-angled.webp` |
| 05 Pairing rule | `products/befar-backing-plate-diameters.webp`, `details/befar-pad-profile-stem.webp` |
| 06 Line ladder | `brand/*.png` + one product per line |
| 07 Opencell | `hero/befar-opencell-stack-dark.webp`, `products/befar-opencell-foam-macro.webp` |
| 08 Object detail | `details/befar-velcro-hook-edge-macro.webp`, `details/befar-hub-foam-macro.webp`, `details/befar-leo-pad-edge-print.webp` |
| 09 In use | `hero/befar-porsche-headlight-detail.webp`, `workflow/befar-gloved-hand-leo-bottle.webp` |

---

## 8. Page architecture

Eleven sections. Two deliberate changes from the outline in the brief, both justified:

- **Added `05 — The Pairing Rule`.** Befar prints a real dependency rule (150 mm foam → 125 mm plate,
  180 → 150, 220 → 170, each in soft/mid/hard). It is a genuine, checkable system statement that no
  competitor page presents, it is small, and it is the natural bridge from hardness to products.
- **`Geometry` and `Object Detail` kept separate but given different jobs.** In the brief they overlap.
  Here, **04 Geometry** is *diagrammatic and vector* (why the shapes exist), while **08 Object Detail**
  is *photographic and wordless* (what the material looks like up close). Two different registers, far
  apart on the page.

| # | Section | Ground | Job |
|---|---|---|---|
| 01 | **Hero — the object** | Charcoal | One product as sculpture. Almost no copy. |
| 02 | **What Befar makes** | Off-white | Four material categories, ~60 words total. |
| 03 | **Hardness Scale** ★ | Charcoal | The signature interaction. Colour = hardness. |
| 04 | **Geometry & perforation** | Off-white | Vector-led: hole counts, foam profiles, why shape exists. |
| 05 | **The pairing rule** | Off-white | Diameter dependency, drawn to scale. |
| 06 | **The line ladder** | Charcoal | turQuaz → befar → +Plus → Opencell / Leo. |
| 07 | **Opencell** *(conditional — see §12)* | Ink | Editorial moment for the newest line. |
| 08 | **Object detail** | Ink | Full-bleed macro interlude. Minimal copy. |
| 09 | **In use** | Off-white | Where Befar enters the work. Secondary, short. |
| 10 | **Product discovery** | Off-white | Only what we actually map. |
| 11 | **Manufacturer note + CTA** | Charcoal | Bursa, since 2002. Then back into the Carsystem system. |

A sticky section nav (the shared `BrandSectionNav` pattern) runs the page. Reusing it is deliberate —
it is a site-wide convention, and consistency of navigation is not the same as a template layout.

---

## 9. Section-by-section behaviour

### 01 — Hero: the object

**Desktop.** Charcoal full-bleed. A single pad, very large, off-centre, cropped by the viewport edge —
treated as a sculptural object rather than a product shot. The `befar` logo plate sits small in the
upper left; a red number tab `01` at the left edge. One short headline in heavy caps. Beneath it, one
line of technical type: the article code and the diameter. No paragraph, no button cluster — one quiet
text link down to the scale.

Headline direction (Serbian latinica, to be finalised — see §13): something that names the material and
the function, e.g. *"Sloj koji dodiruje lak."* Explicitly **not** *"Kompletan sistem za profesionalce."*

**Behaviour.** On load the pad settles into place with a short, weighted move — no bounce. As the user
scrolls, the pad rotates slowly (a few degrees), tied to scroll position, and the perforation field
behind it shifts by a smaller amount. Nothing autoplays indefinitely.

**Mobile.** The pad becomes the top ~55vh, cropped harder, centred. Headline below it, not over it.
Rotation on scroll is retained (cheap `transform`), the parallax layer is dropped.

---

### 02 — What Befar makes

**Desktop.** Off-white. Four columns, each a photograph on the work surface with a mono label and one
short line: **Foam** · **Interfaces & backing** · **Abrasive accessories** · **Surface chemicals**.
Total copy under ~60 words. A red structural band carries the section number and title above.

This section exists to prevent the reader mistaking Befar for a coatings brand. It is deliberately
plain and fast.

**Mobile.** 2 × 2 grid, images square, labels below. No horizontal scroll — four items fit.

---

### 03 — Hardness Scale ★ *(signature)*

The centrepiece. **A data visualisation that is also the product navigation**, not a carousel.

**Desktop.** Charcoal, full-viewport-height, sticky while the user moves through the scale.

- **Left:** the scale itself — five (core-line) horizontal steps, ★ to ★★★★★, stacked vertically. Each
  step shows the star meter, the colour name, and the swatch as a **thin vertical bar**, not a blob.
  The active step is marked by a red indicator in the gutter.
- **Centre:** the pad. A single large disc, face-on. Moving between steps **cross-fades between the
  five code-identified photographs** and, at the same time, the disc **compresses very slightly** on
  the softer steps and sits taller on the harder ones — a physical readout of density. This is the one
  moment where the page dramatises a material property.
- **Right:** a spec panel that changes with the step — article code (mono, large), hardness stars,
  Befar's own "apply with" recommendation, available sizes, and whether **we** carry it. Unstocked
  steps (yellow) are shown greyed with an honest label rather than hidden.

- **Line switcher** above the scale: `Core` / `+Plus` / `Opencell`. Switching re-maps the entire scale,
  because the three lines genuinely differ. Core is the default and the only line with local
  photography; the other two are shown as data-only until assets exist (§18).

**Interaction model.** Scroll-driven by default (the step advances as the sticky section is traversed),
with the steps also directly clickable and fully keyboard-operable as a listbox. Both paths change the
same state.

**Mobile.** The scale rotates to a **horizontal track** pinned under the pad: five colour bars with
star counts, swipeable and tappable. The pad sits above at ~40vh; the spec panel stacks below and is
the tallest element. Sticky behaviour is reduced to the pad only — the page must not trap scroll on
mobile. The compression effect is retained (it is one `transform`), the cross-fade is retained,
scroll-linked stepping is replaced by explicit tap/swipe.

**Reduced motion.** No compression, no cross-fade — an instant swap. The scale remains fully usable.

---

### 04 — Geometry & perforation

**Desktop.** Off-white, and the most graphic section on the page. Vector-led.

- A row of **hole constellations** drawn to scale — 7, 15, 62 (and the 53-hole and 16-hole variants) —
  as precise vector patterns, each with its hole count set large in display type and its function in
  one line of mono. These are drawn, not photographed.
- Below, **foam profile silhouettes** in cross-section: flat, waffle, conical, elips, air-lines,
  wave. Each with a one-line reason it exists.
- One photograph anchors the section so the vectors stay believable:
  `products/befar-interface-pad-multihole-face.webp`.

**Behaviour.** As each constellation enters the viewport its holes appear in a short staggered
sequence — a *perforation reveal*. Fast, once, not on every re-entry.

**Mobile.** Constellations become a horizontally scrollable rail with snap points, one per card,
with a visible progress indicator. Profiles become a stacked list. The reveal stagger is shortened.

---

### 05 — The pairing rule

**Desktop.** Off-white, narrow and quiet — a single diagram, deliberately smaller than its neighbours.
Concentric **diameter rings** drawn to relative scale show foam Ø against required plate Ø:
220 → 170, 180 → 150, 150 → 125. Selecting a foam diameter highlights the matching plate ring and names
the three hardness options (`08xxx` soft, `095xx` middle hard, `094xx` hard).

**Behaviour.** Ring transitions are a scale + opacity change only. No rotation here — this section is
about fit, not movement.

**Mobile.** Rings stack as three separate small diagrams rather than one nested figure; nesting is
illegible below ~480 px.

---

### 06 — The line ladder

**Desktop.** Charcoal. Five horizontal bands, one per line, ascending:
`turQuaz` → `befar` → `befar +Plus` → `Opencell` / `Leo`. Each band carries the sub-brand lockup, one
sentence of positioning, one product photograph, and the code prefix that identifies it
(`ADV`, `ORB`, `OP`, `L`). The bands are visibly different heights and weights so the ladder reads as a
ladder.

This section does the job Befar's own site has never done: showing that the range has tiers.

**Mobile.** Bands become full-width stacked cards in the same order. Lockups scale down; positioning
line stays.

---

### 07 — Opencell *(conditional)*

**Desktop.** Ink ground, full-bleed, editorial. The macro of stacked open-cell foam edges runs large;
type is minimal and sits in the negative space. The Opencell colour code (red ★★★★ / yellow ★★★ /
green ★★ / black ★) is shown as a compact four-step meter — a callback to section 03, at smaller scale.
One honest line about what open-cell foam is, and Befar's own durability claim **attributed to them**,
not asserted by us.

**Commercial caveat.** We currently map **zero** Opencell products (`BEFAR_CARSYSTEM_ASSORTMENT.md`).
Giving a full editorial moment to a line we do not sell is a business decision, not a design one. Three
options, in order of preference:
1. Stock it, and the section stands as designed.
2. Present it as *manufacturer capability* — clearly framed as "Befar's newest line", with an enquiry
   CTA rather than a product link.
3. Reduce it to a single band inside section 06.

**Mobile.** Macro becomes a full-width band at ~50vh with type below. The four-step meter stays.

---

### 08 — Object detail

**Desktop.** Ink. A wordless macro interlude of three to four full-bleed frames — velcro hook texture,
foam edge, hub meeting foam, printed article code on a plate hub. Captions are single mono lines,
small, in the corner. No headline, no CTA. This section's job is to make the material feel physical
after several sections of data.

**Behaviour.** Frames advance on scroll with a slow scale change (a subtle push-in, ≤4%). No parallax
stacking.

**Mobile.** Two frames only, chosen for legibility at small size (hook texture, foam edge). The others
are dropped rather than shrunk — a macro that is too small stops being a macro.

---

### 09 — In use

**Desktop.** Off-white. Deliberately placed **ninth**, not third. Two or three frames showing where
Befar enters the work — pad on the machine, compound on the pad, cloth on the panel — with the
correction sequence named in one short line each. This is a supporting section, roughly half the
height of section 03.

Uses `hero/befar-porsche-headlight-detail.webp` and `workflow/befar-gloved-hand-leo-bottle.webp`,
subject to the provenance check in §18.

**Mobile.** Single column, images full width, one line of copy each.

---

### 10 — Product discovery

**Desktop.** Off-white. Only products we actually map. Cards show the real photograph where we now have
one (the four 25 × 150 mm velcro codes), the article code as a mono chip, the colour name, the star
meter and the size. Filters mirror the page's own logic: **hardness**, **diameter**, **mounting system**
(velcro / M14 applicator) — not our internal category names.

Links into the existing catalogue (`/katalog?brend=befar`) rather than re-implementing it.

**Mobile.** Two-column card grid; filters collapse into a single sheet.

---

### 11 — Manufacturer note + CTA

**Desktop.** Charcoal. A short, factual manufacturer note — family company, Bursa, producing since
2002, foam and interface products also used in aviation, rail, marine and furniture. Facts only; no
superlatives, no country count (three official sources give three different numbers), no distribution
claims about Carsystem.

Then the CTA set, in the site's standard priority:
1. **Pronađi najbližu prodavnicu** (primary, red)
2. Pogledaj Befar proizvode (secondary)
3. Kontakt / tehnički savet (tertiary text link)

**Mobile.** Stacked, primary CTA full width.

---

## 10. Mobile behaviour — consolidated

| Concern | Rule |
|---|---|
| **Hardness interaction** | Vertical scale → horizontal snap track. Tap and swipe, never scroll-hijack. Sticky limited to the pad. |
| **Horizontal layouts** | Only sections 04 and 10 may scroll horizontally, always with snap points and a visible progress indicator. Never a hidden horizontal scroll. |
| **Large circular objects** | Cap at ~86vw. Allow bleeding off one edge — a cropped disc reads better than a shrunken one. Never centre a disc with equal margins; it looks like a logo. |
| **Typography scale** | Display headlines `clamp()` down to a floor that keeps 2–3 words per line. Mono spec type never below 11 px. Star meters must stay countable — if they cannot, show `4/5` instead. |
| **Sticky** | At most one sticky element at a time, and never combined with the site header on screens under ~700 px tall. |
| **Image crop** | Hero and macro frames need mobile-specific art direction (portrait or square crops), not the desktop landscape crop scaled down. Requires `<picture>` with distinct sources. |
| **Touch targets** | Hardness steps ≥ 44 px; the colour bar alone is not the target — the whole row is. |

---

## 11. Motion system

Motion is derived from the product: **rotation, pressure, compression, alignment, perforation, diameter,
contact.** Nothing else.

| Motion | Where | Technique | Budget |
|---|---|---|---|
| **Disc rotation** | 01, 07 | `transform: rotate()` driven by scroll position | ≤ 8° total, linear |
| **Foam compression** | 03 | `transform: scaleY()` + a shadow shift, 2–5% | 200 ms, ease-out |
| **Cross-fade between hardness steps** | 03 | opacity swap of pre-decoded images | 180 ms |
| **Perforation reveal** | 04 | staggered opacity/scale on SVG circles | 30 ms stagger, once |
| **Diameter transition** | 05 | `transform: scale()` on rings | 240 ms |
| **Scale indexing** | 03 | discrete snap between steps, no easing overshoot | 160 ms |
| **Macro push-in** | 08 | `transform: scale(1 → 1.04)` on scroll | continuous but transform-only |

**Rules.**

- CSS transforms and opacity only. **No WebGL.** No canvas. No physics library.
- Everything reversible: scrolling up must undo exactly what scrolling down did.
- Scroll-linked motion via `IntersectionObserver` + `requestAnimationFrame`, or a scroll-timeline where
  supported — never a scroll listener writing layout properties.
- No animation runs when its section is off-screen. No infinite loops anywhere.
- `prefers-reduced-motion: reduce` removes compression, rotation, stagger and push-in, and replaces
  cross-fades with instant swaps. **All content and all interaction remain available.**
- No motion may be the only way to perceive information.

---

## 12. Product / data requirements

| Requirement | Status | Notes |
|---|---|---|
| Mounting system field (velcro / M14 applicator) | **Missing** | Four of our eight SKUs are ambiguous. Blocks the discovery filter. |
| Hardness value per product (1–5) | **Missing** | Currently only implied by prose. Needs a real field, scoped by line. |
| Line/tier field (`core` / `+Plus` / `Opencell` / `Leo` / `turQuaz`) | **Missing** | Needed for §6 and to scope the colour key. |
| Befar article code per product | **Missing** | We hold `sku` (`BEFAR-PAD-OR-25X150`) but not the manufacturer code. |
| Diameter and thickness as separate numeric fields | **Partly** | Currently one label string (`"25 mm x 150 mm"`). The pairing diagram needs numbers. |
| Recommended chemical per hardness step | **Missing** | Available from the catalogue legend. |
| Stock confirmation | **Missing** | Business input. No row may claim availability. |
| Yellow step (`04404`) | **Not stocked** | Scale has a visible gap. Either stock or label honestly. |
| Real photography linked to products | **Now partly available** | Four of eight SKUs have a true photograph in `public/brands/befar/hardness/`. |

**Recommendation:** model this as a Befar-specific data module (`lib/befar-brand-data.ts`), following
the `carfit-brand-data.ts` / `cosmos-lac-brand-data.ts` precedent, rather than widening the shared
`CarsystemProduct` type for one brand.

---

## 13. Content requirements

**All copy in Serbian latinica, server-rendered.**

| Content | Source | Status |
|---|---|---|
| Hero headline + one technical line | Us | To write |
| Four material-category lines (§02) | Us, from Befar's About | To write |
| Hardness step descriptions × 5 | Befar's catalogue legend, translated | To write |
| Hole-count and foam-profile explanations | Us — technical, must be checked with a bodyshop | To write, **needs review** |
| Pairing-rule explanation | Befar catalogue (printed rule) | Direct, low risk |
| Line-ladder positioning lines × 5 | Us | To write |
| Opencell paragraph | Befar's claim, **attributed** | To write |
| Manufacturer note | Verified facts only | Ready — see `BEFAR_BRAND_RESEARCH.md` §3.1 |
| Product names in Serbian | Us | Legacy WP names are inconsistent with Befar's families — needs a decision |

**Prohibited copy.** Any unverified Befar superlative ("sector leader", "most reliable in the region",
"much longer service life" unattributed), any country count, and — per `CLAUDE.md` — any distribution
claim for Carsystem ("zvanični distributer", "ekskluzivni partner") until confirmed. Safe wording:
*"Befar program u ponudi"*, *"partnerska mreža"*.

**Permitted quote.** *"Kalite Keyif Verir…"* / *"Enjoy Quality…"* — once, attributed, in Befar's own
words, set in our type.

---

## 14. CTA strategy

The page must end inside the Carsystem system, not in a Befar-branded cul-de-sac.

| Position | CTA | Tone |
|---|---|---|
| Hero | Quiet text link down to the hardness scale | Not a button. The hero sells the object. |
| After §03 (hardness) | "Pogledaj sunđere u katalogu" — inline, contextual | Low-key |
| §10 discovery cards | Per-product link into `/katalog?brend=befar` | Functional |
| §11 primary | **Pronađi najbližu prodavnicu** | The site's primary CTA. Red. |
| §11 secondary | Pogledaj Befar proizvode | Outline |
| §11 tertiary | Kontakt / tehnički savet | Text link |

No sticky CTA bar, no exit-intent, no pricing, no cart language. No aggressive e-commerce tone.

---

## 15. Performance constraints

Set deliberately against what we found on Befar's own site (605 KB – 2.36 MB of HTML per page, 4608 px
originals served to a gallery).

| Constraint | Target |
|---|---|
| Total image payload above the fold | ≤ 250 KB |
| Full-page image payload (desktop, all sections loaded) | ≤ 1.6 MB |
| Largest single asset | ≤ 420 KB (currently `befar-opencell-foam-macro.webp`, 407 KB) |
| JS added by this page | ≤ ~12 KB gzipped. No animation library, no WebGL. |
| Fonts | **Zero additional families.** |
| Below-fold images | `loading="lazy"`, explicit `width`/`height`, `<picture>` with mobile crops |
| Hardness step images | Pre-decoded on section entry so the cross-fade never stalls; 5 × ~110 KB |
| SVG motifs | Inline, hand-drawn, no icon-font, no external sprite |
| LCP element | The hero object image — must be `priority` and dimension-locked |
| CLS | 0 — every image and every sticky region reserves its box |

---

## 16. Accessibility considerations

- **Colour is never the only signal.** Every hardness swatch carries the colour name and the star
  rating in text. This matters more here than on any other brand page, because colour *is* the data.
- **Contrast.** All five UI swatches must clear 3:1 against both grounds for non-text use; the labels
  beside them must clear 4.5:1 as text. White foam on off-white needs an outline, not a lighter tint.
- **The hardness scale is a real control.** Implemented as a listbox/tablist: arrow keys move between
  steps, `Home`/`End` jump to the ends, focus is always visible, and the active step is announced with
  its colour name and rating. It must be fully operable without scrolling.
- **Scroll-linked state must have a non-scroll path.** Anything driven by scroll position is also
  reachable by click and keyboard.
- **`prefers-reduced-motion`** removes all transforms and staggers; nothing becomes unreachable.
- **Macro interlude (§08)** is decorative — `alt=""` where a caption already carries the meaning, real
  alt text where it does not.
- **Star meters** expose a text equivalent (`4/5`) to assistive technology; never nine repeated glyphs.
- **Headings** form a single logical outline; the sticky nav uses real in-page anchors.
- **Serbian latinica**, `lang="sr-Latn"`, no text baked into images.

---

## 17. What makes this different from our other brand pages

Compared against `RmBrandPage` (8 sections), `BaslacBrandPage` (10), `CarfitBrandPage` (12),
`CosmosBrandPage`, `CarsystemBrandPage` (5).

| Existing page | Its spine | Befar's difference |
|---|---|---|
| **R-M** | *"Jedan povezan radni tok"* → colour technology → digital colour tools | Befar has no colour formulas and no digital tooling. Workflow is section **9**, not section 2. |
| **baslac** | *"Sistem za jasan radni tok"* → systems → waterborne/solvent lines → colour | Same workflow-first spine. Befar inverts it: material → property → geometry → range. |
| **Carsystem** | Connected result → programme units → documentation | Befar has **no documentation** to show. That section cannot and must not exist. |
| **Carfit** | Job-first (*"Radionica ne radi po kategorijama. Radi po zadacima."*) | Carfit owns the "tasks" framing. Befar is property-first, not task-first. |
| **Cosmos** | Colour as appearance (RAL), variant rails, application finder | Befar inverts the same idea: colour as a **measurable physical property**. Similar component, opposite meaning. |

**The three structural moves nothing else on the site makes:**

1. **A scalar product property drives the navigation.** No other brand we carry has one.
2. **Workflow is demoted to ninth.** Four pages already lead with it; a fifth would be the moment the
   site looks like a template.
3. **A vector-diagrammatic technical section (04–05).** Every other page is photographic or chromatic.
   This one is drawn.

**Sequence comparison** — the anti-template check:

```
R-M / baslac / Carsystem : hero → trust → workflow → products → CTA
Carfit                   : hero → tasks → workbench → families → products → docs → CTA
Cosmos                   : hero → colour range → finder → credibility → CTA
BEFAR                    : hero(object) → material → PROPERTY → geometry → pairing
                           → ladder → editorial → macro → use → discovery → CTA
```

---

## 18. Remaining blockers

Carried forward and updated after Phase 1 asset work.

| # | Blocker | Severity | Change since Phase 0 |
|---|---|---|---|
| 1 | **No vector Befar logo.** Best available is a 635 × 192 RGBA raster (now local). The catalogue PDF was checked: page 47's lockup sheet is a flattened JPEG and the only vector layer in the file is the header bar + script slogan. **VECTOR LOGO STILL REQUIRED.** | **Blocker** | Investigated and closed off — the PDF is not a source. |
| 2 | **No vector for `+Plus`, `Leo`, `turQuaz`.** Rasters now local (285–449 px), backgrounds baked in, no alpha. **VECTOR LOGO STILL REQUIRED.** | **Blocker** for §06 | Rasters secured |
| 3 | **No Opencell logo at all**, in any format, at any usable size. | **Blocker** for §07 | Newly confirmed |
| 4 | **Colour accuracy.** Befar's photography is not colorimetrically reliable (their "orange" samples as `#C46852`). The §4.2 swatches are our digital representation. Physical samples or a controlled reshoot needed before we claim any colour is Befar's. | **Blocker** for claiming accuracy | Quantified |
| 5 | **Stock confirmation.** Zero rows are `CONFIRMED CURRENT`. | **Blocker** for §10 | Register now exists |
| 6 | **Mounting system unmodelled** — 4 of 8 SKUs ambiguous between M14 and velcro. | **Blocker** for §10 filters | Newly identified |
| 7 | **Hero photograph provenance unverified.** The red Porsche shots (6720 × 4480) may be commissioned or licensed. Must be confirmed before publishing. | **High** | Newly flagged |
| 8 | No TDS, no SDS, no certifications | High | Unchanged |
| 9 | No PNG-with-alpha packshots — cut-outs must be produced by us | High | Unchanged |
| 10 | No factory, laboratory, team or trade-fair photography | Medium | Unchanged |
| 11 | Clean (untinted) workshop video — the one asset is 720p with red baked in | Medium | Unchanged |
| 12 | Serbian copy | High | Unchanged |
| 13 | Instagram `@befar_tr` not auditable programmatically | Medium | Unchanged — `UNVERIFIED` |
| 14 | Conflicts in Befar's own facts (2500 vs 1000 m²; 50 vs 54 countries) | Medium | Avoid both in copy |

**Items 1–6 gate a production launch.** Items 1–3 can be worked around for a *review build* by using
the rasters at small size; they cannot ship at hero scale.

---

## 19. Implementation order

Sequenced so that each step is reviewable and nothing is built on an unresolved blocker.

| Step | Work | Depends on | Blocked? |
|---|---|---|---|
| **0** | Review this blueprint | — | ← we are here |
| **1** | Business answers: stock list, mounting systems, yellow step, Opencell intent (`BEFAR_CARSYSTEM_ASSORTMENT.md` §5) | — | No |
| **2** | Request from Befar: vector logos ×5, physical colour samples, TDS/SDS, photo licence confirmation | — | No |
| **3** | Build `lib/befar-brand-data.ts` — hardness scale, line ladder, pairing rule, code mapping (§12) | 1 | No |
| **4** | Draw the vector motifs: hole constellations, foam profiles, diameter rings, star meter (§6) | — | No |
| **5** | Write Serbian copy (§13) | 1, 3 | No |
| **6** | Cut out packshots and correct white balance for the ~15 images used on-page | 2 (colour refs) | Partly |
| **7** | Static section shells + sticky nav, no motion | 3, 4, 5 | No |
| **8** | Hardness Scale component — keyboard/listbox first, motion last | 3, 6, 7 | No |
| **9** | Remaining sections, then motion layer (§11) | 7, 8 | No |
| **10** | Mobile art direction and `<picture>` sources (§10) | 6, 9 | No |
| **11** | Performance and accessibility pass against §15 and §16 | 9, 10 | No |
| **12** | Route the brand page (`app/brendovi/[slug]/page.tsx`) to the new component | 11 | No |

Steps 3, 4 and 5 are independent of the outstanding asset requests and can start as soon as the
business answers in step 1 arrive. Step 12 is the only change to existing shared code, and it is a
single branch added to the existing brand-slug switch — the same pattern already used for Carfit and
Cosmos.
