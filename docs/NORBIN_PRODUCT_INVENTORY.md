# NORBIN — Product inventory, current/legacy resolution and technical data (Phase 1)

**Status:** audit only. **No product data was changed. No publication state was changed.**
**Date:** 2026-08-09.
**Companion documents:** `NORBIN_BRAND_RESEARCH.md`, `NORBIN_ASSET_GAP.md`, `NORBIN_DESIGN_BLUEPRINT.md`.

Tags: `[F]` fact from an official source · `[R]` fact from this repository · `[I]` inference ·
`[D]` design interpretation · `UNVERIFIED`.

**The governing rule of this document.** The manufacturer's range and our sales range are three
separate universes and are never merged:

```
  MANUFACTURER (EMEA)  ─┐
  MANUFACTURER (local)  ├──  reconciled in §4, never flattened
  OUR REPOSITORY       ─┘
```

---

## 1. Headline numbers

| Universe | Count | Source |
| --- | ---: | --- |
| Current official **EMEA** range | **13** | 2024 brochure p.2, re-verified live 2026-08-09 `[F]` |
| Manufacturer codes discovered across all regions | **24** registered (+6 seen only in document filenames) | `data/knowledge/norbin-catalog.generated.json` `[R]` |
| Codes visible on the Türkiye page | **30** | live probe 2026-08-09 `[F]` |
| Products in **our** repository | **3 records → 1 distinct manufacturer code** (2 published) | `lib/carsystem-data.ts` `[R]` |
| **Articles in our ERP stock report** | **12 articles → 10 distinct codes** — *added Phase 1.5* | §10–11 `[R]` |
| Reliable code matches | **2** (`exact-code`) | `norbin-match.generated.json` `[R]` |
| Ambiguous local records | **1** | as above `[R]` |
| Confirmed manufacturer-side legacy | **1** (`N55-V15`) | §4 `[F]` |
| Unresolved codes | **1** (`N85-025`) — *not a phantom; a real ERP article, see §14.5* | §8.2, §14.5 |
| Technical claims held, with full provenance | **301** across 24 TDS | `norbin-tds-claims.generated.json` `[R]` |
| Manufacturer-declared product↔component relationships | **21** | as above `[R]` |

---

## 2. The current official EMEA range — 13 products

`[F]` Authority: the *"Refinish a winner with NORBIN®"* brochure, EN, May 2024, page 2, table
"Product Name / Product Code" — re-verified against the live EMEA range page on 2026-08-09. Both agree
exactly.

| # | Code | Official name | Family | Role in the repair | Pack sizes evidenced | TDS | SDS |
| --- | --- | --- | --- | --- | --- | :---: | :---: |
| 1 | `N95-060` | Silicone Cleaner | N95 — cleaning | Degreasing before every stage | 5 L | ✅ | ✅ |
| 2 | `N60-V20` | Multifunctional Body Filler VOC (+ hardener) | N60 — filling | Levelling dents and bare-metal repairs | 1.95 kg filler + 0.05 kg hardener | ✅ | ✅ ×2 |
| 3 | `N55-015` | 1K Plastic Primer | N55 — priming | Adhesion promoter on plastic parts | 1 L | ✅ | ✅ |
| 4 | `N55-V20` | 2K Primer Filler grey VOC | N55 — priming | Sandable undercoat, grey | 2.5 L | ✅ | ✅ |
| 5 | `N55-V29` | 2K Primer Filler black VOC | N55 — priming | Sandable undercoat, black | 2.5 L | ✅ | ✅ |
| 6 | `N15-020` | Clear (non-VOC) | N15 — clearcoat | 2K clear over all basecoats | 1 L, 5 L | ✅ | ✅ ×2 |
| 7 | `N15-V20` | Clear VOC | N15 — clearcoat | 2K VOC clear over all basecoats | 4 L | ✅ | ✅ |
| 8 | `N15-V25` | Fast Clear VOC | N15 — clearcoat | Fast VOC clear for small repairs | 5 L | ✅ | ✅ |
| 9 | `N75-020` | Hardener Fast (non-VOC) | N75 — hardener | Hardener for primer fillers | 0.5 L | ❌ | ✅ |
| 10 | `N75-021` | Hardener Normal (non-VOC) | N75 — hardener | Standard hardener for `N15-020` | 0.5 L, 2.5 L | ❌ | ✅ ×2 |
| 11 | `N75-022` | Hardener Slow (non-VOC) | N75 — hardener | Slow hardener for `N15-020` | 2.5 L | ❌ | ✅ |
| 12 | `N75-V21` | Clear Hardener VOC | N75 — hardener | Hardener for VOC clears | 1 L | ❌ | ✅ |
| 13 | `N85-021` | Thinner | N85 — thinner | Reducer; also part of `N15-V25` and `N55-V20` mixes | 1 L, 5 L | ❌ | ✅ ×2 |

### 2.1 The code grammar

`[F]` The prefix carries the family, consistently across every region:

| Prefix | Family | `V` in position 5 |
| --- | --- | --- |
| `N15` | Clearcoats | VOC-compliant version |
| `N55` | Primers and primer fillers | VOC-compliant version |
| `N60` | Body fillers / putties | VOC-compliant version |
| `N75` | Hardeners | VOC-compliant version |
| `N85` | Thinners / reducers | VOC-compliant version |
| `N95` | Cleaners and auxiliaries | — |

`[I]` The `V` marks the VOC-compliant formulation, and VOC and non-VOC products **do not share
hardeners**: `N15-020` (non-VOC) takes `N75-021`/`N75-022`; `N15-V20` and `N15-V25` (VOC) take
`N75-V21`. Confirmed by the mixing table in §5, not deduced from the letter alone.

### 2.2 The gap that shapes the page

**`[F]` Five of the thirteen EMEA products have no technical data sheet at all** — the four hardeners
and the thinner. They exist only as SDS entries.

`[I]` This is not an omission by the manufacturer. In NORBIN's own information architecture the
hardener is **not a standalone product** — it is a *parameter of the clear or filler it goes into*.
Every hardener's ratio, pot life and behaviour is documented inside the TDS of the product it hardens.
`[D]` The page must therefore present hardeners as attributes of a mix, never as thirteen equal cards
in a grid. A grid would create thirteen empty specification tables and five dead ends.

---

## 3. Our repository — what we actually hold

`[R]` Three records, all in `lib/carsystem-data.ts`, all `brandSlug: "norbin"`,
`programSlug: "boje-i-lakovi"`, `phaseSlug: "lak"`.

| Local slug | Local name | SKU | Line | Match | Manufacturer code | Confidence |
| --- | --- | --- | ---: | --- | --- | --- |
| `norbin-n15-020-5l` | Norbin N15-020 5 L | `NORBIN-N15-020-5L` | 2187 | ✅ | `N15-020` | **`exact-code`** |
| `norbin-n15-020-1l` | Norbin N15-020 1 L | `NORBIN-N15-020-1L` | 2208 | ✅ | `N15-020` | **`exact-code`** |
| `norbin-2k-bezbojni-lak` | Norbin 2K bezbojni lak | `NORBIN-2K-CLEAR` | 1131 | ⚠️ | 3 candidates | **`ambiguous`** |

### 3.1 Reading the match correctly

`[R]` The two `exact-code` matches are genuine: `N15-020` belongs to the manufacturer's own `N##-###`
scheme and both pack sizes (1 L, 5 L) are independently confirmed by the manufacturer's SDS list. No
bare-numeric match was accepted anywhere.

