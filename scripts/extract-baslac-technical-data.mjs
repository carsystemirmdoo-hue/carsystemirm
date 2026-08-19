#!/usr/bin/env node
/**
 * Phase 5 — extract technical claims from the acquired baslac TDS set.
 *
 * Same rule as Phase 3: EXTRACT, DO NOT INFER. Every value is matched against
 * explicit wording in the source PDF and carries page, section and a verbatim
 * excerpt.
 *
 * Two format differences from R-M shape this parser:
 *
 *   1. baslac labels the two spray-gun setups separately ("HVLP spray gun" /
 *      "Compliant gravity-feed spray gun"), so nozzle and pressure are
 *      unambiguous here — unlike R-M, where the two columns merge on
 *      extraction and had to be withheld.
 *   2. The PDF text splits the first character of many words onto its own line
 *      ("T\nechnical", "B\nodyfiller"). Product names are therefore taken from
 *      baslac's own official index rather than parsed out of the broken header.
 *
 * Output: data/knowledge/baslac-technical-extraction.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extractPdfBatch } from "./lib/rm-pdf-text.mjs";

const docsManifest = JSON.parse(
  readFileSync("data/knowledge/baslac-documents.generated.json", "utf8"),
);

const tdsDocs = docsManifest.documents.filter(
  (doc) => doc.kind === "tds" && doc.localPath && !doc.error,
);

const paths = tdsDocs.map((doc) => `public${doc.localPath}`);
const extracted = extractPdfBatch(paths);
const pagesByPath = new Map(extracted.map((entry) => [entry.path, entry.pages]));

/**
 * Repair the split-first-character artefact only where it is unambiguous:
 * a lone capital on its own line immediately followed by a lowercase run.
 * Applied for label matching; values are never reconstructed this way.
 */
function repairSplitWords(text) {
  return text.replace(/(^|\n)([A-Z])\n(?=[a-z])/g, "$1$2");
}

function excerpt(text, limit = 170) {
  return text.replace(/\s+/g, " ").trim().slice(0, limit);
}

function pageOf(pages, index) {
  let offset = 0;
  for (let i = 0; i < pages.length; i += 1) {
    offset += pages[i].length + 1;
    if (index < offset) return i + 1;
  }
  return pages.length;
}

const accessedAt = docsManifest.summary.generatedAt;

function claim({ field, value, raw, section, page, doc, ambiguous, note, confidence }) {
  return {
    field,
    value,
    rawText: excerpt(raw),
    section,
    page,
    sourceType: "manufacturer-technical-document",
    sourceUrl: doc.sourceUrl,
    documentName: doc.title,
    localPath: doc.localPath,
    accessedAt,
    status: "machine-extracted",
    extractionConfidence: confidence ?? (ambiguous ? "low" : "high"),
    ambiguous: Boolean(ambiguous),
    note,
  };
}

/* -------------------------------------------------------------------------- */

const CODE = /\b(\d{2}-\d{2}(?:-[A-Z0-9]+)?|\d{2}-[A-Z]\d{3})\b/g;

/**
 * Expand baslac's sibling shorthand.
 *
 * A line like "50-15, -20" lists two products: 50-15 and 50-20. Reading only
 * the first silently drops an alternative the sheet explicitly offers.
 */
function expandCodes(source) {
  const codes = [...new Set([...source.matchAll(CODE)].map((entry) => entry[1]))];
  const prefix = codes[0]?.split("-")[0];
  if (!prefix) return codes;
  for (const match of source.matchAll(/,\s*-(\d{2})\b/g)) {
    codes.push(`${prefix}-${match[1]}`);
  }
  return [...new Set(codes)];
}

function extractMixingRatio(text, pages, doc) {
  const header = /Mixing Ratio\s*\n\s*(\d+(?::\d+)+)/.exec(text);
  const block = /Mixing Ratio\s*\n([\s\S]{0,420}?)(?=\n\s*(?:Spray viscosity|Potlife|Pot life|HVLP|Compliant|Drying|Number of|Film thickness|Flash off|Safety advice))/.exec(
    text,
  );
  if (!header && !block) return undefined;

  const components = [];
  if (block) {
    const re = /(\d+(?:-\d+)?)\s*%\s*by\s*(volume|weight)\s*\n([^\n]{0,60})/g;
    let match;
    while ((match = re.exec(block[1])) !== null) {
      components.push({
        proportion: match[1],
        basis: match[2],
        codesText: match[3].trim(),
        codes: expandCodes(match[3]),
      });
    }
  }

  return claim({
    field: "mixingRatio",
    value: header
      ? { ratio: header[1], components, basis: components[0]?.basis ?? "volume" }
      : components.length
        ? { ratio: undefined, components }
        : undefined,
    raw: block ? block[0] : header[0],
    section: "Application — Mixing Ratio",
    page: pageOf(pages, (header ?? block).index),
    doc,
    ambiguous: !header,
    note: header
      ? undefined
      : "Sekcija postoji, ali bez eksplicitnog odnosa u obliku a:b — samo komponente.",
  });
}

