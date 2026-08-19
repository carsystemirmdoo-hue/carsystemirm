#!/usr/bin/env node
/**
 * Validator jedinstvenog search indeksa + staleness guard.
 *
 * Nasleđuje `validate-catalog-variant-index.mjs`: indeks je i dalje
 * prerenderovan iz `getCatalogListingData()` (sada kroz
 * `lib/search/buildSearchIndex.ts`), pa strukturno ne može da odluta od listing
 * modela — ali može da postane zastareo u odnosu na podatke o proizvodima ako
 * je build stariji od izvora. Provera ide u OBA smera: nijedan proizvod ne sme
 * da nedostaje u indeksu, i nijedan obrisan zapis ne sme da ostane u njemu.
 *
 * Zahteva pokrenut dev/preview server (ili `next start` nad `build:check`
 * izlazom); namerno ga ne pokreće sam, jer dva Next procesa ne smeju da dele
 * dist direktorijum.
 *
 * Usage: node scripts/validate-catalog-search-index.mjs [--base-url=…]
 */

import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const baseUrl = args["base-url"] ?? "http://localhost:3100";
const INDEX_PATH = "/katalog/search-index.json";

/**
 * PDP sadržaj koji asset pretrage ne sme da nosi. Isti spisak stoji i u
 * `lib/search/buildSearchIndex.ts` — tamo kao namera, ovde kao provera koja
 * pada.
 */
const FORBIDDEN_FIELDS = [
  "longDescription",
  "shortDescription",
  "purpose",
  "detail",
  "documents",
  "specifications",
  "recommendations",
  "relatedProductSlugs",
  "galleryImages",
  "packages",
  "catalogMetadata",
  "sourceReference",
  "verificationStatus",
  "seoDescription",
];

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

/* -- Očekivani model, izveden iz istih generisanih podataka ---------------- */

const cosmosRaw = JSON.parse(
  readFileSync("data/cosmos-lac-products.generated.json", "utf8"),
);
const cosmos = Array.isArray(cosmosRaw) ? cosmosRaw : cosmosRaw.products;

const groups = new Map();
for (const record of cosmos) {
  const bucket = groups.get(record.baseProductSlug) ?? [];
  bucket.push(record);
  groups.set(record.baseProductSlug, bucket);
}
const families = [...groups.values()].filter((variants) => variants.length >= 2);
const expectedVariantSlugs = new Set(
  families.flatMap((variants) => variants.map((variant) => variant.slug)),
);
const expectedVariantCount = expectedVariantSlugs.size;
const expectedFamilyCount = families.length;

/* -- Preuzimanje ----------------------------------------------------------- */

const first = await fetch(`${baseUrl}${INDEX_PATH}`).catch(() => null);
if (!first?.ok) {
  console.error(
    `Search indeks nije dostupan na ${baseUrl}${INDEX_PATH}. Pokreni postojeći dev/preview server pa ponovi — ovaj skript ga namerno ne pokreće.`,
  );
  process.exit(1);
}

const firstText = await first.text();
const payload = JSON.parse(firstText);
const records = payload.records ?? [];

expect(payload.schemaVersion === 1, `Neočekivana schemaVersion: ${payload.schemaVersion}.`);

const byKind = { family: [], standalone: [], variant: [] };
for (const record of records) {
  if (!byKind[record.kind]) {
    failures.push(`Nepoznat \`kind\`: ${record.kind} (${record.id}).`);
    continue;
  }
  byKind[record.kind].push(record);
}

expect(
  byKind.family.length === expectedFamilyCount,
  `Očekivano ${expectedFamilyCount} family zapisa, pronađeno ${byKind.family.length}.`,
);
expect(
  byKind.variant.length === expectedVariantCount,
  `Očekivano ${expectedVariantCount} variant zapisa, pronađeno ${byKind.variant.length}.`,
);
expect(
  byKind.standalone.length === 117,
  `Očekivano 117 samostalnih zapisa, pronađeno ${byKind.standalone.length}.`,
);
expect(
  payload.counts?.total === records.length,
  `\`counts.total\` (${payload.counts?.total}) ne odgovara broju zapisa (${records.length}).`,
);
expect(
  payload.counts?.family === byKind.family.length &&
    payload.counts?.standalone === byKind.standalone.length &&
    payload.counts?.variant === byKind.variant.length,
  "`counts` ne odgovara stvarnom broju zapisa po vrsti.",
);

