#!/usr/bin/env python3
"""Uvoz kataloških slika iz kruga popune nedostajućih slika (2026-10).

Izvori (originali su van Gita, u `assets/manufacturer/<brend>/…`, kao i ostali portal originali):
  * R-M i baslac — Surventis Brand Portal (hub 51 / hub 54), dugme „Download original”.
  * Norbin — renderi ambalaže proizvođača sa sajta distributera Väritikka Oy (varitikka.fi);
    Norbin portal ne postoji, a norbin-paint.com ne objavljuje slike proizvoda.

Svaka stavka je jedan identitet iz `MISSING_PRODUCT_IMAGES.csv` (CARD opseg) čija je etiketa na
originalu ručno pročitana i odgovara brendu, nazivu i šifri zapisa (`identityEvidence`).

Obrada je deterministička i ne menja sadržaj proizvoda:
  * original sa pravom providnošću → obrezivanje praznog (providnog) ruba + 4 % odstojanja;
  * original na beloj podlozi → obrezivanje bele margine (prag 252) + 4 % odstojanja, bela podloga
    OSTAJE (izdvajanje alfe bi probušilo belu etiketu — isto pravilo kao `build-baslac-portal-assets.py`);
  * skaliranje na najviše MAX_SIDE px po dužoj strani (LANCZOS), WebP q90; boja se ne menja
    (svi originali su sRGB IEC61966-2.1, profil se zadržava).

Upotreba:
  python3 scripts/catalog/build-image-gap-imports.py          # piše WebP i dopunjuje supplied-images.json
  python3 scripts/catalog/build-image-gap-imports.py --check  # proverava da su izlazi ažurni, ne piše ništa
"""

from __future__ import annotations

import hashlib
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "data/catalog/image-supply/supplied-images.json"
MAX_SIDE = 1600
PAD = 0.04
WEBP = {"format": "WEBP", "quality": 90, "method": 6}
DOWNLOADED_ON = "2026-10-06"

RM_PORTAL = {
    "portal": "Surventis Brand Portal — R-M hub 51, Media Library (document 392)",
    "portalUrl": "https://brand.surventiscoatings.com/hub/51",
    "collection": "All R-M Packshots",
}
BASLAC_PORTAL = {
    "portal": "Surventis Brand Portal — baslac hub 54, Media Library (document 418)",
    "portalUrl": "https://brand.surventiscoatings.com/hub/54",
}
PORTAL_PERMISSION = (
    "Vlasnik je 2026-09-28 potvrdio dozvolu dobavljača (Surventis) za upotrebu zvaničnih "
    "R-M i baslac materijala sa portala na sajtu."
)
PORTAL_DOWNLOAD = "Portal API isti kao dugme „Download original” (/api/screen/download/<id>); veličina = file_size zapisa asseta, ne CDN pregled"

