#!/usr/bin/env python3
"""
FINAL RECONCILIATION — quality handoff ↔ današnji katalog.  READ ONLY prema repou.

Piše ISKLJUČIVO:
  - IMAGE_QUALITY_QUEUE.csv
  - quality dio FINAL_IMAGE_AUDIT.md (bullet „Samo kvalitet” u §3 + ceo §6)
  - quality-reconciliation.generated.json
NE dira: IMAGE_IDENTITY_INVENTORY / MISSING_PRODUCT_IMAGES / USER_IMAGE_SUPPLY_QUEUE / IMAGE_RIGHTS_REVIEW
(opisni segment `quality:` u beleškama posle ovoga usklađuje sync_quality_notes.py).

Izvor istine za odluke o kvalitetu: historical-evidence/ (handoff + njegovi stvarni fajlovi merenja).
Ništa se ne meri ponovo, nijedan prag se ne menja, nijedan neizmeren par ne dobija rezultat.
"""
import csv, hashlib, json, os, re, sys

HERE = os.environ.get("IMAGE_AUDIT_WORK") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".cache", "image-audit")
HERE = os.path.abspath(HERE)
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
EV = os.path.join(REPO, "data", "catalog", "image-quality", "evidence")

def read_csv(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))

def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()

hist = read_csv(os.path.join(EV, "CARSYSTEM_IMAGE_AUDIT.csv"))
tone = {row["slug"]: row for row in json.load(open(os.path.join(EV, "pipeline-tone-measurements.json"), encoding="utf-8"))}
css = {row["slug"]: row for row in read_csv(os.path.join(EV, "css-rendering-candidates.csv"))}
frame_sim = {row["slug"]: row for row in json.load(open(os.path.join(EV, "alpha-frame-simulation.json"), encoding="utf-8"))}
inventory = [row for row in read_csv(os.path.join(HERE, "IMAGE_IDENTITY_INVENTORY.csv")) if row["brand"] in ("carsystem", "rupes")]
# Zapisi uklonjeni iz kataloga (2026-09-22) više nisu predmet kvaliteta — nalaz odlazi sa karticom.
removed = {record["slug"]: record for record in json.load(open(os.path.join(REPO, "data/catalog/removed-from-customer-catalog.json"), encoding="utf-8"))["records"]}
published = json.load(open(os.path.join(REPO, "data/carsystem-sync/published-images.generated.json"), encoding="utf-8"))["images"]
edge_today = json.load(open(os.path.join(EV, "edge-frame.generated.json"), encoding="utf-8"))
# Koliko je redova queue iz `inventory.mjs` označio grubim tonskim pravilom, PRE nego što ga ovaj
# korak prepiše. Služi samo rečenici u izveštaju koja objašnjava ispravku — čita se dok fajl još stoji.
previous_tone = sum(1 for row in read_csv(os.path.join(HERE, "IMAGE_QUALITY_QUEUE.csv")) if "TONE_SOURCE_REEXPORT_CANDIDATE" in row["evidence_flags"])

# ── Finalne odluke handoffa (prepisane, ne donose se ponovo) ──────────────────────────────
V6_EXCLUDED = {"carsystem-multi-flow", "carsystem-paint-system-cps-3-0", "carsystem-h2o-cleaner"}
SHADOW_UNKNOWN = {"carsystem-glass-fibre-reinforced-putty"}
FRAME_REJECT_REASON = {
    "carsystem-rupes-orbital-sander-slp41a": "R4 — proizvod 6 px od ivice",
    "carsystem-rupes-skorpio-e-rx": "R1/R2 — okvir nepotpun",
}
PILOT = {
    "carsystem-anti-rust-putty": "PILOT 149.612 — pending_manual_review",
    "carsystem-glass-fibre-fleece": "PILOT 125.421 — pending_manual_review",
    "carsystem-rupes-polishing-machine-lhr75": "PILOT 157.332 LANCZOS_660 (automatika PASS; izbor korisnika) — pending_manual_review; NATIVE_560 samo dokaz",
    "carsystem-can-scraper": "PILOT 159.672 — pending_manual_review",
    "carsystem-sanding-block-disc-kit-150": "PILOT 151.904 — pending_manual_review",
    "carsystem-socks-carsystem-black-white": "KONTROLA — nikad se ne integriše",
}
SPECIAL_NOTES = {
    "carsystem-proflex-mercury": "handoff: ceo kadar je alfa 229 i u originalu; da li se ispravlja na 255 je zasebna, NEDONESENA odluka; ispao iz pilota",
    "carsystem-polyester-repair-set": "handoff: ispao iz pilota (original 20,8 MB nije meren)",
    "carsystem-af-21-1k-filler": "handoff: nije ni kontrola ni tretirani pilot (nema izmeren original)",
}
NO_APPROVAL = "NONE — 0 odobreno / 0 integrisano; bez mass apply; runtime productImage nepromenjen"

