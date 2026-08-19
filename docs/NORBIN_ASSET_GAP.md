# NORBIN — Asset inventory, provenance and gap analysis (Phase 1)

**Status:** audit only. **No asset was moved, copied, converted or added to `public/`.**
**Date:** 2026-08-09.
**Companion documents:** `NORBIN_BRAND_RESEARCH.md`, `NORBIN_PRODUCT_INVENTORY.md`, `NORBIN_DESIGN_BLUEPRINT.md`.

Tags: `[F]` fact · `[R]` repository fact · `[I]` inference · `[D]` design interpretation.

**Headline `[I]`:** the prior acquisition pass concluded *"0 product images — the source does not
publish them"*. That is true **per product** and false **for the brand**. NORBIN publishes two large,
well-made, production-grade images and one clean vector logo. Together with the packshot we already
photographed ourselves, that is **four usable assets** — enough to build the recommended design with
no P0 photography blocker on the hero.

---

## 1. What the repository already holds

| # | Path `[R]` | Type | Dimensions | Bytes | Alpha | Subject | Provenance | Production-ready |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| A1 | `public/brands/norbin.svg` | SVG | viewBox 194×116 | 13 982 | n/a (vector) | Wordmark + wave + "A brand of BASF" strapline | **Certain** — byte-identical to `norbin-paint.com/images/logo.svg` | **Yes** |
| A2 | `public/products/norbin/norbin-n15-020-1l.jpg` | JPEG | 1920×1920 | 135 423 | no | Real `N15-020` 1 L can, white background, ¾ view | Our own photography `[I]` | **Yes** |
| A3 | `assets/manufacturer/norbin/documents/` | 99 PDFs | — | ~44 MB | — | 24 TDS, 72 SDS, brochure, poster | Manufacturer, SHA256-verified | Yes, as documents |
| A4 | `/images/products/placeholder-product.svg` | SVG | — | — | — | Generic placeholder used by `norbin-2k-bezbojni-lak` | Ours | **No** — placeholder |

### 1.1 Notes on A1 — the logo

`[F]` Adobe Illustrator output, German layer name `Ebene_1`, four fills:
`#EBB700` (gold stroke) · `#0082BB` (blue stroke) · `#739600` (green stroke) · `#4D5357` (wordmark and
strapline). The wordmark is outlined paths, so no font is required.

`[I]` This is the **muted / print** colourway. The website header uses the same file. The physical can
labels use a darker navy wordmark (`#204552`). Both are legitimate; the SVG is the one we hold, and it
is the correct default.

`[D]` **Caution — the strapline is baked into the artwork.** The file cannot be cropped to the mark
alone without editing. Two consequences: (a) any placement is committing us to displaying *"A brand of
BASF – We create chemistry"*, which is defensible today but is the wording most likely to change as
Surventis rebrands; (b) at small sizes the strapline becomes illegible mush. See P1-2.

### 1.2 Notes on A2 — our own packshot

`[F]` 1920×1920, sharp, evenly lit, neutral white background, correct label geometry, barcode and
batch code legible. This is the **only per-product photograph of a NORBIN product that exists
anywhere we have looked**, including the manufacturer's own channels.

`[I]` It is also our best colour reference: sampling it gives `#0080CB` / `#DFB000` / `#7F9600`,
independently confirming the logo file's palette (see brand research §7.3).

`[D]` Two limitations for the recommended design: it is **square**, so it cannot fill a wide hero; and
it is **JPEG on white**, so it cannot be composited over a coloured ribbon without a visible box. A
cut-out version is P1-1.

---

## 2. Official manufacturer assets — discovered, catalogued, not downloaded

**None of these has been copied into the repository in this phase.** The brochure-embedded images are
already inside the PDF we hold; they were inspected in place.