**These are one product in two pack sizes, not two products.** `[I]` Pack size is a confirmation of the
match, not an identity. `[D]` The page must present `N15-020` once, with 1 L and 5 L as variants.

### 3.2 The ambiguous record

> **⚠ SUPERSEDED by §12 (Phase 1.5).** The record is now classified `INVALID_PRODUCT_RECORD`: it maps
> to no manufacturer code and no ERP article, and it is **not published** — contrary to the last
> paragraph of this section. The reasoning below is retained for audit only.

`[R]` `norbin-2k-bezbojni-lak` is a generic descriptive name with a synthetic SKU
(`NORBIN-2K-CLEAR`), placeholder imagery, placeholder documents (`/documents/placeholder-tds.pdf`,
`status: "placeholder"`), and specifications written as prose (*"Prema tehničkom listu"*). It could be
any of:

- `N15-020` Clear
- `N15-V20` Clear VOC
- `N15-V25` Fast Clear VOC

**No candidate has been selected and none should be.** `[D]` For Phase 2 there are two defensible
options and the choice is commercial, not technical:

1. **Resolve** — confirm with the sales side which clear this record represents, then merge it into the
   real code. Preferred.
2. **Withhold** — leave it out of the NORBIN landing page's product layer until resolved, while
   leaving the record itself untouched and reachable.

**Not acceptable `[D]`:** guessing, or showing it beside `N15-020` as if they were two products. ~~On
the current page it appears as a third clearcoat, which is misleading.~~ **← This was wrong.** The
record never reaches `productRecords` and has never been published; see §12.4.

### 3.3 Local data quality issues found (not fixed)

| Item | Location `[R]` | Issue |
| --- | --- | --- |
| Brand description | `carsystem-data.ts:416` | *"Program boja, lakova i pratećih materijala"* — **NORBIN EMEA has no colours** |
| Brand overview | `:418` | *"…sa fokusom na završne slojeve"* — omits primers, filler, cleaner, which are half the range |
| Hero kicker | `:426` | *"Norbin program boja i lakova"* — same colour problem |
| Programme mapping | `:415` | Mapped only to `boje-i-lakovi`; the real range spans preparation, filling and priming too |
| Specifications | `:2196-2201`, `:2217-2222` | Placeholder text (*"Dostupnost se potvrđuje kroz upit"*) where 16 verified TDS claims exist |
| Documents | `:1168-1178` | `status: "placeholder"` / `"disabled"` pointing at `/documents/placeholder-tds.pdf`, while the real TDS and SDS are held locally |
| Related products | `:2205`, `:2230` | Cross-links to baslac and R-M products; **no link to the hardener the clear actually needs** |
| Motion accent | `components/product/productMotion.ts:33` | `oklch(0.55 0.1 220)` — an approximation, not the official `#0082BB` |

---

## 4. Current vs legacy resolution

Statuses assigned per the brief's vocabulary. **Nothing has been deleted or unpublished.**

### 4.1 EMEA products

| Code | Status | Evidence |
| --- | --- | --- |
| `N15-020` | **`CURRENT_OFFICIAL_AND_LOCAL`** | 2024 brochure + live page + our 2 records `[F]` `[R]` |
| `N15-V20`, `N15-V25`, `N55-015`, `N55-V20`, `N55-V29`, `N60-V20`, `N75-020`, `N75-021`, `N75-022`, `N75-V21`, `N85-021`, `N95-060` | **`CURRENT_OFFICIAL`** | 2024 brochure + live page; not in our range `[F]` |
| `N55-V15` 1K Primer Filler VOC | **`LEGACY_OFFICIAL`** | See §4.2 — strongest evidence in the whole set `[F]` |

### 4.2 `N55-V15` — the one clean legacy verdict

`[F]` Verified live on 2026-08-09. The EMEA range page contains **exactly two HTML-commented links,
and both of them are `N55-V15`**:

```html
<!-- files/TDS/NORBIN_TDS_N55-V15_1K_Primer_Filler_VOC_2022.pdf" -->
<!-- files/MSDS/N55-V15_1K_Primer_Filler_VOC_1L.PDF" -->
```

Four independent signals agree:

1. It is absent from the May 2024 brochure's 13-product table. `[F]`
2. Its links are commented out — the manufacturer deliberately hid them. `[F]`
3. Its TDS is dated **2022** and both files are still served (HTTP 200), so this is withdrawal from the
   *offer*, not deletion of the archive. `[F]`
4. It is still listed on the Türkiye page — a local range decision that does not restore it to EMEA. `[F]`

`[I]` `N55-V15` was the 1K primer filler in the EMEA range and has been superseded by the 2K
`N55-V20`/`N55-V29` pair. **We do not sell it, so nothing is at risk** — but if it ever appears in a
stock list it must be flagged.

### 4.3 Türkiye-only codes

`[F]` 17 codes appear on the Türkiye page and never in EMEA: `N15-120`, `N55-110`, `N55-115`,
`N55-120`, `N55-121`, `N60-100`, `N75-120`, `N75-121`, `N75-122`, `N85-120`, `N85-121`, `N85-140`,
`N95-110`, `N95-120`, `N95-150`, `N95-160`, plus `N55-V15`.

**Status: `CURRENT_LOCAL` (Türkiye) — and out of scope for our page.** `[D]` They are a genuine local
range, not legacy, but presenting them would imply an availability we cannot support and would
directly contradict the manufacturer's own *"Our offer may differ from country to country"* warning.
They are recorded here so that a future stock import that surfaces, say, `N75-121` is recognised as
"Turkish range" rather than "unknown code".

`[F]` Six of these (`N15-120`, `N55-110`, `N55-115`, `N55-120`, `N55-V15`, `N95-150`) exist only in
commented-out HTML on the Turkish page — status **`LOCAL_LEGACY_CANDIDATE` (Türkiye)**, not our
concern.

### 4.4 Reconciliation table

| Universe | Codes | Overlap with our repository |
| --- | ---: | --- |
| Manufacturer EMEA, current | 13 | **1** (`N15-020`) |
| Manufacturer EMEA, legacy | 1 | 0 |
| Manufacturer Türkiye, current-local | 13 additional | 0 |
| Manufacturer Türkiye, hidden | 6 | 0 |
| Manufacturer Kazakhstan | 2 (both also EMEA) | 1 |
| **Our repository, distinct codes** | **1** | — |
| **Our repository, unresolved records** | **1** (`norbin-2k-bezbojni-lak`) | — |

~~**We evidently sell 1 of 13 EMEA products.**~~ **← SUPERSEDED by §11.** Reading only
`lib/carsystem-data.ts` gave 1; the ERP stock report gives **8 of 13**, across 12 articles. The
two-layer model in the blueprint still holds, but the "our programme" layer is a coherent
eight-product clearcoat system, not a single item. See §14.2.

---

## 5. Product relationships — the system map

`[F]` 21 relationships, every one **declared in the manufacturer's own TDS mixing table**, not derived
from names or code numbers.

### 5.1 The ratio families