# (brend, slug, portal asset id, naslov asseta na portalu, tekst etikete pročitan na originalu)
RM = [
    ("rm-c-2a95-mattop", 10952, "ADVANCE_MatTOP_C_2A95_0-75L_0000_CMYK", "MatTOP · C 2A95 · Clear coat, silk mat (Advance Series, 0,75 L)"),
    ("rm-h-2a31-fillcure-slow", 36413, "50772225_RD3327_2_50772225_20231010154502_composite", "FillCURE Slow · H 2A31 (Advance Series)"),
    ("rm-r-2a20-airtopthinn", 36414, "50760186_RD6027_4_50760186_20231010154506_composite", "AirtopTHINN · R 2A20 · Thinner, air drying (Advance Series)"),
    ("rm-h-700-ghd-hardener", 36409, "50451550_RM7013_2_50451550_20231010144728_composite", "GHD HARDENER · H 700"),
    ("rm-gv-100-ghd-thinner", 36375, "54776548_RM60B2_3_54776548_20231010143754_composite", "GHD THINNER · GV 100"),
    ("rm-gv-200-ghd-thinner", 36408, "50195392_RM60B2_3_50195392_20231010143758_composite", "GHD THINNER · GV 200"),
    ("rm-gv-300-ghd-thinner", 36374, "54776654_RM60B2_3_54776654_20231010143803_composite", "GHD THINNER · GV 300"),
    ("rm-gv-400-ghd-thinner", 36373, "54776707_RM60B2_4_54776707_20231010143807_composite", "GHD THINNER · GV 400"),
    ("rm-h-750-ghd-hardener", 36370, "50451565_RM70B2_2_50451565_20231010143824_composite", "GHD HARDENER · H 750"),
    ("rm-h-770-ghd-hardener", 36371, "50451562_RM70B2_2_50451562_20231010143829_composite", "GHD HARDENER · H 770"),
    ("rm-ghd-cv-12", 36407, "53210186_RM71A7_2_53210186_20231009161331_composite", "GRAPHITE HD · CV 12 (GHD = Graphite HD)"),
    ("rm-ghd-cv-40m", 36404, "50795799_RM70A7_5_50795799_20231009161335_composite", "GRAPHITE HD · CV 40M"),
    ("rm-a-5700-ghd-tinting-paste", 36406, "50501819_RM50A7_2_50501819_20231009161346_composite", "GHD TINTING PASTE · A 5700"),
    ("rm-p-5430w-ghd-surfacer-white", 36405, "50610299_RM50A7_2_50610299_20231010140805_composite", "SURFACER WHITE · P 5430W (GHD linija)"),
    ("rm-p-5433-ghd-chassismix", 36402, "53209550_RM50B7_3_53209550_20231009160804_composite", "GHD CHASSISMIX · P 5433"),
    ("rm-p-5520-ghd-multi-primer-filler-cf", 36400, "50431876_RM50B7_2_50431876_20231009160919_composite", "MULTI PRIMER FILLER CF · P 5520"),
    ("rm-db-403-onyx-hd-deep-black", 36392, "50173786_RM6102_2_50173786_20231009153601_composite", "ONYX HD · DB 403 (engleska etiketa)"),
    ("rm-a-5200-ghd-deco-a", 36377, "50795999_RM70B2_2_50795999_20231010154931_composite", "GHD DECO A · A 5200"),
    ("rm-am-2p35-blending-thinn-r", 36418, "50685273_RC6230_2_50685273_20231023105613_composite", "BLENDING THINN-R · AM 2P35 · Blending additive (aerosol, Pioneer Series)"),
    ("rm-hb-015-agilis-minor-repair", 36417, "50769128_RA3122_1_50769128_20231023103642_composite", "AGILIS · HB 015"),
    ("rm-a-2010-bril-852", 33347, "50250554_RM1190_1_50250554_20230613110248_composite", "BRIL 852 · A 2010"),
    ("rm-d-121-ultra-flash-flake-diamond", 33248, "50411239_RM1180_3_50411239_20230607140358_composite", "DIAMONT · D 121 (engleska etiketa)"),
    ("rm-a-2810-hydropure", 32662, "53236209_RM11A6_1_53236209_20230613135831_composite", "HYDROPURE · A 2810"),
    ("rm-h-2p96-matshade-harden-r", 32576, "50824795_RC3327_3_50824795_20231005125151_composite", "MATSHADE HARDEN-R · H 2P96 · eSense topcoat hardener, mat slow (Pioneer Series)"),
    ("rm-a-2540-agilis-blender-x-treme", 30620, "50814622_RA3122_0_50814622_20230605100314_composite", "AGILIS · A 2540 (linija AGILIS i šifra se poklapaju sa zapisom; NE „BLENDING FLASH A2540”, to je druga linija)"),
    ("rm-onyx-hd", 30819, "R-M_1L_ONYX HD", "ONYX HD — generička sistemska limenka bez šifre nijanse (isti princip kao odobreni UNO HD 30820); zamenjuje kanister komponente HB 002 koji je pogrešno predstavljao ceo sistem"),
    ("rm-r-2p45-clear-thinn-r", 36379, "50675739_RC60B2_4_50675739_20231010154923_composite", "CLEAR THINN-R EXTRA SLOW · R 2P45 (Pioneer Series, eSense)"),
]

