/**
 * Čitanje činjenica iz R-M „Technical Information” (TDS) teksta.
 *
 * TDS je tabela „oznaka reda → vrednost”; pypdf je izvlači kao redove u kojima oznaka stoji
 * na početku reda, a nastavak vrednosti u sledećim redovima bez oznake. Čita se samo ono što
 * dokument doslovno kaže — nijedna vrednost se ne izvodi.
 */

/** Zvanična oznaka R-M proizvoda u tekstu: „H 2A14”, „PK 2P10”, „RA 050X”, „BC 020”, „HB 032”, „H 9000”. */
export const CODE_IN_TEXT = /\b(?:PK|PM|RA|HB|BC|DB|SC|GV|AB|A|B|C|D|H|P|R|T)\s?(?:\d[A-Z]\d{2,3}[A-Z]{0,2}|\d{3,4}[A-Z]{0,2})\b/g;

const FEPA_GRITS = new Set([40, 60, 80, 100, 120, 150, 180, 220, 240, 280, 320, 360, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000]);

export const normalizeCode = (code) =>
  String(code ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/^([A-Z]{1,2})\s?(\d)/, "$1 $2")
    .trim();

const LABELS = [
  "Application", "Key Features", "Remarks", "Mixing Ratio", "Hardener", "Thinner", "Additive", "Spray Viscosity", "Potlife", "Pot life",
  "Compliant Gravity Spray Gun", "HVLP Spray Gun", "Number of", "Flash Off", "Film thickness", "Drying", "Infrared", "Drying Remark", "Safety Advice", "Handling", "Cleaning", "Substrates", "Sanding",
];

export function parseTds(pages) {
  const text = pages.join("\n");
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const header = /Page 1 of (\d+) (\d{2})\/(\d{4})/.exec(text);

  /** Vrednost reda + nastavci do sledeće poznate oznake. */
  const valueOf = (label, { all = false } = {}) => {
    const found = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].startsWith(`${label} `) && lines[index] !== label) continue;
      const collected = [lines[index].slice(label.length).trim()];
      for (let next = index + 1; next < lines.length && collected.length < 8; next += 1) {
        if (LABELS.some((other) => lines[next].startsWith(other)) || /^Technical Information$|^Page \d+ of/.test(lines[next])) break;
        collected.push(lines[next]);
      }
      found.push(collected.filter(Boolean));
      if (!all) break;
    }
    return all ? found : found[0] ?? null;
  };

  // „P 400”, „P 1200” u TDS-u su granulacije brusnog papira (FEPA), ne R-M oznake proizvoda.
  const isGrit = (code) => /^P (\d{2,4})$/.test(code) && FEPA_GRITS.has(Number(code.slice(2)));
  const codesIn = (rows) => [...new Set((rows ?? []).flatMap((row) => [...row.matchAll(CODE_IN_TEXT)].map((match) => normalizeCode(match[0]))))].filter((code) => !isGrit(code));
  const hardenerRows = valueOf("Hardener");
  const thinnerRows = valueOf("Thinner");
  const ratio = (valueOf("Mixing Ratio", { all: true }) ?? []).map((rows) => rows[0]).find((row) => /\d\s*:\s*\d|\+\s*\d+\s*%/.test(row)) ?? null;
  const voc = /The EU limit value for this product \(product category: ([^)]+)\) in ready-for-use form\s+is max (\d+) g\/l\. The VOC content of this product is (\d+) g\/l/.exec(text.replace(/\n/g, " "));

  return {
    revision: header ? `${header[3]}-${header[2]}` : null,
    pageCount: header ? Number(header[1]) : pages.length,
    publisher: /by Surventis/.test(text) ? "Surventis" : /BASF/.test(text) ? "BASF" : null,
    subtitle: lines[2] ?? null,
    application: valueOf("Application")?.join(" ") ?? null,
    keyFeatures: valueOf("Key Features")?.join(" ") ?? null,
    mixingRatio: ratio,
    hardeners: codesIn(hardenerRows),
    hardenerRows: hardenerRows ?? [],
    thinners: codesIn(thinnerRows),
    thinnerRows: thinnerRows ?? [],
    potLife: valueOf("Potlife")?.[0] ?? valueOf("Pot life")?.[0] ?? null,
    flashOff: valueOf("Flash Off")?.join(" ") ?? null,
    filmThickness: valueOf("Film thickness")?.[0] ?? null,
    drying: lines.filter((line) => /^Drying at \d+°C/.test(line)),
    infrared: /Infrared[^\n]*\n(?:wave\)\n)?([^\n]*min[^\n]*)/.exec(text)?.[1] ?? null,
    nozzle: /Nozzle Size ([^\n]+)/.exec(text)?.[1] ?? null,
    voc: voc ? { category: voc[1], limit: Number(voc[2]), content: Number(voc[3]) } : null,
    // Sve R-M oznake koje dokument pominje (sistemski odnosi, čistači, aditivi).
    mentionedCodes: codesIn(lines),
  };
}
