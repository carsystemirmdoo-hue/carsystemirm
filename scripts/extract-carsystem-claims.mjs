#!/usr/bin/env node
/**
 * Phase 5 — Carsystem manufacturer-website claim extraction.
 *
 * Applies the Cosmos lesson: absence of a TDS is not absence of data. The
 * official product pages carry structured German sections that state real
 * technical facts, and 219 of 462 products have no TDS at all.
 *
 * Patterns were written against the actual German text after surveying all ten
 * categories — not carried over from the R-M/baslac English sheets. The
 * catalogue spans paint, abrasives, tools, adhesives and PPE, so fields are
 * category-aware: RPM and stroke for power tools, grain for abrasives, PPE
 * category for protective clothing, temperature range for adhesive tapes.
 * Forcing mixing-ratio fields onto a sanding disc would produce nothing but
 * noise.
 *
 * All claims are `sourceType: manufacturer-website` and never presented as
 * TDS-derived. Negative statements keep their polarity.
 *
 * Output: data/knowledge/carsystem-website-claims.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const catalog = JSON.parse(
  readFileSync("data/knowledge/carsystem-catalog.generated.json", "utf8"),
);

const generatedAt = new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* Substrates — German vocabulary                                             */
/* -------------------------------------------------------------------------- */

const SUBSTRATE_TERMS = [
  { slug: "metal", re: /\bmetall\w*\b/i, label: "metal" },
  { slug: "celik", re: /\bstahl\b|\beisen\b/i, label: "čelik / gvožđe" },
  { slug: "pocinkovani-lim", re: /\bverzinkt\w*\b|\bzink\b/i, label: "pocinkovana površina" },
  { slug: "aluminijum", re: /\baluminium\b|\balu\b/i, label: "aluminijum" },
  { slug: "plastika", re: /\bkunststoff\w*\b|\bpp\b|\babs\b/i, label: "plastika" },
  { slug: "drvo", re: /\bholz\w*\b/i, label: "drvo" },
  { slug: "staklo", re: /\bglas\b(?!faser)/i, label: "staklo" },
  { slug: "stakloplastika", re: /\bgfk\b|\bglasfaser\w*\b|\bsmc\b/i, label: "GFK / SMC" },
  { slug: "stari-lak", re: /\baltlack\w*\b|\balter\s+lack\b/i, label: "stari lak" },
  { slug: "temeljna-boja", re: /\bgrundierung\w*\b|\bfüller\b/i, label: "temeljni sloj / filer" },
  { slug: "e-coat", re: /\bktl\b|\be-?coat\b|\belektrotauch\w*\b/i, label: "KTL / e-coat" },
];

/**
 * A word is only a substrate when the sentence is about where the product is
 * applied. Without this, a product *named* "Metall Spray" would generate a
 * metal-substrate claim from its own name.
 */
const SUBSTRATE_CONTEXT =
  /\b(auf|für|geeignet|anwendung|untergrund|oberfläche|substrat|haftet|haftung|lackier\w*|schleif\w*|kleb\w*|beschicht\w*)\b/i;

const NEGATION =
  /\b(nicht|kein|keine|keinen|ungeeignet|ausgenommen|außer|vermeiden|niemals)\b/i;

function extractSubstrates(sentence, productName) {
  if (!SUBSTRATE_CONTEXT.test(sentence)) return [];

  // Strip the product's own name; it frequently contains material words.
  const withoutName = productName
    ? sentence.replace(
        new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
        " ",
      )
    : sentence;

  const negation = NEGATION.exec(withoutName);
  const found = [];
  for (const term of SUBSTRATE_TERMS) {
    const match = term.re.exec(withoutName);
    if (!match) continue;
    const negated = Boolean(negation && match.index > negation.index);
    found.push({
      substrate: term.slug,
      label: term.label,
      suitability: negated ? "not-suitable" : "stated-suitable",
      matchedText: match[0],
    });
  }
  return found;
}

/* -------------------------------------------------------------------------- */
/* Claim patterns — German, category-aware                                    */
/* -------------------------------------------------------------------------- */

