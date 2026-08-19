#!/usr/bin/env node
/**
 * Phase 5 — NORBIN document acquisition.
 *
 * The range pages link every document directly, so discovery is already done by
 * the catalogue step; this downloads them, hashes them and classifies them by
 * content rather than by the folder they sit in.
 *
 * Unlinked entries are fetched too, but kept apart. A document the manufacturer
 * commented out of its own page is not part of the published offer, and the
 * distinction survives into the manifest: the file may exist on the server, or
 * it may 404, and either outcome is recorded rather than assumed.
 *
 * Files are staged outside `public/`. Nothing here is published.
 *
 * Output:
 *   assets/manufacturer/norbin/documents/*
 *   data/knowledge/norbin-documents.generated.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { extractPdfBatch } from "./lib/rm-pdf-text.mjs";

const OUT_DIR = "assets/manufacturer/norbin/documents";
const OUT = "data/knowledge/norbin-documents.generated.json";
const accessedAt = new Date().toISOString();

mkdirSync(OUT_DIR, { recursive: true });

const catalog = JSON.parse(readFileSync("data/knowledge/norbin-catalog.generated.json", "utf8"));

/** Every document the catalogue found, plus the brochures and posters. */
const targets = [...catalog.documents, ...catalog.brochures];

/** The same file is linked from several regions; fetch each URL once. */
const byUrl = new Map();
for (const entry of targets) {
  const existing = byUrl.get(entry.sourceUrl);
  if (existing) {
    existing.regions.add(entry.region);
    if (entry.availability === "live") existing.availability = "live";
    existing.labels.add(entry.label);
    continue;
  }
  byUrl.set(entry.sourceUrl, {
    ...entry,
    regions: new Set([entry.region]),
    labels: new Set([entry.label]),
  });
}

async function download(entry) {
  // Two regions can ship different files under the same base name (`TDS/` vs
  // `TDS/TR/`), so the local name keeps the folder that disambiguates them.
  const relative = entry.sourceUrl.replace(/^https?:\/\/[^/]+\/files\//, "").replace(/\//g, "__");
  const fileName = decodeURIComponent(relative);
  const localPath = path.join(OUT_DIR, fileName);

  if (existsSync(localPath) && statSync(localPath).size > 0) {
    const bytes = readFileSync(localPath);
    return {
      ...entry, fileName, localPath, bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"), reused: true,
    };
  }

  try {
    const response = await fetch(entry.sourceUrl, {
      headers: { "User-Agent": "Carsystem-knowledge-acquisition/1.0" },
    });
    if (!response.ok) return { ...entry, fileName, error: `HTTP ${response.status}` };
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
      return { ...entry, fileName, error: "not a PDF" };
    }
    writeFileSync(localPath, buffer);
    return {
      ...entry, fileName, localPath, bytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"), reused: false,
    };
  } catch (error) {
    return { ...entry, fileName, error: error.message };
  }
}

const downloaded = [];
for (const entry of byUrl.values()) {
  downloaded.push(await download(entry));
  await new Promise((resolve) => setTimeout(resolve, 150));
}

/* -------------------------------------------------------------------------- */
/* Classification by content                                                  */
/* -------------------------------------------------------------------------- */

const readable = downloaded.filter((entry) => entry.localPath && !entry.error);
const firstPages = new Map();
const BATCH = 30;
for (let index = 0; index < readable.length; index += BATCH) {
  const slice = readable.slice(index, index + BATCH);
  for (const result of extractPdfBatch(slice.map((entry) => entry.localPath))) {
    firstPages.set(result.path, {
      text: result.ok ? result.pages.slice(0, 3).join("\n") : "",
      pages: result.ok ? result.pages.length : 0,
      meta: result.meta ?? {},
    });
  }
}

/**
 * The folder says `TDS/` or `MSDS/`, but the folder is a filing convention, not
 * evidence. Classification reads the document's own structure — a safety sheet
 * carries numbered regulatory sections and H/P statements, a technical sheet
 * carries application and substrate blocks.
 */
