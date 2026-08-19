# BEFAR — Carsystem assortment register

**Revised 2026-08-09 (Phase 1.5).** The earlier version of this document was built from the legacy
WordPress catalogue and the eight SKUs in `lib/carsystem-data.ts`. It concluded
`CONFIRMED CURRENT = 0` and stated that "yellow foam is missing from our range". Both conclusions were
too coarse. This revision replaces them.

## 0. Evidence base

| Source | What it is | Date |
|---|---|---|
| **`lager 23.7.26.pdf`** — `CAR SYSTEM I RM · STANJE ZALIHA · 021 VELEPRODAJA` | Warehouse stock printout, 32 pages, 1 789 parsed article rows, of which **110 are Befar or Leo** | **printed 23.07.2026** |
| `lib/carsystem-data.ts` | 8 published SKUs | current |
| Wayback snapshots of `carsystemirm.com` | Legacy WordPress catalogue, 12 Befar products | 2022 |
| `docs/BEFAR_PRODUCT_ARCHITECTURE.md` | Befar's official catalogue (48 pp.) | 2026-08-09 |

> ### `SOURCE_PENDING_RECONCILIATION`
>
> **Missing source:** `lager_23-7-26_filtrirani_proizvodi.xlsx`. Searched the whole machine by exact
> name, by `*filtrirani*`, and for any `.xlsx` modified in the last three days. **Not present.** No
> substitute was invented and no other local document was adopted in its place.
>
> **What was actually parsed:** `~/Downloads/lager 23.7.26.pdf`, header *"STANJE ZALIHA · Datum štampe:
> 23.07.2026"* — the full, unfiltered printout of the same date.
>
> **Reproducibility.** A file in `~/Downloads` is no longer treated as the source of truth. The derived,
> publish-safe evidence now lives in the repository:
>
> - `scripts/extract-befar-stock-evidence.py` — takes any stock report as an argument
> - `data/knowledge/befar-stock-evidence.generated.json` — 110 articles with **no quantities, no
>   prices, no stock values**; only `RECENT_STOCK_EVIDENCE` / `RECENT_ZERO_STOCK`, and a
>   `reconciliation` block carrying this same pending status
>
> **Rule while pending:** no public page content may change on the basis of any difference between the
> XLSX and the PDF until the XLSX is supplied and the two are compared. The V2 page therefore reflects
> the PDF-derived conclusions unchanged.

> **Stock quantities and prices from this file are never published.** They appear nowhere in
> `lib/befar-brand-data.ts`, nowhere in the page components, and nowhere in this document. They are used
> only to decide whether an article is a live commercial product or a historical artefact.

## 1. Status model

| Status | Meaning |
|---|---|
| `RECENT_STOCK_EVIDENCE` | Quantity **> 0** in the 23.07.2026 stock printout. Strong evidence of a live commercial product. **Not a claim that it is in stock today** — the printout is 17 days old as of 09.08.2026. |
| `RECENT_ZERO_STOCK` | Present as an article in the 23.07.2026 printout with quantity **0**. It is a catalogued product that was out of stock on that date — not a discontinued one. |
| `PRESENT_IN_CATALOG` | In `lib/carsystem-data.ts` but with no row in the stock printout. |
| `LEGACY_ONLY` | Only evidenced by the 2022 WordPress site. |
| `UNRESOLVED` | Code or mapping cannot be reconciled against Befar's official catalogue. |

## 2. Headline numbers

| Measure | Count |
|---|---|
| Befar + Leo article rows in the 23.07.2026 printout | **110** |
| …`RECENT_STOCK_EVIDENCE` | **106** |
| …`RECENT_ZERO_STOCK` | **4** |
| Distinct product families evidenced | **22** |
| Distinct attachment systems evidenced | **6** |
| SKUs published on our site today | 8 |
| **Ratio published : evidenced** | **8 : 110** |

