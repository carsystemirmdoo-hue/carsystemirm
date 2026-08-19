#!/usr/bin/env node
/**
 * Phase 5 — C.A.R.FIT website claim extraction.
 *
 * "No TDS" would not have meant "no technical data" here, and neither does
 * "has a TDS": the product pages carry 395 structured specification rows, 68
 * substrate statements and 82 property blocks that exist nowhere else. All of
 * it is extracted before a single PDF is opened.
 *
 * Scope is the central idea. A page that lists three article numbers is a
 * family page, and `Farbe: braun, grün, violett` describes the family, not any
 * one variant. A page with h3 component blocks (Klarlack / Härter) is stronger
 * still: its values may describe only one component. Every claim therefore
 * carries a scope, and family-scope claims are never silently narrowed to a
 * single article number.
 *
 * Two polarity traps, kept apart deliberately:
 *
 *   grammatical negation   "kein Verstopfen" — a *positive* selling point
 *                          phrased with a negation. 39 of these exist.
 *   restriction            "nicht geeignet für …" — an actual prohibition.
 *
 * Treating the first as the second would invent restrictions that the
 * manufacturer never stated, so they are separate fields.
 *
 * Output: data/knowledge/carfit-website-claims.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const catalog = JSON.parse(readFileSync("data/knowledge/carfit-catalog.generated.json", "utf8"));
const generatedAt = new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* Typed fields — category-aware, not one paint schema                        */
/* -------------------------------------------------------------------------- */

const ABRASIVE = ["schleifmittel"];

/**
 * Only labels the manufacturer actually uses. Anything unlisted stays
 * `otherSpecification` with its label verbatim — a fixed schema would have
 * discarded the adhesive, abrasive and equipment vocabulary entirely.
 */
const LABEL_MAP = [
  { re: /^farbe$/i, field: "colour" },
  { re: /^dichte$|^stoffdichte$/i, field: "density" },
  { re: /^flammpunkt$|^siedebereich und flampunkt$/i, field: "flashPoint" },
  { re: /^voc(-value.*)?$/i, field: "voc" },
  { re: /^eu limit$/i, field: "vocRegulation" },
  { re: /^verpackung$|^gebinde$/i, field: "packaging" },
  { re: /^basis$/i, field: "composition" },
  { re: /^temperaturbeständigkeit$|^beständigkeit$|^arbeitstemperaturbereich$/i, field: "temperatureResistance" },
  { re: /^verarbeitungstemperatur$|^verarbeitungsbedingungen$/i, field: "processingTemperature" },
  { re: /^verarbeitungszeit/i, field: "potLife" },
  { re: /^zugfestigkeit$|^querfestigkeit$/i, field: "tensileStrength" },
  { re: /^bruchdehnung$|^längung$/i, field: "elongation" },
  { re: /^schälhaftung$|^haftung an stahl$|^klebkraft|^rolling ball tack$/i, field: "adhesion" },
  { re: /^durchmesser$|^größe$|^maße$/i, field: "dimensions" },
  { re: /^dicke$/i, field: "thickness" },
  { re: /^gewicht$/i, field: "weight" },
  { re: /^material$|^träger material$|^klebstoff$|^schleifmittel$/i, field: "material" },
  { re: /^körnung$/i, field: "abrasiveGrit", categories: ABRASIVE },
  { re: /^sorte$|^typ$/i, field: "grade" },
  { re: /^lagerung$|^haltbarkeit/i, field: "shelfLife" },
  { re: /^viskosität$/i, field: "viscosity" },
  { re: /^zündtemperatur$|^schmelzpunkt$/i, field: "ignitionTemperature" },
  { re: /^härte$/i, field: "hardness" },
  { re: /^verbrauch$/i, field: "coverage" },
  { re: /^glanzgrad/i, field: "gloss" },
  { re: /^salzsprühtest/i, field: "saltSprayResistance" },
  { re: /^imprägnierung$|^schutz$|^klettverschluss$/i, field: "featureSpecification" },
  { re: /^stromversorgung$|^ausgangsstrom$/i, field: "electricalSpecification" },
];

