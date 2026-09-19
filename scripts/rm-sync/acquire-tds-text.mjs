#!/usr/bin/env node
/**
 * R-M sync, korak 4 — tekst TDS dokumenata u LOKALNI KEŠ (nije u repozitorijumu, nije hostovanje).
 *
 * PDF se preuzima jednom (keš po URL-u), a tekst se vadi zajedničkim `rm-pdf-text.mjs`.
 * Izlaz je sirov tekst po strani u `.cache/rm-sync/tds-text/<oznaka>.json` — iz njega
 * build-source čita revizije, pakovanja i sistemske odnose. Ništa se ne tumači ovde.
 */

import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import { cachedFetch, mapLimit, readJson, sha256, writeJson } from "../carsystem-sync/lib/http.mjs";
import { extractPdfBatch } from "../lib/rm-pdf-text.mjs";
import { DOCUMENT_CACHE_DIR, PATHS, REPO_ROOT } from "./lib/config.mjs";

const index = readJson(PATHS.rawDocuments);
if (!index) throw new Error("Nedostaje TDS indeks: prvo acquire-tds-index.mjs.");
const TEXT_DIR = path.join(REPO_ROOT, ".cache", "rm-sync", "tds-text");
mkdirSync(TEXT_DIR, { recursive: true });

const fileOf = (document) => path.join(DOCUMENT_CACHE_DIR, `${sha256(Buffer.from(document.url)).slice(0, 16)}.pdf`);
const textOf = (document) => path.join(TEXT_DIR, `${sha256(Buffer.from(document.url)).slice(0, 16)}.json`);

const failures = [];
await mapLimit(index.documents, 5, async (document) => {
  try {
    await cachedFetch(document.url, fileOf(document));
  } catch (error) {
    failures.push({ code: document.code, error: String(error.message) });
  }
});

const pending = index.documents.filter((document) => existsSync(fileOf(document)) && !existsSync(textOf(document)));
for (let start = 0; start < pending.length; start += 25) {
  const batch = pending.slice(start, start + 25);
  const extracted = extractPdfBatch(batch.map(fileOf));
  batch.forEach((document, position) => {
    const result = extracted[position];
    writeJson(textOf(document), { code: document.code, url: document.url, ok: result.ok, meta: result.meta ?? {}, pages: result.pages });
  });
}
console.log(JSON.stringify({ documents: index.documents.length, cachedPdf: index.documents.filter((document) => existsSync(fileOf(document))).length, withText: index.documents.filter((document) => existsSync(textOf(document))).length, failures }, null, 1));