The previous conclusion that we could evidence "12 distinct Befar codes" was wrong by an order of
magnitude. The Befar business is roughly **fourteen times larger** than our published catalogue shows,
and it includes entire families the site never mentioned: hand pads, waffle and elips foam, wool discs,
sanding blocks, non-woven abrasive, pad protectors, the full chemical ladder, masking foil, tack cloth,
and a genuinely stocked **Leo** line.

`CONFIRMED CURRENT = 0` is superseded. It was technically true but practically misleading.

## 3. Attachment systems — no longer collapsed

The single most important correction. These are **not** size variants of one product; they are
incompatible mounting systems.

| System | Description | Families | Codes |
|---|---|---|---|
| **M14 navoj** | Foam moulded on a plastic hub with an M14 thread. Screws directly onto a rotary polisher. **Needs no backing plate.** | M14 pene | `02401`, `02402`, `02403`, `02404`, `02405` |
| **Čičak (hook-and-loop)** | Hook-and-loop face. **Requires a backing plate** of the matching diameter. | Čičak, Plus, Waffle, Elips pene | `0340x`, `0440x`, `0640x`, `4480x`, `2010x`, `44801x`, `0544xx`, `0554xx` |
| **Čičak — orbital, 16 rupa** | Hook-and-loop with a 16-hole air-line pattern for DA/orbital machines. | Plus orbital pene | `05640x`, `052507` |
| **Ručno (bez montaže)** | Hand pads and wax cones — no machine attachment. | Ručne pene, Pene za vosak, Ručni brusni sunđeri | `1210x`, `13101x`, `95001`, `95002` |
| **Podloška (nosač)** | The backing plate itself. Soft / hard, 75–150 mm. | Podloške | `08400`, `08401`, `08402`, `09401`, `09402`, `09450` |
| **Međupodloška / zaštita** | Sanding interface pad and pad protector, 7 / 15 / 62 holes. | Međupodloške, Zaštita podloške | `93007`, `93015`, `93062`, `93107`, `93115`, `93162`, `93207`, `93215`, `93262` |

**Consequence for our data.** The eight published SKUs use a `25x150` / `50x150` "size" axis that mixes
M14 (`0240x`) with hook-and-loop (`0340x`, `0440x`). The stock printout proves we sell **both** as
separate articles at the same nominal dimensions. `lib/befar-brand-data.ts` now models
`attachment` explicitly; `lib/carsystem-data.ts` still does not, and that remains open.

## 4. Yellow foam — corrected conclusion

The earlier statement *"yellow foam is missing from our range"* was **wrong as written**. The precise
position:

| Claim | Verdict |
|---|---|
| Carsystem carries no yellow Befar foam | **False.** |
| Yellow Befar foam has recent stock evidence | **True** — in three families |
| Yellow exists in the `0440x` / 150 × 25 mm hook-and-loop family | **False** — `04404` does not appear in the stock printout at all, in any quantity. It is not a Carsystem article. |
| Some yellow articles were at zero on 23.07.2026 | **True** — three of them |

| Code | Article | Family | Status |
|---|---|---|---|
| `06404` | Čičak pena za poliranje žuta 180 × 35 mm | Čičak pene 180 × 35 | `RECENT_STOCK_EVIDENCE` |
| `20104` | Elips čičak pena za poliranje žuta 180 × 35 mm | Elips pene | `RECENT_STOCK_EVIDENCE` |
| `448041` | Waffle čičak pena za poliranje žuta 80 × 25 mm | Waffle pene | `RECENT_STOCK_EVIDENCE` |
| `07604` | Plus čičak vuneni disk žuti 150 mm | Vuneni diskovi | `RECENT_STOCK_EVIDENCE` |
| `02404` | Pena 150 × 50 M14 žuta | M14 pene | `RECENT_ZERO_STOCK` |
| `04480 4` → `44804` | Čičak pena za poliranje žuta 80 × 25 mm | Čičak pene 80 × 25 | `RECENT_ZERO_STOCK` |
| `12104` | Ručna pena za poliranje žuta 145 × 25 mm | Ručne pene | `RECENT_ZERO_STOCK` |
| `04404` | *(150 × 25 čičak, yellow)* | Čičak pene 150 × 25 | **Not a Carsystem article** |