| # | Asset | Source URL / document | Dimensions | Bytes | Format | Alpha | Text baked in | Assessment |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| **M1** | **Range group packshot** — all 13 EMEA products, white cut-out | `NORBIN_Broch_EN_2024_mai.pdf`, p.2, embedded `Im0` | **2470×1219** | ~1.9 MB | **PNG, RGBA** | **Yes — 42.8 % transparent, true cut-out** | Product names + codes are printed on the labels (correct, legible) | **Best asset available.** Genuinely transparent, high resolution, editorially complete |
| **M2** | **Workshop photograph** — painter in navy fleece wiping the shoulder of a black car | `NORBIN_Broch_EN_2024_mai.pdf`, p.1, embedded `Im0` | **2489×1265** | ~1.4 MB | **JPEG, CMYK** | No | No | Strong candidate hero image. **Needs CMYK→sRGB conversion with a profile** |
| **M3** | **Homepage banner** — the same photo clipped into the enlarged wave ribbons | `norbin-paint.com/images/norbin-index-banner-1920-v1.jpg` | 1920×1080 | 631 317 | JPEG, RGB | No | No | **Reference, not asset.** It is the definitive proof of the ribbon geometry; the photo inside it is a lower-resolution crop of M2 |
| **M4** | **Range photograph** — same 13 products, on white, May 2024 | `norbin-paint.com/images/gamme_NORBIN-mai-2024.jpg` (mod. 2024-07-18) | 1920×1080 | 551 196 | JPEG, RGB | **No** — flattened onto white | Yes, on labels | Lower value than M1: smaller, no alpha. **But it is the correct-colour reference** — M1's colours are the conversion artefact |
| **M5** | **Official logo** | `norbin-paint.com/images/logo.svg` | vector | 13 982 | SVG | n/a | Strapline | **Already held as A1.** Nothing to acquire |
| **M6** | Brochure, EN, May 2024 | `files/NORBIN_Broch_EN_2024_mai.pdf` | A4, 3 pp | 3.5 MB | PDF | — | — | Held. Publishable as a linked document |
| **M7** | Grey-shade technical poster | `files/NORBIN_A3-Sheet_Tech-Info_Grey-Shades_230221b_druck.pdf` | A3, 1 p | 1.5 MB | PDF | — | — | Held. Contains the §5.2 blend content |
| **M8** | China product leaflet (EN/CN) | `files/NORBIN(R) Product Leaflet China (EN_CN).pdf` | — | — | PDF | — | — | **Out of scope.** Different range; cataloguing only |

### 2.1 Assets that do **not** exist

`[F]` Confirmed absent from every NORBIN channel we probed:

- Any **per-product** packshot published by the manufacturer.
- Any application photography — no spraying, sanding, masking, mixing, panel prep.
- Any product detail or macro photograph.
- Any product page, therefore any product-page imagery.
- Any icon set, pattern library, brand manual or downloadable asset kit.
- Any video.
- Any Serbian-language material of any kind.

`[I]` M2 is the **entire** human photography of the brand in EMEA. One photograph, reused on the
brochure cover and the homepage banner, at least since 2023-11-13.

### 2.2 Provenance and usage caution

`[D]` M1, M2, M4 and M6–M7 are unambiguously the brand owner's own material, and using a supplier's
official product imagery and documentation is normal distributor practice. But the material carries
`© BASF Coatings GmbH` while the brand is now owned by Surventis, and the ownership handover is five
weeks old.

**Recommendation:** before Phase 2 publishes M1 or M2, obtain a one-line written confirmation from the
supplier that we may use NORBIN product imagery and literature on our website. This is a five-minute
email, it removes the only real licensing question in this audit, and it should happen in parallel
with implementation rather than blocking it. **A1 (logo) and A2 (our own photo) need no such
confirmation.**

---

## 3. Assessment of every candidate against the recommended design

`[D]` Judged against the "Ukrštanje" direction in the blueprint.

