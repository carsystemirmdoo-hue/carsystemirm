# BEFAR — Product Architecture

Research phase document. No implementation. Companion to `BEFAR_BRAND_RESEARCH.md`.

**Primary source:** official 48-page `PRODUCT CATALOG` PDF, co-branded Befar + Nargil Dış Ticaret
(`https://www.befar.com.tr/_files/ugd/446a5e_9192e551cfa540ae95f10c5247f2587b.pdf`, downloaded 2026-08-09).
**Secondary source:** `befar.com.tr` product pages (Turkish, Wix), `nargildisticaret.com` product pages (English).

Product names below are transcribed from the official catalogue (English) and the Turkish site.
Article codes are Befar's own. Nothing here is invented; anything not printed in a source is marked `UNVERIFIED`.

---

## 1. Top-level structure

Befar does not publish a single canonical taxonomy — the Turkish site, the English export site and the
PDF catalogue each group products slightly differently. The three views:

| befar.com.tr (Turkish site nav) | nargildisticaret.com (export nav) | PDF catalogue running order |
|---|---|---|
| Leo Ürün Serisi | Compounding Foams | Compounding foam (p4–11) |
| Yüzey Kimyasalları | Velcro Polishing Compounding Foam | Hand / applicator foam (p12–13) |
| Seramik Ürünleri | Basic Pads | Die-cut / elips foam (p14) |
| Befar Cırtlı Süngerler | Auto Compound / Polish / Anti Hologram | Plus foam line (p15–21) |
| Aplikatörlü Polisaj Süngerleri | Other Products | Basic pads / backing pads (p22–25) |
| Taban Grubu | Befar +Plus | Wool pads (p26) |
| Setler | Turkuaz *(404 — broken link)* | Foils, tack cloth (p27) |
| Zımpara Grubu | Leo *(404 — broken link)* | Microfibre, non-woven abrasive (p28) |
| Diğer Ürünler | — | Sanding blocks / hand pads (p29–30) |
| Opencell | — | Adaptors, applicators (p31–32) |
| — | — | Compounds & polishes (p33–34) |
| — | — | Leo line (p35–41) |
| — | — | Opencell line (p42–45) |

**Interpretation (ours):** the real architecture is two-axis, not one hierarchy:

- **Axis 1 — product function:** foam pads / backing & interface pads / wool & microfibre / abrasive
  accessories / chemicals / sets / masking & consumables.
- **Axis 2 — product line (tier):** `Befar` (core) → `Befar +Plus` → `Opencell` (newest) → `Leo`
  (detailing) → `turQuaz` (value/eco).

Their own sites only ever express Axis 1 or Axis 2, never both. That is the single biggest
structural opportunity for us.

---

## 2. The colour = hardness system (their most valuable idea)

Printed on nearly every foam page of the catalogue as a two-column legend: `HARDNESS LEVEL` (stars) →
`APPLY WITH`.

### 2.1 Core / classic foam line

| Colour | Hardness | Recommended use (catalogue wording) |
|---|---|---|
| Orange | ★★★★★ | Liquid or cream compound |
| White | ★★★ | Liquid or cream compound |
| Yellow | ★★★ | Liquid or cream compound |
| Blue | ★★ | Liquid or cream compound |
| Black | ★ | Polish or paint protector |

### 2.2 `+Plus` foam line

| Colour | Hardness | Recommended use |
|---|---|---|
| Orange | ★★★★★ | Cream or liquid compound |
| White | ★★★★ | Cream or liquid compound |
| Cherry | ★★★ | Cream or liquid compound |
| Blue | ★★★ | Cream or liquid compound |
| Cream | ★ | Polish or anti hologram |

### 2.3 `Opencell` foam line (newest generation, own colour code)

| Colour | Hardness | Recommended use |
|---|---|---|
| Red | ★★★★ | Cream or liquid compound |
| Yellow | ★★★ | Cream or liquid compound |
| Green | ★★ | Cream or liquid compound |
| Black | ★ | Polish or anti hologram |

**Important:** the three lines use *different* colour→hardness mappings. Black is soft in the core and
Opencell lines; Cream is the soft one in `+Plus`. Any UI we build must scope the colour key to the line,
not to the brand.