| Base product | Ratio | Hardener | Thinner | Source |
| --- | --- | --- | --- | --- |
| `N15-020` Clear | **2:1** | `N75-021` Normal **or** `N75-022` Slow | — | EN + TR TDS `[F]` |
| `N15-V20` Clear VOC | **4:1** | `N75-V21` Clear Hardener VOC | — | EN + TR TDS `[F]` |
| `N15-V25` Fast Clear VOC | **3:1** | `N75-V21` Clear Hardener VOC | `N85-021` Thinner | EN + TR TDS `[F]` |
| `N55-V20` 2K Primer Filler grey | **5:1:1** | `N75-020` Hardener Fast | `N85-021` Thinner | EN TDS 12/2022 `[F]` |
| `N55-V29` 2K Primer Filler black | **5:1** | `N75-020` Hardener Fast | `N85-025` *(see §8.2)* | EN TDS `[F]` |
| `N60-V20` Body Filler | supplied as a set | integral 0.05 kg hardener | — | EN TDS + SDS pair `[F]` |

`[I]` Three structural observations that should drive the information architecture:

1. **`N15-020` is the only product with a temperature/speed choice** — one clear, two hardeners
   (Normal / Slow). It is a many-to-many relation, and it happens to be the product we sell.
2. **`N75-V21` serves two clears at two different ratios** (4:1 and 3:1). Ratio belongs to the *pair*,
   never to either product alone.
3. **`N85-021` Thinner is not an optional extra** — it is a declared component of two mixes. It is
   part of the system, not an accessory.

### 5.2 The grey-shade relationship

`[F]` From the official A3 technical poster (rev. 230221b), verbatim:

> "Mixing of filler for correct undercoat solution … 100 % N55-V20 (Dark Grey) … 100 % N55-V29
> (Grey Black) … Undercoat solution / Mixing ratio % by vol.: 50 % N55-V20 Dark Grey / 50 % N55-V29
> Grey Black"

`[I]` The two primer fillers are not two products to choose between — they are a **two-point greyscale
that the painter blends** to reach the undercoat shade the topcoat needs. This is genuine, documented,
non-obvious technical content that NORBIN publishes on a poster and nowhere on its own website. `[D]`
It is the single best candidate for an interactive element on our page.

### 5.3 Process map

`[I]` Derived from the `Application:` and `Suitable surfaces:` fields of the TDS files — the sequence
is evidenced, not imposed:

```
  1. CLEAN        N95-060 Silicone Cleaner
  2. FILL         N60-V20 Body Filler (+ integral hardener)
  3. PRIME        N55-015 Plastic Primer  ·  N55-V20 / N55-V29 Primer Filler (+ N75-020 + N85-021)
                  └ blendable to an undercoat grey — §5.2
  4. [ COLOUR ]   ← NORBIN supplies nothing here in EMEA
  5. CLEAR        N15-020 (+N75-021 / N75-022)  ·  N15-V20 (+N75-V21)  ·  N15-V25 (+N75-V21 +N85-021)
```

**Step 4 is deliberately empty and must stay visibly empty on the page.** `[D]` The gap *is* the
positioning: NORBIN works around whichever colour system the shop already uses. Filling it, or hiding
it, would misrepresent the brand.

---

## 6. Normalised technical data — EMEA products with a TDS

`[F]` Every value below is transcribed from the English TDS. Values are given exactly as printed.
Fields not present in the document are marked `—` and were **not** inferred.

### 6.1 Clearcoats

| Field | `N15-020` Clear | `N15-V20` Clear VOC | `N15-V25` Fast Clear VOC |
| --- | --- | --- | --- |
| Application | 2K clear coat for all basecoat finishes. | 2K VOC clear coat for all basecoat finishes. | Fast drying 2K VOC clear suitable for small repairs |
| Key features | Medium solid, good hardness, fast drying. | good hardness, fast drying | very fast drying, good hardness, good polishability |
| Mixing ratio | **2:1** | **4:1** | **3:1** |
| Hardener | `N75-021` / `N75-022` | `N75-V21` | `N75-V21` |
| Thinner | — | — | `N85-021` |
| Spray viscosity (DIN 4, 20 °C) | 16–18 s | 20–24 s | 23–25 s |
| Pot life at 20 °C | 2 h | 1.5 h | 1.5 h |
| Nozzle — HVLP | 1.3 | 1.3 | 1.3 |
| Nozzle — compliant gravity-feed | 1.3–1.4 | 1.3–1.4 | 1.3–1.4 |
| Application pressure | — | — | 2 bar |
| Nozzle pressure | — | — | 0.7 bar |
| Spray coats | 2 | 2 | — |
| Flash-off between coats | 3 min | 3 min | — |
| Dry film thickness | 50–60 µm | 50 µm | 40–60 µm |
| Drying at 20 °C | 5 h ready for assembly | 5 h ready for assembly | 2 h dust free |
| Drying at 60 °C | 30 min | 30 min | 20 min |
| Total hardness | after 24 h | after 24 h | after 24 h |
| VOC | — | 419 g/l | 419 g/l |
| Storage temperature | 5–40 °C | 5–40 °C | 5–40 °C |
| Shelf life | 24 months | 24 months | **36 months** |
| TDS revision | 2022, MPV 4.0 | 2022, MPV 4.0 | MPV 4.x |

### 6.2 Primers, filler and cleaner

| Field | `N55-015` 1K Plastic Primer | `N55-V20` 2K PF grey | `N55-V29` 2K PF black | `N60-V20` Body Filler | `N95-060` Silicone Cleaner |
| --- | --- | --- | --- | --- | --- |
| Application | — | 2K VOC | 2K Primer Filler VOC. | Multifunctional Body Filler VOC | — |
| Key features | Primer to provide good adhesion on plastic parts | good filling and drying, easy to sand | Universal VOC sanding filler with good filling and drying properties, easy to sand | Good filling and sanding features. | Used with NORBIN products. |
| Suitable surfaces | — | Direct to old paint and putty | Direct to old paint and putty; steel/galvanised/aluminium after wash primer | Direct to old paint, steel, galvanised… | — |
| Mixing ratio | 1K — ready to use | **5:1:1** | **5:1** | set with integral hardener | — |
| Hardener | — | `N75-020` | `N75-020` | integral 0.05 kg | — |
| Thinner | — | `N85-021` | `N85-025` *(§8.2)* | — | — |
| Spray viscosity (DIN 4, 20 °C) | — | — | 25–29 s | — | — |
| Pot life | — | 1 h | 1 h at 20 °C | 4–6 min at room temperature | — |
| Nozzle | 1.3–1.4 | 1.6–1.8 | 1.6–1.8 | — | — |
| Spray coats | 1–2 thin coats | 3–4 layers, flash off until matt | 2 (also "3–4 layers…") | — | — |
| Flash-off | 15 min before filler application | — | 3 min between coats | — | — |
| Dry film thickness | 10 µm | 50–70 µm (also 70–160 µm) | 50–70 µm (also 70–160 µm) | — | — |
| Drying at 20 °C | — | 3 h | 3 h | 20–30 min | — |
| Drying at 60 °C | — | 30 min | 30 min | — | — |
| Sanding | — | wet; rotary sander | — | orbital, dry | — |
| VOC | — | 539 g/l | — | 249 g/l | — |
| Storage temperature | 5–35 °C | 5–40 °C | 5–40 °C | 5–40 °C | 5–40 °C |
| Shelf life | 24 months | 24 months | 24 months | **12 months** | **60 months** |

`[F]` Both primer fillers print **two** film-thickness figures (50–70 µm and 70–160 µm) on the same
sheet. This is not a contradiction between documents — it is one document giving a per-coat value and a
total-build value without labelling which is which. `[D]` **Publish both, labelled as printed. Do not
silently pick one.**

### 6.3 The legacy product, for the record

