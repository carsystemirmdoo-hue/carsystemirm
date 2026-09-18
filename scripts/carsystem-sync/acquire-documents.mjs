#!/usr/bin/env node
/**
 * Carsystem sync · korak 3b — zvanični tehnički listovi (TDS) u lokalni keš.
 *
 * TDS je statičan PDF pod `/fileadmin/products/datasheets/` i sajt ga, kao i
 * postojeće Carsystem TDS-ove, servira lokalno (bez hotlinkinga). SDS se NE
 * preuzima: to je dinamički endpoint po artiklu i jeziku (cHash u URL-u), bez
 * srpskog izdanja — na PDP-u ostaje „dostupno na upit”, kao i do sada.
 *
 * Upotreba: node scripts/carsystem-sync/acquire-documents.mjs [--refresh]
 * Izlaz:    data/carsystem-sync/document-manifest.generated.json
 */

import path from "node:path";

import { CACHE_DIR, PATHS } from "./lib/config.mjs";
import { cachedFetch, mapLimit, readJson, sha256, writeJson } from "./lib/http.mjs";

const refresh = process.argv.includes("--refresh");
const DOCUMENT_CACHE_DIR = path.join(CACHE_DIR, "documents");
export const DOCUMENT_MANIFEST_PATH = path.join(path.dirname(PATHS.imageManifest), "document-manifest.generated.json");

const source = readJson(PATHS.source);
if (!source) throw new Error("Nedostaje source dataset — prvo pokrenuti build-source.");

const jobs = source.products.flatMap((product) =>
  product.documents.filter((doc) => doc.kind === "tds").map((doc) => ({ sourceKey: product.sourceKey, doc })),
);

const failures = [];
const documents = (
  await mapLimit(jobs, 5, async ({ sourceKey, doc }) => {
    const fileName = decodeURIComponent(new URL(doc.url).pathname.split("/").pop()).toLowerCase();
    try {
      const { body } = await cachedFetch(doc.url, path.join(DOCUMENT_CACHE_DIR, fileName), { refresh });
      if (body.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("odgovor nije PDF");
      return { sourceKey, kind: "tds", url: doc.url, title: doc.title, fileName, bytes: body.length, sha256: sha256(body) };
    } catch (error) {
      failures.push({ sourceKey, url: doc.url, error: String(error.message ?? error) });
      return null;
    }
  })
)
  .filter(Boolean)
  .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.fileName.localeCompare(b.fileName));

const summary = {
  sourceHost: "carsystem.org/fileadmin/products/datasheets",
  productsWithTds: new Set(documents.map((doc) => doc.sourceKey)).size,
  documents: documents.length,
  distinctByContent: new Set(documents.map((doc) => doc.sha256)).size,
  totalBytes: documents.reduce((sum, doc) => sum + doc.bytes, 0),
  failures: failures.length,
};

writeJson(DOCUMENT_MANIFEST_PATH, { summary, documents, failures });
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
