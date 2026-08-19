#!/usr/bin/env node
/**
 * Evidence gathering for the 12-category platform taxonomy.
 *
 * Reconstructs the catalogue's product population from the same three sources
 * `lib/carsystem-data.ts` composes at runtime, and prints the distribution of
 * every field that could carry category evidence. Read-only: it changes
 * nothing and exists so the mapping rules are derived from confirmed product
 * fields rather than from name matching.
 *
 * Fidelity is asserted, not assumed: the reconstruction must total the same
 * 832 records the live model produces, or the script fails.
 */

import { readFileSync } from "node:fs";

const EXPECTED_TOTAL = 832;

const source = readFileSync("lib/carsystem-data.ts", "utf8");

/* -- hand-written records inside productRecords ---------------------------- */

const recordsStart = source.indexOf("const productRecords: CarsystemProduct[] = [");
const recordsBlock = source.slice(recordsStart, source.indexOf("\n];", recordsStart));

const liveSlugs = new Set([
  ...[...recordsBlock.matchAll(/\n\s*slug:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]),
  ...[...recordsBlock.matchAll(/archivedProduct\("([a-z0-9-]+)"\)/g)].map((m) => m[1]),
]);

const starts = [...source.matchAll(/\n\s*slug:\s*"([a-z0-9-]+)"/g)];
const handWritten = [];

starts.forEach((start, index) => {
  const slug = start[1];
  if (!liveSlugs.has(slug)) return;
  const body = source.slice(start.index, starts[index + 1]?.index ?? source.length);
  handWritten.push({
    slug,
    source: "hand-written",
    name: /name:\s*"([^"]+)"/.exec(body)?.[1] ?? "",
    brandSlug: /brandSlug:\s*"([a-z0-9-]+)"/.exec(body)?.[1] ?? "",
    programSlug: /programSlug:\s*"([a-z0-9-]+)"/.exec(body)?.[1] ?? "",
    phaseSlug: /phaseSlug:\s*"([a-z0-9-]+)"/.exec(body)?.[1] ?? "",
    badges: [...(/badges:\s*\[([^\]]*)\]/.exec(body)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      (m) => m[1],
    ),
    rmCategory: /category:\s*"([a-z-]+)"/.exec(body)?.[1] ?? null,
  });
});

/* -- Befar polishing pads (generated in code, 5 colours x 2 sizes) --------- */

const padColours = [...source.matchAll(/\n\s{4}slug:\s*"(narandzasti|crni|plavi|beli|zuti)"/g)].map(
  (m) => m[1],
);
const padSizes = ["25x150", "50x150"];
const befarPads = padColours.flatMap((colour) =>
  padSizes.map((size) => ({
    slug: `befar-sundjer-${colour}-${size}`,
    source: "befar-pad",
    name: `Befar sunđer ${colour} ${size}`,
    brandSlug: "befar",
    programSlug: "poliranje",
    phaseSlug: "poliranje",
    badges: ["Sunđer", "Poliranje"],
    rmCategory: null,
  })),
);

/* -- imported R-M ---------------------------------------------------------- */

const rm = JSON.parse(readFileSync("data/rm-imported-products.generated.json", "utf8"))
  .products.map((product) => ({
    slug: product.slug,
    source: "rm-import",
    name: product.canonicalName,
    brandSlug: "rm",
    programSlug: product.taxonomy.programSlug,
    phaseSlug: product.taxonomy.phaseSlug,
    badges: [],
    rmCategory: product.taxonomy.category,
  }));

/* -- Cosmos Lac ------------------------------------------------------------ */

const cosmosRaw = JSON.parse(
  readFileSync("data/cosmos-lac-products.generated.json", "utf8"),
);
const cosmosRecords = Array.isArray(cosmosRaw) ? cosmosRaw : cosmosRaw.products;
const cosmos = cosmosRecords.map((record) => ({
  slug: record.slug,
  source: "cosmos",
  name: record.displayNameSr,
  brandSlug: "cosmos-lac",
  programSlug: record.programSlug,
  phaseSlug: record.primaryCategory,
  badges: [],
  rmCategory: null,
  line: record.line,
  technicalCategory: record.technicalCategory,
  baseProductSlug: record.baseProductSlug,
  volume: record.volume,
}));

/* -------------------------------------------------------------------------- */

const all = [...rm, ...handWritten, ...befarPads, ...cosmos];

const bySlug = new Map(all.map((product) => [product.slug, product]));
if (bySlug.size !== all.length) {
  console.error(`Duplirani slugovi: ${all.length - bySlug.size}`);
}

console.log(
  JSON.stringify(
    {
      total: all.length,
      expected: EXPECTED_TOTAL,
      matchesLiveModel: all.length === EXPECTED_TOTAL,
      bySource: tally(all, (p) => p.source),
      byBrand: tally(all, (p) => p.brandSlug),
      byProgram: tally(all, (p) => p.programSlug),
      byPhase: tally(all, (p) => p.phaseSlug),
      byRmCategory: tally(
        all.filter((p) => p.rmCategory),
        (p) => p.rmCategory,
      ),
      byTechnicalCategory: tally(
        all.filter((p) => p.technicalCategory),
        (p) => p.technicalCategory,
      ),
      badgeVocabulary: tally(
        all.flatMap((p) => p.badges.filter((badge) => badge !== "Na upit")),
        (badge) => badge,
      ),
    },
    null,
    2,
  ),
);

if (all.length !== EXPECTED_TOTAL) {
  console.error(
    `\nRekonstrukcija (${all.length}) se ne poklapa sa live modelom (${EXPECTED_TOTAL}).`,
  );
  process.exit(1);
}

function tally(items, pick) {
  const counts = {};
  for (const item of items) {
    const key = pick(item);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1]),
  );
}