/** Categories each field is meaningful for. `*` means all. */
const CLAIM_PATTERNS = [
  {
    field: "temperatureResistance",
    categories: ["*"],
    re: /Temperaturbeständigkeit:?\s*([^|]{2,40})|(-?\d+\s*°C\s*bis\s*\+?\s*-?\d+\s*°C)|\bbis\s+(\d+\s*°C)/i,
    label: "Temperaturna otpornost",
  },
  {
    field: "colour",
    categories: ["*"],
    re: /\bFarbe:\s*([^|;]{2,40})/i,
    label: "Boja",
  },
  {
    field: "overcoatRestriction",
    categories: ["lackieren", "spachteln", "kleben-beschichten"],
    re: /(Überlackierbar\s+mit\s+[^|;]{2,80}|nicht\s+überlackierbar|überlackierbar)/i,
    label: "Prelakiranje",
  },
  {
    field: "dryingCharacteristic",
    categories: ["*"],
    re: /(schnelle?\s+trocknung|schnelltrocknend|trocknungszeit[^|;]{0,40}|lufttrocknend)/i,
    label: "Sušenje",
  },
  {
    field: "sandingMethod",
    categories: ["schleifen", "spachteln", "lackieren"],
    re: /(nass\s*(?:-\s*)?und\s*trocken\w*|nassschliff|trockenschliff|nass\s+zu\s+verarbeiten)/i,
    label: "Brušenje (mokro/suvo)",
  },
  {
    field: "abrasiveGrain",
    categories: ["schleifen"],
    re: /((?:aluminiumoxid|keramik|siliziumkarbid|zirkonium|korund)[- ]?korn|keramikkorn)/i,
    label: "Vrsta zrna",
  },
  {
    field: "rotationSpeed",
    categories: ["finish", "schleifen"],
    re: /(?:Drehzahl[^:]{0,30}:?\s*|Umdrehungszahl[^:]{0,30}:?\s*|max\.?\s*)([\d.]+\s*(?:-\s*[\d.]+)?\s*U\s*\/?\s*min|[\d.]+\s*(?:U\/min|Umdrehungen))/i,
    label: "Broj obrtaja",
  },
  {
    field: "stroke",
    categories: ["finish", "schleifen"],
    re: /(\d+(?:[.,]\d+)?\s*mm\s+Hub)/i,
    label: "Hod (Hub)",
  },
  {
    field: "ppeCategory",
    categories: ["arbeitsschutz"],
    re: /(PSA\s*Kat\.?\s*[IVX]+|Kategorie\s*[IVX]+)/i,
    label: "PSA kategorija",
  },
  {
    field: "applicationArea",
    categories: ["*"],
    re: /^(.{10,140})$/,
    section: "EINSATZGEBIET",
    label: "Namena",
  },
  {
    field: "advantage",
    categories: ["*"],
    re: /^(.{5,120})$/,
    section: "VORTEILE",
    label: "Prednost",
  },
  {
    field: "specialWarnings",
    categories: ["*"],
    re: /(nicht\s+geeignet[^|;]{0,80}|nicht\s+für[^|;]{0,80}|vermeiden\s+sie[^|;]{0,80}|achtung[^|;]{0,80})/i,
    label: "Upozorenje",
  },
  {
    field: "chromateFree",
    categories: ["lackieren", "spachteln"],
    re: /(chromatfrei|silikonfrei|lösemittelfrei)/i,
    label: "Sastav (bez hromata/silikona/rastvarača)",
  },
];

/**
 * Any article number referenced inside descriptive text.
 *
 * The manufacturer writes these several ways — "(Art. Nr. 133.172)",
 * "(Klettvariante 144.769)", "Art.Nr. 145.840", or bare inline ("der 159.007
 * RUPES ..."). Matching only the first form found 3 of 12.
 *
 * They are NOT all accessories: "Mattgrad: Matt - 148.983" references a variant
 * of the same product. The relation is therefore recorded as `referenced-article`
 * with its sentence, and typed only where the wording is explicit. Guessing
 * "accessory" from a bare number would invent a relationship the source never
 * states.
 */
const ARTICLE_REF_RE = /\b(\d{3}\.\d{3})\b/g;

/**
 * German compounds defeat \b-anchored cues: "Anwendungsempfehlung" contains
 * "empfehlung" but has no word boundary before it, so an anchored pattern
 * misses it and the reference falls through to the wrong type. Cues are
 * therefore substring matches.
 */
const ACCESSORY_CUE =
  /(empfehl|einsetzbar|verwendung mit|genutzt werden|alternativ|zubehör|passend|kombination mit)/i;
/** Only when the sentence is about grades/variants of the same product. */
const VARIANT_CUE = /(mattgrad|ausführung|farbton)/i;

function claimFor(product, { field, label, value, sentence, section, matchedText, ambiguous, note }) {
  return {
    field,
    label,
    value,
    rawText: sentence,
    matchedText,
    section,
    // Website evidence, explicitly not a technical data sheet.
    sourceType: "manufacturer-website",
    sourceUrl: product.sourceUrl,
    accessedAt: product.accessedAt,
    status: "machine-extracted",
    extractionConfidence: ambiguous ? "low" : "medium",
    ambiguous: Boolean(ambiguous),
    note,
  };
}

