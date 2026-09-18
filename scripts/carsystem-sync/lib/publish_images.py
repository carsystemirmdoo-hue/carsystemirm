#!/usr/bin/env python3
"""Objava zvaničnih Carsystem packshotova + uzorak boje.

Poziva ga `apply.mjs`. Ulaz (stdin, JSON): lista {"src", "dest", "sample"}.
Izlaz (stdout, JSON): po `dest` → dimenzije, veličina i (opciono) uzorak boje.

Konverzija: WebP q90 sa alfa kanalom. Proporcije i transparentnost se ne
diraju, slika se ne rasteže i ne uvećava; ulaz je zvanični 660 px render.

Uzorak boje opisuje PIKSELE, ne proizvod: koliki deo neprovidne površine nosi
dominantnu zasićenu boju i koja je medijana neutralnih piksela. Da li se ta
boja sme upotrebiti kao boja serije odlučuje `apply.mjs` prema taxonomy mapi.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

WEBP_QUALITY = 90
HUE_BINS = 24


def sample(image: Image.Image) -> dict:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.int16)
    rgb, alpha = rgba[..., :3], rgba[..., 3]
    has_alpha = bool((alpha < 250).any())
    # Bez alfe (JPEG na beloj podlozi) podloga se izuzima po svetlini.
    mask = alpha > 200 if has_alpha else rgb.min(axis=-1) < 235
    pixels = rgb[mask]
    if len(pixels) < 500:
        return {"opaquePixels": int(len(pixels))}

    high, low = pixels.max(axis=1), pixels.min(axis=1)
    chroma = high - low
    lightness = pixels.mean(axis=1) / 255.0
    saturated = (chroma >= 48) & (lightness > 0.12) & (lightness < 0.95)

    result = {
        "opaquePixels": int(len(pixels)),
        "saturatedShare": round(float(saturated.mean()), 4),
        "medianHex": "#%02X%02X%02X" % tuple(int(v) for v in np.median(pixels, axis=0)),
        "medianLightness": round(float(np.median(lightness)), 4),
    }
    if saturated.sum() < 200:
        return result

    sat = pixels[saturated].astype(np.float64)
    r, g, b = sat[:, 0], sat[:, 1], sat[:, 2]
    mx, mn = sat.max(axis=1), sat.min(axis=1)
    delta = np.maximum(mx - mn, 1)
    hue = np.where(mx == r, ((g - b) / delta) % 6, np.where(mx == g, (b - r) / delta + 2, (r - g) / delta + 4)) * 60.0
    bins = (hue // (360 / HUE_BINS)).astype(int) % HUE_BINS
    counts = np.bincount(bins, minlength=HUE_BINS)
    # Susedna polja se sabiraju: jedna boja pod različitim svetlom prelazi granicu polja.
    windowed = counts + np.roll(counts, 1) + np.roll(counts, -1)
    center = int(windowed.argmax())
    member = np.isin(bins, [(center - 1) % HUE_BINS, center, (center + 1) % HUE_BINS])
    dominant = sat[member]
    result["dominantShare"] = round(float(member.sum() / len(pixels)), 4)
    result["dominantHex"] = "#%02X%02X%02X" % tuple(int(v) for v in np.median(dominant, axis=0))
    result["dominantHue"] = int(center * (360 / HUE_BINS))
    return result


def main() -> None:
    jobs = json.load(sys.stdin)
    out = {}
    for job in jobs:
        src, dest = Path(job["src"]), Path(job["dest"])
        with Image.open(src) as image:
            image.load()
            entry = {"width": image.width, "height": image.height}
            if job.get("sample"):
                entry["sample"] = sample(image)
            if job.get("write", True):
                dest.parent.mkdir(parents=True, exist_ok=True)
                keeps_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
                converted = image.convert("RGBA" if keeps_alpha else "RGB")
                converted.save(dest, "WEBP", quality=WEBP_QUALITY, method=6, exact=False)
            if dest.exists():
                entry["bytes"] = dest.stat().st_size
        out[job["dest"]] = entry
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
