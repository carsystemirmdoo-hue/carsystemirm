#!/usr/bin/env python3
"""Izvodi produkcione Baslac hero asset-e iz originalnih 3440x1440 banera.

Skripta je deterministicka: iz istih izvora uvek proizvodi identicne izlaze.
Ne rekonstruise, ne generise i ne retusira motiv - samo isecanje originalnih
piksela i enkodovanje u WebP.

  python3 scripts/build-baslac-campaign-assets.py [--check]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Nedostaje Pillow. Instalirajte ga sa: python3 -m pip install Pillow")

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets/manufacturer/baslac/campaign"
OUTPUT_DIR = ROOT / "public/images/brands/baslac/campaign"

ARTWORK_SOURCE = SOURCE_DIR / "baslac-20-years-header-source.webp"
PHOTO_SOURCE = SOURCE_DIR / "baslac-surventis-header-source.webp"

# Providni padding oko izdvojenog artworka, kao udeo duze stranice bounding boxa.
ARTWORK_PADDING_RATIO = 0.05
# Alpha prag za odredjivanje stvarnog non-transparent bounding boxa.
ARTWORK_ALPHA_THRESHOLD = 4

# Art-directed mobilni kadar drugog banera: pun visinski opseg originala,
# 5:4 kadar poravnat uz desnu ivicu, tako da cela grupa zastava - ukljucujuci
# veliku krajnju Surventis zastavu - ostane u kadru.
PHOTO_MOBILE_ASPECT = (5, 4)
PHOTO_MOBILE_RIGHT_MARGIN = 40


def artwork_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > ARTWORK_ALPHA_THRESHOLD else 0)
    box = mask.getbbox()
    if box is None:
        raise SystemExit("Izvorni artwork nema non-transparent piksele.")
    return box


def build_artwork(check: bool) -> tuple[Path, tuple[int, int]]:
    with Image.open(ARTWORK_SOURCE) as image:
        image = image.convert("RGBA")
        left, top, right, bottom = artwork_bounds(image)
        pad = round(max(right - left, bottom - top) * ARTWORK_PADDING_RATIO)
        box = (
            max(0, left - pad),
            max(0, top - pad),
            min(image.width, right + pad),
            min(image.height, bottom + pad),
        )
        cropped = image.crop(box)

    target = OUTPUT_DIR / "baslac-20-years-artwork.webp"
    if not check:
        cropped.save(target, format="WEBP", lossless=True, method=6)
    return target, cropped.size


def build_photo(check: bool) -> list[tuple[Path, tuple[int, int]]]:
    results: list[tuple[Path, tuple[int, int]]] = []

    with Image.open(PHOTO_SOURCE) as image:
        image = image.convert("RGB")

        desktop = OUTPUT_DIR / "baslac-surventis-desktop.webp"
        if not check:
            image.save(desktop, format="WEBP", quality=88, method=6)
        results.append((desktop, image.size))

        crop_height = image.height
        crop_width = round(crop_height * PHOTO_MOBILE_ASPECT[0] / PHOTO_MOBILE_ASPECT[1])
        crop_right = image.width - PHOTO_MOBILE_RIGHT_MARGIN
        crop_left = crop_right - crop_width
        if crop_left < 0:
            raise SystemExit("Mobilni kadar izlazi izvan originalne sirine.")

        mobile_image = image.crop((crop_left, 0, crop_right, crop_height))

    mobile = OUTPUT_DIR / "baslac-surventis-mobile.webp"
    if not check:
        mobile_image.save(mobile, format="WEBP", quality=88, method=6)
    results.append((mobile, mobile_image.size))

    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Samo prijavi izracunate kadrove, bez upisa fajlova.",
    )
    args = parser.parse_args()

    for source in (ARTWORK_SOURCE, PHOTO_SOURCE):
        if not source.exists():
            raise SystemExit(f"Nedostaje izvorni fajl: {source.relative_to(ROOT)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    outputs = [build_artwork(args.check), *build_photo(args.check)]
    for path, size in outputs:
        print(f"{path.relative_to(ROOT)}  {size[0]}x{size[1]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
