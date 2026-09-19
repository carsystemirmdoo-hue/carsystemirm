#!/usr/bin/env node
/**
 * R-M sync, korak — zvanične slike u LOKALNI KEŠ + manifest (objava je u apply.mjs).
 *
 * Izvor je isključivo R-M: slika pakovanja sa info portala (prioritet — to je packshot sa
 * oznakom proizvoda), a kada je portal nema, slika proizvoda sa rmpaint.com. Slike se
 * preuzimaju samo za zapise koje sync UVOZI; postojeći lokalni zapisi zadržavaju svoje assete.
 * Bez hotlinka i bez slika distributera.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { cachedFetch, mapLimit, readJson, sha256, writeJson } from "../carsystem-sync/lib/http.mjs";
import { IMAGE_CACHE_DIR, PATHS } from "./lib/config.mjs";

const plan = readJson(PATHS.plan);
const source = readJson(PATHS.source);
if (!plan || !source) throw new Error("Nedostaje plan ili source — pokrenuti prethodne korake.");
const refresh = process.argv.includes("--refresh");

const recordByKey = new Map([...source.products, ...source.websiteOnlySystems].map((record) => [record.sourceKey, record]));
const wanted = plan.items.filter((item) => item.action !== "ENRICH_EXISTING").flatMap((item) => {
  const record = recordByKey.get(item.sourceKey);
  const candidates = [record.image ? { origin: "info-portal", url: record.image.url } : null, record.websiteImage ? { origin: "website", url: record.websiteImage.url } : !record.code && record.image ? { origin: "website", url: record.image.url } : null].filter(Boolean);
  // Jedna primarna slika po zapisu: portal, inače sajt.
  return candidates.slice(0, 1).map((candidate) => ({ sourceKey: item.sourceKey, code: item.code, ...candidate }));
});

const images = await mapLimit(wanted, 5, async (image) => {
  const extension = /\.(png|jpe?g|webp)(?:\?|$)/i.exec(image.url)?.[1]?.toLowerCase() ?? "img";
  const fileName = `${sha256(Buffer.from(image.url.split("?")[0])).slice(0, 16)}.${extension}`;
  try {
    const { body } = await cachedFetch(image.url, path.join(IMAGE_CACHE_DIR, fileName), { refresh });
    return { ...image, fileName, bytes: body.length, sha256: sha256(body), index: 0 };
  } catch (error) {
    return { ...image, fileName, error: String(error.message) };
  }
});

// Dimenzije i alfa kanal (Pillow) — odluka o pozadini se donosi u apply koraku.
const ok = images.filter((image) => !image.error && existsSync(path.join(IMAGE_CACHE_DIR, image.fileName)));
const probe = JSON.parse(execFileSync("python3", ["-c", `
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
print(json.dumps(out))`, IMAGE_CACHE_DIR, ...ok.map((image) => image.fileName)], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
for (const image of ok) Object.assign(image, probe[image.fileName]);

images.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
const bySha = new Map();
for (const image of ok) bySha.set(image.sha256, [...(bySha.get(image.sha256) ?? []), image.sourceKey]);

/*
 * Portal isporučuje ISTU sličicu „Image missing” svuda gde fotografije nema.
 * Pravilo je zato sadržajno, ne po imenu fajla: isti bajtovi na TRI ili više zapisa nisu
 * packshot nego zamena portala. (Dva zapisa smeju da dele sliku — AGILIS eSense i njegova
 * X-TREME izvedba zvanično imaju istu fotografiju.)
 */
const PLACEHOLDER_MIN_RECORDS = 3;
const placeholderHashes = new Set([...bySha.entries()].filter(([, keys]) => new Set(keys).size >= PLACEHOLDER_MIN_RECORDS).map(([hash]) => hash));
for (const image of ok) {
  if (!placeholderHashes.has(image.sha256)) continue;
  image.placeholder = true;
  image.placeholderReason = `isti sadržaj na ${new Set(bySha.get(image.sha256)).size} zapisa — zamenska sličica portala, ne fotografija proizvoda`;
}
writeJson(PATHS.imageManifest, {
  meta: {
    sourceHosts: [...new Set(images.map((image) => new URL(image.url).host))],
    records: new Set(images.map((image) => image.sourceKey)).size,
    images: images.length,
    failures: images.filter((image) => image.error).map((image) => ({ code: image.code, error: image.error })),
    byOrigin: Object.fromEntries(["info-portal", "website"].map((origin) => [origin, images.filter((image) => image.origin === origin).length])),
    portalPlaceholders: ok.filter((image) => image.placeholder).length,
    recordsWithoutOfficialImage: [...new Set(images.filter((image) => image.error || image.placeholder).map((image) => image.code ?? image.sourceKey))].sort(),
    usableImages: ok.filter((image) => !image.placeholder).length,
    withTransparency: ok.filter((image) => image.hasTransparency && !image.placeholder).length,
    opaque: ok.filter((image) => !image.hasTransparency && !image.placeholder).length,
    totalBytes: ok.reduce((sum, image) => sum + image.bytes, 0),
    sharedAcrossRecords: [...bySha.entries()].filter(([, keys]) => new Set(keys).size > 1).map(([hash, keys]) => ({ sha256: hash.slice(0, 16), records: [...new Set(keys)], placeholder: placeholderHashes.has(hash) })),
  },
  images,
});
console.log(JSON.stringify(readJson(PATHS.imageManifest).meta, null, 1));
