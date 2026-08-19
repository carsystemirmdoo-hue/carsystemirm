#!/usr/bin/env node
/**
 * Phase 5 — Carsystem official product image acquisition.
 *
 * Images come from the manufacturer's own TYPO3 file store
 * (`carsystem.org/fileadmin/_processed_`). No reseller or search-engine images.
 *
 * Two things make selection non-trivial and are handled explicitly:
 *
 *   1. Every product page also renders thumbnails of the "Weitere Produkte"
 *      block, so most of a page's images belong to *other* products. The
 *      manufacturer names files after the article number, so the product's own
 *      packshot is identified by matching its article numbers — not by taking
 *      the first image on the page.
 *
 *   2. TYPO3 emits several processed sizes of one original. Deduplication is by
 *      content hash after download.
 *
 * Staged outside `public/`; nothing is published and no existing site image is
 * touched.
 *
 * Output:
 *   assets/manufacturer/carsystem/images/*
 *   data/knowledge/carsystem-images.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const catalog = JSON.parse(
  readFileSync("data/knowledge/carsystem-catalog.generated.json", "utf8"),
);

const OUT_DIR = "assets/manufacturer/carsystem/images";
const MANIFEST = "data/knowledge/carsystem-images.generated.json";
const accessedAt = new Date().toISOString();
const CONCURRENCY = 4;

mkdirSync(OUT_DIR, { recursive: true });

/** PNG/JPEG intrinsic size read from the header rather than assumed. */
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
  // WebP: RIFF container, dimensions live in the VP8/VP8L/VP8X chunk.
  if (
    buffer.subarray(0, 4).toString() === "RIFF" &&
    buffer.subarray(8, 12).toString() === "WEBP"
  ) {
    const chunk = buffer.subarray(12, 16).toString();
    if (chunk === "VP8X") {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
    if (chunk === "VP8 ") {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }
  return {};
}

/* -- Select each product's own packshot ------------------------------------- */

const targets = [];
let noOwnImage = 0;

for (const product of catalog.products) {
  const squashedArticles = product.articleNumbers.map((article) =>
    article.replace(/\./g, ""),
  );

  const own = product.imageUrls.filter((url) => {
    const file = decodeURIComponent(url.split("/").pop() ?? "").toLowerCase();
    const squashedFile = file.replace(/[^a-z0-9]/g, "");
    return (
      product.articleNumbers.some((article) => file.includes(article.toLowerCase())) ||
      squashedArticles.some((article) => article.length >= 5 && squashedFile.includes(article))
    );
  });

  if (!own.length) {
    noOwnImage += 1;
    continue;
  }

  targets.push({
    productSlug: product.slug,
    officialName: product.officialName,
    category: product.category,
    productPageUrl: product.sourceUrl,
    // Largest processed variant available; TYPO3 does not expose the original.
    imageUrl: own[0],
    allOwnImages: own,
  });
}

console.log(
  `Slike: ${targets.length} proizvoda sa sopstvenim packshot-om, ${noOwnImage} bez.`,
);

/* -- Download --------------------------------------------------------------- */

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index]);
      }
    }),
  );
}

const byHash = new Map();
const images = [];
let downloaded = 0;
let reused = 0;
let failed = 0;
let deduped = 0;

await mapLimit(targets, CONCURRENCY, async (target) => {
  const fileName = decodeURIComponent(target.imageUrl.split("/").pop() ?? "").replace(
    /[^A-Za-z0-9._-]/g,
    "-",
  );
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
    images.push({ ...target, error: String(error.message ?? error), accessedAt });
    return;
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const dimensions = imageDimensions(buffer);
  const firstUse = byHash.get(sha256);
  if (firstUse) deduped += 1;
  else byHash.set(sha256, fileName);

  images.push({
    ...target,
    role: "primary-packshot",
    manufacturer: "Vosschemie GmbH",
    brand: "Carsystem",
    fileName,
    localPath: `${OUT_DIR}/${fileName}`,
    bytes: statSync(filePath).size,
    sha256,
    width: dimensions.width,
    height: dimensions.height,
    format: path.extname(fileName).replace(".", ""),
    duplicateOf: firstUse && firstUse !== fileName ? firstUse : undefined,
    accessedAt,
    published: false,
  });
});

const ok = images.filter((image) => !image.error);

const summary = {
  generatedAt: accessedAt,
  brand: "Carsystem",
  manufacturer: "Vosschemie GmbH",
  sourceHost: "carsystem.org/fileadmin",
  manufacturerProducts: catalog.products.length,
  productsWithOwnImage: targets.length,
  productsWithoutOwnImage: noOwnImage,
  downloaded,
  reusedFromDisk: reused,
  failed,
  distinctByContent: byHash.size,
  duplicateReferences: deduped,
  withDimensions: ok.filter((image) => image.width).length,
  totalBytes: ok.reduce((sum, image) => sum + (image.bytes ?? 0), 0),
  stagingDirectory: OUT_DIR,
  published: false,
};

mkdirSync(path.dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify({ summary, images }, null, 2)}\n`);

console.log(JSON.stringify(summary, null, 2));