COLUMNS = ["finding_id", "image_id", "todays_brand", "historical_brand", "product_name", "slug", "current_image_path", "current_image_width", "current_image_height",
           "finding", "quality_need", "evidence_level", "treatment_status", "pipeline_tone_status", "tone_fitted_gamma", "tone_median_lum_change_pct",
           "historical_class", "historical_problem_type", "handoff_decision", "approved_action", "pilot_status", "asset_unchanged_since_audit",
           "processed_source_url", "original_source_url", "inventory_classification", "evidence_source", "notes"]

inv_by_slug = {row["slug"]: row for row in inventory}
errors, rows, dropped_by_removal = [], [], []
continuity = {"identical": 0, "legacy_no_manifest": 0, "changed": 0}

def unchanged(h):
    meta = published.get(h["runtimePath"])
    file_path = os.path.join(REPO, "public", h["runtimePath"].lstrip("/"))
    if not os.path.exists(file_path):
        return "NO — fajl ne postoji"
    same_bytes = str(os.path.getsize(file_path)) == h["bytes"]
    if not meta:
        return "YES (legacy asset bez sync manifesta; veličina fajla ista)" if same_bytes else "NO — veličina fajla promenjena"
    return "YES (sourceSha256 + veličina fajla isti)" if meta["sourceSha256"] == h["sourceSha256"] and same_bytes else "NO — izvor ili fajl promenjen"

