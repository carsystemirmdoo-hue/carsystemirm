#!/usr/bin/env python3
"""
Priprema Cikica spray-overlay PNG frejmova za compositing preko
spray-reveal-story.mp4.

Ulaz:  assets/cikica-spray/source/frame-01.png .. frame-08.png
       (RGB, checkerboard pozadina upisana u piksele, bez alpha kanala)
Izlaz: assets/cikica-spray/processed/frame-01.png .. frame-08.png
       (RGBA, transparentna pozadina, poravnati na zajednički anchor)

Koraci:
  1. Uklanjanje pozadine: flood-fill sa ivica platna, ograničen samo na
     piksele koji su "neutralni i svetli" (R≈G≈B, visoka svetlina) - tačno
     osobine checkerboard-a. Zatvoreni svetli detalji (đonovi patika, koji
     su topli krem ton, ne neutralan sivi) nikada ne ispunjavaju uslov pa se
     ne diraju, bez obzira na to koliko su blizu ivice.
  2. Feather 1-2px preko blage Gaussove zamućenosti maske pre konverzije u
     alpha kanal (izbegava tvrde nazubljene ivice).
  3. Edge decontamination: na poluprovidnim ivičnim pikselima ukloni primesu
     pozadinske boje (izbegava svetli halo oko kose/ivica).
  4. Anchor/normalizacija: poravnanje po liniji poda ispod patika i sredini
     između stopala (prioritet 1-2 iz brief-a), zatim opciona sitna
     skala-korekcija ako se visina lika razlikuje između frejmova.

Pokretanje:
  python3 scripts/prepare-cikica-frames.py
  python3 scripts/prepare-cikica-frames.py --debug   # snima i debug masku
"""

from __future__ import annotations

import sys
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = PROJECT_ROOT / "assets" / "cikica-spray" / "source"
OUTPUT_DIR = PROJECT_ROOT / "assets" / "cikica-spray" / "processed"
DEBUG_DIR = PROJECT_ROOT / "assets" / "cikica-spray" / "debug"

FRAME_NAMES = [f"frame-0{i}.png" for i in range(1, 9)]

# checkerboard je neutralan (R≈G≈B) i svetao (izmereno ~245-255).
# Tolerancije su namerno stroge da bi tople/senčene interne svetle povrsine
# (đonovi patika su krem/bež, ne neutralni) ostale netaknute.
NEUTRAL_TOLERANCE = 14
BRIGHTNESS_FLOOR = 210
FEATHER_RADIUS = 1.4


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"), dtype=np.uint8)


