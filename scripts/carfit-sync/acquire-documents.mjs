#!/usr/bin/env node
/**
 * C.A.R.FIT sync, korak 5 — manifest zvaničnih TDS/SDS dokumenata (bez preuzimanja).
 *
 * Strategija je ista kao za Carsystem i R-M: PDP vodi na ZVANIČNI dokument na
 * sajtu proizvođača. PDF-ovi se ne komituju. Ovaj korak samo proverava da link
 * sa stranice proizvoda stvarno radi (HEAD) i meri ukupnu veličinu, da bi odluka
 * o eventualnom lokalnom hostovanju imala broj, a ne procenu.
 *
 * Mrtav link se ne objavljuje na PDP-u (ostaje u manifestu sa statusom).
 *
 *   node scripts/carfit-sync/acquire-documents.mjs [--refresh]
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { mapLimit, readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { USER_AGENT } from "../carsystem-sync/lib/config.mjs";
import { CACHE_DIR, ORIGIN, PATHS } from "./lib/config.mjs";

const refresh = process.argv.includes("--refresh");
const HEAD_CACHE = path.join(CACHE_DIR, "document-heads.json");

const source = readJson(PATHS.source);
if (!source) throw new Error("Nedostaje source dataset — prvo pokrenuti build-source.");

const cache = !refresh && existsSync(HEAD_CACHE) ? readJson(HEAD_CACHE, {}) : {};

const urls = [...new Set(source.products.flatMap((product) => product.documents.map((document) => document.href)))].sort();

await mapLimit(urls, 5, async (url) => {
  if (cache[url]) return;
  if (!url.startsWith(`${ORIGIN}/`)) {
    cache[url] = { status: null, official: false, error: "nije na zvaničnom hostu" };
    return;
  }
  try {
    const response = await fetch(encodeURI(decodeURI(url)), { method: "HEAD", headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
    cache[url] = {
      status: response.status,
      official: true,
      contentType: response.headers.get("content-type"),
      bytes: Number(response.headers.get("content-length") ?? 0) || null,
      finalUrl: response.url !== url ? response.url : null,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    cache[url] = { status: 0, official: true, error: String(error.message ?? error), checkedAt: new Date().toISOString() };
  }
});
writeJson(HEAD_CACHE, cache);

const documents = [];
for (const product of source.products) {
  for (const document of product.documents) {
    const head = cache[document.href] ?? {};
    documents.push({
      sourceKey: product.sourceKey,
      kind: document.kind,
      label: document.label,
      component: document.component,
      href: document.href,
      fileName: decodeURIComponent(new URL(document.href).pathname.split("/").pop()),
      status: head.status ?? null,
      ok: head.status === 200 && /pdf/i.test(head.contentType ?? ""),
      bytes: head.bytes ?? null,
      checkedAt: head.checkedAt ?? null,
    });
  }
}
documents.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.kind.localeCompare(b.kind) || a.href.localeCompare(b.href));

const distinct = new Map(documents.map((document) => [document.href, document]));
const okDistinct = [...distinct.values()].filter((document) => document.ok);

writeJson(PATHS.documentManifest, {
  summary: {
    strategy: "zvanični linkovi na carfitrepair.com; PDF-ovi se ne hostuju lokalno",
    documentLinks: documents.length,
    distinctUrls: distinct.size,
    working: okDistinct.length,
    broken: [...distinct.values()].filter((document) => !document.ok).map((document) => ({ href: document.href, status: document.status, sourceKey: document.sourceKey })),
    tds: documents.filter((document) => document.kind === "tds" && document.ok).length,
    sds: documents.filter((document) => document.kind === "sds" && document.ok).length,
    productsWithTds: new Set(documents.filter((document) => document.kind === "tds" && document.ok).map((document) => document.sourceKey)).size,
    productsWithSds: new Set(documents.filter((document) => document.kind === "sds" && document.ok).map((document) => document.sourceKey)).size,
    totalBytesIfHostedLocally: okDistinct.reduce((sum, document) => sum + (document.bytes ?? 0), 0),
  },
  documents,
});

const summary = readJson(PATHS.documentManifest).summary;
console.log(
  `documents: ${summary.distinctUrls} linkova, ${summary.working} radi, ${summary.broken.length} ne radi · ` +
    `${(summary.totalBytesIfHostedLocally / 1e6).toFixed(1)} MB kada bi se hostovali lokalno`,
);