for h in sorted(hist, key=lambda row: row["slug"]):
    slug = h["slug"]
    inv = inv_by_slug.get(slug)
    if not inv:
        if slug in removed:
            dropped_by_removal.append({"slug": slug, "status": removed[slug]["status"], "historicalClass": h["class"], "historicalProblemType": h["problemType"]})
            continue
        errors.append(f"istorijski slug nema današnji identitet: {slug}")
        continue
    if inv["current_image_path"] != h["runtimePath"]:
        errors.append(f"putanja slike promenjena: {slug}")
    same = unchanged(h)
    continuity["identical" if same.startswith("YES (source") else "legacy_no_manifest" if same.startswith("YES (legacy") else "changed"] += 1
    meta = published.get(h["runtimePath"]) or {}
    source_url = meta.get("sourceUrl", "")
    if source_url and h["sourceProcessedUrl"] and source_url != h["sourceProcessedUrl"]:
        errors.append(f"sourceUrl se razlikuje od istorijskog: {slug}")

    def emit(finding, need, evidence, treatment, decision, source, notes="", **extra):
        if not same.startswith("YES"):
            # Asset promenjen posle audita → istorijski nalaz se NE prenosi kao potvrđen.
            evidence, treatment = "MANUAL_REVIEW_REQUIRED", "NO_ACTION_APPROVED"
            notes = f"ASSET PROMENJEN POSLE AUDITA — istorijski nalaz nije prenet; {notes}"
        rows.append({
            "finding_id": f"{inv['image_id']}#{finding}", "image_id": inv["image_id"], "todays_brand": inv["brand"], "historical_brand": "carsystem",
            "product_name": inv["product_name"], "slug": slug, "current_image_path": inv["current_image_path"],
            "current_image_width": inv["current_image_width"], "current_image_height": inv["current_image_height"],
            "finding": finding, "quality_need": need, "evidence_level": evidence, "treatment_status": treatment,
            "pipeline_tone_status": h["pipelineToneStatus"], "tone_fitted_gamma": extra.get("gamma", ""), "tone_median_lum_change_pct": extra.get("lum", ""),
            "historical_class": h["class"], "historical_problem_type": h["problemType"], "handoff_decision": decision, "approved_action": NO_APPROVAL,
            "pilot_status": PILOT.get(slug, ""), "asset_unchanged_since_audit": same,
            "processed_source_url": h["sourceProcessedUrl"], "original_source_url": h["officialOriginalUrl"],
            "inventory_classification": inv["classification"], "evidence_source": source,
            "notes": "; ".join(part for part in [notes, SPECIAL_NOTES.get(slug, "")] if part),
        })

    # 1) TON — confirmed / not_detected ISKLJUČIVO iz stvarno izmerenog para (pipeline-tone-measurements.json).
    measured = tone.get(slug)
    if measured and measured["pipelineToneStatus"] != h["pipelineToneStatus"]:
        errors.append(f"status tona se ne slaže između CSV-a i merenja: {slug}")
    if h["pipelineToneStatus"] == "confirmed":
        if not measured:
            errors.append(f"confirmed bez merenja: {slug}")
        emit("MEASURED_TONE_DEFECT", "tone/source re-export", "MEASURED", "CONFIRMED_QUALITY_ISSUE",
             "REEXPORT_FROM_OFFICIAL_ORIGINAL (ICC→sRGB samo ako profil postoji; bez globalnog brightness/gamma; bez AI) — tek posle odobrenja pilota",
             "data/catalog/image-quality/evidence/pipeline-tone-measurements.json",
             f"izmeren par: original {measured['originalFormat']} {measured['originalSize'][0]}×{measured['originalSize'][1]}, ICC {'da' if measured['originalHasICC'] else 'ne'}; medLum {measured['origMedLum']} → {measured['runtimeMedLum']}; {measured['corePixelsCompared']} piksela",
             gamma=measured["fittedGamma"], lum=measured["medianLumChangePct"])
    elif h["pipelineToneStatus"] == "not_detected":
        emit("TONE_NOT_DETECTED", "none", "MEASURED", "NO_ACTION_APPROVED",
             "NOT_DETECTED — izmeren par, γ 1,00; ostaje not_detected", "data/catalog/image-quality/evidence/pipeline-tone-measurements.json",
             f"izmeren par: original {measured['originalFormat']}; medLum {measured['origMedLum']} → {measured['runtimeMedLum']}",
             gamma=measured["fittedGamma"], lum=measured["medianLumChangePct"])
    elif re.search(r"_processed_", source_url) and re.search(r"\.png$", source_url, re.I):
        emit("SOURCE_PIPELINE_REEXPORT_CANDIDATE_UNMEASURED", "tone/source re-export (kandidat)", "RULE_BASED_CANDIDATE", "CANDIDATE_NOT_YET_MEASURED",
             "pipelineToneStatus = unknown; ekstrapolacija zabranjena (finalna odluka 9); sistemski re-export nije ni planiran ni odobren",
             "pravilo: današnji manifest porekla (izvor = _processed_ PNG derivat); par NIJE meren",
             "NIJE potvrđen defekt. Isti tip izvora kao 15 izmerenih parova — to je razlog za merenje, ne rezultat merenja.")

    # 2) BORDER_FRAME — šest potvrđenih slučajeva + rezultat BORDER_FRAME_STRIP simulacije.
    if h["alphaVeil"] == "True":
        sim = frame_sim.get(slug, {})
        rings = ", ".join(f"prsten {ring['ring']}: alfa {ring['median']} (max {ring['max']})" for ring in sim.get("rings", []))
        verdict = h["borderFrameSimVerdict"]
        today = "današnji asset daje isti signal" if h["runtimePath"] in edge_today else "današnja provera ivice NE daje signal"
        if h["runtimePath"] not in edge_today:
            errors.append(f"istorijski okvir nije viđen danas: {slug}")
        emit("BORDER_FRAME", "border-frame", "MEASURED", "KNOWN_ASSET_ISSUE",
             "BORDER_FRAME_STRIP (K_MAX=4, RING_TOL=6, GUARD=8 px; R1–R10) — simulacija PASS; obrada tek posle odobrenja" if verdict == "PASS"
             else f"BORDER_FRAME_STRIP simulacija REJECT ({FRAME_REJECT_REASON[slug]}) — NE SME u automatsku obradu; ručni pregled maske",
             "data/catalog/image-quality/evidence/alpha-frame-simulation.json + CARSYSTEM_IMAGE_AUDIT.csv",
             f"{rings}; {today}; `alpha<100→0` je ODBAČEN" + ("; okvir je i dalje vidljiv u tamnoj temi (asset nije zamenjen)" if slug.endswith("lhr75") else ""))
    elif h["runtimePath"] in edge_today:
        full_bleed = "FULL_BLEED_BACKDROP" in h["flags"]
        emit("EDGE_ALPHA_SIGNAL_NOT_IN_HANDOFF", "manual review", "MANUAL_REVIEW_REQUIRED", "NO_ACTION_APPROVED" if full_bleed else "CANDIDATE_NOT_YET_MEASURED",
             "NIJE handoff nalaz: istorijski detektor okvira (alphaVeil) = False; ne računa se kao BORDER_FRAME",
             "edge-frame.generated.json (gruba provera ivice iz ove sesije); BORDER_FRAME_STRIP simulacija NIJE rađena",
             ("materijal preko celog platna (FULL_BLEED_BACKDROP, ugaona alfa " + h["cornerAlphaMax"] + ") — signal ivice je svojstvo kadra, ne okvir") if full_bleed
             else f"ugaona alfa {h['cornerAlphaMax']}; istorijski A_OK — potreban ručni pogled pre bilo kakvog zaključka")

    # 3) RENDERING — fit sistem meri zapečenu senku (kartica manja nego što treba). V6A to rešava, ali NIJE na main.
    candidate = css.get(slug)
    if candidate and candidate["verdict"].startswith("CSS"):
        emit("FIT_MEASURES_BAKED_SHADOW", "crop/fit (rendering, ne asset)", "HISTORICAL_CONFIRMED", "KNOWN_RENDERING_ISSUE",
             "rešenje = V6A hibridni subjectBox (merenjem, bez izmene fajla; bez cropa) — IMPLEMENTED_AND_VERIFIED u starom worktree-u, NIJE na main; ne portuje se",
             "data/catalog/image-quality/evidence/css-rendering-candidates.csv",
             f"linearni manjak {candidate['linearShortfallPct']} %, manjak površine {candidate['areaShortfallPct']} %; inflacija boxa {candidate['areaInflation']}")

    # 4) Klase audita B / D / E / F (A nema nalaz). Okvir (klasa B) već nosi red BORDER_FRAME.
    cls = h["class"]
    if cls == "B_DETERMINISTIC_FIX" and h["alphaVeil"] != "True":
        emit("CLASS_B_DETERMINISTIC_FIX", "asset (deterministički tretman)", "HISTORICAL_CONFIRMED", "KNOWN_ASSET_ISSUE",
             "klasa B — tretman tek posle odobrenja pilota (handoff §12.8); finalna pravila imaju prednost nad predlogom: bez cropa, bez globalnog brightness/gamma/contrast, bez AI",
             "data/catalog/image-quality/evidence/CARSYSTEM_IMAGE_AUDIT.csv", f"nalaz: {h['why']} | istorijski predlog: {h['treatment']} | rizik: {h['risk']}")
    elif cls == "E_SOURCE_REPLACEMENT_PREFERRED":
        emit("CLASS_E_SOURCE_REPLACEMENT_PREFERRED", "source replacement (bolji zvanični packshot)", "HISTORICAL_CONFIRMED", "KNOWN_ASSET_ISSUE",
             "klasa E — kandidat za zamenu izvora boljim ZVANIČNIM packshotom; bez AI; ništa nije preuzeto", "data/catalog/image-quality/evidence/CARSYSTEM_IMAGE_AUDIT.csv",
             f"nalaz: {h['why']} | rizik: {h['risk']}")
    elif cls == "D_AI_HIGH_RISK":
        emit("CLASS_D_AI_HIGH_RISK", "manual review", "MANUAL_REVIEW_REQUIRED", "NO_ACTION_APPROVED",
             "klasa D — visok rizik; bez AI obrade; samo ručna odluka", "data/catalog/image-quality/evidence/CARSYSTEM_IMAGE_AUDIT.csv", f"nalaz: {h['why']} | rizik: {h['risk']}")
    elif cls == "F_SPECIAL_MARKETING_IMAGE":
        emit("CLASS_F_SPECIAL_MARKETING_IMAGE", "manual review", "MANUAL_REVIEW_REQUIRED", "NO_ACTION_APPROVED",
             "klasa F — marketinška/merch fotografija; ne dira se", "data/catalog/image-quality/evidence/CARSYSTEM_IMAGE_AUDIT.csv", f"nalaz: {h['why']} | rizik: {h['risk']}")

    # 5) Pojedinačne finalne odluke handoffa.
    if slug in V6_EXCLUDED:
        emit("V6_EXCLUDED_SLUG", "crop/fit", "HISTORICAL_CONFIRMED", "EXCLUDED_FROM_V6",
             "izuzet iz V6 — ostaje legacy dok korisnik ne odluči drugačije (finalna odluka 15)", "handoff §11.15", "")
    if slug in SHADOW_UNKNOWN:
        emit("V6B_OFFICIAL_SHADOW_UNKNOWN", "manual review", "MANUAL_REVIEW_REQUIRED", "NO_ACTION_APPROVED",
             "officialShadow = unknown — ostaje unknown (finalna odluka 16)", "handoff §11.16", "")
    if slug == "carsystem-rupes-polishing-machine-lhr75":
        emit("PILOT_CASE_LHR75", "asset (pilot)", "HISTORICAL_CONFIRMED", "KNOWN_ASSET_ISSUE",
             "LHR75 kandidat = LANCZOS_660 (jedini odobren izuzetak od pravila „nikad upscale”); NATIVE_560 samo dokaz; pilot NIJE integrisan",
             "handoff §11.6 + pilot tabela", "pilot rešava okvir i ton, ali je van repoa; `public/products/carsystem/enhanced/` ne postoji")
    if slug == "carsystem-glas":
        emit("OFFICIAL_SHADOW_PLATE_VISIBLE_IN_DARK", "rendering (tamna tema)", "HISTORICAL_CONFIRMED", "KNOWN_ASSET_ISSUE",
             "svojstvo asseta — zvanična senka je svetla pravougaona ploča; vezano za V6C koji NIJE odobren", "handoff §7", "")

