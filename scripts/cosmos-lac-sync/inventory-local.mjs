#!/usr/bin/env node
/**
 * Cosmos Lac sync — inventar postojećeg kataloga i pomirenje sa zvaničnim izvorom (samo čitanje).
 *
 * Meri se stvarni runtime: 742 zapisa (svaka nijansa je zapis sa svojom adresom) → kartice porodica.
 * Poređenje je DETERMINISTIČKO — po šifri u zvaničnoj adresi i po doslovnom nazivu nijanse, unutar
 * linije koju naša linija imenuje. Sličnost naziva (Jaccard i sl.) se ne koristi.
 *
 *   EXACT_MATCH        šifra (ili RAL) + ista linija → tačno jedna zvanična stranica
 *   HIGH_CONFIDENCE    nema šifre, ali naziv nijanse doslovno stoji u adresi, u istoj liniji, jednoznačno
 *   PROBABLE           jednoznačan pogodak tek VAN očekivane linije
 *   LEGACY_LOCAL_ONLY  zvanični sajt danas nema tu stranicu (zapis potiče iz zvaničnog Brand Kit-a / kataloga)
 *   DUPLICATE          drugi lokalni zapis koji polaže pravo na istu zvaničnu stranicu
 *   UNKNOWN            više zvaničnih kandidata, nijedan ključ ne presuđuje
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, REPO_ROOT } from "./lib/config.mjs";
import { createMatcher } from "./lib/match.mjs";

const source = readJson(PATHS.source);
const local = readJson(PATHS.localDataset);
if (!source || !local) throw new Error("Nedostaje izvor — acquire-website + build-source.");

const match = createMatcher(source, readJson(PATHS.rawSitemap));
const claimed = new Map();

const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const records = local.map((record) => {
  const result = match(record);
  const imageFile = path.join(REPO_ROOT, "public", record.image);
  const row = {
    slug: record.slug,
    baseProductSlug: record.baseProductSlug,
    line: record.line,
    localName: record.officialName,
    cosmosCode: record.cosmosCode,
    ralCode: record.ralCode,
    colorName: record.colorName,
    volume: record.volume,
    classification: result.classification,
    matchedBy: result.by ?? null,
    reason: result.reason ?? null,
    candidates: result.candidates ?? undefined,
    publishedInLocales: result.locales?.map((entry) => entry.locale) ?? undefined,
    sourceLocaleUrls: result.locales?.map((entry) => entry.url) ?? undefined,
    officialUrl: result.official?.url ?? null,
    officialName: result.official?.officialName ?? null,
    officialFamily: result.official?.family ?? null,
    officialPack: result.official?.pack ?? null,
    officialDocument: result.official?.document ?? null,
    image: record.image,
    imageExists: existsSync(imageFile),
    imageBytes: existsSync(imageFile) ? statSync(imageFile).size : 0,
    imageSha256: existsSync(imageFile) ? sha(imageFile) : null,
    imageSource: record.sourceOriginalPath ?? null,
  };
  if (result.official) claimed.set(result.official.url, [...(claimed.get(result.official.url) ?? []), row]);
  return row;
});

// Drugi (i svaki naredni) zapis na istoj zvaničnoj stranici je DUPLICATE — osim kada se razlikuju pakovanjem.
for (const rows of claimed.values()) {
  if (rows.length < 2) continue;
  const volumes = new Set(rows.map((row) => row.volume));
  if (volumes.size === rows.length) { for (const row of rows) row.sharedOfficialPage = "PACK_VARIANTS_OF_ONE_OFFICIAL_PAGE"; continue; }
  for (const row of rows.slice(1)) { row.previousClassification = row.classification; row.classification = "DUPLICATE"; row.duplicateOf = rows[0].slug; }
}

const claimedUrls = new Set(records.filter((row) => row.officialUrl && row.classification !== "DUPLICATE").map((row) => row.officialUrl));
const unclaimed = source.products.filter((product) => !claimedUrls.has(product.url));

/* ── Kartice: stvarni runtime ── */
const runtime = loadCatalogRuntime();
const ours = runtime.products.filter((product) => product.brandSlug === "cosmos-lac");
const cards = runtime.listing.canonical.filter((card) => card.brandSlug === "cosmos-lac");
const groups = new Map();
for (const row of records) groups.set(row.baseProductSlug, [...(groups.get(row.baseProductSlug) ?? []), row]);
const officialBySlug = new Map(source.products.map((product) => [product.url, product]));
const cardRows = [...groups].map(([base, rows]) => {
  const officialProducts = new Set(rows.map((row) => (row.officialUrl ? officialBySlug.get(row.officialUrl).productKey : null)).filter(Boolean));
  const officialFamilies = new Set(rows.map((row) => row.officialFamily).filter(Boolean));
  const counts = rows.reduce((acc, row) => ({ ...acc, [row.classification]: (acc[row.classification] ?? 0) + 1 }), {});
  return { baseProductSlug: base, line: rows[0].line, records: rows.length, classification: counts, officialFamilies: [...officialFamilies], officialProducts: [...officialProducts] };
}).sort((a, b) => a.baseProductSlug.localeCompare(b.baseProductSlug));

/* ── Slike ── */
const bySha = new Map();
for (const row of records) if (row.imageSha256) bySha.set(row.imageSha256, [...(bySha.get(row.imageSha256) ?? []), row.slug]);
const identicalImages = [...bySha.values()].filter((slugs) => slugs.length > 1);

const count = (key) => records.filter((row) => row.classification === key).length;
writeJson(PATHS.inventory, {
  summary: {
    underlyingRecords: ours.length,
    datasetRecords: records.length,
    visibleCards: cards.length,
    redirectOnlyRecords: ours.filter((product) => runtime.variantSlugs.has(product.slug)).length,
    classification: Object.fromEntries(["EXACT_MATCH", "HIGH_CONFIDENCE", "PROBABLE", "LEGACY_LOCAL_ONLY", "DUPLICATE", "UNKNOWN"].map((key) => [key, count(key)])),
    legacyByReason: records.filter((row) => row.classification === "LEGACY_LOCAL_ONLY").reduce((acc, row) => ({ ...acc, [`${row.reason} · ${row.line}`]: (acc[`${row.reason} · ${row.line}`] ?? 0) + 1 }), {}),
    officialShadePages: source.products.length,
    officialClaimed: claimedUrls.size,
    officialUnclaimed: unclaimed.length,
    unclaimedByFamily: unclaimed.reduce((acc, product) => ({ ...acc, [product.family]: (acc[product.family] ?? 0) + 1 }), {}),
    images: { records: records.length, filesPresent: records.filter((row) => row.imageExists).length, distinctFiles: new Set(records.map((row) => row.image)).size, pixelIdenticalGroups: identicalImages.length, recordsInIdenticalGroups: identicalImages.flat().length, withBrandKitSource: records.filter((row) => row.imageSource).length },
  },
  cards: cardRows,
  unclaimedOfficial: unclaimed.map((product) => ({ url: product.url, officialName: product.officialName, family: product.family, productKey: product.productKey, pack: product.pack, isContainer: product.isContainer })),
  identicalImages,
  records,
});
console.log(JSON.stringify(readJson(PATHS.inventory).summary, null, 1));
