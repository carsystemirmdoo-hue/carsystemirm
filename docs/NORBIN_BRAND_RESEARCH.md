# NORBIN — Brand research, positioning and visual identity (Phase 1)

**Status:** research / audit only. No design, no components, no production code changed.
**Date of research:** 2026-08-09.
**Companion documents:** `NORBIN_PRODUCT_INVENTORY.md`, `NORBIN_ASSET_GAP.md`, `NORBIN_DESIGN_BLUEPRINT.md`.
**Prior work superseded in part:** `docs/seo/NORBIN_ACQUISITION_REPORT.md` (2026-08-08) — see §2.3 and §11.

**Source discipline.** Every material statement carries a tag. Categories are never blended.

- **`[F]` Fact** — printed on, or directly readable from, a current official source; quoted or transcribed.
- **`[C]` Their claim** — marketing language from an official source; true as *their statement*, not independently verified.
- **`[I]` Inference** — our reasoned conclusion from official material. Not an official statement.
- **`[D]` Design interpretation** — a recommendation for *our* site. Never a NORBIN statement.
- **`UNVERIFIED`** — could not be confirmed from any source.

---

## 1. Executive summary — the five findings that change the brief

**1. The owner changed five weeks ago, and NORBIN's own website has not caught up.**
On **1 July 2026** BASF Coatings completed its carve-out from BASF SE and relaunched as **Surventis**
(majority Carlyle + Qatar Investment Authority, BASF retaining ~40%). `[F]` Surventis lists NORBIN in
its own refinish brand portfolio today. `[F]` Meanwhile `norbin-paint.com` still carries
*"© BASF Coatings GmbH 2026. NORBIN® is a registered Trademark of BASF Coatings GmbH"* `[F]`, and every
piece of NORBIN packaging and literature reads *"A brand of BASF – We create chemistry"*. `[F]`
**Our page must not state a single flat owner.** See §2 for the exact wording that is safe.

**2. In our region NORBIN is an auxiliary range, not a paint system — and our current page says the
opposite.** In EMEA the range is 13 products: clears, primer fillers, plastic primer, body filler,
hardeners, thinner, silicone cleaner. **There is no basecoat, no topcoat, no colour, no mixing
system.** `[F]` In China the same brand *is* a full system (25-series basecoat with 55 tinters,
26-series topcoat with 23 tinters). `[F]` Our repository currently describes NORBIN as a
*"Program boja, lakova i pratećih materijala"* (`lib/carsystem-data.ts:417`) — **"boja" is factually
wrong for our market.**

**3. The brand's own graphic device is a mixing metaphor, and the product range is literally about
mixing ratios.** NORBIN's mark is a wave of three strokes — yellow, blue, green — and its hero
artwork enlarges that wave into two crossing ribbons where blue over yellow produces green. `[F]`
Every EMEA clear and filler is defined by a ratio to a hardener (2:1, 3:1, 4:1, 5:1, 5:1:1). `[F]`
This is the strongest and most honest concept available to us. `[I]`

**4. The "neon" NORBIN palette in the brochure PDF is a colour-conversion artefact.** Three
independent official sources — the logo SVG we already hold, the May-2024 range photograph on
norbin-paint.com, and our own physical packshot of a real 1 L can — agree on a **muted** palette
(blue ≈ `#0082BB`, gold ≈ `#EBB700`, olive-green ≈ `#739600`). The brochure PDF's embedded PNG shows
fluorescent cyan/lime/magenta and is the lone outlier. `[F]` evidence in §7.3. **Anyone sampling the
brochure would build the page in the wrong colours.**

**5. NORBIN's own site is unusable on a phone, and has no product pages at all.** No product page, no
product photography, no search, no responsive hero — on mobile the H1 lands unreadably on top of the
banner. `[F]` The bar we have to clear is low; the opportunity is that a *correct, fast, Serbian,
mobile-first* NORBIN page would be better than anything the brand owner publishes anywhere. `[I]`

---

