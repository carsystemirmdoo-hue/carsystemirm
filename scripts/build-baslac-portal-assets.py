#!/usr/bin/env python3
"""Izvodi produkcione baslac vizuale iz originala sa Surventis Brand Portala.

Originali se preuzimaju zvaničnim dugmetom „Download original" u
`assets/manufacturer/baslac/portal/` (u .gitignore; van `public/`, pa ne
ulaze ni u bundle ni u function trace). Naziv fajla počinje portal ID-jem:
`<id>__<originalni naziv>`. Poreklo svakog asseta: `docs/BASLAC_PORTAL_ASSETS.md`.

Skripta je deterministička i ne generiše ni ne retušira motiv:
- fotografije se samo isecaju i skaliraju;
- kompozicije ređaju NEIZMENJENE zvanične packshotove na belu podlogu
  (multiply, pa bela pozadina originala ostaje bela, a senka ostaje senka);
  razmera pakovanja se izjednačava prema nominalnim merama ambalaže
  (PACKAGES), ne prema pikselima snimka;
- family packshot ostaje na originalnoj beloj podlozi (bez izdvajanja alfe).

  python3 scripts/build-baslac-portal-assets.py [--check]
"""

from __future__ import annotations

import argparse

from PIL import Image, ImageChops

from brand_portal_assets import (
    ROOT,
    WEBP_PACKSHOT,
    WEBP_PHOTO,
    PortalSource,
    crop_ratio,
    fit,
    report,
    save,
)

PORTAL = PortalSource("baslac", "docs/BASLAC_PORTAL_ASSETS.md")
BRAND_DIR = ROOT / "public/images/brands/baslac"
PRODUCT_DIR = ROOT / "public/products/baslac"

# Nominalna ambalaža. Razmera se izjednačava po zapremini: za cilindričnu
# limenku prečnik sledi iz zapremine i odnosa visina/prečnik izmerenog na samom
# snimku, pa visoka i niska limenka od 1 L ispadaju iste zapremine. Kanister i
# boca nemaju prost oblik, pa imaju nominalnu širinu tela u mm (približno).
PACKAGES = {
    12081: ("width", 195),  # 45-W00, kanister 5 L
    12121: ("cylinder", 1.0),  # 45-W1010, 1 L
    12094: ("cylinder", 0.5),  # 45-W1020, 0,5 L
    12088: ("width", 48),  # 45-W1390, boca 0,1 L
    12116: ("cylinder", 1.0),  # 40-10
    12118: ("cylinder", 1.0),  # 40-440
    12119: ("cylinder", 1.0),  # 40-450
    45627: ("cylinder", 1.0),  # 40-620
    12146: ("cylinder", 2.0),  # 40-510, 2 L
}


def body_width_mm(asset_id: int, width_px: int, height_px: int) -> float:
    kind, value = PACKAGES[asset_id]
    if kind == "width":
        return value
    # V = pi/4 * d^2 * h, h = d * (height_px / width_px)  ->  d = cbrt(4V / (pi * a))
    aspect = height_px / width_px
    return (4 * value * 1e6 / (3.141592653589793 * aspect)) ** (1 / 3)


GAP_MM = 26


def open_rgb(asset_id: int) -> Image.Image:
    return PORTAL.open_rgb(asset_id)


def ink_box(image: Image.Image, threshold: int) -> tuple[int, int, int, int]:
    """Bounding box piksela tamnijih od praga (bela pozadina je 255)."""
    gray = image.convert("L")
    mask = gray.point(lambda v: 255 if v < threshold else 0)
    box = mask.getbbox()
    if box is None:
        raise SystemExit("Packshot nema motiv na beloj pozadini.")
    return box


def body_width(image: Image.Image, box: tuple[int, int, int, int]) -> int:
    """Širina tela na polovini visine — ne računa ručku, čep ni senku."""
    gray = image.convert("L")
    y = (box[1] + box[3]) // 2
    xs = [x for x in range(box[0], box[2]) if gray.getpixel((x, y)) < 246]
    return xs[-1] - xs[0] + 1


def compose_row(rows: list[list[int]], size: tuple[int, int], fill: float) -> Image.Image:
    """Redovi packshotova na beloj podlozi; baza svih predmeta u redu je ista."""
    canvas_w, canvas_h = size
    items = {}
    for row in rows:
        for asset_id in row:
            image = open_rgb(asset_id)
            product = ink_box(image, 236)
            with_shadow = ink_box(image, 252)
            width_px = body_width(image, product)
            px_per_mm = width_px / body_width_mm(
                asset_id, width_px, product[3] - product[1]
            )
            items[asset_id] = (image, product, with_shadow, px_per_mm)

    def row_width_mm(row: list[int]) -> float:
        return sum(
            (items[i][1][2] - items[i][1][0]) / items[i][3] for i in row
        ) + GAP_MM * (len(row) - 1)

    def item_height_mm(asset_id: int) -> float:
        _, product, _, px_per_mm = items[asset_id]
        return (product[3] - product[1]) / px_per_mm

    row_heights = [max(item_height_mm(i) for i in row) for row in rows]
    total_h_mm = sum(row_heights) + GAP_MM * 1.6 * (len(rows) - 1)
    scale = min(
        canvas_w * fill / max(row_width_mm(r) for r in rows),
        canvas_h * fill / total_h_mm,
    )

    canvas = Image.new("RGB", size, (255, 255, 255))
    y = (canvas_h - total_h_mm * scale) / 2
    for row, row_h in zip(rows, row_heights):
        baseline = y + row_h * scale
        x = (canvas_w - row_width_mm(row) * scale) / 2
        for asset_id in row:
            image, product, shadow, px_per_mm = items[asset_id]
            k = scale / px_per_mm
            tile = image.crop(shadow)
            tile = tile.resize(
                (round(tile.width * k), round(tile.height * k)), Image.LANCZOS
            )
            left = round(x - (product[0] - shadow[0]) * k)
            top = round(baseline - (product[3] - shadow[1]) * k)
            region = (left, top, left + tile.width, top + tile.height)
            canvas.paste(ImageChops.multiply(canvas.crop(region), tile), region[:2])
            x += (product[2] - product[0]) / px_per_mm * scale + GAP_MM * scale
        y = baseline + GAP_MM * 1.6 * scale
    return canvas