| Asset | Use it directly? | Crop / treatment needed | Which section it serves |
| --- | --- | --- | --- |
| **M1** group packshot | **Yes** | Convert to WebP/AVIF. **Recolour is not needed if we use M4 as the colour reference and correct M1's profile.** Individual cans are separable by alpha for per-product cut-outs | Hero object · range section · per-product cards |
| **M2** workshop photo | **Yes**, after conversion | CMYK→sRGB with a profile; 3:2 master; 4:5 and 1:1 safe crops. Subject sits right-of-centre — **crop from the left on mobile, never centre-crop** | Hero background wedge · brand-origin section |
| **M3** banner | **No** — reference only | — | Geometry reference for the ribbon system |
| **M4** range photo | **No** as an image | — | **Colour reference of record.** Cite it in the token comments |
| **A1** logo | **Yes** | Minimum width 120 px so the strapline stays legible; otherwise a text lock-up | Hero identity line · brand-origin section |
| **A2** our 1 L packshot | **Yes** | Cut out to transparent; generate 1:1 and 4:5 | Product layer, `N15-020` card |

### 3.1 Quality flags

`[F]` No asset in this audit is low-resolution, stretched, a screenshot, or of ambiguous provenance.
This is unusually clean. The genuine flags are:

| Flag | Asset | Detail |
| --- | --- | --- |
| **Colour-space artefact** | M1 | Embedded PNG renders fluorescent cyan/lime/magenta; three other official sources disagree. **Do not sample brand colours from M1.** See brand research §7.3 |
| **CMYK source** | M2 | Must be converted with an ICC profile, not naïvely |
| **Baked-in text** | M1, M4 | Product names and codes are printed on the labels. Correct and legible — but it means the image cannot be reused for a different product, and **alt text must not duplicate the visible codes** |
| **Strapline lock-up** | A1 | "A brand of BASF" cannot be separated without editing the artwork |
| **Aspect mismatch** | A2 | Square; unusable as a wide hero |
| **Single photograph** | M2 | Every human image on the page would be the same person and the same car. **This is the strongest argument for local photography** |
| **Duplicate content** | M1 vs M4 | Same artwork, two renderings, different colour. Keep both, label which is which |

---

## 4. Gap analysis

### P0 — blocks implementation

| # | Missing | Why it matters | Sourceable officially? | Local shoot? | Can we proceed without it? |
| --- | --- | --- | --- | --- | --- |
| **P0-1** | **A decision on `norbin-2k-bezbojni-lak`** | It is one of only three NORBIN records we hold, and the page's product layer cannot be laid out until we know whether it is a product or a duplicate of `N15-020` | No — commercial question | No | **No.** Blocks the product section. Inventory §3.2 |
| **P0-2** | **Confirmation of which EMEA products we can actually supply** | The page teaches a 13-product system; the "what we stock" layer currently contains one item. If the real answer is 4–6, the section design changes materially | No | No | **Partly.** The system layer can be built; the stocked layer cannot be finalised |
| **P0-3** | **A correct brand description in `lib/carsystem-data.ts`** | Current copy says NORBIN is a colour programme. It is not. Metadata, JSON-LD and the brand index all read from it | n/a — our own data | n/a | **No.** Wrong at the data layer means wrong everywhere |

`[I]` **All three P0s are decisions or corrections. None is a missing asset.** That is the good news of
this audit: no photograph and no document is standing between us and a complete page.

### P1 — implementation possible, visual quality compromised

| # | Missing | Why it matters | Sourceable officially? | Local shoot? |
| --- | --- | --- | --- | --- |
| **P1-1** | **Cut-out (alpha) version of our `N15-020` 1 L packshot** | The one product we definitely sell cannot sit on a coloured ribbon without a white box around it | No | **No shoot needed** — masking A2 is enough |
| **P1-2** | **A wordmark-only logo lock-up** | A1 has the strapline baked in; at hero scale, or inside a sticky nav, it is either too big or illegible | Possibly — ask the supplier for the asset kit | No |
| **P1-3** | **A second human/application photograph** | With only M2, the page has exactly one human image. A brand about *ease of use* with no picture of use is thin | No — none exists | **Yes** — P0 of the shoot |
| **P1-4** | **A `N15-020` 5 L packshot** | We sell both sizes; showing only the 1 L makes the size choice invisible | No | **Yes** — trivial, same setup |

