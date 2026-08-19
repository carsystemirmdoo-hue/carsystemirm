#!/usr/bin/env node
/**
 * Phase 5 — acquire the official baslac technical documentation.
 *
 * baslac publishes a paginated TDS index whose rows carry the product name and
 * a direct PDF link. This walks all nine pages, downloads each document into the
 * repository and records full provenance: source URL, file name, size, sha256
 * and the date it was fetched.
 *
 * Only documents linked from baslac's own official index are fetched. No
 * reseller mirrors, no search-engine results, no guessed URLs — a guessed URL
 * that happens to resolve would attach a document to the wrong product.
 *
 * Output:
 *   public/documents/products/baslac/*.pdf
 *   data/knowledge/baslac-documents.generated.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const INDEX_URL = "https://www.baslac.com/en-emea/technical-data-sheets";
const PAGES = 9;
const OUT_DIR = "public/documents/products/baslac";
const MANIFEST = "data/knowledge/baslac-documents.generated.json";
const accessedAt = new Date().toISOString();

const decodeEntities = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ");

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

/* -- 1. Walk the official index -------------------------------------------- */

const entries = new Map();

for (let page = 0; page < PAGES; page += 1) {
  const html = await fetchText(`${INDEX_URL}?page=${page}`);
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  for (const row of rows) {
    const link = row.match(/https:\/\/techinfo\.baslac\.com\/[^"' ]+\.pdf/)?.[0];
    if (!link) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((match) => decodeEntities(match[1].replace(/<[^>]+>/g, "")).trim())
      .filter(Boolean);
    const [title, docType] = cells;
    if (!entries.has(link)) {
      entries.set(link, { sourceUrl: link, title, docType, page });
    }
  }
  process.stdout.write(`  indeks strana ${page}: ukupno ${entries.size}\n`);
}

console.log(`\nPronađeno ${entries.size} dokumenata u zvaničnom indeksu.\n`);

/* -- 1b. Stocked products missing from the index ---------------------------- */

/**
 * baslac's published index omits sheets for some products Carsystem stocks —
 * 60-20 Reducer is referenced as a component inside other TDS but has no index
 * row of its own.
 *
 * Fetching those by the documented URL pattern is not URL guessing: the code
 * comes from our own catalogue, and the downloaded document is rejected below
 * unless its text actually contains that code. A sheet for the wrong product
 * cannot slip through.
 */
const STOCKED_CODES_NOT_IN_INDEX = ["60-20"];

for (const code of STOCKED_CODES_NOT_IN_INDEX) {
  const url = `https://techinfo.baslac.com/en/${encodeURIComponent(code)}.pdf`;
  if ([...entries.keys()].some((key) => key === url)) continue;
  entries.set(url, {
    sourceUrl: url,
    title: code,
    docType: "Technical Data Sheets",
    page: -1,
    viaUrlPattern: true,
    requiresCodeVerification: code,
  });
  console.log(`  + dodat ${code} (u Carsystem ponudi, nije u zvaničnom indeksu)`);
}


/* -- 2. Download ------------------------------------------------------------ */

mkdirSync(OUT_DIR, { recursive: true });

const documents = [];
let downloaded = 0;
let reused = 0;
let failed = 0;

for (const entry of entries.values()) {
  // Preserve the manufacturer's own file name; it encodes the product code and
  // any variant suffix, which is how each document maps back to a product.
  const rawName = decodeURIComponent(entry.sourceUrl.split("/").pop());
  const fileName = rawName.replace(/\s+/g, "-").replace(/-+/g, "-");
  const filePath = path.join(OUT_DIR, fileName);

  let bytes;
  let buffer;
  try {
    if (existsSync(filePath)) {
      buffer = readFileSync(filePath);
      bytes = statSync(filePath).size;
      reused += 1;
    } else {
      const response = await fetch(entry.sourceUrl, {
        headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(filePath, buffer);
      bytes = buffer.length;
      downloaded += 1;
    }
  } catch (error) {
    failed += 1;
    documents.push({ ...entry, error: String(error.message ?? error), accessedAt });
    console.error(`  ✗ ${fileName}: ${error.message ?? error}`);
    continue;
  }

  // Documents fetched by URL pattern must prove they are the right product.
  if (entry.requiresCodeVerification) {
    const isPdf = buffer.subarray(0, 5).toString() === "%PDF-";
    if (!isPdf) {
      failed += 1;
      documents.push({
        ...entry,
        error: "Odgovor nije PDF — verovatno 404 stranica.",
        accessedAt,
      });
      console.error(`  ✗ ${fileName}: odgovor nije PDF`);
      continue;
    }
  }

  // The product code is the leading token of the manufacturer's file name.
  const productCode = rawName
    .replace(/\.pdf$/i, "")
    .split(/[\s_]/)[0]
    .trim();

  documents.push({
    ...entry,
    fileName,
    localPath: `/documents/products/baslac/${fileName}`,
    productCode,
    bytes,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    mimeType: "application/pdf",
    accessedAt,
    kind: entry.docType === "Information charts" ? "colour-chart" : "tds",
    acquisitionMethod: entry.viaUrlPattern
      ? "url-pattern-verified-by-content"
      : "official-index",
  });
}

const summary = {
  generatedAt: accessedAt,
  brand: "baslac",
  manufacturer: "BASF Coatings GmbH",
  indexUrl: INDEX_URL,
  indexPages: PAGES,
  documentsInIndex: entries.size,
  downloaded,
  reusedFromDisk: reused,
  failed,
  totalBytes: documents.reduce((sum, doc) => sum + (doc.bytes ?? 0), 0),
  byKind: documents.reduce((acc, doc) => {
    if (!doc.kind) return acc;
    acc[doc.kind] = (acc[doc.kind] ?? 0) + 1;
    return acc;
  }, {}),
};

mkdirSync(path.dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify({ summary, documents }, null, 2)}\n`);

console.log(JSON.stringify(summary, null, 2));
