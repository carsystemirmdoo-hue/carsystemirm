#!/usr/bin/env python3
"""Fotografije ambalaže po SISTEMU I ZAPREMINI za izbor baza (2026-10-21).

Izvor su originali sa Surventis Brand Portala (R-M hub 51, baslac hub 54), preuzeti kroz
„Download original" u `assets/manufacturer/<brend>/portal/<id>__<naziv>` (gitignored).
Jedna fotografija po sistemu i zapremini; ne menja se po boji. R-M limenke su generičke
(bez šifre nijanse). Baslac portal za 1 L / 0,5 L / 5 L / 0,1 L ima samo fotografije sa
šifrom jedne baze na etiketi — koriste se kao reprezentativna ambalaža te zapremine i strana
to kaže („na fotografiji: …"). Etiketa i zapremina se ne prepravljaju.

    python3 scripts/build-family-packshots.py --assets ~/Carsystem/carsystem/assets/manufacturer
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("carfit_publish_images", ROOT / "scripts" / "carfit-sync" / "lib" / "publish_images.py")
_carfit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_carfit)
cut_out = _carfit.cut_out  # isto isecanje bele pozadine kao C.A.R.FIT sync

PACKSHOTS = [
    # (brend, id porekla, izvorni fajl, izlaz, sistem, zapremina, šifra na etiketi ili None)
    ("rm", 34847, "34847__R-M_0,5L_DIAMONT.png", "public/products/rm/system/rm-diamont-0-5l.webp", "DIAMONT", "0,5 L", None),
    ("rm", 34851, "34851__R-M_1L_DIAMONT.png", "public/products/rm/system/rm-diamont-1l.webp", "DIAMONT", "1 L", None),
    ("rm", 30822, "30822__R-M_4L_DIAMONT.png", "public/products/rm/system/rm-diamont-4l.webp", "DIAMONT", "4 L", None),
    ("rm", 30817, "30817__R-M_0,125L_CRYSTAL BASE.png", "public/products/rm/system/rm-crystal-base-125ml.webp", "CRYSTAL BASE", "125 ml", None),
    ("rm", 34856, "34856__R-M_4L_UNO HD.png", "public/products/rm/system/rm-uno-hd-4l.webp", "UNO HD", "4 L", None),
    ("baslac", 12115, "12115__baslac_1L_35-M1020_53220998.jpeg", "public/products/baslac/baslac--line-35-1l-representative.webp", "Line 35", "1 L", "35-M1020"),
    ("baslac", 12092, "12092__baslac_0_5L_35-M1120_53377349.jpeg", "public/products/baslac/baslac--line-35-0.5l-representative.webp", "Line 35", "0,5 L", "35-M1120"),
    ("baslac", 12114, "12114__baslac_1L_30-S110_50493089.jpeg", "public/products/baslac/baslac--line-30-1l-representative.webp", "Line 30", "1 L", "30-S110"),
    ("baslac", 12081, "12081__baslac 5L 45-W00 50393402.jpeg", "public/products/baslac/baslac--line-45-5l-representative.webp", "Line 45", "5 L", "45-W00"),
    ("baslac", 12121, "12121__Baslac_1L_45-W1010_50389480.jpeg", "public/products/baslac/baslac--line-45-1l-representative.webp", "Line 45", "1 L", "45-W1010"),
    ("baslac", 12094, "12094__baslac_0_5L_45-W1020_50390264.jpeg", "public/products/baslac/baslac--line-45-0.5l-representative.webp", "Line 45", "0,5 L", "45-W1020"),
    ("baslac", 12088, "12088__baslac 100ml 45-W1390 50562135.jpeg", "public/products/baslac/baslac--line-45-0.1l-representative.webp", "Line 45", "0,1 L", "45-W1390"),
]

MAX_EDGE = 1200


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets", required=True, type=Path)
    args = parser.parse_args()
    manifest = []
    for brand, asset_id, source, output, system, volume, shown_code in PACKSHOTS:
        path = args.assets / brand / "portal" / source
        image = Image.open(path)
        if image.mode in ("RGBA", "LA") or "transparency" in image.info:
            result = image.convert("RGBA")
            info = {"mode": "source-alpha"}
        else:
            result, info = cut_out(image.convert("RGB"))
        box = result.getchannel("A").getbbox()
        if box:
            result = result.crop(box)
        result.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        target = ROOT / output
        target.parent.mkdir(parents=True, exist_ok=True)
        result.save(target, "WEBP", quality=90, method=6)
        manifest.append({
            "brand": brand,
            "system": system,
            "volume": volume,
            "src": "/" + output.removeprefix("public/"),
            "shownCode": shown_code,
            "portalAssetId": asset_id,
            "portalFile": source.split("__", 1)[1],
            "width": result.width,
            "height": result.height,
            **info,
        })
        print(f"{output} {result.width}x{result.height} {info}")
    (ROOT / "data" / "catalog" / "family-packshots.json").write_text(
        json.dumps({"_comment": __doc__.strip().splitlines()[0], "packshots": manifest}, ensure_ascii=False, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