BASLAC = [
    ("baslac-20-22-2k-primerfiller", 21527, "50758786_baslac_20-22_2K Primerfiller", "baslac · 20-22 · 2K Primerfiller"),
    ("baslac-20-24-2k-primerfiller-grey-4l", 12157, "Baslac_4L_20-24_50207013 Kopie", "baslac · 20-24 · 2K Primerfiller · 4 L"),
    ("baslac-20-94-2k-primerfiller-black-1l", 12110, "Baslac_1L_20-94_50467291 Kopie", "baslac · 20-94 · 2K Primerfiller black · 1 L"),
    ("baslac-21-11-2k-plastic-primer-voc-1l", 12112, "baslac_1L_21-11_50526775", "baslac · 21-11 · 2K Plastic Primer VOC · 1 L"),
    ("baslac-21-20-plastic-primer-400ml", 12091, "baslac 0.4L 21-20 Plastic Primer 50526791", "baslac · 21-20 · Plastic Primer · sprej 0,4 L"),
    ("baslac-27-10-2k-washprimer-1l", 12113, "baslac_1L_27-10_50492012", "baslac · 27-10 · 2K Washprimer · 1 L"),
    ("baslac-45-w10", 12093, "baslac_0_5L_45-W10_50392479", "baslac · 45-W10 · 3-Coat Additive · 0,5 L"),
    ("baslac-50-10-2k-primerfiller-hardener-extra-fast", 12122, "Baslac_1L_50-10_54667633", "baslac · 50-10 · 2K Hardener Extra Fast · 1 L"),
    ("baslac-50-30-2k-hardener-slow", 12125, "Baslac_1L_50-30_54666997", "baslac · 50-30 · 2K Hardener Slow · 1 L"),
    ("baslac-50-415-2k-clear-hardener-fast-voc", 12140, "baslac_2_5L_50-415_50491112 Kopie", "baslac · 50-415 · 2K Clear Hardener Fast VOC · 2,5 L"),
    ("baslac-50-420-2k-clear-hardener-normal-voc", 12141, "baslac_2_5L_50-420_50400517 Kopie", "baslac · 50-420 · 2K Clear Hardener Normal VOC · 2,5 L"),
    ("baslac-50-430-2k-clear-hardener-slow-voc", 12142, "baslac_2_5L_50-430_50649615 Kopie", "baslac · 50-430 · 2K Clear Hardener Slow VOC · 2,5 L"),
    ("baslac-50-45-2k-activator", 12098, "baslac_0_5L_50-45_50507477", "baslac · 50-45 · 2K Activator · 0,5 L"),
    ("baslac-50-510-ambient-clear-hardener", 12102, "baslac_0_5L_50-510_50669596", "baslac · 50-510 · Ambient Hardener · 0,5 L"),
    ("baslac-51-515-2k-hardener-cv-fast", 12143, "baslac_2_5L_51-515_50583094 Kopie", "baslac · 51-515 · 2K Hardener CV fast · 2,5 L"),
    ("baslac-51-520-2k-hardener-cv-normal", 12144, "baslac_2_5L_51-520__50583096 Kopie", "baslac · 51-520 · 2K Hardener CV normal · 2,5 L"),
    ("baslac-51-530-2k-hardener-cv-slow", 12145, "baslac_2_5L_51-530_50583129 Kopie", "baslac · 51-530 · 2K Hardener CV slow · 2,5 L"),
    ("baslac-55-10-ep-hardener", 12126, "Baslac_1L_55-10_50608954", "baslac · 55-10 · EP Hardener · 1 L"),
    ("baslac-56-20-bodyfiller-hardener", 12087, "baslac 56-20 Bodyfiller Hardener 50466915", "baslac · 56-20 · BodyFiller Hardener · tuba 40 g"),
    ("baslac-57-10-additive-washprimer", 12104, "Baslac_0_5L_57-1050492013 Kopie", "baslac · 57-10 · Additive Washprimer · 0,5 L"),
    ("baslac-57-30-additive-washprimer-slow", 12103, "Baslac_0_5L_57-30_50626008 Kopie", "baslac · 57-30 · Additive Washprimer slow · 0,5 L"),
    ("baslac-60-05-speeding-reducer", 12128, "Baslac_1L_60-05_50508528 Kopie", "baslac · 60-05 · Speeding Reducer · 1 L"),
    ("baslac-60-10-reducer-universal-fast", 12082, "baslac 5L 60-10 Reducer 50102836", "baslac · 60-10 · Reducer Universal Fast · 5 L"),
    ("baslac-60-20-razredjivac", 12083, "baslac 5L 60-20 Reducer 54764676", "baslac · 60-20 · Reducer Universal Normal · 5 L (zapis: 60-20, 5 L)"),
    ("baslac-60-30-reducer-universal-slow", 12084, "baslac 5L 60-30 54764464", "baslac · 60-30 · Reducer Universal Slow · 5 L"),
    ("baslac-60-40-reducer-universal-extra-slow", 12130, "Baslac_1L_60-40_54765047", "baslac · 60-40 · Reducer Universal extra slow · 1 L"),
    ("baslac-65-10-blending-reducer", 12131, "Baslac_1L_65-10_54764305", "baslac · 65-10 · Reducer Blending · 1 L"),
    ("baslac-70-10-silicone-remover-for-oil-silicone-and-grease", 12132, "Baslac_1L_70-10_50643350", "baslac · 70-10 · Silicone Remover · 1 L"),
    ("baslac-70-45-cleaner", 12086, "baslac 5L 70-45 50394852", "baslac · 70-45 · Cleaner (Basecoat 45) · 5 L"),
    ("baslac-81-30-additive-chassis", 12162, "baslac 4L 81-30 Additive Chassis CV 50583201", "baslac · 81-30 · Additive Chassis CV · 4 L"),
]