`[F]` `N55-V15` 1K Primer Filler VOC — TDS 2022, now withdrawn from EMEA: universal sanding filler;
old paint work, aluminium, steel and galvanised steel; 1K, 100 % by volume, thinned with `N85-025`;
25–30 s DIN 4 at 20 °C; nozzle 1.6–1.7; 2–3 coats; 5 min flash-off; 60–80 µm; ready to sand 60 min at
20 °C / 30 min at 60 °C; VOC 390 g/l; 24 months. Recorded so the code is recognisable, **not for
publication**.

---

## 7. Document matrix

`[F]` EMEA documents, live as of 2026-08-09. All are already downloaded to
`assets/manufacturer/norbin/documents/` — **outside `public/`**, and they stay there in this phase.

| Code | TDS (EN) | SDS (EN), by pack |
| --- | :---: | --- |
| `N15-020` | ✅ `NORBIN_TDS_N15-020_Clear_2022.pdf` | 1 L, 5 L |
| `N15-V20` | ✅ `NORBIN_TDS_N15-V20_Clear_VOC_2022.pdf` | 4 L |
| `N15-V25` | ✅ `N15-V25_Fast_Clear_VOC_2.pdf` | 5 L |
| `N55-015` | ✅ `N55-015_1K_Plastic_Primer.pdf` | 1 L |
| `N55-V20` | ✅ `N55-V20_2K_Primer_Filler_grey.pdf?asdb213ffe` *(see §8.1)* | 2.5 L |
| `N55-V29` | ✅ `N55-V29_2K_Primer_Filler_black.pdf` | 2.5 L |
| `N60-V20` | ✅ `N60-V20_Multifunctional_Body_Filler_Hardener.pdf` | 1.95 kg filler, 0.05 kg hardener |
| `N95-060` | ✅ `N95-060_Silicone_Cleaner.pdf` | 5 L |
| `N75-020` | ❌ none published | 0.5 L |
| `N75-021` | ❌ none published | 0.5 L, 2.5 L |
| `N75-022` | ❌ none published | 2.5 L *(see §8.3)* |
| `N75-V21` | ❌ none published | 1 L |
| `N85-021` | ❌ none published | 1 L, 5 L |
| — | Brochure `NORBIN_Broch_EN_2024_mai.pdf` · Poster `NORBIN_A3-Sheet_Tech-Info_Grey-Shades_230221b_druck.pdf` | |

**Totals `[F]`:** 8 EMEA TDS · 17 EMEA SDS · 1 brochure · 1 technical poster. Across all regions the
local archive holds **99 files, ~44 MB**.

`[D]` The documentation experience must therefore be **per product, not a link dump** — and it must
handle "this product has no TDS" gracefully, because that is true for five of thirteen.

---

## 8. Unresolved conflicts and data defects

**All are recorded, none are fixed in this phase.** Each is carried into the Phase 2 risk register.

### 8.1 `N55-V20` EN technical sheet is missing from the knowledge base

> **⚠ MECHANISM CORRECTED in §13.2 (Phase 1.5).** The link is rejected *upstream*, by the catalogue
> link filter `/\.pdf$/i` in `acquire-norbin-catalog.mjs:114` — not downstream of the download step.

`[F]` The live EMEA page links `files/TDS/N55-V20_2K_Primer_Filler_grey.pdf?asdb213ffe` — note the
cache-busting query string. `[R]` The file **is** on disk at
`assets/manufacturer/norbin/documents/TDS__N55-V20_2K_Primer_Filler_grey.pdf?asdb213ffe`, but it has
**no entry in `norbin-documents.generated.json` and no record in
`norbin-tds-claims.generated.json`**. The `?` in the filename broke registration downstream.

**Consequence:** the repository under-reports EMEA TDS as 7 instead of 8, and is missing the 5:1:1
mixing relationship `N55-V20 + N75-020 + N85-021`, its viscosity, pot life and drying data. Read
manually from the PDF for §5 and §6 of this document. **Severity: high** — it silently removes a
product's entire technical record.

### 8.2 `N85-025` is a phantom partner code

> **⚠ SUPERSEDED by §14.5 (Phase 1.5).** `N85-025` is a **real article in our ERP** (code 507127,
> `NORBIN RAZREĐIVAČ N85-025 1L*`). It is unresolved on the *manufacturer* side only. "Phantom" was wrong.

`[F]` `N85-025` is named as the thinner in the `N55-V29` and `N55-V15` mixing tables, but it appears
in **no** region's product list, has no TDS, no SDS and no pack size anywhere.

`[I]` Most likely a VOC-compliant thinner that was withdrawn or renamed while the TDS text was not
updated — the same document generation that produced the `N55-V15` sheet. **Status: `UNRESOLVED`.**
`[D]` It must never be rendered as a linkable product. If the `N55-V29` mix is ever displayed, the
thinner needs a footnote, not a link.

### 8.3 Manufacturer link error

`[F]` On the live EMEA page the entry labelled *"NORBIN® N75-022 Hardener Slow 2,5L"* links to
`SDS_N75-022_0_5L_en.PDF` — a **0.5 L** document under a **2.5 L** label. Recorded, not corrected. Any
pack-size logic that trusts the SDS filename will be wrong for this one product.

### 8.4 Numeric range fields are inverted in the generated data

`[R]` **77 of 92** claims carrying a structured `range` object have a negated lower bound, because the
parser read `"5-40 °C"` as `5` and `-40`:

| Printed value | Stored `range` |
| --- | --- |
| `5-40 °C` | `{min: -40, max: 5}` |
| `16-18 s` | `{min: -18, max: 16}` |
| `1.3-1.4` | `{min: -1.4, max: 1.3}` |
| `50-60` | `{min: -60, max: 50}` |

The human-readable `.value` string is **correct** in every case; only the structured object is wrong.

`[D]` **Phase 2 rule: render `claim.value`; never read `claim.range`** until the extractor is fixed.
A slider, sort or comparison built on `range` would display negative temperatures and negative nozzle
sizes. **This is a P0 implementation risk.**

### 8.5 Minor defects

| Defect | Detail `[R]` |
| --- | --- |
| Spurious unit | `intendedUse` and `keyFeatures` claims carry `unit: "s"`. Ignore `unit` on non-numeric fields. |
| Unattributed TDS record | `TDS__NORBIN_TDS_N55-V15_1K_Primer_Filler_VOC_2022.pdf` has `code: null` — the code is recoverable from the filename. |
| `N15-V25` VOC field pollution | Four claims are typed `voc` but hold the product code or a features fragment. Free-text VOC claims need review before display. |
| `N15-V20` key features | Stored as `", good hardness, fast drying."` — leading comma from a bad split. |
| Dead source reference | `data/knowledge/brand-sources.ts:46` cites `cxportal.basf.com`, which no longer resolves. |
| Turkish gun-column names | The TR sheets use `Konvansiyonel tabanca` (conventional), not the EN `Compliant gravity-feed`. **Different equipment.** Never merge EN and TR equipment values. |

---

## 9. What Phase 2 may state without guessing

`[D]` Green-lit for publication, all traceable to an official document:

- The 13-product EMEA range, with codes, official names and families.
- All five mixing ratios and the specific hardener/thinner for each.
- The full technical tables in §6, transcribed as printed.
- The grey-shade blend from the official poster.
- Pack sizes as evidenced by the SDS list.
- That `N15-020` in 1 L and 5 L is in our programme.
- That NORBIN EMEA supplies no colour.

**Blocked pending a decision or a document:**

