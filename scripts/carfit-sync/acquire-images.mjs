#!/usr/bin/env node
/**
 * C.A.R.FIT sync, korak 4 — zvanične slike u lokalni keš + manifest.
 *
 * Izvor je isključivo medijska biblioteka carfitrepair.com (`wp-content/uploads`):
 * istaknuta slika objave i slike iz sadržaja stranice. Preuzima se original iz
 * medijske biblioteke (`source_url`), ne umanjena WordPress kopija.
 *
 * Manifest nosi sha256 svakog fajla: osnova deduplikacije (isti sadržaj se
 * objavljuje jednom) i dokaz pri matchingu sa našim postojećim slikama.
 *
 * Ovde se ništa ne objavljuje u `public/` — to radi apply, samo za proizvode
 * koji zaista ulaze u katalog.
 *
 *   node scripts/carfit-sync/acquire-images.mjs [--refresh]
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

import { cachedFetch, mapLimit, readJson, sha256, writeJson } from "../carsystem-sync/lib/http.mjs";
import { IMAGE_CACHE_DIR, ORIGIN, PATHS } from "./lib/config.mjs";

const refresh = process.argv.includes("--refresh");
/** Glavna slika + najviše dve dodatne. */
export const MAX_IMAGES_PER_PRODUCT = 3;

const source = readJson(PATHS.source);
if (!source) throw new Error("Nedostaje source dataset — prvo pokrenuti build-source.");

const jobs = [];
for (const product of source.products) {
  product.images.slice(0, MAX_IMAGES_PER_PRODUCT).forEach((image, index) => {
    // Samo zvanični host; sve ostalo (CDN treće strane, data URI) se preskače i prijavljuje.
    if (!image.url?.startsWith(`${ORIGIN}/wp-content/uploads/`)) return;
    jobs.push({ sourceKey: product.sourceKey, index, image });
  });
}

const failures = [];
let downloaded = 0;
const entries = await mapLimit(jobs, 5, async ({ sourceKey, index, image }) => {
  const url = new URL(image.url);
  // Putanja uploada ulazi u ime keš fajla: isti naziv fajla postoji u više meseci.
  const fileName = decodeURIComponent(url.pathname.replace(/^\/wp-content\/uploads\//, "").replace(/\//g, "__"));
  const cachePath = path.join(IMAGE_CACHE_DIR, fileName);
  try {
    const { body, fromCache } = await cachedFetch(image.url, cachePath, { refresh });
    if (!fromCache) downloaded += 1;
    return { sourceKey, role: index === 0 ? "primary" : "gallery", index, url: image.url, attachmentId: image.attachmentId, fileName, bytes: body.length, sha256: sha256(body) };
  } catch (error) {
    failures.push({ sourceKey, url: image.url, error: String(error.message ?? error) });
    return null;
  }
});

const images = entries.filter(Boolean);

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
    { input: [...new Set(images.map((image) => path.join(IMAGE_CACHE_DIR, image.fileName)))].join("\n"), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ),
);
for (const image of images) Object.assign(image, probe[path.join(IMAGE_CACHE_DIR, image.fileName)] ?? {});

images.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.index - b.index);

const bySha = new Map();
for (const image of images) bySha.set(image.sha256, [...(bySha.get(image.sha256) ?? []), image.sourceKey]);

const summary = {
  sourceHost: "carfitrepair.com/wp-content/uploads",
  productsWithImages: new Set(images.map((image) => image.sourceKey)).size,
  productsWithoutImages: source.products.filter((product) => !images.some((image) => image.sourceKey === product.sourceKey)).map((product) => product.sourceKey),
  images: images.length,
  distinctByContent: bySha.size,
  sharedAcrossProducts: [...bySha.entries()].filter(([, keys]) => new Set(keys).size > 1).map(([hash, keys]) => ({ sha256: hash.slice(0, 16), products: [...new Set(keys)] })),
  primaryWithoutAlpha: images.filter((image) => image.role === "primary" && image.hasAlpha === false).length,
  primaryBelow400px: images.filter((image) => image.role === "primary" && Math.max(image.width ?? 0, image.height ?? 0) < 400).map((image) => image.sourceKey),
  totalBytes: images.reduce((sum, image) => sum + image.bytes, 0),
  failures: failures.length,
};

writeJson(PATHS.imageManifest, { summary, images, failures });
console.log(JSON.stringify({ ...summary, downloaded }, null, 2));
if (failures.length) process.exitCode = 1;
