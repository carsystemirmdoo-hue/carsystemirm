#!/usr/bin/env python3
"""Vektorski prepis zvanicnog Befar znaka (bela slova na crvenom polju).

Befar ne objavljuje vektorski logo (docs/BEFAR_ASSET_INVENTORY.md). Originalni
PNG (635x192) ima rubne narandzaste i ruzicaste nijanse od antialiasinga, pa u
traci brendova i meniju nije izgledao kao znak u dve boje. Ova skripta ne
crta novi znak: povecava providnost i belinu originala 8x, prag 50 % i
potrace (open-source) daju konture istog oblika. Izlaz ima tacno dve boje.

  brew install potrace
  python3 scripts/trace-befar-logo.py
"""

from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/brands/befar/brand/befar-logo-white-on-red.png"
TARGET = ROOT / "public/brands/befar.svg"
SCALE = 8
RED = "#E30613"  # dominantna boja polja u originalu (227, 6, 19)

COMMENT = (
    "<!-- Vektorski prepis zvaničnog znaka public/brands/befar/brand/befar-logo-white-on-red.png\n"
    "     (potrace, scripts/trace-befar-logo.py). Tačno dve boje: crvena #E30613 i bela, bez\n"
    "     preliva i rubnih nijansi originalnog PNG-a. Oblik i proporcije (635:192) nisu menjani. -->"
)


def trace(channel: np.ndarray, size: tuple[int, int], workdir: Path, name: str):
    width, height = size
    big = Image.fromarray((channel * 255).astype("uint8")).resize(
        (width * SCALE, height * SCALE), Image.BICUBIC
    )
    mask = np.asarray(big) >= 128
    pbm = workdir / f"{name}.pbm"
    svg = workdir / f"{name}.svg"
    Image.fromarray((~mask).astype("uint8") * 255).convert("1").save(pbm)
    subprocess.run(
        ["potrace", str(pbm), "-s", "-o", str(svg), "--turdsize", "20",
         "--alphamax", "1.0", "--opttolerance", "0.2", "-u", "10"],
        check=True,
    )
    text = svg.read_text()
    group = re.search(r'<g transform="([^"]+)"[^>]*>(.*?)</g>', text, re.S)
    return group.group(1), re.findall(r'd="([^"]+)"', group.group(2))


def main() -> int:
    image = Image.open(SOURCE).convert("RGBA")
    pixels = np.asarray(image).astype(float) / 255
    alpha = pixels[..., 3]
    whiteness = np.minimum(pixels[..., 1], pixels[..., 2]) * alpha

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        transform, outer = trace(alpha, image.size, workdir, "outer")
        transform_glyph, glyph = trace(whiteness, image.size, workdir, "glyph")
    if transform != transform_glyph:
        raise SystemExit("Konture polja i znaka nemaju istu transformaciju.")

    width, height = image.size
    TARGET.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width * SCALE} {height * SCALE}" '
        f'width="{width}" height="{height}" role="img" aria-label="Befar">\n{COMMENT}\n'
        f'<g transform="{transform}"><path fill="{RED}" d="{" ".join(outer)}"/>'
        f'<path fill="#FFFFFF" d="{" ".join(glyph)}"/></g>\n</svg>\n'
    )
    print(f"{TARGET.relative_to(ROOT)}  {width}x{height}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
