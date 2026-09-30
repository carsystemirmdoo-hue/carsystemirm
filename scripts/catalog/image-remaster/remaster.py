"""Controlled edge repair for individual product images (dark-theme reconstruction).

Every file is repaired ONLY if it is listed in `data/catalog/image-remaster/plan.json`
with an explicit operation and a reason, and only while its current bytes still match
the original SHA recorded there. Nothing is applied to the catalogue wholesale.

  python3 scripts/catalog/image-remaster/remaster.py --preview OUT_DIR   # before/after sheets
  python3 scripts/catalog/image-remaster/remaster.py --apply            # write derivatives + map
  python3 scripts/catalog/image-remaster/remaster.py --check            # verify state
  python3 scripts/catalog/image-remaster/remaster.py --revert [SRC ...] # drop derivatives

The ORIGINAL file is never modified. Brand syncs use the local file's SHA as identity
evidence (Carsystem "identical-official-packshot") and the Cosmos Brand Kit files are
SHA-locked, so a repair is written as a separate DISPLAY derivative under
`public/remastered/<original public path>` and listed in
`data/catalog/image-remaster/display-map.json`. Only the presentation layer (PDP stage,
product cards) reads that map; catalogue data, syncs and the image inventory keep
seeing the original. When a brand sync delivers a new source, the original's SHA no
longer matches, `--check` fails and `--apply` drops the stale entry.

Operations (none of them changes a product pixel's colour; they only touch pixels that
are NOT part of the product, or the 1–2 px anti-aliasing band of its silhouette):

  shadow-premultiply  The official render carries a light-grey, semi-transparent
                      "shadow" composed for white paper. On a dark page it glows. The
                      same shadow is rewritten as black with alpha a·(255−g)/255, which
                      composites to the IDENTICAL pixel on white and to a real (dark)
                      shadow on a dark stage. Only low-chroma, semi-transparent pixels
                      outside the product's filled silhouette are touched.
  clear-edge-frame    Removes a 1 px semi-transparent frame on the canvas edge (export
                      artefact, present in the manufacturer original) — it draws a faint
                      rectangle around the product on any non-white stage.
  antialias-mask      Binary (stair-stepped) alpha: the silhouette alpha is smoothed with
                      a sub-pixel Gaussian and can only DECREASE, so the product never grows.
  defringe            Silhouette band pixels that are far lighter (and grey) than the
                      product just inside them are background left by cut-out; their RGB
                      is replaced by the local product colour. Alpha is unchanged.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / "public"
PLAN = ROOT / "data/catalog/image-remaster/plan.json"
DISPLAY_MAP = ROOT / "data/catalog/image-remaster/display-map.json"
DERIVATIVE_ROOT = "/remastered"
OPERATIONS = ("shadow-premultiply", "clear-edge-frame", "antialias-mask", "defringe")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_bytes(path: Path) -> bytes:
    # Repo lives under ~/Desktop: macOS may hold files as dataless; read fully, retry once.
    for _ in range(2):
        try:
            return path.read_bytes()
        except OSError:
            continue
    return path.read_bytes()


def box_sum(arr: np.ndarray, r: int) -> np.ndarray:
    p = np.pad(arr, ((r + 1, r), (r + 1, r)), mode="constant")
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    return c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    return box_sum(mask.astype(np.float32), r) > 0


def erode(mask: np.ndarray, r: int) -> np.ndarray:
    return ~dilate(~mask, r)


def luminance(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def filled(mask: np.ndarray) -> np.ndarray:
    """Mask with interior holes filled (flood fill of the background from the border)."""
    h, w = mask.shape
    outside = np.zeros((h + 2, w + 2), dtype=bool)
    free = np.pad(~mask, 1, constant_values=True)
    outside[0, :] = outside[-1, :] = outside[:, 0] = outside[:, -1] = True
    # Iterative 4-neighbour propagation; converges quickly for product renders.
    while True:
        grown = outside.copy()
        grown[1:, :] |= outside[:-1, :]
        grown[:-1, :] |= outside[1:, :]
        grown[:, 1:] |= outside[:, :-1]
        grown[:, :-1] |= outside[:, 1:]
        grown &= free
        if (grown == outside).all():
            break
        outside = grown
    return ~outside[1:-1, 1:-1]


def op_shadow_premultiply(rgba: np.ndarray, params: dict) -> np.ndarray:
    out = rgba.astype(np.float32)
    rgb, alpha = out[..., :3], out[..., 3]
    core_alpha = float(params.get("coreAlpha", 235))
    product = dilate(filled(alpha >= core_alpha), int(params.get("productMargin", 1)))
    chroma = rgb.max(-1) - rgb.min(-1)
    shadow = (alpha > 0) & (alpha < core_alpha) & ~product & (chroma <= float(params.get("maxChroma", 24)))
    # A cast/contact shadow lies below the product's centre of mass. Semi-transparent
    # parts ABOVE it (a clear plastic lid, a spray cap) are product, never shadow.
    rows = np.nonzero(alpha >= core_alpha)[0]
    if rows.size:
        centre = rows.mean() + float(params.get("belowCentreBias", 0.0)) * (rows.max() - rows.min())
        shadow &= (np.arange(alpha.shape[0])[:, None] >= centre)
    grey = luminance(rgb)
    new_alpha = alpha * (255.0 - grey) / 255.0
    out[..., 3] = np.where(shadow, new_alpha, alpha)
    for channel in range(3):
        out[..., channel] = np.where(shadow, 0.0, out[..., channel])
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


def op_clear_edge_frame(rgba: np.ndarray, params: dict) -> np.ndarray:
    out = rgba.copy()
    width = int(params.get("width", 1))
    for sl in (np.s_[:width, :], np.s_[-width:, :], np.s_[:, :width], np.s_[:, -width:]):
        region = out[sl]
        # Only the semi-transparent frame goes; an opaque product touching the edge stays.
        region[..., 3] = np.where(region[..., 3] < 250, 0, region[..., 3])
        out[sl] = region
    return out


def op_antialias_mask(rgba: np.ndarray, params: dict) -> np.ndarray:
    out = rgba.copy()
    alpha = Image.fromarray(rgba[..., 3])
    soft = np.asarray(alpha.filter(ImageFilter.GaussianBlur(float(params.get("sigma", 0.8)))))
    out[..., 3] = np.minimum(rgba[..., 3], soft)
    return out


def op_defringe(rgba: np.ndarray, params: dict) -> np.ndarray:
    out = rgba.astype(np.float32)
    rgb, alpha = out[..., :3], out[..., 3]
    opaque = alpha >= 250
    band = (alpha > 0) & dilate(~opaque, int(params.get("band", 2))) & dilate(opaque, 2)
    core = erode(opaque, int(params.get("inset", 3)))
    radius = int(params.get("radius", 6))
    count = box_sum(core.astype(np.float32), radius)
    local = np.stack([box_sum(rgb[..., c] * core, radius) for c in range(3)], -1) / np.maximum(count, 1e-6)[..., None]
    grey = rgb.max(-1) - rgb.min(-1) <= float(params.get("maxChroma", 30))
    lighter = (luminance(rgb) - luminance(local)) / 255.0 >= float(params.get("minDelta", 0.25))
    target = band & grey & lighter & (count > 0)
    for channel in range(3):
        out[..., channel] = np.where(target, local[..., channel], rgb[..., channel])
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


APPLY = {
    "shadow-premultiply": op_shadow_premultiply,
    "clear-edge-frame": op_clear_edge_frame,
    "antialias-mask": op_antialias_mask,
    "defringe": op_defringe,
}


def load_plan() -> dict:
    return json.loads(PLAN.read_text("utf8"))


def repaired(entry: dict, original: bytes) -> bytes:
    image = Image.open(io.BytesIO(original))
    fmt = image.format
    rgba = np.asarray(image.convert("RGBA"))
    for step in entry["operations"]:
        rgba = APPLY[step["op"]](rgba, step.get("params", {}))
    buffer = io.BytesIO()
    result = Image.fromarray(rgba)
    if fmt == "WEBP":
        result.save(buffer, "WEBP", lossless=True, method=6, exact=True)
    else:
        result.save(buffer, "PNG", optimize=True)
    return buffer.getvalue()


def composite(img: Image.Image, bg: tuple[int, int, int], size: int) -> Image.Image:
    thumb = img.copy()
    thumb.thumbnail((size - 8, size - 8), Image.LANCZOS)
    cell = Image.new("RGBA", (size, size), bg + (255,))
    cell.alpha_composite(thumb, ((size - thumb.width) // 2, (size - thumb.height) // 2))
    return cell.convert("RGB")


def preview(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    backgrounds = [(12, 13, 16), (128, 128, 128), (246, 246, 247)]
    cell = 220
    for entry in load_plan()["images"]:
        path = PUBLIC / entry["src"].lstrip("/")
        before = read_bytes(path)
        if sha256(before) != entry["originalSha256"]:
            print("skip (original changed since review):", entry["src"])
            continue
        after = repaired(entry, before)
        a = Image.open(io.BytesIO(before)).convert("RGBA")
        b = Image.open(io.BytesIO(after)).convert("RGBA")
        sheet = Image.new("RGB", (cell * 3 * 2 + 30, cell * 2 + 40), (40, 40, 40))
        for row, image in enumerate((a, b)):
            for col, bg in enumerate(backgrounds):
                sheet.paste(composite(image, bg, cell), (col * (cell + 4), row * (cell + 4)))
            # 3x zoom of the lower-left silhouette quarter on dark, where shadows/fringes live
            w, h = image.size
            crop = image.crop((0, h // 2, w // 2, h)).resize((cell * 3 // 2, cell * 3 // 2 * h // max(w, 1) if w else cell), Image.NEAREST)
            zoom = Image.new("RGBA", (cell * 3, cell), backgrounds[0] + (255,))
            zoom.alpha_composite(crop.crop((0, 0, min(crop.width, cell * 3), min(crop.height, cell))))
            sheet.paste(zoom.convert("RGB"), (3 * (cell + 4) + 18, row * (cell + 4)))
        ImageDraw.Draw(sheet).text((4, cell * 2 + 14), f"{entry['src']}  {[s['op'] for s in entry['operations']]}  (top: before, bottom: after)", fill=(235, 235, 235))
        sheet.save(out_dir / (Path(entry["src"]).stem + ".png"))
    print("preview sheets in", out_dir)


def derivative_href(src: str) -> str:
    return DERIVATIVE_ROOT + src


def write_map(entries: dict[str, str]) -> None:
    DISPLAY_MAP.write_text(
        json.dumps(
            {
                "note": "GENERATED by scripts/catalog/image-remaster/remaster.py --apply. "
                "Original public path -> reviewed display derivative (see plan.json).",
                "images": dict(sorted(entries.items())),
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        "utf8",
    )


def apply() -> int:
    plan = load_plan()
    entries: dict[str, str] = {}
    written = 0
    for entry in plan["images"]:
        path = PUBLIC / entry["src"].lstrip("/")
        derivative = PUBLIC / derivative_href(entry["src"]).lstrip("/")
        current = read_bytes(path)
        if sha256(current) != entry["originalSha256"]:
            print(f"DROP {entry['src']}: original changed since review — derivative removed", file=sys.stderr)
            entry.pop("repairedSha256", None)
            if derivative.exists():
                derivative.unlink()
            continue
        result = repaired(entry, current)
        if not derivative.exists() or read_bytes(derivative) != result:
            derivative.parent.mkdir(parents=True, exist_ok=True)
            derivative.write_bytes(result)
            written += 1
        entry["repairedSha256"] = sha256(result)
        entries[entry["src"]] = derivative_href(entry["src"])
    PLAN.write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n", "utf8")
    write_map(entries)
    print(f"{len(entries)} display derivative(s), {written} written")
    return 0


def check() -> int:
    problems = []
    mapped = json.loads(DISPLAY_MAP.read_text("utf8"))["images"] if DISPLAY_MAP.exists() else {}
    for entry in load_plan()["images"]:
        path = PUBLIC / entry["src"].lstrip("/")
        derivative = PUBLIC / derivative_href(entry["src"]).lstrip("/")
        current = read_bytes(path)
        if sha256(current) != entry["originalSha256"]:
            if entry["src"] in mapped:
                problems.append(f"{entry['src']}: original changed upstream but is still mapped — run --apply")
            continue
        if mapped.get(entry["src"]) != derivative_href(entry["src"]):
            problems.append(f"{entry['src']}: reviewed repair is not in display-map.json")
        elif not derivative.exists() or read_bytes(derivative) != repaired(entry, current):
            problems.append(f"{entry['src']}: derivative missing or not reproducible from the original")
    planned = {entry["src"] for entry in load_plan()["images"]}
    for src in mapped:
        if src not in planned:
            problems.append(f"{src}: mapped without a reviewed plan entry")
    for p in problems:
        print("FAIL", p, file=sys.stderr)
    print(f"image-remaster check: {len(mapped)} mapped, {len(problems)} problem(s)")
    return 1 if problems else 0


def revert(targets: list[str]) -> int:
    plan = load_plan()
    mapped = json.loads(DISPLAY_MAP.read_text("utf8"))["images"] if DISPLAY_MAP.exists() else {}
    for entry in plan["images"]:
        if targets and entry["src"] not in targets:
            continue
        derivative = PUBLIC / derivative_href(entry["src"]).lstrip("/")
        if derivative.exists():
            derivative.unlink()
        mapped.pop(entry["src"], None)
        entry.pop("repairedSha256", None)
        print("reverted", entry["src"])
    PLAN.write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n", "utf8")
    write_map(mapped)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--preview", metavar="OUT_DIR")
    group.add_argument("--apply", action="store_true")
    group.add_argument("--check", action="store_true")
    group.add_argument("--revert", nargs="*")
    args = parser.parse_args()
    if args.preview:
        preview(Path(args.preview))
        return 0
    if args.apply:
        return apply()
    if args.check:
        return check()
    return revert(args.revert)


if __name__ == "__main__":
    sys.exit(main())
