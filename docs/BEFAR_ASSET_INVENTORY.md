# BEFAR — Media Asset Inventory

Research phase document. Companion to `BEFAR_BRAND_RESEARCH.md`. Nothing downloaded into the repo.

**Surveyed 2026-08-09.** Every asset below was resolved to its **true original pixel dimensions** by
fetching the file and reading the image header — not by trusting the rendered `srcset`.

| Source | Assets found | ≥3000 px wide | 2000–2999 px | 1200–1999 px | 800–1199 px | <800 px |
|---|---|---|---|---|---|---|
| `befar.com.tr` (Wix) | 172 | 136 | 17 | 4 | 3 | 12 |
| `nargildisticaret.com` (export) | 111 | 11 | 11 | 0 | 74 | 6 + 9 unresolved |
| `befar.com.tr` catalogue PDF | 48 pages | — | — | — | — | A4 vector + raster |
| `nargildisticaret.com` brand video | 1 | — | — | 1280 × 720 | — | — |
| **Total distinct assets** | **~330** | | | | | |

**Headline:** the asset situation is far better than their website suggests. **153 of 172** images on
the Wix site are 2000 px or wider, and 136 are 3000 px+. Several are full-resolution camera files
(6720 × 4480, 5472 × 3648, 4608 × 3072) that were uploaded raw and are being served scaled down. This is
a genuinely usable photographic library.

---

## 1. Base URL patterns

```
Wix original:      https://static.wixstatic.com/media/<asset-id>
Wix resized:       https://static.wixstatic.com/media/<asset-id>/v1/fill/w_<W>,h_<H>,al_c,q_80/file.jpg
Export site:       https://www.nargildisticaret.com/<path>      (note: TLS certificate does not
                                                                 validate — use with care)
Catalogue PDF:     https://www.befar.com.tr/_files/ugd/446a5e_9192e551cfa540ae95f10c5247f2587b.pdf
Brand video:       https://www.nargildisticaret.com/video/befar.mp4   (10.7 MB)
Legacy Befar logo: http://web.archive.org/web/20240109132828if_/http://carsystemirm.com/wp-content/uploads/2020/10/befar-logo-removebg-preview.png
```

---

## 2. ASSETS WORTH SAVING

### 2.1 Tier 1 — hero-grade (use full-bleed on desktop)

| Asset | Subject | Resolution | Notes |
|---|---|---|---|
| `446a5e_c00b4561c1584992a8a6c270719a5615~mv2.jpg` | Red car, headlight assembly, blue-gloved hands working | **6720 × 4480** | The single best photograph Befar owns. Real work, real hands, brand-red car. Sharp, well-lit. |
| `446a5e_db3d48234c064a4698310e57581215ee~mv2.jpg` | Homepage hero variant | 6720 × 4480 | Same shoot. |
| `446a5e_6999bc0afab54daaa02be22228118cab~mv2.jpg` | Contact/homepage hero variant | 6720 × 4480 | Same shoot. |
| `446a5e_a92f393de1384f81a8f1e6a944ac7b11~mv2.jpg` | Leo Nano Paint Protector bottle, black bg, purple sphere | 3194 × 3992 | Best studio still-life on the site. Premium register. |
| ~~`446a5e_ccd627c7ed6a4c66b8112adddffd8411~mv2.png`~~ | **Phase 1 correction:** on inspection this is a near-black frame with a few faint red specks, not a usable Opencell hero. Downgraded to atmosphere/texture only. | 4021 × 3193 | **Rejected** in Phase 1 selection. |
| `446a5e_3ec856ee6b3e4d34b946ab7edc5d6c12~mv2.jpg` | Pads on black with reflection | 2240 × 2240 | Square, good for a feature tile. |
| `446a5e_7a9ffcd1c0ab4ff6a0954ac804abbcaa~mv2.jpg` | Opencell banner, black + green/red/yellow | 1920 × 657 | Wide, but only 1920 — banner width only. |
| `446a5e_2ef0a58056c6476a9626505639bb1d72~mv2.jpg` | Red car body with polish swirls | 3000 × 1250 | Excellent "before correction" texture shot. |

### 2.2 Tier 2 — product packshots (consistent set, high resolution)

Approximately **120 images at 4608 × 3072**, shot on a white/light-grey seamless backdrop, consistent
three-quarter low angle, soft top light, short cast shadow. Grouped by product family:

| Family | Count | Resolution | Cut-out difficulty |
|---|---|---|---|
| Velcro foam pads | 38 | mostly 4608 × 3072 | Medium — background is grey-to-white gradient, not pure white |
| Applicator foam pads (M14) | 23 | 4608 × 3072 | Medium |
| Leo series | 16 | 4608 × 3072 | Medium |
| Backing / basic pads | 10 | 4608 × 3072 | Easy — high contrast black on white |
| Sanding group | 11 | 4608 × 3072 | Easy |
| Surface chemicals (boxes + bottles) | 17 | 4608 × 3072 · 2884 × 3920 | Easy — flat product, clean edges |
| Consumer / other products | 18 | 4608 × 3072 · 3000 × 2000 | Mixed |
| Sets, ceramic, new products | 20 | 4608 × 3072 | Easy |

### 2.3 Tier 3 — export-site library, keyed by article code

`nargildisticaret.com/images/urunler/<CODE>/<n>.jpg` — the only place where images are addressable by
Befar article code, which makes it the most directly useful source for a catalogue.

| Asset | Code | Resolution |
|---|---|---|
| `images/urunler/04401/04401.jpg` … `04405.jpg` | 04401–04405 | **5472 × 3648** each |
| `images/urunler/06401/0800.jpg`, `0801.jpg` | 06401 | 5472 × 3648 |
| `images/urunler/01401/0771.jpg` | 01401 microfibre | 5472 × 3648 |
| `images/urunler/12101/0773.jpg` | 12101 hand foam | 5472 × 3648 |
| `images/urunler/20101/20101_1.jpg` | 20101 elips | 5472 × 3648 |
| `images/urunler/44801/0780.jpg` | 44801 | 5472 × 3648 |
| `images/urunler/77741/0856.jpg` … `77748/0860.jpg` | `+Plus` chemicals | 3648 × 5472 (portrait) |
| `images/urunler/04501/04501.jpg` … `04505.jpg` | 04501–04505 waffle | 4768–4814 × 2690–3083 |
| ~74 further files | various | 800 × ~800 — thumbnail only |

### 2.4 Brand marks & claim badges

| Asset | What | Resolution | Note |
|---|---|---|---|
| Catalogue p.47 | **Official sub-brand lockup sheet**: `befar`, `opencell`, `befar +Plus`, `Leo`, `turQuaz` | A4 vector | The most valuable single page. Use as the authority for all logo forms. |
| `446a5e_b8e19247e5d748618cc5b733c663b15a~mv2.png` | "20" anniversary badge, dark | 1192 × 738 | 20 years → consistent with 2002 founding. |
| `446a5e_e88acd659f8042efb4364167d62fa4d7~mv2.png` | "50 ülke" (50 countries) badge | 2481 × 1537 | Conflicts with the catalogue's "54 country" badge. |
| `446a5e_8b4bb903ef8545f2824d06f4e74ecfec~mv2.png` | **Full `befar` lockup** — face icon + wordmark + ®, white on red, **RGBA** | 635 × 192 | **Phase 1 correction:** Phase 0 described this as a cropped "bef" wordmark. That was wrong — the crop was in my preview, not in the file. This is the complete lockup and the **largest official Befar logo raster found anywhere**. Now local. |
| `befar-logo-removebg-preview.png` (Wayback, ex-Carsystem WP) | `befar` red wordmark + face icon, transparent | 300 × 360 | Currently the **only** transparent Befar logo we have. Too small for print/hero. |
| `images/befar_plus_logo.png` (export site) | `befar +Plus` lockup | small | |
| `public/brands/befar.svg` (our repo) | **Placeholder only** — grey rounded rect + "BEFAR" in Arial | vector | Not the real logo. Must be replaced. |

### 2.5 Sector / industry imagery (export site)

All five are deliberately **red** objects — a crude but real brand device.

