#!/usr/bin/env python3
"""Render supporting R-M campaign PDFs into approved editorial crops.

Final hero assets are generated from approved PNG visuals by
``optimize-rm-final-visuals.py``. This script intentionally retains only the
Emil Frey partnership crop so running it cannot overwrite final hero artwork.

The source PDF remains outside the repository:
    python3 scripts/generate-rm-campaign-assets.py \
      --source-dir "/path/to/approved-rm-pdfs"
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


@dataclass(frozen=True)
class Source:
    key: str
    filename: str
    render_size: int


@dataclass(frozen=True)
class Crop:
    source: str
    filename: str
    box: tuple[float, float, float, float]
    size: tuple[int, int]
    centering: tuple[float, float] = (0.5, 0.5)
    contrast: float = 1.0
    saturation: float = 1.0


SOURCES = (Source("emil-frey", "R-M_Emil-Frey-Racing_.pdf", 3200),)


CROPS = (
    Crop(
        "emil-frey",
        "rm-emil-frey-partnership.webp",
        (0.055, 0.42, 0.965, 0.88),
        (1500, 900),
        (0.5, 0.58),
        1.04,
        1.04,
    ),
)


def render_pdf(
    pdftoppm: str, source_path: Path, output_path: Path, render_size: int
) -> None:
    subprocess.run(
        [
            pdftoppm,
            "-png",
            "-singlefile",
            "-scale-to",
            str(render_size),
            str(source_path),
            str(output_path.with_suffix("")),
        ],
        check=True,
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
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("public/images/brands/rm/campaign"),
    )
    parser.add_argument(
        "--pdftoppm",
        default=shutil.which("pdftoppm") or "pdftoppm",
    )
    args = parser.parse_args()

    source_dir = args.source_dir.expanduser().resolve()
    output_dir = args.output_dir.resolve()
    render_dir = Path("tmp/pdfs/rm-campaign-source").resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    render_dir.mkdir(parents=True, exist_ok=True)

    rendered: dict[str, Path] = {}
    for source in SOURCES:
        source_path = source_dir / source.filename
        if not source_path.exists():
            raise FileNotFoundError(f"Missing approved source: {source_path}")
        render_path = render_dir / f"{source.key}.png"
        render_pdf(args.pdftoppm, source_path, render_path, source.render_size)
        rendered[source.key] = render_path

    for crop in CROPS:
        with Image.open(rendered[crop.source]).convert("RGB") as source_image:
            cropped = source_image.crop(fractional_box(source_image, crop.box))
            fitted = ImageOps.fit(
                cropped,
                crop.size,
                method=Image.Resampling.LANCZOS,
                centering=crop.centering,
            )
            if crop.contrast != 1:
                fitted = ImageEnhance.Contrast(fitted).enhance(crop.contrast)
            if crop.saturation != 1:
                fitted = ImageEnhance.Color(fitted).enhance(crop.saturation)
            fitted.save(
                output_dir / crop.filename,
                "WEBP",
                quality=84,
                method=6,
            )

    for render_path in rendered.values():
        render_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
