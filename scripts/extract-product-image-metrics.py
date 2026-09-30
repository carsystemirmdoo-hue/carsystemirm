#!/usr/bin/env python3
"""Deterministic geometry + palette metrics for every product image in `public/`.

Why this exists
---------------
Product images in this repository are official brand renders delivered on a
fixed square canvas (745 of 838 files are 800x800). The product itself fills a
very different share of that canvas per file — measured here, the median image
uses only 39% of the canvas WIDTH. A tall 500 ml spray can and a squat 1 L tin
therefore arrive as the same 800x800 asset with wildly different amounts of
transparent padding baked in.

Every `object-fit: contain` in the UI fits the CANVAS, not the product, so the
S/M/L/XL scale envelope in `lib/product-scale.ts` was effectively being applied
to transparent pixels. This script measures the real content box once, at build
time, so the runtime can size the PRODUCT instead of its padding.

It also samples a foreground palette so decorative art can react to a product's
real colour without a browser-side extraction pass (no hydration drift, no CLS).

Nothing here invents product data. The output describes pixels only: where the
opaque content sits inside its own file, and which colours cover the most area.

Usage
-----
    python3 scripts/extract-product-image-metrics.py [--check]

`--check` re-derives the manifest and exits non-zero if it differs from the
committed file, without writing.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = PROJECT_ROOT / "public"
OUTPUT_PATH = PROJECT_ROOT / "data/product-image-metrics.generated.json"
CSS_OUTPUT_PATH = (
    PROJECT_ROOT / "components/product/ProductImageFit.generated.module.css"
)

# Directories that hold product renders. Brand-page art, maps, icons and social
# exports are deliberately excluded — they are never rendered inside a product
# visual surface, so measuring them would only inflate the manifest.
SOURCE_DIRS = (
    "products",
    "images/products",
    "images/brands/rm/products",
    # Reviewed display derivatives (scripts/catalog/image-remaster/remaster.py).
    "remastered",
)

RASTER_SUFFIXES = {".webp", ".png", ".jpg", ".jpeg"}

# Alpha at or below this is treated as "not part of the product". Official
# renders carry a soft antialiased edge; 24/255 keeps the real silhouette while
# discarding the halo that would otherwise inflate the content box by a few px.
ALPHA_FLOOR = 24
# Max 90th-percentile deviation (0–255) of the border rings for a backdrop to
# count as flat enough to be continued by a plate of one colour.
BACKDROP_FLAT_TOLERANCE = 8

# For opaque files (28 of them — mostly older .jpg/.png sources) the background
# is inferred from the border ring. A channel distance above this counts as
# content. Deliberately generous: a false "no trim" is safe, a false trim is not.
OPAQUE_BG_TOLERANCE = 18

# Palette quantisation: 5 bits per channel (32 levels) merges shading gradients
# on a single moulded part into one bucket, while still separating a red cap
# from a black body.
PALETTE_BITS = 5
PALETTE_LEVELS = 1 << PALETTE_BITS

# A cluster must cover at least this share of the product before it is reported
# as an accent. Keeps a 200 px logo or a line of legal text off the palette.
MIN_CLUSTER_SHARE = 0.06
MAX_PALETTE_ENTRIES = 3

# --- V6 subject fit + official-shadow model (Carsystem only) ------------------
#
# `box` above is the bounding box of everything with alpha > 24. Official
# Carsystem renders bake a soft shadow / reflection / 1 px frame into that alpha,
# so the box describes product + shadow and the scale envelope ends up sizing the
# shadow. The fields below describe the SUBJECT instead. They are ADDITIVE:
# `box`, `aspect`, `fx/fy/ox/oy`, `tone` and `palette` keep their meaning, because
# the PDP stage format, the contrast mode and the visual recipes read them.
#
# Scope is an explicit allowlist. Every other brand's manifest entry and CSS rule
# stays byte-identical; emptying this tuple restores today's output exactly.
# The second prefix is the reviewed DISPLAY derivative of a Carsystem file
# (`public/remastered/...`, see lib/productImageDisplay.ts): surfaces draw the
# derivative, so its subject and baked shadow are measured on its own pixels.
SUBJECT_FIT_PREFIXES = ("/products/carsystem/", "/remastered/products/carsystem/")
DISPLAY_DERIVATIVE_ROOT = "/remastered"
FIT_MODEL_VERSION = 1
# A V6 CSS rule is only worth shipping when the subject box differs from the
# legacy box by more than this share of the canvas (0.5 % = ~3 px at 660 px).
# Below that the two fits are visually identical and the legacy rule is reused.
SUBJECT_RULE_MIN_DELTA = 0.005

# Geometry only - no RGB, no luminance (a red can and a black can must behave
# the same). Thicknesses are expressed at the 660 px reference width.
SUBJECT_CORE_ALPHA = 250      # opaque subject core
SUBJECT_DETAIL_ALPHA = 128    # a translucent part this visible still belongs to the subject
SUBJECT_RIM_PX = 2            # antialiased edge around the core
GROUND_BAND = 0.35            # lowest share of the core height that counts as "at ground level"
SHADOW_STRONG_LATERAL = 0.10
SHADOW_STRONG_THICKNESS = 5.0
SHADOW_STRONG_COVERAGE = 0.2
SHADOW_THIN_THICKNESS = 1.5
SHADOW_THIN_COVERAGE = 0.25
SHADOW_THIN_LATERAL = 0.04

# Reviewed by eye and left undecided on purpose (THIN/STRONG boundary). `unknown`
# renders like `thin`: exactly one weaker anchored CSS shadow, never two layers.
OFFICIAL_SHADOW_OVERRIDES = {
    "/products/carsystem/catalog/carsystem-glass-fibre-reinforced-putty.webp": "unknown",
}


def iter_source_files() -> list[Path]:
    files: list[Path] = []
    for relative in SOURCE_DIRS:
        root = PUBLIC_ROOT / relative
        if not root.exists():
            continue
        files.extend(
            path
            for path in root.rglob("*")
            if path.is_file() and path.suffix.lower() in RASTER_SUFFIXES
        )
    return sorted(set(files))


def public_href(path: Path) -> str:
    return "/" + path.relative_to(PUBLIC_ROOT).as_posix()


def content_mask(rgba: np.ndarray) -> tuple[np.ndarray, str, str | None]:
    """Boolean mask of product pixels, how it was derived, and the flat backdrop colour.

    The backdrop (hex) is only reported for "opaque-border" files: it lets a dark
    stage paint its plate in the photo's own studio colour instead of showing the
    photo as a light rectangle ("sticker") on a dark surface.
    """
    alpha = rgba[:, :, 3]
    if int(alpha.min()) < 255:
        return alpha > ALPHA_FLOOR, "alpha", None

    # Opaque file: infer the flat backdrop from the border ring. Using the ring
    # (not a single corner) means a stray corner artefact cannot decide the crop.
    rgb = rgba[:, :, :3].astype(np.int16)
    ring = np.concatenate(
        [
            rgb[0, :, :],
            rgb[-1, :, :],
            rgb[:, 0, :],
            rgb[:, -1, :],
        ]
    )
    background = np.median(ring, axis=0)
    distance = np.abs(rgb - background).max(axis=2)
    mask = distance > OPAQUE_BG_TOLERANCE

    # If the "background" covers less than half the border, the file simply has
    # no backdrop to trim (a full-bleed photo). Keep the whole canvas.
    border_background_share = float((distance[0, :] <= OPAQUE_BG_TOLERANCE).mean())
    if border_background_share < 0.5 or not mask.any():
        return np.ones(mask.shape, dtype=bool), "canvas", None

    # A light box only works when the backdrop is FLAT all the way round: a
    # studio gradient (lighter centre, darker corners) cannot be matched by one
    # plate colour and is presented as a photograph instead. Measured on the
    # outer ring and on a ring 3% inside it; flat exports sit at 0–6/255,
    # gradient studio shots at 11+.
    height, width = distance.shape
    inset = max(2, int(min(height, width) * 0.03))
    rings = np.concatenate(
        [
            distance[0, :], distance[-1, :], distance[:, 0], distance[:, -1],
            distance[inset, inset:-inset], distance[-inset - 1, inset:-inset],
            distance[inset:-inset, inset], distance[inset:-inset, -inset - 1],
        ]
    )
    if float(np.percentile(rings, 90)) > BACKDROP_FLAT_TOLERANCE:
        return mask, "opaque-border", None

    backdrop = "#" + "".join(f"{int(round(channel)):02x}" for channel in background)
    return mask, "opaque-border", backdrop


def relative_luminance(rgb: np.ndarray) -> np.ndarray:
    linear = np.where(
        rgb <= 0.04045,
        rgb / 12.92,
        ((rgb + 0.055) / 1.055) ** 2.4,
    )
    return linear @ np.array([0.2126, 0.7152, 0.0722])


def sample_palette(rgb: np.ndarray, mask: np.ndarray) -> list[dict[str, object]]:
    """Largest-area colour clusters of the product itself."""
    pixels = rgb[mask]
    if pixels.size == 0:
        return []

    shift = 8 - PALETTE_BITS
    keys = (
        (pixels[:, 0] >> shift).astype(np.int32) * PALETTE_LEVELS * PALETTE_LEVELS
        + (pixels[:, 1] >> shift).astype(np.int32) * PALETTE_LEVELS
        + (pixels[:, 2] >> shift).astype(np.int32)
    )
    unique, counts = np.unique(keys, return_counts=True)
    order = np.argsort(counts)[::-1]

    total = float(len(keys))
    palette: list[dict[str, object]] = []
    for index in order[: MAX_PALETTE_ENTRIES * 4]:
        share = float(counts[index]) / total
        if share < MIN_CLUSTER_SHARE:
            break
        bucket = keys == unique[index]
        mean = pixels[bucket].mean(axis=0)
        palette.append(
            {
                "hex": "#%02x%02x%02x" % tuple(int(round(channel)) for channel in mean),
                "share": round(share, 4),
            }
        )
        if len(palette) == MAX_PALETTE_ENTRIES:
            break
    return palette


def _dilate(mask: np.ndarray, steps: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(steps):
        out[1:, :] |= out[:-1, :]
        out[:-1, :] |= out[1:, :]
        out[:, 1:] |= out[:, :-1]
        out[:, :-1] |= out[:, 1:]
    return out


def _bbox(mask: np.ndarray) -> list[int] | None:
    rows = np.flatnonzero(mask.any(axis=1))
    cols = np.flatnonzero(mask.any(axis=0))
    if rows.size == 0 or cols.size == 0:
        return None
    return [int(cols[0]), int(rows[0]), int(cols[-1] - cols[0] + 1), int(rows[-1] - rows[0] + 1)]


def measure_subject(alpha: np.ndarray, legacy_box: list[int]) -> dict[str, object] | None:
    """Subject box + official-shadow class for one alpha channel, or None.

    None means "keep the legacy fit": an opaque file, a file without a usable
    opaque core, or a result that fails the sanity checks below.

    A soft pixel (24 < alpha < 250, outside the antialiased rim) is judged by
    WHERE it sits relative to the core's own bottom profile:
      - below the core in its column, or beside the core inside the ground band
        -> shadow zone, never part of the subject;
      - anywhere else (above the core, beside it higher up, inside a hole)
        -> subject detail, kept when it is at least half visible.
    So a translucent lid or a fading trouser leg stays in the box, and a baked
    shadow does not.
    """
    height, width = alpha.shape
    if int(alpha.min()) == 255:
        return None

    visible = alpha > ALPHA_FLOOR
    core = alpha >= SUBJECT_CORE_ALPHA
    if int(core.sum()) < 0.05 * max(int(visible.sum()), 1):
        return None
    core_box = _bbox(core)
    if core_box is None:
        return None

    rim = _dilate(core, SUBJECT_RIM_PX) & visible
    soft = visible & (alpha < SUBJECT_CORE_ALPHA) & ~rim

    has_core = core.any(axis=0)
    bottom = np.where(has_core, height - 1 - core[::-1, :].argmax(axis=0), -1)
    yy = np.arange(height)[:, None]
    below = has_core[None, :] & (yy > bottom[None, :] + 2)
    ground_top = core_box[1] + core_box[3] - GROUND_BAND * core_box[3]
    lateral_low = (~has_core)[None, :] & (yy >= ground_top)
    shadow_zone = soft & (below | lateral_low)
    detail = soft & ~shadow_zone & (alpha >= SUBJECT_DETAIL_ALPHA)

    subject = core | rim | detail
    # 1 px opening: a single stray pixel must not be able to move the box.
    subject = _dilate(~_dilate(~subject, 1), 1) | core

    # A tall translucent mass UNDER the core (a clear bottle below an opaque cap)
    # is a subject, not a shadow: keep it and refuse to classify the shadow.
    translucent_below = False
    below_strong = soft & below & (alpha >= SUBJECT_DETAIL_ALPHA)
    if int(below_strong.sum()) >= 0.10 * int(core.sum()):
        strong_box = _bbox(below_strong)
        if strong_box and strong_box[3] >= 0.25 * core_box[3] and strong_box[2] / max(strong_box[3], 1) < 2.5:
            translucent_below = True
            subject = subject | below_strong

    box = _bbox(subject)
    if box is None:
        return None

    # --- sanity: anything odd falls back to the legacy fit ----------------------
    lx, ly, lw, lh = legacy_box
    x, y, w, h = box
    inside_legacy = x >= lx and y >= ly and x + w <= lx + lw and y + h <= ly + lh
    covers_core = (
        x <= core_box[0]
        and y <= core_box[1]
        and x + w >= core_box[0] + core_box[2]
        and y + h >= core_box[1] + core_box[3]
    )
    if not inside_legacy or not covers_core or w < 8 or h < 8:
        return None
    if w * h < 0.25 * lw * lh or min(lw / w, lh / h) > 1.4:
        return None

    # --- official shadow: soft mass UNDER the product's own bottom profile ------
    scale = width / 660.0
    under = soft & below
    thickness = under.sum(axis=0)[has_core] / scale
    coverage = float((thickness >= 3).mean()) if thickness.size else 0.0
    mean_thickness = float(thickness.mean()) if thickness.size else 0.0
    band = soft & lateral_low
    lateral = float((band.sum(axis=0) >= 3 * scale).sum()) / max(core_box[2], 1)

    if translucent_below:
        shadow = "unknown"
    elif lateral >= SHADOW_STRONG_LATERAL or (
        mean_thickness >= SHADOW_STRONG_THICKNESS and coverage >= SHADOW_STRONG_COVERAGE
    ):
        shadow = "strong"
    elif (
        mean_thickness >= SHADOW_THIN_THICKNESS
        or coverage >= SHADOW_THIN_COVERAGE
        or lateral >= SHADOW_THIN_LATERAL
    ):
        shadow = "thin"
    else:
        shadow = "none"

    return {
        "fitModelVersion": FIT_MODEL_VERSION,
        "subjectBox": box,
        "subjectAspect": round(w / h, 4),
        "subjectCenter": [round((x + w / 2) / width, 4), round((y + h / 2) / height, 4)],
        "officialShadow": shadow,
    }


def measure(path: Path, href: str | None = None) -> dict[str, object] | None:
    with Image.open(path) as source:
        image = source.convert("RGBA")
        rgba = np.asarray(image)

    height, width = rgba.shape[:2]
    if width == 0 or height == 0:
        return None

    mask, mask_source, backdrop = content_mask(rgba)
    if not mask.any():
        return None

    rows = np.flatnonzero(mask.any(axis=1))
    cols = np.flatnonzero(mask.any(axis=0))
    top, bottom = int(rows[0]), int(rows[-1]) + 1
    left, right = int(cols[0]), int(cols[-1]) + 1
    box_width = right - left
    box_height = bottom - top

    rgb = rgba[:, :, :3]
    luminance = relative_luminance(rgb[mask].astype(np.float64) / 255.0)
    median_luminance = float(np.median(luminance))

    # `tone` describes the PRODUCT, not its label: it drives whether decorative
    # art needs to sit lighter or darker than the packaging to stay separate.
    if median_luminance < 0.09:
        tone = "very-dark"
    elif median_luminance < 0.3:
        tone = "dark"
    elif median_luminance > 0.78:
        tone = "very-light"
    elif median_luminance > 0.62:
        tone = "light"
    else:
        tone = "mid"

    metrics: dict[str, object] = {
        "w": width,
        "h": height,
        "box": [left, top, box_width, box_height],
        # Fractions are what the CSS actually consumes; rounding to 4 decimals
        # keeps the manifest diff-stable across Pillow patch versions.
        "fx": round(box_width / width, 4),
        "fy": round(box_height / height, 4),
        "ox": round(left / width, 4),
        "oy": round(top / height, 4),
        "aspect": round((box_width / box_height) if box_height else 1.0, 4),
        "luminance": round(median_luminance, 4),
        "tone": tone,
        "boxSource": mask_source,
        "palette": sample_palette(rgb, mask),
        **_subject_fields(rgba, href, [left, top, box_width, box_height], mask_source),
    }
    if backdrop is not None:
        metrics["backdrop"] = backdrop
    return metrics


def _subject_fields(
    rgba: np.ndarray, href: str | None, legacy_box: list[int], mask_source: str
) -> dict[str, object]:
    """Additive V6 fields - only for allowlisted paths, only for alpha-derived boxes."""
    if not href or not href.startswith(SUBJECT_FIT_PREFIXES) or mask_source != "alpha":
        return {}
    subject = measure_subject(rgba[:, :, 3], legacy_box)
    if subject is None:
        return {}
    # Overrides are reviewed per product image and keyed by its identity path;
    # a display derivative inherits the decision made for its original.
    identity = href[len(DISPLAY_DERIVATIVE_ROOT):] if href.startswith(DISPLAY_DERIVATIVE_ROOT + "/") else href
    if identity in OFFICIAL_SHADOW_OVERRIDES:
        subject["officialShadow"] = OFFICIAL_SHADOW_OVERRIDES[identity]
    return subject


def build_manifest() -> dict[str, object]:
    images: dict[str, object] = {}
    skipped: list[str] = []
    for path in iter_source_files():
        try:
            metrics = measure(path, public_href(path))
        except Exception as error:  # noqa: BLE001 — one bad file must not stop the pass
            skipped.append(f"{public_href(path)}: {error}")
            continue
        if metrics is None:
            skipped.append(f"{public_href(path)}: empty content mask")
            continue
        images[public_href(path)] = metrics

    return {
        "schemaVersion": 1,
        "note": (
            "Generated by scripts/extract-product-image-metrics.py. Pixel geometry "
            "only — no product specification is derived from these numbers."
        ),
        "counts": {"images": len(images), "skipped": len(skipped)},
        "skipped": skipped,
        "images": dict(sorted(images.items())),
    }


CSS_HEADER = """/*
 * GENERATED — do not edit. Source: scripts/extract-product-image-metrics.py
 *
 * One rule per product image, keyed by the image's own public path. Each rule
 * publishes where the product actually sits inside its file so a surface can
 * fit the PRODUCT instead of the transparent canvas around it. See
 * `lib/product-image-metrics.ts` for why that distinction matters.
 *
 * Why generated CSS and not a generated module: the catalog renders its cards
 * from a client component, so a lookup table would have to be shipped as
 * JavaScript (~300 KB) or threaded through every one of the eight call sites
 * that mount a product surface. A stylesheet reaches all of them by matching
 * the `data-product-fit` attribute the surface already knows how to emit, costs
 * no JS parse time, and degrades to canvas-fit for any image without a rule.
 */
