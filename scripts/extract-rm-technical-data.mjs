#!/usr/bin/env node
/**
 * Phase 3, step 2 — technical extraction from R-M technical data sheets.
 *
 * EXTRACT — DO NOT INFER.
 *
 * Every value written by this script is matched against an explicit statement
 * in a source PDF, and carries the page number plus a short verbatim excerpt so
 * a reviewer can check it in seconds. Nothing is derived from product names,
 * categories, sibling products or general refinishing knowledge.
 *
 * Two rules shape the whole design:
 *
 *   1. Silence is UNKNOWN, never a default. A field absent from a sheet is
 *      simply absent; it is not inferred from a similar product.
 *   2. Ambiguity is preserved, not resolved. Where a value cannot be normalised
 *      without interpretation (most importantly the merged two-gun spray table),
 *      the structured value is left empty and the raw source wording is kept as
 *      `needs-review`.
 *
 * Every claim is emitted as `machine-extracted`. Nothing here is ever
 * `expert-verified` — that status is reserved for a human.
 *
 * Output: data/knowledge/rm-technical-extraction.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extractPdfBatch } from "./lib/rm-pdf-text.mjs";

const inventory = JSON.parse(
  readFileSync("docs/seo/RM_SOURCE_INVENTORY.json", "utf8"),
);
const rmData = JSON.parse(
  readFileSync("data/rm-imported-products.generated.json", "utf8"),
);
const products = rmData.products ?? [];

const eligible = inventory.documents.filter(
  (doc) => doc.isTds && doc.textExtractionReliable,
);

const extracted = extractPdfBatch(eligible.map((doc) => doc.filePath));
const pagesByPath = new Map(extracted.map((entry) => [entry.path, entry.pages]));

/* -------------------------------------------------------------------------- */
/* Product code index — for resolving referenced R-M codes to product slugs    */
/* -------------------------------------------------------------------------- */

const codeToSlug = new Map();
for (const product of products) {
  if (!product.productCode) continue;
  const normalised = product.productCode.replace(/\s+/g, " ").trim().toUpperCase();
  codeToSlug.set(normalised, product.slug);
  codeToSlug.set(normalised.replace(/\s+/g, ""), product.slug);
}

/** Resolve an R-M code such as "H 2A14" to a product slug, if we stock it. */
function resolveCode(code) {
  const key = code.replace(/\s+/g, " ").trim().toUpperCase();
  return codeToSlug.get(key) ?? codeToSlug.get(key.replace(/\s+/g, ""));
}

/**
 * R-M product codes as they appear in the sheets: one or two letters, a space,
 * then an alphanumeric body starting with a digit — "H 2A14", "HB 032",
 * "RA 050X", "P 5480".
 *
 * The space is required on purpose. Without it this also matches sanding grits
 * ("P400", "P600"), which would turn an abrasive spec into a phantom product
 * reference.
 */
const CODE_PATTERN = /\b([A-Z]{1,2}\s\d[0-9A-Z]{2,4})\b/g;

/* -------------------------------------------------------------------------- */
/* Substrate vocabulary — verbatim source wording only                        */
/* -------------------------------------------------------------------------- */

/**
 * Maps the exact phrases R-M uses to the Phase 2 substrate slugs.
 *
 * Deliberately literal. A phrase not in this table is recorded as an
 * unmapped substrate for expert review rather than guessed into the nearest
 * slug — that guess is exactly the kind of inference this phase forbids.
 */
const SUBSTRATE_PHRASES = [
  { match: /^sheet steel$/i, slugs: ["celik"] },
  { match: /^galvani[sz]ed sheet steel$/i, slugs: ["pocinkovani-lim"] },
  { match: /^alumini(?:um|a)$/i, slugs: ["aluminijum"] },
  { match: /^oem parts with e-?coat$/i, slugs: ["e-coat"] },
  { match: /^old paintwork$/i, slugs: ["stari-lak"] },
  { match: /^grp\s*[-/]\s*smc$/i, slugs: ["stakloplastika"] },
  { match: /^smc$/i, slugs: ["stakloplastika"] },
  {
    // A compound plastics listing. It names GRP-SMC too, so it maps to both
    // slugs; the verbatim wording is preserved on the claim either way.
    match: /pur-rim|pp-epdm|abs|pc-pbtp|ppo|rigid\s*pvc/i,
    slugs: ["plastika", "stakloplastika"],
  },
  { match: /^filler$/i, slugs: ["poliesterski-kit"] },
  { match: /^primer$/i, slugs: ["temeljna-boja"] },
];