function extractClaims(product) {
  const claims = [];
  const relationships = [];

  for (const [section, items] of Object.entries(product.sections)) {
    for (const sentence of items) {
      for (const substrate of extractSubstrates(sentence, product.officialName)) {
        claims.push(
          claimFor(product, {
            field: "substrates",
            label: "Podloga",
            value: {
              substrate: substrate.substrate,
              label: substrate.label,
              suitability: substrate.suitability,
            },
            sentence,
            section,
            matchedText: substrate.matchedText,
            ambiguous: substrate.suitability === "not-suitable",
            note:
              substrate.suitability === "not-suitable"
                ? "Negativna izjava — podloga je izričito isključena. Potvrditi čitanje."
                : undefined,
          }),
        );
      }

      for (const pattern of CLAIM_PATTERNS) {
        const applies =
          pattern.categories.includes("*") || pattern.categories.includes(product.category);
        if (!applies) continue;
        if (pattern.section && pattern.section !== section) continue;
        const match = pattern.re.exec(sentence);
        if (!match) continue;
        const value = (match[1] ?? match[2] ?? match[3] ?? match[0]).trim();
        if (!value) continue;
        claims.push(
          claimFor(product, {
            field: pattern.field,
            label: pattern.label,
            value,
            sentence,
            section,
            matchedText: match[0],
          }),
        );
      }

      // Article numbers referenced in prose. Typed only from explicit wording.
      ARTICLE_REF_RE.lastIndex = 0;
      let reference;
      while ((reference = ARTICLE_REF_RE.exec(sentence)) !== null) {
        const article = reference[1];
        // Skip the product's own article numbers — a self-reference is not a
        // relationship.
        if (product.articleNumbers.includes(article)) continue;
        const type = ACCESSORY_CUE.test(sentence)
          ? "recommended-accessory"
          : VARIANT_CUE.test(sentence)
            ? "variant-reference"
            : "referenced-article";
        relationships.push({
          type,
          targetArticleNumber: article,
          rawText: sentence,
          section,
          sourceType: "manufacturer-website",
          sourceUrl: product.sourceUrl,
          status: "machine-extracted",
          // Stated by the manufacturer with an article number — never derived
          // from catalogue adjacency, naming similarity or shared category.
          inferred: false,
          // `referenced-article` means the link is real but its nature is not
          // stated; a human decides what it is.
          requiresTyping: type === "referenced-article",
        });
      }
    }
  }

  return { claims, relationships };
}

/* -------------------------------------------------------------------------- */

const records = catalog.products.map((product) => {
  const { claims, relationships } = extractClaims(product);
  return {
    slug: product.slug,
    officialName: product.officialName,
    subtitle: product.subtitle,
    category: product.category,
    sourceUrl: product.sourceUrl,
    claims,
    relationships,
  };
});

/* -- Family = manufacturer category; claim coverage within it --------------- */

const categoryAnalysis = [];
const byCategory = new Map();
for (const record of records) {
  const bucket = byCategory.get(record.category) ?? [];
  bucket.push(record);
  byCategory.set(record.category, bucket);
}

const signature = (claim) =>
  claim.field === "substrates"
    ? `substrates:${claim.value.substrate}:${claim.value.suitability}`
    : `${claim.field}:${String(claim.value).toLowerCase().slice(0, 50)}`;

for (const [category, members] of byCategory) {
  const described = members.filter((member) => member.claims.length);
  const counts = new Map();
  for (const member of described) {
    for (const key of new Set(member.claims.map(signature))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const shared = [];
  const specific = [];
  for (const [key, count] of counts) {
    // Category-level only when every described product states it. With
    // hundreds of distinct products per category this is rare, and that
    // rarity is the honest answer rather than a reason to loosen the rule.
    (count === described.length && described.length > 1 ? shared : specific).push({
      claim: key,
      productsStating: count,
      ofProducts: described.length,
    });
  }
  categoryAnalysis.push({
    category,
    products: members.length,
    productsWithClaims: described.length,
    categoryLevelClaims: shared,
    productSpecificClaims: specific.length,
  });
}

const allClaims = records.flatMap((record) => record.claims);
const allRelationships = records.flatMap((record) => record.relationships);
const byField = {};
for (const claim of allClaims) byField[claim.field] = (byField[claim.field] ?? 0) + 1;

const substrateClaims = allClaims.filter((claim) => claim.field === "substrates");

const summary = {
  generatedAt,
  brand: "Carsystem",
  manufacturer: "Vosschemie GmbH",
  sourceType: "manufacturer-website",
  productsAnalysed: records.length,
  productsWithClaims: records.filter((record) => record.claims.length).length,
  totalClaims: allClaims.length,
  byField,
  substrateClaims: substrateClaims.length,
  substrateNotSuitable: substrateClaims.filter(
    (claim) => claim.value.suitability === "not-suitable",
  ).length,
  productsWithSubstrateClaim: records.filter((record) =>
    record.claims.some((claim) => claim.field === "substrates"),
  ).length,
  relationships: allRelationships.length,
  productsWithRelationships: records.filter((record) => record.relationships.length).length,
  categories: categoryAnalysis.length,
  categoryLevelClaims: categoryAnalysis.reduce(
    (sum, entry) => sum + entry.categoryLevelClaims.length,
    0,
  ),
  productSpecificClaims: categoryAnalysis.reduce(
    (sum, entry) => sum + entry.productSpecificClaims,
    0,
  ),
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carsystem-website-claims.generated.json",
  `${JSON.stringify({ summary, categoryAnalysis, records }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
