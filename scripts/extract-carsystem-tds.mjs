#!/usr/bin/env node
/**
 * Carsystem Phase 2 — technical extraction from the 243 acquired TDS documents.
 *
 * The grammar was surveyed before this parser was written, and it is not the
 * R-M/baslac grammar. Three Vosschemie templates are in use:
 *
 *   A (older)  UPPERCASE headings — CHARAKTERISTIK, EINSATZGEBIET,
 *              PRODUKTANGABEN, VERARBEITUNG, SICHERHEITSHINWEISE
 *   B (newer)  Title-case headings with ∙ bullets — Beschreibung,
 *              Einsatzgebiet, Verarbeitung, Produktangaben
 *   C (tools)  Two-column PRODUKTANGABEN tables, where the label and its value
 *              land on separate lines ("Max. Arbeitsdruck:" / "6,3 bar")
 *
 * The technical payload is a block of `Label: value` pairs inside
 * PRODUKTANGABEN / Materialdaten / Technische Daten. A survey found **552
 * distinct labels** across the corpus, spanning abrasives (Kornart, Körnungen,
 * Lochung), masking (Träger, Gesamtdicke, Breiten), paint (V.O.C., Düsengröße,
 * Trockenschichtdicke), pneumatic tools (Luftverbrauch, Arbeitsdruck) and more.
 *
 * So extraction is generic-first: every label/value pair is captured verbatim,
 * then *known* labels are additionally normalised into typed fields. A fixed
 * schema would have discarded most of the corpus, and forcing paint fields onto
 * a sanding disc would produce noise.
 *
 * Conditions and polarity are preserved verbatim. "Max. Wärmestand: 80 °C
 * (mind. 1 h senkrecht)" keeps its duration condition; reducing it to
 * "temperature resistance: 80 °C" would overstate the product.
 *
 * Output: data/knowledge/carsystem-tds-claims.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { extractPdfBatch } from "./lib/rm-pdf-text.mjs";

/**
 * Extracting text from 242 PDFs takes about a minute, so it is cached — but the
 * cache is a speed-up, not an input. It is rebuilt from the acquired documents
 * whenever it is missing, so the pipeline is reproducible from the repository
 * alone.
 */
const TEXT_CACHE = ".cache/carsystem/tds-text.json";

const catalog = JSON.parse(
  readFileSync("data/knowledge/carsystem-catalog.generated.json", "utf8"),
);
const documentManifest = JSON.parse(
  readFileSync("data/knowledge/carsystem-documents.generated.json", "utf8"),
);

