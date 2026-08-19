#!/usr/bin/env node
/**
 * Phase 5 — Cosmos Lac image acquisition.
 *
 * Downloads one official packshot per product from the manufacturer's own CDN
 * (`cosmoslac.com/wp-content/uploads`). No reseller or search-engine images.
 *
 * Two deduplication passes, because WordPress multiplies every upload:
 *   1. URL-level: resize suffixes (`-300x300`) were already collapsed during
 *      discovery, so only the original is requested.
 *   2. Content-level: identical bytes across products (shared packshots for
 *      colour variants) are stored once and referenced by every product that
 *      uses them.
 *
 * Nothing acquired here is published. Files land in a staging directory
 * deliberately outside `public/`, so no build can serve them by accident.
 *
 * Output:
 *   assets/manufacturer/cosmos-lac/images/*
 *   data/knowledge/cosmos-images.generated.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const catalog = JSON.parse(
  readFileSync("data/knowledge/cosmos-catalog.generated.json", "utf8"),
);

const OUT_DIR = "assets/manufacturer/cosmos-lac/images";
const MANIFEST = "data/knowledge/cosmos-images.generated.json";
const accessedAt = new Date().toISOString();
const CONCURRENCY = 6;

mkdirSync(OUT_DIR, { recursive: true });

const targets = catalog.products
  .filter((product) => product.primaryImageUrl)
  .map((product) => ({
    slug: product.slug,
    family: product.family,
    category: product.category,
    officialName: product.officialName,
    productPageUrl: product.sourceUrl,
    imageUrl: product.primaryImageUrl,
  }));

console.log(`Preuzimanje ${targets.length} zvaničnih packshot slika…`);

/** PNG/JPEG intrinsic size, read from the header rather than assumed. */
function imageDimensions(buffer) {
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  return {};
}

const byHash = new Map();
const records = [];
let downloaded = 0;
let reused = 0;
let deduped = 0;
let failed = 0;

async function handle(target) {
  const fileName = decodeURIComponent(target.imageUrl.split("/").pop() ?? "")
    .replace(/[^A-Za-z0-9._-]/g, "-");
  const filePath = path.join(OUT_DIR, fileName);

  let buffer;
  try {
    if (existsSync(filePath)) {
      buffer = readFileSync(filePath);
      reused += 1;
    } else {
      const response = await fetch(target.imageUrl, {
        headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(filePath, buffer);
      downloaded += 1;
    }
  } catch (error) {
    failed += 1;
    records.push({ ...target, error: String(error.message ?? error), accessedAt });
    return;
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const dimensions = imageDimensions(buffer);
  const firstUse = byHash.get(sha256);
  if (firstUse) deduped += 1;
  else byHash.set(sha256, fileName);

  records.push({
    ...target,
    role: "primary-packshot",
    manufacturer: "Cosmos Lac S.A.",
    brand: "Cosmos Lac",
    fileName,
    localPath: `${OUT_DIR}/${fileName}`,
    bytes: statSync(filePath).size,
    sha256,
    width: dimensions.width,
    height: dimensions.height,
    duplicateOf: firstUse && firstUse !== fileName ? firstUse : undefined,
    accessedAt,
    published: false,
  });
}

let cursor = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < targets.length) {
      const index = cursor;
      cursor += 1;
      await handle(targets[index]);
      if (index % 100 === 0) process.stdout.write(`  ${index}/${targets.length}\n`);
    }
  }),
);

const summary = {
  generatedAt: accessedAt,
  brand: "Cosmos Lac",
  manufacturer: "Cosmos Lac S.A.",
  sourceHost: "cosmoslac.com/wp-content/uploads",
  imagesRequested: targets.length,
  downloaded,
  reusedFromDisk: reused,
  failed,
  distinctByContent: byHash.size,
  duplicateReferences: deduped,
  totalBytes: records.reduce((sum, record) => sum + (record.bytes ?? 0), 0),
  withDimensions: records.filter((record) => record.width).length,
  stagingDirectory: OUT_DIR,
  published: false,
  note:
    "Slike su pripremljene van public/ direktorijuma i nisu objavljene. Postojeće slike na sajtu nisu menjane.",
};

mkdirSync(path.dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify({ summary, images: records }, null, 2)}\n`);

console.log(JSON.stringify(summary, null, 2));