> **PHASE 1.5 UPDATE (2026-08-09).** Finding 2 above stands. But the sentence *"our own stock list is
> the only reference for what is actually buyable here"* was acted on only after this document was
> written: the company's ERP stock report was located and reconciled in
> `NORBIN_PRODUCT_INVENTORY.md` §10–14. **We carry 8 of the 13 EMEA products, not 1.** Any statement
> in this document about the size of our programme should be read against Inventory §11.


## 2. Ownership, corporate context and safe wording

### 2.1 The current position

| Question | Answer | Tag |
| --- | --- | --- |
| Who owns the NORBIN brand today? | **Surventis** — the former BASF Coatings business, independent since 1 July 2026 | `[F]` |
| Who holds the registered trademark, per the brand's own site? | *"NORBIN® is a registered Trademark of BASF Coatings GmbH"*, footer, accessed 2026-08-09 | `[F]` |
| Who does the packaging say? | *"A brand of BASF – We create chemistry"* on every can and both brochures | `[F]` |
| Ownership of Surventis | Carlyle funds + Qatar Investment Authority majority; BASF retains ~40% | `[F]` |
| Where NORBIN sits in the portfolio | Below Glasurit, R-M and baslac; alongside LIMCO (Americas), Yindi/SHANCAI (China only) | `[F]` |

Surventis' own description of the brand, verbatim and current:

> "NORBIN — Complete range of automotive refinishing products for good quality jobs." `[C]`
> — surventiscoatings.com/refinish, accessed 2026-08-09

For comparison, from the same page on the same day: `[C]`

- Glasurit® — *"World-class automotive coatings refinish system, with over 130 years…"*
- R-M® — *"The caring business partner with high color competence…"*
- baslac® — *"Easy to use paint portfolio, high color competence and strong online support…"*
- LIMCO® — *"Cost-effective great quality paint solutions… (available in US, Canada, Latin America)"*

**Read the hierarchy in the adjectives.** `[I]` Glasurit gets "world-class", R-M gets "color
competence", baslac gets "easy to use… color competence", NORBIN gets **"good quality jobs"**. NORBIN
is the only brand in the list whose sentence contains no superlative and no colour claim. That is
deliberate positioning, not sloppy copywriting, and it tells us exactly how much we are allowed to
promise.

### 2.2 Wording we may and may not use

Under the brand-safety rule in `CLAUDE.md`, and given a five-week-old ownership change that the
brand's own materials have not absorbed:

**Safe `[D]`**

- „NORBIN je brend iz Surventis refinish porodice (ranije BASF Coatings)."
- „Na ambalaži i u zvaničnoj literaturi NORBIN i danas nosi oznaku *A brand of BASF*."
- „Pomoćni program" / „auxiliary program" / „prateći materijali".
- „Brend vrednosnog segmenta" — supported by Surventis' own comparative phrasing.

**Must not be used without a written confirmation from the owner `[D]`**

- „zvanični distributer", „ovlašćeni zastupnik", „ekskluzivni partner" — nothing in any source
  establishes our status.
- „BASF brend" **stated flatly and alone** — this was true until 30 June 2026 and is now, at best,
  incomplete.
- Any statement that NORBIN includes colours, basecoats or a mixing system **in our market**.
- „vrhunski", „revolucionarni", „najbolji" — the owner does not claim these for NORBIN, and claiming
  more than the manufacturer does is exactly the trap.

### 2.3 Correction to prior repository work

`docs/seo/NORBIN_ACQUISITION_REPORT.md` §1 concludes *"NORBIN je BASF-ov brend vrednosnog segmenta, uz
Glasurit, R-M i baslac."* That was correct on its date (2026-08-08) as a reading of the sources it
cites, but the corporate change of 1 July 2026 was not in scope of that pass. **The *segment* half of
that sentence survives; the *owner* half needs the Surventis qualifier.** No file has been edited in
this phase — this is recorded here for Phase 2.

