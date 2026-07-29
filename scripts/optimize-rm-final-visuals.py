#!/usr/bin/env python3
"""Create production WebP crops from the approved final R-M PNG visuals.

The original PNG files remain untouched and outside the public web bundle.

Example:
    python3 scripts/optimize-rm-final-visuals.py \
      --agilis-performance /path/to/agilis-performance.png \
      --agilis-color /path/to/agilis-color.png \
      --refinity /path/to/refinity.png \
      --esense /path/to/esense.png
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


@dataclass(frozen=True)
class Output:
    source: str
    filename: str
    size: tuple[int, int]
    box: tuple[float, float, float, float] = (0, 0, 1, 1)
    centering: tuple[float, float] = (0.5, 0.5)
    contrast: float = 1.0
    saturation: float = 1.0


OUTPUTS = (
    Output(
        "agilis-performance",
        "rm-hero-agilis-performance-desktop.webp",
        (1600, 900),
        contrast=1.02,
    ),
    Output(
        "agilis-performance",
        "rm-hero-agilis-performance-mobile.webp",
        (960, 720),
        (0.28, 0, 1, 1),
        (0.58, 0.5),
        1.02,
    ),
    Output(
        "agilis-color",
        "rm-hero-agilis-color-desktop.webp",
        (1600, 900),
        contrast=1.02,
    ),
    Output(
        "agilis-color",
        "rm-hero-agilis-color-mobile.webp",
        (960, 720),
        (0.28, 0, 1, 1),
        (0.6, 0.5),
        1.02,
    ),
    Output(
        "refinity",
        "rm-hero-refinity-desktop.webp",
        (1600, 900),
        contrast=1.02,
        saturation=1.02,
    ),
    Output(
        "refinity",
        "rm-hero-refinity-mobile.webp",
        (960, 720),
        (0.3, 0, 1, 0.94),
        (0.62, 0.42),
        1.02,
        1.02,
    ),
    Output(
        "esense",
        "rm-hero-esense-desktop.webp",
        (1600, 900),
        contrast=1.01,
    ),
    Output(
        "esense",
        "rm-hero-esense-mobile.webp",
        (960, 720),
        (0.22, 0.12, 1, 1),
        (0.57, 0.56),
        1.01,
    ),
    Output(
        "agilis-color",
        "rm-agilis-editorial.webp",
        (1400, 900),
        (0.28, 0.05, 1, 0.99),
        (0.59, 0.53),
        1.02,
    ),
    Output(
        "refinity",
        "rm-refinity-editorial.webp",
        (1200, 1200),
        (0.42, 0.02, 0.98, 0.96),
        (0.58, 0.44),
        1.02,
        1.02,
    ),
    Output(
        "esense",
        "rm-esense-editorial.webp",
        (1500, 900),
        (0.2, 0.18, 1, 1),
        (0.56, 0.56),
        1.01,
    ),
)


def fractional_box(
    image: Image.Image, box: tuple[float, float, float, float]
) -> tuple[int, int, int, int]:
    width, height = image.size
    return (
        round(width * box[0]),
        round(height * box[1]),
        round(width * box[2]),
        round(height * box[3]),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--agilis-performance", type=Path, required=True)
    parser.add_argument("--agilis-color", type=Path, required=True)
    parser.add_argument("--refinity", type=Path, required=True)
    parser.add_argument("--esense", type=Path, required=True)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("public/images/brands/rm/campaign"),
    )
    args = parser.parse_args()

    sources = {
        "agilis-performance": args.agilis_performance.expanduser().resolve(),
        "agilis-color": args.agilis_color.expanduser().resolve(),
        "refinity": args.refinity.expanduser().resolve(),
        "esense": args.esense.expanduser().resolve(),
    }
    missing = [str(path) for path in sources.values() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing approved source(s): {', '.join(missing)}")

    output_dir = args.output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    opened: dict[str, Image.Image] = {}
    try:
        for key, path in sources.items():
            opened[key] = Image.open(path).convert("RGB")

        for output in OUTPUTS:
            source = opened[output.source]
            cropped = source.crop(fractional_box(source, output.box))
            fitted = ImageOps.fit(
                cropped,
                output.size,
                method=Image.Resampling.LANCZOS,
                centering=output.centering,
            )
            if output.contrast != 1:
                fitted = ImageEnhance.Contrast(fitted).enhance(output.contrast)
            if output.saturation != 1:
                fitted = ImageEnhance.Color(fitted).enhance(output.saturation)
            fitted.save(
                output_dir / output.filename,
                "WEBP",
                quality=88,
                method=6,
            )
    finally:
        for image in opened.values():
            image.close()


if __name__ == "__main__":
    main()