# (slug, lokalni original, stranica proizvoda, URL originala, tekst etikete)
NORBIN = [
    ("norbin-n15-v20-clear-voc", "N15-V20__varitikka.png", "https://www.varitikka.fi/tuote/norbin-n15-v20-2k-kirkaslakka-voc-40ltr/", "https://www.varitikka.fi/app/uploads/2024/03/norbin-5l-n15-v20.png", "NORBIN · Clear VOC · N15-V20 (pravougaona limenka; zapremina nije odštampana na renderu — distributer isti render prodaje kao „N15-V20 … VOC 4,0 ltr”; naziv fajla kod distributera sadrži „5l”)"),
    ("norbin-n55-v20-2k-primer-filler-grey", "N55-V20__varitikka.png", "https://www.varitikka.fi/tuote/norbin-n55-v20-29-2k-hiomavari-25ltr/", "https://www.varitikka.fi/app/uploads/2024/03/norbin-2k-primer-filler-greyn55-v20.png", "NORBIN · 2K Primer Filler grey · N55-V20 (okrugla limenka 2,5 L)"),
    ("norbin-n55-v29-2k-primer-filler-black", "N55-V29__varitikka.png", "https://www.varitikka.fi/tuote/norbin-n55-v20-29-2k-hiomavari-25ltr/", "https://www.varitikka.fi/app/uploads/2024/03/norbin-n55-v29-25l.png", "NORBIN · 2K Primer Filler black · N55-V29 (okrugla limenka 2,5 L)"),
    ("norbin-n75-020-hardener-fast", "N75-020__varitikka.png", "https://www.varitikka.fi/tuote/norbin-n75-020-kovettaja-nopea-05ltr/", "https://www.varitikka.fi/app/uploads/2024/03/norbin-hardnerfastn75-020.png", "NORBIN · Hardener Fast · N75-020 (limenka 0,5 L)"),
    ("norbin-n75-021-hardener-normal", "N75-021__varitikka_PHOTO.jpg", "https://www.varitikka.fi/tuote/norbin-n75-021-kovettaja-05ltr/", "https://www.varitikka.fi/app/uploads/2024/03/norbin-500ml-n75-021.jpg", "NORBIN · Hardener · N75-021 (studijska fotografija limenke 0,5 L; starija etiketa bez reči „Normal”)"),
    ("norbin-n75-v21-clear-hardener-voc", "N75-V21__varitikka.png", "https://www.varitikka.fi/tuote/norbin-n75-v21-kovettaja-voc-10ltr/", "https://www.varitikka.fi/app/uploads/2024/03/norbin-1l-n75-v21.png", "NORBIN · Clear Hardener VOC · N75-V21 (limenka 1 L)"),
]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def find_original(directory: Path, prefix: str) -> Path:
    matches = sorted(directory.glob(f"{prefix}*"))
    if len(matches) != 1:
        raise SystemExit(f"Original {prefix}* u {directory.relative_to(ROOT)}: nađeno {len(matches)} (treba tačno 1).")
    return matches[0]


