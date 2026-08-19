# Carsystem Category Mapping Proposal

Research output only — feeds the dedicated taxonomy phase. Does not change
`lib/carsystem-data.ts`, `programGroups`, or any routing. Source: the table
of contents and section content of `Carsystem Produktkatalog 2025.pdf`
(110 pages, printed 2025), cross-checked against the six brochures inventoried
in `docs/CARSYSTEM_DOCUMENT_SOURCE_MAP.md`.

Platform taxonomy (12 categories, per `CLAUDE.md`): Boje, Abrazivi, Kitovi,
Maskiranje, Sprejevi, Oprema, Pribor, Lepkovi, Čišćenje, Zaštita, Poliranje,
Radionica.

Manufacturer taxonomy is evidence, not a template — Carsystem's own catalog
groups things by *workflow stage* (SCHLEIFEN, SPACHTELN, LACKIEREN…), which
doesn't line up one-to-one with our 12 categories. Every row below is a
proposal, not a decision.

## Manufacturer section → platform category

| Manufacturer catalog section (German, printed page) | Contents observed | Proposed category | Confidence |
|---|---|---|---|
| SCHLEIFEN (p. 008) | Sanding discs/strips (F.19, F.23 Ceramic, P.19, P.25 Ceramic), Sanding Blocks 100/198/300/400, Tec Line N20 | **Abrazivi** | CONFIDENT |
| SCHLEIFMITTEL \| ZUBEHÖR (p. 054) | Mixed: abrasive fleece (V.19), backup pads (T.19), sanders/accessories | Split: abrasive items → **Abrazivi**; backup pads, sander accessories → **Pribor** | REVIEW — section bundles material and hardware together, needs product-level split, not a section-level one |
| SPACHTELN (p. 084) | Fillers/putties incl. Multi Green Changer, Multi Blue Changer | **Kitovi** | CONFIDENT |
| ABDECKEN (p. 096) | Masking tape, masking film, masking discs | **Maskiranje** | CONFIDENT |
| LACKIEREN (p. 130) | Base coats, clear coats (incl. CC.26 ECO-X 15/60), primers | Split: coloured base coats → **Boje**; clear coats/primers as chemical product, not colour → borderline **Boje** vs a possible future "lakovi" distinction the platform doesn't have yet | REVIEW — platform's 12 categories don't currently distinguish "boja" (colour) from "lak" (clear/primer); until that's decided, defaulting both to Boje is the closest fit |
| FINISH (p. 150) | Polish X-Serie (Compound X1500, Polish X8000), polishing pads, Microfiber X300 | **Poliranje** | CONFIDENT |
| KLEBEN & BESCHICHTEN (p. 170) | Adhesives/sealants (bonding) and protective coatings/underbody (coating) | Split: adhesives/sealants → **Lepkovi**; protective/underbody coatings → **Zaštita** | AMBIGUOUS — single manufacturer section covers two functionally different platform categories; needs product-level review, not inferred from section title alone |
| REINIGEN (p. 182) | Surface/glass/tool cleaners, Desinfektionsprozess product list (wipes, dispensers, gloves) | **Čišćenje** | CONFIDENT |
| ARBEITSSCHUTZ (p. 196) | PPE — gloves, UV glasses, protective suits, seat/steering wheel covers | **Zaštita** | CONFIDENT — matches the existing "Zaštita radnika" category link already used in `carsystemProcessPhases` (`carsystemBrandData.ts:339`) |
| LACKIERBEDARF (page number not resolved from TOC — appears after ARBEITSSCHUTZ) | Not inspected in this pass — generic "paint shop sundries" catch-all (spray guns, tape dispensers, workshop stools, X-Stand racks per back-of-catalog index) | Likely split across **Oprema**, **Pribor**, **Radionica** | AMBIGUOUS — this section wasn't opened in detail during this phase (only the index/back-matter was sampled); needs its own pass |

## Product-family notes from the brochures (not yet in `lib/carsystem-data.ts`)

- **Multi Blue Changer / Multi Green Changer** (Kitovi, CONFIDENT) — Multi
  Green already has a PDP (`carsystem-git-multi-green`) using
  `programSlug: "priprema-povrsine"`. If Kitovi becomes a real top-level
  category, this product's `programSlug` doesn't have to change — program
  and category are different axes in the current data model.
- **Compound X1500 / Polish X8000 / matched pads / Microfiber X300**
  (Poliranje, CONFIDENT) — no PDP yet; see source map for the missing-SKU
  list.
- **CC.26 ECO-X 15/60** (Boje, REVIEW per the LACKIEREN split above) — no
  PDP yet.

## Tally

- CONFIDENT: 6 (Abrazivi/Schleifen, Kitovi/Spachteln, Maskiranje/Abdecken,
  Poliranje/Finish, Čišćenje/Reinigen, Zaštita/Arbeitsschutz)
- REVIEW: 2 (Schleifmittel|Zubehör split, Lackieren Boje-vs-lak ambiguity)
- AMBIGUOUS: 2 (Kleben & Beschichten split, Lackierbedarf catch-all)

## Explicitly not done in this phase

- No changes to `lib/carsystem-data.ts` categories, `programGroups`, or
  catalog filters.
- LACKIERBEDARF section not inspected page-by-page (only the back-of-catalog
  index was sampled) — flagged as a follow-up, not guessed at.
- No claim that Carsystem's 9-section catalog structure should become the
  platform's category structure — the platform's 12 categories remain a
  separate, deliberate product decision per `CLAUDE.md`.