### P2 — enhancement

| # | Missing | Note |
| --- | --- | --- |
| **P2-1** | Macro of the label — code typography, ribbon edge | Would carry the "code first" idea visually. Reshoot of A2 at closer range |
| **P2-2** | The two primer-filler greys side by side | Would make the §5.2 blend tangible. Needs stock we may not have |
| **P2-3** | Mobile-specific hero crop of M2 (4:5) | Derivable from M2; listed separately because it needs an art-direction decision, not just a resize |

---

## 5. Local photography plan

`[D]` Derived from the gaps above, not from a generic wish-list. **Six shots. One session.** Nothing
here needs a studio, a model or a hired location — a clean bench, a window and a real bodyshop are
enough. Five of the six only require stock we already have.

Shared specification for all shots: shoot RAW, 3:2 native; deliver sRGB; **no vendor logos other than
NORBIN in frame**; nothing that could be read as a claim about a colour system.

---

**SHOT 1 — `N15-020` 1 L + 5 L, size pair · P0 of the shoot**

| | |
| --- | --- |
| Subject | The two pack sizes we sell, side by side, showing the scale difference |
| Products | `N15-020` 1 L, `N15-020` 5 L |
| Orientation | Horizontal, 3:2 master; 1:1 and 4:5 safe crops |
| Composition | Both cans ¾ view, front labels readable, 5 L slightly behind and left; generous headroom for a ribbon crop |
| Background | Seamless white, same setup as A2 so it composites with the existing packshot |
| Lighting | Large soft key from the front-left, white bounce right, no hard specular on the label |
| Human | No |
| Action | Static |
| Crop usage | Desktop: product-layer card. Mobile: 4:5 |
| Section | §7 "Naš NORBIN program" |
| Fixes | P1-4, and completes P1-1 |

---

**SHOT 2 — Clear + hardener, the pair · P0 of the shoot**

| | |
| --- | --- |
| Subject | The single most important idea on the page: a clear is never used alone |
| Products | `N15-020` 1 L with `N75-021` Hardener Normal (or `N75-022`) |
| Orientation | Horizontal, 3:2; must survive a 21:9 letterbox crop |
| Composition | Clear left, hardener right, a deliberate gap between them where the "2:1" can be typeset. **The hardener's red band must be visible** |
| Background | White |
| Lighting | As shot 1 |
| Human | No |
| Action | Static |
| Crop usage | Desktop: wide band in the ratio section. Mobile: stacked, cropped to 1:1 each |
| Section | §5 "Odnos" |
| Note | **If we do not stock a NORBIN hardener, this shot cannot be taken.** Fallback: separate the two cans from M1 by alpha. Lower quality, still workable |

---

**SHOT 3 — Label macro · P1**

| | |
| --- | --- |
| Subject | The code typography and the hard diagonal edge of the ribbon on a real label |
| Products | `N15-020`, any size |
| Orientation | Horizontal 3:2, shot tight |
| Composition | Fill the frame with `Clear / N15-020` plus one ribbon edge entering from the right. Slight angle so the tin's curvature reads |
| Background | The can fills the frame |
| Lighting | Raking side light to show the print texture and the can's curve |
| Human | No |
| Action | Static |
| Crop usage | Desktop: full-bleed narrow band between sections. Mobile: 3:2, unchanged |
| Section | §3 "Kako se NORBIN čita" |
| Fixes | P2-1 |

---

**SHOT 4 — Workshop, mixing · P0 of the shoot**

