#!/usr/bin/env node
/**
 * baslac sync — zvanične slike u LOKALNI KEŠ + manifest (objava je u apply.mjs).
 *
 * Izvor je isključivo `baslac.com`: packshot sa kartice kategorije, u originalnoj
 * veličini (Drupal izvedba stila se skida iz putanje). Bez hotlinka, bez distributera
 * i bez slika trećih strana. Slika se vezuje za šifru samo uz dokaz iz koraka 1.
 *
 * Pozadina se NE uklanja: baslac packshot je bela ili svetla ambalaža sa belom etiketom,
 * pa bi maska „belina povezana sa ivicom” pojela sam proizvod (ista odluka kao kod R-M).
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { cachedFetch, mapLimit, readJson, sha256, writeJson } from "../carsystem-sync/lib/http.mjs";
import { IMAGE_CACHE_DIR, PATHS } from "./lib/config.mjs";

const refresh = process.argv.includes("--refresh");
const source = readJson(PATHS.source);
if (!source) throw new Error("Nedostaje source dataset — `npm run baslac:sync:plan`.");

const wanted = source.products
  .filter((product) => product.status === "CURRENT_ACTIVE" && product.officialImages.length)
  .map((product) => ({ sourceKey: product.sourceKey, code: product.code, url: product.officialImages[0], origin: "website" }));

const images = await mapLimit(wanted, 4, async (image) => {
  const extension = /\.(png|jpe?g|webp)$/i.exec(image.url)?.[1]?.toLowerCase() ?? "img";
  const fileName = `${sha256(Buffer.from(image.url)).slice(0, 16)}.${extension}`;
  try {
    const { body } = await cachedFetch(image.url, path.join(IMAGE_CACHE_DIR, fileName), { refresh });
    return { ...image, fileName, bytes: body.length, sha256: sha256(body) };
  } catch (error) {
    return { ...image, fileName, error: String(error.message) };
  }
});

const ok = images.filter((image) => !image.error && existsSync(path.join(IMAGE_CACHE_DIR, image.fileName)));
const probe = ok.length
  ? JSON.parse(execFileSync("python3", ["-c", `
import json,sys
from PIL import Image
out={}
for f in sys.argv[2:]:
    with Image.open(sys.argv[1]+"/"+f) as im:
        alpha = im.mode in ("RGBA","LA") or "transparency" in im.info
        transparent = False
        if alpha:
            a = im.convert("RGBA").getchannel("A"); transparent = a.getextrema()[0] < 250
        out[f]={"width":im.width,"height":im.height,"mode":im.mode,"hasAlpha":alpha,"hasTransparency":transparent}
print(json.dumps(out))`, IMAGE_CACHE_DIR, ...ok.map((image) => image.fileName)], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }))
  : {};
for (const image of ok) Object.assign(image, probe[image.fileName]);

images.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
const bySha = new Map();
for (const image of ok) bySha.set(image.sha256, [...(bySha.get(image.sha256) ?? []), image.code]);

writeJson(PATHS.imageManifest, {
  meta: {
    sourceHosts: [...new Set(images.map((image) => new URL(image.url).host))],
    records: new Set(images.map((image) => image.sourceKey)).size,
    images: images.length,
    failures: images.filter((image) => image.error).map((image) => ({ code: image.code, error: image.error })),
    withTransparency: ok.filter((image) => image.hasTransparency).length,
    opaque: ok.filter((image) => !image.hasTransparency).length,
    totalBytes: ok.reduce((sum, image) => sum + image.bytes, 0),
    sharedAcrossRecords: [...bySha.entries()].filter(([, codes]) => new Set(codes).size > 1).map(([hash, codes]) => ({ sha256: hash.slice(0, 16), codes: [...new Set(codes)] })),
    note: "pozadina se ne uklanja; brojevi iz imena zvaničnog fajla su brojevi artikala i ne objavljuju se",
  },
  images,
});
console.log(JSON.stringify(readJson(PATHS.imageManifest).meta, null, 1));
