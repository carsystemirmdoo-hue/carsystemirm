#!/usr/bin/env node
/**
 * Phase 5 — Carsystem official document acquisition.
 *
 * Two document types, kept strictly apart because they are not equivalent:
 *
 *   TDS — "Technisches Merkblatt", one per product, linked directly.
 *   SDS — "Sicherheitsdatenblatt", one per *article number*, resolved through
 *         a per-row endpoint whose cHash is embedded in the page and cannot be
 *         guessed.
 *
 * A marketing catalogue is never filed as a TDS. Classification comes from
 * where the link was found on the manufacturer's own page, not from the file
 * name.
 *
 * Assets land outside `public/` so no build can serve them.
 *
 * Output:
 *   assets/manufacturer/carsystem/documents/*
 *   data/knowledge/carsystem-documents.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const catalog = JSON.parse(
  readFileSync("data/knowledge/carsystem-catalog.generated.json", "utf8"),
);

const OUT_DIR = "assets/manufacturer/carsystem/documents";
const MANIFEST = "data/knowledge/carsystem-documents.generated.json";
const ORIGIN = "https://www.carsystem.org";
const accessedAt = new Date().toISOString();
/**
 * Serial. The SDS endpoint throttles aggressively: three parallel workers lost
 * 194 of 264, and four concurrent processes lost 253. One at a time with
 * backoff is slower but produces a number that reflects reality rather than
 * rate limiting.
 */
const CONCURRENCY = 1;

mkdirSync(OUT_DIR, { recursive: true });

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch with backoff.
 *
 * The SDS endpoints resolve reliably one at a time but the server throttles a
 * fast parallel sweep; a first run lost 194 of 264 to transient failures that
 * were indistinguishable from "no SDS exists". Retrying makes the difference
 * between a real gap and a rate limit observable.
 */
async function fetchText(url, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    } catch (error) {
      lastError = error;
      await sleep(700 * 2 ** attempt);
    }
  }
  throw lastError;
}

/* -- 1. Build the download list --------------------------------------------- */

const targets = [];

for (const product of catalog.products) {
  if (product.tdsUrl) {
    targets.push({
      documentType: "tds",
      documentTypeLabel: "Technisches Merkblatt",
      sourceUrl: product.tdsUrl,
      productSlug: product.slug,
      productName: product.officialName,
      category: product.category,
      language: "de",
      appliesTo: "product",
    });
  }
  for (const variant of product.variants) {
    if (!variant.sdsEndpoint) continue;
    targets.push({
      documentType: "sds",
      documentTypeLabel: "Sicherheitsdatenblatt",
      // Resolved in step 2 — the endpoint returns a link, not the PDF.
      endpoint: variant.sdsEndpoint,
      productSlug: product.slug,
      productName: product.officialName,
      category: product.category,
      articleNumber: variant.articleNumber,
      language: "de",
      appliesTo: "article",
    });
  }
}

const tdsTargets = targets.filter((target) => target.documentType === "tds");
const sdsTargets = targets.filter((target) => target.documentType === "sds");

console.log(
  `Za preuzimanje: ${tdsTargets.length} TDS (po proizvodu), ${sdsTargets.length} SDS (po artiklu).`,
);

/* -- 2. Resolve SDS endpoints ----------------------------------------------- */

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index], index);
      }
    }),
  );
}

let resolved = 0;
let resolveFailed = 0;
await mapLimit(sdsTargets, CONCURRENCY, async (target) => {
  try {
    const html = await fetchText(target.endpoint);
    const href = /href="([^"]+\.pdf)"/i.exec(html)?.[1];
    if (!href) {
      target.error = "Endpoint nije vratio link ka PDF-u.";
      resolveFailed += 1;
      return;
    }
    target.sourceUrl = href.startsWith("http") ? href : `${ORIGIN}${href}`;
    resolved += 1;
  } catch (error) {
    target.error = `Razrešavanje endpointa: ${error.message ?? error}`;
    resolveFailed += 1;
  }
});

console.log(`SDS endpointi razrešeni: ${resolved}, neuspelo: ${resolveFailed}.`);

/* -- 3. Download ------------------------------------------------------------ */

const documents = [];
const byHash = new Map();
let downloaded = 0;
let reused = 0;
let failed = 0;
let deduped = 0;

// Targets that never resolved are recorded as gaps rather than dropped —
// a silently missing SDS is indistinguishable from one that does not exist.
for (const target of targets.filter((item) => item.error)) {
  documents.push({ ...target, accessedAt, resolved: false });
}

const downloadable = targets.filter((target) => target.sourceUrl && !target.error);

await mapLimit(downloadable, CONCURRENCY, async (target) => {
  const fileName = decodeURIComponent(target.sourceUrl.split("/").pop() ?? "").replace(
    /[^A-Za-z0-9._-]/g,
    "-",
  );
  const filePath = path.join(OUT_DIR, fileName);

  let buffer;
  try {
    if (existsSync(filePath)) {
      buffer = readFileSync(filePath);
      reused += 1;
    } else {
      buffer = await fetchBuffer(target.sourceUrl);
      // Reject anything that is not actually a PDF; a soft-404 HTML page
      // filed as a TDS would be worse than a missing document.
      if (buffer.subarray(0, 5).toString() !== "%PDF-") {
        throw new Error("odgovor nije PDF");
      }
      writeFileSync(filePath, buffer);
      downloaded += 1;
    }
  } catch (error) {
    failed += 1;
    documents.push({ ...target, error: String(error.message ?? error), accessedAt });
    return;
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const firstUse = byHash.get(sha256);
  if (firstUse) deduped += 1;
  else byHash.set(sha256, fileName);

  // Revision, where the manufacturer encodes it in the file name (…-v01.pdf).
  const revision = /-v(\d+)\.pdf$/i.exec(fileName)?.[1];

  documents.push({
    ...target,
    manufacturer: "Vosschemie GmbH",
    brand: "Carsystem",
    fileName,
    localPath: `${OUT_DIR}/${fileName}`,
    bytes: statSync(filePath).size,
    sha256,
    revision: revision ? `v${revision}` : undefined,
    mimeType: "application/pdf",
    accessedAt,
    duplicateOf: firstUse && firstUse !== fileName ? firstUse : undefined,
    published: false,
  });
});

const ok = documents.filter((document) => !document.error);
const unresolved = documents.filter((document) => document.resolved === false);

const summary = {
  generatedAt: accessedAt,
  brand: "Carsystem",
  manufacturer: "Vosschemie GmbH",
  tdsTargets: tdsTargets.length,
  sdsTargets: sdsTargets.length,
  sdsEndpointsResolved: resolved,
  sdsEndpointsFailed: resolveFailed,
  sdsEndpointsRecordedAsGaps: unresolved.length,
  downloaded,
  reusedFromDisk: reused,
  failed,
  duplicateReferences: deduped,
  distinctByContent: byHash.size,
  totalBytes: ok.reduce((sum, document) => sum + (document.bytes ?? 0), 0),
  byType: {
    tds: ok.filter((document) => document.documentType === "tds").length,
    sds: ok.filter((document) => document.documentType === "sds").length,
  },
  productsWithTds: new Set(
    ok.filter((d) => d.documentType === "tds").map((d) => d.productSlug),
  ).size,
  productsWithSds: new Set(
    ok.filter((d) => d.documentType === "sds").map((d) => d.productSlug),
  ).size,
  stagingDirectory: OUT_DIR,
  published: false,
};

mkdirSync(path.dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify({ summary, documents }, null, 2)}\n`);

console.log(JSON.stringify(summary, null, 2));
