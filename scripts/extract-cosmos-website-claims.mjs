#!/usr/bin/env node
/**
 * Phase 5 quality pass — extract technical/application claims from Cosmos's
 * official product descriptions.
 *
 * The earlier pass treated "no TDS PDF" as "no technical data", which was
 * wrong: the manufacturer's own product pages state substrates, temperature
 * resistance, corrosion protection, overcoating and more, in prose.
 *
 * These are recorded as `sourceType: manufacturer-website` and stay strictly
 * distinct from `manufacturer-technical-document` claims. A website sentence is
 * weaker evidence than a TDS table and must never be presented as TDS-derived.
 *
 * Extraction is conservative and literal:
 *   - only explicit statements, matched by pattern
 *   - the exact source sentence is always retained
 *   - negative statements ("all surfaces except plastic") are captured as
 *     NOT-suitable, never silently dropped or inverted
 *
 * Also computes, per official family, which claims are shared across all
 * variants and which are specific to one — so a family-level fact is never
 * derived from a single representative variant.
 *
 * Output: data/knowledge/cosmos-website-claims.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const catalog = JSON.parse(
  readFileSync("data/knowledge/cosmos-catalog.generated.json", "utf8"),
);

const generatedAt = new Date().toISOString();

/** Split a description into sentences so each claim keeps its own evidence. */
function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* Substrate vocabulary — literal surface words only                          */
/* -------------------------------------------------------------------------- */

// Bare surface words are safe here because a sentence must already pass
// SUBSTRATE_CONTEXT before any of these are applied.
const SUBSTRATE_TERMS = [
  { slug: "metal", re: /\bmetals?\b|\bmetallic\s+surfaces?\b/i, label: "metal" },
  { slug: "celik", re: /\b(iron|steel)\s+surfaces?\b|\bsteel\b/i, label: "iron / steel" },
  { slug: "pocinkovani-lim", re: /\bgalvani[sz]ed\b/i, label: "galvanized" },
  { slug: "aluminijum", re: /\balumini(?:um|um|a)\b|\balu\b/i, label: "aluminium" },
  { slug: "plastika", re: /\bplastics?\b/i, label: "plastic" },
  { slug: "drvo", re: /\bwood(?:en)?\b|\btimber\b/i, label: "wood" },
  { slug: "zid", re: /\bwalls?\b|\bplaster\b|\bmasonry\b/i, label: "walls / plaster" },
  { slug: "beton", re: /\bconcrete\b|\bcement\b/i, label: "concrete" },
  { slug: "staklo", re: /\bglass\b/i, label: "glass" },
  { slug: "stari-lak", re: /\bold\s+paint(?:work)?\b|\bpainted\s+surfaces?\b/i, label: "painted surfaces" },
  { slug: "tekstil", re: /\bfabric\b|\btextile\b|\bvinyl\b/i, label: "fabric / vinyl" },
  { slug: "keramika", re: /\bceramics?\b|\btiles?\b/i, label: "ceramics" },
  { slug: "kamen", re: /\bstone\b|\bmarble\b/i, label: "stone / marble" },
  { slug: "papir", re: /\bpaper\b|\bcardboard\b/i, label: "paper" },
  { slug: "glina", re: /\bclay\b|\bterracotta\b/i, label: "clay" },
];

/**
 * Negation windows.
 *
 * "ideal for use on all surfaces except plastic" states that plastic is NOT
 * supported. Reading only the substrate word would invert the manufacturer's
 * meaning, which is the single most damaging error this extractor could make.
 */
const NEGATION = /\b(except|excluding|not\s+suitable|do\s+not|never|unsuitable|apart\s+from|other\s+than)\b/i;

/**
 * A sentence only states a substrate if it says so.
 *
 * Without this, colour names leak in: "Fast Acrylic Ral 7011 – Iron Grey"
 * matched `iron` and became an iron-substrate claim. Requiring a suitability
 * cue keeps "such as stoves, burners, exhausts, and all iron surfaces" while
 * rejecting a shade called Iron Grey.
 */
const SUBSTRATE_CONTEXT =
  /\b(suitable\s+for|for\s+use\s+on|use\s+on|application\s+on|apply(?:ing)?\s+(?:on|to)|ideal\s+for|designed\s+for|surfaces?\b|substrates?\b|on\s+all\b|protect\w*\s+all\b)/i;

