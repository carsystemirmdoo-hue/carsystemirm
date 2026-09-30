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


def measure(path: Path) -> dict[str, object] | None:
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
    }
    if backdrop is not None:
        metrics["backdrop"] = backdrop
    return metrics


def build_manifest() -> dict[str, object]:
    images: dict[str, object] = {}
    skipped: list[str] = []
    for path in iter_source_files():
        try:
            metrics = measure(path)
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
