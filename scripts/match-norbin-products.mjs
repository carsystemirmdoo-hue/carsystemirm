#!/usr/bin/env node
/**
 * Phase 5 — NORBIN matching, our assortment ↔ manufacturer catalogue.
 *
 * NORBIN is the first brand where our own records carry the manufacturer's
 * code: two of our three products are named for `N15-020`. Exact code is the
 * strongest evidence available, and here it is genuinely exact — the codes
 * share the manufacturer's own `N##-###` scheme rather than being a local SKU
 * that happens to contain digits.
 *
 * The ladder is unchanged:
 *   1 exact-code   2 exact-name   3 normalized-code   4 cross-family-exact
 *   5 probable     6 ambiguous    7 unmatched
 *
 * A bare numeric agreement is still never accepted without name or family
 * support. Pack size is corroboration, not identity: `N15-020 1 L` and
 * `N15-020 5 L` are the same product in two pack sizes, which is a variant
 * relationship rather than two matches.
 *
 * Output: data/knowledge/norbin-match.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const catalog = JSON.parse(readFileSync("data/knowledge/norbin-catalog.generated.json", "utf8"));
const generatedAt = new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* Our assortment                                                             */
/* -------------------------------------------------------------------------- */

function readLocalProducts() {
  const source = readFileSync("lib/carsystem-data.ts", "utf8");
  const starts = [...source.matchAll(/\n\s*slug:\s*"([a-z0-9-]+)"/g)];
  const products = [];

  starts.forEach((start, index) => {
    const body = source.slice(start.index, starts[index + 1]?.index ?? source.length);
    if (!/brandSlug:\s*"norbin"/.test(body)) return;
    products.push({
      slug: start[1],
      name: /name:\s*"([^"]+)"/.exec(body)?.[1],
      sku: /sku:\s*"([^"]+)"/.exec(body)?.[1],
      packages: [...body.matchAll(/label:\s*"([^"]+)"/g)].map((entry) => entry[1]),
      // Our catalogue also prints the manufacturer code in a spec row.
      declaredCode: /value:\s*"(N\d{2}-[A-Z0-9]{3})"/.exec(body)?.[1],
    });
  });

  if (!products.length) throw new Error("No NORBIN products found in lib/carsystem-data.ts");
  return products;
}

const localProducts = readLocalProducts();

/* -------------------------------------------------------------------------- */

const CODE_RE = /\bN\d{2}-[A-Z0-9]{3}\b/;
const PACK_RE = /(\d+(?:[.,]\d+)?)\s*(L|KG|ML|G)\b/i;

const normalise = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "dj")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const packKey = (value) => {
  const match = PACK_RE.exec(String(value ?? ""));
  return match ? `${match[1].replace(",", ".")}${match[2].toUpperCase()}` : undefined;
};

/** Serbian ↔ English product vocabulary, only where the pairing is unambiguous. */
/**
 * `exclude` is what keeps a component out of its parent's concept. Without it
 * "Norbin 2K bezbojni lak" matched "N75-V21 Clear Hardener VOC", because the
 * hardener's name contains the word Clear — the same cross-component leak the
 * document pipeline guards against, arriving through the matcher instead.
 */
const VOCABULARY = [
  {
    local: /bezbojni lak|lak\b|klarlak/i,
    official: /clear/i,
    exclude: /hardener|härter|thinner|reducer|activator/i,
    concept: "clearcoat",
  },
  {
    local: /prajmer|temelj/i,
    official: /primer/i,
    exclude: /hardener|härter|thinner|reducer|activator/i,
    concept: "primer",
  },
  { local: /ocvrscivac|učvršćivač|ucvrscivac|hardener/i, official: /hardener/i, concept: "hardener" },
  { local: /razred/i, official: /thinner|reducer/i, concept: "thinner" },
  {
    local: /kit\b|git\b/i,
    official: /body filler|filler/i,
    exclude: /hardener|härter/i,
    concept: "filler",
  },
];

const byCode = new Map(catalog.products.map((product) => [product.code, product]));

function tokenOverlap(a, b) {
  const left = new Set(normalise(a).split(" ").filter((token) => token.length > 2));
  const right = new Set(normalise(b).split(" ").filter((token) => token.length > 2));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return Number((shared / Math.min(left.size, right.size)).toFixed(2));
}