| | |
| --- | --- |
| Subject | A painter pouring hardener into a graduated mixing cup, clear can on the bench beside it |
| Products | `N15-020` + hardener + mixing cup |
| Orientation | Horizontal 3:2 master; **4:5 crop-safe with the hands centred** |
| Composition | Hands and cup dominant, cans secondary and in focus enough to read the code; real bench, real clutter behind, shallow depth of field |
| Background | A real bodyshop mixing room. Not styled |
| Lighting | Available light, warm, plus one bounce. Match M2's honest, unpolished character deliberately |
| Human | **Yes** — hands and forearms only, no identifiable face (avoids a model release and keeps the focus on the action) |
| Action | Pouring, mid-motion |
| Crop usage | Desktop: hero right-hand wedge. Mobile: 4:5 above the headline |
| Section | §1 Hero, and §5 |
| Fixes | P1-3. **This is the shot that makes the page ours rather than a reprint of the brochure** |

---

**SHOT 5 — Primer filler on the panel · P1**

| | |
| --- | --- |
| Subject | A sprayed grey primer-filler panel, half sanded |
| Products | `N55-V20` and/or `N55-V29` if stocked; otherwise any grey-primed panel |
| Orientation | Horizontal 3:2 |
| Composition | The panel fills the frame at a slight angle; the sanded/unsanded boundary runs diagonally, echoing the ribbon geometry |
| Background | The panel is the background |
| Lighting | Raking, to show the surface, not the gloss |
| Human | Optional — a sanding block, no face |
| Action | Static or a hand mid-sand |
| Crop usage | Desktop: half-width. Mobile: 3:2 |
| Section | §4 "Proces" |
| Note | **Only take this if we stock the product.** A generic grey panel presented under a NORBIN heading would be a fabricated claim |

---

**SHOT 6 — The gap · P2**

| | |
| --- | --- |
| Subject | The empty step. A panel in primer, ready for colour, with **no** NORBIN product in frame |
| Products | None |
| Orientation | Horizontal 3:2, wide |
| Composition | Deliberately quiet. A primed panel, lots of negative space |
| Background | Workshop, defocused |
| Lighting | Flat and even |
| Human | No |
| Action | Static |
| Crop usage | Full-bleed, low height, on both breakpoints |
| Section | §4, at the point where the process map shows the colour step NORBIN does not fill |
| Note | A single honest image doing an argumentative job: *this is where your colour system goes, and NORBIN does not compete with it* |

---

### 5.1 If only two shots are possible

`[D]` Take **Shot 4** (workshop mixing) and **Shot 2** (clear + hardener pair). Between them they cover
the hero, the central idea, and the only P1 gap that officially sourced material cannot close.

### 5.2 What we explicitly do **not** need

- A hero product line-up — M1 already provides it, cut out, at 2470 px.
- Individual packshots of the 12 products we do not sell — separable from M1 if ever needed.
- Any spray-booth or "atmosphere" photography — that is R-M's territory on our site, and NORBIN's
  identity is white and plain.
- Video. Nothing on this page changes over time.

---

## 6. Asset readiness summary

| Category | Count |
| --- | ---: |
| Usable production assets held today | **4** (A1, A2, M1, M2 — the last two already inside a PDF we hold) |
| Official assets catalogued but not needed as images | 3 (M3, M4, M8) |
| Documents held and publishable | 10 EMEA (8 TDS, brochure, poster) + 89 regional |
| **P0 gaps** | **3** — all decisions or data corrections, **zero missing assets** |
| P1 gaps | 4 |
| P2 gaps | 3 |
| **Recommended new photographs** | **6** (2 if the budget is minimal) |
| Assets requiring a licensing confirmation before publication | 4 (M1, M2, M6, M7) |
| Assets requiring nothing | 2 (A1, A2) |

**`[I]` Bottom line: the NORBIN page is not asset-blocked. It is decision-blocked.**