| Asset | Sector | Resolution |
|---|---|---|
| `images/befar/otomobil-1-686x457.jpg` | Automotive (red car) | 686 × 457 |
| `images/befar/dnm-9-686x457.jpg` | Rail (red high-speed train) | 686 × 457 |
| `images/befar/ucak-11-686x457.jpg` | Aviation (red business jet) | 686 × 457 |
| `images/befar/gemi.jpg` | Marine (red superyacht) | small |
| `images/befar/eb11ecd49881d667498ae9f9a2b73c50-686x457.jpg` | Furniture (red kitchen) | 686 × 457 |
| `images/befar/0013-2000x1333.jpg`, `0014-2000x1333.jpg` | Product close-ups | 2000 × 1333 |

**Verdict:** the *idea* is reusable, the *files* are not — 686 px and almost certainly licensed stock,
not Befar's own photography.

### 2.6 Video

| Asset | Spec | Verdict |
|---|---|---|
| `nargildisticaret.com/video/befar.mp4` | H.264, **1280 × 720**, 25 fps, 42.9 s, 2.0 Mbps, 10.7 MB | Genuine workshop footage: rotary polisher on a car bonnet, several angles, gloved hands. **But a heavy red duotone is baked into the file** — the colour cannot be recovered. 720p is below what a full-bleed desktop hero needs. Usable only as a small, deliberately-stylised texture panel, or as reference for reshooting. |

---

## 3. ASSETS TOO LOW QUALITY

| Asset | Resolution | Problem |
|---|---|---|
| `befar-logo-removebg-preview.png` | 300 × 360 | Only transparent logo available; unusable above ~150 px. Background removal is also imperfect. |
| ~~`446a5e_8b4bb903ef8545f2824d06f4e74ecfec~mv2.png`~~ | 635 × 192 | **Struck in Phase 1 — this entry was wrong.** It is the full logo lockup, not a crop, and it is now the selected brand mark. See §2.4. |
| `446a5e_1372683cec0f43b9bf363ade64ffe65e~mv2.jpg`, `446a5e_e384c39db7204880b192a09829374391~mv2.jpg` | 520 × 520 | Homepage feature tiles — includes the only "person holding a Leo set" shot. Too small. |
| Facebook / Instagram glyphs | 201 × 201 | Third-party icons; we would use our own. |
| `446a5e_...~mv2.jpg` at 45 × 46, 200 × 60, 447 × 143, 449 × 143, 453 × 151, 285 × 91 | <500 px | UI fragments and logo crops. |
| `446a5e_18a0baec...`-class 750 × 680 / 1080 × 1080 diagrams | ≤1080 | Foam-profile explainer graphics (waffle/wave cross-sections). Concept worth redrawing as vector — files not reusable. |
| ~74 export-site files at 800 × 800 | 800 px | Fine for cards, not for detail views. Superseded by the Wix 4608 px set where a match exists. |
| Sector images (§2.5) | 686 × 457 | Too small; probably licensed stock. |
| `befar.mp4` | 720p, red-baked | See above. |
| Catalogue pp. 42, 47 composites | A4 | Product pads composited onto licensed supercar stock with fake drop shadows. Concept usable, files not. |

---

## 4. What we do **not** have (blockers)

| Missing | Severity | Where it would have to come from |
|---|---|---|
| Vector / high-res transparent **Befar logo** | **Blocker** | Befar directly, or Carsystem's supplier contact |
| Vector logos for `Opencell`, `+Plus`, `Leo`, `turQuaz` | **Blocker** for sub-brand UI | Befar (catalogue p.47 can be traced as a stopgap) |
| Brand guidelines / exact brand colours | High | Befar — none published |
| PNG-with-alpha packshots | High | We would have to cut out the 4608 px JPEGs ourselves |
| Factory / production-line photography | High | Befar — they claim 2500 m² but show none of it |
| Laboratory / R&D photography | High | They claim R&D emphasis with zero visual evidence |
| Trade-fair / stand photography | Medium | They have a dedicated "Fuar Müşteri Tanıma" (fair lead-capture) page but no fair photos |
| People / team photography | Medium | None found |
| Clean (untinted) workshop video | Medium | Would need reshooting |
| Technical data sheets, SDS | High | None published — see `BEFAR_PRODUCT_ARCHITECTURE.md` §8 |
| Serbian-language copy | High | Must be written by us |
| Instagram `@befar_tr` content audit | Medium | JS-gated; could not be read programmatically. `UNVERIFIED` — needs a manual look. |

---

## 5. PHASE 1 — SELECTION STATUS

Curated on 2026-08-09. Everything below was fetched from an official Befar or Nargil URL, checked for
true original resolution (never a thumbnail), de-duplicated by content hash, renamed semantically, and
resized **down only** — no upscaling anywhere.

### 5.1 Summary

| Status | Count | Notes |
|---|---|---|
| **SELECTED / DOWNLOADED (local)** | **44** | In `public/brands/befar/`, 4.1 MB total |
| **REJECTED** | ~285 | Duplicates, thumbnails, licensed stock, UI fragments, near-black frames, low-res catalogue rasters |
| **MISSING** | 5 critical | See §4 and the blueprint §18 |

Conversion policy: photographs → WebP q84 (`method=6`); logos → PNG, unresized, no re-encode of colour.
Long-edge caps: hero 2560 · macro/detail 2000–2400 · packshots 1600 · logos native.

### 5.2 Rejected, with reasons

| Rejected | Count | Reason |
|---|---|---|
| Catalogue PDF rasters | 189 | The PDF is a low-resolution print export — product photos top out at 751 × 397 and box shots at 358 × 153, far below the website versions. The whole file is unusable as an image source. |
| Export-site 800 px product library | ~74 | Superseded by the 4608–5472 px Wix versions wherever a match exists. Retained as a **code-identified reference index** only. |
| Sector tiles (car, train, jet, yacht, kitchen) | 6 | 686 × 457 and almost certainly licensed stock. Concept reusable, files not. |
| `befar.mp4` | 1 | 1280 × 720 with a red duotone baked into the file. Reference only. |
| Near-black frames (incl. `ccd627c7`) | ~4 | No usable subject. |
| UI fragments, social glyphs, logo crops < 500 px | ~12 | Not assets. |
| `automechanika` logo (`d6f5363a`, 1000 × 114) | 1 | Third-party trade-fair mark, not ours to use. *(Does confirm Befar exhibits at Automechanika — a fact, not an asset.)* |
| `interface-pad-multihole-alt` | 1 | Downloaded, then dropped: same frame as the selected shot, differing only in white balance. A concrete example of the colour-consistency problem. |
| Remaining ~130 Wix packshots | ~130 | Duplicate angles of products already covered, or products outside the planned sections. Re-selectable at any time from `BEFAR_ASSET_INVENTORY.md` §6. |

### 5.3 Logo status

The catalogue PDF was investigated specifically as a possible vector source. Result:

- The only vector layer in the entire 48-page file is a repeating page-header Form XObject containing
  the grey bars, the red angled banner and the **"Enjoy Quality…" script slogan** (1156 Bézier
  segments). Genuinely vector, and extractable — but the slogan is the one part of the identity we have
  decided *not* to build type on.
- **Page 47, the official sub-brand lockup sheet, is a single flattened 1693 × 1209 JPEG.** Each logo
  inside it is only a few hundred pixels wide.
- The cover's logo layer (`p01_Im1.png`) is an 866 × 1209 overlay in which the logo plate occupies
  roughly 63 × 24 px.

So the PDF is **not** a vector source, and its logo rasters are smaller than the website's.

| Mark | Best available | Local file | Verdict |
|---|---|---|---|
| **befar** | 635 × 192 PNG, RGBA, white on red | `/brands/befar/brand/befar-logo-white-on-red.png` | **VECTOR LOGO STILL REQUIRED** |
| **befar +Plus** | 285 × 91 PNG, background baked in | `/brands/befar/brand/befar-logo-plus-on-black.png` | **VECTOR LOGO STILL REQUIRED** |
| **Leo** | 449 × 143 PNG, white background baked in | `/brands/befar/brand/befar-logo-leo.png` | **VECTOR LOGO STILL REQUIRED** |
| **turQuaz** | 447 × 143 PNG, cyan background baked in | `/brands/befar/brand/befar-logo-turquaz.png` | **VECTOR LOGO STILL REQUIRED** |
| **Opencell** | **Nothing usable in any format** — exists only inside composite photographs and the flattened catalogue page | — | **MISSING ENTIRELY. VECTOR LOGO STILL REQUIRED.** |

No autotrace was performed, and none should be presented as an official mark.