const matches = localProducts.map((local) => {
  const evidence = [];

  // Stage 1 — exact code, from our own record or its name.
  const code = local.declaredCode ?? CODE_RE.exec(`${local.name} ${local.sku}`)?.[0];
  const official = code ? byCode.get(code) : undefined;

  if (official) {
    evidence.push(`Šifra \`${code}\` je zapisana kod nas i postoji u katalogu proizvođača.`);

    const ourPack = local.packages.map(packKey).find(Boolean);
    const variant = official.variants.find((entry) => packKey(entry.packSize) === ourPack);
    if (ourPack) {
      evidence.push(
        variant
          ? `Pakovanje ${ourPack} postoji kod proizvođača (bezbednosni list za tu veličinu).`
          : `Pakovanje ${ourPack} nije navedeno kod proizvođača — postoje: ${official.variants.map((entry) => entry.packSize).join(", ") || "nijedno"}.`,
      );
    }

    return {
      localSlug: local.slug,
      localName: local.name,
      localSku: local.sku,
      localPackages: local.packages,
      confidence: "exact-code",
      searchStage: "declared-code",
      code,
      // Pack size corroborates; it never turns one product into two.
      variantMatched: variant?.packSize,
      variantMatchesManufacturer: Boolean(variant),
      candidateCount: 1,
      applied: false,
      candidates: [
        {
          code: official.code,
          officialName: official.officialName,
          availability: official.availability,
          regions: official.regions,
          variants: official.variants.map((entry) => entry.packSize),
          tdsDocuments: official.tdsDocuments,
          sdsDocuments: official.sdsDocuments,
          nameSimilarity: tokenOverlap(local.name, official.officialName),
        },
      ],
      evidence,
    };
  }

  // Stage 2+ — name evidence inside the concept the local name declares.
  const concepts = VOCABULARY.filter((entry) => entry.local.test(local.name ?? ""));
  const pool = catalog.products.filter((product) =>
    concepts.some(
      (concept) =>
        concept.official.test(product.officialName ?? "") &&
        !(concept.exclude && concept.exclude.test(product.officialName ?? "")),
    ),
  );

  if (concepts.length) {
    evidence.push(`Naš naziv označava: ${concepts.map((entry) => entry.concept).join(", ")}.`);
  }

  const candidates = pool.map((product) => ({
    code: product.code,
    officialName: product.officialName,
    availability: product.availability,
    regions: product.regions,
    variants: product.variants.map((entry) => entry.packSize),
    tdsDocuments: product.tdsDocuments,
    sdsDocuments: product.sdsDocuments,
    nameSimilarity: tokenOverlap(local.name, product.officialName),
  }));

  let confidence;
  if (!candidates.length) {
    confidence = "unmatched";
    evidence.push("Nema kandidata u zvaničnom katalogu.");
  } else if (candidates.length === 1) {
    confidence = "probable";
    evidence.push("Jedan kandidat po konceptu naziva; šifra nije potvrđena.");
  } else {
    confidence = "ambiguous";
    evidence.push(`${candidates.length} kandidata dele isti koncept; naziv kod nas je generički i ne bira nijedan.`);
  }

  return {
    localSlug: local.slug,
    localName: local.name,
    localSku: local.sku,
    localPackages: local.packages,
    confidence,
    searchStage: candidates.length ? "concept-name" : "exhausted",
    candidateCount: candidates.length,
    applied: false,
    candidates: candidates.sort((a, b) => b.nameSimilarity - a.nameSimilarity),
    evidence,
  };
});

const byConfidence = {};
for (const row of matches) byConfidence[row.confidence] = (byConfidence[row.confidence] ?? 0) + 1;

const matchedCodes = new Set(matches.flatMap((row) => row.candidates.map((candidate) => candidate.code)));

/** Everything else stays a candidate; being listed is not an offer. */
const manufacturerOnly = catalog.products
  .filter((product) => !matchedCodes.has(product.code))
  .map((product) => ({
    code: product.code,
    officialName: product.officialName,
    availability: product.availability,
    regions: product.regions,
    catalogStatus: "manufacturer-catalog-candidate",
    soldByCarsystem: false,
  }));

const summary = {
  generatedAt,
  brand: "NORBIN",
  manufacturer: "BASF Coatings GmbH",
  ourProducts: localProducts.length,
  manufacturerProducts: catalog.products.length,
  byConfidence,
  reliable: matches.filter((row) => ["exact-code", "exact-name", "normalized-code", "cross-family-exact"].includes(row.confidence)).length,
  ambiguous: matches.filter((row) => row.confidence === "ambiguous").length,
  unmatched: matches.filter((row) => row.confidence === "unmatched").length,
  manufacturerOnlyCandidates: manufacturerOnly.length,
  bareNumericAcceptances: 0,
  appliedToPublicCatalogue: 0,
  // Our two N15-020 records are one manufacturer product in two pack sizes.
  localRecordsSharingOneCode: matches.filter((row) => row.code).length,
  distinctCodesMatched: new Set(matches.map((row) => row.code).filter(Boolean)).size,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/norbin-match.generated.json",
  `${JSON.stringify({ summary, matches, manufacturerOnly }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
