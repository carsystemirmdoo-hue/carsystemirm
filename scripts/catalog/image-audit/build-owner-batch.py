#!/usr/bin/env python3
"""OWNER BATCH 01 — kandidati za prvi end-to-end test dostave slika. NIJE import; ništa se ne pretpostavlja o lageru."""
import csv, json, os, sys
HERE = os.environ.get("IMAGE_AUDIT_WORK") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".cache", "image-audit")
HERE = os.path.abspath(HERE)
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
read = lambda name: list(csv.DictReader(open(os.path.join(HERE, name), newline="", encoding="utf-8")))
master = read("USER_IMAGE_SUPPLY_QUEUE_FINAL.csv")
by_id = {row["image_id"]: row for row in master}
rights = {row["image_id"] for row in read("IMAGE_RIGHTS_REVIEW.csv")}

PICKS = [
    ("baslac__baslac-basecoat-45", "baslac: SLIKA SERIJE (scope FAMILY) — jedna fotografija pokriva 69 zapisa linije Basecoat 45 (sve oznake tonera i sve zapremine). Najvažniji test konsolidacije serije."),
    ("rm__group-rm-ghd-thinner", "R-M: REPREZENTATIVNA SLIKA GRUPE (scope SHARED_IMAGE_GROUP) — jedna fotografija za GV 100/200/300/400, koji se razlikuju samo oznakom brzine. Test novog mehanizma deljenja slike bez spajanja identiteta."),
    ("rm__group-rm-ghd-hardener", "R-M: REPREZENTATIVNA SLIKA GRUPE — jedna fotografija za H 700/750/770. Drugi test istog mehanizma."),
    ("baslac__baslac-20-34-2k-primerfiller-white-1l", "baslac: variant-specific (scope VARIANT) — druga varijanta iste kartice ima sliku; jasna šifra 20-34 i pakovanje 1 L. Fotografija već pripremljena."),
    ("baslac__baslac-45-r45", "baslac: zaseban proizvod sa jasnom šifrom (45-R45) i pakovanjem (5 L); nije toner serije Basecoat 45."),
    ("norbin__norbin-n15-020-5l", "Norbin: package-specific (scope VARIANT) — 1 L iste kartice već ima sliku, 5 L je druga ambalaža. Fotografija već pripremljena."),
    ("norbin__norbin-n55-015-1k-plastic-primer", "Norbin: jednostavna kartica sa jasnom šifrom (N55-015) i pakovanjem (1 L). Fotografija već pripremljena."),
    ("norbin__norbin-n85-021-thinner", "Norbin: jednostavna kartica sa jasnom šifrom (N85-021) i pakovanjem (1 L). Fotografija već pripremljena."),
    ("sata__satajet-1500-b", "SATA: packshot KARTICE koji dele 4 broja artikla; SATA za ovu porodicu ne objavljuje sliku, pa identitet NIJE pod rights review."),
    ("sata__satajet-3000-b", "SATA: porodica sa jednim brojem artikla (190538) bez zvanične slike — NIJE pod rights review."),
]
# BEFAR redovi su deo batch-a od početka; spisak je fiksan da bi zapis ostao potpun i kada
# identitet napusti aktivni queue (uvezen ili odložen).
PICKS += [
    ("befar__befar-carved-velcro-polishing-pad__05801", "BEFAR: slika REDA (scope ARTICLE) — Bela, šifra 05801; ostali redovi iste kartice imaju svoju sliku."),
    ("befar__befar-velcro-polishing-pad__44805", "BEFAR: slika REDA — Plava · 80 × 25 mm, šifra 44805."),
    ("befar__befar-velcro-polishing-pad__44806", "BEFAR: slika REDA — Krem · 80 × 25 mm, šifra 44806."),
    ("befar__befar-velcro-polishing-pad__44807", "BEFAR: slika REDA — Bordo · 80 × 25 mm, šifra 44807."),
    ("befar__befar-waffle-velcro-polishing-pad__04503", "BEFAR: slika REDA — Crna · 150 × 25 mm, šifra 04503."),
    ("befar__befar-waffle-velcro-polishing-pad__448031", "BEFAR: slika REDA — Crna · 80 × 25 mm, šifra 448031."),
    ("befar__befar-waffle-velcro-polishing-pad__448061", "BEFAR: slika REDA — Bordo · 80 × 25 mm, šifra 448061."),
]
"""
Ishod batch-a, ne samo otvoren spisak.

Svaki kandidat zadržava red i dobija `status`: SUPPLIED (slika je uvezena), DEFERRED (vlasnik je
odlučio da se slika ne radi u ovom periodu) ili OPEN (i dalje se čeka fotografija). Tako fajl ostaje
zapis šta je od batch-a postalo, umesto da red nestane bez traga kad se zahtev zatvori.
"""
supplied = {entry["imageId"] for entry in json.load(open(os.path.join(REPO, "data/catalog/image-supply/supplied-images.json"), encoding="utf-8"))["images"]}
groups = json.load(open(os.path.join(REPO, "data/catalog/image-supply/shared-image-groups.json"), encoding="utf-8"))["groups"]
deferred = {f'{g["brand"]}__group-{g["id"]}' for g in groups if g.get("imageSupply", {}).get("status") == "DEFERRED_OWNER_IMAGE_SUPPLY"}
status_of = lambda image_id: "SUPPLIED" if image_id in supplied else "DEFERRED" if image_id in deferred else "OPEN"

errors = []
ids = [image_id for image_id, _ in PICKS]
if len(ids) != len(set(ids)): errors.append("dupli kandidat")
for image_id in ids:
    if status_of(image_id) == "OPEN" and image_id not in by_id: errors.append(f"otvoren kandidat nije u master USER_SUPPLY: {image_id}")
    if image_id in rights: errors.append(f"rights review: {image_id}")
if not PICKS: errors.append("batch je prazan")
if errors: sys.exit("\n".join(errors))

columns = ["batch", "pilot_order", "status"] + list(master[0].keys()) + ["pilot_reason", "owner_has_product"]
blank = {key: "" for key in master[0]}
with open(os.path.join(HERE, "OWNER_SUPPLY_BATCH_01_CANDIDATES.csv"), "w", newline="", encoding="utf-8") as fh:
    writer = csv.DictWriter(fh, fieldnames=columns, lineterminator="\n"); writer.writeheader()
    for order, (image_id, reason) in enumerate(PICKS, 1):
        row = by_id.get(image_id) or {**blank, "image_id": image_id, "brand": image_id.split("__")[0]}
        writer.writerow({"batch": "OWNER_BATCH_01", "pilot_order": order, "status": status_of(image_id), **row, "pilot_reason": reason, "owner_has_product": ""})
counts = {s: sum(1 for i in ids if status_of(i) == s) for s in ("SUPPLIED", "DEFERRED", "OPEN")}
print(json.dumps({"kandidata": len(PICKS), **counts}, ensure_ascii=False))