`data/knowledge/brand-sources.ts:46` cites a 2021 Middle-East portfolio PDF at
`cxportal.basf.com`. **That host no longer resolves in DNS** (checked 2026-08-09). `[F]` The reference
is dead and should be replaced in Phase 2.

---

## 3. Brand history and meaning

| Fact | Detail | Tag |
| --- | --- | --- |
| Launched | 2015, first in China, then Asia-Pacific | `[F]` |
| North America | US and Canada, announced 28 March 2016 | `[F]` |
| Name origin | From two Chinese characters (诺缤) translating as **"promise of colour"** | `[C]` |
| Original technology framing | Primers and clears, urethane technology | `[F]` |
| Segment at launch | *"designed for the economy segment"* — Amy Kramer, BASF Inside Sales Manager | `[C]` |
| | *"Customers will benefit from Norbin's consistent quality and its competitive price"* — Gordon Erdelean, BASF Market Segment Manager | `[C]` |
| Chinese name | 诺缤 (Nuò bīn) | `[F]` |

**The name is worth knowing but must be handled carefully.** `[I]` "Promise of colour" is charming and
would make a tempting headline — but in EMEA **NORBIN sells no colour at all**. Using the name's
origin as our headline would create exactly the misunderstanding §1.2 warns about. It belongs in a
small "brand origin" note, not in the hero. `[D]`

---

## 4. What NORBIN is — a precise statement

### 4.1 The EMEA definition

> **`[F]` + `[I]`** NORBIN is the entry tier of the Surventis (ex-BASF Coatings) refinish portfolio.
> In EMEA it is a deliberately short, closed range of **13 auxiliary products** — clearcoats, primer
> fillers, a plastic primer, a body filler, four hardeners, a thinner and a silicone cleaner —
> designed so that a bodyshop can complete an economy-grade repair using industrial-scale chemistry at
> a controlled cost. It does not supply colour, does not require a mixing bank, and is not sold as a
> competitor to a full colour system. It is what you use *around* a colour system.

Supporting evidence:

- *"NORBIN®'s lean range of auxiliaries is designed to enable our customers to be competitive and
  profitable through an optimized price performance ratio."* `[C]` — norbin-paint.com/en, 2026-08-09
- *"The NORBIN® brand in EMEA includes quality clearcoats, primers and other auxiliaries formulated to
  deliver consistent quality and performance, each and every time."* `[C]` — 2024 brochure, p.2
- *"Our offer may differ from country to country due to local market requirements and legislation."*
  `[F]` — repeated on the site and in the brochure. This sentence is the brand's own warning that the
  EMEA list is not a promise of local availability, and we must repeat that logic on our page. `[D]`

### 4.2 What NORBIN emphasises

From the 2024 brochure and the current site, the recurring pillars are three, and only three: `[C]`

1. **High product quality & easy to use** — *"a standard process that is easy to apply"*, *"stringent
   production discipline"*.
2. **Enabler for your business** — *"enables every customer in the refinish market to use BASF
   products"*, *"an optimized price / performance ratio enables customers' profitability"*.
3. **Competitiveness** — the word "competitive"/"competitiveness" appears four times in a
   three-page brochure.

Verbatim tagline: **"Refinish a winner with NORBIN®"** (brochure) / **"Refinish a winner with BASF"**
(homepage). `[F]`

### 4.3 What NORBIN deliberately does *not* claim

`[I]`, derived by absence across every official source we read:

- No OEM approvals claim. (Glasurit and R-M make this claim loudly on the same corporate site.)
- No colour accuracy or colour-competence claim in EMEA.
- No sustainability, VOC-leadership or eco claim — VOC figures appear as regulatory disclosure only.
- No training, digital tool, Refinity or bodyshop-management claim.
- No warranty or durability claim.
- No "premium" or "professional-grade" superlative anywhere.

**This absence is the brand.** `[I]` NORBIN's honesty about being an unglamorous, competent,
cost-controlled range is its most distinctive asset, and a page that tries to inflate it will read as
false to any experienced painter.

### 4.4 Tone of voice