| Item | Blocker |
| --- | --- |
| ~~Anything about `norbin-2k-bezbojni-lak`~~ | **Resolved — §12.** `INVALID_PRODUCT_RECORD`; exclude it |
| ~~Which of the 13 we can supply beyond `N15-020`~~ | **Answered in §14.2** from the ERP stock report |
| Hardener technical values as standalone facts | No TDS exists — they may only appear inside a mix |
| `N85-025` as a product | Real ERP article, no manufacturer listing — §14.5 |
| Any colour/basecoat statement | Contradicted by the source |
| Price, availability, delivery | No source |

---

# PHASE 1.5 — Commercial reconciliation and data integrity

**Added 2026-08-09.** Research only; no product data, publication state or asset was changed.
Sections 10–13 below **supersede** the marked conclusions in §3, §4.4, §8.2 and §9 above; the
superseded text is kept in place with a pointer so the earlier reasoning stays auditable.

---

## 10. The commercial source of record

### 10.1 What was found

`[R]` The Phase 1 pass concluded *"we evidently sell 1 of 13 EMEA products"* on the basis of
`lib/carsystem-data.ts` alone. **That was the wrong source.** The company's actual assortment lives in
an ERP stock report, and one is already cited by existing repository work:

`data/knowledge/befar-stock-evidence.generated.json` names its source as **`lager 23.7.26.pdf`**, a
`carsystem-stock-report` printed **2026-07-23**, and records that the report itself is deliberately
kept out of the repository because it contains prices and quantities.

That report was located and parsed for NORBIN. Its header identifies it unambiguously:

```
CAR SYSTEM I RM · STANJE ZALIHA · Datum štampe: 23.07.2026 · INĐIJA
Poslovni objekti: 021 VELEPRODAJA · Stanje artikla: Svi artikli
```

1 794 article rows in total; **12 of them are NORBIN.**

### 10.2 Discipline applied

This document follows the rule already established by `scripts/extract-befar-stock-evidence.py`:

> *"Sadrži isključivo dokaz o aktivnosti artikla — bez količina, cena i vrednosti lagera. Status nije
> tvrdnja o dostupnosti danas."*

**No quantity, price or stock value from that report appears anywhere in this document.** Only two
derived states are recorded, exactly as the Befar extractor defines them:

| State | Meaning |
| --- | --- |
| `RECENT_STOCK_EVIDENCE` | quantity above zero on the report date |
| `RECENT_ZERO_STOCK` | the article exists in the ERP, quantity zero on the report date |

**Neither is a statement about availability today.** Both prove the article is a live ERP record
rather than a historical artefact.

### 10.3 Two caveats carried forward

1. `[R]` The Befar reconciliation block records that the *intended* source was a filtered XLSX
   (`lager_23-7-26_filtrirani_proizvodi.xlsx`) which was never supplied, and that the full PDF was
   parsed instead — `"Razlike nisu poređene"`. **The same caveat applies to every NORBIN row below.**
2. The report is **17 days old** as of this pass. Zero stock on 2026-07-23 does not mean discontinued,
   and stock on 2026-07-23 does not mean available now.

### 10.4 Corroboration

`[I]` Every pack size in the ERP matches a pack size independently evidenced by the manufacturer's own
SDS list — 0.5 L and 2.5 L hardener, 1 L and 5 L clear, 4 L VOC clear, 1 L thinner, the 2 kg filler
kit. Twelve independent agreements between a Serbian ERP export and a German manufacturer's document
index is not coincidence. **The mapping below is reliable.**

---

## 11. Commercial reconciliation table

`[R]` ERP column = internal article code from the stock report. `[F]` Official columns = manufacturer.

| Manufacturer code | Official product | Our product ID (ERP) | Our slug | Pack | Published | Stock/supply evidence | Current official? | Commercial status | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `N15-020` | Clear | **506494** | `norbin-n15-020-5l` | 5 L | **yes** | `RECENT_STOCK_EVIDENCE` | ✅ EMEA | **`SELLABLE_CURRENT`** | High |
| `N15-020` | Clear | **506493** | `norbin-n15-020-1l` | 1 L | **yes** | `RECENT_ZERO_STOCK` | ✅ EMEA | **`SELLABLE_CURRENT_ZERO_STOCK`** | High |
| `N15-V20` | Clear VOC | **506391** | — | 4 L | no | `RECENT_STOCK_EVIDENCE` | ✅ EMEA | **`SELLABLE_CURRENT`** | High |
| `N15-V25` | Fast Clear VOC | **507911** | — | 5 L | no | `RECENT_STOCK_EVIDENCE` | ✅ EMEA | **`SELLABLE_CURRENT`** | High |
| `N75-020` | Hardener Fast | **507365** | — | 0.5 L | no | `RECENT_STOCK_EVIDENCE` | ✅ EMEA | **`SELLABLE_CURRENT`** | High |
| `N75-021` | Hardener Normal | **506498** | — | 2.5 L | no | `RECENT_STOCK_EVIDENCE` | ✅ EMEA | **`SELLABLE_CURRENT`** | High |
| `N75-021` | Hardener Normal | **506495** | — | 0.5 L | no | `RECENT_ZERO_STOCK` | ✅ EMEA | **`SELLABLE_CURRENT_ZERO_STOCK`** | High |
| `N75-V21` | Clear Hardener VOC | **506392** | — | 1 L | no | `RECENT_STOCK_EVIDENCE` | ✅ EMEA | **`SELLABLE_CURRENT`** | High |
| `N85-021` | Thinner | **507041** | — | 1 L | no | `RECENT_STOCK_EVIDENCE` | ✅ EMEA | **`SELLABLE_CURRENT`** | High |
| `N60-V20` | Multifunctional Body Filler VOC (kit) | **507246** | — | 2 kg kit | no | `RECENT_ZERO_STOCK` | ✅ EMEA | **`SELLABLE_CURRENT_ZERO_STOCK`** | High |
| `N55-V15` | 1K Primer Filler VOC | **507273** | — | 1 L | no | `RECENT_ZERO_STOCK` | ❌ withdrawn from EMEA | **`LEGACY`** | High |
| `N85-025` | *no official EMEA listing* | **507127** | — | 1 L | no | `RECENT_ZERO_STOCK` | ❌ not published by the manufacturer | **`UNRESOLVED`** | Medium |
| `N55-015` | 1K Plastic Primer | — | — | 1 L | no | **absent from the ERP report** | ✅ EMEA | **`NOT_IN_OUR_PROGRAMME`** | Medium |
| `N55-V20` | 2K Primer Filler grey VOC | — | — | 2.5 L | no | **absent from the ERP report** | ✅ EMEA | **`NOT_IN_OUR_PROGRAMME`** | Medium |
| `N55-V29` | 2K Primer Filler black VOC | — | — | 2.5 L | no | **absent from the ERP report** | ✅ EMEA | **`NOT_IN_OUR_PROGRAMME`** | Medium |
| `N75-022` | Hardener Slow | — | — | 2.5 L | no | **absent from the ERP report** | ✅ EMEA | **`NOT_IN_OUR_PROGRAMME`** | Medium |
| `N95-060` | Silicone Cleaner | — | — | 5 L | no | **absent from the ERP report** | ✅ EMEA | **`NOT_IN_OUR_PROGRAMME`** | Medium |
| *none* | *none* | *none* | `norbin-2k-bezbojni-lak` | 1 L / 5 L / "Set" | **no** | none — no ERP article | n/a | **`INVALID_MAPPING`** | High |
| `N15-020` *(mis-typed)* | Clear | `prd-*` mock | *portal demo row* | 1 l | n/a — mock data | none | ✅ code is real | **`INVALID_MAPPING`** | High |