/* -- Identiteti i rute ----------------------------------------------------- */

const ids = records.map((record) => record.id);
expect(new Set(ids).size === ids.length, "ID vrednosti nisu jedinstvene.");

for (const record of records) {
  expect(Boolean(record.href), `Zapis \`${record.id}\` nema href.`);
  expect(Boolean(record.name), `Zapis \`${record.id}\` nema naziv.`);
  if (record.kind === "variant") {
    expect(
      record.href === `/proizvodi/${record.id}`,
      `Variant \`${record.id}\` ima neočekivan href: ${record.href}.`,
    );
    expect(
      Boolean(record.familySlug),
      `Variant \`${record.id}\` nema roditeljsku porodicu.`,
    );
  }
  if (record.kind === "standalone") {
    expect(
      record.href === `/proizvodi/${record.id}`,
      `Samostalni zapis \`${record.id}\` ima neočekivan href: ${record.href}.`,
    );
  }
  if (record.kind === "family") {
    expect(
      record.href.startsWith("/proizvodi/grupa/"),
      `Family \`${record.id}\` ima neočekivan href: ${record.href}.`,
    );
  }
}

const familySlugs = new Set(byKind.variant.map((record) => record.familySlug));
expect(
  familySlugs.size === expectedFamilyCount,
  `Očekivano ${expectedFamilyCount} roditeljskih porodica, pronađeno ${familySlugs.size}.`,
);

/* -- Staleness u oba smera ------------------------------------------------- */

const variantIds = new Set(byKind.variant.map((record) => record.id));
const unknown = [...variantIds].filter((slug) => !expectedVariantSlugs.has(slug));
expect(
  unknown.length === 0,
  `Indeks sadrži ${unknown.length} zapisa kojih nema u trenutnom modelu (npr. ${unknown[0]}). Indeks je zastareo — ponovo pokreni build.`,
);
const missing = [...expectedVariantSlugs].filter((slug) => !variantIds.has(slug));
expect(
  missing.length === 0,
  `Modelu nedostaje ${missing.length} zapisa u indeksu (npr. ${missing[0]}). Indeks je zastareo.`,
);

/* -- Zabranjena rich polja ------------------------------------------------- */

for (const field of FORBIDDEN_FIELDS) {
  const hits = firstText.split(`"${field}"`).length - 1;
  expect(hits === 0, `Zabranjeno polje \`${field}\` se pojavljuje ${hits}× u indeksu.`);
}

/* -- Determinizam ---------------------------------------------------------- */

const second = await fetch(`${baseUrl}${INDEX_PATH}`);
const secondText = await second.text();
expect(
  firstText === secondText,
  "Indeks nije deterministički — dva uzastopna zahteva daju različit sadržaj.",
);

/* -- Početni payload ------------------------------------------------------- */

const catalog = await fetch(`${baseUrl}/katalog`);
const catalogHtml = await catalog.text();
expect(
  !catalogHtml.includes("search-index"),
  "Početni /katalog HTML referiše search indeks (preload/prefetch ili inline payload).",
);

const home = await fetch(`${baseUrl}/`);
const homeHtml = await home.text();
expect(
  !homeHtml.includes("search-index"),
  "Početni Homepage HTML referiše search indeks — asset mora ostati lenj.",
);

if (failures.length) {
  console.error(`Validacija search indeksa nije prošla (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      records: records.length,
      family: byKind.family.length,
      standalone: byKind.standalone.length,
      variant: byKind.variant.length,
      rawBytes: Buffer.byteLength(firstText),
      gzipBytes: gzipSync(Buffer.from(firstText)).length,
      deterministic: true,
      referencedByInitialCatalog: false,
      referencedByInitialHome: false,
    },
    null,
    2,
  ),
);