def background_candidate_mask(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    neutral = (maxc - minc) <= NEUTRAL_TOLERANCE
    bright = maxc >= BRIGHTNESS_FLOOR
    return neutral & bright


def flood_fill_from_border(candidate: np.ndarray) -> np.ndarray:
    """Vektorizovan BFS flood-fill (8-connectivity) preko iterativne
    dilatacije, ograničen na `candidate` masku. Nema zavisnost od scipy/cv2."""
    h, w = candidate.shape
    mask = np.zeros((h, w), dtype=bool)
    mask[0, :] |= candidate[0, :]
    mask[-1, :] |= candidate[-1, :]
    mask[:, 0] |= candidate[:, 0]
    mask[:, -1] |= candidate[:, -1]

    while True:
        grown = mask.copy()
        grown[1:, :] |= mask[:-1, :]
        grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        grown[1:, 1:] |= mask[:-1, :-1]
        grown[:-1, :-1] |= mask[1:, 1:]
        grown[1:, :-1] |= mask[:-1, 1:]
        grown[:-1, 1:] |= mask[1:, :-1]
        grown &= candidate
        if np.array_equal(grown, mask):
            return mask
        mask = grown


def feather_mask(bg_mask: np.ndarray) -> np.ndarray:
    """Vraca float alpha_bg u [0,1], 1=pozadina, 0=lik, blago zamucen rub."""
    float_mask = Image.fromarray((bg_mask * 255).astype(np.uint8))
    blurred = float_mask.filter(ImageFilter.GaussianBlur(radius=FEATHER_RADIUS))
    return np.array(blurred, dtype=np.float32) / 255.0


def decontaminate(rgb: np.ndarray, alpha: np.ndarray, bg_color: np.ndarray) -> np.ndarray:
    """Ukloni primesu pozadinske boje na poluprovidnim ivicnim pikselima."""
    out = rgb.astype(np.float32).copy()
    a = alpha.astype(np.float32) / 255.0
    edge = (a > 0.02) & (a < 0.98)
    a_safe = np.clip(a, 0.12, 1.0)[..., None]
    bg = bg_color.reshape(1, 1, 3)
    decontaminated = (rgb.astype(np.float32) - bg * (1 - a_safe)) / a_safe
    decontaminated = np.clip(decontaminated, 0, 255)
    out[edge] = decontaminated[edge]
    return np.clip(out, 0, 255).astype(np.uint8)


def remove_background(rgb: np.ndarray, debug_name: str | None = None) -> Image.Image:
    candidate = background_candidate_mask(rgb)
    bg_mask = flood_fill_from_border(candidate)
    alpha_bg = feather_mask(bg_mask)
    alpha = ((1.0 - alpha_bg) * 255).astype(np.uint8)

    border_bg = np.concatenate(
        [rgb[0, :][candidate[0, :]], rgb[-1, :][candidate[-1, :]],
         rgb[:, 0][candidate[:, 0]], rgb[:, -1][candidate[:, -1]]]
    )
    bg_color = border_bg.mean(axis=0) if len(border_bg) else np.array([250, 250, 250])

    rgb_clean = decontaminate(rgb, alpha, bg_color)

    if debug_name:
        DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        Image.fromarray((bg_mask * 255).astype(np.uint8)).save(DEBUG_DIR / f"{debug_name}-mask.png")
        Image.fromarray(alpha).save(DEBUG_DIR / f"{debug_name}-alpha.png")

    rgba = np.dstack([rgb_clean, alpha])
    return Image.fromarray(rgba)


def foreground_alpha_mask(rgba: np.ndarray, threshold: int = 128) -> np.ndarray:
    return rgba[:, :, 3] >= threshold


def measure_anchor(mask: np.ndarray, feet_band_px: int = 40) -> tuple[int, float, int]:
    """Vraca (floor_y, feet_center_x, top_y) za dati foreground mask."""
    ys, xs = np.where(mask)
    if len(ys) == 0:
        raise ValueError("Nema foreground piksela - background removal je verovatno pogresio.")
    floor_y = int(ys.max())
    top_y = int(ys.min())
    band_lo = max(top_y, floor_y - feet_band_px)
    band_mask = mask[band_lo:floor_y + 1, :]
    band_ys, band_xs = np.where(band_mask)
    feet_center_x = float(band_xs.mean()) if len(band_xs) else float(xs.mean())
    return floor_y, feet_center_x, top_y


def normalize_frames(rgba_frames: list[Image.Image]) -> list[Image.Image]:
    """Poravnava frejmove SAMO translacijom (linija poda + sredina stopala).

    Namerno se NE radi automatska skala po bounding-box visini: bounding box
    ukljucuje podignutu ruku sa sprejom, cija visina varira po pozi iz poze u
    pozu i nije merilo stvarne visine tela - koriscenje bi pogresno skaliralo
    ceo lik. Skala ostaje 1.0 za sve frejmove; canvas je fiksne, zajednicke
    velicine (dimenzije prvog frejma) za sve.
    """
    arrays = [np.array(f) for f in rgba_frames]
    masks = [foreground_alpha_mask(a) for a in arrays]
    anchors = [measure_anchor(m) for m in masks]

    floor_ys = [a[0] for a in anchors]
    feet_xs = [a[1] for a in anchors]

    target_floor_y = int(round(np.median(floor_ys)))
    target_feet_x = float(np.median(feet_xs))
    canvas_size = rgba_frames[0].size

    normalized = []
    for arr, (floor_y, feet_x, _top_y) in zip(arrays, anchors):
        img = Image.fromarray(arr)

        shift_x = int(round(target_feet_x - feet_x))
        shift_y = int(round(target_floor_y - floor_y))

        canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
        canvas.paste(img, (shift_x, shift_y), img)
        normalized.append(canvas)

    return normalized


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--debug", action="store_true", help="snimi debug mask/alpha fajlove")
    args = parser.parse_args()

    if not SOURCE_DIR.exists():
        print(f"Ne postoji {SOURCE_DIR}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    cleaned = []
    for name in FRAME_NAMES:
        src = SOURCE_DIR / name
        if not src.exists():
            print(f"Nedostaje {src}", file=sys.stderr)
            sys.exit(1)
        rgb = load_rgb(src)
        debug_name = name.replace(".png", "") if args.debug else None
        rgba_img = remove_background(rgb, debug_name=debug_name)
        cleaned.append(rgba_img)
        print(f"✔ ocisceno {name}")

    normalized = normalize_frames(cleaned)

    for name, img in zip(FRAME_NAMES, normalized):
        out_path = OUTPUT_DIR / name
        img.save(out_path)
        arr = np.array(img)
        alpha = arr[:, :, 3]
        has_transparent = bool((alpha == 0).any())
        has_opaque = bool((alpha == 255).any())
        print(
            f"✔ {name}: {img.size[0]}x{img.size[1]} alpha[min={alpha.min()} max={alpha.max()}] "
            f"transparent={has_transparent} opaque={has_opaque}"
        )
        if not (has_transparent and has_opaque):
            print(f"  ⚠ UPOZORENJE: {name} nema i 0 i 255 alpha vrednosti - proveri rucno!")


if __name__ == "__main__":
    main()
