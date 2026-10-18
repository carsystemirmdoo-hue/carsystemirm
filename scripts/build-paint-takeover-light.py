#!/usr/bin/env python3
"""Svetla varijanta poteza za blok „Boja nije sloj“ (tamna tema sajta).

Ne invertuje sliku: iz originalnog SVG-a menja samo krem/bele poteze
(#f4f1eb, #d9d2c7), koji su na tamnoj podlozi beli, u tamno mastilo. Obojeni
akcenti (magenta, plava, cijan, ljubičasta, crvena) ostaju isti, a bele boje
u maskama se ne diraju.

  python3 scripts/build-paint-takeover-light.py [--check]
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/art/paint-takeover/paint-takeover-hero-strokes-final.svg"
TARGET = ROOT / "public/art/paint-takeover/paint-takeover-hero-strokes-light.svg"

RECOLOR = {
    "#f4f1eb": "#1c1e26",  # beli potezi -> tamno mastilo
    "#d9d2c7": "#4a4d57",  # krem senka -> tamno siva
}


def build() -> str:
    text = SOURCE.read_text()
    for old, new in RECOLOR.items():
        text = text.replace(old, new).replace(old.upper(), new)
    return text.replace(
        'aria-label="Finalni Carsystem painterly hero',
        'aria-label="Svetla varijanta: Carsystem painterly hero',
        1,
    )


def main() -> int:
    output = build()
    if "--check" in sys.argv:
        if not TARGET.exists() or TARGET.read_text() != output:
            print(f"{TARGET.relative_to(ROOT)} nije u koraku sa izvorom; pokrenite skriptu.")
            return 1
        print("Svetla varijanta poteza je u koraku sa izvorom.")
        return 0
    TARGET.write_text(output)
    print(f"{TARGET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