`[F]` observed characteristics: short declaratives; plain business vocabulary (*productivity,
profitability, competitiveness, retention*); no adjectives of delight; heavy repetition of "consistent"
and "easy"; the customer's *business* is the subject far more often than the *paint*.

**Serbian equivalent register `[D]`:** flat, professional, workshop-plain. No lyricism. Sentences a
foreman would say. This is the opposite of the register used on our R-M and Cosmos pages, which is a
useful separation.

---

## 5. Geography — and the gap that concerns us directly

`[F]` Region probe of `norbin-paint.com/{region}/norbin-range.html`, all re-verified 2026-08-09:

| Region | Published | TDS links | MSDS links | Note |
| --- | --- | ---: | ---: | --- |
| `en` (EMEA) | **yes** | 8 | 17 | Reference source for our market |
| `tr` (Türkiye) | **yes** | 19 | 50 | Much larger local range — 30 distinct codes |
| `kz` (Kazakhstan) | **yes** | 1 | 4 | Russian-language documents |
| `zh-hans` (China) | **yes** | 0 | 0 | Full colour system; one leaflet only |
| `me` (Montenegro) | **no** | 0 | 0 | Placeholder page, literal marker `Inhalte ME` |
| `de` (Germany) | **no** | 0 | 0 | Placeholder, `Inhalte DE` |
| `pl` (Poland) | **no** | 0 | 0 | Placeholder, `Inhalte PL` |
| `rs`, `hr`, `ba` | **do not exist** | 0 | 0 | Return the CMS default shell, not a real page |

**There is no Serbian, Croatian, Bosnian or Montenegrin NORBIN source in existence.** `[F]` The nearest
regional site — Montenegro — has been an unfinished German-language placeholder for years. `[I]`

**What follows for us `[D]`:** the EMEA (`en`) range is the only defensible reference for what NORBIN
*is* in our region, and **our own stock list is the only reference for what is actually buyable here.**
These two must be presented as two distinct layers on the page and never merged. It also means our
page would become, on publication, the most substantial NORBIN resource in the Serbian language — an
AEO/GEO opportunity noted in the blueprint.

---

## 6. Category and competitive notes (deliberately brief)

`[I]` Observed clichés in this category — refinish auxiliary and value-tier brands, plus the sibling
BASF/Surventis brands:

| Cliché | Who does it | Why we avoid it |
| --- | --- | --- |
| Dark hero + spray gun + moody workshop | R-M, most refinish brands, **and our own R-M page** | Already used on our site; NORBIN's own identity is white |
| Big glossy car panel with a light streak | Glasurit, baslac | Implies premium finish claims NORBIN does not make |
| Wall-to-wall product-card grid | Almost every distributor site | 13 products do not need a grid; they need relationships |
| "Complete system for professionals" opener | Carsystem, baslac and R-M pages on our site | Three of our own pages already open this way |
| Glassmorphism / neon technical HUD | Generic 2020s SaaS look | Nothing in NORBIN supports it |
| Fluorescent gradient bands | Would come from misreading the brochure PDF | Factually the wrong colours — see §7.3 |

**The category's real content gap `[I]`:** value-tier brands publish price positioning and a product
list, and almost never publish *how the products go together*. NORBIN's TDS files contain 21
manufacturer-declared product-to-hardener relationships with explicit ratios, and its own site shows
none of them. That is the substance nobody in the category is presenting.

---

## 7. Visual identity — evidence-led

### 7.1 The mark

`[F]` The official logo file is `https://www.norbin-paint.com/images/logo.svg`, 13 982 bytes,
`Last-Modified: Mon, 13 Nov 2023`. **Our repository already holds this exact file, byte-identical, at
`public/brands/norbin.svg` (13 982 bytes).** Provenance is therefore certain, not assumed.

Structure of the mark, top to bottom:

1. **Wordmark** `NORBIN` — heavy grotesque, all caps, tight tracking, flat-cut terminals.
2. **The wave** — three separate tapering strokes: gold at the left, blue sweeping through the centre
   and dominating, olive-green at the right. Read left to right they overlap in sequence like a
   brushed liquid.
