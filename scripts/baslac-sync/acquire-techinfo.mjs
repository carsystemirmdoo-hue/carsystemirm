#!/usr/bin/env node
/**
 * baslac sync, korak 2 — RAW dataset tehničke dokumentacije.
 *
 * Dva sloja dokaza, namerno odvojena:
 *   `index`     — dokumenti koje zvanični sajt LINKUJE (9 strana indeksa; već preuzeti lokalno
 *                 u `public/documents/products/baslac`, popis u `data/knowledge/baslac-documents…`).
 *   `directory` — otvoren `techinfo.baslac.com/en/`. Fajl koji ovde postoji, a nije u indeksu,
 *                 NIJE dokaz aktuelnosti (pravilo iz reconciliation-a).
 *
 * Kategorije fajlova su uzajamno isključive: `_variant`/„A - B" pre `_Line`, pa čista šifra.
 */

import path from "node:path";

import { cachedFetch, readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PAGE_CACHE_DIR, PATHS, REPO_ROOT, SOURCES } from "./lib/config.mjs";

const refresh = process.argv.includes("--refresh");
const dirUrl = `${SOURCES.techinfo.origin}/${SOURCES.techinfo.language}/`;
const { body } = await cachedFetch(dirUrl, path.join(PAGE_CACHE_DIR, "techinfo-en.html"), { refresh });
const files = [...new Set([...body.toString("utf8").matchAll(/<a href="([^"]+\.pdf)"/gi)].map((match) => decodeURIComponent(match[1])))].sort();

const classify = (file) => {
  const name = file.slice(0, -4);
  if (/_variant/.test(name) || /\s-\s/.test(name)) return "variant";
  if (/_Line/.test(name)) return "line";
  if (/^\d{2}-[A-Z]?\d{2,3}$/.test(name)) return "product";
  return "process";
};

const local = readJson(path.join(REPO_ROOT, "data", "knowledge", "baslac-documents.generated.json"), { documents: [] });
const indexed = new Map(local.documents.map((document) => [decodeURIComponent(document.sourceUrl.split("/").pop()), document]));

const documents = files.map((file) => {
  const entry = indexed.get(file) ?? null;
  return {
    file,
    url: `${dirUrl}${encodeURI(file)}`,
    kind: classify(file),
    code: classify(file) === "product" ? file.slice(0, -4) : null,
    linkedFromWebsiteIndex: Boolean(entry),
    localPath: entry?.localPath ?? null,
    bytes: entry?.bytes ?? null,
    title: entry?.title ?? null,
  };
});

const count = (predicate) => documents.filter(predicate).length;
writeJson(PATHS.rawTechinfo, {
  meta: {
    directory: dirUrl,
    websiteIndex: `${SOURCES.website.origin}/${SOURCES.website.locale}/technical-data-sheets`,
    files: documents.length,
    byKind: Object.fromEntries(["product", "variant", "line", "process"].map((kind) => [kind, count((document) => document.kind === kind)])),
    linkedFromWebsiteIndex: count((document) => document.linkedFromWebsiteIndex),
    directoryOnly: documents.filter((document) => !document.linkedFromWebsiteIndex).map((document) => document.file),
    localCopies: count((document) => document.localPath),
    note: "zbir po vrstama = ukupno; `_Line…_variant…` se broji kao variant, ne dvaput",
  },
  documents,
});
console.log(`techinfo: ${documents.length} fajlova (${count((d) => d.kind === "product")} product / ${count((d) => d.kind === "variant")} variant / ${count((d) => d.kind === "line")} line / ${count((d) => d.kind === "process")} process) · ${count((d) => d.linkedFromWebsiteIndex)} linkovano sa sajta`);