`public/brands/befar.svg` remains the old placeholder (grey rounded rectangle, "BEFAR" set in Arial).
It was **not** modified in this phase — replacing it is a design-phase decision.

### 5.4 Selected files

| File | Group | Source | Original | Local | Size | Why selected |
|---|---|---|---|---|---|---|
| `/brands/befar/brand/befar-logo-leo.png` | brand | `wix:446a5e_cc9bf8cc9b4e4ebfa9a8fab4238979cb~mv2.png` | 449x143 | 449x143 | 14 KB | Leo lockup with dog silhouette. White background baked in. |
| `/brands/befar/brand/befar-logo-plus-on-black.png` | brand | `wix:446a5e_5ffbd5d4f50443a39170953d50336759~mv2.png` | 285x91 | 285x91 | 4 KB | befar +Plus lockup on black. |
| `/brands/befar/brand/befar-logo-turquaz.png` | brand | `wix:446a5e_f15863908c384f38b8c604de4f4bf58b~mv2.png` | 447x143 | 447x143 | 8 KB | turQuaz lockup on cyan. Background baked in. |
| `/brands/befar/brand/befar-logo-white-on-red.png` | brand | `wix:446a5e_8b4bb903ef8545f2824d06f4e74ecfec~mv2.png` | 635x192 | 635x192 | 9 KB | Master lockup, white on red plate, with (R). Largest official raster found anywhere. |
| `/brands/befar/details/befar-backing-plate-printed-label.webp` | details | `wix:446a5e_6e48a26fbb53483a913e06a344eff1fd~mv2.jpg` | 3072x4608 | 1333x2000 | 50 KB | Yellow hub with printed article code 93 - code-as-graphic evidence. |
| `/brands/befar/details/befar-hub-foam-macro.webp` | details | `wix:446a5e_141a9488a82f4e8c9f6f700562ee1360~mv2.jpg` | 4527x2933 | 2000x1296 | 104 KB | Macro of hub meeting foam. |
| `/brands/befar/details/befar-interface-pad-6hole-angled.webp` | details | `wix:446a5e_217cd432920a4fd481ae3efb774620c5~mv2.jpg` | 4726x3072 | 2000x1300 | 54 KB | Interface pad, orange edge, 6-hole pattern, angled. |
| `/brands/befar/details/befar-interface-pad-profile.webp` | details | `wix:446a5e_0a0e03afaab74cacb93b760a0af4e759~mv2.jpg` | 4038x2975 | 2000x1474 | 63 KB | Interface pad in three-quarter profile, holes visible. |
| `/brands/befar/details/befar-leo-pad-edge-print.webp` | details | `wix:446a5e_812eaafd1ea747c7ac9ae6851b7acd2e~mv2.jpg` | 4608x3072 | 2000x1333 | 71 KB | Macro of Leo pad edge and face print - the disc-as-badge idea. |
| `/brands/befar/details/befar-leo-yellow-pad-face.webp` | details | `wix:446a5e_69562690fd194fd9ae44101595e68f84~mv2.jpg` | 3266x2968 | 2000x1818 | 72 KB | Leo yellow pad, ORBITAL SYSTEM, face-on. |
| `/brands/befar/details/befar-pad-profile-stem.webp` | details | `wix:446a5e_61f95a93ab3d4cf2aa17be586c5747e6~mv2.jpg` | 3000x2052 | 2000x1368 | 53 KB | Strict side profile showing foam thickness and plate stem. |
| `/brands/befar/details/befar-pad-tilted-face.webp` | details | `wix:446a5e_c4c38dac041c4fb1ab628614f9690250~mv2.jpg` | 4608x3072 | 2000x1333 | 28 KB | Pad tilted, dark face toward camera - sculptural. |
| `/brands/befar/details/befar-velcro-hook-edge-macro.webp` | details | `wix:446a5e_1afc1c3e56b040579d7a4922a324edff~mv2.jpg` | 4171x2547 | 2000x1221 | 48 KB | Edge-on macro of the hook-and-loop face: the attachment system. |
| `/brands/befar/hardness/befar-foam-04401-white.webp` | hardness | `nargil:images/urunler/04401/04401.jpg` | 5472x3648 | 1600x1067 | 38 KB | Code 04401 WHITE - hardness 3/5 (core line). |
| `/brands/befar/hardness/befar-foam-04402-orange.webp` | hardness | `nargil:images/urunler/04401/04402.jpg` | 5472x3648 | 1600x1067 | 109 KB | Code 04402 ORANGE - hardness 5/5, hardest in the core line. |
| `/brands/befar/hardness/befar-foam-04403-black.webp` | hardness | `nargil:images/urunler/04401/04403.jpg` | 5472x3648 | 1600x1067 | 178 KB | Code 04403 BLACK - hardness 1/5, softest; polish or paint protector. |
| `/brands/befar/hardness/befar-foam-04404-yellow.webp` | hardness | `nargil:images/urunler/04401/04404.jpg` | 5472x3648 | 1600x1067 | 67 KB | Code 04404 YELLOW - hardness 3/5 (core line). |
| `/brands/befar/hardness/befar-foam-04405-blue.webp` | hardness | `nargil:images/urunler/04401/04405.jpg` | 5472x3648 | 1600x1067 | 109 KB | Code 04405 BLUE - hardness 2/5 (core line). |
| `/brands/befar/hardness/befar-pad-family-row.webp` | hardness | `wix:446a5e_a9f25644938c49f2b251eab9451f18e7~mv2.jpg` | 3152x3072 | 2000x1949 | 146 KB | Row of pads in profile - reads as a scale/rail. |
| `/brands/befar/hero/befar-leo-nano-bottle-dark.webp` | hero | `wix:446a5e_a92f393de1384f81a8f1e6a944ac7b11~mv2.jpg` | 3194x3992 | 1920x2400 | 218 KB | Leo Nano Paint Protector, black ground, purple sphere. Premium register. |
| `/brands/befar/hero/befar-opencell-stack-dark.webp` | hero | `wix:446a5e_755852fc3aef4e78821cb207efba47bf~mv2.jpg` | 1920x804 | 1920x804 | 82 KB | Opencell pads stacked on black with red light streaks. Native 1920 - no upscale. |
| `/brands/befar/hero/befar-pads-black-reflection.webp` | hero | `wix:446a5e_3ec856ee6b3e4d34b946ab7edc5d6c12~mv2.jpg` | 2240x2240 | 1800x1800 | 197 KB | Pads on black with reflection. Older product generation (red hub). |
| `/brands/befar/hero/befar-porsche-front-gloss.webp` | hero | `wix:446a5e_6999bc0afab54daaa02be22228118cab~mv2.jpg` | 6720x4480 | 2560x1707 | 232 KB | Second frame, same shoot, wider. PROVENANCE UNVERIFIED. |
| `/brands/befar/hero/befar-porsche-headlight-detail.webp` | hero | `wix:446a5e_db3d48234c064a4698310e57581215ee~mv2.jpg` | 6720x4480 | 2560x1707 | 187 KB | Best photograph on any Befar source: gloved hands, microfibre, red bodywork. PROVENANCE UNVERIFIED. |
| `/brands/befar/hero/befar-red-panel-swirls.webp` | hero | `wix:446a5e_2ef0a58056c6476a9626505639bb1d72~mv2.jpg` | 3000x1250 | 2560x1067 | 129 KB | Red panel with visible swirl marks: the "before correction" state. |
| `/brands/befar/products/befar-backing-plate-diameters.webp` | products | `wix:446a5e_974a8d58fbbf49c3beadf191dd026639~mv2.jpg` | 4608x3072 | 2000x1333 | 120 KB | Three backing-plate diameters together - supports the pairing rule. |
| `/brands/befar/products/befar-backing-plate-face.webp` | products | `wix:446a5e_5e74d5b9b1bf4e948e272bf71a22c00a~mv2.jpg` | 3072x4608 | 1333x2000 | 44 KB | Backing plate face-on. Older generation (orange/red hub). |
| `/brands/befar/products/befar-chem-75-liquid-compound.webp` | products | `wix:446a5e_8b21b77ac83c41c1bb17fb5ddd0d51e3~mv2.jpg` | 4608x3072 | 1600x1067 | 39 KB | LIKIT PASTA / Liquid compound, badge 75, red band. |
| `/brands/befar/products/befar-chem-80-auto-polish.webp` | products | `wix:446a5e_899119ecd6254d31b3c8d43b4306f7b1~mv2.jpg` | 4608x3072 | 1600x1067 | 37 KB | OTO CILASI / Auto polish, badge 80, plum band. |
| `/brands/befar/products/befar-chem-85-anti-hologram.webp` | products | `wix:446a5e_c67de7a45a254cecb02d2f6b9f502c74~mv2.jpg` | 4608x3072 | 1600x1067 | 40 KB | HARE GIDERICI / Anti hologram, badge 85. |
| `/brands/befar/products/befar-chem-90-paint-protection.webp` | products | `wix:446a5e_bc73ef97db604e149e346aa6c7c6d46a~mv2.jpg` | 4608x3072 | 1600x1067 | 40 KB | BOYA KORUMA / Paint protection, badge 90, blue band. |
| `/brands/befar/products/befar-chem-cream-compound-tub.webp` | products | `wix:446a5e_c024c2eb64834e839e2cbb07b9944bdd~mv2.jpg` | 4608x3072 | 1600x1067 | 26 KB | Cream compound tub, red band. |
| `/brands/befar/products/befar-interface-pad-multihole-face.webp` | products | `wix:446a5e_a94153136f8c416a893c4807d7d74d49~mv2.jpg` | 4608x3072 | 2000x1333 | 46 KB | Interface pad face-on, black with orange edge, multi-hole pattern. |
| `/brands/befar/products/befar-leo-orbital-pad.webp` | products | `wix:446a5e_b08c0c7b750343ac96005f2842558e60~mv2.jpg` | 4608x3072 | 2000x1333 | 96 KB | Leo ORBITAL SYSTEM face print + bordo multi-hole pad. |
| `/brands/befar/products/befar-nonwoven-abrasive-grey.webp` | products | `wix:446a5e_dcb6baccaaca4429bbb4b006ef45360e~mv2.jpg` | 4608x3072 | 1600x1067 | 116 KB | Non-woven abrasive, grey = 400 P. |
| `/brands/befar/products/befar-nonwoven-abrasive-red.webp` | products | `wix:446a5e_11c04f79b1bf4b148a01087a5141e4d7~mv2.jpg` | 4608x3072 | 1600x1067 | 126 KB | Non-woven abrasive, red = 280 P. |
| `/brands/befar/products/befar-opencell-foam-macro.webp` | products | `wix:446a5e_d7af7d16fc9943c1af7f06eed4a40985~mv2.jpg` | 3000x2000 | 2000x1333 | 407 KB | Opencell: stacked foam edges, black/red/green/yellow, velcro texture visible. |
| `/brands/befar/products/befar-plus-pad-pair.webp` | products | `wix:446a5e_7373e5347c3b4174877dbea448e1155d~mv2.jpg` | 3200x3072 | 2000x1920 | 193 KB | befar +Plus blue pad, ROTARY SYSTEM face print. |
| `/brands/befar/products/befar-sanding-blocks-orange-soft.webp` | products | `wix:446a5e_2f2a9913eb2341b1a485fb0db0181d3b~mv2.jpg` | 4608x3072 | 1600x1067 | 27 KB | Sanding blocks, orange = soft, three sizes. |
| `/brands/befar/products/befar-sanding-blocks-red-hard.webp` | products | `wix:446a5e_c294f6c06af949d59982fe8a875f022b~mv2.jpg` | 4608x3072 | 1600x1067 | 47 KB | Sanding blocks, red = hard, three sizes. |
| `/brands/befar/products/befar-sanding-blocks-turquaz-eco.webp` | products | `wix:446a5e_0a7e7e28afb243eca13de45fce26c8cb~mv2.jpg` | 4608x3072 | 1600x1067 | 76 KB | turQuaz blue eco sanding blocks, three sizes. |
| `/brands/befar/products/befar-turquaz-bottles.webp` | products | `wix:446a5e_74c4ce72c2a04d8ea6e19224632b1d03~mv2.jpg` | 2884x3920 | 1177x1600 | 47 KB | turQuaz PASTA 1 / CILA 2 bottle pair - value-line identity. |
| `/brands/befar/workflow/befar-chemicals-row-dark.webp` | workflow | `wix:446a5e_91135cb57d0a4ad2a1abf2c43e7ab773~mv2.jpg` | 2226x1295 | 2000x1164 | 179 KB | Row of chemical bottles on a dark ground - the ladder as a group shot. |
| `/brands/befar/workflow/befar-gloved-hand-leo-bottle.webp` | workflow | `wix:446a5e_4aab0ba63e454d99b3489ac04f4409bb~mv2.jpg` | 2943x3514 | 2010x2400 | 159 KB | Gloved hand holding the Leo Nano bottle - the only "product in hand" shot. |