3. **Strapline** — *"A brand of / BASF – We create chemistry"*, two lines, small, grey.

`[F]` The SVG is Adobe Illustrator output with the German layer name `Ebene_1` — consistent with the
Münster (BASF Coatings GmbH) origin recorded in the brochure imprint.

**Two official wordmark colourways exist `[F]`:**

| Where | Wordmark colour | Measured from |
| --- | --- | --- |
| Logo SVG / website header | `#4D5357` warm grey | SVG `.st3` fill |
| Physical can labels | `#204552` dark slate-navy | Brochure packshot, sampled |

Neither is black. `[I]` A pure-black NORBIN wordmark would be wrong in both directions.

### 7.2 The wave is the brand's graphic DNA

`[F]` The homepage banner `images/norbin-index-banner-1920-v1.jpg` (1920×1080, 631 KB) takes the small
wave from the mark and **enlarges it to full-bleed scale as the page's structural device**:

- the field is **white**, roughly 40 % of the frame;
- a **blue ribbon** sweeps in from the left and rises to the top right;
- a **yellow ribbon** sweeps in from the bottom left and rises to the right;
- where they cross, a **green wedge** appears — as if the two were translucent and mixed;
- the **photograph is clipped into the wedge** the ribbons leave behind. It is not a rectangle.

`[I]` **This is a mixing metaphor rendered as geometry.** Two components crossing produce a third.
That is what the wave means, and it is also what every NORBIN clear and filler literally does with its
hardener. Nothing else in the identity carries this much meaning.

`[F]` A second, related treatment appears on the **packaging**: the same idea drawn with **straight,
hard-edged diagonal bands** rather than curved ribbons, rising bottom-left to top-right, with the
overlaps producing intermediate colours. Two dialects of one system — curved for communication,
straight for packaging.

### 7.3 Colour — and the artefact that would have misled us

Four independent measurements of the *same* artwork:

| Source | Blue | Yellow / gold | Green | Hardener accent | Wordmark |
| --- | --- | --- | --- | --- | --- |
| **Official logo SVG** (`public/brands/norbin.svg`) `[F]` | `#0082BB` | `#EBB700` | `#739600` | — | `#4D5357` |
| **Our packshot of a real 1 L can** (`public/products/norbin/norbin-n15-020-1l.jpg`, 1920×1920) `[F]` | `#0080CB` | `#DFB000` | `#7F9600` | — | navy, in shadow |
| **Official range photo** `gamme_NORBIN-mai-2024.jpg` `[F]` | `#2BB7EC` | `#FBD848` | `#CAD866` | `#C23557` | — |
| **Official web banner** `norbin-index-banner-1920-v1.jpg` `[F]` | `#25AAE3` | `#FFD105` | `#258B03` | — | — |
| **Brochure PDF embedded PNG** (2024) `[F]` | `#36FEFF` | `#FFDE00` | `#BBFF24` | `#FF0B7F` | `#204552` |

**Conclusion `[I]`, high confidence:** the brochure PNG is the single outlier, its values are
out-of-gamut neon, and it is embedded in a print PDF. It is an untagged CMYK→RGB conversion artefact.
The **logo SVG and the photograph of the physical can agree to within a few points of each other** —
two independent media, one measured off a real object. That agreement is the strongest evidence
available and it settles the question.

**Working palette for our page `[D]`. Labels are honest about provenance:**

| Token | Value | Status | Notes |
| --- | --- | --- | --- |
| NORBIN blue | `#0082BB` | **official value** — from the official logo file | Already our brand accent in `lib/carsystem-data.ts:426` — correct, keep it |
| NORBIN gold | `#EBB700` | **official value** — logo file | Fill only, never text |
| NORBIN green | `#739600` | **official value** — logo file | Fill only at small sizes |
| Ink | `#204552` | **sampled working value** — packaging wordmark | Body/heading ink |
| Hardener accent | `#C23557` | **sampled working value** — official range photo | Used by NORBIN *only* on hardeners |
| Screen-bright blue | `#25AAE3` | **sampled working value** — official banner | Large graphic ribbons only |
| Site lime | `#CBDB2A` | **read exactly from the official site's CSS**, but it is website chrome — *not* a published brand specification | **Do not use** — see §7.5 |

