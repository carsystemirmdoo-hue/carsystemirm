#!/usr/bin/env node
/**
 * Regression guard for the catalog client payload.
 *
 * The catalog used to ship the whole `CarsystemProduct` — PDP prose, documents,
 * specifications, relationships and Cosmos acquisition metadata — 832 times,
 * plus a second copy per rendered card. Nothing stops that from creeping back
 * except a check that fails when it does.
 *
 * Two layers:
 *   1. source — the listing DTO in `lib/catalog-listing.ts` must not declare a
 *      forbidden field, and `/katalog` must not fall back to the rich
 *      `toProductListingProduct` adapter;
 *   2. runtime — when a dev/preview server is reachable, the serialised RSC
 *      payload of `/katalog` must not contain a forbidden key at all.
 *
 * Usage:
 *   node scripts/validate-catalog-payload.mjs [--base-url=http://localhost:3100]
 */

import { readFileSync } from "node:fs";

import { loadCatalogRuntime } from "./lib/catalog-runtime.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const baseUrl = args["base-url"] ?? "http://localhost:3100";

/** Fields that belong to the PDP model and must never reach the catalog. */
const FORBIDDEN_FIELDS = [
  "longDescription",
  "purpose",
  "documents",
  "specifications",
  "relatedProductSlugs",
  "recommendations",
  "galleryImages",
  "detail",
  "catalogMetadata",
  "sourceReference",
  "verificationStatus",
  "seoDescription",
];

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

/* -- 1. Source ------------------------------------------------------------- */

const listing = readFileSync("lib/catalog-listing.ts", "utf8");
const typeBlocks = [
  ...listing.matchAll(/export type Catalog(?:Listing|Variant)Entity = \{[\s\S]*?\n\};/g),
].map((match) => match[0]);

expect(typeBlocks.length >= 2, "Listing DTO tipovi nisu pronađeni u lib/catalog-listing.ts.");

for (const field of FORBIDDEN_FIELDS) {
  for (const block of typeBlocks) {
    expect(
      !new RegExp(`^\\s*${field}[?]?:`, "m").test(block),
      `Zabranjeno polje \`${field}\` je vraćeno u listing DTO.`,
    );
  }
}

const catalogRoute = readFileSync("app/katalog/page.tsx", "utf8");
expect(
  !catalogRoute.includes("toProductListingProduct"),
  "/katalog ponovo koristi rich `toProductListingProduct` model.",
);
expect(
  catalogRoute.includes("getCatalogListingData"),
  "/katalog ne koristi canonical listing model.",
);

/* -- 2. Runtime ------------------------------------------------------------ */

let runtimeChecked = false;
const response = await fetch(`${baseUrl}/katalog`).catch(() => null);

if (response?.ok) {
  runtimeChecked = true;
  const html = await response.text();
  const flight = [
    ...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g),
  ]
    .map((match) => JSON.parse(`"${match[1]}"`))
    .join("");

  for (const field of FORBIDDEN_FIELDS) {
    const hits = flight.split(`"${field}"`).length - 1;
    expect(hits === 0, `\`${field}\` se pojavljuje ${hits}× u serijalizovanom payload-u.`);
  }

  /* Varijante ne smeju biti u početnom payload-u — dovlače se lenjo. */
  expect(
    !html.includes("search-index"),
    "Početni /katalog referiše search indeks (preload/prefetch ili inline).",
  );
  /*
   * `accent` i `imageSrc` postoje samo na `CatalogVariantEntity`, pa je njihovo
   * prisustvo nedvosmislen dokaz da su se varijante vratile u početni payload.
   * (`familySlug` nije upotrebljiv za ovu proveru — nose ga i family entiteti.)
   */
  for (const variantOnlyField of ["accent", "imageSrc"]) {
    const hits = flight.split(`"${variantOnlyField}"`).length - 1;
    expect(
      hits === 0,
      `Variant zapisi su se vratili u početni Catalog RSC payload (\`${variantOnlyField}\` ×${hits}).`,
    );
  }

  /*
   * Granica se MERI, ne pamti: fiksnih „< 400” je važilo dok je katalog imao
   * ~220 canonical entiteta i palo bi na svaki legitiman rast asortimana
   * (Carsystem sync je doneo 404 samostalna proizvoda). Ono što se čuva je
   * odnos — payload nosi canonical entitete (uz malu rezervu za ponovljen
   * ključ u RSC toku), a nikad canonical + varijante.
   */
  const { listing } = loadCatalogRuntime();
  const canonical = listing.canonical.length;
  const entityCount = flight.split('"kind"').length - 1;
  expect(
    entityCount > 0 && entityCount <= Math.ceil(canonical * 1.15) && entityCount < canonical + listing.variants.length,
    `Neočekivan broj serijalizovanih listing entiteta: ${entityCount} (canonical: ${canonical}, varijanti: ${listing.variants.length}). ` +
      "Browse payload treba da nosi canonical entitete, ne sve varijante.",
  );

  console.log(
    JSON.stringify(
      { runtime: true, serializedFlightBytes: flight.length, listingEntities: entityCount },
      null,
      2,
    ),
  );
}

if (failures.length) {
  console.error(`Catalog payload guard nije prošao (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  runtimeChecked
    ? "Catalog payload guard: source + runtime provere prolaze."
    : `Catalog payload guard: source provere prolaze (server na ${baseUrl} nije dostupan, runtime provera preskočena).`,
);