### 11.1 Counts

| Bucket | Articles | Distinct codes |
| --- | ---: | ---: |
| **A — published and commercially available** | 1 | 1 |
| **B — in our data / ERP but zero stock on the report date** | 4 | 4 |
| **C — present but not confirmed as a NORBIN product** | 2 | — |
| **D — official EMEA, not in our programme** | 5 | 5 |
| **E — legacy, must not be presented as current** | 1 | 1 |
| **F — unresolved** | 1 | 1 |

`[I]` The material correction: **our ERP carries 12 NORBIN articles across 10 distinct manufacturer
codes** — 8 of the 13 current EMEA products, plus one legacy and one unlisted. Phase 1's "1 of 13" was
an artefact of reading only the website's product file.

### 11.2 Status assignments explained

- **`SELLABLE_CURRENT`** requires all three: an ERP article, stock evidence on the report date, and
  presence in the current EMEA range. Seven articles qualify.
- **`SELLABLE_CURRENT_ZERO_STOCK`** is the same minus stock on the day. It is *not* a negative signal —
  `N15-020` 1 L is a mainstream pack that simply ran out.
- **`NOT_IN_OUR_PROGRAMME`** is assigned at **Medium** confidence, not High. Absence from one stock
  report is weaker evidence than presence: a product ordered per job may never sit in stock. **This is
  the group most likely to change under review**, and the five products in it are precisely the
  preparation half of the range (cleaner, plastic primer, both primer fillers).
- **`PUBLISHED_BUT_UNCONFIRMED`** and **`INTERNAL_ONLY`** are **not used** — no NORBIN record meets
  either description. They are listed here so their absence is visibly deliberate.

### 11.3 The portal mock-data defect

`[R]` `mock-data/portal/products.ts:50`:

```
["Norbin N15-020 Razređivač", "Norbin", "Učvršćivači", "Razređivači", "1 l", 2190,
 "/products/norbin/norbin-n15-020-1l.jpg"],
```

`N15-020` is a **clearcoat**. `[F]` This row names it a *razređivač* (thinner), files it under
*Učvršćivači* (hardeners), and illustrates it with the clearcoat's photograph. The real NORBIN thinner
is `N85-021`, which our ERP does carry.

This is demo data for the future B2B portal (`mock-data/`), not the public catalogue, so **nothing
customer-facing is wrong today**. It is recorded because it is the kind of error that gets copied into
a real importer. **Not corrected in this phase.**

---

## 12. `norbin-2k-bezbojni-lak` — full investigation

**Supersedes §3.2 above.**

### 12.1 Identity

| Question | Answer | Basis |
| --- | --- | --- |
| Exact manufacturer code | **None. The record has no manufacturer code and never had one.** | `[R]` |
| Exact official product name | Not applicable | `[R]` |
| Is it a NORBIN product? | **No — it is not a product at all.** It is a catalogue template placeholder | `[I]` |
| Is "2K" part of an official name? | **No.** `[F]` Official name is `N15-020 Clear`. "2K" appears in the TDS *description* (*"2K clear coat for all basecoat finishes"*), never in a product name |
| Is "Bezbojni lak" a correct translation? | **Yes as a category term**, no as a product name. `[R]` `data/knowledge/terminology.ts` gives `bezbojni lak` as the canonical Serbian for a clearcoat |

### 12.2 Mapping

**Unresolvable, and the question is moot.** `[I]`

Phase 1 left three candidates open. A pack-size discriminator was tested in this pass and **rejected**:
the record's `packages: ['1 L', '5 L', 'Set']` is byte-for-byte the same triple used by
`rm-diamont-bezbojni-lak`, and the `"Set"` boilerplate recurs on four unrelated legacy records
(`carsystem-soft-plus-git`, `carsystem-finish-cut-polir-pasta`). **The pack sizes are template output,
not evidence.** This is exactly the trap §4 of the Phase 1.5 brief warns about, in a pack-size costume.

With name, slug, SKU and packages all excluded as evidence, and no manufacturer code present, **there
is nothing left that could identify a specific article.** The record does not map to `N15-020`,
`N15-V20`, `N15-V25`, a legacy product, or anything else. It maps to nothing.

### 12.3 Data origin

`[R]` Traced precisely:

| Question | Finding |
| --- | --- |
| Introduced by | commit **`1a7b492`** *"Polish Carsystem website visuals and interactions"*, CollectraMarket, **2026-07-02** |
| Introduced alongside | the same commit added `norbin-n15-020-5l` and `norbin-n15-020-1l` |
| Which array | **`legacyProducts`** (`lib/carsystem-data.ts:628`) — a pool, not the published catalogue |
| Authoring generation | Plain object literal with template boilerplate. The N15-020 pair, added in the same commit, uses the `createProduct()` factory and carries real manufacturer codes |
| Template fingerprint | `longDescription` follows the generic pattern *"… je deo … programa u katalogu. Stranica povezuje upit, dokumentaciju i srodne refinish proizvode."*; `productImage` and `galleryImages` both point at `placeholderProductImage`; documents point at `/documents/placeholder-tds.pdf` with `status: "placeholder"` |
| Importer / catalogue source | **None.** No importer, no CSV, no ERP export produced it. `[I]` It was authored to give the brand a representative clearcoat before real product data existed |
| Client asset drop | `_incoming/fajl-za-sajt/…/norbin-1l-n15-020.jpg` — the client supplied **exactly one** NORBIN image, and it is byte-identical (SHA-256 `18a019b4…`) to `public/products/norbin/norbin-n15-020-1l.jpg`. **No asset was ever supplied for a "2K bezbojni lak".** |

### 12.4 Commercial state — it is not published

**This corrects a Phase 1 error.** The Phase 1 blueprint recorded that the record *"is currently
visible on the live page"*. **It is not, and never has been.**

`[R]` `productRecords` (`lib/carsystem-data.ts:1496`) does **not** spread `legacyProducts`. Records
enter the published catalogue only when named individually via `archivedProduct(slug)`, and there are
exactly four such calls: `rm-diamont-bazna-boja`, `rm-diamont-bezbojni-lak`, `carsystem-soft-plus-git`,
`satajet-x-5500`. **`norbin-2k-bezbojni-lak` is not among them.**

| Check | Result |
| --- | --- |
| Published / routable | **No** — never reaches `products` |
| Price | No — the type has no price field; no product in the repo carries one |
| Stock | No — no ERP article; `publicStatus`/`stockStatus` unset |
| Image | Placeholder SVG only |
| TDS | `/documents/placeholder-tds.pdf`, `status: "placeholder"` |
| SDS | `status: "disabled"` |
| Inbound links | **Zero.** The slug appears on exactly one line in the whole repository — its own declaration |
| In sitemap | **No** — `docs/seo/evidence/sitemap.xml` lists only `/brendovi/norbin`, `/proizvodi/norbin-n15-020-1l`, `/proizvodi/norbin-n15-020-5l` |
| In route inventory / canonical map / metadata / image audit | **No** — zero rows in all four generated SEO artefacts |
| In structured data | **No** — no route, therefore no JSON-LD |
| In search | **No** — the site has no search index over products |

### 12.5 Decision

> ## `INVALID_PRODUCT_RECORD`
> **Confidence: High.**

It has no manufacturer code, a synthetic SKU (`NORBIN-2K-CLEAR`) matching no ERP article, template
boilerplate for every text field, placeholder imagery, placeholder documents, and it is unpublished,
unrouted and unlinked. It is a scaffold left in an unused pool.