**NORBIN publishes no brand guidelines and no Pantone/HEX specification.** `UNVERIFIED` — repeated
searching found no public NORBIN or BASF/Surventis brand manual. Every value above is either read out
of an official *file* or sampled from an official *image*, and is labelled accordingly. **We must not
present any of these as a corporate specification.**

### 7.4 Colour coding is real, and it is narrow

`[F]` Across the official range artwork, the **crimson/magenta band appears on four products and only
four**: `N75-020` Hardener Fast, `N75-021` Hardener Normal, `N75-022` Hardener Slow, `N75-V21` Clear
Hardener VOC. Every other product — clears, primer fillers, plastic primer, body filler, thinner,
silicone cleaner — carries only blue / gold / green.

`[I]` **Red means hardener.** This is the one genuine colour code in the NORBIN system, it is
manufacturer-applied, and it maps perfectly onto the mixing-ratio story. It should be the only
semantic colour on our page.

`UNVERIFIED`: whether blue, gold and green carry any per-family meaning. We could find no pattern —
the same three appear on clears, primers and cleaner alike. **We must not invent one.**

### 7.5 Why the site's lime green is excluded

`[F]` The live norbin-paint.com navigation bar is `rgb(203, 219, 42)` = `#CBDB2A`. It is prominent and
it would be tempting to treat as a brand colour.

Two reasons to refuse it `[D]`:

1. It appears **only** in website chrome — never on packaging, never in the logo, never in the
   brochure. It is a web-template decision, not brand identity.
2. **baslac already owns lime green on our own site** (`BaslacBrandPage`, primary CTA). Two BASF/Surventis
   sibling brands sharing a lime accent on adjacent pages of *our* site would be a real usability
   failure, not a cosmetic one.

### 7.6 Typography

`[F]` The live site's computed `font-family` on every element is:

```
"Helvetica Neue LT W06 55 Roman", Arial, SimHei, 黑体, "Heiti SC", …, sans-serif
```

So the official web typeface is **Helvetica Neue LT 55 Roman**, licensed as a W06 webfont. The
packaging wordmark and label text are consistent with the same family at Bold/Black weight. `[I]`

**Recommendation `[D]`: do not license or import Helvetica Neue.** Our stack already loads Archivo
(`--font-display`), IBM Plex Sans (`--font-body`) and IBM Plex Mono (`--font-technical`). The visual
properties that matter here are: neutral grotesque, closed apertures, horizontal terminals, no
personality in the letterforms, and a **large weight jump between product name and product code**.
Archivo at 700–800 for display and IBM Plex Sans for body reproduce that character without a new
network request. IBM Plex Mono is the right home for the `N15-020` codes.

**The typographic signature of NORBIN is a hierarchy, not a typeface `[F]`:** on every label the
product *name* is set small and bold, and the product *code* is set **larger than the name**. NORBIN
identifies its products by code first. Reproducing that inversion is worth more than matching the
font.

### 7.7 Photography

`[F]` NORBIN publishes exactly **two** photographic assets in EMEA:

1. A workshop photograph — a painter in a navy fleece inspecting/wiping the shoulder of a black car,
   shallow depth of field, warm interior lighting, real (slightly cluttered) bodyshop behind. Appears
   in the brochure cover and, clipped by the ribbons, in the homepage banner.
2. A white-background group packshot of the whole range.

That is the entire library. `[F]` There is no application photography, no sanding, no spraying, no
detail macro, no per-product packshot. See `NORBIN_ASSET_GAP.md`.

---

## 8. Mobile and usability audit of the official site

`[F]` Rendered at 375×812 (2026-08-09):