function classify(entry) {
  // Brochures and posters are already typed by the catalogue step from the
  // section they were linked in; they are neither TDS nor SDS.
  if (entry.documentType === "brochure" || entry.documentType === "technical-poster") {
    return { documentType: entry.documentType, confidence: "source-section" };
  }

  const extracted = firstPages.get(entry.localPath);
  const head = (extracted?.text ?? "").slice(0, 6000);
  if (!head.trim()) return { documentType: "unreadable", confidence: "content" };

  const score = (patterns) => patterns.filter((pattern) => pattern.test(head)).length;

  const sds = score([
    /safety data sheet|sicherheitsdatenblatt|güvenlik bilgi formu|паспорт безопасности/i,
    /section\s*\d|abschnitt\s*\d|bölüm\s*\d/i,
    /\bH\d{3}\b/, /\bP\d{3}\b/,
    /1907\/2006|reach/i,
    /hazard statement|gefahrenhinweis/i,
  ]);

  const tds = score([
    /technical data sheet|technisches merkblatt|teknik bilgi/i,
    /mixing ratio|mischungsverhältnis|karışım oranı/i,
    /application|verarbeitung|uygulama/i,
    /substrate|untergrund|yüzey/i,
    /drying|trocknung|kuruma/i,
    /spray viscosity|spritzviskosität|pot life|topfzeit/i,
  ]);

  if (sds >= 3 && sds > tds) return { documentType: "sds", confidence: "content" };
  if (tds >= 2 && tds >= sds) return { documentType: "tds", confidence: "content" };
  if (sds >= 2) return { documentType: "sds", confidence: "content" };

  // Fall back to the manufacturer's own filing only when the content is
  // inconclusive, and say so.
  if (/\/MSDS\//i.test(entry.sourceUrl)) return { documentType: "sds", confidence: "folder-fallback" };
  if (/\/TDS\//i.test(entry.sourceUrl)) return { documentType: "tds", confidence: "folder-fallback" };
  return { documentType: "unclassified", confidence: undefined };
}

const seenHashes = new Map();

const documents = downloaded.map((entry) => {
  const classified = entry.error ? {} : classify(entry);
  const extracted = firstPages.get(entry.localPath);
  const duplicateOf = entry.sha256 ? seenHashes.get(entry.sha256) : undefined;
  if (entry.sha256 && !duplicateOf) seenHashes.set(entry.sha256, entry.fileName);

  return {
    ...entry,
    regions: [...entry.regions],
    labels: [...entry.labels].filter(Boolean),
    documentType: classified.documentType,
    classificationConfidence: classified.confidence,
    // Kept so a disputed classification can be audited without reopening the PDF.
    classificationEvidence: extracted?.text?.replace(/\s+/g, " ").slice(0, 200),
    pageCount: extracted?.pages,
    internalTitle: extracted?.meta?.Title?.trim() || undefined,
    duplicateOfFileName: duplicateOf,
    manufacturer: "BASF Coatings GmbH",
    brand: "NORBIN",
    published: false,
  };
});

const byType = {};
for (const entry of documents) byType[entry.documentType ?? "(failed)"] = (byType[entry.documentType ?? "(failed)"] ?? 0) + 1;

const unlinked = documents.filter((entry) => entry.availability === "unlinked-in-source");

const summary = {
  generatedAt: accessedAt,
  brand: "NORBIN",
  manufacturer: "BASF Coatings GmbH",
  discovered: byUrl.size,
  downloaded: documents.filter((entry) => entry.localPath && !entry.reused).length,
  reusedFromDisk: documents.filter((entry) => entry.reused).length,
  failed: documents.filter((entry) => entry.error).length,
  distinctByContent: seenHashes.size,
  duplicateFiles: documents.filter((entry) => entry.duplicateOfFileName).length,
  byType,
  classifiedByFolderFallback: documents.filter((entry) => entry.classificationConfidence === "folder-fallback").length,
  unreadable: documents.filter((entry) => entry.documentType === "unreadable").length,
  // Commented out of the manufacturer's own page: recorded, never counted as
  // part of the published offer.
  unlinkedInSource: unlinked.length,
  unlinkedRetrievable: unlinked.filter((entry) => entry.localPath && !entry.error).length,
  unlinkedMissing: unlinked.filter((entry) => entry.error).length,
  totalBytes: documents.reduce((total, entry) => total + (entry.bytes ?? 0), 0),
  codesWithTds: new Set(documents.filter((entry) => entry.documentType === "tds" && entry.code).map((entry) => entry.code)).size,
  codesWithSds: new Set(documents.filter((entry) => entry.documentType === "sds" && entry.code).map((entry) => entry.code)).size,
  stagingDirectory: OUT_DIR,
  published: false,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ summary, documents }, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
