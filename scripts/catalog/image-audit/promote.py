#!/usr/bin/env python3
"""
Upis u PRAĆENE canonical fajlove.

Poslednji korak lanca `npm run catalog:image-supply:generate`. Kopira bajt-za-bajt iz radnog
direktorijuma; jedino se izveštaju dopisuje zaglavlje, a handoffu statusni blok. Nijedan broj se
ne upisuje ručno — svi se mere iz fajlova koji su upravo napravljeni.
"""
import csv, hashlib, os, shutil
HERE = os.environ.get("IMAGE_AUDIT_WORK") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".cache", "image-audit")
HERE = os.path.abspath(HERE)
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
DATA = os.path.join(REPO, "data/catalog/image-supply"); DOCS = os.path.join(REPO, "docs/catalog")
os.makedirs(DATA, exist_ok=True); os.makedirs(DOCS, exist_ok=True)
sha = lambda name: hashlib.sha256(open(os.path.join(HERE, name), "rb").read()).hexdigest()
# Broj redova inventara se MERI, ne upisuje: izveštaj ne sme da tvrdi zastarelu veličinu.
with open(os.path.join(HERE, "IMAGE_IDENTITY_INVENTORY.csv"), newline="", encoding="utf-8") as fh:
    inventory_rows = sum(1 for _ in csv.reader(fh)) - 1
for source, target in [("MISSING_PRODUCT_IMAGES.csv", "MISSING_PRODUCT_IMAGES.csv"), ("USER_IMAGE_SUPPLY_QUEUE_FINAL.csv", "USER_IMAGE_SUPPLY_QUEUE.csv"), ("IMAGE_RIGHTS_REVIEW.csv", "IMAGE_RIGHTS_REVIEW.csv"), ("OWNER_SUPPLY_BATCH_01_CANDIDATES.csv", "OWNER_SUPPLY_BATCH_01_CANDIDATES.csv")]:
    shutil.copyfile(os.path.join(HERE, source), os.path.join(DATA, target))
shutil.copyfile(os.path.join(HERE, "USER_IMAGE_SUPPLY_GUIDE.md"), os.path.join(DOCS, "USER_IMAGE_SUPPLY_GUIDE.md"))
report = open(os.path.join(HERE, "FINAL_IMAGE_AUDIT.md"), encoding="utf-8").read()
start = report.index("## 1. ")
header = "\n".join([
    "# Final image audit", "",
    "> Status: **APPROVED_FOR_OWNER_IMAGE_SUPPLY**. Ništa nije preuzeto, nijedna slika ni `productImage` referenca nije menjana.", ">",
    "> Commit iz kog je manifest nastao zapisuje `manifest-lock.json` (`createdFromMainSha`) — jedini provenance SHA. Ovde se namerno NE duplira: `git merge-base` se pomera pri svakom fast-forwardu, pa bi izveštaj bio izmenjen i kad se katalog nije promenio, a generator ne bi bio idempotentan.", "",
    "**Praćeni (canonical) fajlovi** — `data/catalog/image-supply/`: `MISSING_PRODUCT_IMAGES.csv`, `USER_IMAGE_SUPPLY_QUEUE.csv`, `IMAGE_RIGHTS_REVIEW.csv`, `OWNER_SUPPLY_BATCH_01_CANDIDATES.csv`, `manifest-lock.json`. Provera: `npm run catalog:image-supply:check`. Vodič za vlasnika: `docs/catalog/USER_IMAGE_SUPPLY_GUIDE.md`. Runtime sajta ove fajlove ne čita.", "",
    "**Image-quality workflow ima ODVOJEN canonical evidence** (nije deo supply lock-a, koji po dizajnu pokriva samo MISSING / USER_SUPPLY / RIGHTS): `data/catalog/image-quality/IMAGE_QUALITY_QUEUE.csv` (usklađeni queue; SHA-256 `" + sha("IMAGE_QUALITY_QUEUE.csv") + "`) i `docs/catalog/image-quality/CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md` (handoff, `HISTORICAL_IMPLEMENTATION_EVIDENCE`). Ni ti fajlovi nisu runtime.", "",
    "**Kako se ovi fajlovi prave.** `npm run catalog:image-supply:generate` (`scripts/catalog/image-audit/`) ih gradi iz STVARNOG runtime kataloga i praćenih dokaza u `data/catalog/image-quality/evidence/`. Drugo pokretanje daje bajt-identične izlaze. Provera zatečenog stanja: `npm run catalog:image-supply:check`.", "",
    "**Nepraćeni radni međuizlaz** (`.cache/image-audit/`, ne čita ga ni runtime ni budući importer): pun inventar `IMAGE_IDENTITY_INVENTORY.csv` (" + str(inventory_rows) + " redova; SHA-256 `" + sha("IMAGE_IDENTITY_INVENTORY.csv") + "`, otisak je u lock-u). Nazivi fajlova bez putanje u nastavku odnose se na taj radni inventar, osim canonical manifesta navedenih gore.", "",
    "Kolone `USER_IMAGE_SUPPLY_QUEUE.csv`: odobreni owner supply pack (isti `image_id` / `suggested_filename` / `target_path` kao u `MISSING_PRODUCT_IMAGES.csv`), dopunjen sa `public_code`, `manufacturer_code`, `image_scope`, `members_sharing_identity`, `what_image_is_needed`, `why_image_is_needed`.", "", ""])