> **Accuracy flag for our own catalogue.** `lib/carsystem-data.ts` currently describes Befar orange as
> *"Srednja korekcija i ujednačavanje traga poliranja"* (medium correction). Per Befar's own legend,
> orange is the **hardest** foam in both the core and `+Plus` lines (★★★★★). Black
> (*"fina završna obrada i kontrola holograma"*) is correct. This should be corrected when we touch the
> data — not in this phase.

---

## 3. Category detail

### 3.1 Compounding foam — applicator type (threaded M14 hub, no velcro)

Foam moulded onto a plastic hub with an M14 thread; screws straight onto a rotary polisher.

| Family | Codes | Size | Box qty | Notes |
|---|---|---|---|---|
| Compounding foam | 02401 / 02402 / 02403 / 02404 / 02405 | 150 × 50 mm (black 150 × 45) | 24 | Core line, retail box "24" |
| Compounding foam | 10101–10105 | 180 × 35 mm | 20 | Larger diameter |
| Applicator compounding foam (Plus) | 11001 / 11002 / 11005 / 11007 | 180 × 35 mm | 20 | Plus line |
| Applicator compounding foam | 52402 / 52405 / 52406 / 52407 | 150 × 45 mm | — | Turkish site only |
| Applicator foam (Plus) | 52401–52407 | 150 × 50 mm | 24 | |
| Leo Premium applicator foam | 59507 | 150 × 50 mm | 24 | Cherry |
| Leo Premium **Advance** applicator foam | 59507ADV | 150 × 50 mm | 24 | Cherry, top of range |
| Leo Plus Advance applicator foam | 52401ADV–52407ADV | 150 × 50 mm | 24 | |
| Hand-applicator velcro foam | 14101–14107 | 110 × 10 mm | — | For hand block |
| Wheel-cleaning hand foam | 92201–92206 | standard | — | |
| Velcro hand applicator | 14250 | standard | — | Black |
| Professional hand applicator | 14255 | standard | — | Black |

### 3.2 Compounding foam — velcro (hook & loop) type

| Family | Codes | Size | Box qty |
|---|---|---|---|
| Velcro compounding foam | 03401–03405 | 150 × 50 mm (black 45) | 36 |
| Velcro compounding foam | 04401–04405 | 150 × 25 mm | 66 |
| Velcro **waffle** compounding foam | 04501–04505 | 150 × 25 mm | 66 |
| Velcro compounding foam | 06401–06405 | 180 × 35 mm | 32 |
| Velcro compounding foam | 44801–44805 | 80 × 25 mm | 200 |
| Velcro **conical** compounding foam | 44311–44317 | 30 × 25 mm | 200 |
| Velcro **conical** compounding foam | 44511–44517 | 50 × 25 mm | 200 |
| **Plus** velcro compounding foam | 44808 / 44809 / 44805 / 44807 | 80 × 25 mm | 200 |
| Velcro conical compounding foam | 44811–44817 | 80 × 25 mm | 200 |
| Velcro waffle compounding foam | 448011–448051 | 80 × 25 mm | 200 |
| **Elips die-cut** velcro foam | 20101 / 20102 / 20104 / 20105 | 180 × 35 mm | 32 |
| Plus velcro foam | 54401–54407 | 150 × 25 mm | 66 |
| Plus velcro foam | 56401–56407 | 180 × 35 mm | 32 |
| Plus velcro foam | 58401–58407 | 220 × 35 mm | 20 |
| Plus **Advance** velcro foam | 55401ADV–55407ADV | 150 × 50 mm | 24 |
| Leo Plus Advance velcro foam | 52507ADV | 150 × 50 mm | 24 |
| **Oymalı** (carved) velcro foam | 05801 / 05802 / 58405–58407 | 220 × 35 mm | — |

Pairing rule printed in the catalogue (a real system statement):

- 150 mm foam → **125 mm** velcro basic pad: soft `08401` / middle hard `09501` / hard `09401`
- 180 mm foam → **150 mm** velcro basic pad: soft `08402` / middle hard `09502` / hard `09402`
- 220 mm foam → **170 mm** velcro basic pad: soft `08403` / middle hard `09503` / hard `09403`

### 3.3 Orbital / "air lines" foam (DA machines)

