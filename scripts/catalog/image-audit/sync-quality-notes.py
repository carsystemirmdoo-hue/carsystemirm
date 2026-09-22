#!/usr/bin/env python3
"""
QUALITY NOTE HYGIENE — menja ISKLJUČIVO segment `quality: …` u koloni `notes` (inventar + rights review),
tako da nosi nalaze iz usklađenog IMAGE_QUALITY_QUEUE.csv. Sve ostale kolone i svi ostali segmenti beleške
ostaju bajt-identični; skripta to sama proverava i pada ako bi se promenilo bilo šta drugo.
"""
import csv, io, os, sys
HERE = os.environ.get("IMAGE_AUDIT_WORK") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".cache", "image-audit")
HERE = os.path.abspath(HERE)
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
ORDER = ["MEASURED_TONE_DEFECT", "TONE_NOT_DETECTED", "SOURCE_PIPELINE_REEXPORT_CANDIDATE_UNMEASURED", "BORDER_FRAME", "EDGE_ALPHA_SIGNAL_NOT_IN_HANDOFF", "FIT_MEASURES_BAKED_SHADOW",
         "CLASS_B_DETERMINISTIC_FIX", "CLASS_E_SOURCE_REPLACEMENT_PREFERRED", "CLASS_D_AI_HIGH_RISK", "CLASS_F_SPECIAL_MARKETING_IMAGE", "V6_EXCLUDED_SLUG", "V6B_OFFICIAL_SHADOW_UNKNOWN", "PILOT_CASE_LHR75", "OFFICIAL_SHADOW_PLATE_VISIBLE_IN_DARK"]
findings = {}
for row in csv.DictReader(open(os.path.join(HERE, "IMAGE_QUALITY_QUEUE.csv"), newline="", encoding="utf-8")):
    findings.setdefault(row["image_id"], []).append(row["finding"])

def note_for(image_id):
    found = sorted(findings[image_id], key=ORDER.index)
    # Bez "; " u tekstu: to je separator segmenata beleške.
    return "quality: " + "+".join(found) + " (usklađeno sa handoffom — vidi IMAGE_QUALITY_QUEUE)"

changed = {}
for name in ["IMAGE_IDENTITY_INVENTORY.csv", "IMAGE_RIGHTS_REVIEW.csv"]:
    path = os.path.join(HERE, name)
    rows = list(csv.DictReader(open(path, newline="", encoding="utf-8")))
    fields = list(rows[0].keys())
    count = 0
    for row in rows:
        parts = row["notes"].split("; ") if row["notes"] else []
        for index, part in enumerate(parts):
            if part.startswith("quality: "):
                if row["image_id"] not in findings:
                    sys.exit(f"{name}: {row['image_id']} ima quality belešku, a nema red u usklađenom queue-u")
                fresh = note_for(row["image_id"])
                if part != fresh:
                    parts[index] = fresh; count += 1
        before = dict(row); row["notes"] = "; ".join(parts)
        assert all(before[key] == row[key] for key in fields if key != "notes")
    buffer = io.StringIO(); writer = csv.DictWriter(buffer, fieldnames=fields, lineterminator="\n"); writer.writeheader(); writer.writerows(rows)
    original = open(path, newline="", encoding="utf-8").read()
    if count == 0:
        assert buffer.getvalue() == original, f"{name}: CSV pisac ne reprodukuje fajl bajt-identično"
    open(path, "w", newline="", encoding="utf-8").write(buffer.getvalue())
    changed[name] = count
print(changed)
