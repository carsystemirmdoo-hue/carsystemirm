#!/usr/bin/env python3
"""Objava zvaničnih C.A.R.FIT packshotova po standardu sajta.

Poziva ga `apply.mjs`. Ulaz (stdin, JSON): lista {"src", "dest", "sample", "write"}.
Izlaz (stdout, JSON): po `dest` → dimenzije, veličina, način obrade i uzorak boje.

Zvanične slike su JPEG packshotovi na čisto beloj podlozi. Kartica kataloga
crta obojenu „roletnu" IZA proizvoda, pa slika bez alfa kanala preko nje stavlja
beli kvadrat. Standard sajta (docs/PAGE_LOCK_STATUS.md) zato traži cut-out
„preciznom maskom SPOLJNE pozadine": uklanja se samo belina povezana sa ivicom
slike. Etikete, beli delovi ambalaže i beli proizvodi ostaju neprovidni jer nisu
povezani sa ivicom.

Sigurnosna pravila (slika se NE seče ako bi maska mogla da pojede proizvod):
  - ivica slike mora biti bela (inače je to fotografija sa pozadinom),
  - posle maske mora ostati razuman udeo proizvoda,
  - maska ne sme da „procuri" kroz proizvod: udeo uklonjenih piksela unutar
    okvira proizvoda ne sme biti prevelik za svetle proizvode (bela rolna,
    navlaka, vuna) — tada slika ostaje cela, sa oznakom `kept-background`.

Proporcije se ne menjaju, slika se ne rasteže i ne uvećava; veća od 1200 px se
smanjuje na 1200 px po dužoj strani.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "carsystem-sync" / "lib"))
from publish_images import sample  # noqa: E402  (isti uzorak boje kao Carsystem sync)

WEBP_QUALITY = 90
MAX_SIDE = 1200
WHITE = 244  # min(R,G,B) ≥ WHITE → „belo"
FILL = 128


def outer_background_mask(rgb: np.ndarray) -> np.ndarray:
    """True = piksel spoljne pozadine (belina povezana sa ivicom slike)."""
    near_white = (rgb.min(axis=-1) >= WHITE).astype(np.uint8) * 255
    # Beli okvir od 1 px spaja sve ivične oblasti, pa je dovoljan jedan flood fill.
    padded = np.pad(near_white, 1, constant_values=255)
    # `.copy()`: slika iz numpy niza je samo za čitanje, flood fill bi tiho izostao.
    canvas = Image.fromarray(padded).copy()
    ImageDraw.floodfill(canvas, (0, 0), FILL, thresh=0)
    return (np.asarray(canvas)[1:-1, 1:-1] == FILL)


def cut_out(image: Image.Image) -> tuple[Image.Image, dict]:
    rgb = np.asarray(image.convert("RGB"))
    height, width = rgb.shape[:2]
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    border_white = float((border.min(axis=-1) >= WHITE).mean())
    info = {"borderWhiteShare": round(border_white, 4)}
    if border_white < 0.70:
        info["mode"] = "kept-background"
        info["reason"] = "ivica slike nije bela (fotografija sa pozadinom)"
        return image.convert("RGB"), info

    background = outer_background_mask(rgb)
    product = ~background
    share = float(product.mean())
    info["productShare"] = round(share, 4)
    if share < 0.03:
        info["mode"] = "kept-background"
        info["reason"] = "posle maske ne ostaje proizvod"
        return image.convert("RGB"), info

    rows = np.where(product.any(axis=1))[0]
    cols = np.where(product.any(axis=0))[0]
    box = (slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1))
    inside = product[box]
    fill_ratio = float(inside.mean())
    near_white_inside = float((rgb[box].min(axis=-1) >= WHITE)[inside].mean())
    info["boxFillRatio"] = round(fill_ratio, 4)
    info["nearWhiteInsideProduct"] = round(near_white_inside, 4)

    # Svetao proizvod čija je silueta „izgrižena": maska je verovatno procurila.
    luminance = rgb[box].mean(axis=-1)[inside]
    info["productMedianLuminance"] = round(float(np.median(luminance)), 1)

    alpha = Image.fromarray((product * 255).astype(np.uint8))
    # 1 px erozije skida beli oreol JPEG ivice; blago zamućenje daje glatku ivicu.
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    result = image.convert("RGB").copy()
    result.putalpha(alpha)
    info["mode"] = "cut-out"
    return result, info


def main() -> None:
    jobs = json.load(sys.stdin)
    out = {}
    for job in jobs:
        src, dest = Path(job["src"]), Path(job["dest"])
        with Image.open(src) as image:
            image.load()
            entry = {"sourceWidth": image.width, "sourceHeight": image.height}
            has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
            if job.get("sample"):
                entry["sample"] = sample(image)
            if has_alpha:
                processed, info = image.convert("RGBA"), {"mode": "source-alpha"}
            elif job.get("keepBackground"):
                processed, info = image.convert("RGB"), {"mode": "kept-background", "reason": "ručna odluka"}
            else:
                processed, info = cut_out(image)
            if max(processed.size) > MAX_SIDE:
                processed.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            entry.update(info)
            entry["width"], entry["height"] = processed.size
            entry["hasAlpha"] = processed.mode == "RGBA"
            if job.get("write", True):
                dest.parent.mkdir(parents=True, exist_ok=True)
                processed.save(dest, "WEBP", quality=WEBP_QUALITY, method=6, exact=False)
            if dest.exists():
                entry["bytes"] = dest.stat().st_size
        out[job["dest"]] = entry
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
