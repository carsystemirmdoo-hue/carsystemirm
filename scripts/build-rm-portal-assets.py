#!/usr/bin/env python3
"""Izvodi produkcione R-M vizuale iz originala sa Surventis Brand Portala (hub 51).

Originali: `assets/manufacturer/rm/portal/<id>__<originalni naziv>` (u .gitignore).
Poreklo, izbor i odbačeni kandidati: `docs/RM_PORTAL_ASSETS.md`. Zajednička
logika je u `scripts/brand_portal_assets.py` (ista kao za baslac).

Obrada samo iseca i skalira fotografije. UNO HD limenka (30820) se ovde NE izvodi: ona je
kataloška slika zapisa `rm-uno-hd` (`data/catalog/image-supply/supplied-images.json`), a brend
stranica je čita iz kataloga.

  python3 scripts/build-rm-portal-assets.py [--check]
"""

from __future__ import annotations

import argparse

from brand_portal_assets import (
    ROOT,
    WEBP_PHOTO,
    PortalSource,
    crop_box,
    crop_ratio,
    fit,
    report,
    save,
)

PORTAL = PortalSource("rm", "docs/RM_PORTAL_ASSETS.md")
REFINITY_DIR = ROOT / "public/images/brands/rm/refinity"

STEP_WIDTH = 900  # 4:5 → 900×1125; pločica je najviše ~260 CSS px, pa i 2x ima rezerve.

# Refinity tok: portal ID → (izlazni fajl, kadar). Kadar je isečak originala u
# udelima (x0, y0, x1, y1) ili fokus za najveći 4:5 isečak.
REFINITY_STEPS = [
    # 01 Vozilo — lakirani blatobran, retrovizor i ručka vrata; točak (znak
    # proizvođača, natpis gume) ostaje van kadra.
    (63938, "rm-refinity-step-01-vehicle.webp", ("box", (0.52, 0.24, 0.95, 0.605))),
    # 02 ScanR — merni uređaj na lakiranoj površini.
    (76316, "rm-refinity-step-02-scanr.webp", ("focus", (0.5, 0.45))),
    # 03 Refinity formula — rad na Refinity stanici (ekran + tehničar).
    (50792, "rm-refinity-step-03-formula.webp", ("focus", (0.62, 0.42))),
    # 04 Automatsko mešanje — R-M automatska mašina za mešanje.
    (41774, "rm-refinity-step-04-mixing.webp", ("focus", (0.56, 0.5))),
    # 05 Spremna boja — lakiran panel na stalku.
    (76311, "rm-refinity-step-05-result.webp", ("focus", (0.5, 0.6))),
]


def build(check: bool) -> list:
    log: list = []

    for asset_id, name, (mode, value) in REFINITY_STEPS:
        image = PORTAL.open_rgb(asset_id)
        if mode == "box":
            image = crop_box(image, value)
        image = crop_ratio(image, 4 / 5, *value) if mode == "focus" else crop_ratio(image, 4 / 5, 0.5, 0.5)
        save(fit(image, STEP_WIDTH), REFINITY_DIR / name, WEBP_PHOTO, check, log)

    return log


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="samo proveri izvore")
    args = parser.parse_args()
    report(build(args.check), args.check)


if __name__ == "__main__":
    main()