function extractSubstrates(sentence, productName) {
  if (!SUBSTRATE_CONTEXT.test(sentence)) return [];

  // The product's own name repeats inside the sentence and carries the colour
  // designation; matching inside it produces phantom substrates.
  const withoutName = productName
    ? sentence.replace(
        new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
        " ",
      )
    : sentence;

  const found = [];
  const negationMatch = NEGATION.exec(withoutName);
  for (const term of SUBSTRATE_TERMS) {
    const match = term.re.exec(withoutName);
    if (!match) continue;
    // A substrate word appearing after the negation marker is excluded.
    const negated = Boolean(negationMatch && match.index > negationMatch.index);
    found.push({
      substrate: term.slug,
      label: term.label,
      suitability: negated ? "not-suitable" : "stated-suitable",
      matchedText: match[0],
      contextSentence: withoutName.trim().slice(0, 200),
    });
  }
  return found;
}

/* -------------------------------------------------------------------------- */
/* Other claim types                                                          */
/* -------------------------------------------------------------------------- */

const CLAIM_PATTERNS = [
  {
    field: "temperatureResistance",
    re: /\b(?:up\s+to|resist(?:s|ant)?\s+(?:to|up\s+to)?|withstand(?:s)?)\s*([0-9]{2,4}\s*°?\s*C)\b|\b([0-9]{2,4}\s*°C)\b/i,
    label: "Temperaturna otpornost",
  },
  {
    field: "corrosionResistance",
    re: /\b(anti-?rust|anti-?corros\w*|corrosion|rust\s+protection|cathodic\s+protection)\b/i,
    label: "Zaštita od korozije",
  },
  {
    field: "overcoatRestriction",
    re: /\b(can\s+be\s+painted\s+over|can\s+be\s+overcoated|overcoat\w*|paintable|can\s+be\s+recoated)\b/i,
    label: "Prekrivanje / prefarbavanje",
  },
  {
    field: "primerRequirement",
    re: /\b(no\s+primer|without\s+primer|primer\s+(?:is\s+)?(?:required|needed)|before\s+painting|undercoat)\b/i,
    label: "Potreba za temeljnim slojem",
  },
  {
    field: "dryingCharacteristic",
    re: /\b(dries?\s+(?:quickly|fast|rapidly)|fast[- ]drying|quick[- ]drying|drying\s+time)\b/i,
    label: "Sušenje",
  },
  {
    field: "indoorOutdoorUse",
    re: /\b(outdoor|indoor|exterior|interior|external|internal)\s*(?:use|application|surfaces?)?\b/i,
    label: "Unutrašnja / spoljna upotreba",
  },
  {
    field: "coverage",
    re: /\b(good|excellent|high|outstanding)\s+cover(?:age|ing)\b|\bcoverage\b/i,
    label: "Pokrivnost",
  },
  {
    field: "finish",
    re: /\b(matte?|gloss(?:y)?|satin|semi-?gloss|textured|metallic|transparent|velvety)\s*(?:finish|surface|effect)?\b/i,
    label: "Završnica",
  },
  {
    field: "durability",
    re: /\b(long[- ]lasting|durab\w+|UV\s+(?:radiation|protection|resistan\w+)|weather\s+(?:conditions|resistan\w+)|yellowing|discolo\w+)\b/i,
    label: "Trajnost / otpornost",
  },
  {
    field: "applicationArea",
    re: /\b(?:ideal|suitable|designed|specially\s+designed)\s+for\s+([^.]{5,90})/i,
    label: "Namena",
  },
  {
    field: "specialWarnings",
    re: /\b(do\s+not\s+[^.]{3,60}|avoid\s+[^.]{3,60}|never\s+[^.]{3,60})/i,
    label: "Upozorenje",
  },
];