function typeOf(label, category) {
  for (const entry of LABEL_MAP) {
    if (!entry.re.test(label.trim())) continue;
    if (entry.categories && !entry.categories.includes(category)) continue;
    return entry.field;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Value parsing                                                              */
/* -------------------------------------------------------------------------- */

const UNIT_RE =
  /(g\s*\/\s*cm³|g\s*\/\s*l|kg\s*\/\s*m³|mPa\s*s|N\s*\/\s*25\s*mm|N\s*\/\s*cm|UPM|°C|µm|μm|mm|cm|kg|ml|\bl\b|\bg\b|%|bar|min|Std\.?|Monate|Jahre?|Stk\.?)/i;

const QUALIFIER_RE = /(ca\.|circa|etwa|bis zu|bis|min\.|mind\.|max\.|mindestens|maximal|>|<|≥|≤|±)/i;
const RESTRICTION_RE = /\b(nicht geeignet|nicht für|nicht auf|ungeeignet|darf nicht|kein[e]? verwendung|not suitable|do not (use|apply))\b/i;
const NEGATION_RE = /\b(kein|keine|keinen|nicht|ohne|frei von|no|without)\b/i;

function parseValue(raw) {
  const text = String(raw).trim();

  // A trailing parenthetical is a condition: "bis 80°C (60 Minuten)" is not the
  // same instruction as "bis 80°C".
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
    // Both bounds are kept; a midpoint would be a number the source never gave.
    range: isRange ? { min: Math.min(...numeric), max: Math.max(...numeric) } : undefined,
    negated: NEGATION_RE.test(text),
    restriction: RESTRICTION_RE.test(text),
  };
}

/* -------------------------------------------------------------------------- */
/* Substrates                                                                 */
/* -------------------------------------------------------------------------- */

const SUBSTRATES = [
  { slug: "celik", re: /\bstahl\w*|\bsteel\b/i, label: "čelik" },
  { slug: "nerdjajuci-celik", re: /edelstahl|stainless/i, label: "nerđajući čelik" },
  { slug: "aluminijum", re: /alumini\w*/i, label: "aluminijum" },
  { slug: "cink", re: /\bzink\w*|verzinkt\w*|galvani\w*/i, label: "cink / pocinkovano" },
  { slug: "bakar", re: /\bkupfer\b|\bcopper\b/i, label: "bakar" },
  { slug: "mesing", re: /\bmessing\b|\bbrass\b/i, label: "mesing" },
  { slug: "plastika", re: /kunststoff\w*|plastik\w*|\bplastic\b/i, label: "plastika" },
  { slug: "guma", re: /\bgummi\b|\brubber\b/i, label: "guma" },
  { slug: "staklo", re: /\bglas\b|\bglass\b/i, label: "staklo" },
  { slug: "hrom", re: /verchromt\w*|\bchrom\w*/i, label: "hrom" },
  { slug: "poliester-kit", re: /polyester-?spachtel|polyester (putty|filler)/i, label: "poliesterski kit" },
  { slug: "prajmer", re: /grundierung|grundiert\w*|\bprimer\b/i, label: "prajmer / temeljni sloj" },
  { slug: "oem-lak", re: /oem[- ]?(beschichtung|lackierung|coating)\w*/i, label: "OEM lak" },
  { slug: "stari-lak", re: /alte[rn]? (lack|beschichtung)\w*|old (coating|paint)/i, label: "stari lak" },
  { slug: "drvo", re: /\bholz\b|\bwood\b/i, label: "drvo" },
  { slug: "mineralne-podloge", re: /mineralstoff|mineral/i, label: "mineralne podloge" },
];

/* -------------------------------------------------------------------------- */

const records = [];

for (const product of catalog.products) {
  const claims = [];
  const category = product.category;

  /**
   * A page listing more than one article number describes a family. Component
   * blocks make it stronger: the value may belong to one component only, which
   * an expert has to confirm.
   */
  const pageScope = product.hasComponentBlocks
    ? "family-multi-component"
    : product.isFamily
      ? "family"
      : "variant";

  const base = {
    sourceType: "manufacturer-website",
    status: "machine-extracted",
    sourceUrl: product.sourceUrl,
    language: "de",
  };

  const push = (claim) => claims.push({ ...base, ...claim });

  // -- Specification rows ----------------------------------------------------
  for (const row of product.specifications) {
    const parsed = parseValue(row.value);
    push({
      field: typeOf(row.label, category) ?? "otherSpecification",
      sourceLabel: row.label,
      value: parsed.value,
      unit: parsed.unit,
      qualifier: parsed.qualifier,
      condition: parsed.condition,
      range: parsed.range,
      negated: parsed.negated,
      restriction: parsed.restriction,
      // A component-scoped row belongs to that component, not to the page.
      scope: row.component ? "component" : pageScope,
      component: row.component,
      appliesToArticleNumbers: row.component
        ? product.variants.filter((variant) => variant.component === row.component).map((variant) => variant.articleNumber)
        : product.articleNumbers,
      section: "Weitere Produktinformation",
      rawText: `${row.label}: ${row.value}`,
      extractionConfidence: typeOf(row.label, category) ? "high" : "medium",
    });
  }

  // -- Technical-data rows, including Ja/Nein compatibility ------------------
  for (const row of product.technicalData) {
    const yesNo = /^(ja|yes)$/i.test(row.value) ? true : /^(nein|no)$/i.test(row.value) ? false : undefined;
    const parsed = parseValue(row.value);
    push({
      // "Frischer Lack: Nein" is a compatibility statement whose whole meaning
      // is the polarity; storing the value without it would invert it.
      field: yesNo === undefined ? (typeOf(row.label, category) ?? "otherSpecification") : "compatibility",
      sourceLabel: row.label,
      value: yesNo === undefined ? parsed.value : row.value,
      compatible: yesNo,
      unit: parsed.unit,
      qualifier: parsed.qualifier,
      condition: parsed.condition,
      range: parsed.range,
      negated: yesNo === false || parsed.negated,
      restriction: yesNo === false,
      scope: row.component ? "component" : pageScope,
      component: row.component,
      appliesToArticleNumbers: product.articleNumbers,
      section: "Technische Daten",
      rawText: `${row.label}: ${row.value}`,
      extractionConfidence: yesNo === undefined ? "medium" : "high",
    });
  }

  // -- Substrates ------------------------------------------------------------
  for (const line of product.substrates) {
    const restricted = RESTRICTION_RE.test(line);
    for (const substrate of SUBSTRATES) {
      if (!substrate.re.test(line)) continue;
      push({
        field: "substrate",
        value: {
          substrate: substrate.slug,
          label: substrate.label,
          // `Oberflächen` lists what the product is *for*. A restriction phrase
          // in the same sentence flips it, and that is checked rather than
          // assumed.
          suitability: restricted ? "not-suitable" : "stated-suitable",
        },
        negated: restricted,
        restriction: restricted,
        scope: pageScope,
        appliesToArticleNumbers: product.articleNumbers,
        section: "Oberflächen",
        rawText: line.slice(0, 300),
        extractionConfidence: "high",
      });
    }
  }

  // -- Properties ------------------------------------------------------------
  for (const line of product.properties) {
    if (line.length < 3) continue;
    const parsed = parseValue(line);
    push({
      field: RESTRICTION_RE.test(line) ? "restriction" : "property",
      value: line,
      condition: parsed.condition,
      unit: parsed.unit,
      range: parsed.range,
      // Grammatical negation only. "kein Verstopfen" is a benefit, not a ban;
      // `restriction` is what marks a prohibition.
      negated: parsed.negated,
      restriction: RESTRICTION_RE.test(line),
      scope: pageScope,
      appliesToArticleNumbers: product.articleNumbers,
      section: "Eigenschaften",
      rawText: line.slice(0, 300),
      extractionConfidence: "medium",
    });
  }

  // -- Intended use ----------------------------------------------------------
  if (product.intendedUse) {
    push({
      field: "intendedUse",
      value: product.intendedUse.slice(0, 600),
      scope: pageScope,
      appliesToArticleNumbers: product.articleNumbers,
      section: "Zweckbestimmung",
      rawText: product.intendedUse.slice(0, 300),
      restriction: RESTRICTION_RE.test(product.intendedUse),
      negated: NEGATION_RE.test(product.intendedUse),
      extractionConfidence: "medium",
    });
  }

  records.push({
    slug: product.slug,
    productId: product.id,
    officialName: product.officialName,
    sourceUrl: product.sourceUrl,
    category,
    scope: pageScope,
    articleNumbers: product.articleNumbers,
    componentBlocks: product.componentBlocks,
    claims,
  });
}

const allClaims = records.flatMap((record) => record.claims);
const byField = {};
for (const claim of allClaims) byField[claim.field] = (byField[claim.field] ?? 0) + 1;
const byScope = {};
for (const claim of allClaims) byScope[claim.scope] = (byScope[claim.scope] ?? 0) + 1;

const summary = {
  generatedAt,
  brand: "C.A.R.FIT",
  manufacturer: "August Handel GmbH",
  sourceType: "manufacturer-website",
  products: records.length,
  productsWithClaims: records.filter((record) => record.claims.length).length,
  totalClaims: allClaims.length,
  typedClaims: allClaims.filter((claim) => claim.field !== "otherSpecification").length,
  byField,
  byScope,
  substrateClaims: allClaims.filter((claim) => claim.field === "substrate").length,
  compatibilityClaims: allClaims.filter((claim) => claim.field === "compatibility").length,
  // The two polarity notions are reported separately on purpose.
  grammaticallyNegated: allClaims.filter((claim) => claim.negated).length,
  restrictions: allClaims.filter((claim) => claim.restriction).length,
  withCondition: allClaims.filter((claim) => claim.condition).length,
  withRange: allClaims.filter((claim) => claim.range).length,
  withUnit: allClaims.filter((claim) => claim.unit).length,
  componentScoped: allClaims.filter((claim) => claim.scope === "component").length,
  familyScoped: allClaims.filter((claim) => String(claim.scope).startsWith("family")).length,
  allMachineExtracted: allClaims.every((claim) => claim.status === "machine-extracted"),
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carfit-website-claims.generated.json",
  `${JSON.stringify({ summary, records }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
