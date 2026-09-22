#!/usr/bin/env python3
"""OWNER BATCH 01 — kandidati za prvi end-to-end test dostave slika. NIJE import; ništa se ne pretpostavlja o lageru."""
import csv, os, sys
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
PICKS += [(row["image_id"], f"BEFAR: slika REDA (scope ARTICLE) — {row['variant']}, šifra {row['article_number']}; ostali redovi iste kartice imaju svoju sliku, pa je potrebna fotografija TAČNO te boje/dimenzije." + (" Fotografija već pripremljena." if row["article_number"] != "05801" else " Jedina iz BEFAR grupe koja još nije pripremljena.")) for row in master if row["brand"] == "befar"]
errors = []
ids = [image_id for image_id, _ in PICKS]
if len(ids) != len(set(ids)): errors.append("dupli kandidat")
for image_id in ids:
    if image_id not in by_id: errors.append(f"nije u master USER_SUPPLY: {image_id}")
    if image_id in rights: errors.append(f"rights review: {image_id}")
if not 15 <= len(PICKS) <= 20: errors.append(f"veličina batch-a: {len(PICKS)}")
if errors: sys.exit("\n".join(errors))

columns = ["batch", "pilot_order"] + list(master[0].keys()) + ["pilot_reason", "owner_has_product"]
with open(os.path.join(HERE, "OWNER_SUPPLY_BATCH_01_CANDIDATES.csv"), "w", newline="", encoding="utf-8") as fh:
    writer = csv.DictWriter(fh, fieldnames=columns, lineterminator="\n"); writer.writeheader()
    for order, (image_id, reason) in enumerate(PICKS, 1):
        writer.writerow({"batch": "OWNER_BATCH_01", "pilot_order": order, **by_id[image_id], "pilot_reason": reason, "owner_has_product": ""})
print(len(PICKS), sorted({by_id[i]["brand"] for i in ids}), sorted({by_id[i]["image_scope"] for i in ids}))
