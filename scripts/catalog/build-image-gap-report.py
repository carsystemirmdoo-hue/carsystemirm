#!/usr/bin/env python3
"""Izveštaj kruga popune slika (2026-10): ADDED_IMAGES + UNRESOLVED_IMAGES (CSV i Markdown).

Ulazi:
  * data/catalog/image-supply/supplied-images.json      — dodate slike (batch-evi 2026-10)
  * data/catalog/image-supply/MISSING_PRODUCT_IMAGES.csv — nerešene slike proizvoda (generator manifesta)
  * docs/catalog/image-gaps-2026-10/browser-placeholder-pages.json — gde se placeholder stvarno VIDI
    u browseru (pregled sitemap-a, svih URL-ova varijanti i aria-label slotova; videti README izveštaja)
  * ručno utvrđeni ne-proizvodni slotovi i nalazi ispod (NON_PRODUCT), sa izvorima koji su provereni

Izlaz: docs/catalog/image-gaps-2026-10/{ADDED_IMAGES,UNRESOLVED_IMAGES}.{csv,md}
"""

from __future__ import annotations

import csv
import io
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/catalog/image-gaps-2026-10"
BATCHES = {"SUPPLIER_PORTAL_RM_2026-10", "SUPPLIER_PORTAL_BASLAC_2026-10", "DISTRIBUTOR_RENDER_NORBIN_2026-10"}
SITE = "https://carsystemirm.com"

R_M_PORTAL_CHECK = (
    "Surventis Brand Portal R-M hub 51 (2026-10-06): pretraga po šifri i nazivu + vizuelni pregled svih "
    "808 neimenovanih packshotova (composite) i 123 imenovana kandidata; info.rmpaint.com (stranica proizvoda nema packshot)"
)
BASLAC_PORTAL_CHECK = "Surventis Brand Portal baslac hub 54 (svih 441 asseta, 2026-10-06); baslac.com stranica proizvoda (nema packshota)"
NORBIN_CHECK = (
    "norbin-paint.com (bez slika proizvoda); brošura NORBIN_Broch_EN_2024 (samo grupna slika, limenka delimično zaklonjena); "
    "varitikka.fi, tobis.ee/.lt/.lv, carparts247.co.uk, lasurit.com, colormarket.online (nema slike ove šifre); Surventis portal nema Norbin biblioteku"
)
SATA_CHECK = (
    "sata.com stranica artikla (slika postoji, URL iz manifesta od 2026-09-24 vraća 404 — SATA je premestio media putanje); "
    "sata.com/en/legal-notice, /en/terms-conditions, /de-de/agb, /en/service/downloads (nema press/media dozvole)"
)
COSMOS_CHECK = (
    "cosmoslac.com stranica proizvoda; Brand Kit (cosmoslac.com/brand-kit — zaštićen lozinkom); uslovi korišćenja cosmoslac.com/el/oroi-chrisis"
)