`LEGACY_PRODUCT` was considered — it does live in an array named `legacyProducts` — and rejected: a
legacy product is one we *used* to sell, and this one was never sold, never published and never
mapped to an article. The array name describes the pool's role in the codebase, not the record's
commercial history.

**No action taken.** Not deleted, not renamed, not merged, not modified. Recommended Phase 2
treatment: **exclude it from the NORBIN landing page and leave the record untouched** until someone
decides whether to delete it. Because it is unpublished, it is doing no harm where it sits — this is
a cleanup item, not a blocker.

### 12.6 Consequence for Phase 1's P0-1

`[I]` Phase 1 listed *"a decision on `norbin-2k-bezbojni-lak`"* as **P0-1, blocking the product
section**. **It is no longer a blocker.** The record is invalid and unpublished; excluding it requires
no decision from anyone. P0-1 is closed by this investigation.

---

## 13. Data Integrity Findings

### 13.1 The negated-range defect — scope is system-wide, impact today is zero

**Exact cause.** `[R]` Four scripts share a copy-pasted tokenizer:

```js
const numeric = [...withoutCondition.matchAll(/-?\d+(?:[.,]\d+)?/g)]
    .map((m) => Number(m[0].replace(",", ".")));
const isRange = /\d\s*[-–—]\s*\d/.test(withoutCondition) && numeric.length >= 2;
range: isRange ? { min: Math.min(...numeric), max: Math.max(...numeric) } : undefined
```

The `-?` allows a **leading minus**, so in `"5-40 °C"` the hyphen is consumed as a sign: the tokens are
`5` and `-40`, giving `{min: -40, max: 5}`. **The bug is in the tokenizer, not in `Math.min`/`Math.max`** —
those are doing exactly what they were given.

**Exact files and lines:**

| File | Line |
| --- | ---: |
| `scripts/extract-norbin-tds.mjs` | 155, 164 |
| `scripts/extract-carsystem-tds.mjs` | 228, 239 |
| `scripts/extract-carfit-tds.mjs` | 179, 189 |
| `scripts/extract-carfit-website-claims.mjs` | ~110, 116 |

**Exact field:** `claims[].range.{min,max}` in the generated knowledge datasets, and the copies of those
claims inside the brand manifests.

**Scope — this is not a NORBIN problem:**

| Dataset | Ranges | Inverted / negated | Share |
| --- | ---: | ---: | ---: |
| `norbin-tds-claims.generated.json` | 92 | **77** | 83 % |
| `norbin.manifest.generated.json` | 86 | **72** | 83 % |
| `carfit-tds-claims.generated.json` | 159 | **64** | 40 % |
| `carfit.manifest.generated.json` | 175 | **62** | 35 % |
| `carsystem-tds-claims.generated.json` | 189 | **32** | 17 % |
| `carsystem.manifest.generated.json` | 196 | **37** | 19 % |
| `carfit-website-claims.generated.json` | 26 | 1 | 4 % |

`[I]` NORBIN is worst-affected because BASF's `MPV` sheets express nearly every parameter as a
hyphenated range. baslac and R-M use a different extractor and schema and are unaffected.

**Is the displayed `.value` still correct?** `[R]` **Yes, in every case checked.** `.value` holds the
verbatim string from the document (`"5-40 °C"`, `"1.3-1.4"`, `"16-18 s"`) and is untouched by the
tokenizer. The excerpt, page number, SHA-256 and source URL are also unaffected. **Only the derived
numeric object is wrong.**

**Consumers — the important finding:**

| Consumer | Reads `.range`? | Evidence |
| --- | --- | --- |
| Any NORBIN UI | **No** | No NORBIN page exists beyond the generic fallback |
| Any brand page / component / route | **No** | The only `.range` match in `lib/`, `components/`, `app/`, `features/`, `services/` is `styles.range`, a CSS class in `CosmosRange.tsx:31` |
| **The application at all** | **No** | **No runtime file imports `*-tds-claims`, `*.manifest.generated`, `norbin-catalog`, `norbin-documents` or `norbin-match`.** The knowledge datasets are offline research artefacts read only by `scripts/` |
| JSON-LD | **No** | `productJsonLd` (`lib/seo.ts:270`) builds `additionalProperty` from `visibleProductFacts(product)`, i.e. hand-authored `specifications` in `carsystem-data.ts` |
| Filtering / sorting / search | **No** | The site has no search index over products, and no filter reads numeric claim data |
| Dossier / expert-review exporters | **No** | Carry the field through but never render it |

> **Blast radius today: zero.** Nothing user-facing, indexable or machine-readable consumes the
> defective field. This is a **latent** defect.

**Why it still matters.** `[D]` The Phase 1 blueprint proposes rendering TDS claims in section 8 of the
NORBIN page. The moment that is wired up, this becomes a live defect that would publish negative
temperatures and negative nozzle sizes.

**Why the existing validator did not catch it.** `[R]` `scripts/validate-knowledge.mjs` has three
range-related invariants (lines 478, 675, 1020), and all three check the *same wrong thing*: that a
`range` only exists when `.value` contains a dash. That guards against **invented** ranges. **No
invariant asserts `min <= max`.**

**Recommended remediation (later, not now):**

1. Fix the tokenizer in all four scripts — reject a hyphen that follows a digit, e.g. match
   `/(?<![\d.])-?\d+(?:[.,]\d+)?/g`, or split on the range separator before tokenising.
2. Add the missing invariant to `validate-knowledge.mjs`: `range.min <= range.max`, and for the fields
   involved here, `range.min >= 0`.
3. Re-run the affected pipelines and diff the regenerated datasets.
4. Until 1–3 land: **Phase 2 must render `claim.value` and must not read `claim.range`.**

### 13.2 `N55-V20` English TDS — registration failure

**Corrects §8.1 above, which attributed this to the download step.**

| Question | Finding |
| --- | --- |
| Exact file path | `assets/manufacturer/norbin/documents/TDS__N55-V20_2K_Primer_Filler_grey.pdf?asdb213ffe` |
| Exact document name | *NORBIN 2K Primer Filler grey* — `Technical Information`, `N55-V20`, generator stamp `JSON created 2022-12-14T06:08:22+0000, MPV 4.1`, footer `12/2022`, 3 pages |
| Exact source URL | `https://www.norbin-paint.com/files/TDS/N55-V20_2K_Primer_Filler_grey.pdf?asdb213ffe` |
| Is the file valid and current? | **Yes.** SHA-256 of the local copy equals SHA-256 of what the server returns today: `76fc971ad4016e312d6a9c0e0c8ba7d9f42e148bf7ff88b558227377d11e9f93` |
| Linked to the correct product? | **Not linked at all.** `norbin-catalog.generated.json` shows `N55-V20` with a single TDS — the Turkish one. The English sheet is absent from the catalogue, the document registry and the claims set |

**Exact mechanism** — `[R]` `scripts/acquire-norbin-catalog.mjs:114`:

```js
.filter((match) => /\.pdf$/i.test(match[1]))
```

The `$` anchor requires the href to **end** in `.pdf`. The live link ends in `?asdb213ffe`, so it is
rejected **at the catalogue stage — before download, before registration.** Verified:

```
/\.pdf$/i.test(href)      → false     ← current filter
/\.pdf(\?|$)/i.test(href) → true      ← proposed fix
```