"""


V6_CSS_HEADER = """
/*
 * V6 subject fit - Carsystem only (SUBJECT_FIT_PREFIXES in the generator).
 *
 * Same five properties as above, measured on the SUBJECT instead of on
 * "everything with alpha": baked shadows, reflections and 1 px frames no longer
 * shrink or shift the product. Opt-in per surface via data-product-fit-model="v6";
 * without that attribute the legacy rule above still applies.
 */
"""


def build_css(manifest: dict[str, object]) -> str:
    lines = [CSS_HEADER, "\n.fit {\n"]
    # Defaults describe an untrimmed canvas, so an image with no rule below
    # behaves exactly as `object-fit: contain` always did.
    lines.append("  --product-canvas-aspect: 1;\n")
    lines.append("  --product-content-aspect: 1;\n")
    lines.append("  --product-content-fill-x: 1;\n")
    lines.append("  --product-content-fill-y: 1;\n")
    lines.append("  --product-content-offset-x: 0;\n")
    lines.append("  --product-content-offset-y: 0;\n")
    lines.append("}\n")

    def number(value: float) -> str:
        return f"{value:.4f}".rstrip("0").rstrip(".") or "0"

    images: dict[str, dict[str, object]] = manifest["images"]  # type: ignore[assignment]
    for href, metrics in images.items():
        canvas_aspect = float(metrics["w"]) / float(metrics["h"])  # type: ignore[arg-type]
        lines.append(
            f'\n.fit[data-product-fit="{href}"] {{\n'
            f"  --product-canvas-aspect: {number(canvas_aspect)};\n"
            f"  --product-content-aspect: {number(metrics['aspect'])};\n"  # type: ignore[arg-type]
            f"  --product-content-fill-x: {number(metrics['fx'])};\n"  # type: ignore[arg-type]
            f"  --product-content-fill-y: {number(metrics['fy'])};\n"  # type: ignore[arg-type]
            f"  --product-content-offset-x: {number(metrics['ox'])};\n"  # type: ignore[arg-type]
            f"  --product-content-offset-y: {number(metrics['oy'])};\n"  # type: ignore[arg-type]
            f"{dark_matte(metrics)}"
            "}\n"
        )

    # V6 subject fit. Appended AFTER every legacy rule and keyed on an extra
    # attribute, so (a) the block above is byte-identical to the pre-V6 output and
    # (b) a surface without `data-product-fit-model="v6"` keeps the legacy fit.
    # Only emitted where the subject box actually differs from the legacy box.
    v6_rules: list[str] = []
    for href, metrics in images.items():
        subject_box = metrics.get("subjectBox")
        if not subject_box:
            continue
        x, y, w, h = subject_box  # type: ignore[misc]
        lx, ly, lw, lh = metrics["box"]  # type: ignore[misc]
        width, height = float(metrics["w"]), float(metrics["h"])  # type: ignore[arg-type]
        delta = max(abs(x - lx) / width, abs(w - lw) / width, abs(y - ly) / height, abs(h - lh) / height)
        if delta <= SUBJECT_RULE_MIN_DELTA:
            continue
        v6_rules.append(
            f'\n.fit[data-product-fit="{href}"][data-product-fit-model="v6"] {{\n'
            f"  --product-content-aspect: {number(w / h)};\n"
            f"  --product-content-fill-x: {number(w / width)};\n"
            f"  --product-content-fill-y: {number(h / height)};\n"
            f"  --product-content-offset-x: {number(x / width)};\n"
            f"  --product-content-offset-y: {number(y / height)};\n"
            "}\n"
        )
    if v6_rules:
        lines.append(V6_CSS_HEADER)
        lines.extend(v6_rules)
    return "".join(lines)


# Feathered edge for a photo on a flat studio backdrop: the last few percent of
# the file fade into a plate painted in the backdrop's own colour, so the photo
# edge disappears instead of drawing a rectangle. Product pixels are untouched.
BACKDROP_FEATHER = (
    "linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent), "
    "linear-gradient(180deg, transparent, #000 4%, #000 96%, transparent)"
)


def dark_matte(metrics: dict[str, object]) -> str:
    """Dark-theme presentation of an OPAQUE file (read only by `.dark` rules).

    A transparent render emits nothing and keeps the default cut-out treatment.
    See `resolveImageMatte` in lib/product-image-metrics.ts for the model.
    """
    source = metrics["boxSource"]
    if source == "alpha":
        return ""
    lines = "  --product-image-dark-filter: none;\n  --product-image-dark-contact: 0;\n"
    if source == "opaque-border" and metrics.get("backdrop"):
        lines += f"  --product-image-dark-plate: {metrics['backdrop']};\n"
        lines += f"  --product-image-dark-mask: {BACKDROP_FEATHER};\n"
    else:
        lines += "  --product-image-dark-frame: 0 0 0 1px oklch(0.94 0.008 255 / 0.12);\n"
    return lines


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    manifest = build_manifest()
    serialised = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    css = build_css(manifest)

    if args.check:
        stale = []
        if not OUTPUT_PATH.exists() or OUTPUT_PATH.read_text(encoding="utf8") != serialised:
            stale.append(str(OUTPUT_PATH))
        if not CSS_OUTPUT_PATH.exists() or CSS_OUTPUT_PATH.read_text(encoding="utf8") != css:
            stale.append(str(CSS_OUTPUT_PATH))
        if stale:
            print("stale, rerun without --check: " + ", ".join(stale), file=sys.stderr)
            return 1
        print(f"ok: {manifest['counts']['images']} images match the manifest")
        return 0

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(serialised, encoding="utf8")
    CSS_OUTPUT_PATH.write_text(css, encoding="utf8")
    print(
        f"wrote {OUTPUT_PATH.relative_to(PROJECT_ROOT)} and "
        f"{CSS_OUTPUT_PATH.relative_to(PROJECT_ROOT)}: "
        f"{manifest['counts']['images']} images, {manifest['counts']['skipped']} skipped"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