| Family | Codes | Size | Box qty |
|---|---|---|---|
| Plus air-lines orbital velcro foam | 54401ORB–54407ORB | 150 mm | 60 |
| Plus air-lines orbital, 16 holes | 56401ORB–56407ORB | 180 mm | 40 |
| Leo Plus air-lines orbital | 52507ORB | 150 mm | 60 |
| Leo Plus air-lines orbital, 16 holes | 56507ORB | 180 mm | 40 |

### 3.4 Basic pads / backing pads / interface pads

| Family | Codes | Sizes | Notes |
|---|---|---|---|
| Velcro basic pad — soft | 08400 / 08401 / 08402 / 08403 | 75 / 125 / 150 / 170 mm | |
| Velcro basic pad — hard | 09400 / 09401 / 09402 / 09403 | 75 / 125 / 150 / 170 mm | |
| Velcro basic pad — middle hard | 09501 / 09502 / 09503 | 125 / 150 / 170 mm | |
| Velcro basic pad, polyurethane | 96125 / 96150 | 125 / 150 mm | Standard |
| Velcro basic pad for buffing pad | 77776 | 180 mm | Hard |
| **Sandwich** velcro pad | 08401SND / 08402SND / 08403SND | 150 / 170 mm | Turkish site |
| **Backing pad — soft** | 93007 / 93015 / 93062 | 150 mm, 7 / 15 / 62 holes | Sanding interface |
| **Backing pad — hard** | 93107 / 93115 / 93162 | 150 mm, 7 / 15 / 62 holes | Sanding interface |
| **Pad protector** | 93207 / 93215 / 93262 | 150 mm, 7 / 15 / 62 holes | |
| Eco backing pad | 77207 / 77215 | 150 mm, 7 / 15 holes | |
| Pad protector / backing pad | 93700 / 93753 | 120 × 75 mm, no holes / 53 holes | |
| Air machine sanding base | 93000 | 150 mm | |
| Plate-type felt pad | 77776 | 180 mm | Turkish site |
| Leo Detailing pad (middle hard) | 09901 / 09902 | 125 / 145 mm | Yellow |
| Leo Plus triple detailing pad | 59532 / 59533 | 2-in-1 / 3-in-1 (75/125/145) | Yellow |
| Leo Plus microfibre velcro pad | 68130L / 68160L / 68180L | 130 / 160 / 180 mm | |
| Leo Plus microfibre velcro **hard** pad | 78130L / 78160L / 78180L | 130 / 160 / 180 mm | |

### 3.5 Wool pads

| Family | Codes | Sizes |
|---|---|---|
| Velcro woolpad (white) | 07404 / 07405 / 07406 | 150 / 160 / 180 mm |
| Velcro woolpad **Plus** (yellow) | 07604 / 07605 / 07606 | 150 / 160 / 180 mm |

### 3.6 Surface chemicals (compounds, polish, protection)

The chemicals carry a **two-digit family number** printed as a badge on the pack — this number is also
the first two digits of the article code. A genuinely elegant system.

| Product (TR / EN) | Badge | Codes | Sizes |
|---|---|---|---|
| Likit Pasta / **Liquid compound** | 75 | 75250, 75011 | 250 g, 1000 g |
| Oto Cilası / **Auto polish** | 80 | 80250, 80011 | 250 g, 1000 g |
| Hare Giderici / **Anti hologram** | 85 | 85250, 85011 | 250 g, 1000 g |
| Boya Koruma / **Paint protection** | 90 | 90250, 90011 | 250 g, 1000 g |
| Krem Pasta / **Cream compound** | 60 | 60125/60150, 60300, 60400, 60000 | 125–1000 g |
| Ekstra Krem Pasta / **Extra cream compound** | 76 | 76125/76150, 76300, 76400, 76000 | 125–1000 g |
| turQuaz Pasta / Cila | 1 / 2 | 70041, 70046 | — |
| `+Plus` chemicals | — | 77741, 77742, 77746, 77748 | Dark label + colour wave |

### 3.7 Ceramic

| Product | Codes | Size |
|---|---|---|
| Leo Nano paint ceramic protector set | 98030 / 98050 | 30 ml / 50 ml |
| Leo Plus ceramic application block | 800120 / 80012Y / 80012B / 80012R (and `20105R`) | 90 × 40 mm |
| Leo Plus ceramic cloth | 10175TM | 10 × 10 cm, turquoise |

### 3.8 Abrasive accessories & sanding

