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

import { spawnSync } from "node:child_process";
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

/* -- Očekivani model, iz trenutnih izvora kataloga ------------------------- */

/*
 * Model se ne rekonstruiše iz jednog generisanog JSON-a (to je poznavalo samo
 * Cosmos porodice), nego iz iste TypeScript implementacije koju koristi ruta,
 * pokrenute nad TRENUTNIM izvorima kroz `tsx`. Servirani indeks dolazi iz
 * build-a, pa razlika između ta dva i dalje znači „indeks je zastareo".
 */
const modelRun = spawnSync(
  process.execPath,
  [
    "node_modules/tsx/dist/cli.mjs",
    "--tsconfig",
    "tsconfig.json",
    "scripts/qa/print-search-model.mts",
  ],
  {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    // `server-only` baca grešku van Next runtime-a; pod `react-server`
    // uslovom paket izvozi prazan modul, isto kao u RSC okruženju. Ide kroz
    // NODE_OPTIONS jer tsx ponovo pokreće node i ne prosleđuje argv zastavice.
    env: { ...process.env, NODE_OPTIONS: "--conditions=react-server" },
  },
);
if (modelRun.status !== 0) {
  console.error("Ne mogu da izgradim očekivani model search indeksa:");
  console.error(modelRun.stderr || modelRun.stdout);
  process.exit(1);
}
const model = JSON.parse(modelRun.stdout);
const expectedById = new Map(model.records.map((record) => [record.id, record]));
const expectedByKind = { family: 0, standalone: 0, variant: 0 };
for (const record of model.records) expectedByKind[record.kind] += 1;
const expectedFamilyCount = expectedByKind.family;
const expectedVariantCount = expectedByKind.variant;

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
  byKind.standalone.length === expectedByKind.standalone,
  `Očekivano ${expectedByKind.standalone} samostalnih zapisa, pronađeno ${byKind.standalone.length}.`,
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

const familyIds = new Set(byKind.family.map((record) => record.familySlug));
for (const record of records) {
  expect(Boolean(record.href), `Zapis \`${record.id}\` nema href.`);
  expect(Boolean(record.name), `Zapis \`${record.id}\` nema naziv.`);
  const expected = expectedById.get(record.id);
  if (!expected) continue; // prijavljuje se dole, kao zastareo zapis
  expect(
    record.kind === expected.kind,
    `Zapis \`${record.id}\` je \`${record.kind}\`, a model kaže \`${expected.kind}\`.`,
  );
  expect(
    record.href === expected.href,
    `Zapis \`${record.id}\` ima href ${record.href}, a model kaže ${expected.href}.`,
  );
  if (record.kind === "variant") {
    expect(
      Boolean(record.familySlug) && familyIds.has(record.familySlug),
      `Variant \`${record.id}\` referiše porodicu koje nema u indeksu: ${record.familySlug}.`,
    );
    expect(
      /\/proizvodi\/(grupa\/[a-z0-9-]+\?varijanta=[^&]+|[a-z0-9-]+)$/.test(record.href),
      `Variant \`${record.id}\` ima neočekivan href: ${record.href}.`,
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

const servedIds = new Set(ids);
const unknown = ids.filter((id) => !expectedById.has(id));
expect(
  unknown.length === 0,
  `Indeks sadrži ${unknown.length} zapisa kojih nema u trenutnom modelu (npr. ${unknown[0]}). Indeks je zastareo — ponovo pokreni build.`,
);
const missing = [...expectedById.keys()].filter((id) => !servedIds.has(id));
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
