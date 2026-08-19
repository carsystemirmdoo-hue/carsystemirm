/**
 * Shared helpers for reading R-M technical PDFs.
 *
 * Text extraction itself is done in Python (`pypdf`), because that is the only
 * PDF toolchain available on this machine — no poppler, mutool, qpdf or
 * ghostscript. These helpers wrap that call and normalise the output.
 *
 * The normalisation matters more than it looks: the R-M PDFs embed typographic
 * ligatures (ﬁ, ﬂ, ﬀ), so a naive extraction yields "ﬂash oﬀ", "ﬁlm" and
 * "speciﬁed". Any regex written against the human-readable spelling silently
 * matches nothing. Every consumer must go through `normaliseText()`.
 */

import { execFileSync } from "node:child_process";

const LIGATURES = [
  ["ﬀ", "ff"],
  ["ﬁ", "fi"],
  ["ﬂ", "fl"],
  ["ﬃ", "ffi"],
  ["ﬄ", "ffl"],
  ["ﬅ", "st"],
  ["ﬆ", "st"],
];

/** Undo ligatures and unify whitespace/dash variants. */
export function normaliseText(value) {
  let text = value;
  for (const [from, to] of LIGATURES) {
    text = text.split(from).join(to);
  }
  return text
    .replace(/ /g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/’/g, "'")
    .replace(/[ \t]+/g, " ");
}

const PY_EXTRACT = `
import json, sys
from pypdf import PdfReader
out = []
for path in sys.argv[1:]:
    try:
        reader = PdfReader(path)
        pages = []
        for page in reader.pages:
            try:
                pages.append(page.extract_text() or "")
            except Exception as exc:
                pages.append("")
        meta = {}
        try:
            info = reader.metadata or {}
            meta = {k[1:] if k.startswith("/") else k: str(v) for k, v in info.items()}
        except Exception:
            meta = {}
        out.append({"path": path, "ok": True, "pages": pages, "meta": meta})
    except Exception as exc:
        out.append({"path": path, "ok": False, "error": str(exc), "pages": []})
print(json.dumps(out))
`;

/**
 * Extract per-page text for a batch of PDFs.
 *
 * Batched because process startup dominates for 117 small files.
 */
export function extractPdfBatch(paths) {
  const raw = execFileSync("python3", ["-c", PY_EXTRACT, ...paths], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return JSON.parse(raw).map((entry) => ({
    ...entry,
    pages: entry.pages.map(normaliseText),
  }));
}

/** Collapse a page's text to single-spaced lines, dropping empties. */
export function toLines(pageText) {
  return pageText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
