"""Zajednička obrada originala sa Surventis Brand Portala (baslac, R-M).

Originali se preuzimaju zvaničnim dugmetom „Download original" u
`assets/manufacturer/<brend>/portal/<id>__<originalni naziv>` (u .gitignore;
van `public/`, pa ne ulaze ni u bundle ni u function trace). Moduli brendova
(`build-baslac-portal-assets.py`, `build-rm-portal-assets.py`) koriste ove
pomoćne funkcije; obrada je deterministička i nikad ne menja motiv.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover
    sys.exit("Nedostaje Pillow. Instalirajte ga sa: python3 -m pip install Pillow")

ROOT = Path(__file__).resolve().parents[1]

WEBP_PHOTO = {"format": "WEBP", "quality": 82, "method": 6}
WEBP_PACKSHOT = {"format": "WEBP", "quality": 88, "method": 6}


class PortalSource:
    """Originali jednog brenda, adresirani portal ID-jem."""

    def __init__(self, brand: str, provenance_doc: str) -> None:
        self.directory = ROOT / "assets/manufacturer" / brand / "portal"
        self.provenance_doc = provenance_doc

    def path(self, asset_id: int) -> Path:
        matches = sorted(self.directory.glob(f"{asset_id}__*"))
        if not matches:
            raise SystemExit(
                f"Nedostaje original {asset_id} u {self.directory.relative_to(ROOT)} "
                f"(preuzeti sa portala, vidi {self.provenance_doc})."
            )
        return matches[0]

    def open(self, asset_id: int) -> Image.Image:
        """Original u stvarnoj orijentaciji (EXIF) i punom kvalitetu."""
        with Image.open(self.path(asset_id)) as image:
            image.load()
            return ImageOps.exif_transpose(image)

    def open_rgb(self, asset_id: int) -> Image.Image:
        """RGB; providna pozadina se poravnava na belu."""
        image = self.open(asset_id)
        if image.mode in ("RGBA", "LA") or "transparency" in image.info:
            rgba = image.convert("RGBA")
            flat = Image.new("RGB", rgba.size, (255, 255, 255))
            flat.paste(rgba, mask=rgba.getchannel("A"))
            return flat
        return image.convert("RGB")


def crop_ratio(image: Image.Image, ratio: float, cx: float, cy: float) -> Image.Image:
    """Najveći isečak zadatog odnosa oko fokusa (cx, cy u 0..1)."""
    w, h = image.size
    if w / h > ratio:
        cw, ch = round(h * ratio), h
    else:
        cw, ch = w, round(w / ratio)
    x0 = min(max(round(cx * w - cw / 2), 0), w - cw)
    y0 = min(max(round(cy * h - ch / 2), 0), h - ch)
    return image.crop((x0, y0, x0 + cw, y0 + ch))


def crop_box(image: Image.Image, box: tuple[float, float, float, float]) -> Image.Image:
    """Isečak zadat udelima originala (x0, y0, x1, y1 u 0..1)."""
    w, h = image.size
    return image.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)))


def fit(image: Image.Image, width: int) -> Image.Image:
    if image.width <= width:
        return image
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.LANCZOS)


def save(image: Image.Image, target: Path, options: dict, check: bool, log: list) -> None:
    log.append((target, image.size))
    if check:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, **options)


def report(log: list, check: bool) -> None:
    for target, size in log:
        print(f"{'OK ' if check else 'W  '} {target.relative_to(ROOT)} {size[0]}x{size[1]}")