- The banner slider does not scale — it keeps a fixed pixel width and is cropped arbitrarily.
- The `<h1>` "A complete and easy-to-use range" renders in **grey, at large size, directly on top of
  the busy packshot image**, with no scrim. It is effectively unreadable.
- ~350 px of empty white sits between the nav and the hero.
- The document lists are long unstyled link runs with no grouping by product.
- No `robots.txt`, no `sitemap.xml`, no product pages, no search.

`[I]` NORBIN has no meaningful digital presence to defend or to imitate. Our page has no incumbent to
compete with — only a standard to set.

---

## 9. Answers to the twenty questions in the brief

| # | Question | Answer | Where |
| --- | --- | --- | --- |
| 1 | What is NORBIN? | Entry-tier refinish brand; in EMEA an auxiliary-only range of 13 products | §4.1 |
| 2 | Who owns it / portfolio position? | Surventis since 1 Jul 2026 (ex-BASF Coatings); below Glasurit, R-M, baslac | §2 |
| 3 | Who is it for? | Bodyshops doing cost-controlled, economy-grade repairs | §4 |
| 4 | Current relevant range? | 13 EMEA codes, brochure May 2024, confirmed live today | Inventory §2 |
| 5 | Which exist in our repository? | 3 records → 1 distinct code (2 published). **Our ERP carries 12 articles / 10 codes** | Inventory §3, §11 |
| 6 | Which do we actually sell? | **8 of the 13 EMEA codes** — every clearcoat, every hardener serving them, and the thinner | Inventory §11, §14.2 |
| 7 | Which local codes may be legacy? | **One:** `N55-V15` is in our ERP at zero stock and is withdrawn from EMEA | Inventory §4.2, §11 |
| 8 | Which products work together? | 21 declared relationships, 5 ratio families | Inventory §5 |
| 9 | What technical data do we have? | 301 provenance-checked claims across 24 TDS | Inventory §6 |
| 10 | Which documents are available? | 8 EMEA TDS, 17 EMEA SDS, 1 brochure, 1 poster, +TR/KZ | Inventory §7 |
| 11 | Authentic visual language? | White field, enlarged crossing wave, code-led typography | §7 |
| 12 | Genuinely associated colours? | `#0082BB` / `#EBB700` / `#739600`; red = hardener | §7.3–7.4 |
| 13 | Which assets are usable now? | 4 | Asset gap §2 |
| 14 | Which are missing? | 3 P0, 4 P1, 3 P2 | Asset gap §4 |
| 15 | What to photograph locally? | 6 shots | Asset gap §5 |
| 16 | What should the page communicate? | "A short, closed range that works by ratio" | Blueprint §2 |
| 17 | How should it differ from our others? | Only white-dominant page; only one built on ratios | Blueprint §4 |
| 18 | What is in each section? | 9 sections | Blueprint §7 |
| 19 | Desktop vs mobile? | Full spec | Blueprint §11 |
| 20 | What can be built without guessing? | Everything except 3 P0 assets | Asset gap §4 |

---

## 10. Source register