today_only = sorted(set(inv_by_slug) - {h["slug"] for h in hist})
for slug in today_only:
    if inv_by_slug[slug]["current_image_status"] != "PLACEHOLDER":
        errors.append(f"današnji identitet sa slikom nije bio u istorijskom auditu: {slug}")

ids = [row["finding_id"] for row in rows]
if len(ids) != len(set(ids)):
    errors.append("dupli finding_id")
if errors:
    print(json.dumps({"errors": errors}, ensure_ascii=False, indent=1))
    sys.exit(1)

rows.sort(key=lambda row: row["finding_id"])
with open(os.path.join(HERE, "IMAGE_QUALITY_QUEUE.csv"), "w", newline="", encoding="utf-8") as fh:
    writer = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)

def tally(key, subset=None):
    out = {}
    for row in subset if subset is not None else rows:
        out[row[key]] = out.get(row[key], 0) + 1
    return dict(sorted(out.items()))

def identities(predicate):
    return len({row["image_id"] for row in rows if predicate(row)})

hist_tone = {}
for h in hist:
    hist_tone[h["pipelineToneStatus"]] = hist_tone.get(h["pipelineToneStatus"], 0) + 1

summary = {
    "handoff": {"file": "data/catalog/image-quality/evidence/CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md", "sha256": sha(os.path.join(EV, "CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md")), "historicalHead": "7d6b8df"},
    "evidenceSha256": {name: sha(os.path.join(EV, name)) for name in sorted(os.listdir(EV))},
    "remap": {"historicalPrimaryAssets": len(hist), "matchedToday": len(hist) - len(dropped_by_removal), "droppedByCatalogRemoval": dropped_by_removal, "todaysIdentities": {"carsystem": sum(1 for r in inventory if r["brand"] == "carsystem"), "rupes": sum(1 for r in inventory if r["brand"] == "rupes")},
              "todayOnlyPlaceholders": today_only, "assetContinuity": continuity},
    "historicalPipelineToneStatus": dict(sorted(hist_tone.items())),
    "queue": {"findingRows": len(rows), "identities": identities(lambda row: True), "identitiesByBrand": {brand: identities(lambda row, b=brand: row["todays_brand"] == b) for brand in ("carsystem", "rupes")},
              "byFinding": tally("finding"), "byEvidenceLevel": tally("evidence_level"), "byTreatmentStatus": tally("treatment_status"),
              "rupesByFinding": tally("finding", [row for row in rows if row["todays_brand"] == "rupes"])},
    "corrected": {
        "confirmedMeasuredToneDefects": sum(1 for row in rows if row["finding"] == "MEASURED_TONE_DEFECT"),
        "toneNotDetected": sum(1 for row in rows if row["finding"] == "TONE_NOT_DETECTED"),
        "unmeasuredToneCandidates": sum(1 for row in rows if row["finding"] == "SOURCE_PIPELINE_REEXPORT_CANDIDATE_UNMEASURED"),
        "renderingIssues": sum(1 for row in rows if row["treatment_status"] == "KNOWN_RENDERING_ISSUE"),
        "assetIssueRows": sum(1 for row in rows if row["treatment_status"] == "KNOWN_ASSET_ISSUE"),
        "assetIssueIdentities": identities(lambda row: row["treatment_status"] == "KNOWN_ASSET_ISSUE"),
        "manualReviewRows": sum(1 for row in rows if row["evidence_level"] == "MANUAL_REVIEW_REQUIRED"),
        "excludedFromV6": sum(1 for row in rows if row["treatment_status"] == "EXCLUDED_FROM_V6"),
    },
    "v6": {"V6A": "HISTORICAL IMPLEMENTED_AND_VERIFIED (stari worktree) — NOT PRESENT on main", "V6B": "HISTORICAL IMPLEMENTED_AND_VERIFIED (stari worktree) — NOT PRESENT on main",
           "loadingShadowGate": "HISTORICAL IMPLEMENTED_AND_VERIFIED (stari worktree) — NOT PRESENT on main", "V6C": "REJECTED / NOT APPROVED",
           "pilotEnhancedAssets": {"approved": 0, "integrated": 0}, "runtimeProductImageReferenceChanged": False,
           "presentOnMain": {path: os.path.exists(os.path.join(REPO, path)) for path in ["lib/productFitModel.mjs", "lib/product-fit-model.ts", "components/product/productImageLoadState.mjs", "components/product/productFitModelV6.test.mjs", "public/products/carsystem/enhanced"]}},
}
json.dump(summary, open(os.path.join(HERE, "quality-reconciliation.generated.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open(os.path.join(HERE, "quality-reconciliation.generated.json"), "a").write("\n")

# ── Quality dio izveštaja ────────────────────────────────────────────────────────────────
c, q = summary["corrected"], summary["queue"]
dropped_list = ", ".join("`" + entry["slug"] + "`" for entry in dropped_by_removal) or "—"
section = [
    "## 6. Carsystem kvalitet — usklađeno sa handoffom (FINAL RECONCILIATION)", "",
    "Izvor istine: `historical-evidence/CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md` i njegovi stvarni fajlovi merenja (`pipeline-tone-measurements.json`, `CARSYSTEM_IMAGE_AUDIT.csv`, `css-rendering-candidates.csv`, `alpha-frame-simulation.json`). Ništa nije ponovo mereno, nijedan prag nije menjan, nijedan neizmeren par nije dobio rezultat.", "",
    f"**Remap na današnji runtime.** {len(hist) - len(dropped_by_removal)}/{len(hist)} istorijskih primary asseta ima današnji identitet sa istim slugom i istom putanjom slike; danas Carsystem {summary['remap']['todaysIdentities']['carsystem']} + RUPES {summary['remap']['todaysIdentities']['rupes']} ({len(dropped_by_removal)} nalaz otpada jer je kartica uklonjena iz kataloga 2026-09-22: {dropped_list}; identiteti bez istorijskog reda su placeholderi `{'`, `'.join(today_only)}` → `USER_SUPPLY`, nisu quality redovi). Kontinuitet asseta: {continuity['identical']} sa istim `sourceSha256` i veličinom fajla, {continuity['legacy_no_manifest']} legacy bez sync manifesta (ista veličina), {continuity['changed']} promenjenih → istorijski nalazi važe za današnje fajlove. Nalazi RUPES proizvoda nose `todays_brand = rupes` ({q['identitiesByBrand']['rupes']} identiteta).", "",
    f"**Ton — ispravka prethodne verzije.** Prethodni queue je označio {previous_tone} redova kao `TONE_SOURCE_REEXPORT_CANDIDATE`, što se čitalo kao {previous_tone} defekata. Ispravno:", "",
    "| Nalaz | evidence_level | treatment_status | Broj |", "|---|---|---|---|",
    f"| `MEASURED_TONE_DEFECT` (izmeren par original ↔ runtime, γ 2,07–2,27) | MEASURED | CONFIRMED_QUALITY_ISSUE | **{c['confirmedMeasuredToneDefects']}** |",
    f"| `TONE_NOT_DETECTED` (izmeren par, γ 1,00 — `socks`, kontrola) | MEASURED | NO_ACTION_APPROVED | **{c['toneNotDetected']}** |",
    f"| `SOURCE_PIPELINE_REEXPORT_CANDIDATE_UNMEASURED` (izvor je `_processed_` PNG; par NIJE meren) | RULE_BASED_CANDIDATE | CANDIDATE_NOT_YET_MEASURED | **{c['unmeasuredToneCandidates']}** |", "",
    f"Istorijski `pipelineToneStatus` je prenet bez izmene: confirmed {hist_tone.get('confirmed', 0)} · not_detected {hist_tone.get('not_detected', 0)} · unknown {hist_tone.get('unknown', 0)}. Kandidati NISU potvrđeni defekti i ne sabiraju se sa 15 izmerenih.", "",
    "**Ostali nalazi (odluke handoffa su prepisane, ne donose se ponovo).**", "",
    "| Nalaz | evidence_level | treatment_status | Redova |", "|---|---|---|---|",
]
LABEL = {
    "BORDER_FRAME": "1 px poluprovidan okvir — 4 PASS simulacije, 2 REJECT (`slp41a` R4, `skorpio-e-rx` R1/R2: nikad u automatsku obradu)",
    "EDGE_ALPHA_SIGNAL_NOT_IN_HANDOFF": "signal ivice iz ove sesije koji handoff NE potvrđuje (2 full-bleed kadra, 2 za ručni pogled) — nije BORDER_FRAME",
    "FIT_MEASURES_BAKED_SHADOW": "fit meri zapečenu senku (kartica manja); rešenje V6A — nije na main",
    "CLASS_B_DETERMINISTIC_FIX": "klasa B (bez 6 okvira koji imaju svoj red)", "CLASS_E_SOURCE_REPLACEMENT_PREFERRED": "klasa E — zamena izvora boljim zvaničnim packshotom",
    "CLASS_D_AI_HIGH_RISK": "klasa D — bez AI", "CLASS_F_SPECIAL_MARKETING_IMAGE": "klasa F — ne dira se",
    "V6_EXCLUDED_SLUG": "`multi-flow`, `paint-system-cps-3-0`, `h2o-cleaner`", "V6B_OFFICIAL_SHADOW_UNKNOWN": "`glass-fibre-reinforced-putty` = unknown",
    "PILOT_CASE_LHR75": "LHR75 = LANCZOS_660, pilot nije integrisan", "OFFICIAL_SHADOW_PLATE_VISIBLE_IN_DARK": "`glas` — svetla ploča senke u tamnoj temi",
}
for finding, label in LABEL.items():
    subset = [row for row in rows if row["finding"] == finding]
    if subset:
        section.append(f"| `{finding}` — {label} | {' / '.join(sorted({row['evidence_level'] for row in subset}))} | {' / '.join(sorted({row['treatment_status'] for row in subset}))} | {len(subset)} |")
section += ["",
    f"Queue: **{q['findingRows']}** redova nalaza nad **{q['identities']}** identiteta (Carsystem {q['identitiesByBrand']['carsystem']} · RUPES {q['identitiesByBrand']['rupes']}); jedan red = jedan nalaz, pa isti identitet može imati više redova. Po `treatment_status`: " + " · ".join(f"{key} {value}" for key, value in q["byTreatmentStatus"].items()) + ".", "",
    "Globalni poznati rendering nalazi bez liste po slugu u handoffu (nisu pretvoreni u redove): svetle CSS senke kartice u tamnoj temi; svetli oreol zvanične senke na tamnoj površini (36 od 80 asseta sa mekim proširenjem) — estetska odluka V6C, nije doneta. Odbačeni signali (luminanca, `SOFT_IMAGE`, `skinShare`) nisu nalazi.", "",
    "**Stanje V6.** V6A, V6B i loading-shadow gate: istorijski `IMPLEMENTED_AND_VERIFIED` u starom worktree-u (HEAD `7d6b8df`, nekomitovano) — **NOT PRESENT** na današnjem `main` (" + ", ".join(f"`{path}`: {'postoji' if present else 'ne postoji'}" for path, present in summary["v6"]["presentOnMain"].items()) + "). V6C: **REJECTED / NOT APPROVED**. Pilot enhanced asseti: **0 odobreno / 0 integrisano**. Runtime `productImage` reference: **nepromenjene**. Ništa nije portovano.", "",
    "**Zabrane koje ostaju na snazi.** Bez globalnog brightness/gamma/contrast; bez AI ulepšavanja; bez mass apply; bez enhanced runtime referenci bez odobrenja; original se nikad ne prepisuje.", "",
    "**Napomena o inventaru i rights review.** Klasa `IMAGE_QUALITY_REVIEW_ONLY` (360) u inventaru znači „ima runtime sliku i nalazi se u quality queue”, NE „360 potvrđenih defekata”. Opisni segment `quality: …` u koloni `notes` (inventar 384 reda, `IMAGE_RIGHTS_REVIEW.csv` 24 RUPES reda) usklađuje `sync_quality_notes.py` sa nalazima ovog queue-a; nijedna druga kolona se pri tome ne menja.", "",
    "Ostali brendovi nemaju urađen quality audit → `NEEDS_FUTURE_QUALITY_AUDIT` (nije izmišljan nalaz).", "",
]
report_path = os.path.join(HERE, "FINAL_IMAGE_AUDIT.md")
report = open(report_path, encoding="utf-8").read()
start, end = report.index("## 6. "), report.index("## 7. ")
report = report[:start] + "\n".join(section) + "\n" + report[end:]
bullet = f"- Quality queue (`IMAGE_QUALITY_QUEUE.csv`): **{q['findingRows']}** redova nalaza / **{q['identities']}** identiteta — potvrđeno merenjem **{c['confirmedMeasuredToneDefects']}**, neizmereni kandidati **{c['unmeasuredToneCandidates']}**, rendering **{c['renderingIssues']}**, asset **{c['assetIssueRows']}**, ručni pregled **{c['manualReviewRows']}** (vidi §6)"
report, replaced = re.subn(r"^- (Samo kvalitet|Quality queue) \(`IMAGE_QUALITY_QUEUE\.csv`\).*$", lambda _: bullet, report, flags=re.M)
assert replaced == 1, "bullet §3 nije nađen"
open(report_path, "w", encoding="utf-8").write(report)
print(json.dumps({"queue": summary["queue"], "corrected": summary["corrected"], "remap": summary["remap"]}, ensure_ascii=False, indent=1))