function buildTextCache() {
  // One entry per distinct sheet; the many-to-many fan-out happens later.
  const seen = new Set();
  const sheets = documentManifest.documents.filter((entry) => {
    if (entry.documentType !== "tds" || entry.error || !entry.sha256) return false;
    if (seen.has(entry.sha256)) return false;
    seen.add(entry.sha256);
    return existsSync(entry.localPath);
  });

  const byPath = new Map();
  const BATCH = 40;
  for (let index = 0; index < sheets.length; index += BATCH) {
    const slice = sheets.slice(index, index + BATCH);
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
  docs = buildTextCache();
  mkdirSync(path.dirname(TEXT_CACHE), { recursive: true });
  writeFileSync(TEXT_CACHE, JSON.stringify(docs));
}

const generatedAt = new Date().toISOString();
const productBySlug = new Map(catalog.products.map((product) => [product.slug, product]));

/** Every product/article a given TDS hash serves (many-to-many). */
const usersByHash = new Map();
for (const entry of documentManifest.documents) {
  if (entry.documentType !== "tds" || entry.error || !entry.sha256) continue;
  const bucket = usersByHash.get(entry.sha256) ?? [];
  bucket.push(entry);
  usersByHash.set(entry.sha256, bucket);
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

const SECTION_NAMES = [
  "CHARAKTERISTIK", "EINSATZGEBIET", "PRODUKTANGABEN", "VERARBEITUNG",
  "SICHERHEITSHINWEISE", "MATERIALDATEN", "HINWEISE", "HINWEIS", "VORTEILE",
  "UNTERGRUND", "ANWENDUNG", "DOSIERUNG", "SCHLEIFBARKEIT", "TOPFZEIT",
  "AUFTRAG", "TROCKENZEIT", "MISCHUNGSVERHÄLTNIS", "ÜBERARBEITUNG", "LAGERUNG",
  "REAKTIONSTEMPERATUR", "SPRITZVISKOSITÄT", "BESCHREIBUNG", "TECHNISCHE DATEN",
  "LIEFERFORM", "ZUSAMMENSETZUNG", "GEBINDE", "REINIGUNG",
];

const sectionPattern = new RegExp(
  `^\\s*(${SECTION_NAMES.map((name) => name.replace(/ /g, "\\s+")).join("|")})\\s*:?\\s*$`,
  "i",
);

/** Split a document's lines into labelled sections, tolerating both templates. */
function splitSections(lines) {
  const sections = [];
  let current = { heading: "(uvod)", lines: [], startLine: 0 };
  lines.forEach((line, index) => {
    const match = sectionPattern.exec(line);
    if (match) {
      if (current.lines.length) sections.push(current);
      current = { heading: match[1].toUpperCase().replace(/\s+/g, " "), lines: [], startLine: index };
      return;
    }
    current.lines.push(line);
  });
  if (current.lines.length) sections.push(current);
  return sections;
}

/* -------------------------------------------------------------------------- */
/* Label normalisation                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Known labels mapped to typed fields, with the categories they make sense for.
 *
 * Anything not listed still gets captured as a raw `Label: value` claim — the
 * map only decides which pairs additionally receive a typed field name.
 */
const LABEL_MAP = [
  // Abrasives
  { re: /^kornart$/i, field: "abrasiveGrainType", categories: ["schleifen"] },
  { re: /^körnung(en)?$/i, field: "abrasiveGrit", categories: ["schleifen"] },
  { re: /^lochung$/i, field: "holePattern", categories: ["schleifen"] },
  { re: /^(träger|trägermaterial)$/i, field: "backingMaterial", categories: ["*"] },
  // Dimensions / physical
  { re: /^(maße|abmessung(en)?|breiten|größe)$/i, field: "dimensions", categories: ["*"] },
  { re: /^(dicke|gesamtdicke)$/i, field: "thickness", categories: ["*"] },
  { re: /^(gewicht|bruttogewicht|flächengewicht)$/i, field: "weight", categories: ["*"] },
  { re: /^(dichte|spez\.?\s*gewicht|spezifisches gewicht)/i, field: "density", categories: ["*"] },
  { re: /^(farbe|farbton)$/i, field: "colour", categories: ["*"] },
  { re: /^(form|konsistenz)$/i, field: "consistency", categories: ["*"] },
  { re: /^material$/i, field: "material", categories: ["*"] },
  // Temperature
  {
    re: /^(temperaturbeständigkeit|hitzebeständigkeit|wärmestand|max\.?\s*wärmestand|dauerwärmestand|kältebeständigkeit)/i,
    field: "temperatureResistance",
    categories: ["*"],
  },
  { re: /^(verarbeitungstemperatur|reaktionstemperatur)/i, field: "processingTemperature", categories: ["*"] },
  // Paint / chemical
  { re: /^(v\.?o\.?c\.?|voc-gehalt)/i, field: "voc", categories: ["*"] },
  { re: /^düsengröße/i, field: "nozzleSize", categories: ["*"] },
  { re: /^(luftdruck|spritzdruck)/i, field: "sprayPressure", categories: ["*"] },
  { re: /^(trockenschichtdicke|schichtdicke)/i, field: "filmThickness", categories: ["*"] },
  { re: /^(mischungsverhältnis|mischverhältnis)/i, field: "mixingRatio", categories: ["*"] },
  { re: /^(topfzeit|verarbeitungszeit)/i, field: "potLife", categories: ["*"] },
  { re: /^(trockenzeit|trocknungszeit|durchtrocknung)/i, field: "dryingTime", categories: ["*"] },
  { re: /^(schleifbar|schleifbarkeit)/i, field: "sandability", categories: ["*"] },
  { re: /^(überarbeitung|überlackierbar)/i, field: "overcoating", categories: ["*"] },
  { re: /^(reichweite|ergiebigkeit|verbrauch)/i, field: "coverage", categories: ["*"] },
  { re: /^volumenfestkörper/i, field: "solidsByVolume", categories: ["*"] },
  { re: /^spritzviskosität/i, field: "sprayViscosity", categories: ["*"] },
  // Storage / packaging
  { re: /^(lagerstabilität|haltbarkeit|lagerzeit)/i, field: "shelfLife", categories: ["*"] },
  { re: /^(verpackung|gebinde|lieferform)/i, field: "packaging", categories: ["*"] },
  // Other
  { re: /^geruch$/i, field: "odour", categories: ["*"] },
  { re: /^zugfestigkeit/i, field: "tensileStrength", categories: ["*"] },
  { re: /^(basis|zusammensetzung)/i, field: "composition", categories: ["*"] },
];

function normaliseLabel(label, category) {
  for (const entry of LABEL_MAP) {
    if (!entry.re.test(label.trim())) continue;
    if (!entry.categories.includes("*") && !entry.categories.includes(category)) continue;
    return entry.field;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Value parsing — conditions and polarity preserved                          */
/* -------------------------------------------------------------------------- */

const UNIT_RE =
  /(°\s*C|°\s*F|g\s*\/\s*l|gr\s*\/\s*ltr|g\s*\/\s*cm³|kg\s*\/\s*l|µm|μm|mm|cm|m²\s*\/\s*l|m²|bar|min\.?|Min\.?|Std\.?|h\b|Monate|Stück|%|N\/mm²|g\b|kg\b)/;

/** Words that make a statement negative; polarity must survive extraction. */
const NEGATION_RE =
  /\b(nicht|kein|keine|keinen|ungeeignet|unverträglich|darf nicht|vermeiden|niemals)\b/i;

/**
 * Split a value into its measurement and its condition.
 *
 * "80 °C (mind. 1 h senkrecht)" → value "80 °C", condition "mind. 1 h senkrecht".
 * Dropping the parenthetical would turn a conditional limit into an absolute
 * one, which overstates what the manufacturer guarantees.
 */
function parseValue(raw) {
  const text = raw.trim();
  const conditionMatch = /\(([^)]{2,90})\)\s*$/.exec(text);
  const condition = conditionMatch ? conditionMatch[1].trim() : undefined;
  const withoutCondition = conditionMatch
    ? text.slice(0, conditionMatch.index).trim()
    : text;

  // Qualifiers change meaning and are kept, not stripped.
  const qualifier =
    /\b(ca\.|circa|etwa|bis zu|bis|min\.|mind\.|max\.|mindestens|maximal|>|<|≥|≤|±)/i.exec(
      withoutCondition,
    )?.[1];

  const unit = UNIT_RE.exec(withoutCondition)?.[1]?.replace(/\s+/g, "");
  const numeric = [...withoutCondition.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) =>
    Number(m[0].replace(",", ".")),
  );
  const isRange = /\d\s*[-–]\s*\d/.test(withoutCondition) && numeric.length >= 2;

  return {
    value: withoutCondition,
    condition,
    qualifier,
    unit,
    // Ranges keep both bounds; collapsing to a midpoint would invent a number.
    range: isRange ? { min: Math.min(...numeric), max: Math.max(...numeric) } : undefined,
    negative: NEGATION_RE.test(text),
  };
}

/* -------------------------------------------------------------------------- */
/* Variant sub-blocks                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Some TDS carry several variant blocks under one heading — e.g. Antidröhn-
 * platten lists "SCHWARZ BITUMEN" and further grades, each with its own data.
 * A standalone ALL-CAPS line that is not a known section starts such a block.
 * Merging their values would attribute one grade's figures to another.
 */
function detectVariantBlock(line) {
  const text = line.trim();
  if (text.length < 3 || text.length > 40) return undefined;
  if (sectionPattern.test(text)) return undefined;
  if (!/^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9 .\-+/]{2,38}$/.test(text)) return undefined;
  if (/^(TECHNISCHES|CARSYSTEM|VOSSCHEMIE|COPYRIGHT|SEITE)/i.test(text)) return undefined;
  return text;
}

/* -------------------------------------------------------------------------- */
/* Extraction                                                                 */
/* -------------------------------------------------------------------------- */

const SKIP_LABEL =
  /^(telefon|telefax|fax|tel|e-?mail|www|seite|stand|copyright|internet|homepage|datum)/i;

const records = [];

for (const document of docs) {
  const product = productBySlug.get(document.productSlug);
  const category = document.category;
  const claims = [];

  document.pages.forEach((pageText, pageIndex) => {
    const lines = pageText.split("\n");
    const sections = splitSections(lines);

    for (const section of sections) {
      let variantBlock;

      for (let index = 0; index < section.lines.length; index += 1) {
        const line = section.lines[index];
        const maybeVariant = detectVariantBlock(line);
        if (maybeVariant) {
          variantBlock = maybeVariant;
          continue;
        }

        // Labels may be bullet-prefixed ("- Farbton: grün", "∙ Dicke: 1 mm").
        // Anchoring strictly at line start silently skipped whole documents.
        const match = /^\s*(?:[-–∙•*]\s*)?([A-ZÄÖÜa-zäöüß][A-Za-zÄÖÜäöüß0-9 .,%°&\/()-]{2,38}?):\s*(\S.{0,120})$/.exec(
          line,
        );

        /**
         * Third template: two-column PRODUKTANGABEN tables, where the extractor
         * emits the label and its value as separate lines —
         *
         *     Max. Arbeitsdruck:
         *     6,3 bar
         *
         * Requiring both on one line dropped these sheets entirely. The label
         * must contain a lowercase letter so that section headings written as
         * "ACHTUNG:" are not mistaken for one, and the following line must not
         * itself be a label or a heading.
         */
        const wrappedLabel = match
          ? undefined
          : /^\s*(?:[-–∙•*]\s*)?([A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9 .,%°&\/()-]{2,38}?):\s*$/.exec(line);

        let rawLabel;
        let rawValue;
        let excerpt;

        if (match) {
          rawLabel = match[1].trim();
          rawValue = match[2];
          excerpt = line.trim().slice(0, 160);
        } else if (wrappedLabel && /[a-zäöüß]/.test(wrappedLabel[1])) {
          const next = section.lines[index + 1]?.trim();
          const usable =
            next &&
            next.length <= 120 &&
            !/:\s*$/.test(next) &&
            !/^[A-ZÄÖÜ\s.-]{4,}$/.test(next) &&
            !detectVariantBlock(next);
          if (!usable) continue;
          rawLabel = wrappedLabel[1].trim();
          rawValue = next;
          // The excerpt keeps both lines, so the expert sees the pair the value
          // was read from rather than a bare number.
          excerpt = `${line.trim()} ${next}`.slice(0, 160);
          index += 1;
        } else {
          continue;
        }

        const label = rawLabel;
        if (SKIP_LABEL.test(label)) continue;

        const parsed = parseValue(rawValue);
        const field = normaliseLabel(label, category);

        claims.push({
          field: field ?? "otherSpecification",
          sourceLabel: label,
          value: parsed.value,
          unit: parsed.unit,
          qualifier: parsed.qualifier,
          condition: parsed.condition,
          range: parsed.range,
          negative: parsed.negative,
          // Which variant block this value belongs to, when the sheet has more
          // than one. Values are never merged across blocks.
          variantBlock,
          section: section.heading,
          page: pageIndex + 1,
          excerpt,
          sourceType: "manufacturer-technical-document",
          documentFileName: document.fileName,
          documentSha256: document.sha256,
          documentRevision: document.revision,
          documentSourceUrl: document.sourceUrl,
          status: "machine-extracted",
          extractionConfidence: field ? "high" : "medium",
        });
      }
    }
  });

  /**
   * Substrate statements with polarity.
   *
   * Vosschemie writes these as bullets in CHARAKTERISTIK — "Nur für
   * Stahluntergründe" (steel ONLY) next to "Nicht für Zink- und
   * Aluminiumuntergründe" (NOT zinc/aluminium). Reading the substrate word
   * without its qualifier would invert the second line into support for
   * aluminium, which is the most damaging error available here.
   */
  const SUBSTRATE_WORDS = [
    { slug: "celik", re: /stahl\w*/i, label: "čelik" },
    { slug: "aluminijum", re: /alumini\w*/i, label: "aluminijum" },
    { slug: "pocinkovani-lim", re: /\bzink\w*|verzinkt\w*/i, label: "cink / pocinkovano" },
    { slug: "plastika", re: /kunststoff\w*/i, label: "plastika" },
    { slug: "drvo", re: /holz\w*/i, label: "drvo" },
    { slug: "stakloplastika", re: /gfk|glasfaser\w*|smc/i, label: "GFK / SMC" },
    { slug: "stari-lak", re: /altlack\w*/i, label: "stari lak" },
    { slug: "e-coat", re: /ktl\b|e-?coat/i, label: "KTL / e-coat" },
  ];

  document.pages.forEach((pageText, pageIndex) => {
    for (const rawLine of pageText.split("\n")) {
      const line = rawLine.replace(/\s+/g, " ").trim();
      if (line.length < 8 || line.length > 160) continue;
      const polarity = /\b(nicht|kein|keine|ungeeignet)\b/i.test(line)
        ? "not-suitable"
        : /\b(nur für|ausschließlich für|geeignet für|für)\b/i.test(line)
          ? "stated-suitable"
          : undefined;
      if (!polarity) continue;
      // Require an explicit substrate word, not merely a sentence about use.
      if (!/untergr|substrat|oberfläche|material/i.test(line) && !/\b(stahl|alumini|zink|kunststoff|holz)/i.test(line)) {
        continue;
      }
      for (const term of SUBSTRATE_WORDS) {
        if (!term.re.test(line)) continue;
        claims.push({
          field: "substrate",
          sourceLabel: "(tekst)",
          value: { substrate: term.slug, label: term.label, suitability: polarity },
          negative: polarity === "not-suitable",
          // "Nur für" is exclusive — it restricts as well as permits.
          exclusive: /\bnur für|ausschließlich für\b/i.test(line),
          section: "CHARAKTERISTIK / tekst",
          page: pageIndex + 1,
          excerpt: line.slice(0, 180),
          sourceType: "manufacturer-technical-document",
          documentFileName: document.fileName,
          documentSha256: document.sha256,
          documentRevision: document.revision,
          documentSourceUrl: document.sourceUrl,
          status: "machine-extracted",
          extractionConfidence: "medium",
        });
      }
    }
  });

  // Narrative negative statements outside label/value pairs. Scanned per page
  // so every claim carries page evidence, as the invariant requires.
  const negatives = [];
  document.pages.forEach((pageText, pageIndex) => {
    for (const match of pageText.matchAll(
      /([^.\n]{0,90}\b(?:nicht geeignet|nicht verwenden|ungeeignet|darf nicht|nicht beständig|nicht für|nur für|nicht auf)\b[^.\n]{0,90})/gi,
    )) {
      const sentence = match[1].replace(/\s+/g, " ").trim();
      if (sentence.length < 15) continue;
      if (negatives.some((entry) => entry.excerpt === sentence.slice(0, 200))) continue;
      negatives.push({
        field: "restriction",
        sourceLabel: "(tekst)",
        value: sentence,
        negative: true,
        section: "(tekst dokumenta)",
        page: pageIndex + 1,
        excerpt: sentence.slice(0, 200),
        sourceType: "manufacturer-technical-document",
        documentFileName: document.fileName,
        documentSha256: document.sha256,
        documentRevision: document.revision,
        documentSourceUrl: document.sourceUrl,
        status: "machine-extracted",
        extractionConfidence: "medium",
      });
    }
  });
  claims.push(...negatives.slice(0, 6));

  const users = usersByHash.get(document.sha256) ?? [];

  records.push({
    documentFileName: document.fileName,
    documentSha256: document.sha256,
    documentRevision: document.revision,
    documentSourceUrl: document.sourceUrl,
    pages: document.pages.length,
    category,
    // Many-to-many: one TDS may serve several products/articles.
    appliesToProducts: [...new Set(users.map((entry) => entry.productSlug))],
    appliesToArticleNumbers: [
      ...new Set(users.flatMap((entry) => productBySlug.get(entry.productSlug)?.articleNumbers ?? [])),
    ],
    productName: product?.officialName,
    claims,
  });
}

/* -- Templates -------------------------------------------------------------- */

const templateCounts = new Map();
for (const record of records) {
  const headings = [...new Set(record.claims.map((claim) => claim.section))]
    .filter((heading) => heading !== "(tekst dokumenta)")
    .sort()
    .join("|");
  const key = headings || "(bez sekcija)";
  templateCounts.set(key, (templateCounts.get(key) ?? 0) + 1);
}

const allClaims = records.flatMap((record) => record.claims);
const byField = {};
const byCategory = {};
for (const record of records) {
  byCategory[record.category] = (byCategory[record.category] ?? 0) + record.claims.length;
  for (const claim of record.claims) byField[claim.field] = (byField[claim.field] ?? 0) + 1;
}

const summary = {
  generatedAt,
  brand: "Carsystem",
  manufacturer: "Vosschemie GmbH",
  sourceType: "manufacturer-technical-document",
  documentsProcessed: records.length,
  documentsWithClaims: records.filter((record) => record.claims.length).length,
  documentsWithoutClaims: records.filter((record) => !record.claims.length).length,
  totalClaims: allClaims.length,
  typedClaims: allClaims.filter((claim) => claim.field !== "otherSpecification").length,
  untypedClaims: allClaims.filter((claim) => claim.field === "otherSpecification").length,
  claimsWithCondition: allClaims.filter((claim) => claim.condition).length,
  claimsWithQualifier: allClaims.filter((claim) => claim.qualifier).length,
  claimsWithRange: allClaims.filter((claim) => claim.range).length,
  claimsWithUnit: allClaims.filter((claim) => claim.unit).length,
  negativeClaims: allClaims.filter((claim) => claim.negative).length,
  claimsWithVariantBlock: allClaims.filter((claim) => claim.variantBlock).length,
  claimsWithPageEvidence: allClaims.filter((claim) => Number.isFinite(claim.page)).length,
  distinctSourceLabels: new Set(allClaims.map((claim) => claim.sourceLabel)).size,
  byField,
  byCategory,
  distinctTemplates: templateCounts.size,
  productsWithTdsEvidence: new Set(records.flatMap((record) => record.appliesToProducts)).size,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carsystem-tds-claims.generated.json",
  `${JSON.stringify({ summary, records }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
