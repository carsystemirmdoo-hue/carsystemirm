#!/usr/bin/env node
/**
 * Carsystem sync · korak 3 — zvanični packshotovi u lokalni keš + manifest.
 *
 * Preuzima se zvanični 660 px render (`/fileadmin/_processed_/…`), isti onaj
 * koji postojeći Carsystem proizvodi na sajtu već koriste. `data-zoom-image`
 * originali su štamparski fajlovi (izmereno do 43 MB po slici) i ne preuzimaju
 * se; URL originala ostaje u source datasetu radi sledljivosti.
 *
 * Manifest nosi sha256 SVAKOG zvaničnog fajla. To je i dokaz pri matchingu
 * (naša slika bajt-identična zvaničnom packshotu = isti proizvod) i osnova
 * deduplikacije: isti sadržaj se objavljuje jednom.
 *
 * Ovde se ništa ne objavljuje u `public/` — to radi apply, samo za proizvode
 * koji zaista ulaze u katalog.
 *
 * Upotreba: node scripts/carsystem-sync/acquire-images.mjs [--refresh]
 * Izlaz:    data/carsystem-sync/image-manifest.generated.json
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

import { IMAGE_CACHE_DIR, PATHS } from "./lib/config.mjs";
import { cachedFetch, mapLimit, readJson, sha256, writeJson } from "./lib/http.mjs";

const refresh = process.argv.includes("--refresh");
/** Glavna slika + najviše dve dodatne: dovoljno za PDP galeriju, bez gomilanja. */
export const MAX_IMAGES_PER_PRODUCT = 3;

const source = readJson(PATHS.source);
if (!source) throw new Error("Nedostaje source dataset — prvo pokrenuti build-source.");

const jobs = [];
for (const product of source.products) {
  product.images.slice(0, MAX_IMAGES_PER_PRODUCT).forEach((image, index) => {
    if (!image.processedUrl) return;
    jobs.push({ sourceKey: product.sourceKey, index, image });
  });
}

let downloaded = 0;
const failures = [];
const entries = await mapLimit(jobs, 6, async ({ sourceKey, index, image }) => {
  const fileName = decodeURIComponent(new URL(image.processedUrl).pathname.split("/").pop());
  const cachePath = path.join(IMAGE_CACHE_DIR, fileName);
  try {
    const { body, fromCache } = await cachedFetch(image.processedUrl, cachePath, { refresh });
    if (!fromCache) downloaded += 1;
    return {
      sourceKey,
      role: index === 0 ? "primary" : "gallery",
      index,
      processedUrl: image.processedUrl,
      originalUrl: image.originalUrl,
      fileName,
      bytes: body.length,
      sha256: sha256(body),
    };
  } catch (error) {
    failures.push({ sourceKey, url: image.processedUrl, error: String(error.message ?? error) });
    return null;
  }
});

const images = entries.filter(Boolean);

// Dimenzije i alfa kanal: PIL je već toolchain projekta (images:metrics).
const probe = JSON.parse(
  execFileSync(
    "python3",
    [
      "-c",
      `
import json, sys
from PIL import Image
out = {}
for path in sys.stdin.read().split("\\n"):
    if not path: continue
    try:
        with Image.open(path) as im:
            alpha = im.mode in ("RGBA", "LA") or "transparency" in im.info
            out[path] = {"width": im.width, "height": im.height, "format": im.format, "hasAlpha": bool(alpha)}
    except Exception as exc:
        out[path] = {"error": str(exc)}
print(json.dumps(out))
`,
    ],
    {
      input: [...new Set(images.map((image) => path.join(IMAGE_CACHE_DIR, image.fileName)))].join("\n"),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  ),
);

for (const image of images) {
  Object.assign(image, probe[path.join(IMAGE_CACHE_DIR, image.fileName)] ?? {});
}

images.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.index - b.index);

const bySha = new Map();
for (const image of images) bySha.set(image.sha256, (bySha.get(image.sha256) ?? 0) + 1);

const summary = {
  sourceHost: "carsystem.org/fileadmin/_processed_",
  productsWithImages: new Set(images.map((image) => image.sourceKey)).size,
  productsWithoutImages: source.products.filter((product) => !product.images.length).map((product) => product.sourceKey),
  images: images.length,
  distinctByContent: bySha.size,
  sharedAcrossProducts: [...bySha.values()].filter((count) => count > 1).length,
  primaryWithoutAlpha: images.filter((image) => image.role === "primary" && image.hasAlpha === false).length,
  primaryBelow400px: images.filter((image) => image.role === "primary" && Math.max(image.width ?? 0, image.height ?? 0) < 400).length,
  totalBytes: images.reduce((sum, image) => sum + image.bytes, 0),
  failures: failures.length,
};

writeJson(PATHS.imageManifest, { summary, images, failures });
console.log(JSON.stringify({ ...summary, productsWithoutImages: summary.productsWithoutImages.length, downloaded }, null, 2));
if (failures.length) process.exitCode = 1;