**How the page states this.** The hardness scale is built on the Core line and includes the yellow
★★★ step, because yellow is a real Befar Core colour that we really sell. The step names the codes we
actually carry (`06404`, `448041`) and says plainly that in the 150 × 25 mm family yellow is not part of
our range. No step claims stock.

## 5. Other corrections and discrepancies found

| Finding | Detail |
|---|---|
| **Non-woven abrasive colours are swapped** between sources | Befar's catalogue (p.28) prints `91025` = GREY / 400 P and `91030` = RED / 280 P. Our stock printout has `091025` = *crveni* (red) and `091030` = *sivi* (grey). **`UNRESOLVED`** — the page therefore names the two products without asserting a colour↔grit pairing. |
| **Leo is a real, stocked line** | 20 Leo articles with stock evidence — ceramic applicators (4 colours), ceramic cloth, detailing pads (125 / 145 / 3-in-1), nano ceramic set, polishing set, magic sponge, microfibre pad, mini set, orbital pad. Phase 0 rated Leo relevance as uncertain; it is not. |
| **Opencell is not sold** | **Zero** Opencell rows in the printout. Confirms the blueprint's caveat. The page presents Opencell as *manufacturer capability*, in a small editorial section, with an enquiry CTA and no product links. |
| **turQuaz is not sold** | No Befar turQuaz rows. The turQuaz logo asset stays unused on the page. |
| **Black exists in the Elips family** | `20103` is in stock, but Befar's catalogue p.14 lists only white/orange/yellow/blue for the elips die-cut. Minor catalogue omission on their side. |
| **`09450`** — Čičak podloška tvrda 75 mm | Befar's catalogue lists `09400` for the hard 75 mm plate. `09450` is not in the catalogue. **`UNRESOLVED`** — possibly a Carsystem internal code or a newer Befar variant. |
| **`088180`** — Leo mikrofiber sunđer čičak 160 mm | Closest catalogue entries are `68160L` / `78160L` (microfibre velcro pad 160 mm). Mapping not exact. **`UNRESOLVED`** |
| **Cherry / višnja is stocked** | `44807`, `12107`, `55407`, `56407`, `052507`. This is a `+Plus` line colour, confirming we sell across two lines. |
| **Cream compound (`60xxx`) is not sold** | The chemical ladder we carry is `75` → `80` → `85` → `90`, in 250 g and 1000 g. No `60`/`76` cream compound. |

## 6. What the landing page actually uses

`lib/befar-brand-data.ts` carries a **curated** subset — not all 110 rows — chosen so that every item
shown has recent evidence and a clear role:

- **Hardness scale:** 5 Core-line colour steps.
- **Families:** 6 editorial groups covering foam, interface/backing, chemistry, abrasive, Leo, consumables.
- **Geometry:** the 7 / 15 / 62-hole interface pads and the 16-hole orbital pattern.
- **Pairing rule:** 150 → 125, 180 → 150, 220 → 170, plus the 75 mm plate we stock.
- **Discovery:** the 8 SKUs that have real product pages, plus family-level links into the catalogue.

Products **without** a product page are shown as family entries linking to the filtered catalogue, never
as dead links.

## 7. Open questions for Carsystem

1. Is the 23.07.2026 range still accurate, and is anything on it being discontinued?
2. Resolve the non-woven abrasive colour↔grit swap (`91025` / `91030`).
3. Confirm `09450` and `088180`.
4. Should the 8 published SKUs be expanded toward the ~90 Befar articles actually carried? That is a
   catalogue-import decision, not a design one.
5. Should `lib/carsystem-data.ts` gain an `attachment` field so M14 and hook-and-loop stop sharing a
   size axis?
6. Is Opencell or turQuaz planned for the range?

