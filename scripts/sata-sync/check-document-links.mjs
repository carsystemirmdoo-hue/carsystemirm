#!/usr/bin/env node
/**
 * SATA sync — provera veza dokumenata (MREŽA; nije deo `npm test`).
 *
 * Sajt vodi SATA dokumente na stranicu porodice (`sourceUrl`), jer se adrese fajlova menjaju
 * (vidi `docs/SATA_CATALOG_SYNC.md` › Dokumenti). Ovde se proverava ono na šta se to oslanja:
 *   1. svaka stranica porodice sa dokumentom odgovara 200;
 *   2. svaki dokument je i dalje ponuđen na njoj — po imenu fajla, bez heša i `?ts=`.
 * Zastarela doslovna adresa u datasetu se samo broji (`staleRecordedFileUrls`), nije greška.
 */

import { readFileSync } from "node:fs";

import { PATHS, USER_AGENT } from "./lib/config.mjs";

const dataset = JSON.parse(readFileSync(PATHS.siteDataset, "utf8"));
const entries = [...dataset.products, ...Object.values(dataset.enrichments ?? {})].filter((entry) => entry.documents.length);
const fileName = (href) => new URL(href).pathname.split("/").pop();

async function get(url) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "follow" });
  return { status: response.status, body: response.ok ? await response.text() : "" };
}

const failures = [];
let staleRecordedFileUrls = 0;
let documents = 0;
for (const entry of entries) {
  const page = await get(entry.sourceUrl);
  if (page.status !== 200) {
    failures.push({ slug: entry.slug, code: "PRODUCT_PAGE_NOT_200", url: entry.sourceUrl, status: page.status });
    continue;
  }
  const offered = new Set([...page.body.matchAll(/https:\/\/www\.sata\.com\/media\/[^"'\s<>]+/g)].map((match) => fileName(match[0].replaceAll("&amp;", "&"))));
  for (const document of entry.documents) {
    documents += 1;
    if (!offered.has(fileName(document.href))) failures.push({ slug: entry.slug, code: "DOCUMENT_NOT_ON_PRODUCT_PAGE", file: fileName(document.href) });
    else if (!page.body.includes(document.href.replaceAll("&", "&amp;")) && !page.body.includes(document.href)) staleRecordedFileUrls += 1;
  }
}

console.log(JSON.stringify({ productPages: entries.length, documents, staleRecordedFileUrls, failures }, null, 1));
if (failures.length) process.exitCode = 1;
