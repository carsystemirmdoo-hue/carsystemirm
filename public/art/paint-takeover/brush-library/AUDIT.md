# Carsystem Brush Reference Audit

Audit scope:

- `ACTIVE_FULL_SVG`: `spray-six-pass.svg`
- `ISOLATED_PASS_SVG`: `jedna linija.svg`
- one unique `brush-svg-references.zip` package; the second downloaded ZIP is
  byte-identical (`d60bea700482627b0998726a97c78f6931fca45e42831f365ff02bfa26b327b2`)

All 15 SVG documents parse as standard browser SVG. Every document has:

- zero `<image>` nodes;
- zero Base64 payloads;
- zero external file/URL references;
- zero duplicate IDs inside the document;
- zero scripts and `foreignObject` nodes.

`browser-safe` below means structurally safe to open or inline after normal ID
namespacing. It does not mean that a source is light enough for production.

## Exact structural inventory

Element shorthand: `G/P/C/E/M/CP/F` = groups, paths, circles, ellipses, masks,
clipPaths, filters.

| Rank | Exact file | Bytes | viewBox; width × height | Top-level group(s) | G/P/C/E/M/CP/F | Path commands; max/path | Editor-specific data | Browser-safe | Family | Recommended use |
|---:|---|---:|---|---|---|---:|---|---|---|---|
| 1 | `jedna linija.svg` | 127,729 | `0 0 1536 1024`; not set | `spray-pass-03` | `1/7/0/0/0/0/0` | 26,205; 8,953 | Adobe Illustrator 30.2.1 generator comment; no proprietary attrs/namespaces | yes | isolated broad spray-brush pass | Primary model for one hero stroke; clean and decompose before use |
| 2 | `spray-six-pass.svg` | 1,098,013 | `0 0 1536 1024`; `1536 × 1024` | `spray-pass-01` … `spray-pass-06` | `6/42/0/0/0/0/0` | 129,006; 10,824 | none | yes, but not runtime-appropriate | full six-pass composition | Quality, structure and full-composition reference only |
| 3 | `brush-broad-02.svg` | 10,856 | `0 0 1600 800`; not set | `bb02-root` | `5/25/0/18/1/0/0` | 259; 46 | none | yes | broad brush | Direct-shape candidate for curved/diagonal broad strokes |
| 4 | `curved-sweep-01.svg` | 12,518 | `0 0 1600 900`; not set | `cs01-root` | `5/38/0/14/0/0/0` | 352; 70 | none | yes | curved sweep | Direct curved hero shape and curve-following release |
| 5 | `brush-broad-01.svg` | 9,053 | `0 0 1600 600`; not set | `bb01-root` | `5/24/0/16/1/0/0` | 235; 42 | none | yes | broad brush | Direct broad hero shape |
| 6 | `dry-brush-01.svg` | 13,296 | `0 0 1600 500`; not set | `db01-root` | `4/62/0/0/0/0/0` | 420; 10 | none | yes | dry brush | Reusable mask/fragment-wave source |
| 7 | `spray-drag-01.svg` | 16,947 | `0 0 1600 600`; not set | `sd01-root` | `5/5/0/94/0/0/0` | 194; 58 | none | yes | spray drag | Directional spray core and distance-based overspray source |
| 8 | `bristle-overlay-01.svg` | 13,413 | `0 0 1600 500`; not set | `bo01-root` | `4/61/0/0/0/0/0` | 426; 10 | none | yes | bristle overlay | Long/short bristle and fragment overlay |
| 9 | `dry-brush-02.svg` | 11,650 | `0 0 1400 650`; not set | `db02-root` | `4/51/0/0/0/0/0` | 370; 10 | none | yes | dry brush | Secondary diagonal reusable mask |
| 10 | `spray-burst-01.svg` | 18,232 | `0 0 1000 1000`; not set | `sb01-root` | `5/6/0/121/0/0/0` | 74; 16 | none | yes | spray burst | Burst/near/far particle source |
| 11 | `splatter-01.svg` | 14,054 | `0 0 1000 1000`; not set | `sp01-root` | `4/9/0/80/0/0/0` | 111; 17 | none | yes | splatter | Sparse accent source |
| 12 | `scratch-01.svg` | 2,649 | `0 0 1600 500`; not set | `sc01-root` | `4/11/0/0/0/0/0` | 23; 3 | none | yes | scratch | Cheap reusable mask, but too technical for this six-group proof |
| 13 | `thin-flick-01.svg` | 1,329 | `0 0 1600 450`; not set | `tf01-root` | `3/5/0/0/0/0/0` | 12; 3 | none | yes | thin flick | Low-cost normalized line; keep outside this painterly test |
| 14 | `drip-01.svg` | 3,107 | `0 0 800 1200`; not set | `dr01-root` | `4/8/0/5/0/0/0` | 80; 38 | none | yes | drip | Selective gravity-bound accent only |
| 15 | `brush-svg-reference-sheet.svg` | 140,216 | `0 0 4800 7530`; not set | no direct root `<g>`; 52 nested groups in defs/use composition | `52/305/0/348/2/0/0` | 2,556; 70 | none | yes | reference sheet | Catalogue only; never place directly in runtime DOM |

## Group structure and role mapping

- `ACTIVE_FULL_SVG` has six independent top-level groups. Each contains one
  core path and six progressively lighter mist paths. The particle fields are
  encoded as many subpaths inside seven paths per pass, explaining the very
  high anchor count despite the low path count.
- `ISOLATED_PASS_SVG` contains the exact third pass from that structure:
  `stroke-03-core` plus `stroke-03-mist-1` … `stroke-03-mist-6`. The cleaned
  internal copy maps them to:
  - core → `stroke-03-core`;
  - bristles/dense breakup → `mist-1`;
  - fragments → `mist-2`;
  - near/mid/far overspray → `mist-3`, `mist-4`, `mist-5`;
  - terminal release → `mist-6`.
- The ZIP assets already expose useful `data-part` groups:
  - broad: `core`, `bristles`, `fragments`, `overspray`;
  - dry: core/main fragments, fine bristles, detached/release fragments;
  - spray: `core`, near overspray/particles, far particles, end accent/drips;
  - curved: `core`, `bristles`, `fragments`, `release`.

## Complexity conclusion

- The active full SVG is a strong composition and edge-density reference, but
  its ~1.1 MB payload and ~129k path commands disqualify it as a direct hero
  runtime layer.
- The isolated pass is the correct primary anatomical reference, but its
  ~26k commands are still too expensive to duplicate across selected groups.
- The compact ZIP families provide the most practical vocabulary for direct
  shape, mask and overlay adaptation.
- The proof therefore retains the approved group coordinates and directions,
  adds compact nested painterly parts, and uses one deterministic
  curve-following reveal mask per adapted group.