| Product | Codes | Detail |
|---|---|---|
| Sanding block — soft (orange) | 88010 / 88015 / 88020 | standard / medium / large |
| Sanding block — hard (red) | 89010 / 89015 / 89020 | standard / medium / large |
| turQuaz sanding block — eco (blue) | 78010 / 78015 / 78020 | standard / medium / large |
| Hand pad soft / hard | 95001 / 95002 | no holes |
| Leo slim sanding block | 77010 | 6 × 12.5 cm, white & black |
| Befar sanding block for abrasive paper | 90010 / 90030 | 6.8 × 19.5 / 6.8 × 39.5 cm, red & black |
| Non-woven abrasive — red 280 P | 91030 | 150 × 220 mm |
| Non-woven abrasive — grey 400 P | 91025 | 150 × 220 mm |
| Brite matting felt (TR site) | 91025 / 91030 | 15 × 22 / 15 × 25 cm |

### 3.9 Masking, cloths, consumables

| Product | Codes | Detail |
|---|---|---|
| Static foil | 64005 / 64100 / 64150 / 64300 | 4 × 5 / 100 / 150 / 300 m |
| Half-static foil | 79005 / 79100 / 79150 / 79300 | 4 × 5 / 100 / 150 / 300 m |
| Tack cloth (standard / soft / extra) | 34520 / 34515 / 34510 | Standard: solvent base, 90 × 36 cm, 23 g · Extra: 75 × 36 cm, 18 g · Soft: water + solvent, non-woven |
| Microfibre cloth | 01401 / 01405 / 01407 | 40 × 40 / 40 × 60 cm |
| Auto washing sponge | 92100 | 195 × 60 mm, blue |
| Magic sponge (Leo Plus) | 81011L | 70 × 100 × 30 mm |
| Double-face hand foam | 90207 (Leo "Hamburger") | 115 × 33 mm |
| Plastic putty applicator | 87101 | 115 × 75 mm, red |
| Professional spray-gun plastic cup | 20241 | 600 ml |
| M14 adaptor (drill style) | 97400 | standard |
| Rim cleaner foam (drill style) | 97200 | 80 mm |
| Headlight cleaner foam (drill style) | 83424 | 80 mm |

### 3.10 Sets

| Set | Code | Contents (catalogue) |
|---|---|---|
| **Headlight cleaning set** | 05812 | 2× 76 mm 1000P velcro wet paper, 2× 76 mm 2000P, 1× 75 mm soft velcro basic pad, 1× metal M14/drill adaptor, 1× 80 mm velcro woolpad, 1× No:1 scratch remover compound, 1× 80 mm black polishing foam, 1× No:2 polish, 1× microfibre cloth, 1× glove — 12 pcs |
| **Leo compound polish set** | 150221 | Liquid compound 0.2 kg, auto polish (with silicone) 0.2 kg, 1× microfibre cloth, 1× double-face hand foam |
| **Leo nano ceramic set** | 98030 / 98050 | 1× ceramic liquid, 1× microfibre cloth, 1× glove, 1× ceramic application block, 4× ceramic cloths |
| **Leo Plus mini detailing / cleaning set** | 05712 (yellow) / 05717 (cherry) | 16 pcs |

### 3.11 `Opencell` — newest line (2024/25 era)

Marketed as *"Befar'a özgü üretim teknikleriyle, kullanım ömrü çok daha uzun"* — longer service life
through Befar-specific production techniques (their claim, unverified).

| Family | Codes | Sizes |
|---|---|---|
| Opencell compounding foam | OP1001–OP1004 | 150 × 50 mm |
| Opencell velcro compounding foam | OP2001–OP2004 | 150 × 25 mm |
| Opencell velcro conical foam | OP2011–OP2014 | 165 × 30 mm |
| Opencell velcro conical foam | OP2081–OP2084 | 80 × 30 mm |
| Opencell velcro conic, centred hole | OP3001–OP3004 | 150 × 125 × 25 mm |
| Opencell velcro conic, centred hole | OP3011–OP3014 | 165 × 150 × 30 mm |
| Opencell velcro conic, centred hole | OP3081–OP3084 | 80 × 75 × 30 mm |
| Opencell orbital velcro foam | OP4001–OP4004 | 150 × 125 × 25 mm |
| Opencell air-lines orbital foam | OP4011–OP4014 | 165 × 150 × 25 mm |
| Opencell air-lines orbital foam | OP4081–OP4084 | 80 × 75 × 25 mm |