# Razlog po (brend, missing_reason) iz manifesta; pojedinačne napomene dopunjuju ITEM_NOTES.
REASONS = {
    ("sata", "OFFICIAL_IMAGE_RIGHTS_REVIEW"): "Zvanična slika postoji, ali SATA zadržava sva prava i ne objavljuje dozvolu za preprodavce; potrebna je pisana saglasnost SATA (ili slike iz SATA PSV dealer shop-a).",
    ("sata", "PLACEHOLDER_ACCEPTED"): "SATA ne objavljuje sliku ovog pribora; vlasnik je ranije prihvatio placeholder (pribor faze 2).",
    ("sata", "OFFICIAL_IMAGE_NOT_PUBLISHED"): "SATA za ovaj artikal ne objavljuje sliku.",
    ("cosmos-lac", "OFFICIAL_IMAGE_AVAILABLE_NOT_IMPORTED"): "Slika postoji samo na cosmoslac.com (nema je u Brand Kit-u). Uslovi korišćenja cosmoslac.com zabranjuju komercijalnu upotrebu bez prethodne pisane dozvole.",
    ("rm", "OFFICIAL_IMAGE_NOT_PUBLISHED"): "Packshot ove šifre nije pronađen ni na Surventis portalu ni na info.rmpaint.com.",
    ("rm", "USER_SUPPLY_REQUIRED"): "Ručni zapis bez šifre proizvođača — identitet (koji DIAMONT lak) nije potvrđen, pa se slika ne može uparivati.",
    ("baslac", "OFFICIAL_IMAGE_NOT_PUBLISHED"): "Packshot ove šifre ne postoji na baslac portalu (441 asset) ni na baslac.com.",
    ("baslac", "USER_SUPPLY_REQUIRED"): "Packshot ove šifre ne postoji na baslac portalu.",
    ("norbin", "OFFICIAL_IMAGE_NOT_PUBLISHED"): "Proizvođač ne objavljuje sliku; kod distributera nema slike ove šifre, a u zvaničnoj brošuri je limenka samo delimično vidljiva (premalo / zaklonjeno).",
}
ITEM_NOTES = {
    "rm-agilis-x-treme": "Sistem bez šifre. Portal ima AGILIS limenke konkretnih šifri (npr. HB 040, A 2540), ali ne i generičku limenku sistema AGILIS X-TREME.",
    "rm-c-2rm2-wheel-clear-coat": "Pretraga „2RM2” i „WHEEL” na portalu: 0 asseta.",
    "rm-h-2rm2-wheel-clear-coat-hardener": "Pretraga „2RM2” i „WHEEL” na portalu: 0 asseta.",
    "rm-h-2a80-fillcure-plus": "Portal ima samo FillCURE H 2A30 i FillCURE Slow H 2A31 (druge šifre).",
    "rm-h-2a81-fillcure-plus-slow": "Portal ima samo FillCURE H 2A30 i FillCURE Slow H 2A31 (druge šifre).",
    "rm-h-2p80-filler-harden-r-plus": "Portal ima FILLER HARDEN-R H 2P84 (druga šifra) — ne koristi se kao zamena.",
    "rm-h-2p81-filler-harden-r-plus-slow": "Portal ima FILLER HARDEN-R H 2P84 (druga šifra) — ne koristi se kao zamena.",
    "rm-hb-10s-gleam-silver-onyx-hd": "Kandidat: portal asset 33657 (ONYX HD HB 10S) — ali isključivo etiketa za kinesko tržište (kineski tekst). Evropska etiketa nije pronađena.",
    "rm-onyx-blender-plus": "Portal ima ONYX EASY BLENDER A 2520 (drugi proizvod) — ne koristi se kao zamena.",
    "rm-onyx-hd-tropical": "Sistem. Portal ima samo komponentu ONYX-HYDROBASE HB 006 TROPIC (asset 36415, 33568), ne generičku limenku sistema; komponenta ne predstavlja ceo sistem.",
    "rm-diamont-bezbojni-lak": "Kandidati na portalu (ne mogu se upariti bez šifre): DIAMONTOP CP C 2410 1 L (10505), DIAMONTCLEAR CP C 2450 5 L (10508), DIAMONTOP MS C 1410 5 L (15740).",
    "baslac-30-s510-s-serija": "Portal ima Line 30 limenke 30-S00, 30-S01, 30-S010, 30-S920 (3,5 L) i 30-S110 (1 L), ne 30-S510.",
    "baslac-50-05-2k-hardener-ambient-uc": "Na portalu postoje samo video zapisi 50-05 (assets 41742, 41741, mp4), ne packshot.",
    "norbin-n15-v25-fast-clear-voc": "Kandidat (nedovoljan): isečak iz brošure 2024, 377×735 px, dno limenke zaklonjeno.",
    "norbin-n60-v20-multifunctional-body-filler-hardener": "Kandidat (nedovoljan): isečak iz brošure 2024, 352×210 px, bez učvršćivača.",
    "norbin-n75-022-hardener-slow": "Kandidat (nedovoljan): isečak iz brošure 2024, 376×395 px, donji desni deo zaklonjen.",
    "norbin-n95-060-silicone-cleaner": "Kandidat (nedovoljan): isečak iz brošure 2024, vidi se samo gornja polovina. Stranica varitikka.fi prikazuje samo Norbin logo.",
    "cosmos-lac-acrylic-varnish-376-gloss": "Zvanična slika je ISTI fajl za 376/377/378 i etiketa nema šifru ni završnicu — ni uz dozvolu ne razlikuje varijante.",
    "cosmos-lac-acrylic-varnish-377-matt": "Zvanična slika je ISTI fajl za 376/377/378 i etiketa nema šifru ni završnicu.",
    "cosmos-lac-acrylic-varnish-378-satin": "Zvanična slika je ISTI fajl za 376/377/378 i etiketa nema šifru ni završnicu.",
    "cosmos-lac-chrome-effect-450-container": "Zvanična slika je generička limenka „185 ML” (grčka etiketa), ista za Chrome 450 i Gold 451; zapis navodi 175 ml.",
    "cosmos-lac-gold-effect-451-container": "Zvanična slika je ista kao za Chrome 450 (generička limenka).",
    "cosmos-lac-high-heat-350-silver-container": "Zvanična slika je ISTI generički fajl za 350/351/353 (bez boje i šifre na etiketi).",
    "cosmos-lac-high-heat-351-black-container": "Zvanična slika je ISTI generički fajl za 350/351/353.",
    "cosmos-lac-high-heat-353-maroon-container": "Zvanična slika je ISTI generički fajl za 350/351/353.",
    "cosmos-lac-flame-orange-fo-314-piglet-pink-dark": "Zvanična slika nosi US etiketu (NET WT 11 OZ / 312 g) bez šifre; zapis je 400 ml.",
    "cosmos-lac-easy-max-glitter-912-multi": "Etiketa „EASY MAX GLITTER MULTI” odgovara; slika nema stranicu proizvoda na sajtu (nepovezan upload).",
    "cosmos-lac-ral-9003-matt-signal-white": "Etiketa „MATT RAL 9003 SIGNAL WHITE 400 ML” odgovara — prepreka je samo dozvola.",
}
SEARCH = {
    "sata": lambda r: f"SATA {r['article_number'].split()[0] if r['article_number'] else r['product_name']} site:sata.com",
    "cosmos-lac": lambda r: f"Cosmos Lac {r['product_name'].replace('Cosmos Lac ', '')} packshot (zatražiti dopunu Brand Kit-a)",
    "rm": lambda r: f"R-M {r['manufacturer_code'] or r['product_name'].replace('R-M ', '')} packshot (Surventis portal, hub 51)",
    "baslac": lambda r: f"baslac {r['manufacturer_code'] or r['product_name']} packshot (Surventis portal, hub 54)",
    "norbin": lambda r: f"Norbin {r['manufacturer_code']} {r['package']} packshot / render (zatražiti od Surventis-a)",
}
CHECKED = {"sata": SATA_CHECK, "cosmos-lac": COSMOS_CHECK, "rm": R_M_PORTAL_CHECK, "baslac": BASLAC_PORTAL_CHECK, "norbin": NORBIN_CHECK}

