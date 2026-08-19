# Carsystem Document Source Map

Internal traceability for the `/katalozi` document library and the Carsystem
brand-page content added in Phase 9A. Not customer-facing. For every claim or
editorial module built from a source PDF, this file records the source
document, the page(s) it came from, what was extracted, and where it landed.

Source package: `Archive 6.zip` (supplied 2026-08-14). Extracted to a scratch
directory, inventoried, then a subset was copied into `public/documents/`.
One file in the archive (`RAČUN 0007.12.08.2026..pdf`, an unrelated
invoice/receipt) was excluded entirely — not a Carsystem product document,
never copied, opened only far enough to confirm it wasn't in scope.

## Documents copied to production

| Document ID (`lib/documents.ts`) | Source file | Pages | Destination |
|---|---|---|---|
| `carsystem-produktkatalog-2025` | Produktkatalog 2025.pdf | 110 | `public/documents/carsystem/catalogs/carsystem-produktkatalog-2025.pdf` |
| `carsystem-polish-x-serie` | Polish X-Serie.pdf | 7 | `public/documents/carsystem/brochures/carsystem-polish-x-serie.pdf` |
| `carsystem-sanding-blocks` | Sanding Blocks.pdf | 5 | `public/documents/carsystem/brochures/carsystem-sanding-blocks.pdf` |
| `carsystem-schleifmittel` | Schleifmittel.pdf | 2 | `public/documents/carsystem/brochures/carsystem-schleifmittel.pdf` |
| `carsystem-schleifmittel-new-collection` | Schleifmittel New Collection.pdf | 2 | `public/documents/carsystem/brochures/carsystem-schleifmittel-new-collection.pdf` |
| `carsystem-multi-changer` | Multi-Changer.pdf | 1 | `public/documents/carsystem/brochures/carsystem-multi-changer.pdf` |
| `carsystem-cc26-eco-x-15-60` | CC.26 ECO-X 15_60.pdf | 5 | `public/documents/carsystem/brochures/carsystem-cc26-eco-x-15-60.pdf` |
| `carsystem-desinfektionsprozess` | Desinfektionsprozess.pdf | 3 | `public/documents/carsystem/guides/carsystem-desinfektionsprozess.pdf` |

Cover art: first-page QuickLook render (macOS `qlmanage -t`), resized and
compressed to WebP via `cwebp` (`public/brands/carsystem/documents/*-cover.webp`,
~9–70 KB each). No cropping/recomposition beyond a straight resize — these are
unmodified brochure cover pages, not extracted product photography.

## Editorial modules and their exact source claims

### Finish system spotlight — `components/carsystem-brand/CarsystemFinishSystem.tsx`

Source: Polish X-Serie.pdf, page 2.

- Compound X1500: "Sehr hoher Cut in den ersten 10 Sekunden" → "very high cut
  in the first 10 seconds." "Nach ca. 15 Sekunden Polierzeit bricht das
  Schleifkorn feiner auf und sorgt für ein ruhiges Polierbild mit hohem
  Glanz" → after ~15s the abrasive grain breaks down finer, producing a calm,
  high-gloss finish. This is why the copy presents Compound X1500 as a
  single self-refining step ("Cut & Refine"), not an invented separate
  "Refine" product — the source only supports two real products.
- Polish X8000: "enthält mikroskopisch kleines Schleifkorn, das selbst
  feinste Kratzer und Hologramme gezielt und kontrolliert entfernt" →
  microscopic abrasive grain removes fine scratches/holograms; "Ideal als
  letzter Polierschritt" → ideal as the last polishing step. Matches the
  "Finish" label used in the module.
- Pad matching (page 3–5): "Passend zur: COMPOUND X1500" for HC/MC pads,
  "Passend zur: POLISH X8000" for the AH pad — this is the source's own
  stated compatibility, not inferred.
- Microfiber X300 Duo (page 6): two-colour cloths for separating rough/fine
  polish stages — included as the accessory line.

