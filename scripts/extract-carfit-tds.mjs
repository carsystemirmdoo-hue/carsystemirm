#!/usr/bin/env node
/**
 * Phase 5 — C.A.R.FIT technical extraction from the acquired TDS corpus.
 *
 * The grammar was surveyed before this parser was written and it is not the
 * Carsystem/Vosschemie grammar. Two things stand out:
 *
 *  1. The sheets are bilingual. A file named `…_DE_de.pdf` frequently carries
 *     English section headings (APPLICATION, TECHNICAL DATA, SUBSTRATES)
 *     alongside German ones (ANWENDUNG, TECHNISCHE DATEN). Language is
 *     therefore decided from content, not from the file name — the file name
 *     said 108 German and 1 English, which the content does not support.
 *
 *  2. Values live in two shapes: `Label: value` inline, and a TECHNICAL DATA
 *     block where the label and value are separated by run of spaces or land on
 *     consecutive lines.
 *
 * Conditions, ranges, units and polarity are preserved exactly as in the
 * Carsystem pipeline: "Flash-off between layers: 5 – 10 min" keeps both bounds,
 * and a substrate sentence keeps its qualifier.
 *
 * Output: data/knowledge/carfit-tds-claims.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { extractPdfBatch } from "./lib/rm-pdf-text.mjs";

const documents = JSON.parse(readFileSync("data/knowledge/carfit-documents.generated.json", "utf8"));

/**
 * Phase 2 association. The extraction itself is unchanged — the same text
 * produces the same values — but which product, component and article numbers a
 * sheet belongs to now comes from the resolution step rather than from the
 * page-link/file-name guess made during acquisition.
 *
 * Documents that do not count as evidence (duplicates, unreadable scans,
 * catalogue-only identities) are excluded here, so a product cannot appear to
 * hold technical data that nobody can read.
 */
const resolutionPath = "data/knowledge/carfit-document-resolution.generated.json";
const resolutionByFile = new Map();
if (existsSync(resolutionPath)) {
  for (const entry of JSON.parse(readFileSync(resolutionPath, "utf8")).resolutions) {
    resolutionByFile.set(entry.fileName, entry);
  }
}
const generatedAt = new Date().toISOString();
const TEXT_CACHE = ".cache/carfit/tds-text.json";

const sheets = documents.documents.filter(
  (entry) => entry.documentType === "tds" && entry.localPath && !entry.error,
);

/** Cache is a speed-up, not an input: rebuilt from the staged PDFs when absent. */
function buildCache() {
  const byPath = new Map();
  const BATCH = 40;
  const present = sheets.filter((entry) => existsSync(entry.localPath));
  for (let index = 0; index < present.length; index += BATCH) {
    const slice = present.slice(index, index + BATCH);
    for (const result of extractPdfBatch(slice.map((entry) => entry.localPath))) {
      byPath.set(result.path, result);
    }
  }
  return sheets.map((entry) => {
    const result = byPath.get(entry.localPath);
    return { ...entry, ok: result?.ok !== false, pages: result?.pages ?? [] };
  });
}

let docs;
if (existsSync(TEXT_CACHE)) {
  docs = JSON.parse(readFileSync(TEXT_CACHE, "utf8"));
} else {
  docs = buildCache();
  mkdirSync(path.dirname(TEXT_CACHE), { recursive: true });
  writeFileSync(TEXT_CACHE, JSON.stringify(docs));
}

/* -------------------------------------------------------------------------- */
/* Sections — both languages                                                  */
/* -------------------------------------------------------------------------- */

const SECTION_NAMES = [
  "DESCRIPTION", "BESCHREIBUNG", "CHARACTERISTICS", "EIGENSCHAFTEN",
  "APPLICATION", "ANWENDUNG", "VERARBEITUNG",
  "SUBSTRATES", "SUBSTRATE PRETREATMENT", "OBERFLÄCHENBEHANDLUNG", "UNTERGRUND",
  "TECHNICAL DATA", "TECHNISCHE DATEN",
  "FURTHER TREATMENT", "WEITERE BEHANDLUNG",
  "STORAGE", "AUFBEWAHRUNG", "LAGERUNG",
  "SAFETY", "SICHERHEITSHINWEISE", "PRODUCT DESCRIPTION", "PRODUKTBESCHREIBUNG",
];