/** Hardener/thinner referenced inside the mixing block, by role position. */
function extractComponentRoles(text, pages, doc) {
  const block = /Mixing Ratio\s*\n([\s\S]{0,420}?)(?=\n\s*(?:Spray viscosity|Potlife|Pot life|HVLP|Compliant|Drying|Number of|Film thickness|Flash off|Safety advice))/.exec(
    text,
  );
  if (!block) return [];

  const rows = [...block[1].matchAll(/(\d+(?:-\d+)?)\s*%\s*by\s*(?:volume|weight)\s*\n([^\n]{0,60})/g)];
  if (rows.length < 2) return [];

  const results = [];
  // Row 0 is the product itself; later rows are its hardener / thinner.
  for (let index = 1; index < rows.length; index += 1) {
    const codes = expandCodes(rows[index][2]);
    if (!codes.length) continue;
    results.push(
      claim({
        field: index === 1 ? "hardener" : "thinner",
        value: codes,
        raw: `${rows[index][1]} % — ${rows[index][2]}`,
        section: "Application — Mixing Ratio",
        page: pageOf(pages, block.index),
        doc,
        // Role is inferred from row position, not stated. Flagged as such.
        ambiguous: true,
        confidence: "medium",
        note:
          "Uloga (učvršćivač/razređivač) je izvedena iz redosleda u tabeli, nije eksplicitno navedena u listu. Zahteva potvrdu.",
      }),
    );
  }
  return results;
}

function extractSprayGun(text, pages, doc) {
  const results = [];
  const setups = [
    {
      key: "hvlp",
      label: "HVLP spray gun",
      // The label itself is line-broken in the extracted text ("HVLP\n spray gun").
      re: /HVLP\s*\n?\s*spray\s*gun\s*\n([\s\S]{0,260}?)(?=\n\s*(?:HVLP|Compliant|Number of|Film thickness|Flash off|Drying|Safety advice|Pot ?life)|$)/i,
    },
    {
      key: "compliant-gravity",
      label: "Compliant gravity-feed spray gun",
      re: /Compliant\s*\n?\s*gravity[- ]?feed\s*\n?\s*spray\s*\n?\s*gun\s*\n([\s\S]{0,260}?)(?=\n\s*(?:HVLP|Compliant|Number of|Film thickness|Flash off|Drying|Safety advice|Pot ?life)|$)/i,
    },
  ];

  for (const setup of setups) {
    const match = setup.re.exec(text);
    if (!match) continue;
    const body = match[1];
    const nozzle = /Nozzle\s*size\s*\n\s*([\d.]+(?:\s*-\s*[\d.]+)?)\s*mm/i.exec(body);
    const appPressure = /Application\s*pressure\s*\n\s*([\d.]+)\s*bar/i.exec(body);
    const nozzlePressure = /Nozzle\s*pressure\s*\n\s*([\d.]+)\s*bar/i.exec(body);
    if (!nozzle && !appPressure) continue;

    results.push(
      claim({
        field: "nozzle",
        value: {
          gunType: setup.key,
          nozzleMm: nozzle ? nozzle[1].replace(/\s+/g, "") : undefined,
          applicationPressureBar: appPressure ? Number(appPressure[1]) : undefined,
          nozzlePressureBar: nozzlePressure ? Number(nozzlePressure[1]) : undefined,
        },
        raw: `${setup.label}: ${body}`,
        section: `Application — ${setup.label}`,
        page: pageOf(pages, match.index),
        doc,
      }),
    );
  }
  return results;
}

function simple(text, pages, doc, { field, pattern, section, parse, note }) {
  const match = pattern.exec(text);
  if (!match) return undefined;
  const parsed = parse ? parse(match) : match[1]?.trim();
  return claim({
    field,
    value: parsed,
    raw: match[0],
    section,
    page: pageOf(pages, match.index),
    doc,
    ambiguous: parsed === undefined,
    note,
  });
}

