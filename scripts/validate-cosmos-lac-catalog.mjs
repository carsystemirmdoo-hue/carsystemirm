#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataPath = path.join(projectRoot, "data/cosmos-lac-products.generated.json");
const blockedPath = path.join(projectRoot, "data/cosmos-lac-blocked.generated.json");
const summaryPath = path.join(projectRoot, "data/cosmos-lac-summary.generated.json");
const uncertainRoot = path.join(projectRoot, "tmp/cosmos-lac-assets/uncertain");

const requiredStrings = [
  "id",
  "slug",
  "baseProductSlug",
  "variantId",
  "brand",
  "brandSlug",
  "line",
  "officialName",
  "displayNameSr",
  "programSlug",
  "primaryCategory",
  "technicalCategory",
  "image",
  "imageAlt",
  "visualMode",
  "backgroundColor",
  "foregroundTone",
  "colorSource",
  "colorConfidence",
  "verificationStatus",
  "sourceReference",
  "sourceAsset",
  "sourceOriginalPath",
  "sourceSha256",
  "productionSha256",
  "visualTreatment",
  "shortDescription",
  "seoTitle",
  "seoDescription",
];

const allowedCategories = new Set(["priprema", "podloga", "boja", "lak", "poliranje"]);
const allowedPrograms = new Set([
  "aerosoli",
  "boje-i-lakovi",
  "priprema-povrsine",
  "potrosni-materijal",
]);
const allowedForegroundTones = new Set(["light", "dark"]);
const allowedColorSources = new Set([
  "official-chart",
  "ral",
  "cap-sample",
  "name-derived",
  "manual-estimate",
]);
const allowedColorConfidence = new Set(["verified", "derived", "provisional"]);
const deprecatedVisualFields = [
  "backgroundBase",
  "backgroundLight",
  "backgroundDark",
  "colorMappingSource",
  "colorMappingConfidence",
];

function fail(message) {
  throw new Error(message);
}

function assertUnique(records, field) {
  const seen = new Map();
  for (const record of records) {
    const value = record[field];
    if (seen.has(value)) {
      fail(`Duplicate ${field} "${value}" in ${seen.get(value)} and ${record.sourceAsset}`);
    }
    seen.set(value, record.sourceAsset);
  }
}

function assertHex(value, label) {
  if (!/^#[0-9A-F]{6}$/.test(value)) fail(`Invalid ${label}: ${value}`);
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function assertRalColorSemantics(record) {
  if (!record.ralCode || !record.colorName) return;
  const name = record.colorName.toLowerCase();
  const luminance = relativeLuminance(record.backgroundColor);
  if (name.includes("white") && luminance < 0.6) {
    fail(`RAL white mapped to a dark color for ${record.slug}: ${record.backgroundColor}`);
  }
  if (name.includes("black") && luminance > 0.22) {
    fail(`RAL black mapped to a light color for ${record.slug}: ${record.backgroundColor}`);
  }
}

async function sha256(filePath) {
  const contents = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(contents).digest("hex");
}

async function countFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) count += await countFiles(path.join(root, entry.name));
    else if (entry.isFile()) count += 1;
  }
  return count;
}

async function forEachConcurrent(items, concurrency, worker) {
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
}

function assertKnownConflictsExcluded(record) {
  const source = record.sourceOriginalPath.toLowerCase();
  const forbidden = [
    /ral.*9003.*matt/,
    /wood-varnish-(374|375)/,
    /acrylic-varnish-(376|377|378)/,
    /high-heat-(350|351|353)-.*container/,
    /flame.*orange.*fo-314/,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(source)) fail(`Known conflict was published: ${record.sourceOriginalPath}`);
  }
  if (record.cosmosCode === "FO-313" && !/fo-313-cherry-dark/i.test(record.sourceOriginalPath)) {
    fail(`FO-313 is not mapped to the chart-confirmed Cherry Dark source: ${record.sourceAsset}`);
  }
}

function duplicateSignature(record) {
  return [
    record.cosmosCode ?? "",
    record.colorName ?? "",
    record.finish ?? "",
  ].join("|");
}

function assertDocumentedDuplicateHashes(records) {
  const groups = new Map();
  for (const record of records) {
    const group = groups.get(record.productionSha256) ?? [];
    group.push(record);
    groups.set(record.productionSha256, group);
  }
  const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
  const allowedGroups = new Set([
    ["FB-3000|Transparent White|providna", "FB-900|Pure White|"].sort().join("::"),
    ["FB-3004|Transparent Black|providna", "FB-904|Deep Black|"].sort().join("::"),
    ["FO-901|Thick Black|", "FO-904|Deep Black|"].sort().join("::"),
    ["10|Black|mat", "10|Black|sjaj"].sort().join("::"),
    ["10|White|mat", "10|White|sjaj"].sort().join("::"),
  ]);
  for (const group of duplicateGroups) {
    const signature = group.map(duplicateSignature).sort().join("::");
    if (!allowedGroups.has(signature)) {
      fail(`Undocumented duplicate production hash: ${signature}`);
    }
    const groupIds = new Set(group.map((record) => record.duplicateImageGroup));
    if (groupIds.size !== 1 || groupIds.has(undefined)) {
      fail(`Duplicate hash has no stable resolution group: ${signature}`);
    }
    for (const record of group) {
      if (!record.duplicateImageResolution?.trim()) {
        fail(`Duplicate hash has no documented resolution: ${record.slug}`);
      }
    }
  }
  if (duplicateGroups.length !== allowedGroups.size) {
    fail(`Expected ${allowedGroups.size} documented duplicate groups, found ${duplicateGroups.length}`);
  }
}