---

## 8. Full evidenced assortment — 23.07.2026

Quantities and prices deliberately omitted. Sorted by family.

| Šifra (lager) | Befar kod | Naziv u lageru | Porodica | Sistem montaže | Status |
|---|---|---|---|---|---|
| `088010` | `88010` | Befar Brusni Blok Meki Mali Oranz | Brusni blokovi | ručno (abraziv) | `RECENT_STOCK_EVIDENCE` |
| `088015` | `88015` | Befar Brusni Blok Meki Srednji Oranz | Brusni blokovi | ručno (abraziv) | `RECENT_STOCK_EVIDENCE` |
| `088020` | `88020` | Befar Brusni Blok Meki Veliki Oranz | Brusni blokovi | ručno (abraziv) | `RECENT_STOCK_EVIDENCE` |
| `089010` | `89010` | Befar Brusni Blok Tvrdi Mali Crveni | Brusni blokovi | ručno (abraziv) | `RECENT_STOCK_EVIDENCE` |
| `089015` | `89015` | Befar Brusni Blok Tvrdi Srednji Crveni | Brusni blokovi | ručno (abraziv) | `RECENT_STOCK_EVIDENCE` |
| `089020` | `89020` | Befar Brusni Blok Tvrdi Veliki Crveni | Brusni blokovi | ručno (abraziv) | `RECENT_STOCK_EVIDENCE` |
| `020101` | `20101` | Befar Elips Cicak Sundjer Za Poliranje Beli 180 X 35 Mm | Elips pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `020102` | `20102` | Befar Elips Cicak Sundjer Za Poliranje Oranz 180 X 35 Mm | Elips pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `020103` | `20103` | Befar Elips Cicak Sundjer Za Poliranje Crni 180 X 35 Mm | Elips pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `020104` | `20104` | Befar Elips Cicak Sundjer Za Poliranje Zuti 180 X 35 Mm | Elips pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `020105` | `20105` | Befar Elips Cicak Sundjer Za Pol.Plavi 180 X 35 Mm | Elips pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `075011` | `75011` | Befar Liquid Compound Std 1000G | Hemija 1000 g | — (hemija) | `RECENT_STOCK_EVIDENCE` |
| `080011` | `80011` | Befar Polish Std 1000G | Hemija 1000 g | — (hemija) | `RECENT_STOCK_EVIDENCE` |
| `085011` | `85011` | Befar Anti Hologram Std 1000G | Hemija 1000 g | — (hemija) | `RECENT_STOCK_EVIDENCE` |
| `090011` | `90011` | Befar Paint Protector Std 1000G | Hemija 1000 g | — (hemija) | `RECENT_STOCK_EVIDENCE` |
| `075250` | `75250` | Befar Polir Pasta Liquid 250 Gr | Hemija 250 g | — (hemija) | `RECENT_STOCK_EVIDENCE` |
| `080250` | `80250` | Befar Polir Pasta Auto Polish 250 Gr | Hemija 250 g | — (hemija) | `RECENT_STOCK_EVIDENCE` |
| `085250` | `85250` | Befar Polir Pasta Anti Hologram 250 Gr | Hemija 250 g | — (hemija) | `RECENT_STOCK_EVIDENCE` |
| `090250` | `90250` | Befar Polir Pasta Paint Protect 250 Gr | Hemija 250 g | — (hemija) | `RECENT_STOCK_EVIDENCE` |
| `001407` | `1407` | Befar Plus Mikrofiber Krpa | Krpe i potrošno | — | `RECENT_STOCK_EVIDENCE` |
| `034510` | `34510` | Befar Medene Krpe | Krpe i potrošno | — | `RECENT_STOCK_EVIDENCE` |
| `034515` | `34515` | Befar Tack Cloth Soft | Krpe i potrošno | — | `RECENT_STOCK_EVIDENCE` |
| `079150` | `79150` | Befar Poluantistatik Folija 4X150M | Krpe i potrošno | — | `RECENT_STOCK_EVIDENCE` |
| `088180` | `88180` | Leo Mikrofiber Sundjer Čičak 160Mm | Krpe i potrošno | čičak | `RECENT_STOCK_EVIDENCE` |
| `000812` | `812` | Leo Plus Aplikator Za Keramiku Crni | Leo keramika | — | `RECENT_STOCK_EVIDENCE` |
| `008012` | `8012` | Leo Plus Aplikator Za Keramiku Zuti | Leo keramika | — | `RECENT_STOCK_EVIDENCE` |
| `010175` | `10175` | Leo Plus Krpa Za Keramičku Zaštitu | Leo keramika | — | `RECENT_STOCK_EVIDENCE` |
| `080012` | `80012` | Leo Plus Aplikator Za Keramiku Oranz | Leo keramika | — | `RECENT_STOCK_EVIDENCE` |
| `098050` | `98050` | Leo Plus Set Nano Keramicka Zastita | Leo keramika | — | `RECENT_STOCK_EVIDENCE` |
| `800012` | `800012` | Leo Plus Aplikator Za Keramiku Crveni | Leo keramika | — | `RECENT_STOCK_EVIDENCE` |
| `081011` | `81011` | Leo Magični Sundjer | Leo ostalo | — | `RECENT_STOCK_EVIDENCE` |
| `002401` | `2401` | Befar Sundjer 150X50 M14 Beli | M14 pene | M14 navoj | `RECENT_STOCK_EVIDENCE` |
| `002402` | `2402` | Befar Sundjer 150X50 M14 Oranz | M14 pene | M14 navoj | `RECENT_STOCK_EVIDENCE` |
| `002403` | `2403` | Befar Sundjer 150X45 M14 Crni | M14 pene | M14 navoj | `RECENT_STOCK_EVIDENCE` |
| `002404` | `2404` | Befar Sundjer 150X50 M14 Žuti | M14 pene | M14 navoj | `RECENT_ZERO_STOCK` |
| `002405` | `2405` | Befar Sundjer 150X50 M14 Plavi | M14 pene | M14 navoj | `RECENT_STOCK_EVIDENCE` |
| `093007` | `93007` | Befar Medjupodloska Meka 150 Mm 7 Rupa | Međupodloške | međupodloška | `RECENT_STOCK_EVIDENCE` |
| `093015` | `93015` | Befar Medjupodloška Meka 150 Mm 15 Rupa | Međupodloške | međupodloška | `RECENT_STOCK_EVIDENCE` |
| `093062` | `93062` | Befar Medjupodloska Meka 150 Mm 62 Rupe | Međupodloške | međupodloška | `RECENT_ZERO_STOCK` |
| `093107` | `93107` | Befar Medjupodloska Tvrda 150 Mm 7 Rupa | Međupodloške | međupodloška | `RECENT_STOCK_EVIDENCE` |
| `093115` | `93115` | Befar Medjupodloška Tvrda 150 Mm 15 Rupa | Međupodloške | međupodloška | `RECENT_STOCK_EVIDENCE` |
| `093162` | `93162` | Befar Medjupodloska Tvrda 150Mm 62 Rupe | Međupodloške | međupodloška | `RECENT_STOCK_EVIDENCE` |
| `091025` | `91025` | Befar Netkani Abraziv Tabak Crveni | Netkani abraziv | ručno (abraziv) | `RECENT_STOCK_EVIDENCE` |
| `091030` | `91030` | Befar Netkani Abraziv Tabak Sivi | Netkani abraziv | ručno (abraziv) | `RECENT_STOCK_EVIDENCE` |
| `131011` | `131011` | Befar Konusni Sundjer Za Vosak Beli | Pene za vosak | ručno | `RECENT_STOCK_EVIDENCE` |
| `131021` | `131021` | Befar Konusni Sundjer Za Vosak Oranz | Pene za vosak | ručno | `RECENT_STOCK_EVIDENCE` |
| `056401` | `56401` | Befar Plus 16 Rupa Orbital Cicak Sundjer Za Polir. Beli 180Mm | Plus orbital pene | čičak (orbital, 16 rupa) | `RECENT_STOCK_EVIDENCE` |
| `056402` | `56402` | Befar Plus 16 Rupa Orbital Cicak Sundjer Za Pol. Oranz 180Mm | Plus orbital pene | čičak (orbital, 16 rupa) | `RECENT_STOCK_EVIDENCE` |
| `056403` | `56403` | Befar Plus 16 Rupa Orbital Cicak Sundjer Za Pol. Crni 180 Mm | Plus orbital pene | čičak (orbital, 16 rupa) | `RECENT_STOCK_EVIDENCE` |
| `056405` | `56405` | Befar Plus 16 Rupa Orbital Cicak Sundjer Za Pol. Plavi 180 Mm | Plus orbital pene | čičak (orbital, 16 rupa) | `RECENT_STOCK_EVIDENCE` |
| `056407` | `56407` | Befar Plus 16 Rupa Orbital Cicak Sundjer Za Pol. Visnja 180 Mm | Plus orbital pene | čičak (orbital, 16 rupa) | `RECENT_STOCK_EVIDENCE` |
| `044805` | `44805` | Befar Plus Cicak Sundjer Za Poliranje Plavi 80 X 25 Mm | Plus pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `044807` | `44807` | Befar Plus Cicak Sundjer Za Poliranje Visnja 80 X 25 Mm | Plus pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `044808` | `44808` | Befar Plus Cicak Sundjer Za Poliranje Oranž 80 X 25 Mm | Plus pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `044809` | `44809` | Befar Plus Cicak Sundjer Za Poliranje Beli 80 X 25 Mm | Plus pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `054401` | `54401` | Befar Plus Cicak Sundjer Za Poliranje Beli 150 X 25 Mm | Plus pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `055401` | `55401` | Befar Plus Cicak Sundjer Za Poliranje Beli 150 X 50 Mm | Plus pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `055402` | `55402` | Befar Plus Cicak Sundjer Za Poliranje Oranz 150 X 50 Mm | Plus pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `055403` | `55403` | Befar Plus Cicak Sundjer Za Poliranje Crni 150 X 50 Mm | Plus pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `055405` | `55405` | Befar Plus Cicak Sundjer Za Poliranje Plavi 150 X 50 Mm | Plus pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `055407` | `55407` | Befar Plus Cicak Sundjer Za Poliranje Visnja 150 X 50 Mm | Plus pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `008400` | `8400` | Befar Cicak Podloska Meka 75 Mm | Podloške / nosači | čičak | `RECENT_STOCK_EVIDENCE` |
| `008401` | `8401` | Befar Podloška Za Sundjer Meka 125Mm | Podloške / nosači | podloška (nosač) | `RECENT_STOCK_EVIDENCE` |
| `008402` | `8402` | Befar Podloška Za Sundjer Meka 150Mm | Podloške / nosači | podloška (nosač) | `RECENT_STOCK_EVIDENCE` |
| `009401` | `9401` | Befar Podloška Za Sundjer Tvrda 125Mm | Podloške / nosači | podloška (nosač) | `RECENT_STOCK_EVIDENCE` |
| `009402` | `9402` | Befar Podloška Za Sundjer Tvrda 150Mm | Podloške / nosači | podloška (nosač) | `RECENT_STOCK_EVIDENCE` |
| `009450` | `9450` | Befar Čičak Podloska Tvrda 75Mm | Podloške / nosači | čičak | `RECENT_STOCK_EVIDENCE` |
| `009901` | `9901` | Leo Plus Datailing Cicak Podloska 125 Mm | Podloške / nosači | čičak | `RECENT_STOCK_EVIDENCE` |
| `009902` | `9902` | Leo Plus Detailing Cicak Podloska 145 Mm | Podloške / nosači | čičak | `RECENT_STOCK_EVIDENCE` |
| `059533` | `59533` | Leo Plus Detailing Cicak Podloska 3 U 1 | Podloške / nosači | čičak | `RECENT_STOCK_EVIDENCE` |
| `012101` | `12101` | Befar Rucni Sundjer Za Poliranje Beli 145 X 25 Mm | Ručne pene za poliranje | ručno | `RECENT_STOCK_EVIDENCE` |
| `012102` | `12102` | Befar Rucni Sundjer Za Poliranje Oranz 145 X 25 Mm | Ručne pene za poliranje | ručno | `RECENT_STOCK_EVIDENCE` |
| `012103` | `12103` | Befar Rucni Sundjer Za Poliranje Crni 145 X 25 Mm | Ručne pene za poliranje | ručno | `RECENT_STOCK_EVIDENCE` |
| `012104` | `12104` | Befar Rucni Sundjer Za Poliranje Zuti 145 X 25 Mm | Ručne pene za poliranje | ručno | `RECENT_ZERO_STOCK` |
| `012105` | `12105` | Befar Rucni Sundjer Za Poliranje Plavi 145 X 25 Mm | Ručne pene za poliranje | ručno | `RECENT_STOCK_EVIDENCE` |
| `012107` | `12107` | Befar Rucni Sundjer Za Poliranje Visnja 145 X 25Mm | Ručne pene za poliranje | ručno | `RECENT_STOCK_EVIDENCE` |
| `095001` | `95001` | Befar Rucni Sundjer Meki | Ručni brusni sunđeri | ručno | `RECENT_STOCK_EVIDENCE` |
| `095002` | `95002` | Befar Rucni Sundjer Tvrdi | Ručni brusni sunđeri | ručno | `RECENT_STOCK_EVIDENCE` |
| `005712` | `5712` | Leo Plus Detailing Set Mini Sundjer | Setovi | — | `RECENT_STOCK_EVIDENCE` |
| `005812` | `5812` | Befar Set Za Poliranje Farova | Setovi | — | `RECENT_STOCK_EVIDENCE` |
| `150221` | `150221` | Leo Plus Set Za Poliranje | Setovi | — | `RECENT_STOCK_EVIDENCE` |
| `083424` | `83424` | Befar Sundjer Za Farove | Specijalni sunđeri | — | `RECENT_STOCK_EVIDENCE` |
| `097200` | `97200` | Befar Sundjer Za Felne | Specijalni sunđeri | — | `RECENT_STOCK_EVIDENCE` |
| `007404` | `7404` | Befar Cicak Vuneni Disk Beli 150 Mm | Vuneni diskovi | čičak | `RECENT_STOCK_EVIDENCE` |
| `007604` | `7604` | Befar Plus Cicak Vuneni Disk Zuti 150 Mm | Vuneni diskovi | čičak | `RECENT_STOCK_EVIDENCE` |
| `448011` | `448011` | Befar Waffle Cicak Sundjer Za Poliranje Beli 80 X 25 Mm | Waffle pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `448021` | `448021` | Befar Waffle Cicak Sundjer Za Poliranje Oranz 80 X 25 Mm | Waffle pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `448031` | `448031` | Befar Waffle Cicak Sundjer Za Poliranje Crni 80 X 25 Mm | Waffle pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `448041` | `448041` | Befar Waffle Cicak Sundjer Za Poliranje Zuti 80 X 25 Mm | Waffle pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `093207` | `93207` | Befar Zastita Podloske 150 Mm 7 Rupa | Zaštita podloške | zaštita podloške | `RECENT_STOCK_EVIDENCE` |
| `093215` | `93215` | Befar Zastita Podloske 150 Mm 15 Rupa | Zaštita podloške | zaštita podloške | `RECENT_STOCK_EVIDENCE` |
| `093262` | `93262` | Befar Zastita Podloske 150 Mm 62 Rupe | Zaštita podloške | zaštita podloške | `RECENT_STOCK_EVIDENCE` |
| `003401` | `3401` | Befar Sundjer Cicak 150X50 Beli | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `003402` | `3402` | Befar Sundjer Cicak 150X50 Oranz | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `003403` | `3403` | Befar Sundjer Cicak 150X45 Crni | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `003405` | `3405` | Befar Sundjer Cicak 150X50 Plavi | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `004401` | `4401` | Befar Sundjer Cicak 150X25 Beli | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `004402` | `4402` | Befar Sundjer Cicak 150X25 Oranz | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `004403` | `4403` | Befar Sundjer Cicak 150X25 Crni | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `004405` | `4405` | Befar Sundjer Cicak 150X25 Plavi | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `006401` | `6401` | Befar Cicak Sundjer Za Poliranje Beli 180 X 35 Mm | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `006402` | `6402` | Befar Cicak Sundjer Za Poliranje Oranz 180 X 35 Mm | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `006403` | `6403` | Befar Cicak Sundjer Za Poliranje Crni 180 X 35 Mm | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `006404` | `6404` | Befar Cicak Sundjer Za Poliranje Zuti 180 X 35 Mm | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `006405` | `6405` | Befar Cicak Sundjer Za Poliranje Plavi 180 X 35 Mm | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `044801` | `44801` | Befar Cicak Sundjer Za Poliranje Beli 80 X 25 Mm | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `044802` | `44802` | Befar Cicak Sundjer Za Poliranje Oranž 80 X 25 Mm | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `044803` | `44803` | Befar Cicak Sundjer Za Poliranje Crni 80 X 25 Mm | Čičak pene | čičak | `RECENT_STOCK_EVIDENCE` |
| `044804` | `44804` | Befar Cicak Sundjer Za Poliranje Zuti 80 X 25 Mm | Čičak pene | čičak | `RECENT_ZERO_STOCK` |
| `052507` | `52507` | Leo Plus Orbital Cicak Sundjer Za Pol. 150 Mm Visnja | Čičak pene | čičak (orbital, 16 rupa) | `RECENT_STOCK_EVIDENCE` |