### 5.5 Still missing after Phase 1

| Missing | Severity |
|---|---|
| Vector logos × 5 (incl. Opencell in **any** usable form) | **Blocker** |
| Accurate foam colour references (physical samples or controlled reshoot) | **Blocker** |
| Licence/provenance confirmation for the red Porsche hero shoot | **High** |
| PNG-with-alpha packshots — cut-outs must be produced by us | High |
| TDS / SDS / certifications | High |
| Factory, laboratory, team, trade-fair photography | Medium |
| Clean untinted workshop video | Medium |
| Instagram `@befar_tr` audit (JS-gated, `UNVERIFIED`) | Medium |

---

## 6. Full asset table

Sorted by resolution, largest first. `Type` and `Potential use` are our classification, not Befar's.

### A. befar.com.tr (Wix) — 172 assets

| # | Asset (Wix media id) | Type | Source page | Resolution | Quality | Potential use |
|---|---|---|---|---|---|---|
| 1 | `446a5e_c00b4561c1584992a8a6c270719a5615~mv2.jpg` | Photo | About | 6720x4480 | A — excellent | Hero / full-bleed section |
| 2 | `446a5e_db3d48234c064a4698310e57581215ee~mv2.jpg` | Photo | Homepage | 6720x4480 | A — excellent | Hero / full-bleed section |
| 3 | `446a5e_6999bc0afab54daaa02be22228118cab~mv2.jpg` | Photo | Contact | 6720x4480 | A — excellent | Secondary / editorial |
| 4 | `446a5e_2cbb0eba28174ee98818c3173444c0e5~mv2.jpg` | Photo | Velcro foam pads | 4608x3308 | A — excellent | Product packshot (needs cut-out) |
| 5 | `446a5e_1297932741ca4b6b917184a2c5bde463~mv2.jpg` | Photo | Velcro foam pads | 4608x3190 | A — excellent | Product packshot (needs cut-out) |
| 6 | `446a5e_217cd432920a4fd481ae3efb774620c5~mv2.jpg` | Photo | Sanding group | 4726x3072 | A — excellent | Product packshot (needs cut-out) |
| 7 | `446a5e_228551a00820444692afd6d037ec989c~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 8 | `446a5e_4f7643fb0e3f430788b21b143dbd13dc~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 9 | `446a5e_91b73e722ee5471fb5d3dacc3c6cdf9b~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 10 | `446a5e_b169778b08194a059b1e766c008a4a41~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 11 | `446a5e_aceb0de292dc4f53903ac63e89b33250~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 12 | `446a5e_4c7650228a4c45cc99cc96d57cc24e40~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 13 | `446a5e_59fd74dec61a469b984bcc8703850abd~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 14 | `446a5e_3685d3e2ba0d418395bd276dffb8f286~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 15 | `446a5e_9c700bb6913b4b24b84091e786c0019d~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 16 | `446a5e_c1faeb900a01416a9df999937a7ba19d~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 17 | `446a5e_f6ad8a42685c43678b68752f4ec0c784~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 18 | `446a5e_c561e3b3c599402298d8862bbddf6ac8~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 19 | `446a5e_38d61ba26f6048509c8ccfb0622910b5~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 20 | `446a5e_8f3e07e8cb6d44f28c621ec78922abde~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 21 | `446a5e_34962e674a02407f9c63665879618944~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 22 | `446a5e_357349eb5af14e34a18f02f41b16d7fa~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 23 | `446a5e_20d11be5e9e34ab0b3a87ec13c2f5717~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 24 | `446a5e_0d47beeecd6e49348293f4c0c5393001~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 25 | `446a5e_c8df712f9c0a4cc1bcf0df30664f4edb~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 26 | `446a5e_7a4b7875c169463f8dbca62ccd5251bb~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 27 | `446a5e_cc59c8f9c54c436eb46a8bb3c5e0f9c8~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 28 | `446a5e_34192af0a396409e88b9b69ccea5b20a~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 29 | `446a5e_5b005ee1e4d34e12ae2f51bf5b1e7485~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 30 | `446a5e_f1e9786a61f14d818b7f4d6328a474c4~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 31 | `446a5e_2476c73dfd5a4834bb55dcfc6f27d8a8~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 32 | `446a5e_5eb55699b09443e6aaead42333eaf18f~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 33 | `446a5e_6b2aef8d416047e99494dac8b1039768~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 34 | `446a5e_bb8e1af9a7d64c9b872517b21b06444b~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 35 | `446a5e_153f2df6758d4b2eb29405ccedfc9e3e~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 36 | `446a5e_e751146dce2047f4ae80f3e8e037741a~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 37 | `446a5e_60eed730c09846d79115e1d57e9cc842~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 38 | `446a5e_728b61a550f6481ab51fb72d488c32a1~mv2.jpg` | Photo | Velcro foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 39 | `446a5e_a94153136f8c416a893c4807d7d74d49~mv2.jpg` | Photo | Products index | 4608x3072 | A — excellent | Secondary / editorial |
| 40 | `446a5e_0becaab02b63468fbdf9a43cd2719239~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 41 | `446a5e_e892b214483946478a83fa57bad860a5~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 42 | `446a5e_cd890cf9aba1487ebc9973f0c5adfb9d~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 43 | `446a5e_f87112f4769a4218a148d1024b706f41~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 44 | `446a5e_ec234db8cc5a4826925b5156d3ad3b6b~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 45 | `446a5e_18a0baec24434983877febf72eec288c~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 46 | `446a5e_9d9cebb9c3c64547a92d60e6d9374a9b~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 47 | `446a5e_24ed130b7d7f4e23bc11b28e99bd2888~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 48 | `446a5e_264b63a619d844fc8977bbfbd4dc1bab~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 49 | `446a5e_3c187130d9434ee1ad69282d951953d6~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 50 | `446a5e_0a456a63fd1e435fa80f0026737e245b~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 51 | `446a5e_2319c65f517249499284a9166baae237~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 52 | `446a5e_0439bc391e35493eb49845ba04532165~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 53 | `446a5e_2f9cc769d3bf4829804734d8fe744587~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 54 | `446a5e_edc17eca07d14c0992f9d8301a5be986~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 55 | `446a5e_4d0affdf6d404baaabecb570a7379ced~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 56 | `446a5e_3abdb9b5504f4ab99531f0c673ecfaf5~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 57 | `446a5e_e87913a06b2a45b083174248491ce0eb~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 58 | `446a5e_161d504b905248c684022f89ecf79ba4~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 59 | `446a5e_589b16f250e346729c1078e19ea00d88~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 60 | `446a5e_61e9231c99554fcd8fc834730aa458e9~mv2.jpg` | Photo | Applicator foam pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 61 | `446a5e_6e48a26fbb53483a913e06a344eff1fd~mv2.jpg` | Photo | Sanding group | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 62 | `446a5e_7cc2b71a06444f4c89d5fb4125d3662d~mv2.jpg` | Photo | Sanding group | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 63 | `446a5e_f9d5e7703b944b0aadc8d2b7c7e17d19~mv2.jpg` | Photo | Sanding group | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 64 | `446a5e_c294f6c06af949d59982fe8a875f022b~mv2.jpg` | Photo | Sanding group | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 65 | `446a5e_2f2a9913eb2341b1a485fb0db0181d3b~mv2.jpg` | Photo | Sanding group | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 66 | `446a5e_0a7e7e28afb243eca13de45fce26c8cb~mv2.jpg` | Photo | Sanding group | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 67 | `446a5e_11c04f79b1bf4b148a01087a5141e4d7~mv2.jpg` | Photo | Sanding group | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 68 | `446a5e_dcb6baccaaca4429bbb4b006ef45360e~mv2.jpg` | Photo | Sanding group | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 69 | `446a5e_e468dfedfd97465cae69ca4e032ecdd5~mv2.jpg` | Photo | Ceramic | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 70 | `446a5e_36e07a370a3648589d14c41684926c0a~mv2.jpg` | Photo | Ceramic | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 71 | `446a5e_4ceeb34b1a144e11a70bed935cd40e5b~mv2.jpg` | Photo | Ceramic | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 72 | `446a5e_03e96f69b6dc4c02ad5ef09efcc793ef~mv2.jpg` | Photo | New products | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 73 | `446a5e_8985c488c27d434bbe6db1bdacf2be35~mv2.jpg` | Photo | Sets | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 74 | `446a5e_09ed46629fd14fbf8fcfda81c85ab7ba~mv2.jpg` | Photo | Sets | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 75 | `446a5e_f91c7aa183434309a7f56fb9080fa230~mv2.jpg` | Photo | Other products / consumer | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 76 | `446a5e_a334c401f8f14bfca1fa4495b343bb75~mv2.jpg` | Photo | Other products / consumer | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 77 | `446a5e_70b0f4f125c04e808c76552d93f0faf4~mv2.jpg` | Photo | Other products / consumer | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 78 | `446a5e_5a908dfb56cd45219801c6c88bb98d38~mv2.jpg` | Photo | Other products / consumer | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 79 | `446a5e_85335ea35a794a9f956f68e1eb79cda1~mv2.jpg` | Photo | Other products / consumer | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 80 | `446a5e_77c448bf737749eeab493025cdec9924~mv2.jpg` | Photo | Other products / consumer | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 81 | `446a5e_4ef60c88e143423fb5a085edca6ac04e~mv2.jpg` | Photo | Other products / consumer | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 82 | `446a5e_32f913a56a5947efac5b15da173af54e~mv2.jpg` | Photo | Other products / consumer | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 83 | `446a5e_def53463ee5f4f6ea6463f5757cb3be4~mv2.jpg` | Photo | Other products / consumer | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 84 | `446a5e_14cd6c846ead442aae4b4236ef965bd9~mv2.jpg` | Photo | Other products / consumer | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 85 | `446a5e_c004fa3aa9314451bb14e2e6d9eed316~mv2.jpg` | Photo | Other products / consumer | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 86 | `446a5e_8239a62fec924ac9aeb5a576338347d8~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 87 | `446a5e_5da2bf2cd81a4d0b915ee1380b3fe79d~mv2.jpg` | Photo | Backing pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 88 | `446a5e_974a8d58fbbf49c3beadf191dd026639~mv2.jpg` | Photo | Backing pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 89 | `446a5e_d41cdc96e52b49008f9e81b66e47b5f9~mv2.jpg` | Photo | Backing pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 90 | `446a5e_2c8793aae66e4e37901ab6274b1f7b4f~mv2.jpg` | Photo | Backing pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 91 | `446a5e_b1e3c5d65fc84c53b65b5294e04d7efc~mv2.jpg` | Photo | Backing pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 92 | `446a5e_5e74d5b9b1bf4e948e272bf71a22c00a~mv2.jpg` | Photo | Backing pads | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 93 | `446a5e_c4c38dac041c4fb1ab628614f9690250~mv2.jpg` | Photo | Backing pads | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 94 | `446a5e_39bf157671b343a09f8e51066dc1f113~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 95 | `446a5e_e1c9ceedbe1c4ae6b100a83fa33ce043~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 96 | `446a5e_9fd62db5e1de409da0cdb87a17bad1d8~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 97 | `446a5e_4128e09ebf4b4b048cb30e7b1f992d78~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 98 | `446a5e_812eaafd1ea747c7ac9ae6851b7acd2e~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 99 | `446a5e_d4dda3a0df1c4f708735b5ef25467273~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 100 | `446a5e_d78948bea45f4dbf9d4ddf9b6527c1f6~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 101 | `446a5e_b2373e2ad5b845e6961a5221d36aaf1a~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 102 | `446a5e_62ccd702347c482294d1dc42000ba029~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 103 | `446a5e_569cc027eabe4c1f8080423d3d233569~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 104 | `446a5e_b08c0c7b750343ac96005f2842558e60~mv2.jpg` | Photo | Leo series | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 105 | `446a5e_7aa5d1c91b504845a92d2969f69aaf41~mv2.jpg` | Photo | Surface chemicals | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 106 | `446a5e_8b21b77ac83c41c1bb17fb5ddd0d51e3~mv2.jpg` | Photo | Surface chemicals | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 107 | `446a5e_899119ecd6254d31b3c8d43b4306f7b1~mv2.jpg` | Photo | Surface chemicals | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 108 | `446a5e_bc73ef97db604e149e346aa6c7c6d46a~mv2.jpg` | Photo | Surface chemicals | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 109 | `446a5e_c67de7a45a254cecb02d2f6b9f502c74~mv2.jpg` | Photo | Surface chemicals | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 110 | `446a5e_c024c2eb64834e839e2cbb07b9944bdd~mv2.jpg` | Photo | Surface chemicals | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 111 | `446a5e_8b08455e20c24a69a841c8b88f77258b~mv2.jpg` | Photo | Surface chemicals | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 112 | `446a5e_a1eb4c5c2a15492bb90e83caae894004~mv2.jpg` | Photo | Surface chemicals | 4608x3072 | A — excellent | Product packshot (needs cut-out) |
| 113 | `446a5e_631ed56267504052a7c5e5c43839722d~mv2.jpg` | Photo | Surface chemicals | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 114 | `446a5e_5f3de9332c02414b956f288f246264ba~mv2.jpg` | Photo | Surface chemicals | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 115 | `446a5e_113fe794ad3946bcaf3167423942edef~mv2.jpg` | Photo | Surface chemicals | 3072x4608 | B — good | Product packshot (needs cut-out) |
| 116 | `446a5e_f2114abbee49478ea4693d321c4077c1~mv2.jpg` | Photo | Velcro foam pads | 4606x3071 | A — excellent | Product packshot (needs cut-out) |
| 117 | `446a5e_3c835daf60bd424b92e932f598bc5093~mv2.jpg` | Photo | Applicator foam pads | 4446x3072 | A — excellent | Product packshot (needs cut-out) |
| 118 | `446a5e_141a9488a82f4e8c9f6f700562ee1360~mv2.jpg` | Photo | Backing pads | 4527x2933 | A — excellent | Product packshot (needs cut-out) |
| 119 | `446a5e_9ec2a059c64546cea38fa9ac82c9a705~mv2.jpg` | Photo | Other products / consumer | 4378x2982 | A — excellent | Product packshot (needs cut-out) |
| 120 | `446a5e_ccd627c7ed6a4c66b8112adddffd8411~mv2.png` | Graphic/PNG | Homepage | 4021x3193 | A — excellent | Hero / full-bleed section |
| 121 | `446a5e_a92f393de1384f81a8f1e6a944ac7b11~mv2.jpg` | Photo | Homepage | 3194x3992 | B — good | Hero / full-bleed section |
| 122 | `446a5e_e9cfeddfbbe24b3fa13a8b7795fac3db~mv2.jpg` | Photo | Velcro foam pads | 4068x3072 | A — excellent | Product packshot (needs cut-out) |
| 123 | `446a5e_0a0e03afaab74cacb93b760a0af4e759~mv2.jpg` | Photo | Sanding group | 4038x2975 | A — excellent | Product packshot (needs cut-out) |
| 124 | `446a5e_715b3c5ea33f4b9d891d3ec9bf978747~mv2.jpg` | Photo | New products | 2995x3907 | B — good | Product packshot (needs cut-out) |
| 125 | `446a5e_d4005e3d93d14d27830059752f650111~mv2.jpg` | Photo | Leo series | 4121x2780 | A — excellent | Product packshot (needs cut-out) |
| 126 | `446a5e_74c4ce72c2a04d8ea6e19224632b1d03~mv2.jpg` | Photo | Surface chemicals | 2884x3920 | B — good | Product packshot (needs cut-out) |
| 127 | `446a5e_1afc1c3e56b040579d7a4922a324edff~mv2.jpg` | Photo | Sanding group | 4171x2547 | A — excellent | Product packshot (needs cut-out) |
| 128 | `446a5e_4aab0ba63e454d99b3489ac04f4409bb~mv2.jpg` | Photo | Products index | 2943x3514 | B — good | Secondary / editorial |
| 129 | `446a5e_6234680f4382477fbbb0f0b942020e96~mv2.jpg` | Photo | Leo series | 2788x3567 | B — good | Product packshot (needs cut-out) |
| 130 | `446a5e_beb4259a459744839620129c8e78e4eb~mv2.jpg` | Photo | New products | 2842x3494 | B — good | Product packshot (needs cut-out) |
| 131 | `446a5e_7373e5347c3b4174877dbea448e1155d~mv2.jpg` | Photo | Products index | 3200x3072 | B — good | Secondary / editorial |
| 132 | `446a5e_1cc2f89151844dd29f0ac3fedcbcae2e~mv2.jpg` | Photo | Products index | 3200x3072 | B — good | Secondary / editorial |
| 133 | `446a5e_69562690fd194fd9ae44101595e68f84~mv2.jpg` | Photo | Products index | 3266x2968 | B — good | Secondary / editorial |
| 134 | `446a5e_a9f25644938c49f2b251eab9451f18e7~mv2.jpg` | Photo | Products index | 3152x3072 | B — good | Secondary / editorial |
| 135 | `446a5e_660fa8fe410543ce8744c244a6f41d16~mv2.jpg` | Photo | Surface chemicals | 2872x3127 | B — good | Product packshot (needs cut-out) |
| 136 | `446a5e_51693099f88a4f7d83efcd602ab9663f~mv2.jpg` | Photo | Leo series | 2799x2941 | B — good | Product packshot (needs cut-out) |
| 137 | `446a5e_e3262703ea234329bfeab21781aa01fc~mv2.jpg` | Photo | New products | 2912x2814 | B — good | Product packshot (needs cut-out) |
| 138 | `446a5e_446e7e65d7ca47299e8ae57bbd2e306c~mv2.jpg` | Photo | Surface chemicals | 2727x3001 | B — good | Product packshot (needs cut-out) |
| 139 | `446a5e_be1b37e98f3c474cb0ace7618cf61838~mv2.jpg` | Photo | Surface chemicals | 2727x3001 | B — good | Product packshot (needs cut-out) |
| 140 | `446a5e_3221ae7bb60c4f15809ccf5abe8fd7f9~mv2.jpg` | Photo | Applicator foam pads | 2777x2803 | B — good | Product packshot (needs cut-out) |
| 141 | `446a5e_7d226cc4d5544a21935be281aefa3f79~mv2.jpg` | Photo | Backing pads | 2516x3000 | B — good | Product packshot (needs cut-out) |
| 142 | `446a5e_61f95a93ab3d4cf2aa17be586c5747e6~mv2.jpg` | Photo | Backing pads | 3000x2052 | B — good | Product packshot (needs cut-out) |
| 143 | `446a5e_d7af7d16fc9943c1af7f06eed4a40985~mv2.jpg` | Photo | Opencell | 3000x2000 | B — good | Hero / full-bleed section |
| 144 | `446a5e_be0c3ffa797b42e6a0a27a373d005414~mv2.jpg` | Photo | Other products / consumer | 3000x2000 | B — good | Product packshot (needs cut-out) |
| 145 | `446a5e_fdf9ae2401d84000beeaf0f5b7107ec1~mv2.jpg` | Photo | Other products / consumer | 3000x2000 | B — good | Product packshot (needs cut-out) |
| 146 | `446a5e_fc00efda5f534606a4eb9e4559c78b5f~mv2.jpg` | Photo | Other products / consumer | 3000x2000 | B — good | Product packshot (needs cut-out) |
| 147 | `446a5e_454a7b78c3a34095bde124721e0c4ba6~mv2.jpg` | Photo | Other products / consumer | 3000x2000 | B — good | Product packshot (needs cut-out) |
| 148 | `446a5e_3ec856ee6b3e4d34b946ab7edc5d6c12~mv2.jpg` | Photo | Homepage | 2240x2240 | B — good | Hero / full-bleed section |
| 149 | `446a5e_e88acd659f8042efb4364167d62fa4d7~mv2.png` | Graphic/PNG | About | 2481x1537 | B — good | Hero / full-bleed section |
| 150 | `446a5e_2ef0a58056c6476a9626505639bb1d72~mv2.jpg` | Photo | Products index | 3000x1250 | B — good | Secondary / editorial |
| 151 | `446a5e_91135cb57d0a4ad2a1abf2c43e7ab773~mv2.jpg` | Photo | Products index | 2226x1295 | B — good | Secondary / editorial |
| 152 | `446a5e_38141205c8b94e939e9343fcb718e10e~mv2.jpg` | Photo | New products | 2245x1247 | B — good | Product packshot (needs cut-out) |
| 153 | `446a5e_2ddb9b662ec54db1a012353945efd104~mv2.jpg` | Photo | Blog (empty) | 2229x1238 | B — good | Secondary / editorial |
| 154 | `446a5e_7310ccdccfe948958a8e59338a283f10~mv2.jpg` | Photo | Fair form | 1920x1080 | C — usable | Secondary / editorial |
| 155 | `446a5e_88cb7c32d29c4197868c57ed21940e34~mv2.jpg` | Photo | Catalogue page | 1920x1080 | C — usable | Secondary / editorial |
| 156 | `446a5e_755852fc3aef4e78821cb207efba47bf~mv2.jpg` | Photo | Homepage | 1920x804 | C — usable | Hero / full-bleed section |
| 157 | `446a5e_7a9ffcd1c0ab4ff6a0954ac804abbcaa~mv2.jpg` | Photo | Opencell | 1920x657 | C — usable | Hero / full-bleed section |
| 158 | `446a5e_5f45d096944b4c0cbcf06e5b0f0b6bbb~mv2.jpg` | Photo | Velcro foam pads | 1080x1080 | D — thumbnail only | Card thumbnail |
| 159 | `446a5e_b8e19247e5d748618cc5b733c663b15a~mv2.png` | Graphic/PNG | About | 1192x738 | D — thumbnail only | Hero / full-bleed section |
| 160 | `446a5e_d70d328ecf0a4b48ab8bd8e2545b7db3~mv2.jpg` | Photo | Velcro foam pads | 750x680 | D — thumbnail only | Card thumbnail |
| 161 | `446a5e_1372683cec0f43b9bf363ade64ffe65e~mv2.jpg` | Logo/UI | Products index | 520x520 | E — too low | Not usable at scale |
| 162 | `446a5e_e384c39db7204880b192a09829374391~mv2.jpg` | Logo/UI | Products index | 520x520 | E — too low | Not usable at scale |
| 163 | `446a5e_8b4bb903ef8545f2824d06f4e74ecfec~mv2.png` | Graphic/PNG | Homepage | 635x192 | D — thumbnail only | Hero / full-bleed section |
| 164 | `446a5e_d6f5363a16634907915819a64bd0a769~mv2.png` | Graphic/PNG | Fair landing | 1000x114 | D — thumbnail only | Secondary / editorial |
| 165 | `446a5e_fa854089d7be4d9bb59685121b28ca26~mv2.png` | Logo/UI | Products index | 453x151 | E — too low | Not usable at scale |
| 166 | `446a5e_cc9bf8cc9b4e4ebfa9a8fab4238979cb~mv2.png` | Logo/UI | Other products / consumer | 449x143 | E — too low | Not usable at scale |
| 167 | `446a5e_f15863908c384f38b8c604de4f4bf58b~mv2.png` | Logo/UI | Surface chemicals | 447x143 | E — too low | Not usable at scale |
| 168 | `11062b_2381e8a6e7444f4f902e7b649aa3f0ac~mv2.png` | Logo/UI | Opencell | 201x201 | E — too low | Not usable at scale |
| 169 | `11062b_9b5a3b3607694630a7253c5fc4ff6476~mv2.png` | Logo/UI | Opencell | 201x201 | E — too low | Not usable at scale |
| 170 | `446a5e_5ffbd5d4f50443a39170953d50336759~mv2.png` | Logo/UI | Other products / consumer | 285x91 | E — too low | Not usable at scale |
| 171 | `446a5e_b52614f23e0649189b3a74f57066609d~mv2.png` | Logo/UI | Surface chemicals | 200x60 | E — too low | Not usable at scale |
| 172 | `446a5e_d6f9c2e09e504b9a8301c451dcfd4a1e~mv2.png` | Logo/UI | Leo series | 45x46 | E — too low | Not usable at scale |