def derive(source: Path) -> tuple[Image.Image, str]:
    with Image.open(io.BytesIO(source.read_bytes())) as raw:
        raw.load()
        icc = raw.info.get("icc_profile")
        rgba = raw.convert("RGBA")
    alpha = np.asarray(rgba)[..., 3]
    if (alpha < 250).mean() > 0.01:
        # prava providnost: obrezuje se samo prazan (providan) rub, senka ostaje
        box = Image.fromarray((alpha > 8).astype(np.uint8) * 255).getbbox()
        image, mode = rgba, "alpha"
    else:
        rgb = rgba.convert("RGB")
        box = rgb.convert("L").point(lambda v: 255 if v < 252 else 0).getbbox()
        image, mode = rgb, "white"
    if box is None:
        raise SystemExit(f"{source.name}: nema motiva.")
    pad = round(max(box[2] - box[0], box[3] - box[1]) * PAD)
    fill = (0, 0, 0, 0) if mode == "alpha" else (255, 255, 255)
    crop = Image.new(image.mode, (box[2] - box[0] + 2 * pad, box[3] - box[1] + 2 * pad), fill)
    crop.paste(image.crop(box), (pad, pad))
    if max(crop.size) > MAX_SIDE:
        scale = MAX_SIDE / max(crop.size)
        crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.LANCZOS)
    if icc:
        crop.info["icc_profile"] = icc
    return crop, mode