def build(check: bool) -> list:
    log: list = []

    # 1. Proces popravke — Baslac78 (13440): lakirer nanosi materijal na
    #    maskiran popravljeni deo. Desktop 16:10, mobilni 4:5 oko pištolja.
    repair = open_rgb(13440)
    save(fit(crop_ratio(repair, 16 / 10, 0.5, 0.45), 2000),
         BRAND_DIR / "process/baslac-repair-rhythm-desktop.webp", WEBP_PHOTO, check, log)
    save(fit(crop_ratio(repair, 4 / 5, 0.5, 0.5), 1066),
         BRAND_DIR / "process/baslac-repair-rhythm-mobile.webp", WEBP_PHOTO, check, log)

    # 2. 45 Line — kompozicija zvaničnih packshotova (5 L, 1 L, 0,5 L, 0,1 L).
    save(compose_row([[12081, 12121, 12094, 12088]], (2800, 2100), 0.86),
         BRAND_DIR / "systems/baslac-45-line-system.webp", WEBP_PACKSHOT, check, log)

    # 3. Bezbojni lakovi — 40-10, 40-440, 40-450, 40-620 (1 L) i 40-510 (2 L).
    #    40-100 nema packshot na portalu, pa ga kompozicija ne prikazuje.
    clear = [12116, 12118, 12119, 45627, 12146]
    save(compose_row([clear], (3600, 1350), 0.9),
         BRAND_DIR / "clearcoats/baslac-clearcoat-range.webp", WEBP_PACKSHOT, check, log)
    # Mobilni: dva reda, sa donjom marginom za potpis slota (figcaption).
    save(compose_row([clear[:3], clear[3:]], (1600, 1520), 0.8),
         BRAND_DIR / "clearcoats/baslac-clearcoat-range-mobile.webp", WEBP_PACKSHOT, check, log)

    # 4. Koloristika — e-finder star (12193) na crvenom metalik panelu.
    finder = open_rgb(12193)
    save(fit(crop_ratio(finder, 16 / 9, 0.47, 0.49), 2400),
         BRAND_DIR / "color/baslac-color-workflow.webp", WEBP_PHOTO, check, log)

    # 5. Komercijalna vozila — zvanični render (15133), bela pozadina.
    truck = open_rgb(15133)
    save(fit(crop_ratio(truck, 1600 / 1050, 0.5, 0.5), 2400),
         BRAND_DIR / "commercial/baslac-commercial-vehicles.webp", WEBP_PHOTO, check, log)

    # 6. Line 45 family — primer ambalaže 45-W1010 1 L (12121). Ostaje na
    #    originalnoj beloj podlozi: bela etiketa dodiruje belu pozadinu na
    #    bočnim ivicama, pa bilo kakvo izdvajanje alfe buši etiketu.
    can = open_rgb(12121)
    box = ink_box(can, 252)
    pad = round(max(box[2] - box[0], box[3] - box[1]) * 0.04)
    can = can.crop((box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad))
    save(fit(can, 840),
         PRODUCT_DIR / "baslac--line-45-1l-example-packshot.webp",
         {"format": "WEBP", "quality": 90, "method": 6}, check, log)

    # 7/8. Sezonske ilustracije — kvadratni social vizuali bez teksta; donja
    #      plava traka social šablona se odseca (nije deo motiva).
    for asset_id, name in ((45532, "baslac-seasonal-new-year"), (50625, "baslac-seasonal-easter")):
        art = open_rgb(asset_id)
        band = seasonal_band_top(art)
        art = art.crop((0, 0, art.width, band))
        art = crop_ratio(art, 1.0, 0.5, 0.5) if art.width != art.height else art
        save(art, BRAND_DIR / f"campaign/{name}.webp", WEBP_PHOTO, check, log)

    return log


def seasonal_band_top(image: Image.Image) -> int:
    """Prva linija odozdo koja više nije plava traka šablona."""
    rgb = image.convert("RGB")
    x = rgb.width // 2
    y = rgb.height - 1
    while y > rgb.height * 0.8:
        r, g, b = rgb.getpixel((x, y))
        if not (b > 150 and b - r > 60):
            break
        y -= 1
    return y + 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="samo proveri izvore")
    args = parser.parse_args()
    report(build(args.check), args.check)


if __name__ == "__main__":
    main()