function extractDrying(text, pages, doc) {
  const entries = [];
  let first;
  const dry = /Drying at\s*(\d+)\s*°C\s*\n\s*([\d]+(?:-[\d]+)?)\s*(min|h)/gi;
  let match;
  while ((match = dry.exec(text)) !== null) {
    first ??= match.index;
    entries.push({
      temperatureC: Number(match[1]),
      duration: match[2],
      unit: match[3],
      sourceText: match[0].replace(/\s+/g, " "),
    });
  }
  const ir = /Infrared\s*\(([a-z ]+)\s*wave\)\s*\n\s*([\d]+(?:-[\d]+)?)\s*min/gi;
  while ((match = ir.exec(text)) !== null) {
    first ??= match.index;
    entries.push({
      temperatureC: undefined,
      stage: `Infracrveno (${match[1].trim()} wave)`,
      duration: match[2],
      unit: "min",
      sourceText: match[0].replace(/\s+/g, " "),
    });
  }
  if (!entries.length) return undefined;

  return claim({
    field: "drying",
    value: entries,
    raw: entries.map((entry) => entry.sourceText).join(" | "),
    section: "Drying",
    page: pageOf(pages, first),
    doc,
  });
}

/* -------------------------------------------------------------------------- */

const records = [];

for (let index = 0; index < tdsDocs.length; index += 1) {
  const doc = tdsDocs[index];
  const pages = pagesByPath.get(paths[index]) ?? [];
  const rawText = pages.join("\n");
  const text = repairSplitWords(rawText);

  const claims = [
    extractMixingRatio(text, pages, doc),
    ...extractComponentRoles(text, pages, doc),
    ...extractSprayGun(text, pages, doc),
    simple(text, pages, doc, {
      field: "potLife",
      pattern: /Pot ?life at\s*(\d+)\s*°C\s*\n\s*([\d]+(?:-[\d]+)?)\s*(min|h)/i,
      section: "Application — Potlife",
      parse: (match) => `${match[2]} ${match[3]} @ ${match[1]}°C`,
    }),
    simple(text, pages, doc, {
      field: "coats",
      pattern: /Number of spray coats\s*\n\s*([^\n]{1,80})/i,
      section: "Application — Number of spray coats",
    }),
    simple(text, pages, doc, {
      field: "filmThickness",
      pattern: /Film thickness\s*\n\s*([\d]+\s*-\s*[\d]+\s*[μµ]m|[^\n]{1,40}[μµ]m)/i,
      section: "Application — Film thickness",
    }),
    simple(text, pages, doc, {
      field: "flashOff",
      pattern: /Flash off at\s*(\d+)\s*°C\s*\n\s*([^\n]{1,60})/i,
      section: "Application — Flash off",
      parse: (match) => `${match[2].trim()} @ ${match[1]}°C`,
    }),
    simple(text, pages, doc, {
      field: "voc",
      pattern: /VOC content of this product is\s*([\d.]+)\s*g\/l/i,
      section: "Safety advice — VOC",
      parse: (match) => Number(match[1]),
    }),
    simple(text, pages, doc, {
      field: "officialDescription",
      pattern: /page \d+ of \d+\s*\n([\s\S]{20,320}?)(?=\n\s*(?:Application|Mixing Ratio|Drying|Please note|Safety advice))/,
      section: "Uvodni opis",
    }),
    extractDrying(text, pages, doc),
  ].filter(Boolean);

  const revision = /(\d{2}\/\d{4})\s*\n\s*page \d+ of/.exec(text)?.[1];

  records.push({
    productCode: doc.productCode,
    officialProductName: doc.title,
    documentSourceUrl: doc.sourceUrl,
    documentLocalPath: doc.localPath,
    documentVersion: revision,
    pages: pages.length,
    claims,
  });
}

const allClaims = records.flatMap((record) => record.claims);
const fields = [...new Set(allClaims.map((claim) => claim.field))].sort();

const summary = {
  generatedAt: new Date().toISOString(),
  brand: "baslac",
  manufacturer: "BASF Coatings GmbH",
  documentsProcessed: records.length,
  claimsExtracted: allClaims.length,
  claimsWithValue: allClaims.filter((claim) => claim.value !== undefined).length,
  claimsAmbiguous: allClaims.filter((claim) => claim.ambiguous).length,
  productsWithAnyClaim: records.filter((record) => record.claims.length).length,
  byField: Object.fromEntries(
    fields.map((field) => [
      field,
      {
        documents: new Set(
          allClaims.filter((claim) => claim.field === field).map((claim) => claim.localPath),
        ).size,
        withValue: allClaims.filter(
          (claim) => claim.field === field && claim.value !== undefined,
        ).length,
        ambiguous: allClaims.filter((claim) => claim.field === field && claim.ambiguous).length,
      },
    ]),
  ),
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/baslac-technical-extraction.generated.json",
  `${JSON.stringify({ summary, records }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
