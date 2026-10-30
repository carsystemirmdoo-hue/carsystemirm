/**
 * Spisak slika čije pravo prikaza nije potvrđeno, za stranice „Sistemi i programi“.
 *
 * Izvor je evidencija prava `data/catalog/image-supply/IMAGE_RIGHTS_REVIEW.csv`: svaki red je
 * slika koja čeka potvrdu. Stranice sistema umesto takve slike prikazuju neutralno polje.
 * `node scripts/sistemi/sync-image-rights.mjs` upisuje spisak; `--check` samo proverava.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CSV = path.join(ROOT, "data/catalog/image-supply/IMAGE_RIGHTS_REVIEW.csv");
const OUT = path.join(ROOT, "content/sistemi/slike-bez-potvrde-prava.json");

/** Red CSV-a sa poljima pod navodnicima (RFC 4180, bez prelamanja reda u polju). */
function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }
  cells.push(cell);
  return cells;
}

export function pendingImageIds(csvText) {
  const [header, ...lines] = csvText.trim().split(/\r?\n/);
  const columns = splitCsvLine(header);
  const idIndex = columns.indexOf("image_id");
  const statusIndex = columns.indexOf("rights_status");
  if (idIndex < 0 || statusIndex < 0) throw new Error("IMAGE_RIGHTS_REVIEW.csv: nema kolone image_id ili rights_status");
  return lines
    .map((line) => splitCsvLine(line))
    .filter((cells) => cells[idIndex] && cells[statusIndex] && !cells[statusIndex].startsWith("CONFIRMED"))
    .map((cells) => cells[idIndex])
    .sort();
}

const expected = `${JSON.stringify({ izvor: "data/catalog/image-supply/IMAGE_RIGHTS_REVIEW.csv", slike: pendingImageIds(readFileSync(CSV, "utf8")) }, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== expected) {
    console.error("content/sistemi/slike-bez-potvrde-prava.json nije usklađen sa IMAGE_RIGHTS_REVIEW.csv — pokrenite node scripts/sistemi/sync-image-rights.mjs");
    process.exit(1);
  }
  console.log("slike-bez-potvrde-prava.json je usklađen");
} else {
  writeFileSync(OUT, expected);
  console.log(`upisano ${JSON.parse(expected).slike.length} slika`);
}