const sectionPattern = new RegExp(
  `^\\s*(${SECTION_NAMES.map((name) => name.replace(/ /g, "\\s+")).join("|")})\\s*:?\\s*$`,
  "i",
);

function splitSections(lines) {
  const sections = [];
  let current = { heading: "(lead)", lines: [] };
  for (const line of lines) {
    const match = sectionPattern.exec(line);
    if (match) {
      if (current.lines.length) sections.push(current);
      current = { heading: match[1].toUpperCase().replace(/\s+/g, " "), lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.length) sections.push(current);
  return sections;
}

/* -------------------------------------------------------------------------- */
/* Field typing                                                               */
/* -------------------------------------------------------------------------- */

const LABEL_MAP = [
  { re: /^v\.?o\.?c\.?/i, field: "voc" },
  { re: /^(eu[- ]?(grenzwert|limit)|grenzwert)/i, field: "vocRegulation" },
  { re: /^(zwischenablüftzeit|flash[- ]?off)/i, field: "flashOffTime" },
  { re: /^(topfzeit|pot life)/i, field: "potLife" },
  { re: /^(mischverhältnis|mixing ratio)/i, field: "mixingRatio" },
  { re: /^(verbrauch|consumption|efficiency|ergiebigkeit)/i, field: "coverage" },
  { re: /^(trockenzeit|drying|dust dry|dry to sand|staubtrocken)/i, field: "dryingTime" },
  { re: /^(schleifen nach|sand after|schleifbar)/i, field: "sandability" },
  { re: /^(düse|nozzle|spritzdüse)/i, field: "nozzleSize" },
  { re: /^(inlet pressure|luftdruck|spritzdruck)/i, field: "sprayPressure" },
  { re: /^(schichtdicke|film thickness|trockenschichtdicke)/i, field: "filmThickness" },
  { re: /^(lagerung|storage|shelf life|haltbarkeit|lagerzeit)/i, field: "shelfLife" },
  { re: /^(dichte|density)/i, field: "density" },
  { re: /^(farbe|colour|color|colourname)/i, field: "colour" },
  { re: /^(basis|base|bindemittel)/i, field: "composition" },
  { re: /^(flammpunkt|flash point)/i, field: "flashPoint" },
  { re: /^(glanzgrad|gloss)/i, field: "gloss" },
  { re: /^(viskosität|viscosity)/i, field: "viscosity" },
  { re: /^(temperatur|working temperature|verarbeitungstemperatur)/i, field: "processingTemperature" },
  { re: /^(untergrund|substrate|surfaces|oberfläche)/i, field: "substrate" },
];

const typeOf = (label) => LABEL_MAP.find((entry) => entry.re.test(label.trim()))?.field;

/**
 * A colon-free `<known label> <value>` line, e.g. "Farbe Grau". Built from the
 * same vocabulary as LABEL_MAP so the pattern can never widen accidentally.
 */
const KNOWN_LABEL_WORDS = [
  "Farbe", "Colour", "Color", "Dichte", "Density", "Basis", "Base",
  "Flammpunkt", "Flash point", "Viskosität", "Viscosity", "Glanzgrad", "Gloss",
  "Topfzeit", "Pot life", "Verbrauch", "Consumption", "Mischverhältnis",
  "Mixing ratio", "Trockenzeit", "Lagerung", "Storage", "Haltbarkeit",
  "Schichtdicke", "Trockenschichtdicke", "Düsengröße", "Nozzle",
];
const KNOWN_LABEL_RE = new RegExp(
  `^(${KNOWN_LABEL_WORDS.map((word) => word.replace(/ /g, "\\s+")).join("|")})\\s+(\\S.{0,120})$`,
  "i",
);

/* -------------------------------------------------------------------------- */
/* Value parsing — conditions, ranges, polarity                               */
/* -------------------------------------------------------------------------- */

const UNIT_RE =
  /(g\s*\/\s*l|g\s*\/\s*cm³|µm|μm|mPa\s*s|°C|bar|min\.?|Std\.?|hours?|Stunden|Monate|Jahre?|mm|cm|ml|kg|%|\bl\b)/i;
const QUALIFIER_RE = /(ca\.|approx\.?|about|bis zu|up to|bis|min\.|mind\.|max\.|>|<|≥|≤|±)/i;
const NEGATION_RE =
  /\b(nicht|kein|keine|keinen|ungeeignet|not suitable|do not|never|ohne|without|frei von|avoid|vermeiden)\b/i;
const RESTRICTION_RE =
  /\b(nicht geeignet|nicht für|nicht auf|ungeeignet|not suitable|do not (use|apply)|never apply)\b/i;

function parseValue(raw) {
  const text = String(raw).trim();
  const conditionMatch = /\(([^)]{2,90})\)\s*$/.exec(text);
  const condition = conditionMatch ? conditionMatch[1].trim() : undefined;
  const withoutCondition = conditionMatch ? text.slice(0, conditionMatch.index).trim() : text;

  const numeric = [...withoutCondition.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((match) =>
    Number(match[0].replace(",", ".")),
  );
  const isRange = /\d\s*[-–—]\s*\d|\bbis\b|\bto\b/i.test(withoutCondition) && numeric.length >= 2;

  return {
    value: withoutCondition,
    condition,
    unit: UNIT_RE.exec(withoutCondition)?.[1]?.replace(/\s+/g, ""),
    qualifier: QUALIFIER_RE.exec(withoutCondition)?.[1],
    range: isRange ? { min: Math.min(...numeric), max: Math.max(...numeric) } : undefined,
    negative: NEGATION_RE.test(text),
    restriction: RESTRICTION_RE.test(text),
  };
}

/** Content-based language detection; the file name is not trusted. */
function detectLanguage(text) {
  const german = (text.match(/\b(und|der|die|das|mit|für|nicht|Trocknung|Untergrund|Verarbeitung)\b/gi) ?? []).length;
  const english = (text.match(/\b(and|the|with|for|not|drying|substrate|application|surface)\b/gi) ?? []).length;
  if (german > english * 1.3) return "de";
  if (english > german * 1.3) return "en";
  return "mixed";
}

const SKIP_LABEL = /^(tel|fax|e-?mail|www|seite|page|stand|datum|art\.?-?nr|achtung|note|hinweis)/i;

/* -------------------------------------------------------------------------- */

const records = [];

for (const document of docs) {
  const claims = [];
  const fullText = (document.pages ?? []).join("\n");
  const language = detectLanguage(fullText);

  (document.pages ?? []).forEach((pageText, pageIndex) => {
    const lines = pageText.split("\n").map((line) => line.replace(/\s+$/, "")).filter((line) => line.trim());

    for (const section of splitSections(lines)) {
      for (let index = 0; index < section.lines.length; index += 1) {
        const line = section.lines[index].trim();

        // Inline `Label: value`, or a two-column row separated by a run of
        // spaces, or a label whose value sits on the following line.
        let label;
        let rawValue;
        let excerpt = line;

        const inline = /^([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9 .,%°&\/()\-]{2,40}?):\s*(\S.{0,120})$/.exec(line);
        const columnar = /^([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9 .,%°&\/()\-]{2,40}?)\s{3,}(\S.{0,120})$/.exec(line);
        const wrapped = /^([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9 .,%°&\/()\-]{2,40}?):\s*$/.exec(line);

        /**
         * The sheets are laid out in magazine columns, and the flattener emits
         * "Farbe Grau" and "Dichte 1648 g/L (Füller)" with a single space and
         * no colon. Splitting on any single space would turn every prose line
         * into a claim, so this is restricted to the controlled label
         * vocabulary — a line only qualifies if its first words are a label
         * this parser already knows.
         */
        const bare = KNOWN_LABEL_RE.exec(line);

        if (inline) {
          [, label, rawValue] = inline;
        } else if (columnar) {
          [, label, rawValue] = columnar;
        } else if (bare) {
          [, label, rawValue] = bare;
        } else if (wrapped) {
          const next = section.lines[index + 1]?.trim();
          if (!next || /:$/.test(next) || next.length > 120) continue;
          label = wrapped[1];
          rawValue = next;
          excerpt = `${line} ${next}`;
          index += 1;
        } else {
          continue;
        }

        label = label.trim();
        if (SKIP_LABEL.test(label) || !/[a-zäöüß]/i.test(label)) continue;

        const parsed = parseValue(rawValue);
        const field = typeOf(label);

        claims.push({
          field: field ?? "otherSpecification",
          sourceLabel: label,
          value: parsed.value,
          unit: parsed.unit,
          qualifier: parsed.qualifier,
          condition: parsed.condition,
          range: parsed.range,
          negative: parsed.negative,
          restriction: parsed.restriction,
          section: section.heading,
          page: pageIndex + 1,
          excerpt: excerpt.trim().slice(0, 200),
          sourceType: "manufacturer-technical-document",
          documentFileName: document.fileName,
          documentSha256: document.sha256,
          documentSourceUrl: document.sourceUrl,
          status: "machine-extracted",
          extractionConfidence: field ? "high" : "medium",
        });
      }

      // Narrative restrictions carry meaning that no label/value pair holds.
      if (/SUBSTRATE|UNTERGRUND|OBERFLÄCHEN|APPLICATION|ANWENDUNG/i.test(section.heading)) {
        for (const line of section.lines) {
          if (!RESTRICTION_RE.test(line) || line.length < 12) continue;
          const page = (document.pages ?? []).findIndex((text) => text.includes(line.trim()));
          claims.push({
            field: "restriction",
            sourceLabel: section.heading,
            value: line.trim().slice(0, 200),
            negative: true,
            restriction: true,
            section: section.heading,
            page: page >= 0 ? page + 1 : 1,
            excerpt: line.trim().slice(0, 200),
            sourceType: "manufacturer-technical-document",
            documentFileName: document.fileName,
            documentSha256: document.sha256,
            documentSourceUrl: document.sourceUrl,
            status: "machine-extracted",
            extractionConfidence: "medium",
          });
        }
      }
    }
  });

  const resolution = resolutionByFile.get(document.fileName);

  records.push({
    documentFileName: document.fileName,
    documentSha256: document.sha256,
    documentSourceUrl: document.sourceUrl,
    languageFromFileName: document.language,
    languageFromContent: language,
    pageCount: (document.pages ?? []).length,
    textLength: fullText.length,
    resolutionState: resolution?.state,
    resolutionConfidence: resolution?.confidence,
    // Claims stay scoped to the component the document is about. A hardener
    // sheet must not lend its values to the product it hardens.
    component: resolution?.component,
    countsAsEvidence: resolution ? resolution.countsAsEvidence : false,
    appliesToProducts: resolution
      ? resolution.countsAsEvidence
        ? resolution.products.map((product) => product.slug)
        : []
      : (document.appliesToProducts ?? []),
    appliesToArticleNumbers: resolution?.articleNumbers?.length
      ? resolution.articleNumbers
      : (document.appliesToArticleNumbers ?? []),
    claims,
  });
}

const allClaims = records.flatMap((record) => record.claims);
const byField = {};
for (const claim of allClaims) byField[claim.field] = (byField[claim.field] ?? 0) + 1;

const summary = {
  generatedAt,
  brand: "C.A.R.FIT",
  manufacturer: "August Handel GmbH",
  sourceType: "manufacturer-technical-document",
  documentsProcessed: records.length,
  documentsWithClaims: records.filter((record) => record.claims.length).length,
  documentsWithoutClaims: records.filter((record) => !record.claims.length).length,
  totalClaims: allClaims.length,
  typedClaims: allClaims.filter((claim) => claim.field !== "otherSpecification").length,
  byField,
  withCondition: allClaims.filter((claim) => claim.condition).length,
  withRange: allClaims.filter((claim) => claim.range).length,
  withUnit: allClaims.filter((claim) => claim.unit).length,
  withQualifier: allClaims.filter((claim) => claim.qualifier).length,
  negative: allClaims.filter((claim) => claim.negative).length,
  restrictions: allClaims.filter((claim) => claim.restriction).length,
  withPageEvidence: allClaims.filter((claim) => typeof claim.page === "number").length,
  distinctSourceLabels: new Set(allClaims.map((claim) => claim.sourceLabel)).size,
  documentsCountingAsEvidence: records.filter((record) => record.countsAsEvidence).length,
  componentScopedDocuments: records.filter((record) => record.component).length,
  productsWithTdsClaims: new Set(
    records.filter((record) => record.claims.length).flatMap((record) => record.appliesToProducts),
  ).size,
  // The file name claimed 108/1; the content does not agree, and that gap is
  // reported rather than smoothed over.
  languageFromFileName: records.reduce((counts, record) => {
    counts[record.languageFromFileName] = (counts[record.languageFromFileName] ?? 0) + 1;
    return counts;
  }, {}),
  languageFromContent: records.reduce((counts, record) => {
    counts[record.languageFromContent] = (counts[record.languageFromContent] ?? 0) + 1;
    return counts;
  }, {}),
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carfit-tds-claims.generated.json",
  `${JSON.stringify({ summary, records }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
