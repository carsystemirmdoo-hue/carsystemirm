#!/usr/bin/env node
/**
 * BEFAR sync, korak 4 — zvanične slike u lokalni keš + manifest.
 *
 * Izvor je isključivo Wix medijska biblioteka zvaničnog sajta
 * (`static.wixstatic.com/media/446a5e_…`), preko medijskog ID-ja koji nosi blok
 * proizvoda. Preuzima se ista kompozicija koju proizvođač prikazuje: kada blok
 * nosi isečak (`crop`), traži se TAJ isečak u punoj rezoluciji (najviše 1600 px),
 * a ne umanjena sličica sa stranice; slajdovi galerije se preuzimaju celi.
 *
 * Ništa se ovde ne objavljuje u `public/` — to radi apply.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

import { cachedFetch, mapLimit, readJson, sha256, writeJson } from "../carsystem-sync/lib/http.mjs";
import { IMAGE_CACHE_DIR, PATHS, WEBSITE } from "./lib/config.mjs";

const refresh = process.argv.includes("--refresh");
export const MAX_IMAGES_PER_PRODUCT = 3;
const MAX_COLOUR_SLIDES = 8;
const COLOUR_IN_TITLE = /\b(white|orange|black|yellow|blue|cream|burgundy|claret red|red|green|grey)\b/i;
const MAX_SIDE = 1600;

const source = readJson(PATHS.source);
if (!source) throw new Error("Nedostaje source dataset — prvo pokrenuti build-source.");

function officialUrl(image) {
  const extension = /\.(\w+)$/.exec(image.mediaId)?.[1] ?? "jpg";
  if (image.crop) {
    const scale = Math.min(1, MAX_SIDE / Math.max(image.crop.w, image.crop.h));
    const width = Math.round(image.crop.w * scale);
    const height = Math.round(image.crop.h * scale);
    return `${WEBSITE.mediaHost}${image.mediaId}/v1/crop/x_${image.crop.x},y_${image.crop.y},w_${image.crop.w},h_${image.crop.h}/fill/w_${width},h_${height},al_c,q_90/image.${extension}`;
  }
  return `${WEBSITE.mediaHost}${image.mediaId}/v1/fit/w_${MAX_SIDE},h_${MAX_SIDE},q_90/image.${extension}`;
}

const jobs = [];
for (const product of source.products) {
  // Glavne (grupne) fotografije + slajdovi čiji naslov nosi BOJU: oni postaju slike varijanti te boje.
  const colourSlides = product.images.filter((image) => COLOUR_IN_TITLE.test(image.title ?? ""));
  const general = product.images.filter((image) => !colourSlides.includes(image));
  const selected = [...(general.length ? general : colourSlides).slice(0, MAX_IMAGES_PER_PRODUCT), ...(general.length ? colourSlides : colourSlides.slice(MAX_IMAGES_PER_PRODUCT)).slice(0, MAX_COLOUR_SLIDES)];
  selected.forEach((image, index) => jobs.push({ sourceKey: product.sourceKey, index, image, url: officialUrl(image) }));
}

const failures = [];
let downloaded = 0;
const entries = await mapLimit(jobs, 4, async ({ sourceKey, index, image, url }) => {
  const cropKey = image.crop ? `__c${image.crop.x}-${image.crop.y}-${image.crop.w}-${image.crop.h}` : "";
  const fileName = `${image.mediaId.replace(/~mv2/, "").replace(/\.(\w+)$/, "")}${cropKey}.${/\.(\w+)$/.exec(image.mediaId)?.[1] ?? "jpg"}`;
  try {
    const { body, fromCache } = await cachedFetch(url, path.join(IMAGE_CACHE_DIR, fileName), { refresh });
    if (!fromCache) downloaded += 1;
    return { sourceKey, role: index === 0 ? "primary" : "gallery", index, mediaId: image.mediaId, crop: image.crop, title: image.title ?? null, url, fileName, bytes: body.length, sha256: sha256(body) };
  } catch (error) {
    failures.push({ sourceKey, url, error: String(error.message ?? error) });
    return null;
  }
});
const images = entries.filter(Boolean);

const probe = JSON.parse(
  execFileSync(
    "python3",
    ["-c", `
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
`],
    { input: [...new Set(images.map((image) => path.join(IMAGE_CACHE_DIR, image.fileName)))].join("\n"), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ),
);
for (const image of images) Object.assign(image, probe[path.join(IMAGE_CACHE_DIR, image.fileName)] ?? {});
images.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.index - b.index);

const bySha = new Map();
for (const image of images) bySha.set(image.sha256, [...(bySha.get(image.sha256) ?? []), image.sourceKey]);

const summary = {
  sourceHost: "static.wixstatic.com/media (medijska biblioteka befar.com.tr)",
  productsWithImages: new Set(images.map((image) => image.sourceKey)).size,
  productsWithoutImages: source.products.filter((product) => !images.some((image) => image.sourceKey === product.sourceKey)).map((product) => product.sourceKey),
  images: images.length,
  distinctByContent: bySha.size,
  sharedAcrossProducts: [...bySha.entries()].filter(([, keys]) => new Set(keys).size > 1).map(([hash, keys]) => ({ sha256: hash.slice(0, 16), products: [...new Set(keys)] })),
  totalBytes: images.reduce((sum, image) => sum + image.bytes, 0),
  failures: failures.length,
};
writeJson(PATHS.imageManifest, { summary, images, failures });
console.log(JSON.stringify({ ...summary, sharedAcrossProducts: summary.sharedAcrossProducts.length, downloaded }, null, 2));
if (failures.length) process.exitCode = 1;