function mapSubstratePhrase(phrase) {
  const cleaned = phrase.replace(/^[•\-•]\s*/, "").trim();
  if (!cleaned) return undefined;
  for (const entry of SUBSTRATE_PHRASES) {
    if (entry.match.test(cleaned)) {
      return { slugs: entry.slugs, sourceText: cleaned };
    }
  }
  return { slugs: [], sourceText: cleaned, unmapped: true };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Locate which 1-based page a matched index falls on. */
function pageOf(pages, absoluteIndex) {
  let offset = 0;
  for (let index = 0; index < pages.length; index += 1) {
    const end = offset + pages[index].length + 1;
    if (absoluteIndex < end) return index + 1;
    offset = end;
  }
  return pages.length;
}

/** Trim an excerpt to a short, reviewable snippet. */
function excerpt(text, limit = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit).trimEnd()}…`;
}

function makeClaim({ field, value, raw, section, page, doc, ambiguous, note }) {
  return {
    field,
    value,
    rawText: excerpt(raw),
    section,
    page,
    documentHref: doc.href,
    documentLabel: `R-M tehnički list — ${doc.productName}`,
    sourceType: "manufacturer-technical-document",
    // Factually what happened: a script read this out of a PDF. `Claim`'s
    // publication gate treats this as unpublishable, which is the point —
    // nothing here reaches a page until a human upgrades it.
    verificationStatus: "machine-extracted",
    extractionConfidence: ambiguous ? "low" : value === undefined ? "low" : "high",
    ambiguous: Boolean(ambiguous),
    note,
  };
}

/* -------------------------------------------------------------------------- */
/* Field extractors                                                           */
/* -------------------------------------------------------------------------- */

function extractSubstrates(text, pages, doc) {
  const header = /Product\s+(?:is\s+)?suitable\s+on\s*\n?/i.exec(text);
  if (!header) return undefined;

  const start = header.index + header[0].length;
  const rest = text.slice(start);
  const stop = rest.search(
    /\n(?:Mixing [Rr]atio|Spray Viscosity|Potlife|Application|Drying|Do not|Technical Information|Clean the surface)/,
  );
  const block = stop === -1 ? rest.slice(0, 500) : rest.slice(0, stop);

  // "If bare metal areas are primed, the product can be used on ..." is a
  // distinct, weaker statement than the unconditional list above it. Splitting
  // here is what preserves the requires-primer / suitable distinction.
  const conditionalMatch =
    /If\s+bare\s+metal\s+areas?\s+are\s+primed[^\n]*\n/i.exec(block);
  const directBlock = conditionalMatch
    ? block.slice(0, conditionalMatch.index)
    : block;
  const conditionalBlock = conditionalMatch
    ? block.slice(conditionalMatch.index + conditionalMatch[0].length)
    : "";

  const entries = [];
  const collect = (chunk, suitability, condition) => {
    for (const line of chunk.split("\n")) {
      const mapped = mapSubstratePhrase(line);
      if (!mapped) continue;
      if (/^(clean|do not|if |remarks|the material)/i.test(mapped.sourceText)) continue;
      entries.push({ ...mapped, suitability, condition });
    }
  };

  collect(directBlock, "suitable");
  if (conditionalBlock) {
    collect(
      conditionalBlock,
      "requires-primer",
      excerpt(conditionalMatch[0], 120),
    );
  }

  if (!entries.length) return undefined;

  return makeClaim({
    field: "substrates",
    value: entries,
    raw: block,
    section: "Handling — Product is suitable on",
    page: pageOf(pages, header.index),
    doc,
    ambiguous: entries.some((entry) => entry.unmapped),
    note: entries.some((entry) => entry.unmapped)
      ? "Sadrži formulaciju podloge koja nije u kontrolisanom rečniku."
      : undefined,
  });
}

function extractMixingRatio(text, pages, doc) {
  const match = /Mixing Ratio\s+(\d+(?::\d+)+(?:\s*\+\s*\d+\s*%)?)/.exec(text);
  const componentBlock = /Mixing Ratio\s*\n?([\s\S]{0,420}?)(?=\n(?:Spray Viscosity|Potlife|Application|Drying))/.exec(
    text,
  );

  const components = [];
  if (componentBlock) {
    const lineRe =
      /(Hardener|Thinner|Additive|Mixing Ratio)?\s*(\d+)\s*(?:%\s*by\s*volume|part\(s\)\s*by\s*vol)\s*([\s\S]{0,120}?)(?=\n\s*(?:Hardener|Thinner|Additive|Spray|Potlife|Mixing|$))/g;
    let lineMatch;
    while ((lineMatch = lineRe.exec(componentBlock[1])) !== null) {
      const role = (lineMatch[1] ?? "base").toLowerCase().replace("mixing ratio", "base");
      const body = lineMatch[3] ?? "";
      const codes = [...body.matchAll(CODE_PATTERN)].map((entry) => entry[1]);
      components.push({
        role: role === "base" ? "base" : role,
        proportion: Number(lineMatch[2]),
        codes: [...new Set(codes)],
        sourceText: excerpt(body, 90),
      });
    }
  }

  if (!match && !components.length) return undefined;

  return makeClaim({
    field: "mixingRatio",
    value: match
      ? { ratio: match[1].replace(/\s+/g, " ").trim(), components, basis: "volume" }
      : undefined,
    raw: componentBlock ? componentBlock[0] : match[0],
    section: "Mixing Ratio",
    page: pageOf(pages, (match ?? componentBlock).index),
    doc,
    ambiguous: !match,
    note: match
      ? undefined
      : "Sekcija postoji, ali nema eksplicitan odnos u obliku a:b — samo komponente.",
  });
}

function extractComponentProducts(text, pages, doc, label, field) {
  const re = new RegExp(
    `${label}\\s+(?:\\d+\\s*(?:%\\s*by\\s*volume|part\\(s\\)\\s*by\\s*vol)\\s*)?([\\s\\S]{0,240}?)(?=\\n\\s*(?:Hardener|Thinner|Additive|Spray Viscosity|Potlife|Application|Mixing|Drying|$))`,
  );
  const match = re.exec(text);
  if (!match) return undefined;

  const codes = [...new Set([...match[1].matchAll(CODE_PATTERN)].map((e) => e[1]))];
  const resolved = codes
    .map((code) => ({ code, productSlug: resolveCode(code) }))
    .filter((entry) => entry.productSlug);

  if (!codes.length) return undefined;

  return makeClaim({
    field,
    value: resolved.length ? resolved.map((entry) => entry.productSlug) : undefined,
    raw: `${label} ${match[1]}`,
    section: label,
    page: pageOf(pages, match.index),
    doc,
    ambiguous: resolved.length === 0,
    note:
      resolved.length === 0
        ? `Navedene šifre (${codes.join(", ")}) nisu u Carsystem katalogu.`
        : resolved.length < codes.length
          ? `Deo navedenih šifara nije u katalogu: ${codes.filter((c) => !resolveCode(c)).join(", ")}.`
          : undefined,
    });
}

function extractPotLife(text, pages, doc) {
  const match = /Potlife\s*(?:at\s*(\d+)\s*°C)?\s*([\d.,]+)\s*(min|h|hours?|days?)/i.exec(
    text,
  );
  if (!match) return undefined;
  const amount = Number(match[2].replace(",", "."));
  const unit = match[3].toLowerCase();
  const minutes =
    unit.startsWith("min") ? amount
    : unit.startsWith("h") ? amount * 60
    : unit.startsWith("day") ? amount * 1440
    : undefined;

  return makeClaim({
    field: "potLifeMinutes",
    value: Number.isFinite(minutes) ? minutes : undefined,
    raw: match[0],
    section: "Potlife",
    page: pageOf(pages, match.index),
    doc,
    ambiguous: !Number.isFinite(minutes),
    note: match[1] ? `Navedeno na ${match[1]}°C.` : "Temperatura nije navedena uz vrednost.",
  });
}

function extractSprayGun(text, pages, doc) {
  const nozzle = /Nozzle Size\s+([\d.,\s\-]+)/.exec(text);
  const pressure = /Pressure\s+([\d.,]+)\s*bar/.exec(text);
  if (!nozzle && !pressure) return undefined;

  const anchor = nozzle ?? pressure;

  // Two gun columns (Compliant Gravity + HVLP) collapse into one line during
  // text extraction, so "1.3 -1.4 1.3 -1.5" cannot be split back onto the right
  // gun without interpretation. Structured value withheld; raw text kept.
  if (doc.columnMergeRisk) {
    return makeClaim({
      field: "sprayGun",
      value: undefined,
      raw: `${nozzle ? nozzle[0] : ""} ${pressure ? pressure[0] : ""}`,
      section: "Application — spray gun",
      page: pageOf(pages, anchor.index),
      doc,
      ambiguous: true,
      note:
        "Dokument navodi dva tipa pištolja (Compliant Gravity i HVLP) čije se kolone spajaju pri ekstrakciji. Dodela vrednosti pištolju zahteva ručnu proveru.",
    });
  }

  const nozzleRange = nozzle
    ? /([\d.]+)\s*-\s*([\d.]+)/.exec(nozzle[1]) ?? /([\d.]+)/.exec(nozzle[1])
    : null;

  const value = {};
  if (nozzleRange) {
    value.nozzleMm = {
      min: Number(nozzleRange[1]),
      max: Number(nozzleRange[2] ?? nozzleRange[1]),
      unit: "mm",
    };
  }
  if (pressure) {
    const bar = Number(pressure[1].replace(",", "."));
    value.pressureBar = { min: bar, max: bar, unit: "bar" };
  }

  return makeClaim({
    field: "sprayGun",
    value: Object.keys(value).length ? value : undefined,
    raw: `${nozzle ? nozzle[0] : ""} ${pressure ? pressure[0] : ""}`,
    section: "Application — spray gun",
    page: pageOf(pages, anchor.index),
    doc,
    ambiguous: false,
  });
}

function extractCoats(text, pages, doc) {
  const match = /Number of\s*\n?\s*Coats\s*\n?([\s\S]{0,220}?)(?=\n(?:Flash Off|Film thickness|Remarks|Drying|Sanding|Technical Information|Please note))/.exec(
    text,
  );
  if (!match) return undefined;
  const body = match[1].replace(/\s+/g, " ").trim();
  if (!body) return undefined;

  return makeClaim({
    field: "coats",
    value: body,
    raw: body,
    section: "Number of Coats",
    page: pageOf(pages, match.index),
    doc,
    ambiguous: false,
  });
}

function extractFlashOff(text, pages, doc) {
  const match = /Flash Off at\s*\n?\s*(\d+)\s*°C\s*\n?([\s\S]{0,260}?)(?=\n(?:Film thickness|Remarks|Drying|Number of|Sanding|Technical Information|Please note))/.exec(
    text,
  );
  if (!match) return undefined;
  const body = match[2].replace(/\s+/g, " ").trim();
  if (!body) return undefined;

  // Only a bare "N min" is safe to normalise. Anything narrative ("until mat",
  // "no flash off before oven drying") stays as text — converting it to a
  // number would invent a parameter the sheet never states.
  const simple = /^(\d+)\s*min\b/.exec(body);

  return makeClaim({
    field: "flashOffMinutes",
    value: simple ? Number(simple[1]) : undefined,
    raw: body,
    section: `Flash Off at ${match[1]}°C`,
    page: pageOf(pages, match.index),
    doc,
    ambiguous: !simple,
    note: simple
      ? undefined
      : "Opisna vrednost, nije brojčana — normalizacija bi zahtevala tumačenje.",
  });
}

function extractFilmThickness(text, pages, doc) {
  const range = /Film thickness\s*(?:max\.?\s*)?([\d]+)\s*-\s*([\d]+)\s*[μµ]m/.exec(text);
  const single = /Film thickness\s*max\.?\s*([\d]+)\s*[μµ]m/.exec(text);
  const match = range ?? single;
  if (!match) return undefined;

  return makeClaim({
    field: "filmThicknessMicrons",
    value: range
      ? { min: Number(range[1]), max: Number(range[2]), unit: "µm" }
      : { min: 0, max: Number(single[1]), unit: "µm" },
    raw: match[0],
    section: "Film thickness",
    page: pageOf(pages, match.index),
    doc,
    ambiguous: false,
    note: range ? undefined : "Naveden je samo maksimum.",
  });
}

function extractDrying(text, pages, doc) {
  const entries = [];
  const dryRe = /Drying at\s*(\d+)\s*°C\s*([\d.,]+)\s*(min|h|hours?)/gi;
  let match;
  let firstIndex;
  while ((match = dryRe.exec(text)) !== null) {
    firstIndex ??= match.index;
    const amount = Number(match[2].replace(",", "."));
    const unit = match[3].toLowerCase();
    entries.push({
      temperatureC: Number(match[1]),
      minutes: unit.startsWith("h") ? amount * 60 : amount,
      stage: undefined,
      sourceText: match[0].replace(/\s+/g, " "),
    });
  }

  const infrared = /Infrared\s*(?:\(short\s*\n?\s*wave\))?\s*\n?\s*([\d.,]+)\s*min/i.exec(
    text,
  );
  if (infrared) {
    firstIndex ??= infrared.index;
    entries.push({
      temperatureC: undefined,
      minutes: Number(infrared[1].replace(",", ".")),
      stage: "Infracrveno (kratkotalasno)",
      sourceText: infrared[0].replace(/\s+/g, " "),
    });
  }

  if (!entries.length) return undefined;

  return makeClaim({
    field: "dryingProfile",
    value: entries,
    raw: entries.map((entry) => entry.sourceText).join(" | "),
    section: "Drying",
    page: pageOf(pages, firstIndex),
    doc,
    ambiguous: false,
  });
}

function extractSanding(text, pages, doc) {
  const match = /Sanding\s*\n?([\s\S]{0,320}?)(?=\n(?:Please note|Drying|Remarks|Technical Information|Safety Advice|$))/.exec(
    text,
  );
  if (!match) return undefined;
  const body = match[1].replace(/\s+/g, " ").trim();
  if (!body) return undefined;

  const grits = [...new Set([...body.matchAll(/P\s?(\d{3,4})/g)].map((e) => `P${e[1]}`))];
  const dry = /\bdry\b/i.test(body);
  const wet = /\bwet\b/i.test(body);

  return makeClaim({
    field: "sanding",
    value: grits.length
      ? { grits, method: dry && wet ? "both" : dry ? "dry" : wet ? "wet" : undefined }
      : undefined,
    raw: body,
    section: "Sanding",
    page: pageOf(pages, match.index),
    doc,
    ambiguous: !grits.length,
  });
}

function extractVoc(text, pages, doc) {
  const match = /VOC content of this product is\s*([\d.,]+)\s*g\/l/i.exec(text);
  if (!match) return undefined;
  return makeClaim({
    field: "vocGramsPerLitre",
    value: Number(match[1].replace(",", ".")),
    raw: match[0],
    section: "Safety Advice — VOC",
    page: pageOf(pages, match.index),
    doc,
    ambiguous: false,
  });
}

/** Boilerplate disclaimer sentences that must never be read as warnings. */
const DISCLAIMER = /do not relieve|do not imply|do not constitute|does not constitute/i;

function extractWarnings(text, pages, doc) {
  const pattern =
    /((?:not suitable|do not|must not|never|unsuitable|avoid)[^\n.]{0,160}\.?)/gi;
  const hits = [];
  let match;
  let firstIndex;
  while ((match = pattern.exec(text)) !== null) {
    const sentence = match[1].replace(/\s+/g, " ").trim();
    if (DISCLAIMER.test(sentence)) continue;
    if (sentence.length < 12) continue;
    if (hits.some((hit) => hit.startsWith(sentence.slice(0, 40)))) continue;
    firstIndex ??= match.index;
    hits.push(sentence);
  }
  if (!hits.length) return undefined;

  return makeClaim({
    field: "warnings",
    value: hits,
    raw: hits.join(" | "),
    section: "Remarks / Handling",
    page: pageOf(pages, firstIndex),
    doc,
    ambiguous: false,
  });
}

function extractApplication(text, pages, doc) {
  const match = /^Application\s+([^\n]{10,300})/m.exec(text);
  if (!match) return undefined;
  return makeClaim({
    field: "applicationStatement",
    value: match[1].replace(/\s+/g, " ").trim(),
    raw: match[0],
    section: "Application",
    page: pageOf(pages, match.index),
    doc,
    ambiguous: false,
  });
}

/**
 * Explicit sequencing statements only.
 *
 * "Clean the surface with X before applying Y" names a real preceding product.
 * Nothing is derived from catalogue order or naming similarity.
 */
function extractSequencing(text, pages, doc) {
  const results = [];
  const beforeRe = /Clean the surface with\s+([^\n]{2,60}?)\s+before applying\s+([^\n.]{2,60})/gi;
  let match;
  while ((match = beforeRe.exec(text)) !== null) {
    results.push({
      relation: "preceded-by",
      targetText: match[1].trim(),
      contextText: excerpt(match[0], 160),
      page: pageOf(pages, match.index),
    });
  }

  const notOverRe = /Do not overcoat\s+([A-Z]{1,2}\s?\d{3,4}[A-Z]?)\s+directly with\s+([^\n.]{2,120})/gi;
  while ((match = notOverRe.exec(text)) !== null) {
    results.push({
      relation: "must-not-be-overcoated-with",
      targetText: match[2].trim(),
      contextText: excerpt(match[0], 180),
      page: pageOf(pages, match.index),
    });
  }

  if (!results.length) return undefined;

  return makeClaim({
    field: "sequencing",
    value: results,
    raw: results.map((entry) => entry.contextText).join(" | "),
    section: "Handling / Remarks",
    page: results[0].page,
    doc,
    ambiguous: false,
  });
}

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

const records = [];
for (const doc of eligible) {
  const pages = pagesByPath.get(doc.filePath) ?? [];
  const text = pages.join("\n");

  const claims = [
    extractApplication(text, pages, doc),
    extractSubstrates(text, pages, doc),
    extractMixingRatio(text, pages, doc),
    extractComponentProducts(text, pages, doc, "Hardener", "hardenerProductSlugs"),
    extractComponentProducts(text, pages, doc, "Thinner", "thinnerProductSlugs"),
    extractPotLife(text, pages, doc),
    extractSprayGun(text, pages, doc),
    extractCoats(text, pages, doc),
    extractFlashOff(text, pages, doc),
    extractFilmThickness(text, pages, doc),
    extractDrying(text, pages, doc),
    extractSanding(text, pages, doc),
    extractVoc(text, pages, doc),
    extractWarnings(text, pages, doc),
    extractSequencing(text, pages, doc),
  ].filter(Boolean);

  records.push({
    productSlug: doc.productSlug,
    productName: doc.productName,
    productCode: doc.productCode,
    category: doc.category,
    documentHref: doc.href,
    documentPages: doc.pageCount,
    revision: doc.revision,
    claims,
  });
}

const allClaims = records.flatMap((record) =>
  record.claims.map((claim) => ({ productSlug: record.productSlug, ...claim })),
);

const summary = {
  generatedAt: new Date().toISOString(),
  sourceDocuments: eligible.length,
  productsProcessed: records.length,
  claimsExtracted: allClaims.length,
  claimsWithStructuredValue: allClaims.filter((claim) => claim.value !== undefined).length,
  claimsAmbiguous: allClaims.filter((claim) => claim.ambiguous).length,
  claimsWithPageProvenance: allClaims.filter((claim) => Number.isFinite(claim.page)).length,
  byField: Object.fromEntries(
    [...new Set(allClaims.map((claim) => claim.field))]
      .sort()
      .map((field) => [
        field,
        {
          products: new Set(
            allClaims.filter((claim) => claim.field === field).map((c) => c.productSlug),
          ).size,
          structured: allClaims.filter(
            (claim) => claim.field === field && claim.value !== undefined,
          ).length,
          ambiguous: allClaims.filter(
            (claim) => claim.field === field && claim.ambiguous,
          ).length,
        },
      ]),
  ),
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/rm-technical-extraction.generated.json",
  `${JSON.stringify({ summary, records }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
