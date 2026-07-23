#!/usr/bin/env python3
"""Extract deterministic RGB approximations from official Cosmos Lac vector charts."""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

import pdfplumber


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF_ROOT = PROJECT_ROOT / "tmp/pdfs/cosmos-lac-official/COSMOS LAC Color charts "
DEFAULT_OUTPUT = PROJECT_ROOT / "data/cosmos-lac-color-chart.generated.json"


def rgb_tuple(color: object) -> tuple[float, float, float] | None:
    if not isinstance(color, (tuple, list)):
        return None
    if len(color) == 3:
        return tuple(float(channel) for channel in color)
    if len(color) == 4:
        cyan, magenta, yellow, black = (float(channel) for channel in color)
        return (
            1 - min(1, cyan * (1 - black) + black),
            1 - min(1, magenta * (1 - black) + black),
            1 - min(1, yellow * (1 - black) + black),
        )
    return None


def to_hex(rgb: tuple[float, float, float]) -> str:
    channels = [max(0, min(255, round(channel * 255))) for channel in rgb]
    return "#" + "".join(f"{channel:02X}" for channel in channels)


def color_score(rgb: tuple[float, float, float]) -> float:
    maximum = max(rgb)
    minimum = min(rgb)
    chroma = maximum - minimum
    luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
    return chroma * 2 + luminance * 0.2


def grouped_swatch_rects(page: pdfplumber.page.Page, min_height: float) -> list[dict]:
    groups: dict[tuple[float, float, float, float], list[dict]] = defaultdict(list)
    for rect in page.rects:
        width = rect["x1"] - rect["x0"]
        height = rect["bottom"] - rect["top"]
        color = rgb_tuple(rect.get("non_stroking_color"))
        if width < 100 or height < min_height or color is None:
            continue
        key = tuple(round(float(rect[field]), 1) for field in ("x0", "top", "x1", "bottom"))
        groups[key].append({**rect, "_rgb": color})

    selected: list[dict] = []
    for rects in groups.values():
        colors = {to_hex(rect["_rgb"]): rect for rect in rects}
        candidates = list(colors.values())
        non_black = [rect for rect in candidates if max(rect["_rgb"]) > 0.16]
        pool = non_black or candidates
        selected.append(max(pool, key=lambda rect: color_score(rect["_rgb"])))
    return sorted(selected, key=lambda rect: (rect["top"], rect["x0"]))


def words_for_swatch(page: pdfplumber.page.Page, rect: dict, max_offset: float) -> list[dict]:
    words = page.extract_words(x_tolerance=1, y_tolerance=2, keep_blank_chars=False)
    return [
        word
        for word in words
        if word["x0"] >= rect["x0"] - 10
        and word["x1"] <= rect["x1"] + 10
        and word["top"] >= rect["bottom"] + 3
        and word["bottom"] <= rect["bottom"] + max_offset
    ]


def normalized_code(value: str) -> str:
    return value.upper().replace("F0-", "FO-").replace("F0", "FO")


def text_from_words(words: list[dict]) -> str:
    return " ".join(word["text"] for word in sorted(words, key=lambda word: (word["top"], word["x0"])))


def add_entry(
    entries: dict[str, dict],
    *,
    key: str,
    label: str,
    rgb: tuple[float, float, float],
    source: str,
) -> None:
    key = normalized_code(key)
    value = {
        "hex": to_hex(rgb),
        "label": " ".join(label.split()),
        "source": source,
    }
    existing = entries.get(key)
    if existing and existing["hex"] != value["hex"]:
        raise ValueError(f"Conflicting chart values for {key}: {existing['hex']} / {value['hex']}")
    entries[key] = value


def extract_visual_index(pdf_path: Path, entries: dict[str, dict]) -> None:
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[1]
        for rect in grouped_swatch_rects(page, min_height=38):
            words = words_for_swatch(page, rect, max_offset=31)
            text = text_from_words(words)
            cl_match = re.search(r"\bCL\s+([A-Z]?\d{2,4})\b", text, re.IGNORECASE)
            if not cl_match:
                continue
            code = cl_match.group(1).upper()
            label = text[: cl_match.start()].strip()
            source = f"{pdf_path.name}, p. 2"
            add_entry(entries, key=f"CL:{code}", label=label, rgb=rect["_rgb"], source=source)
            ral_match = re.search(r"\bRAL\s+(\d{4})\b", label, re.IGNORECASE)
            if ral_match:
                ral_key = f"RAL:{ral_match.group(1)}"
                add_entry(
                    entries,
                    key=ral_key,
                    label=label,
                    rgb=rect["_rgb"],
                    source=source,
                )
                entries[ral_key]["cosmosCode"] = code


def extract_flame_index(pdf_path: Path, entries: dict[str, dict]) -> None:
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[1]
        for rect in grouped_swatch_rects(page, min_height=25):
            words = words_for_swatch(page, rect, max_offset=25)
            text = normalized_code(text_from_words(words))
            code_match = re.search(r"\b(FB|FO)-(\d{3,4})\b", text)
            if not code_match:
                continue
            code = f"{code_match.group(1)}:{code_match.group(2)}"
            label = text[: code_match.start()].strip()
            add_entry(
                entries,
                key=code,
                label=label,
                rgb=rect["_rgb"],
                source=f"{pdf_path.name}, p. 2",
            )


def validate_entries(entries: dict[str, dict]) -> None:
    expected_minimums = {
        "CL:": 105,
        "RAL:": 45,
        "FB:": 115,
        "FO:": 130,
    }
    for prefix, minimum in expected_minimums.items():
        count = sum(key.startswith(prefix) for key in entries)
        if count < minimum:
            raise ValueError(f"Expected at least {minimum} {prefix} chart entries, found {count}")

    for key, value in entries.items():
        if not re.fullmatch(r"#[0-9A-F]{6}", value["hex"]):
            raise ValueError(f"Invalid color for {key}: {value['hex']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf-root", type=Path, default=DEFAULT_PDF_ROOT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    entries: dict[str, dict] = {}
    extract_visual_index(args.pdf_root / "Colourchart2023_LEAFLET-DIGITAL USE.pdf", entries)
    extract_flame_index(
        args.pdf_root / "FL🔥ME /FLAME_Colourchart2023_LEAFLET_DIGITAL USE.pdf",
        entries,
    )
    validate_entries(entries)

    payload = {
        "schemaVersion": 1,
        "note": (
            "Screen RGB approximations extracted from vector swatches in official Cosmos Lac "
            "color charts. Physical samples remain authoritative."
        ),
        "entries": dict(sorted(entries.items())),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(entries)} chart mappings to {args.output}")


if __name__ == "__main__":
    main()