def encode(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    options = dict(WEBP)
    if image.info.get("icc_profile"):
        options["icc_profile"] = image.info["icc_profile"]
    image.save(buffer, **options)
    return buffer.getvalue()


def entries():
    for slug, asset_id, title, label in RM:
        yield "rm", slug, find_original(ROOT / "assets/manufacturer/rm/portal", f"{asset_id}__"), {
            "kind": "portal", "batch": "SUPPLIER_PORTAL_RM_2026-10", "assetId": asset_id, "assetTitle": title, "label": label, "portal": RM_PORTAL,
        }
    for slug, asset_id, title, label in BASLAC:
        yield "baslac", slug, find_original(ROOT / "assets/manufacturer/baslac/portal", f"{asset_id}__"), {
            "kind": "portal", "batch": "SUPPLIER_PORTAL_BASLAC_2026-10", "assetId": asset_id, "assetTitle": title, "label": label, "portal": BASLAC_PORTAL,
        }
    for slug, file_name, page, url, label in NORBIN:
        yield "norbin", slug, ROOT / "assets/manufacturer/norbin/distributor" / file_name, {
            "kind": "distributor", "batch": "DISTRIBUTOR_RENDER_NORBIN_2026-10", "page": page, "url": url, "label": label,
        }


def build(check: bool) -> int:
    registry = json.loads(REGISTRY.read_text(encoding="utf8"))
    by_id = {image["imageId"]: image for image in registry["images"]}
    stale = []
    for brand, slug, source, meta in entries():
        image_id = f"{brand}__{slug}"
        pending = meta["kind"] == "distributor"  # pravo objave nije potvrđeno → van public/
        rel = f"/products/{brand}/pending-rights/{image_id}.webp" if pending else f"/products/{brand}/supplied/{image_id}.webp"
        staged = f"review-assets/pending-rights/{brand}/{image_id}.webp" if pending else None
        derived, mode = derive(source)
        data = encode(derived)
        target = ROOT / staged if staged else ROOT / "public" / rel.lstrip("/")
        source_bytes = source.read_bytes()
        method = (
            "obrezan samo providni rub + 4 % odstojanja, alfa i senka očuvane" if mode == "alpha"
            else "obrezana samo bela margina (prag 252) + 4 % odstojanja, bela podloga originala zadržana (bez izdvajanja alfe)"
        ) + f"; skalirano LANCZOS na ≤ {MAX_SIDE} px; WebP q90; sRGB profil zadržan; sadržaj proizvoda nije menjan"
        entry = {
            "imageId": image_id, "brand": brand, "scope": "CARD", "slug": slug, "path": rel,
            "sha256": sha(data), "width": derived.width, "height": derived.height,
            "sourceFile": source.name.split("__", 1)[1] if meta["kind"] == "portal" else Path(meta["url"]).name,
            "sourceSha256": sha(source_bytes), "batch": meta["batch"],
        }
        if staged:
            entry["stagedSource"] = staged
        if meta["kind"] == "portal":
            entry |= {
                "sourceBasis": "SUPPLIER_BRAND_PORTAL", "processing": "CROP_SCALE_ONLY", "rightsBasis": "OWNER_CONFIRMED",
                "sourceDetail": {
                    **meta["portal"], "assetId": meta["assetId"], "assetTitle": meta["assetTitle"],
                    "originalFile": source.name.split("__", 1)[1], "downloadedOn": DOWNLOADED_ON,
                    "downloadMethod": PORTAL_DOWNLOAD,
                    "identityEvidence": f"Etiketa na originalu (ručno pročitano): {meta['label']}. Šifra i naziv odgovaraju zapisu `{slug}`.",
                    "processingMethod": method, "ownerPermission": PORTAL_PERMISSION,
                },
            }
        else:
            entry |= {
                "sourceBasis": "DISTRIBUTOR_HOSTED_MANUFACTURER_RENDER", "processing": "CROP_SCALE_ONLY", "rightsBasis": "OWNER_CONFIRMATION_REQUIRED",
                "sourceDetail": {
                    "distributor": "Väritikka Oy (varitikka.fi), ovlašćeni prodavac Norbin/Glasurit/baslac u Finskoj",
                    "productPage": meta["page"], "originalUrl": meta["url"], "downloadedOn": DOWNLOADED_ON,
                    "identityEvidence": f"Etiketa na slici (ručno pročitano): {meta['label']}. Šifra i pakovanje odgovaraju zapisu `{slug}`.",
                    "rightsNote": "Render ambalaže je delo proizvođača (BASF Coatings / Surventis); sajt distributera nema izjavu o autorskim pravima ni zabranu upotrebe. Proizvođač (norbin-paint.com) ne objavljuje slike proizvoda. Pre Production objave vlasnik potvrđuje pravo upotrebe.",
                    "processingMethod": method,
                },
            }
        existing = by_id.get(image_id)
        if pending and existing and existing.get("rightsBasis") == "OWNER_CONFIRMED":
            # Vlasnik je u međuvremenu potvrdio pravo: zapis se više ne vraća u pending-rights.
            print(f"SKIP {image_id}: pravo je potvrđeno (OWNER_CONFIRMED) — zapis se ne menja")
            continue
        current = target.read_bytes() if target.exists() else None
        if current != data or by_id.get(image_id) != entry:
            stale.append(image_id)
        if not check:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            by_id[image_id] = entry
        print(f"{'OK ' if current == data else ('W  ' if not check else 'STALE')} {rel} {derived.width}x{derived.height} {mode} {len(data) // 1024} KB")

    if not check:
        model = registry["provenanceModel"]
        model["sourceBasis"].setdefault(
            "DISTRIBUTOR_HOSTED_MANUFACTURER_RENDER",
            "Render/fotografija ambalaže proizvođača preuzeta u originalnoj veličini sa sajta pouzdanog distributera (ne thumbnail pretrage), kada proizvođač sam ne objavljuje slike. Stranica i URL originala su u `sourceDetail`; pravo objave potvrđuje vlasnik.",
        )
        model["processing"].setdefault(
            "CROP_SCALE_ONLY",
            "Obrezan samo prazan rub (providan ili beo) uz 4 % odstojanja i skaliranje; pikseli proizvoda, boja i senka nisu menjani.",
        )
        order = [image["imageId"] for image in registry["images"]]
        registry["images"] = [by_id[i] for i in order] + [by_id[i] for i in sorted(set(by_id) - set(order))]
        REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    if check and stale:
        print(f"Zastarelo: {len(stale)} — pokrenite bez --check.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(build("--check" in sys.argv))