`[I]` The file nevertheless exists on disk, under exactly the name `download()` would generate
(`entry.sourceUrl.replace(/^https?:\/\/[^/]+\/files\//, "").replace(/\//g, "__")`). It is an **orphan
from an earlier run**, made before the manufacturer added the cache-busting query string. The current
pipeline would not re-acquire it.

**Are other documents affected?** `[F]` **No — exactly one.** Of 27 live PDF links on the EMEA range
page, exactly one carries a query string, and it is this one. A full disk-versus-registry
reconciliation confirms it:

| Reconciliation | Count | Detail |
| --- | ---: | --- |
| Files on disk | 99 | |
| Registered documents | 102 | |
| **On disk, not registered** | **1** | this file — the only one |
| Registered, not on disk | 4 | `TDS__TR__{N55-121,N75-121,N85-120,N85-121}_TR.pdf` — the four known HTTP 404s at source, already documented in the acquisition report. **Not a new defect** |

`[F]` The `.pdf$` **link filter** appears only in `acquire-norbin-catalog.mjs`. The `.pdf$` patterns in
the baslac, Carfit and Carsystem scripts strip a filename suffix — a different operation, not this bug.

**Does it affect the live product experience?** `[R]` **No — knowledge retrieval only.**
No runtime file imports `norbin-documents.generated.json`, and the two published NORBIN products get
their documents from `documentsOnRequest()` (`lib/carsystem-data.ts:1360`), which emits
`status: "placeholder"` entries for every product. **No NORBIN product currently exposes a real
document to a visitor**, so nothing user-facing is missing this sheet.

**Recommended remediation (later, not now):**

1. Change the filter to `/\.pdf(\?|$)/i` in `acquire-norbin-catalog.mjs:114`.
2. Strip the query string when deriving the stored filename, while keeping it in `sourceUrl` — the
   query is a cache-buster and will change.
3. Re-run `npm run norbin:pipeline`; expect EMEA TDS to go 7 → 8 and `N55-V20` to gain its 5:1:1
   relationship with `N75-020` + `N85-021`, its viscosity, pot life and drying data.
4. Add a pipeline invariant: **every file in the document directory must have a registry entry.** That
   single check would have surfaced this without anyone looking for it.

---

## 14. Commercial range decision

### 14.1 The two questions, kept apart

> **Which products exist in the official NORBIN EMEA universe?**
> **13** — `N15-020`, `N15-V20`, `N15-V25`, `N55-015`, `N55-V20`, `N55-V29`, `N60-V20`, `N75-020`,
> `N75-021`, `N75-022`, `N75-V21`, `N85-021`, `N95-060`. `[F]`

> **Which NORBIN products should the landing page present as OUR programme?**
> **The 10 articles below**, covering **8 manufacturer codes.**

### 14.2 Recommended: present these

`[D]` Every one has an ERP article and is a current EMEA product.

| Code | Product | Packs to show | Note |
| --- | --- | --- | --- |
| `N15-020` | Clear | 5 L, 1 L | The 5 L is our stocked pack; the 1 L is the one we have a photograph of |
| `N15-V20` | Clear VOC | 4 L | |
| `N15-V25` | Fast Clear VOC | 5 L | |
| `N75-020` | Hardener Fast | 0.5 L | Partner to `N55-V20`/`N55-V29` |
| `N75-021` | Hardener Normal | 2.5 L, 0.5 L | Partner to `N15-020` |
| `N75-V21` | Clear Hardener VOC | 1 L | Partner to `N15-V20` and `N15-V25` |
| `N85-021` | Thinner | 1 L | Component of the `N15-V25` mix |
| `N60-V20` | Multifunctional Body Filler VOC | 2 kg kit | Zero stock on the report date |

`[I]` **This set is coherent, and that is the striking part.** It is not a random eight — it is
*every clearcoat in the EMEA range, every hardener that serves them, and the thinner*. Our assortment
is the **clearcoat system**, complete. The five products we do not carry are the preparation half
(cleaner, plastic primer, both primer fillers) and one slow hardener.

`[D]` **That changes the page's argument for the better.** Phase 1 proposed teaching a 13-product
system and admitting we stock one item. The truth is stronger: *we carry the finishing half of the
NORBIN range in full, and the ratio spine in section 4 is entirely buyable from us.* Four of the five
mixing ratios can be shown with both sides in our programme.

### 14.3 Must not be presented as our programme

| Code / record | Reason |
| --- | --- |
| `N55-015`, `N55-V20`, `N55-V29`, `N75-022`, `N95-060` | `NOT_IN_OUR_PROGRAMME` — no ERP article. May appear as *manufacturer range* context in the system layer, never with a price, cart, PDP link or availability implication |
| `N55-V15` | `LEGACY` — withdrawn from EMEA. Present in our ERP at zero stock. **Must never appear as current** |
| `N85-025` | `UNRESOLVED` — see 14.5 |
| `norbin-2k-bezbojni-lak` | `INVALID_PRODUCT_RECORD` — exclude entirely |

### 14.4 The smallest defensible set, if the above is not confirmed

`[D]` If nobody signs off on the ERP-derived list, the floor is:

> **`N15-020`, 5 L** — the only NORBIN article that is simultaneously published on our site, present in
> our ERP, carrying stock evidence, and current in the EMEA range.

Adding the 1 L pack is defensible on the same evidence minus stock on the day. **A one-product page is
a large step down from a coherent eight-product clearcoat system, so confirming §14.2 is the highest-value
question to put to the sales side.**

### 14.5 Unresolved, listed separately

| Item | State | What would resolve it |
| --- | --- | --- |
| **`N85-025`** | Real ERP article **507127**, `NORBIN RAZREĐIVAČ N85-025 1L*`, zero stock. Named as the thinner in the `N55-V29` and `N55-V15` mixing tables. **The manufacturer publishes no TDS, no SDS, no pack size and no product listing for it in any region.** | Ask the supplier whether `N85-025` is still orderable, and whether it was superseded by `N85-021`. **Phase 1 called this a "phantom code" — that is now wrong: the article is real in our ERP.** It is unresolved on the *manufacturer* side, not ours |
| The `*` suffix in `N85-025 1L*` | Meaning unknown. `[F]` The same `*` appears on unrelated non-NORBIN articles (`P500*`, `P1500*`), so it is an ERP naming convention, **not** a NORBIN status marker | Ask whoever maintains the article master |
| The five `NOT_IN_OUR_PROGRAMME` codes | Medium confidence only — absence from one stock report is weaker than presence | Confirm whether any is orderable per job |
| Stock report currency | Dated 2026-07-23; the intended filtered XLSX was never supplied | Supply `lager_23-7-26_filtrirani_proizvodi.xlsx`, or a fresher export |

---

## 15. Corrections to earlier sections of this document

| Section | Said | Now |
| --- | --- | --- |
| §1, §4.4 | *"We evidently sell 1 of 13 EMEA products"* | **8 of 13**, via 12 ERP articles. §11 |
| §3.2 | `norbin-2k-bezbojni-lak` is `ambiguous`, needs a commercial decision | `INVALID_PRODUCT_RECORD`, unpublished, no decision needed. §12 |
| §8.1 | The `?` broke registration *downstream of download* | It is rejected *upstream*, by the catalogue link filter. §13.2 |
| §8.2 | `N85-025` is a "phantom code" | A **real ERP article**; unresolved on the manufacturer side only. §14.5 |
| §9 | *"Which of the 13 we can supply beyond `N15-020`"* is blocked | Answered from the ERP report. §14.2 |
