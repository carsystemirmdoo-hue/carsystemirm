#!/usr/bin/env python3
"""Izvodi produkcione homepage campaign assete iz odobrenih izvora.

Deterministicki: iz istih izvora uvek proizvodi identicne izlaze. Ne
rekonstruise, ne generise i ne retusira motiv — samo isecanje originalnih
piksela i enkodovanje u WebP.

Carsystem slajd koristi odobrenu homepage hero fotografiju
(`public/images/home/hero-dark.png`, 1672x941), koja je i dalje u upotrebi za
route-transition handoff i zato se ne menja ni brise.

  python3 scripts/build-home-campaign-assets.py [--check]
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
OUTPUT_DIR = ROOT / "public/images/home/campaign"

CARSYSTEM_SOURCE = ROOT / "public/images/home/hero-dark.png"

# Mobilni kadar prati postojecu R-M campaign konvenciju (4:3) i poravnat je uz
# desnu ivicu, tako da lakirer i panel — glavni motiv — ostanu u kadru.
MOBILE_ASPECT = (4, 3)


def build_carsystem(check: bool) -> list[tuple[Path, tuple[int, int]]]:
    results: list[tuple[Path, tuple[int, int]]] = []

    with Image.open(CARSYSTEM_SOURCE) as image:
        image = image.convert("RGB")

        desktop = OUTPUT_DIR / "carsystem-home-campaign-brand-desktop.webp"
        if not check:
            image.save(desktop, format="WEBP", quality=86, method=6)
        results.append((desktop, image.size))

        crop_height = image.height
        crop_width = round(crop_height * MOBILE_ASPECT[0] / MOBILE_ASPECT[1])
        if crop_width > image.width:
            raise SystemExit("Mobilni kadar izlazi izvan originalne sirine.")
        crop_left = image.width - crop_width
        mobile_image = image.crop((crop_left, 0, image.width, crop_height))

    mobile = OUTPUT_DIR / "carsystem-home-campaign-brand-mobile.webp"
    if not check:
        mobile_image.save(mobile, format="WEBP", quality=86, method=6)
    results.append((mobile, mobile_image.size))

    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Samo prijavi kadrove.")
    args = parser.parse_args()

    if not CARSYSTEM_SOURCE.exists():
        raise SystemExit(f"Nedostaje izvor: {CARSYSTEM_SOURCE.relative_to(ROOT)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for path, size in build_carsystem(args.check):
        print(f"{path.relative_to(ROOT)}  {size[0]}x{size[1]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