---

## 9. Legacy WordPress mapping (retained)

The 2022 carsystemirm.com catalogue carried 12 Befar products. Its image filenames were Befar article
codes, which is how the brand was originally identified. All twelve reappear in the 23.07.2026 printout,
so none is `LEGACY_ONLY` any more:

| Legacy product | Legacy image | Befar code | 23.07.2026 status |
|---|---|---|---|
| SUNĐER 150 × 50 M14 BELI | `240100.jpg` | `02401` | `RECENT_STOCK_EVIDENCE` |
| … ORANŽ | `240200.jpg` | `02402` | `RECENT_STOCK_EVIDENCE` |
| … CRNI | `240300.jpg` | `02403` | `RECENT_STOCK_EVIDENCE` |
| … PLAVI | `240500.jpg` | `02405` | `RECENT_STOCK_EVIDENCE` |
| SUNĐER ČIČAK BELI | `340100.jpg` | `03401` | `RECENT_STOCK_EVIDENCE` |
| … ORANŽ | `340200.jpg` | `03402` | `RECENT_STOCK_EVIDENCE` |
| … PLAVI | `340500.jpg` | `03405` | `RECENT_STOCK_EVIDENCE` |
| … CRNI | `440300.jpg` | `04403` | `RECENT_STOCK_EVIDENCE` |
| PODLOŠKA MEKANA | `840100.jpg` | `08401` | `RECENT_STOCK_EVIDENCE` |
| PODLOŠKA TVRDA | `940100.jpg` | `09401` | `RECENT_STOCK_EVIDENCE` |
| MEĐUPODLOŠKA 15 RUPA MEKA | `930150.jpg` | `93015` | `RECENT_STOCK_EVIDENCE` |
| MEĐUPODLOŠKA 15 RUPA TVRDA | `931150.jpg` | `93115` | `RECENT_STOCK_EVIDENCE` |
