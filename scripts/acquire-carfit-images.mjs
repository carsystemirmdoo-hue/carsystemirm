#!/usr/bin/env node
/**
 * Phase 5 — C.A.R.FIT product imagery.
 *
 * One packshot per product, taken from the post's featured media at full size.
 * WordPress generates a ladder of resizes (`-300x300`, `-768x768`, `-150x150`)
 * of the same photograph; those are skipped rather than downloaded and
 * deduplicated afterwards, and anything that slips through is caught by the
 * content hash.
 *
 * Staged outside `public/`. Existing site imagery is never touched.
 *
 * Output:
 *   assets/manufacturer/carfit/images/*
 *   data/knowledge/carfit-images.generated.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const API = "https://carfitrepair.com/wp-json/wp/v2";
const OUT_DIR = "assets/manufacturer/carfit/images";
const OUT = "data/knowledge/carfit-images.generated.json";
const CACHE_DIR = ".cache/carfit";
const accessedAt = new Date().toISOString();

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });

const catalog = JSON.parse(readFileSync("data/knowledge/carfit-catalog.generated.json", "utf8"));

async function fetchJson(url, cacheKey) {
  const file = path.join(CACHE_DIR, `${cacheKey}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const response = await fetch(url, {
    headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const data = await response.json();
  writeFileSync(file, JSON.stringify(data));
  return data;
}

const media = [];
for (let page = 1; page <= 2; page += 1) {
  const batch = await fetchJson(`${API}/media?per_page=100&media_type=image&page=${page}`, `media-img-${page}`);
  if (!Array.isArray(batch) || !batch.length) break;
  media.push(...batch);
}
const mediaById = new Map(media.map((item) => [item.id, item]));

/** `foo-300x300.jpg` → a resize of `foo.jpg`; only the original is wanted. */
const isResize = (url) => /-\d{2,4}x\d{2,4}\.(jpe?g|png|webp)$/i.test(url);

const seenHashes = new Map();
const images = [];

for (const product of catalog.products) {
  if (!product.featuredMediaId) {
    images.push({ productSlug: product.slug, productName: product.officialName, error: "no featured image" });
    continue;
  }

  let item = mediaById.get(product.featuredMediaId);
  if (!item) {
    try {
      item = await fetchJson(`${API}/media/${product.featuredMediaId}`, `media-${product.featuredMediaId}`);
    } catch (error) {
      images.push({ productSlug: product.slug, productName: product.officialName, error: error.message });
      continue;
    }
  }

  const imageUrl = item.source_url;
  if (!imageUrl || isResize(imageUrl)) {
    images.push({ productSlug: product.slug, productName: product.officialName, error: "no full-size original" });
    continue;
  }

  const fileName = decodeURIComponent(imageUrl.split("/").pop());
  const localPath = path.join(OUT_DIR, fileName);

  try {
    let buffer;
    let reused = false;
    if (existsSync(localPath) && statSync(localPath).size > 0) {
      buffer = readFileSync(localPath);
      reused = true;
    } else {
      const response = await fetch(imageUrl, {
        headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(localPath, buffer);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const duplicateOf = seenHashes.get(sha256);
    if (!duplicateOf) seenHashes.set(sha256, product.slug);

    images.push({
      productSlug: product.slug,
      productName: product.officialName,
      mediaId: item.id,
      imageUrl,
      fileName,
      localPath,
      bytes: buffer.length,
      sha256,
      // The same photograph is reused across sibling products; recorded rather
      // than silently kept twice.
      duplicateOfProductSlug: duplicateOf,
      width: item.media_details?.width,
      height: item.media_details?.height,
      altText: item.alt_text || undefined,
      reused,
      accessedAt,
      published: false,
    });
  } catch (error) {
    images.push({ productSlug: product.slug, productName: product.officialName, imageUrl, error: error.message });
  }
}

const summary = {
  generatedAt: accessedAt,
  brand: "C.A.R.FIT",
  manufacturer: "August Handel GmbH",
  products: catalog.products.length,
  acquired: images.filter((image) => !image.error).length,
  failed: images.filter((image) => image.error).length,
  withoutFeaturedImage: images.filter((image) => image.error === "no featured image").length,
  distinctByContent: seenHashes.size,
  reusedPhotographs: images.filter((image) => image.duplicateOfProductSlug).length,
  withAltText: images.filter((image) => image.altText).length,
  totalBytes: images.reduce((total, image) => total + (image.bytes ?? 0), 0),
  stagingDirectory: OUT_DIR,
  published: false,
  replacedSiteImagery: 0,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ summary, images }, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