# Ne-proizvodni slotovi i generičke slike koje prikrivaju nedostatak (utvrđeno pregledom koda i browserom).
NON_PRODUCT = [
    {
        "group": "BRAND_PAGE_PHOTO", "brand": "Carsystem", "subject": "Brend stranica — hero fotografije (priprema / lakiranje / završna obrada), desktop + mobilna verzija",
        "code": "", "pages": ["/brendovi/carsystem"],
        "missing": "6 fajlova: carsystem-hero-{preparation,painting,finishing}.webp i …-mobile.webp (public/images/brands/carsystem/hero/); stranica prikazuje generičku SVG šemu radionice umesto fotografije",
        "reason": "Kandidati postoje na carsystem.org (npr. Flow_Banner.jpg 4961×3721, Explorer-Ltd-Coverall-Banner.jpg 5184×3888, Polieren-min.jpg 6016×4000), ali impressum carsystem.org (VOSSCHEMIE) zabranjuje komercijalnu upotrebu bez saglasnosti nosioca prava. Lackieren-min.jpg odbačen (SATA logo na čaši).",
        "checked": "carsystem.org (sitemap 13 strana, 6 jezičkih početnih, vesti, 10 kategorija, katalog 2026/27 PDF, flajeri); carsystem.org/impressum",
        "search": "Zatražiti od VOSSCHEMIE (info@vosschemie.de) dozvolu za carsystem.org kategorijske fotografije: Schleifen-min, Abdecken-min, Polieren-min, Flow_Banner",
    },
    {
        "group": "BRAND_PAGE_PHOTO", "brand": "Carsystem", "subject": "Brend stranica — fotografije procesa (priprema / nanošenje / završna obrada)",
        "code": "", "pages": ["/brendovi/carsystem"],
        "missing": "3 fajla: carsystem-process-{preparation,application,finish}.webp (public/images/brands/carsystem/process/); prikazuje se SVG šema",
        "reason": "Isto kao hero: kandidati na carsystem.org (Spachteln-min, Kleben_Beschichten-min, Polieren-min), dozvola nosioca prava nije data.",
        "checked": "carsystem.org (kao iznad)",
        "search": "carsystem.org Kategoriebild Schleifen / Spachteln / Kleben Beschichten / Polieren — zatražiti originale i dozvolu",
    },
    {
        "group": "BRAND_PAGE_PHOTO", "brand": "Carsystem", "subject": "Brend stranica — niz od 4 faze istog panela (oštećenje → pripremljeno → lakirano → završeno)",
        "code": "", "pages": ["/brendovi/carsystem"],
        "missing": "4 fajla: carsystem-workflow-{damage,prepared,painted,finished}.webp (public/images/brands/carsystem/workflow/)",
        "reason": "Mora biti stvarni niz istog panela, istog ugla i svetla. Takav niz ne postoji ni na carsystem.org, ni u katalogu 2026/27, ni na baslac/R-M portalu. Ne pravi se montažom ni AI-jem.",
        "checked": "carsystem.org, katalog 2026/27 (110 strana), baslac Technical Support Tool (video kadrovi menjaju ugao)",
        "search": "Snimiti u radionici: isti panel, isti ugao, 4 faze (vlasnik/partnerska radionica)",
    },
    {
        "group": "BRAND_PAGE_PHOTO", "brand": "Norbin", "subject": "Brend stranica — hero fotografija radionice",
        "code": "", "pages": ["/brendovi/norbin"],
        "missing": "fotografija radionice u hero bloku (komponenta prikazuje „Fotografija u pripremi”; slot nema putanju u kodu)",
        "reason": "Norbin ne objavljuje fotografije radionice; Surventis portal nema Norbin biblioteku.",
        "checked": "norbin-paint.com; brošure 2021/2024; Surventis portal (dostupni samo hub 51 R-M i hub 54 baslac)",
        "search": "Norbin bodyshop application photo — zatražiti od Surventis-a (Norbin brend tim)",
    },
    {
        "group": "BRAND_PAGE_PHOTO", "brand": "Norbin", "subject": "Brend stranica — sekcija „Deo Surventis refinish porodice” (poreklo)",
        "code": "", "pages": ["/brendovi/norbin"],
        "missing": "fotografija sekcije porekla (prikazuje „Fotografija u pripremi”; slot nema putanju u kodu)",
        "reason": "Jedini kandidat je zvanična grupna slika asortimana norbin-paint.com/images/gamme_NORBIN-mai-2024.jpg (1920×1080); upotreba traži odluku o sadržaju sekcije i dozvolu proizvođača.",
        "checked": "norbin-paint.com, brošura 2024",
        "search": "norbin-paint.com gamme_NORBIN-mai-2024.jpg — potvrditi dozvolu i nameru sekcije",
    },
    {
        "group": "BRAND_PAGE_PHOTO", "brand": "R-M", "subject": "Brend stranica — slotovi „Efektne komponente” i „Kompatibilna završnica” (CRYSTAL BASE)",
        "code": "CRYSTAL BASE", "pages": ["/brendovi/rm"],
        "missing": "2 fotografije proizvoda u grupi „Specijalni efektni proizvodi” (aria: „Fotografija proizvoda za … još nije dostupna”)",
        "reason": "CRYSTAL BASE čeka odluku vlasnika o programu (nije u aktivnom R-M katalogu); slotovi nisu vezani za konkretnu šifru, pa nijedna bočica ne odgovara „komponenti” uopšte. Portal ima desetine CRYSTAL BASE / SPECIAL CRYSTAL BASE bočica (npr. 33700 CB 34M).",
        "checked": "Surventis portal R-M hub 51",
        "search": "R-M CRYSTAL BASE packshot — posle odluke o programu i izbora konkretne šifre",
    },
]
# baslac sistemske stranice: slika po (sistem, zapremina); prazan slot = poruka „…za ovo pakovanje je u pripremi”.
BASLAC_VOLUME_SLOTS = [
    ("line-30", "1 L", 17, "12114 (30-S110 1 L)"),
    ("line-35", "1 L", 17, "12115 (35-M1020 1 L)"),
    ("line-35", "0,5 L", 32, "12092 (35-M1120 0,5 L)"),
    ("line-45", "5 L", 2, "12081 (45-W00 5 L), 12080 (45-R45 5 L)"),
    ("line-45", "1 L", 7, "12121 (45-W1010 1 L) — već se koristi kao „primer ambalaže” na kartici Line 45"),
    ("line-45", "0,5 L", 49, "12094 (45-W1020 0,5 L), 12093 (45-W10 0,5 L)"),
    ("line-45", "0,1 L", 12, "12088 / 12068 (45-W1390 0,1 L), 12089 / 12071 (49-W463 0,1 L)"),
]
SHARED = [
    ("Befar", "Drill type wheel cleaning pad; M14 adapter", ["befar-drill-type-wheel-cleaning-pad", "befar-m14-adapter"],
     "Oba zapisa prikazuju fotografiju jastučića za farove (befar-drill-type-headlight-cleaning-pad.webp) — slika drugog proizvoda prikriva nedostatak.",
     "Befar zvanični sajt (Wix) koristi istu fotografiju za sva tri artikla; sopstvena slika nije objavljena.",
     "befar.com.tr wheel cleaning pad / M14 adapter — zatražiti od Befar-a ili fotografisati"),
    ("R-M", "ONYX HD (sistemska kartica)", ["rm-onyx-hd"],
     "Kartica sistema prikazuje kanister komponente HB 002 (isti fajl kao rm-hb-002-onyx-hd) — komponenta predstavlja ceo sistem.",
     "Slika dolazi sa info.rmpaint.com (zvanični sync). Na portalu postoji generička sistemska limenka „R-M_1L_ONYX HD” (asset 34852 / 30819), po istom principu kao odobreni UNO HD (30820). Nije zamenjeno bez odluke jer postojeća slika potiče od proizvođača.",
     "Odobriti zamenu portalom 34852 (generička ONYX HD limenka, bez šifre)"),
    ("Cosmos Lac", "Parovi varijanti sa istom fotografijom", ["cosmos-lac-master-mechanic-10-sjaj / -10-mat (Black, White)", "cosmos-lac-flame-blue-fb-900 / fb-3000", "cosmos-lac-flame-blue-fb-904 / fb-3004", "cosmos-lac-flame-orange-fo-901 / fo-904"],
     "Sjaj i mat, odnosno puna i providna varijanta dele bajt-identičnu fotografiju iz zvaničnog Brand Kit-a.",
     "Brand Kit sadrži jednu sliku po paru; zvanični sajt takođe. Uslovi cosmoslac.com zabranjuju upotrebu drugih izvora bez dozvole.",
     "Zatražiti od Cosmos Lac posebne packshotove (support@cosmoslac.com)"),
]