function extractClaims(product) {
  const description = product.officialDescription;
  if (!description) return [];

  const claims = [];
  for (const sentence of sentences(description)) {
    for (const substrate of extractSubstrates(sentence, product.officialName)) {
      claims.push({
        field: "substrates",
        value: {
          substrate: substrate.substrate,
          label: substrate.label,
          suitability: substrate.suitability,
        },
        rawText: sentence,
        matchedText: substrate.matchedText,
        // A website sentence is weaker evidence than a TDS table. The
        // distinction is carried on every claim so it cannot be lost later.
        sourceType: "manufacturer-website",
        sourceUrl: product.sourceUrl,
        accessedAt: product.accessedAt,
        status: "machine-extracted",
        extractionConfidence: substrate.suitability === "not-suitable" ? "medium" : "high",
        ambiguous: substrate.suitability === "not-suitable",
        note:
          substrate.suitability === "not-suitable"
            ? "Negativna izjava — proizvod je izričito isključen za ovu podlogu. Potvrditi čitanje."
            : undefined,
      });
    }

    for (const pattern of CLAIM_PATTERNS) {
      const match = pattern.re.exec(sentence);
      if (!match) continue;
      claims.push({
        field: pattern.field,
        label: pattern.label,
        value: (match[1] ?? match[0]).trim(),
        rawText: sentence,
        matchedText: match[0],
        sourceType: "manufacturer-website",
        sourceUrl: product.sourceUrl,
        accessedAt: product.accessedAt,
        status: "machine-extracted",
        extractionConfidence: "medium",
        ambiguous: false,
      });
    }
  }
  return claims;
}

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

const records = catalog.products.map((product) => ({
  slug: product.slug,
  officialName: product.officialName,
  family: product.family,
  category: product.category,
  sourceUrl: product.sourceUrl,
  officialDescription: product.officialDescription,
  claims: extractClaims(product),
}));

/* -- Family-level vs variant-specific --------------------------------------- */

/**
 * A fact may only be called family-level if it holds for *every* variant whose
 * page states anything at all. Promoting one representative's description to
 * the whole family is how a single shade's wording becomes a claim about 134
 * products it was never written about.
 */
const familyAnalysis = [];
const byFamily = new Map();
for (const record of records) {
  const bucket = byFamily.get(record.family) ?? [];
  bucket.push(record);
  byFamily.set(record.family, bucket);
}

for (const [family, members] of byFamily) {
  const described = members.filter((member) => member.officialDescription);
  const signature = (claim) =>
    claim.field === "substrates"
      ? `substrates:${claim.value.substrate}:${claim.value.suitability}`
      : `${claim.field}:${String(claim.value).toLowerCase().slice(0, 40)}`;

  const counts = new Map();
  for (const member of described) {
    for (const key of new Set(member.claims.map(signature))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const shared = [];
  const variantSpecific = [];
  for (const [key, count] of counts) {
    (count === described.length && described.length > 1 ? shared : variantSpecific).push({
      claim: key,
      variantsStating: count,
      ofVariants: described.length,
    });
  }

  // Descriptions that are byte-identical across the family are a strong signal
  // that the manufacturer authored one text for the whole line.
  const distinctDescriptions = new Set(
    described.map((member) => member.officialDescription),
  ).size;

  familyAnalysis.push({
    family,
    variants: members.length,
    variantsWithDescription: described.length,
    distinctDescriptions,
    descriptionIsUniform: distinctDescriptions === 1 && described.length > 1,
    sharedClaims: shared.sort((a, b) => b.variantsStating - a.variantsStating),
    variantSpecificClaims: variantSpecific.sort(
      (a, b) => b.variantsStating - a.variantsStating,
    ),
  });
}

const allClaims = records.flatMap((record) => record.claims);
const byField = {};
for (const claim of allClaims) {
  byField[claim.field] = (byField[claim.field] ?? 0) + 1;
}

const substrateClaims = allClaims.filter((claim) => claim.field === "substrates");

const summary = {
  generatedAt,
  brand: "Cosmos Lac",
  sourceType: "manufacturer-website",
  productsAnalysed: records.length,
  productsWithDescription: records.filter((r) => r.officialDescription).length,
  productsWithAnyClaim: records.filter((r) => r.claims.length).length,
  totalClaims: allClaims.length,
  byField,
  substrateClaims: substrateClaims.length,
  substrateNotSuitableClaims: substrateClaims.filter(
    (claim) => claim.value.suitability === "not-suitable",
  ).length,
  productsWithSubstrateClaim: records.filter((r) =>
    r.claims.some((claim) => claim.field === "substrates"),
  ).length,
  families: familyAnalysis.length,
  familiesWithUniformDescription: familyAnalysis.filter((f) => f.descriptionIsUniform).length,
  familyLevelClaims: familyAnalysis.reduce((sum, f) => sum + f.sharedClaims.length, 0),
  variantSpecificClaims: familyAnalysis.reduce(
    (sum, f) => sum + f.variantSpecificClaims.length,
    0,
  ),
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/cosmos-website-claims.generated.json",
  `${JSON.stringify({ summary, familyAnalysis, records }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