### B. nargildisticaret.com (export site) — 111 assets

| # | Asset path | Type | Product code | Resolution | Quality | Potential use |
|---|---|---|---|---|---|---|
| 1 | `images/urunler/01401/0771.jpg` | Product photo | 01401 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 2 | `images/urunler/04401/04401.jpg` | Product photo | 04401 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 3 | `images/urunler/04401/04402.jpg` | Product photo | 04401 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 4 | `images/urunler/04401/04403.jpg` | Product photo | 04401 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 5 | `images/urunler/04401/04404.jpg` | Product photo | 04401 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 6 | `images/urunler/04401/04405.jpg` | Product photo | 04401 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 7 | `images/urunler/06401/0800.jpg` | Product photo | 06401 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 8 | `images/urunler/06401/0801.jpg` | Product photo | 06401 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 9 | `images/urunler/12101/0773.jpg` | Product photo | 12101 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 10 | `images/urunler/20101/20101_1.jpg` | Product photo | 20101 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 11 | `images/urunler/44801/0780.jpg` | Product photo | 44801 | 5472x3648 | A — excellent | Product packshot (needs cut-out) |
| 12 | `images/urunler/77741/0856.jpg` | Product photo | 77741 | 3648x5472 | B — good | Product packshot (needs cut-out) |
| 13 | `images/urunler/77742/0858.jpg` | Product photo | 77742 | 3648x5472 | B — good | Product packshot (needs cut-out) |
| 14 | `images/urunler/77746/0859.jpg` | Product photo | 77746 | 3648x5472 | B — good | Product packshot (needs cut-out) |
| 15 | `images/urunler/77748/0860.jpg` | Product photo | 77748 | 3648x5472 | B — good | Product packshot (needs cut-out) |
| 16 | `images/urunler/04501/04502.jpg` | Product photo | 04501 | 4768x3083 | A — excellent | Product packshot (needs cut-out) |
| 17 | `images/urunler/04501/04503.jpg` | Product photo | 04501 | 4768x3083 | A — excellent | Product packshot (needs cut-out) |
| 18 | `images/urunler/04501/04501.jpg` | Product photo | 04501 | 4793x2865 | A — excellent | Product packshot (needs cut-out) |
| 19 | `images/urunler/04501/04504.jpg` | Product photo | 04501 | 4814x2690 | A — excellent | Product packshot (needs cut-out) |
| 20 | `images/urunler/04501/04505.jpg` | Product photo | 04501 | 4814x2690 | A — excellent | Product packshot (needs cut-out) |
| 21 | `images/befar/0013-2000x1333.jpg` | Sector/editorial photo | — | 2000x1333 | B — good | Product packshot (needs cut-out) |
| 22 | `images/befar/0014-2000x1333.jpg` | Sector/editorial photo | — | 2000x1333 | B — good | Product packshot (needs cut-out) |
| 23 | `images/urunler/93062/0717.jpg` | Product photo | 93062 | 800x884 | D — thumbnail only | Card thumbnail / catalogue tile |
| 24 | `images/urunler/91025/0709.jpg` | Product photo | 91025 | 800x797 | D — thumbnail only | Card thumbnail / catalogue tile |
| 25 | `images/urunler/91030/0708.jpg` | Product photo | 91030 | 800x790 | D — thumbnail only | Card thumbnail / catalogue tile |
| 26 | `images/urunler/93015/0716.jpg` | Product photo | 93015 | 800x743 | D — thumbnail only | Card thumbnail / catalogue tile |
| 27 | `images/urunler/64520/0700.jpg` | Product photo | 64520 | 800x728 | D — thumbnail only | Card thumbnail / catalogue tile |
| 28 | `images/urunler/93007/0715.jpg` | Product photo | 93007 | 800x688 | D — thumbnail only | Card thumbnail / catalogue tile |
| 29 | `images/urunler/34510/0704.jpg` | Product photo | 34510 | 800x645 | D — thumbnail only | Card thumbnail / catalogue tile |
| 30 | `images/urunler/10101/10101.jpg` | Product photo | 10101 | 800x588 | D — thumbnail only | Card thumbnail / catalogue tile |
| 31 | `images/urunler/89010/0755.jpg` | Product photo | 89010 | 800x573 | D — thumbnail only | Card thumbnail / catalogue tile |
| 32 | `images/urunler/93162/0742.jpg` | Product photo | 93162 | 800x545 | D — thumbnail only | Card thumbnail / catalogue tile |
| 33 | `images/urunler/20101/20101_2.jpg` | Product photo | 20101 | 800x543 | D — thumbnail only | Card thumbnail / catalogue tile |
| 34 | `images/urunler/55405/0694.jpg` | Product photo | 55405 | 800x541 | D — thumbnail only | Card thumbnail / catalogue tile |
| 35 | `images/urunler/55405/0695.jpg` | Product photo | 55405 | 800x540 | D — thumbnail only | Card thumbnail / catalogue tile |
| 36 | `images/urunler/89010/0757.jpg` | Product photo | 89010 | 800x540 | D — thumbnail only | Card thumbnail / catalogue tile |
| 37 | `images/urunler/93700/0747.jpg` | Product photo | 93700 | 800x540 | D — thumbnail only | Card thumbnail / catalogue tile |
| 38 | `images/urunler/02401/02401.jpg` | Product photo | 02401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 39 | `images/urunler/02401/02402.jpg` | Product photo | 02401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 40 | `images/urunler/02401/02403.jpg` | Product photo | 02401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 41 | `images/urunler/02401/02404.jpg` | Product photo | 02401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 42 | `images/urunler/02401/02405.jpg` | Product photo | 02401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 43 | `images/urunler/06401/0805.jpg` | Product photo | 06401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 44 | `images/urunler/06401/0806.jpg` | Product photo | 06401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 45 | `images/urunler/06401/0807.jpg` | Product photo | 06401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 46 | `images/urunler/07404/07404.jpg` | Product photo | 07404 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 47 | `images/urunler/07604/07604.jpg` | Product photo | 07604 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 48 | `images/urunler/08400/0640.jpg` | Product photo | 08400 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 49 | `images/urunler/08400/0641.jpg` | Product photo | 08400 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 50 | `images/urunler/08400/0642.jpg` | Product photo | 08400 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 51 | `images/urunler/09400/0645.jpg` | Product photo | 09400 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 52 | `images/urunler/09400/0646.jpg` | Product photo | 09400 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 53 | `images/urunler/09400/0647.jpg` | Product photo | 09400 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 54 | `images/urunler/09400/0648.jpg` | Product photo | 09400 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 55 | `images/urunler/10101/10102.jpg` | Product photo | 10101 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 56 | `images/urunler/10101/10103.jpg` | Product photo | 10101 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 57 | `images/urunler/10101/10104.jpg` | Product photo | 10101 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 58 | `images/urunler/10101/10105.jpg` | Product photo | 10101 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 59 | `images/urunler/11001/11001.jpg` | Product photo | 11001 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 60 | `images/urunler/11001/11002.jpg` | Product photo | 11001 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 61 | `images/urunler/11001/11005.jpg` | Product photo | 11001 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 62 | `images/urunler/11001/11006.jpg` | Product photo | 11001 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 63 | `images/urunler/11001/11007.jpg` | Product photo | 11001 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 64 | `images/urunler/52401/52401.jpg` | Product photo | 52401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 65 | `images/urunler/52401/52402.jpg` | Product photo | 52401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 66 | `images/urunler/52401/52405.jpg` | Product photo | 52401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 67 | `images/urunler/52401/52406.jpg` | Product photo | 52401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 68 | `images/urunler/52401/52407.jpg` | Product photo | 52401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 69 | `images/urunler/52401adv/0696.jpg` | Product photo | 52401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 70 | `images/urunler/54401/0824.jpg` | Product photo | 54401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 71 | `images/urunler/54401/0826.jpg` | Product photo | 54401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 72 | `images/urunler/54401/0828.jpg` | Product photo | 54401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 73 | `images/urunler/54401/0831.jpg` | Product photo | 54401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 74 | `images/urunler/56401/0807.jpg` | Product photo | 56401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 75 | `images/urunler/56401/0833.jpg` | Product photo | 56401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 76 | `images/urunler/56401/0835.jpg` | Product photo | 56401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 77 | `images/urunler/56401/0836.jpg` | Product photo | 56401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 78 | `images/urunler/56401/0837.jpg` | Product photo | 56401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 79 | `images/urunler/58401/0838.jpg` | Product photo | 58401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 80 | `images/urunler/58401/0840.jpg` | Product photo | 58401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 81 | `images/urunler/58401/0842.jpg` | Product photo | 58401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 82 | `images/urunler/58401/0843.jpg` | Product photo | 58401 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 83 | `images/urunler/88010/0754.jpg` | Product photo | 88010 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 84 | `images/urunler/88010/0758.jpg` | Product photo | 88010 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 85 | `images/urunler/88010/0764.jpg` | Product photo | 88010 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 86 | `images/urunler/97200/0651.jpg` | Product photo | 97200 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 87 | `images/urunler/97200/0652.jpg` | Product photo | 97200 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 88 | `images/urunler/97200/0653.jpg` | Product photo | 97200 | 800x533 | D — thumbnail only | Card thumbnail / catalogue tile |
| 89 | `images/urunler/01407/0882_L.jpg` | Product photo | 01407 | 800x528 | D — thumbnail only | Card thumbnail / catalogue tile |
| 90 | `images/urunler/01407/0883_L.jpg` | Product photo | 01407 | 800x528 | D — thumbnail only | Card thumbnail / catalogue tile |
| 91 | `images/urunler/97400/0661.jpg` | Product photo | 97400 | 800x525 | D — thumbnail only | Card thumbnail / catalogue tile |
| 92 | `images/urunler/93115/0740.jpg` | Product photo | 93115 | 800x512 | D — thumbnail only | Card thumbnail / catalogue tile |
| 93 | `images/urunler/93107/0734.jpg` | Product photo | 93107 | 800x505 | D — thumbnail only | Card thumbnail / catalogue tile |
| 94 | `images/urunler/83424/0654.jpg` | Product photo | 83424 | 800x498 | D — thumbnail only | Card thumbnail / catalogue tile |
| 95 | `images/urunler/09501/0680.jpg` | Product photo | 09501 | 800x460 | D — thumbnail only | Card thumbnail / catalogue tile |
| 96 | `images/urunler/09501/0682.jpg` | Product photo | 09501 | 800x458 | D — thumbnail only | Card thumbnail / catalogue tile |
| 97 | `images/befar/dnm-9-686x457.jpg` | Sector/editorial photo | — | 686x457 | D — thumbnail only | Card thumbnail / catalogue tile |
| 98 | `images/befar/eb11ecd49881d667498ae9f9a2b73c50-686x457.jpg` | Sector/editorial photo | — | 686x457 | D — thumbnail only | Card thumbnail / catalogue tile |
| 99 | `images/befar/gemi.jpg` | Sector/editorial photo | — | 686x457 | D — thumbnail only | Card thumbnail / catalogue tile |
| 100 | `images/befar/otomobil-1-686x457.jpg` | Sector/editorial photo | — | 686x457 | D — thumbnail only | Card thumbnail / catalogue tile |
| 101 | `images/befar/ucak-11-686x457.jpg` | Sector/editorial photo | — | 686x457 | D — thumbnail only | Card thumbnail / catalogue tile |
| 102 | `images/befar_plus_logo.png` | Logo | — | 498x143 | E — too low | Not usable at scale |
| 103 | `images/nargil_logo_beyaz.svg` | Logo | — | 0x0 | unknown | Not usable at scale |
| 104 | `images/urunler/02401_befar.jpg` | Product photo | 02401 | 0x0 | unknown | Not usable at scale |
| 105 | `images/urunler/02402_befar.jpg` | Product photo | 02402 | 0x0 | unknown | Not usable at scale |
| 106 | `images/urunler/02403_befar.jpg` | Product photo | 02403 | 0x0 | unknown | Not usable at scale |
| 107 | `images/urunler/02404_befar.jpg` | Product photo | 02404 | 0x0 | unknown | Not usable at scale |
| 108 | `images/urunler/02405_befar.jpg` | Product photo | 02405 | 0x0 | unknown | Not usable at scale |
| 109 | `images/urunler/05812_1.jpeg` | Product photo | 05812 | 0x0 | unknown | Not usable at scale |
| 110 | `images/urunler/05812_2.jpeg` | Product photo | 05812 | 0x0 | unknown | Not usable at scale |
| 111 | `images/urunler/05812_3.jpeg` | Product photo | 05812 | 0x0 | unknown | Not usable at scale |