async function main() {
  const [records, blocked, summary] = await Promise.all(
    [dataPath, blockedPath, summaryPath].map((filePath) =>
      fs.readFile(filePath, "utf8").then(JSON.parse),
    ),
  );

  if (!Array.isArray(records) || records.length === 0) fail("Published dataset is empty.");
  if (!Array.isArray(blocked)) fail("Blocked dataset is not an array.");
  assertUnique(records, "id");
  assertUnique(records, "slug");
  assertUnique(records, "variantId");
  assertUnique(records, "sourceSha256");
  assertDocumentedDuplicateHashes(records);

  const skuVariants = new Set();
  for (const record of records) {
    for (const field of requiredStrings) {
      if (typeof record[field] !== "string" || !record[field].trim()) {
        fail(`Missing ${field} for ${record.slug || record.sourceAsset || "unknown record"}`);
      }
    }
    if (record.brand !== "Cosmos Lac" || record.brandSlug !== "cosmos-lac") {
      fail(`Invalid brand for ${record.slug}`);
    }
    if (!allowedCategories.has(record.primaryCategory)) {
      fail(`Invalid Carsystem category for ${record.slug}: ${record.primaryCategory}`);
    }
    if (!allowedPrograms.has(record.programSlug)) {
      fail(`Invalid program for ${record.slug}: ${record.programSlug}`);
    }
    if (!allowedForegroundTones.has(record.foregroundTone)) {
      fail(`Missing foreground tone for ${record.slug}`);
    }
    if (record.visualMode !== "color-on-hover") {
      fail(`Invalid visual mode for ${record.slug}: ${record.visualMode}`);
    }
    if (!allowedColorSources.has(record.colorSource)) {
      fail(`Invalid color source for ${record.slug}: ${record.colorSource}`);
    }
    if (!allowedColorConfidence.has(record.colorConfidence)) {
      fail(`Invalid color confidence for ${record.slug}: ${record.colorConfidence}`);
    }
    for (const field of deprecatedVisualFields) {
      if (field in record) fail(`Deprecated visual field ${field} found in ${record.slug}`);
    }
    assertHex(record.backgroundColor, `${record.slug} backgroundColor`);
    assertRalColorSemantics(record);
    if (!record.image.startsWith("/products/cosmos-lac/") || record.image.includes("..")) {
      fail(`Invalid public image path for ${record.slug}: ${record.image}`);
    }
    if (
      !record.sourceAsset.startsWith("tmp/cosmos-lac-assets/selected-products/") ||
      record.sourceAsset.toLowerCase().includes("uncertain")
    ) {
      fail(`Forbidden source asset for ${record.slug}: ${record.sourceAsset}`);
    }
    if (!record.seoTitle.includes(record.officialName) || record.seoDescription.length < 60) {
      fail(`Incomplete SEO content for ${record.slug}`);
    }
    const skuVariantKey = [
      record.line,
      record.cosmosCode ?? "no-code",
      record.ralCode ?? "no-ral",
      record.colorName ?? "no-color",
      record.finish ?? "no-finish",
      record.volume ?? "no-volume",
      record.variantId,
    ].join("|");
    if (skuVariants.has(skuVariantKey)) fail(`Duplicate SKU/variant combination: ${skuVariantKey}`);
    skuVariants.add(skuVariantKey);
    assertKnownConflictsExcluded(record);
  }

  await forEachConcurrent(records, 12, async (record) => {
    const publicPath = path.join(projectRoot, "public", record.image);
    const sourcePath = path.join(projectRoot, record.sourceAsset);
    const [metadata, publicHash, sourceHash] = await Promise.all([
      sharp(publicPath).metadata(),
      sha256(publicPath),
      sha256(sourcePath),
    ]);
    if (metadata.width !== 800 || metadata.height !== 800 || !metadata.hasAlpha) {
      fail(`Invalid image dimensions or alpha for ${record.image}`);
    }
    if (publicHash !== record.productionSha256) {
      fail(`Production hash mismatch for ${record.image}`);
    }
    if (sourceHash !== record.sourceSha256) {
      fail(`Source hash mismatch for ${record.sourceAsset}`);
    }
  });

  const uncertainCount = await countFiles(uncertainRoot);
  if (uncertainCount !== 34) fail(`Expected 34 uncertain files, found ${uncertainCount}`);
  if (summary.publishedEntries !== records.length || summary.variants !== records.length) {
    fail("Summary counts do not match the published dataset.");
  }
  if (summary.blockedSelectedImages !== blocked.length) {
    fail("Summary blocked count does not match the blocked dataset.");
  }
  if (summary.excludedUncertainImages !== uncertainCount) {
    fail("Summary uncertain count does not match the source folder.");
  }
  if (summary.pixelIdenticalImageGroups !== 5 || summary.pixelIdenticalPublishedImages !== 10) {
    fail("Summary does not document the five resolved pixel-identical image groups.");
  }
  for (const record of blocked) {
    if (!record.sourceAsset.startsWith("tmp/cosmos-lac-assets/selected-products/")) {
      fail(`Invalid blocked source path: ${record.sourceAsset}`);
    }
    if (!record.reason?.trim()) fail(`Blocked record has no reason: ${record.sourceAsset}`);
  }

  console.log(
    `Cosmos Lac validation passed: ${records.length} published variants, ${blocked.length} blocked selected assets, ${uncertainCount} uncertain files excluded.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