No PDP exists yet for Compound X1500 / Polish X8000 (article 160.446–160.457,
DE origin, not yet in `lib/carsystem-data.ts`), so the CTA links to the
`poliranje` catalog program filter, not a fabricated product page. Flagged
below under missing product coverage.

### Multi Changer spotlight — `components/carsystem-brand/CarsystemMultiChanger.tsx`

Source: Multi-Changer.pdf, page 1.

- Multi Blue Changer: "Farbveränderung während der Trocknung von BLAU zu
  GRAU" → colour change during drying, BLUE→GREY. Art.-Nr. 157.623.
- Multi Green Changer: "Farbveränderung während der Aushärtung von GRÜN zu
  GELB" → colour change during curing, GREEN→YELLOW. Art.-Nr. 157.622.
- Both are described as "Polyester-Multifunktionsspachtel" (multi-purpose
  polyester filler) with multi-substrate adhesion (steel, aluminium,
  galvanised sheet, GRP, plastic, 2K polyester filler, wood — per the
  compatibility table on the same page).

The copy deliberately says the colour change is "a visual signal during
drying/curing" and does not claim it proves full cure — the source describes
a colour transition during the process, not a cure-completion indicator, and
no page in the brochure makes that stronger claim either.

Multi Green Changer links to the existing PDP `carsystem-git-multi-green`
(`lib/carsystem-data.ts:1613`), which is the same product family (SKU
`CS-GIT-MULTI-GREEN`). Multi Blue Changer has no PDP yet, so it links to the
filler/"git" catalog query instead of a fabricated product page.

### Curated document rail — `components/carsystem-brand/CarsystemBrandPage.tsx` (`DocumentLibrary`)

No new claims — pulls the four documents flagged `featured: true` in
`lib/documents.ts` (Produktkatalog 2025, Polish X-Serie, Sanding Blocks,
CC.26 ECO-X 15/60) via `getFeaturedDocuments("carsystem")`. CTA links to
`/katalozi?brand=carsystem`.

## Content deliberately left as download-only (no new editorial module)

- **Sanding Blocks.pdf** — real product-family logic exists (Sanding Block
  100 2.0 / 198 2.0 / 300 / 400 2.0, each matched to specific abrasive strip
  types), but it's already represented in the curated document rail and the
  block range appears in the printed 2025 catalog (page ~27 by PDF page
  count). Adding a third dedicated "right tool for the job" module on top of
  the Finish System and Multi Changer spotlights would push the page past
  the "2–4 meaningful moments" ceiling in the brief; the brochure download
  plus the existing P.19/F.19/F.23 abrasive-disc PDPs already cover this.
- **Schleifmittel.pdf / Schleifmittel New Collection.pdf** — genuine
  product-family distinctions (P.19/F.19/V.19/T.19, Jupiter/Jupiter H2O),
  but narrower in scope and lower visual/story strength than the Finish
  System and Multi Changer material. Left as brochure downloads.
- **CC.26 ECO-X 15/60.pdf** — verified technical facts (2K acrylic clear
  coat, 2:1 mixing ratio, no thinner required, 15 min/60°C or 3–4 h/20°C
  drying) are accurate and could support a technical spotlight, but no PDP
  exists for this product yet and a fourth new module would exceed the
  content-density guidance. It's featured in the curated document rail
  instead so it's still prominent, just not narrated.
- **Desinfektionsprozess.pdf** — explicitly process/educational content per
  the brief, not a refinish product story. Document-library only
  (`type: "process-guide"`, not `featured`), not surfaced in the curated
  Carsystem rail.

## Missing product coverage (follow-up, not built here)

No PDP exists for: Compound X1500, Polish X8000, Polishing Pad HC/MC X1500,
Polishing Pad AH X8000, Microfiber X300 Duo, Multi Blue Changer, CC.26
ECO-X 15/60 (articles 160.446–160.457, 157.623, 160.613–160.615). All are
real, current (2026) Carsystem articles per the source brochures. Adding
them to `lib/carsystem-data.ts` is a separate data-import task, deliberately
out of scope for this phase.