| # | Source | Organisation | URL / path | Date / version | Used for | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | NORBIN EMEA product range page | Surventis / BASF Coatings | `https://www.norbin-paint.com/en/norbin-range.html` | accessed 2026-08-09 | Live range, document links, trademark footer | High |
| S2 | NORBIN EMEA homepage | as above | `https://www.norbin-paint.com/en` | accessed 2026-08-09 | Positioning copy, banner asset, typeface | High |
| S3 | "Refinish a winner with NORBIN®" brochure | BASF Coatings GmbH | `files/NORBIN_Broch_EN_2024_mai.pdf`; local copy `assets/manufacturer/norbin/documents/` | May 2024 | The 13-product EMEA range; three brand pillars; group packshot | High |
| S4 | Grey shade technical poster | BASF Coatings GmbH | `files/NORBIN_A3-Sheet_Tech-Info_Grey-Shades_230221b_druck.pdf` | rev. 230221b | N55-V20/N55-V29 undercoat mixing | High |
| S5 | NORBIN official logo | BASF Coatings GmbH | `https://www.norbin-paint.com/images/logo.svg`; identical local copy `public/brands/norbin.svg` | 2023-11-13 | Wordmark, wave, official colour values | High |
| S6 | Homepage banner image | as above | `images/norbin-index-banner-1920-v1.jpg` | 2023-11-13 | Ribbon geometry, screen palette, workshop photo | High |
| S7 | Range photograph | as above | `images/gamme_NORBIN-mai-2024.jpg` | May 2024 | Label artwork colours, hardener red coding | High |
| S8 | NORBIN China range page | as above | `/zh-hans/norbin-range.html` | accessed 2026-08-09 | Proof that the China range is a full colour system | High |
| S9 | Regional page probe (10 locales) | as above | `/{locale}/norbin-range.html` | accessed 2026-08-09 | No Serbian/Balkan source exists | High |
| S10 | Surventis refinish brand portfolio | Surventis | `https://www.surventiscoatings.com/refinish` | accessed 2026-08-09 | Current ownership; verbatim brand positioning lines | High |
| S11 | Surventis carve-out coverage | Repairer Driven News / PCI / Autobody News / Autosphere | multiple, July 2026 | 1 Jul 2026 | Date, Carlyle/QIA/BASF structure | High (multi-source) |
| S12 | BASF US NORBIN brand page | BASF Refinish US | `https://refinish.basf.us/brands/norbin/` | accessed 2026-08-09 | "value for money segment"; name origin | Medium — Americas scope, not EMEA |
| S13 | "BASF launches Norbin brand in the US and Canada" | BASF, via PR Newswire | prnewswire.com/…/300241905.html | 28 Mar 2016 | Launch dates, executive quotes, segment | High (primary release) |
| S14 | NORBIN technical data sheets (24) | BASF Coatings GmbH | `assets/manufacturer/norbin/documents/TDS__*` | 2022 / MPV 4.0–4.1 | All technical values and product relationships | High |
| S15 | Repository product data | this project | `lib/carsystem-data.ts:412-429, 1131, 2187, 2208` | working tree, 2026-08-09 | Our 3 local records, current accent colour | High |
| S16 | Repository knowledge base | this project | `data/knowledge/norbin-*.generated.json` | generated 2026-08-08 | Catalogue, documents, 301 claims, match set | High, with defects listed in Inventory §8 |
| S17 | Prior acquisition report | this project | `docs/seo/NORBIN_ACQUISITION_REPORT.md` | 2026-08-08 | Pipeline history; superseded on ownership | Medium — see §2.3 |
| S18 | BASF Middle East NORBIN portfolio 2021 | BASF | `cxportal.basf.com/dam/…Norbin-Product-Portfolio_2021.pdf` | 2021 | **Not retrievable — host does not resolve** | Dead link |

---

## 11. Deltas against the 2026-08-08 acquisition report

Recorded so Phase 2 does not re-derive them.

| Item | Report said | Verified today | Action for Phase 2 |
| --- | --- | --- | --- |
| Brand owner | "BASF-ov brend" | Surventis since 1 Jul 2026; trademark line still names BASF Coatings GmbH | Qualify the wording; do not restate flatly |
| EMEA TDS count | 7 | **8** — `N55-V20 2K Primer Filler grey` was missed | Re-run acquisition; see Inventory §8.1 |
| Region switcher | `en/me/de/pl/tr/kz` | Now **EMEA / USA / 中国** at top level; `tr`/`kz` still reachable from the locale menu | Update the region model |
| Product images at source | "0" | Still 0 *per product*, but **2 usable group/hero images exist** and were not inventoried | Register them — Asset gap §2 |
| `cxportal.basf.com` portfolio PDF | cited as a source | Host does not resolve | Remove the dead reference |
| `N55-V15` | listed as `unlinked-in-source` | Confirmed: the **only** two commented-out items in the EMEA page, both `N55-V15` | Classify `LEGACY_OFFICIAL` |