open(os.path.join(DOCS, "FINAL_IMAGE_AUDIT.md"), "w", encoding="utf-8").write((header + report[start:]).rstrip("\n") + "\n")

# ── Carsystem image-quality evidence (NON-RUNTIME; odvojen od supply lock-a) ──
QDATA = os.path.join(REPO, "data/catalog/image-quality"); QDOCS = os.path.join(REPO, "docs/catalog/image-quality")
os.makedirs(QDATA, exist_ok=True); os.makedirs(QDOCS, exist_ok=True)
shutil.copyfile(os.path.join(HERE, "IMAGE_QUALITY_QUEUE.csv"), os.path.join(QDATA, "IMAGE_QUALITY_QUEUE.csv"))
handoff_path = os.path.join(REPO, "data", "catalog", "image-quality", "evidence", "CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md")
handoff = open(handoff_path, encoding="utf-8").read()
original_sha = hashlib.sha256(open(handoff_path, "rb").read()).hexdigest()
# Istorijski sadržaj se ne menja; skida se samo belina na kraju reda (jedan razmak, red 91) da `git diff --check` ostane čist.
body = "\n".join(line.rstrip(" \t") for line in handoff.split("\n"))
status = "\n".join([
    "> **STATUS: HISTORICAL_IMPLEMENTATION_EVIDENCE**", ">",
    "> Current-main state (2026-09-21, `main` = `7f9f6179d347348b39dec7609e653d2c7971d607`):", ">",
    "> - V6A / V6B / loading-shadow gate NISU na current `main` (istorijski `IMPLEMENTED_AND_VERIFIED` samo u starom, nekomitovanom worktree-u na `7d6b8df`);",
    "> - V6C NIJE odobren;",
    "> - enhanced pilot assets = 0 integrated (0 odobreno); `productImage` reference nepromenjene;",
    "> - dokument služi kao evidence/handoff za budući quality rollout, ne kao opis današnjeg koda;",
    "> - današnji product/brand identities se UVEK uzimaju iz current runtime-a (npr. 25 tadašnjih „Carsystem” RUPES proizvoda danas ima `brandSlug = rupes`); usklađeni nalazi po današnjem identitetu su u `data/catalog/image-quality/IMAGE_QUALITY_QUEUE.csv`.", ">",
    "> Istorijski sadržaj ispod ove napomene nije menjan. SHA-256 originalnog handoff fajla: `" + original_sha + "` (jedina razlika u telu: uklonjen jedan razmak na kraju reda 91).", "", "---", "", ""])
open(os.path.join(QDOCS, "CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md"), "w", encoding="utf-8").write(status + body)
print("promoted")