def read_pages() -> dict[str, list[str]]:
    path = OUT / "browser-placeholder-pages.json"
    return json.loads(path.read_text(encoding="utf8")) if path.exists() else {}


def csv_text(columns: list[str], rows: list[dict]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def md_cell(value: str) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def added() -> list[dict]:
    registry = json.loads((ROOT / "data/catalog/image-supply/supplied-images.json").read_text(encoding="utf8"))
    rows = []
    for image in registry["images"]:
        if image.get("batch") not in BATCHES:
            continue
        detail = image["sourceDetail"]
        portal = image["sourceBasis"] == "SUPPLIER_BRAND_PORTAL"
        rows.append({
            "brand": image["brand"],
            "product_slug": image["slug"],
            "site_page": f"/proizvodi/{image['slug']}",
            "local_file": f"public{image['path']}",
            "size_px": f"{image['width']}x{image['height']}",
            "source_url": f"{detail['portalUrl']} (asset {detail['assetId']}: {detail['assetTitle']})" if portal else detail["originalUrl"],
            "source_page": detail["portalUrl"] if portal else detail["productPage"],
            "source_basis": image["sourceBasis"],
            "rights_basis": image["rightsBasis"],
            "identity_evidence": detail["identityEvidence"],
            "processing": detail["processingMethod"],
            "original_sha256": image["sourceSha256"],
        })
    return rows


def unresolved() -> list[dict]:
    pages = read_pages()
    rows = []
    for item in csv.DictReader((ROOT / "data/catalog/image-supply/MISSING_PRODUCT_IMAGES.csv").open(encoding="utf8")):
        brand, slug = item["brand"], item["slug"]
        seen = list(pages.get(slug, []))
        # Varijanta u porodičnoj kartici: lice kartice (katalog, pretraga) se vidi pod ključem porodice.
        for family in {p.split("/")[3].split("?")[0] for p in seen if p.startswith("/proizvodi/grupa/")}:
            seen += [p for p in pages.get(family, []) if not p.startswith("/proizvodi/grupa/")] + [f"/proizvodi/grupa/{family}"]
        in_family = any(p.startswith("/proizvodi/grupa/") for p in seen)
        page_list = sorted(set(seen if in_family else [f"/proizvodi/{slug}"] + seen))
        note = ITEM_NOTES.get(slug, "")
        rows.append({
            "group": "PRODUCT_IMAGE",
            "brand": {"rm": "R-M", "sata": "SATA", "baslac": "baslac", "norbin": "Norbin", "cosmos-lac": "Cosmos Lac"}[brand],
            "subject": item["product_name"],
            "code_variant": " / ".join(x for x in [item["manufacturer_code"] or item["public_code"], item["article_number"] if brand == "sata" else "", item["package"] if item["package"] not in ("", "Na upit") else ""] if x),
            "pages": " ; ".join(page_list) + " ; pretraga sajta (isti prikaz kartice)",
            "missing": "packshot proizvoda (kartica u katalogu, PDP, srodni proizvodi, pretraga)",
            "reason": " ".join(x for x in [REASONS.get((brand, item["missing_reason"]), item["missing_reason"]), note] if x),
            "checked_sources": CHECKED[brand] + (f" ; zvanični URL iz manifesta: {item['official_image_url']}" if item["official_image_url"] else ""),
            "search_term": SEARCH[brand](item),
            "image_id": item["image_id"],
        })
    for system, volume, count, candidates in BASLAC_VOLUME_SLOTS:
        key = f"baslac-volume:{system}:{volume}"
        rows.append({
            "group": "PACKAGE_SLOT", "brand": "baslac", "subject": f"Sistemska stranica {system} — packshot ambalaže {volume}",
            "code_variant": f"{count} baza u pakovanju {volume}",
            "pages": " ; ".join(pages.get(key, [f"/proizvodi/grupa/baslac-{system}?varijanta=…"])),
            "missing": f"generička slika ambalaže {volume} za sistem {system} (prikazuje se „Zvanična fotografija ambalaže za ovo pakovanje je u pripremi.”)",
            "reason": "Stranica namerno ne prikazuje limenku druge zapremine. Portal nema generičku limenku sistema za ovu zapreminu — samo limenke konkretnih šifri, koje bi uz drugu izabranu bazu prikazale pogrešnu šifru. Potrebna odluka: generički packshot ili „primer ambalaže” (kao na kartici Line 45).",
            "checked_sources": f"{BASLAC_PORTAL_CHECK} ; kandidati (primer ambalaže, NE generička): {candidates}",
            "search_term": f"baslac {system.replace('line-', 'Line ')} {volume} family packshot (generička limenka bez šifre nijanse)",
            "image_id": key,
        })
    for item in NON_PRODUCT:
        rows.append({
            "group": item["group"], "brand": item["brand"], "subject": item["subject"], "code_variant": item["code"],
            "pages": " ; ".join(item["pages"]), "missing": item["missing"], "reason": item["reason"],
            "checked_sources": item["checked"], "search_term": item["search"], "image_id": "",
        })
    for brand, subject, slugs, missing, reason, search in SHARED:
        rows.append({
            "group": "GENERIC_IMAGE_MASKS_GAP", "brand": brand, "subject": subject, "code_variant": "",
            "pages": " ; ".join(f"/proizvodi/{s}" if " " not in s else s for s in slugs),
            "missing": missing, "reason": reason, "checked_sources": "runtime katalog + SHA-256 poređenje svih slika", "search_term": search, "image_id": "",
        })
    rows.append({
        "group": "PLANNED_SLOT", "brand": "Cosmos Lac", "subject": "Početna — kampanjski slajd „Cosmos Spray” (planiran, nije implementiran)",
        "code_variant": "", "pages": "/", "missing": "banner 2400×1350 desktop + 1448×1086 mobilni (content-asset slot home.campaign.cosmos-spray)",
        "reason": "Nijedan zvanični banner ne ispunjava zahtev (3–5 limenki, fokus desno, mirna leva polovina); hero-placeholder.jpg 1920×1080 ima jednu limenku. Brand Kit je zaštićen lozinkom. Slajd se ne prikazuje, pa posetilac ne vidi prazno mesto.",
        "checked_sources": "cosmoslac.com (848 od 1878 media stavki, ostalo nedostupno), Brand Kit (lozinka)", "search_term": "Cosmos Lac Spray campaign key visual — zatražiti iz Brand Kit-a", "image_id": "home.campaign.cosmos-spray",
    })
    return rows


ADDED_COLUMNS = ["brand", "product_slug", "site_page", "local_file", "size_px", "source_url", "source_page", "source_basis", "rights_basis", "identity_evidence", "processing", "original_sha256"]
UNRESOLVED_COLUMNS = ["group", "brand", "subject", "code_variant", "pages", "missing", "reason", "checked_sources", "search_term", "image_id"]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    add, unr = added(), unresolved()
    (OUT / "ADDED_IMAGES.csv").write_text(csv_text(ADDED_COLUMNS, add), encoding="utf8")
    (OUT / "UNRESOLVED_IMAGES.csv").write_text(csv_text(UNRESOLVED_COLUMNS, unr), encoding="utf8")

    lines = ["# Dodate slike — krug 2026-10", "", f"Ukupno: **{len(add)}** slika. Originali su van Gita (`assets/manufacturer/…`); izvedeni WebP fajlovi su u `public/products/<brend>/supplied/`, a evidencija po slici u `data/catalog/image-supply/supplied-images.json`. Pravilo: slika je dodata samo kada je etiketa na originalu ručno pročitana i odgovara brendu, nazivu, šifri i (gde je zadato) pakovanju zapisa.", ""]
    by_brand = defaultdict(list)
    for row in add:
        by_brand[row["brand"]].append(row)
    for brand in ["rm", "baslac", "norbin"]:
        lines += [f"## {dict(rm='R-M', baslac='baslac', norbin='Norbin')[brand]} ({len(by_brand[brand])})", "", "| Proizvod (stranica) | Lokalni fajl | Izvor | Potvrda identiteta | Pravo |", "|---|---|---|---|---|"]
        for row in by_brand[brand]:
            lines.append(f"| [{row['product_slug']}]({SITE}{row['site_page']}) | `{row['local_file']}` ({row['size_px']}) | {md_cell(row['source_url'])} | {md_cell(row['identity_evidence'])} | {row['rights_basis']} |")
        lines.append("")
    (OUT / "ADDED_IMAGES.md").write_text("\n".join(lines) + "\n", encoding="utf8")

    groups = [
        ("PRODUCT_IMAGE", "Slike proizvoda (placeholder na sajtu)"),
        ("PACKAGE_SLOT", "baslac sistemske stranice — slika po zapremini"),
        ("BRAND_PAGE_PHOTO", "Fotografije na brend stranicama"),
        ("GENERIC_IMAGE_MASKS_GAP", "Generička / tuđa slika prikriva nedostatak"),
        ("PLANNED_SLOT", "Planirani slot koji se još ne prikazuje"),
    ]
    lines = ["# Nerešene slike — spisak za traženje jedne po jedne", "", "Svaki red je JEDAN resurs koji treba nabaviti; sva mesta gde se koristi navedena su u koloni „Stranice”. Mašinski čitljiva verzija: `UNRESOLVED_IMAGES.csv`.", ""]
    for key, title in groups:
        subset = [r for r in unr if r["group"] == key]
        if not subset:
            continue
        lines += [f"## {title} ({len(subset)})", ""]
        brands = sorted({r["brand"] for r in subset}, key=lambda b: ["R-M", "baslac", "Norbin", "Cosmos Lac", "SATA", "Carsystem", "Befar"].index(b) if b in ["R-M", "baslac", "Norbin", "Cosmos Lac", "SATA", "Carsystem", "Befar"] else 99)
        for brand in brands:
            part = [r for r in subset if r["brand"] == brand]
            if key == "PRODUCT_IMAGE":
                lines += [f"### {brand} ({len(part)})", ""]
            lines += ["| Brend | Proizvod / lokacija | Šifra / varijanta | Stranice | Šta nedostaje | Zašto nije popunjeno | Provereni izvori | Predlog pretrage |", "|---|---|---|---|---|---|---|---|"]
            for r in part:
                lines.append("| " + " | ".join(md_cell(r[c]) for c in ["brand", "subject", "code_variant", "pages", "missing", "reason", "checked_sources", "search_term"]) + " |")
            lines.append("")
    (OUT / "UNRESOLVED_IMAGES.md").write_text("\n".join(lines) + "\n", encoding="utf8")
    print(f"added {len(add)}, unresolved {len(unr)}")


if __name__ == "__main__":
    main()