---

## 4. Article-code grammar (decoded)

Reverse-engineered from the catalogue. Not published by Befar as a rule — this is **our
interpretation**, but it holds across the whole range:

```
0 2 4 0 1
│ │ │ │ └── colour digit: 1=white 2=orange 3=black 4=yellow 5=blue 6=cream 7=cherry
│ │ └─┴──── size / form group (40 = 150 mm class, 80 = 80 mm class …)
└─┴──────── family / line group (02=applicator, 03/04=velcro, 05/06=large,
            52/54/55/56/58=Plus, 59=Leo Premium, 44=small velcro, 93=backing pad,
            08/09=basic pad, 07=wool, 75/80/85/90/60/76=chemicals)
```

Suffixes carry the tier: `ADV` = Advance, `ORB` = orbital / air-lines, `SND` = sandwich,
`L` = Leo microfibre, `OP` prefix = Opencell.

**Why this matters for us:** the code itself encodes colour, size and line. A well-built Befar page can
let a bodyshop navigate by hardness → machine type → diameter and land on the exact code, without any
literature. Nobody in this category does that well.

---

## 5. Real product systems (workflows Befar itself defines)

Befar never draws a process diagram, but the catalogue does state three genuine dependency chains.
These are systems, not marketing:

### System A — Machine polishing stack (explicit in the catalogue)

```
Machine (rotary / orbital)
   └── Velcro basic pad, hardness chosen soft / middle hard / hard
         (125 mm for 150 mm foam · 150 mm for 180 mm · 170 mm for 220 mm)
         └── Foam pad, colour = hardness (★ to ★★★★★)
               └── Matching chemical: cream/liquid compound → polish → anti hologram → paint protection
                     └── Microfibre cloth (01401 / 01407)
```
Sources: catalogue pp. 5–7, 10, 14, 16–20 (pairing notes), pp. 33–34 (chemicals).

### System B — Sanding interface stack

```
Air/electric sander, 150 mm
   └── Machine sanding base (93000)
         └── Backing / interface pad, soft or hard, hole count matched to disc
               (7 / 15 / 62 holes — 93007/93015/93062 soft, 93107/93115/93162 hard)
               └── Pad protector (93207/93215/93262) to extend pad life
                     └── Abrasive disc (not a Befar product)
                           └── Non-woven abrasive 280 P / 400 P for matting (91030 / 91025)
                                 └── Tack cloth before paint (34520 / 34515 / 34510)
```
Sources: catalogue pp. 24–25, 27–28.
**This is the chain that matters most to Carsystem** — it is the one that touches refinish prep, not
just detailing.

### System C — Correction → gloss → protection (the chemical ladder)

```
60/76  Cream compound  →  75  Liquid compound  →  80  Auto polish
                                                    →  85  Anti hologram
                                                          →  90  Paint protection
                                                                →  98  Leo nano ceramic
```
The badge numbers *are* the ladder. Sources: catalogue pp. 33–34, 40.

### System D — Headlight restoration (a packaged, self-contained system)

The only place Befar ships a complete, ordered process in one box: set `05812`, contents listed in
§3.10. Wet-sand 1000P → 2000P → wool pad + scratch remover → black foam + polish → wipe.
Source: catalogue p. 32.

---

## 6. Mapping to our existing Carsystem catalogue

The legacy Carsystem WordPress site (archived, `web.archive.org` snapshots 2022) sold four Befar
sub-categories. Its product image filenames were **Befar article codes**, which lets us map our own
products to Befar's catalogue with confidence:

| Legacy Carsystem product | Legacy image file | Befar code | Befar catalogue entry |
|---|---|---|---|
| SUNĐER ZA POLIRANJE 150 × 50 mm M14 BELI | `240100.jpg` | 02401 | Compounding foam, white, 150 × 50 mm |
| … ORANŽ | `240200.jpg` | 02402 | Compounding foam, orange |
| … CRNI | `240300.jpg` | 02403 | Compounding foam, black, 150 × 45 mm |
| … PLAVI | `240500.jpg` | 02405 | Compounding foam, blue |
| SUNĐER ZA POLIRANJE ČIČAK BELI | `340100.jpg` | 03401 | Velcro compounding foam, white |
| … ORANŽ | `340200.jpg` | 03402 | Velcro compounding foam, orange |
| … PLAVI | `340500.jpg` | 03405 | Velcro compounding foam, blue |
| … CRNI | `440300.jpg` | 04403 | Velcro compounding foam, black, 150 × 25 mm |
| PODLOŠKA ZA SUNĐER MEKANA | `840100.jpg` | 08401 | Velcro basic pad, soft, 125 mm |
| PODLOŠKA ZA SUNĐER TVRDA | `940100.jpg` | 09401 | Velcro basic pad, hard, 125 mm |
| MEĐUPODLOŠKA 15 RUPA MEKA | `930150.jpg` | 93015 | Backing pad, soft, 150 mm, 15 holes |
| MEĐUPODLOŠKA 15 RUPA TVRDA | `931150.jpg` | 93115 | Backing pad, hard, 150 mm, 15 holes |

Source for the legacy names/files: Wayback CDX for `carsystemirm.com` + snapshots
`20220707035802`, `20220815035130`, `20220815041029`, `20220815044434`.

**Consequences:**

1. Our current `lib/carsystem-data.ts` Befar block (8 SKUs = 4 colours × 25/50 mm) collapses two
   distinct Befar families — **M14 applicator** (`024xx`) and **velcro** (`034xx`/`044xx`) — into a
   single "size" axis. Those are different mounting systems, not two sizes of the same thing.
2. We are missing the two accessory families the legacy site actually carried (basic pads
   `08401`/`09401`, backing pads `93015`/`93115`) — and those are precisely the refinish-prep items.
3. Real photography exists for **every one of these twelve codes** on `nargildisticaret.com`
   (`images/urunler/<code>/…`), at 800–5472 px. See `BEFAR_ASSET_INVENTORY.md`.

None of this is changed in this phase. It is recorded for the design/implementation phase.

---

## 7. Hero product candidates

Ranked by ability to carry a landing page visually **and** commercially.

| Rank | Product | Why |
|---|---|---|
| 1 | **Opencell foam line** (OP1001–OP4084) | Their newest, best-photographed, best-designed product. Black foam + green/red/yellow, macro texture, dark studio shots at 3000 px. Has its own logo, its own hardness code, its own claim. This is the natural hero. |
| 2 | **Backing / interface pads with 7 / 15 / 62 holes** (930xx / 931xx / 932xx) | Graphically the strongest objects Befar makes — black discs with precise hole constellations. Also the most relevant to refinish prep, and the item Carsystem already sold. Perfect for a technical, diagrammatic hero. |
| 3 | **Leo line** (59507ADV, 52507ORB, 09901…) | The only sub-brand with a mascot, a colour identity (yellow + charcoal) and a premium register. Strong for a "detailing" chapter. |
| 4 | **Chemicals ladder 60 → 75 → 80 → 85 → 90** | The numbered badge system is a ready-made visual system. Four packs side by side already read as a product family. |
| 5 | **Colour = hardness pad wall** | Not a product but a *display*: white/orange/yellow/blue/black/cherry/cream discs as a hardness scale. The single most useful interactive element we could build. |
| 6 | **Headlight cleaning set 05812** | The only closed, step-by-step system Befar ships. Good for a "system in a box" story. |
| 7 | **Sanding blocks (orange soft / red hard / turQuaz blue eco)** | Simple, bold shapes; instantly legible colour coding. |

---

## 8. Gaps in the product data

| Missing | Impact | Note |
|---|---|---|
| Technical data sheets (TDS) | High | None published on any official source. |
| Safety data sheets (SDS) for chemicals | High | None found. Legally relevant if we list chemicals. |
| Foam density / PPI / cell-structure figures | Medium | Only star ratings exist. "Opencell" implies open-cell foam but no spec is published. |
| Machine speed / pressure guidance | Medium | Only "Max. 2000" moulded on a backing plate (visible in catalogue cover photo). |
| Certifications (ISO, REACH, TSE) | Medium | No certification page or logo found anywhere. |
| Colour charts | N/A | Not applicable — Befar makes no tinted coatings. |
| Which codes Carsystem actually stocks today | High | Business input, not research. |
| Serbian product naming | High | Only the legacy WP names exist; they are inconsistent with Befar's own family names. |
