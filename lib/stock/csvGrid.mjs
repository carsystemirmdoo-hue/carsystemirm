/**
 * CSV izvoz izveštaja → mreža ćelija (dok. 65). Ćelije ostaju TEKST — broj tumači
 * parser izveštaja (decimalni zarez/tačka, dvosmislene vrednosti).
 *
 * Kodni raspored: UTF-8 (sa ili bez BOM-a); ako bajtovi nisu ispravan UTF-8, BizniSoft
 * na Windows-u piše Windows-1250 (š, đ, č, ć, ž). Separator: onaj od `;`, tab i `,`
 * koji daje najviše kolona u prvim redovima izvan navodnika.
 */

export class CsvReadError extends Error {
  constructor(message) {
    super(message);
    this.name = "CsvReadError";
  }
}

export function decodeCsv(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (buf.includes(0)) throw new CsvReadError("Fajl nije tekstualni CSV.");
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, ""), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1250").decode(buf), encoding: "windows-1250" };
  }
}

function countOutsideQuotes(line, ch) {
  let n = 0;
  let q = false;
  for (const c of line) {
    if (c === '"') q = !q;
    else if (c === ch && !q) n++;
  }
  return n;
}

export function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 40);
  let best = ";";
  let bestScore = -1;
  for (const d of [";", "\t", ","]) {
    const score = lines.reduce((a, l) => a + countOutsideQuotes(l, d), 0);
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** @returns {{ rows: (string | null)[][], encoding: string, delimiter: string }} */
export function readCsvGrid(bytes) {
  const { text, encoding } = decodeCsv(bytes);
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let started = false;
  const pushCell = () => {
    row.push(cell.trim() === "" ? null : cell);
    cell = "";
    started = false;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
      continue;
    }
    if (c === '"' && !started) {
      quoted = true;
      started = true;
    } else if (c === delimiter) pushCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushCell();
      rows.push(row);
      row = [];
    } else {
      cell += c;
      started = true;
    }
  }
  if (quoted) throw new CsvReadError("CSV ima nezatvoren navodnik.");
  if (cell !== "" || row.length) {
    pushCell();
    rows.push(row);
  }
  return { rows, encoding, delimiter };
}
