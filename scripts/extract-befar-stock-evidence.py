#!/usr/bin/env python3
"""Izvlači Befar/Leo dokaz o aktivnosti artikla iz Carsystem lager izveštaja.

ZAŠTO POSTOJI
    Faza 1.5 je asortiman zaključila iz lager izveštaja koji je živeo samo u
    ~/Downloads. To nije reproducibilno. Ovaj skript pretvara bilo koji lager
    izveštaj u versionisani artefakt u repozitorijumu, tako da se za šest meseci
    može utvrditi odakle je došao svaki zaključak o asortimanu.

ŠTA NAMERNO NE ZAPISUJE
    Ni količine, ni cene, ni vrednost lagera. Izlaz nosi samo šifru, naziv,
    porodicu, sistem montaže i status:

        RECENT_STOCK_EVIDENCE  količina > 0 na dan izveštaja
        RECENT_ZERO_STOCK      artikal postoji u izveštaju, količina 0

    Status NIKADA nije tvrdnja o dostupnosti danas — samo dokaz da artikal nije
    istorijski artefakt. Javna stranica ne prikazuje ni status ni brojeve.

UPOTREBA
    python3 scripts/extract-befar-stock-evidence.py <putanja-do-izvestaja.pdf> \\
        [--source-label "lager 23.7.26.pdf"] [--printed-on 2026-07-23]

    Izlaz: data/knowledge/befar-stock-evidence.generated.json

ZAVISNOSTI
    pypdf (pip install pypdf)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, timezone, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = REPO_ROOT / "data" / "knowledge" / "befar-stock-evidence.generated.json"

# Red u izveštaju završava se numeričkim repom: količina, JM, cena, vrednost,
# šifra (6 cifara), grupa, opciono kataloški broj. Naziv je sve pre toga i može
# biti prelomljen u više linija.
TAIL = re.compile(
    r"(?P<qty>[\d.]*,\d{3})(?P<jm>[A-ZŠĐŽČĆ]{2,3})\s+"
    r"(?P<price>[\d.]+,\d{4})\s+"
    r"(?P<value>[\d.]+,\d{2})(?P<code>\d{6})\s+"
    r"(?P<gr>\d{2})(?:\s*(?P<kat>\d{6}))?\s*$"
)

SKIP = re.compile(
    r"^(CAR SYSTEM|STANJE ZALIHA|Datum|INĐIJA|Po nazivu|Trgovačka|Naziv robe|"
    r"Na dan|Poslovni|021 VELEPRODAJA|Vrsta|Stanje artikla|\d{2}\.\d{2}\.\d{4}|"
    r"Ukupno|Strana|\s*$)"
)

BRAND_PREFIXES = ("BEFAR", "LEO ")

FAMILY_RULES: list[tuple[str, str]] = [
    ("MEDJUPODLO", "Međupodloške"),
    ("ZASTITA PODLOSKE", "Zaštita podloške"),
    ("PODLOSK", "Podloške / nosači"),
    ("PODLOŠK", "Podloške / nosači"),
    ("VUNENI", "Vuneni diskovi"),
    ("BRUSNI BLOK", "Brusni blokovi"),
    ("NETKANI", "Netkani abraziv"),
    ("WAFFLE", "Waffle pene"),
    ("ELIPS", "Elips pene"),
    ("16 RUPA ORBITAL", "Plus orbital pene"),
    ("PLUS CICAK SUNDJER", "Plus pene"),
    ("KONUSNI", "Pene za vosak"),
    ("RUCNI SUNDJER ZA POLIRANJE", "Ručne pene za poliranje"),
    ("RUCNI SUNDJER", "Ručni brusni sunđeri"),
    ("SUNDJER CICAK", "Čičak pene"),
    ("CICAK SUNDJER", "Čičak pene"),
    ("SUNDJER 150X", "M14 pene"),
    ("POLIR PASTA", "Hemija 250 g"),
    ("COMPOUND", "Hemija 1000 g"),
    ("POLISH STD", "Hemija 1000 g"),
    ("HOLOGRAM STD", "Hemija 1000 g"),
    ("PROTECTOR STD", "Hemija 1000 g"),
    ("MIKROFIBER", "Krpe i potrošno"),
    ("MEDENE KRPE", "Krpe i potrošno"),
    ("TACK CLOTH", "Krpe i potrošno"),
    ("FOLIJA", "Krpe i potrošno"),
    ("SET ZA POLIRANJE FAROVA", "Setovi"),
    ("SUNDJER ZA FAROVE", "Specijalni sunđeri"),
    ("SUNDJER ZA FELNE", "Specijalni sunđeri"),
    ("APLIKATOR ZA KERAMIKU", "Leo keramika"),
    ("KRPA ZA KERAMI", "Leo keramika"),
    ("NANO KERAMICKA", "Leo keramika"),
    ("DETAILING CICAK PODLOSKA", "Leo podloške"),
    ("DATAILING CICAK PODLOSKA", "Leo podloške"),
    ("MAGIČNI", "Leo ostalo"),
    ("MIKROFIBER SUNDJER", "Leo ostalo"),
    ("SET", "Setovi"),
]

ATTACHMENT_RULES: list[tuple[str, str]] = [
    ("M14", "m14"),
    ("ORBITAL", "cicak-orbital"),
    ("CICAK", "cicak"),
    ("ČIČAK", "cicak"),
    ("RUCNI", "rucno"),
    ("KONUSNI", "rucno"),
    ("MEDJUPODLO", "medjupodloska"),
    ("ZASTITA PODLOSKE", "medjupodloska"),
    ("PODLOSK", "podloska"),
    ("PODLOŠK", "podloska"),
]


def classify(name: str, rules: list[tuple[str, str]], default: str) -> str:
    upper = name.upper()
    for needle, value in rules:
        if needle in upper:
            return value
    return default


def parse(pdf_path: Path) -> list[dict]:
    try:
        import pypdf
    except ImportError:
        sys.exit("pypdf nije instaliran: pip install pypdf")

    reader = pypdf.PdfReader(str(pdf_path))
    lines: list[str] = []
    for page in reader.pages:
        lines.extend((page.extract_text() or "").split("\n"))

    rows: list[dict] = []
    buffer: list[str] = []
    for line in lines:
        line = line.rstrip()
        if SKIP.match(line):
            buffer = []
            continue
        match = TAIL.search(line)
        if not match:
            buffer.append(line.strip())
            continue

        name = re.sub(r"\s+", " ", " ".join([*buffer, line[: match.start()]]).strip())
        buffer = []
        if not name.upper().startswith(BRAND_PREFIXES):
            continue

        quantity = float(match.group("qty").replace(".", "").replace(",", "."))
        code = match.group("code")
        rows.append(
            {
                # Šifra kako stoji u izveštaju (6 cifara) i Befarov kod bez vodećih nula.
                "reportCode": code,
                "befarCode": code.lstrip("0") or "0",
                "name": name,
                "family": classify(name, FAMILY_RULES, "Ostalo"),
                "attachment": classify(name, ATTACHMENT_RULES, "none"),
                # Namerno: samo status, bez količine.
                "status": "RECENT_STOCK_EVIDENCE" if quantity > 0 else "RECENT_ZERO_STOCK",
            }
        )

    rows.sort(key=lambda row: (row["family"], row["reportCode"]))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path, help="Lager izveštaj (PDF)")
    parser.add_argument("--source-label", default=None, help="Ime izvora za zapis")
    parser.add_argument("--printed-on", default=None, help="Datum štampe izveštaja (YYYY-MM-DD)")
    args = parser.parse_args()

    if not args.report.exists():
        sys.exit(f"Izveštaj ne postoji: {args.report}")

    rows = parse(args.report)
    with_stock = sum(1 for row in rows if row["status"] == "RECENT_STOCK_EVIDENCE")

    payload = {
        "$comment": (
            "Generisano skriptom scripts/extract-befar-stock-evidence.py. "
            "Sadrži isključivo dokaz o aktivnosti artikla — bez količina, cena i "
            "vrednosti lagera. Status nije tvrdnja o dostupnosti danas."
        ),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {
            "label": args.source_label or args.report.name,
            "printedOn": args.printed_on,
            "kind": "carsystem-stock-report",
            # Putanja se NE zapisuje kao trajni source of truth; beleži se samo ime.
            "note": (
                "Izveštaj nije u repozitorijumu jer sadrži cene i količine. "
                "Ovaj JSON je izvedeni, objavljivo-bezbedan artefakt."
            ),
        },
        "reconciliation": {
            "status": "SOURCE_PENDING_RECONCILIATION",
            "expectedSource": "lager_23-7-26_filtrirani_proizvodi.xlsx",
            "expectedSourceFound": False,
            "detail": (
                "Naručeni izvor je filtrirani XLSX. On nije pronađen na mašini. "
                "Parsiran je pun PDF izveštaj sa istim datumom štampe. Razlike nisu "
                "poređene i nijedan javni sadržaj ne sme se menjati na osnovu razlike "
                "dok se XLSX ne dostavi."
            ),
        },
        "counts": {
            "articles": len(rows),
            "recentStockEvidence": with_stock,
            "recentZeroStock": len(rows) - with_stock,
            "families": len({row["family"] for row in rows}),
        },
        "articles": rows,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Zapisano: {OUT_PATH.relative_to(REPO_ROOT)}")
    print(f"  artikala: {len(rows)}  sa zalihom: {with_stock}  na nuli: {len(rows) - with_stock}")


if __name__ == "__main__":
    main()
